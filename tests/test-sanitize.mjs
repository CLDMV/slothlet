#!/usr/bin/env node

import { sanitizePathName } from "../src/lib/helpers/sanitize.mjs";

console.log("Testing sanitizePathName with pattern matching...\n");

let passCount = 0;
let failCount = 0;

function runTest(description, input, rules, expected, testName) {
	const result = sanitizePathName(input, { rules });
	const passed = result === expected;

	console.log(`\nInput: "${input}"`);
	console.log(`Rule: ${JSON.stringify(rules)} ${description}`);
	console.log("Result:", result);
	console.log(`Expected: "${expected}"`);
	console.log("Match:", passed ? "✅ PASS" : "❌ FAIL");

	if (passed) {
		passCount++;
	} else {
		failCount++;
		console.log(`❌ FAILED TEST: ${testName}`);
	}
}

// Test 1: "auto-ip" with "*-ip" pattern (ending with -ip)
runTest("(pattern ending with -ip)", "auto-ip", { upper: ["*-ip"] }, "autoIP", "auto-ip with *-ip pattern");

// Test 2: "auto-ip" with "*ip" pattern (ending with ip)
runTest("(pattern ending with ip)", "auto-ip", { upper: ["*ip"] }, "autoIP", "auto-ip with *ip pattern");

// Test 3: "auto-ip" with "ip" exact match
runTest("(exact segment match)", "auto-ip", { upper: ["ip"] }, "autoIP", "auto-ip with exact ip match");

// Test 3.5: "auto-ip" with "*ip*" pattern (contains ip anywhere)
runTest("(pattern containing ip anywhere)", "auto-ip", { upper: ["*ip*"] }, "autoIP", "auto-ip with *ip* pattern");

// Test 4: "*-ip" should NOT match "get-ip-address" (doesn't end with -ip)
runTest("(pattern ending with -ip)", "get-ip-address", { upper: ["*-ip"] }, "getIpAddress", "get-ip-address should NOT match *-ip");

// Test 5: Exact segment matching for "ip" in "get-ip-address"
runTest("(exact segment match)", "get-ip-address", { upper: ["ip"] }, "getIPAddress", "get-ip-address exact ip match");

// Test 6: "*-ip-*" should match "get-ip-address" (contains -ip-)
runTest("(pattern containing -ip-)", "get-ip-address", { upper: ["*-ip-*"] }, "getIPAddress", "get-ip-address with *-ip-* pattern");

// Test 7: Complex pattern with API
runTest("", "get-api-status", { upper: ["*-api-*"] }, "getAPIStatus", "get-api-status with *-api-* pattern");

// Test 8: Multiple patterns with one match
runTest(
	"(exact match on json, pattern match on *-api)",
	"parse-json-data",
	{ upper: ["json", "*-api"] },
	"parseJSONData",
	"parse-json-data with multiple patterns"
);

console.log("\n=== Testing LOWER rules ===");

// Test 9: lower with exact match
runTest("(exact segment match)", "parse-JSON-data", { lower: ["json"] }, "parsejsonData", "lower rule exact match");

// Test 10: lower with pattern match
runTest("(pattern containing API)", "get-API-status", { lower: ["*-api-*"] }, "getapiStatus", "lower rule pattern match");

console.log("\n=== Testing LEAVE rules ===");

// Test 11: leave with exact match (case-sensitive)
runTest(
	"(case-sensitive exact segment match)",
	"get-XML-parser",
	{ leave: ["XML"] },
	"getXMLParser",
	"leave rule case-sensitive exact match"
);

// Test 11.5: leave should NOT match different case
runTest("(case-sensitive, should NOT match xml)", "get-xml-parser", { leave: ["XML"] }, "getXmlParser", "leave rule case sensitivity test");

console.log("\n=== Testing LEAVEINSENSITIVE rules ===");

// Test 11.7: leaveInsensitive should match different case
runTest(
	"(case-insensitive, should match xml)",
	"get-xml-parser",
	{ leaveInsensitive: ["XML"] },
	"getxmlParser",
	"leaveInsensitive rule case insensitive match"
);

// Test 11.8: leaveInsensitive with pattern
runTest(
	"(case-insensitive pattern)",
	"auto-iot-device",
	{ leaveInsensitive: ["*IoT*"] },
	"autoiotDevice",
	"leaveInsensitive rule pattern match"
);

// Test 12: leave with pattern match
runTest("(pattern containing IoT)", "auto-IoT-device", { leave: ["*-IoT-*"] }, "autoIoTDevice", "leave rule pattern match");

console.log("\n=== Testing rule precedence (leave > leaveInsensitive > upper > lower) ===");

// Test 13: Multiple rules - leave should win over leaveInsensitive
runTest(
	"(leave should win)",
	"get-API-data",
	{
		leave: ["API"],
		leaveInsensitive: ["api"],
		upper: ["API"],
		lower: ["API"]
	},
	"getAPIData",
	"rule precedence - leave wins"
);

// Test 13.5: leaveInsensitive should win over upper/lower
runTest(
	"(leaveInsensitive should win)",
	"get-api-data",
	{
		leaveInsensitive: ["API"],
		upper: ["api"],
		lower: ["api"]
	},
	"getapiData",
	"rule precedence - leaveInsensitive wins"
);

// Test 14: upper vs lower - upper should win
runTest(
	"(upper should win)",
	"get-json-data",
	{
		upper: ["json"],
		lower: ["json"]
	},
	"getJSONData",
	"rule precedence - upper wins over lower"
);

console.log("\n=== Testing within-segment pattern transformations ===");

// Test 15: Within-segment URL pattern transformations
runTest("(within camelCase segment)", "buildUrlWithParams", { upper: ["*URL*"] }, "buildURLWithParams", "within-segment URL transformation");

// Test 16: Within-segment pattern on simple camelCase
runTest("(within simple camelCase)", "parseUrl", { upper: ["*URL*"] }, "parseURL", "simple camelCase URL transformation");

// Test 17: Within-segment pattern on complex camelCase
runTest("(within complex camelCase)", "validateUrlString", { upper: ["*URL*"] }, "validateURLString", "complex camelCase URL transformation");

// Test 18: Within-segment pattern should still work on standalone words
runTest("(standalone word)", "url", { upper: ["*URL*"] }, "URL", "standalone URL transformation");

// Test 19: Within-segment pattern with multiple occurrences
runTest("(multiple URL occurrences)", "parseUrlFromUrlString", { upper: ["*URL*"] }, "parseURLFromURLString", "multiple URL transformations");

// === Boundary-Requiring Pattern Tests (**STRING**) ===
console.log("\n--- Boundary-Requiring Pattern Tests (**STRING**) ---");

// Test 20: **url** should match "url" only when surrounded by other characters
runTest("(boundary-requiring surrounded)", "buildUrlWithParams", { upper: ["**url**"] }, "buildURLWithParams", "buildUrlWithParams with **url** boundary pattern");

// Test 21: **url** should NOT match standalone "url" (no surrounding characters)
runTest("(boundary-requiring standalone)", "url", { upper: ["**url**"] }, "url", "standalone url should NOT match **url** pattern");

// Test 22: **json** boundary-requiring pattern
runTest("(boundary-requiring json)", "parseJsonData", { upper: ["**json**"] }, "parseJSONData", "parseJsonData with **json** boundary pattern");

// Test 23: **json** should NOT match standalone "json"
runTest("(boundary-requiring standalone json)", "json", { upper: ["**json**"] }, "json", "standalone json should NOT match **json** pattern");

// Test 24: **api** boundary-requiring pattern in middle of word
runTest("(boundary-requiring api)", "getApiStatus", { upper: ["**api**"] }, "getAPIStatus", "getApiStatus with **api** boundary pattern");

// Test 25: **api** should NOT match standalone "api"
runTest("(boundary-requiring standalone api)", "api", { upper: ["**api**"] }, "api", "standalone api should NOT match **api** pattern");

// Test 26: Multiple boundary-requiring patterns
runTest("(multiple boundary patterns)", "buildApiUrlParser", { upper: ["**api**", "**url**"] }, "buildAPIURLParser", "multiple boundary patterns on same string");

// Final results
console.log(`\n=== Test Results ===`);
console.log(`✅ Passed: ${passCount}`);
console.log(`❌ Failed: ${failCount}`);
console.log(`📊 Total: ${passCount + failCount}`);

if (failCount > 0) {
	console.log(`\n❌ ${failCount} test(s) failed!`);
	process.exit(1);
} else {
	console.log("\n✅ All tests passed!");
	process.exit(0);
}
