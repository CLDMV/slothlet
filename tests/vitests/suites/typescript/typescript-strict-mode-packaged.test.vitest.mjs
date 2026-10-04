/**
 *
 *	@Project: @cldmv/slothlet
 *	@Filename: /tests/vitests/suites/typescript/typescript-strict-mode-packaged.test.vitest.mjs
 *	@Date: 2026-09-28 09:44:57 -07:00 (1790613897)
 *	@Author: Shinrai <CLDMV>
 *	@Email: <Shinrai@users.noreply.github.com>
 *	-----
 *	@Last modified by: Shinrai <CLDMV> (Shinrai@users.noreply.github.com)
 *	@Last modified time: 2026-10-03 20:04:45 -07:00 (1791083085)
 *	-----
 *	@Copyright: Copyright (c) 2013-2026 Catalyzed Motivation Inc. All rights reserved.
 *
 */

/**
 * @fileoverview Regression (#500): strict TypeScript mode forks a type-generation worker, and that worker
 * must ship in the published package. It lived in `tools/build/` and imported `../../src/...`; neither
 * `tools/` nor `src/` is in `package.json` `files`, so strict mode could only work inside this repo.
 *
 * The worker must sit inside the source tree the build copies into `dist/` (`src/lib/...` →
 * `dist/lib/...`), and import only Node builtins or `@cldmv/slothlet` self-references, which resolve
 * to `src/` under the `slothlet-dev` condition and to `dist/` in an installed package.
 *
 * @module tests/vitests/suites/typescript/typescript-strict-mode-packaged
 */

import { describe, it, expect, afterAll } from "vitest";
import { readFileSync, existsSync } from "node:fs";
import { mkdir, writeFile, rm } from "node:fs/promises";
import { builtinModules } from "node:module";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { typeGenerationWorkerPath } from "@cldmv/slothlet/processors/loader";
import { runTypeGeneration, runIfEntry } from "@cldmv/slothlet/processors/type-generation-worker";
import { makeTestTmpDir } from "../../setup/test-fixtures-tmp.mjs";

const REPO_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../../..");
const LIB_ROOT = path.join(REPO_ROOT, "src", "lib");

describe("strict mode type-generation worker ships with the package (#500)", () => {
	it("forks a worker inside the lib tree the build copies into dist/", () => {
		const workerPath = typeGenerationWorkerPath();
		expect(existsSync(workerPath)).toBe(true);
		const relative = path.relative(LIB_ROOT, workerPath);
		expect(relative.startsWith("..") || path.isAbsolute(relative)).toBe(false);
	});

	it("imports only Node builtins and @cldmv/slothlet self-references", () => {
		const source = readFileSync(typeGenerationWorkerPath(), "utf8");
		const specifiers = [...source.matchAll(/^\s*import\s+(?:[^"']*?\s+from\s+)?["']([^"']+)["']/gm)].map((m) => m[1]);
		expect(specifiers.length).toBeGreaterThan(0);
		const builtins = new Set([...builtinModules, ...builtinModules.map((name) => `node:${name}`)]);
		const unpublished = specifiers.filter((spec) => !builtins.has(spec) && !spec.startsWith("@cldmv/slothlet"));
		expect(unpublished).toEqual([]);
	});

	it("does nothing when imported rather than run as the process's entry script", async () => {
		// Importing the worker (a bundler following the reference, a test, a tool scanning the package)
		// must not start a build or call process.exit on the importer.
		const before = process.exitCode;
		await import(typeGenerationWorkerPath());
		expect(process.exitCode).toBe(before);
	});

	it("is inside the published file list", () => {
		const pkg = JSON.parse(readFileSync(path.join(REPO_ROOT, "package.json"), "utf8"));
		expect(pkg.files).toContain("dist/");
	});
});

describe("type-generation worker, driven in-process (#500)", () => {
	const roots = [];

	afterAll(async () => {
		await Promise.allSettled(roots.map((root) => rm(root, { recursive: true, force: true })));
	});

	/**
	 * A tmp api folder with one leaf, plus the worker config that builds it.
	 * @returns {Promise<{configJson: string, output: string}>}
	 */
	async function workerFixture() {
		const root = await makeTestTmpDir("type-generation-worker");
		roots.push(root);
		const apiDir = path.join(root, "api");
		await mkdir(apiDir, { recursive: true });
		await writeFile(
			path.join(apiDir, "math.mjs"),
			"/** @param {number} a @param {number} b @returns {number} */\nexport function add(a, b) { return a + b; }\n",
			"utf8"
		);
		const output = path.join(root, "types", "api.d.ts");
		const configJson = JSON.stringify({
			base: apiDir,
			mode: "eager",
			silent: true,
			typescript: { enabled: true, mode: "fast" },
			types: { output, interfaceName: "WorkerApi" }
		});
		return { configJson, output };
	}

	it("builds the api, writes the declaration, and reports success", async () => {
		const { configJson, output } = await workerFixture();
		const messages = [];
		const code = await runTypeGeneration(configJson, (message) => messages.push(message));
		expect(code).toBe(0);
		expect(messages).toEqual([{ type: "success" }]);
		expect(readFileSync(output, "utf8")).toContain("interface WorkerApi");
	});

	it("reports an error and exit code 1 when SLOTHLET_CONFIG is missing", async () => {
		const messages = [];
		const code = await runTypeGeneration(undefined, (message) => messages.push(message));
		expect(code).toBe(1);
		expect(messages).toHaveLength(1);
		expect(messages[0].type).toBe("error");
		expect(messages[0].error).toMatch(/SLOTHLET_CONFIG/);
	});

	it("reports an error and exit code 1 when type generation fails", async () => {
		const { configJson } = await workerFixture();
		const broken = JSON.parse(configJson);
		delete broken.types.output;
		const messages = [];
		const code = await runTypeGeneration(JSON.stringify(broken), (message) => messages.push(message));
		expect(code).toBe(1);
		expect(messages[0].type).toBe("error");
	});

	it("works without an IPC channel", async () => {
		const { configJson } = await workerFixture();
		await expect(runTypeGeneration(configJson, undefined)).resolves.toBe(0);
		await expect(runTypeGeneration(undefined, undefined)).resolves.toBe(1);
	});

	it("runs only when the worker is the process's entry script", async () => {
		const exits = [];
		expect(runIfEntry(undefined, "{}", undefined, (code) => exits.push(code))).toBeNull();
		expect(runIfEntry(path.join(REPO_ROOT, "index.mjs"), "{}", undefined, (code) => exits.push(code))).toBeNull();
		expect(exits).toEqual([]);

		const { configJson, output } = await workerFixture();
		const messages = [];
		await runIfEntry(
			typeGenerationWorkerPath(),
			configJson,
			(message) => messages.push(message),
			(code) => exits.push(code)
		);
		expect(exits).toEqual([0]);
		expect(messages).toEqual([{ type: "success" }]);
		expect(readFileSync(output, "utf8")).toContain("interface WorkerApi");
	});
});
