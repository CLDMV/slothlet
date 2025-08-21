/**
 * Updates the live-binding references for self, context, and reference.
 * Call this whenever a new API instance is created.
 * Ensures submodules can import and use `self`, `context`, and `reference` directly.
 *
 * @param {object} newContext - The current context object to bind as `context`.
 * @param {object} newReference - The current reference object to bind as `reference`.
 * @param {object} newSelf - The current API object instance to bind as `self`.
 *
 * @example
 * // Update live bindings after creating a new API instance
 * updateBindings(api, { user: 'alice' }, { custom: 123 });
 * // Submodules can now use imported self, context, reference
 * self.math.add(1, 2);
 * context.user; // 'alice'
 * reference.custom; // 123
 */
export function updateBindings(newContext: object, newReference: object, newSelf?: object): void;
/**
 * Live-binding references for API object (self) and context.
 * These are updated whenever a new API instance is created.
 * Dynamically imported modules can access these at runtime.
 * @type {object}
 */
export let self: object;
/**
 * Live-binding reference for contextual data.
 * @type {object}
 */
export let context: object;
/**
 * Live-binding reference for ref data.
 * @type {object}
 */
export let reference: object;
export namespace slothlet {
    let api: any;
    let boundapi: any;
    let mode: string;
    let loaded: boolean;
    namespace config {
        export let lazy: boolean;
        export let lazyDepth: number;
        export { DEBUG as debug };
        export let dir: any;
    }
    let _dispose: any;
    let _boundAPIShutdown: any;
    function create(options?: {}): Promise<any>;
    /**
     * Returns the loaded API object (Proxy or plain).
     * @returns {object}
     */
    function getApi(): object;
    /**
     * Returns the loaded API object (Proxy or plain).
     * @returns {object}
     */
    function getBoundApi(): object;
    /**
     * Shuts down both the bound API and internal resources, with timeout and error handling.
     * Prevents infinite recursion if called from Proxy.
     * @returns {Promise<void>}
     */
    function shutdown(): Promise<void>;
    /**
     * Loads the bindleApi modules, either lazily or eagerly.
     *
     * @param {object} [config] - Loader configuration options.
     * @param {boolean} [config.lazy=true] - If true, enables lazy loading (API modules loaded on demand).
     * @param {number} [config.lazyDepth=Infinity] - How deep to lazy load (subdirectory depth; use Infinity for full lazy loading).
     * @param {string} [config.dir] - Directory to load API modules from. Defaults to the loader's directory (__dirname).
     * @returns {Promise<object>} The API object. If lazy loading is enabled, returns a Proxy that loads modules on access; otherwise, returns a fully loaded API object.
     *
     * @example
     * // Lazy load from default directory
     * await slothlet.load({ lazy: true });
     *
     * // Eager load from a custom directory
     * await slothlet.load({ lazy: false, dir: '/custom/path/to/api' });
     *
     * // Access API endpoints
     * const api = slothlet.createBoundApi(ctx);
     * const result = await api.fs.ensureDir('/some/path');
     */
    function load(config?: {
        lazy?: boolean;
        lazyDepth?: number;
        dir?: string;
    }, ctxRef?: {
        context: any;
        reference: any;
    }): Promise<object>;
    /**
     * Eagerly loads all API modules (same as original loader).
     * @param {string} dir - Directory to load
     * @returns {Promise<object>} API object
     * @private
     */
    function _eagerLoadApi(dir: string, rootLevel?: boolean): Promise<object>;
    /**
     * Converts a filename or folder name to camelCase for API property.
     * @param {string} name
     * @returns {string}
     * @example
     * toApiKey('root-math') // 'rootMath'
     */
    function _toApiKey(name: string): string;
    /**
     * Eagerly loads a category (same flattening logic as original).
     * @param {string} categoryPath
     * @returns {Promise<object>}
     * @private
     */
    function _eagerLoadCategory(categoryPath: string): Promise<object>;
    /**
     * Loads a single module file and returns its exports (flattened if needed).
     * @param {string} modulePath
     * @returns {Promise<object>}
     * @private
     */
    function _loadSingleModule(modulePath: string, rootLevel?: boolean): Promise<object>;
    /**
     * Creates a lazy API proxy for a directory.
     * @param {string} dir - Directory path.
     * @param {number} [depth=0] - Recursion depth.
     * @returns {Proxy} Proxy object for lazy API loading.
     * @private
     */
    function _createLazyApiProxy(dir: string, depth?: number, rootLevel?: boolean): ProxyConstructor;
    function _createLazyApiProxy2(dir: any, depth?: number, rootLevel?: boolean): Promise<any>;
    /**
     * Updates the live-binding references for self and context.
     * Call this whenever a new API instance is created.
     * @param {object} newContext - The current context object to bind as `context`.
     * @param {object} newReference - The current reference object to bind as `reference`.
     * @param {object} newSelf - The current API object instance to bind as `self`.
     */
    function updateBindings(newContext: object, newReference: object, newSelf?: object): void;
    /**
     * Creates a bound API object with live-bound self, context, and reference.
     * Ensures submodules can access `self`, `context`, and `reference` directly.
     * Works for both eager and lazy loading modes.
     *
     * @param {object} [ctx=null] - Context object to be spread into the API and live-bound.
     * @param {object|object[]} [ref=null] - Reference object(s) to extend the API/self with additional properties.
     * @returns {object} Bound API object (Proxy or plain) with live-bound self, context, and reference.
     *
     * @example
     * // Create API with context and reference
     * const api = slothlet.createBoundApi({ user: 'alice' }, { custom: 123 });
     *
     * // Access API endpoints
     * api.math.add(2, 3); // 5
     *
     * // Access live-bound self and context
     * api.self.math.add(1, 2); // 3
     * api.context.user; // 'alice'
     * api.reference.custom; // 123
     *
     * // Submodules can import { self, context, reference } from the loader
     * // and use them directly: self.math.add(...)
     */
    function createBoundApi(ctx?: object, ref?: object | object[]): object;
    /**
     * Recursively builds a bound API from an eagerly loaded API object.
     * @param {object} apiModules
     * @returns {object}
     * @private
     */
    function _buildCompleteApi(apiModules: object): object;
    /**
     * Wraps the lazy API proxy so that modules are loaded and built with context on access.
     * @param {Proxy} proxyApi
     * @returns {Proxy}
     * @private
     */
    function _createBoundLazyApi(proxyApi: ProxyConstructor): ProxyConstructor;
    /**
     * Checks if the API has been loaded.
     * @returns {boolean}
     */
    function isLoaded(): boolean;
}
export default slothlet;
/**
 * DEBUG mode: configurable via command line (--slothletdebug), environment variable (SLOTHLET_DEBUG), or defaults to false.
 */
declare let DEBUG: boolean;
