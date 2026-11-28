/**
 * Register the process-level `SlothletWarning` class (called once by `errors.mjs`).
 * @param {Function} WarningClass - The `SlothletWarning` class.
 * @returns {void}
 * @internal
 */
export function registerWarningClass(WarningClass: Function): void;
/**
 * Get current language
 * @returns {string} Language code
 * @public
 */
export function getLanguage(): string;
/**
 * Translate error message with interpolation
 * @param {string} errorCode - Error code
 * @param {Object} params - Parameters for interpolation
 * @returns {string} Translated message
 * @public
 */
export function translate(errorCode: string, params?: Object): string;
/**
 * This file's internal bindings, for the files of slothlet's own that use them: each of those files takes them once, as
 * it loads, and anyone else is refused (see `ownBindingsRefusal` in `helpers/instance-imports`).
 * @param {string} consumer - The file asking: its path in slothlet's code folder, without its extension.
 * @returns {object} The bindings.
 * @internal
 */
export function internals(consumer: string): object;
/**
 * Translate error message with interpolation
 * @param {string} errorCode - Error code
 * @param {Object} params - Parameters for interpolation
 * @returns {string} Translated message
 * @public
 */
export function t(errorCode: string, params?: Object): string;
/**
 * The process-wide language: `language.get()` reads it, `language.set(lang)` switches it (see {@link setLanguageTo}).
 * @type {{get: typeof getLanguage, set: typeof setLanguageTo}}
 * @public
 * @example
 * import { language } from "@cldmv/slothlet/i18n";
 * language.set("es-mx");
 * language.get(); // "es-mx"
 */
export const language: {
    get: typeof getLanguage;
    set: typeof setLanguageTo;
};
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
declare function setLanguageTo(lang: string, options?: {
    SlothletWarning?: Function;
}): Promise<void> | undefined;
/** @type {typeof setLanguage} */
declare const guarded_setLanguage: typeof setLanguage;
/** @type {typeof setLanguageAsync} */
declare const guarded_setLanguageAsync: typeof setLanguageAsync;
/** @type {typeof initI18n} */
declare const guarded_initI18n: typeof initI18n;
/**
 * Set current language (synchronous)
 * Merges requested language translations over default English translations
 * @param {string} lang - Language code
 * @param {{SlothletWarning?: Function}} [options] - Warning class for a failed load
 * @public
 */
declare function setLanguage(lang: string, options?: {
    SlothletWarning?: Function;
}): void;
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
declare function setLanguageAsync(lang: string, options?: {
    SlothletWarning?: Function;
}): Promise<void>;
/**
 * Initialize i18n system (synchronous)
 * @param {Object} options - Options
 * @param {string} [options.language] - Language code (auto-detect if not provided)
 * @public
 */
declare function initI18n(options?: {
    language?: string | undefined;
}): void;
export { guarded_setLanguage as setLanguage, guarded_setLanguageAsync as setLanguageAsync, guarded_initI18n as initI18n, guarded_initI18n as init };
//# sourceMappingURL=translations.d.mts.map