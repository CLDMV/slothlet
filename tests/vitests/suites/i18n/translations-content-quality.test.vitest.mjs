/**
 *	@Project: @cldmv/slothlet
 *	@Filename: /tests/vitests/suites/i18n/translations-content-quality.test.vitest.mjs
 *	@Date: 2026-05-02T00:00:00-08:00 (1746086400)
 *	@Author: Nate Corcoran <CLDMV>
 *	@Email: <Shinrai@users.noreply.github.com>
 *	-----
 *	@Last modified by: Nate Corcoran <CLDMV> (Shinrai@users.noreply.github.com)
 *	@Last modified time: 2026-05-02 17:11:07 -07:00 (1777767067)
 *	-----
 *	@Copyright: Copyright (c) 2013-2026 Catalyzed Motivation Inc. All rights reserved.
 */

/**
 * @fileoverview Unit tests for translation content quality.
 *
 * Verifies that all non-English locales have properly localized content (translations
 * are not identical to English). This catches instances where a locale file was created
 * but translation keys were never actually translated.
 *
 * Tests catch the following issues:
 * - Untranslated keys (value matches English exactly)
 * - Missing keys in non-English locales
 * - Locale files that weren't properly regionalized
 *
 * @module tests/vitests/suites/i18n/translations-content-quality
 */

import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = fileURLToPath(new URL(".", import.meta.url));
const rootDir = join(__dirname, "../../../..");
const languagesDir = join(rootDir, "src/lib/i18n/languages");

/**
 * Load a language JSON file and return the translations object.
 * @param {string} locale - Locale code (e.g., "en-us", "es-es")
 * @returns {object} Translations object with all keys
 */
function loadLanguage(locale) {
	const filePath = join(languagesDir, `${locale}.json`);
	const content = readFileSync(filePath, "utf-8");
	const data = JSON.parse(content);
	return data.translations || {};
}

/**
 * Get all available locales from the languages directory.
 * @returns {Array<string>} Array of locale codes
 */
function getAvailableLocales() {
	const fs = require("node:fs");
	const files = fs.readdirSync(languagesDir);
	return files.filter((f) => f.endsWith(".json") && f !== "en-us.json").map((f) => f.replace(".json", ""));
}

describe("Translation Content Quality", () => {
	const enUs = loadLanguage("en-us");
	const enUsKeys = Object.keys(enUs);
	const locales = getAvailableLocales();

	describe("All non-English locales should differ from English baseline", () => {
		for (const locale of locales) {
			it(`${locale} should not have untranslated keys (values matching English)`, () => {
				const localeData = loadLanguage(locale);

				// Track untranslated keys for this locale
				const untranslated = [];

				for (const key of enUsKeys) {
					// Skip HINT_ keys - these are meta-keys, not user-facing translations
					if (key.startsWith("HINT_")) {
						continue;
					}

					const enUsValue = enUs[key];
					const localeValue = localeData[key];

					// Key should exist
					expect(localeValue).toBeDefined(`Missing key "${key}" in locale ${locale}`);

					// Value should not be identical to English (unless it's a proper noun or special case)
					// Allow for a small list of exceptions that legitimately should match English
					const allowIdenticalTo = ["en-gb"]; // British English can share many terms with US English
					const isAllowedIdentical = allowIdenticalTo.includes(locale);

					if (localeValue === enUsValue && !isAllowedIdentical) {
						untranslated.push({
							key,
							value: enUsValue
						});
					}
				}

				if (untranslated.length > 0) {
					const summary = untranslated
						.slice(0, 5)
						.map((item) => `  ${item.key}: "${item.value}"`)
						.join("\n");
					const remaining = untranslated.length > 5 ? `\n  ... and ${untranslated.length - 5} more` : "";
					throw new Error(`${locale} has ${untranslated.length} untranslated key(s):\n${summary}${remaining}`);
				}
			});

			it(`${locale} should have all required keys from English baseline`, () => {
				const localeData = loadLanguage(locale);
				const missingKeys = [];

				for (const key of enUsKeys) {
					if (!Object.prototype.hasOwnProperty.call(localeData, key)) {
						missingKeys.push(key);
					}
				}

				if (missingKeys.length > 0) {
					const listed = missingKeys.slice(0, 10).join(", ");
					const remaining = missingKeys.length > 10 ? ` ... and ${missingKeys.length - 10} more` : "";
					throw new Error(`${locale} is missing ${missingKeys.length} key(s): ${listed}${remaining}`);
				}
			});
		}
	});

	it("should have consistent locale count between English and all other locales", () => {
		const enUsCount = enUsKeys.length;

		for (const locale of locales) {
			const localeData = loadLanguage(locale);
			const localeCount = Object.keys(localeData).length;

			expect(localeCount).toBe(enUsCount, `${locale} has ${localeCount} keys but English has ${enUsCount}`);
		}
	});
});
