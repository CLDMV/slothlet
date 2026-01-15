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
    constructor(enabled?: boolean, defaultPattern?: string, options?: {
        suppressErrors?: boolean;
    });
    enabled: boolean;
    defaultPattern: string;
    enabledPatterns: Set<any>;
    patternFilterActive: boolean;
    suppressErrors: boolean;
    hooks: Map<any, any>;
    registrationOrder: number;
    reportedErrors: WeakSet<object>;
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
     * @param {string} [data.subset="primary"] - Hook subset: "before", "primary", or "after" (defines execution phase within hook type)
     * @returns {string} Hook ID for later removal
     *
     * @description
     * Register a hook with optional priority, pattern filtering, and subset control.
     * Subsets define execution order within a hook type: before → primary → after.
     * Within each subset, hooks execute by priority (higher first), then registration order.
     *
     * @example
     * // Register hook with priority
     * manager.on("before", handler, { priority: 200 });
     *
     * @example
     * // Register hook with custom ID and pattern
     * manager.on("before", handler, { id: "validator", pattern: "math.*", priority: 500 });
     *
     * @example
     * // Register hook in 'before' subset for early execution
     * manager.on("before", handler, { subset: "before", priority: 100 });
     */
    public on(type: string, handler: Function, data?: {
        id?: string;
        priority?: number;
        pattern?: string;
        subset?: string;
    }): string;
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
    public cleanup(): void;
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
    public off(nameOrPattern: string): boolean;
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
    public clear(type?: string): void;
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
    public list(type?: string): object;
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
    public enable(pattern?: string): void;
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
    public disable(pattern?: string): void;
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
    private executeBeforeHooks;
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
    private executeAfterHooks;
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
    private executeAlwaysHooks;
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
    private executeErrorHooks;
    /**
     * @function _getMatchingHooks
     * @internal
     * @private
     * @param {string} type - Hook type to match
     * @param {string} path - Function path to test against patterns
     * @returns {Array<object>} Sorted array of matching hooks
     *
     * @description
     * Get hooks matching type and path, sorted by subset (before → primary → after),
     * then priority (DESC), then order (ASC).
     *
     * @example
     * // Get matching hooks
     * const hooks = manager._getMatchingHooks("before", "database.users.create");
     */
    private _getMatchingHooks;
    /**
     * @function _getSubsetOrder
     * @internal
     * @private
     * @param {string} subset - Subset name ("before", "primary", or "after")
     * @returns {number} Sort order (0=before, 1=primary, 2=after)
     *
     * @description
     * Convert subset name to numeric sort order for consistent ordering.
     */
    private _getSubsetOrder;
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
    private _compilePattern;
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
    private _expandBraces;
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
    private _splitAlternatives;
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
    private _patternToRegex;
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
    private _matchPattern;
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
    private _isPathEnabled;
}
//# sourceMappingURL=hooks.d.mts.map