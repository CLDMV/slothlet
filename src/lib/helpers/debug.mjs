/**
 *
 *	@Project: @cldmv/slothlet
 *	@Filename: /src/lib/helpers/debug.mjs
 *	@Date: 2026-11-16T00:00:00-08:00 (1794816000)
 *	@Author: Nate Corcoran <CLDMV>
 *	@Email: <Shinrai@users.noreply.github.com>
 *	-----
 *	@Last modified by: Nate Corcoran <CLDMV> (Shinrai@users.noreply.github.com)
 *	@Last modified time: 2026-11-16T00:00:00-08:00 (1794816000)
 *	-----
 *	@Copyright: Copyright (c) 2013-2026 Catalyzed Motivation Inc. All rights reserved.
 *
 */

/**
 * @fileoverview The debug logger slothlet's own files write `config.debug` output through. Internal: it was exported
 * from `@cldmv/slothlet/errors` before v4.
 * @module @cldmv/slothlet/helpers/debug
 * @internal
 */
import { translate } from "#i18n";
import { ArrayMethods, filterList, Objects, StringMethods } from "#helpers/intrinsics";

/**
 * Debug utility class for centralized conditional console output with i18n
 * @internal
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
		// this.debugFlags is always a truthy object ({} at minimum) — constructor sets `config.debug || {}`,
		// so the `!this.debugFlags` left-hand branch of || is structurally unreachable.
		/* v8 ignore next */
		if (!this.debugFlags || !this.debugFlags[code]) {
			return;
		}

		// Extract key and message; remaining props are i18n interpolation params / extra context
		const { key: msgKey, message, ...contextParams } = context;

		// Key resolution: explicit key > category key (DEBUG_{CODE}) > raw message fallback
		const translationKey = msgKey ?? `DEBUG_${StringMethods.toUpperCase(code)}`;
		const translatedMessage = translate(translationKey, contextParams);
		const hasTranslation = translatedMessage && !StringMethods.startsWith(translatedMessage, "Error:");

		// Format label
		const label = `[DEBUG:${StringMethods.toUpperCase(code)}]`;

		// The console as it is now: hosts and test runners point it elsewhere after slothlet loads.
		if (hasTranslation) {
			globalThis.console.log(`${label} ${translatedMessage}`);
		} else if (message) {
			// Backwards compat: raw message string (no key provided, no category key found)
			globalThis.console.log(`${label} ${message}`);
		} else {
			// No message or translation - dump raw context
			globalThis.console.log(label, contextParams);
		}

		// Show interpolation params / extra context if present (never show 'key' or 'message')
		if ((hasTranslation || message) && Objects.keys(contextParams).length > 0) {
			globalThis.console.log(`${label} Context:`, contextParams);
		}
	}

	/**
	 * Custom string representation
	 * @returns {string} Debug info
	 */
	toString() {
		return `[SlothletDebug] flags: ${ArrayMethods.join(
			filterList(Objects.keys(this.debugFlags), (k) => this.debugFlags[k]),
			", "
		)}`;
	}
}
