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
		let translatedHint = hintKey ? translate(hintKey, enrichedContext) : undefined;

		// For validation errors, still check for static HINT_ translation
		if (!translatedHint && validationError) {
			const staticHintKey = `HINT_${code}`;
			const staticHint = translate(staticHintKey, enrichedContext);
			// Only use it if it's not the fallback format (Error: HINT_...)
			if (staticHint && !staticHint.startsWith("Error:")) {
				translatedHint = staticHint;
			}
		}

		// Include error code in message for better debugging and test matching
		const messageWithCode = `[${code}] ${translatedMessage}`;
		super(messageWithCode);
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
	// Static array to capture warnings for testing
	static captured = [];
	static suppressConsole = false;

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

		// Emit warning to console unless suppressed
		if (!SlothletWarning.suppressConsole) {
			console.warn(`\n⚠️  [${this.code}] ${this.name}\n${this.message}`);

			// Show context if provided
			if (Object.keys(context).length > 0) {
				console.warn("Context:", context);
			}
		} else {
			// Only capture when console is suppressed (for testing)
			SlothletWarning.captured.push(this);
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
	 * Clear captured warnings (for testing)
	 * @public
	 */
	static clearCaptured() {
		SlothletWarning.captured = [];
	}
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
	constructor(config = {}) {
		this.config = config;
		this.debugFlags = config.debug || {};
	}

	/**
	 * Log a debug message if the code's debug flag is enabled
	 * @param {string} code - Debug code/category (e.g., "modes", "wrapper", "api")
	 * @param {Object} context - Contextual information to display
	 * @public
	 *
	 * @description
	 * Centralized debug logging that respects debug configuration flags.
	 * Only outputs when the specified code matches a truthy debug flag.
	 * Translates messages using i18n system (looks for DEBUG_{CODE} keys).
	 *
	 * @example
	 * this.slothlet.debug("wrapper", {
	 *   apiPath: "math.add",
	 *   action: "materialized",
	 *   implKeys: ["add", "subtract"]
	 * });
	 */
	log(code, context = {}) {
		// Only log if debug flag for this code is enabled
		if (!this.debugFlags || !this.debugFlags[code]) {
			return;
		}

		// Try to translate the message using DEBUG_{CODE} key
		const debugKey = `DEBUG_${code.toUpperCase()}`;
		const translatedMessage = translate(debugKey, context);

		// Format label
		const label = `[DEBUG:${code.toUpperCase()}]`;

		// If translation exists (not fallback), use it
		if (translatedMessage && !translatedMessage.startsWith("Error:")) {
			console.log(`${label} ${translatedMessage}`);
			// Show additional context if available (excluding 'message' which is already shown)
			const { message, ...additionalContext } = context;
			if (Object.keys(additionalContext).length > 0) {
				console.log(`${label} Context:`, additionalContext);
			}
		} else if (context.message) {
			// Fallback to context.message
			console.log(`${label} ${context.message}`);
			// Show additional context if available (excluding 'message')
			const { message, ...additionalContext } = context;
			if (Object.keys(additionalContext).length > 0) {
				console.log(`${label} Context:`, additionalContext);
			}
		} else {
			// No message or translation - show all context
			console.log(label, context);
		}

		// Show remaining context (excluding message)
		const { message, ...remainingContext } = context;
		if (Object.keys(remainingContext).length > 0) {
			console.log(remainingContext);
		}
	}

	/**
	 * Custom string representation
	 * @returns {string} Debug info
	 */
	toString() {
		return `[SlothletDebug] flags: ${Object.keys(this.debugFlags)
			.filter((k) => this.debugFlags[k])
			.join(", ")}`;
	}
}
