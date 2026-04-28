/**
 * Custom error class for Slothlet-specific errors with context and i18n
 * @public
 */
export class SlothletError extends Error {
    /**
     * Create a new SlothletError with automatic translation and hint detection
     * @param {string} code - Error code identifier
     * @param {Object} context - Additional context about the error
     * @param {boolean} [context.validationError] - Mark as validation error (no originalError needed)
     * @param {boolean} [context.stub] - Mark as stub error (not-yet-implemented feature)
     * @param {Error} [originalError] - The original error that caused this SlothletError
     * @param {Object} [options] - Additional options (alternative to embedding flags in context)
     * @param {boolean} [options.validationError] - Mark as validation error (no originalError needed)
     * @param {boolean} [options.stub] - Mark as stub error (not-yet-implemented feature)
     * @public
     */
    constructor(code: string, context?: {
        validationError?: boolean | undefined;
        stub?: boolean | undefined;
    }, originalError?: Error, options?: {
        validationError?: boolean | undefined;
        stub?: boolean | undefined;
    });
    /**
     * Prevent JSON serialization of context (cleaner error display)
     * @returns {Object} Simplified error object
     */
    toJSON(): Object;
}
/**
 * Warning class for non-fatal issues with i18n support
 * @public
 */
export class SlothletWarning {
    static captured: any[];
    static suppressConsole: boolean;
    /**
     * Clear captured warnings (for testing)
     * @public
     */
    public static clearCaptured(): void;
    /**
     * Create and emit a warning with automatic translation
     * @param {string} code - Warning code identifier
     * @param {Object} context - Additional context about the warning
     * @param {string} [context.key] - Optional translation key override. When provided, this key
     *   is used for translation instead of `code`. All other context properties are used as
     *   interpolation params. Allows sub-key variants without changing the warning code.
     * @public
     */
    constructor(code: string, context?: {
        key?: string | undefined;
    });
    name: string;
    code: string;
    message: any;
    context: {
        key?: string | undefined;
    };
    /**
     * Custom string representation
     * @returns {string} Formatted warning string
     */
    toString(): string;
}
/**
 * Debug utility class for centralized conditional console output with i18n
 * @public
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
//# sourceMappingURL=errors.d.mts.map