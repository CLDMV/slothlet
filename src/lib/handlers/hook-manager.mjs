/**
 *	@Project: @cldmv/slothlet
 *	@Filename: /src/lib/handlers/hook-manager.mjs
 *	@Date: 2026-01-29 22:04:09 -08:00 (1738219449)
 *	@Author: Nate Corcoran <CLDMV>
 *	@Email: <Shinrai@users.noreply.github.com>
 *	-----
 *	@Last modified by: Nate Corcoran <CLDMV> (Shinrai@users.noreply.github.com)
 *	@Last modified time: 2026-03-01 20:21:37 -08:00 (1772425297)
 *	-----
 *	@Copyright: Copyright (c) 2013-2026 Catalyzed Motivation Inc. All rights reserved.
 */

/**
 * @fileoverview Hook manager for intercepting API function calls
 * @module @cldmv/slothlet/handlers/hook-manager
 * @internal
 */

import { ComponentBase } from "@cldmv/slothlet/factories/component-base";
import { compilePattern } from "@cldmv/slothlet/helpers/pattern-matcher";
import { normalizeHookConfig } from "@cldmv/slothlet/helpers/config";

/**
 * Result returned by hook execution methods.
 * @typedef {Object} HookExecutionResult
 * @property {boolean} modified - Whether any hook modified the result value.
 * @property {*} [result] - The final (possibly hook-modified) return value.
 */

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

		// Read hook configuration from slothlet.config.hook. The HookManager is constructed
		// during _initializeComponents — BEFORE transformConfig runs — so slothlet.config.hook
		// is still the RAW user value (a boolean/string/object), not the normalized object.
		// Normalize it here from the same source of truth so the boolean and string `hook`
		// forms work, not just the object form (#125).
		const hookConfig = normalizeHookConfig(slothlet.config?.hook);

		this.enabled = hookConfig.enabled;
		this.defaultPattern = hookConfig.pattern || "**";
		this.suppressErrors = hookConfig.suppressErrors || false;

		// Global path filter: when active, a hook fires only if the called API path matches
		// at least one enabled pattern. `hook.pattern` (config) seeds it; a catch-all "**"
		// means "no restriction", so the filter stays inactive and every path runs hooks.
		this.enabledPatterns = new Set(); // Path patterns hook execution is restricted to
		this.patternFilterActive = false; // Whether the global path filter is in effect
		if (this.defaultPattern !== "**") {
			this.enabledPatterns.add(this.defaultPattern);
			this.patternFilterActive = true;
		}

		this.hooks = new Map(); // Map<name, {type, handler, priority, pattern, compiledPattern, subset}>
		this.registrationOrder = 0; // Counter for maintaining registration order
		this.reportedErrors = new WeakSet(); // Track errors that have been reported to prevent duplicate error hook calls
	}

	/**
	 * Compiled-matcher cache for the global path filter, keyed by pattern string.
	 * Avoids recompiling `enabledPatterns` on every {@link getHooksForPath} call.
	 * @type {Map<string, function>}
	 * @private
	 */
	#globalFilterCache = new Map();

	/**
	 * Test an API path against the active global path filter.
	 *
	 * @param {string} apiPath - The API path being called (e.g. "math.add").
	 * @returns {boolean} `true` if the path passes the filter (or no filter is active).
	 * @private
	 */
	#pathMatchesGlobalFilter(apiPath) {
		if (!this.patternFilterActive) {
			return true;
		}
		for (const pattern of this.enabledPatterns) {
			let matcher = this.#globalFilterCache.get(pattern);
			if (!matcher) {
				matcher = this.#compilePattern(pattern);
				this.#globalFilterCache.set(pattern, matcher);
			}
			if (matcher(apiPath)) {
				return true;
			}
		}
		return false;
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
	 * @param {boolean} [options.lockCaller=true] - Pin the registering module's caller
	 *   identity onto the handler so its `self.*` calls and permission checks are
	 *   attributed to the module that registered the hook, not the caller whose API
	 *   call triggered it. On by default; pass `false` to opt out — the handler then
	 *   runs un-pinned, with whatever async context is ambient when it fires (for a
	 *   `before` hook, typically none, so a `self.*` call inside it has no context).
	 *   No effect when the hook is registered outside a module (no caller identity to
	 *   capture) or when `handler` is already a `lockCaller`-wrapped function.
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
		let { type, pattern } = this.#parseTypePattern(typePattern);

		// Allow options.pattern to override parsed pattern
		if (options.pattern !== undefined) {
			pattern = options.pattern;
		}

		// Validate type
		if (!this.#validTypes.has(type)) {
			throw new this.slothlet.SlothletError("INVALID_HOOK_TYPE", {
				type,
				validTypes: Array.from(this.#validTypes)
			});
		}

		// Validate handler
		if (typeof handler !== "function") {
			throw new this.slothlet.SlothletError("INVALID_HOOK_HANDLER", {
				receivedType: typeof handler,
				validationError: true
			});
		}

		// Get or generate ID
		const id = options.id || this.#generateId();

		// Check for duplicate ID
		if (this.#byId.has(id)) {
			throw new this.slothlet.SlothletError("DUPLICATE_HOOK_ID", { id, validationError: true });
		}

		// Get subset (default: primary)
		const subset = options.subset || "primary";
		if (!this.#validSubsets.has(subset)) {
			throw new this.slothlet.SlothletError("INVALID_HOOK_SUBSET", {
				subset,
				validSubsets: Array.from(this.#validSubsets)
			});
		}

		// Validate pattern by compiling it (throws on errors like max nesting)
		this.#compilePattern(pattern);

		// Caller-identity pinning (opt-out, default on): attribute the handler's
		// self.*/permission checks to the module that registered the hook rather than
		// to whichever caller's API call triggered it. #pinHandler is a no-op when the
		// hook is registered outside a module or the handler is already locked.
		const lockCaller = options.lockCaller !== false;
		const effectiveHandler = lockCaller ? this.#pinHandler(handler) : handler;

		// Create hook object
		const hook = {
			id,
			type,
			pattern,
			handler: effectiveHandler,
			lockCaller,
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
	 * Pin the registering module's caller identity onto a hook handler.
	 *
	 * Mirrors `self.slothlet.lockCaller()`: captures the `currentWrapper` active at
	 * registration time and, on every invocation, runs the handler with that caller
	 * identity restored — so the handler's `self.*` calls and permission checks are
	 * attributed to the module that registered the hook, not to whichever caller
	 * triggered the intercepted API path.
	 *
	 * No-op passthrough when there is nothing to pin: the hook was registered outside
	 * a module (no `currentWrapper`), or `handler` is already a `lockCaller`-wrapped
	 * function (it carries `_slothletOriginal`) — in which case the existing lock is
	 * respected rather than double-wrapped. This also makes re-registration after a
	 * full reload (via {@link exportHooks}/{@link importHooks}) idempotent.
	 *
	 * @internal
	 * @private
	 * @param {function} handler - The hook handler to pin.
	 * @returns {function} The pinned handler, or `handler` unchanged when there is
	 *   nothing to pin.
	 */
	#pinHandler(handler) {
		// Already locked (manual lockCaller, or a re-registered hook) — respect it.
		if (typeof handler._slothletOriginal === "function") return handler;

		// `slothlet` is the long-lived instance object; a full reload() swaps both
		// `contextManager` and `instanceID` on it (and carries this pinned handler
		// into the new HookManager via exportHooks/importHooks). Capture the stable
		// object and resolve those two live on each call so the handler always
		// targets the current instance, never a torn-down one.
		const slothlet = this.slothlet;
		const capturedWrapper = slothlet.contextManager?.tryGetContext?.()?.currentWrapper ?? null;
		// Registered outside a module — no caller identity to capture.
		if (!capturedWrapper) return handler;

		const pinned = function slothlet_pinnedHook(...args) {
			// rawErrors: a hook handler must surface its own errors unchanged so the
			// error-hook pipeline sees the original type/code, not CONTEXT_EXECUTION_FAILED.
			return slothlet.contextManager.runInContext(slothlet.instanceID, handler, this, args, capturedWrapper, true);
		};
		// Parity with lockCaller / the EventEmitter patch metadata.
		pinned._slothletOriginal = handler;
		return pinned;
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
	 * Restrict hook execution to a path pattern at runtime (the global path filter).
	 *
	 * Distinct from {@link enable}/{@link disable}, which toggle the `enabled` flag of
	 * individual registered hooks by their registration pattern. This narrows *which API
	 * paths* the hook system applies to at all — the runtime counterpart of the `hook.pattern`
	 * config. Once any pattern is enabled the filter is active, and a hook fires only when the
	 * called path matches at least one enabled pattern. Adding `"**"` matches every path.
	 *
	 * @param {string} pattern - Glob path pattern to restrict execution to (e.g. "math.*").
	 * @returns {number} The number of patterns now in the active filter.
	 * @public
	 *
	 * @example
	 * api.slothlet.hook.enablePattern("database.*"); // only intercept database.* paths
	 */
	enablePattern(pattern) {
		// Validate by compiling (throws on malformed patterns, consistent with on()).
		this.#compilePattern(pattern);
		this.enabledPatterns.add(pattern);
		this.patternFilterActive = true;
		return this.enabledPatterns.size;
	}

	/**
	 * Remove a path pattern from the runtime global path filter.
	 *
	 * When the last enabled pattern is removed the filter deactivates, so hooks once again
	 * apply to every path (an unrestricted state, matching a `"**"` default).
	 *
	 * @param {string} pattern - The previously-enabled path pattern to remove.
	 * @returns {number} The number of patterns remaining in the filter.
	 * @public
	 *
	 * @example
	 * api.slothlet.hook.disablePattern("database.*"); // stop restricting to database.*
	 */
	disablePattern(pattern) {
		this.enabledPatterns.delete(pattern);
		this.#globalFilterCache.delete(pattern);
		if (this.enabledPatterns.size === 0) {
			this.patternFilterActive = false;
		}
		return this.enabledPatterns.size;
	}

	/**
	 * Reset the runtime global path filter back to the configured `hook.pattern` default.
	 *
	 * Clears any runtime {@link enablePattern}/{@link disablePattern} changes. If the configured
	 * default is the catch-all `"**"` the filter ends up inactive (unrestricted); otherwise it is
	 * re-seeded with the configured pattern.
	 *
	 * @returns {void}
	 * @public
	 */
	resetPatternFilter() {
		this.enabledPatterns.clear();
		this.#globalFilterCache.clear();
		this.patternFilterActive = false;
		if (this.defaultPattern !== "**") {
			this.enabledPatterns.add(this.defaultPattern);
			this.patternFilterActive = true;
		}
	}

	/**
	 * List registered hooks matching filter criteria.
	 *
	 * @param {object|string} [filter={}] - Filter criteria (empty = list all), type string, or pattern string
	 * @param {string} [filter.id] - List hook by ID
	 * @param {string} [filter.type] - List hooks by type
	 * @param {string} [filter.pattern] - List hooks matching pattern
	 * @param {boolean} [filter.enabled] - Filter by enabled state
	 * @returns {object} Object with registeredHooks array property
	 * @public
	 */
	list(filter = {}) {
		// Support string shorthand for type or pattern
		if (typeof filter === "string") {
			// Check if it's a valid type
			if (this.#validTypes.has(filter)) {
				filter = { type: filter };
			} else {
				// Treat as pattern
				filter = { pattern: filter };
			}
		}

		const hooks = [];

		// Filter by ID (fast path)
		if (filter.id) {
			const hook = this.#byId.get(filter.id);
			if (hook && (filter.enabled === undefined || hook.enabled === filter.enabled)) {
				hooks.push(this.#serializeHook(hook));
			}
			return { registeredHooks: hooks };
		}

		// Filter by type and/or pattern
		const types = filter.type ? [filter.type] : Array.from(this.#validTypes);

		// Compile pattern matcher if pattern filter provided
		let patternMatcher = null;
		if (filter.pattern) {
			patternMatcher = this.#compilePattern(filter.pattern);
		}

		for (const type of types) {
			const typeIndex = this.#hooks[type];

			for (const subset of ["before", "primary", "after"]) {
				const subsetIndex = typeIndex[subset];

				// Get all patterns in this subset
				for (const pattern in subsetIndex) {
					const patternHooks = subsetIndex[pattern];
					for (const hook of patternHooks) {
						// Check enabled filter
						if (filter.enabled !== undefined && hook.enabled !== filter.enabled) {
							continue;
						}

						// Check pattern filter using compiled matcher
						if (patternMatcher && !patternMatcher(hook.pattern)) {
							continue;
						}

						hooks.push(this.#serializeHook(hook));
					}
				}
			}
		}

		return { registeredHooks: hooks };
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
		// Fast path: globally disabled (check live enabled state)
		if (this.enabled === false) {
			return [];
		}

		// Global path filter: when active, only paths matching an enabled pattern run hooks.
		if (!this.#pathMatchesGlobalFilter(apiPath)) {
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
			const subsetHooks = [];

			// Check each pattern group in this subset
			for (const pattern in subsetIndex) {
				const patternHooks = subsetIndex[pattern];

				// Try exact match first (no compilation needed)
				if (pattern === apiPath) {
					subsetHooks.push(...patternHooks.filter((h) => h.enabled));
					continue;
				}

				// Check if pattern matches with cached compilation
				for (const hook of patternHooks) {
					if (!hook.enabled) continue;

					if (!hook._compiled) {
						hook._compiled = this.#compilePattern(hook.pattern);
					}

					if (hook._compiled(apiPath)) {
						subsetHooks.push(hook);
					}
				}
			}

			// Sort hooks within this subset by priority (highest first)
			subsetHooks.sort((a, b) => b.priority - a.priority);

			// Add sorted subset hooks to final list
			hooks.push(...subsetHooks);
		}

		return hooks;
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
					throw new this.SlothletError("HOOK_BEFORE_RETURNED_PROMISE", { id: hook.id, path }, null, { validationError: true });
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
					subset: hook.subset,
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
	 * @returns {HookExecutionResult} Object indicating if result was modified and the final result
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
					subset: hook.subset,
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
	 * @param {*} resultOrError - Function result or error
	 * @param {boolean} hasError - Whether an error occurred
	 * @param {Array<Error>} errors - Array of errors that occurred
	 * @param {object} api - Bound API object
	 * @param {object} ctx - User context object
	 * @public
	 */
	executeAlwaysHooks(path, args, resultOrError, hasError = false, errors = [], api, ctx) {
		const hooks = this.getHooksForPath("always", path);

		for (const hook of hooks) {
			try {
				hook.handler({
					path,
					args,
					result: hasError ? undefined : resultOrError,
					hasError,
					errors: errors,
					api,
					ctx
				});
			} catch (error) {
				// Execute error hooks for always hook failure
				const sourceInfo = {
					type: "always",
					subset: hook.subset,
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
	 * @param {Array} args - Function arguments
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
					errorType: error?.constructor?.name || "Error",
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
			throw new this.slothlet.SlothletError("INVALID_TYPE_PATTERN", {
				typePattern,
				expected: "string in format 'type:pattern'"
			});
		}

		const colonIndex = typePattern.indexOf(":");
		if (colonIndex === -1) {
			throw new this.slothlet.SlothletError("INVALID_TYPE_PATTERN", {
				typePattern,
				expected: "string in format 'type:pattern' with at least one colon"
			});
		}

		const type = typePattern.substring(0, colonIndex);
		const pattern = typePattern.substring(colonIndex + 1);

		if (!type || !pattern) {
			throw new this.slothlet.SlothletError("INVALID_TYPE_PATTERN", {
				typePattern,
				expected: "non-empty type and pattern"
			});
		}

		return { type, pattern };
	}

	/**
	 * Compile a glob pattern into a matcher function.
	 * Delegates to the shared pattern-matcher utility.
	 *
	 * @param {string} pattern - Glob pattern to compile
	 * @returns {function} Matcher function that takes a path and returns boolean
	 * @private
	 */
	#compilePattern(pattern) {
		return compilePattern(pattern, {
			onMaxDepth: (maxDepth) => {
				throw new this.SlothletError("HOOK_BRACE_EXPANSION_MAX_DEPTH", { maxDepth }, null, { validationError: true });
			}
		});
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

		// Invariant: patternHooks must always exist — on() writes to both #byId and
		// #hooks[type][subset][pattern] atomically. A missing key means #byId and
		// #hooks are desynced, which indicates a bug in this class.
		// unreachable via tests (2026-03-04): #private fields prevent external
		// mutation; on() creates the array before writing to #byId so no public
		// path can produce a missing patternHooks key.
		/* v8 ignore next */
		if (!patternHooks) {
			throw new this.slothlet.SlothletError("INTERNAL_HOOK_STATE_CORRUPT", {
				hookId: hook.id,
				type: hook.type,
				subset: hook.subset,
				pattern: hook.pattern,
				detail: "patternHooks array missing from subsetIndex — #byId and #hooks are desynced"
			});
		}

		const index = patternHooks.indexOf(hook);

		// Invariant: hook object must be in patternHooks — on() pushes the exact object
		// reference that it stores in #byId. If not found, internal state is corrupt.
		// unreachable via tests (2026-03-04): on() pushes the identical object
		// reference; no public path splices the array without clearing #byId,
		// so indexOf always finds the hook and index === -1 is never true.
		/* v8 ignore next */
		if (index === -1) {
			throw new this.slothlet.SlothletError("INTERNAL_HOOK_STATE_CORRUPT", {
				hookId: hook.id,
				type: hook.type,
				subset: hook.subset,
				pattern: hook.pattern,
				detail: "hook object not found in patternHooks array — #byId and #hooks are desynced"
			});
		}

		patternHooks.splice(index, 1);

		// Clean up empty pattern arrays
		if (patternHooks.length === 0) {
			delete subsetIndex[hook.pattern];
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
			enabled: hook.enabled,
			lockCaller: hook.lockCaller
			// Don't expose: handler, _compiled
		};
	}

	/**
	 * Export all registered hooks (including handler closures) so they can be
	 * re-registered on a fresh HookManager instance after a full reload.
	 *
	 * @returns {Array<object>} Snapshot of all current hook registrations.
	 * @public
	 */
	exportHooks() {
		const registrations = [];
		for (const hook of this.#byId.values()) {
			registrations.push({
				typePattern: `${hook.type}:${hook.pattern}`,
				handler: hook.handler,
				options: {
					id: hook.id,
					priority: hook.priority,
					subset: hook.subset,
					// Preserve an explicit opt-out across reload. The exported handler is
					// already in final form (pinned handlers carry _slothletOriginal, so
					// re-registration is idempotent), so this only keeps the hook object's
					// lockCaller flag accurate for introspection.
					lockCaller: hook.lockCaller
				},
				enabled: hook.enabled
			});
		}
		return registrations;
	}

	/**
	 * Re-register hooks exported by {@link exportHooks} into this (new) instance.
	 * Called after a full `api.slothlet.reload()` to restore user-registered hooks.
	 *
	 * @param {Array<object>} registrations - Snapshot returned by exportHooks().
	 * @returns {void}
	 * @public
	 */
	importHooks(registrations) {
		if (!Array.isArray(registrations)) return;
		for (const reg of registrations) {
			this.on(reg.typePattern, reg.handler, reg.options);
			if (!reg.enabled) {
				this.disable({ id: reg.options.id });
			}
		}
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
