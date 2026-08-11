/**
 *	@Project: @cldmv/slothlet
 *	@Filename: /tests/vitests/suites/ownership/module-ownership-removal.test.vitest.mjs
 *	@Date: 2026-01-12T23:44:38-08:00 (1768290278)
 *	@Author: Nate Corcoran <CLDMV>
 *	@Email: <Shinrai@users.noreply.github.com>
 *	-----
 *	@Last modified by: Nate Corcoran <CLDMV> (Shinrai@users.noreply.github.com)
 *	@Last modified time: 2026-08-09 15:43:26 -07:00 (1786315406)
 *	-----
 *	@Copyright: Copyright (c) 2013-2026 Catalyzed Motivation Inc. All rights reserved.
 */

/**
 * @fileoverview Comprehensive tests for module ownership tracking and API removal
 * Tests Rule 13: Auto-cleanup before reload to prevent orphan functions
 * @module tests/vitests/processed/ownership/module-ownership-removal.test.vitest
 * @memberof tests.vitests
 */

import { describe, it, expect, beforeAll, afterAll, beforeEach, afterEach } from "vitest";
import { getMatrixConfigs, TEST_DIRS, withSuppressedSlothletErrorOutput } from "../../setup/vitest-helper.mjs";
import path from "node:path";
import fs from "node:fs/promises";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Test modules directory - temporary folder next to this test file
const testDir = path.join(__dirname, "temp-ownership-modules");

/**
 * Setup test module directories with different function sets
 */
async function setupTestModules() {
	// Clean up if exists
	try {
		await fs.rm(testDir, { recursive: true, force: true });
	} catch (_) {
		// Ignore if doesn't exist
	}

	// Create test module directories
	await fs.mkdir(testDir, { recursive: true });

	// Module A - Version 1 (has function1 and function2)
	const moduleAv1Dir = path.join(testDir, "moduleA_v1");
	await fs.mkdir(moduleAv1Dir, { recursive: true });
	await fs.writeFile(
		path.join(moduleAv1Dir, "functions.mjs"),
		`
export function function1() {
	return "moduleA_v1_function1";
}

export function function2() {
	return "moduleA_v1_function2";
}
`.trim()
	);

	// Module A - Version 2 (has function2 and function3, no function1)
	const moduleAv2Dir = path.join(testDir, "moduleA_v2");
	await fs.mkdir(moduleAv2Dir, { recursive: true });
	await fs.writeFile(
		path.join(moduleAv2Dir, "functions.mjs"),
		`
export function function2() {
	return "moduleA_v2_function2";
}

export function function3() {
	return "moduleA_v2_function3";
}
`.trim()
	);

	// Module B - Has different functions
	const moduleBDir = path.join(testDir, "moduleB");
	await fs.mkdir(moduleBDir, { recursive: true });
	await fs.writeFile(
		path.join(moduleBDir, "helpers.mjs"),
		`
export function helperA() {
	return "moduleB_helperA";
}

export function helperB() {
	return "moduleB_helperB";
}
`.trim()
	);
}

/**
 * Cleanup test modules
 */
async function cleanupTestModules() {
	try {
		await fs.rm(testDir, { recursive: true, force: true });
	} catch (_) {
		// Ignore errors
	}
}

// Setup once before all tests
beforeAll(async () => {
	await setupTestModules();
});

// Cleanup after all tests
afterAll(async () => {
	await cleanupTestModules();
});

// Basic API removal tests
describe.each(getMatrixConfigs())("Basic API Removal > Config: '$name'", ({ config }) => {
	let slothlet;
	let api;

	beforeEach(async () => {
		const slothletModule = await import("@cldmv/slothlet");
		slothlet = slothletModule.default;
	});

	afterEach(async () => {
		if (api) {
			await api.shutdown();
			api = null;
		}
	});

	it("should remove API by path", async () => {
		api = await slothlet({
			...config,
			base: TEST_DIRS.API_TEST
		});

		// Add an API
		await api.slothlet.api.add("test.module", testDir + "/moduleA_v1");

		// Remove it
		const removed = await api.slothlet.api.remove("test.module");
		expect(removed).toBe(true);
		expect(api.test?.module).toBeUndefined();
	});

	it("should handle removeApi error cases", async () => {
		api = await slothlet({
			...config,
			base: TEST_DIRS.API_TEST
		});

		// Test invalid types
		await withSuppressedSlothletErrorOutput(async () => {
			await expect(api.slothlet.api.remove(123)).rejects.toThrow();
		});

		// Test empty object
		await withSuppressedSlothletErrorOutput(async () => {
			await expect(api.slothlet.api.remove({})).rejects.toThrow();
		});

		// Test non-existent path (should return false, not throw)
		const removed = await api.slothlet.api.remove("nonexistent.path");
		expect(removed).toBe(false);
	});

	it("should work without ownership tracking", async () => {
		api = await slothlet({
			...config,
			base: TEST_DIRS.API_TEST
		});

		// Add API without moduleID
		await api.slothlet.api.add("test.module", testDir + "/moduleA_v1");

		// Remove by path (should work)
		const removed = await api.slothlet.api.remove("test.module");
		expect(removed).toBe(true);
		expect(api.test?.module).toBeUndefined();
	});

	it("should return false for moduleID removal without ownership tracking", async () => {
		api = await slothlet({
			...config,
			base: TEST_DIRS.API_TEST
		});

		// Try to remove by moduleID without ownership tracking
		const removed = await api.slothlet.api.remove("someModule");
		expect(removed).toBe(false);
	});

	it("should remove by moduleID when ownership is available", async () => {
		api = await slothlet({
			...config,
			base: TEST_DIRS.API_TEST
		});

		// Add API with moduleID (ownership tracking is ALWAYS available in v3)
		await api.slothlet.api.add("plugins.test", testDir + "/moduleA_v1", { moduleID: "testModule" });

		expect(api.plugins?.test).toBeDefined();

		// Remove by moduleID should work (ownership is available)
		const removedById = await api.slothlet.api.remove("testModule");
		expect(removedById).toBe(true);
		expect(api.plugins?.test).toBeUndefined();
	});
});

// Module ownership tests - ownership tracking always available in v3
describe.each(getMatrixConfigs())("Module Ownership > Config: '$name'", ({ config }) => {
	let slothlet;
	let api;

	beforeEach(async () => {
		const slothletModule = await import("@cldmv/slothlet");
		slothlet = slothletModule.default;
	});

	afterEach(async () => {
		if (api) {
			await api.shutdown();
			api = null;
		}
	});

	it("should remove API by moduleID", async () => {
		api = await slothlet({
			...config,
			base: TEST_DIRS.API_TEST
		});

		// Add multiple APIs for the same module
		await api.slothlet.api.add("plugins.feature1", testDir + "/moduleA_v1", { moduleID: "moduleA" });
		await api.slothlet.api.add("plugins.feature2", testDir + "/moduleA_v1", { moduleID: "moduleA" });

		// Remove all APIs owned by moduleA
		const removed = await api.slothlet.api.remove("moduleA");
		expect(removed).toBe(true);
		expect(api.plugins?.feature1).toBeUndefined();
		expect(api.plugins?.feature2).toBeUndefined();
	});

	it("should auto-cleanup to prevent orphan functions", async () => {
		api = await slothlet({
			...config,
			base: TEST_DIRS.API_TEST
		});

		// Load version 1 (has function1 and function2)
		await api.slothlet.api.add("plugins.moduleA", testDir + "/moduleA_v1", { moduleID: "moduleA" });

		// Reload with version 2 (has function2 and function3, NO function1)
		await api.slothlet.api.add("plugins.moduleA", testDir + "/moduleA_v2", { moduleID: "moduleA" });

		// With auto-cleanup, function1 should be GONE (no errors should occur)
		expect(api.plugins?.moduleA).toBeDefined();
	});

	it("should isolate auto-cleanup by moduleID", async () => {
		api = await slothlet({
			...config,
			base: TEST_DIRS.API_TEST
		});

		// Load moduleA
		await api.slothlet.api.add("plugins.moduleA", testDir + "/moduleA_v1", { moduleID: "moduleA" });

		// Load moduleB
		await api.slothlet.api.add("plugins.moduleB", testDir + "/moduleB", { moduleID: "moduleB" });

		// Reload moduleA with version 2
		await api.slothlet.api.add("plugins.moduleA", testDir + "/moduleA_v2", { moduleID: "moduleA" });

		// moduleB should be untouched
		expect(api.plugins?.moduleB).toBeDefined();
	});

	it("should remove nested API paths by moduleID", async () => {
		api = await slothlet({
			...config,
			base: TEST_DIRS.API_TEST
		});

		// Add APIs at different nesting levels
		await api.slothlet.api.add("level1", testDir + "/moduleA_v1", { moduleID: "test" });
		await api.slothlet.api.add("level1.level2", testDir + "/moduleB", { moduleID: "test" });
		await api.slothlet.api.add("level1.level2.level3", testDir + "/moduleA_v1", { moduleID: "test" });

		// Remove all by moduleID
		const removed = await api.slothlet.api.remove("test");
		expect(removed).toBe(true);
		expect(api.level1).toBeUndefined();
	});
});

// Removing a module that SHARES a mount path with another must revert the shared paths to the
// co-owner, not delete the whole mount. This was a core unified-wrapper guarantee: when module B
// takes over a leaf module A owns and B is later removed, the leaf reverts to A.
describe.each(getMatrixConfigs())("Shared-mount removal reverts to the co-owner > Config: '$name'", ({ config }) => {
	let slothlet;
	let api;

	beforeEach(async () => {
		const slothletModule = await import("@cldmv/slothlet");
		slothlet = slothletModule.default;
	});

	afterEach(async () => {
		if (api) {
			await api.shutdown();
			api = null;
		}
	});

	it("reverts a taken-over leaf to the previous module when the overriding module is removed", async () => {
		api = await slothlet({ ...config, base: TEST_DIRS.API_TEST, api: { collision: "replace" } });
		await api.slothlet.api.add("shop", { exports: { leaf: () => "A-leaf" } });
		const idB = await api.slothlet.api.add("shop", { exports: { leaf: () => "B-leaf" } });

		// B took over the shared leaf on the live surface.
		expect(api.shop.leaf()).toBe("B-leaf");

		// Removing B must revert shop.leaf to A — not delete the whole shop mount (the pre-fix bug
		// left api.shop undefined).
		await api.slothlet.api.remove(idB);
		expect(api.shop, "the mount survives B's removal").toBeDefined();
		expect(api.shop.leaf()).toBe("A-leaf");
	});

	it("keeps the co-owner's members when a merged sibling module is removed", async () => {
		api = await slothlet({ ...config, base: TEST_DIRS.API_TEST }); // default merge
		await api.slothlet.api.add("shop", { exports: { leaf: () => "A-leaf", onlyA: () => "A-only" } });
		const idB = await api.slothlet.api.add("shop", { exports: { onlyB: () => "B-only" } });

		expect(api.shop.onlyB()).toBe("B-only");

		// Removing B removes only B's exclusive member; A's whole contribution survives.
		await api.slothlet.api.remove(idB);
		expect(api.shop.leaf()).toBe("A-leaf");
		expect(api.shop.onlyA()).toBe("A-only");
		expect(api.shop.onlyB).toBeUndefined();
	});

	it("merge-replace: second wins terminal + data leaves, recursively merges namespaces, reverts on remove", async () => {
		// merge-replace = "merge what can be merged, replace what must be replaced" (#5):
		//  - a TERMINAL leaf (callable or data) both modules define → second wins;
		//  - a NAMESPACE both contribute to → merged RECURSIVELY (each side's exclusive children coexist,
		//    deeper conflicts resolve the same way), not wholesale-replaced;
		//  - each module's non-conflicting members coexist;
		//  - removing the overwriting module restores the overwritten leaves to the first.
		// Before the fix, merge-replace no-ops on a callable leaf and behaves like merge, so B never wins.
		api = await slothlet({ ...config, base: TEST_DIRS.API_TEST, api: { collision: "merge-replace" } });
		await api.slothlet.api.add("shop", {
			exports: { leaf: () => "A-leaf", onlyA: () => "A-only", limit: 10, grp: { x: () => "A-x", ay: () => "A-ay" } }
		});
		const idB = await api.slothlet.api.add("shop", {
			exports: { leaf: () => "B-leaf", onlyB: () => "B-only", limit: 20, grp: { x: () => "B-x", by: () => "B-by" } }
		});

		// terminal callable + data leaf: second wins
		expect(api.shop.leaf(), "second wins the terminal callable").toBe("B-leaf");
		expect(api.shop.limit, "second wins the data leaf").toBe(20);
		// namespace merged recursively: conflicting child replaced, each side's exclusive child survives
		expect(api.shop.grp.x(), "second wins the nested terminal").toBe("B-x");
		expect(api.shop.grp.ay(), "A's exclusive nested child survives").toBe("A-ay");
		expect(api.shop.grp.by(), "B's nested child is added").toBe("B-by");
		// non-conflicting top-level members coexist
		expect(api.shop.onlyA(), "A's member survives").toBe("A-only");
		expect(api.shop.onlyB(), "B's member added").toBe("B-only");

		// removing B restores the overwritten leaves to A
		await api.slothlet.api.remove(idB);
		expect(api.shop.leaf(), "terminal reverts to A").toBe("A-leaf");
		expect(api.shop.grp.x(), "nested terminal reverts to A").toBe("A-x");
		expect(api.shop.onlyA(), "A's member still present").toBe("A-only");
		expect(api.shop.onlyB, "B's member gone").toBeUndefined();
	});

	it("replace: shadows the first module's exclusive members and restores its FULL mount on remove", async () => {
		// replace = B's mount wholesale-swaps the VISIBLE surface (only B's keys show), but A's
		// exclusive members are SHADOWED (preserved underneath), and removing B restores A's FULL
		// mount — the overwritten leaf AND the shadowed exclusive members. Before the fix, replace
		// DESTROYS A's exclusive members on add and cannot bring them back on remove (#3).
		api = await slothlet({ ...config, base: TEST_DIRS.API_TEST, api: { collision: "replace" } });
		await api.slothlet.api.add("shop", { exports: { leaf: () => "A-leaf", onlyA: () => "A-only", grp: { ax: () => "A-ax" } } });
		const idB = await api.slothlet.api.add("shop", { exports: { leaf: () => "B-leaf", onlyB: () => "B-only" } });

		// wholesale surface swap: only B's keys are visible; A's exclusive members are shadowed.
		expect(api.shop.leaf(), "second wins the terminal").toBe("B-leaf");
		expect(api.shop.onlyB(), "B's member is visible").toBe("B-only");
		expect(api.shop.onlyA, "A's exclusive leaf is shadowed while B is mounted").toBeUndefined();
		expect(api.shop.grp, "A's exclusive namespace is shadowed while B is mounted").toBeUndefined();

		// removing B restores A's FULL mount: the overwritten leaf AND every shadowed member (leaf + subtree).
		await api.slothlet.api.remove(idB);
		expect(api.shop, "the mount survives B's removal").toBeDefined();
		expect(api.shop.leaf(), "terminal reverts to A").toBe("A-leaf");
		expect(api.shop.onlyA(), "A's shadowed leaf is restored").toBe("A-only");
		expect(api.shop.grp.ax(), "A's shadowed namespace subtree is restored").toBe("A-ax");
		expect(api.shop.onlyB, "B's member is gone").toBeUndefined();
	});

	it("replace: a module replacing ITSELF drops its removed exports (no self-shadow to resurrect)", async () => {
		// The shadow only preserves a DIFFERENT module's exclusive members. A module replacing itself
		// (a same-moduleID re-add / reload-shaped op) genuinely drops the exports it no longer defines —
		// they must not be shadowed and later resurrected (#3, self-replace gate).
		api = await slothlet({ ...config, base: TEST_DIRS.API_TEST, api: { collision: "replace" } });
		await api.slothlet.api.add("shop", { exports: { leaf: () => "v1-leaf", gone: () => "v1-gone" } }, { moduleID: "selfmod" });
		await api.slothlet.api.add("shop", { exports: { leaf: () => "v2-leaf" } }, { moduleID: "selfmod" });
		expect(api.shop.leaf(), "the surviving export is updated").toBe("v2-leaf");
		expect(api.shop.gone, "the dropped export is gone, not shadowed").toBeUndefined();
	});

	it("replace: a later module re-providing a shadowed member keeps it on the earlier module's removal", async () => {
		// A's exclusive `x` is shadowed by B, then C re-provides `x`. Removing B must NOT clobber C's live
		// `x` with A's stale shadow — the re-attach skips a member the current surface already carries (#3).
		api = await slothlet({ ...config, base: TEST_DIRS.API_TEST, api: { collision: "replace" } });
		await api.slothlet.api.add("shop", { exports: { leaf: () => "A-leaf", x: () => "A-x" } }, { moduleID: "A" });
		const idB = await api.slothlet.api.add("shop", { exports: { leaf: () => "B-leaf" } }, { moduleID: "B" });
		await api.slothlet.api.add("shop", { exports: { leaf: () => "C-leaf", x: () => "C-x" } }, { moduleID: "C" });
		expect(api.shop.x(), "C provides x").toBe("C-x");

		await api.slothlet.api.remove(idB);
		expect(api.shop.x(), "C's live x survives B's removal (not clobbered by A's shadow)").toBe("C-x");
		expect(api.shop.leaf(), "leaf reverts to the current owner C").toBe("C-leaf");
	});
});
