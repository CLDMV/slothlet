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
	 * Create a new SlothletError with automatic translation and hint detection
	 * @param {string} code - Error code identifier
	 * @param {Object} context - Additional context about the error
	 * @param {boolean} [context.validationError] - Mark as validation error (no originalError needed)
	 * @param {boolean} [context.stub] - Mark as stub error (not-yet-implemented feature)
	 * @param {Error} [originalError] - The original error that caused this SlothletError
	 * @public
	 */
	constructor(code, context = {}, originalError = null) {
		// Extract flags from context
		const { validationError, stub, ...contextData } = context;

		// Enrich context with originalError message if provided
		const enrichedContext = originalError ? { ...contextData, error: originalError.message } : contextData;

		// Translate message synchronously (translations already loaded at module init)
		const translatedMessage = translate(code, enrichedContext);

		// Auto-detect and translate hint if originalError provided (skip for stubs/validations)
		const skipHint = stub || validationError;
		const hintKey = originalError && !skipHint ? detectHint(originalError, code) : undefined;
		const translatedHint = hintKey ? translate(hintKey, enrichedContext) : undefined;

		super(translatedMessage);
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

/**
 * Warning class for non-fatal issues with i18n support
 * @public
 */
export class SlothletWarning {
	/**
	 * Create and emit a warning with automatic translation
	 * @param {string} code - Warning code identifier
	 * @param {Object} context - Additional context about the warning
	 * @public
	 */
	constructor(code, context = {}) {
		// Translate message synchronously
		const translatedMessage = translate(code, context);

		this.name = "SlothletWarning";
		this.code = code;
		this.message = translatedMessage;
		this.context = context;

		// Emit warning to console
		console.warn(`\n⚠️  [${this.code}] ${this.name}\n${this.message}`);

		// Show context if provided
		if (Object.keys(context).length > 0) {
			console.warn("Context:", context);
		}
	}

	/**
	 * Custom string representation
	 * @returns {string} Formatted warning string
	 */
	toString() {
		return `[${this.code}] ${this.name}: ${this.message}`;
	}
}
