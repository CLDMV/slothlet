/**
 *	@Project: @cldmv/slothlet
 *	@Filename: /tests/vitests/suites/processors/loader.test.vitest.mjs
 *	@Date: 2026-02-23 00:00:00 -08:00
 *	@Author: Nate Hyson <CLDMV>
 *	@Email: <Shinrai@users.noreply.github.com>
 *	-----
 *	@Last modified by: Nate Hyson <CLDMV> (Shinrai@users.noreply.github.com)
 *	@Last modified time: 2026-02-23 21:51:35 -08:00 (1771912295)
 *	-----
 *	@Copyright: Copyright (c) 2013-2026 Catalyzed Motivation Inc. All rights reserved.
 */

/**
 * @fileoverview Integration coverage tests for loader behavior through real slothlet instances.
 * @module tests/vitests/suites/processors/loader.test.vitest
 */

import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { mkdir, writeFile, rm, access } from "node:fs/promises";
import { constants } from "node:fs";
import { join, resolve, dirname } from "node:path";
import slothlet from "@cldmv/slothlet";
import { withSuppressedSlothletErrorOutput } from "../../setup/vitest-helper.mjs";

/**
 * Create a unique temporary fixture directory under the project tmp folder.
 * @returns {string} Absolute fixture directory path.
 */
function createFixtureRoot() {
	return resolve("tmp", `slothlet-loader-real-${Date.now()}-${Math.random().toString(36).slice(2)}`);
}

/**
 * Ensure a directory exists recursively.
 * @param {string} dirPath - Directory path.
 * @returns {Promise<void>} Completion promise.
 */
async function ensureDir(dirPath) {
	await mkdir(dirPath, { recursive: true });
}

/**
 * Write a JavaScript/TypeScript fixture module file.
 * @param {string} filePath - Absolute file path.
 * @param {string} code - Module source code.
 * @returns {Promise<void>} Completion promise.
 */
async function writeModule(filePath, code) {
	await ensureDir(dirname(filePath));
	await writeFile(filePath, code);
}

/**
 * Check whether a file path exists.
 * @param {string} filePath - Absolute path.
 * @returns {Promise<boolean>} True when file exists.
 */
async function fileExists(filePath) {
	try {
		await access(filePath, constants.F_OK);
		return true;
	} catch {
		return false;
	}
}

/**
 * Resolve a callable export regardless of whether it is attached directly or nested.
 * @param {any} value - API value at path.
 * @param {string} key - Nested key fallback for named export shape.
 * @returns {Function|undefined} Callable function when found.
 */
function resolveCallable(value, key) {
	if (value && typeof value[key] === "function") {
		return value[key];
	}
	if (typeof value === "function") {
		return value;
	}
	return undefined;
}

describe("Loader processor (real slothlet integration)", () => {
	let fixtureRoot;
	const activeApis = [];

	beforeEach(async () => {
		fixtureRoot = createFixtureRoot();
		await ensureDir(fixtureRoot);
	});

	afterEach(async () => {
		for (const api of activeApis.splice(0)) {
			if (api?.shutdown) {
				await api.shutdown();
			}
		}
		if (fixtureRoot) {
			await rm(fixtureRoot, { recursive: true, force: true });
		}
	});

	it("returns INVALID_DIRECTORY when initializing from a non-existent root", async () => {
		await withSuppressedSlothletErrorOutput(async () => {
			await expect(
				slothlet({
					dir: join(fixtureRoot, "missing-root"),
					mode: "eager"
				})
			).rejects.toThrow("INVALID_DIRECTORY");
		});
	});

	it("initializes from an empty directory (exercises WARN_DIRECTORY_EMPTY path)", async () => {
		const api = await slothlet({ dir: fixtureRoot, mode: "eager" });
		activeApis.push(api);

		expect(api).toBeDefined();
		expect(api.slothlet).toBeDefined();
	});

	it("loads ESM/CJS export patterns and applies merge/extract rules", async () => {
		await writeModule(join(fixtureRoot, "feature.mjs"), 'export function feature() { return "flattened"; }');
		await writeModule(join(fixtureRoot, "single.mjs"), "export function notMatching() { return 123; }");
		await writeModule(join(fixtureRoot, "onlydefault.mjs"), 'export default function () { return "callable"; }');
		await writeModule(
			join(fixtureRoot, "mixedcallable.mjs"),
			[
				"function callable() {",
				'\treturn "mixed";',
				"}",
				"export default callable;",
				'export const keepAttach = "yes";',
				"export { callable };"
			].join("\n")
		);
		await writeModule(join(fixtureRoot, "mixedobject.mjs"), 'export default { inner: true }; export const extra = "value";');
		await writeModule(join(fixtureRoot, "mixedprimitive.mjs"), 'export default 99; export function named() { return "n"; }');
		await writeModule(
			join(fixtureRoot, "namednamespace.mjs"),
			"export function first() { return 1; } export function second() { return 2; }"
		);
		await writeModule(join(fixtureRoot, "empty.mjs"), "const value = 1;");
		await writeModule(
			join(fixtureRoot, "cjspattern.cjs"),
			"module.exports = { default: { innerDefault: true }, named() { return 'named'; }, cjspattern() { return 'pattern'; } };"
		);

		const api = await slothlet({ dir: fixtureRoot, mode: "eager" });
		activeApis.push(api);

		expect(resolveCallable(api.feature, "feature")?.()).toBe("flattened");
		expect(resolveCallable(api.single, "notMatching")?.()).toBe(123);
		expect(typeof api.onlydefault).toBe("function");
		expect(api.onlydefault()).toBe("callable");

		expect(typeof api.mixedcallable).toBe("function");
		expect(api.mixedcallable()).toBe("mixed");
		expect(api.mixedcallable.keepAttach).toBe("yes");
		expect(api.mixedcallable.callable).toBeUndefined();

		expect(api.mixedobject.inner).toBe(true);
		expect(api.mixedobject.extra).toBe("value");
		expect(api.mixedprimitive.default).toBe(99);
		expect(resolveCallable(api.mixedprimitive, "named")?.()).toBe("n");
		expect(resolveCallable(api.namednamespace, "first")?.()).toBe(1);
		expect(resolveCallable(api.namednamespace, "second")?.()).toBe(2);

		expect(api.empty).toEqual({});
		expect(api.cjspattern.innerDefault).toBe(true);
		expect(typeof api.cjspattern.named).toBe("function");
		expect(api.cjspattern.named()).toBe("named");
		expect(resolveCallable(api.cjspattern, "cjspattern")?.()).toBe("pattern");
	});

	it("uses file-based add() to trigger single-file filter behavior", async () => {
		await writeModule(join(fixtureRoot, "bootstrap.mjs"), 'export function bootstrap() { return "ok"; }');
		await writeModule(join(fixtureRoot, "scope", "keep.mjs"), "export function keep() { return 1; }");
		await writeModule(join(fixtureRoot, "scope", "skip.mjs"), "export function skip() { return 2; }");
		await writeModule(join(fixtureRoot, "scope", "nested", "child.mjs"), "export function child() { return 3; }");

		const api = await slothlet({ dir: fixtureRoot, mode: "eager" });
		activeApis.push(api);

		await api.slothlet.api.add("fileOnly", join(fixtureRoot, "scope", "keep.mjs"));
		expect(resolveCallable(api.fileOnly, "keep")?.()).toBe(1);
		expect(api.fileOnly.skip).toBeUndefined();
		expect(api.fileOnly.nested).toBeUndefined();
	});

	it("skips files prefixed with __ during directory scan", async () => {
		await writeModule(join(fixtureRoot, "__hidden.mjs"), 'export function hidden() { return "hidden"; }');
		await writeModule(join(fixtureRoot, "visible.mjs"), 'export function visible() { return "visible"; }');

		const api = await slothlet({ dir: fixtureRoot, mode: "eager" });
		activeApis.push(api);

		expect(resolveCallable(api.visible, "visible")?.()).toBe("visible");
		expect(api.__hidden).toBeUndefined();
	});

	it("reloads API through public endpoint (exercises cache-bust module import path)", async () => {
		await writeModule(join(fixtureRoot, "reloadable.mjs"), 'export function reloadable() { return "v1"; }');

		const api = await slothlet({ dir: fixtureRoot, mode: "eager" });
		activeApis.push(api);

		expect(api.reloadable).toBeDefined();
		await api.slothlet.api.reload();
		expect(api.reloadable).toBeDefined();
	});

	it("loads TypeScript in fast mode through real initialization", async () => {
		await writeModule(join(fixtureRoot, "fast.ts"), "export function fast() { return 99; }");

		const api = await slothlet({
			dir: fixtureRoot,
			mode: "eager",
			typescript: true
		});
		activeApis.push(api);

		expect(resolveCallable(api.fast, "fast")?.()).toBe(99);
	});

	it("loads TypeScript strict mode and generates declaration output", async () => {
		const typesOutput = join(fixtureRoot, "generated", "api.d.ts");
		await writeModule(join(fixtureRoot, "strict.ts"), "export function strict() { return 7; }");

		const api = await slothlet({
			dir: fixtureRoot,
			mode: "eager",
			typescript: {
				mode: "strict",
				types: {
					output: typesOutput,
					interfaceName: "LoaderStrictAPI"
				}
			}
		});
		activeApis.push(api);

		expect(resolveCallable(api.strict, "strict")?.()).toBe(7);
		expect(await fileExists(typesOutput)).toBe(true);
	});

	it("surfaces strict-mode type check failures during real initialization", async () => {
		await writeModule(join(fixtureRoot, "broken.ts"), 'export const broken: number = "not-a-number";');

		await withSuppressedSlothletErrorOutput(async () => {
			await expect(
				slothlet({
					dir: fixtureRoot,
					mode: "eager",
					typescript: {
						mode: "strict",
						types: {
							output: join(fixtureRoot, "generated", "api-errors.d.ts"),
							interfaceName: "LoaderStrictErrorAPI"
						}
					}
				})
			).rejects.toThrow();
		});
	});

	it("validates strict mode requirements for output and interfaceName", async () => {
		await writeModule(join(fixtureRoot, "valid.ts"), "export const valid = 1;");

		await withSuppressedSlothletErrorOutput(async () => {
			await expect(
				slothlet({
					dir: fixtureRoot,
					mode: "eager",
					typescript: {
						mode: "strict",
						types: {
							interfaceName: "MissingOutput"
						}
					}
				})
			).rejects.toThrow("TS_STRICT_REQUIRES_OUTPUT");

			await expect(
				slothlet({
					dir: fixtureRoot,
					mode: "eager",
					typescript: {
						mode: "strict",
						types: {
							output: join(fixtureRoot, "generated", "missing-name.d.ts")
						}
					}
				})
			).rejects.toThrow("TS_STRICT_REQUIRES_INTERFACE_NAME");
		});
	});

	it("surfaces strict-mode type generation worker failures from invalid output path", async () => {
		await writeModule(join(fixtureRoot, "valid-strict.ts"), "export const value: number = 42;");

		await withSuppressedSlothletErrorOutput(async () => {
			await expect(
				slothlet({
					dir: fixtureRoot,
					mode: "eager",
					typescript: {
						mode: "strict",
						types: {
							output: "/dev/null/slothlet-invalid-output.d.ts",
							interfaceName: "InvalidStrictOutput"
						}
					}
				})
			).rejects.toThrow();
		});
	});
});
