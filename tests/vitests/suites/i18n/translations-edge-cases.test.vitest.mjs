/**
 *	@Project: @cldmv/slothlet
 *	@Filename: /tests/vitests/suites/i18n/translations-edge-cases.test.vitest.mjs
 *	@Date: 2026-02-26 00:00:00 -08:00
 *	@Author: Nate Hyson <CLDMV>
 *	@Email: <Shinrai@users.noreply.github.com>
 *	-----
 *	@Copyright: Copyright (c) 2013-2026 Catalyzed Motivation Inc. All rights reserved.
 */

/**
 * @fileoverview Unit tests for translations.mjs uncovered edge-case branches.
 *
 * @description
 * Targets the branches not reached by integration tests:
 * - Line 103-105: `setLanguage` else-branch when language JSON fails to load
 *   (console.warn + currentLanguage reset to "en-us")
 * - Line 133-134: `translate` fallback to `INVALID_CONFIG_generic` template
 *   when an `INVALID_CONFIG_*` code has no specific translation
 * - Lines 167-171: `initI18n` catch-block when options argument is null
 *   (TypeError propagates into the outer try/catch)
 *
 * Imports the internal functions directly via the `@cldmv/slothlet/i18n` export.
 *
 * @module tests/vitests/suites/i18n/translations-edge-cases.test.vitest
 */

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { setLanguage, translate, initI18n, getLanguage } from "@cldmv/slothlet/i18n";

describe("translations.mjs edge cases", () => {
	let warnSpy;

	beforeEach(() => {
		warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});
	});

	afterEach(() => {
		warnSpy.mockRestore();
		// Restore to default English so tests remain isolated
		setLanguage("en-us");
	});

	// ─── setLanguage failure path (lines 103-105) ───────────────────────────

	it("should log a warning and fall back to 'en-us' when the language file cannot be loaded", () => {
		// "zz" is not a valid language; its JSON file does not exist in languages/
		// → i18n_loadLanguageSync returns null → else branch fires (lines 103-105)
		setLanguage("zz");

		// console.warn should have been called with the failure message
		expect(warnSpy).toHaveBeenCalledWith(expect.stringContaining("Failed to load language 'zz'"));

		// Language should reset to the English fallback
		expect(getLanguage()).toBe("en-us");
	});

	it("should still produce valid translations after recovering from a failed setLanguage call", () => {
		setLanguage("totally-invalid-lang-code");
		// After recovery, translate() should still work normally with English defaults
		const msg = translate("MODULE_NOT_FOUND", { modulePath: "./api.mjs" });
		expect(typeof msg).toBe("string");
		expect(msg.length).toBeGreaterThan(0);
	});

	// ─── translate INVALID_CONFIG_ generic fallback (line 133-134) ──────────

	it("should use INVALID_CONFIG_generic template for unknown INVALID_CONFIG_* codes (line 134)", () => {
		// Code starts with INVALID_CONFIG_ but has no specific entry → line 133 if-branch fires
		// and line 134 assigns currentTranslations.INVALID_CONFIG_generic (may be undefined)
		const result = translate("INVALID_CONFIG_TOTALLY_UNKNOWN_KEY_ZZ");
		// Must return a non-empty string (either the generic template or the Error: fallback)
		expect(typeof result).toBe("string");
		expect(result.length).toBeGreaterThan(0);
	});

	it("should interpolate params even when falling back via INVALID_CONFIG_generic", () => {
		// Ensure parameter interpolation still runs after the generic fallback path
		const result = translate("INVALID_CONFIG_TOTALLY_UNKNOWN_KEY_ZZ", { field: "testField" });
		expect(typeof result).toBe("string");
	});

	// ─── initI18n catch-block (lines 167-171) ───────────────────────────────

	it("should catch and handle errors gracefully inside initI18n when options is null (lines 167-171)", () => {
		// Passing null triggers: `options.language` → TypeError (null has no properties)
		// The catch block fires, console.warn is called, and i18n falls back to defaults
		initI18n(null);

		// console.warn should have been called with the initialization failure message
		expect(warnSpy).toHaveBeenCalledWith(expect.stringContaining("i18n initialization failed"), expect.any(String));
	});

	it("should remain functional (language = 'en-us') after initI18n catches an error", () => {
		initI18n(null);
		// Translations should still produce valid output after the fallback
		const msg = translate("MODULE_NOT_FOUND", { modulePath: "./x.mjs" });
		expect(typeof msg).toBe("string");
		expect(msg.length).toBeGreaterThan(0);
		expect(getLanguage()).toBe("en-us");
	});
});
