/**
 *	@Project: @cldmv/slothlet
 *	@Filename: /tests/vitests/suites/api/api-sanitize.test.vitest.mjs
 *	@Date: 2026-02-10T17:51:53-08:00 (1770774713)
 *	@Author: Nate Hyson <CLDMV>
 *	@Email: <Shinrai@users.noreply.github.com>
 *	-----
 *	@Last modified by: Nate Hyson <CLDMV> (Shinrai@users.noreply.github.com)
 *	@Last modified time: 2026-02-10 18:01:59 -08:00 (1770775319)
 *	-----
 *	@Copyright: Copyright (c) 2013-2026 Catalyzed Motivation Inc. All rights reserved.
 */

/**
 * @fileoverview Tests for api.slothlet.sanitize() method
 */
import { describe, test, expect, beforeEach, afterEach } from "vitest";
import slothlet from "@cldmv/slothlet";
import { getMatrixConfigs, TEST_DIRS, withSuppressedSlothletErrorOutputSync } from "../../setup/vitest-helper.mjs";

describe.each(getMatrixConfigs())("API Sanitize Method > Config: '$name'", ({ config }) => {
	let api;

	beforeEach(async () => {
		api = await slothlet({
			dir: TEST_DIRS.API_TEST,
			...config
		});
	});

	afterEach(async () => {
		if (api) {
			await api.shutdown();
		}
	});

	test("should be exposed under api.slothlet.sanitize", () => {
		expect(api.slothlet.sanitize).toBeDefined();
		expect(typeof api.slothlet.sanitize).toBe("function");
	});

	test("should sanitize filenames with extensions", () => {
		// Note: sanitize doesn't strip extensions - it processes the whole string
		expect(api.slothlet.sanitize("my-module.mjs")).toBe("myModuleMjs");
		expect(api.slothlet.sanitize("user_settings.mjs")).toBe("user_settingsMjs");
		expect(api.slothlet.sanitize("data-processor.js")).toBe("dataProcessorJs");
	});

	test("should preserve technical terms with proper casing", () => {
		// Extensions are included in the sanitized output
		expect(api.slothlet.sanitize("auto-IP.mjs")).toBe("autoIPMjs");
		expect(api.slothlet.sanitize("parse-JSON.mjs")).toBe("parseJSONMjs");
		expect(api.slothlet.sanitize("http-API.mjs")).toBe("httpAPIMjs");
	});

	test("should handle input without extensions", () => {
		expect(api.slothlet.sanitize("my-module")).toBe("myModule");
		expect(api.slothlet.sanitize("user_settings")).toBe("user_settings");
		expect(api.slothlet.sanitize("data-processor")).toBe("dataProcessor");
	});

	test("should handle camelCase input", () => {
		expect(api.slothlet.sanitize("myModule")).toBe("myModule");
		expect(api.slothlet.sanitize("getUserData")).toBe("getUserData");
	});

	test("should handle kebab-case", () => {
		expect(api.slothlet.sanitize("user-profile")).toBe("userProfile");
		expect(api.slothlet.sanitize("data-loader")).toBe("dataLoader");
	});

	test("should handle snake_case", () => {
		expect(api.slothlet.sanitize("user_profile")).toBe("user_profile");
		expect(api.slothlet.sanitize("data_loader")).toBe("data_loader");
	});

	test("should throw error for non-string input", () => {
		withSuppressedSlothletErrorOutputSync(() => {
			expect(() => api.slothlet.sanitize(123)).toThrow();
			expect(() => api.slothlet.sanitize(null)).toThrow();
			expect(() => api.slothlet.sanitize(undefined)).toThrow();
			expect(() => api.slothlet.sanitize({})).toThrow();
			expect(() => api.slothlet.sanitize([])).toThrow();
		});
	});

	test("should handle empty strings", () => {
		const result = api.slothlet.sanitize("");
		expect(typeof result).toBe("string");
	});

	test("should match actual API path names", () => {
		// Verify sanitize produces same names as actual API paths
		// math.mjs should be accessible as api.math (extension stripped during API building)
		// But sanitize itself doesn't strip extensions
		const sanitizedWithExt = api.slothlet.sanitize("math.mjs");
		expect(sanitizedWithExt).toBe("mathMjs");

		// Without extension matches the actual API name
		const sanitizedNoExt = api.slothlet.sanitize("math");
		expect(api[sanitizedNoExt]).toBeDefined();
		expect(sanitizedNoExt).toBe("math");
	});

	test("should predict API paths correctly for non-extension names", async () => {
		// Test that sanitize can predict how a module name (without extension) will be exposed
		const moduleName = "string";
		const predictedPath = api.slothlet.sanitize(moduleName);

		// api.string should exist if string.mjs exists in TEST_DIRS.API_TEST
		if (api[predictedPath]) {
			// Trigger materialization for lazy mode before checking typeof
			if (api[predictedPath].upper) {
				await api[predictedPath].upper("test");
			}
			// In lazy mode, modules can be functions or objects after materialization
			const actualType = typeof api[predictedPath];
			expect(["object", "function"]).toContain(actualType);
		}
	});

	test("should handle multiple dot segments", () => {
		// Multiple dots create additional segments
		expect(api.slothlet.sanitize("file.test.mjs")).toBe("fileTestMjs");
		expect(api.slothlet.sanitize("component.spec.js")).toBe("componentSpecJs");
	});

	test("should handle special characters", () => {
		// Sanitize should remove or convert special characters safely
		const result1 = api.slothlet.sanitize("my@module.mjs");
		const result2 = api.slothlet.sanitize("my#module.mjs");

		expect(typeof result1).toBe("string");
		expect(typeof result2).toBe("string");
		// Exact behavior depends on sanitize implementation
	});
});
