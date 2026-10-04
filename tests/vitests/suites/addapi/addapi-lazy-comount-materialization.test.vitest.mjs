/**
 *
 *	@Project: @cldmv/slothlet
 *	@Filename: /tests/vitests/suites/addapi/addapi-lazy-comount-materialization.test.vitest.mjs
 *	@Date: 2026-10-02T12:32:44-07:00 (1790969564)
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
 * @fileoverview A lazy add into an existing namespace loads only what the merge inspects (#548).
 *
 * @description
 * Module `a` is added at `plugins`, then module `b` is added at the same path. `plugins.shared` is a
 * subfolder both modules contribute to, so the merge has to load both sides of it to combine their
 * children. Every other subfolder `b` brings (`gear`, `kit`, `net`, and `shared.inner` inside the
 * shared one) is `b`'s alone: nothing reads it during the add, so under lazy mode it must stay
 * unmaterialized after the add — including once pending microtasks and timers have run — and load
 * only on first access, one subfolder at a time. Eager mode is the control: there every subfolder
 * is already loaded by the add.
 *
 * Materialization state is read through the public `__materialized` / `__inFlight` diagnostics on
 * each subfolder, reached by own-property descriptors so the probe itself loads nothing. A plain
 * property read (`api.plugins.kit`) would not do: handing out a reference to a lazy subfolder through
 * its parent starts loading it, with or without an add.
 *
 * Runs across the full matrix (eager/lazy × async/live × hooks on/off).
 *
 * @module tests/vitests/suites/addapi/addapi-lazy-comount-materialization
 */

import { describe, it, expect, afterEach, vi } from "vitest";
import path from "node:path";
import slothlet from "@cldmv/slothlet";
import { getMatrixConfigs, TEST_DIRS } from "../../setup/vitest-helper.mjs";

// Instance creation plus two adds can exceed the default hook/test timeout on a loaded machine.
vi.setConfig({ hookTimeout: 60000, testTimeout: 60000 });

const API_TESTS_ROOT = path.dirname(TEST_DIRS.API_TEST);
const A_DIR = path.join(API_TESTS_ROOT, "api_test_lazy_add_comount_a");
const B_DIR = path.join(API_TESTS_ROOT, "api_test_lazy_add_comount_b");

/** Subfolders only `b` contributes, relative to `api.plugins`. */
const B_ONLY_FOLDERS = ["gear", "kit", "net", "shared.inner"];

/** Every leaf under `api.plugins` once both modules are added, with the value each returns. */
const LEAVES = {
	top: "a:top",
	"shared.alpha": "a:alpha",
	"shared.beta": "b:beta",
	"shared.inner.gamma": "b:gamma",
	"gear.cog": "b:cog",
	"gear.spring": "b:spring",
	"kit.tape": "b:tape",
	"kit.box.nail": "b:nail",
	"net.dns": "b:dns"
};

/**
 * Resolve a dotted path under `api.plugins`.
 * @param {object} api - Slothlet API proxy.
 * @param {string} dotted - Path relative to `api.plugins`.
 * @returns {*} The value at that path, or undefined.
 */
function at(api, dotted) {
	let cur = api.plugins;
	for (const part of dotted.split(".")) {
		if (cur === undefined || cur === null) return undefined;
		cur = cur[part];
	}
	return cur;
}

/**
 * Whether the namespace at a path has been loaded or has started loading.
 * @description
 * Reading a lazy child through its parent (`api.plugins.gear`) counts as accessing it and starts
 * loading it, so this walks own-property descriptors instead: a descriptor read hands back the child
 * without touching it, and `__materialized` / `__inFlight` are answered without loading anything.
 * @param {object} api - Slothlet API proxy.
 * @param {string} dotted - Path relative to `api.plugins`.
 * @returns {boolean} True once the namespace is materialized or its materialization is in flight.
 */
function loaded(api, dotted) {
	let node = api.plugins;
	for (const part of dotted.split(".")) node = Object.getOwnPropertyDescriptor(node, part)?.value;
	return node.__materialized === true || node.__inFlight === true;
}

/**
 * Let pending microtasks, immediates and short timers run.
 * @returns {Promise<void>}
 */
async function settle() {
	await new Promise((resolve) => setImmediate(resolve));
	await new Promise((resolve) => setTimeout(resolve, 50));
}

describe.each(getMatrixConfigs())("api.add into an existing namespace: materialization (#548) > Config: $name", ({ config }) => {
	let api;

	afterEach(async () => {
		await api?.shutdown();
		api = null;
	});

	/**
	 * Create an instance and add `a` then `b` at `plugins`.
	 * @returns {Promise<object>} Slothlet API proxy.
	 */
	async function createComounted() {
		const instance = await slothlet({
			...config,
			base: TEST_DIRS.API_TEST,
			api: { ...config.api, mutations: { add: true, remove: true, reload: true } }
		});
		await instance.slothlet.api.add("plugins", A_DIR, { moduleID: "a" });
		await instance.slothlet.api.add("plugins", B_DIR, { moduleID: "b" });
		return instance;
	}

	it.skipIf(config.mode !== "lazy")("leaves the added module's untouched subfolders unmaterialized", async () => {
		api = await createComounted();
		for (const folder of B_ONLY_FOLDERS) expect(loaded(api, folder), `plugins.${folder} right after the add`).toBe(false);

		await settle();
		for (const folder of B_ONLY_FOLDERS) expect(loaded(api, folder), `plugins.${folder} once the add has settled`).toBe(false);
	});

	it.skipIf(config.mode !== "lazy")("materializes only the subfolder that is accessed", async () => {
		api = await createComounted();
		await settle();

		expect(await api.plugins.gear.cog()).toBe("b:cog");
		await settle();

		expect(loaded(api, "gear")).toBe(true);
		for (const folder of B_ONLY_FOLDERS.filter((f) => f !== "gear")) {
			expect(loaded(api, folder), `plugins.${folder} after reading plugins.gear`).toBe(false);
		}
	});

	it.skipIf(config.mode !== "eager")("eager control: every subfolder is materialized by the add", async () => {
		api = await createComounted();
		for (const folder of B_ONLY_FOLDERS) expect(at(api, folder).__materialized, `plugins.${folder}`).toBe(true);
	});

	it("keeps every leaf of both modules reachable", async () => {
		api = await createComounted();
		for (const [dotted, expected] of Object.entries(LEAVES)) {
			const fn = at(api, dotted);
			expect(typeof fn, `api.plugins.${dotted}`).toBe("function");
			expect(await fn(), `api.plugins.${dotted}()`).toBe(expected);
		}
	});
});
