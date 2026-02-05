/**
 *	@Project: @cldmv/slothlet
 *	@Filename: /tests/test-sanitize-v3.mjs
 *	@Date: 2026-01-16T21:11:21-08:00 (1768626681)
 *	@Author: Nate Hyson <CLDMV>
 *	@Email: <Shinrai@users.noreply.github.com>
 *	-----
 *	@Last modified by: Nate Hyson <CLDMV> (Shinrai@users.noreply.github.com)
 *	@Last modified time: 2026-02-04 20:39:43 -08:00 (1770266383)
 *	-----
 *	@Copyright: Copyright (c) 2013-2026 Catalyzed Motivation Inc. All rights reserved.
 */

/**
 * Test suite for sanitizePropertyName - V2 compatibility verification
 */

import { sanitizePropertyName } from "../src/lib/helpers/sanitize.mjs";

console.log("=".repeat(80));
console.log("V3 Sanitization Engine - V2 Compatibility Tests");
console.log("=".repeat(80));
console.log("");

const tests = [
	{
		name: "Basic camelCase conversion",
		tests: [
			{ input: "auto-ip", expected: "autoIp", opts: {} },
			{ input: "root-math", expected: "rootMath", opts: {} },
			{ input: "my_module", expected: "my_module", opts: {} }, // V2 preserves underscores
			{ input: "get-api-status", expected: "getApiStatus", opts: {} }
		]
	},
	{
		name: "Rule: upper with glob patterns",
		tests: [
			{ input: "auto-ip", expected: "autoIP", opts: { rules: { upper: ["*-ip"] } } },
			{ input: "get-api-status", expected: "getAPIStatus", opts: { rules: { upper: ["*-api-*"] } } },
			{ input: "parse-json-data", expected: "parseJSONData", opts: { rules: { upper: ["*-json-*"] } } }
		]
	},
	{
		name: "Rule: upper with exact matches",
		tests: [
			{ input: "get-http-status", expected: "getHTTPStatus", opts: { rules: { upper: ["http"] } } },
			{ input: "parse-xml", expected: "parseXML", opts: { rules: { upper: ["xml"] } } }
		]
	},
	{
		name: "Rule: **STRING** boundary-requiring patterns",
		tests: [
			{ input: "parseJsonData", expected: "parseJSONData", opts: { rules: { upper: ["**json**"] } } },
			{ input: "buildUrlWithParams", expected: "buildURLWithParams", opts: { rules: { upper: ["**url**"] } } },
			{ input: "json", expected: "json", opts: { rules: { upper: ["**json**"] } } }, // No surrounding chars
			{ input: "url", expected: "url", opts: { rules: { upper: ["**url**"] } } } // No surrounding chars
		]
	},
	{
		name: "Rule: leave (case-sensitive preservation)",
		tests: [
			{ input: "autoIP", expected: "autoIP", opts: { rules: { leave: ["autoIP"] } } },
			{ input: "parseJSON", expected: "parseJSON", opts: { rules: { leave: ["parseJSON"] } } }
		]
	},
	{
		name: "Rule: leaveInsensitive (case-insensitive preservation)",
		tests: [
			{ input: "autoIP", expected: "autoIP", opts: { rules: { leaveInsensitive: ["autoip"] } } },
			{ input: "AutoIP", expected: "AutoIP", opts: { rules: { leaveInsensitive: ["autoip"] } } }
		]
	},
	{
		name: "Option: preserveAllUpper",
		tests: [
			{ input: "COMMON_APPS", expected: "COMMON_APPS", opts: { preserveAllUpper: true } },
			{ input: "HTTP_STATUS", expected: "HTTP_STATUS", opts: { preserveAllUpper: true } },
			{ input: "Mixed_APPS", expected: "mixed_APPS", opts: { preserveAllUpper: true } } // V2 behavior: only checks if ENTIRE string is all-upper (it's not, so "Mixed" gets lowercased)
		]
	},
	{
		name: "Option: preserveAllLower",
		tests: [
			{ input: "common_apps", expected: "common_apps", opts: { preserveAllLower: true } },
			{ input: "http_status", expected: "http_status", opts: { preserveAllLower: true } },
			{ input: "Mixed_apps", expected: "mixed_apps", opts: { preserveAllLower: true } } // V2: mixed becomes segment, apps preserved as all-lower
		]
	},
	{
		name: "Option: lowerFirst",
		tests: [
			{ input: "MyModule", expected: "myModule", opts: { lowerFirst: true } },
			{ input: "MyModule", expected: "MyModule", opts: { lowerFirst: false } },
			{ input: "parse-json", expected: "parseJson", opts: { lowerFirst: true } },
			{ input: "parse-json", expected: "parseJson", opts: { lowerFirst: false } } // V2 preserves original case
		]
	},
	{
		name: "Edge cases",
		tests: [
			{ input: "2autoIP", expected: "autoIP", opts: {} }, // V2 strips leading numbers
			{ input: "my file!.mjs", expected: "myFileMjs", opts: {} }, // Special chars
			{ input: "foo-bar-baz", expected: "fooBarBaz", opts: {} }, // Multiple segments
			{ input: "___test", expected: "___test", opts: {} }, // Valid identifier preserved
			{ input: "", expected: "_", opts: {} }, // Empty string
			{ input: "   ", expected: "_", opts: {} } // Only whitespace
		]
	},
	{
		name: "Complex multi-rule scenarios",
		tests: [
			{
				input: "get-http-api-status",
				expected: "getHTTPAPIStatus",
				opts: { rules: { upper: ["http", "*-api-*"] } }
			},
			{
				input: "parse-json-xml-data",
				expected: "parseJSONXMLData",
				opts: { rules: { upper: ["json", "xml"] } }
			},
			{
				input: "validate-user-id",
				expected: "validateUserid",
				opts: { rules: { lower: ["*id"] } }
			}
		]
	}
];

let totalTests = 0;
let passedTests = 0;
let failedTests = 0;

tests.forEach((category) => {
	console.log(`\n${category.name}`);
	console.log("-".repeat(80));

	category.tests.forEach((test) => {
		totalTests++;
		const result = sanitizePropertyName(test.input, test.opts);
		const passed = result === test.expected;

		if (passed) {
			passedTests++;
			console.log(`✅ "${test.input}" → "${result}"`);
		} else {
			failedTests++;
			console.log(`❌ "${test.input}"`);
			console.log(`   Expected: "${test.expected}"`);
			console.log(`   Got:      "${result}"`);
			if (test.opts && Object.keys(test.opts).length > 0) {
				console.log(`   Options:  ${JSON.stringify(test.opts)}`);
			}
		}
	});
});

console.log("");
console.log("=".repeat(80));
console.log("Summary");
console.log("=".repeat(80));
console.log(`Total tests:  ${totalTests}`);
console.log(`Passed:       ${passedTests} ✅`);
console.log(`Failed:       ${failedTests} ${failedTests > 0 ? "❌" : ""}`);
console.log(`Success rate: ${((passedTests / totalTests) * 100).toFixed(1)}%`);
console.log("");

if (failedTests === 0) {
	console.log("🎉 All tests passed! V3 sanitization maintains V2 compatibility.");
} else {
	console.log("⚠️  Some tests failed. Review implementation for V2 compatibility issues.");
	process.exit(1);
}
