/**
 *	@Project: @cldmv/slothlet
 *	@Filename: /src/lib/errors.mjs
 *	@Date: 2026-01-20 20:25:54 -08:00 (1737432354)
 *	@Author: Nate Corcoran <CLDMV>
 *	@Email: <Shinrai@users.noreply.github.com>
 *	-----
 *	@Last modified by: Nate Corcoran <CLDMV> (Shinrai@users.noreply.github.com)
 *	@Last modified time: 2026-03-01 20:21:36 -08:00 (1772425296)
 *	-----
 *	@Copyright: Copyright (c) 2013-2026 Catalyzed Motivation Inc. All rights reserved.
 */

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
	 * @param {Object} [options] - Additional options (alternative to embedding flags in context)
	 * @param {boolean} [options.validationError] - Mark as validation error (no originalError needed)
	 * @param {boolean} [options.stub] - Mark as stub error (not-yet-implemented feature)
	 * @public
	 */
	constructor(code, context = {}, originalError = null, options = {}) {
		// Extract flags from context OR from the 4th options arg (backwards compat for the
		// `new SlothletError("CODE", {}, null, { validationError: true })` calling convention)
		const { validationError: ctxValidation, stub: ctxStub, ...contextData } = context;
		const { validationError: optsValidation, stub: optsStub } = options;
		const validationError = ctxValidation ?? optsValidation;
		const stub = ctxStub ?? optsStub;

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
		if (this.hint) {
			output += `\n💡 ${this.hint}\n`;
		}

		// Add only critical details
		const criticalKeys = ["modulePath", "moduleID", "apiPath"];
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
	 * @param {string} [context.key] - Optional translation key override. When provided, this key
	 *   is used for translation instead of `code`. All other context properties are used as
	 *   interpolation params. Allows sub-key variants without changing the warning code.
	 * @public
	 */
	constructor(code, context = {}) {
		// Allow context.key to override the translation key (key: "WARNING_FOO_VARIANT", ...params)
		const { key: msgKey, ...contextData } = context;
		const translationKey = msgKey ?? code;

		// Translate message synchronously
		const translatedMessage = translate(translationKey, contextData);

		this.name = "SlothletWarning";
		this.code = code;
		this.message = translatedMessage;
		this.context = context;

		// Emit warning to console unless suppressed
		if (!SlothletWarning.suppressConsole) {
			console.warn(`\n⚠️  [${this.code}] ${this.name}\n${this.message}`);

			// Show context if provided (exclude synthetic 'key' field from display)
			if (Object.keys(contextData).length > 0) {
				console.warn("Context:", contextData);
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
	 * @param {string} [context.key] - Translation key for the message (e.g. "DEBUG_MODE_FLATTENING").
	 *   When provided, translates via i18n using the remaining context properties as interpolation
	 *   params - no `await t()` needed at the call site. Falls back to `DEBUG_{CODE}` category key
	 *   if omitted, then to `context.message` for backwards compatibility.
	 * @param {string} [context.message] - Raw message string (backwards-compat fallback).
	 *   Prefer `context.key` for new call sites so messages are translatable.
	 * @public
	 *
	 * @description
	 * Centralized debug logging that respects debug configuration flags.
	 * Only outputs when the specified code matches a truthy debug flag.
	 * Translates messages using i18n system with the following key resolution order:
	 * 1. `context.key` - explicit per-message translation key (preferred)
	 * 2. `DEBUG_{CODE}` - category-level key (e.g. DEBUG_MODES)
	 * 3. `context.message` - raw string fallback for backwards compatibility
	 *
	 * @example
	 * // Preferred: pass translation key directly - no await needed
	 * this.debug("modes", { key: "DEBUG_MODE_FLATTENING", mode, categoryName });
	 *
	 * @example
	 * // Legacy: raw message string (still works, but not translatable)
	 * this.debug("wrapper", { message: "Category reuse - using existing wrapper", apiPath });
	 */
	log(code, context = {}) {
		// Only log if debug flag for this code is enabled
		if (!this.debugFlags || !this.debugFlags[code]) {
			return;
		}

		// Extract key and message; remaining props are i18n interpolation params / extra context
		const { key: msgKey, message, ...contextParams } = context;

		// Key resolution: explicit key > category key (DEBUG_{CODE}) > raw message fallback
		const translationKey = msgKey ?? `DEBUG_${code.toUpperCase()}`;
		const translatedMessage = translate(translationKey, contextParams);
		const hasTranslation = translatedMessage && !translatedMessage.startsWith("Error:");

		// Format label
		const label = `[DEBUG:${code.toUpperCase()}]`;

		if (hasTranslation) {
			console.log(`${label} ${translatedMessage}`);
		} else if (message) {
			// Backwards compat: raw message string (no key provided, no category key found)
			console.log(`${label} ${message}`);
		} else {
			// No message or translation - dump raw context
			console.log(label, contextParams);
		}

		// Show interpolation params / extra context if present (never show 'key' or 'message')
		if ((hasTranslation || message) && Object.keys(contextParams).length > 0) {
			console.log(`${label} Context:`, contextParams);
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
