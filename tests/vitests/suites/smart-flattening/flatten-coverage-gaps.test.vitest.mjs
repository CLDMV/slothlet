/**
 *	@Project: @cldmv/slothlet
 *	@Filename: /tests/vitests/suites/smart-flattening/flatten-coverage-gaps.test.vitest.mjs
 *	@Date: 2026-07-10 00:00:00 -07:00 (1752134400)
 *	@Author: Nate Corcoran <CLDMV>
 *	@Email: <Shinrai@users.noreply.github.com>
 *	-----
 *	@Last modified by: Nate Corcoran <CLDMV> (Shinrai@users.noreply.github.com)
 *	@Last modified time: 2026-03-03 21:34:22 -08:00 (1772602462)
 *	-----
 *	@Copyright: Copyright (c) 2013-2026 Catalyzed Motivation Inc. All rights reserved.
 */

/**
 * @fileoverview Coverage gap tests for flatten.mjs.
 *
 * @description
 * Directly exercises flatten processor methods to cover lines not reached
 * by integration tests:
 *
 * - Line 56: `#checkSelfReferential` early-return when `mod` is null/non-object.
 *   In normal API loading mod is always an object from extractExports, so this
 *   defensive guard is only reachable by calling getFlatteningDecision directly
 *   with a non-object mod value.
 *
 * - Line 362: Fallback path in `processModuleForAPI` for "named-only exports with
 *   no default" — fires when the module has named exports but no default export and
 *   no other content-building rule applies (not flattenToRoot/Category, not
 *   useAutoFlattening, not isSelfReferential, not hybrid default+named).
 *
 * @module flatten-coverage-gaps.test.vitest
 */

import { describe, test, expect, afterEach } from "vitest";
import slothlet from "@cldmv/slothlet";
import { resolveWrapper } from "@cldmv/slothlet/handlers/unified-wrapper";
import path from "node:path";
import { fileURLToPath } from "node:url";
const _filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(_filename);

const API_TEST_IMPL = path.resolve(__dirname, "../../../../api_tests/api_test_impl");

/** @type {import("@cldmv/slothlet").SlothletInstance|null} */
let api = null;

afterEach(async () => {
	if (api) {
		await api.slothlet.shutdown();
		api = null;
	}
});

/**
 * Creates a minimal Slothlet instance in eager mode and returns the flatten
 * processor for direct method invocation.
 * @returns {Promise<object>} The flatten processor instance
 */
async function getFlattenProcessor() {
	api = await slothlet({ dir: API_TEST_IMPL, mode: "eager" });
	// resolveWrapper retrieves the UnifiedWrapper; .slothlet is the Slothlet class instance
	const slInstance = resolveWrapper(api.math).slothlet;
	return slInstance.processors.flatten;
}

/**
 * Minimal no-op translation helper that satisfies the `t` parameter expected
 * by flatten processor methods.
 * @param {string} key - i18n key
 * @returns {Promise<string>} The key, unchanged
 */
async function t(key) {
	return key;
}

// ============================================================================
// LINE 56 — #checkSelfReferential: non-object mod guard
// ============================================================================

describe("flatten.mjs — line 56: #checkSelfReferential non-object guard", () => {
	test("getFlatteningDecision with null mod returns preserveAsNamespace without throwing", async () => {
		const flatten = await getFlattenProcessor();

		// Pass mod=null — #checkSelfReferential fires line 56 (`!mod` is true → return false).
		// Using moduleName≠categoryName so other short-circuit rules don't mask the line.
		const decision = await flatten.getFlatteningDecision({
			mod: null,
			moduleName: "nullmod",
			categoryName: "differentFolder",
			analysis: { hasDefault: false, hasNamed: false, defaultExportType: null },
			hasMultipleDefaults: false,
			moduleKeys: [],
			t
		});

		// #checkSelfReferential returns false (non-object guard) → falls through to default
		expect(decision).toBeDefined();
		expect(decision.preserveAsNamespace).toBe(true);
	});

	test("getFlatteningDecision with string mod returns a valid decision", async () => {
		const flatten = await getFlattenProcessor();

		// Pass mod="notAnObject" — typeof mod !== "object" fires line 56 → return false.
		const decision = await flatten.getFlatteningDecision({
			mod: "notAnObject",
			moduleName: "stringmod",
			categoryName: "anotherFolder",
			analysis: { hasDefault: false, hasNamed: false, defaultExportType: null },
			hasMultipleDefaults: false,
			moduleKeys: [],
			t
		});

		expect(decision).toBeDefined();
		expect(decision.preserveAsNamespace).toBe(true);
	});

	test("getFlatteningDecision with numeric mod returns a valid decision", async () => {
		const flatten = await getFlattenProcessor();

		// Pass mod=42 — typeof 42 !== "object" fires line 56 → return false.
		const decision = await flatten.getFlatteningDecision({
			mod: 42,
			moduleName: "numericmod",
			categoryName: "yetAnotherFolder",
			analysis: { hasDefault: false, hasNamed: false, defaultExportType: null },
			hasMultipleDefaults: false,
			moduleKeys: [],
			t
		});

		expect(decision).toBeDefined();
		expect(decision.preserveAsNamespace).toBe(true);
	});
});

// ============================================================================
// LINE 362 — processModuleForAPI: named-only exports fallback
// ============================================================================

describe("flatten.mjs — line 362: processModuleForAPI named-only fallback", () => {
	test("named exports without default emit { key: value } moduleContent", async () => {
		const flatten = await getFlattenProcessor();

		/**
		 * Simulate a module like: export function beta(name) { return name; }
		 * modExports has no "default" key → mod.default is undefined (falsy).
		 * decision is preserveAsNamespace — does NOT trigger flattenToRoot,
		 * flattenToCategory, or useAutoFlattening.
		 * The hybrid `mod.default && moduleKeys.length > 0` check is false.
		 * The only-default `mod.default && moduleKeys.length === 0` check is false.
		 * → Reaches line 362 fallback.
		 */
		const betaFn = (name) => `Hello, ${name}!`;
		const modExports = { beta: betaFn };

		const result = flatten.processModuleForAPI({
			mod: modExports,
			decision: { preserveAsNamespace: true },
			moduleName: "singlefile",
			propertyName: "singlefile",
			moduleKeys: ["beta"],
			analysis: { hasDefault: false, hasNamed: true, defaultExportType: null },
			isSelfReferential: false
		});

		// Fallback builds a plain object collecting all named exports
		expect(result).toBeDefined();
		expect(result.moduleContent).toBeDefined();
		expect(result.moduleContent.beta).toBe(betaFn);
		// No default should be added (mod.default is falsy)
		expect(result.moduleContent.default).toBeUndefined();
	});

	test("named exports with falsy default include no default key in moduleContent", async () => {
		const flatten = await getFlattenProcessor();

		// mod.default = undefined → falsy, so `if (mod.default)` at line 363 is false.
		// Named exports alpha and beta are both collected.
		const alphaFn = () => "alpha";
		const betaFn = () => "beta";
		const modExports = { alpha: alphaFn, beta: betaFn };

		const result = flatten.processModuleForAPI({
			mod: modExports,
			decision: { preserveAsNamespace: true },
			moduleName: "helpers",
			propertyName: "helpers",
			moduleKeys: ["alpha", "beta"],
			analysis: { hasDefault: false, hasNamed: true, defaultExportType: null },
			isSelfReferential: false
		});

		expect(result.moduleContent.alpha).toBe(alphaFn);
		expect(result.moduleContent.beta).toBe(betaFn);
		expect(result.moduleContent.default).toBeUndefined();
	});

	test("named exports with falsy-but-present default: default key is omitted", async () => {
		const flatten = await getFlattenProcessor();

		// mod.default = 0 (falsy number) — `if (mod.default)` at line 363 is false.
		// Confirms the branch condition accurately: only truthy defaults are promoted.
		const modExports = { default: 0, count: 5 };

		const result = flatten.processModuleForAPI({
			mod: modExports,
			decision: { preserveAsNamespace: true },
			moduleName: "counter",
			propertyName: "counter",
			moduleKeys: ["count"],
			analysis: { hasDefault: false, hasNamed: true, defaultExportType: null },
			isSelfReferential: false
		});

		// mod.default = 0 is falsy → not added to moduleContent
		expect(result.moduleContent.default).toBeUndefined();
		expect(result.moduleContent.count).toBe(5);
	});
});
// ============================================================================
// LINES 152 & 182 — getFlatteningDecision: typeof mod === "function" TRUE branch
// ============================================================================

describe("flatten.mjs — lines 152 & 182: typeof mod === 'function' TRUE branch", () => {
	test("L152: mod is a raw function inside multiDefaultDecision.preserveAsNamespace block", async () => {
		const flatten = await getFlattenProcessor();

		// hasMultipleDefaults: true + analysis.hasDefault: true →
		// #checkMultiDefault returns { preserveAsNamespace: true }
		// mod is a function → typeof mod === "function" is TRUE (L152 TRUE branch)
		function myParser() {}
		const decision = await flatten.getFlatteningDecision({
			mod: myParser,
			moduleName: "myparser",
			categoryName: "parsers",
			analysis: { hasDefault: true, hasNamed: false, defaultExportType: "function" },
			hasMultipleDefaults: true,
			moduleKeys: [],
			t
		});

		expect(decision).toBeDefined();
		expect(decision.preserveAsNamespace).toBe(true);
	});

	test("L182: mod is a raw function in the function-name-preference block", async () => {
		const flatten = await getFlattenProcessor();

		// hasMultipleDefaults: false → #checkMultiDefault returns null
		// mod is a function → #checkSelfReferential returns false (not an object)
		// moduleKeys.length === 0 → #checkAutoFlatten returns false
		// moduleName !== categoryName → flattenToCategory not triggered
		// → reaches L182: typeof mod === "function" TRUE branch
		// function name "parseCSV" normalised "parsecsv" === moduleName "parsecsv" → preferredName set
		function parseCSV() {}
		const decision = await flatten.getFlatteningDecision({
			mod: parseCSV,
			moduleName: "parsecsv",
			categoryName: "utils",
			analysis: { hasDefault: false, hasNamed: false, defaultExportType: null },
			hasMultipleDefaults: false,
			moduleKeys: [],
			t
		});

		expect(decision).toBeDefined();
		expect(decision.preserveAsNamespace).toBe(true);
		expect(decision.preferredName).toBe("parseCSV");
	});
});
