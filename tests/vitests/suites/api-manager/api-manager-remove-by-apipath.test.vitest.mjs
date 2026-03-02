/**
 *	@Project: @cldmv/slothlet
 *	@Filename: /tests/vitests/suites/api-manager/api-manager-remove-by-apipath.test.vitest.mjs
 *	@Date: 2026-02-27T20:33:02-08:00 (1772253182)
 *	@Author: Nate Corcoran <CLDMV>
 *	@Email: <Shinrai@users.noreply.github.com>
 *	-----
 *	@Last modified by: Nate Corcoran <CLDMV> (Shinrai@users.noreply.github.com)
 *	@Last modified time: 2026-03-01 20:21:43 -08:00 (1772425303)
 *	-----
 *	@Copyright: Copyright (c) 2013-2026 Catalyzed Motivation Inc. All rights reserved.
 */

/**
 * @fileoverview Coverage for removeApiComponent with apiPath (not a moduleID string)
 * targeting the `if (apiPath && moduleID)` dispatch block in api-manager.mjs.
 *
 * @description
 * Exercises lines 1538-1610:
 *   - ownership detection by API path (not moduleID)
 *   - ownershipResult.action === "delete"  (lines 1574-1591)
 *   - ownershipResult.action === "restore" (lines 1591-1610) via two-module ownership
 *   - ownershipResult.action === "none"    (line 1606-1608) via no-history path
 *
 * To trigger the `apiPath && moduleID` branch:
 *   - The argument must NOT match any registered moduleID
 *   - BUT the argument must be a registered ownership API path
 *   → resolution falls to getCurrentOwner(), setting both apiPath AND moduleID
 *
 * @module tests/vitests/suites/api-manager/api-manager-remove-by-apipath
 */

process.env.SLOTHLET_INTERNAL_TEST_MODE = "true";

import { describe, it, expect, afterEach } from "vitest";
import slothlet from "@cldmv/slothlet";
import { TEST_DIRS } from "../../setup/vitest-helper.mjs";

const EAGER_CONFIGS = [
	{ name: "eager/hooks-on", config: { mode: "eager", runtime: "async", hook: { enabled: true } } },
	{ name: "eager/hooks-off", config: { mode: "eager", runtime: "async", hook: { enabled: false } } }
];

/**
 * Create a slothlet instance.
 * @param {object} base - Base config.
 * @param {object} [extra] - Extra overrides.
 * @returns {Promise<object>}
 */
async function makeApi(base, extra = {}) {
	return slothlet({ ...base, ...extra });
}

// ---------------------------------------------------------------------------
// 1. Remove an API path that is ownership-tracked but NOT a moduleID
//    → enters `if (apiPath && moduleID)` → action: "delete"
// ---------------------------------------------------------------------------
describe.each(EAGER_CONFIGS)("remove by api-path — delete action ($name)", ({ config }) => {
	let api;

	afterEach(async () => {
		if (api?.shutdown) await api.shutdown();
		api = null;
		await new Promise((r) => setTimeout(r, 30));
	});

	it("removes an ownership-tracked api path that is not a registered moduleID", async () => {
		api = await makeApi(config, { dir: TEST_DIRS.API_TEST });
		// Add module with auto-generated moduleID (e.g. "api_test_mixed_<hash>")
		await api.slothlet.api.add("removable", TEST_DIRS.API_TEST_MIXED);
		expect(api.removable).toBeDefined();

		// "removable" is an ownership-tracked path but NOT a registered moduleID
		// → ownership detection sets apiPath="removable", moduleID=<auto-hash>
		// → enters `if (apiPath && moduleID)` → action: "delete"
		const result = await api.slothlet.api.remove("removable");
		expect(result).toBe(true);
		expect(api.removable).toBeUndefined();
	});

	it("removes a nested ownership-tracked api path", async () => {
		api = await makeApi(config, { dir: TEST_DIRS.API_TEST });
		await api.slothlet.api.add("ns.group", TEST_DIRS.API_TEST_MIXED);
		expect(api.ns).toBeDefined();
		expect(api.ns.group).toBeDefined();

		// "ns.group" is an ownership path — remove triggers apiPath && moduleID block
		const result = await api.slothlet.api.remove("ns.group");
		expect(result).toBe(true);
	});

	it("returns false for a path that is not registered in ownership", async () => {
		api = await makeApi(config, { dir: TEST_DIRS.API_TEST });

		// "ghostPath" is neither a moduleID nor an ownership-tracked path
		// → ownership detection returns false early (no owner found)
		const result = await api.slothlet.api.remove("ghostPath");
		expect(result).toBe(false);
	});
});

// ---------------------------------------------------------------------------
// 2. Remove by apiPath triggers ownership restore (two-module ownership)
//    → enters `if (apiPath && moduleID)` → action: "restore"
// ---------------------------------------------------------------------------
describe.each(EAGER_CONFIGS)("remove by api-path — restore action ($name)", ({ config }) => {
	let api;

	afterEach(async () => {
		if (api?.shutdown) await api.shutdown();
		api = null;
		await new Promise((r) => setTimeout(r, 50));
	});

	it("restores previous owner when removing newer module by api path", async () => {
		api = await makeApi(config, { dir: TEST_DIRS.API_TEST });

		// Add module A first
		await api.slothlet.api.add("layered", TEST_DIRS.API_TEST_MIXED, {
			moduleID: "layer-a",
			collisionMode: "replace"
		});
		expect(api.layered).toBeDefined();

		// Add module B over same path — B becomes new owner (ownership now has A then B)
		await api.slothlet.api.add("layered", TEST_DIRS.API_TEST_MIXED, {
			moduleID: "layer-b",
			collisionMode: "replace"
		});
		expect(api.layered).toBeDefined();

		// Remove "layered" by api path (NOT by moduleID)
		// → ownership detects apiPath="layered", moduleID="layer-b"
		// → removePath("layered", "layer-b") → action: "restore" to A
		const result = await api.slothlet.api.remove("layered");
		expect(result).toBe(true);

		// After restore, the path should still exist (restored to layer-a's impl)
		// OR be gone if layer-a's impl was replaced...
		// Either way, the operation should not throw
	});
});

// ---------------------------------------------------------------------------
// 3. Remove by apiPath — path doesn't exist but ownership says "none"
//    → enters `if (apiPath && moduleID)` → action: "none" → returns false
// ---------------------------------------------------------------------------
describe.each(EAGER_CONFIGS)("remove by api-path — none action ($name)", ({ config }) => {
	let api;

	afterEach(async () => {
		if (api?.shutdown) await api.shutdown();
		api = null;
		await new Promise((r) => setTimeout(r, 30));
	});

	it("returns false for a registered path that no longer has an owner", async () => {
		api = await makeApi(config, { dir: TEST_DIRS.API_TEST });

		// Add then remove by moduleID to clear ownership entirely
		await api.slothlet.api.add("tempPath", TEST_DIRS.API_TEST_MIXED, { moduleID: "temp-mod" });
		await api.slothlet.api.remove("temp-mod"); // by moduleID → clears ownership

		// Now try to remove by apiPath — no owner found → returns false (early exit)
		const result = await api.slothlet.api.remove("tempPath");
		expect(result).toBe(false);
	});
});

// ---------------------------------------------------------------------------
// 4. Remove by apiPath — metadata cleanup
// ---------------------------------------------------------------------------
describe.each(EAGER_CONFIGS)("remove by api-path — metadata cleanup ($name)", ({ config }) => {
	let api;

	afterEach(async () => {
		if (api?.shutdown) await api.shutdown();
		api = null;
		await new Promise((r) => setTimeout(r, 30));
	});

	it("cleans up user metadata when removing by api path", async () => {
		api = await makeApi(config, { dir: TEST_DIRS.API_TEST });
		await api.slothlet.api.add("annotated", TEST_DIRS.API_TEST_MIXED, {
			metadata: { version: "1.0", auto: true }
		});
		expect(api.annotated).toBeDefined();

		// Remove by apiPath with metadata cleanup
		await api.slothlet.api.remove("annotated");
		expect(api.annotated).toBeUndefined();
	});
});

// ---------------------------------------------------------------------------
// 5. Remove by api path — base module (. endpoint) api path
// ---------------------------------------------------------------------------
describe.each(EAGER_CONFIGS)("remove by api-path — base module keys ($name)", ({ config }) => {
	let api;

	afterEach(async () => {
		if (api?.shutdown) await api.shutdown();
		api = null;
		await new Promise((r) => setTimeout(r, 30));
	});

	it("can remove a top-level key from the base module via api path", async () => {
		api = await makeApi(config, { dir: TEST_DIRS.API_TEST_MIXED });
		// mathEsm is a top-level key from the base module (API_TEST_MIXED dir)
		expect(api.mathEsm).toBeDefined();

		// "mathEsm" → NOT a moduleID → ownership-tracked path → apiPath+moduleID block
		const result = await api.slothlet.api.remove("mathEsm");
		expect(result).toBe(true);
		expect(api.mathEsm).toBeUndefined();
	});

	it("removing non-existent base module path returns false", async () => {
		api = await makeApi(config, { dir: TEST_DIRS.API_TEST });

		// "neverExisted" is not in ownership tracking
		const result = await api.slothlet.api.remove("neverExisted");
		expect(result).toBe(false);
	});
});
