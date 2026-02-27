/**
 *      @Project: @cldmv/slothlet
 *      @Filename: /tests/vitests/suites/processors/flatten-branches.test.vitest.mjs
 *      @Date: 2026-07-15T00:00:00-07:00 (1752652800)
 *      @Author: Nate Hyson <CLDMV>
 *      @Email: <Shinrai@users.noreply.github.com>
 *      -----
 *      @Last modified by: Nate Hyson <CLDMV> (Shinrai@users.noreply.github.com)
 *      @Last modified time: 2026-07-15 00:00:00 -07:00 (1752652800)
 *      -----
 *      @Copyright: Copyright (c) 2013-2026 Catalyzed Motivation Inc. All rights reserved.
 */

/**
 * @fileoverview Coverage tests for Flatten processor uncovered branches (lines 508, 532, 538, 541).
 *
 * @description
 * Directly instantiates Flatten to exercise code paths that integration tests never reach:
 *
 * - Line 508: `buildCategoryDecisions()` — Rule 7 C12 "object-auto-flatten" path where a module
 *   is an object whose only export key matches the module name (e.g. a `math` folder with a
 *   `{ math: fn }` export). Returns `{ shouldFlatten: true, flattenType: "object-auto-flatten" }`.
 *
 * - Line 532: `shouldAttachNamedExport()` — the `!key || key === "default"` guard, reached
 *   when the named export key is `null` or the string `"default"`.
 *
 * - Line 538: `shouldAttachNamedExport()` — `key === defaultFunc.name` guard, fires when the
 *   named export key equals the name of the wrapped default function.
 *
 * - Line 541: `shouldAttachNamedExport()` — `key === originalDefault.name` guard, fires when
 *   the key matches the original default function name but NOT the wrapper function name.
 *
 * @module tests/vitests/suites/processors/flatten-branches.test.vitest
 */

import { describe, it, expect, vi } from "vitest";
import { Flatten } from "@cldmv/slothlet/processors/flatten";
import { SlothletError, SlothletWarning } from "@cldmv/slothlet/errors";

/**
 * Minimal mock slothlet satisfying Flatten's ComponentBase requirements.
 * `shouldAttachNamedExport` and `buildCategoryDecisions` do not access
 * `this.slothlet.*` directly, so a bare-minimum mock is sufficient.
 *
 * @returns {object} Mock slothlet instance.
 *
 * @example
 * const flatten = new Flatten(makeMock());
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
 * Simple async identity translator used as the `t` param for `buildCategoryDecisions`.
 * Returns the i18n key string directly so the result is deterministic in tests.
 *
 * @param {string} key - i18n key.
 * @returns {Promise<string>} The key itself.
 *
 * @example
 * await t("FLATTEN_REASON_NO_CONDITIONS_MET"); // "FLATTEN_REASON_NO_CONDITIONS_MET"
 */
const t = async (key) => key;

// ─── shouldAttachNamedExport ──────────────────────────────────────────────────

describe("Flatten.shouldAttachNamedExport — uncovered return false branches", () => {
	it("returns false when key is null (line 532)", () => {
		// The guard `!key || key === "default"` fires immediately for a null key.
		const flatten = new Flatten(makeMock());

		expect(flatten.shouldAttachNamedExport(null, "someValue", () => {}, () => {})).toBe(false);
	});

	it("returns false when key is an empty string (line 532)", () => {
		// `!key` is truthy for an empty string.
		const flatten = new Flatten(makeMock());

		expect(flatten.shouldAttachNamedExport("", "someValue", () => {}, () => {})).toBe(false);
	});

	it("returns false when key is 'default' (line 532)", () => {
		// The literal string "default" is explicitly rejected.
		const flatten = new Flatten(makeMock());

		expect(flatten.shouldAttachNamedExport("default", "someValue", () => {}, () => {})).toBe(false);
	});

	it("returns false when key equals defaultFunc.name (line 538)", () => {
		// When the key matches the wrapped default function's name, re-exporting it would
		// create a duplicate and should be skipped.
		const flatten = new Flatten(makeMock());

		/** @returns {number} */
		function computeSum() {
			return 42;
		}

		const originalDefault = function originalFn() {};

		// key "computeSum" matches computeSum.name → line 538 fires.
		expect(flatten.shouldAttachNamedExport("computeSum", computeSum, computeSum, originalDefault)).toBe(false);
	});

	it("returns false when key equals originalDefault.name (line 541)", () => {
		// When defaultFunc.name does NOT match key but originalDefault.name does,
		// line 541's guard fires.
		const flatten = new Flatten(makeMock());

		function parseJSON() {
			return {};
		}

		// defaultFunc has a different name so line 538 skips; originalDefault.name matches.
		const defaultWrapper = function wrappedFn() {};

		expect(flatten.shouldAttachNamedExport("parseJSON", parseJSON, defaultWrapper, parseJSON)).toBe(false);
	});

	it("returns true when key is a regular export with no name collision (line 543)", () => {
		// Regression guard: a plain non-special key should pass all guards.
		const flatten = new Flatten(makeMock());

		function helperFn() {}

		expect(flatten.shouldAttachNamedExport("helper", helperFn, () => {}, () => {})).toBe(true);
	});
});

// ─── buildCategoryDecisions — C12 object-auto-flatten (line 508) ─────────────

describe("Flatten.buildCategoryDecisions — C12 object-auto-flatten path (line 508)", () => {
	it("returns shouldFlatten=true with flattenType 'object-auto-flatten' when single key matches moduleName", async () => {
		// Rule 7 / C12: an object module at `math/math.mjs` that exports `{ math: value }`
		// should auto-flatten because the single named export key equals the module name.
		const flatten = new Flatten(makeMock());

		const result = await flatten.buildCategoryDecisions({
			categoryName: "math",
			moduleName: "math",
			fileBaseName: "math.mjs", // ≠ "math" so C13 basename-match does not fire
			mod: { math: () => 1 }, // plain object, not a function — skips C10 and C16
			analysis: { hasDefault: false, defaultExportType: null }, // skips C11
			moduleKeys: ["math"],
			currentDepth: 1, // > 0 required for C12
			moduleFiles: [],
			t
		});

		expect(result.shouldFlatten).toBe(true);
		expect(result.flattenType).toBe("object-auto-flatten");
	});

	it("returns shouldFlatten=true for any single key matching moduleName at depth > 0", async () => {
		// Ensure the rule is not sensitive to the specific module name.
		const flatten = new Flatten(makeMock());

		const result = await flatten.buildCategoryDecisions({
			categoryName: "utils",
			moduleName: "utils",
			fileBaseName: "utils.mjs",
			mod: { utils: { greet: () => "hi" } },
			analysis: { hasDefault: false, defaultExportType: null },
			moduleKeys: ["utils"],
			currentDepth: 2,
			moduleFiles: [],
			t
		});

		expect(result.shouldFlatten).toBe(true);
		expect(result.flattenType).toBe("object-auto-flatten");
	});

	it("does NOT auto-flatten when the single key does not match moduleName", async () => {
		// If the export key differs from the module name, C12 should not fire.
		const flatten = new Flatten(makeMock());

		const result = await flatten.buildCategoryDecisions({
			categoryName: "math",
			moduleName: "math",
			fileBaseName: "math.mjs",
			mod: { operations: () => 1 }, // key "operations" ≠ "math"
			analysis: { hasDefault: false, defaultExportType: null },
			moduleKeys: ["operations"],
			currentDepth: 1,
			moduleFiles: [],
			t
		});

		// Should not trigger C12 auto-flatten.
		expect(result.shouldFlatten).not.toBe(true);
	});
});
