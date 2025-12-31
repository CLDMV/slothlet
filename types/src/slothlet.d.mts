/**
 * Live-binding reference to the current API instance.
 * This is updated whenever a new API instance is created.
 * Dynamically imported modules can access this at runtime.
 * @type {object}
 * @private
 * @internal
 */
export const self: object;
/**
 * Live-binding reference for contextual data.
 * @type {object}
 * @private
 * @internal
 */
export const context: object;
/**
 * Live-binding reference for reference data.
 * @type {object}
 * @private
 * @internal
 */
export const reference: object;
export default slothlet;
export type SlothletOptions = {
    /**
     * - Directory to load API modules from.
     * - Can be absolute or relative path.
     * - If relative, resolved from the calling file's location.
     * - Defaults to "api" directory relative to caller.
     */
    dir?: string;
    /**
     * - Loading strategy (legacy option):
     * - `true`: Lazy loading - modules loaded on-demand when accessed (lower initial load, proxy overhead)
     * - `false`: Eager loading - all modules loaded immediately (default, higher initial load, direct access)
     */
    lazy?: boolean;
    /**
     * - Loading mode (alternative to lazy option):
     * - `"lazy"`: Lazy loading - modules loaded on-demand when accessed (same as lazy: true)
     * - `"eager"`: Eager loading - all modules loaded immediately (same as lazy: false)
     * - `"singleton"`, `"vm"`, `"worker"`, `"fork"`: Execution engine mode (legacy, use engine option instead)
     * - Takes precedence over lazy option when both are provided
     */
    mode?: string;
    /**
     * - Execution environment mode:
     * - `"singleton"`: Single shared instance within current process (default, fastest)
     * - `"vm"`: Isolated VM context for security/isolation
     * - `"worker"`: Web Worker or Worker Thread execution
     * - `"fork"`: Child process execution for complete isolation
     */
    engine?: string;
    /**
     * - Runtime binding system:
     * - `"async"` or `"asynclocalstorage"`: Use AsyncLocalStorage for context isolation (default, recommended)
     * - `"live"` or `"livebindings"`: Use live binding system for dynamic context updates
     * - Controls how `self`, `context`, and `reference` bindings are managed across function calls
     */
    runtime?: string;
    /**
     * - Directory traversal depth control:
     * - `Infinity`: Traverse all subdirectories recursively (default)
     * - `0`: Only load files in root directory, no subdirectories
     * - `1`, `2`, etc.: Limit traversal to specified depth levels
     */
    apiDepth?: number;
    /**
     * - Debug output control:
     * - `true`: Enable verbose logging for module loading, API construction, and binding operations
     * - `false`: Silent operation (default)
     * - Can be set via command line flag `--slothletdebug`, environment variable `SLOTHLET_DEBUG=true`, or options parameter
     * - Command line and environment settings become the default for all instances unless overridden
     */
    debug?: boolean;
    /**
     * - API structure and calling convention:
     * - `"auto"`: Auto-detect based on root module exports (function vs object) - recommended (default)
     * - `"function"`: Force API to be callable as function with properties attached
     * - `"object"`: Force API to be plain object with method properties
     */
    api_mode?: string;
    /**
     * - Controls whether addApi can overwrite existing API endpoints:
     * - `true`: Allow overwrites (default, backwards compatible)
     * - `false`: Prevent overwrites, log warning and skip when attempting to overwrite existing endpoints
     * - Applies to both function and object overwrites at the final key of the API path
     */
    allowApiOverwrite?: boolean;
    /**
     * - Context data object injected into live-binding `context` reference.
     * - Available to all loaded modules via `import { context } from "@cldmv/slothlet/runtime"`. Useful for request data,
     * - user sessions, environment configs, etc.
     */
    context?: object;
    /**
     * - Reference object merged into the API root level.
     * - Properties not conflicting with loaded modules are added directly to the API.
     * - Useful for utility functions, constants, or external service connections.
     */
    reference?: object;
    /**
     * - Filename sanitization options for API property names.
     * - Controls how file names are converted to valid JavaScript identifiers.
     * - Default behavior: camelCase conversion with lowerFirst=true.
     */
    sanitize?: {
        lowerFirst?: boolean;
        preserveAllUpper?: boolean;
        preserveAllLower?: boolean;
        rules?: {
            leave?: string[];
            leaveInsensitive?: string[];
            upper?: string[];
            lower?: string[];
        };
    };
};
export type SlothletAPI = {
    /**
     * - Shuts down the API instance and cleans up all resources
     */
    shutdown: () => Promise<void>;
    /**
     * - Dynamically adds API modules from a folder to a specified API path
     */
    addApi: (apiPath: string, folderPath: string) => Promise<void>;
    /**
     * - Returns metadata about the current API instance configuration. In lazy mode with showAll=false, returns an array of property keys. In lazy mode with showAll=true, returns a Promise resolving to an object. In eager mode, returns a plain object.
     */
    describe: (showAll?: boolean) => ((string | symbol)[] | object | Promise<object>);
};
/**
 * Creates a slothlet API instance with the specified configuration.
 * This is the main entry point that can be called directly as a function.
 * @async
 * @alias module:@cldmv/slothlet
 * @param {SlothletOptions} [options={}] - Configuration options for creating the API
 * @returns {Promise<SlothletAPI>} The bound API object or function with management methods
 * @public
 */
export function slothlet(options?: SlothletOptions): Promise<SlothletAPI>;
//# sourceMappingURL=slothlet.d.mts.map