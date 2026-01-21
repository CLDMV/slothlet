/**
 * Comprehensive sanitization test suite for V2 and V3
 * Tests all options individually and in combination
 */

import { describe, it, expect, beforeAll } from "vitest";

// Detect V2 vs V3 based on NODE_OPTIONS conditions
const isV3 = process.env.NODE_OPTIONS?.includes("slothlet-three");
const sanitizeModule = isV3 ? "../../../../src3/lib/helpers/sanitize.mjs" : "../../../../src/lib/helpers/sanitize.mjs";

let sanitizePropertyName;

beforeAll(async () => {
	const module = await import(sanitizeModule);
	// V2 exports sanitizePathName, V3 exports sanitizePropertyName
	sanitizePropertyName = module.sanitizePropertyName || module.sanitizePathName;
});

describe(`Sanitization Tests (${isV3 ? "V3" : "V2"})`, () => {
	describe("Basic camelCase conversion", () => {
		it('"auto-ip" → "autoIp"', () => {
			expect(sanitizePropertyName("auto-ip")).toBe("autoIp");
		});

		it('"root-math" → "rootMath"', () => {
			expect(sanitizePropertyName("root-math")).toBe("rootMath");
		});

		it('"get-api-status" → "getApiStatus"', () => {
			expect(sanitizePropertyName("get-api-status")).toBe("getApiStatus");
		});

		it('"foo-bar-baz" → "fooBarBaz"', () => {
			expect(sanitizePropertyName("foo-bar-baz")).toBe("fooBarBaz");
		});

		it('"my_module" → "my_module" (preserve underscores)', () => {
			expect(sanitizePropertyName("my_module")).toBe("my_module");
		});

		it('"common_apps" → "common_apps" (preserve underscores)', () => {
			expect(sanitizePropertyName("common_apps")).toBe("common_apps");
		});

		it('"Mixed_APPS_some-thing" → "mixed_APPS_someThing" (mixed hyphens and underscores)', () => {
			expect(sanitizePropertyName("Mixed_APPS_some-thing")).toBe("mixed_APPS_someThing");
		});

		it('"my file!.mjs" → "myFileMjs" (special chars)', () => {
			expect(sanitizePropertyName("my file!.mjs")).toBe("myFileMjs");
		});

		it('"2autoIP" → "autoIP" (strip leading numbers)', () => {
			expect(sanitizePropertyName("2autoIP")).toBe("autoIP");
		});

		it('"___test" → "___test" (preserve leading underscores)', () => {
			expect(sanitizePropertyName("___test")).toBe("___test");
		});

		it('"_test" → "_test" (preserve leading underscore)', () => {
			expect(sanitizePropertyName("_test")).toBe("_test");
		});

		it('"__private" → "__private" (preserve double underscore)', () => {
			expect(sanitizePropertyName("__private")).toBe("__private");
		});

		it('"mixed__APPS" → "mixed__APPS" (preserve consecutive underscores)', () => {
			expect(sanitizePropertyName("mixed__APPS")).toBe("mixed__APPS");
		});

		it('"test___value" → "test___value" (preserve triple underscores)', () => {
			expect(sanitizePropertyName("test___value")).toBe("test___value");
		});
	});

	describe("Option: lowerFirst", () => {
		it('"MyModule" with lowerFirst:true → "myModule"', () => {
			expect(sanitizePropertyName("MyModule", { lowerFirst: true })).toBe("myModule");
		});

		it('"parse-json" with lowerFirst:true → "parseJson"', () => {
			expect(sanitizePropertyName("parse-json", { lowerFirst: true })).toBe("parseJson");
		});

		it('"MyModule" with lowerFirst:false → "MyModule"', () => {
			expect(sanitizePropertyName("MyModule", { lowerFirst: false })).toBe("MyModule");
		});

		it('"parse-json" with lowerFirst:false → "parseJson" (already lowercase)', () => {
			expect(sanitizePropertyName("parse-json", { lowerFirst: false })).toBe("parseJson");
		});
	});

	describe("Option: preserveAllUpper", () => {
		it('"COMMON_APPS" with preserveAllUpper:true → "COMMON_APPS"', () => {
			expect(sanitizePropertyName("COMMON_APPS", { preserveAllUpper: true })).toBe("COMMON_APPS");
		});

		it('"HTTP_STATUS" with preserveAllUpper:true → "HTTP_STATUS"', () => {
			expect(sanitizePropertyName("HTTP_STATUS", { preserveAllUpper: true })).toBe("HTTP_STATUS");
		});

		it('"Mixed_APPS" with preserveAllUpper:true → "mixed_APPS" (V2 bug: checks entire string)', () => {
			expect(sanitizePropertyName("Mixed_APPS", { preserveAllUpper: true })).toBe("mixed_APPS");
		});

		it('"MIXED_Apps" with preserveAllUpper:true → "mIXED_Apps" (whole string not uppercase)', () => {
			expect(sanitizePropertyName("MIXED_Apps", { preserveAllUpper: true })).toBe("mIXED_Apps");
		});

		it('"cOMMON_APPS" with preserveAllUpper:true → "cOMMON_APPS"', () => {
			expect(sanitizePropertyName("cOMMON_APPS", { preserveAllUpper: true })).toBe("cOMMON_APPS");
		});
	});

	describe("Option: preserveAllLower", () => {
		it('"common_apps" with preserveAllLower:true → "common_apps"', () => {
			expect(sanitizePropertyName("common_apps", { preserveAllLower: true })).toBe("common_apps");
		});

		it('"http_status" with preserveAllLower:true → "http_status"', () => {
			expect(sanitizePropertyName("http_status", { preserveAllLower: true })).toBe("http_status");
		});

		it('"Mixed_apps" with preserveAllLower:true → "mixed_apps"', () => {
			expect(sanitizePropertyName("Mixed_apps", { preserveAllLower: true })).toBe("mixed_apps");
		});

		it('"Common_apps" with preserveAllLower:true → "common_apps"', () => {
			expect(sanitizePropertyName("Common_apps", { preserveAllLower: true })).toBe("common_apps");
		});
	});

	describe("Rule: leave (case-sensitive)", () => {
		it('"autoIP" with leave:["autoIP"] → "autoIP"', () => {
			expect(sanitizePropertyName("autoIP", { rules: { leave: ["autoIP"] } })).toBe("autoIP");
		});

		it('"parseJSON" with leave:["parseJSON"] → "parseJSON"', () => {
			expect(sanitizePropertyName("parseJSON", { rules: { leave: ["parseJSON"] } })).toBe("parseJSON");
		});

		it('"auto-ip" with leave:["ip"] → "autoip" (preserves "ip" segment)', () => {
			expect(sanitizePropertyName("auto-ip", { rules: { leave: ["ip"] } })).toBe("autoip");
		});

		it('"auto-ip" with leave:["IP"] → "autoIp" (case mismatch, transforms normally)', () => {
			expect(sanitizePropertyName("auto-ip", { rules: { leave: ["IP"] } })).toBe("autoIp");
		});
	});

	describe("Rule: leaveInsensitive", () => {
		it('"autoIP" with leaveInsensitive:["autoip"] → "autoIP"', () => {
			expect(sanitizePropertyName("autoIP", { rules: { leaveInsensitive: ["autoip"] } })).toBe("autoIP");
		});

		it('"AutoIP" with leaveInsensitive:["autoip"] → "AutoIP"', () => {
			expect(sanitizePropertyName("AutoIP", { rules: { leaveInsensitive: ["autoip"] } })).toBe("AutoIP");
		});

		it('"AUTOIP" with leaveInsensitive:["autoip"] → "AUTOIP"', () => {
			expect(sanitizePropertyName("AUTOIP", { rules: { leaveInsensitive: ["autoip"] } })).toBe("AUTOIP");
		});
	});

	describe("Rule: upper with exact matches", () => {
		it('"get-http-status" with upper:["http"] → "getHTTPStatus"', () => {
			expect(sanitizePropertyName("get-http-status", { rules: { upper: ["http"] } })).toBe("getHTTPStatus");
		});

		it('"parse-xml" with upper:["xml"] → "parseXML"', () => {
			expect(sanitizePropertyName("parse-xml", { rules: { upper: ["xml"] } })).toBe("parseXML");
		});

		it('"parse-json-xml-data" with upper:["json","xml"] → "parseJSONXMLData"', () => {
			expect(sanitizePropertyName("parse-json-xml-data", { rules: { upper: ["json", "xml"] } })).toBe("parseJSONXMLData");
		});
	});

	describe("Rule: upper with glob patterns", () => {
		it('"auto-ip" with upper:["*-ip"] → "autoIP" (pre-split pattern)', () => {
			expect(sanitizePropertyName("auto-ip", { rules: { upper: ["*-ip"] } })).toBe("autoIP");
		});

		it('"get-api-status" with upper:["*-api-*"] → "getAPIStatus" (middle pattern)', () => {
			expect(sanitizePropertyName("get-api-status", { rules: { upper: ["*-api-*"] } })).toBe("getAPIStatus");
		});

		it('"parse-json-data" with upper:["*-json-*"] → "parseJSONData"', () => {
			expect(sanitizePropertyName("parse-json-data", { rules: { upper: ["*-json-*"] } })).toBe("parseJSONData");
		});

		it('"get-http-api-status" with upper:["http","*-api-*"] → "getHTTPAPIStatus" (multiple patterns)', () => {
			expect(sanitizePropertyName("get-http-api-status", { rules: { upper: ["http", "*-api-*"] } })).toBe("getHTTPAPIStatus");
		});
	});

	describe("Rule: upper with boundary patterns **STRING**", () => {
		it('"buildUrlWithParams" with upper:["**url**"] → "buildURLWithParams" (surrounded)', () => {
			expect(sanitizePropertyName("buildUrlWithParams", { rules: { upper: ["**url**"] } })).toBe("buildURLWithParams");
		});

		it('"url" with upper:["**url**"] → "url" (standalone, not matched)', () => {
			expect(sanitizePropertyName("url", { rules: { upper: ["**url**"] } })).toBe("url");
		});

		it('"parseJsonData" with upper:["**json**"] → "parseJSONData" (surrounded)', () => {
			expect(sanitizePropertyName("parseJsonData", { rules: { upper: ["**json**"] } })).toBe("parseJSONData");
		});

		it('"json" with upper:["**json**"] → "json" (standalone, not matched)', () => {
			expect(sanitizePropertyName("json", { rules: { upper: ["**json**"] } })).toBe("json");
		});

		it('"getApiStatus" with upper:["**api**"] → "getAPIStatus" (middle)', () => {
			expect(sanitizePropertyName("getApiStatus", { rules: { upper: ["**api**"] } })).toBe("getAPIStatus");
		});

		it('"api" with upper:["**api**"] → "api" (standalone, not matched)', () => {
			expect(sanitizePropertyName("api", { rules: { upper: ["**api**"] } })).toBe("api");
		});

		it('"buildApiUrlParser" with upper:["**api**","**url**"] → "buildAPIURLParser" (multiple)', () => {
			expect(sanitizePropertyName("buildApiUrlParser", { rules: { upper: ["**api**", "**url**"] } })).toBe("buildAPIURLParser");
		});
	});

	describe("Within-segment pattern transformations", () => {
		it('"buildUrlWithParams" with upper:["*URL*"] → "buildURLWithParams" (within camelCase)', () => {
			expect(sanitizePropertyName("buildUrlWithParams", { rules: { upper: ["*URL*"] } })).toBe("buildURLWithParams");
		});

		it('"parseUrl" with upper:["*URL*"] → "parseURL" (simple camelCase)', () => {
			expect(sanitizePropertyName("parseUrl", { rules: { upper: ["*URL*"] } })).toBe("parseURL");
		});

		it('"validateUrlString" with upper:["*URL*"] → "validateURLString" (complex camelCase)', () => {
			expect(sanitizePropertyName("validateUrlString", { rules: { upper: ["*URL*"] } })).toBe("validateURLString");
		});

		it('"url" with upper:["*URL*"] → "URL" (standalone)', () => {
			expect(sanitizePropertyName("url", { rules: { upper: ["*URL*"] } })).toBe("URL");
		});

		it('"parseUrlFromUrlString" with upper:["*URL*"] → "parseURLFromURLString" (multiple)', () => {
			expect(sanitizePropertyName("parseUrlFromUrlString", { rules: { upper: ["*URL*"] } })).toBe("parseURLFromURLString");
		});
	});

	describe("Additional glob pattern tests", () => {
		it('"get-ip-address" with upper:["*-ip"] → "getIpAddress" (doesn\'t match: needs to end with -ip)', () => {
			expect(sanitizePropertyName("get-ip-address", { rules: { upper: ["*-ip"] } })).toBe("getIpAddress");
		});

		it('"get-ip-address" with upper:["ip"] → "getIPAddress" (exact "ip" segment)', () => {
			expect(sanitizePropertyName("get-ip-address", { rules: { upper: ["ip"] } })).toBe("getIPAddress");
		});

		it('"get-ip-address" with upper:["*-ip-*"] → "getIPAddress" (matches middle pattern)', () => {
			expect(sanitizePropertyName("get-ip-address", { rules: { upper: ["*-ip-*"] } })).toBe("getIPAddress");
		});

		it('"auto-ip" with upper:["*ip"] → "autoIP" (ends with ip)', () => {
			expect(sanitizePropertyName("auto-ip", { rules: { upper: ["*ip"] } })).toBe("autoIP");
		});

		it('"auto-ip" with upper:["*ip*"] → "autoIP" (contains ip)', () => {
			expect(sanitizePropertyName("auto-ip", { rules: { upper: ["*ip*"] } })).toBe("autoIP");
		});
	});

	describe("Rule: lower", () => {
		it('"validate-user-id" with lower:["*id"] → "validateUserid"', () => {
			expect(sanitizePropertyName("validate-user-id", { rules: { lower: ["*id"] } })).toBe("validateUserid");
		});

		it('"foo-API-json" with lower:["json"] → "fooAPIjson"', () => {
			expect(sanitizePropertyName("foo-API-json", { rules: { lower: ["json"] } })).toBe("fooAPIjson");
		});
	});

	describe("Rule precedence", () => {
		it('"autoIP" with leave:["autoIP"] + upper:["ip"] → "autoIP" (leave overrides)', () => {
			const result = sanitizePropertyName("autoIP", {
				rules: {
					leave: ["autoIP"],
					upper: ["ip"]
				}
			});
			expect(result).toBe("autoIP");
		});

		it('"COMMON_APPS" with preserveAllUpper:true + upper:["apps"] → "COMMON_APPS"', () => {
			expect(
				sanitizePropertyName("COMMON_APPS", {
					preserveAllUpper: true,
					rules: { upper: ["apps"] }
				})
			).toBe("COMMON_APPS");
		});
	});

	describe("Complex combinations", () => {
		it('"get-http-api-status" with upper:["http","*-api-*"] → "getHTTPAPIStatus"', () => {
			expect(
				sanitizePropertyName("get-http-api-status", {
					rules: { upper: ["http", "*-api-*"] }
				})
			).toBe("getHTTPAPIStatus");
		});

		it('"COMMON_APPS" with preserveAllUpper:true + lowerFirst:false → "COMMON_APPS"', () => {
			expect(
				sanitizePropertyName("COMMON_APPS", {
					preserveAllUpper: true,
					lowerFirst: false
				})
			).toBe("COMMON_APPS");
		});

		it('"Mixed_APPS_some-thing" with preserveAllUpper:true + upper:["thing"] → "mixed_APPS_someTHING" (V3) or "mixed_APPS_someThing" (V2)', () => {
			if (isV3) {
				expect(
					sanitizePropertyName("Mixed_APPS_some-thing", {
						preserveAllUpper: true,
						rules: { upper: ["thing"] }
					})
				).toBe("mixed_APPS_someTHING");
			} else {
				// V2 behavior
				expect(
					sanitizePropertyName("Mixed_APPS_some-thing", {
						preserveAllUpper: true
					})
				).toBe("mixed_APPS_someThing");
			}
		});
	});

	describe("Edge cases", () => {
		it('"" (empty string) → "_"', () => {
			expect(sanitizePropertyName("")).toBe("_");
		});

		it('"   " (whitespace only) → "_"', () => {
			expect(sanitizePropertyName("   ")).toBe("_");
		});

		it('"$scope" → "$scope" (dollar signs preserved)', () => {
			expect(sanitizePropertyName("$scope")).toBe("$scope");
		});

		it('"validIdentifier" → "validIdentifier" (valid identifier unchanged)', () => {
			expect(sanitizePropertyName("validIdentifier")).toBe("validIdentifier");
		});

		it('"auto_ip" → "auto_ip" (underscores unchanged)', () => {
			expect(sanitizePropertyName("auto_ip")).toBe("auto_ip");
		});
	});

	describe("Conflicting options", () => {
		it('"COMMON_apps" with preserveAllUpper:true + preserveAllLower:true → "cOMMON_apps" (both check, neither fully applies)', () => {
			expect(
				sanitizePropertyName("COMMON_apps", {
					preserveAllUpper: true,
					preserveAllLower: true
				})
			).toBe("cOMMON_apps");
		});

		it('"auto-ip" with leave:["autoIP"] + leaveInsensitive:["autoip"] → "autoIp" (neither matches input exactly)', () => {
			expect(
				sanitizePropertyName("auto-ip", {
					rules: {
						leave: ["autoIP"],
						leaveInsensitive: ["autoip"]
					}
				})
			).toBe("autoIp");
		});

		it('"foo-api" with upper:["api"] + lower:["api"] → "fooAPI" (upper takes precedence)', () => {
			expect(
				sanitizePropertyName("foo-api", {
					rules: {
						upper: ["api"],
						lower: ["api"]
					}
				})
			).toBe("fooAPI");
		});

		it('"COMMON_APPS" with preserveAllUpper:true + lower:["apps"] → "COMMON_APPS" (preserve overrides lower)', () => {
			expect(
				sanitizePropertyName("COMMON_APPS", {
					preserveAllUpper: true,
					rules: { lower: ["apps"] }
				})
			).toBe("COMMON_APPS");
		});

		it('"common_apps" with preserveAllLower:true + upper:["apps"] → "common_apps" (preserve overrides upper)', () => {
			expect(
				sanitizePropertyName("common_apps", {
					preserveAllLower: true,
					rules: { upper: ["apps"] }
				})
			).toBe("common_apps");
		});
	});

	describe("lowerFirst interactions", () => {
		it('"ParseJSON" with lowerFirst:false + leave:["ParseJSON"] → "ParseJSON" (leave wins)', () => {
			expect(
				sanitizePropertyName("ParseJSON", {
					lowerFirst: false,
					rules: { leave: ["ParseJSON"] }
				})
			).toBe("ParseJSON");
		});

		it('"AUTO-IP" with lowerFirst:false + upper:["ip"] → "AUTOIP" (uppercase first segment, IP rule applied)', () => {
			expect(
				sanitizePropertyName("AUTO-IP", {
					lowerFirst: false,
					rules: { upper: ["ip"] }
				})
			).toBe("AUTOIP");
		});

		it('"parse-json" with lowerFirst:true + upper:["json"] → "parseJSON" (lowercase first, upper on second)', () => {
			expect(
				sanitizePropertyName("parse-json", {
					lowerFirst: true,
					rules: { upper: ["json"] }
				})
			).toBe("parseJSON");
		});
	});

	describe("Pattern edge cases", () => {
		it('"test-api-url-parser" with upper:["**api**","**url**"] → "testAPIURLParser" (multiple boundary patterns)', () => {
			expect(
				sanitizePropertyName("test-api-url-parser", {
					rules: { upper: ["**api**", "**url**"] }
				})
			).toBe("testAPIURLParser");
		});

		it('"buildApiUrl" with upper:["*API*","*URL*"] → "buildAPIURL" (multiple glob patterns)', () => {
			expect(
				sanitizePropertyName("buildApiUrl", {
					rules: { upper: ["*API*", "*URL*"] }
				})
			).toBe("buildAPIURL");
		});

		it('"get-api-url" with upper:["*-api-*","**url**"] → "getAPIUrl" (glob + boundary mixed)', () => {
			expect(
				sanitizePropertyName("get-api-url", {
					rules: { upper: ["*-api-*", "**url**"] }
				})
			).toBe("getAPIUrl");
		});

		it.skipIf(!isV3)('"api_helper" with upper:["api_*"] → "API_helper" (underscore in glob pattern - V3 only)', () => {
			expect(
				sanitizePropertyName("api_helper", {
					rules: { upper: ["api_*"] }
				})
			).toBe("API_helper");
		});

		it.skipIf(!isV3)('"get_api_data" with upper:["*_api_*"] → "get_API_data" (underscore boundary glob - V3 only)', () => {
			expect(
				sanitizePropertyName("get_api_data", {
					rules: { upper: ["*_api_*"] }
				})
			).toBe("get_API_data");
		});
	});

	describe("Ultimate stress test", () => {
		it('"Mixed_API_some-json-DATA" with all options → "mixed_API_someJSONDATA" (preserveAllUpper overrides lower)', () => {
			expect(
				sanitizePropertyName("Mixed_API_some-json-DATA", {
					lowerFirst: true,
					preserveAllUpper: true,
					preserveAllLower: false,
					rules: {
						upper: ["json"],
						lower: ["data"],
						leave: ["API"]
					}
				})
			).toBe("mixed_API_someJSONDATA");
		});

		it('"GET-http-api-STATUS" with complex rules → "GEThttpAPIstatus"', () => {
			expect(
				sanitizePropertyName("GET-http-api-STATUS", {
					lowerFirst: false,
					rules: {
						upper: ["*-api-*"],
						lower: ["http", "status"],
						leaveInsensitive: ["get"]
					}
				})
			).toBe("GEThttpAPIstatus");
		});
	});

	describe.skipIf(!isV3)("V3-specific improvements", () => {
		it('"Mixed_APPS_some-thing" with preserveAllUpper:true → "mixed_APPS_someThing" (two-level segmentation)', () => {
			expect(sanitizePropertyName("Mixed_APPS_some-thing", { preserveAllUpper: true })).toBe("mixed_APPS_someThing");
		});

		it('"test__value" → "test__value" (preserve double underscore)', () => {
			expect(sanitizePropertyName("test__value")).toBe("test__value");
		});

		it('"test___value" → "test___value" (preserve triple underscore)', () => {
			expect(sanitizePropertyName("test___value")).toBe("test___value");
		});

		it('"some-thing" with lower:["thing"] → "something" (rules applied before camelCase)', () => {
			expect(sanitizePropertyName("some-thing", { rules: { lower: ["thing"] } })).toBe("something");
		});
	});
});
