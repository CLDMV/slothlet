/**
 * @Project: @cldmv/slothlet
 * @Filename: /tests/vitests/processed/sanitization/sanitize.test.vitest.mjs
 * @Date: 2025-01-11 (Migrated from node:test)
 * @Author: Nate Hyson <CLDMV>
 * @Email: <Shinrai@users.noreply.github.com>
 * -----
 * @Copyright: Copyright (c) 2013-2025 Catalyzed Motivation Inc. All rights reserved.
 */

/**
 * Test sanitizePathName function with pattern matching
 * Tests filename sanitization rules, pattern matching, and case transformations
 */

import { describe, it, expect } from "vitest";
import { sanitizePathName } from "@cldmv/slothlet/helpers/sanitize";

describe("Sanitize Path Name", () => {
	describe("Upper rules with patterns", () => {
		it('should match "auto-ip" with "*-ip" pattern', () => {
			const result = sanitizePathName("auto-ip", { rules: { upper: ["*-ip"] } });
			expect(result).toBe("autoIP");
		});

		it('should match "auto-ip" with "*ip" pattern', () => {
			const result = sanitizePathName("auto-ip", { rules: { upper: ["*ip"] } });
			expect(result).toBe("autoIP");
		});

		it('should match "auto-ip" with exact "ip" match', () => {
			const result = sanitizePathName("auto-ip", { rules: { upper: ["ip"] } });
			expect(result).toBe("autoIP");
		});

		it('should match "auto-ip" with "*ip*" pattern', () => {
			const result = sanitizePathName("auto-ip", { rules: { upper: ["*ip*"] } });
			expect(result).toBe("autoIP");
		});

		it('should NOT match "get-ip-address" with "*-ip" pattern', () => {
			const result = sanitizePathName("get-ip-address", { rules: { upper: ["*-ip"] } });
			expect(result).toBe("getIpAddress");
		});

		it('should match exact "ip" segment in "get-ip-address"', () => {
			const result = sanitizePathName("get-ip-address", { rules: { upper: ["ip"] } });
			expect(result).toBe("getIPAddress");
		});

		it('should match "get-ip-address" with "*-ip-*" pattern', () => {
			const result = sanitizePathName("get-ip-address", { rules: { upper: ["*-ip-*"] } });
			expect(result).toBe("getIPAddress");
		});

		it('should match "get-api-status" with "*-api-*" pattern', () => {
			const result = sanitizePathName("get-api-status", { rules: { upper: ["*-api-*"] } });
			expect(result).toBe("getAPIStatus");
		});

		it("should apply multiple patterns with one match", () => {
			const result = sanitizePathName("parse-json-data", { rules: { upper: ["json", "*-api"] } });
			expect(result).toBe("parseJSONData");
		});
	});

	describe("Lower rules", () => {
		it("should apply lower with exact match", () => {
			const result = sanitizePathName("parse-JSON-data", { rules: { lower: ["json"] } });
			expect(result).toBe("parsejsonData");
		});

		it("should apply lower with pattern match", () => {
			const result = sanitizePathName("get-API-status", { rules: { lower: ["*-api-*"] } });
			expect(result).toBe("getapiStatus");
		});
	});

	describe("Leave rules (case-sensitive)", () => {
		it("should leave XML with exact case-sensitive match", () => {
			const result = sanitizePathName("get-XML-parser", { rules: { leave: ["XML"] } });
			expect(result).toBe("getXMLParser");
		});

		it("should NOT match different case with leave rule", () => {
			const result = sanitizePathName("get-xml-parser", { rules: { leave: ["XML"] } });
			expect(result).toBe("getXmlParser");
		});

		it("should apply leave with pattern match", () => {
			const result = sanitizePathName("auto-IoT-device", { rules: { leave: ["*-IoT-*"] } });
			expect(result).toBe("autoIoTDevice");
		});
	});

	describe("LeaveInsensitive rules (case-insensitive)", () => {
		it("should match different case with leaveInsensitive", () => {
			const result = sanitizePathName("get-xml-parser", { rules: { leaveInsensitive: ["XML"] } });
			expect(result).toBe("getxmlParser");
		});

		it("should apply leaveInsensitive with pattern", () => {
			const result = sanitizePathName("auto-iot-device", { rules: { leaveInsensitive: ["*IoT*"] } });
			expect(result).toBe("autoiotDevice");
		});
	});

	describe("Rule precedence", () => {
		it("leave should win over other rules", () => {
			const result = sanitizePathName("get-API-data", {
				rules: {
					leave: ["API"],
					leaveInsensitive: ["api"],
					upper: ["API"],
					lower: ["API"]
				}
			});
			expect(result).toBe("getAPIData");
		});

		it("leaveInsensitive should win over upper/lower", () => {
			const result = sanitizePathName("get-api-data", {
				rules: {
					leaveInsensitive: ["API"],
					upper: ["api"],
					lower: ["api"]
				}
			});
			expect(result).toBe("getapiData");
		});

		it("preserveAllUpper should win over upper rules", () => {
			const result = sanitizePathName("XML_DATA", {
				preserveAllUpper: true,
				rules: { upper: ["xml"] }
			});
			expect(result).toBe("XML_DATA");
		});

		it("leave should win over preserveAllUpper", () => {
			const result = sanitizePathName("XML_DATA", {
				preserveAllUpper: true,
				rules: { leave: ["XML_DATA"] }
			});
			expect(result).toBe("XML_DATA");
		});

		it("upper should win over lower", () => {
			const result = sanitizePathName("get-json-data", {
				rules: {
					upper: ["json"],
					lower: ["json"]
				}
			});
			expect(result).toBe("getJSONData");
		});
	});

	describe("PreserveAllUpper option", () => {
		it("should preserve all-uppercase identifiers", () => {
			const result = sanitizePathName("COMMON_APPS", { preserveAllUpper: true });
			expect(result).toBe("COMMON_APPS");
		});

		it("should NOT preserve mixed case", () => {
			const result = sanitizePathName("cOMMON_APPS", { preserveAllUpper: true });
			expect(result).toBe("cOMMON_APPS");
		});

		it("should work in multi-segment context", () => {
			const result = sanitizePathName("parse-XML-data", { preserveAllUpper: true });
			expect(result).toBe("parseXMLData");
		});
	});

	describe("PreserveAllLower option", () => {
		it("should preserve all-lowercase identifiers", () => {
			const result = sanitizePathName("common_apps", { preserveAllLower: true });
			expect(result).toBe("common_apps");
		});

		it("should NOT preserve mixed case", () => {
			const result = sanitizePathName("Common_apps", { preserveAllLower: true });
			expect(result).toBe("common_apps");
		});

		it("should work in multi-segment context", () => {
			const result = sanitizePathName("parse-xml-data", { preserveAllLower: true });
			expect(result).toBe("parsexmldata");
		});
	});

	describe("Edge cases with preserve options", () => {
		it("should handle numeric identifiers with preserveAllUpper", () => {
			const result = sanitizePathName("123_456", { preserveAllUpper: true });
			expect(result).toBe("_456");
		});

		it("should handle single uppercase letter with preserveAllUpper", () => {
			const result = sanitizePathName("A", { preserveAllUpper: true });
			expect(result).toBe("A");
		});

		it("should handle single lowercase letter with preserveAllLower", () => {
			const result = sanitizePathName("a", { preserveAllLower: true });
			expect(result).toBe("a");
		});
	});

	describe("Within-segment pattern transformations", () => {
		it("should transform URL within camelCase segment", () => {
			const result = sanitizePathName("buildUrlWithParams", { rules: { upper: ["*URL*"] } });
			expect(result).toBe("buildURLWithParams");
		});

		it("should transform URL in simple camelCase", () => {
			const result = sanitizePathName("parseUrl", { rules: { upper: ["*URL*"] } });
			expect(result).toBe("parseURL");
		});

		it("should transform URL in complex camelCase", () => {
			const result = sanitizePathName("validateUrlString", { rules: { upper: ["*URL*"] } });
			expect(result).toBe("validateURLString");
		});

		it("should transform standalone URL", () => {
			const result = sanitizePathName("url", { rules: { upper: ["*URL*"] } });
			expect(result).toBe("URL");
		});

		it("should transform multiple URL occurrences", () => {
			const result = sanitizePathName("parseUrlFromUrlString", { rules: { upper: ["*URL*"] } });
			expect(result).toBe("parseURLFromURLString");
		});
	});

	describe("Boundary-requiring patterns (**STRING**)", () => {
		it("should match **url** when surrounded by characters", () => {
			const result = sanitizePathName("buildUrlWithParams", { rules: { upper: ["**url**"] } });
			expect(result).toBe("buildURLWithParams");
		});

		it("should NOT match **url** for standalone url", () => {
			const result = sanitizePathName("url", { rules: { upper: ["**url**"] } });
			expect(result).toBe("url");
		});

		it("should match **json** when surrounded by characters", () => {
			const result = sanitizePathName("parseJsonData", { rules: { upper: ["**json**"] } });
			expect(result).toBe("parseJSONData");
		});

		it("should NOT match **json** for standalone json", () => {
			const result = sanitizePathName("json", { rules: { upper: ["**json**"] } });
			expect(result).toBe("json");
		});

		it("should match **api** in middle of word", () => {
			const result = sanitizePathName("getApiStatus", { rules: { upper: ["**api**"] } });
			expect(result).toBe("getAPIStatus");
		});

		it("should NOT match **api** for standalone api", () => {
			const result = sanitizePathName("api", { rules: { upper: ["**api**"] } });
			expect(result).toBe("api");
		});

		it("should apply multiple boundary-requiring patterns", () => {
			const result = sanitizePathName("buildApiUrlParser", { rules: { upper: ["**api**", "**url**"] } });
			expect(result).toBe("buildAPIURLParser");
		});
	});
});
