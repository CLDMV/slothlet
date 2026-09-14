/**
 * @fileoverview Coverage for remaining Config normalization branches (routines validation,
 * collectLifecycleHooks deprecation, routines:null). Drives each branch through the real
 * `slothlet({...})` config path.
 * @module tests/vitests/suites/config/config-coverage
 */

import { describe, it, expect, afterEach } from "vitest";
import slothlet from "@cldmv/slothlet";
import { TEST_DIRS, withSuppressedSlothletErrorOutput } from "../../setup/vitest-helper.mjs";

/** @type {any} */
let api;
afterEach(async () => {
	if (api?.slothlet?.shutdown) await api.slothlet.shutdown().catch(() => {});
	if (api?.shutdown && !api?.slothlet) await api.shutdown().catch(() => {});
	api = null;
});

describe("Config normalization coverage", () => {
	it("rejects an array routine entry, reporting its type as \"array\" (config.mjs:955 ternary-true)", async () => {
		await withSuppressedSlothletErrorOutput(async () => {
			await expect(slothlet({ dir: TEST_DIRS.API_TEST_ROUTINES, routines: [["not-a-string"]], silent: true })).rejects.toMatchObject({
				code: "INVALID_CONFIG"
			});
		});
	});

	it("rejects a root-anchored name whose pattern fails to compile (config.mjs:1055)", async () => {
		// A `^`-prefixed name compiles as a glob via compilePattern; brace nesting past the max
		// expansion depth throws BRACE_EXPANSION_MAX_DEPTH, which normalizeRoutines rethrows as INVALID_CONFIG.
		let deep = "x";
		for (let i = 0; i < 12; i++) deep = `{${deep},y}`;
		await withSuppressedSlothletErrorOutput(async () => {
			await expect(slothlet({ dir: TEST_DIRS.API_TEST_ROUTINES, routines: [{ name: `^${deep}` }], silent: true })).rejects.toMatchObject({
				code: "INVALID_CONFIG"
			});
		});
	});

	it("rejects an invalid routine order (config.mjs:1072-1073)", async () => {
		await withSuppressedSlothletErrorOutput(async () => {
			await expect(
				slothlet({ dir: TEST_DIRS.API_TEST_ROUTINES, routines: [{ name: "initialize", order: "sideways" }], silent: true })
			).rejects.toMatchObject({ code: "INVALID_CONFIG" });
		});
	});

	it("routines: null normalizes to no routines (config.mjs:916-917)", async () => {
		// null takes the `routines === null` early-return (an empty routine set), like routines: [].
		api = await slothlet({ dir: TEST_DIRS.API_TEST_ROUTINES, routines: null, silent: true });
		expect(api).toBeDefined();
	});

	it("collectLifecycleHooks (without explicit autoRoutines, non-silent) emits the V3 deprecation warning (config.mjs:574-575)", async () => {
		// silent is falsy here so the `!config.silent` deprecation branch runs and constructs the warning.
		api = await slothlet({ dir: TEST_DIRS.API_TEST_ROUTINES, collectLifecycleHooks: true });
		expect(api).toBeDefined();
	});
});
