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

import defaultTranslations from "./languages/en-us.json" with { type: "json" };

// Node-only on-disk locale loading resolved via the platform module so fs/url/path stay out of the
// browser static graph (#123). The default (en-us) is bundled via the JSON import above; additional
// on-disk locales load only under Node — a browser keeps the bundled default.
import { isNode, fs, path, url, loadJson } from "@cldmv/slothlet/helpers/platform";

/**
 * Get current directory path
 * @private
 */
/* v8 ignore next - browser-only: the `: null` arm fires only in a browser (no filesystem) */
const translations_dirname = isNode ? path.dirname(url.fileURLToPath(import.meta.url)) : null;

// `defaultTranslations` is imported as a JSON module at the top of this file, so the default
// locale is available in a browser (bundled) with no filesystem access.

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
 * Shipped locale codes — used in a browser, which has no filesystem to probe. Node checks the
 * filesystem directly (see {@link i18n_languageFileExists}). Kept in sync with `languages/*.json`;
 * the i18n test suite asserts this list matches the shipped files so it can't silently drift.
 * @private
 */
const KNOWN_LOCALES = new Set(["de-de", "en-gb", "en-us", "es-es", "es-mx", "fr-fr", "hi-in", "ja-jp", "ko-kr", "pt-br", "ru-ru", "zh-cn"]);

/**
 * Locales bundled in @cldmv/slothlet itself. en-us is the statically-imported base/fallback and the
 * only locale the published core ships; every other locale resolves from the optional
 * @cldmv/slothlet-i18n pack (or, under slothlet-dev, the internal source files that stay in place).
 * @private
 */
const BASE_LOCALES = new Set(["en-us"]);

/**
 * Node only: resolve a non-base locale to a filesystem path inside the optional @cldmv/slothlet-i18n
 * pack, or null when the pack isn't installed.
 * @param {string} lang - Language code (e.g. "es-mx").
 * @returns {string|null} Filesystem path to the pack locale, or null.
 * @private
 */
function i18n_resolvePackPath(lang) {
	try {
		return url.fileURLToPath(import.meta.resolve(`@cldmv/slothlet-i18n/language/${lang}.json`));
	} catch {
		return null;
	}
}

/**
 * Ordered list of refs to try when loading a locale: the @cldmv/slothlet-i18n pack first, then the
 * internal files (present under slothlet-dev), then nothing (the caller falls back to en-us). Node
 * refs are filesystem paths; browser refs are module specifiers resolved via the page's importmap.
 * @param {string} lang - Language code (e.g. "es-mx").
 * @returns {string[]} Refs to try in priority order (possibly empty).
 * @private
 */
function i18n_localeRefs(lang) {
	/* v8 ignore start - browser arm: specifiers resolve via the importmap; node coverage exercises the path arm */
	if (!isNode) {
		if (BASE_LOCALES.has(lang)) return [`@cldmv/slothlet/i18n/language/${lang}.json`];
		const specs = [`@cldmv/slothlet-i18n/language/${lang}.json`, `@cldmv/slothlet/i18n/language/${lang}.json`];
		if (typeof import.meta.resolve !== "function") return specs;
		return specs.filter((s) => {
			try {
				import.meta.resolve(s);
				return true;
			} catch {
				return false;
			}
		});
	}
	/* v8 ignore stop */
	if (BASE_LOCALES.has(lang)) return [path.join(translations_dirname, "languages", `${lang}.json`)];
	const refs = [];
	const packPath = i18n_resolvePackPath(lang);
	if (packPath) refs.push(packPath);
	const internal = path.join(translations_dirname, "languages", `${lang}.json`);
	if (fs.existsSync(internal)) refs.push(internal);
	return refs;
}

/**
 * Check whether a locale file exists without parsing JSON.
 *
 * @param {string} lang - Language code (e.g., "en-us", "es-es").
 * @returns {boolean} True when the locale file exists on disk.
 * @private
 */
function i18n_languageFileExists(lang) {
	/* v8 ignore start - browser-only: no on-disk locales; check the static known-locale list */
	if (!isNode) return KNOWN_LOCALES.has(lang);
	/* v8 ignore stop */
	if (BASE_LOCALES.has(lang)) {
		return fs.existsSync(path.join(translations_dirname, "languages", `${lang}.json`));
	}
	return i18n_localeRefs(lang).length > 0;
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
	/* v8 ignore start - browser-only: detect from navigator.languages, not process.env */
	if (!isNode) {
		const navLang = typeof navigator !== "undefined" ? navigator.languages?.[0] || navigator.language : null;
		return navLang ? i18n_normalizeEnvLanguage(navLang) : "en-us";
	}
	/* v8 ignore stop */
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
	/* v8 ignore start - browser-only: no synchronous on-disk locales, only the bundled default */
	if (!isNode) return null;
	/* v8 ignore stop */
	// Try each candidate ref in priority order (pack → internal); a miss falls through to en-us.
	for (const ref of i18n_localeRefs(lang)) {
		const langData = loadJson(ref);
		if (langData?.translations) return langData.translations;
	}
	return null;
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

	if (lang === "en-us") {
		currentLanguage = "en-us";
		return;
	}

	/* v8 ignore start - browser-only: load asynchronously (fire-and-forget); en-us shows until it resolves */
	if (!isNode) {
		// A browser can't read the locale synchronously; kick off the async load and swap it in
		// when (if) it resolves. setLanguageAsync warns + keeps en-us on a miss.
		void setLanguageAsync(lang);
		return;
	}
	/* v8 ignore stop */

	// Node: synchronous load + merge.
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
}

/**
 * Set the current language asynchronously — the browser-capable path.
 *
 * @description
 * Mirrors {@link setLanguage}, but awaits the locale load so it works in a browser, where locales
 * arrive via dynamic `import(…, { with: { type: "json" } })` rather than the filesystem. In Node it
 * awaits the same synchronous read (the await is a no-op). A failed load warns and keeps the bundled
 * English default. Use this when you need to *await* a locale switch (e.g. in an Electron renderer).
 * @param {string} lang - Language code (e.g. "es-mx").
 * @returns {Promise<void>}
 * @public
 */
export async function setLanguageAsync(lang) {
	// Always start from the bundled English base.
	currentTranslations = { ...defaultTranslations.translations };
	if (lang === "en-us") {
		currentLanguage = "en-us";
		return;
	}
	// Until the (possibly async, in a browser) load resolves, the active translations are the
	// bundled English defaults set above — keep currentLanguage consistent with them rather than
	// leaving it on the previous locale; the success branch below overwrites it with `lang`.
	currentLanguage = "en-us";
	// loadJson is synchronous (object) in Node and asynchronous (Promise) in a browser; `await`
	// transparently handles both forms. Try each candidate ref in priority order (pack → internal).
	let langData = null;
	for (const ref of i18n_localeRefs(lang)) {
		const data = await loadJson(ref);
		if (data?.translations) {
			langData = data;
			break;
		}
	}
	if (langData?.translations) {
		currentTranslations = { ...currentTranslations, ...langData.translations };
		currentLanguage = lang;
	} else {
		console.warn(`Failed to load language '${lang}', falling back to English.`);
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
		const lang = options.language || i18n_detectLanguage();
		/* v8 ignore start - browser-only: async detect + load; the bundled en-us shows until it resolves */
		if (!isNode) {
			currentLanguage = "en-us"; // bundled default until the async locale load resolves
			if (lang && lang !== "en-us") void setLanguageAsync(lang);
			return;
		}
		/* v8 ignore stop */
		setLanguage(lang);
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
