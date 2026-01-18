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
     * @public
     */
    constructor(code: string, context?: {
        validationError?: boolean;
        stub?: boolean;
    }, originalError?: Error);
    /**
     * Prevent JSON serialization of context (cleaner error display)
     * @returns {Object} Simplified error object
     */
    toJSON(): any;
}
//# sourceMappingURL=errors.d.mts.map