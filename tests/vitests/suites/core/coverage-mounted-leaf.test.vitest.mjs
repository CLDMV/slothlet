/**
 *
 *	@Project: @cldmv/slothlet
 *	@Filename: tests/vitests/suites/core/coverage-mounted-leaf.test.vitest.mjs
 *	@Date: 2026-11-28T00:00:00-08:00 (1795852800)
 *	@Author: Nate Corcoran <CLDMV>
 *	@Email: <Shinrai@users.noreply.github.com>
 *	-----
 *	@Last modified by: Nate Corcoran <CLDMV> (Shinrai@users.noreply.github.com)
 *	@Last modified time: 2026-11-28T04:31:36-08:00 (1795869096)
 *	-----
 *	@Copyright: Copyright (c) 2013-2026 Catalyzed Motivation Inc. All rights reserved.
 *
 */

/**
 * @fileoverview Coverage of a mounted module's leaves (#1042) and of helper copies (#1043) in a consumer's vitest run.
 *
 * @description
 * A leaf of a module mounted with `api.slothlet.api.add()` loads under
 * `<file>?slothlet_instance=<id>&module=<moduleID>`. `@vitest/coverage-v8` decodes the whole script URL before it
 * remaps it, and vite then takes the last `/` of that id as the file's name. A moduleID with a `/` in it (a package
 * name such as `@scope/pkg`) used to come out of that decode with its `/` back, so the coverage landed on a file named
 * after the end of the moduleID, which does not exist, and the leaf read 0%.
 *
 * Each case runs a consumer project's own vitest coverage run in a child process, with slothlet externalized the way a
 * consumer's `node_modules` copy is, and reads the leaf's statements from the report.
 *
 * @module tests/vitests/suites/core/coverage-mounted-leaf.test.vitest
 */

import { describe, it, expect, beforeAll, afterAll } from "vitest";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { writeFile, rm, mkdir, readFile, symlink } from "node:fs/promises";
import { makeTestTmpDir } from "../../setup/test-fixtures-tmp.mjs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(__dirname, "../../../..");
const VITEST_BIN = path.join(REPO_ROOT, "node_modules", "vitest", "vitest.mjs");

let root;

beforeAll(async () => {
	root = await makeTestTmpDir("coverage-mounted-leaf");
	await mkdir(path.join(root, "api"), { recursive: true });
	await mkdir(path.join(root, "mod"), { recursive: true });
	await mkdir(path.join(root, "test"), { recursive: true });
	await mkdir(path.join(root, "lib"), { recursive: true });
	await mkdir(path.join(root, "node_modules", "@cldmv"), { recursive: true });
	await symlink(REPO_ROOT, path.join(root, "node_modules", "@cldmv", "slothlet"), "dir");
	await writeFile(path.join(root, "package.json"), JSON.stringify({ name: "coverage-mounted-leaf", private: true, type: "module" }));
	await writeFile(path.join(root, "api", "hello.mjs"), 'export function hello() {\n\treturn "hello";\n}\n');
	// A helper the root module's leaf imports: under `helpers: "module"` it loads once per api file, as a copy that names
	// the api file in its URL (#1043).
	await writeFile(
		path.join(root, "api", "counted.mjs"),
		'import { count } from "../lib/count.mjs";\nexport function counted(n) {\n\treturn count(n);\n}\n'
	);
	await writeFile(
		path.join(root, "lib", "count.mjs"),
		'export function count(n) {\n\tconst doubled = n * 2;\n\tconst label = `count:${doubled}`;\n\tconst parts = label.split(":");\n\treturn parts[1];\n}\n'
	);
	await writeFile(
		path.join(root, "mod", "root.mjs"),
		'export function run(n) {\n\tconst doubled = n * 2;\n\tconst label = `value:${doubled}`;\n\tconst parts = label.split(":");\n\treturn parts[1];\n}\n'
	);
	await writeFile(
		path.join(root, "test", "mounted.test.mjs"),
		[
			'import { it, expect } from "vitest";',
			'import path from "node:path";',
			'import slothlet from "@cldmv/slothlet";',
			'it("calls a leaf of a mounted module", async () => {',
			'\tconst root = path.resolve(import.meta.dirname, "..");',
			'\tconst api = await slothlet({ base: path.join(root, "api"), silent: true, helpers: process.env.HELPERS || "instance" });',
			'\tawait api.slothlet.api.add("ext", path.join(root, "mod"), { id: process.env.MOUNT_ID });',
			'\texpect(await api.ext.root.run(2)).toBe("4");',
			'\texpect(await api.counted(2)).toBe("4");',
			"\tawait api.shutdown();",
			"});",
			""
		].join("\n")
	);
	// The symlink resolves to this checkout, outside any node_modules, which vitest would inline as project source;
	// `external` keeps slothlet native, as it is for a consumer (this project sits under the checkout's tmp/, which stays
	// project source).
	await writeFile(
		path.join(root, "vitest.config.mjs"),
		[
			'import { defineConfig } from "vitest/config";',
			`const REPO = ${JSON.stringify(REPO_ROOT + path.sep)};`,
			'const escaped = REPO.replace(/[.*+?^${}()|[\\]\\\\]/g, "\\\\$&");',
			"export default defineConfig({",
			"\ttest: {",
			'\t\tinclude: ["test/**/*.test.mjs"],',
			'\t\texecArgv: ["--conditions=slothlet-dev"],',
			"\t\tserver: {",
			"\t\t\tdeps: process.env.SLOTHLET_INLINE",
			"\t\t\t\t? { inline: [/@cldmv\\/slothlet/, new RegExp(`^${escaped}(?!tmp[\\\\/])`)] }",
			"\t\t\t\t: { external: [new RegExp(`^${escaped}(?!tmp[\\\\/])`), /[\\\\/]@cldmv[\\\\/]slothlet[\\\\/]/] }",
			"\t\t},",
			'\t\tcoverage: { enabled: true, provider: "v8", include: ["mod/**", "lib/**"], reporter: ["json"], reportsDirectory: process.env.COV_DIR }',
			"\t}",
			"});",
			""
		].join("\n")
	);
});

afterAll(async () => {
	if (root) await rm(root, { recursive: true, force: true });
});

/**
 * Run the consumer's coverage run and read one file's statements.
 * @param {string} mountID - The moduleID the mounted module is mounted under.
 * @param {boolean} inline - Whether the run inlines slothlet (`server.deps.inline`) instead of keeping it external.
 * @param {object} [options] - What to run and read.
 * @param {string} [options.file="mod/root.mjs"] - The file to read, relative to the consumer project.
 * @param {"instance"|"module"} [options.helpers="instance"] - The instance's `helpers` option.
 * @returns {Promise<{status: number|null, output: string, covered: number|null, total: number|null, missed: number[]|null, files: string[]|null}>}
 *   The run, and the lines of the file's statements it did not reach.
 */
async function coverageFor(mountID, inline, { file = "mod/root.mjs", helpers = "instance" } = {}) {
	const covDir = path.join(root, `coverage-${inline ? "inline" : "external"}-${helpers}-${mountID.replace(/[^a-z0-9]/gi, "_")}`);
	const env = {};
	for (const [key, value] of Object.entries(process.env)) {
		// The parent run's own vitest / coverage settings must not reach the child run.
		if (/^(VITEST|NODE_V8_COVERAGE$|NODE_OPTIONS$|TINYPOOL)/.test(key)) continue;
		env[key] = value;
	}
	const result = spawnSync(process.execPath, [VITEST_BIN, "run", "--root", root], {
		cwd: root,
		env: { ...env, MOUNT_ID: mountID, COV_DIR: covDir, SLOTHLET_INLINE: inline ? "1" : "", HELPERS: helpers },
		encoding: "utf8",
		timeout: 180_000
	});
	const output = `${result.stdout ?? ""}${result.stderr ?? ""}`;
	let report = null;
	try {
		report = JSON.parse(await readFile(path.join(covDir, "coverage-final.json"), "utf8"));
	} catch {
		// No report: the run failed, and `output` says why.
	}
	const suffix = `${path.sep}${file.split("/").join(path.sep)}`;
	const entry = report && Object.entries(report).find(([name]) => name.endsWith(suffix))?.[1];
	const counts = entry ? Object.values(entry.s) : null;
	const missed = entry
		? Object.entries(entry.s)
				.filter(([, n]) => n === 0)
				.map(([id]) => entry.statementMap[id].start.line)
		: null;
	return {
		status: result.status,
		output,
		covered: counts && counts.filter((n) => n > 0).length,
		total: counts && counts.length,
		missed,
		files: report && Object.keys(report)
	};
}

describe("coverage of a mounted module's leaf (#1042)", () => {
	it("attributes a leaf the same whether or not its moduleID has a / in it (slothlet externalized)", async () => {
		const scoped = await coverageFor("@scope/pkg", false);
		const plain = await coverageFor("plain-pkg", false);
		expect(scoped.status, scoped.output).toBe(0);
		expect(plain.status, plain.output).toBe(0);
		// Externalized, Node runs the leaf's own source while the provider maps it through vite's transform of the file,
		// so a statement can be lost (see docs/TESTING.md); the moduleID must not change which.
		expect(plain.covered).toBeGreaterThan(0);
		expect({ covered: scoped.covered, missed: scoped.missed }).toEqual({ covered: plain.covered, missed: plain.missed });
	}, 240_000);

	it("attributes every statement of the leaf with slothlet inlined, for a moduleID with a / in it", async () => {
		const run = await coverageFor("@scope/pkg", true);
		expect(run.status, run.output).toBe(0);
		expect(run.total, JSON.stringify(run.files)).toBe(4);
		expect(run.covered, JSON.stringify({ missed: run.missed, files: run.files })).toBe(run.total);
	}, 240_000);
});

describe("coverage of a helper copy loaded once per api file (#1043)", () => {
	it("attributes a helper copy the same as the helper loaded once per instance (slothlet externalized)", async () => {
		const perFile = await coverageFor("plain-pkg", false, { file: "lib/count.mjs", helpers: "module" });
		const perInstance = await coverageFor("plain-pkg", false, { file: "lib/count.mjs", helpers: "instance" });
		expect(perFile.status, perFile.output).toBe(0);
		expect(perInstance.status, perInstance.output).toBe(0);
		expect(perInstance.covered).toBeGreaterThan(0);
		expect({ covered: perFile.covered, missed: perFile.missed }).toEqual({ covered: perInstance.covered, missed: perInstance.missed });
	}, 240_000);

	it("attributes every statement of a helper copy with slothlet inlined", async () => {
		const run = await coverageFor("plain-pkg", true, { file: "lib/count.mjs", helpers: "module" });
		expect(run.status, run.output).toBe(0);
		expect(run.total, JSON.stringify(run.files)).toBe(4);
		expect(run.covered, JSON.stringify({ missed: run.missed, files: run.files })).toBe(run.total);
	}, 240_000);
});
