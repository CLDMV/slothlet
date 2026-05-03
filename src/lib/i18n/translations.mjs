/**
 *	@Project: @cldmv/slothlet
 *	@Filename: /src/lib/i18n/translations.mjs
 *	@Date: 2026-01-20 20:25:54 -08:00 (1737432354)
 *	@Author: Nate Corcoran <CLDMV>
 *	@Email: <Shinrai@users.noreply.github.com>
 *	-----
 *	@Last modified by: Nate Corcoran <CLDMV> (Shinrai@users.noreply.github.com)
 *	@Last modified time: 2026-05-02 16:16:03 -07:00 (1777763763)
 *	-----
 *	@Copyright: Copyright (c) 2013-2026 Catalyzed Motivation Inc. All rights reserved.
 */

/**
 * @fileoverview i18n translation system for Slothlet errors
 * @module @cldmv/slothlet/i18n
 * @internal
 */

import { existsSync, readFileSync } from "fs";
import { fileURLToPath } from "url";
import { dirname, join } from "path";

/**
 * Get current directory path
 * @private
 */
const translations_dirname = dirname(fileURLToPath(import.meta.url));

/**
 * Default English translations (loaded synchronously)
 * @private
 */
const defaultTranslations = JSON.parse(readFileSync(join(translations_dirname, "languages", "en-us.json"), "utf-8"));

/**
 * Current translations (merged language + defaults)
 * @private
 */
let currentTranslations = defaultTranslations.translations;

/**
 * Current language code
 * @private
 */
let currentLanguage = "en-us";

/**
 * Default locale fallbacks for base language tags.
 * @private
 */
const i18n_languageFallbacks = {
	en: "en-us",
	es: "es-mx",
	de: "de-de",
	fr: "fr-fr",
	hi: "hi-in",
	ja: "ja-jp",
	ko: "ko-kr",
	pt: "pt-br",
	ru: "ru-ru",
	zh: "zh-cn"
};

/**
 * Check whether a locale file exists without parsing JSON.
 *
 * @param {string} lang - Language code (e.g., "en-us", "es-es").
 * @returns {boolean} True when the locale file exists on disk.
 * @private
 */
function i18n_languageFileExists(lang) {
	const langFilePath = join(translations_dirname, "languages", `${lang}.json`);
	return existsSync(langFilePath);
}

/**
 * Normalize an environment locale string to a supported language code.
 * Preserves explicit region tags when a matching locale file exists.
 * Falls back to sensible defaults for known base language tags.
 * @param {string} envLang - Raw language string from environment.
 * @returns {string} Normalized language code.
 * @private
 */
function i18n_normalizeEnvLanguage(envLang) {
	const normalized = String(envLang).split(".")[0].split("@")[0].replace(/_/g, "-").toLowerCase();

	if (normalized === "c" || normalized === "posix") return "en-us";

	// If the full locale exists (e.g. es-mx, es-es, en-gb), prefer it.
	if (i18n_languageFileExists(normalized)) return normalized;

	const base = normalized.split("-")[0];
	if (!base) return "en-us";

	// If a base language file exists directly, use it.
	if (i18n_languageFileExists(base)) return base;

	return i18n_languageFallbacks[base] || base;
}

/**
 * Detect system language from environment
 * @returns {string} Language code
 * @private
 */
function i18n_detectLanguage() {
	// Try environment variables
	const envLang = process.env.LANG || process.env.LANGUAGE || process.env.LC_ALL;
	if (envLang) {
		return i18n_normalizeEnvLanguage(envLang);
	}

	// Default to English (US)
	return "en-us";
}

/**
 * Load a language module synchronously
 * @param {string} lang - Language code (e.g., "en-us", "es-es")
 * @returns {Object} Language translations
 * @private
 */
function i18n_loadLanguageSync(lang) {
	try {
		// Load language JSON file synchronously
		const langFilePath = join(translations_dirname, "languages", `${lang}.json`);
		const langData = JSON.parse(readFileSync(langFilePath, "utf-8"));
		return langData.translations;
	} catch (___error) {
		// If loading fails, return null to indicate failure
		return null;
	}
}

/**
 * Set current language (synchronous)
 * Merges requested language translations over default English translations
 * @param {string} lang - Language code
 * @public
 */
export function setLanguage(lang) {
	// Always start with default English translations as base
	currentTranslations = { ...defaultTranslations.translations };

	// If not English, try to load and merge the requested language
	if (lang !== "en-us") {
		const langTranslations = i18n_loadLanguageSync(lang);
		if (langTranslations) {
			// Merge language translations over defaults (missing translations fall back to English)
			currentTranslations = { ...currentTranslations, ...langTranslations };
			currentLanguage = lang;
		} else {
			// If language load failed, warn and use English
			console.warn(`Failed to load language '${lang}', falling back to English.`);
			currentLanguage = "en-us";
		}
	} else {
		currentLanguage = "en-us";
	}
}

/**
 * Get current language
 * @returns {string} Language code
 * @public
 */
export function getLanguage() {
	return currentLanguage;
}

/**
 * Translate error message with interpolation
 * @param {string} errorCode - Error code
 * @param {Object} params - Parameters for interpolation
 * @returns {string} Translated message
 * @public
 */
export function translate(errorCode, params = {}) {
	// Use currentTranslations (already merged with defaults)
	let template = currentTranslations[errorCode];

	// Fallback to generic message if specific one not found
	if (!template && errorCode.startsWith("INVALID_CONFIG_")) {
		template = currentTranslations.INVALID_CONFIG_generic;
	}

	// Interpolate parameters
	let message = template || `Error: ${errorCode}`;
	for (const [key, value] of Object.entries(params)) {
		message = message.replace(new RegExp(`\\{${key}\\}`, "g"), value !== undefined ? String(value) : "");
	}

	// Clean up empty placeholders (no surrounding \s* to avoid ReDoS on whitespace-heavy input)
	message = message
		.replace(/\{\w+\}/g, "")
		.replace(/\s+/g, " ")
		.trim();

	return message;
}

/**
 * Initialize i18n system (synchronous)
 * @param {Object} options - Options
 * @param {string} [options.language] - Language code (auto-detect if not provided)
 * @public
 */
export function initI18n(options = {}) {
	try {
		if (options.language) {
			setLanguage(options.language);
		} else {
			// Auto-detect from environment
			const detected = i18n_detectLanguage();
			setLanguage(detected);
		}
	} catch (___error) {
		// Silently fall back to en-us if initialization fails
		console.warn("i18n initialization failed, using English:", ___error.message);
		currentLanguage = "en-us";
		currentTranslations = defaultTranslations.translations;
	}
}

// Auto-initialize on first import (now synchronous)
initI18n();

/**
 * Shorthand for translate
 * @public
 */
export const t = translate;
