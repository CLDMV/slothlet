/**
 *	@Project: @cldmv/slothlet
 *	@Filename: /tests/vitests/suites/addapi/addapi-remove-namespace-creator.test.vitest.mjs
 *	@Date: 2026-10-02 00:00:00 -07:00 (1790924400)
 *	@Author: Shinrai <CLDMV>
 *	@Email: <Shinrai@users.noreply.github.com>
 *	-----
 *	@Last modified by: Shinrai <CLDMV> (Shinrai@users.noreply.github.com)
 *	@Last modified time: 2026-10-02 00:00:00 -07:00 (1790924400)
 *	-----
 *	@Copyright: Copyright (c) 2013-2026 Catalyzed Motivation Inc. All rights reserved.
 */

/**
 * @fileoverview Removing the module that created a shared namespace keeps the children other modules
 * merged into it (#555).
 *
 * @description
 * Two modules are added at `plugins`: the first creates the namespace, the second merges its children
 * in (shared subfolders `tools` / `tools.net` and a leaf both export, `shared`, included). Removing the
 * first module must leave every leaf of the second reachable and callable — with the same references —
 * drop the first module's own leaves, hand a leaf both export to the survivor, and leave the namespace's
 * keys as the survivor alone lays them out. Covered for a plain namespace creator and for one whose default export makes
 * the namespace callable, in both add orders, under the `merge` and `merge-replace` collision modes.
 *
 * Runs across the full matrix (eager/lazy × async/live × hooks on/off).
 *
 * @module tests/vitests/suites/addapi/addapi-remove-namespace-creator
 */

process.env.SLOTHLET_INTERNAL_TEST_MODE = "true";

import { describe, it, expect, afterEach, vi } from "vitest";
import path from "node:path";
import slothlet from "@cldmv/slothlet";
import { resolveWrapper } from "#handlers/unified-wrapper";
import { getMatrixConfigs, TEST_DIRS } from "../../setup/vitest-helper.mjs";

// Instance creation plus two adds and a remove can exceed the default hook/test timeout on a loaded machine.
vi.setConfig({ hookTimeout: 60000, testTimeout: 60000 });

const API_TESTS_ROOT = path.dirname(TEST_DIRS.API_TEST);

/** Each module: its folder, the leaves it contributes (dotted path → return value), and its function. */
const MODULES = {
	other: {
		dir: path.join(API_TESTS_ROOT, "api_test_reload_comount_other"),
		leaves: {
			gamma: "other:gamma",
			delta: "other:delta",
			shared: "other:shared",
			"gear.cog": "other:cog",
			"gear.spring": "other:spring",
			"tools.wrench": "other:wrench",
			"tools.net.dns": "other:dns",
			"tools.net.ntp": "other:ntp",
			"tools.kit.tape": "other:tape",
			"tools.kit.box.nail": "other:nail"
		},
		main: null
	},
	ext: {
		dir: path.join(API_TESTS_ROOT, "api_test_reload_comount_ext"),
		leaves: {
			alpha: "ext:alpha",
			beta: "ext:beta",
			shared: "ext:shared",
			"tools.hammer": "ext:hammer",
			"tools.saw": "ext:saw",
			"tools.net.http": "ext:http",
			"tools.net.smtp": "ext:smtp"
		},
		main: null
	},
	callable: {
		dir: path.join(API_TESTS_ROOT, "api_test_reload_comount_callable"),
		leaves: { extra: "callable:extra" },
		main: "callable:main"
	}
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
 * Run a call that may throw synchronously or reject, as a promise either way.
 * @param {Function} fn - The call.
 * @returns {Promise<unknown>} Its settled result.
 */
function settle(fn) {
	return Promise.resolve().then(fn);
}

for (const { config, name } of getMatrixConfigs()) {
	for (const collisionApi of ["merge", "merge-replace"]) {
		describe(`Removing the module that created a namespace (#555) > ${collisionApi} > ${name}`, () => {
			let api;

			afterEach(async () => {
				if (api?.shutdown) await api.shutdown();
				api = null;
			});

			/**
			 * Create an instance with this suite's collision mode and every mutation enabled.
			 * @returns {Promise<object>} Slothlet API proxy.
			 */
			function createInstance() {
				return slothlet({
					...config,
					base: TEST_DIRS.API_TEST,
					silent: true,
					api: {
						...config.api,
						collision: { ...(config.api?.collision ?? {}), api: collisionApi },
						mutations: { add: true, remove: true, reload: true }
					}
				});
			}

			it.each([
				["a plain namespace", ["ext", "other"]],
				["a plain namespace", ["other", "ext"]],
				["a callable namespace", ["callable", "other"]],
				["a plain namespace under a callable merge", ["other", "callable"]]
			])("%s created by the first of %j", async (_label, [creator, survivor]) => {
				// The key order the survivor's namespace has on its own.
				const alone = await createInstance();
				await alone.slothlet.api.add("plugins", MODULES[survivor].dir, { moduleID: survivor });
				const survivorOrder = Object.keys(alone.plugins);
				await alone.shutdown();

				api = await createInstance();
				await api.slothlet.api.add("plugins", MODULES[creator].dir, { moduleID: creator });
				await api.slothlet.api.add("plugins", MODULES[survivor].dir, { moduleID: survivor });

				// Call every surviving leaf once (materializing it under lazy mode), then hold its reference.
				const survivorLeaves = MODULES[survivor].leaves;
				for (const dotted of Object.keys(survivorLeaves)) await at(api.plugins, dotted)();
				const refs = Object.fromEntries(Object.keys(survivorLeaves).map((dotted) => [dotted, at(api.plugins, dotted)]));

				await api.slothlet.api.remove(creator);

				// Every surviving leaf is reachable, callable, and returns the survivor's value. A leaf the
				// survivor shared with the removed module (`shared`) now resolves to the survivor's.
				for (const [dotted, expected] of Object.entries(survivorLeaves)) {
					const live = at(api.plugins, dotted);
					expect(typeof live, dotted).toBe("function");
					expect(await live(), `${dotted}()`).toBe(expected);
					if (!(dotted in MODULES[creator].leaves)) {
						// Same reference as before the removal, and a held reference still works.
						expect(live, `${dotted} reference`).toBe(refs[dotted]);
						expect(await refs[dotted](), `held ${dotted}()`).toBe(expected);
					}
				}

				// The removed module's own leaves are gone.
				for (const dotted of Object.keys(MODULES[creator].leaves)) {
					if (dotted in survivorLeaves) continue;
					expect(at(api.plugins, dotted), dotted).toBeUndefined();
				}

				// The namespace now reads as the survivor's alone: its keys, in its order.
				expect(Object.keys(api.plugins)).toEqual(survivorOrder);

				// The namespace's function follows the modules that remain (#533).
				if (MODULES[survivor].main) {
					expect(await api.plugins()).toBe(MODULES[survivor].main);
				} else if (MODULES[creator].main) {
					expect(typeof api.plugins).toBe("function");
					await expect(settle(() => api.plugins())).rejects.toThrow(/not a function/);
				} else {
					expect(typeof api.plugins).toBe("object");
				}
			});
		});
	}
}

describe("invalidateSpeculativeWrappers with a live-kept list (#555)", () => {
	let api;

	afterEach(async () => {
		if (api?.shutdown) await api.shutdown();
		api = null;
	});

	it("invalidates detached wrappers and plain values' wrappers, but keeps and reports live ones", async () => {
		api = await slothlet({
			...getMatrixConfigs()[0].config,
			base: TEST_DIRS.API_TEST,
			silent: true,
			api: { mutations: { add: true, remove: true } }
		});
		await api.slothlet.api.add("plugins", MODULES.other.dir, { moduleID: "other" });
		const slothletInstance = resolveWrapper(api.plugins).slothlet;
		const UnifiedWrapper = resolveWrapper(api.plugins).constructor;
		const gamma = api.plugins.gamma;
		// A wrapper that was never placed in the tree, at a path nothing occupies.
		const detached = new UnifiedWrapper(slothletInstance, { mode: "eager", apiPath: "nowhere.thing", initialImpl: () => "detached" });
		const detachedProxy = detached.createProxy();
		expect(await detachedProxy()).toBe("detached");

		const kept = [];
		slothletInstance.handlers.apiManager.invalidateSpeculativeWrappers(
			{ plain: { live: gamma, detached: detachedProxy, value: 1 } },
			undefined,
			kept
		);

		expect(kept).toEqual([gamma]);
		expect(await api.plugins.gamma()).toBe("other:gamma");
		expect(() => detachedProxy()).toThrow(/invalidated/);
	});
});
