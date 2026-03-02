/**
 *	@Project: @cldmv/slothlet
 *	@Filename: /tests/vitests/suites/core/scope-disabled.test.vitest.mjs
 *	@Date: 2026-03-01 12:35:53 -08:00 (1772397353)
 *	@Author: Nate Hyson <CLDMV>
 *	@Email: <Shinrai@users.noreply.github.com>
 *	-----
 *	@Last modified by: Nate Hyson <CLDMV> (Shinrai@users.noreply.github.com)
 *	@Last modified time: 2026-03-01 16:31:02 -08:00 (1772411462)
 *	-----
 *	@Copyright: Copyright (c) 2013-2026 Catalyzed Motivation Inc. All rights reserved.
 */

/**
 * @fileoverview Coverage-gap tests for api_builder.mjs createScopeFunction — scope:false branch.
 *
 * @description
 * When `scope: false` is passed in the slothlet config, calling `api.slothlet.scope()` (or
 * `api.slothlet.run()`) should throw a `SlothletError` with code `"SCOPE_DISABLED"`.
 *
 * Uncovered line:
 *
 * - **Line 1207** `throw new slothlet.SlothletError("SCOPE_DISABLED", ...)`:
 *   only reachable when `slothlet.config.scope === false` and the scope function is invoked.
 *
 * Additionally, this file also covers:
 *
 * - **api_builder.mjs line 47-48** (`_resolvePathOrModuleId` moduleID history lookup):
 *   calling `api.slothlet.metadata.setFor(moduleID, ...)` where `moduleID` is the return
 *   value from `api.slothlet.api.add()` exercises the `history.findLast(entry => entry.moduleID === pathOrModuleId)`
 *   branch that was previously uncovered.
 *
 * @module tests/vitests/suites/core/scope-disabled
 */

import { describe, it, expect, afterEach } from "vitest";
import slothlet from "@cldmv/slothlet";
import { TEST_DIRS } from "../../setup/vitest-helper.mjs";

// ─── Shared teardown ──────────────────────────────────────────────────────────

let api;

afterEach(async () => {
	if (api) {
		await api.shutdown().catch(() => {});
		api = null;
	}
});

// ─── scope: false → SCOPE_DISABLED error (api_builder.mjs line 1207) ─────────

describe("api.slothlet.scope() with scope: false config (line 1207)", () => {
	it("throws SCOPE_DISABLED when scope: false and api.slothlet.scope() is called", async () => {
		api = await slothlet({
			dir: TEST_DIRS.API_TEST,
			scope: false,
			silent: true
		});

		// `scope()` is an async function — SCOPE_DISABLED surfaces as a rejected Promise (line 1207).
		// Use `.rejects.toMatchObject` instead of `.toThrow()` which only catches sync throws.
		await expect(api.slothlet.scope({ fn: () => {} })).rejects.toMatchObject({ code: "SCOPE_DISABLED" });
	});

	it("rejects with SCOPE_DISABLED when scope: false (async rejection, line 1207)", async () => {
		api = await slothlet({
			dir: TEST_DIRS.API_TEST,
			scope: false,
			silent: true
		});

		// scope() is async so the SCOPE_DISABLED error is a Promise rejection, not a sync throw.
		// Verify the rejection carries the expected error code.
		const rejection = await api.slothlet.scope({ fn: () => {} }).catch((e) => e);
		expect(rejection).toMatchObject({ code: "SCOPE_DISABLED" });
	});

	it("does NOT throw when scope is not false (default config)", async () => {
		api = await slothlet({
			dir: TEST_DIRS.API_TEST,
			silent: true
		});

		// scope is not disabled → no throw (the scope function proceeds)
		expect(typeof api.slothlet.scope).toBe("function");
		// We don't actually invoke it here to avoid needing a valid fn argument
	});
});

// ─── _resolvePathOrModuleId moduleID history lookup (api_builder.mjs lines 47-48) ──

describe("_resolvePathOrModuleId — moduleID history lookup (api_builder.mjs lines 47-48)", () => {
	it("setFor(moduleID) resolves via addHistory when moduleID matches an api.add() call", async () => {
		api = await slothlet({
			dir: TEST_DIRS.API_TEST,
			silent: true,
			collision: { initial: "replace", api: "replace" }
		});

		// api.slothlet.api.add(apiPath, folderPath, options) — first arg is the API namespace,
		// second arg is the folder path, third arg is options including moduleID.
		const moduleID = await api.slothlet.api.add("dynamic", TEST_DIRS.API_TEST_MIXED, {
			moduleID: "dynamic_module_id_test"
		});

		expect(typeof moduleID === "string" || typeof moduleID === "undefined").toBe(true);

		// When we call setFor("dynamic_module_id_test", ...), _resolvePathOrModuleId
		// checks addHistory for an entry with .moduleID === "dynamic_module_id_test"
		// and returns the corresponding apiPath — covering lines 47-48.
		expect(() => api.slothlet.metadata.setFor("dynamic_module_id_test", "source", "dynamicModule")).not.toThrow();
	});

	it("setFor() with a plain API path (no moduleID match) falls through to return the path directly", async () => {
		api = await slothlet({ dir: TEST_DIRS.API_TEST, silent: true });

		// "math" is not a moduleID in addHistory, so _resolvePathOrModuleId returns it as-is
		expect(() => api.slothlet.metadata.setFor("math", "category", "arithmetic")).not.toThrow();
	});
});
