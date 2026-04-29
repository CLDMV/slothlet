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
    static slothletProperty: string;
    /**
     * Creates a new HookManager instance.
     * @param {object} slothlet - Parent slothlet instance
     */
    constructor(slothlet: object);
    enabled: any;
    defaultPattern: any;
    suppressErrors: any;
    enabledPatterns: Set<any>;
    patternFilterActive: boolean;
    hooks: Map<any, any>;
    registrationOrder: number;
    reportedErrors: WeakSet<object>;
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
    public on(typePattern: string, handler: Function, options?: {
        id?: string | undefined;
        priority?: number | undefined;
        subset?: string | undefined;
    }): string;
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
    public remove(filter?: {
        id?: string | undefined;
        type?: string | undefined;
        pattern?: string | undefined;
    }): number;
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
    public enable(filter?: object | string): number;
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
    public disable(filter?: object | string): number;
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
    public list(filter?: object | string): object;
    /**
     * Get hooks for a specific API path and type.
     * Used internally by UnifiedWrapper.
     *
     * @param {string} type - Hook type (before/after/always/error)
     * @param {string} apiPath - API path (e.g., "math.add")
     * @returns {Array<object>} Sorted array of matching hooks
     * @public
     */
    public getHooksForPath(type: string, apiPath: string): Array<object>;
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
    public executeBeforeHooks(path: string, args: any[], api: object, ctx: object): object;
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
    public executeAfterHooks(path: string, result: any, args: any[], api: object, ctx: object): HookExecutionResult;
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
    public executeAlwaysHooks(path: string, args: any[], resultOrError: any, hasError: boolean | undefined, errors: Array<Error> | undefined, api: object, ctx: object): void;
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
    public executeErrorHooks(path: string, error: Error, source: object, args: any[], api: object, ctx: object): void;
    /**
     * Get the pattern compilation function for diagnostic purposes.
     * Only exposed when diagnostics mode is enabled.
     *
     * @returns {function} The pattern compilation function
     * @internal
     */
    getCompilePatternForDiagnostics(): Function;
    /**
     * Export all registered hooks (including handler closures) so they can be
     * re-registered on a fresh HookManager instance after a full reload.
     *
     * @returns {Array<object>} Snapshot of all current hook registrations.
     * @public
     */
    public exportHooks(): Array<object>;
    /**
     * Re-register hooks exported by {@link exportHooks} into this (new) instance.
     * Called after a full `api.slothlet.reload()` to restore user-registered hooks.
     *
     * @param {Array<object>} registrations - Snapshot returned by exportHooks().
     * @returns {void}
     * @public
     */
    public importHooks(registrations: Array<object>): void;
    /**
     * Cleanup hook manager on shutdown.
     * @public
     */
    public shutdown(): Promise<void>;
    #private;
}
/**
 * Result returned by hook execution methods.
 */
export type HookExecutionResult = {
    /**
     * - Whether any hook modified the result value.
     */
    modified: boolean;
    /**
     * - The final (possibly hook-modified) return value.
     */
    result?: any;
};
import { ComponentBase } from "@cldmv/slothlet/factories/component-base";
//# sourceMappingURL=hook-manager.d.mts.map