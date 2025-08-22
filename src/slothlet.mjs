/**
 * @fileoverview Slothlet - Advanced module loader with lazy and eager loading capabilities
 * @module @cldmv/slothlet
 * @typicalname slothlet
 * @version 2.0.0
 * @author CLDMV/Shinrai
 *
 * Slothlet is a sophisticated module loading framework that provides both lazy and eager
 * loading strategies for JavaScript modules. It features copy-left materialization,
 * live-binding references, and comprehensive API management.
 *
 * Key Features:
 * - Lazy loading with look-ahead materialization
 * - Eager loading for immediate module availability
 * - Copy-left approach preserving materialized functions
 * - Live-binding references (self, context, reference)
 * - Configurable debug output
 * - Multiple execution modes (vm, worker, fork)
 * - Bound API management with automatic cleanup
 * - Callable function interface for simplified usage
 *
 * The main slothlet export is callable as a function for convenience, eliminating the need
 * to call slothlet.create() explicitly. Both slothlet(options) and slothlet.create(options)
 * work identically.
 *
 *
 * @example
 * // Default import (recommended)
 * import slothlet from '@cldmv/slothlet';
 *
 * // OR named import
 * import { slothlet } from '@cldmv/slothlet';
 *
 * // OR both (they're the same)
 * import slothlet, { slothlet as namedSlothlet } from '@cldmv/slothlet';
 *
 * // Usage
 * const api = await slothlet({
 *     dir: './api_test'
 * });
 *
 * @example
 * // Basic require
 * const slothlet = require('@cldmv/slothlet');
 *
 * // Usage
 * const api = await slothlet({
 *     dir: './api_test'
 * });
 *
 * @example
 * // Create with context and reference (direct call)
 * const api = await slothlet({
 *   dir: './api_test',
 *   context: { user: 'alice', env: 'prod' },
 *   reference: { version: '1.0.0' }
 * });
 *
 * // Access modules through bound API
 * await api.math.add(2, 3); // 5
 * api.context.user; // 'alice'
 * api.version; // '1.0.0'
 *
 * @example
 * // Shutdown when done
 * await api.shutdown();
 */
import fs from "fs/promises";
import path from "path";
import { fileURLToPath, pathToFileURL } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

/**
 * DEBUG mode: configurable via command line (--slothletdebug), environment variable (SLOTHLET_DEBUG), or defaults to false.
 * This becomes the default debug configuration for all slothlet instances unless overridden in options.
 * @private
 * @type {boolean}
 */
let DEBUG = process.argv.includes("--slothletdebug")
	? true
	: process.env.SLOTHLET_DEBUG === "1" || process.env.SLOTHLET_DEBUG === "true"
	? true
	: false;

/**
 * The shared _slothlet parameter for live binding coordination.
 * @type {string}
 * @private
 * @internal
 */
export let _slothlet = new URL(import.meta.url).searchParams.get("_slothlet") || "";

/**
 * Live-binding reference to the current API instance.
 * This is updated whenever a new API instance is created.
 * Dynamically imported modules can access this at runtime.
 * @type {object}
 * @private
 * @internal
 */
export const self = {};

/**
 * Live-binding reference for contextual data.
 * @type {object}
 * @private
 * @internal
 */
export const context = {};

/**
 * Live-binding reference for reference data.
 * @type {object}
 * @private
 * @internal
 */
export const reference = {};

/**
 * Creates a slothlet API instance with the specified configuration.
 * This is the main entry point that can be called directly as a function.
 * @async
 * @alias module:@cldmv/slothlet
 * @param {SlothletOptions} [options={}] - Configuration options for creating the API
 * @returns {Promise<object|function>} The bound API object or function
 * @public
 */
async function slothlet(options = {}) {
	return await slothlet.create(options);
}

// Add all the slothlet object properties and methods to the function
Object.assign(slothlet, {
	api: null,
	boundapi: {},
	context: {},
	reference: {},
	mode: "singleton",
	loaded: false,
	config: { lazy: false, apiDepth: Infinity, debug: DEBUG, dir: null },
	_dispose: null,
	_boundAPIShutdown: null,

	/**
	 * Creates and initializes a slothlet API instance.
	 * @async
	 * @memberof module:@cldmv/slothlet
	 * @param {SlothletOptions} [options={}] - Configuration options for creating the API
	 * @public
	 * @internal
	 * @returns {Promise<object>} The bound API object
	 */
	async create(options = {}) {
		if (this.loaded) {
			console.warn("[slothlet] create: API already loaded, returning existing instance.");
			return this.boundapi;
		}

		// Dynamically scan src/lib/modes for slothlet_*.mjs files and assign to this.modes
		if (!this.modes) {
			this.modes = {};
			const modesDir = path.join(__dirname, "lib", "modes");
			// console.log(modesDir);
			// process.exit(0);
			let modeFiles = await fs.readdir(modesDir);
			for (const file of modeFiles) {
				const modePath = path.join(modesDir, file);
				const modeName = file.replace(/^slothlet_/, "").replace(/\..+$/, "");
				if (!modeName || modeName.includes(" ")) continue;
				try {
					// Use dynamic import for ESM, ensure file:// URL for Windows compatibility
					const modeUrl = pathToFileURL(modePath).href;
					// console.log("modePath: ", modePath);
					// console.log("modeUrl: ", modeUrl);
					// process.exit(0);
					const imported = await import(modeUrl + "?_slothlet=" + _slothlet);
					if (imported && typeof imported === "object") {
						this.modes[modeName] = imported.default || imported;
					}
				} catch (err) {
					console.error(`[slothlet] Could not import mode '${modeName}':`, err);
				}
			}
		}

		// Default entry is THIS module, which re-exports `slothlet`
		// const { entry = import.meta.url, mode = "vm" } = options ?? {};
		const { entry = import.meta.url, mode = "singleton", api_mode = "auto" } = options ?? {};

		_slothlet = new URL(import.meta.url).searchParams.get("_slothlet") || "";
		// console.log("[slothlet.mjs] create _slothlet:", _slothlet);

		// self = this.boundapi;
		// context = this.context;
		// reference = this.reference;

		this.mode = mode;
		this.api_mode = api_mode;
		let api;
		let dispose;
		if (mode === "singleton") {
			const { context = null, reference = null, ...loadConfig } = options;
			this.context = context;
			this.reference = reference;

			/**
			 * Conditionally initialize boundapi as a function or object based on api_mode.
			 * If api_mode is 'function', boundapi is a function with a mutable implementation (_impl).
			 * If api_mode is 'auto', it will be determined after loading based on API structure.
			 * Otherwise, boundapi is a plain object.
			 * @example
			 * this.api_mode = 'function';
			 * // this.boundapi(...args) calls this.boundapi._impl(...args)
			 */
			if (this.api_mode === "function") {
				this.boundapi = function (...args) {
					if (typeof this.boundapi._impl === "function") {
						return this.boundapi._impl(...args);
					}
				}.bind(this);
				this.boundapi._impl = () => {};
			} else if (this.api_mode === "auto") {
				// Start with object, will be updated after loading if needed
				this.boundapi = {};
			} else {
				this.boundapi = {};
			}

			await this.load(loadConfig, { context, reference });

			// console.log("this.boundapi", this.boundapi);
			// process.exit(0);
			return this.boundapi;
		} else {
			const { createEngine } = await import("./lib/engine/slothlet_engine.mjs");
			({ api, dispose } = await createEngine({ entry, ...options }));
			// setShutdown(dispose); // stash the disposer so shutdown() can call it
			// Attach __dispose__ as a non-enumerable property to the API object
			if (typeof dispose === "function") {
				Object.defineProperty(api, "__dispose__", {
					value: dispose,
					writable: false,
					enumerable: false,
					configurable: false
				});
			}
			this._dispose = dispose;
			this.loaded = true;
			return api;
		}
	},

	/**
	 * Loads the bindleApi modules, either lazily or eagerly.
	 *
	 * @async
	 * @memberof module:@cldmv/slothlet
	 * @param {object} [config] - Loader configuration options.
	 * @param {boolean} [config.lazy=false] - If true, enables lazy loading (API modules loaded on demand).
	 * @param {number} [config.apiDepth=Infinity] - How deep to traverse subdirectories (use Infinity for unlimited traversal).
	 * @param {string} [config.dir] - Directory to load API modules from. Defaults to "api" relative to the current working directory.
	 * @param {object} [ctxRef] - Context and reference objects for binding.
	 * @returns {Promise<object>} The API object. If lazy loading is enabled, returns a Proxy that loads modules on access; otherwise, returns a fully loaded API object.
	 * @private
	 * @internal
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
	async load(config = {}, ctxRef = { context: null, reference: null }) {
		this.config = { ...this.config, ...config };
		// console.log("this.config", this.config);
		// process.exit(0);
		let apiDir = this.config.dir || "api";
		// If apiDir is relative, resolve it from process.cwd() (the caller's working directory)
		if (apiDir && !path.isAbsolute(apiDir)) {
			apiDir = path.resolve(process.cwd(), apiDir);
		}
		if (this.loaded) return this.api;
		if (this.config.lazy) {
			this.api = await this.modes.lazy.create.call(this, apiDir, true, this.config.apiDepth || Infinity, 0);
		} else {
			this.api = await this.modes.eager.create.call(this, apiDir, true, this.config.apiDepth || Infinity, 0);
		}
		if (this.config.debug) console.log(this.api);

		// Auto-detect api_mode based on whether API is a function (has root default export)
		if (this.api_mode === "auto") {
			this.api_mode = typeof this.api === "function" ? "function" : "object";
			if (this.config.debug) {
				console.log(`[DEBUG] Auto-detected api_mode: ${this.api_mode} (API is ${typeof this.api})`);
			}

			// Update boundapi structure if needed
			if (this.api_mode === "function" && typeof this.boundapi !== "function") {
				this.boundapi = function (...args) {
					if (typeof this.boundapi._impl === "function") {
						return this.boundapi._impl(...args);
					}
				}.bind(this);
				this.boundapi._impl = () => {};
			} else if (this.api_mode === "object" && typeof this.boundapi === "function") {
				this.boundapi = {};
			}
		}

		const l_ctxRef = { ...{ context: null, reference: null }, ...ctxRef };

		// this.updateBindings(l_ctxRef.context, l_ctxRef.reference, this.boundapi);
		// Object.assign(this.boundapi, this.createBoundApi(l_ctxRef.context, l_ctxRef.reference) || {});
		// this.boundapi = this.createBoundApi(l_ctxRef.context, l_ctxRef.reference);
		const _boundapi = this.createBoundApi(l_ctxRef.context, l_ctxRef.reference);

		mutateLiveBindingFunction(this.boundapi, _boundapi);

		this.updateBindings(this.context, this.reference, this.boundapi);
		// process.exit(0);
		this.loaded = true;
		return this.boundapi;
	},

	/**
	 * Converts a filename or folder name to camelCase for API property.
	 * @memberof module:@cldmv/slothlet
	 * @param {string} name - The name to convert
	 * @returns {string} The camelCase version of the name
	 * @private
	 * @internal
	 * @example
	 * _toApiKey('root-math') // 'rootMath'
	 */
	_toApiKey(name) {
		return name.replace(/-([a-zA-Z0-9])/g, (_, c) => c.toUpperCase());
	},

	/**
	 * Eagerly loads a category (same flattening logic as original).
	 * @async
	 * @memberof module:@cldmv/slothlet
	 * @param {string} categoryPath
	 * @param {number} [currentDepth=0] - Current traversal depth
	 * @param {number} [maxDepth=Infinity] - Maximum depth to traverse
	 * @returns {Promise<object>}
	 * @private
	 * @internal
	 */
	async _loadCategory(categoryPath, currentDepth = 0, maxDepth = Infinity) {
		const files = await fs.readdir(categoryPath, { withFileTypes: true });
		const mjsFiles = files.filter((f) => f.name.endsWith(".mjs") && !f.name.startsWith("."));
		const categoryName = path.basename(categoryPath);
		const subDirs = files.filter((e) => e.isDirectory() && !e.name.startsWith("."));

		// If only a single file matches the folder name and there are no subdirs, return its exports directly
		if (mjsFiles.length === 1 && subDirs.length === 0) {
			const moduleName = path.basename(mjsFiles[0].name, ".mjs");
			const mod = await this._loadSingleModule(path.join(categoryPath, mjsFiles[0].name));
			// Flatten if file matches folder name and exports a function (named)
			if (moduleName === categoryName && typeof mod === "function") {
				Object.defineProperty(mod, "name", { value: categoryName, configurable: true });
				return mod;
			}
			// Flatten if exports a default function, regardless of file name
			if (typeof mod === "function" && (!mod.name || mod.name === "default")) {
				Object.defineProperty(mod, "name", { value: categoryName, configurable: true });
				// Return as { [categoryName]: mod } if parent is util, else just mod
				// But for top-level util, flatten to size: [Function: size]
				return mod;
			}
			// If file matches folder and is a plain object, flatten
			if (moduleName === categoryName && mod && typeof mod === "object" && !mod.default) {
				return { ...mod };
			}
			// Otherwise, return as { [file]: mod }
			return { [moduleName]: mod };
		}

		// Otherwise, return an object with both files and subdirectories as properties
		const categoryModules = {};
		for (const file of mjsFiles) {
			const moduleName = path.basename(file.name, ".mjs");
			const mod = await this._loadSingleModule(path.join(categoryPath, file.name));
			// console.log("== categoryPath: ", categoryPath);
			// console.log("moduleName: ", moduleName);
			// console.log("this._toApiKey(moduleName): ", this._toApiKey(moduleName));
			// console.log("categoryName: ", categoryName);
			// console.log("typeof mod: ", typeof mod);
			if (moduleName === categoryName && mod && typeof mod === "object") {
				// If the export is { [categoryName]: { ... } }, flatten that property
				if (
					Object.prototype.hasOwnProperty.call(mod, categoryName) &&
					typeof mod[categoryName] === "object" &&
					mod[categoryName] !== null
				) {
					Object.assign(categoryModules, mod[categoryName]);
					// Also add other properties except the parentKey
					for (const [key, value] of Object.entries(mod)) {
						if (key !== categoryName) {
							categoryModules[key] = value;
						}
					}
				} else {
					Object.assign(categoryModules, mod);
				}
			} else if (typeof mod === "function") {
				// Use the function's name if available, otherwise use moduleName
				const fnName = mod.name && mod.name !== "default" ? mod.name : moduleName;
				Object.defineProperty(mod, "name", { value: fnName, configurable: true });
				categoryModules[fnName] = mod;
			} else {
				categoryModules[this._toApiKey(moduleName)] = mod;
			}
		}
		for (const subDirEntry of subDirs) {
			if (currentDepth < maxDepth) {
				categoryModules[this._toApiKey(subDirEntry.name)] = await this._loadCategory(
					path.join(categoryPath, subDirEntry.name),
					currentDepth + 1,
					maxDepth
				);
			}
		}

		// Upward flattening: Only if single property matches parent folder name and is a function/object
		const keys = Object.keys(categoryModules);
		if (keys.length === 1) {
			const singleKey = keys[0];
			const parentName = this._toApiKey(path.basename(categoryPath));
			if (singleKey === parentName) {
				let single = categoryModules[singleKey];
				if (typeof single === "function") {
					// Set function name to parentName if not already
					if (single.name !== parentName) {
						Object.defineProperty(single, "name", { value: parentName, configurable: true });
					}
					return single;
				} else if (typeof single === "object" && single !== null && !Array.isArray(single)) {
					return single;
				}
			}
		}
		return categoryModules;
	},

	/**
	 * Loads a single module file and returns its exports (flattened if needed).
	 * @async
	 * @memberof module:@cldmv/slothlet
	 * @param {string} modulePath
	 * @returns {Promise<object>}
	 * @private
	 * @internal
	 */
	async _loadSingleModule(modulePath, rootLevel = false) {
		const moduleUrl = pathToFileURL(modulePath).href;
		// const module = await import(moduleUrl);
		const module = await import(moduleUrl + "?_slothlet=" + _slothlet);
		// const module = await import(moduleUrl + "?testParam=maybe&_slothlet=" + _slothlet);
		if (this.config.debug) console.log("module: ", module);
		// If default export is a function, expose as callable and attach named exports as properties
		if (typeof module.default === "function") {
			let fn;
			if (rootLevel) {
				fn = module;
			} else {
				fn = module.default;
				for (const [exportName, exportValue] of Object.entries(module)) {
					if (exportName !== "default") {
						fn[exportName] = exportValue;
					}
				}
				if (this.config.debug) console.log("fn: ", fn);
			}
			return fn;
		}

		const moduleExports = Object.entries(module);
		// If there are no exports, throw a clear error
		if (!moduleExports.length) {
			throw new Error(
				`slothlet: No exports found in module '${modulePath}'. The file is empty or does not export any function/object/variable.`
			);
		}
		if (this.config.debug) console.log("moduleExports: ", moduleExports);

		// Handle both module.default and moduleExports[0][1] for callable and object default exports
		const defaultExportObj =
			typeof module.default === "object" && module.default !== null
				? module.default
				: typeof moduleExports[0][1] === "object" && typeof moduleExports[0][1].default === "function" && moduleExports[0][1] !== null
				? moduleExports[0][1]
				: null;
		let objectName = null;
		if (typeof module.default === "function" && module.default.name) {
			objectName = module.default.name;
		} else if (moduleExports[0] && moduleExports[0][0] !== "default") {
			objectName = moduleExports[0][0];
		}
		const defaultExportFn =
			typeof module.default === "function" ? module.default : typeof moduleExports[0][1] === "function" ? moduleExports[0][1] : null;

		if (this.config.debug) console.log("defaultExportObj: ", defaultExportObj);
		if (this.config.debug) console.log("objectName: ", objectName);

		if (defaultExportObj && typeof defaultExportObj.default === "function") {
			if (this.config.debug) console.log("DEFAULT FUNCTION FOUND FOR: ", module);
			/**
			 * Wraps an object with a callable default property as a function.
			 * @param {...any} args - Arguments to pass to the default function.
			 * @returns {any}
			 * @private
			 * @internal
			 * @example
			 * api(...args); // calls default
			 */
			const callableApi = {
				[objectName]: function (...args) {
					return defaultExportObj.default.apply(defaultExportObj, args);
				}
			}[objectName];
			for (const [methodName, method] of Object.entries(defaultExportObj)) {
				if (methodName === "default") continue;
				callableApi[methodName] = method;
			}
			// for (const [exportName, exportValue] of Object.entries(module)) {
			// 	if (exportName !== "default" && exportValue !== callableApi) {
			// 		callableApi[exportName] = exportValue;
			// 	}
			// }
			if (this.config.debug) console.log("callableApi", callableApi);
			return callableApi;
		} else if (defaultExportObj) {
			if (this.config.debug) console.log("DEFAULT FOUND FOR: ", module);
			/**
			 * Flattens object default exports and attaches named exports.
			 * @returns {object}
			 * @example
			 * api.method();
			 */
			const obj = { ...defaultExportObj };
			for (const [exportName, exportValue] of Object.entries(module)) {
				if (exportName !== "default" && exportValue !== obj) {
					obj[exportName] = exportValue;
				}
			}
			return obj;
		}
		// If only named exports and no default, expose the export directly
		const namedExports = Object.entries(module).filter(([k]) => k !== "default");
		if (this.config.debug) console.log("namedExports: ", namedExports);
		if (namedExports.length === 1 && !module.default) {
			if (typeof namedExports[0][1] === "object") {
				// Flatten single object export
				if (this.config.debug) console.log("namedExports[0][1] === object: ", namedExports[0][1]);
				return { ...namedExports[0][1] };
			}
			if (typeof namedExports[0][1] === "function") {
				if (this.config.debug) console.log("namedExports[0][1] === function: ", namedExports[0][1]);
				// Return single function export directly
				return namedExports[0][1];
			}
		}
		const apiExport = {};
		for (const [exportName, exportValue] of namedExports) {
			apiExport[exportName] = exportValue;
		}
		return apiExport;
	},

	/**
	 * Updates a specific property in the bound API with a materialized value.
	 * Called from lazy mode when a proxy is materialized.
	 * @memberof module:@cldmv/slothlet
	 * @param {string} key - The property key to update
	 * @param {any} materializedValue - The materialized value to set
	 * @private
	 * @internal
	 */
	updateBoundApiProperty(key, materializedValue) {
		if (this.boundapi && key) {
			try {
				// Update the bound API with the materialized value
				Object.defineProperty(this.boundapi, key, {
					value: materializedValue,
					writable: true,
					enumerable: true,
					configurable: true
				});

				// Also update the live bindings by updating the self reference
				if (self && typeof self === "object") {
					Object.defineProperty(self, key, {
						value: materializedValue,
						writable: true,
						enumerable: true,
						configurable: true
					});
				}

				// Force re-mutation of the live binding to pick up the change
				// This ensures the boundapi reflects the current state of this.api
				const currentApi = this.api;
				if (currentApi && currentApi[key] === materializedValue) {
					mutateLiveBindingFunction(this.boundapi, currentApi);
				}

				if (this.config.debug) {
					console.log(`[DEBUG] Updated boundapi.${key} with materialized value`);
					console.log(`[DEBUG] boundapi.${key} is now:`, typeof this.boundapi[key]);
					console.log(`[DEBUG] boundapi.${key} keys:`, Object.keys(this.boundapi[key] || {}));
				}
			} catch (error) {
				console.warn(`[slothlet] Failed to update boundapi.${key}:`, error.message);
			}
		}
	},

	/**
	 * Updates the live-binding references for self, context, and reference.
	 * Mutates the function and its properties, preserving reference.
	 *
	 * **IMPORTANT LIMITATIONS:**
	 * - `reference` does not add/remove functions from the API when called outside slothlet functions
	 * - Setting `self` manually is ill-advised and can break the API if not done correctly
	 * - These bindings are primarily for internal use during API initialization
	 *
	 * @memberof module:@cldmv/slothlet
	 * @param {object} newContext - The current context object to bind as `context`.
	 * @param {object} newReference - The current reference object to bind as `reference`. Note: Does not modify API structure when called externally.
	 * @param {object|function} newSelf - The current API object instance to bind as `self`. WARNING: Manual setting can break the API.
	 * @public
	 * @example
	 * // Safe usage - updating context only
	 * slothlet.updateBindings({ user: 'alice' }, null, null);
	 * context.user; // 'alice'
	 *
	 * @example
	 * // Potentially unsafe - manual self/reference modification
	 * // Use with caution outside of slothlet initialization
	 * slothlet.updateBindings(null, { custom: 123 }, customApiObject);
	 */
	updateBindings(newContext = null, newReference = null, newSelf = null) {
		if (newContext === null || (typeof newContext === "object" && Object.keys(newContext).length === 0)) newContext = { ...context };
		if (newReference === null || (typeof newReference === "object" && Object.keys(newReference).length === 0))
			newReference = { ...reference };
		if (newSelf === null || (typeof newSelf === "object" && Object.keys(newSelf).length === 0)) newSelf = this.boundapi;
		// Object.assign(context, newContext || {});
		// Object.assign(reference, newReference || {});
		// updateBindings(newContext, newReference, newSelf);
		mutateLiveBindingFunction(self, newSelf);
		Object.assign(context, newContext || {});
		Object.assign(reference, newReference || {});
	},

	/**
	 * Creates a bound API object with live-bound self, context, and reference.
	 * Ensures submodules can access `self`, `context`, and `reference` directly.
	 * Works for both eager and lazy loading modes.
	 *
	 * @memberof module:@cldmv/slothlet
	 * @param {object} [ctx=null] - Context object to be spread into the API and live-bound.
	 * @param {object|object[]} [ref=null] - Reference object(s) to extend the API/self with additional properties.
	 * @returns {object} Bound API object (Proxy or plain) with live-bound self, context, and reference.
	 * @private
	 * @internal
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
	createBoundApi(ctx = null, ref = null) {
		if (!this.api) throw new Error("BindleApi modules not loaded. Call load() first.");

		let boundApi;
		if (this.config.lazy) {
			// The new lazy mode creates a fully functional proxy API
			// No need to wrap it again, just use it directly
			boundApi = this.api;
		} else {
			// Use the eager mode's buildCompleteApi function
			if (this.modes && this.modes.eager && typeof this.modes.eager._buildCompleteApi === "function") {
				boundApi = this.modes.eager._buildCompleteApi(this.api);
			} else {
				boundApi = this.old_buildCompleteApi(this.api);
			}
		}

		/**
		 * Extends boundApi with properties from reference object (shallow, non-recursive).
		 * Any key in reference not present in boundApi will be added.
		 * @param {object} ref - Reference object to extend boundApi.
		 * @example
		 * // If boundApi has no 'custom', and ref = { custom: 123 }, boundApi.custom = 123
		 */
		if (ref && typeof ref === "object") {
			for (const [key, value] of Object.entries(ref)) {
				if (!(key in boundApi)) {
					try {
						boundApi[key] = value;
					} catch {}
				}
			}
		}

		// Allow ref to extend boundApi
		// if (ref && typeof ref === "object") {
		// 	for (const [key, value] of Object.entries(ref)) {
		// 		if (!(key in boundApi)) {
		// 			try {
		// 				boundApi[key] = value;
		// 			} catch {}
		// 		}
		// 	}
		// }

		// Live-bind self and context for submodules
		// this.updateBindings(ctx, ref, boundApi);

		// this.safeDefine(boundApi, "self", self);
		// this.safeDefine(boundApi, "context", context);
		// this.safeDefine(boundApi, "reference", reference);
		this.safeDefine(boundApi, "describe", function (showAll = false) {
			/**
			 * For lazy mode:
			 * - If showAll is false, return top-level keys only (do not resolve modules).
			 * - If showAll is true, recursively resolve all endpoints and return a fully built API object.
			 * For eager mode, return full API object.
			 */
			if (this.config && this.config.lazy) {
				if (!showAll) {
					return Reflect.ownKeys(boundApi);
				}
				// Recursively resolve all endpoints in lazy mode
				async function resolveAll(obj) {
					const keys = Reflect.ownKeys(obj);
					const entries = await Promise.all(
						keys.map(async (key) => {
							const value = obj[key];
							// If value is a proxy (lazy loader)
							if (typeof value === "function" && value.constructor.name === "Proxy") {
								let resolved;
								try {
									resolved = await value();
								} catch {
									resolved = value;
								}
								// If resolved is an object, recurse
								if (resolved && typeof resolved === "object" && !Array.isArray(resolved)) {
									return [key, await resolveAll(resolved)];
								}
								return [key, resolved];
							} else if (value && typeof value === "object" && !Array.isArray(value)) {
								// Recurse into plain objects
								return [key, await resolveAll(value)];
							} else {
								return [key, value];
							}
						})
					);
					const apiObj = {};
					for (const [key, val] of entries) {
						apiObj[key] = val;
					}
					return apiObj;
				}
				return resolveAll(boundApi);
			}
			// Eager mode: show full API
			return { ...boundApi };
		});

		// Only set _boundAPIShutdown if it's a user-defined function, not a bound version of slothlet.shutdown
		if (
			typeof boundApi.shutdown === "function" &&
			boundApi.shutdown !== this.shutdown &&
			boundApi.shutdown.name !== "bound get" &&
			boundApi.shutdown.name !== "bound shutdown" &&
			boundApi.shutdown.toString().indexOf("[native code]") === -1 &&
			boundApi.shutdown.toString() !== this.shutdown.bind(this).toString()
		) {
			this._boundAPIShutdown = boundApi.shutdown; // Save original
		} else {
			this._boundAPIShutdown = null;
		}
		const shutdownDesc = Object.getOwnPropertyDescriptor(boundApi, "shutdown");
		if (!shutdownDesc || shutdownDesc.configurable) {
			Object.defineProperty(boundApi, "shutdown", {
				value: this.shutdown.bind(this),
				writable: true,
				configurable: true,
				enumerable: true
			});
		} else if (this.config && this.config.debug) {
			console.warn("Could not redefine boundApi.shutdown: not configurable");
		}
		// console.debug("[slothlet] createBoundApi: boundApi.shutdown is now slothlet.shutdown.");

		// this.boundApi = boundApi;

		// Live-bind self and context for submodules
		// this.updateBindings(ctx, ref, this.boundApi);

		return boundApi;
	},

	/**
	 * Safely defines a property on an object, handling non-configurable properties.
	 * @memberof module:@cldmv/slothlet
	 * @param {object} obj - Target object
	 * @param {string} key - Property key
	 * @param {any} value - Property value
	 * @private
	 * @internal
	 * @example
	 * safeDefine(api, 'shutdown', shutdownFunction);
	 */
	safeDefine(obj, key, value) {
		const desc = Object.getOwnPropertyDescriptor(obj, key);
		if (!desc) {
			Object.defineProperty(obj, key, {
				value,
				writable: true,
				configurable: true,
				enumerable: true
			});
		} else if (desc.configurable) {
			Object.defineProperty(obj, key, {
				value,
				writable: true,
				configurable: true,
				enumerable: true
			});
		} else if (this.config && this.config.debug) {
			console.warn(`Could not redefine boundApi.${key}: not configurable`);
		}
	},

	/**
	 * Checks if the API has been loaded.
	 * @memberof module:@cldmv/slothlet
	 * @returns {boolean}
	 * @public
	 */
	isLoaded() {
		return this.loaded;
	},

	/**
	 * Returns the raw built API object (unbound, except in lazy mode where it's identical to boundapi).
	 * This is the original API structure before processing and binding operations.
	 * Most consumers should use getBoundApi() instead.
	 * @memberof module:@cldmv/slothlet
	 * @returns {object|function} The raw API object or function
	 * @public
	 */
	getApi() {
		return this.api;
	},

	/**
	 * Returns the processed and bound API object that consumers should use.
	 * This includes live-binding references, context/reference injection, and shutdown management.
	 * This is what most applications should interact with.
	 * @memberof module:@cldmv/slothlet
	 * @returns {object|function} The bound API object or function with live bindings and context
	 * @public
	 */
	getBoundApi() {
		return this.boundapi;
	},

	/**
	 * Gracefully shuts down the API and cleans up resources.
	 *
	 * This method performs a comprehensive cleanup of the slothlet instance, including:
	 * - Calling any user-defined shutdown functions in the loaded API
	 * - Disposing of internal engine resources (VM contexts, workers, child processes)
	 * - Clearing all bound references and live bindings
	 * - Resetting the instance to an unloaded state
	 *
	 * The shutdown process includes timeout protection (5 seconds) and prevents
	 * recursive shutdown calls to ensure safe cleanup even in error conditions.
	 *
	 * @async
	 * @memberof module:@cldmv/slothlet
	 * @returns {Promise<void>} Resolves when shutdown is complete
	 * @throws {Error} If recursive shutdown is detected or shutdown fails
	 * @public
	 *
	 * @example
	 * // Basic shutdown
	 * await api.shutdown();
	 *
	 * @example
	 * // Shutdown with error handling
	 * try {
	 *   await api.shutdown();
	 *   console.log('API shut down successfully');
	 * } catch (error) {
	 *   console.error('Shutdown failed:', error.message);
	 * }
	 */
	async shutdown() {
		if (this._shutdownInProgress) {
			console.log("this._boundAPIShutdown", this._boundAPIShutdown);
			throw new Error("slothlet.shutdown: Recursive shutdown detected");
		} else {
			this._shutdownInProgress = true;
			/**
			 * Shuts down both the bound API and internal resources, with timeout and error handling.
			 * @returns {Promise<void>}
			 */
			// console.debug("[slothlet] shutdown: Starting shutdown process...");
			// console.log(this);
			if (this.loaded) {
				const TIMEOUT_MS = 5000;
				let apiError, internalError;
				if (typeof this._boundAPIShutdown === "function") {
					// console.debug("[slothlet] shutdown: Starting bound API shutdown...");
					try {
						await Promise.race([
							this._boundAPIShutdown.call(this.boundapi),
							new Promise((_, reject) => setTimeout(() => reject(new Error("API shutdown timeout")), TIMEOUT_MS))
						]);
						// console.debug("[slothlet] shutdown: Bound API shutdown complete.");
					} catch (err) {
						apiError = err;
						// console.error("[slothlet] shutdown: Bound API shutdown error:", err);
					}
				}
				// Prefer boundApi.__dispose__ if available
				const disposeFn = this.boundapi && typeof this.boundapi.__dispose__ === "function" ? this.boundapi.__dispose__ : this._dispose;
				if (typeof disposeFn === "function") {
					// console.debug("[slothlet] shutdown: About to call dispose...");
					try {
						await disposeFn();
						// console.debug("[slothlet] shutdown: dispose() completed.");
					} catch (err) {
						internalError = err;
						// console.error("[slothlet] shutdown: Internal dispose error:", err);
					}
				}
				this.loaded = false;
				this.api = null;
				this.boundapi = {};
				this.context = {};
				this.reference = {};
				this._dispose = null;
				this._boundAPIShutdown = null;

				// this.updateBindings(null, null, null); // Clear live bindings
				if (apiError || internalError) {
					throw apiError || internalError;
				}
			}
		}
	}
});

/**
 * Mutates a live-binding variable (object or function) to match a new value, preserving reference.
 * @param {object|function} target - The variable to mutate (object or function).
 * @param {object|function} source - The new value to copy from (object or function).
 * @private
 * @internal
 * @example
 * mutateLiveBindingFunction(self, newSelf);
 * mutateLiveBindingFunction(boundapi, newApi);
 */
export function mutateLiveBindingFunction(target, source) {
	if (typeof source === "function") {
		target._impl = (...args) => source(...args);
		// Remove old methods except _impl
		for (const key of Object.keys(target)) {
			if (key !== "_impl") delete target[key];
		}
		// Attach new methods
		for (const key of Object.getOwnPropertyNames(source)) {
			if (key !== "length" && key !== "name" && key !== "prototype" && key !== "_impl") {
				try {
					target[key] = source[key];
				} catch {}
			}
		}
	} else if (typeof source === "object" && source !== null) {
		// Remove old methods except _impl
		for (const key of Object.keys(target)) {
			if (key !== "_impl") delete target[key];
		}
		// Attach new properties/methods
		for (const [key, value] of Object.entries(source)) {
			target[key] = value;
		}
		// Optionally, set _impl to a default method if present
		if (typeof source._impl === "function") {
			target._impl = source._impl;
		}
	}
}

export { slothlet };
export default slothlet;

// ============================================================================
// TYPE DEFINITIONS
// ============================================================================

/**
 * @typedef {object} SlothletOptions
 * @property {string} [dir=api] - Directory to load API modules from. Can be absolute or relative path.
 *   If relative, resolved from process.cwd(). Defaults to "api" directory in current working directory.
 * @property {boolean} [lazy=false] - Loading strategy:
 *   - `true`: Lazy loading - modules loaded on-demand when accessed (lower initial load, proxy overhead)
 *   - `false`: Eager loading - all modules loaded immediately (default, higher initial load, direct access)
 * @property {number} [apiDepth=Infinity] - Directory traversal depth control:
 *   - `Infinity`: Traverse all subdirectories recursively (default)
 *   - `0`: Only load files in root directory, no subdirectories
 *   - `1`, `2`, etc.: Limit traversal to specified depth levels
 * @property {boolean} [debug=false] - Debug output control:
 *   - `true`: Enable verbose logging for module loading, API construction, and binding operations
 *   - `false`: Silent operation (default)
 *   - Can be set via command line flag `--slothletdebug`, environment variable `SLOTHLET_DEBUG=true`, or options parameter
 *   - Command line and environment settings become the default for all instances unless overridden
 * @property {string} [mode=singleton] - Execution environment mode:
 *   - `"singleton"`: Single shared instance within current process (default, fastest)
 *   - `"vm"`: Isolated VM context for security/isolation
 *   - `"worker"`: Web Worker or Worker Thread execution
 *   - `"fork"`: Child process execution for complete isolation
 * @property {string} [api_mode=auto] - API structure and calling convention:
 *   - `"auto"`: Auto-detect based on root module exports (function vs object) - recommended (default)
 *   - `"function"`: Force API to be callable as function with properties attached
 *   - `"object"`: Force API to be plain object with method properties
 * @property {object} [context={}] - Context data object injected into live-binding `context` reference.
 *   Available to all loaded modules via `import { context } from 'slothlet'`. Useful for request data,
 *   user sessions, environment configs, etc.
 * @property {object} [reference={}] - Reference object merged into the API root level.
 *   Properties not conflicting with loaded modules are added directly to the API.
 *   Useful for utility functions, constants, or external service connections.
 * @property {string} [entry] - Entry module URL for advanced use cases.
 *   Defaults to slothlet's own module URL. Only modify if implementing custom loaders.
 *   **Warning**: This parameter is experimental and not officially supported. Use at your own risk.
 */
