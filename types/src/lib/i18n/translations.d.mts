/**
 * Set current language (synchronous)
 * Merges requested language translations over default English translations
 * @param {string} lang - Language code
 * @public
 */
export function setLanguage(lang: string): void;
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
export function setLanguageAsync(lang: string): Promise<void>;
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
 * Initialize i18n system (synchronous)
 * @param {Object} options - Options
 * @param {string} [options.language] - Language code (auto-detect if not provided)
 * @public
 */
export function initI18n(options?: {
    language?: string | undefined;
}): void;
/**
 * Translate error message with interpolation
 * @param {string} errorCode - Error code
 * @param {Object} params - Parameters for interpolation
 * @returns {string} Translated message
 * @public
 */
export function t(errorCode: string, params?: Object): string;
//# sourceMappingURL=translations.d.mts.map