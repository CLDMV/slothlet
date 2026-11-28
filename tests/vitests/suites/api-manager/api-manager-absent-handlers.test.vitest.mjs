/**
 *
 *	@Project: @cldmv/slothlet
 *	@Filename: tests/vitests/suites/api-manager/api-manager-absent-handlers.test.vitest.mjs
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
 * @fileoverview ApiManager's add and removal flows on an instance with one of its optional handlers absent.
 *
 * @description
 * The metadata and version handlers are optional to a removal, and the routine handler is optional to an add: each
 * use of them there is guarded, so the call still does its work without them, it only skips the bookkeeping the
 * handler keeps. Each test takes the handlers off a live instance for the one call (restoring them after) and checks
 * the call's own result:
 *
 * - removing a path a module owns, and removing a module by its id, with no metadata or version handler;
 * - an add at a new path, and an add a "skip" collision rejects (at a named path and at the root), with no routine
 *   handler;
 * - a cross-module replace shadow record asked for with no moduleID.
 *
 * @module tests/vitests/suites/api-manager/api-manager-absent-handlers
 */

process.env.SLOTHLET_INTERNAL_TEST_MODE = "true";

import path from "node:path";
import { describe, it, expect, afterEach } from "vitest";
import slothlet from "@cldmv/slothlet";
import { resolveWrapper } from "#handlers/unified-wrapper";
import { TEST_DIRS } from "../../setup/vitest-helper.mjs";

const MATH_DIR = path.join(TEST_DIRS.API_TEST, "math");

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
 * Run `fn` with the named handlers taken off the instance, putting them back after.
 * @param {object} sl - Internal Slothlet instance.
 * @param {string[]} names - Handler names.
 * @param {() => Promise<*>} fn - The call to make.
 * @returns {Promise<*>} What `fn` resolves to.
 */
async function withoutHandlers(sl, names, fn) {
	const saved = names.map((name) => [name, sl.handlers[name]]);
	for (const name of names) sl.handlers[name] = null;
	try {
		return await fn();
	} finally {
		for (const [name, handler] of saved) sl.handlers[name] = handler;
	}
}

/**
 * An instance with no base directory, holding the math folder (module "mathmod") and a synthetic "tools" module.
 * @returns {Promise<object>} The api.
 */
async function loadWithMath() {
	const api = await slothlet({ mode: "eager", silent: true });
	await api.slothlet.api.add("math", MATH_DIR, { id: "mathmod" });
	await api.slothlet.api.add("tools", { exports: { ping: () => "pong" } }, { id: "tools" });
	return api;
}

describe("ApiManager with an optional handler absent", () => {
	let api;

	afterEach(async () => {
		if (api?.shutdown) await api.shutdown();
		api = null;
	});

	it("removing a path a module owns, with no metadata or version handler, removes it", async () => {
		api = await loadWithMath();
		const sl = instanceOf(api);
		const removed = await withoutHandlers(sl, ["metadata", "versionManager"], () => sl.handlers.apiManager.removeApiComponent("math.add"));
		expect(removed).toBe(true);
		expect(api.math?.add).toBeUndefined();
		expect(await api.tools.ping()).toBe("pong");
	});

	it("removing a module by its id, with no metadata or version handler, removes its mount", async () => {
		api = await loadWithMath();
		const sl = instanceOf(api);
		const removed = await withoutHandlers(sl, ["metadata", "versionManager"], () => sl.handlers.apiManager.removeApiComponent("mathmod"));
		expect(removed).toBe(true);
		expect(api.math).toBeUndefined();
		expect(await api.tools.ping()).toBe("pong");
	});

	it("an add at a new path, with no routine handler, mounts it", async () => {
		api = await loadWithMath();
		const sl = instanceOf(api);
		await withoutHandlers(sl, ["routineManager"], () =>
			sl.handlers.apiManager.addApiComponent({ apiPath: "extra", folderPath: { exports: { ping: () => "extra" } }, options: {} })
		);
		expect(await api.extra.ping()).toBe("extra");
	});

	it("an add a skip collision rejects at a named path, with no routine handler, leaves the existing module", async () => {
		api = await loadWithMath();
		const sl = instanceOf(api);
		const before = await api.math.add(2, 3);
		await withoutHandlers(sl, ["routineManager"], () =>
			sl.handlers.apiManager.addApiComponent({
				apiPath: "math",
				folderPath: { exports: { add: () => "replaced" } },
				options: { collisionMode: "skip" }
			})
		);
		expect(await api.math.add(2, 3)).toBe(before);
	});

	it("an add a skip collision rejects at the root, with no routine handler, leaves the existing module", async () => {
		api = await loadWithMath();
		const sl = instanceOf(api);
		await withoutHandlers(sl, ["routineManager"], () =>
			sl.handlers.apiManager.addApiComponent({
				apiPath: "",
				folderPath: { exports: { tools: { ping: () => "replaced" } } },
				options: { collisionMode: "skip" }
			})
		);
		expect(await api.tools.ping()).toBe("pong");
	});

	it("a replace shadow record asked for with no moduleID records nothing", async () => {
		api = await loadWithMath();
		const mgr = instanceOf(api).handlers.apiManager;
		const before = mgr.state.replaceShadows.size;
		expect(mgr._recordReplaceShadows(resolveWrapper(api.math), ["add"], [], null)).toBeUndefined();
		expect(mgr.state.replaceShadows.size).toBe(before);
		expect(typeof api.math.add).toBe("function");
	});
});
