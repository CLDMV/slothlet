/**
 *	@Project: @cldmv/slothlet
 *	@Filename: /src/slothlet.mjs
 *	@Date: 2026-02-06 10:12:46 -08:00 (1770401566)
 *	@Author: Nate Corcoran <CLDMV>
 *	@Email: <Shinrai@users.noreply.github.com>
 *	-----
 *	@Last modified by: Nate Corcoran <CLDMV> (Shinrai@users.noreply.github.com)
 *	@Last modified time: 2026-03-01 20:21:39 -08:00 (1772425299)
 *	-----
 *	@Copyright: Copyright (c) 2013-2026 Catalyzed Motivation Inc. All rights reserved.
 */

/**
 * @fileoverview Main Slothlet orchestrator
 * @module @cldmv/slothlet
 */
import { readdirSync } from "node:fs";
import { join } from "node:path";
import { pathToFileURL } from "node:url";
import { getContextManager } from "@cldmv/slothlet/factories/context";
import { SlothletError, SlothletWarning, SlothletDebug } from "@cldmv/slothlet/errors";
import { registerInstance } from "@cldmv/slothlet/handlers/lifecycle-token";
import { initI18n } from "@cldmv/slothlet/i18n";
import {
	enableEventEmitterPatching,
	disableEventEmitterPatching,
	cleanupEventEmitterResources,
	setApiContextChecker
} from "@cldmv/slothlet/helpers/eventemitter-context";

/**
 * Slothlet instance - clean architecture prototype
 * @private
 */
class Slothlet {
	// Reserved root-level API keys that should be skipped by recursive functions
	// Only applies at the root level (path depth 0) - nested keys with same name are allowed
	static RESERVED_ROOT_KEYS = ["slothlet", "shutdown", "destroy"];

	// Properties to skip during recursive operations (at any depth)
	static SKIP_PROPS = ["__metadata", "__type", "_materialize", "_impl", "____slothletInternal"];

	constructor() {
		// Expose error classes to components (no imports needed)
		this.SlothletError = SlothletError;
		this.SlothletWarning = SlothletWarning;
		// Debug logger will be initialized in load() with config
		this.debugLogger = null;

		// Instance properties
		this.instanceID = null;
		this.config = null;
		this.api = null;
		this.boundApi = null; // Created in load(), forwards to this.api
		this.contextManager = null;
		this.isLoaded = false;
		this.reference = null;
		this.context = null;

		// Lazy materialization tracking (for api.slothlet.materialize)
		this._totalLazyCount = 0; // Total lazy wrappers created
		this._unmaterializedLazyCount = 0; // Currently unmaterialized lazy wrappers
		this._materializationComplete = false; // Set to true when all lazy wrappers materialized
		this._materializationWaiters = []; // Promises waiting for full materialization
		this._materializationCompleteEmitted = false; // Track if event was already emitted

		// Component categories
		this.componentCategories = ["helpers", "handlers", "builders", "processors", "modes"];

		// Component namespaces (populated by _initializeComponents)
		for (const category of this.componentCategories) {
			this[category] = {};
		}
	}

	/**
	 * Initialize all component class instances via auto-discovery
	 * Organizes components into namespaces: helpers.*, handlers.*, builders.*, processors.*
	 * @private
	 */
	async _initializeComponents() {
		// Auto-discover helpers, handlers, builders, processors
		// NOTE: Does NOT auto-discover:
		//   - errors/ (throw-able classes, not instance components)
		//   - runtime/ (context managers set manually during load)
		//   - i18n/ (translation utilities, not instance components)

		const baseDir = join(import.meta.dirname, "lib");

		for (const category of this.componentCategories) {
			const categoryDir = join(baseDir, category);
			const files = readdirSync(categoryDir).filter((f) => f.endsWith(".mjs"));

			for (const file of files) {
				const filePath = join(categoryDir, file);

				try {
					const module = await import(pathToFileURL(filePath).href);

					// Find ALL exported classes with slothletProperty (supports multiple per file)
					const classExports = Object.values(module).filter((exp) => typeof exp === "function" && exp.slothletProperty);

					for (const ClassExport of classExports) {
						const propName = ClassExport.slothletProperty;
						// Organize into category namespace
						this[category][propName] = new ClassExport(this);

						if (this.config?.debug?.initialization) {
							this.debug("initialization", {
								key: "DEBUG_MODE_COMPONENT_INITIALIZED",
								component: ClassExport.name,
								category,
								propertyName: propName
							});
						}
					}
				} catch (error) {
					// Component file failed to import - this is fatal
					throw new this.SlothletError(
						"MODULE_IMPORT_FAILED",
						{
							modulePath: filePath
						},
						error
					);
				}
			}
		}
	}

	/**
	 * Set up lifecycle event subscribers for cross-system coordination
	 * @private
	 */
	_setupLifecycleSubscribers() {
		if (!this.handlers.lifecycle) {
			return; // Lifecycle handler not available
		}

		// Subscribe metadata system to impl:created and impl:changed events
		if (this.handlers.metadata) {
			this.handlers.lifecycle.subscribe("impl:created", (data, token) => {
				this.handlers.metadata.tagSystemMetadata(
					data.impl,
					{
						filePath: data.filePath,
						apiPath: data.apiPath,
						moduleID: data.moduleID,
						sourceFolder: data.sourceFolder
					},
					token
				);
			});

			this.handlers.lifecycle.subscribe("impl:changed", (data, token) => {
				this.handlers.metadata.tagSystemMetadata(
					data.impl,
					{
						filePath: data.filePath,
						apiPath: data.apiPath,
						moduleID: data.moduleID,
						sourceFolder: data.sourceFolder
					},
					token
				);
			});

			this.handlers.lifecycle.subscribe("impl:removed", (data) => {
				// Clean up user metadata for removed impl (use root segment only)
				if (data.apiPath) {
					const rootSegment = data.apiPath.split(".")[0];
					this.handlers.metadata.removeUserMetadataByApiPath(rootSegment);
				}
			});
		}

		// Subscribe ownership system to impl:created and impl:changed events
		if (this.handlers.ownership) {
			// Only register on impl:created, not impl:changed
			// This prevents duplicate registrations during replacement operations
			this.handlers.lifecycle.subscribe("impl:created", (data) => {
				// Get collision mode from config or use default
				const collisionMode = this.config?.collision?.api || "merge";
				// Store the actual _impl, not the wrapper, so it doesn't get corrupted by mutations
				const implValue = data.wrapper?.__impl ?? data.impl;
				this.handlers.ownership.register({
					moduleID: data.moduleID,
					apiPath: data.apiPath,
					value: implValue,
					source: data.source,
					filePath: data.filePath,
					collisionMode: collisionMode
				});
			});

			// Also subscribe to impl:changed for replacements (when wrapper already exists but impl changes)
			// This handles the case where a module replaces another module's impl
			this.handlers.lifecycle.subscribe("impl:changed", (data) => {
				// Get collision mode from config or use default
				const collisionMode = this.config?.collision?.api || "merge";
				// Store the actual _impl, not the wrapper, so it doesn't get corrupted by mutations
				const implValue = data.wrapper?.__impl ?? data.impl;

				// Only register if this moduleID doesn't already own this path
				// This prevents duplicate registrations from multiple impl:changed events
				const currentOwner = this.handlers.ownership.getCurrentOwner(data.apiPath);
				if (currentOwner?.moduleID !== data.moduleID) {
					this.handlers.ownership.register({
						moduleID: data.moduleID,
						apiPath: data.apiPath,
						value: implValue,
						source: data.source,
						filePath: data.filePath,
						collisionMode: collisionMode
					});
				}
			});
		}
	}

	/**
	 * Register a lazy wrapper for materialization tracking
	 * Called by UnifiedWrapper constructor when mode === "lazy"
	 * @private
	 */
	_registerLazyWrapper() {
		this._totalLazyCount++;
		this._unmaterializedLazyCount++;

		if (this.config?.debug?.materialize) {
			this.debug("materialize", {
				key: "DEBUG_MODE_LAZY_WRAPPER_REGISTERED",
				total: this._totalLazyCount,
				unmaterialized: this._unmaterializedLazyCount
			});
		}
	}

	/**
	 * Notify that a lazy wrapper has materialized
	 * Called by UnifiedWrapper._materialize() after materialization completes
	 * @private
	 */
	_onWrapperMaterialized() {
		this._unmaterializedLazyCount--;

		if (this.config?.debug?.materialize) {
			this.debug("materialize", {
				key: "DEBUG_MODE_LAZY_WRAPPER_MATERIALIZED",
				total: this._totalLazyCount,
				unmaterialized: this._unmaterializedLazyCount,
				percentage: this._totalLazyCount > 0 ? ((this._totalLazyCount - this._unmaterializedLazyCount) / this._totalLazyCount) * 100 : 100
			});
		}

		// Check if all lazy wrappers are materialized
		if (this._unmaterializedLazyCount === 0 && !this._materializationComplete) {
			this._materializationComplete = true;

			if (this.config?.debug?.materialize) {
				this.debug("materialize", {
					key: "DEBUG_MODE_ALL_LAZY_WRAPPERS_MATERIALIZED",
					total: this._totalLazyCount
				});
			}

			// Resolve all waiting promises
			const waiters = this._materializationWaiters.splice(0);
			for (const resolve of waiters) {
				resolve();
			}

			// Emit lifecycle event if tracking enabled and not already emitted
			if (this.config?.tracking?.materialization && !this._materializationCompleteEmitted) {
				this._materializationCompleteEmitted = true;
				if (this.handlers?.lifecycle) {
					this.handlers.lifecycle.emit("materialized:complete", {
						total: this._totalLazyCount,
						timestamp: Date.now()
					});
				}
			}
		}
	}

	/**
	 * Load API from directory
	 * @param {Object} config - Configuration options
	 * @param {string} config.dir - Directory to load API from
	 * @param {string} [config.mode="eager"] - Loading mode (eager or lazy)
	 * @param {string} [config.runtime="async"] - Runtime type (async or live)
	 * @param {string} [preservedInstanceID] - Optional instance ID to preserve (used by reload)
	 * @returns {Promise<Object>} Bound API object
	 * @public
	 * @example
	 * const slothlet = new Slothlet();
	 * const api = await slothlet.load({
	 *   dir: "./api_tests/api_test",
	 *   mode: "eager",
	 *   runtime: "async"
	 * });
	 */
	async load(config = {}, preservedInstanceID = null) {
		// Store raw config for components to access if needed
		this.config = config;

		// Early-init debug logger with raw config so that debug.initialization messages
		// produced inside _initializeComponents() are visible even before transformConfig runs.
		// Will be re-initialised below with the fully normalised config.
		this.debugLogger = new SlothletDebug(config);

		// Initialize all components via auto-discovery BEFORE transforming config
		// This allows config helpers to be component classes
		await this._initializeComponents();

		// Register per-instance lifecycle capability token (must be before any tagSystemMetadata calls)
		registerInstance(this);

		// Set up lifecycle event subscribers for cross-system coordination
		this._setupLifecycleSubscribers();

		// Transform and validate config using component classes
		this.config = this.helpers.config.transformConfig(config);

		// Apply i18n configuration (dev-facing; process-global)
		if (this.config?.i18n?.language) {
			initI18n({ language: this.config.i18n.language });
		}

		// Re-initialise debug logger with the fully normalised config (includes all flags).
		// This replaces the early-init created above and ensures post-transform flags are active.
		this.debugLogger = new SlothletDebug(this.config);

		// Use preserved instance ID (from reload) or generate new one
		this.instanceID = preservedInstanceID || this.helpers.utilities.generateId();

		// Store reference and context from config
		this.reference = this.config.reference;
		this.context = this.config.context;

		// Get appropriate context manager based on runtime
		this.contextManager = getContextManager(this.config.runtime);

		// Set up EventEmitter tracking to use the correct runtime context
		setApiContextChecker(() => {
			const ctx = this.contextManager.tryGetContext();
			return !!(ctx && ctx.self);
		});

		// Initialize context (or reuse existing if preservedInstanceID provided)
		let store;
		// contextManager is always freshly created above (line 343), so instances is always
		// empty here regardless of preservedInstanceID — always do a fresh initialize.
		store = this.contextManager.initialize(this.instanceID, this.config);

		// Enable EventEmitter context patching (once globally, safe to call multiple times)
		// This ensures EventEmitter callbacks preserve AsyncLocalStorage context
		enableEventEmitterPatching();

		// Register context checker for EventEmitter tracking (must be after patching)
		if (typeof this.contextManager.registerEventEmitterContextChecker === "function") {
			this.contextManager.registerEventEmitterContextChecker();
		}

		// Note: ownership manager and hook manager already initialized via auto-discovery

		// Generate base moduleID for ownership tracking
		const baseModuleId = `base_${this.helpers.utilities.generateId().substring(0, 8)}`;

		// Build raw API (with context manager and instance ID for unified wrapper)
		// UnifiedWrapper handles context binding internally - no separate wrapper needed!
		const baseApi = await this.builders.builder.buildAPI({
			dir: this.config.dir,
			mode: this.config.mode,
			moduleID: baseModuleId
		});

		// Temporarily assign baseApi to this.api for buildFinalAPI
		// (buildFinalAPI mutates this.api in place by adding builtins)
		this.api = baseApi;

		// Build final API with builtins attached (mutates this.api in place)
		const apiWithBuiltins = await this.buildFinalAPI(this.api);

		// NOW store in cache AFTER builtins are attached
		// Cache stores the complete API tree with builtins
		if (this.handlers.apiCacheManager) {
			this.handlers.apiCacheManager.set(baseModuleId, {
				endpoint: ".",
				moduleID: baseModuleId,
				api: this.api, // Store complete API with builtins
				folderPath: this.config.dir,
				mode: this.config.mode,
				sanitizeOptions: this.config.sanitize || {},
				collisionMode: this.config.collision?.api || "merge",
				config: { ...this.config },
				timestamp: Date.now()
			});
		}

		// Inject runtime-aware metadata functions that have proper context access
		this.injectRuntimeMetadataFunctions(apiWithBuiltins);

		// Apply init metadata if provided in config
		if (this.config.metadata && typeof this.config.metadata === "object") {
			// Set as global metadata so it's inherited by all future api.add() calls
			for (const [key, value] of Object.entries(this.config.metadata)) {
				this.handlers.metadata.setGlobalMetadata(key, value);
			}

			// Register user metadata for base moduleID
			this.handlers.metadata.registerUserMetadata(baseModuleId, this.config.metadata);
		}

		// Register all API paths with ownership manager AFTER building final API
		// This ensures builtins (slothlet, shutdown, destroy) are also registered
		if (this.handlers.ownership) {
			this.handlers.ownership.registerSubtree(apiWithBuiltins, baseModuleId, "");
		}

		// Note: apiWithBuiltins IS this.api (buildFinalAPI now mutates in place, no clone)
		// this.api already has builtins attached from buildFinalAPI

		// Create boundApi proxy if first load (preserves reference across reloads)
		if (!this.boundApi) {
			// Determine proxy target type based on this.api (like UnifiedWrapper does)
			const isCallable = typeof this.api === "function" || (this.api && typeof this.api.default === "function");
			const proxyTarget = isCallable ? function () {} : {};

			this.boundApi = new Proxy(proxyTarget, {
				get: (target, prop) => (this.api ? this.api[prop] : undefined),
				set: (target, prop, value) => {
					if (this.api) {
						this.api[prop] = value;
					}
					return true;
				},
				has: (target, prop) => (this.api ? prop in this.api : false),
				ownKeys: (target) => (this.api ? Reflect.ownKeys(this.api) : []),
				deleteProperty: (target, prop) => (this.api ? delete this.api[prop] : true),
				apply: (target, thisArg, args) => (this.api ? Reflect.apply(this.api, thisArg, args) : undefined),
				construct: (target, args) => (this.api ? Reflect.construct(this.api, args) : {}),
				getOwnPropertyDescriptor: (target, prop) => {
					// Return actual descriptor for 'prototype' on function targets to satisfy proxy invariants
					if (isCallable && prop === "prototype") {
						return Object.getOwnPropertyDescriptor(target, prop);
					}
					if (this.api && prop in this.api) {
						const desc = Object.getOwnPropertyDescriptor(this.api, prop);
						if (desc) {
							return { ...desc, configurable: true };
						}
					}
					return undefined;
				}
			});
		}

		// Set self and context in store
		store.self = this.boundApi;
		store.context = this.context || {}; // User-provided context from config

		// TODO: Merge reference object using add API system for ownership tracking
		// For now, directly assign to boundApi (will be replaced with proper add API)
		if (this.reference && typeof this.reference === "object") {
			Object.assign(this.boundApi, this.reference);
		}

		this.isLoaded = true;

		return this.boundApi;
	}

	/**
	 * Reload entire instance (fresh load with preserved instance ID)
	 * @public
	 *
	 * @description
	 * Reloads all modules in the API by clearing caches and doing a fresh load().
	 * Preserves instance ID (so context is maintained), hooks, and API reference.
	 * Replays all add/remove operations in chronological order.
	 *
	 * @example
	 * // Reload all modules to pick up code changes
	 * await api.slothlet.reload();
	 */
	async reload() {
		// Allow reload from shutdown state as long as config was previously loaded.
		// Reject only if the instance was never loaded at all (no config.dir).
		if (!this.config?.dir) {
			throw new SlothletError("INVALID_CONFIG_NOT_LOADED", {
				operation: "reload",
				validationError: true
			});
		}

		// 1. Save operation history from api-manager for replay
		const operationHistory = this.handlers.apiManager?.state?.operationHistory ? [...this.handlers.apiManager.state.operationHistory] : [];

		// 2. Clear CommonJS module caches to force re-import
		await this._clearModuleCaches();

		// 3. Create a NEW permanent instanceID (busts internal caches; the old ID is
		//    cleaned up after load so stale ALS/context entries don't accumulate).
		const oldInstanceID = this.instanceID;
		this.instanceID = `${oldInstanceID}_reload_${Date.now()}`;

		// 3b. Save user-managed metadata state before load() destroys the current
		//     Metadata instance. This preserves setGlobal() and set() values across reload.
		const savedMetadataState = this.handlers.metadata?.exportUserState?.();

		// 3c. Save hook registrations before load() destroys the current HookManager.
		//     This preserves hook.on() registrations across full reload.
		const savedHooks = this.handlers.hookManager?.exportHooks?.();

		// 4. Do a FRESH load() with the new permanent instanceID
		await this.load(this.config, this.instanceID);

		// 4b. Restore saved metadata state into the new Metadata instance, BEFORE
		//     replay so that registerUserMetadata() from replay merges over it correctly.
		if (savedMetadataState && this.handlers.metadata) {
			this.handlers.metadata.importUserState(savedMetadataState);
		}

		// 4c. Restore hook registrations into the new HookManager instance.
		if (savedHooks?.length && this.handlers.hookManager) {
			this.handlers.hookManager.importHooks(savedHooks);
		}

		// 5. Reparent any child __run_ context stores that were created before reload.
		//    Their parentInstanceID points to the old base instanceID; updating it lets
		//    context.get() still find them for callers that call reload() inside a .run() scope.
		for (const [, store] of this.contextManager.instances) {
			if (store.parentInstanceID === oldInstanceID) {
				store.parentInstanceID = this.instanceID;
			}
		}

		// 6. Clean up the old base context store now that the new one is active.
		//    Guard with .has() because shutdown() may have already removed the store.
		if (oldInstanceID && oldInstanceID !== this.instanceID && this.contextManager.instances?.has(oldInstanceID)) {
			this.contextManager.cleanup(oldInstanceID);
		}

		// 6. Replay operation history in chronological order
		for (const operation of operationHistory) {
			if (operation.type === "add") {
				await this.handlers.apiManager.addApiComponent({
					apiPath: operation.apiPath,
					folderPath: operation.folderPath,
					options: { ...(operation.options || {}), recordHistory: false },
					moduleID: `replay_${this.helpers.utilities.generateId().substring(0, 8)}` // Generate new moduleID for replay
				});
			} else if (operation.type === "remove") {
				// During replay, operation.apiPath is the root path (e.g., "path1").
				// Use deletePath directly to remove the entire subtree.
				const { parts } = this.handlers.apiManager.normalizeApiPath(operation.apiPath);
				this.handlers.apiManager.deletePath(this.api, parts);
				// Clean up metadata
				if (this.handlers.metadata) {
					const rootSegment = operation.apiPath.split(".")[0];
					this.handlers.metadata.removeUserMetadataByApiPath(rootSegment);
				}
			}
		}

		return this.boundApi;
	}

	/**
	 * Clear Node.js module caches for reloading
	 * @private
	 */
	async _clearModuleCaches() {
		// Clear CommonJS require cache
		// Only clear modules from the configured dir to avoid breaking dependencies
		const targetDir = this.config.dir;
		const { resolve } = await import("node:path");
		const { createRequire } = await import("node:module");
		const require = createRequire(import.meta.url);
		const absoluteTargetDir = resolve(targetDir);

		// Clear require.cache for CJS modules
		for (const key of Object.keys(require.cache)) {
			if (key.startsWith(absoluteTargetDir)) {
				delete require.cache[key];
			}
		}

		// ESM modules are cached by URL and can't be cleared directly
		// The loadModule will handle cache-busting via query params for ESM
	}

	/**
	 * Inject runtime-aware metadata functions into api.slothlet.metadata
	 * These functions use the context manager to access current execution context
	 * @param {Object} api - API object with slothlet namespace
	 * @private
	 */
	injectRuntimeMetadataFunctions(api) {
		if (!api.slothlet?.metadata) {
			return;
		}

		const metadataHandler = this.handlers.metadata;

		// Delegate to Metadata class methods — all logic lives in metadata.mjs
		api.slothlet.metadata.get = async function slothlet_metadata_get_runtime(path) {
			return metadataHandler.get(path);
		};

		api.slothlet.metadata.self = function slothlet_metadata_self_runtime() {
			return metadataHandler.self();
		};

		api.slothlet.metadata.caller = function slothlet_metadata_caller_runtime() {
			return metadataHandler.caller();
		};
	}

	/**
	 * Shutdown instance and cleanup resources
	 * @public
	 */
	async shutdown() {
		if (!this.isLoaded) {
			return;
		}

		// Disable EventEmitter patching and cleanup AsyncResources
		disableEventEmitterPatching();
		cleanupEventEmitterResources();

		// Cleanup context
		if (this.instanceID && this.contextManager) {
			this.contextManager.cleanup(this.instanceID);
		}

		// Clear ownership
		if (this.handlers.ownership) {
			this.handlers.ownership.clear();
		}

		// Mark as not loaded. Keep this.api intact so the boundApi proxy remains
		// usable after shutdown (e.g. double-shutdown no-ops, reload-after-shutdown works).
		this.isLoaded = false;
	}

	/**
	 * Log debug message if debug flag is enabled
	 * @param {string} code - Debug code/category
	 * @param {Object} context - Debug context
	 * @public
	 *
	 * @example
	 * this.slothlet.debug("wrapper", { apiPath: "math", action: "materialized" });
	 */
	debug(code, context = {}) {
		if (this.debugLogger) {
			this.debugLogger.log(code, context);
		}
	}

	/**
	 * Get current API
	 * @returns {Object} Bound API object
	 * @public
	 */
	getAPI() {
		if (!this.isLoaded) {
			throw new SlothletError(
				"INVALID_CONFIG_NOT_LOADED",
				{
					operation: "getAPI"
				},
				null,
				{ validationError: true }
			);
		}
		return this.boundApi;
	}

	/**
	 * Get diagnostic information
	 * @returns {Object} Diagnostic data
	 * @public
	 */
	getDiagnostics() {
		return {
			instanceID: this.instanceID,
			isLoaded: this.isLoaded,
			config: this.config,
			context: this.contextManager?.getDiagnostics() || null,
			ownership: this.handlers.ownership?.getDiagnostics() || null
		};
	}

	/**
	 * Get ownership information
	 * @returns {Object} Ownership data
	 * @public
	 */
	getOwnership() {
		if (!this.handlers.ownership) {
			return null;
		}
		return this.handlers.ownership.getDiagnostics();
	}

	/**
	 * Build final API with built-in methods attached
	 * @param {Object} userApi - Raw user API from load()
	 * @returns {Object} Final API with built-ins
	 * @private
	 */
	buildFinalAPI(userApi) {
		return this.builders.apiBuilder.buildFinalAPI(userApi);
	}
}

/**
 * Create new Slothlet instance and load API
 * Middleware function that delegates to Slothlet class
 * @param {Object} config - Configuration options
 * @returns {Promise<Object>} Bound API object with control methods
 * @public
 * @example
 * const api = await slothlet({ dir: "./api_tests/api_test" });
 * // Use API
 * const result = api.math.add(2, 3);
 * // Hot reload
 * await api.api.reload();
 * // Full reload
 * await api.reload();
 * // Shutdown when done
 * await api.api.shutdown();
 */
export async function slothlet(config) {
	const instance = new Slothlet();
	const api = await instance.load(config);

	// API already has builtins attached from load()
	return api;
}

export default slothlet;
