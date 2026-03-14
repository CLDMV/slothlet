/**
 *	@Project: @cldmv/slothlet
 *	@Filename: /tests/vitests/suites/cjs/cjs-default-exports.test.vitest.mjs
 *	@Date: 2026-01-28T12:05:03-08:00 (1769630703)
 *	@Author: Nate Corcoran <CLDMV>
 *	@Email: <Shinrai@users.noreply.github.com>
 *	-----
 *	@Last modified by: Nate Corcoran <CLDMV> (Shinrai@users.noreply.github.com)
 *	@Last modified time: 2026-03-01 20:21:45 -08:00 (1772425305)
 *	-----
 *	@Copyright: Copyright (c) 2013-2026 Catalyzed Motivation Inc. All rights reserved.
 */

/**
 * @file CJS Default Export Handling Tests
 * @description
 * Tests that CJS modules using `module.exports = { default: obj, namedExport: fn }`
 * behave identically to ESM `export default obj; export { namedExport }`.
 *
 * This ensures Node.js's CJS wrapper pattern (which wraps as { default: { default: obj, named: fn }, named: fn })
 * is correctly normalized so both the default object AND named exports are accessible on the API.
 */

import { describe, it, expect, beforeEach } from "vitest";
import slothlet from "@cldmv/slothlet";
import { getMatrixConfigs, TEST_DIRS } from "../../setup/vitest-helper.mjs";

describe("CJS Default Exports", () => {
	const TEST_MATRIX = getMatrixConfigs();

	TEST_MATRIX.forEach(({ name, config }) => {
		describe(`Config: '${name}'`, () => {
			let api;

			beforeEach(async () => {
				api = await slothlet({
					dir: TEST_DIRS.API_TEST_CJS,
					...config
				});
			});

			it("should expose named exports alongside default object export", async () => {
				// The CJS module has: module.exports = { default: calculator, getCalculatorName: fn }
				// This should behave like: export default calculator; export { getCalculatorName }

				// Check that the default object properties are accessible
				expect(typeof api.explicitDefault.multiply).toBe("function");
				expect(typeof api.explicitDefault.divide).toBe("function");

				// Check that the named export is ALSO accessible
				expect(typeof api.explicitDefault.getCalculatorName).toBe("function");

				// Verify functionality
				const result1 = await api.explicitDefault.multiply(6, 7);
				expect(result1).toBe(42);

				const result2 = await api.explicitDefault.divide(84, 2);
				expect(result2).toBe(42);

				const name = await api.explicitDefault.getCalculatorName();
				expect(name).toBe("Hyphenated Default Calculator");
			});

			it("should not expose extra .default layer in API", async () => {
				// Verify that we DON'T have api.explicitDefault.default
				// (which would happen if the CJS wrapper wasn't normalized)

				// In lazy mode, we need to trigger materialization first
				// Call any function to materialize the module
				await api.explicitDefault.multiply(1, 1);

				expect(api.explicitDefault.default).toBeUndefined();
				expect(api.explicitDefault.default2).toBeUndefined();
			});

			it("should have all three expected properties", async () => {
				// Trigger materialization first in lazy mode
				await api.explicitDefault.multiply(1, 1);

				// Get all enumerable keys
				const keys = Object.keys(api.explicitDefault);

				// In eager mode, keys are on the impl
				// In lazy mode, keys come from ownKeysTrap
				// Both should show all three properties
				expect(keys).toContain("multiply");
				expect(keys).toContain("divide");
				expect(keys).toContain("getCalculatorName");
			});

			it("should work with Object.getOwnPropertyNames", async () => {
				// Trigger materialization first in lazy mode
				await api.explicitDefault.multiply(1, 1);

				const props = Object.getOwnPropertyNames(api.explicitDefault);

				// Should have all three function properties
				expect(props).toContain("multiply");
				expect(props).toContain("divide");
				expect(props).toContain("getCalculatorName");
			});

			it("should allow calling all functions successfully", async () => {
				// Test all three functions work
				const results = await Promise.all([
					api.explicitDefault.multiply(3, 4),
					api.explicitDefault.divide(12, 3),
					api.explicitDefault.getCalculatorName()
				]);

				expect(results[0]).toBe(12);
				expect(results[1]).toBe(4);
				expect(results[2]).toBe("Hyphenated Default Calculator");
			});

			it("should preserve function names", async () => {
				// Trigger materialization first in lazy mode
				await api.explicitDefault.multiply(1, 1);

				// Verify function names are preserved
				expect(api.explicitDefault.multiply.name).toBe("multiply");
				expect(api.explicitDefault.divide.name).toBe("divide");
				expect(api.explicitDefault.getCalculatorName.name).toBe("getCalculatorName");
			});

			it("should have correct typeof for all properties", async () => {
				// In lazy mode, typeof always returns "function" for proxy wrappers
				// In eager mode, returns actual type
				const multiplyType = typeof api.explicitDefault.multiply;
				const divideType = typeof api.explicitDefault.divide;
				const getNameType = typeof api.explicitDefault.getCalculatorName;

				expect(multiplyType).toBe("function");
				expect(divideType).toBe("function");
				expect(getNameType).toBe("function");
			});

			it("should match behavior of ESM equivalent", async () => {
				// If this were ESM with:
				//   const calculator = { multiply, divide };
				//   export default calculator;
				//   export { getCalculatorName };
				// We would expect all three to be accessible

				const hasDefaultProperties = typeof api.explicitDefault.multiply === "function" && typeof api.explicitDefault.divide === "function";

				const hasNamedExport = typeof api.explicitDefault.getCalculatorName === "function";

				expect(hasDefaultProperties).toBe(true);
				expect(hasNamedExport).toBe(true);
			});
		});
	});
});
