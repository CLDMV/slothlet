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

	it("prefix-removes a whole subtree by container path without orphaning descendants", async () => {
		api = await slothlet({ ...config, base: TEST_DIRS.API_TEST });
		await api.slothlet.api.add("svc", TEST_DIRS.API_TEST_MIXED, { moduleID: "modA" }); // container + children
		await api.slothlet.api.add("keep", () => "K", { moduleID: "modB" });
		// Settle the subtree so every descendant ownership record exists (esp. under lazy).
		const owned = await api.slothlet.api.leaves("modA", { includePrivate: true });
		expect(owned.length).toBeGreaterThan(0);
		const ownership = resolveWrapper(api.keep).slothlet.handlers.ownership;
		expect(ownership.moduleToPath.get("modA")).toBeDefined();

		// Scope to the CONTAINER: modA's whole subtree goes, the sibling module survives, and no
		// descendant ownership record is left orphaned in the registry.
		expect(await api.slothlet.api.remove("modA", "svc")).toBe(true);
		expect(api.svc).toBeUndefined();
		expect(ownership.moduleToPath.get("modA")).toBeUndefined();
		expect(api.keep()).toBe("K");
	});
});
