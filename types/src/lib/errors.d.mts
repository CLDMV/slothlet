/**
 * Custom error class for Slothlet-specific errors with details and i18n
 * @public
 */
export class SlothletError extends Error {
    /**
     * Renders a thrown value for message interpolation.
     *
     * @param {unknown} thrown - Whatever the guarded code threw.
     * @returns {string} A human-readable rendering: an Error's own message, a string as itself, and
     *   any other value's own data JSON-serialized (falling back to its `String()` text).
     */
    static #describeThrown(thrown: unknown): string;
    /**
     * Create a new SlothletError with automatic translation and hint detection.
     * @param {string} code - Error code identifier.
     * @param {Object} [details] - Structured details about the error, also the i18n interpolation params.
     * @param {Object} [options] - Error options.
     * @param {unknown} [options.cause] - What was originally thrown. Not necessarily an `Error`: application code may
     *   throw a structured payload, a string, or any other value, and all of them are rendered into the message (as
     *   `details.error`) and chained as the standard `cause`. Only `null`/`undefined` mean "no cause".
     * @public
     */
    constructor(code: string, details?: Object, options?: {
        cause?: unknown;
    });
    /**
     * JSON form: name, code, message and the translated hint (details are left out for a cleaner display).
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
     * Whether a warning raised through this class stays off the console. The process-level class prints every warning;
     * an instance's class reads its instance's `silent` option.
     * @type {boolean}
     */
    static get silent(): boolean;
    /**
     * Create the warning class for one slothlet instance (#819). Every warning raised through it is handed to
     * `record` (the instance keeps them; `api.slothlet.warnings.get()` reads them), printed or not, and it is printed
     * unless `isSilent()` says the instance is silent (#838). Warnings on one instance never reach another, and they
     * are still `instanceof SlothletWarning`.
     * @param {function(): boolean} [isSilent] - Whether the instance's `silent` option is on, read as each warning is raised.
     * @param {(warning: SlothletWarning) => void} [record] - Called with each warning raised through the class.
     * @returns {Function} The per-instance class (a subclass of `SlothletWarning`).
     * @public
     */
    public static forInstance(isSilent?: () => boolean, record?: (warning: SlothletWarning) => void): Function;
    /**
     * Create and emit a warning with automatic translation
     * @param {string} code - Warning code identifier
     * @param {Object} [details] - Structured details about the warning, also the i18n interpolation params.
     * @param {string} [details.key] - Optional translation key override. When provided, this key
     *   is used for translation instead of `code`. All other details are used as
     *   interpolation params. Allows sub-key variants without changing the warning code.
     * @param {Object} [options] - Warning options.
     * @param {*} [options.cause] - What caused the warning, typically an error a handler threw. Exposed as
     *   `cause` and printed with its stack, so the warning never hides the failure it reports (#578).
     * @public
     */
    constructor(code: string, details?: {
        key?: string | undefined;
    }, options?: {
        cause?: any;
    });
    name: string;
    code: string;
    /** @type {string} */
    message: string;
    details: {
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