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
     * @param {unknown} [originalError] - What was originally thrown. Not necessarily an `Error`:
     *   application code may throw a structured payload, a string, or any other value, and all of
     *   them are rendered into the message and chained via `cause`. Only `null`/`undefined` mean
     *   "no original".
     * @param {Object} [options] - Additional options (alternative to embedding flags in context)
     * @param {boolean} [options.validationError] - Mark as validation error (no originalError needed)
     * @param {boolean} [options.stub] - Mark as stub error (not-yet-implemented feature)
     * @public
     */
    /**
     * Renders a thrown value for message interpolation.
     *
     * @param {unknown} thrown - Whatever the guarded code threw.
     * @returns {string} A human-readable rendering: an Error's own message, a string as itself, and
     *   any other value's own data JSON-serialized (falling back to its `String()` text).
     */
    static #describeThrown(thrown: unknown): string;
    constructor(code: any, context?: {}, originalError?: null, options?: {});
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
    /**
     * Suppress console output and capture instead. On this class it is the process-level setting; an
     * instance's class follows it until that instance sets its own value (assign `null` to follow it again).
     * @type {boolean}
     */
    static suppressConsole: boolean;
    /**
     * Create the warning class for one slothlet instance (#819). Every warning made with it is recorded in `records`,
     * the instance's own list (read as `api.slothlet.warnings.get()`), so warnings on one instance never reach another.
     * The subclass keeps its own `suppressConsole` setting, which follows the process-level value until the instance
     * sets its own. Warnings are still `instanceof SlothletWarning`.
     * @param {SlothletWarning[]} [records] - The list every warning made with the class is pushed to.
     * @returns {Function} The per-instance class (a subclass of `SlothletWarning`).
     * @public
     * @example
     * const records = [];
     * const InstanceWarning = SlothletWarning.forInstance(records);
     * new InstanceWarning("WARNING_DIRECTORY_EMPTY", { folder: "./api" }); // records.length === 1
     */
    public static forInstance(records?: SlothletWarning[]): Function;
    /**
     * Create and emit a warning with automatic translation
     * @param {string} code - Warning code identifier
     * @param {Object} context - Additional context about the warning
     * @param {string} [context.key] - Optional translation key override. When provided, this key
     *   is used for translation instead of `code`. All other context properties are used as
     *   interpolation params. Allows sub-key variants without changing the warning code.
     * @param {*} [cause] - What caused the warning, typically an error a handler threw. Exposed as
     *   `cause` and printed with its stack, so the warning never hides the failure it reports (#578).
     * @public
     */
    constructor(code: string, context?: {
        key?: string | undefined;
    }, cause?: any);
    name: string;
    code: string;
    /** @type {string} */
    message: string;
    context: {
        key?: string | undefined;
    };
    /** @type {*} */
    cause: any;
    /**
     * Custom string representation
     * @returns {string} Formatted warning string
     */
    toString(): string;
}
//# sourceMappingURL=errors.d.mts.map