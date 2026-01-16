/**
 * @fileoverview Custom error classes with i18n support
 * @module @cldmv/slothlet/errors
 */
import { translate } from "@cldmv/slothlet/i18n";

/**
 * Format error message synchronously (fallback)
 * @param {string} code - Error code
 * @param {Object} context - Context parameters
 * @returns {string} Formatted message
 * @private
 */
function formatErrorFallback(code, context = {}) {
	// Simple template interpolation for fallback
	let message = `[${code}]`;

	// Add context details
	if (Object.keys(context).length > 0) {
		const parts = [];
		for (const [key, value] of Object.entries(context)) {
			if (key === "stack") {
				// Include full stack trace
				parts.push(`\n${key}:\n${value}`);
			} else {
				// Format other values
				const stringValue = typeof value === "string" ? value : JSON.stringify(value);
				parts.push(`${key}=${stringValue}`);
			}
		}
		message += ` ${parts.join(", ")}`;
	}

	return message;
}

/**
 * Custom error class for Slothlet-specific errors with context and i18n
 * @public
 */
export class SlothletError extends Error {
	/**
	 * Create a new SlothletError
	 * @param {string} code - Error code identifier
	 * @param {Object} context - Additional context about the error
	 */
	constructor(code, context = {}) {
		// Use fallback message initially (sync)
		const fallbackMessage = formatErrorFallback(code, context);
		super(fallbackMessage);
		this.name = "SlothletError";
		this.code = code;
		this.context = context;

		// Try to load translated message asynchronously (for console.log, etc.)
		// This won't affect the initial throw, but will improve error display
		translate(code, context)
			.then((translatedMessage) => {
				this.message = translatedMessage;
			})
			.catch((___error) => {
				// Keep fallback message
			});

		Error.captureStackTrace(this, SlothletError);
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
}
