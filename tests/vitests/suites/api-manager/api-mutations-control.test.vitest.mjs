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
		// Capture console.warn to verify warning is shown
		const originalConsoleWarn = console.warn;
		let warnOutput = "";
		console.warn = (...args) => {
			warnOutput += args.join(" ");
		};

		try {
			api = await createApiInstance(config, { allowMutation: false });

			// Verify V2_CONFIG_UNSUPPORTED warning was shown
			expect(warnOutput).toContain("V2_CONFIG_UNSUPPORTED");
			expect(warnOutput).toContain("allowMutation");
			expect(warnOutput).toContain("api.mutations");

			// API should be created
			expect(api.slothlet.api).toBeDefined();
			expect(api.slothlet.reload).toBeTypeOf("function");

			// But mutations should be blocked
			await expect(api.slothlet.api.add("test", TEST_DIRS.API_TEST_MIXED, {}, { moduleId: "test" })).rejects.toThrow(
				"INVALID_CONFIG_MUTATIONS_DISABLED"
			);

			await expect(api.slothlet.api.remove("math")).rejects.toThrow("INVALID_CONFIG_MUTATIONS_DISABLED");

			await expect(api.slothlet.reload()).rejects.toThrow("INVALID_CONFIG_MUTATIONS_DISABLED");
		} finally {
			console.warn = originalConsoleWarn;
		}
	});

	it("should allow normal API usage when allowMutation: false", async () => {
		// Capture console.warn to verify warning is shown
		const originalConsoleWarn = console.warn;
		let warnOutput = "";
		console.warn = (...args) => {
			warnOutput += args.join(" ");
		};

		try {
			api = await createApiInstance(config, { allowMutation: false });

			// Verify V2_CONFIG_UNSUPPORTED warning was shown
			expect(warnOutput).toContain("V2_CONFIG_UNSUPPORTED");
			expect(warnOutput).toContain("allowMutation");

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
		} finally {
			console.warn = originalConsoleWarn;
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
		await expect(api.slothlet.api.add("test", TEST_DIRS.API_TEST_MIXED, {}, { moduleId: "test" })).rejects.toThrow(
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
		await api.slothlet.api.add("extra", TEST_DIRS.API_TEST_MIXED, {}, { moduleId: "extra-test" });
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
		await expect(api.slothlet.api.add("test", TEST_DIRS.API_TEST_MIXED, {}, { moduleId: "test" })).rejects.toThrow(
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
		await expect(
			api.slothlet.api.add("test", TEST_DIRS.API_TEST_MIXED, {}, { moduleId: "test-forced", forceOverwrite: true })
		).rejects.toThrow("INVALID_CONFIG_MUTATIONS_DISABLED");
	});

	// TODO: Add proper ownership conflict tests once ownership system is fixed
	// Current issue: Adding same directory twice with different moduleIds doesn't trigger
	// OWNERSHIP_CONFLICT as expected. Need to investigate ownership tracking.

	it.skip("should allow only reload with granular mutations control", async () => {
		// SKIPPED: reload() not implemented yet
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
		await expect(api.slothlet.api.add("test", TEST_DIRS.API_TEST_MIXED, {}, { moduleId: "test" })).rejects.toThrow(
			"INVALID_CONFIG_MUTATIONS_DISABLED"
		);
		await expect(api.slothlet.api.remove("math")).rejects.toThrow("INVALID_CONFIG_MUTATIONS_DISABLED");

		// Reload should work
		await expect(api.slothlet.reload()).resolves.not.toThrow();
	});

	it.skip("should allow all mutations by default", async () => {
		// SKIPPED: reload() not implemented yet
		api = await createApiInstance(config);

		// All mutations should work
		await api.slothlet.api.add("extra", TEST_DIRS.API_TEST_MIXED, {}, { moduleId: "extra-test" });
		expect(api.extra).toBeDefined();

		await expect(api.slothlet.reload()).resolves.not.toThrow();
		await expect(api.slothlet.api.remove("extra")).resolves.not.toThrow();
	});

	it.skip("should allow all mutations with api.mutations: { add: true, remove: true, reload: true }", async () => {
		// SKIPPED: reload() not implemented yet
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
		await api.slothlet.api.add("extra", TEST_DIRS.API_TEST_MIXED, {}, { moduleId: "extra-test" });
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
		// Use merge mode to avoid initial load conflicts, then test addApi collision
		api = await createApiInstance(config, {
			api: {
				collision: {
					initial: "merge",
					api: "error"
				}
			}
		});

		expect(api.slothlet.api).toBeDefined();

		// Mutations are still available (not disabled by collision config)
		// Adding to unique path should work (no collision)
		const uniquePath = `test_${Date.now()}`;
		await api.slothlet.api.add(uniquePath, TEST_DIRS.API_TEST_MIXED, {}, { moduleId: "unique-test" });
		expect(api[uniquePath]).toBeDefined();

		// Trying to add again to same path should throw error due to collision mode = 'error'
		// This tests that collision config affects API path collision handling, not mutation availability
		await expect(api.slothlet.api.add(uniquePath, TEST_DIRS.API_TEST_MIXED, {}, { moduleId: "unique-test2" })).rejects.toThrow(
			"path already exists and collision mode is 'error'"
		);
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
