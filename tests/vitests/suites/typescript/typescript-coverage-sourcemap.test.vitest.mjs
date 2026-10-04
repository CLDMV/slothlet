/**
 *
 *	@Project: @cldmv/slothlet
 *	@Filename: /tests/vitests/suites/typescript/typescript-coverage-sourcemap.test.vitest.mjs
 *	@Date: 2026-09-28T00:00:00-07:00 (1790578800)
 *	@Author: Shinrai <CLDMV>
 *	@Email: <Shinrai@users.noreply.github.com>
 *	-----
 *	@Last modified by: Shinrai <CLDMV> (Shinrai@users.noreply.github.com)
 *	@Last modified time: 2026-10-03T22:15:23-07:00 (1791090923)
 *	-----
 *	@Copyright: Copyright (c) 2013-2026 Catalyzed Motivation Inc. All rights reserved.
 *
 */

/**
 * @fileoverview TypeScript source maps during a coverage run (#484).
 *
 * @description
 * A TypeScript leaf executes from its `.slothlet-cache/` copy, so coverage can only land on the
 * `.ts` source through the copy's inline source map. When `typescript.sourcemap` is not set,
 * slothlet turns it on for a coverage run — a vitest coverage run (the worker global the #235
 * hint already reads) or a native/c8 run (`NODE_V8_COVERAGE`). An explicit `sourcemap: false`
 * wins, and then a one-shot `WARNING_COVERAGE_TS_SOURCEMAP_OFF` says the TS coverage can't reach
 * the source (silenced by `silent`).
 *
 * @module tests/vitests/suites/typescript/typescript-coverage-sourcemap.test.vitest
 */

import { describe, it, expect, beforeAll, afterAll } from "vitest";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath, pathToFileURL } from "node:url";
import { writeFile, rm, mkdir, readdir, readFile } from "node:fs/promises";
import { makeTestTmpDir } from "../../setup/test-fixtures-tmp.mjs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(__dirname, "../../../..");

const WARNING_CODE = "WARNING_COVERAGE_TS_SOURCEMAP_OFF";
const COVERAGE_WORKER = { config: { coverage: { enabled: true, provider: "v8" } } };
const PLAIN_WORKER = { config: { coverage: { enabled: false } } };

let root;
let apiDir;
let leafPath;

beforeAll(async () => {
	root = await makeTestTmpDir("ts-coverage-sourcemap");
	apiDir = path.join(root, "api");
	await mkdir(apiDir, { recursive: true });
	leafPath = path.join(apiDir, "boom.ts");
	await writeFile(
		leafPath,
		[
			"export function boom(label: string): never {",
			"\tconst message: string = `boom-484:${label}`;",
			"\tthrow new Error(message);",
			"}",
			""
		].join("\n"),
		"utf8"
	);
	// A second TS leaf, so the one-shot warning is proven to fire once per instance, not per leaf.
	await writeFile(path.join(apiDir, "other.ts"), "export function other(): number {\n\treturn 484;\n}\n", "utf8");
});

afterAll(async () => {
	if (root) await rm(root, { recursive: true, force: true });
});

describe("coverage-run detection", () => {
	it("detects a vitest coverage run from the worker global", async () => {
		const { isCoverageRun } = await import("@cldmv/slothlet/processors/loader");
		expect(isCoverageRun({ worker: COVERAGE_WORKER, env: {} })).toBe(true);
	});

	it("detects a native/c8 run from NODE_V8_COVERAGE", async () => {
		const { isCoverageRun } = await import("@cldmv/slothlet/processors/loader");
		expect(isCoverageRun({ worker: null, env: { NODE_V8_COVERAGE: "/some/dir" } })).toBe(true);
	});

	it("reports no coverage run for a plain test run or plain process", async () => {
		const { isCoverageRun } = await import("@cldmv/slothlet/processors/loader");
		expect(isCoverageRun({ worker: PLAIN_WORKER, env: {} })).toBe(false);
		expect(isCoverageRun({ worker: null, env: {} })).toBe(false);
		expect(isCoverageRun({ worker: null, env: { NODE_V8_COVERAGE: "" } })).toBe(false);
		// A malformed worker global means no detection, never a throw.
		expect(isCoverageRun({ worker: { config: null }, env: {} })).toBe(false);
	});
});

describe("resolveSourcemap", () => {
	it("turns source maps on under a coverage run when sourcemap is not set", async () => {
		const { resolveSourcemap } = await import("@cldmv/slothlet/processors/loader");
		expect(resolveSourcemap({ enabled: true, mode: "fast" }, { worker: COVERAGE_WORKER, env: {} })).toBe(true);
		expect(resolveSourcemap({ enabled: true, mode: "fast", sourcemap: null }, { worker: null, env: { NODE_V8_COVERAGE: "/x" } })).toBe(
			true
		);
	});

	it("leaves source maps off outside a coverage run when sourcemap is not set", async () => {
		const { resolveSourcemap } = await import("@cldmv/slothlet/processors/loader");
		expect(resolveSourcemap({ enabled: true, mode: "fast" }, { worker: PLAIN_WORKER, env: {} })).toBe(false);
	});

	it("lets an explicit sourcemap value win over detection", async () => {
		const { resolveSourcemap } = await import("@cldmv/slothlet/processors/loader");
		expect(resolveSourcemap({ enabled: true, mode: "fast", sourcemap: false }, { worker: COVERAGE_WORKER, env: {} })).toBe(false);
		expect(resolveSourcemap({ enabled: true, mode: "fast", sourcemap: true }, { worker: null, env: {} })).toBe(true);
	});

	it("keeps an unset sourcemap unset through config normalization", async () => {
		const { Config } = await import("@cldmv/slothlet/helpers/config");
		const { SlothletError, SlothletWarning } = await import("@cldmv/slothlet/errors");
		const cfg = new Config({
			config: {},
			debug: () => {},
			SlothletError,
			SlothletWarning,
			helpers: { resolver: { resolvePathFromCaller: (dir) => dir } }
		});
		expect(cfg.normalizeTypeScript({ mode: "fast" }).sourcemap).toBeNull();
		expect(cfg.normalizeTypeScript({ mode: "fast", sourcemap: false }).sourcemap).toBe(false);
	});
});

describe("warnIfCoverageWithoutSourcemap", () => {
	/**
	 * Run the decision helper with captured warnings.
	 * @param {object} config - Instance config under test.
	 * @param {object} overrides - Injected environment inputs.
	 * @returns {Promise<{fired: boolean, captured: number}>} Whether it warned and how many captures.
	 */
	async function probe(config, overrides) {
		const { warnIfCoverageWithoutSourcemap } = await import("@cldmv/slothlet/processors/loader");
		const { SlothletWarning } = await import("@cldmv/slothlet/errors");
		SlothletWarning.clearCaptured();
		const prior = SlothletWarning.suppressConsole;
		SlothletWarning.suppressConsole = true;
		try {
			const fired = warnIfCoverageWithoutSourcemap(config, overrides);
			return { fired, captured: SlothletWarning.captured.filter((w) => w.code === WARNING_CODE).length };
		} finally {
			SlothletWarning.suppressConsole = prior;
			SlothletWarning.clearCaptured();
		}
	}

	const OFF = { typescript: { enabled: true, mode: "fast", sourcemap: false } };

	it("warns under a coverage run with sourcemap explicitly off", async () => {
		expect(await probe(OFF, { worker: COVERAGE_WORKER, env: {} })).toEqual({ fired: true, captured: 1 });
		expect(await probe(OFF, { worker: null, env: { NODE_V8_COVERAGE: "/x" } })).toEqual({ fired: true, captured: 1 });
	});

	it("stays silent outside a coverage run", async () => {
		expect(await probe(OFF, { worker: PLAIN_WORKER, env: {} })).toEqual({ fired: false, captured: 0 });
	});

	it("stays silent when sourcemap is on or unset (auto-on)", async () => {
		const on = { typescript: { enabled: true, mode: "fast", sourcemap: true } };
		const unset = { typescript: { enabled: true, mode: "fast", sourcemap: null } };
		expect((await probe(on, { worker: COVERAGE_WORKER, env: {} })).fired).toBe(false);
		expect((await probe(unset, { worker: COVERAGE_WORKER, env: {} })).fired).toBe(false);
	});

	it("respects silent instances", async () => {
		expect(await probe({ ...OFF, silent: true }, { worker: COVERAGE_WORKER, env: {} })).toEqual({ fired: false, captured: 0 });
	});
});

describe("a real NODE_V8_COVERAGE process", () => {
	/**
	 * Boot slothlet against the fixture in a child process, call both leaves, and shut down.
	 * @param {object} options - Child options.
	 * @param {object} options.typescript - The `typescript` config to boot with.
	 * @param {boolean} [options.silent=false] - Boot the instance silent.
	 * @param {string|null} options.coverageDir - NODE_V8_COVERAGE for the child, or null for none.
	 * @returns {{stdout: string, stderr: string}} The child's output (stdout carries the error stack).
	 */
	function runChild({ typescript, silent = false, coverageDir }) {
		const script = [
			`import slothlet from ${JSON.stringify(pathToFileURL(path.join(REPO_ROOT, "index.mjs")).href)};`,
			`const api = await slothlet({ dir: ${JSON.stringify(apiDir)}, mode: "eager", silent: ${silent}, typescript: ${JSON.stringify(typescript)} });`,
			`await api.other();`,
			`try { await api.boom("x"); } catch (error) { process.stdout.write(String(error.stack)); }`,
			`await api.slothlet.shutdown();`
		].join("\n");
		const scriptPath = path.join(root, `child-${Date.now()}-${Math.random().toString(36).slice(2)}.mjs`);
		const env = { ...process.env };
		delete env.NODE_V8_COVERAGE;
		if (coverageDir) env.NODE_V8_COVERAGE = coverageDir;
		return (async () => {
			await writeFile(scriptPath, script, "utf8");
			const result = spawnSync(process.execPath, ["--enable-source-maps", scriptPath], {
				cwd: REPO_ROOT,
				env,
				encoding: "utf8",
				timeout: 90000
			});
			expect(result.status, result.stderr).toBe(0);
			return { stdout: result.stdout, stderr: result.stderr };
		})();
	}

	it("inlines the map automatically and the coverage output maps the cache copy to the .ts source", async () => {
		const coverageDir = path.join(root, "v8-auto");
		const { stdout, stderr } = await runChild({ typescript: { mode: "fast" }, coverageDir });
		expect(stdout).toContain("boom-484:x");
		expect(stdout, "stack frame remapped through the inline map").toContain(`${leafPath}:3`);
		expect(stderr).not.toContain(WARNING_CODE);

		// Node records each loaded module's source map into the coverage output (`source-map-cache`),
		// which c8 uses to remap. The cache copy's entry must name the .ts source.
		const sources = [];
		for (const name of await readdir(coverageDir)) {
			const data = JSON.parse(await readFile(path.join(coverageDir, name), "utf8"));
			for (const [key, entry] of Object.entries(data["source-map-cache"] ?? {})) {
				if (key.includes(".slothlet-cache")) sources.push(...(entry.data?.sources ?? []));
			}
		}
		expect(sources.some((source) => source === leafPath || source === pathToFileURL(leafPath).href)).toBe(true);
	}, 90000);

	it("keeps source maps off when sourcemap is explicitly false, and warns once", async () => {
		const { stdout, stderr } = await runChild({ typescript: { mode: "fast", sourcemap: false }, coverageDir: path.join(root, "v8-off") });
		expect(stdout).toContain("boom-484:x");
		expect(stdout).not.toContain(leafPath);
		expect(stderr.split(WARNING_CODE).length - 1, "one warning for two TS leaves").toBe(1);
	}, 90000);

	it("does not warn a silent instance", async () => {
		const { stderr } = await runChild({
			typescript: { mode: "fast", sourcemap: false },
			silent: true,
			coverageDir: path.join(root, "v8-silent")
		});
		expect(stderr).not.toContain(WARNING_CODE);
	}, 90000);

	it("leaves source maps off without a coverage run", async () => {
		const { stdout, stderr } = await runChild({ typescript: { mode: "fast" }, coverageDir: null });
		expect(stdout).toContain("boom-484:x");
		expect(stdout).not.toContain(leafPath);
		expect(stderr).not.toContain(WARNING_CODE);
	}, 90000);
});
