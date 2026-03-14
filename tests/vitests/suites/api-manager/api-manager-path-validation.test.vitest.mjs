/**
 *	@Project: @cldmv/slothlet
 *	@Filename: /tests/vitests/suites/api-manager/api-manager-path-validation.test.vitest.mjs
 *	@Date: 2026-02-26T06:59:00-08:00 (1772117940)
 *	@Author: Nate Corcoran <CLDMV>
 *	@Email: <Shinrai@users.noreply.github.com>
 *	-----
 *	@Last modified by: Nate Corcoran <CLDMV> (Shinrai@users.noreply.github.com)
 *	@Last modified time: 2026-03-01 20:21:43 -08:00 (1772425303)
 *	-----
 *	@Copyright: Copyright (c) 2013-2026 Catalyzed Motivation Inc. All rights reserved.
 */

/**
 * @fileoverview Coverage tests for api-manager normalizeApiPath validation branches.
 *
 * @description
 * Tests the uncovered branches in `normalizeApiPath` (api-manager.mjs lines 118-186):
 * - Array path input: converted to dot-separated string
 * - Empty array: treated as root path
 * - Non-string element in array: throws INVALID_CONFIG_API_PATH_INVALID
 * - Empty-string element in array: throws INVALID_CONFIG_API_PATH_INVALID
 * - Reserved name as first array element ("slothlet"): throws INVALID_CONFIG_API_PATH_INVALID
 * - Non-string, non-array type (e.g., number): throws INVALID_CONFIG_API_PATH_INVALID
 *
 * All tests go through `api.slothlet.api.add` which internally calls normalizeApiPath.
 *
 * @module tests/vitests/suites/api-manager/api-manager-path-validation.test.vitest
 */

process.env.SLOTHLET_INTERNAL_TEST_MODE = "true";

import { describe, it, expect, afterEach } from "vitest";
import slothlet from "@cldmv/slothlet";
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

describe.each(getMatrixConfigs())("API Manager Path Validation (normalizeApiPath) > Config: '$name'", ({ config }) => {
	let api;

	afterEach(async () => {
		if (api?.shutdown) {
			await api.shutdown();
		}
		api = null;
	});

	// ─── Array path support ──────────────────────────────────────────────────

	it("should accept an array as an API path and mount the API correctly", async () => {
		api = await createApiInstance(config, { dir: TEST_DIRS.API_TEST });
		await api.slothlet.api.add(["myns", "sub"], TEST_DIRS.API_TEST_MIXED);

		// The array ["myns", "sub"] should resolve to path "myns.sub"
		expect(api.myns).toBeDefined();
		expect(api.myns.sub).toBeDefined();
		expect(typeof api.myns.sub.mathEsm?.add).toBe("function");
	});

	it("should treat an empty array as the root path (same as empty string)", async () => {
		api = await createApiInstance(config, { dir: TEST_DIRS.API_TEST });
		// Empty array → root path → should succeed without error (resolves to a module ID string)
		await expect(api.slothlet.api.add([], TEST_DIRS.API_TEST_MIXED)).resolves.toBeDefined();
	});

	// ─── Invalid array element: non-string ──────────────────────────────────

	it("should reject an array containing a non-string element (number)", async () => {
		api = await createApiInstance(config, { dir: TEST_DIRS.API_TEST });
		await withSuppressedSlothletErrorOutput(async () => {
			await expect(api.slothlet.api.add([42, "sub"], TEST_DIRS.API_TEST_MIXED)).rejects.toThrow("INVALID_CONFIG_API_PATH_INVALID");
		});
	});

	it("should reject an array containing a non-string element (object)", async () => {
		api = await createApiInstance(config, { dir: TEST_DIRS.API_TEST });
		await withSuppressedSlothletErrorOutput(async () => {
			await expect(api.slothlet.api.add([{}, "sub"], TEST_DIRS.API_TEST_MIXED)).rejects.toThrow("INVALID_CONFIG_API_PATH_INVALID");
		});
	});

	// ─── Invalid array element: empty string ────────────────────────────────

	it("should reject an array containing an empty string element", async () => {
		api = await createApiInstance(config, { dir: TEST_DIRS.API_TEST });
		await withSuppressedSlothletErrorOutput(async () => {
			await expect(api.slothlet.api.add(["", "sub"], TEST_DIRS.API_TEST_MIXED)).rejects.toThrow("INVALID_CONFIG_API_PATH_INVALID");
		});
	});

	it("should reject an array containing a whitespace-only string element", async () => {
		api = await createApiInstance(config, { dir: TEST_DIRS.API_TEST });
		await withSuppressedSlothletErrorOutput(async () => {
			await expect(api.slothlet.api.add(["   ", "sub"], TEST_DIRS.API_TEST_MIXED)).rejects.toThrow("INVALID_CONFIG_API_PATH_INVALID");
		});
	});

	// ─── Reserved names ──────────────────────────────────────────────────────

	it("should reject an array whose first element is the reserved name 'slothlet'", async () => {
		api = await createApiInstance(config, { dir: TEST_DIRS.API_TEST });
		await withSuppressedSlothletErrorOutput(async () => {
			await expect(api.slothlet.api.add(["slothlet", "sub"], TEST_DIRS.API_TEST_MIXED)).rejects.toThrow("INVALID_CONFIG_API_PATH_INVALID");
		});
	});

	it("should reject a single-element array with the reserved name 'shutdown'", async () => {
		api = await createApiInstance(config, { dir: TEST_DIRS.API_TEST });
		await withSuppressedSlothletErrorOutput(async () => {
			await expect(api.slothlet.api.add(["shutdown"], TEST_DIRS.API_TEST_MIXED)).rejects.toThrow("INVALID_CONFIG_API_PATH_INVALID");
		});
	});

	it("should reject a single-element array with the reserved name 'destroy'", async () => {
		api = await createApiInstance(config, { dir: TEST_DIRS.API_TEST });
		await withSuppressedSlothletErrorOutput(async () => {
			await expect(api.slothlet.api.add(["destroy"], TEST_DIRS.API_TEST_MIXED)).rejects.toThrow("INVALID_CONFIG_API_PATH_INVALID");
		});
	});

	// ─── Non-string, non-array type ──────────────────────────────────────────

	it("should reject a numeric path argument", async () => {
		api = await createApiInstance(config, { dir: TEST_DIRS.API_TEST });
		await withSuppressedSlothletErrorOutput(async () => {
			await expect(api.slothlet.api.add(42, TEST_DIRS.API_TEST_MIXED)).rejects.toThrow("INVALID_CONFIG_API_PATH_INVALID");
		});
	});

	it("should reject a boolean path argument", async () => {
		api = await createApiInstance(config, { dir: TEST_DIRS.API_TEST });
		await withSuppressedSlothletErrorOutput(async () => {
			await expect(api.slothlet.api.add(true, TEST_DIRS.API_TEST_MIXED)).rejects.toThrow("INVALID_CONFIG_API_PATH_INVALID");
		});
	});

	it("should reject an object path argument", async () => {
		api = await createApiInstance(config, { dir: TEST_DIRS.API_TEST });
		await withSuppressedSlothletErrorOutput(async () => {
			await expect(api.slothlet.api.add({ path: "test" }, TEST_DIRS.API_TEST_MIXED)).rejects.toThrow("INVALID_CONFIG_API_PATH_INVALID");
		});
	});
});
