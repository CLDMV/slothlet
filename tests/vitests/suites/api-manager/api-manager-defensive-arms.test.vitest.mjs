/**
 *
 *	@Project: @cldmv/slothlet
 *	@Filename: tests/vitests/suites/api-manager/api-manager-defensive-arms.test.vitest.mjs
 *	@Date: 2026-11-28T00:00:00-08:00 (1795852800)
 *	@Author: Nate Corcoran <CLDMV>
 *	@Email: <Shinrai@users.noreply.github.com>
 *	-----
 *	@Last modified by: Nate Corcoran <CLDMV> (Shinrai@users.noreply.github.com)
 *	@Last modified time: 2026-11-28T00:00:00-08:00 (1795852800)
 *	-----
 *	@Copyright: Copyright (c) 2013-2026 Catalyzed Motivation Inc. All rights reserved.
 *
 */

/**
 * @fileoverview The input guards of ApiManager's internal helpers, driven with the inputs they guard against.
 *
 * @description
 * Each helper here is reached by the add / remove / reload flows with well-formed arguments; these tests hand
 * them the other shapes their guards accept (no params, a non-wrapper value, a missing handler, a cache set that
 * covers nothing) and check the answer each guard gives:
 *
 * - the constructor with an instance that has no config;
 * - `syncWrapper` with two values that are not wrapper proxies;
 * - `mutateApiValue` with a null next value while api debug logging is on;
 * - `setValueAtPath` with no collision mode;
 * - `addApiComponent` with no params, and with a forced add whose moduleID stringifies to "";
 * - `removeApiComponent` with ownership off and an id that is only the reserved separator prefix;
 * - `_collectCustomProperties` / `_restoreCustomProperties` with missing or non-wrapper inputs;
 * - `_restoreApiTree` with no fresh api;
 * - `_findAffectedCaches` lookups against stub cache and ownership handlers;
 * - a reload by path, of a path nothing provides and of the base path, with no cache to rebuild.
 *
 * @module tests/vitests/suites/api-manager/api-manager-defensive-arms
 */

process.env.SLOTHLET_INTERNAL_TEST_MODE = "true";

import path from "node:path";
import { describe, it, expect, afterEach } from "vitest";
import slothlet from "@cldmv/slothlet";
import { ApiManager } from "#handlers/api-manager";
import { resolveWrapper } from "#handlers/unified-wrapper";
import { MODULE_ID_SEPARATOR } from "#handlers/metadata";
import { TEST_DIRS } from "../../setup/vitest-helper.mjs";

/**
 * The internal Slothlet instance behind an api, read through a wrapper on one of its members.
 * @param {object} api - Slothlet api.
 * @param {string} [prop="math"] - A member that carries a wrapper.
 * @returns {object} Internal Slothlet instance.
 */
function instanceOf(api, prop = "math") {
	const wrapper = resolveWrapper(api[prop]);
	if (!wrapper) throw new Error(`resolveWrapper(api.${prop}) returned null`);
	return wrapper.____slothlet;
}

/**
 * An ApiManager over a stub instance carrying only the handlers given.
 * @param {object} handlers - Handlers the stub instance exposes.
 * @returns {ApiManager} The manager.
 */
function managerWith(handlers) {
	return new ApiManager({ handlers, debug: () => {} });
}

/**
 * A stub api cache: moduleID → `{ endpoint }`.
 * @param {Record<string, string>} endpoints - Endpoint per moduleID.
 * @returns {object} Stub with the cache-manager reads `_findAffectedCaches` makes.
 */
function cacheOf(endpoints) {
	return {
		getAllModuleIDs: () => Object.keys(endpoints),
		get: (id) => (Object.hasOwn(endpoints, id) ? { endpoint: endpoints[id] } : undefined),
		has: (id) => Object.hasOwn(endpoints, id)
	};
}

describe("ApiManager helpers — inputs their guards accept", () => {
	let api;

	afterEach(async () => {
		if (api?.shutdown) await api.shutdown();
		api = null;
	});

	it("constructor: an instance with no config records no initial config", () => {
		expect(new ApiManager({}).state.initialConfig).toBeNull();
		expect(new ApiManager(undefined).state.initialConfig).toBeNull();
	});

	it("syncWrapper: two values that are not wrapper proxies are left alone and report no update", async () => {
		api = await slothlet({ base: TEST_DIRS.API_TEST, mode: "eager", silent: true });
		const mgr = instanceOf(api).handlers.apiManager;
		const existing = { a: 1 };
		const next = { a: 2, b: 3 };
		await expect(mgr.syncWrapper(existing, next, {})).resolves.toBe(false);
		expect(existing).toEqual({ a: 1 });
	});

	it("mutateApiValue: a null next value with api debug on hands back null", async () => {
		api = await slothlet({ base: TEST_DIRS.API_TEST, mode: "eager", silent: true });
		const mgr = instanceOf(api).handlers.apiManager;
		const existing = { a: 1 };
		await expect(mgr.mutateApiValue(existing, null, { removeMissing: false }, { debug: { api: true } })).resolves.toBeNull();
		expect(existing).toEqual({ a: 1 });
	});

	it("setValueAtPath: with no collision mode an absent key is written", async () => {
		api = await slothlet({ base: TEST_DIRS.API_TEST, mode: "eager", silent: true });
		const mgr = instanceOf(api).handlers.apiManager;
		const root = {};
		await expect(mgr.setValueAtPath(root, ["value"], 7, {})).resolves.toBe(true);
		expect(root.value).toBe(7);
	});

	it("setValueAtPath: no root to write into fails as a write on null does", async () => {
		api = await slothlet({ base: TEST_DIRS.API_TEST, mode: "eager", silent: true });
		const mgr = instanceOf(api).handlers.apiManager;
		// Plain JS: `null.value = 7` throws a TypeError.
		await expect(mgr.setValueAtPath(null, ["value"], 7, { collisionMode: "merge" })).rejects.toBeInstanceOf(TypeError);
	});

	it("removeApiComponent: with ownership and metadata off, a path removal deletes the path and, unrecorded, adds no history", async () => {
		api = await slothlet({ base: TEST_DIRS.API_TEST, mode: "eager", silent: true });
		const sl = instanceOf(api);
		const saved = { ownership: sl.handlers.ownership, metadata: sl.handlers.metadata };
		sl.handlers.ownership = null;
		sl.handlers.metadata = null;
		try {
			const historyBefore = sl.handlers.apiManager.state.operationHistory.length;
			await expect(sl.handlers.apiManager.removeApiComponent("math.add", { recordHistory: false })).resolves.toBe(true);
			expect(api.math.add).toBeUndefined();
			expect(sl.handlers.apiManager.state.operationHistory.length).toBe(historyBefore);
		} finally {
			sl.handlers.ownership = saved.ownership;
			sl.handlers.metadata = saved.metadata;
		}
	});

	it("addApiComponent: no params is refused before anything is mounted", async () => {
		api = await slothlet({ base: TEST_DIRS.API_TEST, mode: "eager", silent: true });
		const mgr = instanceOf(api).handlers.apiManager;
		const before = Object.keys(api).sort();
		await expect(mgr.addApiComponent()).rejects.toMatchObject({ name: "SlothletError" });
		expect(Object.keys(api).sort()).toEqual(before);
	});

	it("addApiComponent: a forced add whose moduleID stringifies to an empty string is refused with MODULE_ID_REQUIRED", async () => {
		api = await slothlet({ base: TEST_DIRS.API_TEST, mode: "eager", silent: true });
		const mgr = instanceOf(api).handlers.apiManager;
		// String([]) is "": a truthy moduleID that names no module.
		await expect(
			mgr.addApiComponent({
				apiPath: "forced",
				folderPath: path.join(TEST_DIRS.API_TEST, "math"),
				options: { moduleID: [], forceOverwrite: true }
			})
		).rejects.toMatchObject({ code: "MODULE_ID_REQUIRED" });
		expect(api.forced).toBeUndefined();
	});

	it("removeApiComponent: with ownership off, an id that is only the separator prefix names no path", async () => {
		api = await slothlet({ base: TEST_DIRS.API_TEST, mode: "eager", silent: true });
		const sl = instanceOf(api);
		const savedOwnership = sl.handlers.ownership;
		sl.handlers.ownership = null;
		try {
			// No dot, so it is read as a moduleID; its base (the text before the separator) is empty.
			await expect(sl.handlers.apiManager.removeApiComponent(`${MODULE_ID_SEPARATOR}math`)).rejects.toMatchObject({
				code: "API_PATH_INVALID"
			});
		} finally {
			sl.handlers.ownership = savedOwnership;
		}
		expect(typeof api.math.add).toBe("function");
	});

	it("_collectCustomProperties: no value, a primitive, or a value that is not a wrapper has no custom properties", async () => {
		api = await slothlet({ base: TEST_DIRS.API_TEST, mode: "eager", silent: true });
		const mgr = instanceOf(api).handlers.apiManager;
		expect(mgr._collectCustomProperties(null, {})).toEqual({});
		expect(mgr._collectCustomProperties(42, {})).toEqual({});
		expect(mgr._collectCustomProperties({ note: "plain" }, {})).toEqual({});
	});

	it("_collectCustomProperties: with no fresh api a host-set member is still collected", async () => {
		api = await slothlet({ base: TEST_DIRS.API_TEST, mode: "eager", silent: true });
		const mgr = instanceOf(api).handlers.apiManager;
		api.math.note = "kept";
		const withoutFresh = mgr._collectCustomProperties(api.math, null);
		expect(withoutFresh).toMatchObject({ note: "kept" });
		expect(withoutFresh).toEqual(mgr._collectCustomProperties(api.math, {}));
	});

	it("_restoreCustomProperties: no target or no property map writes nothing", async () => {
		api = await slothlet({ base: TEST_DIRS.API_TEST, mode: "eager", silent: true });
		const mgr = instanceOf(api).handlers.apiManager;
		const target = { a: 1 };
		expect(mgr._restoreCustomProperties(null, { a: 2 })).toBeUndefined();
		mgr._restoreCustomProperties(target, null);
		mgr._restoreCustomProperties(target, "a=2");
		expect(target).toEqual({ a: 1 });
	});

	it("_restoreApiTree: no fresh api leaves the tree as it is", async () => {
		api = await slothlet({ base: TEST_DIRS.API_TEST, mode: "eager", silent: true });
		const mgr = instanceOf(api).handlers.apiManager;
		const before = Object.keys(api).sort();
		const add = api.math.add;
		await expect(mgr._restoreApiTree(null, ".", "base", "replace")).resolves.toBeUndefined();
		await expect(mgr._restoreApiTree(5, ".", "base", "replace")).resolves.toBeUndefined();
		expect(Object.keys(api).sort()).toEqual(before);
		expect(api.math.add).toBe(add);
	});
});

describe("_findAffectedCaches — lookups against stub handlers", () => {
	it("no cache manager: nothing to reload", () => {
		expect(managerWith({})._findAffectedCaches("math")).toEqual([]);
	});

	it("an ownership history entry whose module has no cache is skipped, and the lookup goes on to the parent cache", () => {
		const mgr = managerWith({
			apiCacheManager: cacheOf({ tools: "tools" }),
			ownership: { getPathHistory: () => [{ moduleID: "gone" }] }
		});
		expect(mgr._findAffectedCaches("tools.inner.leaf")).toEqual(["tools"]);
	});

	it("no base module and no cache covering the path: nothing to reload", () => {
		const mgr = managerWith({
			apiCacheManager: cacheOf({ tools: "tools", rooted: "" }),
			ownership: { getPathHistory: () => [{ moduleID: "gone" }] }
		});
		expect(mgr._findAffectedCaches("elsewhere")).toEqual([]);
	});
});

describe("reload by path with no cache to rebuild", () => {
	let api;

	afterEach(async () => {
		if (api?.shutdown) await api.shutdown();
		api = null;
	});

	/**
	 * Reload `apiPath` through the internal reload by path with the cache manager taken off for the call, so no
	 * cache is found to rebuild. The public reload refuses a path with nothing at it; this is the call it makes
	 * once the path checks pass.
	 * @param {object} sl - Internal Slothlet instance.
	 * @param {string} apiPath - Path to reload.
	 * @returns {Promise<void>} The reload.
	 */
	async function reloadWithoutCaches(sl, apiPath) {
		const saved = sl.handlers.apiCacheManager;
		sl.handlers.apiCacheManager = null;
		try {
			return await sl.handlers.apiManager._reloadByApiPath(apiPath);
		} finally {
			sl.handlers.apiCacheManager = saved;
		}
	}

	it("a path nothing provides is restored from the base, which has nothing there, so the tree is unchanged", async () => {
		api = await slothlet({ base: TEST_DIRS.API_TEST, mode: "eager", silent: true });
		const add = api.math.add;
		const before = Object.keys(api).sort();
		await expect(reloadWithoutCaches(instanceOf(api), "nowhere")).resolves.toBeUndefined();
		expect(api.nowhere).toBeUndefined();
		expect(Object.keys(api).sort()).toEqual(before);
		expect(api.math.add).toBe(add);
	});

	it("the base path is left as it is", async () => {
		api = await slothlet({ base: TEST_DIRS.API_TEST, mode: "eager", silent: true });
		const add = api.math.add;
		const before = Object.keys(api).sort();
		await expect(reloadWithoutCaches(instanceOf(api), ".")).resolves.toBeUndefined();
		expect(Object.keys(api).sort()).toEqual(before);
		expect(api.math.add).toBe(add);
	});
});
