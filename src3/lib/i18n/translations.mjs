/**
 * @fileoverview i18n translation system for Slothlet errors
 * @module @cldmv/slothlet/i18n
 */

/**
 * Loaded language modules cache
 * @private
 */
const loadedLanguages = new Map();

/**
 * Current language (default: en-us)
 * @private
 */
let currentLanguage = "en-us";

/**
 * Detect system language from environment
 * @returns {string} Language code
 * @private
 */
function i18n_detectLanguage() {
	// Try environment variables
	const envLang = process.env.LANG || process.env.LANGUAGE || process.env.LC_ALL;
	if (envLang) {
		const lang = envLang.split(".")[0].split("_")[0].toLowerCase();
		// Convert to our format (e.g., "en" -> "en-us")
		if (lang === "en") return "en-us";
		if (lang === "es") return "es-mx";
		return lang;
	}

	// Default to English (US)
	return "en-us";
}

/**
 * Load a language module
 * @param {string} lang - Language code (e.g., "en-us", "es-mx")
 * @returns {Promise<Object>} Language module with translations
 * @private
 */
async function i18n_loadLanguage(lang) {
	if (loadedLanguages.has(lang)) {
		return loadedLanguages.get(lang);
	}

	try {
		// Import language module dynamically
		const module = await import(`@cldmv/slothlet/i18n/${lang}`);
		loadedLanguages.set(lang, module);
		return module;
	} catch (___error) {
		console.warn(t("WARNING_LANGUAGE_LOAD_FAILED", { lang }));
		if (lang !== "en-us") {
			return i18n_loadLanguage("en-us");
		}
		throw ___error;
	}
}

/**
 * Set current language
 * @param {string} lang - Language code
 * @public
 */
export async function setLanguage(lang) {
	try {
		await i18n_loadLanguage(lang);
		currentLanguage = lang;
	} catch (___error) {
		console.warn(t("WARNING_LANGUAGE_UNAVAILABLE", { lang }));
		currentLanguage = "en-us";
		await i18n_loadLanguage("en-us");
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
	// Get already-loaded language (loaded at module init time)
	const langModule = loadedLanguages.get(currentLanguage);
	if (!langModule) {
		// Fallback to raw code if language somehow not loaded
		return `[${errorCode}]`;
	}

	const lang = langModule.translations;
	let template = lang[errorCode];

	// Fallback to generic message if specific one not found
	if (!template && errorCode.startsWith("INVALID_CONFIG_")) {
		template = lang.INVALID_CONFIG_generic;
	}

	// Interpolate parameters
	let message = template || `Error: ${errorCode}`;
	for (const [key, value] of Object.entries(params)) {
		message = message.replace(new RegExp(`\\{${key}\\}`, "g"), value !== undefined ? String(value) : "");
	}

	// Clean up empty placeholders
	message = message
		.replace(/\s*\{\w+\}\s*/g, " ")
		.replace(/\s+/g, " ")
		.trim();

	return message;
}

/**
 * Initialize i18n system
 * @param {Object} options - Options
 * @param {string} [options.language] - Language code (auto-detect if not provided)
 * @public
 */
export async function initI18n(options = {}) {
	if (options.language) {
		await setLanguage(options.language);
	} else {
		// Auto-detect from environment
		const detected = i18n_detectLanguage();
		await setLanguage(detected);
	}
}

// Auto-initialize on first import (returns promise)
initI18n().catch((___error) => {
	// Silently fall back to en-us if initialization fails
	currentLanguage = "en-us";
});

/**
 * Shorthand for translate
 * @public
 */
export const t = translate;
