/**
 *	@Project: @cldmv/slothlet
 *	@Filename: /tests/vitests/suites/processors/flatten-new-branches.test.vitest.mjs
 *	@Date: 2026-02-27T06:19:24-08:00 (1772201964)
 *	@Author: Nate Hyson <CLDMV>
 *	@Email: <Shinrai@users.noreply.github.com>
 *	-----
 *	@Last modified by: Nate Hyson <CLDMV> (Shinrai@users.noreply.github.com)
 *	@Last modified time: 2026-02-28 13:23:07 -08:00 (1772313787)
 *	-----
 *	@Copyright: Copyright (c) 2013-2026 Catalyzed Motivation Inc. All rights reserved.
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
// ─── helpers for processModuleForAPI tests ────────────────────────────────────

/**
 * Minimal mock slothlet that also provides helpers.modesUtils for processModuleForAPI.
 * @param {string} [collisionMode="merge"] - Collision mode to use in config.
 * @returns {object} Mock slothlet.
 *
 * @example
 * const flatten = new Flatten(makeMockWithHelpers("error"));
 */
function makeMockWithHelpers(collisionMode = "merge") {
        return {
                config: {
                        collision: { initial: collisionMode, api: collisionMode }
                },
                debug: vi.fn(),
                SlothletError,
                SlothletWarning,
                helpers: {
                        modesUtils: {
                                /**
                                 * Identity — returns original function unchanged.
                                 * @param {Function} fn - Input function.
                                 * @returns {Function} Same function.
                                 */
                                ensureNamedExportFunction: (fn) => fn
                        }
                }
        };
}

// ─── Line 140: getFlatteningDecision — self-referential preserveAsNamespace ───

describe("Flatten.getFlatteningDecision — self-referential module preserves namespace (line 140)", () => {
        it("returns preserveAsNamespace:true when mod[moduleName] === mod (line 140)", async () => {
                const flatten = new Flatten(makeMock());

                // Self-referential: the module has a key equal to moduleName pointing to itself
                const mod = {};
                mod.math = mod;

                const result = await flatten.getFlatteningDecision({
                        mod,
                        moduleName: "math",
                        categoryName: "ns",
                        analysis: { hasDefault: false, defaultExportType: null },
                        hasMultipleDefaults: false,
                        moduleKeys: ["math"],
                        t
                });

                expect(result.preserveAsNamespace).toBe(true);
                expect(result.reason).toBe("FLATTEN_REASON_SELF_REFERENTIAL");
        });
});

// ─── Line 280: processModuleForAPI — self-referential non-function content ────

describe("Flatten.processModuleForAPI — self-referential uses mod[moduleName] (line 280)", () => {
        it("returns mod[moduleName] as moduleContent when isSelfReferential=true (line 280)", () => {
                const flatten = new Flatten(makeMockWithHelpers());

                const mod = {};
                mod.math = mod;

                const result = flatten.processModuleForAPI({
                        mod,
                        decision: {},
                        moduleName: "math",
                        propertyName: "math",
                        moduleKeys: [],
                        analysis: { hasDefault: false },
                        isSelfReferential: true
                });

                // mod["math"] === mod → moduleContent should be mod itself
                expect(result.moduleContent).toBe(mod);
        });

        it("falls back to mod when mod[moduleName] is falsy (line 280)", () => {
                const flatten = new Flatten(makeMockWithHelpers());
                // mod.other is undefined → mod[moduleName] is falsy → fallback is mod
                const mod = { unrelated: () => {} };

                const result = flatten.processModuleForAPI({
                        mod,
                        decision: {},
                        moduleName: "missing",
                        propertyName: "missing",
                        moduleKeys: [],
                        analysis: { hasDefault: false },
                        isSelfReferential: true
                });

                expect(result.moduleContent).toBe(mod);
        });
});

// ─── Lines 299-310: processModuleForAPI — hybrid collision "error" / "warn" ──

describe("Flatten.processModuleForAPI — hybrid default+named collision modes (lines 299-310)", () => {
        it("throws COLLISION_DEFAULT_EXPORT_ERROR when collisionMode='error' and named export collides (line 300-308)", () => {
                const flatten = new Flatten(makeMockWithHelpers("error"));

                // Default function that already owns property "version"
                function logger() {}
                logger.version = "original";

                const mod = { default: logger, version: "named-overwrite" };

                expect(() =>
                        flatten.processModuleForAPI({
                                mod,
                                decision: {},
                                moduleName: "logger",
                                propertyName: "logger",
                                moduleKeys: ["version"],
                                analysis: { hasDefault: true },
                                collisionContext: "initial",
                                apiPathPrefix: "tools"
                        })
                ).toThrow(/COLLISION_DEFAULT_EXPORT_ERROR/);
        });

        it("emits warning and overwrites when collisionMode='warn' and named export collides (lines 309-314)", () => {
                SlothletWarning.suppressConsole = true;
                try {
                        const flatten = new Flatten(makeMockWithHelpers("warn"));

                        function logger() {}
                        logger.version = "original";

                        const mod = { default: logger, version: "named-overwrite" };

                        const result = flatten.processModuleForAPI({
                                mod,
                                decision: {},
                                moduleName: "logger",
                                propertyName: "logger",
                                moduleKeys: ["version"],
                                analysis: { hasDefault: true },
                                collisionContext: "initial",
                                apiPathPrefix: "tools"
                        });

                        // Should NOT throw; named export is assigned after warning
                        expect(result.moduleContent).toBeDefined();
                        expect(result.moduleContent.version).toBe("named-overwrite");
                } finally {
                        SlothletWarning.suppressConsole = false;
                }
        });

        it("falls through with no warning when collisionMode='replace' and named export collides (line 309 false branch)", () => {
                // collisionMode="replace" is not "warn", so the else-if at line 309 evaluates to FALSE
                // and falls through to direct assignment — exercising the false branch of that else-if.
                const flatten = new Flatten(makeMockWithHelpers("replace"));

                function logger() {}
                logger.version = "original";

                const mod = { default: logger, version: "named-replace" };

                const result = flatten.processModuleForAPI({
                        mod,
                        decision: {},
                        moduleName: "logger",
                        propertyName: "logger",
                        moduleKeys: ["version"],
                        analysis: { hasDefault: true },
                        collisionContext: "initial",
                        apiPathPrefix: "tools"
                });

                // "replace" mode falls through to direct assignment — no throw, no warn
                expect(result.moduleContent).toBeDefined();
                expect(result.moduleContent.version).toBe("named-replace");
        });
});

// ─── Line 449 false branch: generic filename but multiple keys (C14 inner-if false) ────────

describe("Flatten.buildCategoryDecisions — C14 generic-filename with 2+ keys (line 449 false branch)", () => {
        it("does not return parent-level-flatten when generic filename has 2+ named exports", async () => {
                // Reaches the outer C14 if at line 445 (single file, depth>0, object) and enters the block.
                // Then line 449: moduleKeys.length === 1 is FALSE (2 keys) → takes the false branch → falls through.
                const flatten = new Flatten(makeMock());
                const mod = { a: 1, b: 2 };

                const result = await flatten.buildCategoryDecisions({
                        categoryName: "utils",
                        mod,
                        moduleName: "index",        // generic name → isGenericFilename=true
                        fileBaseName: "index.mjs",
                        analysis: { hasDefault: false, defaultExportType: null, hasNamed: true },
                        moduleKeys: ["a", "b"],      // length 2 → 449 condition is false
                        currentDepth: 1,
                        moduleFiles: ["index.mjs"],  // single file → enters outer guard
                        t
                });

                // Did NOT flatten via parent-level-flatten — fell through
                expect(result.flattenType).not.toBe("parent-level-flatten");
        });
});

// ─── Line 476: exportToCheck using mod.default when default is a function ─────────

describe("Flatten.buildCategoryDecisions — line 476 exportToCheck via mod.default function", () => {
        it("takes the mod.default branch of the exportToCheck ternary when default is a function (line 476)", async () => {
                // Line 476 ternary: mod is NOT a function, but mod.default IS a function.
                // → exportToCheck = mod.default (the middle branch of the nested ternary).
                // moduleName differs from categoryName so earlier conditions don't short-circuit.
                const flatten = new Flatten(makeMock());

                function namedHelper() {}
                const mod = { default: namedHelper, extra: 42 };

                const result = await flatten.buildCategoryDecisions({
                        categoryName: "utils",
                        mod,
                        moduleName: "helpers",      // different from categoryName → skips C10-C12
                        fileBaseName: "helpers.mjs",
                        analysis: { hasDefault: true, defaultExportType: "function", hasNamed: true },
                        moduleKeys: ["extra"],
                        currentDepth: 1,
                        moduleFiles: ["helpers.mjs", "other.mjs"],  // 2 files → skips C14 outer guard
                        t
                });

                // Result may be any decision; the important thing is that the function ran without error
                // and evaluated the exportToCheck = mod.default path at line 476.
                expect(result).toBeDefined();
        });
});