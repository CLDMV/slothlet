/**
 *	@Project: @cldmv/slothlet
 *	@Filename: /tests/vitests/suites/processors/flatten-branches.test.vitest.mjs
 *	@Date: 2026-02-26T19:02:54-08:00 (1772161374)
 *	@Author: Nate Hyson <CLDMV>
 *	@Email: <Shinrai@users.noreply.github.com>
 *	-----
 *	@Last modified by: Nate Hyson <CLDMV> (Shinrai@users.noreply.github.com)
 *	@Last modified time: 2026-02-28 13:23:07 -08:00 (1772313787)
 *	-----
 *	@Copyright: Copyright (c) 2013-2026 Catalyzed Motivation Inc. All rights reserved.
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

		expect(
			flatten.shouldAttachNamedExport(
				null,
				"someValue",
				() => {},
				() => {}
			)
		).toBe(false);
	});

	it("returns false when key is an empty string (line 532)", () => {
		// `!key` is truthy for an empty string.
		const flatten = new Flatten(makeMock());

		expect(
			flatten.shouldAttachNamedExport(
				"",
				"someValue",
				() => {},
				() => {}
			)
		).toBe(false);
	});

	it("returns false when key is 'default' (line 532)", () => {
		// The literal string "default" is explicitly rejected.
		const flatten = new Flatten(makeMock());

		expect(
			flatten.shouldAttachNamedExport(
				"default",
				"someValue",
				() => {},
				() => {}
			)
		).toBe(false);
	});

	it("returns false when key equals defaultFunc.name (line 538)", () => {
		// When the key matches the wrapped default function's name, re-exporting it would
		// create a duplicate and should be skipped.
		// IMPORTANT: value must be a DIFFERENT reference from both defaultFunc and
		// originalDefault so the early reference-equality check (line 534) does not fire
		// first — only then does execution reach the name-equality guard at line 537-538.
		const flatten = new Flatten(makeMock());

		/** @returns {number} */
		function computeSum() {
			return 42;
		}

		const originalDefault = function originalFn() {};
		const differentValue = 99; // not the same reference as computeSum or originalFn

		// key "computeSum" === computeSum.name → line 538 fires.
		expect(flatten.shouldAttachNamedExport("computeSum", differentValue, computeSum, originalDefault)).toBe(false);
	});

	it("returns false when key equals originalDefault.name (line 541)", () => {
		// When defaultFunc.name does NOT match key but originalDefault.name does,
		// line 541's guard fires.
		// IMPORTANT: value must differ from both, and key must differ from defaultFunc.name,
		// so lines 534 and 538 are skipped before reaching line 540-541.
		const flatten = new Flatten(makeMock());

		function parseJSON() {
			return {};
		}

		// defaultFunc has a different name so line 537-538 skips; originalDefault.name matches.
		const defaultWrapper = function wrappedFn() {};
		const differentValue = "some-string"; // not the same reference as either function

		expect(flatten.shouldAttachNamedExport("parseJSON", differentValue, defaultWrapper, parseJSON)).toBe(false);
	});

	it("returns true when key is a regular export with no name collision (line 543)", () => {
		// Regression guard: a plain non-special key should pass all guards.
		const flatten = new Flatten(makeMock());

		function helperFn() {}

		expect(
			flatten.shouldAttachNamedExport(
				"helper",
				helperFn,
				() => {},
				() => {}
			)
		).toBe(true);
	});
});

// ─── buildCategoryDecisions — C12 object-auto-flatten (line 508) ─────────────

describe("Flatten.buildCategoryDecisions — C12 object-auto-flatten path (line 508)", () => {
	it("returns shouldFlatten=true via C12 when single key matches moduleName at depth > 0", async () => {
		// Rule 7 / C12: an object module at `math/math.mjs` that exports `{ math: value }`
		// should auto-flatten because the single named export key equals the module name.
		// C12 fires before C18 when moduleName === categoryName && currentDepth > 0.
		const flatten = new Flatten(makeMock());

		const result = await flatten.buildCategoryDecisions({
			categoryName: "math",
			moduleName: "math",
			fileBaseName: "math.mjs", // ≠ "math" so C13 basename-match does not fire
			mod: { math: () => 1 }, // plain object, not a function — skips C10 and C16
			analysis: { hasDefault: false, defaultExportType: null }, // skips C11
			moduleKeys: ["math"],
			currentDepth: 1, // > 0 required for C12 to fire before C18
			moduleFiles: [],
			t
		});

		expect(result.shouldFlatten).toBe(true);
		expect(result.flattenType).toBe("object-auto-flatten");
	});

	it("returns shouldFlatten=true via C18 (final check) when single key matches moduleName at depth=0 (line 506)", async () => {
		// Rule 7 / C18 (final fallback check): fires when earlier conditions (C12, etc.) are skipped.
		// With currentDepth=0, C12 does not fire (it requires depth > 0), so the final
		// C18 check at line 504-511 becomes the first to match.
		// This covers the specifically uncovered line 506 (`return { shouldFlatten: true... }`).
		const flatten = new Flatten(makeMock());

		const result = await flatten.buildCategoryDecisions({
			categoryName: "math",
			moduleName: "math",
			fileBaseName: "math.mjs",
			mod: { math: () => 1 },
			analysis: { hasDefault: false, defaultExportType: null },
			moduleKeys: ["math"],
			currentDepth: 0, // = 0 → C12 skipped (requires > 0) → C18 fires at line 504-511
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
