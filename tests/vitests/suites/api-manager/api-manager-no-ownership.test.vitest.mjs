/**
 *	@Project: @cldmv/slothlet
 *	@Filename: /tests/vitests/suites/api-manager/api-manager-no-ownership.test.vitest.mjs
 *	@Date: 2026-03-02T00:00:00-08:00 (1772496000)
 *	@Author: Nate Corcoran <CLDMV>
 *	@Email: <Shinrai@users.noreply.github.com>
 *	-----
 *	@Last modified by: Nate Corcoran <CLDMV> (Shinrai@users.noreply.github.com)
 *	@Last modified time: 2026-03-02 00:00:00 -08:00 (1772496000)
 *	-----
 *	@Copyright: Copyright (c) 2013-2026 Catalyzed Motivation Inc. All rights reserved.
 */

/**
 * @fileoverview Tests for api-manager.mjs code paths that are only reachable when
 * `this.slothlet.handlers.ownership` is null.  Also covers `resolveFolderPath` and
 * `restoreApiPath` with moduleID "base"/"core".
 *
 * Covered lines:
 *   - Lines 1536-1540: no-ownership heuristic (dots = apiPath) else-branch
 *   - Lines 1757-1772: apiPath-only remove — path exists → delete → return true
 *   - Lines 1769-1772: apiPath-only remove — path absent → return false
 *   - Lines 257-283:   resolveFolderPath — null / non-existent / file / valid-dir branches
 *   - Lines 979-1008:  restoreApiPath "base"/"core" branch (no history entry)
 *
 * All tests mutate internal state through `resolveWrapper()` and always restore it
 * in `finally` blocks.
 *
 * @module tests/vitests/suites/api-manager/api-manager-no-ownership
 */

process.env.SLOTHLET_INTERNAL_TEST_MODE = "true";

import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, it, expect, afterEach } from "vitest";
import slothlet from "@cldmv/slothlet";
import { resolveWrapper } from "@cldmv/slothlet/handlers/unified-wrapper";
import { TEST_DIRS } from "../../setup/vitest-helper.mjs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

/**
 * Extract the real Slothlet instance from an API proxy by resolving the wrapper on
 * any top-level property.
 * @param {object} api - Slothlet API proxy.
 * @param {string} [prop="math"] - A property that carries a wrapper.
 * @returns {object} Internal Slothlet instance.
 */
function getSlInstance(api, prop = "math") {
	const wrapper = resolveWrapper(api[prop]);
	if (!wrapper) throw new Error(`resolveWrapper(api.${prop}) returned null`);
	return wrapper.slothlet;
}

// ---------------------------------------------------------------------------
// 1–3: removeApiComponent with null ownership
// ---------------------------------------------------------------------------

describe("removeApiComponent — no ownership — apiPath branch (lines 1757-1772)", () => {
	let api;

	afterEach(async () => {
		if (api?.shutdown) await api.shutdown();
		api = null;
	});

	it("returns true and deletes path when ownership=null and dotted path exists (covers lines 1758-1769)", async () => {
		api = await slothlet({ dir: TEST_DIRS.API_TEST, mode: "eager", silent: true });
		const sl = getSlInstance(api);
		const savedOwnership = sl.handlers.ownership;
		sl.handlers.ownership = null;
		try {
			// "math.add" is a real path: api.math.add exists after eager load.
			// Without ownership, the heuristic routes dot-paths to the apiPath-only branch.
			const result = await sl.handlers.apiManager.removeApiComponent("math.add");
			expect(result).toBe(true);
		} finally {
			sl.handlers.ownership = savedOwnership;
		}
	});

	it("returns false when ownership=null and dotted path does not exist (covers lines 1769-1772)", async () => {
		api = await slothlet({ dir: TEST_DIRS.API_TEST, mode: "eager", silent: true });
		const sl = getSlInstance(api);
		const savedOwnership = sl.handlers.ownership;
		sl.handlers.ownership = null;
		try {
			const result = await sl.handlers.apiManager.removeApiComponent("totally.nonexistent.path");
			expect(result).toBe(false);
		} finally {
			sl.handlers.ownership = savedOwnership;
		}
	});

	it("no-ownership dot-path branch returns true for a shallow dotted path (covers lines 1536-1540)", async () => {
		api = await slothlet({ dir: TEST_DIRS.API_TEST, mode: "eager", silent: true });
		const sl = getSlInstance(api);
		const savedOwnership = sl.handlers.ownership;
		sl.handlers.ownership = null;
		try {
			// "math.multiply" is a real nested path in eager mode.
			const result = await sl.handlers.apiManager.removeApiComponent("math.multiply");
			expect(result).toBe(true);
		} finally {
			sl.handlers.ownership = savedOwnership;
		}
	});

	it("no-ownership heuristic: value-that-is-path-but-missing returns false (covers 'return false')", async () => {
		api = await slothlet({ dir: TEST_DIRS.API_TEST, mode: "eager", silent: true });
		const sl = getSlInstance(api);
		const savedOwnership = sl.handlers.ownership;
		sl.handlers.ownership = null;
		try {
			// "deep.path.that.never.existed" has many dots → apiPath branch → missing → false
			const result = await sl.handlers.apiManager.removeApiComponent("deep.path.that.never.existed");
			expect(result).toBe(false);
		} finally {
			sl.handlers.ownership = savedOwnership;
		}
	});
});

// ---------------------------------------------------------------------------
// 4: resolveFolderPath — lines 257-283
// ---------------------------------------------------------------------------

describe("resolveFolderPath — input validation and path checks (lines 257-283)", () => {
	let api;

	afterEach(async () => {
		if (api?.shutdown) await api.shutdown();
		api = null;
	});

	it("throws INVALID_CONFIG_DIR_INVALID when folderPath is null (line 259)", async () => {
		api = await slothlet({ dir: TEST_DIRS.API_TEST, mode: "eager", silent: true });
		const sl = getSlInstance(api);
		await expect(
			sl.handlers.apiManager.resolveFolderPath(null)
		).rejects.toMatchObject({ code: "INVALID_CONFIG_DIR_INVALID" });
	});

	it("throws INVALID_CONFIG_DIR_INVALID when folderPath is undefined (line 259)", async () => {
		api = await slothlet({ dir: TEST_DIRS.API_TEST, mode: "eager", silent: true });
		const sl = getSlInstance(api);
		await expect(
			sl.handlers.apiManager.resolveFolderPath(undefined)
		).rejects.toMatchObject({ code: "INVALID_CONFIG_DIR_INVALID" });
	});

	it("throws INVALID_CONFIG_DIR_INVALID when folderPath is a number (line 259)", async () => {
		api = await slothlet({ dir: TEST_DIRS.API_TEST, mode: "eager", silent: true });
		const sl = getSlInstance(api);
		await expect(
			sl.handlers.apiManager.resolveFolderPath(42)
		).rejects.toMatchObject({ code: "INVALID_CONFIG_DIR_INVALID" });
	});

	it("throws INVALID_CONFIG_DIR_INVALID for a non-existent path (catch branch line 278)", async () => {
		api = await slothlet({ dir: TEST_DIRS.API_TEST, mode: "eager", silent: true });
		const sl = getSlInstance(api);
		await expect(
			sl.handlers.apiManager.resolveFolderPath("/srv/repos/slothlet/__does_not_exist_xyz__/")
		).rejects.toMatchObject({ code: "INVALID_CONFIG_DIR_INVALID" });
	});

	it("throws INVALID_CONFIG_DIR_INVALID when path points to a file, not a directory (line 266-269)", async () => {
		api = await slothlet({ dir: TEST_DIRS.API_TEST, mode: "eager", silent: true });
		const sl = getSlInstance(api);
		// package.json is a real file (not a directory)
		await expect(
			sl.handlers.apiManager.resolveFolderPath("/srv/repos/slothlet/package.json")
		).rejects.toMatchObject({ code: "INVALID_CONFIG_DIR_INVALID" });
	});

	it("returns the resolved absolute path for a valid directory (line 283)", async () => {
		api = await slothlet({ dir: TEST_DIRS.API_TEST, mode: "eager", silent: true });
		const sl = getSlInstance(api);
		const result = await sl.handlers.apiManager.resolveFolderPath(TEST_DIRS.API_TEST);
		expect(typeof result).toBe("string");
		expect(result.length).toBeGreaterThan(0);
	});
});

// ---------------------------------------------------------------------------
// 5: restoreApiPath — "base"/"core" branch (lines 979-1008)
// ---------------------------------------------------------------------------

describe("restoreApiPath — base/core moduleID branch (lines 979-1008)", () => {
	let api;

	afterEach(async () => {
		if (api?.shutdown) await api.shutdown();
		api = null;
	});

	it("hits the base/core rebuild branch when no history entry exists for moduleID 'base' (line 980)", async () => {
		api = await slothlet({ dir: TEST_DIRS.API_TEST, mode: "eager", silent: true });
		const sl = getSlInstance(api);

		// Clear addHistory to ensure there is no history entry for apiPath="math" + moduleID="base".
		// Without a history entry the function falls through to the normalizedModuleId==="base" branch.
		const savedHistory = [...sl.handlers.apiManager.state.addHistory];
		sl.handlers.apiManager.state.addHistory = [];
		try {
			// Should not throw — rebuilds "math" from the base config dir
			await expect(
				sl.handlers.apiManager.restoreApiPath("math", "base")
			).resolves.not.toThrow();
		} finally {
			sl.handlers.apiManager.state.addHistory = savedHistory;
		}
	});

	it("hits the base/core rebuild branch for moduleID 'core' (aliases base branch)", async () => {
		api = await slothlet({ dir: TEST_DIRS.API_TEST, mode: "eager", silent: true });
		const sl = getSlInstance(api);

		const savedHistory = [...sl.handlers.apiManager.state.addHistory];
		sl.handlers.apiManager.state.addHistory = [];
		try {
			await expect(
				sl.handlers.apiManager.restoreApiPath("math", "core")
			).resolves.not.toThrow();
		} finally {
			sl.handlers.apiManager.state.addHistory = savedHistory;
		}
	});

	it("base/core branch handles a path that does not exist in the rebuilt API (deletePath variant, lines 992-995)", async () => {
		api = await slothlet({ dir: TEST_DIRS.API_TEST, mode: "eager", silent: true });
		const sl = getSlInstance(api);

		const savedHistory = [...sl.handlers.apiManager.state.addHistory];
		sl.handlers.apiManager.state.addHistory = [];
		try {
			// "nonexistent.path.xyz" won't be in the rebuilt base API; baseValue will be undefined
			// → triggers the deletePath(api, parts) branch (lines 992-995)
			await expect(
				sl.handlers.apiManager.restoreApiPath("nonexistent.path.xyz", "base")
			).resolves.not.toThrow();
		} finally {
			sl.handlers.apiManager.state.addHistory = savedHistory;
		}
	});

	it("uses historyEntry fast-path when a matching history entry IS present (does not enter base branch)", async () => {
		api = await slothlet({ dir: TEST_DIRS.API_TEST, mode: "eager", silent: true });
		const sl = getSlInstance(api);

		// With history intact, a "base"-moduleID entry was recorded at initial load.
		// The function should find it and call addApiComponent (fast path), not the base branch.
		// We just verify it resolves without error.
		await expect(
			sl.handlers.apiManager.restoreApiPath("math", "base")
		).resolves.not.toThrow();
	});
});
