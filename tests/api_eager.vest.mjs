import { describe, test, expect } from "vitest";
import slothletEager from "../src/slothlet.mjs?_slothlet=eager";
import { callNestedFunction, testConfig } from "./test-utils.mjs";

/**
 * Mock MD5 function for testing reference functionality
 * @param {string} input - String to hash
 * @returns {string} Mock MD5 hash
 */
function mockMd5(input) {
	return "mock-md5-hash-" + input.length;
}

// Initialize slothlet at top level instead of in beforeAll
const bound = await slothletEager({
	lazy: false,
	dir: "./api_test",
	api_mode: "function",
	reference: { md5: mockMd5 }
});

// Generate test cases from JSON configuration
const { apiTests } = testConfig.testConfig;

for (const section of apiTests) {
	describe(section.section, () => {
		for (const call of section.calls) {
			test(call.label, async () => {
				const result = await callNestedFunction(bound, call.path, call.args, false);
				expect(result).toBe(call.expected);
			});
		}
	});
}

describe("Additional functions", () => {
	test("md5 reference function", () => {
		expect(typeof bound.md5).toBe("function");
		// Test that reference function is callable and works
		const result = bound.md5("test");
		expect(result).toBe("mock-md5-hash-4"); // "test" has 4 characters
	});

	test("describe function", () => {
		expect(typeof bound.describe).toBe("function");
	});

	test("shutdown function", () => {
		expect(typeof bound.shutdown).toBe("function");
	});
});
