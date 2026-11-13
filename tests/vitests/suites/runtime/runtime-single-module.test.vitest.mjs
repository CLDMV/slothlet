/**
 *
 *	@Project: @cldmv/slothlet
 *	@Filename: /tests/vitests/suites/runtime/runtime-single-module.test.vitest.mjs
 *	@Date: 2026-11-12T22:54:52-08:00 (1794552892)
 *	@Author: Nate Corcoran <CLDMV>
 *	@Email: <Shinrai@users.noreply.github.com>
 *	-----
 *	@Last modified by: Nate Corcoran <CLDMV> (Shinrai@users.noreply.github.com)
 *	@Last modified time: 2026-11-12T22:54:52-08:00 (1794552892)
 *	-----
 *	@Copyright: Copyright (c) 2013-2026 Catalyzed Motivation Inc. All rights reserved.
 *
 */

/**
 * @fileoverview Slothlet's runtime is one module per process, whichever loader is asked for it (#760).
 *
 * @description
 * This suite runs slothlet's source through vitest's module runner, while Node itself loads every CommonJS file and
 * whatever such a file imports. Fixture `api_test_runtime_single`:
 * ```
 * api/native.cjs      a CommonJS api file: import("@cldmv/slothlet/runtime"), and import("../helpers/reader.mjs")
 * helpers/reader.mjs  imports { self } from the runtime; read() reads the vault
 * api/vault.mjs       get() → "SECRET"
 * ```
 * Expected values come from plain module semantics and from the rules as ruled: a specifier names one module, so the
 * runtime Node hands such a file is the runtime slothlet runs on, and its `self` is the api of the call it is read in.
 * `reader.mjs` is a file no module's folder holds, loaded by `native.cjs`: its code is that module's
 * (docs/PERMISSIONS.md), so it reads the vault where the module `native` may and is refused where it may not.
 *
 * @module tests/vitests/suites/runtime/runtime-single-module
 */
import { describe, it, expect, beforeAll, afterAll } from "vitest";
import path from "node:path";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";
import slothlet from "@cldmv/slothlet";
import * as runtime from "@cldmv/slothlet/runtime";
import * as asyncRuntime from "@cldmv/slothlet/runtime/async";
import * as liveRuntime from "@cldmv/slothlet/runtime/live";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const DIR = path.resolve(HERE, "../../../../api_tests/api_test_runtime_single/api");
const DENIED = "PERMISSION_DENIED";
const SECRET = "SECRET";
/** Import a module with Node's own loader: the function is a CommonJS file's. */
const nativeImport = createRequire(import.meta.url)(path.join(HERE, "fixtures/native-import.cjs"));

const MODES = [];
for (const mode of ["eager", "lazy"])
	for (const runtimeName of ["async", "live"]) MODES.push({ name: `${mode}/${runtimeName}`, mode, runtime: runtimeName });

/**
 * Run a function, giving back what it returns or the code of the error it threw.
 * @param {Function} fn - The function.
 * @returns {Promise<*>} The outcome.
 */
async function settle(fn) {
	try {
		return await fn();
	} catch (error) {
		return error?.code ?? String(error?.message ?? error);
	}
}

describe.each(MODES)("Runtime > one copy per process > $name", ({ mode, runtime: runtimeName }) => {
	describe("with no permissions configured", () => {
		let api;

		beforeAll(async () => {
			api = await slothlet({ base: DIR, mode, runtime: runtimeName, silent: true });
		});

		afterAll(async () => {
			await api?.shutdown();
		});

		it("a CommonJS api file's import() of the runtime gives the runtime of its instance", async () => {
			expect(await settle(() => api.native.read())).toBe(SECRET);
		});

		it("a file a CommonJS api file loads with import() imports the same runtime", async () => {
			expect(await settle(() => api.native.viaFile())).toBe(SECRET);
		});

		it.each([
			{ specifier: "@cldmv/slothlet/runtime", own: () => runtime },
			{ specifier: "@cldmv/slothlet/runtime/async", own: () => asyncRuntime },
			{ specifier: "@cldmv/slothlet/runtime/live", own: () => liveRuntime }
		])("Node's own import of $specifier is the module slothlet runs on", async ({ specifier, own }) => {
			const native = await nativeImport(specifier);
			expect(Object.keys(native).sort()).toEqual(Object.keys(own()).sort());
			for (const name of Object.keys(own())) expect(native[name]).toBe(own()[name]);
		});
	});

	describe.each(["precise", "fast"])("attribution %s", (attribution) => {
		describe.each([
			{ rules: "nothing denied", list: [], expected: SECRET },
			{ rules: "the module native denied", list: [{ caller: "native.**", target: "vault.**", effect: "deny" }], expected: DENIED },
			{ rules: "another module denied", list: [{ caller: "vault.**", target: "vault.**", effect: "deny" }], expected: SECRET }
		])("$rules", ({ list, expected }) => {
			let api;

			beforeAll(async () => {
				api = await slothlet({
					base: DIR,
					mode,
					runtime: runtimeName,
					silent: true,
					permissions: { defaultPolicy: "allow", attribution, rules: list }
				});
			});

			afterAll(async () => {
				await api?.shutdown();
			});

			it("the CommonJS api file's own read", async () => {
				expect(await settle(() => api.native.read())).toBe(expected);
			});

			it("the read of the file it loaded with import()", async () => {
				expect(await settle(() => api.native.viaFile())).toBe(expected);
			});
		});
	});
});
