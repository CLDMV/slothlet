/**
 * @fileoverview Hook manager for intercepting API function calls
 * @module handlers/hook-manager
 */

import { ComponentBase } from "@cldmv/slothlet/factories/component-base";

/**
 * Symbol to mark errors that have already been processed by hook error handlers
 * @private
 */
const ERROR_HOOK_PROCESSED = Symbol.for("@cldmv/slothlet/hook-error-processed");

/**
 * Manages hooks for API function interception.
 * Supports before/after/always/error hooks with pattern matching and priority ordering.
 *
 * @class HookManager
 * @extends ComponentBase
 */
export class HookManager extends ComponentBase {
	/**
	 * Property name for auto-discovery
	 * @type {string}
	 * @static
	 */
	static slothletProperty = "hookManager";

	/**
	 * Hook storage organized by type → subset → pattern
	 * @type {object}
	 * @private
	 */
	#hooks = {
		before: { before: {}, primary: {}, after: {} },
		after: { before: {}, primary: {}, after: {} },
		always: { before: {}, primary: {}, after: {} },
		error: { before: {}, primary: {}, after: {} }
	};

	/**
	 * Hook lookup by ID
	 * @type {Map<string, object>}
	 * @private
	 */
	#byId = new Map();

	/**
	 * Counter for auto-generated IDs
	 * @type {number}
	 * @private
	 */
	#idCounter = 0;

	/**
	 * Valid hook types
	 * @type {Set<string>}
	 * @private
	 */
	#validTypes = new Set(["before", "after", "always", "error"]);

	/**
	 * Valid subset phases
	 * @type {Set<string>}
	 * @private
	 */
	#validSubsets = new Set(["before", "primary", "after"]);

	/**
	 * Creates a new HookManager instance.
	 * @param {object} slothlet - Parent slothlet instance
	 */
	constructor(slothlet) {
		super(slothlet);

		// Read hook configuration from slothlet.config.hooks
		const hookConfig = slothlet.config?.hook || { enabled: false, pattern: "**", suppressErrors: false };

		this.enabled = hookConfig.enabled;
		this.defaultPattern = hookConfig.pattern || "**";
		this.suppressErrors = hookConfig.suppressErrors || false;
		this.enabledPatterns = new Set(); // Patterns currently enabled for execution
		this.patternFilterActive = false; // Whether pattern filtering is in use

		this.hooks = new Map(); // Map<name, {type, handler, priority, pattern, compiledPattern, subset}>
		this.registrationOrder = 0; // Counter for maintaining registration order
		this.reportedErrors = new WeakSet(); // Track errors that have been reported to prevent duplicate error hook calls
	}

	/**
	 * Register a hook for API functions.
	 *
	 * @param {string} typePattern - Combined type and pattern (e.g., "before:math.*")
	 * @param {function} handler - Hook handler function
	 * @param {object} [options={}] - Hook options
	 * @param {string} [options.id] - Unique identifier (auto-generated if not provided)
	 * @param {number} [options.priority=0] - Higher = earlier execution
	 * @param {string} [options.subset="primary"] - Phase: "before", "primary", or "after"
	 * @returns {string} Hook ID
	 * @public
	 *
	 * @example
	 * hookManager.on("before:math.*", ({ args }) => {
	 *   console.log("Args:", args);
	 *   return args;
	 * }, { priority: 100 });
	 */
	on(typePattern, handler, options = {}) {
		// Parse typePattern (format: "type:pattern")
		const { type, pattern } = this.#parseTypePattern(typePattern);

		// Validate type
		if (!this.#validTypes.has(type)) {
			throw this.slothlet.SlothletError("INVALID_HOOK_TYPE", {
				type,
				validTypes: Array.from(this.#validTypes)
			});
		}

		// Validate handler
		if (typeof handler !== "function") {
			throw this.slothlet.SlothletError("INVALID_HOOK_HANDLER", {
				receivedType: typeof handler
			});
		}

		// Get or generate ID
		const id = options.id || this.#generateId();

		// Check for duplicate ID
		if (this.#byId.has(id)) {
			throw this.slothlet.SlothletError("DUPLICATE_HOOK_ID", { id });
		}

		// Get subset (default: primary)
		const subset = options.subset || "primary";
		if (!this.#validSubsets.has(subset)) {
			throw this.slothlet.SlothletError("INVALID_HOOK_SUBSET", {
				subset,
				validSubsets: Array.from(this.#validSubsets)
			});
		}

		// Create hook object
		const hook = {
			id,
			type,
			pattern,
			handler,
			priority: options.priority || 0,
			subset,
			enabled: true,
			_compiled: null // Lazy compile pattern on first use
		};

		// Store in type → subset → pattern group
		const typeIndex = this.#hooks[type];
		const subsetIndex = typeIndex[subset];

		if (!subsetIndex[pattern]) {
			subsetIndex[pattern] = [];
		}
		subsetIndex[pattern].push(hook);

		// Add to ID index
		this.#byId.set(id, hook);

		return id;
	}

	/**
	 * Remove hooks matching filter criteria.
	 *
	 * @param {object} [filter={}] - Filter criteria
	 * @param {string} [filter.id] - Remove hook by ID
	 * @param {string} [filter.type] - Remove hooks by type
	 * @param {string} [filter.pattern] - Remove hooks matching pattern
	 * @returns {number} Number of hooks removed
	 * @public
	 */
	remove(filter = {}) {
		let removed = 0;

		// Filter by ID (fast path)
		if (filter.id) {
			const hook = this.#byId.get(filter.id);
			if (hook) {
				this.#removeHook(hook);
				removed = 1;
			}
			return removed;
		}

		// Filter by type and/or pattern
		const types = filter.type ? [filter.type] : Array.from(this.#validTypes);

		for (const type of types) {
			const typeIndex = this.#hooks[type];

			for (const subset of ["before", "primary", "after"]) {
				const subsetIndex = typeIndex[subset];

				// If pattern filter provided, only check that pattern
				if (filter.pattern) {
					const patternHooks = subsetIndex[filter.pattern];
					if (patternHooks) {
						removed += patternHooks.length;
						patternHooks.forEach((hook) => this.#byId.delete(hook.id));
						delete subsetIndex[filter.pattern];
					}
				} else {
					// Remove all patterns in this subset
					for (const pattern in subsetIndex) {
						const patternHooks = subsetIndex[pattern];
						removed += patternHooks.length;
						patternHooks.forEach((hook) => this.#byId.delete(hook.id));
						delete subsetIndex[pattern];
					}
				}
			}
		}

		return removed;
	}

	/**
	 * Enable hooks matching filter criteria.
	 *
	 * @param {object|string} [filter={}] - Filter criteria (empty = enable all, string = pattern)
	 * @param {string} [filter.id] - Enable hook by ID
	 * @param {string} [filter.type] - Enable hooks by type
	 * @param {string} [filter.pattern] - Enable hooks matching pattern
	 * @returns {number} Number of hooks enabled
	 * @public
	 */
	enable(filter = {}) {
		// Support string pattern shorthand
		if (typeof filter === "string") {
			filter = { pattern: filter };
		}

		// Always enable globally when enabling any hooks
		this.enabled = true;

		return this.#setEnabledState(filter, true);
	}

	/**
	 * Disable hooks matching filter criteria.
	 *
	 * @param {object|string} [filter={}] - Filter criteria (empty = disable all, string = pattern)
	 * @param {string} [filter.id] - Disable hook by ID
	 * @param {string} [filter.type] - Disable hooks by type
	 * @param {string} [filter.pattern] - Disable hooks matching pattern
	 * @returns {number} Number of hooks disabled
	 * @public
	 */
	disable(filter = {}) {
		// Support string pattern shorthand
		if (typeof filter === "string") {
			filter = { pattern: filter };
		}

		// If no filter provided, disable globally
		if (Object.keys(filter).length === 0) {
			this.enabled = false;
		}
		return this.#setEnabledState(filter, false);
	}

	/**
	 * List registered hooks matching filter criteria.
	 *
	 * @param {object} [filter={}] - Filter criteria (empty = list all)
	 * @param {string} [filter.id] - List hook by ID
	 * @param {string} [filter.type] - List hooks by type
	 * @param {string} [filter.pattern] - List hooks matching pattern
	 * @param {boolean} [filter.enabled] - Filter by enabled state
	 * @returns {Array<object>} Array of hook objects
	 * @public
	 */
	list(filter = {}) {
		const hooks = [];

		// Filter by ID (fast path)
		if (filter.id) {
			const hook = this.#byId.get(filter.id);
			if (hook && (filter.enabled === undefined || hook.enabled === filter.enabled)) {
				hooks.push(this.#serializeHook(hook));
			}
			return hooks;
		}

		// Filter by type and/or pattern
		const types = filter.type ? [filter.type] : Array.from(this.#validTypes);

		for (const type of types) {
			const typeIndex = this.#hooks[type];

			for (const subset of ["before", "primary", "after"]) {
				const subsetIndex = typeIndex[subset];

				// If pattern filter provided, only check that pattern
				if (filter.pattern) {
					const patternHooks = subsetIndex[filter.pattern] || [];
					for (const hook of patternHooks) {
						if (filter.enabled === undefined || hook.enabled === filter.enabled) {
							hooks.push(this.#serializeHook(hook));
						}
					}
				} else {
					// Get all patterns in this subset
					for (const pattern in subsetIndex) {
						const patternHooks = subsetIndex[pattern];
						for (const hook of patternHooks) {
							if (filter.enabled === undefined || hook.enabled === filter.enabled) {
								hooks.push(this.#serializeHook(hook));
							}
						}
					}
				}
			}
		}

		return hooks;
	}

	/**
	 * Get hooks for a specific API path and type.
	 * Used internally by UnifiedWrapper.
	 *
	 * @param {string} type - Hook type (before/after/always/error)
	 * @param {string} apiPath - API path (e.g., "math.add")
	 * @returns {Array<object>} Sorted array of matching hooks
	 * @public
	 */
	getHooksForPath(type, apiPath) {
		// Fast path: globally disabled (check config)
		if (this.slothlet.config?.hooks?.enabled === false) {
			return [];
		}

		const typeIndex = this.#hooks[type];
		if (!typeIndex) {
			return [];
		}

		const hooks = [];

		// Process subsets in order: before → primary → after
		for (const subset of ["before", "primary", "after"]) {
			const subsetIndex = typeIndex[subset];

			// Check each pattern group in this subset
			for (const pattern in subsetIndex) {
				const patternHooks = subsetIndex[pattern];

				// Try exact match first (no compilation needed)
				if (pattern === apiPath) {
					hooks.push(...patternHooks.filter((h) => h.enabled));
					continue;
				}

				// Check if pattern matches with cached compilation
				for (const hook of patternHooks) {
					if (!hook.enabled) continue;

					if (!hook._compiled) {
						hook._compiled = this.#compilePattern(hook.pattern);
					}

					if (hook._compiled(apiPath)) {
						hooks.push(hook);
					}
				}
			}
		}

		// Sort by priority once (highest first)
		return hooks.sort((a, b) => b.priority - a.priority);
	}

	/**
	 * Execute before hooks for an API path.
	 *
	 * @param {string} path - API path being called
	 * @param {Array} args - Function arguments
	 * @param {object} api - Bound API object
	 * @param {object} ctx - User context object
	 * @returns {object} Result object: { args, shortCircuit, value }
	 * @public
	 */
	executeBeforeHooks(path, args, api, ctx) {
		const hooks = this.getHooksForPath("before", path);

		for (const hook of hooks) {
			try {
				const result = hook.handler({ path, args, api, ctx });

				// Before hooks must be synchronous - reject Promises
				if (result && typeof result === "object" && typeof result.then === "function") {
					throw new Error(`Before hook "${hook.id}" for path "${path}" returned a Promise. Before hooks must be synchronous.`);
				}

				// Check for short-circuit (hook returns value directly)
				if (result !== undefined && !Array.isArray(result)) {
					return { args, shortCircuit: true, value: result };
				}

				// Hook can modify args by returning array
				if (Array.isArray(result)) {
					args = result;
				}
			} catch (error) {
				// Execute error hooks for before hook failure
				const sourceInfo = {
					type: "before",
					hookTag: hook.id,
					hookId: hook.id,
					timestamp: Date.now(),
					stack: error.stack
				};
				this.executeErrorHooks(path, error, sourceInfo, args, api, ctx);
				// Only throw if suppressErrors is false
				if (!this.suppressErrors) {
					throw error;
				}
				// Error suppressed - short-circuit with undefined
				return { args, shortCircuit: true, value: undefined };
			}
		}

		return { args, shortCircuit: false };
	}

	/**
	 * Execute after hooks for an API path.
	 *
	 * @param {string} path - API path being called
	 * @param {*} result - Function return value
	 * @param {Array} args - Original function arguments
	 * @param {object} api - Bound API object
	 * @param {object} ctx - User context object
	 * @returns {{ modified: boolean, result?: * }} Object indicating if result was modified and the final result
	 * @public
	 */
	executeAfterHooks(path, result, args, api, ctx) {
		const hooks = this.getHooksForPath("after", path);
		const originalResult = result;
		let currentResult = result;

		for (const hook of hooks) {
			try {
				const hookContext = {
					path,
					args,
					result: currentResult,
					api,
					ctx
				};
				const transformed = hook.handler(hookContext);

				// Hook can transform result by returning a value
				if (transformed !== undefined) {
					currentResult = transformed;
				}
			} catch (error) {
				// Execute error hooks for after hook failure
				const sourceInfo = {
					type: "after",
					hookTag: hook.id,
					hookId: hook.id,
					timestamp: Date.now(),
					stack: error.stack
				};
				this.executeErrorHooks(path, error, sourceInfo, args, api, ctx);
				// Only throw if suppressErrors is false
				if (!this.suppressErrors) {
					throw error;
				}
			}
		}

		// Return protocol object indicating modification status
		if (currentResult === originalResult) {
			return { modified: false };
		} else {
			return { modified: true, result: currentResult };
		}
	}

	/**
	 * Execute always hooks for an API path.
	 *
	 * @param {string} path - API path being called
	 * @param {Array} args - Function arguments
	 * @param {*} [resultOrError] - Function result or error
	 * @param {boolean} [hasError=false] - Whether an error occurred
	 * @param {object} api - Bound API object
	 * @param {object} ctx - User context object
	 * @public
	 */
	executeAlwaysHooks(path, args, resultOrError, hasError = false, api, ctx) {
		const hooks = this.getHooksForPath("always", path);

		for (const hook of hooks) {
			try {
				hook.handler({
					path,
					args,
					result: hasError ? undefined : resultOrError,
					error: hasError ? resultOrError : undefined,
					hasError,
					api,
					ctx
				});
			} catch (error) {
				// Execute error hooks for always hook failure
				const sourceInfo = {
					type: "always",
					hookTag: hook.id,
					hookId: hook.id,
					timestamp: Date.now(),
					stack: error.stack
				};
				this.executeErrorHooks(path, error, sourceInfo, args, api, ctx);
			}
		}
	}

	/**
	 * Execute error hooks for an API path.
	 *
	 * @param {string} path - API path being called
	 * @param {Error} error - The error that occurred
	 * @param {object} source - Error source info with type, hookTag, hookId, timestamp, stack
	 * @param {Array} [args] - Function arguments
	 * @param {object} api - Bound API object
	 * @param {object} ctx - User context object
	 * @public
	 */
	executeErrorHooks(path, error, source, args, api, ctx) {
		// Mark error as processed to prevent double-handling
		if (error && typeof error === "object") {
			error[ERROR_HOOK_PROCESSED] = true;
		}

		const hooks = this.getHooksForPath("error", path);

		for (const hook of hooks) {
			try {
				hook.handler({
					path,
					args,
					error,
					source,
					timestamp: new Date(),
					api,
					ctx
				});
			} catch (hookError) {
				// Error hooks errors are logged but don't propagate
				this.slothlet.debug("hooks", `Error hook failed for ${path}:`, hookError);
			}
		}
	}

	/**
	 * Parse typePattern into type and pattern.
	 * Format: "type:pattern" where only FIRST : is separator.
	 *
	 * @param {string} typePattern - Combined type and pattern
	 * @returns {object} Object with type and pattern properties
	 * @private
	 */
	#parseTypePattern(typePattern) {
		if (typeof typePattern !== "string") {
			throw this.slothlet.SlothletError("INVALID_TYPE_PATTERN", {
				typePattern,
				expected: "string in format 'type:pattern'"
			});
		}

		const colonIndex = typePattern.indexOf(":");
		if (colonIndex === -1) {
			throw this.slothlet.SlothletError("INVALID_TYPE_PATTERN", {
				typePattern,
				expected: "string in format 'type:pattern' with at least one colon"
			});
		}

		const type = typePattern.substring(0, colonIndex);
		const pattern = typePattern.substring(colonIndex + 1);

		if (!type || !pattern) {
			throw this.slothlet.SlothletError("INVALID_TYPE_PATTERN", {
				typePattern,
				expected: "non-empty type and pattern"
			});
		}

		return { type, pattern };
	}

	/**
	 * Compile a glob pattern into a matcher function.
	 * Supports: * (any chars except .), ** (any chars including .), ? (single char)
	 *
	 * @param {string} pattern - Glob pattern
	 * @returns {function} Matcher function that takes a path and returns boolean
	 * @private
	 */
	#compilePattern(pattern) {
		// Escape special regex characters except *, ?, and .
		let regexPattern = pattern
			.replace(/[+^${}()|[\]\\]/g, "\\$&")
			.replace(/\*\*/g, "\x00") // Placeholder for **
			.replace(/\*/g, "[^.]*") // * matches any chars except .
			.replace(/\x00/g, ".*") // ** matches any chars including .
			.replace(/\?/g, "."); // ? matches single char

		regexPattern = `^${regexPattern}$`;
		const regex = new RegExp(regexPattern);

		return (path) => regex.test(path);
	}

	/**
	 * Get the pattern compilation function for diagnostic purposes.
	 * Only exposed when diagnostics mode is enabled.
	 *
	 * @returns {function} The pattern compilation function
	 * @internal
	 */
	getCompilePatternForDiagnostics() {
		return this.#compilePattern.bind(this);
	}

	/**
	 * Generate a unique hook ID.
	 *
	 * @returns {string} Generated ID
	 * @private
	 */
	#generateId() {
		return `hook-${++this.#idCounter}`;
	}

	/**
	 * Remove a specific hook from storage.
	 *
	 * @param {object} hook - Hook object to remove
	 * @private
	 */
	#removeHook(hook) {
		const typeIndex = this.#hooks[hook.type];
		const subsetIndex = typeIndex[hook.subset];
		const patternHooks = subsetIndex[hook.pattern];

		if (patternHooks) {
			const index = patternHooks.indexOf(hook);
			if (index !== -1) {
				patternHooks.splice(index, 1);
			}

			// Clean up empty pattern arrays
			if (patternHooks.length === 0) {
				delete subsetIndex[hook.pattern];
			}
		}

		this.#byId.delete(hook.id);
	}

	/**
	 * Set enabled state for hooks matching filter.
	 *
	 * @param {object} filter - Filter criteria
	 * @param {boolean} enabled - New enabled state
	 * @returns {number} Number of hooks affected
	 * @private
	 */
	#setEnabledState(filter, enabled) {
		let affected = 0;

		// Filter by ID (fast path)
		if (filter.id) {
			const hook = this.#byId.get(filter.id);
			if (hook) {
				hook.enabled = enabled;
				affected = 1;
			}
			return affected;
		}

		// Filter by type and/or pattern
		const types = filter.type ? [filter.type] : Array.from(this.#validTypes);

		for (const type of types) {
			const typeIndex = this.#hooks[type];

			for (const subset of ["before", "primary", "after"]) {
				const subsetIndex = typeIndex[subset];

				// If pattern filter provided, only affect that pattern
				if (filter.pattern) {
					const patternHooks = subsetIndex[filter.pattern] || [];
					for (const hook of patternHooks) {
						hook.enabled = enabled;
						affected++;
					}
				} else {
					// Affect all patterns in this subset
					for (const pattern in subsetIndex) {
						const patternHooks = subsetIndex[pattern];
						for (const hook of patternHooks) {
							hook.enabled = enabled;
							affected++;
						}
					}
				}
			}
		}

		return affected;
	}

	/**
	 * Serialize a hook object for external consumption.
	 * Removes internal fields and makes it safe to return.
	 *
	 * @param {object} hook - Internal hook object
	 * @returns {object} Serialized hook object
	 * @private
	 */
	#serializeHook(hook) {
		return {
			id: hook.id,
			type: hook.type,
			pattern: hook.pattern,
			priority: hook.priority,
			subset: hook.subset,
			enabled: hook.enabled
			// Don't expose: handler, _compiled
		};
	}

	/**
	 * Cleanup hook manager on shutdown.
	 * @public
	 */
	async shutdown() {
		// Clear all hooks
		this.#hooks = {
			before: { before: {}, primary: {}, after: {} },
			after: { before: {}, primary: {}, after: {} },
			always: { before: {}, primary: {}, after: {} },
			error: { before: {}, primary: {}, after: {} }
		};
		this.#byId.clear();
		this.#idCounter = 0;
	}
}
