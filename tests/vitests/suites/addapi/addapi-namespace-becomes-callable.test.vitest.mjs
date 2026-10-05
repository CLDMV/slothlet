/**
 *
 *	@Project: @cldmv/slothlet
 *	@Filename: /tests/vitests/suites/addapi/addapi-namespace-becomes-callable.test.vitest.mjs
 *	@Date: 2026-10-02T00:00:00-07:00 (1790924400)
 *	@Author: Nate Corcoran <CLDMV>
 *	@Email: <Shinrai@users.noreply.github.com>
 *	-----
 *	@Last modified by: Nate Corcoran <CLDMV> (Shinrai@users.noreply.github.com)
 *	@Last modified time: 2026-10-03T22:28:16-07:00 (1791091696)
 *	-----
 *	@Copyright: Copyright (c) 2013-2026 Catalyzed Motivation Inc. All rights reserved.
 *
 */

/**
 * @fileoverview A plain namespace becomes callable when a later module supplies its function (#533).
 *
 * @description
 * Module `other` mounts a plain namespace at `plugins`; module `callable` then adds a folder whose single
 * file default-exports a function, which flattens onto the same mount. The namespace must become callable
 * (`typeof api.plugins === "function"`, `api.plugins()` runs the function) while every child `other`
 * contributed stays reachable. A reference to `api.plugins` held from before the change keeps reading,
 * enumerating and writing through to the live namespace; it stays non-callable itself, because a Proxy's
 * callability is fixed when it is created.
 *
 * Under each instance collision mode, two modules can supply the namespace's function: `merge` keeps the
 * first one (first writer wins), `merge-replace` takes the incoming one, in every add order, and removing
 * either module resolves the function again from the modules that remain.
 *
 * Also covered: both add orders, the per-call `merge-replace` and `replace` collision modes, a reload that gives
 * the namespace its function, a reload of either module, removing the module that supplied the
 * function (its children go, the namespace keeps the callable shape and throws a clean "not a function"),
 * re-adding it, and a namespace no module ever makes callable staying `typeof` "object".
 *
 * Runs across the full matrix (eager/lazy × async/live × hooks on/off).
 *
 * @module tests/vitests/suites/addapi/addapi-namespace-becomes-callable
 */

process.env.SLOTHLET_INTERNAL_TEST_MODE = "true";

import { describe, it, expect, afterEach, vi } from "vitest";
import { cpSync, rmSync, writeFileSync } from "node:fs";
import path from "node:path";
import slothlet from "@cldmv/slothlet";
import { resolveWrapper } from "#handlers/unified-wrapper";
import { getMatrixConfigs, TEST_DIRS } from "../../setup/vitest-helper.mjs";

// Instance creation plus several adds can exceed the default hook/test timeout on a loaded machine.
vi.setConfig({ hookTimeout: 60000, testTimeout: 60000 });

const API_TESTS_ROOT = path.dirname(TEST_DIRS.API_TEST);
const OTHER_DIR = path.join(API_TESTS_ROOT, "api_test_reload_comount_other");
const EXT_DIR = path.join(API_TESTS_ROOT, "api_test_reload_comount_ext");
const CALLABLE_DIR = path.join(API_TESTS_ROOT, "api_test_reload_comount_callable");
const SECOND_DIR = path.join(API_TESTS_ROOT, "api_test_namespace_callable_second");

/** Folder per moduleID, for the add-order permutations. */
const DIRS = { other: OTHER_DIR, callable: CALLABLE_DIR, second: SECOND_DIR };
/** What each function-supplying module's namespace function returns. */
const MAIN = { callable: "callable:main", second: "second:main" };

/** Leaves `other` contributes under `api.plugins`, with the value each returns. */
const OTHER_LEAVES = {
	gamma: "other:gamma",
	delta: "other:delta",
	"gear.cog": "other:cog",
	"tools.wrench": "other:wrench",
	"tools.kit.box.nail": "other:nail"
};

/**
 * Resolve a dotted path below a node.
 * @param {*} node - Starting node.
 * @param {string} dotted - Dotted path relative to `node`.
 * @returns {*} The value at that path, or undefined.
 */
function at(node, dotted) {
	let cur = node;
	for (const part of dotted.split(".")) {
		if (cur === undefined || cur === null) return undefined;
		cur = cur[part];
	}
	return cur;
}

/**
 * Assert every listed leaf below `node` is callable and returns its expected value.
 * @param {*} node - Namespace to read from.
 * @param {Record<string, string>} leaves - Map of dotted path → expected return value.
 * @returns {Promise<void>}
 */
async function expectLeaves(node, leaves) {
	for (const [dotted, expected] of Object.entries(leaves)) {
		const fn = at(node, dotted);
		expect(typeof fn, dotted).toBe("function");
		expect(await fn(), `${dotted}()`).toBe(expected);
	}
}

/**
 * Create an instance with add/remove/reload enabled.
 * @param {object} config - Matrix config.
 * @param {string} [collisionApi] - `api.collision.api` to use; the matrix config's when omitted.
 * @returns {Promise<object>} Slothlet API proxy.
 */
function createInstance(config, collisionApi) {
	const apiConfig = { ...config.api, mutations: { add: true, remove: true, reload: true, allowCollisionOverride: true } };
	if (collisionApi) apiConfig.collision = { ...(config.api?.collision ?? {}), api: collisionApi };
	// allowCollisionOverride lets a per-call `collisionMode` take effect.
	return slothlet({ ...config, base: TEST_DIRS.API_TEST, silent: true, api: apiConfig });
}

/**
 * Run a call that may throw synchronously or reject, as a promise either way.
 * @param {Function} fn - The call.
 * @returns {Promise<unknown>} Its settled result.
 */
function settle(fn) {
	return Promise.resolve().then(fn);
}

for (const { config, name } of getMatrixConfigs()) {
	describe(`A namespace becomes callable when a later module adds its function (#533) > ${name}`, () => {
		let api;
		let scratchDir;

		afterEach(async () => {
			if (api?.shutdown) await api.shutdown();
			api = null;
			if (scratchDir) rmSync(scratchDir, { recursive: true, force: true });
			scratchDir = null;
		});

		/**
		 * Mount `other` (plain namespace) at `plugins`, read it once, then add `callable` there.
		 * @returns {Promise<object>} The reference to `api.plugins` held from before the callable add.
		 */
		async function namespaceThenCallable() {
			api = await createInstance(config);
			await api.slothlet.api.add("plugins", OTHER_DIR, { moduleID: "other" });
			const held = api.plugins;
			expect(typeof held).toBe("object");
			await expectLeaves(held, OTHER_LEAVES);
			await api.slothlet.api.add("plugins", CALLABLE_DIR, { moduleID: "callable" });
			return held;
		}

		it("makes api.plugins callable and keeps the existing namespace's children", async () => {
			await namespaceThenCallable();

			expect(typeof api.plugins).toBe("function");
			expect(await api.plugins()).toBe("callable:main");
			await expectLeaves(api.plugins, { extra: "callable:extra", ...OTHER_LEAVES });
			expect(Object.keys(api.plugins)).toEqual(expect.arrayContaining(["gamma", "delta", "gear", "tools", "extra"]));
		});

		it("a reference held from before keeps reading, enumerating and writing through to the namespace", async () => {
			const held = await namespaceThenCallable();

			await expectLeaves(held, { extra: "callable:extra", ...OTHER_LEAVES });
			expect(held.gamma).toBe(api.plugins.gamma);
			expect(Object.keys(held).sort()).toEqual(Object.keys(api.plugins).sort());
			expect("extra" in held).toBe(true);

			held.note = "from-held";
			expect(api.plugins.note).toBe("from-held");
			api.plugins.note2 = "from-live";
			expect(held.note2).toBe("from-live");

			// A held reference stays non-callable: a Proxy's callability is fixed at creation.
			expect(typeof held).toBe("object");
			expect(() => held()).toThrow(TypeError);
		});

		it.each([
			["merge-replace", { extra: "callable:extra", ...OTHER_LEAVES }],
			["replace", { extra: "callable:extra" }]
		])("becomes callable when the function arrives under collisionMode %s", async (collisionMode, leaves) => {
			api = await createInstance(config);
			await api.slothlet.api.add("plugins", OTHER_DIR, { moduleID: "other" });
			const held = api.plugins;
			expect(typeof held).toBe("object");
			await api.slothlet.api.add("plugins", CALLABLE_DIR, { moduleID: "callable", collisionMode });

			expect(typeof api.plugins).toBe("function");
			expect(await api.plugins()).toBe("callable:main");
			await expectLeaves(api.plugins, leaves);
			await expectLeaves(held, leaves);
			expect(typeof held).toBe("object");
		});

		it("becomes callable when a reload gives the namespace its function", async () => {
			scratchDir = path.join(process.cwd(), "tmp", `namespace-callable-533-${name.replace(/[^a-z0-9]+/gi, "-")}`);
			rmSync(scratchDir, { recursive: true, force: true });
			cpSync(CALLABLE_DIR, scratchDir, { recursive: true });
			const mainFile = path.join(scratchDir, "main.mjs");
			writeFileSync(mainFile, `export function extra() {\n\treturn "callable:extra";\n}\n`);

			api = await createInstance(config);
			await api.slothlet.api.add("plugins", OTHER_DIR, { moduleID: "other" });
			await api.slothlet.api.add("plugins", scratchDir, { moduleID: "callable" });
			const held = api.plugins;
			expect(typeof held).toBe("object");
			// Without a default export the file does not flatten onto the mount.
			await expectLeaves(held, { "main.extra": "callable:extra", ...OTHER_LEAVES });

			writeFileSync(
				mainFile,
				`export default function main() {\n\treturn "callable:main:v2";\n}\nexport function extra() {\n\treturn "callable:extra";\n}\n`
			);
			await api.slothlet.api.reload("callable");

			expect(typeof api.plugins).toBe("function");
			expect(await api.plugins()).toBe("callable:main:v2");
			await expectLeaves(api.plugins, { extra: "callable:extra", ...OTHER_LEAVES });
			await expectLeaves(held, OTHER_LEAVES);
		});

		it("is callable whichever module is added first", async () => {
			api = await createInstance(config);
			await api.slothlet.api.add("plugins", CALLABLE_DIR, { moduleID: "callable" });
			await api.slothlet.api.add("plugins", OTHER_DIR, { moduleID: "other" });

			expect(typeof api.plugins).toBe("function");
			expect(await api.plugins()).toBe("callable:main");
			await expectLeaves(api.plugins, { extra: "callable:extra", ...OTHER_LEAVES });
		});

		it("stays callable when a third, plain module is added afterwards", async () => {
			await namespaceThenCallable();
			await api.slothlet.api.add("plugins", EXT_DIR, { moduleID: "ext" });

			expect(typeof api.plugins).toBe("function");
			expect(await api.plugins()).toBe("callable:main");
			await expectLeaves(api.plugins, { extra: "callable:extra", alpha: "ext:alpha", ...OTHER_LEAVES });
		});

		it.each(["other", "callable"])("stays callable with every child after reload('%s')", async (target) => {
			const held = await namespaceThenCallable();

			await api.slothlet.api.reload(target);

			expect(typeof api.plugins).toBe("function");
			expect(await api.plugins()).toBe("callable:main");
			await expectLeaves(api.plugins, { extra: "callable:extra", ...OTHER_LEAVES });
			await expectLeaves(held, OTHER_LEAVES);
		});

		it("removing the module that supplied the function reverts the namespace's children", async () => {
			const held = await namespaceThenCallable();

			await api.slothlet.api.remove("callable");

			expect(api.plugins.extra).toBeUndefined();
			await expectLeaves(api.plugins, OTHER_LEAVES);
			await expectLeaves(held, OTHER_LEAVES);
			// The callable proxy is kept; with no function behind it, a call fails cleanly.
			expect(typeof api.plugins).toBe("function");
			await expect(settle(() => api.plugins())).rejects.toThrow(/not a function/);
		});

		it("becomes callable again when the removed module is added back", async () => {
			await namespaceThenCallable();
			await api.slothlet.api.remove("callable");
			await api.slothlet.api.add("plugins", CALLABLE_DIR, { moduleID: "callable" });

			expect(typeof api.plugins).toBe("function");
			expect(await api.plugins()).toBe("callable:main");
			await expectLeaves(api.plugins, { extra: "callable:extra", ...OTHER_LEAVES });
		});

		it("swapping the proxy in the parent leaves a node the path no longer leads to alone", async () => {
			api = await createInstance(config);
			await api.slothlet.api.add("plugins", OTHER_DIR, { moduleID: "other" });
			const gear = api.plugins.gear;
			const gearWrapper = resolveWrapper(gear);
			const stranger = {};

			// Still attached, but the parent holds a different proxy than the one named: no change.
			gearWrapper.___replaceInParent(stranger, {});
			expect(api.plugins.gear).toBe(gear);

			// Detached: the walk runs off the end of the tree and changes nothing.
			await api.slothlet.api.remove("other");
			expect(api.plugins).toBeUndefined();
			expect(() => gearWrapper.___replaceInParent(gear, stranger)).not.toThrow();
			expect(api.plugins).toBeUndefined();
		});

		it("a namespace no module makes callable stays typeof object", async () => {
			api = await createInstance(config);
			await api.slothlet.api.add("plugins", OTHER_DIR, { moduleID: "other" });
			const held = api.plugins;
			await api.slothlet.api.add("plugins", EXT_DIR, { moduleID: "ext" });

			expect(typeof api.plugins).toBe("object");
			expect(api.plugins).toBe(held);
			await expectLeaves(api.plugins, { alpha: "ext:alpha", ...OTHER_LEAVES });

			await api.slothlet.api.reload("ext");
			expect(typeof api.plugins).toBe("object");
			expect(api.plugins).toBe(held);
		});
	});
}

for (const { config, name } of getMatrixConfigs()) {
	for (const collisionApi of ["merge", "merge-replace"]) {
		describe(`A namespace's function under collision mode ${collisionApi} (#533) > ${name}`, () => {
			let api;

			afterEach(async () => {
				if (api?.shutdown) await api.shutdown();
				api = null;
			});

			/**
			 * Add each module at `plugins` in order.
			 * @param {string[]} order - moduleIDs, in add order.
			 * @returns {Promise<void>}
			 */
			async function addInOrder(order) {
				api = await createInstance(config, collisionApi);
				for (const moduleID of order) await api.slothlet.api.add("plugins", DIRS[moduleID], { moduleID });
			}

			it.each([[["other", "callable"]], [["callable", "other"]]])("a namespace and a function: %j", async (order) => {
				await addInOrder(order);

				expect(typeof api.plugins).toBe("function");
				expect(await api.plugins()).toBe("callable:main");
				await expectLeaves(api.plugins, { extra: "callable:extra", ...OTHER_LEAVES });
			});

			it.each([[["other", "callable", "second"]], [["callable", "second", "other"]], [["second", "other", "callable"]]])(
				"two functions, added %j, resolve by the mode and again on removal",
				async (order) => {
					const suppliers = order.filter((moduleID) => moduleID !== "other");
					const winner = collisionApi === "merge" ? suppliers[0] : suppliers[1];
					const loser = suppliers.find((moduleID) => moduleID !== winner);
					await addInOrder(order);

					expect(typeof api.plugins).toBe("function");
					expect(await api.plugins()).toBe(MAIN[winner]);
					await expectLeaves(api.plugins, { extra: "callable:extra", more: "second:more", ...OTHER_LEAVES });

					// Removing the module whose function lost keeps the winner's.
					await api.slothlet.api.remove(loser);
					expect(await api.plugins()).toBe(MAIN[winner]);
					await expectLeaves(api.plugins, OTHER_LEAVES);
				}
			);

			it.each([[["other", "callable", "second"]], [["callable", "second", "other"]], [["second", "other", "callable"]]])(
				"two functions, added %j: removing the winning module reverts to the other function",
				async (order) => {
					const suppliers = order.filter((moduleID) => moduleID !== "other");
					const winner = collisionApi === "merge" ? suppliers[0] : suppliers[1];
					const remaining = suppliers.find((moduleID) => moduleID !== winner);
					await addInOrder(order);
					expect(await api.plugins()).toBe(MAIN[winner]);

					await api.slothlet.api.remove(winner);

					expect(typeof api.plugins).toBe("function");
					expect(await api.plugins()).toBe(MAIN[remaining]);
					await expectLeaves(api.plugins, OTHER_LEAVES);
				}
			);

			it("two functions and a namespace: removing the namespace's module keeps the winning function", async () => {
				const winner = collisionApi === "merge" ? "callable" : "second";
				await addInOrder(["callable", "second", "other"]);
				expect(await api.plugins()).toBe(MAIN[winner]);

				await api.slothlet.api.remove("other");

				expect(await api.plugins()).toBe(MAIN[winner]);
				expect(api.plugins.gamma).toBeUndefined();
				await expectLeaves(api.plugins, { extra: "callable:extra", more: "second:more" });
			});
		});
	}
}

describe("UnifiedWrapper callable-impl helpers (#533)", () => {
	let api;

	afterEach(async () => {
		if (api?.shutdown) await api.shutdown();
		api = null;
	});

	it("_isCallableImpl recognizes a function and a default-exported function, and nothing else", async () => {
		api = await createInstance(getMatrixConfigs()[0].config);
		await api.slothlet.api.add("plugins", OTHER_DIR, { moduleID: "other" });
		const UnifiedWrapper = resolveWrapper(api.plugins).constructor;

		expect(UnifiedWrapper._isCallableImpl(() => {})).toBe(true);
		expect(UnifiedWrapper._isCallableImpl({ default() {} })).toBe(true);
		expect(UnifiedWrapper._isCallableImpl({ default: "x" })).toBe(false);
		expect(UnifiedWrapper._isCallableImpl({})).toBe(false);
		expect(UnifiedWrapper._isCallableImpl(null)).toBe(false);
		expect(UnifiedWrapper._isCallableImpl(undefined)).toBe(false);
	});

	it("a namespace adopts a default-exported function impl and calls it", async () => {
		api = await createInstance(getMatrixConfigs()[0].config);
		await api.slothlet.api.add("plugins", OTHER_DIR, { moduleID: "other" });
		const wrapper = resolveWrapper(api.plugins);

		expect(wrapper.___adoptCallableImpl({ default: () => "from-default" })).toBe(true);
		expect(typeof api.plugins).toBe("function");
		expect(await api.plugins()).toBe("from-default");
		// A non-callable impl, or the impl the namespace already has, changes nothing.
		expect(wrapper.___adoptCallableImpl({ gamma: 1 }, true)).toBe(false);
		expect(wrapper.___adoptCallableImpl(wrapper.____slothletInternal.impl, true)).toBe(false);
		// Under merge semantics an existing function is kept.
		expect(wrapper.___adoptCallableImpl(() => "later")).toBe(false);
		expect(await api.plugins()).toBe("from-default");
		await expectLeaves(api.plugins, OTHER_LEAVES);
	});

	it("a merge loser's function is never restored as the namespace's function", async () => {
		api = await createInstance(getMatrixConfigs()[0].config, "merge");
		await api.slothlet.api.add("plugins", OTHER_DIR, { moduleID: "other" });
		await api.slothlet.api.add("plugins", EXT_DIR, { moduleID: "ext" });
		// Two functions recorded at the namespace under merge: the first owns it, the second loses (O08).
		const ownership = resolveWrapper(api.plugins).slothlet.handlers.ownership;
		const register = (moduleID, value) =>
			ownership.register({ moduleID, apiPath: "plugins", value, source: "core", collisionMode: "merge" });
		expect(register("winner", () => "winner").isMergeLoss).toBe(false);
		expect(register("loser", () => "loser").isMergeLoss).toBe(true);

		// Removing ext rolls the namespace back; its function is resolved from the remaining entries.
		await api.slothlet.api.remove("ext");

		expect(typeof api.plugins).toBe("function");
		expect(await api.plugins()).toBe("winner");
		await expectLeaves(api.plugins, OTHER_LEAVES);
	});

	it("pinLiveEntries leaves a path with no ownership stack, and entries for other wrappers, alone", async () => {
		api = await createInstance(getMatrixConfigs()[0].config);
		await api.slothlet.api.add("plugins", OTHER_DIR, { moduleID: "other" });
		const wrapper = resolveWrapper(api.plugins);
		const ownership = wrapper.slothlet.handlers.ownership;
		const before = ownership.getPathHistory("plugins").map((entry) => entry.value);

		expect(() => ownership.pinLiveEntries("no.such.path", wrapper, {}, resolveWrapper)).not.toThrow();
		ownership.pinLiveEntries("plugins", resolveWrapper(api.plugins.gear), {}, resolveWrapper);

		expect(ownership.getPathHistory("plugins").map((entry) => entry.value)).toEqual(before);
	});
});
