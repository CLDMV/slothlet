/**
 *
 *	@Project: @cldmv/slothlet
 *	@Filename: /tests/vitests/suites/api-manager/api-manager-remove-overwrite-restore.test.vitest.mjs
 *	@Date: 2026-09-28T23:29:42-07:00 (1790663382)
 *	@Author: Shinrai <CLDMV>
 *	@Email: <Shinrai@users.noreply.github.com>
 *	-----
 *	@Last modified by: Shinrai <CLDMV> (Shinrai@users.noreply.github.com)
 *	@Last modified time: 2026-10-03T22:14:58-07:00 (1791090898)
 *	-----
 *	@Copyright: Copyright (c) 2013-2026 Catalyzed Motivation Inc. All rights reserved.
 *
 */

/**
 * @fileoverview Regression coverage (#531): removing a module that `forceOverwrite`-replaced part of another
 * module's mount must restore the overwritten module's FULL subtree, in lazy mode exactly as in eager mode.
 *
 * `launcher` is added with `session/store.mjs` and `session/vault/lock.mjs`; `shadow` then replaces
 * `launcher.session` with its own `store.mjs` and `vault/lock.mjs`. After `remove("shadow")`, every one of
 * launcher's leaves must be reachable and run launcher's code again. Before the fix, lazy mode lost
 * `launcher.session.vault.lock` entirely (or overflowed the stack reaching it): the rollback wrote the previous
 * owner's impl onto shadow's still-unmaterialized namespace wrapper, which leaves a namespace empty — its
 * children live on the wrapper, not in the impl — so launcher's nested leaves were never brought back.
 * Eager is the control: its namespaces are already populated, so it restored correctly. The restore goes INTO
 * the live wrappers, so a reference taken while `shadow` was live keeps working and runs launcher's code; a
 * third module merged into the overwritten namespace keeps its content; values set on the namespace by hand
 * are kept after the restored keys; and keys read in their pre-overwrite order — in both modes.
 * @module tests/vitests/suites/api-manager/api-manager-remove-overwrite-restore
 */

process.env.SLOTHLET_INTERNAL_TEST_MODE = "true";

import path from "node:path";
import { describe, it, expect, afterEach } from "vitest";
import slothlet from "@cldmv/slothlet";
import { getMatrixConfigs, TEST_DIRS } from "../../setup/vitest-helper.mjs";

const FIXTURES = path.join(path.dirname(TEST_DIRS.API_TEST), "api_test_lazy_remove_overwrite");
const BASE = path.join(FIXTURES, "base"); // core/alpha.mjs: ping()
const EXT = path.join(FIXTURES, "ext"); // main.mjs: activate(); session/store.mjs: create(), destroy(); session/vault/lock.mjs: open()
const SHADOW = path.join(FIXTURES, "shadow"); // store.mjs: create(), destroy(); vault/lock.mjs: open()
const THIRD = path.join(FIXTURES, "third"); // extra.mjs: hello()

/**
 * Call every leaf `launcher` provides, reporting a thrown error as `"ERR <message>"` instead of failing
 * on the first one, so one assertion shows the whole restored surface.
 * @param {object} api - Composed api.
 * @returns {Promise<Object<string, string>>} Leaf name → return value (or error marker).
 */
async function callLauncherLeaves(api) {
	const calls = {
		create: () => api.launcher.session.store.create(),
		destroy: () => api.launcher.session.store.destroy(),
		open: () => api.launcher.session.vault.lock.open(),
		activate: () => api.launcher.main.activate()
	};
	const results = {};
	for (const [name, call] of Object.entries(calls)) {
		try {
			results[name] = await call();
		} catch (error) {
			results[name] = `ERR ${error.message}`;
		}
	}
	return results;
}

const LAUNCHER_RESULTS = { create: "ext-create", destroy: "ext-destroy", open: "ext-open", activate: "ext-activate" };

describe.each(getMatrixConfigs())("remove() of a forceOverwrite module restores the overwritten subtree (#531) > $name", ({ config }) => {
	let api;

	afterEach(async () => {
		if (api?.shutdown) await api.shutdown();
		api = null;
	});

	it("restores every overwritten leaf when the original leaves were never called", async () => {
		api = await slothlet({ ...config, base: BASE, silent: true });
		await api.slothlet.api.add("launcher", EXT, { moduleID: "launcher" });
		await api.slothlet.api.add("launcher.session", SHADOW, { moduleID: "shadow", forceOverwrite: true });

		expect(await api.slothlet.api.remove("shadow")).toBe(true);

		expect(await callLauncherLeaves(api)).toEqual(LAUNCHER_RESULTS);
		expect(Object.keys(api.launcher.session.vault)).toContain("lock");
	});

	it("restores every overwritten leaf when the original leaves were called before the overwrite", async () => {
		api = await slothlet({ ...config, base: BASE, silent: true });
		await api.slothlet.api.add("launcher", EXT, { moduleID: "launcher" });
		expect(await callLauncherLeaves(api)).toEqual(LAUNCHER_RESULTS);
		await api.slothlet.api.add("launcher.session", SHADOW, { moduleID: "shadow", forceOverwrite: true });

		expect(await api.slothlet.api.remove("shadow")).toBe(true);

		expect(await callLauncherLeaves(api)).toEqual(LAUNCHER_RESULTS);
		expect(Object.keys(api.launcher.session.vault)).toContain("lock");
	});

	it("restores every overwritten leaf when the overwriting leaves were called before the remove", async () => {
		api = await slothlet({ ...config, base: BASE, silent: true });
		await api.slothlet.api.add("launcher", EXT, { moduleID: "launcher" });
		await api.slothlet.api.add("launcher.session", SHADOW, { moduleID: "shadow", forceOverwrite: true });
		expect([await api.launcher.session.store.create(), await api.launcher.session.vault.lock.open()]).toEqual([
			"shadow-create",
			"shadow-open"
		]);

		expect(await api.slothlet.api.remove("shadow")).toBe(true);

		expect(await callLauncherLeaves(api)).toEqual(LAUNCHER_RESULTS);
		expect(Object.keys(api.launcher.session.vault)).toContain("lock");
	});

	it("keeps a third module's content merged into the overwritten namespace alongside the restored leaves", async () => {
		api = await slothlet({ ...config, base: BASE, silent: true });
		await api.slothlet.api.add("launcher", EXT, { moduleID: "launcher" });
		await api.slothlet.api.add("launcher.session", SHADOW, { moduleID: "shadow", forceOverwrite: true });
		await api.slothlet.api.add("launcher.session.vault", THIRD, { moduleID: "third" });
		expect(await api.launcher.session.vault.extra.hello()).toBe("third-hello");

		expect(await api.slothlet.api.remove("shadow")).toBe(true);

		expect(await callLauncherLeaves(api)).toEqual(LAUNCHER_RESULTS);
		expect(await api.launcher.session.vault.extra.hello()).toBe("third-hello");
		// launcher's key first, as before the overwrite, then the key the third module merged in.
		expect(Object.keys(api.launcher.session.vault)).toEqual(["lock", "extra"]);
		expect(Object.keys(api.launcher.session)).toEqual(["store", "vault"]);
	});

	it.each([
		["the original leaves were never called", false],
		["the original leaves were called before the overwrite", true]
	])("keeps references taken while the overwriting module was live working when %s", async (_label, touchFirst) => {
		api = await slothlet({ ...config, base: BASE, silent: true });
		await api.slothlet.api.add("launcher", EXT, { moduleID: "launcher" });
		if (touchFirst) expect(await callLauncherLeaves(api)).toEqual(LAUNCHER_RESULTS);
		await api.slothlet.api.add("launcher.session", SHADOW, { moduleID: "shadow", forceOverwrite: true });

		// Held while shadow is live: a namespace, a nested namespace, and a leaf.
		const vault = api.launcher.session.vault;
		const lock = vault.lock;
		const open = lock.open;
		const store = api.launcher.session.store;
		const create = store.create;
		expect([await open(), await create()]).toEqual(["shadow-open", "shadow-create"]);

		expect(await api.slothlet.api.remove("shadow")).toBe(true);

		// The held namespace is still the live node at its path. (Under lazy, the deeper references were taken
		// through a not-yet-materialized parent and are waiting proxies, so only their behavior is comparable.)
		// Every held reference now runs launcher's code.
		expect(api.launcher.session.vault).toBe(vault);
		if (config.mode === "eager") {
			expect(api.launcher.session.vault.lock).toBe(lock);
			expect(api.launcher.session.vault.lock.open).toBe(open);
			expect(api.launcher.session.store.create).toBe(create);
		}
		expect([await open(), await lock.open(), await vault.lock.open()]).toEqual(["ext-open", "ext-open", "ext-open"]);
		expect([await create(), await store.destroy()]).toEqual(["ext-create", "ext-destroy"]);
		expect(Object.keys(vault)).toEqual(["lock"]);
	});

	it("keeps values set by hand on the overwritten namespace, after the restored keys", async () => {
		api = await slothlet({ ...config, base: BASE, silent: true });
		await api.slothlet.api.add("launcher", EXT, { moduleID: "launcher" });
		await api.slothlet.api.add("launcher.session", SHADOW, { moduleID: "shadow", forceOverwrite: true });
		const vault = api.launcher.session.vault;
		// Reached first so a lazy namespace has materialized before the hand-set values land on it.
		expect(await vault.lock.open()).toBe("shadow-open");
		vault.note = "x";
		vault.settings = { retries: 3 };

		expect(await api.slothlet.api.remove("shadow")).toBe(true);

		expect(api.launcher.session.vault.note).toBe("x");
		expect(api.launcher.session.vault.settings.retries).toBe(3);
		expect(Object.keys(api.launcher.session.vault)).toEqual(["lock", "note", "settings"]);
		expect(await callLauncherLeaves(api)).toEqual(LAUNCHER_RESULTS);
	});
});
