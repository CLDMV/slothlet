/**
 * Debug utility class for centralized conditional console output with i18n
 * @internal
 */
export class SlothletDebug {
    /**
     * Create a debug logger instance bound to a config
     * @param {Object} config - Configuration object (typically slothlet.config)
     * @public
     */
    constructor(config?: Object);
    config: Object;
    debugFlags: any;
    /**
     * Log a debug message if the code's debug flag is enabled
     * @param {string} code - Debug code/category (e.g., "modes", "wrapper", "api")
     * @param {Object} context - Contextual information to display
     * @param {string} [context.key] - Translation key for the message (e.g. "DEBUG_MODE_FLATTENING").
     *   When provided, translates via i18n using the remaining context properties as interpolation
     *   params - no `await t()` needed at the call site. Falls back to `DEBUG_{CODE}` category key
     *   if omitted, then to `context.message` for backwards compatibility.
     * @param {string} [context.message] - Raw message string (backwards-compat fallback).
     *   Prefer `context.key` for new call sites so messages are translatable.
     * @public
     *
     * @description
     * Centralized debug logging that respects debug configuration flags.
     * Only outputs when the specified code matches a truthy debug flag.
     * Translates messages using i18n system with the following key resolution order:
     * 1. `context.key` - explicit per-message translation key (preferred)
     * 2. `DEBUG_{CODE}` - category-level key (e.g. DEBUG_MODES)
     * 3. `context.message` - raw string fallback for backwards compatibility
     *
     * @example
     * // Preferred: pass translation key directly - no await needed
     * this.debug("modes", { key: "DEBUG_MODE_FLATTENING", mode, categoryName });
     *
     * @example
     * // Legacy: raw message string (still works, but not translatable)
     * this.debug("wrapper", { message: "Category reuse - using existing wrapper", apiPath });
     */
    public log(code: string, context?: {
        key?: string | undefined;
        message?: string | undefined;
    }): void;
    /**
     * Custom string representation
     * @returns {string} Debug info
     */
    toString(): string;
}
//# sourceMappingURL=debug.d.mts.map