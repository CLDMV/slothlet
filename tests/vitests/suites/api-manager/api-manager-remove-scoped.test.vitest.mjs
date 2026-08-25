/**
 *	@Project: @cldmv/slothlet
 *	@Filename: /tests/vitests/suites/api-manager/api-manager-remove-scoped.test.vitest.mjs
 *	@Date: 2026-08-24T00:00:00-08:00 (1756022400)
 *	@Author: Nate Corcoran <CLDMV>
 *	@Email: <Shinrai@users.noreply.github.com>
 *	-----
 *	@Last modified by: Nate Corcoran <CLDMV> (Shinrai@users.noreply.github.com)
 *	@Last modified time: 2026-08-24T00:00:00-08:00 (1756022400)
 *	-----
 *	@Copyright: Copyright (c) 2013-2026 Catalyzed Motivation Inc. All rights reserved.
 */

/**
 * @fileoverview api.remove() accepts an optional second apiPath to scope removal to one module's node.
 *
 * @description
 * `remove(id)` removes every path a moduleID owns; `remove(apiPath)` removes that path's whole subtree
 * regardless of which module owns each node. Neither can surgically remove a single module's node at a
 * shared path. The optional second argument closes that gap: `remove(moduleID, apiPath)` removes ONLY the
 * node at `apiPath` owned by `moduleID`, leaving other modules — and that same module's other mounts —
 * untouched. Verified in eager and lazy modes.
 * @module tests/vitests/suites/api-manager/api-manager-remove-scoped
 */

process.env.SLOTHLET_INTERNAL_TEST_MODE = "true";

import { describe, it, expect, afterEach } from "vitest";
import slothlet from "@cldmv/slothlet";
import { resolveWrapper } from "#handlers/unified-wrapper";
import { TEST_DIRS } from "../../setup/vitest-helper.mjs";

const CONFIGS = [
	{ name: "eager", config: { mode: "eager", runtime: "async", hook: { enabled: true } } },
	{ name: "lazy", config: { mode: "lazy", runtime: "async", hook: { enabled: true } } }
];

describe.each(CONFIGS)("remove(moduleID, apiPath) scoped removal — $name", ({ config }) => {
	let api;

	afterEach(async () => {
		if (api?.shutdown) await api.shutdown();
		api = null;
	});

	it("removes only the named module's node at a shared parent path", async () => {
		api = await slothlet({ ...config, base: TEST_DIRS.API_TEST });
		await api.slothlet.api.add("svc.a", () => "A", { moduleID: "modA" });
		await api.slothlet.api.add("svc.b", () => "B", { moduleID: "modB" });
		expect(api.svc.a()).toBe("A");
		expect(api.svc.b()).toBe("B");

		// Scoped to modA at svc.a — modB's svc.b must survive.
		expect(await api.slothlet.api.remove("modA", "svc.a")).toBe(true);
		expect(api.svc?.a).toBeUndefined();
		expect(api.svc.b()).toBe("B");
	});

	it("removes only one of a moduleID's several mounts", async () => {
		api = await slothlet({ ...config, base: TEST_DIRS.API_TEST });
		await api.slothlet.api.add("alpha", () => "A", { moduleID: "dup" });
		await api.slothlet.api.add("beta", () => "B", { moduleID: "dup" });

		expect(await api.slothlet.api.remove("dup", "alpha")).toBe(true);
		expect(api.alpha).toBeUndefined();
		expect(api.beta()).toBe("B"); // dup's other mount survives
	});

	it("returns false when the module does not own that path", async () => {
		api = await slothlet({ ...config, base: TEST_DIRS.API_TEST });
		await api.slothlet.api.add("alpha", () => "A", { moduleID: "dup" });

		expect(await api.slothlet.api.remove("dup", "not.there")).toBe(false);
		expect(api.alpha()).toBe("A"); // untouched
	});

	it("returns false when the moduleID is unknown", async () => {
		api = await slothlet({ ...config, base: TEST_DIRS.API_TEST });
		await api.slothlet.api.add("svc.b", () => "B", { moduleID: "modB" });

		expect(await api.slothlet.api.remove("noSuchModule", "svc.b")).toBe(false);
		expect(api.svc.b()).toBe("B"); // modB's node is not removed by another module's scoped call
	});

	it("single-arg remove(moduleID) still removes every path the module owns", async () => {
		api = await slothlet({ ...config, base: TEST_DIRS.API_TEST });
		await api.slothlet.api.add("alpha", () => "A", { moduleID: "dup" });
		await api.slothlet.api.add("beta", () => "B", { moduleID: "dup" });

		expect(await api.slothlet.api.remove("dup")).toBe(true);
		expect(api.alpha).toBeUndefined();
		expect(api.beta).toBeUndefined();
	});

	it("rejects a non-string apiPath argument", async () => {
		api = await slothlet({ ...config, base: TEST_DIRS.API_TEST });
		await expect(api.slothlet.api.remove("dup", 123)).rejects.toMatchObject({ code: "INVALID_ARGUMENT" });
	});

	it("recursively removes the module's own subtree under the scoped container, no orphans", async () => {
		// The module solely owns the whole subtree at "svc": every one of its nodes is removed, the now
		// childless+unowned container goes too, and nothing is left orphaned in the ownership registry.
		api = await slothlet({ ...config, base: TEST_DIRS.API_TEST });
		await api.slothlet.api.add("svc", TEST_DIRS.API_TEST_MIXED, { moduleID: "modA" }); // container + children
		await api.slothlet.api.add("keep", () => "K", { moduleID: "modB" });
		// Settle the subtree so every descendant ownership record exists (esp. under lazy).
		const owned = await api.slothlet.api.leaves("modA", { includePrivate: true });
		expect(owned.length).toBeGreaterThan(0);
		const ownership = resolveWrapper(api.keep).slothlet.handlers.ownership;
		expect(ownership.moduleToPath.get("modA")).toBeDefined();

		expect(await api.slothlet.api.remove("modA", "svc")).toBe(true);
		expect(api.svc).toBeUndefined();
		expect(ownership.moduleToPath.get("modA")).toBeUndefined(); // no orphaned ownership
		expect(api.keep()).toBe("K"); // unrelated module untouched
	});

	it("under a shared container, removes only this module's nodes and keeps the container for the others", async () => {
		// modA and modB both live under "shop": remove(modA, "shop") deletes modA's leaf, reverts the
		// shared "shop" container to modB, and leaves modB's leaf and the container standing. It must NOT
		// delete the whole "shop" path — that is what remove("shop") (path as the first arg) is for.
		api = await slothlet({ ...config, base: TEST_DIRS.API_TEST });
		await api.slothlet.api.add("shop.a", () => "A", { moduleID: "modA" });
		await api.slothlet.api.add("shop.b", () => "B", { moduleID: "modB" });
		expect(api.shop.a()).toBe("A");
		expect(api.shop.b()).toBe("B");

		expect(await api.slothlet.api.remove("modA", "shop")).toBe(true);
		expect(api.shop).toBeDefined(); // container survives for modB
		expect(api.shop?.a).toBeUndefined(); // modA's node gone
		expect(api.shop.b()).toBe("B"); // modB's node untouched
	});

	it("a scoped removal survives a reload (replayed as scoped, not a whole-path removal)", async () => {
		// Directory mounts (synthetic adds don't replay), each a whole module under a shared "shop"
		// container. reload() replays the two adds then the scoped remove; the modules keep their ids
		// across the reload, so the scoped remove resolves and only modA's subtree stays gone — modB's
		// must NOT be over-deleted.
		api = await slothlet({ ...config, base: TEST_DIRS.API_TEST, api: { mutations: { add: true, remove: true, reload: true } } });
		await api.slothlet.api.add("shop.a", TEST_DIRS.API_TEST_MIXED, { moduleID: "modA" });
		await api.slothlet.api.add("shop.b", TEST_DIRS.API_TEST_MIXED, { moduleID: "modB" });
		expect(await api.slothlet.api.remove("modA", "shop")).toBe(true);
		expect(api.shop?.a).toBeUndefined();
		expect(api.shop?.b).toBeDefined();

		await api.slothlet.reload();
		expect(api.shop?.a).toBeUndefined(); // scoped removal persisted
		expect(api.shop?.b).toBeDefined(); // modB survived the reload, not over-deleted
	});
});
