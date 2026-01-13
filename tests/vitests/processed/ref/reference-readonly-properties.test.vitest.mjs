/**
 * @Project: @cldmv/slothlet
 * @Filename: /tests/vitests/processed/reference/reference-readonly-properties.test.vitest.mjs
 * @Date: 2025-01-11 (Migrated from node:test)
 * @Author: Nate Hyson <CLDMV>
 * @Email: <Shinrai@users.noreply.github.com>
 * -----
 * @Copyright: Copyright (c) 2013-2025 Catalyzed Motivation Inc. All rights reserved.
 */

/**
 * Test for reference object with read-only property assignment
 * Tests the fix for TypeError when reference object contains read-only properties like 'name'
 */

import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { getMatrixConfigs, TEST_DIRS } from "../../setup/vitest-helper.mjs";

describe.each(getMatrixConfigs())("Reference Readonly Properties > Config: '$name'", ({ config }) => {
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

	it("should handle reference with 'name' property without TypeError", async () => {
		api = await slothlet({
			...config,
			dir: TEST_DIRS.API_TV_TEST,
				reference: {
					version: "2.5.6",
					name: "test-package" // This used to cause TypeError: Cannot assign to read only property 'name'
				}
			});

			expect(api).toBeDefined();
			expect(api.version).toBe("2.5.6");
			expect(api.name).toBe("test-package");
		});

	it("should handle reference with multiple potentially problematic properties", async () => {
		api = await slothlet({
			...config,
			dir: TEST_DIRS.API_TV_TEST,
				reference: {
					version: "1.0.0",
					name: "another-package",
					author: "test-author",
					description: "test description",
					length: 42, // Another potentially problematic property
					prototype: { custom: "value" } // Another potentially problematic property
				}
			});

			expect(api).toBeDefined();
			expect(api.version).toBe("1.0.0");
			expect(api.name).toBe("another-package");
			expect(api.author).toBe("test-author");
			expect(api.description).toBe("test description");
			expect(api.length).toBe(42);
			expect(api.prototype).toEqual({ custom: "value" });
		});

	it("should not throw TypeError for any read-only property names", async () => {
		// This test verifies that the fix prevents TypeErrors
		api = await slothlet({
			...config,
			dir: TEST_DIRS.API_TV_TEST,
			reference: {
				name: "test",
				length: 10,
				prototype: {},
				constructor: "custom-constructor",
				caller: "custom-caller",
				arguments: "custom-arguments"
			}
		});
		expect(api).toBeDefined();
	});

	it("should preserve reference properties alongside API methods", async () => {
		api = await slothlet({
			...config,
			dir: TEST_DIRS.API_TV_TEST,
			reference: {
				version: "1.0.0",
				name: "test-package"
			}
		});

		// Check reference properties exist
		expect(api.version).toBe("1.0.0");
		expect(api.name).toBe("test-package");

		// Check API structure is still intact
		expect(api.devices).toBeDefined();
		expect(api.devices.lg).toBeDefined();
	});
});
