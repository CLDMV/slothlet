/**
 *	@Project: @cldmv/slothlet
 *	@Filename: /src/lib/helpers/hooks.mjs
 *	@Date: 2025-12-18 00:00:00 -00:00
 *	@Author: Nate Hyson <CLDMV>
 *	@Email: <Shinrai@users.noreply.github.com>
 *	-----
 *	@Last modified by: Nate Hyson <CLDMV> (Shinrai@users.noreply.github.com)
 *	@Last modified time: 2025-12-18 00:00:00 -00:00
 *	-----
 *	@Copyright: Copyright (c) 2013-2025 Catalyzed Motivation Inc. All rights reserved.
 */

/**
 * @fileoverview Hook management system for slothlet function interception.
 * @module @cldmv/slothlet/helpers/hooks
 * @memberof module:@cldmv/slothlet
 * @internal
 * @private
 *
 * @description
 * Provides priority-based hook system with glob pattern matching for intercepting
 * slothlet API function calls. Supports before/after/always/error hooks with argument
 * modification, short-circuiting, result transformation, and read-only observation.
 *
 * @example
 * // Internal usage within slothlet
 * import { HookManager } from "@cldmv/slothlet/helpers/hooks";
 */

const MAX_BRACE_NESTING = 10;

/**
 * @class HookManager
 * @internal
 * @private
 *
 * @description
 * Manages registration, pattern matching, and execution of hooks for slothlet API calls.
 * Hooks are executed in priority order (higher priority first), then registration order.
 *
 * @example
 * // Create hook manager
 * const manager = new HookManager();
 * manager.on("logger", "before", (ctx) => { console.log(ctx.path); });
 */
export class HookManager {
	/**
	 * @constructor
	 * @param {boolean} [enabled=true] - Initial enabled state
	 * @param {string} [defaultPattern="**"] - Default pattern for filtering
	 */
	constructor(enabled = true, defaultPattern = "**") {
		this.enabled = enabled;
		this.defaultPattern = defaultPattern;
		this.hooks = new Map(); // Map<name, {type, handler, priority, pattern, compiledPattern}>
		this.registrationOrder = 0; // Counter for maintaining registration order
	}

	/**
	 * @function on
	 * @public
	 * @param {string} name - Hook name/ID for debugging and removal
	 * @param {string} type - Hook type: "before", "after", "always", or "error"
	 * @param {Function} handler - Hook handler function
	 * @param {object} [options] - Registration options
	 * @param {number} [options.priority=100] - Execution priority (higher = earlier)
	 * @param {string} [options.pattern] - Glob pattern for path filtering
	 * @returns {void}
	 *
	 * @description
	 * Register a hook with optional priority and pattern filtering.
	 *
	 * @example
	 * // Register hook with priority
	 * manager.on("validator", "before", handler, { priority: 200 });
	 */
	on(name, type, handler, options = {}) {
		const priority = options.priority ?? 100;
		const pattern = options.pattern || this.defaultPattern;
		const compiledPattern = this._compilePattern(pattern);
		const order = this.registrationOrder++;

		this.hooks.set(name, {
			type,
			handler,
			priority,
			pattern,
			compiledPattern,
			order
		});
	}

	/**
	 * @function off
	 * @public
	 * @param {string} name - Hook name to remove
	 * @returns {boolean} True if hook was removed
	 *
	 * @description
	 * Remove a registered hook by name.
	 *
	 * @example
	 * // Remove hook
	 * manager.off("validator");
	 */
	off(name) {
		return this.hooks.delete(name);
	}

	/**
	 * @function clear
	 * @public
	 * @returns {void}
	 *
	 * @description
	 * Remove all registered hooks.
	 *
	 * @example
	 * // Clear all hooks
	 * manager.clear();
	 */
	clear() {
		this.hooks.clear();
		this.registrationOrder = 0;
	}

	/**
	 * @function list
	 * @public
	 * @returns {Array<object>} Array of hook metadata
	 *
	 * @description
	 * List all registered hooks with their metadata.
	 *
	 * @example
	 * // List hooks
	 * const hooks = manager.list();
	 */
	list() {
		const result = [];
		for (const [name, hook] of this.hooks) {
			result.push({
				name,
				type: hook.type,
				priority: hook.priority,
				pattern: hook.pattern,
				order: hook.order
			});
		}
		return result;
	}

	/**
	 * @function enable
	 * @public
	 * @param {string} [pattern] - Optional new default pattern
	 * @returns {void}
	 *
	 * @description
	 * Enable hook execution, optionally updating default pattern.
	 *
	 * @example
	 * // Enable with new pattern
	 * manager.enable("database.*");
	 */
	enable(pattern) {
		this.enabled = true;
		if (pattern !== undefined) {
			this.defaultPattern = pattern;
		}
	}

	/**
	 * @function disable
	 * @public
	 * @returns {void}
	 *
	 * @description
	 * Disable hook execution (fast-path bypass).
	 *
	 * @example
	 * // Disable hooks
	 * manager.disable();
	 */
	disable() {
		this.enabled = false;
	}

	/**
	 * @function executeBeforeHooks
	 * @internal
	 * @private
	 * @param {string} path - Function path (e.g., "database.users.create")
	 * @param {Array} args - Function arguments
	 * @returns {{cancelled: boolean, value?: any, args: Array}} Execution result
	 *
	 * @description
	 * Execute before hooks in priority order. Returns object indicating if execution
	 * should be cancelled (short-circuited) and potentially modified arguments.
	 *
	 * Hook return semantics:
	 * - undefined: continue to next hook/function
	 * - Array: modified arguments for next hook/function
	 * - Other value: short-circuit and return this value
	 *
	 * @example
	 * // Execute before hooks
	 * const result = manager.executeBeforeHooks("database.users.create", [data]);
	 * if (result.cancelled) return result.value;
	 */
	executeBeforeHooks(path, args) {
		const hooks = this._getMatchingHooks("before", path);
		let currentArgs = args;

		for (const hook of hooks) {
			const result = hook.handler({ path, args: currentArgs });

			// undefined = continue
			if (result === undefined) {
				continue;
			}

			// Array = modified args
			if (Array.isArray(result)) {
				currentArgs = result;
				continue;
			}

			// Any other value = short-circuit
			return { cancelled: true, value: result, args: currentArgs };
		}

		return { cancelled: false, args: currentArgs };
	}

	/**
	 * @function executeAfterHooks
	 * @internal
	 * @private
	 * @param {string} path - Function path
	 * @param {any} initialResult - Initial result from function
	 * @returns {any} Transformed result
	 *
	 * @description
	 * Execute after hooks in priority order, chaining results through each hook.
	 * Each hook receives the previous hook's return value (or initial result).
	 * After hooks only run if the function actually executed (not short-circuited).
	 *
	 * @example
	 * // Execute after hooks with chaining
	 * const finalResult = manager.executeAfterHooks("database.users.create", result);
	 */
	executeAfterHooks(path, initialResult) {
		const hooks = this._getMatchingHooks("after", path);
		let currentResult = initialResult;

		for (const hook of hooks) {
			const transformed = hook.handler({ path, result: currentResult });
			// If hook returns undefined, keep current result; otherwise use transformed
			if (transformed !== undefined) {
				currentResult = transformed;
			}
		}

		return currentResult;
	}

	/**
	 * @function executeAlwaysHooks
	 * @internal
	 * @private
	 * @param {string} path - Function path
	 * @param {any} result - Final result (from function or short-circuit)
	 * @returns {void}
	 *
	 * @description
	 * Execute always hooks (like finally blocks). These hooks always run regardless
	 * of whether execution was short-circuited or completed normally. Always hooks
	 * are read-only observers and cannot modify the result.
	 *
	 * @example
	 * // Execute always hooks
	 * manager.executeAlwaysHooks("database.users.create", result);
	 */
	executeAlwaysHooks(path, result) {
		const hooks = this._getMatchingHooks("always", path);

		for (const hook of hooks) {
			try {
				hook.handler({ path, result });
			} catch (hookError) {
				// Error in always hook - log but don't throw
				console.error(`Error in always hook for ${path}:`, hookError);
			}
		}
	}

	/**
	 * @function executeErrorHooks
	 * @internal
	 * @private
	 * @param {string} path - Function path
	 * @param {Error} error - Error that was thrown
	 * @returns {void}
	 *
	 * @description
	 * Execute error hooks (observers only, errors bubble naturally).
	 *
	 * @example
	 * // Execute error hooks
	 * manager.executeErrorHooks("database.users.create", error);
	 */
	executeErrorHooks(path, error) {
		const hooks = this._getMatchingHooks("error", path);

		for (const hook of hooks) {
			try {
				hook.handler({ path, error });
			} catch (hookError) {
				// Error in error hook - log but don't throw
				console.error(`Error in error hook for ${path}:`, hookError);
			}
		}
	}

	/**
	 * @function _getMatchingHooks
	 * @internal
	 * @private
	 * @param {string} type - Hook type to match
	 * @param {string} path - Function path to test against patterns
	 * @returns {Array<object>} Sorted array of matching hooks
	 *
	 * @description
	 * Get hooks matching type and path, sorted by priority (DESC) then order (ASC).
	 *
	 * @example
	 * // Get matching hooks
	 * const hooks = manager._getMatchingHooks("before", "database.users.create");
	 */
	_getMatchingHooks(type, path) {
		const matching = [];

		for (const hook of this.hooks.values()) {
			if (hook.type !== type) continue;
			if (!this._matchPattern(hook.compiledPattern, path)) continue;
			matching.push(hook);
		}

		// Sort: priority DESC, then order ASC
		matching.sort((a, b) => {
			if (a.priority !== b.priority) {
				return b.priority - a.priority; // Higher priority first
			}
			return a.order - b.order; // Earlier registration first
		});

		return matching;
	}

	/**
	 * @function _compilePattern
	 * @internal
	 * @private
	 * @param {string} pattern - Glob pattern string
	 * @returns {RegExp|null} Compiled RegExp or null for negation patterns
	 *
	 * @description
	 * Compile glob pattern to RegExp with support for:
	 * - `*`: single-level wildcard
	 * - `**`: multi-level wildcard
	 * - `{users,posts}`: brace expansion (max 10 nesting levels)
	 * - `!internal.*`: negation patterns
	 *
	 * @example
	 * // Compile pattern
	 * const regex = manager._compilePattern("database.*.create");
	 */
	_compilePattern(pattern) {
		// Handle negation patterns
		if (pattern.startsWith("!")) {
			return {
				negation: true,
				regex: this._compilePattern(pattern.slice(1))
			};
		}

		// Expand braces first (with nesting limit)
		const expanded = this._expandBraces(pattern);
		if (expanded.length > 1) {
			// Multiple alternatives - create alternation regex
			const regexes = expanded.map((p) => this._patternToRegex(p));
			return new RegExp(`^(?:${regexes.join("|")})$`);
		}

		// Single pattern
		return new RegExp(`^${this._patternToRegex(expanded[0])}$`);
	}

	/**
	 * @function _expandBraces
	 * @internal
	 * @private
	 * @param {string} pattern - Pattern with potential braces
	 * @param {number} [depth=0] - Current nesting depth
	 * @returns {Array<string>} Expanded pattern alternatives
	 *
	 * @description
	 * Expand brace patterns like `{users,posts}` to multiple alternatives.
	 * Limits nesting to MAX_BRACE_NESTING to prevent performance issues.
	 *
	 * @example
	 * // Expand braces
	 * const patterns = manager._expandBraces("{users,posts}.create");
	 * // Returns: ["users.create", "posts.create"]
	 */
	_expandBraces(pattern, depth = 0) {
		if (depth > MAX_BRACE_NESTING) {
			throw new Error(`Brace expansion exceeds maximum nesting depth of ${MAX_BRACE_NESTING}`);
		}

		const braceStart = pattern.indexOf("{");
		if (braceStart === -1) {
			return [pattern];
		}

		// Find matching closing brace
		let braceEnd = -1;
		let nestLevel = 0;
		for (let i = braceStart; i < pattern.length; i++) {
			if (pattern[i] === "{") nestLevel++;
			if (pattern[i] === "}") {
				nestLevel--;
				if (nestLevel === 0) {
					braceEnd = i;
					break;
				}
			}
		}

		if (braceEnd === -1) {
			// No matching brace, treat as literal
			return [pattern];
		}

		const before = pattern.slice(0, braceStart);
		const inside = pattern.slice(braceStart + 1, braceEnd);
		const after = pattern.slice(braceEnd + 1);

		// Split alternatives (respecting nested braces)
		const alternatives = this._splitAlternatives(inside);

		// Recursively expand each alternative
		const results = [];
		for (const alt of alternatives) {
			const expanded = this._expandBraces(before + alt + after, depth + 1);
			results.push(...expanded);
		}

		return results;
	}

	/**
	 * @function _splitAlternatives
	 * @internal
	 * @private
	 * @param {string} str - String to split on commas
	 * @returns {Array<string>} Split alternatives
	 *
	 * @description
	 * Split brace content on commas, respecting nested braces.
	 *
	 * @example
	 * // Split alternatives
	 * const alts = manager._splitAlternatives("users,posts,{admin,guest}");
	 */
	_splitAlternatives(str) {
		const alternatives = [];
		let current = "";
		let nestLevel = 0;

		for (let i = 0; i < str.length; i++) {
			const char = str[i];
			if (char === "{") nestLevel++;
			if (char === "}") nestLevel--;

			if (char === "," && nestLevel === 0) {
				alternatives.push(current);
				current = "";
			} else {
				current += char;
			}
		}

		if (current) {
			alternatives.push(current);
		}

		return alternatives;
	}

	/**
	 * @function _patternToRegex
	 * @internal
	 * @private
	 * @param {string} pattern - Pattern without braces
	 * @returns {string} Regex pattern string
	 *
	 * @description
	 * Convert glob pattern to regex pattern string.
	 *
	 * @example
	 * // Convert pattern
	 * const regex = manager._patternToRegex("database.*.create");
	 */
	_patternToRegex(pattern) {
		// Escape special regex characters except * and .
		let regex = pattern.replace(/[+?^${}()|[\]\\]/g, "\\$&");

		// Escape dots FIRST (before wildcard replacements)
		regex = regex.replace(/\./g, "\\.");

		// Replace ** with placeholder to avoid interference with single * replacement
		regex = regex.replace(/\*\*/g, "___DOUBLESTAR___");

		// Replace * with single-level wildcard (no dots)
		regex = regex.replace(/\*/g, "([^\\.]+)");

		// Replace ** placeholder with multi-level wildcard
		regex = regex.replace(/___DOUBLESTAR___/g, ".*?");

		return regex;
	}

	/**
	 * @function _matchPattern
	 * @internal
	 * @private
	 * @param {RegExp|object} compiledPattern - Compiled pattern or negation object
	 * @param {string} path - Path to test
	 * @returns {boolean} True if path matches pattern
	 *
	 * @description
	 * Test if path matches compiled pattern, handling negation.
	 *
	 * @example
	 * // Match pattern
	 * const matches = manager._matchPattern(compiledPattern, "database.users.create");
	 */
	_matchPattern(compiledPattern, path) {
		if (compiledPattern.negation) {
			// Negation: match if inner pattern does NOT match
			return !this._matchPattern(compiledPattern.regex, path);
		}

		return compiledPattern.test(path);
	}
}
