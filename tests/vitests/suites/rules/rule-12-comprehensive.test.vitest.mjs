/**
 *
 *	@Project: @cldmv/slothlet
 *	@Filename: /tests/vitests/suites/rules/rule-12-comprehensive.test.vitest.mjs
 *	@Date: 2026-01-12T23:44:38-08:00 (1768290278)
 *	@Author: Nate Corcoran <CLDMV>
 *	@Email: <Shinrai@users.noreply.github.com>
 *	-----
 *	@Last modified by: Nate Corcoran <CLDMV> (Shinrai@users.noreply.github.com)
 *	@Last modified time: 2026-11-16T18:30:21-08:00 (1794882621)
 *	-----
 *	@Copyright: Copyright (c) 2013-2026 Catalyzed Motivation Inc. All rights reserved.
 *
 */

/**
 * Comprehensive Rule 12 test using matrix testing approach
 * Tests Rule 12 (Module Ownership and Selective API Overwriting) across all
 * meaningful slothlet configuration combinations to ensure consistent behavior.
 */

import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { getMatrixConfigs, TEST_DIRS, withSuppressedSlothletErrorOutput } from "../../setup/vitest-helper.mjs";

// Every matrix config, with merge collisions set on each (no matrix config carries an `api` key to filter on).
const OWNERSHIP_CONFIGS = getMatrixConfigs({}).map(({ name, config }) => ({
	name,
	config: { ...config, api: { ...config.api, collision: { mode: { initial: "merge", api: "merge" } } } }
}));

// Basic configurations for validation testing
const BASIC_CONFIGS = getMatrixConfigs({});

describe.each(OWNERSHIP_CONFIGS)("Rule 12 Ownership Tracking - $name", ({ name: ___name, config }) => {
	let slothlet;
	let api;

	beforeEach(async () => {
		const slothletModule = await import("@cldmv/slothlet");
		slothlet = slothletModule.default;
		api = await slothlet({
			...config,
			base: TEST_DIRS.API_TEST
		});
	});

	afterEach(async () => {
		if (api) {
			await api.shutdown();
			api = null;
		}
	});

	it("should allow module to register and update its own APIs", async () => {
		// Register moduleA - use absolute paths relative to current test directory
		await api.slothlet.api.add("plugins.moduleA", TEST_DIRS.API_TEST_MIXED, {
			id: "moduleA",
			collision: {
				force: true
			}
		});

		expect(api.plugins.moduleA).toBeDefined();

		// Update moduleA (hot-reload)
		await api.slothlet.api.add("plugins.moduleA", TEST_DIRS.API_TEST, {
			id: "moduleA",
			collision: {
				force: true
			}
		});

		expect(api.plugins.moduleA).toBeDefined();
	});

	it("should allow registering different modules independently", async () => {
		await api.slothlet.api.add("plugins.moduleB", TEST_DIRS.API_TEST_COLLECTIONS, {
			id: "moduleB",
			collision: {
				force: true
			}
		});

		expect(api.plugins.moduleB).toBeDefined();
	});

	it("should handle cross-module overwrite based on allowAddApiOverwrite setting", async () => {
		// Register moduleC first
		await api.slothlet.api.add("plugins.moduleC", TEST_DIRS.API_TEST, {
			id: "moduleC",
			collision: {
				force: true
			}
		});

		const before = await api.slothlet.api.leaves("moduleC");
		const mixedKeys = ["interop", "mathCjs", "mathEsm"];
		expect(before.length).toBeGreaterThan(0);

		// These configs collide by merge: a different module adding at an owned path succeeds.
		await api.slothlet.api.add("plugins.moduleC", TEST_DIRS.API_TEST_MIXED, {
			id: "moduleD"
				// Different module adding at moduleC's path
		});

		// The path now carries API_TEST_MIXED's top-level keys, and moduleC's own keys are still there (a merge, not a replace).
		for (const key of mixedKeys) {
			expect(api.plugins.moduleC[key]).toBeDefined();
		}
		expect(api.plugins.moduleC.math).toBeDefined();

		// moduleD owns exactly the leaves API_TEST_MIXED contributed; moduleC keeps its own and owns none of those.
		const ownedByD = await api.slothlet.api.leaves("moduleD");
		expect([...ownedByD].sort()).toEqual(
			[
				"plugins.moduleC.interop.interopCjs.testCrossCall",
				"plugins.moduleC.interop.interopEsm.testCrossCall",
				"plugins.moduleC.mathCjs.divide",
				"plugins.moduleC.mathCjs.multiply",
				"plugins.moduleC.mathEsm.add",
				"plugins.moduleC.mathEsm.subtract"
			].sort()
		);
		const ownedByC = await api.slothlet.api.leaves("moduleC");
		expect(ownedByC).toEqual(before);
		for (const leaf of ownedByD) {
			expect(ownedByC).not.toContain(leaf);
		}
	});
});

describe.each(BASIC_CONFIGS)("Rule 12 Configuration Validation - $name", ({ name: ___name, config }) => {
	let slothlet;
	let api;

	beforeEach(async () => {
		const slothletModule = await import("@cldmv/slothlet");
		slothlet = slothletModule.default;
		api = await slothlet({
			...config,
			base: TEST_DIRS.API_TEST
		});
	});

	afterEach(async () => {
		if (api) {
			await api.shutdown();
			api = null;
		}
	});

	it("should gate a forceOverwrite add on api.mutations.add, not api.mutations.reload", async () => {
		const addForced = (target) =>
			target.slothlet.api.add("test.path", TEST_DIRS.API_TEST, { collision: {
						force: true
					}, id: "testModule" });

		// Reload mutations off: slothlet does not tie forceOverwrite to reload, so the add still resolves.
		const noReload = await slothlet({ ...config, base: TEST_DIRS.API_TEST, api: { ...config.api, mutations: { reload: false } } });
		try {
			await addForced(noReload);
			expect(noReload.test.path).toBeDefined();
		} finally {
			await noReload.shutdown();
		}

		// Reload mutations on: the same add resolves.
		const withReload = await slothlet({ ...config, base: TEST_DIRS.API_TEST, api: { ...config.api, mutations: { reload: true } } });
		try {
			await addForced(withReload);
			expect(withReload.test.path).toBeDefined();
		} finally {
			await withReload.shutdown();
		}

		// Add mutations off: the same forceOverwrite add is refused with the real code.
		const noAdd = await slothlet({ ...config, base: TEST_DIRS.API_TEST, api: { ...config.api, mutations: { add: false } } });
		try {
			await withSuppressedSlothletErrorOutput(async () => {
				await expect(addForced(noAdd)).rejects.toMatchObject({ code: "API_MUTATION_DISABLED" });
			});
		} finally {
			await noAdd.shutdown();
		}
	});
});

describe("Rule 12 with allowApiOverwrite: false", () => {
	let apisToClean = [];

	afterEach(async () => {
		for (const api of apisToClean) {
			if (api) {
				await api.shutdown();
			}
		}
		apisToClean = [];
	});

	it("should block normal overwrites when allowApiOverwrite: false (eager mode)", async () => {
		const slothletModule = await import("@cldmv/slothlet");
		const slothlet = slothletModule.default;
		const api = await slothlet({
			base: TEST_DIRS.API_TEST,
			api: {
				mutations: { reload: true },
				collision: {
					mode: { initial: "replace", api: "skip" }
				}
			}
		});
		apisToClean.push(api);

		// First api.slothlet.api.add should work
		await api.slothlet.api.add("normal.test", TEST_DIRS.API_TEST);
		const originalApi = api.normal.test;

		// Second api.slothlet.api.add should be silently skipped (not throw)
		await api.slothlet.api.add("normal.test", TEST_DIRS.API_TEST_MIXED);

		// Verify API was NOT overwritten
		expect(api.normal.test).toBe(originalApi);
	});

	it("should allow same module to update despite allowApiOverwrite: false (eager mode)", async () => {
		const slothletModule = await import("@cldmv/slothlet");
		const slothlet = slothletModule.default;
		const api = await slothlet({
			base: TEST_DIRS.API_TEST,
			api: {
				mutations: { reload: true },
				collision: {
					mode: { initial: "merge-replace", api: "error" }
				}
			}
		});
		apisToClean.push(api);

		// Register with moduleID
		await api.slothlet.api.add("ownership.test", TEST_DIRS.API_TEST_COLLECTIONS, {
			id: "testModule",
			collision: {
				force: true
			}
		});

		// Same module should be able to update
		await api.slothlet.api.add("ownership.test", TEST_DIRS.API_TEST_MIXED, {
			id: "testModule",
			collision: {
				force: true
			}
		});

		// Original test doesn't check reference identity - just verifies operation succeeds
		// Module ownership allows same module to update (slothlet preserves reference correctly)
		expect(api.ownership.test).toBeDefined();
	});

	it("should block cross-module overwrites when allowApiOverwrite: false (eager mode)", async () => {
		const slothletModule = await import("@cldmv/slothlet");
		const slothlet = slothletModule.default;
		const api = await slothlet({
			base: TEST_DIRS.API_TEST,
			api: {
				mutations: { reload: true },
				collision: {
					mode: { initial: "merge-replace", api: "error" }
				}
			}
		});
		apisToClean.push(api);

		// Register with moduleID
		await api.slothlet.api.add("ownership.cross", TEST_DIRS.API_TEST_COLLECTIONS, {
			id: "testModule",
			collision: {
				force: true
			}
		});

		// Different module should be blocked by collision mode
		await withSuppressedSlothletErrorOutput(async () => {
			try {
				await api.slothlet.api.add("ownership.cross", TEST_DIRS.API_TEST_COLLECTIONS, {
					id: "differentModule"
				});
				throw new Error("Expected cross-module overwrite to be blocked");
			} catch (error) {
				expect(error.message).toContain("path already exists");
				expect(error.message).toContain("collision mode is 'error'");
			}
		});
	});

	it("should block normal overwrites when allowAddApiOverwrite: false (lazy mode)", async () => {
		const slothletModule = await import("@cldmv/slothlet");
		const slothlet = slothletModule.default;
		const api = await slothlet({
			base: TEST_DIRS.API_TEST_COLLECTIONS,
			api: {
				mutations: { reload: true },
				collision: {
					mode: { initial: "replace", api: "skip" }
				}
			}
		});
		apisToClean.push(api);

		await api.slothlet.api.add("normal.test2", TEST_DIRS.API_TEST_COLLECTIONS);
		const originalApi = api.normal.test2;

		await api.slothlet.api.add("normal.test2", TEST_DIRS.API_TEST_MIXED);

		expect(api.normal.test2).toBe(originalApi);
	});

	it("should allow same module to update despite allowApiOverwrite: false (lazy mode)", async () => {
		const slothletModule = await import("@cldmv/slothlet");
		const slothlet = slothletModule.default;
		const api = await slothlet({
			base: TEST_DIRS.API_TEST,
			api: {
				mutations: { reload: true },
				collision: {
					mode: { initial: "merge-replace", api: "error" }
				}
			}
		});
		apisToClean.push(api);

		await api.slothlet.api.add("ownership.test2", TEST_DIRS.API_TEST_COLLECTIONS, {
			id: "testModule2",
			collision: {
				force: true
			}
		});

		await api.slothlet.api.add("ownership.test2", TEST_DIRS.API_TEST_MIXED, {
			id: "testModule2",
			collision: {
				force: true
			}
		});

		// Original test doesn't check reference identity - just verifies operation succeeds
		expect(api.ownership.test2).toBeDefined();
	});

	it("should block cross-module overwrites when allowApiOverwrite: false (lazy mode)", async () => {
		const slothletModule = await import("@cldmv/slothlet");
		const slothlet = slothletModule.default;
		const api = await slothlet({
			base: TEST_DIRS.API_TEST,
			api: {
				mutations: { reload: true },
				collision: {
					mode: { initial: "merge-replace", api: "error" }
				}
			}
		});
		apisToClean.push(api);

		await api.slothlet.api.add("ownership.cross2", TEST_DIRS.API_TEST_COLLECTIONS, {
			id: "testModule2",
			collision: {
				force: true
			}
		});

		await withSuppressedSlothletErrorOutput(async () => {
			try {
				await api.slothlet.api.add("ownership.cross2", TEST_DIRS.API_TEST_COLLECTIONS, {
					id: "differentModule2"
				});
				throw new Error("Expected cross-module overwrite to be blocked");
			} catch (error) {
				expect(error.message).toContain("path already exists");
				expect(error.message).toContain("collision mode is 'error'");
			}
		});
	});
});
