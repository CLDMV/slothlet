/**
 *
 *	@Project: @cldmv/slothlet
 *	@Filename: /src/lib/errors.mjs
 *	@Date: 2026-01-20T20:25:54-08:00 (1768969554)
 *	@Author: Nate Corcoran <CLDMV>
 *	@Email: <Shinrai@users.noreply.github.com>
 *	-----
 *	@Last modified by: Nate Corcoran <CLDMV> (Shinrai@users.noreply.github.com)
 *	@Last modified time: 2026-11-16T18:28:44-08:00 (1794882524)
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
	describeThrown,
	Error,
	Errors,
	filterList,
	Objects,
	stringOf,
	Symbols,
	WeakMap,
	WeakMapMethods
} from "#helpers/intrinsics";

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
	static #describeThrown(thrown) {
		return describeThrown(thrown);
	}

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
	constructor(code, details = {}, options = {}) {
		const cause = options?.cause;
		// "Has a cause" is anything that is not null/undefined: `0`, `false` and `""` are legal throws, and the
		// diagnostic that replaced one must still be able to name it (#252).
		const hasCause = cause !== null && cause !== undefined;
		const enrichedDetails = hasCause ? { ...details, error: SlothletError.#describeThrown(cause) } : { ...details };

		// Translate message synchronously (translations already loaded at module init)
		const translatedMessage = translate(code, enrichedDetails);

		// The hint is always a translated sentence: detected from the cause when there is one (pattern rules, then the
		// code's own HINT_<code>), otherwise the code's own HINT_<code> when it has one, otherwise none.
		const hintKey = hasCause ? detectHint(cause, code) : `HINT_${code}`;
		const hintText = translate(hintKey, enrichedDetails);
		// translate() answers "Error: <key>" for a key it has no sentence for: that is "no hint".
		const translatedHint = hintText === `Error: ${hintKey}` ? undefined : hintText;

		// Include error code in message for better debugging and test matching; chain the cause via the standard
		// `cause` (ES2022), the channel util.inspect, serializers and cause-walking tooling follow.
		super(`[${code}] ${translatedMessage}`, hasCause ? { cause } : undefined);
		this.name = "SlothletError";

		// Non-enumerable so they are not dumped with the error
		Objects.defineProperty(this, "code", { __proto__: null, value: code, enumerable: false, writable: false });
		Objects.defineProperty(this, "details", { __proto__: null, value: enrichedDetails, enumerable: false, writable: false });
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
		const criticalKeys = ["file", "module", "path"];
		const detailKeys = filterList(Objects.keys(this.details), (k) => ArrayMethods.includes(criticalKeys, k));

		if (detailKeys.length > 0) {
			output += "\nDetails:\n";
			for (let ofIndex = 0, ofList = detailKeys; ofIndex < ofList.length; ofIndex++) {
				const key = ofList[ofIndex];
				output += `  ${key}: ${stringOf(this.details[key])}\n`;
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
	 * JSON form: name, code, message and the translated hint (details are left out for a cleaner display).
	 * @returns {Object} Simplified error object
	 */
	toJSON() {
		return {
			name: this.name,
			code: this.code,
			message: this.message,
			hint: this.hint
		};
	}
}

/**
 * The recorder each per-instance warning class hands its warnings to (see {@link SlothletWarning.forInstance}).
 * @type {WeakMap<Function, (warning: SlothletWarning) => void>}
 * @private
 */
const RECORDERS = new WeakMap();

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
	static get silent() {
		return false;
	}

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
	static forInstance(isSilent = () => false, record) {
		class InstanceSlothletWarning extends SlothletWarning {
			static get silent() {
				return isSilent() === true;
			}
		}
		if (typeof record === "function") WeakMapMethods.set(RECORDERS, InstanceSlothletWarning, record);
		return InstanceSlothletWarning;
	}

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
	constructor(code, details = {}, options = {}) {
		const cause = options?.cause;
		// Allow details.key to override the translation key (key: "WARNING_FOO_VARIANT", ...params)
		const { key: msgKey, ...detailData } = details;
		const translationKey = msgKey ?? code;

		// Translate message synchronously
		const translatedMessage = translate(translationKey, detailData);

		this.name = "SlothletWarning";
		this.code = code;
		/** @type {string} */
		this.message = translatedMessage;
		this.details = details;
		// Same "has a cause" test SlothletError uses: anything but null/undefined, so a thrown `0`,
		// `false` or `""` is still reported.
		const hasCause = cause !== null && cause !== undefined;
		if (hasCause) {
			/** @type {*} */
			this.cause = cause;
		}

		// `Home` is the instance's class for a warning raised through an instance (#819), or this class for one raised
		// outside any instance. Whether it is printed is that class's `silent`, decided here and nowhere else (#838).
		const Home = this.constructor;
		if (!Home.silent) {
			// The console as it is now: hosts and test runners point it elsewhere after slothlet loads.
			globalThis.console.warn(`\n⚠️  [${this.code}] ${this.name}\n${this.message}`);

			// Show details if provided (exclude synthetic 'key' field from display)
			if (Objects.keys(detailData).length > 0) {
				globalThis.console.warn("Details:", detailData);
			}

			if (hasCause) {
				globalThis.console.warn("Cause:", cause instanceof Error ? cause.stack : cause);
			}
		}
		// A warning raised through an instance is kept by that instance, printed or not.
		const record = WeakMapMethods.get(RECORDERS, Home);
		if (record !== undefined) record(this);
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
