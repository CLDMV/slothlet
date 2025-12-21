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
    suppressErrors: boolean;
    hooks: Map<any, any>;
    registrationOrder: number;
    reportedErrors: WeakSet<object>;
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
    public on(name: string, type: string, handler: Function, options?: {
        priority?: number;
        pattern?: string;
    }): void;
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
    public off(name: string): boolean;
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
    public clear(): void;
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
    public list(): Array<object>;
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
    public enable(pattern?: string): void;
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
    public disable(): void;
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
     * Get hooks matching type and path, sorted by priority (DESC) then order (ASC).
     *
     * @example
     * // Get matching hooks
     * const hooks = manager._getMatchingHooks("before", "database.users.create");
     */
    private _getMatchingHooks;
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
}
//# sourceMappingURL=hooks.d.mts.map