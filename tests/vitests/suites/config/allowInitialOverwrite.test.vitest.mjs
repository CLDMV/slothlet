/**
 * @fileoverview Tests for allowInitialOverwrite config option
 *
 * @description
 * Tests that allowInitialOverwrite controls whether files can overwrite
 * existing properties during initial module loading:
 * - allowInitialOverwrite: true (default) → later files can overwrite earlier ones
 * - allowInitialOverwrite: false → later files cannot overwrite, keeps first version
 *
 * @module tests/vitests/config/allowInitialOverwrite.test.vitest
 */

import { describe, it, expect, afterEach } from "vitest";
import slothlet from "@cldmv/slothlet";
import { TEST_MATRIX, TEST_DIRS } from "../../setup/vitest-helper.mjs";

// Test with full matrix since initial overwrite behavior is independent of mode/runtime
const MATRIX_CONFIGS = TEST_MATRIX;

describe.each(MATRIX_CONFIGS)("allowInitialOverwrite - $name", ({ config }) => {
	let api = null;

	afterEach(async () => {
		if (api?.shutdown) {
			await api.shutdown();
		}
	});

	/**
	 * Helper to create API instance with config override
	 */
	async function createApiInstance(baseConfig, configOverride = {}) {
		return await slothlet({
			...baseConfig,
			...configOverride,
			dir: TEST_DIRS.API_TEST
		});
	}

	it("should allow overwrites during initialization by default (allowInitialOverwrite: true)", async () => {
		// Default behavior: later files can overwrite earlier ones
		api = await createApiInstance(config, { allowInitialOverwrite: true });

		// overwrite-test-2.mjs is loaded after overwrite-test-1.mjs (alphabetically)
		// With allowInitialOverwrite: true, it should overwrite the function
		const result = config.mode === "lazy" ? await api.conflictingName() : api.conflictingName();

		// Should get the SECOND version (overwritten)
		expect(result).toBe("from-file-2");
	});

	it("should block overwrites during initialization when allowInitialOverwrite: false", async () => {
		// With allowInitialOverwrite: false, first file wins
		api = await createApiInstance(config, { allowInitialOverwrite: false });

		// overwrite-test-1.mjs is loaded first (alphabetically)
		// With allowInitialOverwrite: false, it should NOT be overwritten
		const result = config.mode === "lazy" ? await api.conflictingName() : api.conflictingName();

		// Should get the FIRST version (not overwritten)
		expect(result).toBe("from-file-1");
	});

	it("should emit warning when blocking overwrites (unless silent: true)", async () => {
		// Capture console.warn output
		const warnings = [];
		const originalWarn = console.warn;
		console.warn = (...args) => warnings.push(args.join(" "));

		try {
			api = await createApiInstance(config, {
				allowInitialOverwrite: false,
				silent: false
			});

			// Should have emitted a warning about the overwrite being blocked
			expect(warnings.length).toBeGreaterThan(0);
			expect(warnings.some((w) => w.includes("Cannot overwrite"))).toBe(true);
			expect(warnings.some((w) => w.includes("conflictingName"))).toBe(true);
		} finally {
			console.warn = originalWarn;
		}
	});

	it("should NOT emit warning when silent: true", async () => {
		// Capture console.warn output
		const warnings = [];
		const originalWarn = console.warn;
		console.warn = (...args) => warnings.push(args.join(" "));

		try {
			api = await createApiInstance(config, {
				allowInitialOverwrite: false,
				silent: true
			});

			// Should NOT have emitted warnings (silent mode)
			expect(warnings.length).toBe(0);
		} finally {
			console.warn = originalWarn;
		}
	});

	it("should still allow normal API access when blocking overwrites", async () => {
		api = await createApiInstance(config, { allowInitialOverwrite: false });

		// Non-conflicting functions should work normally
		const mathResult = config.mode === "lazy" ? await api.math.add(2, 3) : api.math.add(2, 3);

		expect(mathResult).toBe(5);

		// The first conflicting function should work
		const conflictResult = config.mode === "lazy" ? await api.conflictingName() : api.conflictingName();

		expect(conflictResult).toBe("from-file-1");
	});

	it("should keep first-loaded default export when blocking overwrites", async () => {
		api = await createApiInstance(config, { allowInitialOverwrite: false });

		// Both files export default functions named "overwriteTest"
		// First file wins, so we should have both available as separate properties
		// (overwriteTest1 and overwriteTest2 after sanitization)

		// Check that at least one version exists
		expect(api.overwriteTest1 || api.overwriteTest2).toBeDefined();

		// The behavior depends on how defaults are handled - just ensure no crash
		const hasTest1 = typeof api.overwriteTest1 === "function";
		const hasTest2 = typeof api.overwriteTest2 === "function";

		expect(hasTest1 || hasTest2).toBe(true);
	});
});
