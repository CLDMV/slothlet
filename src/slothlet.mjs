/**
 *	@Project: @cldmv/slothlet
 *	@Filename: /src/slothlet.mjs
 *	@Date: 2025-10-16 13:48:46 -07:00 (1760647726)
 *	@Author: Nate Hyson <CLDMV>
 *	@Email: <Shinrai@users.noreply.github.com>
 *	-----
 *	@Last modified by: Nate Hyson <CLDMV> (Shinrai@users.noreply.github.com)
 *	@Last modified time: 2025-12-30 05:41:53 -08:00 (1767102113)
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
 * import slothlet from "@cldmv/slothlet";
 *
 * // OR destructured import
 * import { slothlet } from "@cldmv/slothlet";
 *
 * // OR both (they're the same)
 * import slothlet, { slothlet as namedSlothlet } from "@cldmv/slothlet";
 *
 * // OR dynamic import
 * const slothlet = await import("@cldmv/slothlet");
 *
 * // OR dynamic destructured import
 * const { slothlet } = await import("@cldmv/slothlet");
 *
 * // Usage
 * const api = await slothlet({
 *     dir: "./api_tests/api_test"
 * });
 *
 * @example
 * // Default require (recommended)
 * const slothlet = require("@cldmv/slothlet");
 *
 * // OR destructured require
 * const { slothlet } = require("@cldmv/slothlet");
 *
 * // OR both (they're the same)
 * const { default: slothlet, slothlet: namedSlothlet } = require("@cldmv/slothlet");
 *
 * // OR dynamic import from CJS (top-level)
 * let slothlet;
 * (async () => {
 *   ({ slothlet } = await import("@cldmv/slothlet"));
 *   const api = await slothlet({
 *     dir: "./api_tests/api_test"
 *   });
 * })();
 *
 * // Usage (inside async function or top-level await)
 * const api = await slothlet({
 *     dir: "./api_tests/api_test"
 * });
 *
 * > [!IMPORTANT]
 * > The `await` keyword requires an async context. Use within an async function or at the top level in ES modules.
 *
 * @example
 * // Multiple instances with ESM
 * import slothlet from "@cldmv/slothlet";
 *
 * const api1 = await slothlet({ dir: "./api_tests/api_test" });
 * const api2 = await slothlet({ dir: "./api_tests/api_test_mixed" });
 *
 * @example
 * // Multiple instances with CommonJS
 * const slothlet = require("@cldmv/slothlet");
 *
 * const api1 = await slothlet({ dir: "./api_tests/api_test" });
 * const api2 = await slothlet({ dir: "./api_tests/api_test_cjs" });
 *
 * @example
 * // Create with context and reference (direct call)
 * const api = await slothlet({
 *   dir: "./api_tests/api_test",
 *   context: { user: "alice", env: "prod" },
 *   reference: { version: "1.0.0" }
 * });
 *
 * // Access modules through bound API
 * await api.math.add(2, 3); // 5
 * api.context.user; // "alice"
 * api.version; // "1.0.0"
 *
 * @example
 * // Shutdown when done
 * await api.shutdown();
 */
import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

import { resolvePathFromCaller } from "@cldmv/slothlet/helpers/resolve-from-caller";
import {
	analyzeModule,
	processModuleFromAnalysis,
	buildCategoryStructure,
	toapiPathKey,
	shouldIncludeFile
} from "@cldmv/slothlet/helpers/api_builder";
import { updateInstanceData, cleanupInstance } from "@cldmv/slothlet/helpers/instance-manager";
import { disableAlsForEventEmitters, cleanupAllSlothletListeners } from "@cldmv/slothlet/helpers/als-eventemitter";
import { HookManager } from "@cldmv/slothlet/helpers/hooks";

// import { wrapCjsFunction, createCjsModuleProxy, isCjsModule, setGlobalCjsInstanceId } from "@cldmv/slothlet/helpers/cjs-integration";

/**
 * Normalize runtime input to internal standard format.
 * @function normalizeRuntimeType
 * @param {string} runtime - Input runtime type (various formats accepted)
 * @returns {string} Normalized runtime type ("async" or "live")
 * @internal
 * @private
 */
function normalizeRuntimeType(runtime) {
	if (!runtime || typeof runtime !== "string") {
		return "async"; // Default to AsyncLocalStorage
	}

	const normalized = runtime.toLowerCase().trim();

	// AsyncLocalStorage runtime variants
	if (normalized === "async" || normalized === "asynclocal" || normalized === "asynclocalstorage") {
		return "async";
	}

	// Live bindings runtime variants
	if (normalized === "live" || normalized === "livebindings" || normalized === "experimental") {
		return "live";
	}

	// Default to async for unknown values
	return "async";
}

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
 * @returns {Promise<SlothletAPI>} The bound API object or function with management methods
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
 * instance.config.dir = "./my-api";  // Independent configuration
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
	config: { lazy: false, apiDepth: Infinity, debug: DEBUG, dir: null, sanitize: null, allowApiOverwrite: true },
	_dispose: null,
	_boundAPIShutdown: null,
	instanceId: null, // Unique instance identifier for cache isolation

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

		// Support both old and new option names:
		// - engine (new) vs mode (old) for execution environment
		// - mode: "lazy"/"eager" as alternative to lazy: true/false
		const { entry = import.meta.url, engine = "singleton", mode, api_mode = "auto" } = options ?? {};

		// Handle execution engine option (backward compatibility for mode -> engine)
		const executionEngine = mode && ["singleton", "vm", "worker", "fork"].includes(mode) ? mode : engine;

		// Handle loading mode option (mode: "lazy"/"eager" takes precedence over lazy: true/false)
		let isLazyMode;
		if (mode && ["lazy", "eager"].includes(mode)) {
			isLazyMode = mode === "lazy";
		} else {
			isLazyMode = options.lazy !== undefined ? options.lazy : this.config.lazy;
		}

		// Generate unique instance ID for cache isolation between different slothlet instances
		const runtimeType = normalizeRuntimeType(options.runtime || "async");
		const loadingModeStr = isLazyMode ? "lazy" : "eager";
		this.instanceId = `slothlet_${runtimeType}_${loadingModeStr}_${Date.now()}_${Math.random().toString(36).slice(2, 11).padEnd(9, "0")}`;

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

					const imported = await import(modeUrl);
					if (imported && typeof imported === "object") {
						this.modes[modeName] = imported.default || imported;
					}
				} catch (err) {
					console.error(`[slothlet] Could not import mode '${modeName}':`, err);
				}
			}
		}

		// self = this.boundapi;
		// context = this.context;
		// reference = this.reference;

		this.mode = executionEngine;
		this.api_mode = api_mode;
		let api;
		let dispose;
		if (executionEngine === "singleton") {
			// Destructure and exclude engine/mode from loadConfig to avoid conflicts
			// eslint-disable-next-line no-unused-vars
			const { context = null, reference = null, sanitize = null, hooks = false, scope, engine, mode, ...loadConfig } = options;
			this.context = context;
			this.reference = reference;

			// Parse hooks configuration
			let hooksEnabled = false;
			let hooksPattern = null;
			let hooksSuppressErrors = false;

			if (hooks === true || hooks === false) {
				// Boolean: enabled/disabled with all patterns
				hooksEnabled = hooks;
				hooksPattern = hooks ? "**" : null;
			} else if (typeof hooks === "string") {
				// String: enabled with specific pattern
				hooksEnabled = true;
				hooksPattern = hooks;
			} else if (hooks && typeof hooks === "object") {
				// Object: { enabled, pattern, suppressErrors }
				hooksEnabled = hooks.enabled !== false; // Default true if object provided
				hooksPattern = hooks.pattern || "**";
				hooksSuppressErrors = hooks.suppressErrors || false;
			}

			// Create HookManager instance
			this.hookManager = new HookManager(hooksEnabled, hooksPattern, { suppressErrors: hooksSuppressErrors });

			// Parse scope configuration for per-request context
			if (scope && typeof scope === "object") {
				const mergeStrategy = scope.merge || "shallow";
				if (mergeStrategy !== "shallow" && mergeStrategy !== "deep") {
					throw new TypeError(`Invalid scope.merge value: "${mergeStrategy}". Must be "shallow" or "deep".`);
				}
				this.config.scope = { merge: mergeStrategy };
			} else if (scope === false) {
				this.config.scope = { enabled: false };
			} else {
				// Default: shallow merge enabled
				this.config.scope = { merge: "shallow" };
			}

			// Store sanitize options in config for use by _toapiPathKey
			if (sanitize !== null) {
				this.config.sanitize = sanitize;
			}

			// Update loadConfig with the resolved loading mode, removing conflicting options
			loadConfig.lazy = isLazyMode;

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

			// Hooks API is now added in load() method before wrapping

			// console.log("this.boundapi", this.boundapi);
			// process.exit(0);
			return this.boundapi;
		} else {
			const { createEngine } = await import("./lib/engine/slothlet_engine.mjs");
			// Pass the execution engine as 'mode' parameter to createEngine for backward compatibility
			({ api, dispose } = await createEngine({ entry, mode: executionEngine, ...options }));
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

		// Normalize runtime input to internal format (async/live)
		this.config.runtime = normalizeRuntimeType(this.config.runtime);
		// Import appropriate runtime module based on normalized config
		if (!this.runtime) {
			if (this.config.runtime === "live") {
				this.runtime = await import("@cldmv/slothlet/runtime/live");
			} else {
				// Default to AsyncLocalStorage runtime (original master branch implementation)
				this.runtime = await import("@cldmv/slothlet/runtime/async");
			}
		}

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

		if (this.loaded) return this.api;
		if (this.config.lazy) {
			this.api = await this.modes.lazy.create.call(this, apiDir, this.config.apiDepth || Infinity, 0);
		} else {
			this.api = await this.modes.eager.create.call(this, apiDir, this.config.apiDepth || Infinity, 0);
		}

		// Add hooks API to this.api if HookManager exists (BEFORE wrapping with runtime)
		if (this.hookManager) {
			const hooksApi = {
				on: (name, type, handler, options) => this.hookManager.on(name, type, handler, options),
				off: (idOrPattern) => this.hookManager.off(idOrPattern),
				enable: (pattern) => this.hookManager.enable(pattern),
				disable: () => this.hookManager.disable(),
				clear: (type) => this.hookManager.clear(type),
				list: (type) => this.hookManager.list(type)
			};

			// Define hooks as enumerable to work with both eager and lazy proxies
			Object.defineProperty(this.api, "hooks", {
				value: hooksApi,
				writable: false,
				enumerable: true,
				configurable: true
			});
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
	 * Delegates to centralized api_builder utility function.
	 * @memberof module:@cldmv/slothlet
	 * @param {string} name - The name to convert
	 * @returns {string} The camelCase version of the name
	 * @private
	 * @internal
	 * @example
	 * _toapiPathKey('root-math') // 'rootMath'
	 */
	_toapiPathKey(name) {
		return toapiPathKey(name, this.config.sanitize || {});
	},

	/**
	 * Unified category builder supporting eager and lazy strategies using centralized decision logic.
	 * When mode === 'eager' it recursively materializes subdirectories.
	 * When mode === 'lazy' it delegates subdirectory handling to the provided subdirHandler
	 * without loading their contents (allowing proxy creation by caller).
	 * Now uses centralized decision functions for consistent API structure logic.
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

		// Delegate to centralized category building function
		return buildCategoryStructure(categoryPath, {
			currentDepth,
			maxDepth,
			mode,
			subdirHandler,
			instance: this
		});
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
	 * Thin wrapper around analyzeModule + processModuleFromAnalysis from api_builder.
	 * @async
	 * @memberof module:@cldmv/slothlet
	 * @param {string} modulePath - Absolute path to the module file to load
	 * @param {boolean} [returnAnalysis=false] - When true, returns both processed module and original analysis data.
	 *   Required for multi-default export handling where flattening decisions need access to original
	 *   analysis results (hasDefault, namedExportsCount, etc.) before processModuleFromAnalysis
	 *   modifies the module structure by attaching named exports to default exports.
	 * @returns {Promise<object|{mod: object, analysis: object}>}
	 *   When returnAnalysis=false: Returns processed module exports only (legacy behavior).
	 *   When returnAnalysis=true: Returns {mod: processedModule, analysis: originalAnalysis}
	 *   where analysis contains unmodified module metadata for accurate flattening decisions.
	 * @private
	 * @internal
	 */
	async _loadSingleModule(modulePath, returnAnalysis = false) {
		// Delegate to centralized api_builder functions
		const analysis = await analyzeModule(modulePath, {
			debug: this.config.debug,
			instance: this
		});
		const processedModule = processModuleFromAnalysis(analysis, {
			debug: this.config.debug,
			instance: this
		});

		// Return both analysis and processed module when requested for multi-default handling
		if (returnAnalysis) {
			return { mod: processedModule, analysis };
		}

		// Legacy behavior: return only processed module
		return processedModule;
	},





	/**
	 * Filters out files that should not be loaded by slothlet.
	 * Delegates to centralized api_builder utility function.
	 * @private
	 * @param {object} entry - The directory entry to check
	 * @returns {boolean} True if the file should be included, false if it should be excluded
	 */
	_shouldIncludeFile(entry) {
		return shouldIncludeFile(entry);
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
	 * slothlet.updateBindings({ user: "alice" }, null, null);
	 * context.user; // "alice"
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

		// Include runtime type in context for dispatcher detection
		const contextWithRuntime = {
			...newContext,
			runtimeType: this.config.runtime // Already normalized to "async" or "live"
		};
		Object.assign(context, contextWithRuntime || {});
		Object.assign(reference, newReference || {});

		// Register instance data for live bindings runtime
		if (this.instanceId) {
			updateInstanceData(this.instanceId, "self", newSelf);
			updateInstanceData(this.instanceId, "context", contextWithRuntime);
			updateInstanceData(this.instanceId, "reference", newReference);
			updateInstanceData(this.instanceId, "config", this.config);
		}

		this.safeDefine(this.boundapi, "__ctx", {
			self: this.boundapi,
			context: this.context,
			reference: this.reference,
			hookManager: this.hookManager
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

		// Capture instance reference for describe function
		const instance = this;
		this.safeDefine(boundApi, "describe", function (showAll = false) {
			/**
			 * For lazy mode:
			 * - If showAll is false, return top-level keys only (do not resolve modules).
			 * - If showAll is true, recursively resolve all endpoints and return a fully built API object.
			 * For eager mode, return full API object.
			 */
			if (instance.config && instance.config.lazy) {
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

		// Determine if shutdown should be enumerable
		// If user defined a shutdown function, keep it enumerable (part of API surface)
		// If it's only our management method, make it non-enumerable (hidden)
		const hasUserDefinedShutdown = this._boundAPIShutdown !== null;

		const shutdownDesc = Object.getOwnPropertyDescriptor(boundApi, "shutdown");
		if (!shutdownDesc || shutdownDesc.configurable) {
			Object.defineProperty(boundApi, "shutdown", {
				value: this.shutdown.bind(this),
				writable: true,
				configurable: true,
				enumerable: hasUserDefinedShutdown // Enumerable if user-defined, hidden if management-only
			});
		} else if (this.config && this.config.debug) {
			console.warn("Could not redefine boundApi.shutdown: not configurable");
		}

		// Add addApi method to boundApi
		const addApiDesc = Object.getOwnPropertyDescriptor(boundApi, "addApi");
		if (!addApiDesc || addApiDesc.configurable) {
			Object.defineProperty(boundApi, "addApi", {
				value: this.addApi.bind(this),
				writable: true,
				configurable: true,
				enumerable: false // Non-enumerable to distinguish from API endpoints
			});
		} else if (this.config && this.config.debug) {
			console.warn("Could not redefine boundApi.addApi: not configurable");
		}

		// Add .run() method to boundApi
		const runDesc = Object.getOwnPropertyDescriptor(boundApi, "run");
		if (!runDesc || runDesc.configurable) {
			Object.defineProperty(boundApi, "run", {
				value: this.run.bind(this),
				writable: true,
				configurable: true,
				enumerable: false
			});
		} else if (this.config && this.config.debug) {
			console.warn("Could not redefine boundApi.run: not configurable");
		}

		// Add .scope() method to boundApi
		const scopeDesc = Object.getOwnPropertyDescriptor(boundApi, "scope");
		if (!scopeDesc || scopeDesc.configurable) {
			Object.defineProperty(boundApi, "scope", {
				value: this.scope.bind(this),
				writable: true,
				configurable: true,
				enumerable: false
			});
		} else if (this.config && this.config.debug) {
			console.warn("Could not redefine boundApi.scope: not configurable");
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
	 * @param {boolean} [enumerable=false] - Whether the property should be enumerable (default: false for management methods)
	 * @private
	 * @internal
	 * @example
	 * safeDefine(api, 'shutdown', shutdownFunction, false);
	 */
	safeDefine(obj, key, value, enumerable = false) {
		const desc = Object.getOwnPropertyDescriptor(obj, key);
		if (!desc) {
			Object.defineProperty(obj, key, {
				value,
				writable: true,
				configurable: true,
				enumerable
			});
		} else if (desc.configurable) {
			Object.defineProperty(obj, key, {
				value,
				writable: true,
				configurable: true,
				enumerable
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
	 * Dynamically adds API modules from a new folder to the existing API at a specified path.
	 *
	 * This method allows extending the API after it has been created by loading modules from
	 * an additional folder and merging them into the API at a specific location defined by
	 * a dotted path notation. Works with both lazy and eager loading modes.
	 *
	 * **Warning:** This method is not thread-safe. Concurrent calls to addApi with overlapping
	 * paths may result in race conditions and inconsistent state. Ensure calls are properly
	 * sequenced using await or other synchronization mechanisms.
	 *
	 * @async
	 * @memberof module:@cldmv/slothlet
	 * @param {string} apiPath - Dotted path where to add the new API (e.g., "runtime.newapi", "tools.external")
	 * @param {string} folderPath - Path to the folder containing modules to load (relative or absolute)
	 * @returns {Promise<void>} Resolves when the API extension is complete
	 * @throws {Error} If API is not loaded, folder doesn't exist, or path navigation fails
	 * @public
	 *
	 * @description
	 * The method performs the following steps:
	 * 1. Validates that the API is loaded and the folder exists
	 * 2. Resolves relative folder paths from the caller's location
	 * 3. Loads modules from the specified folder using the current loading mode (lazy/eager)
	 * 4. Navigates to the specified API path, creating intermediate objects as needed
	 * 5. Merges the new modules into the target location
	 * 6. Updates all live bindings to reflect the changes
	 *
	 * @example
	 * // Create initial API
	 * const api = await slothlet({ dir: "./api" });
	 *
	 * // Add additional modules at runtime.plugins path
	 * await api.addApi("runtime.plugins", "./plugins");
	 *
	 * // Access the new API
	 * api.runtime.plugins.myPlugin();
	 *
	 * @example
	 * // Add modules to root level
	 * await api.addApi("utilities", "./utils");
	 * api.utilities.helperFunc();
	 *
	 * @example
	 * // Add nested modules
	 * await api.addApi("services.external.github", "./integrations/github");
	 * api.services.external.github.getUser();
	 */
	async addApi(apiPath, folderPath) {
		if (!this.loaded) {
			throw new Error("[slothlet] Cannot add API: API not loaded. Call create() or load() first.");
		}

		// Validate apiPath parameter
		if (typeof apiPath !== "string") {
			throw new TypeError("[slothlet] addApi: 'apiPath' must be a string.");
		}
		const normalizedApiPath = apiPath.trim();
		if (normalizedApiPath === "") {
			throw new TypeError("[slothlet] addApi: 'apiPath' must be a non-empty, non-whitespace string.");
		}
		const pathParts = normalizedApiPath.split(".");
		if (pathParts.some((part) => part === "")) {
			throw new Error(`[slothlet] addApi: 'apiPath' must not contain empty segments. Received: "${normalizedApiPath}"`);
		}

		// Validate folderPath parameter
		if (typeof folderPath !== "string") {
			throw new TypeError("[slothlet] addApi: 'folderPath' must be a string.");
		}

		// Resolve relative folder paths from the caller's location
		let resolvedFolderPath = folderPath;
		if (!path.isAbsolute(folderPath)) {
			resolvedFolderPath = resolvePathFromCaller(folderPath);
		}

		// Verify the folder exists
		let stats;
		try {
			stats = await fs.stat(resolvedFolderPath);
		} catch (error) {
			throw new Error(`[slothlet] addApi: Cannot access folder: ${resolvedFolderPath} - ${error.message}`);
		}
		if (!stats.isDirectory()) {
			throw new Error(`[slothlet] addApi: Path is not a directory: ${resolvedFolderPath}`);
		}

		if (this.config.debug) {
			console.log(`[DEBUG] addApi: Loading modules from ${resolvedFolderPath} to path: ${normalizedApiPath}`);
		}

		// Load modules from the new folder using the appropriate mode
		let newModules;
		if (this.config.lazy) {
			// Use lazy mode to create the API structure
			newModules = await this.modes.lazy.create.call(this, resolvedFolderPath, this.config.apiDepth || Infinity, 0);
		} else {
			// Use eager mode to create the API structure
			newModules = await this.modes.eager.create.call(this, resolvedFolderPath, this.config.apiDepth || Infinity, 0);
		}

		if (this.config.debug) {
			if (newModules && typeof newModules === "object") {
				console.log(`[DEBUG] addApi: Loaded modules:`, Object.keys(newModules));
			} else {
				console.log(
					`[DEBUG] addApi: Loaded modules (non-object):`,
					typeof newModules === "function" ? `[Function: ${newModules.name || "anonymous"}]` : newModules
				);
			}
		}

		// Navigate to the target location in the API, creating intermediate objects as needed
		let currentTarget = this.api;
		let currentBoundTarget = this.boundapi;

		for (let i = 0; i < pathParts.length - 1; i++) {
			const part = pathParts[i];
			const key = this._toapiPathKey(part);

			// Create intermediate objects if they don't exist
			// Allow both objects and functions as containers (slothlet's function.property pattern)
			// Functions are valid containers in JavaScript and can have properties added to them
			if (Object.prototype.hasOwnProperty.call(currentTarget, key)) {
				const existing = currentTarget[key];
				if (existing === null || (typeof existing !== "object" && typeof existing !== "function")) {
					throw new Error(
						`[slothlet] Cannot extend API path "${normalizedApiPath}" through segment "${part}": ` +
							`existing value is type "${typeof existing}", cannot add properties.`
					);
				}
				// At this point, existing is guaranteed to be an object or function
				// Both are valid containers that can be traversed and extended with properties
			} else {
				currentTarget[key] = {};
			}
			if (Object.prototype.hasOwnProperty.call(currentBoundTarget, key)) {
				const existingBound = currentBoundTarget[key];
				if (existingBound === null || (typeof existingBound !== "object" && typeof existingBound !== "function")) {
					throw new Error(
						`[slothlet] Cannot extend bound API path "${normalizedApiPath}" through segment "${part}": ` +
							`existing value is type "${typeof existingBound}", cannot add properties.`
					);
				}
				// At this point, existingBound is guaranteed to be an object or function
			} else {
				currentBoundTarget[key] = {};
			}

			// Navigate into the container (object or function) to continue path traversal
			currentTarget = currentTarget[key];
			currentBoundTarget = currentBoundTarget[key];
		}

		// Get the final key where we'll merge the new modules
		const finalKey = this._toapiPathKey(pathParts[pathParts.length - 1]);

		// Merge the new modules into the target location
		if (typeof newModules === "function") {
			// If the loaded modules result in a function, set it directly
			// Check for existing value and handle based on allowApiOverwrite config
			if (Object.prototype.hasOwnProperty.call(currentTarget, finalKey)) {
				const existing = currentTarget[finalKey];

				// Check if overwrites are disabled
				if (this.config.allowApiOverwrite === false) {
					console.warn(
						`[slothlet] Skipping addApi: API path "${normalizedApiPath}" final key "${finalKey}" ` +
							`already exists (type: "${typeof existing}"). Set allowApiOverwrite: true to allow overwrites.`
					);
					return; // Skip the overwrite
				}

				// Warn if overwriting an existing non-function value (potential data loss)
				if (existing !== null && typeof existing !== "function") {
					console.warn(
						`[slothlet] Overwriting existing non-function value at API path "${normalizedApiPath}" ` +
							`final key "${finalKey}" with a function. Previous type: "${typeof existing}".`
					);
				} else if (typeof existing === "function") {
					// Warn when replacing an existing function
					console.warn(
						`[slothlet] Overwriting existing function at API path "${normalizedApiPath}" ` + `final key "${finalKey}" with a new function.`
					);
				}
			}
			currentTarget[finalKey] = newModules;
			currentBoundTarget[finalKey] = newModules;
		} else if (typeof newModules === "object" && newModules !== null) {
			// Validate existing target is compatible (object or function, not primitive)
			if (Object.prototype.hasOwnProperty.call(currentTarget, finalKey)) {
				const existing = currentTarget[finalKey];

				// Check if overwrites are disabled and target already has content
				if (this.config.allowApiOverwrite === false && existing !== undefined && existing !== null) {
					// For objects, check if they have any keys (non-empty)
					const hasContent = typeof existing === "object" ? Object.keys(existing).length > 0 : true;
					if (hasContent) {
						console.warn(
							`[slothlet] Skipping addApi merge: API path "${normalizedApiPath}" final key "${finalKey}" ` +
								`already exists with content (type: "${typeof existing}"). Set allowApiOverwrite: true to allow merging.`
						);
						return; // Skip the merge
					}
				}

				if (existing !== null && typeof existing !== "object" && typeof existing !== "function") {
					throw new Error(
						`[slothlet] Cannot merge API at "${normalizedApiPath}": ` +
							`existing value at final key "${finalKey}" is type "${typeof existing}", cannot merge into primitives.`
					);
				}
			}
			if (Object.prototype.hasOwnProperty.call(currentBoundTarget, finalKey)) {
				const existingBound = currentBoundTarget[finalKey];
				if (existingBound !== null && typeof existingBound !== "object" && typeof existingBound !== "function") {
					throw new Error(
						`[slothlet] Cannot merge bound API at "${normalizedApiPath}": ` +
							`existing value at final key "${finalKey}" is type "${typeof existingBound}", cannot merge into primitives.`
					);
				}
			}

			// If target doesn't exist, create it
			if (!currentTarget[finalKey]) {
				currentTarget[finalKey] = {};
			}
			if (!currentBoundTarget[finalKey]) {
				currentBoundTarget[finalKey] = {};
			}

			// Merge new modules into existing object
			// Note: Object.assign performs shallow merge, which is intentional here.
			// We want to preserve references to the actual module exports, including
			// proxies (lazy mode) and function references (eager mode). Deep cloning
			// would break these references and lose the proxy/function behavior.
			Object.assign(currentTarget[finalKey], newModules);
			Object.assign(currentBoundTarget[finalKey], newModules);
		} else if (newModules === null || newModules === undefined) {
			// Warn when loaded modules result in null or undefined
			const receivedType = newModules === null ? "null" : "undefined";
			console.warn(
				`[slothlet] addApi: No modules loaded from folder at API path "${normalizedApiPath}". ` +
					`Loaded modules resulted in ${receivedType}. Check that the folder contains valid module files.`
			);
		} else {
			// Handle primitive values (string, number, boolean, symbol, bigint)
			// Set them directly like functions
			currentTarget[finalKey] = newModules;
			currentBoundTarget[finalKey] = newModules;
		}

		// Update live bindings to reflect the changes
		this.updateBindings(this.context, this.reference, this.boundapi);

		if (this.config.debug) {
			console.log(`[DEBUG] addApi: Successfully added modules at ${normalizedApiPath}`);
		}
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

	/**
	 * Execute a function with per-request context data.
	 *
	 * @function run
	 * @memberof module:@cldmv/slothlet
	 * @param {object} contextData - Context data to merge with instance context
	 * @param {Function} callback - Function to execute with the merged context
	 * @param {...any} args - Additional arguments to pass to the callback
	 * @returns {any} The result of the callback function
	 * @public
	 */
	run(contextData, callback, ...args) {
		if (this.config.scope?.enabled === false) {
			throw new Error("Per-request context (scope) is disabled for this instance.");
		}

		if (typeof callback !== "function") {
			throw new TypeError("Callback must be a function.");
		}

		const runtimeType = this.config.runtime || "async";
		let requestALS;
		if (runtimeType === "async") {
			return import("./lib/runtime/runtime-asynclocalstorage.mjs").then((asyncRuntime) => {
				requestALS = asyncRuntime.requestALS;
				const parentContext = requestALS.getStore() || {};

				let mergedContext;
				if (this.config.scope?.merge === "deep") {
					const instanceContext = this.context || {};
					let temp = this._deepMerge({}, instanceContext);
					temp = this._deepMerge(temp, parentContext);
					mergedContext = this._deepMerge(temp, contextData);
				} else {
					mergedContext = { ...parentContext, ...contextData };
				}

				return requestALS.run(mergedContext, () => callback(...args));
			});
		} else {
			return import("./lib/runtime/runtime-livebindings.mjs").then((liveRuntime) => {
				requestALS = liveRuntime.requestALS;
				const parentContext = requestALS.getStore() || {};

				let mergedContext;
				if (this.config.scope?.merge === "deep") {
					const instanceContext = this.context || {};
					let temp = this._deepMerge({}, instanceContext);
					temp = this._deepMerge(temp, parentContext);
					mergedContext = this._deepMerge(temp, contextData);
				} else {
					mergedContext = { ...parentContext, ...contextData };
				}

				return requestALS.run(mergedContext, () => callback(...args));
			});
		}
	},

	/**
	 * Execute a function with per-request context data (structured API).
	 *
	 * @function scope
	 * @memberof module:@cldmv/slothlet
	 * @param {object} options - Configuration object
	 * @param {object} options.context - Context data to merge with instance context
	 * @param {Function} options.fn - Function to execute with the merged context
	 * @param {Array} [options.args] - Optional array of arguments to pass to the function
	 * @returns {any} The result of the function execution
	 * @public
	 */
	scope({ context, fn, args }) {
		if (this.config.scope?.enabled === false) {
			throw new Error("Per-request context (scope) is disabled for this instance.");
		}

		if (!context || typeof context !== "object") {
			throw new TypeError("context must be an object.");
		}

		if (typeof fn !== "function") {
			throw new TypeError("fn must be a function.");
		}

		const runtimeType = this.config.runtime || "async";
		let requestALS;
		if (runtimeType === "async") {
			return import("./lib/runtime/runtime-asynclocalstorage.mjs").then((asyncRuntime) => {
				requestALS = asyncRuntime.requestALS;
				const parentContext = requestALS.getStore() || {};

				let mergedContext;
				if (this.config.scope?.merge === "deep") {
					const instanceContext = this.context || {};
					let temp = this._deepMerge({}, instanceContext);
					temp = this._deepMerge(temp, parentContext);
					mergedContext = this._deepMerge(temp, context);
				} else {
					mergedContext = { ...parentContext, ...context };
				}

				const argsArray = args || [];
				return requestALS.run(mergedContext, () => fn(...argsArray));
			});
		} else {
			return import("./lib/runtime/runtime-livebindings.mjs").then((liveRuntime) => {
				requestALS = liveRuntime.requestALS;
				const parentContext = requestALS.getStore() || {};

				let mergedContext;
				if (this.config.scope?.merge === "deep") {
					const instanceContext = this.context || {};
					let temp = this._deepMerge({}, instanceContext);
					temp = this._deepMerge(temp, parentContext);
					mergedContext = this._deepMerge(temp, context);
				} else {
					mergedContext = { ...parentContext, ...context };
				}

				const argsArray = args || [];
				return requestALS.run(mergedContext, () => fn(...argsArray));
			});
		}
	},

	/**
	 * Deep merge two objects recursively.
	 *
	 * @function _deepMerge
	 * @memberof module:@cldmv/slothlet
	 * @param {object} target - Target object
	 * @param {object} source - Source object
	 * @returns {object} Merged object
	 * @private
	 */
	_deepMerge(target, source) {
		if (!source || typeof source !== "object" || Array.isArray(source)) {
			return source;
		}

		for (const key in source) {
			if (Object.prototype.hasOwnProperty.call(source, key)) {
				const sourceValue = source[key];
				const targetValue = target[key];

				if (sourceValue && typeof sourceValue === "object" && !Array.isArray(sourceValue)) {
					target[key] = this._deepMerge(
						targetValue && typeof targetValue === "object" && !Array.isArray(targetValue) ? targetValue : {},
						sourceValue
					);
				} else {
					target[key] = sourceValue;
				}
			}
		}

		return target;
	},

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

				// Clean up hook manager to prevent listener leaks
				if (this.hookManager) {
					this.hookManager.cleanup();
					this.hookManager = null;
				}

				// Runtime cleanup handled by individual runtime modules

				// Clean up instance data for live bindings runtime
				if (this.instanceId) {
					await cleanupInstance(this.instanceId);
				}

				// Clean up global EventEmitter patching to prevent hanging AsyncResource instances
				// Note: This is a global operation that affects all EventEmitters
				try {
					// First clean up all slothlet-created listeners
					cleanupAllSlothletListeners();
					// Then disable the patching system
					disableAlsForEventEmitters();
				} catch (cleanupError) {
					// Log but don't fail shutdown for cleanup errors
					console.warn("[slothlet] Warning: EventEmitter cleanup failed:", cleanupError.message);
				}

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
function mutateLiveBindingFunction(target, source) {
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
		// Attach new properties/methods (enumerable API endpoints)
		for (const [key, value] of Object.entries(source)) {
			if (key !== "__ctx") {
				target[key] = value;
			}
		}
		// Manually copy management methods (may be non-enumerable)
		const managementMethods = ["shutdown", "addApi", "describe"];
		for (const method of managementMethods) {
			const desc = Object.getOwnPropertyDescriptor(source, method);
			if (desc) {
				try {
					Object.defineProperty(target, method, desc);
				} catch {
					// ignore
				}
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
 * @property {boolean} [lazy=false] - Loading strategy (legacy option):
 *   - `true`: Lazy loading - modules loaded on-demand when accessed (lower initial load, proxy overhead)
 *   - `false`: Eager loading - all modules loaded immediately (default, higher initial load, direct access)
 * @property {string} [mode] - Loading mode (alternative to lazy option):
 *   - `"lazy"`: Lazy loading - modules loaded on-demand when accessed (same as lazy: true)
 *   - `"eager"`: Eager loading - all modules loaded immediately (same as lazy: false)
 *   - `"singleton"`, `"vm"`, `"worker"`, `"fork"`: Execution engine mode (legacy, use engine option instead)
 *   - Takes precedence over lazy option when both are provided
 * @property {string} [engine=singleton] - Execution environment mode:
 *   - `"singleton"`: Single shared instance within current process (default, fastest)
 *   - `"vm"`: Isolated VM context for security/isolation
 *   - `"worker"`: Web Worker or Worker Thread execution
 *   - `"fork"`: Child process execution for complete isolation
 * @property {string} [runtime=async] - Runtime binding system:
 *   - `"async"` or `"asynclocalstorage"`: Use AsyncLocalStorage for context isolation (default, recommended)
 *   - `"live"` or `"livebindings"`: Use live binding system for dynamic context updates
 *   - Controls how `self`, `context`, and `reference` bindings are managed across function calls
 * @property {number} [apiDepth=Infinity] - Directory traversal depth control:
 *   - `Infinity`: Traverse all subdirectories recursively (default)
 *   - `0`: Only load files in root directory, no subdirectories
 *   - `1`, `2`, etc.: Limit traversal to specified depth levels
 * @property {boolean} [debug=false] - Debug output control:
 *   - `true`: Enable verbose logging for module loading, API construction, and binding operations
 *   - `false`: Silent operation (default)
 *   - Can be set via command line flag `--slothletdebug`, environment variable `SLOTHLET_DEBUG=true`, or options parameter
 *   - Command line and environment settings become the default for all instances unless overridden
 * @property {string} [api_mode=auto] - API structure and calling convention:
 *   - `"auto"`: Auto-detect based on root module exports (function vs object) - recommended (default)
 *   - `"function"`: Force API to be callable as function with properties attached
 *   - `"object"`: Force API to be plain object with method properties
 * @property {boolean} [allowApiOverwrite=true] - Controls whether addApi can overwrite existing API endpoints:
 *   - `true`: Allow overwrites (default, backwards compatible)
 *   - `false`: Prevent overwrites, log warning and skip when attempting to overwrite existing endpoints
 *   - Applies to both function and object overwrites at the final key of the API path
 * @property {object} [context={}] - Context data object injected into live-binding `context` reference.
 *   - Available to all loaded modules via `import { context } from "@cldmv/slothlet/runtime"`. Useful for request data,
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

/**
 * @typedef {object} SlothletAPI
 * @property {() => Promise<void>} shutdown - Shuts down the API instance and cleans up all resources
 * @property {(apiPath: string, folderPath: string) => Promise<void>} addApi - Dynamically adds API modules from a folder to a specified API path
 * @property {(showAll?: boolean) => ((string|symbol)[]|object|Promise<object>)} describe - Returns metadata about the current API instance configuration. In lazy mode with showAll=false, returns an array of property keys. In lazy mode with showAll=true, returns a Promise resolving to an object. In eager mode, returns a plain object.
 */
