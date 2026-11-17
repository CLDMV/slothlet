/**
 *
 *	@Project: @cldmv/slothlet
 *	@Filename: /src/lib/errors.mjs
 *	@Date: 2026-01-20T20:25:54-08:00 (1768969554)
 *	@Author: Nate Corcoran <CLDMV>
 *	@Email: <Shinrai@users.noreply.github.com>
 *	-----
 *	@Last modified by: Nate Corcoran <CLDMV> (Shinrai@users.noreply.github.com)
 *	@Last modified time: 2026-11-16T16:16:09-08:00 (1794874569)
 *	-----
 *	@Copyright: Copyright (c) 2013-2026 Catalyzed Motivation Inc. All rights reserved.
 *
 */

/**
 * @fileoverview Custom error classes with i18n support
 * @module @cldmv/slothlet/errors
 * @internal
 */
import { translate, registerWarningClass } from "#i18n";
import { detectHint } from "#helpers/hint-detector";
import {
	ArrayMethods,
	Error,
	Errors,
	filterList,
	jsonOf,
	listPush,
	Objects,
	Reflect,
	StringMethods,
	stringOf,
	Symbols,
	WeakMap,
	WeakMapMethods
} from "#helpers/intrinsics";

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
	static #describeThrown(thrown) {
		// Read without running code the thrown value carries (a `toJSON`, a getter, a `toString`): see helpers/intrinsics
		// `jsonOf` and `stringOf`.
		if (thrown instanceof Error) {
			const message = Reflect.getOwnPropertyDescriptor(thrown, "message");
			return message && typeof message.value === "string" ? message.value : stringOf(thrown);
		}
		if (typeof thrown === "string") return thrown;
		return jsonOf(thrown) ?? stringOf(thrown);
	}

	constructor(code, context = {}, originalError = null, options = {}) {
		// Extract flags from context OR from the 4th options arg (backwards compat for the
		// `new SlothletError("CODE", {}, null, { validationError: true })` calling convention)
		const { validationError: ctxValidation, stub: ctxStub, ...contextData } = context;
		const { validationError: optsValidation, stub: optsStub } = options;
		const validationError = ctxValidation ?? optsValidation;
		const stub = ctxStub ?? optsStub;

		// Enrich context with a rendering of the original throw. `.message` only exists on Error
		// instances; a structured payload (`{ statusCode, key, … }` — the standard HTTP-mapping
		// shape) used to interpolate as an empty slot, leaving the diagnostic that replaced the
		// error unable to name it (#252).
		// "Has an original" is the same test the `cause` chain below uses: anything that is not
		// null/undefined counts. A truthiness test would drop `0`, `false` and `""` — all legal
		// throws — and leave the diagnostic unable to name what it replaced, which is the very gap
		// this rendering exists to close.
		const hasOriginal = originalError !== null && originalError !== undefined;
		const enrichedContext = hasOriginal ? { ...contextData, error: SlothletError.#describeThrown(originalError) } : contextData;

		// Translate message synchronously (translations already loaded at module init)
		const translatedMessage = translate(code, enrichedContext);

		// Auto-detect and translate hint if originalError provided (skip for stubs/validations)
		const skipHint = stub || validationError;
		const hintKey = hasOriginal && !skipHint ? detectHint(originalError, code) : undefined;
		let translatedHint = hintKey ? translate(hintKey, enrichedContext) : undefined;

		// For validation errors, still check for static HINT_ translation
		// The false path of this && triggers when translatedHint is already set; V8's fork-based
		// coverage merging produces a negative branch count for this path due to range arithmetic
		// underflow across 199 test workers — the branch IS covered but cannot be reliably tracked.
		/* v8 ignore next */
		if (!translatedHint && validationError) {
			const staticHintKey = `HINT_${code}`;
			const staticHint = translate(staticHintKey, enrichedContext);
			// Only use it if it's not the fallback format (Error: HINT_...)
			if (staticHint && !StringMethods.startsWith(staticHint, "Error:")) {
				translatedHint = staticHint;
			}
		}

		// Include error code in message for better debugging and test matching.
		// Chain the original via the standard `cause` (ES2022) — it is the channel util.inspect,
		// serializers, and cause-walking tooling follow; `originalError` below stays as the
		// compatibility channel (#252).
		const messageWithCode = `[${code}] ${translatedMessage}`;
		super(messageWithCode, hasOriginal ? { cause: originalError } : undefined);
		this.name = "SlothletError";

		// Make code and context non-enumerable to prevent them from being dumped
		Objects.defineProperty(this, "code", { __proto__: null, value: code, enumerable: false, writable: false });

		Objects.defineProperty(this, "context", { __proto__: null, value: context, enumerable: false, writable: false });

		Objects.defineProperty(this, "originalError", { __proto__: null, value: originalError, enumerable: false, writable: false });

		Objects.defineProperty(this, "hint", { __proto__: null, value: translatedHint, enumerable: false, writable: false });

		Errors.captureStackTrace(this, SlothletError);
	}

	/**
	 * Custom string representation
	 * @returns {string} Formatted error string
	 */
	toString() {
		let output = `\n[${this.code}] ${this.name}\n`;

		// Show hint prominently if available
		if (this.hint) {
			output += `\n💡 ${this.hint}\n`;
		}

		// Add only critical details
		const criticalKeys = ["modulePath", "moduleID", "apiPath"];
		const detailKeys = filterList(Objects.keys(this.context), (k) => ArrayMethods.includes(criticalKeys, k));

		if (detailKeys.length > 0) {
			output += "\nDetails:\n";
			for (let ofIndex = 0, ofList = detailKeys; ofIndex < ofList.length; ofIndex++) {
				const key = ofList[ofIndex];
				output += `  ${key}: ${stringOf(this.context[key])}\n`;
			}
		}

		return output;
	}

	/**
	 * Custom inspect for console.log/console.error
	 * @returns {string} Formatted error for display
	 */
	[Symbols.for("nodejs.util.inspect.custom")]() {
		return this.toString() + `\n${this.stack}`;
	}

	/**
	 * Prevent JSON serialization of context (cleaner error display)
	 * @returns {Object} Simplified error object
	 */
	toJSON() {
		return {
			name: this.name,
			code: this.code,
			message: this.message,
			hint: this.context.hint
		};
	}
}

/**
 * The warning list of each instance's warning class (see {@link SlothletWarning.forInstance}).
 * @type {WeakMap<Function, SlothletWarning[]>}
 */
const INSTANCE_RECORDS = new WeakMap();

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
	static suppressConsole = false;

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
	static forInstance(records = []) {
		const Process = SlothletWarning;
		let own = null;
		class InstanceSlothletWarning extends Process {
			static get suppressConsole() {
				return own ?? Process.suppressConsole;
			}
			static set suppressConsole(value) {
				own = value;
			}
		}
		WeakMapMethods.set(INSTANCE_RECORDS, InstanceSlothletWarning, records);
		return InstanceSlothletWarning;
	}

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
	constructor(code, context = {}, cause) {
		// Allow context.key to override the translation key (key: "WARNING_FOO_VARIANT", ...params)
		const { key: msgKey, ...contextData } = context;
		const translationKey = msgKey ?? code;

		// Translate message synchronously
		const translatedMessage = translate(translationKey, contextData);

		this.name = "SlothletWarning";
		this.code = code;
		/** @type {string} */
		this.message = translatedMessage;
		this.context = context;
		// Same "has a cause" test SlothletError uses: anything but null/undefined, so a thrown `0`,
		// `false` or `""` is still reported.
		const hasCause = cause !== null && cause !== undefined;
		if (hasCause) {
			/** @type {*} */
			this.cause = cause;
		}

		// Emit warning to console unless suppressed. `Home` is the instance's class for a warning raised through
		// an instance (#819), or this class for one raised outside any instance.
		const Home = this.constructor;
		if (!Home.suppressConsole) {
			// The console as it is now: hosts and test runners point it elsewhere after slothlet loads.
			globalThis.console.warn(`\n⚠️  [${this.code}] ${this.name}\n${this.message}`);

			// Show context if provided (exclude synthetic 'key' field from display)
			if (Objects.keys(contextData).length > 0) {
				globalThis.console.warn("Context:", contextData);
			}

			if (hasCause) {
				globalThis.console.warn("Cause:", cause instanceof Error ? cause.stack : cause);
			}
		}
		// A warning raised through an instance is recorded on that instance, whether or not it reached the console.
		const records = WeakMapMethods.get(INSTANCE_RECORDS, Home);
		if (records) listPush(records, this);
	}

	/**
	 * Custom string representation
	 * @returns {string} Formatted warning string
	 */
	toString() {
		return `[${this.code}] ${this.name}: ${this.message}`;
	}
}

// The i18n module cannot import this one, so the process-level class is handed to it for the warnings it raises (#820).
registerWarningClass(SlothletWarning);
