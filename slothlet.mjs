/**
 * slothlet - Lazy loading version of bindleApiLoader
 * Supports both lazy and eager loading via config.
 *
 * Usage:
 *   import { slothlet } from './loaderv2.mjs';
 *   await slothlet.load({ lazy: true });
 *   const api = slothlet.createBoundApi(context);
 *
 * Config:
 *   lazy: true  // enables lazy loading (default: true)
 *   lazyDepth: 2 // how deep to lazy load (default: Infinity)
 */
import fs from "fs/promises";
import path from "path";
import { fileURLToPath, pathToFileURL } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const slothlet = {
	api: null,
	loaded: false,
	config: { lazy: true, lazyDepth: Infinity },

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
	 * const api = slothlet.createBoundApi(context);
	 * const result = await api.fs.ensureDir('/some/path');
	 */
	async load(config = {}) {
		this.config = { ...this.config, ...config };
		const apiDir = this.config.dir || __dirname;
		if (this.loaded) return this.api;
		if (this.config.lazy) {
			this.api = await this._createLazyApiProxy(apiDir, 0);
		} else {
			this.api = await this._eagerLoadApi(apiDir);
		}
		this.loaded = true;
		return this.api;
	},

	/**
	 * Eagerly loads all API modules (same as original loader).
	 * @param {string} dir - Directory to load
	 * @returns {Promise<object>} API object
	 * @private
	 */
	async _eagerLoadApi(dir) {
		const entries = await fs.readdir(dir, { withFileTypes: true });
		const api = {};
		for (const entry of entries) {
			if (entry.isDirectory() && !entry.name.startsWith(".")) {
				const categoryPath = path.join(dir, entry.name);
				api[this._toApiKey(entry.name)] = await this._eagerLoadCategory(categoryPath);
			}
		}
		return api;
	},
	/**
	 * Converts a filename or folder name to camelCase for API property.
	 * @param {string} name
	 * @returns {string}
	 * @example
	 * toApiKey('root-math') // 'rootMath'
	 */
	_toApiKey(name) {
		return name.replace(/-([a-zA-Z0-9])/g, (_, c) => c.toUpperCase());
	},

	/**
	 * Eagerly loads a category (same flattening logic as original).
	 * @param {string} categoryPath
	 * @returns {Promise<object>}
	 * @private
	 */
	async _eagerLoadCategory(categoryPath) {
		const files = await fs.readdir(categoryPath);
		const mjsFiles = files.filter((f) => f.endsWith(".mjs") && !f.startsWith("."));
		if (mjsFiles.length === 1) {
			const categoryName = path.basename(categoryPath);
			const moduleName = path.basename(mjsFiles[0], ".mjs");
			if (moduleName === categoryName) {
				return await this._loadSingleModule(path.join(categoryPath, mjsFiles[0]));
			}
		}
		const categoryModules = {};
		for (const file of mjsFiles) {
			const moduleName = path.basename(file, ".mjs");
			categoryModules[this._toApiKey(moduleName)] = await this._loadSingleModule(path.join(categoryPath, file));
		}
		return categoryModules;
	},

	/**
	 * Loads a single module file and returns its exports (flattened if needed).
	 * @param {string} modulePath
	 * @returns {Promise<object>}
	 * @private
	 */
	async _loadSingleModule(modulePath) {
		const moduleUrl = pathToFileURL(modulePath).href;
		const module = await import(moduleUrl);
		const exports = {};
		for (const [exportName, exportValue] of Object.entries(module)) {
			if (exportName !== "default") exports[exportName] = exportValue;
			else if (exportValue && typeof exportValue === "object") Object.assign(exports, exportValue);
		}
		const exportNames = Object.keys(exports);
		if (exportNames.length === 1 && typeof exports[exportNames[0]] === "object" && exports[exportNames[0]] !== null) {
			return exports[exportNames[0]];
		}
		return exports;
	},

	/**
	 * Creates a lazy-loading Proxy for the API directory.
	 * @param {string} dir - Directory to proxy
	 * @param {number} depth - Current depth
	 * @returns {Proxy}
	 * @private
	 */
	async _createLazyApiProxy(dir, depth) {
		const self = this;
		const entries = await fs.readdir(dir, { withFileTypes: true });
		const cache = {};
		return new Proxy(
			{},
			{
				get(target, prop) {
					if (typeof prop !== "string" || prop.startsWith("_")) return undefined;
					const apiKey = this._toApiKey(prop);
					if (cache[apiKey]) return cache[apiKey];
					const entry = entries.find((e) => this._toApiKey(e.name) === apiKey);
					if (!entry) {
						throw new Error(`slothlet: API path or method '${prop}' does not exist in directory '${dir}'.`);
					}
					if (entry.isDirectory()) {
						if (depth + 1 < self.config.lazyDepth) {
							const subdirPath = path.join(dir, entry.name);
							const promiseProxy = self._createLazyApiProxy(subdirPath, depth + 1);
							cache[apiKey] = promiseProxy;
							return promiseProxy;
						} else {
							const subdirPath = path.join(dir, entry.name);
							const promise = self._eagerLoadCategory(subdirPath);
							cache[apiKey] = promise;
							return promise;
						}
					} else if (entry.isFile() && entry.name.endsWith(".mjs")) {
						const modulePath = path.join(dir, entry.name);
						const promise = self._loadSingleModule(modulePath);
						cache[apiKey] = promise;
						return promise;
					}
					throw new Error(`slothlet: API path or method '${prop}' does not exist in directory '${dir}'.`);
				},
				ownKeys() {
					return entries.map((e) => e.name);
				},
				getOwnPropertyDescriptor() {
					return { enumerable: true, configurable: true };
				}
			}
		);
	},

	/**
	 * Returns the loaded API object (Proxy or plain).
	 * @returns {object}
	 */
	getApi() {
		return this.api;
	},

	/**
	 * Creates a bound API object with context, using the same build logic as original.
	 * @param {object} context
	 * @returns {object}
	 */
	createBoundApi(context) {
		if (!this.loaded) throw new Error("BindleApi modules not loaded. Call load() first.");
		// For lazy, wrap the proxy in a handler that builds modules on access
		if (this.config.lazy) {
			return this._createBoundLazyApi(this.api, context);
		} else {
			return this._buildCompleteApi(this.api, context);
		}
	},

	/**
	 * Recursively builds a bound API from an eagerly loaded API object.
	 * @param {object} apiModules
	 * @param {object} context
	 * @returns {object}
	 * @private
	 */
	_buildCompleteApi(apiModules, context) {
		// Same as original loader's build logic
		const buildModule = (module) => {
			if (!module) return module;
			if (typeof module.default === "function") {
				const callableApi = (...args) => module.default(context, ...args);
				for (const [methodName, method] of Object.entries(module)) {
					if (methodName === "default") continue;
					if (typeof method === "function") {
						callableApi[methodName] = (...args) => method.call(module, ...args);
					} else if (typeof method === "object" && method !== null) {
						callableApi[methodName] = buildModule(method);
					} else {
						callableApi[methodName] = method;
					}
				}
				return callableApi;
			} else {
				const builtModule = {};
				for (const [methodName, method] of Object.entries(module)) {
					if (typeof method === "function") {
						builtModule[methodName] = (...args) => method.call(module, ...args);
					} else if (typeof method === "object" && method !== null) {
						builtModule[methodName] = buildModule(method);
					} else {
						builtModule[methodName] = method;
					}
				}
				return builtModule;
			}
		};
		const completeApi = {};
		for (const [moduleName, module] of Object.entries(apiModules)) {
			completeApi[moduleName] = buildModule(module);
		}
		return completeApi;
	},

	/**
	 * Wraps the lazy API proxy so that modules are loaded and built with context on access.
	 * @param {Proxy} proxyApi
	 * @param {object} context
	 * @returns {Proxy}
	 * @private
	 */
	_createBoundLazyApi(proxyApi, context) {
		const self = this;
		return new Proxy(proxyApi, {
			get(target, prop) {
				if (typeof prop !== "string" || prop.startsWith("_")) return undefined;
				const apiKey = this._toApiKey(prop);
				const value = target[apiKey];
				if (value instanceof Promise) {
					// Await and build module with context
					return (async () => {
						const loaded = await value;
						return self._buildCompleteApi({ [prop]: loaded }, context)[prop];
					})();
				} else if (value && typeof value === "object") {
					// Recursively wrap sub-proxy
					return self._createBoundLazyApi(value, context);
				}
				return value;
			},
			ownKeys() {
				return Reflect.ownKeys(target);
			},
			getOwnPropertyDescriptor() {
				return { enumerable: true, configurable: true };
			}
		});
	},

	/**
	 * Checks if the API has been loaded.
	 * @returns {boolean}
	 */
	isLoaded() {
		return this.loaded;
	}
};

export default slothlet;
