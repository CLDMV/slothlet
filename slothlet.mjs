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
/**
 * DEBUG mode: configurable via command line (--slothletdebug), environment variable (SLOTHLET_DEBUG), or defaults to false.
 */
let DEBUG = process.argv.includes("--slothletdebug")
	? true
	: process.env.SLOTHLET_DEBUG === "1" || process.env.SLOTHLET_DEBUG === "true"
	? true
	: false;

/**
 * Live-binding references for API object (self) and context.
 * These are updated whenever a new API instance is created.
 * Dynamically imported modules can access these at runtime.
 * @type {object}
 */
export let self = null;
/**
 * Live-binding reference for contextual data.
 * @type {object}
 */
export let context = null;
/**
 * Live-binding reference for ref data.
 * @type {object}
 */
export let reference = null;

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
export function updateBindings(newContext, newReference, newSelf = null) {
	self = newSelf;
	context = newContext;
	reference = newReference;
}

export const slothlet = {
	api: null,
	boundapi: null,
	mode: "singleton",
	loaded: false,
	config: { lazy: true, lazyDepth: Infinity, debug: DEBUG, dir: null },
	_dispose: null,
	_boundAPIShutdown: null,

	async create(options = {}) {
		if (this.loaded) {
			console.warn("[slothlet] create: API already loaded, returning existing instance.");
			return this.boundapi;
		}
		// Default entry is THIS module, which re-exports `slothlet`
		// const { entry = import.meta.url, mode = "vm" } = options ?? {};
		const { entry = import.meta.url, mode = "singleton" } = options ?? {};
		this.mode = mode;
		let api;
		let dispose;
		if (mode === "singleton") {
			const { context = null, reference = null, ...loadConfig } = options;
			await this.load(loadConfig, { context, reference });
			// console.log("this.boundapi", this.boundapi);
			// process.exit(0);
			return this.boundapi;
		} else {
			const { createEngine } = await import("./src/lib/slothlet_engine.mjs");
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
	 * Returns the loaded API object (Proxy or plain).
	 * @returns {object}
	 */
	getApi() {
		return this.api;
	},

	/**
	 * Returns the loaded API object (Proxy or plain).
	 * @returns {object}
	 */
	getBoundApi() {
		return this.boundapi;
	},

	/**
	 * Shuts down both the bound API and internal resources, with timeout and error handling.
	 * Prevents infinite recursion if called from Proxy.
	 * @returns {Promise<void>}
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
				this.boundapi = null;
				this._dispose = null;
				this._boundAPIShutdown = null;

				this.updateBindings(null, null, null); // Clear live bindings
				if (apiError || internalError) {
					throw apiError || internalError;
				}
			}
		}
	},

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
	async load(config = {}, ctxRef = { context: null, reference: null }) {
		this.config = { ...this.config, ...config };
		// console.log("this.config", this.config);
		// process.exit(0);
		let apiDir = this.config.dir || __dirname;
		// If apiDir is relative, resolve it from process.cwd() (the caller's working directory)
		if (apiDir && !path.isAbsolute(apiDir)) {
			apiDir = path.resolve(process.cwd(), apiDir);
		}
		if (this.loaded) return this.api;
		if (this.config.lazy) {
			this.api = await this._createLazyApiProxy(apiDir, 0);
		} else {
			this.api = await this._eagerLoadApi(apiDir);
		}
		if (this.config.debug) console.log(this.api);

		const l_ctxRef = { ...{ context: null, reference: null }, ...ctxRef };

		this.boundapi = this.createBoundApi(l_ctxRef.context, l_ctxRef.reference);
		// process.exit(0);
		this.loaded = true;
		return this.boundapi;
	},

	/**
	 * Eagerly loads all API modules (same as original loader).
	 * @param {string} dir - Directory to load
	 * @returns {Promise<object>} API object
	 * @private
	 */
	async _eagerLoadApi(dir, rootLevel = true) {
		const entries = await fs.readdir(dir, { withFileTypes: true });
		const api = {};
		const rootFunctions = [];
		const rootNamedExports = {};
		let rootFunctionKey = null;
		let rootDefaultFunction = null;

		if (rootLevel) {
			// Load root-level .mjs files
			for (const entry of entries) {
				if (entry.isFile() && entry.name.endsWith(".mjs") && !entry.name.startsWith(".")) {
					const fileName = path.basename(entry.name, ".mjs");
					const apiKey = this._toApiKey(fileName);
					const mod = await this._loadSingleModule(path.join(dir, entry.name), true);
					if (mod && typeof mod.default === "function") {
						if (!rootDefaultFunction) rootDefaultFunction = mod.default;
						for (const [key, value] of Object.entries(mod)) {
							if (key !== "default") api[key] = value;
						}
					} else {
						api[apiKey] = mod;
						for (const [key, value] of Object.entries(mod)) {
							rootNamedExports[key] = value;
						}
					}
				}
			}
		}

		// Load directories (categories)
		for (const entry of entries) {
			if (entry.isDirectory() && !entry.name.startsWith(".")) {
				const categoryPath = path.join(dir, entry.name);
				const subEntries = await fs.readdir(categoryPath, { withFileTypes: true });
				const hasSubDirs = subEntries.some((e) => e.isDirectory());
				if (hasSubDirs) {
					api[this._toApiKey(entry.name)] = await this._eagerLoadApi(categoryPath, false);
				} else {
					api[this._toApiKey(entry.name)] = await this._eagerLoadCategory(categoryPath);
				}
			}
		}

		// If a root-level default export function exists, make API callable
		if (rootDefaultFunction) {
			if (this.config.debug) console.log("rootDefaultFunction found");
			// process.exit(0);
			Object.assign(rootDefaultFunction, api);
			return rootDefaultFunction;
		} else {
			return api;
		}
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
		let flattened = false;
		const files = await fs.readdir(categoryPath);
		const mjsFiles = files.filter((f) => f.endsWith(".mjs") && !f.startsWith("."));
		if (mjsFiles.length === 1) {
			const categoryName = path.basename(categoryPath);
			const moduleName = path.basename(mjsFiles[0], ".mjs");
			if (moduleName === categoryName) {
				const mod = await this._loadSingleModule(path.join(categoryPath, mjsFiles[0]));
				// If the module is an object with only named exports, flatten them
				if (mod && typeof mod === "object" && !mod.default) {
					flattened = true;
					return { ...mod };
				}
				return mod;
			}
		}
		const categoryName = path.basename(categoryPath);
		const categoryModules = {};
		for (const file of mjsFiles) {
			const moduleName = path.basename(file, ".mjs");
			const mod = await this._loadSingleModule(path.join(categoryPath, file));
			if (moduleName === categoryName && mod && typeof mod === "object") {
				// Flatten all exports from the file matching the folder name
				Object.assign(categoryModules, mod);
				flattened = true;
			} else {
				categoryModules[this._toApiKey(moduleName)] = mod;
			}
		}
		return categoryModules;
	},

	/**
	 * Loads a single module file and returns its exports (flattened if needed).
	 * @param {string} modulePath
	 * @returns {Promise<object>}
	 * @private
	 */
	async _loadSingleModule(modulePath, rootLevel = false) {
		const moduleUrl = pathToFileURL(modulePath).href;
		const module = await import(moduleUrl);
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
			 * @example
			 * api(...args); // calls default
			 */
			// const callableApi = defaultExportObj.default;
			// callableApi.displayName = moduleExports[0][0];
			// const objectName = moduleExports[0][0]; // dynamically set as needed
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
	 * Creates a lazy API proxy for a directory.
	 * @param {string} dir - Directory path.
	 * @param {number} [depth=0] - Recursion depth.
	 * @returns {Proxy} Proxy object for lazy API loading.
	 * @private
	 */
	async _createLazyApiProxy(dir, depth = 0, rootLevel = true) {
		const self = this;
		const entries = await fs.readdir(dir, { withFileTypes: true });

		// ───────────────────────── helpers ─────────────────────────
		const SEP = "\x1f";
		const pathKeyOf = (arr) => arr.join(SEP);
		const cacheMap = new Map(); // full-path → proxy/value
		const rootExportCache = new Map(); // exportName → value (functions or values)
		const rootLoaders = []; // loaders for root files (for api() and root exports)

		// loader thunk that memoizes its import() and keeps resolved namespace
		function createLoader(loadModule) {
			const loader = async () => {
				if (!loader.__promise) {
					loader.__promise = loadModule().then((ns) => {
						loader.__ns = ns;
						return ns;
					});
				}
				return loader.__promise;
			};
			loader.__isLoader = true;
			loader.__ns = null;
			loader.__promise = null;
			return loader;
		}

		// build a callable proxy that represents a member (possibly nested) *inside* a module namespace
		function buildModuleMemberProxy(loader, insideKeys, fullPath) {
			// Heuristic to resolve a callable from a value (ESM/CJS friendly)
			function resolveCallable(value) {
				// direct function
				if (typeof value === "function") return value;

				// common wrapper shapes
				if (value && typeof value.default === "function") return value.default; // { default: fn }
				if (value && value.__esModule && typeof value.default === "function") return value.default;

				// sometimes bundlers double-wrap: { default: { default: fn } }
				if (value && value.default && typeof value.default.default === "function") return value.default.default;

				// last resort: some libraries hang callables on .handler/.fn
				if (value && typeof value.handler === "function") return value.handler;
				if (value && typeof value.fn === "function") return value.fn;

				return null;
			}

			// Resolve the target value from the module namespace using insideKeys
			function resolveFromNamespace(ns) {
				// module root call: prefer module-as-function, then default
				if (insideKeys.length === 0) {
					// CJS: module.exports = fn
					const cand0 = resolveCallable(ns);
					if (cand0) return cand0;

					// ESM: export default fn
					const cand1 = resolveCallable(ns && ns.default);
					if (cand1) return cand1;

					return null;
				}

				// Nested member call: walk ns[...] then resolve callable on that leaf
				let cur = ns;
				for (const k of insideKeys) {
					cur = cur?.[k];
					if (cur == null) break;
				}
				return resolveCallable(cur);
			}

			const targetFn = function (...args) {
				return (async () => {
					const ns = loader.__ns || (await loader());
					const fn = resolveFromNamespace(ns);

					const shownPath = insideKeys.length ? fullPath.concat(insideKeys).join(".") : `${fullPath.join(".")}.default`;

					if (typeof fn !== "function") {
						throw new Error(`slothlet: ${shownPath} is not a function.`);
					}
					return fn(...args);
				})();
			};

			return new Proxy(targetFn, {
				// Build deeper paths synchronously; import happens only when called
				get(_fn, prop, receiver) {
					if (typeof prop === "symbol" || Reflect.has(targetFn, prop)) {
						return Reflect.get(targetFn, prop, receiver);
					}
					if (typeof prop !== "string") return undefined;

					const seg = self._toApiKey(prop);
					const nextInside = insideKeys.concat(seg);
					const nextFull = fullPath.concat(seg);
					return buildModuleMemberProxy(loader, nextInside, nextFull);
				},

				// Always delegate calls through the unified resolver
				apply(_fn, _this, args) {
					return targetFn(...args);
				},

				// Keep inspector happy without forcing import
				ownKeys() {
					return ["default"];
				},
				getOwnPropertyDescriptor() {
					return { enumerable: true, configurable: true };
				}
			});
		}

		// callable, path-aware object proxy (for objects that hold loaders or nested objects)
		function makeObjProxy(currentObj, pathArr = []) {
			const targetFn = function (...args) {
				if (pathArr.length === 0) return rootApply(args); // api(...)
				throw new Error("slothlet: cannot call this path directly.");
			};

			return new Proxy(targetFn, {
				get(_, prop, receiver) {
					// pass-through function built-ins/symbols
					if (typeof prop === "symbol" || Reflect.has(targetFn, prop)) {
						return Reflect.get(targetFn, prop, receiver);
					}
					// guards
					if (typeof prop !== "string" || prop === "then" || prop === "default" || prop.startsWith("_") || /^[0-9]+$/.test(prop))
						return undefined;

					const seg = self._toApiKey(prop);
					const newPath = pathArr.concat(seg);
					const pkey = pathKeyOf(newPath);

					if (cacheMap.has(pkey)) return cacheMap.get(pkey);
					if (self.config.debug) console.log("path:", newPath.join("."));

					let next;

					// 1) real member on currentObj?
					if (currentObj && Object.prototype.hasOwnProperty.call(currentObj, seg)) {
						const value = currentObj[seg];

						if (value && value.__isLoader) {
							// lazy module at this node
							next = buildModuleMemberProxy(value, [], newPath);
						} else if (value && typeof value === "object") {
							// plain nested object (e.g., subfolder object)
							next = makeObjProxy(value, newPath);
						} else {
							// primitive or function already materialized (rare at build time)
							next = value;
						}
					}
					// 2) at root, treat unknown as potential root named export (lazy resolver)
					else if (pathArr.length === 0) {
						next = buildRootExportResolver(seg);
					}
					// 3) otherwise keep walking with a virtual node
					else {
						next = makeObjProxy({}, newPath);
					}

					cacheMap.set(pkey, next);
					return next;
				},

				apply(_fn, _thisArg, args) {
					if (pathArr.length === 0) return rootApply(args);
					throw new Error("slothlet: only the API root is callable.");
				},

				// invariants: union of function target keys + object keys
				ownKeys() {
					const s = new Set(Reflect.ownKeys(targetFn));
					for (const k of Reflect.ownKeys(currentObj || {})) s.add(k);
					return [...s];
				},
				getOwnPropertyDescriptor(_t, p) {
					const onTarget = Reflect.getOwnPropertyDescriptor(targetFn, p);
					if (onTarget) return onTarget;
					if (currentObj) {
						const onObj = Object.getOwnPropertyDescriptor(currentObj, p);
						if (onObj) return onObj;
					}
					return { enumerable: true, configurable: true };
				}
			});
		}

		// lazy resolver for root-level named exports: api.someExport()
		function buildRootExportResolver(exportKey) {
			const targetFn = function (...args) {
				return (async () => {
					// cached?
					if (rootExportCache.has(exportKey)) {
						const v = rootExportCache.get(exportKey);
						if (typeof v !== "function") throw new Error(`slothlet: ${exportKey} is not a function.`);
						return v(...args);
					}
					// scan each root module lazily until found
					for (const loader of rootLoaders) {
						const ns = loader.__ns || (await loader());
						if (Object.prototype.hasOwnProperty.call(ns, exportKey)) {
							const v = ns[exportKey];
							rootExportCache.set(exportKey, v);
							if (typeof v !== "function") throw new Error(`slothlet: ${exportKey} is not a function.`);
							return v(...args);
						}
					}
					throw new Error(`slothlet: root export '${exportKey}' not found.`);
				})();
			};

			return new Proxy(targetFn, {
				get(_fn, prop, receiver) {
					if (typeof prop === "symbol" || Reflect.has(targetFn, prop)) {
						return Reflect.get(targetFn, prop, receiver);
					}
					return undefined; // don’t allow chaining off a root export name
				},
				apply(_fn, _this, args) {
					return targetFn(...args);
				},
				ownKeys() {
					return [];
				},
				getOwnPropertyDescriptor() {
					return { enumerable: true, configurable: true };
				}
			});
		}

		// root apply: find first root module with callable default (lazy, memoized)
		let cachedRootDefault = null;
		async function rootApply(args) {
			if (cachedRootDefault) return cachedRootDefault(...args);
			for (const loader of rootLoaders) {
				const ns = loader.__ns || (await loader());
				if (typeof ns?.default === "function") {
					cachedRootDefault = ns.default;
					return cachedRootDefault(...args);
				}
			}
			throw new Error("slothlet: no root default function is available.");
		}

		// ───────────────────── build the LAZY api tree ─────────────────────
		const api = {};

		// Root files → expose as lazy modules under api[fileKey]
		for (const entry of entries) {
			if (entry.isFile() && !entry.name.startsWith(".") && (entry.name.endsWith(".mjs") || entry.name.endsWith(".js"))) {
				const filePath = path.join(dir, entry.name);
				const fileKey = self._toApiKey(path.basename(entry.name, path.extname(entry.name)));
				const loader = createLoader(() => self._loadSingleModule(filePath, true));

				rootLoaders.push(loader);
				api[fileKey] = loader; // store loader (not proxy) – object proxy will wrap it on access
			}
		}

		// Directories → flatten or build nested objects of loaders
		for (const entry of entries) {
			if (!entry.isDirectory() || entry.name.startsWith(".")) continue;

			let flattened = false;

			const categoryPath = path.join(dir, entry.name);
			const subEntries = await fs.readdir(categoryPath, { withFileTypes: true });
			const mjsFiles = subEntries.filter((e) => e.isFile() && e.name.endsWith(".mjs") && !e.name.startsWith("."));
			const subDirs = subEntries.filter((e) => e.isDirectory() && !e.name.startsWith("."));
			const catKey = self._toApiKey(entry.name);
			const categoryName = path.basename(categoryPath);

			// Flatten: ./nested/date/date.mjs -> api.nested.date.*
			if (mjsFiles.length === 1 && path.basename(mjsFiles[0].name, ".mjs") === categoryName && subDirs.length === 0) {
				const modPath = path.join(categoryPath, mjsFiles[0].name);
				const loader = createLoader(() => self._loadSingleModule(modPath));
				api[catKey] = loader; // object proxy will wrap this loader lazily
				continue;
			}

			// Nested: build an object of loaders and nested proxies
			const categoryObj = {};
			for (const fileEntry of mjsFiles) {
				const moduleName = path.basename(fileEntry.name, ".mjs");
				const modKey = self._toApiKey(moduleName);
				const loader = createLoader(() => self._loadSingleModule(path.join(categoryPath, fileEntry.name)));
				if (moduleName === categoryName) {
					// Flatten all exports from the file matching the folder name
					loader().then((mod) => {
						if (mod && typeof mod === "object") {
							Object.assign(categoryObj, mod);
						}
					});
					flattened = true;
				} else {
					categoryObj[modKey] = loader;
				}
			}
			for (const subDirEntry of subDirs) {
				categoryObj[self._toApiKey(subDirEntry.name)] = await self._createLazyApiProxy(
					path.join(categoryPath, subDirEntry.name),
					depth + 1,
					false
				);
			}
			api[catKey] = categoryObj;
		}

		// Return the callable, path-aware proxy rooted at `api`
		return makeObjProxy(api, []);
	},

	async _createLazyApiProxy2(dir, depth = 0, rootLevel = true) {
		const self = this;
		const entries = await fs.readdir(dir, { withFileTypes: true });
		let cache = {};
		const dirName = path.basename(dir);
		const mjsFiles = entries.filter((e) => e.isFile() && (e.name.endsWith(".mjs") || e.name.endsWith(".js")) && !e.name.startsWith("."));
		const api = {};
		let rootDefaultFunction = null;

		// if (rootLevel) {
		// Load root-level .mjs files
		for (const entry of mjsFiles) {
			const fileName = path.basename(entry.name, path.extname(entry.name));
			const apiKey = self._toApiKey(fileName);
			const modPromise = await self._loadSingleModule(path.join(dir, entry.name), true);
			cache[apiKey] = modPromise;
			if (this.config.debug) console.log(`modPromise (${entry.name})(${apiKey}): `, modPromise);
			/*
			modPromise.then((mod) => {
				if (this.config.debug) console.log(`mod (${entry.name})(${apiKey}): `, mod);
				if (mod && typeof mod.default === "function" && rootLevel) {
					if (!rootDefaultFunction) rootDefaultFunction = mod.default;
					for (const [key, value] of Object.entries(mod)) {
						if (key !== "default") api[key] = value;
					}
				} else {
					api[apiKey] = mod;
					// if (typeof mod === "function") {
					// for (const [key, value] of Object.entries(mod)) {
					// 	if (key !== "default") api[key] = value;
					// }
					// } else {
					for (const [key, value] of Object.entries(mod)) {
						api[key] = value;
					}
					// }
				}
				// cache = api;
				if (this.config.debug) console.log(`api[apiKey] (${entry.name})(${apiKey}): `, api[apiKey]);
			}); */
		}
		// }

		// Load directories (categories)
		for (const entry of entries) {
			if (entry.isDirectory() && !entry.name.startsWith(".")) {
				const categoryPath = path.join(dir, entry.name);
				const subEntries = await fs.readdir(categoryPath, { withFileTypes: true });
				const mjsFiles = subEntries.filter((e) => e.isFile() && e.name.endsWith(".mjs") && !e.name.startsWith("."));
				const subDirs = subEntries.filter((e) => e.isDirectory() && !e.name.startsWith("."));
				const categoryName = path.basename(categoryPath);
				// Only flatten if single file matches category name and no subdirs
				if (mjsFiles.length === 1 && path.basename(mjsFiles[0].name, ".mjs") === categoryName && subDirs.length === 0) {
					const mod = await self._loadSingleModule(path.join(categoryPath, mjsFiles[0].name));
					api[self._toApiKey(entry.name)] = mod;
					// api[self._toApiKey(entry.name)] = await mod;
					if (this.config.debug) console.log(`mod mjsFiles (${entry.name} :: ${mjsFiles[0].name}): `, mod);
				} else {
					// Multi-file or nested: assign each file and subdir as a property
					const categoryObj = {};
					for (const fileEntry of mjsFiles) {
						const moduleName = path.basename(fileEntry.name, ".mjs");
						if (this.config.debug) console.log(`mod categoryObj ${moduleName} === ${categoryName} (${entry.name} :: ${fileEntry.name}): `);
						if (moduleName === categoryName) {
							// Merge exports directly into parent object
							const mod = await self._loadSingleModule(path.join(categoryPath, fileEntry.name));
							if (this.config.debug) console.log(`mod categoryObj (${entry.name} :: ${fileEntry.name}): `, mod);
							if (mod && typeof mod === "object") {
								Object.assign(categoryObj, mod);
							} else {
								categoryObj[moduleName] = mod;
							}
						} else {
							categoryObj[self._toApiKey(moduleName)] = await self._loadSingleModule(path.join(categoryPath, fileEntry.name));
						}
					}
					for (const subDirEntry of subDirs) {
						const mod = await self._createLazyApiProxy(path.join(categoryPath, subDirEntry.name), depth + 1, false);
						categoryObj[self._toApiKey(subDirEntry.name)] = mod;
						if (this.config.debug) console.log(`subDirEntry (${entry.name} :: ${subDirEntry.name}): `, mod);
					}
					if (this.config.debug) console.log(`categoryObj (${entry.name}): `, categoryObj);
					api[self._toApiKey(entry.name)] = categoryObj;
				}
			}
		}
		/* 
		// Await all module promises and build API object
		const apiKeys = Object.keys(cache);
		const resolvedModules = await Promise.all(apiKeys.map((k) => cache[k]));
		for (let i = 0; i < apiKeys.length; i++) {
			const key = apiKeys[i];
			const mod = resolvedModules[i];
			if (typeof mod === "function" && rootLevel) {
				// Module itself is a function, assign directly
				// api[key] = mod;
				if (!rootDefaultFunction) rootDefaultFunction = mod;
			} else if (mod && typeof mod.default === "function" && rootLevel) {
				// Module is an object with a callable default property, assign the whole object
				// api[key] = mod;
				if (!rootDefaultFunction) rootDefaultFunction = mod;
			} else if (mod && typeof mod === "object" && mod !== null) {
				// } else if (mod && typeof mod === "object" && mod !== null && typeof mod !== "function") {
				api[key] = { ...mod };
			} else {
				api[key] = mod;
			}
		}
 */
		// If a root-level default export function exists, make API callable
		if (rootDefaultFunction) {
			// Use the original function reference for callability and attach named exports
			let fn = rootDefaultFunction;
			for (const [key, value] of Object.entries(api)) {
				// Prevent circular reference and skip 'default' property
				if (key === "default" || value === fn) continue;
				try {
					fn[key] = value;
				} catch (err) {
					// Ignore assignment errors for read-only properties
				}
			}
			return fn;
		} else {
			const SEP = "\x1f";
			const PATH = Symbol("path");

			// Turn ['foo','bar'] into 'foo␟bar'
			const pathKeyOf = (path) => path.join(SEP);

			// Use a Map so keys aren't accidentally coerced
			const cache = new Map();

			function wrap(value, path) {
				if (value == null) return makeProxy({}, path);

				if (typeof value === "function") {
					return new Proxy(value, {
						get(fn, p, r) {
							if (p === PATH) return path.slice();
							return Reflect.get(fn, p, r);
						},
						apply(fn, thisArg, args) {
							console.log("call:", path.join("."), "args:", args);
							return Reflect.apply(fn, thisArg, args);
						}
					});
				}

				if (typeof value === "object") return makeProxy(value, path);

				// primitives end the chain
				return value;
			}

			function makeProxy(api, path = []) {
				return new Proxy(api, {
					get(target, prop, receiver) {
						if (
							typeof prop !== "string" ||
							prop === "then" ||
							prop === "default" ||
							prop.startsWith("_") ||
							typeof prop === "symbol" ||
							/^[0-9]+$/.test(prop)
						)
							return undefined;

						const seg = self._toApiKey(prop); // sanitized segment
						const newPath = path.concat(seg);
						const key = pathKeyOf(newPath);

						// full-path cache lookup
						if (cache.has(key)) return cache.get(key);

						console.log("path:", newPath.join(".")); // full chain log

						// prefer real member; otherwise keep walking
						const real = Reflect.get(target, seg, receiver);
						const next = real !== undefined ? wrap(real, newPath) : makeProxy({}, newPath);

						// cache the wrapped/proxied value for this *full path*
						cache.set(key, next);
						return next;
					},

					ownKeys(t) {
						return Reflect.ownKeys(t);
					},
					getOwnPropertyDescriptor(t, p) {
						return Object.getOwnPropertyDescriptor(t, p) || { enumerable: true, configurable: true };
					}
				});
			}
			return makeProxy(api);
		}
	},

	/**
	 * Updates the live-binding references for self and context.
	 * Call this whenever a new API instance is created.
	 * @param {object} newContext - The current context object to bind as `context`.
	 * @param {object} newReference - The current reference object to bind as `reference`.
	 * @param {object} newSelf - The current API object instance to bind as `self`.
	 */
	updateBindings(newContext, newReference, newSelf = null) {
		if (newSelf === null) newSelf = this.boundapi;
		updateBindings(newContext, newReference, newSelf);
	},

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
	createBoundApi(ctx = null, ref = null) {
		if (!this.api) throw new Error("BindleApi modules not loaded. Call load() first.");
		let boundApi;
		if (this.config.lazy) {
			boundApi = this._createBoundLazyApi(this.api);
		} else {
			boundApi = this._buildCompleteApi(this.api);
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

		const safeDefine = (obj, key, value) => {
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
		};

		// Live-bind self and context for submodules
		// this.updateBindings(ctx, ref, boundApi);

		safeDefine(boundApi, "self", self);
		safeDefine(boundApi, "context", context);
		safeDefine(boundApi, "reference", reference);
		safeDefine(boundApi, "describe", function () {
			// For lazy mode, only show top-level keys, do not resolve modules
			if (this.config && this.config.lazy) {
				return Reflect.ownKeys(boundApi);
			}
			// For eager mode, show full API
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

		// Live-bind self and context for submodules
		this.updateBindings(ctx, ref, boundApi);

		return boundApi;
	},

	/**
	 * Recursively builds a bound API from an eagerly loaded API object.
	 * @param {object} apiModules
	 * @returns {object}
	 * @private
	 */
	_buildCompleteApi(apiModules) {
		// Improved build logic: preserve functions, handle callable objects, recurse only into objects
		const buildModule = (module) => {
			if (!module) return module;
			if (typeof module === "function") {
				// Return function as-is (preserve callability)
				return module;
			}
			if (typeof module === "object" && module !== null) {
				if (typeof module.default === "function") {
					// Make object callable via default, attach named methods as direct function references
					const callableApi = function (...args) {
						return module.default.apply(module, args);
					};
					for (const [methodName, method] of Object.entries(module)) {
						if (methodName === "default") continue;
						callableApi[methodName] = typeof method === "function" ? method : buildModule(method);
					}
					return callableApi;
				}
				// For plain objects, assign function references directly, recurse only into objects
				const builtModule = {};
				for (const [methodName, method] of Object.entries(module)) {
					builtModule[methodName] = typeof method === "function" ? method : buildModule(method);
				}
				return builtModule;
			}
			return module;
		};
		let completeApi = {};
		if (typeof apiModules === "function") {
			completeApi = apiModules;
		}
		for (const [moduleName, module] of Object.entries(apiModules)) {
			completeApi[moduleName] = buildModule(module);
		}
		return completeApi;
	},

	/**
	 * Wraps the lazy API proxy so that modules are loaded and built with context on access.
	 * @param {Proxy} proxyApi
	 * @returns {Proxy}
	 * @private
	 */
	_createBoundLazyApi(proxyApi) {
		const slothletSelf = this;
		function wrap(value, prop) {
			if (value instanceof Promise) {
				return new Proxy(function () {}, {
					apply: async (target, thisArg, args) => {
						const loaded = await value;
						const built = slothletSelf._buildCompleteApi({ [prop]: loaded })[prop];
						if (typeof built === "function") {
							return built.apply(thisArg, args);
						} else if (built && typeof built.default === "function") {
							return built.default.apply(built, args);
						}
						return built;
					},
					get: (target, subProp) => {
						return wrap(
							value.then((loaded) => loaded[subProp]),
							subProp
						);
					}
				});
			}
			if (value && typeof value === "object" && typeof value.default === "function") {
				const callableApi = function (...args) {
					return value.default.apply(value, args);
				};
				for (const [methodName, method] of Object.entries(value)) {
					if (methodName === "default") continue;
					callableApi[methodName] = method;
				}
				return callableApi;
			}
			if (value && typeof value === "object") {
				return slothletSelf._createBoundLazyApi(value);
			}
			return value;
		}
		return new Proxy(proxyApi, {
			get(target, prop) {
				// Only run RegExp.test if prop is a primitive string (not a Proxy object)
				if (
					typeof prop !== "string" ||
					prop === "then" ||
					prop === "default" ||
					prop.startsWith("_") ||
					typeof prop === "symbol" ||
					/^[0-9]+$/.test(String(prop))
				)
					return undefined;
				if (prop === "shutdown") {
					// Always return the main slothlet shutdown, bound to slothletSelf, to avoid recursion
					return slothletSelf.shutdown.bind(slothletSelf);
				}
				const apiKey = slothletSelf._toApiKey(prop);
				return wrap(target[apiKey], prop);
			},
			ownKeys(target) {
				return Reflect.ownKeys(target);
			},
			getOwnPropertyDescriptor(target, prop) {
				// For special properties, delegate to Reflect
				if (prop === "prototype" || prop === "constructor") {
					return Reflect.getOwnPropertyDescriptor(target, prop);
				}
				// If property exists, delegate to Reflect
				const desc = Reflect.getOwnPropertyDescriptor(target, prop);
				if (desc) return desc;
				// For non-existent properties, return a configurable descriptor
				return { configurable: true, enumerable: true, writable: true, value: undefined };
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
