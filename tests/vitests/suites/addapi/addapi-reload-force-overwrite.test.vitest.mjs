/**
 *
 *	@Project: @cldmv/slothlet
 *	@Filename: /tests/vitests/suites/addapi/addapi-reload-force-overwrite.test.vitest.mjs
 *	@Date: 2026-09-29 02:02:27 -07:00 (1790672547)
 *	@Author: Shinrai <CLDMV>
 *	@Email: <Shinrai@users.noreply.github.com>
 *	-----
 *	@Last modified by: Shinrai <CLDMV> (Shinrai@users.noreply.github.com)
 *	@Last modified time: 2026-10-03 20:03:43 -07:00 (1791083023)
 *	-----
 *	@Copyright: Copyright (c) 2013-2026 Catalyzed Motivation Inc. All rights reserved.
 *
 */

/**
 * @fileoverview Scoped reload respects a forceOverwrite add's collision outcome (#530).
 *
 * @description
 * `launcher` is added at `launcher`; `shadow` is then added at `launcher.session` with
 * `forceOverwrite: true`, replacing that subtree: `shadow`'s `create` and `peek` are live there and
 * `launcher`'s own `session.close` is shadowed off the surface. `api.slothlet.api.reload("launcher")`
 * must rebuild only `launcher`'s own contribution: `launcher.session` keeps `shadow`'s code and
 * ownership and `launcher.session.close` stays shadowed, while `launcher`'s leaves outside the
 * overwritten subtree pick up their new code. Removing `shadow` afterwards reverts
 * `launcher.session` to `launcher`'s current code. The same holds when the overwrite covers the
 * reloaded module's whole mount. A module mounted (without an overwrite) inside one of the reloaded
 * module's own subfolders keeps its leaves too.
 *
 * Runs across the full matrix (eager/lazy × async/live × hooks on/off).
 *
 * @module tests/vitests/suites/addapi/addapi-reload-force-overwrite
 */

process.env.SLOTHLET_INTERNAL_TEST_MODE = "true";

import { describe, it, expect, afterEach, vi } from "vitest";
import { cpSync, rmSync, writeFileSync } from "node:fs";
import path from "node:path";
import slothlet from "@cldmv/slothlet";
import { resolveWrapper } from "#handlers/unified-wrapper";
import { getMatrixConfigs, TEST_DIRS } from "../../setup/vitest-helper.mjs";

// Instance creation plus two adds can exceed the default hook/test timeout on a loaded machine.
vi.setConfig({ hookTimeout: 60000, testTimeout: 60000 });

const API_TESTS_ROOT = path.dirname(TEST_DIRS.API_TEST);
const LAUNCHER_DIR = path.join(API_TESTS_ROOT, "api_test_reload_force_launcher");
const SHADOW_DIR = path.join(API_TESTS_ROOT, "api_test_reload_force_shadow");
const REVERT_A_DIR = path.join(API_TESTS_ROOT, "api_test_reload_revert_a");
const REVERT_B_DIR = path.join(API_TESTS_ROOT, "api_test_reload_revert_b");

/**
 * Write a single-function leaf module.
 * @param {string} file - File to write.
 * @param {string} name - Exported function name.
 * @param {string} value - Value the function returns.
 * @returns {void}
 */
function writeLeaf(file, name, value) {
	writeFileSync(file, `export function ${name}() {\n\treturn "${value}";\n}\n`);
}

/**
 * Create an instance with every mutation enabled.
 * @param {object} config - Matrix config.
 * @returns {Promise<object>} Slothlet API proxy.
 */
function createInstance(config) {
	return slothlet({ ...config, base: TEST_DIRS.API_TEST, api: { ...config.api, mutations: { add: true, remove: true, reload: true } } });
}

/**
 * Ownership of every `launcher.session` path: each path's stack (moduleIDs, in order) and owner.
 * @param {object} api - Slothlet API proxy.
 * @returns {Record<string, {stack: string[], owner: (string|undefined)}>} Ownership by path.
 */
function sessionOwnership(api) {
	const ownership = resolveWrapper(api.launcher).slothlet.handlers.ownership;
	const result = {};
	for (const apiPath of ["launcher.session", "launcher.session.create", "launcher.session.peek", "launcher.session.close"]) {
		result[apiPath] = {
			stack: ownership.getPathHistory(apiPath).map((entry) => entry.moduleID),
			owner: ownership.getCurrentOwner(apiPath)?.moduleID
		};
	}
	return result;
}

for (const { config, name } of getMatrixConfigs()) {
	describe(`scoped reload respects a forceOverwrite add (#530) - ${name}`, () => {
		let api;
		let scratchDir = null;

		afterEach(async () => {
			if (api) await api.shutdown();
			api = null;
			if (scratchDir) rmSync(scratchDir, { recursive: true, force: true });
			scratchDir = null;
		});

		/**
		 * Mount `launcher`, then force-overwrite `launcher.session` with `shadow`.
		 * @param {string} [launcherDir] - Folder to mount as `launcher`.
		 * @returns {Promise<void>}
		 */
		async function mount(launcherDir = LAUNCHER_DIR) {
			api = await createInstance(config);
			await api.slothlet.api.add("launcher", launcherDir, { moduleID: "launcher" });
			await api.slothlet.api.add("launcher.session", SHADOW_DIR, { moduleID: "shadow", forceOverwrite: true });
			expect(await api.launcher.session.create()).toBe("shadow:create");
			expect(await api.launcher.session.peek()).toBe("shadow:peek");
			expect(api.launcher.session.close).toBeUndefined();
		}

		/**
		 * Copy the `launcher` fixture into a scratch folder so a test can change it on disk.
		 * @returns {string} The copy.
		 */
		function copyLauncher() {
			scratchDir = path.join(process.cwd(), "tmp", `reload-force-530-${name.replace(/[^a-z0-9]+/gi, "-")}`);
			rmSync(scratchDir, { recursive: true, force: true });
			cpSync(LAUNCHER_DIR, scratchDir, { recursive: true });
			return scratchDir;
		}

		it("reload('launcher') keeps shadow's code, shadowed members and ownership under launcher.session", async () => {
			await mount();
			const keysBefore = Object.keys(api.launcher.session);
			const ownershipBefore = sessionOwnership(api);

			await api.slothlet.api.reload("launcher");

			expect(await api.launcher.session.create()).toBe("shadow:create");
			expect(await api.launcher.session.peek()).toBe("shadow:peek");
			expect(api.launcher.session.close).toBeUndefined();
			expect(Object.keys(api.launcher.session)).toEqual(keysBefore);
			expect(await api.launcher.status()).toBe("launcher:status");
			expect(sessionOwnership(api)).toEqual(ownershipBefore);
			expect(sessionOwnership(api)["launcher.session.create"].owner).toBe("shadow");
		});

		it("reload('launcher') picks up launcher's changes outside the overwritten subtree", async () => {
			const launcherDir = copyLauncher();
			await mount(launcherDir);

			writeLeaf(path.join(launcherDir, "status.mjs"), "status", "launcher:status:v2");
			writeLeaf(path.join(launcherDir, "session", "create.mjs"), "create", "launcher:create:v2");
			await api.slothlet.api.reload("launcher");

			expect(await api.launcher.status()).toBe("launcher:status:v2");
			expect(await api.launcher.boot()).toBe("launcher:boot");
			expect(await api.launcher.session.create()).toBe("shadow:create");
		});

		it("removing shadow after reload('launcher') reverts launcher.session to launcher's current code", async () => {
			const launcherDir = copyLauncher();
			await mount(launcherDir);

			writeLeaf(path.join(launcherDir, "session", "create.mjs"), "create", "launcher:create:v2");
			writeLeaf(path.join(launcherDir, "session", "close.mjs"), "close", "launcher:close:v2");
			await api.slothlet.api.reload("launcher");
			await api.slothlet.api.remove("shadow");

			expect(await api.launcher.session.create()).toBe("launcher:create:v2");
			expect(await api.launcher.session.close()).toBe("launcher:close:v2");
			expect(api.launcher.session.peek).toBeUndefined();
			expect(await api.launcher.status()).toBe("launcher:status");
		});

		it("reload('shadow') still rebuilds shadow and leaves launcher's own leaves alone", async () => {
			await mount();
			const statusBefore = api.launcher.status;

			await api.slothlet.api.reload("shadow");

			expect(await api.launcher.session.create()).toBe("shadow:create");
			expect(await api.launcher.session.peek()).toBe("shadow:peek");
			expect(api.launcher.session.close).toBeUndefined();
			expect(api.launcher.status).toBe(statusBefore);
		});

		it("an overwrite of the reloaded module's whole mount keeps its outcome across the reload", async () => {
			api = await createInstance(config);
			await api.slothlet.api.add("leaf", REVERT_A_DIR, { moduleID: "A" });
			await api.slothlet.api.add("leaf", REVERT_B_DIR, { moduleID: "B", forceOverwrite: true });
			expect(api.leaf.am).toBeUndefined();

			await api.slothlet.api.reload("A");

			expect(await api.leaf.an()).toBe("B:an");
			expect(await api.leaf.bx()).toBe("B:bx");
			expect(api.leaf.am).toBeUndefined();

			await api.slothlet.api.remove("B");

			expect(await api.leaf.an()).toBe("A:an");
			expect(await api.leaf.am()).toBe("A:am");
			expect(api.leaf.bx).toBeUndefined();
		});

		it("a module mounted inside the reloaded module's own subfolder keeps its leaves", async () => {
			api = await createInstance(config);
			await api.slothlet.api.add("launcher", LAUNCHER_DIR, { moduleID: "launcher" });
			await api.slothlet.api.add("launcher.session.extra", SHADOW_DIR, { moduleID: "shadow" });
			const extraBefore = api.launcher.session.extra;

			await api.slothlet.api.reload("launcher");

			expect(api.launcher.session.extra).toBe(extraBefore);
			expect(await api.launcher.session.extra.create()).toBe("shadow:create");
			expect(await api.launcher.session.extra.peek()).toBe("shadow:peek");
			expect(await api.launcher.session.create()).toBe("launcher:create");
			expect(await api.launcher.session.close()).toBe("launcher:close");
		});

		it("keeps shadow's overwrite when ownership tracking is unavailable", async () => {
			await mount();
			const sl = resolveWrapper(api.launcher).slothlet;
			const ownership = sl.handlers.ownership;
			sl.handlers.ownership = null;
			try {
				await api.slothlet.api.reload("launcher");
			} finally {
				sl.handlers.ownership = ownership;
			}

			expect(await api.launcher.session.create()).toBe("shadow:create");
			expect(await api.launcher.session.peek()).toBe("shadow:peek");
			expect(api.launcher.session.close).toBeUndefined();
			expect(await api.launcher.status()).toBe("launcher:status");
		});
	});
}
