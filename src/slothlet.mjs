/**
 *	@Project: @cldmv/slothlet
 *	@Filename: /src/slothlet.mjs
 *	@Date: 2025-10-16 13:48:46 -07:00 (1760647726)
 *	@Author: Nate Hyson <CLDMV>
 *	@Email: <Shinrai@users.noreply.github.com>
 *	-----
 *	@Last modified by: Nate Hyson <CLDMV> (Shinrai@users.noreply.github.com)
 *	@Last modified time: 2025-11-04 20:45:25 -08:00 (1762317925)
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
import { types as utilTypes } from "node:util";
import { fileURLToPath, pathToFileURL } from "node:url";

import { resolvePathFromCaller } from "@cldmv/slothlet/helpers/resolve-from-caller";
import { sanitizePathName } from "@cldmv/slothlet/helpers/sanitize";
import {
	analyzeModule,
	processModuleFromAnalysis,
	getCategoryBuildingDecisions,
	buildCategoryDecisions
} from "@cldmv/slothlet/helpers/api_builder";

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
	config: { lazy: false, apiDepth: Infinity, debug: DEBUG, dir: null, sanitize: null },
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

		// Generate unique instance ID for cache isolation between different slothlet instances
		this.instanceId = `slothlet_${Date.now()}_${Math.random().toString(36).slice(2, 11)}`;

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

		// Default entry is THIS module, which re-exports `slothlet`
		// const { entry = import.meta.url, mode = "vm" } = options ?? {};
		const { entry = import.meta.url, mode = "singleton", api_mode = "auto" } = options ?? {};

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

			// Store sanitize options in config for use by _toapiPathKey
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

		if (this.loaded) return this.api;
		if (this.config.lazy) {
			this.api = await this.modes.lazy.create.call(this, apiDir, this.config.apiDepth || Infinity, 0);
		} else {
			this.api = await this.modes.eager.create.call(this, apiDir, this.config.apiDepth || Infinity, 0);
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
	 * @memberof module:@cldmv/slothlet
	 * @param {string} name - The name to convert
	 * @returns {string} The camelCase version of the name
	 * @private
	 * @internal
	 * @example
	 * _toapiPathKey('root-math') // 'rootMath'
	 */
	_toapiPathKey(name) {
		return sanitizePathName(name, this.config.sanitize || {});
		// return name.replace(/-([a-zA-Z0-9])/g, (_, c) => c.toUpperCase());
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

		// Use centralized category building decisions
		const decisions = await buildCategoryDecisions(categoryPath, {
			currentDepth,
			maxDepth,
			mode,
			subdirHandler,
			instance: this
		});

		// SINGLE FILE CASE
		if (decisions.type === "single-file") {
			const { singleFile } = decisions;
			const { mod, moduleName } = singleFile;

			// Handle flattening based on centralized decisions
			if (decisions.shouldFlatten) {
				switch (decisions.flattenType) {
					case "function-folder-match":
					case "default-function":
						try {
							Object.defineProperty(mod, "name", { value: decisions.preferredName, configurable: true });
						} catch {
							// ignore
						}
						return mod;

					case "default-export-flatten":
						// Return the module directly - it already has the default object contents spread with named exports
						return mod;

					case "object-auto-flatten":
						// Return the contents of the named export directly (flatten it)
						return mod[decisions.preferredName];

					case "parent-level-flatten": {
						// Return an object with the export name as key, promoting it to parent level
						const exportValue = mod[Object.keys(mod).filter((k) => k !== "default")[0]];
						return { [decisions.preferredName]: exportValue };
					}

					case "filename-folder-match-flatten":
						// Return the module directly to avoid double nesting (e.g., nest/nest.mjs -> nest.alpha, not nest.nest.alpha)
						return mod;
				}
			}

			// Handle preferred name without flattening
			if (decisions.preferredName && decisions.preferredName !== moduleName) {
				return { [decisions.preferredName]: mod };
			}

			// Default case: return as namespace
			return { [moduleName]: mod };
		}

		// MULTI-FILE CASE
		const categoryModules = {};
		const { categoryName, processedModules, subdirectoryDecisions } = decisions;

		// Process each module based on centralized decisions
		for (const moduleDecision of processedModules) {
			const { moduleName, mod, type, apiPathKey, shouldFlatten, flattenType, specialHandling, processedExports } = moduleDecision;
			// Handle different module types based on centralized decisions
			if (specialHandling === "category-merge") {
				// Module filename matches category name - merge logic
				if (
					Object.prototype.hasOwnProperty.call(mod, categoryName) &&
					typeof mod[categoryName] === "object" &&
					mod[categoryName] !== null
				) {
					Object.assign(categoryModules, mod[categoryName]);
					for (const [key, value] of Object.entries(mod)) {
						if (key !== categoryName) categoryModules[this._toapiPathKey(key)] = value;
					}
				} else {
					Object.assign(categoryModules, mod);
				}
			} else if (type === "function") {
				// Function handling with appropriate naming
				if (specialHandling === "multi-default-filename") {
					try {
						Object.defineProperty(mod, "name", { value: moduleName, configurable: true });
					} catch {
						// ignore
					}
					categoryModules[moduleName] = mod;
				} else if (specialHandling === "prefer-function-name") {
					categoryModules[apiPathKey] = mod;
				} else {
					// Standard function processing
					categoryModules[apiPathKey] = mod;
				}
			} else if (type === "self-referential") {
				// Self-referential case: use the named export directly to avoid nesting
				categoryModules[moduleName] = mod[moduleName] || mod;
			} else if (type === "object") {
				// Object/named exports handling
				if (specialHandling === "preferred-export-names") {
					Object.assign(categoryModules, processedExports);
				} else if (shouldFlatten) {
					switch (flattenType) {
						case "single-default-object": {
							// Flatten the default export and merge named exports
							// Special handling for Proxy objects: don't use spread operator which breaks custom handlers
							let flattened;

							// Check if mod.default is likely a Proxy with custom behavior
							const defaultExport = mod.default;
							const hasNamedExports = Object.keys(mod).some((k) => k !== "default");

							if (hasNamedExports && defaultExport && typeof defaultExport === "object") {
								// Use Node.js built-in proxy detection for reliable detection
								const isProxy = utilTypes?.isProxy?.(defaultExport) ?? false;

								if (isProxy) {
									// Preserve Proxy object and add named exports
									flattened = defaultExport;
									let assignmentFailed = false;
									// Use Map from the start to avoid array-to-Map conversion overhead
									const failedMap = new Map();

									// Try to add named exports directly to the proxy
									for (const [key, value] of Object.entries(mod)) {
										if (key !== "default") {
											try {
												flattened[key] = value;
											} catch (e) {
												// Track assignment failure
												assignmentFailed = true;
												failedMap.set(key, value);
												if (this.config?.debug) {
													console.warn(
														`Could not assign '${key}' to proxy object in module '${moduleName}' at '${categoryPath}':`,
														e.message
													);
												}
											}
										}
									}

									// If any assignments failed, create a wrapper proxy to ensure named exports are accessible
									if (assignmentFailed) {
										// DOUBLE-PROXY LAYER JUSTIFICATION:
										// This creates a wrapper around the original proxy because direct property assignment
										// failed (e.g., LGTVControllers proxy with custom setters that reject certain properties).
										// The double-proxy approach is necessary because:
										// 1. We can't modify the original proxy's behavior without breaking its intended functionality
										// 2. Some proxies (like LGTVControllers) have custom get/set handlers that conflict with property assignment
										// 3. The wrapper provides a "fallback layer" that ensures API completeness while preserving original proxy behavior
										// 4. Performance impact is minimal since this only occurs when assignment fails, not in normal operation
										const originalProxy = flattened;
										flattened = new Proxy(originalProxy, {
											get(target, prop, receiver) {
												// Check failed assignments first
												if (failedMap.has(prop)) return failedMap.get(prop);

												// Fallback to original proxy
												return Reflect.get(target, prop, receiver);
											},
											has(target, prop) {
												// Include failed assignments in has checks
												if (failedMap.has(prop)) return true;
												return Reflect.has(target, prop);
											},
											ownKeys(target) {
												const originalKeys = Reflect.ownKeys(target);
												const failedKeys = Array.from(failedMap.keys());
												return [...new Set([...originalKeys, ...failedKeys])];
											},
											getOwnPropertyDescriptor(target, prop) {
												if (failedMap.has(prop)) {
													return { configurable: true, enumerable: true, value: failedMap.get(prop) };
												}
												return Reflect.getOwnPropertyDescriptor(target, prop);
											}
										});
									}
								} else {
									// Regular object, use spread operator
									flattened = { ...defaultExport };
									for (const [key, value] of Object.entries(mod)) {
										if (key !== "default") {
											flattened[key] = value;
										}
									}
								}
							} else {
								// No named exports or not an object, use as-is
								flattened = defaultExport;
							}

							categoryModules[apiPathKey] = flattened;
							break;
						}
						case "multi-default-no-default": {
							// Multi-default context: flatten modules WITHOUT default exports to category
							const moduleKeys = Object.keys(mod).filter((k) => k !== "default");
							for (const key of moduleKeys) {
								categoryModules[key] = mod[key];
							}
							break;
						}
						case "single-named-export-match":
							// Auto-flatten: module exports single named export matching filename
							categoryModules[apiPathKey] = mod[apiPathKey];
							break;
						case "category-name-match-flatten": {
							// Auto-flatten: module filename matches folder name and has no default → flatten to category
							const moduleKeys = Object.keys(mod).filter((k) => k !== "default");
							for (const key of moduleKeys) {
								categoryModules[key] = mod[key];
							}
							break;
						}
					}
				} else {
					// Standard object export
					categoryModules[apiPathKey] = mod;
				}
			}
		}

		// SUBDIRECTORIES - handle based on centralized decisions
		for (const subDirDecision of subdirectoryDecisions) {
			if (subDirDecision.shouldRecurse) {
				const { name, path: subDirPath, apiPathKey } = subDirDecision;
				let subModule;

				if (mode === "lazy" && typeof subdirHandler === "function") {
					subModule = subdirHandler({
						subDirEntry: { name },
						subDirPath,
						key: apiPathKey,
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
					subModule.name.toLowerCase() === apiPathKey.toLowerCase() &&
					subModule.name !== apiPathKey
				) {
					// Use the original function name as the key
					categoryModules[subModule.name] = subModule;
				} else {
					categoryModules[apiPathKey] = subModule;
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
		// Use centralized module loading logic
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
	 * Enhanced category builder using centralized decision logic.
	 * This is a test version that uses the decision functions to maintain the same behavior
	 * but with centralized logic that both eager and lazy modes can benefit from.
	 * @async
	 * @memberof module:@cldmv/slothlet
	 * @param {string} categoryPath
	 * @param {object} [options]
	 * @param {number} [options.currentDepth=0]
	 * @param {number} [options.maxDepth=Infinity]
	 * @param {'eager'|'lazy'} [options.mode='eager']
	 * @param {Function} [options.subdirHandler] - (ctx) => node; only used in lazy mode
	 * @returns {Promise<function|object>}
	 * @private
	 * @internal
	 */
	async _buildCategoryEnhanced(categoryPath, options = {}) {
		const { currentDepth = 0, maxDepth = Infinity, mode = "eager", subdirHandler } = options;

		// Get centralized building decisions
		const decisions = await getCategoryBuildingDecisions(categoryPath, {
			instance: this,
			currentDepth,
			maxDepth,
			debug: this.config.debug
		});

		const { processingStrategy, categoryName, processedModules, subDirectories } = decisions;

		// SINGLE FILE CASE - use the same logic as original but with decisions
		if (processingStrategy === "single-file" && processedModules.length === 1) {
			const { processedModule, flattening } = processedModules[0];

			if (flattening.shouldFlatten) {
				// Apply the flattening decision
				if (typeof processedModule === "function") {
					try {
						Object.defineProperty(processedModule, "name", { value: flattening.apiPathKey, configurable: true });
					} catch {
						// ignore
					}
				}
				return processedModule;
			}

			// No flattening - return as namespace
			return { [flattening.apiPathKey]: processedModule };
		}

		// MULTI-FILE CASE - use processed modules from decisions
		const categoryModules = {};

		for (const { processedModule, flattening } of processedModules) {
			categoryModules[flattening.apiPathKey] = processedModule;
		}

		// SUBDIRECTORIES - handle the same as original
		for (const { dirEntry: subDirEntry, apiPathKey: key } of subDirectories) {
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
				// Recursive call using enhanced version
				subModule = await this._buildCategoryEnhanced(subDirPath, {
					currentDepth: currentDepth + 1,
					maxDepth,
					mode: "eager"
				});
			}

			// Apply function name preference logic
			if (
				typeof subModule === "function" &&
				subModule.name &&
				subModule.name.toLowerCase() === key.toLowerCase() &&
				subModule.name !== key
			) {
				categoryModules[subModule.name] = subModule;
			} else {
				categoryModules[key] = subModule;
			}
		}

		// UPWARD FLATTENING - same logic as original
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
