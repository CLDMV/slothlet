/**
 *	@Project: @cldmv/slothlet
 *	@Filename: /src/lib/helpers/hooks.mjs
 *	@Date: 2025-12-18 00:00:00 -00:00
 *	@Author: Nate Hyson <CLDMV>
 *	@Email: <Shinrai@users.noreply.github.com>
 *	-----
 *	@Last modified by: Nate Hyson <CLDMV> (Shinrai@users.noreply.github.com)
 *	@Last modified time: 2026-01-08 16:08:18 -08:00 (1767917298)
 *	-----
 *	@Copyright: Copyright (c) 2013-2026 Catalyzed Motivation Inc. All rights reserved.
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
	 * @param {object} [options={}] - Additional options
	 * @param {boolean} [options.suppressErrors=false] - If true, errors are logged but not thrown (except for before/after hooks)
	 */
	constructor(enabled = true, defaultPattern = "**", options = {}) {
		this.enabled = enabled;
		this.defaultPattern = defaultPattern;
		this.enabledPatterns = new Set(); // Patterns currently enabled for execution
		this.patternFilterActive = false; // Whether pattern filtering is in use
		this.suppressErrors = options.suppressErrors || false;
		this.hooks = new Map(); // Map<name, {type, handler, priority, pattern, compiledPattern}>
		this.registrationOrder = 0; // Counter for maintaining registration order
		this.reportedErrors = new WeakSet(); // Track errors that have been reported to prevent duplicate error hook calls
	}

	/**
	 * @function on
	 * @public
	 * @param {string} type - Hook type: "before", "after", "always", or "error"
	 * @param {Function} handler - Hook handler function with type-specific signature:
	 *   - before: ({ path, args }) => modified args array or value to short-circuit
	 *   - after: ({ path, result }) => transformed result
	 *   - always: ({ path, result, hasError, errors }) => void (read-only)
	 *   - error: ({ path, error, errorType, source }) => void (observer)
	 * @param {object} [data] - Registration options
	 * @param {string} [data.id] - Hook ID for debugging and removal (auto-generated if not provided)
	 * @param {number} [data.priority=1000] - Execution priority (higher = earlier)
	 * @param {string} [data.pattern] - Glob pattern for path filtering (uses defaultPattern if not provided)
	 * @returns {string} Hook ID for later removal
	 *
	 * @description
	 * Register a hook with optional priority and pattern filtering.
	 *
	 * @example
	 * // Register hook with priority
	 * manager.on("before", handler, { priority: 200 });
	 *
	 * @example
	 * // Register hook with custom ID and pattern
	 * manager.on("before", handler, { id: "validator", pattern: "math.*", priority: 500 });
	 */
	on(type, handler, data = {}) {
		const id = data.id || `hook_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
		const priority = data.priority ?? 1000;
		const pattern = data.pattern || this.defaultPattern;
		const compiledPattern = this._compilePattern(pattern);
		const order = this.registrationOrder++;

		this.hooks.set(id, {
			tag: id,
			type,
			handler,
			priority,
			pattern,
			compiledPattern,
			order
		});

		return id;
	}

	/**
	 * Clean up all hooks and resources
	 * @public
	 * @description
	 * Clears all registered hooks and resets internal state.
	 * Should be called during shutdown to prevent memory leaks.
	 *
	 * @example
	 * // Clean up during shutdown
	 * manager.cleanup();
	 */
	cleanup() {
		this.hooks.clear();
		this.reportedErrors = new WeakSet();
		this.registrationOrder = 0;
		this.enabled = false;
	}

	/**
	 * @function off
	 * @public
	 * @param {string} nameOrPattern - Hook name or glob pattern to remove
	 * @returns {boolean} True if one or more hooks were removed
	 *
	 * @description
	 * Remove registered hook(s) by exact name or pattern matching.
	 *
	 * @example
	 * // Remove hook by exact name
	 * manager.off("validator");
	 *
	 * @example
	 * // Remove all hooks matching pattern
	 * manager.off("math.*");
	 */
	off(nameOrPattern) {
		// Fast path: exact name removal
		if (this.hooks.has(nameOrPattern)) {
			return this.hooks.delete(nameOrPattern);
		}

		// Pattern-based removal
		const compiled = this._compilePattern(nameOrPattern);
		let removed = false;
		for (const key of [...this.hooks.keys()]) {
			if (this._matchPattern(compiled, key)) {
				this.hooks.delete(key);
				removed = true;
			}
		}
		return removed;
	}

	/**
	 * @function clear
	 * @public
	 * @param {string} [type] - Optional hook type to clear ("before", "after", "always", "error")
	 * @returns {void}
	 *
	 * @description
	 * Remove registered hooks. If type is provided, only hooks of that type are removed.
	 *
	 * @example
	 * // Clear all hooks
	 * manager.clear();
	 *
	 * @example
	 * // Clear only before hooks
	 * manager.clear("before");
	 */
	clear(type) {
		if (type === undefined) {
			this.hooks.clear();
			this.registrationOrder = 0;
			return;
		}

		// Type-specific clearing
		for (const [name, hook] of this.hooks) {
			if (hook.type === type) {
				this.hooks.delete(name);
			}
		}
	}

	/**
	 * @function list
	 * @public
	 * @param {string} [type] - Optional hook type to filter by ("before", "after", "always", "error")
	 * @returns {object} Hook manager status and registered hooks
	 *
	 * @description
	 * Returns hook manager state including enabled patterns, global status, and registered hooks.
	 * When type is provided, only hooks matching that type are included.
	 *
	 * @example
	 * // Get full status
	 * const status = manager.list();
	 * console.log(status.enabledPatterns); // ["math.*", "string.*"]
	 *
	 * @example
	 * // List only before hooks
	 * const beforeStatus = manager.list("before");
	 */
	list(type) {
		const hooks = [];
		for (const [name, hook] of this.hooks) {
			if (type === undefined || hook.type === type) {
				hooks.push({
					name,
					type: hook.type,
					priority: hook.priority,
					pattern: hook.pattern,
					order: hook.order
				});
			}
		}

		return {
			globalEnabled: this.enabled,
			defaultPattern: this.defaultPattern,
			patternFilterActive: this.patternFilterActive,
			enabledPatterns: Array.from(this.enabledPatterns),
			registeredHooks: hooks
		};
	}

	/**
	 * @function enable
	 * @public
	 * @param {string} [pattern] - Pattern to enable for execution, or omit to enable all
	 * @returns {void}
	 *
	 * @description
	 * Enable hook execution globally or add pattern to enabled patterns.
	 * If pattern is provided, enables pattern-based filtering.
	 * If no pattern provided, clears all pattern filtering.
	 *
	 * @example
	 * // Enable all hooks (clear pattern filtering)
	 * manager.enable();
	 *
	 * // Enable only math operations
	 * manager.enable("math.*");
	 *
	 * // Add string operations to enabled patterns
	 * manager.enable("string.*");
	 */
	enable(pattern) {
		this.enabled = true;
		if (pattern !== undefined) {
			this.enabledPatterns.add(pattern);
			this.patternFilterActive = true;
		} else {
			// enable() with no args clears pattern filtering
			this.enabledPatterns.clear();
			this.patternFilterActive = false;
		}
	}

	/**
	 * @function disable
	 * @public
	 * @param {string} [pattern] - Pattern to disable, or omit to disable all hooks globally
	 * @returns {void}
	 *
	 * @description
	 * Disable hook execution globally or remove pattern from enabled patterns.
	 * If pattern is provided, removes it from pattern filtering.
	 * If no pattern provided, disables all hooks globally.
	 *
	 * @example
	 * // Disable all hooks globally
	 * manager.disable();
	 *
	 * // Remove math operations from enabled patterns
	 * manager.disable("math.*");
	 */
	disable(pattern) {
		if (pattern !== undefined) {
			this.enabledPatterns.delete(pattern);
			// If no patterns left, deactivate filtering
			if (this.enabledPatterns.size === 0) {
				this.patternFilterActive = false;
			}
		} else {
			// disable() with no args disables globally
			this.enabled = false;
		}
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
	executeBeforeHooks(path, args, self, context) {
		const hooks = this._getMatchingHooks("before", path);
		let currentArgs = args;

		for (const hook of hooks) {
			try {
				const result = hook.handler({ path: path, args: currentArgs, self, context });

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
			} catch (error) {
				// Error in before hook - report with source info
				this.reportedErrors.add(error);
				this.executeErrorHooks(
					path,
					error,
					{
						type: "before",
						hookId: hook.id,
						hookTag: hook.tag
					},
					self,
					context
				);
				throw error;
			}
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
	executeAfterHooks(path, initialResult, self, context) {
		const hooks = this._getMatchingHooks("after", path);
		let currentResult = initialResult;

		for (const hook of hooks) {
			try {
				const transformed = hook.handler({ path: path, result: currentResult, self, context });
				// If hook returns undefined, keep current result; otherwise use transformed
				if (transformed !== undefined) {
					currentResult = transformed;
				}
			} catch (error) {
				// Error in after hook - report with source info
				this.reportedErrors.add(error);
				this.executeErrorHooks(
					path,
					error,
					{
						type: "after",
						hookId: hook.id,
						hookTag: hook.tag
					},
					self
				);
				throw error;
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
	 * @param {Array<Error>} [errors=[]] - Array of errors that occurred during execution
	 * @returns {void}
	 *
	 * @description
	 * Execute always hooks (like finally blocks). These hooks always run regardless
	 * of whether execution was short-circuited, completed normally, or threw errors.
	 * Always hooks receive full execution context including both errors and results,
	 * allowing a single hook to handle all logging scenarios.
	 *
	 * @example
	 * // Execute always hooks with success result
	 * manager.executeAlwaysHooks("database.users.create", result, []);
	 *
	 * @example
	 * // Execute always hooks with error context
	 * manager.executeAlwaysHooks("database.users.create", undefined, [error]);
	 */
	executeAlwaysHooks(path, result, errors = [], self, context) {
		const hooks = this._getMatchingHooks("always", path);

		for (const hook of hooks) {
			try {
				hook.handler({
					path: path,
					result: result,
					hasError: errors.length > 0,
					errors,
					self,
					context
				});
			} catch (error) {
				// Error in always hook - report with source info but don't throw
				this.executeErrorHooks(
					path,
					error,
					{
						type: "always",
						hookId: hook.id,
						hookTag: hook.tag
					},
					self,
					context
				);
				// Don't re-throw - always hooks are observers
			}
		}
	}

	/**
	 * @function executeErrorHooks
	 * @internal
	 * @private
	 * @param {string} path - Function path
	 * @param {Error} error - Error that was thrown
	 * @param {Object} [source] - Source information about where error originated
	 * @param {string} source.type - Source type: 'before', 'function', 'after', 'always'
	 * @param {string} [source.hookId] - Hook ID if error came from a hook
	 * @param {string} [source.hookTag] - Hook tag if error came from a hook
	 * @returns {void}
	 *
	 * @description
	 * Execute error hooks (observers only, errors bubble naturally).
	 * Provides detailed context about where the error originated.
	 *
	 * @example
	 * // Execute error hooks with source info
	 * manager.executeErrorHooks("database.users.create", error, {
	 *   type: 'before',
	 *   hookId: 'hook-123',
	 *   hookTag: 'validation'
	 * });
	 */
	executeErrorHooks(path, error, source = { type: "unknown" }, self, context) {
		const hooks = this._getMatchingHooks("error", path);

		// Enhance error context with source information
		const errorContext = {
			path: path,
			error: error,
			errorType: error.constructor ? error.constructor.name : "Error",
			source: {
				type: source.type || "unknown",
				hookId: source.hookId,
				hookTag: source.hookTag,
				timestamp: Date.now(),
				stack: error.stack
			},
			self,
			context
		};

		for (const hook of hooks) {
			try {
				hook.handler(errorContext);
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
		// Fast-path: if hooks are disabled globally, return empty array
		if (!this.enabled) {
			return [];
		}

		// Pattern filtering check: if pattern filtering is active and path doesn't match enabled patterns
		if (this.patternFilterActive && !this._isPathEnabled(path)) {
			return [];
		}

		const matching = [];

		for (const [hookId, hook] of this.hooks.entries()) {
			if (hook.type !== type) continue;
			if (!this._matchPattern(hook.compiledPattern, path)) continue;
			matching.push({ ...hook, id: hookId });
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

	/**
	 * @function _isPathEnabled
	 * @internal
	 * @private
	 * @param {string} path - Function path to check
	 * @returns {boolean} True if path matches any enabled pattern
	 *
	 * @description
	 * Check if execution path matches any of the enabled patterns.
	 * Used for pattern-based execution filtering.
	 *
	 * @example
	 * // Internal usage
	 * const enabled = manager._isPathEnabled("math.add");
	 */
	_isPathEnabled(path) {
		if (!this.patternFilterActive) return true;

		for (const pattern of this.enabledPatterns) {
			const compiledPattern = this._compilePattern(pattern);
			if (this._matchPattern(compiledPattern, path)) {
				return true;
			}
		}
		return false;
	}
}
