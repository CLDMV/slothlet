/**
 *
 *	@Project: @cldmv/slothlet
 *	@Filename: /tests/vitests/suites/helpers/coverage-file.test.vitest.mjs
 *	@Date: 2026-11-25T11:33:57-08:00 (1795635237)
 *	@Author: Nate Corcoran <CLDMV>
 *	@Email: <Shinrai@users.noreply.github.com>
 *	-----
 *	@Last modified by: Nate Corcoran <CLDMV> (Shinrai@users.noreply.github.com)
 *	@Last modified time: 2026-11-25T11:42:35-08:00 (1795635755)
 *	-----
 *	@Copyright: Copyright (c) 2013-2026 Catalyzed Motivation Inc. All rights reserved.
 *
 */

/**
 * @fileoverview `npm run coverage:file` (tools/coverage/coverage-file.mjs): argument parsing, loading the
 * coverage index (explicit file, local index for HEAD, published index) and looking up the tests that reach
 * a source file or one of its functions, against a fixture index and a stubbed fetch.
 */

import { describe, it, expect, afterEach } from "vitest";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
	parseArgs,
	toIndexPath,
	loadIndex,
	lookupTests,
	staleWarning,
	validateIndex,
	CoverageFileError,
	LOCAL_INDEX,
	PUBLISHED_BASE_URL
} from "../../../../tools/coverage/coverage-file.mjs";
import { makeTestTmpDirSync } from "../../setup/test-fixtures-tmp.mjs";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const FIXTURE = path.join(HERE, "fixtures", "coverage-file", "coverage-index.json");
const PROJECT_ROOT = path.resolve(HERE, "../../../..");
const FIXTURE_COMMIT = "1111111111111111111111111111111111111111";
const fixture = () => JSON.parse(fs.readFileSync(FIXTURE, "utf8"));

/**
 * A fetch stand-in that records the URLs asked for.
 * @param {{ status?: number, body?: unknown, error?: Error }} reply
 * @returns {{ fetchImpl: typeof fetch, urls: string[] }}
 */
function stubFetch({ status = 200, body = null, error = null }) {
	const urls = [];
	const fetchImpl = async (url) => {
		urls.push(String(url));
		if (error) throw error;
		return { ok: status >= 200 && status < 300, status, json: async () => body };
	};
	return { fetchImpl, urls };
}

describe("coverage:file argument parsing", () => {
	it("takes one source file and defaults to the next branch", () => {
		expect(parseArgs(["src/a.mjs"])).toEqual({
			help: false,
			file: "src/a.mjs",
			fn: null,
			branch: "next",
			index: null,
			dryRun: false,
			passthrough: []
		});
	});

	it("reads --fn, --branch and --index in both spellings", () => {
		const spaced = parseArgs(["src/a.mjs", "--fn", "run", "--branch", "master", "--index", "x.json", "--dry-run"]);
		const joined = parseArgs(["--fn=run", "--branch=master", "--index=x.json", "--dry-run", "src/a.mjs"]);
		for (const parsed of [spaced, joined]) {
			expect(parsed).toMatchObject({ file: "src/a.mjs", fn: "run", branch: "master", index: "x.json", dryRun: true });
		}
	});

	it("passes everything after -- on to coverage:node", () => {
		expect(parseArgs(["src/a.mjs", "--", "--workers", "2", "--fn"]).passthrough).toEqual(["--workers", "2", "--fn"]);
	});

	it("rejects an unknown branch, an unknown flag, a missing value and a second file", () => {
		expect(() => parseArgs(["src/a.mjs", "--branch", "dev"])).toThrow(/Unknown branch "dev"/);
		expect(() => parseArgs(["src/a.mjs", "--verbose"])).toThrow(/Unknown option --verbose/);
		expect(() => parseArgs(["src/a.mjs", "--fn"])).toThrow(/--fn needs a value/);
		expect(() => parseArgs(["src/a.mjs", "--fn", "--dry-run"])).toThrow(/--fn needs a value/);
		expect(() => parseArgs(["src/a.mjs", "src/b.mjs"])).toThrow(/One source file at a time/);
		expect(() => parseArgs(["--bogus"])).toThrow(CoverageFileError);
	});

	it("recognises --help", () => {
		expect(parseArgs(["-h"]).help).toBe(true);
		expect(parseArgs(["--help"]).help).toBe(true);
	});
});

describe("coverage:file source path", () => {
	it("keys the file as the index does: project-relative, forward slashes", () => {
		expect(toIndexPath("./src/lib/helpers/../helpers/module-sort.mjs", { root: PROJECT_ROOT, cwd: PROJECT_ROOT })).toBe(
			"src/lib/helpers/module-sort.mjs"
		);
		expect(toIndexPath(path.join(PROJECT_ROOT, "src/slothlet.mjs"), { root: PROJECT_ROOT })).toBe("src/slothlet.mjs");
	});

	it("refuses an unknown file, a folder and a path outside the project", () => {
		expect(() => toIndexPath("src/no-such-file.mjs", { root: PROJECT_ROOT, cwd: PROJECT_ROOT })).toThrow(/No such file/);
		expect(() => toIndexPath("src/lib", { root: PROJECT_ROOT, cwd: PROJECT_ROOT })).toThrow(/No such file/);
		expect(() => toIndexPath("../outside.mjs", { root: PROJECT_ROOT, cwd: PROJECT_ROOT })).toThrow(/outside the project/);
	});
});

describe("coverage:file index lookup", () => {
	it("lists every test that reaches any function of the file, sorted and unique", () => {
		expect(lookupTests(fixture(), "src/lib/helpers/module-sort.mjs")).toEqual({
			tests: ["tests/vitests/suites/modules/coverage-gaps.test.vitest.mjs", "tests/vitests/suites/modules/sort.test.vitest.mjs"],
			functions: ["sortModules", "defaultModuleComparator"]
		});
	});

	it("narrows to one function", () => {
		expect(lookupTests(fixture(), "src/lib/helpers/module-sort.mjs", "sortModules").tests).toEqual([
			"tests/vitests/suites/modules/sort.test.vitest.mjs"
		]);
	});

	it("matches every name@line entry for a bare repeated name, and one entry for name@line", () => {
		expect(lookupTests(fixture(), "src/lib/helpers/segments.mjs", "join")).toEqual({
			tests: ["tests/vitests/suites/modules/sort.test.vitest.mjs", "tests/vitests/suites/rules/rule-coverage.test.vitest.mjs"],
			functions: ["join@12", "join@40"]
		});
		expect(lookupTests(fixture(), "src/lib/helpers/segments.mjs", "join@40").tests).toEqual([
			"tests/vitests/suites/modules/sort.test.vitest.mjs"
		]);
	});

	it("returns no tests for a function nothing reached", () => {
		expect(lookupTests(fixture(), "src/lib/helpers/segments.mjs", "segmentsOf")).toEqual({ tests: [], functions: ["segmentsOf"] });
	});

	it("says so when the file or the function isn't in the index", () => {
		expect(() => lookupTests(fixture(), "src/lib/helpers/config.mjs")).toThrow(
			/src\/lib\/helpers\/config\.mjs is not in the coverage index/
		);
		expect(() => lookupTests(fixture(), "src/lib/helpers/module-sort.mjs", "nope")).toThrow(
			/has no function "nope" in the index\. Known: sortModules, defaultModuleComparator/
		);
	});
});

describe("coverage:file stale index", () => {
	it("warns when the index is for another commit, and stays quiet for HEAD", () => {
		expect(staleWarning({ commit: FIXTURE_COMMIT }, FIXTURE_COMMIT)).toBeNull();
		expect(staleWarning({ commit: FIXTURE_COMMIT }, "2".repeat(40))).toMatch(/index is for 111111111111, HEAD is 222222222222/);
		expect(staleWarning({ commit: null }, "2".repeat(40))).toMatch(/records no commit/);
		expect(staleWarning({ commit: FIXTURE_COMMIT }, null)).toBeNull();
	});
});

describe("coverage:file loading the index", () => {
	let root = null;
	afterEach(() => {
		if (root) fs.rmSync(root, { recursive: true, force: true });
		root = null;
	});

	/**
	 * A throwaway project root with a local index for `commit`.
	 * @param {string} commit
	 * @returns {string}
	 */
	const withLocalIndex = (commit) => {
		root = makeTestTmpDirSync("coverage-file");
		fs.mkdirSync(path.join(root, "coverage"));
		fs.writeFileSync(path.join(root, LOCAL_INDEX), JSON.stringify({ ...fixture(), commit }));
		return root;
	};

	it("reads --index without looking anywhere else", async () => {
		const { fetchImpl, urls } = stubFetch({ status: 500 });
		const { index, source } = await loadIndex({ index: FIXTURE, fetchImpl, head: "x" });
		expect(source).toBe(FIXTURE);
		expect(index.commit).toBe(FIXTURE_COMMIT);
		expect(urls).toEqual([]);
	});

	it("refuses a missing --index file and one that isn't an index", async () => {
		await expect(loadIndex({ index: "tmp/does-not-exist.json" })).rejects.toThrow(/Index not found/);
		expect(() => validateIndex({ version: 2, files: {} }, "x.json")).toThrow(/x\.json is not a version 1 coverage index/);
		expect(() => validateIndex([], "x.json")).toThrow(CoverageFileError);
	});

	it("uses the local index when it was written for HEAD", async () => {
		const { fetchImpl, urls } = stubFetch({ status: 500 });
		const { source } = await loadIndex({ root: withLocalIndex("a".repeat(40)), head: "a".repeat(40), fetchImpl });
		expect(source).toBe(LOCAL_INDEX);
		expect(urls).toEqual([]);
	});

	it("fetches the branch's published index when the local one is for another commit", async () => {
		const { fetchImpl, urls } = stubFetch({ body: fixture() });
		const { source } = await loadIndex({ root: withLocalIndex("a".repeat(40)), head: "b".repeat(40), branch: "master", fetchImpl });
		expect(urls).toEqual([`${PUBLISHED_BASE_URL}/coverage-index.json`]);
		expect(source).toBe(urls[0]);
	});

	it("names the published file per branch", async () => {
		root = makeTestTmpDirSync("coverage-file");
		for (const [branch, name] of [
			["next", "coverage-index-next.json"],
			["hotfixes", "coverage-index-hotfixes.json"]
		]) {
			const { fetchImpl, urls } = stubFetch({ body: fixture() });
			await loadIndex({ root, branch, fetchImpl });
			expect(urls).toEqual([`${PUBLISHED_BASE_URL}/${name}`]);
		}
	});

	it("falls back to an older local index when nothing is published", async () => {
		const { fetchImpl } = stubFetch({ status: 404 });
		const { index, source } = await loadIndex({ root: withLocalIndex("a".repeat(40)), head: "b".repeat(40), fetchImpl });
		expect(index.commit).toBe("a".repeat(40));
		expect(source).toMatch(/^coverage\/coverage-index\.json \(No published index at .*HTTP 404/);
	});

	it("fails clearly with no local index and no published one", async () => {
		root = makeTestTmpDirSync("coverage-file");
		await expect(loadIndex({ root, fetchImpl: stubFetch({ status: 404 }).fetchImpl })).rejects.toThrow(
			/No published index at .*coverage-index-next\.json \(HTTP 404\)\. Pass --index <path>/
		);
		await expect(loadIndex({ root, fetchImpl: stubFetch({ error: new Error("offline") }).fetchImpl })).rejects.toThrow(
			/Couldn't fetch .*: offline/
		);
		await expect(loadIndex({ root, fetchImpl: stubFetch({ body: { version: 1 } }).fetchImpl })).rejects.toThrow(
			/not a version 1 coverage index/
		);
	});
});
