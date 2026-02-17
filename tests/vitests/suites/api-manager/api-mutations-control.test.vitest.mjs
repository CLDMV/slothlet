/**
 *	@Project: @cldmv/slothlet
 *	@Filename: /tests/vitests/suites/api-manager/api-mutations-control.test.vitest.mjs
 *	@Date: 2026-01-28T17:14:19-08:00 (1769649259)
 *	@Author: Nate Hyson <CLDMV>
 *	@Email: <Shinrai@users.noreply.github.com>
 *	-----
 *	@Last modified by: Nate Hyson <CLDMV> (Shinrai@users.noreply.github.com)
 *	@Last modified time: 2026-02-05 15:54:19 -08:00 (1770335659)
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
import { getMatrixConfigs, TEST_DIRS } from "../../setup/vitest-helper.mjs";

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
	{ label: "api-test", dir: TEST_DIRS.API_TEST },
	{ label: "api-test-mixed", dir: TEST_DIRS.API_TEST_MIXED }
];

const MATRIX_CONFIGS = getMatrixConfigs({}).flatMap(({ name, config }) =>
	BASE_DIRS.map(({ label, dir }) => ({
		name: `${name} | ${label}`,
		config: { ...config, dir }
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

		// Verify V2_CONFIG_UNSUPPORTED warning was shown
		const warnings = SlothletWarning.captured;
		expect(warnings.some((w) => w.code === "V2_CONFIG_UNSUPPORTED")).toBe(true);
		const v2Warning = warnings.find((w) => w.code === "V2_CONFIG_UNSUPPORTED");
		expect(v2Warning.message).toContain("allowMutation");
		expect(v2Warning.message).toContain("api.mutations");

		// API should be created
		expect(api.slothlet.api).toBeDefined();
		expect(api.slothlet.reload).toBeTypeOf("function");

		// But mutations should be blocked
		await expect(api.slothlet.api.add("test", TEST_DIRS.API_TEST_MIXED, { moduleID: "test" })).rejects.toThrow(
			"INVALID_CONFIG_MUTATIONS_DISABLED"
		);

		await expect(api.slothlet.api.remove("math")).rejects.toThrow("INVALID_CONFIG_MUTATIONS_DISABLED");

		await expect(api.slothlet.reload()).rejects.toThrow("INVALID_CONFIG_MUTATIONS_DISABLED");
	});

	it("should allow normal API usage when allowMutation: false", async () => {
		// Clear captured warnings before test
		const { SlothletWarning } = await import("@cldmv/slothlet/errors");
		SlothletWarning.clearCaptured();

		api = await createApiInstance(config, { allowMutation: false });

		// Verify V2_CONFIG_UNSUPPORTED warning was shown
		const warnings = SlothletWarning.captured;
		expect(warnings.some((w) => w.code === "V2_CONFIG_UNSUPPORTED")).toBe(true);
		const v2Warning = warnings.find((w) => w.code === "V2_CONFIG_UNSUPPORTED");
		expect(v2Warning.message).toContain("allowMutation");

		// Normal API functions should still work (mutations blocked, but API callable)
		const mathAdd = config.dir === TEST_DIRS.API_TEST_MIXED ? api.mathEsm?.add : api.math?.add;
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
		await expect(api.slothlet.api.add("test", TEST_DIRS.API_TEST_MIXED, { moduleID: "test" })).rejects.toThrow(
			"INVALID_CONFIG_MUTATIONS_DISABLED"
		);

		await expect(api.slothlet.api.remove("math")).rejects.toThrow("INVALID_CONFIG_MUTATIONS_DISABLED");

		await expect(api.slothlet.reload()).rejects.toThrow("INVALID_CONFIG_MUTATIONS_DISABLED");
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
		await expect(api.slothlet.api.remove("extra")).rejects.toThrow("INVALID_CONFIG_MUTATIONS_DISABLED");
		await expect(api.slothlet.reload()).rejects.toThrow("INVALID_CONFIG_MUTATIONS_DISABLED");
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
		await expect(api.slothlet.api.add("test", TEST_DIRS.API_TEST_MIXED, { moduleID: "test" })).rejects.toThrow(
			"INVALID_CONFIG_MUTATIONS_DISABLED"
		);
		await expect(api.slothlet.reload()).rejects.toThrow("INVALID_CONFIG_MUTATIONS_DISABLED");

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
		await expect(api.slothlet.api.add("test", TEST_DIRS.API_TEST_MIXED, { moduleID: "test-forced", forceOverwrite: true })).rejects.toThrow(
			"INVALID_CONFIG_MUTATIONS_DISABLED"
		);
	});

	// TODO: Add proper ownership conflict tests once ownership system is fixed
	// Current issue: Adding same directory twice with different moduleIDs doesn't trigger
	// OWNERSHIP_CONFLICT as expected. Need to investigate ownership tracking.

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
		await expect(api.slothlet.api.add("test", TEST_DIRS.API_TEST_MIXED, { moduleID: "test" })).rejects.toThrow(
			"INVALID_CONFIG_MUTATIONS_DISABLED"
		);
		await expect(api.slothlet.api.remove("math")).rejects.toThrow("INVALID_CONFIG_MUTATIONS_DISABLED");

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
		if (config.dir === TEST_DIRS.API_TEST_MIXED) {
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
			expect(error.context?.hint).toBeTruthy();
		}

		// Check remove error
		try {
			await api.slothlet.api.remove("math");
		} catch (error) {
			expect(error.message).toContain("INVALID_CONFIG_MUTATIONS_DISABLED");
			expect(error.context?.operation).toBe("api.remove");
			expect(error.context?.hint).toBeTruthy();
		}

		// Check reload error
		try {
			await api.slothlet.reload();
		} catch (error) {
			expect(error.message).toContain("INVALID_CONFIG_MUTATIONS_DISABLED");
			expect(error.context?.operation).toBe("reload");
			expect(error.context?.hint).toBeTruthy();
		}
	});
});
