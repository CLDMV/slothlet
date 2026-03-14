/**
 *	@Project: @cldmv/slothlet
 *	@Filename: /tests/vitests/suites/sanitization/sanitize.test.vitest.mjs
 *	@Date: 2026-01-12T23:44:38-08:00 (1768290278)
 *	@Author: Nate Corcoran <CLDMV>
 *	@Email: <Shinrai@users.noreply.github.com>
 *	-----
 *	@Last modified by: Nate Corcoran <CLDMV> (Shinrai@users.noreply.github.com)
 *	@Last modified time: 2026-03-01 20:21:55 -08:00 (1772425315)
 *	-----
 *	@Copyright: Copyright (c) 2013-2026 Catalyzed Motivation Inc. All rights reserved.
 */

/**
 * Comprehensive sanitization test suite
 * Tests all options individually and in combination: camelCase, lowerFirst,
 * preserveAllUpper/Lower, leave/leaveInsensitive/upper/lower rules, glob patterns,
 * boundary patterns, within-segment transforms, precedence, and edge cases.
 */

import { describe, it, expect } from "vitest";
import { sanitizePropertyName } from "@cldmv/slothlet/helpers/sanitize";

describe("Sanitization Tests", () => {
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

		it('"Mixed_APPS" with preserveAllUpper:true → "mixed_APPS"', () => {
			expect(sanitizePropertyName("Mixed_APPS", { preserveAllUpper: true })).toBe("mixed_APPS");
		});

		it('"MIXED_Apps" with preserveAllUpper:true → "mIXED_Apps" (whole string not uppercase)', () => {
			expect(sanitizePropertyName("MIXED_Apps", { preserveAllUpper: true })).toBe("mIXED_Apps");
		});

		it('"cOMMON_APPS" with preserveAllUpper:true → "cOMMON_APPS"', () => {
			expect(sanitizePropertyName("cOMMON_APPS", { preserveAllUpper: true })).toBe("cOMMON_APPS");
		});

		it("should work in multi-segment context", () => {
			expect(sanitizePropertyName("parse-XML-data", { preserveAllUpper: true })).toBe("parseXMLData");
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

		it('"parse-xml-data" with preserveAllLower:true → "parsexmldata"', () => {
			expect(sanitizePropertyName("parse-xml-data", { preserveAllLower: true })).toBe("parsexmldata");
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

		it('"get-XML-parser" with leave:["XML"] → "getXMLParser" (case-sensitive match)', () => {
			expect(sanitizePropertyName("get-XML-parser", { rules: { leave: ["XML"] } })).toBe("getXMLParser");
		});

		it('"get-xml-parser" with leave:["XML"] → "getXmlParser" (no match - case mismatch)', () => {
			expect(sanitizePropertyName("get-xml-parser", { rules: { leave: ["XML"] } })).toBe("getXmlParser");
		});

		it('"auto-IoT-device" with leave:["*-IoT-*"] → "autoIoTDevice" (glob pattern)', () => {
			expect(sanitizePropertyName("auto-IoT-device", { rules: { leave: ["*-IoT-*"] } })).toBe("autoIoTDevice");
		});
	});

	describe("Rule: leaveInsensitive (case-insensitive)", () => {
		it('"autoIP" with leaveInsensitive:["autoip"] → "autoIP"', () => {
			expect(sanitizePropertyName("autoIP", { rules: { leaveInsensitive: ["autoip"] } })).toBe("autoIP");
		});

		it('"AutoIP" with leaveInsensitive:["autoip"] → "AutoIP"', () => {
			expect(sanitizePropertyName("AutoIP", { rules: { leaveInsensitive: ["autoip"] } })).toBe("AutoIP");
		});

		it('"AUTOIP" with leaveInsensitive:["autoip"] → "AUTOIP"', () => {
			expect(sanitizePropertyName("AUTOIP", { rules: { leaveInsensitive: ["autoip"] } })).toBe("AUTOIP");
		});

		it('"get-xml-parser" with leaveInsensitive:["XML"] → "getxmlParser"', () => {
			expect(sanitizePropertyName("get-xml-parser", { rules: { leaveInsensitive: ["XML"] } })).toBe("getxmlParser");
		});

		it('"auto-iot-device" with leaveInsensitive:["*IoT*"] → "autoiotDevice" (glob pattern)', () => {
			expect(sanitizePropertyName("auto-iot-device", { rules: { leaveInsensitive: ["*IoT*"] } })).toBe("autoiotDevice");
		});
	});

	describe("Rule: upper - exact matches", () => {
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

	describe("Rule: upper - glob patterns", () => {
		it('"auto-ip" with upper:["*-ip"] → "autoIP" (pre-split pattern)', () => {
			expect(sanitizePropertyName("auto-ip", { rules: { upper: ["*-ip"] } })).toBe("autoIP");
		});

		it('"auto-ip" with upper:["*ip"] → "autoIP"', () => {
			expect(sanitizePropertyName("auto-ip", { rules: { upper: ["*ip"] } })).toBe("autoIP");
		});

		it('"auto-ip" with upper:["*ip*"] → "autoIP"', () => {
			expect(sanitizePropertyName("auto-ip", { rules: { upper: ["*ip*"] } })).toBe("autoIP");
		});

		it('"get-ip-address" with upper:["*-ip"] → "getIpAddress" (does not match - not end)', () => {
			expect(sanitizePropertyName("get-ip-address", { rules: { upper: ["*-ip"] } })).toBe("getIpAddress");
		});

		it('"get-ip-address" with upper:["ip"] → "getIPAddress" (exact segment match)', () => {
			expect(sanitizePropertyName("get-ip-address", { rules: { upper: ["ip"] } })).toBe("getIPAddress");
		});

		it('"get-ip-address" with upper:["*-ip-*"] → "getIPAddress" (middle pattern)', () => {
			expect(sanitizePropertyName("get-ip-address", { rules: { upper: ["*-ip-*"] } })).toBe("getIPAddress");
		});

		it('"get-api-status" with upper:["*-api-*"] → "getAPIStatus"', () => {
			expect(sanitizePropertyName("get-api-status", { rules: { upper: ["*-api-*"] } })).toBe("getAPIStatus");
		});

		it('"parse-json-data" with upper:["*-json-*"] → "parseJSONData"', () => {
			expect(sanitizePropertyName("parse-json-data", { rules: { upper: ["*-json-*"] } })).toBe("parseJSONData");
		});

		it('"get-http-api-status" with upper:["http","*-api-*"] → "getHTTPAPIStatus" (multiple patterns)', () => {
			expect(sanitizePropertyName("get-http-api-status", { rules: { upper: ["http", "*-api-*"] } })).toBe("getHTTPAPIStatus");
		});

		it("should apply multiple patterns with one match", () => {
			expect(sanitizePropertyName("parse-json-data", { rules: { upper: ["json", "*-api"] } })).toBe("parseJSONData");
		});
	});

	describe("Rule: upper - underscore glob patterns", () => {
		it('"api_helper" with upper:["api_*"] → "API_helper"', () => {
			expect(sanitizePropertyName("api_helper", { rules: { upper: ["api_*"] } })).toBe("API_helper");
		});

		it('"get_api_data" with upper:["*_api_*"] → "get_API_data"', () => {
			expect(sanitizePropertyName("get_api_data", { rules: { upper: ["*_api_*"] } })).toBe("get_API_data");
		});
	});

	describe("Rule: upper - boundary patterns (**STRING**)", () => {
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

	describe("Rule: upper - within-segment pattern transformations", () => {
		it('"buildUrlWithParams" with upper:["*URL*"] → "buildURLWithParams"', () => {
			expect(sanitizePropertyName("buildUrlWithParams", { rules: { upper: ["*URL*"] } })).toBe("buildURLWithParams");
		});

		it('"parseUrl" with upper:["*URL*"] → "parseURL"', () => {
			expect(sanitizePropertyName("parseUrl", { rules: { upper: ["*URL*"] } })).toBe("parseURL");
		});

		it('"validateUrlString" with upper:["*URL*"] → "validateURLString"', () => {
			expect(sanitizePropertyName("validateUrlString", { rules: { upper: ["*URL*"] } })).toBe("validateURLString");
		});

		it('"url" with upper:["*URL*"] → "URL" (standalone)', () => {
			expect(sanitizePropertyName("url", { rules: { upper: ["*URL*"] } })).toBe("URL");
		});

		it('"parseUrlFromUrlString" with upper:["*URL*"] → "parseURLFromURLString" (multiple)', () => {
			expect(sanitizePropertyName("parseUrlFromUrlString", { rules: { upper: ["*URL*"] } })).toBe("parseURLFromURLString");
		});
	});

	describe("Rule: lower", () => {
		it('"parse-JSON-data" with lower:["json"] → "parsejsonData" (exact match)', () => {
			expect(sanitizePropertyName("parse-JSON-data", { rules: { lower: ["json"] } })).toBe("parsejsonData");
		});

		it('"get-API-status" with lower:["*-api-*"] → "getapiStatus" (pattern match preserves lowercase)', () => {
			expect(sanitizePropertyName("get-API-status", { rules: { lower: ["*-api-*"] } })).toBe("getapiStatus");
		});

		it('"validate-user-id" with lower:["*id"] → "validateUserid"', () => {
			expect(sanitizePropertyName("validate-user-id", { rules: { lower: ["*id"] } })).toBe("validateUserid");
		});

		it('"foo-API-json" with lower:["json"] → "fooAPIjson"', () => {
			expect(sanitizePropertyName("foo-API-json", { rules: { lower: ["json"] } })).toBe("fooAPIjson");
		});

		it('"some-thing" with lower:["thing"] → "something" (rules applied before camelCase)', () => {
			expect(sanitizePropertyName("some-thing", { rules: { lower: ["thing"] } })).toBe("something");
		});
	});

	describe("Rule precedence", () => {
		it("leave should win over all other rules", () => {
			expect(
				sanitizePropertyName("get-API-data", {
					rules: {
						leave: ["API"],
						leaveInsensitive: ["api"],
						upper: ["API"],
						lower: ["API"]
					}
				})
			).toBe("getAPIData");
		});

		it("leaveInsensitive should win over upper/lower", () => {
			expect(
				sanitizePropertyName("get-api-data", {
					rules: {
						leaveInsensitive: ["API"],
						upper: ["api"],
						lower: ["api"]
					}
				})
			).toBe("getapiData");
		});

		it("preserveAllUpper should win over upper rules", () => {
			expect(
				sanitizePropertyName("XML_DATA", {
					preserveAllUpper: true,
					rules: { upper: ["xml"] }
				})
			).toBe("XML_DATA");
		});

		it("leave should win over preserveAllUpper", () => {
			expect(
				sanitizePropertyName("XML_DATA", {
					preserveAllUpper: true,
					rules: { leave: ["XML_DATA"] }
				})
			).toBe("XML_DATA");
		});

		it("upper should win over lower", () => {
			expect(
				sanitizePropertyName("get-json-data", {
					rules: {
						upper: ["json"],
						lower: ["json"]
					}
				})
			).toBe("getJSONData");
		});

		it('"autoIP" with leave:["autoIP"] + upper:["ip"] → "autoIP" (leave overrides upper)', () => {
			expect(
				sanitizePropertyName("autoIP", {
					rules: {
						leave: ["autoIP"],
						upper: ["ip"]
					}
				})
			).toBe("autoIP");
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

		it('"Mixed_APPS_some-thing" with preserveAllUpper:true + upper:["thing"] → "mixed_APPS_someTHING"', () => {
			expect(
				sanitizePropertyName("Mixed_APPS_some-thing", {
					preserveAllUpper: true,
					rules: { upper: ["thing"] }
				})
			).toBe("mixed_APPS_someTHING");
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

		it("should handle numeric identifiers with preserveAllUpper", () => {
			expect(sanitizePropertyName("123_456", { preserveAllUpper: true })).toBe("_456");
		});

		it("should handle single uppercase letter with preserveAllUpper", () => {
			expect(sanitizePropertyName("A", { preserveAllUpper: true })).toBe("A");
		});

		it("should handle single lowercase letter with preserveAllLower", () => {
			expect(sanitizePropertyName("a", { preserveAllLower: true })).toBe("a");
		});
	});

	describe("Conflicting options", () => {
		it('"COMMON_apps" with preserveAllUpper:true + preserveAllLower:true → "cOMMON_apps"', () => {
			expect(
				sanitizePropertyName("COMMON_apps", {
					preserveAllUpper: true,
					preserveAllLower: true
				})
			).toBe("cOMMON_apps");
		});

		it('"auto-ip" with leave:["autoIP"] + leaveInsensitive:["autoip"] → "autoIp" (neither matches input)', () => {
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

		it('"AUTO-IP" with lowerFirst:false + upper:["ip"] → "AUTOIP"', () => {
			expect(
				sanitizePropertyName("AUTO-IP", {
					lowerFirst: false,
					rules: { upper: ["ip"] }
				})
			).toBe("AUTOIP");
		});

		it('"parse-json" with lowerFirst:true + upper:["json"] → "parseJSON"', () => {
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
});
