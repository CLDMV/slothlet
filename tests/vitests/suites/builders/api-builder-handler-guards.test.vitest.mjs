/**
 *
 *	@Project: @cldmv/slothlet
 *	@Filename: tests/vitests/suites/builders/api-builder-handler-guards.test.vitest.mjs
 *	@Date: 2026-11-28T10:44:16-08:00 (1795891456)
 *	@Author: Nate Corcoran <CLDMV>
 *	@Email: <Shinrai@users.noreply.github.com>
 *	-----
 *	@Last modified by: Nate Corcoran <CLDMV> (Shinrai@users.noreply.github.com)
 *	@Last modified time: 2026-11-28T12:15:25-08:00 (1795896925)
 *	-----
 *	@Copyright: Copyright (c) 2013-2026 Catalyzed Motivation Inc. All rights reserved.
 *
 */

/**
 * @fileoverview The `slothlet.*` namespace methods of api_builder.mjs when a handler they use is missing.
 *
 * @description
 * Every namespace method checks for the handler (or the handler method) it forwards to before calling it.
 * These tests take a live instance, replace one handler with a stand-in that lacks the method (or with null),
 * and call the method through the public surface:
 *   - permissions.* and event.rules.* throw PERMISSION_MANAGER_NOT_AVAILABLE when the PermissionManager lacks the method
 *   - versioning.* answer undefined / false when no VersionManager is registered
 *   - metadata.get answers {} when no metadata handler is registered
 *   - api.add still mounts when no RoutineManager is registered
 *   - a metadata path is read as the path itself when no ApiManager (and so no add history) is registered
 *   - a namespace built without an EventManager, a MaterializeManager or (with diagnostics) a HookManager
 *     gets its fallback members
 *   - attachBuiltins attaches a pre-built destroy function when one is passed
 *
 * @module tests/vitests/suites/builders/api-builder-handler-guards
 */

process.env.SLOTHLET_INTERNAL_TEST_MODE = "true";

import { describe, it, expect, afterEach } from "vitest";
import slothlet from "@cldmv/slothlet";
import { resolveWrapper } from "#handlers/unified-wrapper";
import { DELIVERY_REASONS } from "#handlers/event-manager";
import { TEST_DIRS } from "../../setup/vitest-helper.mjs";

/**
 * Create an eager API on the standard fixture.
 * @param {object} [extra={}] - Additional config.
 * @returns {Promise<object>} The api.
 */
function makeApi(extra = {}) {
	return slothlet({ mode: "eager", runtime: "async", base: TEST_DIRS.API_TEST, ...extra });
}

/**
 * The internal slothlet instance behind an api.
 * @param {object} api - Slothlet api.
 * @returns {object} The instance.
 */
function getSlothlet(api) {
	return resolveWrapper(api.math).____slothlet;
}

/**
 * A stand-in for a handler that behaves like it except that one method is missing.
 * @param {object} handler - The real handler.
 * @param {string} missing - The method the stand-in lacks.
 * @returns {object} The stand-in.
 */
function withoutMethod(handler, missing) {
	return new Proxy(handler, {
		get(target, key) {
			if (key === missing) return undefined;
			const value = Reflect.get(target, key, target);
			return typeof value === "function" ? value.bind(target) : value;
		}
	});
}

/**
 * Run `fn` with `sl.handlers[name]` replaced, restoring it afterwards.
 * @param {object} sl - Slothlet instance.
 * @param {string} name - Handler key.
 * @param {*} replacement - The value to put in its place.
 * @param {Function} fn - The body.
 * @returns {Promise<*>} What `fn` returns.
 */
async function withHandler(sl, name, replacement, fn) {
	const original = sl.handlers[name];
	sl.handlers[name] = replacement;
	try {
		return await fn();
	} finally {
		sl.handlers[name] = original;
	}
}

let api;
afterEach(async () => {
	if (api) await api.shutdown().catch(() => {});
	api = null;
});

describe("api_builder – permission methods need the PermissionManager method they forward to", () => {
	const cases = [
		["addRule", (a) => a.slothlet.permissions.rules.add({ caller: "x.**", target: "y.**", effect: "deny" })],
		["removeRule", (a) => a.slothlet.permissions.rules.remove("perm-1")],
		["registerPrincipal", (a) => a.slothlet.permissions.principal.register("roles", { key: () => 1, resolve: () => [] })],
		["unregisterPrincipal", (a) => a.slothlet.permissions.principal.unregister("roles")],
		["invalidatePrincipal", (a) => a.slothlet.permissions.principal.invalidate("roles")],
		["checkAccess", (a) => a.slothlet.permissions.self.access("math.add")],
		["getRulesForCaller", (a) => a.slothlet.permissions.self.rules()],
		["checkCall", (a) => a.slothlet.permissions.global.check.call("x", "math.add", [])],
		["getRulesForPath", (a) => a.slothlet.permissions.global.rules.path("math.add")],
		["getRulesByModule", (a) => a.slothlet.permissions.global.rules.module("mod")],
		["seal", (a) => a.slothlet.permissions.control.seal()],
		["isSealed", (a) => a.slothlet.permissions.control.sealed],
		["addEventRule", (a) => a.slothlet.event.rules.add({ caller: "x.**", event: "e", effect: "deny" })],
		["removeEventRule", (a) => a.slothlet.event.rules.remove("event-rule-1")]
	];

	for (const [method, call] of cases) {
		it(`throws PERMISSION_MANAGER_NOT_AVAILABLE without permissionManager.${method}`, async () => {
			api = await makeApi();
			const sl = getSlothlet(api);
			await withHandler(sl, "permissionManager", withoutMethod(sl.handlers.permissionManager, method), () => {
				expect(() => call(api)).toThrow(expect.objectContaining({ code: "PERMISSION_MANAGER_NOT_AVAILABLE" }));
			});
		});
	}

	it("global.check.access throws PERMISSION_MANAGER_NOT_AVAILABLE without permissionManager.checkAccess", async () => {
		api = await makeApi();
		const sl = getSlothlet(api);
		await withHandler(sl, "permissionManager", withoutMethod(sl.handlers.permissionManager, "checkAccess"), () => {
			expect(() => api.slothlet.permissions.global.check.access("x", "math.add")).toThrow(
				expect.objectContaining({ code: "PERMISSION_MANAGER_NOT_AVAILABLE" })
			);
		});
	});
});

describe("api_builder – versioning methods without a VersionManager", () => {
	it("list / default / metadata.get / metadata.set answer undefined and remove answers false", async () => {
		api = await makeApi();
		const sl = getSlothlet(api);
		await withHandler(sl, "versionManager", null, async () => {
			expect(api.slothlet.versioning.list("auth")).toBeUndefined();
			expect(api.slothlet.versioning.default("auth", "v1")).toBeUndefined();
			expect(api.slothlet.versioning.metadata.get("auth", "v1")).toBeUndefined();
			expect(api.slothlet.versioning.metadata.set("auth", "v1", { stable: true })).toBeUndefined();
			await expect(api.slothlet.versioning.remove("auth", "v1")).resolves.toBe(false);
		});
	});
});

describe("api_builder – metadata.get without a metadata handler", () => {
	it("answers an empty object", async () => {
		api = await makeApi();
		const sl = getSlothlet(api);
		await withHandler(sl, "metadata", null, () => {
			expect(api.slothlet.metadata.get("math")).toEqual({});
		});
	});
});

describe("api_builder – api.add without a RoutineManager", () => {
	it("mounts the folder all the same", async () => {
		api = await makeApi();
		const sl = getSlothlet(api);
		const moduleID = await withHandler(sl, "routineManager", null, () => api.slothlet.api.add("extra", TEST_DIRS.API_TEST_MIXED));
		expect(typeof moduleID).toBe("string");
		expect(api.extra).toBeDefined();
	});
});

describe("api_builder – a metadata path without an ApiManager", () => {
	it("is read as the path itself", async () => {
		api = await makeApi();
		const sl = getSlothlet(api);
		api.slothlet.metadata.set("math", { owner: "host" });
		const expected = api.slothlet.metadata.get("math");
		const read = await withHandler(sl, "apiManager", null, () => api.slothlet.metadata.get("math"));
		expect(read).toEqual(expected);
		expect(read).toMatchObject({ owner: "host" });
	});
});

describe("api_builder – namespace fallbacks when a handler is missing at build time", () => {
	it("event members are inert stand-ins without an EventManager", async () => {
		api = await makeApi();
		const sl = getSlothlet(api);
		const ns = await withHandler(sl, "eventManager", null, () => sl.builders.apiBuilder.createSlothletNamespace({}));
		const subscription = ns.event.on("e", () => {});
		expect(subscription.level).toBe("deny");
		expect(subscription.off()).toBeUndefined();
		expect(ns.event.once("e", () => {}).level).toBe("deny");
		expect(ns.event.off("id")).toBe(false);
		await expect(ns.event.emit("e", {})).resolves.toBeUndefined();
		expect(ns.event.level("x", "e")).toBe("notify");
		expect(ns.event.strategy(() => {})).toBeUndefined();
		await expect(ns.event.deliver({}, "id")).resolves.toEqual({ delivered: false, reason: DELIVERY_REASONS.LISTENER_GONE });
		expect(ns.event.rules.add({})).toBeUndefined();
		expect(ns.event.rules.remove("id")).toBeUndefined();
	});

	it("materialize.wait resolves without a MaterializeManager", async () => {
		api = await makeApi();
		const sl = getSlothlet(api);
		const ns = await withHandler(sl, "materialize", null, () => sl.builders.apiBuilder.createSlothletNamespace({}));
		await expect(ns.materialize.wait()).resolves.toBeUndefined();
	});

	it("diag.hook is undefined without a HookManager", async () => {
		api = await makeApi({ diagnostics: true });
		const sl = getSlothlet(api);
		const ns = await withHandler(sl, "hookManager", null, () => sl.builders.apiBuilder.createSlothletNamespace({}));
		expect(ns.diag).toBeDefined();
		expect(ns.diag.hook).toBeUndefined();
	});
});

describe("api_builder – attachBuiltins with a pre-built destroy", () => {
	it("attaches destroy as a read-only, enumerable, configurable member", async () => {
		api = await makeApi();
		const sl = getSlothlet(api);
		const target = {};
		const destroy = () => "destroyed";
		const shutdown = () => "shut";
		sl.builders.apiBuilder.attachBuiltins(target, { slothlet: {}, shutdown, destroy });
		expect(Object.getOwnPropertyDescriptor(target, "destroy")).toEqual({
			value: destroy,
			enumerable: true,
			writable: false,
			configurable: true
		});
	});
});
