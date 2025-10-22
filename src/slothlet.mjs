/**
 *	@Project: @cldmv/slothlet
 *	@Filename: /src/slothlet.mjs
 *	@Date: 2025-10-16 13:48:46 -07:00 (1760647726)
 *	@Author: Nate Hyson <CLDMV>
 *	@Email: <Shinrai@users.noreply.github.com>
 *	-----
 *	@Last modified by: Nate Hyson <CLDMV> (Shinrai@users.noreply.github.com)
 *	@Last modified time: 2025-10-22 07:00:27 -07:00 (1761141627)
 *	-----
 *	@Copyright: Copyright (c) 2013-2025 Catalyzed Motivation Inc. All rights reserved.
 */

/**
 * @fileoverview Slothlet - Advanced module loader with lazy and eager loading capabilities
 * @module @cldmv/slothlet
 * @typicalname slothlet
 * @version 2.0.0
 * @author CLDMV/Shinrai
 * @public
 * @simpleName
 *
 * @description
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
 *
 * @example
 * // Default import (recommended)
 * import slothlet from '@cldmv/slothlet';
 *
 * // OR destructured import
 * import { slothlet } from '@cldmv/slothlet';
 *
 * // OR both (they're the same)
 * import slothlet, { slothlet as namedSlothlet } from '@cldmv/slothlet';
 *
 * // OR dynamic import
 * const slothlet = await import('@cldmv/slothlet');
 *
 * // OR dynamic destructured import
 * const { slothlet } = await import('@cldmv/slothlet');
 *
 * // Usage
 * const api = await slothlet({
 *     dir: './api_tests/api_test'
 * });
 *
 * @example
 * // Default require (recommended)
 * const slothlet = require('@cldmv/slothlet');
 *
 * // OR destructured require
 * const { slothlet } = require('@cldmv/slothlet');
 *
 * // OR both (they're the same)
 * const { default: slothlet, slothlet: namedSlothlet } = require('@cldmv/slothlet');
 *
 * // OR dynamic import from CJS (top-level)
 * let slothlet;
 * (async () => {
 *   ({ slothlet } = await import('@cldmv/slothlet'));
 *   const api = await slothlet({
 *     dir: './api_tests/api_test'
 *   });
 * })();
 *
 * // Usage (inside async function or top-level await)
 * const api = await slothlet({
 *     dir: './api_tests/api_test'
 * });
 *
 * > [!IMPORTANT]
 * > The `await` keyword requires an async context. Use within an async function or at the top level in ES modules.
 *
 * @example
 * // Multiple instances with ESM
 * import slothlet from '@cldmv/slothlet';
 *
 * const api1 = await slothlet({ dir: './api_tests/api_test' });
 * const api2 = await slothlet({ dir: './api_tests/api_test_mixed' });
 *
 * @example
 * // Multiple instances with CommonJS
 * const slothlet = require('@cldmv/slothlet');
 *
 * const api1 = await slothlet({ dir: './api_tests/api_test' });
 * const api2 = await slothlet({ dir: './api_tests/api_test_cjs' });
 *
 * @example
 * // Create with context and reference (direct call)
 * const api = await slothlet({
 *   dir: './api_tests/api_test',
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

import { resolvePathFromCaller } from "@cldmv/slothlet/helpers/resolve-from-caller";
import { sanitizePathName } from "@cldmv/slothlet/helpers/sanitize";

// import { wrapCjsFunction, createCjsModuleProxy, isCjsModule, setGlobalCjsInstanceId } from "@cldmv/slothlet/helpers/cjs-integration";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// ESM require function
// const require = createRequire(import.meta.url);

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

// Set the global instance ID for CJS modules to use
// setGlobalCjsInstanceId(_slothlet);

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
 * @returns {Promise<function|object>} The bound API object or function
 * @public
 */
async function slothlet(options = {}) {
	// Create an isolated instance template
	const instance = createFreshInstance();

	// Remove prior instance-bound keys (leave helper meta underscored keys intact)
	for (const key of Object.keys(slothlet)) {
		if (key.startsWith("_")) continue; // keep meta like _instance if present
		// Skip the callable itself if a property accidentally shadowed name
		if (key === "name" || key === "length") continue;
		try {
			delete slothlet[key];
		} catch {
			// ignore
		}
	}

	// Attach fresh instance properties/functions onto the callable function
	for (const [k, v] of Object.entries(instance)) {
		if (typeof v === "function") {
			// Bind methods so `this` inside methods refers to the instance, not the function
			Object.defineProperty(slothlet, k, { value: v.bind(instance), writable: false, enumerable: true, configurable: true });
		} else {
			// Expose live references to instance state containers
			Object.defineProperty(slothlet, k, { value: instance[k], writable: true, enumerable: true, configurable: true });
		}
	}
	Object.defineProperty(slothlet, "_instance", { value: instance, writable: false, enumerable: false, configurable: true });

	// Boot this new instance and return its bound API
	return await instance.create(options);
}

/**
 * Creates a fresh, isolated slothlet instance object.
 * Copies method references from the template while cloning mutable state so
 * each invocation of slothlet() yields an independent API (no shared caches
 * unless implemented inside user modules).
 * @internal
 * @private
 * @returns {object} New internal slothlet instance with independent state
 * @example
 * // Internal usage only - creates isolated instance
 * const instance = createFreshInstance();
 * instance.config.dir = './my-api';  // Independent configuration
 */
function createFreshInstance() {
	const instance = {};
	for (const [k, v] of Object.entries(slothletObject)) {
		if (typeof v === "function") {
			// Do not bind here; preserve dynamic this for method chaining on the instance
			instance[k] = v;
			continue;
		}
		// Clone mutable containers to avoid cross-instance bleed
		if (k === "config") instance[k] = { ...v };
		else if (k === "boundapi" || k === "context" || k === "reference") instance[k] = {};
		else instance[k] = v;
	}
	return instance;
}

// Add all the slothlet object properties and methods to the function
const slothletObject = {
	// slothlet: null,
	api: null,
	self: {},
	boundapi: {},
	context: {},
	reference: {},
	mode: "singleton",
	loaded: false,
	config: { lazy: false, apiDepth: Infinity, debug: DEBUG, dir: null, sanitize: null },
	_dispose: null,
	_boundAPIShutdown: null,

	/**
	 * Creates and initializes a slothlet API instance.
	 * @async
	 * @memberof module:@cldmv/slothlet
	 * @param {SlothletOptions} [options={}] - Configuration options for creating the API
	 * @package
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
			const dirents = await fs.readdir(modesDir, { withFileTypes: true });
			const modeFiles = dirents.filter((d) => d.isFile()).map((d) => path.join(modesDir, d.name));
			// const modeFiles = dirents.filter((d) => d.isFile()).map((d) => d.name);
			// const modeFiles = dirents.filter((d) => d.isFile());

			for (const file of modeFiles) {
				// console.log("file: ", file);
				// const modePath = path.join(modesDir, file);
				const modePath = file;

				// const modeName = path
				// 	.basename(file)
				// 	.replace(/^slothlet_/, "")
				// 	.replace(/\..+$/, "");

				const modeName = path.parse(file).name.replace(/^slothlet_/, "");
				if (!modeName || modeName.includes(" ")) continue;
				try {
					// Use dynamic import for ESM, ensure file:// URL for Windows compatibility
					const modeUrl = pathToFileURL(modePath).href;
					// console.log("modePath: ", modePath);
					// console.log("modeUrl: ", modeUrl);
					// process.exit(0);
					// const imported = await import(modeUrl + "?_slothlet=" + _slothlet);
					const imported = await import(modeUrl);
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
			const { context = null, reference = null, sanitize = null, ...loadConfig } = options;
			this.context = context;
			this.reference = reference;

			// Store sanitize options in config for use by _toApiKey
			if (sanitize !== null) {
				this.config.sanitize = sanitize;
			}

			/**
			 * Conditionally initialize boundapi as a function or object based on api_mode.
			 * If api_mode is 'function', boundapi is a function with a mutable implementation (_impl).
			 * If api_mode is 'auto', it will be determined after loading based on API structure.
			 * Otherwise, boundapi is a plain object.
			 * @example
			 * this.api_mode = 'function';
			 * // this.boundapi(...args) calls this.boundapi._impl(...args)
			 */
			// TODO: Figure out why this needs to be here... if it's not here it breaks... But even in auto mode it breaks...
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
			// console.log("before:", apiDir);
			apiDir = resolvePathFromCaller(apiDir);
			// console.log("after:", apiDir);
			// console.error(new Error("Stack trace").stack);
			// process.exit(0);
			// apiDir = path.resolve(process.cwd(), apiDir);
		}

		// const slothletCJS = require("../index.cjs").withInstanceId(_slothlet);

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
					// TODO: this might be why I need the declaration in create()
					if (typeof this.boundapi._impl === "function") {
						return this.boundapi._impl(...args);
					}
				}.bind(this);
				this.boundapi._impl = () => {};
			} else if (this.api_mode === "object" && typeof this.boundapi === "function") {
				this.boundapi = {};
			}
		}

		// this.self = this.boundapi;

		const l_ctxRef = { ...{ context: null, reference: null }, ...ctxRef };

		// this.updateBindings(l_ctxRef.context, l_ctxRef.reference, this.boundapi);
		// Object.assign(this.boundapi, this.createBoundApi(l_ctxRef.context, l_ctxRef.reference) || {});
		// this.boundapi = this.createBoundApi(l_ctxRef.context, l_ctxRef.reference);
		const _boundapi = this.createBoundApi(l_ctxRef.reference);

		// _boundapi.__slothlet = this;

		mutateLiveBindingFunction(this.boundapi, _boundapi);

		this.updateBindings(this.context, this.reference, this.boundapi);
		// Debug: Check what's actually in the live bindings
		// console.log("[DEBUG] After updateBindings:");
		// console.log("  l_ctxRef.context:", l_ctxRef.context);
		// console.log("  l_ctxRef.reference:", l_ctxRef.reference);
		// console.log("  self keys:", Object.keys(self));
		// console.log("  context keys:", Object.keys(context));
		// console.log("  reference keys:", Object.keys(reference));
		// process.exit(0);
		this.loaded = true;

		// Update the bindings for this instance
		// this.updateBindings(null, null, this.boundapi);

		// Set up the async local storage context for this instance

		// this.safeDefine(this.boundapi, "__ctx", {
		// 	self: this.boundapi,
		// 	context: { ...context },
		// 	reference: { ...reference }
		// });

		// Update the bindings for this instance
		// this.updateBindings(null, null, this.boundapi);

		// this.safeDefine(this, "__ctx", {
		// 	self: this.boundapi,
		// 	context: { ...context },
		// 	reference: { ...reference }
		// });
		// this.boundapi.__ctx = {
		// 	self: this.boundapi,
		// 	context: { ...context },
		// 	reference: { ...reference }
		// };
		// if (this.config.lazy) {
		// 	console.log("[DEBUG] Setting __ctx:", {
		// 		hasSelf: !!this.boundapi.__ctx.self,
		// 		selfKeys: Object.keys(this.boundapi.__ctx.self || {}),
		// 		hasContext: !!this.boundapi.__ctx.context,
		// 		hasReference: !!this.boundapi.__ctx.reference
		// 	});
		// 	console.log("[DEBUG] this.boundapi", this.boundapi);
		// 	process.exit(0);
		// }

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
		return sanitizePathName(name, this.config.sanitize || {});
		// return name.replace(/-([a-zA-Z0-9])/g, (_, c) => c.toUpperCase());
	},

	/**
	 * Unified category builder supporting eager and lazy strategies.
	 * When mode === 'eager' it recursively materializes subdirectories.
	 * When mode === 'lazy' it delegates subdirectory handling to the provided subdirHandler
	 * without loading their contents (allowing proxy creation by caller).
	 * Shared responsibilities: file scanning, single-file flattening, export merging,
	 * upward flattening heuristics, function naming.
	 *
	 * @async
	 * @param {string} categoryPath
	 * @param {object} [options]
	 * @param {number} [options.currentDepth=0]
	 * @param {number} [options.maxDepth=Infinity]
	 * @param {'eager'|'lazy'} [options.mode='eager']
	 * @param {Function} [options.subdirHandler] - (ctx) => node; only used in lazy mode; ctx: { subDirEntry, subDirPath, key, categoryModules, currentDepth, maxDepth }
	 * @returns {Promise<function|object>}
	 * @private
	 * @internal
	 */
	async _buildCategory(categoryPath, options = {}) {
		const { currentDepth = 0, maxDepth = Infinity, mode = "eager", subdirHandler } = options;

		// Debug: Log when _buildCategory is called
		if (this.config.debug) {
			console.log(`[DEBUG] _buildCategory called with path: ${categoryPath}, mode: ${mode}`);
		}

		const files = await fs.readdir(categoryPath, { withFileTypes: true });
		const moduleFiles = files.filter((f) => this._shouldIncludeFile(f));
		const categoryName = this._toApiKey(path.basename(categoryPath));
		const subDirs = files.filter((e) => e.isDirectory() && !e.name.startsWith("."));

		// SINGLE FILE CASE
		if (moduleFiles.length === 1 && subDirs.length === 0) {
			const moduleExt = path.extname(moduleFiles[0].name);
			const moduleName = this._toApiKey(path.basename(moduleFiles[0].name, moduleExt));
			const mod = await this._loadSingleModule(path.join(categoryPath, moduleFiles[0].name));

			// Check if function name matches sanitized folder name (case-insensitive)
			const functionNameMatchesFolder = typeof mod === "function" && mod.name && mod.name.toLowerCase() === categoryName.toLowerCase();

			// NEW: Check if function name matches sanitized filename (case-insensitive) for single files
			const functionNameMatchesFilename =
				typeof mod === "function" &&
				mod.name &&
				this._toApiKey(mod.name).toLowerCase() === this._toApiKey(moduleName).toLowerCase() &&
				mod.name !== this._toApiKey(moduleName);

			// Debug: Log single file processing for auto-ip
			// if (this.config.debug && (moduleName.includes("autoI") || moduleName === "auto-ip")) {
			// 	console.log("[DEBUG] Single file processing:", moduleFiles[0].name);
			// 	console.log("[DEBUG] moduleName:", moduleName, "functionName:", mod.name);
			// 	console.log("[DEBUG] functionNameMatchesFolder:", functionNameMatchesFolder);
			// 	console.log("[DEBUG] functionNameMatchesFilename:", functionNameMatchesFilename);
			// }

			// Flatten if file matches folder name and exports a function (named)
			if (moduleName === categoryName && typeof mod === "function") {
				try {
					Object.defineProperty(mod, "name", { value: categoryName, configurable: true });
				} catch {
					// ignore
				}
				return mod;
			}

			// NEW: Flatten if function name matches folder name (case-insensitive) and prefer function name
			if (functionNameMatchesFolder) {
				try {
					// Use the original function name instead of sanitized folder name
					Object.defineProperty(mod, "name", { value: mod.name, configurable: true });
				} catch {
					// ignore
				}
				return mod;
			}

			// NEW: Use function name instead of sanitized filename when they match (case-insensitive)
			if (functionNameMatchesFilename) {
				// if (this.config.debug) {
				// 	console.log("[DEBUG] Using function name:", mod.name, "instead of sanitized filename:", moduleName);
				// }
				return { [mod.name]: mod };
			}

			// ALSO flatten if this was a default function export (tracked by internal flag)
			// even when the filename differs from the folder name (e.g. folder nest3 / singlefile.mjs)
			if (
				typeof mod === "function" &&
				(!mod.name || mod.name === "default" || mod.__slothletDefault === true) // explicitly marked default export function
			) {
				try {
					Object.defineProperty(mod, "name", { value: categoryName, configurable: true });
				} catch {
					// ignore
				}
				return mod;
			}
			if (moduleName === categoryName && mod && typeof mod === "object" && !mod.default) {
				return { ...mod };
			}
			return { [moduleName]: mod };
		}

		// MULTI-FILE CASE
		const categoryModules = {};
		for (const file of moduleFiles) {
			const moduleExt = path.extname(file.name);
			const moduleName = this._toApiKey(path.basename(file.name, moduleExt));

			// Debug: Log file processing
			// if (this.config.debug && file.name.includes("auto-ip")) {
			// 	console.log("[DEBUG] Processing file:", file.name, "moduleName:", moduleName);
			// }

			const mod = await this._loadSingleModule(path.join(categoryPath, file.name));
			if (moduleName === categoryName && mod && typeof mod === "object") {
				if (
					Object.prototype.hasOwnProperty.call(mod, categoryName) &&
					typeof mod[categoryName] === "object" &&
					mod[categoryName] !== null
				) {
					Object.assign(categoryModules, mod[categoryName]);
					for (const [key, value] of Object.entries(mod)) {
						if (key !== categoryName) categoryModules[this._toApiKey(key)] = value;
					}
				} else {
					Object.assign(categoryModules, mod);
				}
			} else if (typeof mod === "function") {
				const fnName = mod.name && mod.name !== "default" ? mod.name : moduleName;
				try {
					Object.defineProperty(mod, "name", { value: fnName, configurable: true });
				} catch {
					// ignore
				}

				// Check if function name matches sanitized filename (case-insensitive)
				// If so, prefer the original function name over the sanitized version
				let apiKey;
				if (fnName && fnName.toLowerCase() === moduleName.toLowerCase() && fnName !== moduleName) {
					// Use original function name without sanitizing
					apiKey = fnName;
					if (this.config.debug) {
						console.log(`[DEBUG] Using function name '${fnName}' instead of module name '${moduleName}'`);
					}
				} else {
					// Use sanitized function name
					apiKey = this._toApiKey(fnName);
					if (this.config.debug) {
						console.log(`[DEBUG] Using sanitized key '${apiKey}' for function '${fnName}' (module: '${moduleName}')`);
					}
				}

				categoryModules[apiKey] = mod;
			} else {
				// Handle named exports - check if any export function names match filename
				let hasPreferredName = false;
				const modWithPreferredNames = {};

				// Debug: Log the module structure for auto-ip related files
				// if (this.config.debug && (moduleName.includes("autoI") || moduleName === "auto-ip")) {
				// 	console.log("[DEBUG] Processing module:", moduleName, "exports:", Object.keys(mod));
				// 	for (const [exportName, exportValue] of Object.entries(mod)) {
				// 		if (typeof exportValue === "function") {
				// 			console.log(
				// 				"[DEBUG] Function export:",
				// 				exportName,
				// 				"function name:",
				// 				exportValue.name,
				// 				"filename lower:",
				// 				moduleName.toLowerCase(),
				// 				"function lower:",
				// 				exportValue.name?.toLowerCase(),
				// 				"matches filename:",
				// 				exportValue.name?.toLowerCase() === moduleName.toLowerCase(),
				// 				"different casing:",
				// 				exportValue.name !== moduleName
				// 			);
				// 		}
				// 	}
				// }

				for (const [exportName, exportValue] of Object.entries(mod)) {
					if (
						typeof exportValue === "function" &&
						exportValue.name &&
						this._toApiKey(exportValue.name).toLowerCase() === this._toApiKey(moduleName).toLowerCase() &&
						exportValue.name !== this._toApiKey(moduleName)
					) {
						// Use the original function name instead of sanitized filename
						modWithPreferredNames[exportValue.name] = exportValue;
						hasPreferredName = true;
						if (this.config.debug) {
							console.log("[DEBUG] Using preferred name:", exportValue.name, "instead of:", this._toApiKey(moduleName));
						}
					} else {
						modWithPreferredNames[this._toApiKey(exportName)] = exportValue;
					}
				}

				if (hasPreferredName) {
					Object.assign(categoryModules, modWithPreferredNames);
					// console.log("[DEBUG] Applied preferred names to categoryModules");
				} else {
					categoryModules[this._toApiKey(moduleName)] = mod;
					// if (moduleName.includes("autoI") || moduleName === "auto-ip") {
					// 	console.log("[DEBUG] No preferred name found, using default:", this._toApiKey(moduleName));
					// }
				}
			}
		}

		// SUBDIRECTORIES
		for (const subDirEntry of subDirs) {
			if (currentDepth < maxDepth) {
				const key = this._toApiKey(subDirEntry.name);
				const subDirPath = path.join(categoryPath, subDirEntry.name);
				let subModule;

				if (mode === "lazy" && typeof subdirHandler === "function") {
					subModule = subdirHandler({
						subDirEntry,
						subDirPath,
						key,
						categoryModules,
						currentDepth,
						maxDepth
					});
				} else {
					subModule = await this._buildCategory(subDirPath, {
						currentDepth: currentDepth + 1,
						maxDepth,
						mode: "eager"
					});
				}

				// Check if returned module is a function with name matching folder (case-insensitive)
				// If so, use the function name instead of the sanitized folder name
				if (
					typeof subModule === "function" &&
					subModule.name &&
					subModule.name.toLowerCase() === key.toLowerCase() &&
					subModule.name !== key
				) {
					// Use the original function name as the key
					categoryModules[subModule.name] = subModule;
				} else {
					categoryModules[key] = subModule;
				}
			}
		}

		// UPWARD FLATTENING
		const keys = Object.keys(categoryModules);
		if (keys.length === 1) {
			const singleKey = keys[0];
			if (singleKey === categoryName) {
				const single = categoryModules[singleKey];
				if (typeof single === "function") {
					if (single.name !== categoryName) {
						try {
							Object.defineProperty(single, "name", { value: categoryName, configurable: true });
						} catch {
							// ignore
						}
					}
					return single;
				} else if (single && typeof single === "object" && !Array.isArray(single)) {
					return single;
				}
			}
		}
		return categoryModules;
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
		return this._buildCategory(categoryPath, { currentDepth, maxDepth, mode: "eager" });
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
		// const moduleUrl = pathToFileURL(modulePath).href + "?_slothlet=" + _slothlet;
		// const module = await import(moduleUrl);
		// console.log("moduleUrl: ", moduleUrl);
		const module = await import(moduleUrl);

		// Detect if this is a CJS module by file extension
		// const isCjsModuleFile = isCjsModule(modulePath);

		// if (this.config.debug) console.log("Loading module:", modulePath, "isCjsModule:", isCjsModuleFile);

		// const module = await import(moduleUrl + "?testParam=maybe&_slothlet=" + _slothlet);
		if (this.config.debug) console.log("module: ", module);
		// If default export is a function, expose as callable and attach named exports as properties
		if (typeof module.default === "function") {
			let fn;
			if (rootLevel) {
				fn = module;
			} else {
				fn = module.default;
				// Mark as originating from a default export so category flatten logic can detect
				try {
					Object.defineProperty(fn, "__slothletDefault", { value: true, enumerable: false });
				} catch {
					// ignore
				}

				// Wrap CJS functions with instance context
				// if (isCjsModuleFile) {
				// 	if (this.config.debug) console.log("Wrapping CJS default function");
				// 	fn = this._wrapCjsFunction(fn);
				// }

				for (const [exportName, exportValue] of Object.entries(module)) {
					if (exportName !== "default") {
						// Wrap CJS functions
						// if (isCjsModuleFile && typeof exportValue === "function") {
						// 	if (this.config.debug) console.log("Wrapping CJS named export:", exportName);
						// 	fn[this._toApiKey(exportName)] = this._wrapCjsFunction(exportValue);
						// } else {
						fn[this._toApiKey(exportName)] = exportValue;
						// }
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
		// const defaultExportFn =
		// 	typeof module.default === "function" ? module.default : typeof moduleExports[0][1] === "function" ? moduleExports[0][1] : null;

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

			const obj = { ...defaultExportObj };

			// Wrap CJS functions in the default export object
			// if (isCjsModuleFile) {
			// 	if (this.config.debug) console.log("Wrapping CJS functions in default export object");
			// 	for (const [key, value] of Object.entries(obj)) {
			// 		if (typeof value === "function") {
			// 			if (this.config.debug) console.log(`Wrapping CJS function: ${key}`);
			// 			obj[key] = this._wrapCjsFunction(value);
			// 		}
			// 	}
			// }

			for (const [exportName, exportValue] of Object.entries(module)) {
				if (exportName !== "default" && exportValue !== obj) {
					// Skip named exports that exist in the default export (they're already wrapped)
					// if (isCjsModuleFile && exportName in defaultExportObj) {
					// 	if (this.config.debug) console.log(`Skipping named export '${exportName}' - already wrapped in default export`);
					// 	continue;
					// }
					obj[this._toApiKey(exportName)] = exportValue;
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
				const obj = { ...namedExports[0][1] };

				// Wrap CJS functions in the object
				// if (isCjsModuleFile) {
				// 	for (const [key, value] of Object.entries(obj)) {
				// 		if (typeof value === "function") {
				// 			obj[key] = this._wrapCjsFunction(value);
				// 		}
				// 	}
				// }

				return obj;
			}
			if (typeof namedExports[0][1] === "function") {
				if (this.config.debug) console.log("namedExports[0][1] === function: ", namedExports[0][1]);
				// Return single function export directly, wrapped if CJS
				// return isCjsModuleFile ? this._wrapCjsFunction(namedExports[0][1]) : namedExports[0][1];
				return namedExports[0][1];
			}
		}
		const apiExport = {};
		for (const [exportName, exportValue] of namedExports) {
			// Wrap CJS functions
			// apiExport[exportName] = isCjsModuleFile && typeof exportValue === "function" ? this._wrapCjsFunction(exportValue) : exportValue;
			apiExport[this._toApiKey(exportName)] = exportValue;
		}
		return apiExport;
	},

	/**
	 * Filters out files that should not be loaded by slothlet.
	 * @private
	 * @param {object} entry - The directory entry to check
	 * @returns {boolean} True if the file should be included, false if it should be excluded
	 */
	_shouldIncludeFile(entry) {
		// Only include actual files
		if (!entry.isFile()) return false;
		// Only include JavaScript module files
		if (!(entry.name.endsWith(".mjs") || entry.name.endsWith(".cjs") || entry.name.endsWith(".js"))) return false;
		// Exclude hidden files (starting with .)
		if (entry.name.startsWith(".")) return false;
		// Exclude slothlet JSDoc files (starting with __slothlet_)
		if (entry.name.startsWith("__slothlet_")) return false;
		return true;
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
	 * > [!WARNING]
	 * > - `reference` does not add/remove functions from the API when called outside slothlet functions
	 * > - Setting `self` manually is ill-advised and can break the API if not done correctly
	 * > - These bindings are primarily for internal use during API initialization
	 *
	 * @memberof module:@cldmv/slothlet
	 * @param {object} newContext - The current context object to bind as `context`.
	 * @param {object} newReference - The current reference object to bind as `reference`. Note: Does not modify API structure when called externally.
	 * @param {function|object} newSelf - The current API object instance to bind as `self`. WARNING: Manual setting can break the API.
	 * @private
	 * @internal
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

		this.safeDefine(this.boundapi, "__ctx", {
			self: this.boundapi,
			context: this.context,
			reference: this.reference
		});
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
	createBoundApi(ref = null) {
		if (!this.api) throw new Error("BindleApi modules not loaded. Call load() first.");

		// console.log(this.api);
		// process.exit(0);

		let boundApi;
		/* 		
		if (this.config.lazy) {
			// The new lazy mode creates a fully functional proxy API
			// No need to wrap it again, just use it directly
			boundApi = this.api;
		} else {
			// Use the eager mode's buildCompleteApi function
			boundApi = this.modes.eager._buildCompleteApi(this.api);
		} 
		*/

		boundApi = this.api;

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
					} catch {
						// ignore
					}
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
	 * @returns {function|object} The raw API object or function
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
	 * @returns {function|object} The bound API object or function with live bindings and context
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
		// If a shutdown is already in progress AND we're still loaded, treat as a true recursive call.
		// If a shutdown completed earlier (loaded === false) just make this a no-op.
		if (this._shutdownInProgress) {
			if (!this.loaded) return; // Idempotent: already shut down.
			console.warn("[slothlet] shutdown already in progress – ignoring nested call.");
			return; // Swallow nested call instead of throwing to reduce false positives.
		}
		this._shutdownInProgress = true;
		try {
			/**
			 * Shuts down both the bound API and internal resources, with timeout and error handling.
			 * @returns {Promise<void>}
			 */
			if (this.loaded) {
				const TIMEOUT_MS = 5000;
				let apiError, internalError;
				if (typeof this._boundAPIShutdown === "function") {
					try {
						await Promise.race([
							this._boundAPIShutdown.call(this.boundapi),
							new Promise((_, reject) => setTimeout(() => reject(new Error("API shutdown timeout")), TIMEOUT_MS))
						]);
					} catch (err) {
						apiError = err;
					}
				}
				// Prefer boundApi.__dispose__ if available
				const disposeFn = this.boundapi && typeof this.boundapi.__dispose__ === "function" ? this.boundapi.__dispose__ : this._dispose;
				if (typeof disposeFn === "function") {
					try {
						await disposeFn();
					} catch (err) {
						internalError = err;
					}
				}
				this.loaded = false;
				this.api = null;
				this.boundapi = {};
				this.context = {};
				this.reference = {};
				this._dispose = null;
				this._boundAPIShutdown = null;
				if (apiError || internalError) throw apiError || internalError;
			}
		} finally {
			// Always release the in-progress flag so future shutdown attempts after re-create work.
			this._shutdownInProgress = false;
		}
	}
};

/**
 * Mutates a live-binding variable (object or function) to match a new value, preserving reference.
 * @param {function|object} target - The variable to mutate (object or function).
 * @param {function|object} source - The new value to copy from (object or function).
 * @private
 * @internal
 * @example
 * mutateLiveBindingFunction(self, newSelf);
 * mutateLiveBindingFunction(boundapi, newApi);
 */
export function mutateLiveBindingFunction(target, source) {
	if (typeof source === "function") {
		target._impl = (...args) => source(...args);
		// Remove old methods except _impl and __ctx
		for (const key of Object.keys(target)) {
			if (key !== "_impl" && key !== "__ctx") delete target[key];
		}
		// Attach new methods
		for (const key of Object.getOwnPropertyNames(source)) {
			if (key !== "length" && key !== "name" && key !== "prototype" && key !== "_impl" && key !== "__ctx") {
				try {
					target[key] = source[key];
				} catch {
					// ignore
				}
			}
		}
	} else if (typeof source === "object" && source !== null) {
		// Remove old methods except _impl and __ctx
		for (const key of Object.keys(target)) {
			if (key !== "_impl" && key !== "__ctx") delete target[key];
		}
		// Attach new properties/methods
		for (const [key, value] of Object.entries(source)) {
			if (key !== "__ctx") {
				target[key] = value;
			}
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
 * @property {string} [dir=api] - Directory to load API modules from.
 *   - Can be absolute or relative path.
 *   - If relative, resolved from the calling file's location.
 *   - Defaults to "api" directory relative to caller.
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
 *   - Available to all loaded modules via `import { context } from '@cldmv/slothlet/runtime'`. Useful for request data,
 *   - user sessions, environment configs, etc.
 * @property {object} [reference={}] - Reference object merged into the API root level.
 *   - Properties not conflicting with loaded modules are added directly to the API.
 *   - Useful for utility functions, constants, or external service connections.
 * @property {object} [sanitize] - Filename sanitization options for API property names.
 *   - Controls how file names are converted to valid JavaScript identifiers.
 *   - Default behavior: camelCase conversion with lowerFirst=true.
 * @property {boolean} [sanitize.lowerFirst=true] - Lowercase first character of first segment for camelCase convention.
 * @property {boolean} [sanitize.preserveAllUpper=false] - Automatically preserve any identifier that is already in all-uppercase format.
 * @property {boolean} [sanitize.preserveAllLower=false] - Automatically preserve any identifier that is already in all-lowercase format.
 * @property {object} [sanitize.rules={}] - Advanced segment transformation rules with glob pattern support.
 * @property {string[]} [sanitize.rules.leave=[]] - Segments to preserve exactly as-is (case-sensitive, supports * and ? globs).
 * @property {string[]} [sanitize.rules.leaveInsensitive=[]] - Segments to preserve exactly as-is (case-insensitive, supports * and ? globs).
 * @property {string[]} [sanitize.rules.upper=[]] - Segments to force to UPPERCASE (case-insensitive, supports * and ? globs).
 * @property {string[]} [sanitize.rules.lower=[]] - Segments to force to lowercase (case-insensitive, supports * and ? globs).
 */
