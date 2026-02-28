/**
 *	@Project: @cldmv/slothlet
 *	@Filename: /tests/vitests/suites/api-manager/api-manager-reload-by-apipath.test.vitest.mjs
 *	@Date: 2026-03-01T00:00:00-08:00
 *	@Author: Nate Hyson <CLDMV>
 *	@Email: <Shinrai@users.noreply.github.com>
 *	-----
 *	@Last modified by: Nate Hyson <CLDMV> (Shinrai@users.noreply.github.com)
 *	@Last modified time: 2026-02-27 18:52:29 -08:00 (1772247149)
 *	-----
 *	@Copyright: Copyright (c) 2013-2026 Catalyzed Motivation Inc. All rights reserved.
 */

/**
 * @fileoverview Coverage for _reloadByApiPath, _findAffectedCaches, and _restoreApiTree
 * nested-path branches in api-manager.mjs.
 *
 * @description
 * Exercises the following previously uncovered code paths:
 *   _reloadByApiPath (lines ~1976-2060):
 *     - No caches found → fallback restoreApiPath
 *     - Sort base-first, group by endpoint, apply forceReplace logic
 *     - Metadata update after rebuild
 *   _findAffectedCaches (lines ~2061-2161):
 *     - Base module resolution (".")
 *     - Exact endpoint match
 *     - Child caches (endpoint starts with path prefix)
 *     - Ownership history fallback
 *     - Parent cache (most-specific covering cache)
 *   _restoreApiTree (lines ~2204-2495):
 *     - Nested path (parts.length > 0): update wrapper impl via ___setImpl
 *     - Root path (parts.length === 0): isLazyFresh path and eager path
 *
 * @module tests/vitests/suites/api-manager/api-manager-reload-by-apipath
 */

process.env.SLOTHLET_INTERNAL_TEST_MODE = "true";

import { describe, it, expect, afterEach } from "vitest";
import slothlet from "@cldmv/slothlet";
import { TEST_DIRS } from "../../setup/vitest-helper.mjs";

// Eager-only matrix to avoid lazy timing races in reload
const EAGER_CONFIGS = [
	{ name: "eager/async/hooks-on", config: { mode: "eager", runtime: "async", hook: { enabled: true } } },
	{ name: "eager/async/hooks-off", config: { mode: "eager", runtime: "async", hook: { enabled: false } } }
];

/**
 * Create a slothlet instance with the given base config and optional overrides.
 * @param {object} baseConfig - Matrix config object.
 * @param {object} [overrides] - Extra config overrides merged on top.
 * @returns {Promise<object>} Ready slothlet API instance.
 */
async function makeApi(baseConfig, overrides = {}) {
	return slothlet({ ...baseConfig, ...overrides });
}

// ---------------------------------------------------------------------------
// 1. _findAffectedCaches: base module (".")
// ---------------------------------------------------------------------------
describe("_findAffectedCaches — base module reload", () => {
	let api;

	afterEach(async () => {
		if (api?.shutdown) await api.shutdown();
		api = null;
		await new Promise((r) => setTimeout(r, 30));
	});

	it("reloads the base module when apiPath is '.'", async () => {
		api = await makeApi(EAGER_CONFIGS[0].config, { dir: TEST_DIRS.API_TEST });
		// api.math exists from the base dir
		expect(api.math).toBeDefined();

		// Reload with "." should find the base module cache and rebuild it
		await expect(api.slothlet.api.reload(".")).resolves.toBeUndefined();

		// api.math should still be accessible after reload
		expect(api.math).toBeDefined();
	});

	it("reloads the base module when apiPath is empty string", async () => {
		api = await makeApi(EAGER_CONFIGS[1].config, { dir: TEST_DIRS.API_TEST });
		expect(api.math).toBeDefined();

		// Empty string also maps to base module
		await expect(api.slothlet.api.reload("")).resolves.toBeUndefined();
		expect(api.math).toBeDefined();
	});
});

// ---------------------------------------------------------------------------
// 2. _findAffectedCaches: exact endpoint match
// ---------------------------------------------------------------------------
describe.each(EAGER_CONFIGS)("_findAffectedCaches — exact endpoint match ($name)", ({ config }) => {
	let api;

	afterEach(async () => {
		if (api?.shutdown) await api.shutdown();
		api = null;
		await new Promise((r) => setTimeout(r, 30));
	});

	it("finds exact endpoint cache when reload path matches add endpoint", async () => {
		api = await makeApi(config, { dir: TEST_DIRS.API_TEST });
		// Add a second API under "extras"
		await api.slothlet.api.add("extras", TEST_DIRS.API_TEST_MIXED);
		expect(api.extras).toBeDefined();

		// Reload by exact endpoint "extras" — _findAffectedCaches finds exact match
		await expect(api.slothlet.api.reload("extras")).resolves.toBeUndefined();

		// extras should still be accessible
		expect(api.extras).toBeDefined();
	});

	it("reloads a specifically-named add module by its full endpoint", async () => {
		api = await makeApi(config, { dir: TEST_DIRS.API_TEST });
		await api.slothlet.api.add("plugins", TEST_DIRS.API_TEST_MIXED, { moduleID: "plugins-mod" });
		expect(api.plugins).toBeDefined();

		// Reload by apiPath "plugins" — exact endpoint match
		await expect(api.slothlet.api.reload("plugins")).resolves.toBeUndefined();
		expect(api.plugins).toBeDefined();
	});
});

// ---------------------------------------------------------------------------
// 3. _findAffectedCaches: parent cache covering a sub-path
// ---------------------------------------------------------------------------
describe.each(EAGER_CONFIGS)("_findAffectedCaches — parent cache fallback ($name)", ({ config }) => {
	let api;

	afterEach(async () => {
		if (api?.shutdown) await api.shutdown();
		api = null;
		await new Promise((r) => setTimeout(r, 30));
	});

	it("falls back to parent cache when reloading a sub-path of a mounted module", async () => {
		api = await makeApi(config, { dir: TEST_DIRS.API_TEST });
		// api.math comes from the base module ("."), so reload("math") should
		// find the base module (most specific parent) via parent-cache fallback
		expect(api.math).toBeDefined();

		// "math" is under "." — no exact match, no children, no ownership → parent "."
		await expect(api.slothlet.api.reload("math")).resolves.toBeUndefined();
		expect(api.math).toBeDefined();
	});

	it("falls back to parent cache for deeply nested non-existent sub-path", async () => {
		api = await makeApi(config, { dir: TEST_DIRS.API_TEST });
		await api.slothlet.api.add("ext", TEST_DIRS.API_TEST_MIXED, { moduleID: "ext-mod" });
		expect(api.ext).toBeDefined();

		// "ext.mathEsm.add" is a sub-path of "ext" — no exact endpoint, uses parent "ext" cache
		await expect(api.slothlet.api.reload("ext.mathEsm")).resolves.toBeUndefined();
		expect(api.ext).toBeDefined();
	});
});

// ---------------------------------------------------------------------------
// 4. _findAffectedCaches: child caches
// ---------------------------------------------------------------------------
describe.each(EAGER_CONFIGS)("_findAffectedCaches — child caches ($name)", ({ config }) => {
	let api;

	afterEach(async () => {
		if (api?.shutdown) await api.shutdown();
		api = null;
		await new Promise((r) => setTimeout(r, 30));
	});

	it("finds child caches when reloading parent endpoint path", async () => {
		api = await makeApi(config, { dir: TEST_DIRS.API_TEST });
		// Add two modules under a shared prefix (nested endpoints)
		await api.slothlet.api.add("ns.a", TEST_DIRS.API_TEST_MIXED, { moduleID: "ns-a-mod" });
		await api.slothlet.api.add("ns.b", TEST_DIRS.API_TEST_MIXED, { moduleID: "ns-b-mod", collisionMode: "merge" });

		// Reload "ns" — _findAffectedCaches should find children "ns.a" and "ns.b"
		await expect(api.slothlet.api.reload("ns")).resolves.toBeUndefined();
		expect(api.ns).toBeDefined();
	});
});

// ---------------------------------------------------------------------------
// 5. _reloadByApiPath: validation — unknown paths throw INVALID_API_PATH
// ---------------------------------------------------------------------------
describe("_reloadByApiPath — invalid path validation", () => {
	let api;

	afterEach(async () => {
		if (api?.shutdown) await api.shutdown();
		api = null;
		await new Promise((r) => setTimeout(r, 30));
	});

	it("throws INVALID_API_PATH when trying to reload a path that does not exist in the live API", async () => {
		api = await makeApi(EAGER_CONFIGS[0].config, { dir: TEST_DIRS.API_TEST });
		// "nonexistent" is not registered in the live API — reload validates path presence first
		await expect(api.slothlet.api.reload("nonexistent")).rejects.toThrow("INVALID_API_PATH");
	});
});

// ---------------------------------------------------------------------------
// 6. _reloadByApiPath: metadata option passed after rebuild
// ---------------------------------------------------------------------------
describe.each(EAGER_CONFIGS)("_reloadByApiPath — metadata option ($name)", ({ config }) => {
	let api;

	afterEach(async () => {
		if (api?.shutdown) await api.shutdown();
		api = null;
		await new Promise((r) => setTimeout(r, 30));
	});

	it("applies metadata update after reload when metadata option is provided", async () => {
		api = await makeApi(config, { dir: TEST_DIRS.API_TEST });
		await api.slothlet.api.add("tagged", TEST_DIRS.API_TEST_MIXED, { moduleID: "tagged-mod" });
		expect(api.tagged).toBeDefined();

		// Reload with metadata option — hits the reloadMetadata path (lines ~2041-2055)
		await expect(api.slothlet.api.reload("tagged", { metadata: { version: "2.0", author: "test" } })).resolves.toBeUndefined();

		expect(api.tagged).toBeDefined();
	});
});

// ---------------------------------------------------------------------------
// 7. _restoreApiTree: nested path (endpoint with parts)
// ---------------------------------------------------------------------------
describe.each(EAGER_CONFIGS)("_restoreApiTree — nested endpoint path ($name)", ({ config }) => {
	let api;

	afterEach(async () => {
		if (api?.shutdown) await api.shutdown();
		api = null;
		await new Promise((r) => setTimeout(r, 30));
	});

	it("updates wrapper impl via ___setImpl when endpoint is a nested path", async () => {
		api = await makeApi(config, { dir: TEST_DIRS.API_TEST });
		// Add under a nested endpoint "plugins.extra"
		await api.slothlet.api.add("plugins.extra", TEST_DIRS.API_TEST_MIXED, { moduleID: "nested-extra" });
		expect(api.plugins).toBeDefined();
		expect(api.plugins.extra).toBeDefined();

		// Reload by moduleID string — api.slothlet.api.reload() accepts the moduleID string directly
		await expect(api.slothlet.api.reload("nested-extra")).resolves.toBeUndefined();
		expect(api.plugins.extra).toBeDefined();
	});

	it("reloads nested endpoint by moduleID string — wrapper is preserved", async () => {
		api = await makeApi(config, { dir: TEST_DIRS.API_TEST });
		await api.slothlet.api.add("tools.extra", TEST_DIRS.API_TEST_MIXED, { moduleID: "tools-extra" });
		expect(api.tools).toBeDefined();

		// Reload by moduleID string — wrapper should still be accessible after
		await expect(api.slothlet.api.reload("tools-extra")).resolves.toBeUndefined();
		expect(api.tools).toBeDefined();
	});
});

// ---------------------------------------------------------------------------
// 8. _restoreApiTree: root path - multiple reloads preserve custom properties
// ---------------------------------------------------------------------------
describe.each(EAGER_CONFIGS)("_restoreApiTree — custom property preservation ($name)", ({ config }) => {
	let api;

	afterEach(async () => {
		if (api?.shutdown) await api.shutdown();
		api = null;
		await new Promise((r) => setTimeout(r, 30));
	});

	it("preserves user-set custom properties on wrapper after reload", async () => {
		api = await makeApi(config, { dir: TEST_DIRS.API_TEST });

		// math wrapper exists from base dir
		expect(api.math).toBeDefined();

		// Set a custom property on the math namespace
		api.math.customTestFlag = "preserved-value";
		expect(api.math.customTestFlag).toBe("preserved-value");

		// Reload base module — _restoreApiTree collects & restores custom props
		await api.slothlet.api.reload("math");

		// Custom property should be preserved
		expect(api.math.customTestFlag).toBe("preserved-value");
	});
});

// ---------------------------------------------------------------------------
// 9. _reloadByApiPath: multiple modules sort & group by endpoint
// ---------------------------------------------------------------------------
describe.each(EAGER_CONFIGS)("_reloadByApiPath — multi-module sort and group ($name)", ({ config }) => {
	let api;

	afterEach(async () => {
		if (api?.shutdown) await api.shutdown();
		api = null;
		await new Promise((r) => setTimeout(r, 30));
	});

	it("reloads multiple modules under same endpoint in correct order", async () => {
		api = await makeApi(config, { dir: TEST_DIRS.API_TEST });

		// Add two modules at the same endpoint with merge mode
		await api.slothlet.api.add("shared", TEST_DIRS.API_TEST_MIXED, {
			moduleID: "shared-first",
			collisionMode: "merge"
		});
		await api.slothlet.api.add("shared", TEST_DIRS.API_TEST_MIXED, {
			moduleID: "shared-second",
			collisionMode: "merge"
		});

		expect(api.shared).toBeDefined();

		// Reload "shared" — should rebuild both modules in addHistory order
		// (first gets forceReplace=true, second gets forceReplace=false)
		await expect(api.slothlet.api.reload("shared")).resolves.toBeUndefined();
		expect(api.shared).toBeDefined();
	});
});
