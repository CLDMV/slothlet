/**
 *	@Project: @cldmv/slothlet
 *	@Filename: /tests/vitests/suites/metadata/metadata-internal-guards.test.vitest.mjs
 *	@Date: 2026-03-03 00:00:00 -08:00 (1772726400)
 *	@Author: Nate Corcoran <CLDMV>
 *	@Email: <Shinrai@users.noreply.github.com>
 *	-----
 *	@Last modified by: Nate Corcoran <CLDMV> (Shinrai@users.noreply.github.com)
 *	@Last modified time: 2026-03-03 00:00:00 -08:00 (1772726400)
 *	-----
 *	@Copyright: Copyright (c) 2013-2026 Catalyzed Motivation Inc. All rights reserved.
 */

/**
 * @fileoverview Coverage tests for metadata.mjs internal guard lines.
 *
 * @description
 * Targets these specific uncovered lines:
 *
 *   Line 59  — `#deepFreeze`: null/undefined early return
 *   Line 60  — `#deepFreeze`: non-object (primitive) early return
 *   Line 184 — `collectMetadataFromParents`: falsy path early return
 *   Line 433 — `removeUserMetadataByApiPath`: falsy apiPath early return
 *   Line 565 — `importUserState`: falsy state early return
 *
 * Lines 59 and 60 are hit by setting metadata with a null or primitive value,
 * then triggering `getMetadata()` which calls `#deepFreeze(combined)`.  The
 * `#deepFreeze` recurser traverses every property of the combined object and
 * calls itself recursively — hitting line 59 for `null` values and line 60 for
 * number/string values.
 *
 * Lines 433 and 565 are early-return guards on package-level methods, reachable
 * via `sl.handlers.metadata.*` after extracting the raw Slothlet instance with
 * `resolveWrapper`.
 *
 * @module tests/vitests/suites/metadata/metadata-internal-guards
 */

import { describe, it, expect, afterEach } from "vitest";
import slothlet from "@cldmv/slothlet";
import { resolveWrapper } from "@cldmv/slothlet/handlers/unified-wrapper";
import { TEST_DIRS } from "../../setup/vitest-helper.mjs";

let api;

afterEach(async () => {
	await api?.shutdown().catch(() => {});
	api = null;
});

/**
 * Get raw Slothlet instance from the api proxy.
 *
 * @param {object} _api - Slothlet API object.
 * @param {string} key - Non-slothlet key present in the api.
 * @returns {object} Raw Slothlet instance.
 */
function getSlFromApi(_api, key) {
	return resolveWrapper(_api[key])?.slothlet;
}

// ─── #deepFreeze — null/undefined guard (line 59) ─────────────────────────────

describe("metadata #deepFreeze — null value guard (line 59)", () => {
	/**
	 * When a metadata value is `null`, `getMetadata()` freezes the combined object.
	 * `#deepFreeze` recurses into every property value.  For `null` children,
	 * the first guard `obj === null` fires at line 59.
	 */
	it("triggers #deepFreeze null guard when metadata value is null (line 59)", async () => {
		api = await slothlet({ dir: TEST_DIRS.API_TEST, silent: true });
		const sl = getSlFromApi(api, "math");

		// Store null as a metadata value for 'math'
		api.slothlet.metadata.setFor("math", "nullKey", null);

		// getMetadata(api.math) builds combined metadata and calls #deepFreeze.
		// combined = { nullKey: null, ...systemData }
		// #deepFreeze recurses into obj["nullKey"] = null → line 59: obj === null → return obj
		const meta = sl.handlers.metadata.getMetadata(api.math);
		expect(meta).toBeDefined();
		// The null value should be preserved in the frozen result
		expect(meta.nullKey).toBeNull();
	});
});

// ─── #deepFreeze — primitive guard (line 60) ──────────────────────────────────

describe("metadata #deepFreeze — primitive (non-object) value guard (line 60)", () => {
	/**
	 * When a metadata value is a number or string (primitive), `#deepFreeze`
	 * recurse hits `typeof obj !== 'object'` at line 60 and returns early.
	 */
	it("triggers #deepFreeze primitive guard when metadata value is a number (line 60)", async () => {
		api = await slothlet({ dir: TEST_DIRS.API_TEST, silent: true });
		const sl = getSlFromApi(api, "math");

		// Store a number — #deepFreeze(42) → typeof 42 !== "object" → line 60
		api.slothlet.metadata.setFor("math", "numKey", 42);

		const meta = sl.handlers.metadata.getMetadata(api.math);
		expect(meta).toBeDefined();
		expect(meta.numKey).toBe(42);
	});

	it("triggers #deepFreeze primitive guard when metadata value is a string (line 60)", async () => {
		api = await slothlet({ dir: TEST_DIRS.API_TEST, silent: true });
		const sl = getSlFromApi(api, "math");

		// Store a string — #deepFreeze("hello") → typeof "hello" !== "object" → line 60
		api.slothlet.metadata.setFor("math", "strKey", "hello");

		const meta = sl.handlers.metadata.getMetadata(api.math);
		expect(meta).toBeDefined();
		expect(meta.strKey).toBe("hello");
	});
});

// ─── collectMetadataFromParents — falsy path guard (line 184) ─────────────────

describe("metadata collectMetadataFromParents — falsy path guard (line 184)", () => {
	/**
	 * `collectMetadataFromParents(path)` is a local function inside `getMetadata`.
	 * If called with a falsy `path`, line 184 immediately returns `{}`.
	 * Passing a target with no associated apiPath triggers this early return.
	 */
	it("getMetadata for a fresh plain object (no apiPath) hits the !path guard (line 184)", async () => {
		api = await slothlet({ dir: TEST_DIRS.API_TEST, silent: true });
		const sl = getSlFromApi(api, "math");

		// A plain object has no apiPath registered in the metadata system.
		// getMetadata(plainObj) → systemData.apiPath is undefined/empty
		// → collectMetadataFromParents(undefined) → !path → line 184 return {}
		const plainObj = {};
		const meta = sl.handlers.metadata.getMetadata(plainObj);
		// Should not throw; returns combined metadata (likely empty for unknown target)
		expect(meta).toBeDefined();
		expect(typeof meta).toBe("object");
	});
});

// ─── removeUserMetadataByApiPath — falsy apiPath guard (line 433) ─────────────

describe("metadata removeUserMetadataByApiPath — falsy apiPath guard (line 433)", () => {
	/**
	 * `removeUserMetadataByApiPath(apiPath)` has an early return at line 433:
	 * `if (!apiPath) return;`
	 * Calling it directly with null triggers this guard immediately.
	 */
	it("calling removeUserMetadataByApiPath(null) is a safe no-op (line 433)", async () => {
		api = await slothlet({ dir: TEST_DIRS.API_TEST, silent: true });
		const sl = getSlFromApi(api, "math");

		// null → !null → line 433 return (no-op, no throw)
		expect(() => sl.handlers.metadata.removeUserMetadataByApiPath(null)).not.toThrow();
	});

	it("calling removeUserMetadataByApiPath('') is a safe no-op (line 433)", async () => {
		api = await slothlet({ dir: TEST_DIRS.API_TEST, silent: true });
		const sl = getSlFromApi(api, "math");

		// '' → !'' → line 433 return (no-op)
		expect(() => sl.handlers.metadata.removeUserMetadataByApiPath("")).not.toThrow();
	});
});

// ─── importUserState — falsy state guard (line 565) ───────────────────────────

describe("metadata importUserState — falsy state guard (line 565)", () => {
	/**
	 * `importUserState(state)` has an early return at line 565:
	 * `if (!state) return;`
	 * Calling it with null or undefined triggers this guard immediately.
	 */
	it("calling importUserState(null) is a safe no-op (line 565)", async () => {
		api = await slothlet({ dir: TEST_DIRS.API_TEST, silent: true });
		const sl = getSlFromApi(api, "math");

		// null → !null → line 565 return (no-op, no throw)
		expect(() => sl.handlers.metadata.importUserState(null)).not.toThrow();
	});

	it("calling importUserState(undefined) is a safe no-op (line 565)", async () => {
		api = await slothlet({ dir: TEST_DIRS.API_TEST, silent: true });
		const sl = getSlFromApi(api, "math");

		// undefined → !undefined → line 565 return (no-op)
		expect(() => sl.handlers.metadata.importUserState(undefined)).not.toThrow();
	});
});

// ─── removeUserMetadata — no moduleID guard (line 317) ─────────────────────

describe("metadata removeUserMetadata — no moduleID early-return guard (line 317)", () => {
	/**
	 * `removeUserMetadata(target)` resolves the wrapper and looks up system metadata.
	 * If the target has no `moduleID` in its system metadata (e.g. a plain object
	 * that was never registered), line 317 `if (!moduleID) return` fires immediately.
	 */
	it("removeUserMetadata with a plain unregistered object returns early (line 317)", async () => {
		api = await slothlet({ dir: TEST_DIRS.API_TEST, silent: true });
		const sl = getSlFromApi(api, "math");

		// plainObj has no system metadata registered → moduleID = undefined → line 317 return
		const plainObj = {};
		expect(() => sl.handlers.metadata.removeUserMetadata(plainObj)).not.toThrow();
	});

	it("removeUserMetadata with a plain function returns early (line 317)", async () => {
		api = await slothlet({ dir: TEST_DIRS.API_TEST, silent: true });
		const sl = getSlFromApi(api, "math");

		// Plain function has no system metadata → moduleID = undefined → line 317 return
		const plainFn = () => {};
		expect(() => sl.handlers.metadata.removeUserMetadata(plainFn)).not.toThrow();
	});
});

// ─── metadata.get — null apiRoot guard (line 619) ───────────────────────────

describe("metadata.get — null apiRoot early-return guard (line 619)", () => {
	/**
	 * `metadata.get(path)` resolves the path against `this.slothlet.api` (line 618).
	 * If `slothlet.api` is null, the guard at line 619 fires and returns null.
	 *
	 * After `api.destroy()`, `slothlet.api` is set to null (api_builder line 1458).
	 * Saving a bound reference to `metadata.get` before destroy and calling it
	 * afterward exercises line 619.
	 */
	it("metadata.get returns null after slothlet.api is cleared (line 619)", async () => {
		api = await slothlet({ dir: TEST_DIRS.API_TEST, silent: true });
		const sl = getSlFromApi(api, "math");

		// Save a bound reference BEFORE we nullify the api
		const getMetadataPath = sl.handlers.metadata.get.bind(sl.handlers.metadata);

		// Directly set slothlet.api to null — simulates post-destroy state
		const savedApi = sl.api;
		sl.api = null;

		try {
			// metadata.get checks `this.slothlet.api` at line 618 → null → line 619 return null
			const result = await getMetadataPath("math");
			expect(result).toBeNull();
		} finally {
			// Restore api reference so afterEach shutdown works correctly
			sl.api = savedApi;
		}
	});
});
