#!/usr/bin/env node

/**
 * Test script to verify the normalizeMemberof deduplication functionality
 */

import { fileURLToPath } from "url";
import { dirname, join } from "path";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Import the helpers
const helpers = await import(join(__dirname, "docs/helpers.cjs"));
const functions = helpers.default;

// Test cases for the normalizeMemberof function
const testCases = [
	{
		input: "api_test.exportDefault.exportDefault",
		expected: "api_test.exportDefault",
		description: "Should remove duplicate end segments"
	},
	{
		input: "module:api_test.math.math",
		expected: "api_test.math",
		description: "Should remove module prefix and duplicate segments"
	},
	{
		input: "api_test.advanced.nest",
		expected: "api_test.advanced.nest",
		description: "Should not change when no duplicates"
	},
	{
		input: "module:api_test",
		expected: "module:api_test",
		doclet: { kind: "module" },
		description: "Should keep module prefix for module kind"
	},
	{
		input: "api_test.util.util.util",
		expected: "api_test.util.util",
		description: "Should only remove one duplicate (last two segments)"
	}
];

console.log("Testing normalizeMemberof function with deduplication...\n");

testCases.forEach((testCase, index) => {
	const result = functions.normalizeMemberof(testCase.input, testCase.doclet);
	const passed = result === testCase.expected;

	console.log(`Test ${index + 1}: ${passed ? "✅ PASS" : "❌ FAIL"}`);
	console.log(`  Description: ${testCase.description}`);
	console.log(`  Input: "${testCase.input}"`);
	console.log(`  Expected: "${testCase.expected}"`);
	console.log(`  Actual: "${result}"`);
	if (!passed) {
		console.log(`  🚨 MISMATCH!`);
	}
	console.log("");
});

console.log("Test completed.");
