/**
 * Set current language (synchronous)
 * Merges requested language translations over default English translations
 * @param {string} lang - Language code
 * @public
 */
export function setLanguage(lang: string): void;
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
export function translate(errorCode: string, params?: any): string;
/**
 * Initialize i18n system (synchronous)
 * @param {Object} options - Options
 * @param {string} [options.language] - Language code (auto-detect if not provided)
 * @public
 */
export function initI18n(options?: {
    language?: string;
}): void;
/**
 * Translate error message with interpolation
 * @param {string} errorCode - Error code
 * @param {Object} params - Parameters for interpolation
 * @returns {string} Translated message
 * @public
 */
export function t(errorCode: string, params?: any): string;
//# sourceMappingURL=translations.d.mts.map