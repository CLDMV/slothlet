/**
 *      @Project: @cldmv/slothlet
 *      @Filename: /tests/vitests/suites/processors/flatten-new-branches.test.vitest.mjs
 *      @Date: 2026-07-17T00:00:00-07:00 (1752739200)
 *      @Author: Nate Hyson <CLDMV>
 *      @Email: <Shinrai@users.noreply.github.com>
 *      -----
 *      @Last modified by: Nate Hyson <CLDMV> (Shinrai@users.noreply.github.com)
 *      @Last modified time: 2026-07-17 00:00:00 -07:00 (1752739200)
 *      -----
 *      @Copyright: Copyright (c) 2013-2026 Catalyzed Motivation Inc. All rights reserved.
 */

/**
 * @fileoverview Coverage tests for Flatten.buildCategoryDecisions — uncovered paths.
 *
 * @description
 * Exercises `buildCategoryDecisions` branches not covered by the existing flatten or
 * smart-flattening test suites:
 *
 * - addapi-special-file: `isAddapiFile=true` but NOT metadata-default pattern  →
 *   `flattenType: "addapi-special-file"`.
 *
 * - function-folder-match (C10): `moduleName === categoryName && typeof mod === "function"
 *   && currentDepth > 0` →  `flattenType: "function-folder-match"` (no preferredName).
 *
 * - function-folder-match (C15): `typeof mod === "function" && mod.name && depth > 0 &&
 *   mod.name.toLowerCase() === categoryName.toLowerCase()` → `flattenType: "function-folder-match"`
 *   with a `preferredName`.
 *
 * - preserving-function-name (C16): function whose name (case-sensitive) matches the
 *   module filename → `shouldFlatten: false`, `preferredName: fn.name`.
 *
 * - default-function (C17): anonymous / `default`-named function at depth > 0 →
 *   `flattenType: "default-function"`.
 *
 * - parent-level-flatten (C14): single file, generic filename, single export key →
 *   `flattenType: "parent-level-flatten"`.
 *
 * @module tests/vitests/suites/processors/flatten-new-branches.test.vitest
 */

import { describe, it, expect, vi } from "vitest";
import { Flatten } from "@cldmv/slothlet/processors/flatten";
import { SlothletError, SlothletWarning } from "@cldmv/slothlet/errors";

/**
 * Minimal mock slothlet for ComponentBase.
 * @returns {object} Minimal mock.
 */
function makeMock() {
	return {
		config: {},
		debug: vi.fn(),
		SlothletError,
		SlothletWarning
	};
}

/**
 * Identity translator that returns i18n keys as-is for deterministic assertions.
 * @param {string} key - i18n key.
 * @returns {Promise<string>} The key unchanged.
 *
 * @example
 * await t("FLATTEN_REASON_ADDAPI_SPECIAL_FILE"); // "FLATTEN_REASON_ADDAPI_SPECIAL_FILE"
 */
const t = async (key) => key;

// ─── addapi-special-file path ─────────────────────────────────────────────────

describe("Flatten.buildCategoryDecisions — addapi-special-file path", () => {
	it("returns flattenType='addapi-special-file' for file named addapi with no metadata-default", async () => {
		const flatten = new Flatten(makeMock());
		const fn = function addapi() {
			return "addapi";
		};
		// moduleName = "addapi" triggers isAddapiFile; no hasDefault+object+keys → line 399 path
		const result = await flatten.buildCategoryDecisions({
			categoryName: "utils",
			mod: fn,
			moduleName: "addapi",
			fileBaseName: "addapi.mjs",
			analysis: { hasDefault: false, defaultExportType: null, hasNamed: false },
			moduleKeys: [],
			currentDepth: 1,
			moduleFiles: ["addapi.mjs"],
			t
		});

		expect(result.shouldFlatten).toBe(true);
		expect(result.flattenType).toBe("addapi-special-file");
	});

	it("returns flattenType='addapi-metadata-default' for addapi file with object default + keys", async () => {
		const flatten = new Flatten(makeMock());
		const mod = { default: { a: 1 }, namedExport: "val" };
		// metadata pattern satisfied → early return before line 399
		const result = await flatten.buildCategoryDecisions({
			categoryName: "utils",
			mod,
			moduleName: "addapi",
			fileBaseName: "addapi.mjs",
			analysis: { hasDefault: true, defaultExportType: "object", hasNamed: true },
			moduleKeys: ["namedExport"],
			currentDepth: 1,
			moduleFiles: ["addapi.mjs"],
			t
		});

		expect(result.shouldFlatten).toBe(true);
		expect(result.flattenType).toBe("addapi-metadata-default");
	});
});

// ─── function-folder-match C10 ────────────────────────────────────────────────

describe("Flatten.buildCategoryDecisions — C10 function-folder-match (moduleName===categoryName)", () => {
	it("returns function-folder-match when moduleName===categoryName and mod is a function at depth>0", async () => {
		const flatten = new Flatten(makeMock());

		function mathFn() {
			return 42;
		}

		const result = await flatten.buildCategoryDecisions({
			categoryName: "math",
			mod: mathFn,
			moduleName: "math",
			fileBaseName: "math.mjs",
			analysis: { hasDefault: false, defaultExportType: null, hasNamed: false },
			moduleKeys: [],
			currentDepth: 1,
			moduleFiles: ["math.mjs"],
			t
		});

		expect(result.shouldFlatten).toBe(true);
		expect(result.flattenType).toBe("function-folder-match");
		// C10 does NOT set preferredName
		expect(result.preferredName).toBeFalsy();
	});
});

// ─── function-folder-match C15 ────────────────────────────────────────────────

describe("Flatten.buildCategoryDecisions — C15 function name matches folder", () => {
	it("returns function-folder-match with preferredName when fn.name===categoryName at depth>0", async () => {
		const flatten = new Flatten(makeMock());

		// Named function whose name matches the category, but moduleName differs
		function parser() {
			return "parsed";
		}

		const result = await flatten.buildCategoryDecisions({
			categoryName: "parser",
			mod: parser,
			moduleName: "xml-parser", // different from categoryName → C10 does NOT fire
			fileBaseName: "xml-parser.mjs",
			analysis: { hasDefault: false, defaultExportType: null, hasNamed: false },
			moduleKeys: [],
			currentDepth: 1,
			moduleFiles: ["xml-parser.mjs"],
			t
		});

		// C15: fn.name "parser" matches category "parser"
		expect(result.shouldFlatten).toBe(true);
		expect(result.flattenType).toBe("function-folder-match");
		expect(result.preferredName).toBe("parser");
	});
});

// ─── C16: preserving function name ───────────────────────────────────────────

describe("Flatten.buildCategoryDecisions — C16 preserving function name", () => {
	it("returns shouldFlatten=false and preserves exact function name casing", async () => {
		const flatten = new Flatten(makeMock());

		// Function name matches module filename (case-insensitive), so use the exact name
		function XMLParser() {
			return "parsed";
		}

		const result = await flatten.buildCategoryDecisions({
			categoryName: "utils",
			mod: XMLParser,
			moduleName: "xmlparser", // matches XMLParser.toLowerCase()
			fileBaseName: "xmlparser.mjs",
			analysis: { hasDefault: false, defaultExportType: null, hasNamed: false },
			moduleKeys: [],
			currentDepth: 0, // depth 0 to avoid C10 triggering
			moduleFiles: ["xmlparser.mjs"],
			t
		});

		// C16: preserve exact casing from function name
		expect(result.shouldFlatten).toBe(false);
		expect(result.preferredName).toBe("XMLParser");
	});
});

// ─── C17: default-function (anonymous / `default`-named at depth > 0) ─────────

describe("Flatten.buildCategoryDecisions — C17 default-function", () => {
	it("returns flattenType='default-function' for anonymous function at depth>0", async () => {
		const flatten = new Flatten(makeMock());
		// Force name to empty string so C17 condition fires (!mod.name)
		const anon = function () {
			return "anon";
		};
		Object.defineProperty(anon, "name", { value: "" });

		const result = await flatten.buildCategoryDecisions({
			categoryName: "utils",
			mod: anon,
			moduleName: "helper",
			fileBaseName: "helper.mjs",
			analysis: { hasDefault: false, defaultExportType: null, hasNamed: false },
			moduleKeys: [],
			currentDepth: 2,
			moduleFiles: ["helper.mjs"],
			t
		});

		expect(result.shouldFlatten).toBe(true);
		expect(result.flattenType).toBe("default-function");
		expect(result.preferredName).toBe("utils"); // categoryName
	});

	it("returns flattenType='default-function' for function named 'default' at depth>0", async () => {
		const flatten = new Flatten(makeMock());
		// Function whose name is the string "default"
		const fn = function () {
			return "val";
		};
		Object.defineProperty(fn, "name", { value: "default" });

		const result = await flatten.buildCategoryDecisions({
			categoryName: "api",
			mod: fn,
			moduleName: "endpoints",
			fileBaseName: "endpoints.mjs",
			analysis: { hasDefault: false, defaultExportType: null, hasNamed: false },
			moduleKeys: [],
			currentDepth: 1,
			moduleFiles: ["endpoints.mjs"],
			t
		});

		expect(result.shouldFlatten).toBe(true);
		expect(result.flattenType).toBe("default-function");
	});
});

// ─── C14: parent-level-flatten ────────────────────────────────────────────────

describe("Flatten.buildCategoryDecisions — C14 parent-level-flatten (generic filename)", () => {
	it("returns flattenType='parent-level-flatten' for a single-file generic-named module at depth>0", async () => {
		const flatten = new Flatten(makeMock());
		const mod = { index: () => "result" };

		const result = await flatten.buildCategoryDecisions({
			categoryName: "utils",
			mod,
			moduleName: "index", // generic filename
			fileBaseName: "index.mjs",
			analysis: { hasDefault: false, defaultExportType: null, hasNamed: true },
			moduleKeys: ["index"],
			currentDepth: 1,
			moduleFiles: ["index.mjs"], // single file
			t
		});

		expect(result.shouldFlatten).toBe(true);
		expect(result.flattenType).toBe("parent-level-flatten");
	});
});
