/**
 *
 *	@Project: @cldmv/slothlet
 *	@Filename: src/lib/i18n/translations.mjs
 *	@Date: 2026-01-20T20:25:54-08:00 (1768969554)
 *	@Author: Nate Corcoran <CLDMV>
 *	@Email: <Shinrai@users.noreply.github.com>
 *	-----
 *	@Last modified by: Nate Corcoran <CLDMV> (Shinrai@users.noreply.github.com)
 *	@Last modified time: 2026-11-28T04:30:46-08:00 (1795869046)
 *	-----
 *	@Copyright: Copyright (c) 2013-2026 Catalyzed Motivation Inc. All rights reserved.
 *
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
import { isNode, fs, path, url, loadJson } from "#helpers/platform";
import {
	ArrayMethods,
	Arrays,
	Boolean,
	filterList,
	mapList,
	listPush,
	listSplice,
	NativeProcess,
	navigator,
	Objects,
	regExpReplace,
	Set,
	setFrom,
	SetMethods,
	splitText,
	String,
	StringMethods,
	stringOf
} from "#helpers/intrinsics";
import { guardInternal, isOwnTopLevelOf, ownBindingsRefusal } from "#helpers/instance-imports";

/**
 * Get current directory path
 * @private
 */
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
const BASE_LOCALES = setFrom(["en-us"]);

/**
 * Node only: resolve a non-base locale to a filesystem path inside the optional @cldmv/slothlet-i18n
 * pack, or null when the pack isn't installed.
 * @param {string} lang - Language code (e.g. "es-mx").
 * @returns {string|null} Filesystem path to the pack locale, or null.
 * @private
 */
function i18n_resolvePackPath(lang) {
	try {
		const packPath = url.fileURLToPath(import.meta.resolve(`@cldmv/slothlet-i18n/language/${lang}.json`));
		// `import.meta.resolve` only maps the specifier through the pack's `./language/*` wildcard export;
		// it does NOT verify the target exists. Without this existence check, an installed pack makes EVERY
		// locale name "resolve" to a path — so a locale the pack doesn't ship (e.g. a regional `zz-ca`)
		// wrongly reads as present, and the env-language fallback never reaches the base locale.
		return fs.existsSync(packPath) ? packPath : null;
	} catch {
		return null;
	}
}

/**
 * Ordered list of refs to try when loading a NON-BASE locale: the @cldmv/slothlet-i18n pack first,
 * then the internal files (present under slothlet-dev), then nothing (the caller falls back to
 * en-us). Node refs are filesystem paths; browser refs are module specifiers resolved via the
 * page's importmap. Callers handle base locales before reaching here — the loaders early-return on
 * en-us and {@link i18n_languageFileExists} has its own base guard — so `lang` is never base.
 * @param {string} lang - Non-base language code (e.g. "es-mx").
 * @returns {string[]} Refs to try in priority order (possibly empty).
 * @private
 */
function i18n_localeRefs(lang) {
	/* v8 ignore if - browser arm: importmap-resolved specifiers; the single real-Chromium run can take
	   only one side of the `import.meta.resolve` capability check + one filter outcome, so it can't cover
	   every sub-branch here — keep the arm ignored rather than read as partially covered. */
	if (!isNode) {
		const specs = [`@cldmv/slothlet-i18n/language/${lang}.json`, `@cldmv/slothlet/i18n/language/${lang}.json`];
		if (typeof import.meta.resolve !== "function") return specs;
		return filterList(specs, (s) => {
			try {
				// import.meta.resolve(...) throws when `s` can't be resolved — that throw IS the test here.
				// Read into the expression rather than starting a statement with `import.meta`: CodeQL's JS
				// extractor mis-parses a statement that begins with it (js/syntax-error #104 — a false positive).
				return Boolean(import.meta.resolve(s));
			} catch {
				return false;
			}
		});
	}
	const refs = [];
	const packPath = i18n_resolvePackPath(lang);
	if (packPath) listPush(refs, packPath);
	const internal = path.join(translations_dirname, "languages", `${lang}.json`);
	if (fs.existsSync(internal)) listPush(refs, internal);
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
	if (!isNode) return SetMethods.has(KNOWN_LOCALES, lang);
	// Read into a local before branching: a bare `if (...)` immediately after the
	// browser guard makes v8→istanbul mis-merge this branch's else-arm count (it
	// goes negative across the full-suite merge, reading as uncovered).
	const isBaseLocale = SetMethods.has(BASE_LOCALES, lang);
	if (isBaseLocale) {
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
	const normalized = StringMethods.toLowerCase(regExpReplace(/_/g, splitText(splitText(String(envLang), ".")[0], "@")[0], "-"));

	if (normalized === "c" || normalized === "posix") return "en-us";

	// If the full locale exists (e.g. es-mx, es-es, en-gb), prefer it. Read into a local before the
	// branch: a function call in the `if` condition can make v8→istanbul mis-merge this branch's
	// else-arm to a negative count across the full-suite blob merge (reads as uncovered).
	const fullLocaleExists = i18n_languageFileExists(normalized);
	if (fullLocaleExists) return normalized;

	const base = splitText(normalized, "-")[0];
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
	if (!isNode) {
		// A real browser/worker always defines `navigator`; the `: null` arm is a defensive guard for
		// an exotic non-Node host without it (unreachable under real-Chromium coverage).
		const navLang = typeof navigator !== "undefined" ? navigator.languages?.[0] || navigator.language : /* v8 ignore next */ null;
		return navLang ? i18n_normalizeEnvLanguage(navLang) : "en-us";
	}
	// Try environment variables
	const envLang = NativeProcess.env.LANG || NativeProcess.env.LANGUAGE || NativeProcess.env.LC_ALL;
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
	// Genuinely unreachable in both hosts: the only caller (setLanguage) is node-gated, and in
	// a browser setLanguage takes the async arm and never calls this. Defensive guard.
	/* v8 ignore if */
	if (!isNode) return null;
	// Try each candidate ref in priority order (pack → internal); a miss falls through to en-us.
	for (let ofIndex = 0, ofList = i18n_localeRefs(lang); ofIndex < ofList.length; ofIndex++) {
		const ref = ofList[ofIndex];
		const langData = loadJson(ref);
		if (langData?.translations) return langData.translations;
	}
	return null;
}

/**
 * The process-level `SlothletWarning` class, registered by `errors.mjs` when it loads. The translations module
 * cannot import it (errors.mjs imports this module), so a failed locale load reaches it through here.
 * @type {(Function|null)}
 * @private
 */
let processWarningClass = null;

/**
 * Load failures reported before the warning class registered (the import-time auto-initialisation runs first).
 * They are raised once the class registers, so none is lost.
 * @type {string[]}
 * @private
 */
const pendingLoadFailures = [];

/**
 * Register the process-level `SlothletWarning` class (called once by `errors.mjs`).
 * @param {Function} WarningClass - The `SlothletWarning` class.
 * @returns {void}
 * @internal
 */
export function registerWarningClass(WarningClass) {
	// Only the first registration counts: errors.mjs makes it as it loads, and this export is reachable by anyone.
	if (processWarningClass !== null) return;
	processWarningClass = WarningClass;
	const held = listSplice(pendingLoadFailures, 0);
	for (let index = 0; index < held.length; index++) new WarningClass("WARNING_LANGUAGE_LOAD_FAILED", { lang: held[index] });
}

/**
 * Report a locale that failed to load as a coded, translated `WARNING_LANGUAGE_LOAD_FAILED` SlothletWarning (#820).
 * A call made through an instance passes that instance's warning class, so it is recorded there and printed unless the
 * instance is silent; a call made outside any instance uses the process-level class.
 * @param {string} lang - The language that failed to load.
 * @param {{SlothletWarning?: Function}} [options] - Instance warning class.
 * @returns {void}
 * @private
 */
function i18n_warnLoadFailed(lang, options) {
	const WarningClass = options?.SlothletWarning ?? processWarningClass;
	// errors.mjs registers the class when it loads, which is after this module's import-time initialisation. A
	// failure from that initialisation is held and raised on registration. The suite always has errors.mjs loaded
	// first, so the held case is not reproducible there.
	/* v8 ignore if */
	if (!WarningClass) {
		listPush(pendingLoadFailures, lang);
		return;
	}
	new WarningClass("WARNING_LANGUAGE_LOAD_FAILED", { lang });
}

/**
 * Set current language (synchronous)
 * Merges requested language translations over default English translations
 * @param {string} lang - Language code
 * @param {{SlothletWarning?: Function}} [options] - Warning class for a failed load
 * @public
 */
function setLanguage(lang, options) {
	// Always start with default English translations as base
	currentTranslations = { ...defaultTranslations.translations };

	if (lang === "en-us") {
		currentLanguage = "en-us";
		return;
	}

	if (!isNode) {
		// A browser can't read the locale synchronously; kick off the async load and swap it in
		// when (if) it resolves. setLanguageAsync warns + keeps en-us on a miss.
		void setLanguageAsync(lang, options);
		return;
	}

	// Node: synchronous load + merge.
	const langTranslations = i18n_loadLanguageSync(lang);
	if (langTranslations) {
		// Merge language translations over defaults (missing translations fall back to English)
		currentTranslations = { ...currentTranslations, ...langTranslations };
		currentLanguage = lang;
	} else {
		// If language load failed, warn and use English
		i18n_warnLoadFailed(lang, options);
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
 * @param {{SlothletWarning?: Function}} [options] - Warning class for a failed load
 * @returns {Promise<void>}
 * @public
 */
async function setLanguageAsync(lang, options) {
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
	for (let ofIndex = 0, ofList = i18n_localeRefs(lang); ofIndex < ofList.length; ofIndex++) {
		const ref = ofList[ofIndex];
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
		i18n_warnLoadFailed(lang, options);
		currentLanguage = "en-us";
	}
}

/**
 * Switch the process-wide language. One call for every environment: where the locale can be read synchronously (Node,
 * or `"en-us"`, which is bundled) the switch is done when it returns, and nothing is returned; where the load is
 * asynchronous (a browser) it returns a promise that settles once the locale is in place. `await language.set(x)`
 * works everywhere. A locale that fails to load raises `WARNING_LANGUAGE_LOAD_FAILED` and keeps `"en-us"`.
 * @param {string} lang - Language code (e.g. "es-mx").
 * @param {{SlothletWarning?: Function}} [options] - Warning class for a failed load.
 * @returns {Promise<void>|undefined} A promise only when the load is asynchronous.
 * @public
 * @example
 * language.set("es-mx");         // Node: switched on return
 * await language.set("es-mx");   // works in a browser too
 */
function setLanguageTo(lang, options) {
	if (isNode || lang === "en-us") {
		setLanguage(lang, options);
		return undefined;
	}
	return setLanguageAsync(lang, options);
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
	if (!template && StringMethods.startsWith(errorCode, "INVALID_CONFIG_")) {
		template = currentTranslations.INVALID_CONFIG_generic;
	}

	// Interpolate parameters. `{name}` renders a value; an array renders joined with "." (the paths slothlet reports
	// are segments arrays, shown in their dotted form). `{name.N}` renders one element of an array, and `{name|list}`
	// renders an array as a list ("a, b"). A placeholder with no value renders empty.
	let message = template || `Error: ${errorCode}`;
	const values = { __proto__: null };
	for (let ofIndex = 0, ofList = Objects.entries(params ?? {}); ofIndex < ofList.length; ofIndex++)
		values[ofList[ofIndex][0]] = ofList[ofIndex][1];
	message = regExpReplace(/\{(\w+)(?:\.(\d+))?(\|list)?\}/g, message, (whole, name, index, list) => {
		let value = values[name];
		if (index !== undefined) value = Arrays.isArray(value) ? value[index] : undefined;
		if (value === undefined) return "";
		if (Arrays.isArray(value))
			return ArrayMethods.join(
				mapList(value, (item) => stringOf(item)),
				list ? ", " : "."
			);
		return stringOf(value);
	});

	// Clean up empty placeholders (no surrounding \s* to avoid ReDoS on whitespace-heavy input)
	message = StringMethods.trim(regExpReplace(/\s+/g, regExpReplace(/\{\w+\}/g, message, ""), " "));

	return message;
}

/**
 * Initialize i18n system (synchronous)
 * @param {Object} options - Options
 * @param {string} [options.language] - Language code (auto-detect if not provided)
 * @public
 */
function initI18n(options = {}) {
	try {
		const lang = options.language || i18n_detectLanguage();
		if (!isNode) {
			currentLanguage = "en-us"; // bundled default until the async locale load resolves
			if (lang && lang !== "en-us") void setLanguageAsync(lang, options);
			return;
		}
		setLanguage(lang, options);
	} catch (___error) {
		// Silently fall back to en-us if initialization fails
		// The console as it is now: hosts and test runners point it elsewhere after slothlet loads.
		globalThis.console.warn("i18n initialization failed, using English:", ___error.message);
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

/**
 * This file's internal bindings, for the files of slothlet's own that use them: each of those files takes them once, as
 * it loads, and anyone else is refused (see `ownBindingsRefusal` in `helpers/instance-imports`).
 * @param {string} consumer - The file asking: its path in slothlet's code folder, without its extension.
 * @returns {object} The bindings.
 * @internal
 */
export function internals(consumer) {
	if (!mayTakeInternals(consumer, ["lib/builders/api_builder", "slothlet"]))
		throw ownBindingsRefusal("lib/i18n/translations", import.meta.url);
	return { initI18n, setLanguage: setLanguageTo };
}

/**
 * The files of slothlet's own that took this file's bindings (see {@link internals}). A `var` with no initializer, so a
 * file can take them before this file's top level has run (a cycle of slothlet's own files), and that run does not reset
 * what was taken.
 * @type {object|undefined}
 * @private
 */
var internalsTaken;

/**
 * Whether a file may take this file's bindings: it is one of those listed, and has not taken them yet. Reads no import
 * and no built-in a module can replace, so it answers the same before this file's imports are ready and after.
 * @param {string} consumer - The file asking.
 * @param {string[]} consumers - The files that take them.
 * @returns {boolean} True, once, for each file listed.
 * @private
 */
function mayTakeInternals(consumer, consumers) {
	if (internalsTaken === undefined) internalsTaken = { __proto__: null };
	let listed = false;
	for (let i = 0; i < consumers.length; i++) if (consumers[i] === consumer) listed = true;
	if (!listed || typeof consumer !== "string") return false;
	// Taken already: only a second evaluation of that very file, at its own top level, takes them again.
	if (internalsTaken[consumer] === true) return isOwnTopLevelOf(consumer);
	internalsTaken[consumer] = true;
	return true;
}

// The exports below answer slothlet's own files and the host only (see `guardInternal` in `helpers/instance-imports`).
/** @type {typeof setLanguage} */
const guarded_setLanguage = guardInternal(setLanguage, "setLanguage", import.meta.url);
/** @type {typeof setLanguageAsync} */
const guarded_setLanguageAsync = guardInternal(setLanguageAsync, "setLanguageAsync", import.meta.url);
/** @type {typeof initI18n} */
const guarded_initI18n = guardInternal(initI18n, "init", import.meta.url);
/** @type {typeof setLanguageTo} */
const guarded_setLanguageTo = guardInternal(setLanguageTo, "language.set", import.meta.url);

/**
 * The process-wide language: `language.get()` reads it, `language.set(lang)` switches it (see {@link setLanguageTo}).
 * @type {{get: typeof getLanguage, set: typeof setLanguageTo}}
 * @public
 * @example
 * import { language } from "@cldmv/slothlet/i18n";
 * language.set("es-mx");
 * language.get(); // "es-mx"
 */
export const language = Objects.freeze({ get: getLanguage, set: guarded_setLanguageTo });

export {
	guarded_setLanguage as setLanguage,
	guarded_setLanguageAsync as setLanguageAsync,
	guarded_initI18n as initI18n,
	guarded_initI18n as init
};
