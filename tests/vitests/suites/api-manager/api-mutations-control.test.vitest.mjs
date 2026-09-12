/**
 *	@Project: @cldmv/slothlet
 *	@Filename: /tests/vitests/suites/api-manager/api-mutations-control.test.vitest.mjs
 *	@Date: 2026-01-28T17:14:19-08:00 (1769649259)
 *	@Author: Nate Corcoran <CLDMV>
 *	@Email: <Shinrai@users.noreply.github.com>
 *	-----
 *	@Last modified by: Nate Corcoran <CLDMV> (Shinrai@users.noreply.github.com)
 *	@Last modified time: 2026-03-01 20:21:44 -08:00 (1772425304)
 *	-----
 *	@Copyright: Copyright (c) 2013-2026 Catalyzed Motivation Inc. All rights reserved.
 */

/**
 * @fileoverview Tests for API mutation control (api.mutations config)
 *
 * @description
 * Tests for the api.mutations configuration option which controls runtime API modifications.
 *
 * The api.mutations config provides granular control over:
 * - api.slothlet.api.add() - Adding new modules at runtime
 * - api.slothlet.api.remove() - Removing modules at runtime
 * - api.slothlet.reload() - Reloading the entire instance
 *
 * Also tests backward compatibility with the deprecated allowMutation config option.
 *
 * @module tests/vitests/suites/api-manager/api-manager-allowMutation-disabled.test.vitest
 */

process.env.SLOTHLET_INTERNAL_TEST_MODE = "true";

import { describe, it, expect, afterEach } from "vitest";
import slothlet from "@cldmv/slothlet";
import { resolveWrapper } from "#handlers/unified-wrapper";
import { getMatrixConfigs, TEST_DIRS, withSuppressedSlothletErrorOutput } from "../../setup/vitest-helper.mjs";

/**
 * Create a slothlet API instance for a given configuration.
 * @param {object} baseConfig - Base configuration from the matrix.
 * @param {object} [overrides] - Additional overrides for the slothlet config.
 * @returns {Promise<object>} Initialized slothlet API instance.
 */
async function createApiInstance(baseConfig, overrides = {}) {
	return slothlet({ ...baseConfig, ...overrides });
}

const BASE_DIRS = [
	{ label: "api-test", base: TEST_DIRS.API_TEST },
	{ label: "api-test-mixed", base: TEST_DIRS.API_TEST_MIXED }
];

const MATRIX_CONFIGS = getMatrixConfigs({}).flatMap(({ name, config }) =>
	BASE_DIRS.map(({ label, base }) => ({
		name: `${name} | ${label}`,
		config: { ...config, base }
	}))
);

describe.each(MATRIX_CONFIGS)("API mutations control - $name", ({ config }) => {
	let api;

	afterEach(async () => {
		if (api?.shutdown) {
			await api.shutdown();
		}
		api = null;
	});

	// ===== BACKWARD COMPATIBILITY TESTS =====

	it("should map allowMutation: false to api.mutations disabled (backward compat)", async () => {
		// Clear captured warnings before test
		const { SlothletWarning } = await import("@cldmv/slothlet/errors");
		SlothletWarning.clearCaptured();

		api = await createApiInstance(config, { allowMutation: false });

		// Verify V3_CONFIG_DEPRECATED warning was shown
		const warnings = SlothletWarning.captured;
		expect(warnings.some((w) => w.code === "V3_CONFIG_DEPRECATED")).toBe(true);
		const deprecationWarning = warnings.find((w) => w.code === "V3_CONFIG_DEPRECATED");
		expect(deprecationWarning.message).toContain("allowMutation");
		expect(deprecationWarning.message).toContain("api.mutations");

		// API should be created
		expect(api.slothlet.api).toBeDefined();
		expect(api.slothlet.reload).toBeTypeOf("function");

		// But mutations should be blocked
		await withSuppressedSlothletErrorOutput(async () => {
			await expect(api.slothlet.api.add("test", TEST_DIRS.API_TEST_MIXED, { moduleID: "test" })).rejects.toThrow(
				"INVALID_CONFIG_MUTATIONS_DISABLED"
			);
		});

		await withSuppressedSlothletErrorOutput(async () => {
			await expect(api.slothlet.api.remove("math")).rejects.toThrow("INVALID_CONFIG_MUTATIONS_DISABLED");
		});

		await withSuppressedSlothletErrorOutput(async () => {
			await expect(api.slothlet.reload()).rejects.toThrow("INVALID_CONFIG_MUTATIONS_DISABLED");
		});
	});

	it("should allow normal API usage when allowMutation: false", async () => {
		// Clear captured warnings before test
		const { SlothletWarning } = await import("@cldmv/slothlet/errors");
		SlothletWarning.clearCaptured();

		api = await createApiInstance(config, { allowMutation: false });

		// Verify V3_CONFIG_DEPRECATED warning was shown
		const warnings = SlothletWarning.captured;
		expect(warnings.some((w) => w.code === "V3_CONFIG_DEPRECATED")).toBe(true);
		const deprecationWarning = warnings.find((w) => w.code === "V3_CONFIG_DEPRECATED");
		expect(deprecationWarning.message).toContain("allowMutation");

		// Normal API functions should still work (mutations blocked, but API callable)
		const mathAdd = config.base === TEST_DIRS.API_TEST_MIXED ? api.mathEsm?.add : api.math?.add;
		expect(mathAdd).toBeDefined();
		expect(typeof mathAdd).toBe("function");

		// Don't test the actual return value - depends on collision config
		// (file vs folder wins, giving 8 vs 1008)
		if (mathAdd) {
			const result = await mathAdd(5, 3);
			expect(typeof result).toBe("number");
		}
	});

	// ===== NEW API.MUTATIONS CONFIG TESTS =====

	it("should disable all mutations with api.mutations: { add: false, remove: false, reload: false }", async () => {
		api = await createApiInstance(config, {
			api: {
				mutations: {
					add: false,
					remove: false,
					reload: false
				}
			}
		});

		// All mutations should be blocked
		await withSuppressedSlothletErrorOutput(async () => {
			await expect(api.slothlet.api.add("test", TEST_DIRS.API_TEST_MIXED, { moduleID: "test" })).rejects.toThrow(
				"INVALID_CONFIG_MUTATIONS_DISABLED"
			);
		});

		await withSuppressedSlothletErrorOutput(async () => {
			await expect(api.slothlet.api.remove("math")).rejects.toThrow("INVALID_CONFIG_MUTATIONS_DISABLED");
		});

		await withSuppressedSlothletErrorOutput(async () => {
			await expect(api.slothlet.reload()).rejects.toThrow("INVALID_CONFIG_MUTATIONS_DISABLED");
		});
	});

	it("should allow only add with granular mutations control", async () => {
		api = await createApiInstance(config, {
			api: {
				mutations: {
					add: true,
					remove: false,
					reload: false
				}
			}
		});

		// Add should work
		await api.slothlet.api.add("extra", TEST_DIRS.API_TEST_MIXED, { moduleID: "extra-test" });
		expect(api.extra).toBeDefined();

		// Remove and reload should be blocked
		await withSuppressedSlothletErrorOutput(async () => {
			await expect(api.slothlet.api.remove("extra")).rejects.toThrow("INVALID_CONFIG_MUTATIONS_DISABLED");
		});
		await withSuppressedSlothletErrorOutput(async () => {
			await expect(api.slothlet.reload()).rejects.toThrow("INVALID_CONFIG_MUTATIONS_DISABLED");
		});
	});

	it("should allow only remove with granular mutations control", async () => {
		api = await createApiInstance(config, {
			api: {
				mutations: {
					add: false,
					remove: true,
					reload: false
				}
			}
		});

		// Add and reload should be blocked
		await withSuppressedSlothletErrorOutput(async () => {
			await expect(api.slothlet.api.add("test", TEST_DIRS.API_TEST_MIXED, { moduleID: "test" })).rejects.toThrow(
				"INVALID_CONFIG_MUTATIONS_DISABLED"
			);
		});
		await withSuppressedSlothletErrorOutput(async () => {
			await expect(api.slothlet.reload()).rejects.toThrow("INVALID_CONFIG_MUTATIONS_DISABLED");
		});

		// Remove should work - returns false when path not found
		const removeResult = await api.slothlet.api.remove("nonexistent");
		expect(removeResult).toBe(false);
	});

	it("should block add even with forceOverwrite: true when mutations.add is false", async () => {
		api = await createApiInstance(config, {
			api: {
				mutations: {
					add: false,
					remove: true,
					reload: false
				}
			}
		});

		// forceOverwrite should NOT bypass mutations.add restriction
		await withSuppressedSlothletErrorOutput(async () => {
			await expect(
				api.slothlet.api.add("test", TEST_DIRS.API_TEST_MIXED, { moduleID: "test-forced", forceOverwrite: true })
			).rejects.toThrow("INVALID_CONFIG_MUTATIONS_DISABLED");
		});
	});

	it("allows a fresh add to a brand-new path under collision.api: 'error' (#366 review)", async () => {
		// A brand-new (non-colliding) api.add() must succeed under collision.api: "error" — it
		// previously always threw, because addApiComponent writes the same value to both
		// this.slothlet.api and this.slothlet.boundApi (a pure pass-through Proxy over api) via two
		// separate setValueAtPath calls; by the second call, boundApi's mirrored read of api's
		// just-written value looked like a foreign collision to a check that branched on
		// collisionMode before ever comparing the two references.
		api = await createApiInstance(config, { collision: { api: "error" } });

		await api.slothlet.api.add("thing", TEST_DIRS.API_TEST_ADD_DEDUP_LEAF, { moduleID: "dedup-leaf" });
		expect(api.thing("x")).toBe("base:x");
	});

	it("still rejects a genuine cross-module collision under collision.api: 'error' with no override", async () => {
		api = await createApiInstance(config, { collision: { api: "error" }, base: TEST_DIRS.API_TEST_ADD_DEDUP_LEAF });
		expect(api.thing("x")).toBe("base:x");

		await withSuppressedSlothletErrorOutput(async () => {
			await expect(
				api.slothlet.api.add("thing", TEST_DIRS.API_TEST_ADD_DEDUP_LEAF_OVERRIDE, { moduleID: "different-module" })
			).rejects.toThrow("INVALID_CONFIG_API_PATH_INVALID");
		});
	});

	it("forceOverwrite selects replace under collision.api: 'error' instead of throwing OWNERSHIP_CONFLICT", async () => {
		api = await createApiInstance(config, { collision: { api: "error" }, base: TEST_DIRS.API_TEST_ADD_DEDUP_LEAF });
		expect(api.thing("x")).toBe("base:x");
		const baseModuleID = resolveWrapper(api.thing).____slothletInternal.moduleID;

		await expect(
			api.slothlet.api.add("thing", TEST_DIRS.API_TEST_ADD_DEDUP_LEAF_OVERRIDE, { moduleID: baseModuleID, forceOverwrite: true })
		).resolves.not.toThrow();

		expect(typeof api.thing).toBe("function");
		expect(api.thing("x")).toBe("override:x");
	});

	it("a skip-rejected add is not recorded as an owner of the path it never landed on (#366 review — #373)", async () => {
		api = await createApiInstance(config, { collision: { api: "skip" }, base: TEST_DIRS.API_TEST_ADD_DEDUP_LEAF });
		expect(api.thing("x")).toBe("base:x");
		const baseModuleID = resolveWrapper(api.thing).____slothletInternal.moduleID;

		// A different moduleID colliding under "skip" is silently rejected — the live tree must be
		// untouched, AND the rejected module must not appear in the path's ownership set (previously
		// it did, since processFiles registered ownership unconditionally after assignToApiPath).
		await api.slothlet.api.add("thing", TEST_DIRS.API_TEST_ADD_DEDUP_LEAF_OVERRIDE, { moduleID: "rejected-mod" });

		expect(api.thing("x")).toBe("base:x");
		const owners = api.slothlet.owner.get("thing");
		expect(owners.has("rejected-mod")).toBe(false);
		expect([...owners]).toEqual([baseModuleID]);
	});

	it("a skip-rejected re-add by the SAME moduleID does not erase its own existing ownership (#366 review — #373)", async () => {
		api = await createApiInstance(config, { collision: { api: "skip" }, base: TEST_DIRS.API_TEST });

		// First add: a brand-new path, no collision — "same-mod" becomes its legitimate owner.
		await api.slothlet.api.add("thing", TEST_DIRS.API_TEST_ADD_DEDUP_LEAF, { moduleID: "same-mod" });
		expect(api.thing("x")).toBe("base:x");
		expect(api.slothlet.owner.get("thing").has("same-mod")).toBe(true);

		// Second add: same moduleID, same path, different content. buildAPI always constructs a
		// fresh wrapper, so this is still a real collision under "skip" and is rejected — but the
		// module's own PRIOR ownership registration must survive the rejection cleanup, since it
		// wasn't fabricated by this failed attempt.
		await api.slothlet.api.add("thing", TEST_DIRS.API_TEST_ADD_DEDUP_LEAF_OVERRIDE, { moduleID: "same-mod" });

		expect(api.thing("x")).toBe("base:x");
		expect(api.slothlet.owner.get("thing").has("same-mod")).toBe(true);
	});

	it("a root-level add's per-key skip rejection does not record ownership for the rejected key (#366 review — #373)", async () => {
		api = await createApiInstance(config, { collision: { api: "skip" }, base: TEST_DIRS.API_TEST_ADD_ROOT_BASE });
		expect(api.existing("x")).toBe("root-base:x");

		// Root add mounts two keys at once: "existing" collides under skip and is rejected, "fresh"
		// has no collision and is genuinely mounted. The two keys must be gated independently, not
		// by a single any-key-succeeded flag.
		await api.slothlet.api.add("", TEST_DIRS.API_TEST_ADD_ROOT_MULTI, { moduleID: "root-multi-mod" });

		expect(api.existing("x")).toBe("root-base:x");
		expect(api.slothlet.owner.get("existing").has("root-multi-mod")).toBe(false);

		expect(api.fresh("x")).toBe("root-multi:fresh:x");
		expect(api.slothlet.owner.get("fresh").has("root-multi-mod")).toBe(true);
	});

	it("should allow only reload with granular mutations control", async () => {
		api = await createApiInstance(config, {
			api: {
				mutations: {
					add: false,
					remove: false,
					reload: true
				}
			}
		});

		// Add and remove should be blocked
		await withSuppressedSlothletErrorOutput(async () => {
			await expect(api.slothlet.api.add("test", TEST_DIRS.API_TEST_MIXED, { moduleID: "test" })).rejects.toThrow(
				"INVALID_CONFIG_MUTATIONS_DISABLED"
			);
		});
		await withSuppressedSlothletErrorOutput(async () => {
			await expect(api.slothlet.api.remove("math")).rejects.toThrow("INVALID_CONFIG_MUTATIONS_DISABLED");
		});

		// Reload should work
		await expect(api.slothlet.reload()).resolves.not.toThrow();
	});

	it("should allow all mutations by default", async () => {
		api = await createApiInstance(config);

		// All mutations should work
		await api.slothlet.api.add("extra", TEST_DIRS.API_TEST_MIXED, { moduleID: "extra-test" });
		expect(api.extra).toBeDefined();

		await expect(api.slothlet.reload()).resolves.not.toThrow();
		await expect(api.slothlet.api.remove("extra")).resolves.not.toThrow();
	});

	it("should allow all mutations with api.mutations: { add: true, remove: true, reload: true }", async () => {
		api = await createApiInstance(config, {
			api: {
				mutations: {
					add: true,
					remove: true,
					reload: true
				}
			}
		});

		// All mutations should work
		await api.slothlet.api.add("extra", TEST_DIRS.API_TEST_MIXED, { moduleID: "extra-test" });
		expect(api.extra).toBeDefined();

		await expect(api.slothlet.reload()).resolves.not.toThrow();
		await expect(api.slothlet.api.remove("extra")).resolves.not.toThrow();
	});

	// ===== COLLISION CONFIG VS MUTATIONS CONFIG =====

	it("should distinguish collision config from mutations config", async () => {
		// Skip for api-test-mixed since it has mathCjs collisions that interfere with error mode
		if (config.base === TEST_DIRS.API_TEST_MIXED) {
			return;
		}

		// collision config controls collision handling, NOT mutation availability
		// V3: collision.api = "error" rejects api.add() even for new paths if the added module
		// has internal collisions, so use "warn" instead to test the concept
		api = await createApiInstance(config, {
			api: {
				collision: {
					initial: "merge",
					api: "warn"
				}
			}
		});

		expect(api.slothlet.api).toBeDefined();

		// Mutations are still available (not disabled by collision config)
		// Adding to unique path should work (warns but allows first add)
		const uniquePath = `test_${Date.now()}`;
		await api.slothlet.api.add(uniquePath, TEST_DIRS.API_TEST_COLLECTIONS, { moduleID: "unique-test" });
		expect(api[uniquePath]).toBeDefined();

		// V3: With warn mode, second add merges instead of throwing
		// The test concept is validated: collision config != mutations disabled
		await api.slothlet.api.add(uniquePath, TEST_DIRS.API_TEST_COLLECTIONS, { moduleID: "unique-test2" });
		expect(api[uniquePath]).toBeDefined();
	});

	// ===== ERROR MESSAGE VALIDATION =====

	it("should provide helpful error messages when mutations are disabled", async () => {
		api = await createApiInstance(config, {
			api: {
				mutations: {
					add: false,
					remove: false,
					reload: false
				}
			}
		});

		// Check add error
		try {
			await api.slothlet.api.add("test", TEST_DIRS.API_TEST_MIXED);
		} catch (error) {
			expect(error.message).toContain("INVALID_CONFIG_MUTATIONS_DISABLED");
			expect(error.context?.operation).toBe("api.add");
			expect(error.hint).toBeTruthy();
		}

		// Check remove error
		try {
			await api.slothlet.api.remove("math");
		} catch (error) {
			expect(error.message).toContain("INVALID_CONFIG_MUTATIONS_DISABLED");
			expect(error.context?.operation).toBe("api.remove");
			expect(error.hint).toBeTruthy();
		}

		// Check reload error
		try {
			await api.slothlet.reload();
		} catch (error) {
			expect(error.message).toContain("INVALID_CONFIG_MUTATIONS_DISABLED");
			expect(error.context?.operation).toBe("reload");
			expect(error.hint).toBeTruthy();
		}
	});
});
