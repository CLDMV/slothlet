/**
 *
 *	@Project: @cldmv/slothlet
 *	@Filename: /tests/vitests/suites/ownership/ownership-force-overwrite.test.vitest.mjs
 *	@Date: 2026-09-28 21:59:12 -07:00 (1790657952)
 *	@Author: Shinrai <CLDMV>
 *	@Email: <Shinrai@users.noreply.github.com>
 *	-----
 *	@Last modified by: Shinrai <CLDMV> (Shinrai@users.noreply.github.com)
 *	@Last modified time: 2026-10-03 20:04:26 -07:00 (1791083066)
 *	-----
 *	@Copyright: Copyright (c) 2013-2026 Catalyzed Motivation Inc. All rights reserved.
 *
 */

/**
 * @fileoverview Regression coverage (#524): after `api.slothlet.api.add(path, dir, { moduleID, forceOverwrite: true })`
 * the overwriting module's implementation is the live one at every path it overwrote, so the ownership registry
 * must record that module as the current owner of each of those paths, identically in eager and lazy mode.
 *
 * Before the fix, the registry kept the overwritten module as current owner of the overwritten leaves (eager) or
 * of the mount path and some of its namespaces (lazy): every construction-time registration used the instance's
 * default collision mode, so the overwriting module's leaves were recorded as merge losers, and in lazy mode the
 * overwritten module's forced materialization registered after the overwriting module and took the path back.
 * Anything reading the current owner (e.g. `permissions.owner`, #509) then attributed the overwriting module's
 * live code to the module it replaced.
 * @module tests/vitests/suites/ownership/ownership-force-overwrite
 */

process.env.SLOTHLET_INTERNAL_TEST_MODE = "true";

import path from "node:path";
import { describe, it, expect, afterEach } from "vitest";
import slothlet from "@cldmv/slothlet";
import { resolveWrapper } from "#handlers/unified-wrapper";
import { OwnershipManager } from "#handlers/ownership";
import { SlothletError, SlothletWarning } from "@cldmv/slothlet/errors";
import { getMatrixConfigs, TEST_DIRS } from "../../setup/vitest-helper.mjs";

const FIXTURES = path.join(path.dirname(TEST_DIRS.API_TEST), "api_test_force_overwrite_ownership");
const BASE = path.join(FIXTURES, "base"); // core/alpha.mjs: ping()
const EXT = path.join(FIXTURES, "ext"); // main.mjs: activate(); session/store.mjs: create(), destroy(); session/vault/lock.mjs: open()
const SHADOW = path.join(FIXTURES, "shadow"); // store.mjs: create(), destroy(); vault/lock.mjs: open()

/**
 * The paths the shadow module's content occupies below its mount point.
 * @type {string[]}
 */
const SHADOW_SUBPATHS = ["store", "store.create", "store.destroy", "vault", "vault.lock", "vault.lock.open"];

/**
 * Read the ownership handler behind a composed api.
 * @param {object} api - Composed api.
 * @returns {object} The instance's OwnershipManager.
 */
function ownershipOf(api) {
	return resolveWrapper(api.core).slothlet.handlers.ownership;
}

/**
 * Map each path to its current owner's moduleID.
 * @param {object} ownership - OwnershipManager.
 * @param {string[]} paths - API paths.
 * @returns {Object<string, (string|null)>} Path → current owner moduleID.
 */
function currentOwners(ownership, paths) {
	return Object.fromEntries(paths.map((apiPath) => [apiPath, ownership.getCurrentOwner(apiPath)?.moduleID ?? null]));
}

/**
 * Call every shadow leaf under `node`, materializing it in lazy mode.
 * @param {object} node - The api node the shadow module is mounted at.
 * @returns {Promise<string[]>} The leaves' return values.
 */
async function callShadowLeaves(node) {
	return [await node.store.create(), await node.store.destroy(), await node.vault.lock.open()];
}

describe.each(getMatrixConfigs())("ownership after a forceOverwrite add (#524) > $name", ({ config }) => {
	let api;

	afterEach(async () => {
		if (api?.shutdown) await api.shutdown();
		api = null;
	});

	it("records the overwriting module as current owner of every overwritten path of another added module", async () => {
		api = await slothlet({ ...config, base: BASE, silent: true });
		await api.slothlet.api.add("launcher", EXT, { moduleID: "launcher" });
		await api.slothlet.api.add("launcher.session", SHADOW, { moduleID: "shadow", forceOverwrite: true });

		expect(await callShadowLeaves(api.launcher.session)).toEqual(["shadow-create", "shadow-destroy", "shadow-open"]);

		const paths = ["launcher.session", ...SHADOW_SUBPATHS.map((p) => `launcher.session.${p}`)];
		expect(currentOwners(ownershipOf(api), paths)).toEqual(Object.fromEntries(paths.map((p) => [p, "shadow"])));
		// A path the overwrite did not touch keeps its own owner.
		expect(await api.launcher.main.activate()).toBe("ext-activate");
		expect(ownershipOf(api).getCurrentOwner("launcher.main.activate")?.moduleID).toBe("launcher");
	});

	it("records the overwriting module as current owner when the overwritten leaves were already called", async () => {
		api = await slothlet({ ...config, base: BASE, silent: true });
		await api.slothlet.api.add("launcher", EXT, { moduleID: "launcher" });
		expect([await api.launcher.session.store.create(), await api.launcher.session.vault.lock.open()]).toEqual(["ext-create", "ext-open"]);

		await api.slothlet.api.add("launcher.session", SHADOW, { moduleID: "shadow", forceOverwrite: true });

		expect(await callShadowLeaves(api.launcher.session)).toEqual(["shadow-create", "shadow-destroy", "shadow-open"]);

		const paths = ["launcher.session", ...SHADOW_SUBPATHS.map((p) => `launcher.session.${p}`)];
		expect(currentOwners(ownershipOf(api), paths)).toEqual(Object.fromEntries(paths.map((p) => [p, "shadow"])));
	});

	it("records the overwriting module as current owner of an overwritten base-module path", async () => {
		api = await slothlet({ ...config, base: BASE, silent: true });
		await api.slothlet.api.add("core", SHADOW, { moduleID: "shadow", forceOverwrite: true });

		expect(await callShadowLeaves(api.core)).toEqual(["shadow-create", "shadow-destroy", "shadow-open"]);

		const paths = ["core", ...SHADOW_SUBPATHS.map((p) => `core.${p}`)];
		expect(currentOwners(ownershipOf(api), paths)).toEqual(Object.fromEntries(paths.map((p) => [p, "shadow"])));
	});

	it("keeps the overwriting module as current owner across a full reload", async () => {
		api = await slothlet({ ...config, base: BASE, silent: true });
		await api.slothlet.api.add("launcher", EXT, { moduleID: "launcher" });
		await api.slothlet.api.add("launcher.session", SHADOW, { moduleID: "shadow", forceOverwrite: true });
		await api.slothlet.reload();

		expect(await callShadowLeaves(api.launcher.session)).toEqual(["shadow-create", "shadow-destroy", "shadow-open"]);

		const paths = ["launcher.session", ...SHADOW_SUBPATHS.map((p) => `launcher.session.${p}`)];
		expect(currentOwners(ownershipOf(api), paths)).toEqual(Object.fromEntries(paths.map((p) => [p, "shadow"])));
	});
});

describe.each(getMatrixConfigs().filter(({ name }) => name === "EAGER" || name === "LAZY"))(
	"placement mode bookkeeping of a rejected add (#524) > $name",
	({ config }) => {
		let api;

		afterEach(async () => {
			if (api?.shutdown) await api.shutdown();
			api = null;
		});

		it.each(["skip", "warn"])("a %s-rejected re-add keeps the placement the live content was added under", async (collisionMode) => {
			api = await slothlet({ ...config, base: BASE, silent: true, api: { mutations: { allowCollisionOverride: true } } });
			await api.slothlet.api.add("launcher", EXT, { moduleID: "launcher" });
			await api.slothlet.api.add("launcher.session", SHADOW, { moduleID: "shadow", forceOverwrite: true });
			await api.slothlet.api.add("launcher.session", SHADOW, { moduleID: "shadow", collisionMode });

			const ownership = ownershipOf(api);
			expect(ownership.getPlacementMode("shadow", "launcher.session.store.create")).toBe("replace");
			expect(await callShadowLeaves(api.launcher.session)).toEqual(["shadow-create", "shadow-destroy", "shadow-open"]);
			expect(ownership.getCurrentOwner("launcher.session.vault.lock.open")?.moduleID).toBe("shadow");
		});

		it("a merge re-add of the same module at the same endpoint replaces the recorded placement", async () => {
			api = await slothlet({ ...config, base: BASE, silent: true, api: { mutations: { allowCollisionOverride: true } } });
			await api.slothlet.api.add("launcher.session", SHADOW, { moduleID: "shadow", forceOverwrite: true });
			await api.slothlet.api.add("launcher.session", SHADOW, { moduleID: "shadow", collisionMode: "merge" });

			expect(ownershipOf(api).getPlacementMode("shadow", "launcher.session.store")).toBeNull();
		});
	}
);

/**
 * Minimal mock slothlet sufficient for OwnershipManager.
 * @returns {object} Mock slothlet object.
 */
function makeMock() {
	return { config: {}, debug: () => {}, SlothletError, SlothletWarning };
}

describe("OwnershipManager placement modes (#524)", () => {
	it("records only replace/merge-replace and resolves the deepest covering endpoint", () => {
		const ownership = new OwnershipManager(makeMock());

		expect(ownership.setPlacementMode("mod", "a", "merge")).toBeNull();
		expect(ownership.getPlacementMode("mod", "a.b")).toBeNull();

		expect(ownership.setPlacementMode("mod", "a", "replace")).toBeNull();
		expect(ownership.setPlacementMode("mod", "a.b", "merge-replace")).toBeNull();
		expect(ownership.getPlacementMode("mod", "a")).toBe("replace");
		expect(ownership.getPlacementMode("mod", "a.x")).toBe("replace");
		expect(ownership.getPlacementMode("mod", "a.b.c")).toBe("merge-replace");
		// A sibling that merely shares a prefix is not under the endpoint.
		expect(ownership.getPlacementMode("mod", "ab")).toBeNull();
		expect(ownership.getPlacementMode("other", "a.b")).toBeNull();
		expect(ownership.getPlacementMode("mod", undefined)).toBeNull();

		// Re-recording returns the previous mode; a non-winning mode clears the endpoint.
		expect(ownership.setPlacementMode("mod", "a.b", "error")).toBe("merge-replace");
		expect(ownership.getPlacementMode("mod", "a.b.c")).toBe("replace");
		expect(ownership.setPlacementMode("mod", "a", null)).toBe("replace");
		expect(ownership.placementModes.has("mod")).toBe(false);
	});

	it("a root-level endpoint covers every path", () => {
		const ownership = new OwnershipManager(makeMock());
		ownership.setPlacementMode("mod", "", "replace");
		expect(ownership.getPlacementMode("mod", "anything.at.all")).toBe("replace");
	});

	it("unregister, markUnregistered and clear drop a module's placement modes", () => {
		const ownership = new OwnershipManager(makeMock());
		ownership.register({ moduleID: "a", apiPath: "x", value: function () {}, collisionMode: "replace" });
		ownership.setPlacementMode("a", "x", "replace");
		ownership.setPlacementMode("b", "y", "replace");
		ownership.setPlacementMode("c", "z", "replace");

		ownership.unregister("a");
		expect(ownership.getPlacementMode("a", "x")).toBeNull();
		ownership.markUnregistered("b");
		expect(ownership.getPlacementMode("b", "y")).toBeNull();
		ownership.clear();
		expect(ownership.getPlacementMode("c", "z")).toBeNull();
	});

	it.each(["replace", "merge-replace"])("registerSubtree under %s claims every path it walks", (collisionMode) => {
		const ownership = new OwnershipManager(makeMock());
		const incomingLeaf = function () {};
		// The incoming module's leaf was recorded as a merge loser against the original's, and the original
		// module's container registered after the incoming one (a lazy wrapper materialized mid-collision).
		ownership.register({ moduleID: "original", apiPath: "ns.leaf", value: function () {}, collisionMode: "merge" });
		ownership.register({ moduleID: "incoming", apiPath: "ns.leaf", value: incomingLeaf, collisionMode: "merge" });
		ownership.register({ moduleID: "incoming", apiPath: "ns", value: {}, collisionMode: "merge" });
		ownership.register({ moduleID: "original", apiPath: "ns", value: {}, collisionMode: "merge" });
		expect(ownership.getCurrentOwner("ns").moduleID).toBe("original");
		expect(ownership.getCurrentOwner("ns.leaf").moduleID).toBe("original");

		ownership.registerSubtree({ leaf: incomingLeaf }, "incoming", "ns", { collisionMode });

		expect(ownership.getCurrentOwner("ns").moduleID).toBe("incoming");
		expect(ownership.getCurrentOwner("ns.leaf").moduleID).toBe("incoming");
		expect(ownership.getCurrentValue("ns.leaf")).toBe(incomingLeaf);
	});

	it("registerSubtree without a winning mode only confirms, leaving the current owner alone", () => {
		const ownership = new OwnershipManager(makeMock());
		ownership.register({ moduleID: "original", apiPath: "ns.leaf", value: function () {}, collisionMode: "merge" });
		ownership.register({ moduleID: "incoming", apiPath: "ns.leaf", value: function () {}, collisionMode: "merge" });

		ownership.registerSubtree({ leaf: function () {} }, "incoming", "ns");

		expect(ownership.getCurrentOwner("ns.leaf").moduleID).toBe("original");
	});

	it("registerSubtree under replace claims nothing for a module whose registrations are rejected", () => {
		const ownership = new OwnershipManager(makeMock());
		ownership.register({ moduleID: "original", apiPath: "ns.leaf", value: function () {}, collisionMode: "merge" });
		ownership.markUnregistered("gone");

		ownership.registerSubtree({ leaf: function () {} }, "gone", "ns", { collisionMode: "replace" });

		expect(ownership.getPathOwnership("ns.leaf")).toEqual(new Set(["original"]));
		expect(ownership.getPathOwnership("ns")).toBeNull();
	});
});
