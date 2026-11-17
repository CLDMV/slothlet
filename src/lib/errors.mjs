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
import { ArrayMethods, Error, Errors, filterList, jsonOf, listPush, Objects, Reflect, stringOf, Symbols } from "#helpers/intrinsics";

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
		// Read without running code the thrown value carries (a `toJSON`, a getter, a `toString`): see helpers/intrinsics
		// `jsonOf` and `stringOf`.
		if (thrown instanceof Error) {
			const message = Reflect.getOwnPropertyDescriptor(thrown, "message");
			return message && typeof message.value === "string" ? message.value : stringOf(thrown);
		}
		if (typeof thrown === "string") return thrown;
		return jsonOf(thrown) ?? stringOf(thrown);
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
 * Warning class for non-fatal issues with i18n support
 * @public
 */
export class SlothletWarning {
	/**
	 * Warnings captured while console output is suppressed (for testing).
	 * On this class it is the process-level list: it holds warnings raised outside any slothlet
	 * instance (module-level coverage notices, for example). Each instance has its own subclass with its own
	 * list, reached as `api.slothlet.diag.SlothletWarning.captured` (see {@link SlothletWarning.forInstance}).
	 * @type {SlothletWarning[]}
	 */
	static captured = [];

	/**
	 * Suppress console output and capture instead. On this class it is the process-level setting; an
	 * instance's class follows it until that instance sets its own value (assign `null` to follow it again).
	 * @type {boolean}
	 */
	static suppressConsole = false;

	/**
	 * Create the warning class for one slothlet instance (#819). The subclass keeps its own `captured` list and
	 * its own `suppressConsole` setting, so warnings, `clearCaptured()` and console suppression on one instance
	 * never reach another. `suppressConsole` follows the process-level value until the instance sets its own.
	 * Warnings are still `instanceof SlothletWarning`.
	 * @returns {Function} The per-instance class (a subclass of `SlothletWarning`).
	 * @public
	 */
	static forInstance() {
		const Process = SlothletWarning;
		let own = null;
		class InstanceSlothletWarning extends Process {
			static captured = [];
			static get suppressConsole() {
				return own ?? Process.suppressConsole;
			}
			static set suppressConsole(value) {
				own = value;
			}
			static clearCaptured() {
				InstanceSlothletWarning.captured = [];
			}
		}
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

		// Emit warning to console unless suppressed. `Home` is the instance's class for a warning raised through
		// an instance (#819), or this class for one raised outside any instance.
		const Home = this.constructor;
		if (!Home.suppressConsole) {
			// The console as it is now: hosts and test runners point it elsewhere after slothlet loads.
			globalThis.console.warn(`\n⚠️  [${this.code}] ${this.name}\n${this.message}`);

			// Show details if provided (exclude synthetic 'key' field from display)
			if (Objects.keys(detailData).length > 0) {
				globalThis.console.warn("Details:", detailData);
			}

			if (hasCause) {
				globalThis.console.warn("Cause:", cause instanceof Error ? cause.stack : cause);
			}
		} else {
			// Only capture when console is suppressed (for testing)
			listPush(Home.captured, this);
		}
	}

	/**
	 * Custom string representation
	 * @returns {string} Formatted warning string
	 */
	toString() {
		return `[${this.code}] ${this.name}: ${this.message}`;
	}

	/**
	 * Clear captured warnings (for testing). On an instance's class this clears that instance only.
	 * @public
	 */
	static clearCaptured() {
		SlothletWarning.captured = [];
	}
}

// The i18n module cannot import this one, so the process-level class is handed to it for the warnings it raises (#820).
registerWarningClass(SlothletWarning);
