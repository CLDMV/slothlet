/**
 * @fileoverview Custom error classes with i18n support
 * @module @cldmv/slothlet/errors
 */
import { translate } from "@cldmv/slothlet/i18n";
import { detectHint } from "@cldmv/slothlet/helpers/hint-detector";

/**
 * Custom error class for Slothlet-specific errors with context and i18n
 * @public
 */
export class SlothletError extends Error {
	/**
	 * Create a new SlothletError (use SlothletError.create() for async version with translations)
	 * @param {string} code - Error code identifier
	 * @param {Object} context - Additional context about the error
	 * @param {Error} [originalError] - The original error that caused this SlothletError
	 * @param {string} [translatedMessage] - Pre-translated message
	 * @param {string} [translatedHint] - Pre-translated hint
	 * @private
	 */
	constructor(code, context = {}, originalError = null, translatedMessage = null, translatedHint = null) {
		super(translatedMessage || `[${code}]`);
		this.name = "SlothletError";

		// Make code and context non-enumerable to prevent them from being dumped
		Object.defineProperty(this, "code", {
			value: code,
			enumerable: false,
			writable: false
		});

		Object.defineProperty(this, "context", {
			value: context,
			enumerable: false,
			writable: false
		});

		Object.defineProperty(this, "originalError", {
			value: originalError,
			enumerable: false,
			writable: false
		});

		Object.defineProperty(this, "hint", {
			value: translatedHint,
			enumerable: false,
			writable: false
		});

		Error.captureStackTrace(this, SlothletError);
	}

	/**
	 * Create a SlothletError with translations (async factory method)
	 * This method:
	 * 1. Detects appropriate hint based on original error
	 * 2. Translates error message
	 * 3. Translates hint (if detected)
	 * 4. Returns fully-translated error ready to throw
	 *
	 * @param {string} code - Error code identifier
	 * @param {Object} context - Additional context about the error
	 * @param {Error} [originalError] - The original error that caused this SlothletError
	 * @returns {Promise<SlothletError>} Translated error instance
	 * @public
	 */
	static async create(code, context = {}, originalError = null) {
		// Auto-detect hint from original error
		const hintKey = originalError ? detectHint(originalError, code) : undefined;

		// Add error message to context if originalError provided
		const enrichedContext = originalError ? { ...context, error: originalError.message } : context;

		// Translate message and hint in parallel
		const [translatedMessage, translatedHint] = await Promise.all([
			translate(code, enrichedContext),
			hintKey ? translate(hintKey, enrichedContext) : Promise.resolve(undefined)
		]);

		// Create error with translations
		return new SlothletError(code, enrichedContext, originalError, translatedMessage, translatedHint);
	}

	/**
	 * Get translated error message (async)
	 * @returns {Promise<string>} Translated message
	 * @public
	 */
	async getTranslatedMessage() {
		try {
			return await translate(this.code, this.context);
		} catch (___error) {
			return this.message;
		}
	}

	/**
	 * Custom string representation
	 * @returns {string} Formatted error string
	 */
	toString() {
		let output = `\n[${this.code}] ${this.name}\n`;

		// Show hint prominently if available
		if (this.context.hint) {
			output += `\n💡 ${this.context.hint}\n`;
		}

		// Add only critical details
		const criticalKeys = ["modulePath", "moduleId", "apiPath"];
		const detailKeys = Object.keys(this.context).filter((k) => criticalKeys.includes(k));

		if (detailKeys.length > 0) {
			output += "\nDetails:\n";
			for (const key of detailKeys) {
				output += `  ${key}: ${this.context[key]}\n`;
			}
		}

		return output;
	}

	/**
	 * Custom inspect for console.log/console.error
	 * @returns {string} Formatted error for display
	 */
	[Symbol.for("nodejs.util.inspect.custom")]() {
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
