/**
 *	@Project: @cldmv/slothlet
 *	@Filename: /src/slothlet.mjs
 *	@Date: 2026-02-06 10:12:46 -08:00 (1770401566)
 *	@Author: Nate Corcoran <CLDMV>
 *	@Email: <Shinrai@users.noreply.github.com>
 *	-----
 *	@Last modified by: Nate Corcoran <CLDMV> (Shinrai@users.noreply.github.com)
 *	@Last modified time: 2026-03-08 19:49:51 -07:00 (1773024591)
 *	-----
 *	@Copyright: Copyright (c) 2013-2026 Catalyzed Motivation Inc. All rights reserved.
 */

/**
 * @fileoverview Slothlet — transform a directory of ESM/CJS/TypeScript files into a unified, proxy-based API object.
 * @module @cldmv/slothlet
 * @typicalname slothlet
 * @version 3.0.0
 * @author CLDMV/Shinrai
 * @public
 * @simpleName
 *
 * @description
 * Slothlet is a module-loading framework for Node.js (ESM-first) that scans a directory of source files
 * and assembles them into a single, cohesive API object with zero runtime dependencies.
 *
 * Key Features:
 * - Eager and lazy loading strategies with configurable traversal depth
 * - Proxy-based API object with hot-reload, dynamic add/remove, and ownership tracking
 * - AsyncLocalStorage-based per-request context isolation (or experimental live bindings)
 * - Declarative hook system for intercepting and modifying API calls
 * - TypeScript file support (esbuild fast mode or tsc strict mode)
 * - Collision handling with merge / replace / skip / warn / error modes
 * - Rich lifecycle events, metadata annotations, and diagnostics
 * - Full i18n support for all framework messages (11 languages)
 *
 * @example
 * // ESM default import (recommended)
 * import slothlet from "@cldmv/slothlet";
 *
 * const api = await slothlet({ dir: "./api" });
 * await api.math.add(2, 3);  // 5
 * await api.slothlet.shutdown();
 *
 * @example
 * // ESM named import
 * import { slothlet } from "@cldmv/slothlet";
 *
 * @example
 * // CommonJS require
 * const slothlet = require("@cldmv/slothlet");
 *
 * @example
 * // Lazy loading mode — modules loaded on first access
 * const api = await slothlet({ dir: "./api", mode: "lazy" });
 *
 * @example
 * // With per-request context isolation
 * const api = await slothlet({
 *   dir: "./api",
 *   context: { db, logger },
 *   runtime: "async"
 * });
 *
 * // Inside an API module, access context via:
 * // import { context } from "@cldmv/slothlet/runtime";
 *
 * @example
 * // With hook interception
 * const api = await slothlet({ dir: "./api", hook: true });
 * api.slothlet.hook.on("before", "math.*", (endpoint, args) => {
 *   console.log("calling:", endpoint, args);
 * });
 *
 * @example
 * // Multiple independent instances
 * const api1 = await slothlet({ dir: "./api" });
 * const api2 = await slothlet({ dir: "./other-api" });
 *
 * @example
 * // Shutdown when done
 * await api.slothlet.shutdown();
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
					// unreachable via tests (2026-03-05): framework component files are always
					// present in the installed package; this guard exists for corrupt installs.
					/* v8 ignore next */
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
		// Defensive: lifecycle is always auto-registered via slothletProperty; return-guard unreachable.
		/* v8 ignore start */
		if (!this.handlers.lifecycle) {
			return; // Lifecycle handler not available
		}
		/* v8 ignore stop */

		// Subscribe metadata system to impl:created and impl:changed events
		// metadata is always auto-registered via slothletProperty; false arm unreachable.
		/* v8 ignore next */
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
				// impl:removed always provides data.apiPath; false arm is defensive dead code.
				/* v8 ignore next */
				if (data.apiPath) {
					const rootSegment = data.apiPath.split(".")[0];
					this.handlers.metadata.removeUserMetadataByApiPath(rootSegment);
				}
			});
		}

		// Subscribe ownership system to impl:created and impl:changed events
		// ownership is always auto-registered via slothletProperty; false arm unreachable.
		/* v8 ignore next */
		if (this.handlers.ownership) {
			// Only register on impl:created, not impl:changed
			// This prevents duplicate registrations during replacement operations
			this.handlers.lifecycle.subscribe("impl:created", (data) => {
				// Get collision mode from config or use default
				// config.collision.api is always set after normalization; "merge" fallback never reached.
				/* v8 ignore next */
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
				// config.collision.api is always set after normalization; "merge" fallback never reached.
				/* v8 ignore next */
				const collisionMode = this.config?.collision?.api || "merge";
				// Store the actual _impl, not the wrapper, so it doesn't get corrupted by mutations
				// data.wrapper.__impl is always set for impl:changed events; data.impl fallback is dead code.
				/* v8 ignore next */
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
				// _totalLazyCount is always > 0 when this callback fires (at least one wrapper was registered).
				/* v8 ignore next */
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
				// lifecycle is always auto-registered via slothletProperty; false arm unreachable.
				/* v8 ignore next */
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

		// Set up a generic fallback EventEmitter context checker. This callback body is
		// dead code in practice: both AsyncContextManager and LiveContextManager define
		// registerEventEmitterContextChecker(), which is called a few lines below and
		// immediately overwrites this checker via a second setApiContextChecker() call.
		// The callback is registered then discarded synchronously — no EventEmitter
		// activity occurs between these two calls, so lines below can never execute.
		// The callback is synchronously overwritten by registerEventEmitterContextChecker(); it can never execute.
		/* v8 ignore start */
		setApiContextChecker(() => {
			/* v8 ignore start */
			const ctx = this.contextManager.tryGetContext();
			return !!(ctx && ctx.self);
			/* v8 ignore stop */
		});
		/* v8 ignore stop */

		// Initialize context (or reuse existing if preservedInstanceID provided)
		let store;
		if (preservedInstanceID && this.contextManager.instances.has(preservedInstanceID)) {
			// Reload: DONT reuse store, delete old and create fresh
			this.contextManager.cleanup(preservedInstanceID);
			store = this.contextManager.initialize(this.instanceID, this.config);
		} else {
			// Fresh load: initialize new store
			store = this.contextManager.initialize(this.instanceID, this.config);
		}

		// Enable EventEmitter context patching (once globally, safe to call multiple times)
		// This ensures EventEmitter callbacks preserve AsyncLocalStorage context
		enableEventEmitterPatching();

		// Register context checker for EventEmitter tracking (must be after patching)
		// registerEventEmitterContextChecker is always defined in both context managers.
		/* v8 ignore next */
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
		// apiCacheManager is always auto-registered via slothletProperty; false arm unreachable.
		/* v8 ignore next */
		if (this.handlers.apiCacheManager) {
			this.handlers.apiCacheManager.set(baseModuleId, {
				endpoint: ".",
				moduleID: baseModuleId,
				api: this.api, // Store complete API with builtins
				folderPath: this.config.dir,
				mode: this.config.mode,
				sanitizeOptions: this.config.sanitize || {},
				// config.collision.api is always set after config normalization; "merge" fallback never reached.
				/* v8 ignore next */
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
		// ownership is always auto-registered via slothletProperty; false arm unreachable.
		/* v8 ignore next */
		if (this.handlers.ownership) {
			this.handlers.ownership.registerSubtree(apiWithBuiltins, baseModuleId, "");
		}

		// Note: apiWithBuiltins IS this.api (buildFinalAPI now mutates in place, no clone)
		// this.api already has builtins attached from buildFinalAPI

		// Create boundApi proxy if first load (preserves reference across reloads)
		if (!this.boundApi) {
			// V8 fork-pool coverage gaps with isCallable cond-expr; proxy trap null guards are defensive dead code.
			/* v8 ignore start */
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
				ownKeys: (____target) => (this.api ? Reflect.ownKeys(this.api) : []),
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
			/* v8 ignore stop */
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
	 * @param {Object} [options={}] - Reload options.
	 * @param {boolean} [options.keepInstanceID=false] - When true the existing instanceID is
	 *   reused instead of generating a new `_reload_` ID. This causes
	 *   `contextManager.instances.has(preservedInstanceID)` to be TRUE inside `load()`,
	 *   triggering the cleanup-then-reinitialise branch. Useful for testing and for callers
	 *   that need the context store reset in place rather than migrated to a new ID.
	 *
	 * @example
	 * // Normal hot-reload (new instanceID each time)
	 * await api.slothlet.reload();
	 *
	 * @example
	 * // Reload while resetting the context store in place (same instanceID)
	 * await api.slothlet.reload({ keepInstanceID: true });
	 */
	async reload(options = {}) {
		const { keepInstanceID = false } = options;

		// Allow reload from shutdown state as long as config was previously loaded.
		// Reject only if the instance was never loaded at all (no config.dir).
		if (!this.config?.dir) {
			throw new SlothletError("INVALID_CONFIG_NOT_LOADED", {
				operation: "reload",
				validationError: true
			});
		}

		// 1. Save operation history from api-manager for replay
		// apiManager.state.operationHistory is always a defined array; [] fallback is dead code.
		/* v8 ignore next */
		const operationHistory = this.handlers.apiManager?.state?.operationHistory ? [...this.handlers.apiManager.state.operationHistory] : [];

		// 2. Clear CommonJS module caches to force re-import
		await this._clearModuleCaches();

		// 3. Determine the instanceID to pass to load().
		//    Normal reload: create a fresh ID (busts internal caches; old ID cleaned up below).
		//    keepInstanceID: reuse the current ID so instances.has() is TRUE inside load(),
		//    which triggers the cleanup-then-reinitialise branch of the context store.
		const oldInstanceID = this.instanceID;
		if (!keepInstanceID) {
			this.instanceID = `${oldInstanceID}_reload_${Date.now()}`;
		}

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
		// savedMetadataState is always truthy (metadata always exports state); metadata handler always present.
		/* v8 ignore next */
		if (savedMetadataState && this.handlers.metadata) {
			this.handlers.metadata.importUserState(savedMetadataState);
		}

		// 4c. Restore hook registrations into the new HookManager instance.
		// savedHooks always has entries when exported after hooks are registered; hookManager always present.
		/* v8 ignore next */
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
					// operation.options is always provided during api.add() replay; {} fallback is dead code.
					/* v8 ignore next */
					options: { ...(operation.options || {}), recordHistory: false },
					moduleID: `replay_${this.helpers.utilities.generateId().substring(0, 8)}` // Generate new moduleID for replay
				});
				// All operations are "add" or "remove"; no third type exists — false arm is dead code.
				/* v8 ignore next */
			} else if (operation.type === "remove") {
				// During replay, operation.apiPath is the root path (e.g., "path1").
				// Use deletePath directly to remove the entire subtree.
				const { parts } = this.handlers.apiManager.normalizeApiPath(operation.apiPath);
				this.handlers.apiManager.deletePath(this.api, parts);
				// Clean up metadata
				// metadata is always auto-registered via slothletProperty; false arm unreachable.
				/* v8 ignore next */
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
		// ownership is always auto-registered via slothletProperty; false arm unreachable.
		/* v8 ignore next */
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
 * Create a new Slothlet instance and load an API from a directory.
 * This is the sole public entry point for slothlet. Each call produces an independent
 * API instance with its own component graph, context store, and lifecycle.
 * @alias module:@cldmv/slothlet
 * @async
 * @param {SlothletOptions} config - Configuration options
 * @returns {Promise<SlothletAPI>} Fully loaded, proxy-based API object
 * @public
 * @example
 * // Minimal usage
 * const api = await slothlet({ dir: "./api" });
 * const result = await api.math.add(2, 3);
 * await api.slothlet.shutdown();
 *
 * @example
 * // Lazy mode with background materialization
 * const api = await slothlet({
 *   dir: "./api",
 *   mode: "lazy",
 *   backgroundMaterialize: true
 * });
 *
 * @example
 * // With hooks
 * const api = await slothlet({ dir: "./api", hook: true });
 * api.slothlet.hook.on("before", "**", (endpoint, args) => { /* ... *\/ });
 *
 * @example
 * // Hot-reload a module at runtime
 * await api.slothlet.api.reload("./api/math.mjs");
 *
 * @example
 * // Strict collision control
 * const api = await slothlet({
 *   dir: "./api",
 *   api: { collision: { initial: "merge", api: "error" } }
 * });
 */
export async function slothlet(config) {
	const instance = new Slothlet();
	const api = await instance.load(config);

	// API already has builtins attached from load()
	return api;
}

export default slothlet;

// ============================================================================
// TYPE DEFINITIONS
// ============================================================================

/**
 * Configuration options passed to `slothlet()`.
 * @typedef {object} SlothletOptions
 * @property {string} dir - Directory to scan for API modules. Relative paths are resolved from the calling file.
 * @property {"eager"|"lazy"} [mode="eager"] - Loading strategy.
 *   - `"eager"` — all modules are loaded immediately at startup (default).
 *   - `"lazy"` — modules are loaded on first access via a Proxy.
 *   Also accepted: `"immediate"` / `"preload"` (eager aliases); `"deferred"` / `"proxy"` (lazy aliases).
 * @property {"async"|"live"} [runtime="async"] - Context propagation runtime.
 *   - `"async"` — AsyncLocalStorage (Node.js built-in, recommended for production).
 *   - `"live"` — Experimental live bindings.
 *   Also accepted: `"asynclocalstorage"` / `"als"` / `"node"` as aliases for `"async"`.
 * @property {number} [apiDepth=Infinity] - Directory traversal depth. `Infinity` scans all subdirectories (default). `0` scans only the root.
 * @property {object|null} [context=null] - Object merged into the per-request context accessible inside API functions via `import { context } from "@cldmv/slothlet/runtime"`.
 * @property {object|null} [reference=null] - Object whose properties are merged directly onto the root API and also available as `api.slothlet.reference`.
 * @property {{merge: "shallow"|"deep"}} [scope] - Controls how per-request scope data is merged. `"shallow"` merges top-level keys; `"deep"` recurses into nested objects.
 * @property {object} [api] - API build and mutation settings.
 * @property {string|{initial: string, api: string}} [api.collision="merge"] - Collision strategy when two modules export the same path.
 *   Modes: `"merge"` (default), `"merge-replace"`, `"replace"`, `"skip"`, `"warn"`, `"error"`.
 *   Pass an object to use different strategies for the initial build vs. runtime `api.slothlet.api.add()` calls.
 * @property {object} [api.mutations={add:true,remove:true,reload:true}] - Enable or disable runtime mutation methods on `api.slothlet.api`.
 *   Object with boolean keys `add`, `remove`, `reload` (all default `true`).
 * @property {boolean|string|object} [hook=false] - Hook system configuration.
 *   - `false` — disabled (default).
 *   - `true` — enabled, all endpoints.
 *   - `string` — enabled with a default glob pattern.
 *   - `object` — full control: `{ enabled: boolean, pattern?: string, suppressErrors?: boolean }`.
 * @property {boolean|object} [debug=false] - Enable verbose internal logging. `true` enables all categories.
 *   Pass an object with sub-keys `builder`, `api`, `index`, `modes`, `wrapper`, `ownership`, `context` to target specific subsystems.
 * @property {boolean} [silent=false] - Suppress all console output from slothlet (warnings, deprecations). Does not affect `debug`.
 * @property {boolean} [diagnostics=false] - Enable the `api.slothlet.diag.*` introspection namespace. Intended for testing; do not enable in production.
 * @property {boolean|object} [tracking=false] - Enable internal tracking. Pass `true` or `{ materialization: true }` to track lazy-mode materialization progress.
 * @property {boolean} [backgroundMaterialize=false] - When `mode: "lazy"`, immediately begins materializing all paths in the background after init.
 * @property {object} [i18n] - Internationalization settings (dev-facing, process-global).
 *   `{ language: string }` — selects the locale for framework messages (e.g. `"en-us"`, `"fr-fr"`, `"ja-jp"`).
 * @property {boolean|"fast"|"strict"|object} [typescript=false] - TypeScript support.
 *   - `false` — disabled (default).
 *   - `true` or `"fast"` — esbuild transpilation, no type checking.
 *   - `"strict"` — tsc compilation with type checking and `.d.ts` generation.
 *   See [TYPESCRIPT.md](docs/TYPESCRIPT.md) for the full configuration reference.
 */

/**
 * Bound API object returned by `slothlet()`.
 * The root contains all loaded module exports plus the reserved `slothlet` namespace.
 * @typedef {object} SlothletAPI
 * @property {function(): void} destroy - Like `shutdown()` but additionally invokes registered destroy hooks before teardown. %%sig: (): void%% %%example: // ESM usage via slothlet API|import slothlet from "@cldmv/slothlet";|const api = await slothlet({ dir: './api' });|await api.destroy();%% %%example: // ESM usage via slothlet API (inside async function)|async function example() {|  const { default: slothlet } = await import("@cldmv/slothlet");|  const api = await slothlet({ dir: './api' });|  await api.destroy();|}%% %%example: // CJS usage via slothlet API (top-level)|let slothlet;|(async () => {|  ({ slothlet } = await import("@cldmv/slothlet"));|  const api = await slothlet({ dir: './api' });|  await api.destroy();|})();%% %%example: // CJS usage via slothlet API (inside async function)|const slothlet = require("@cldmv/slothlet");|const api = await slothlet({ dir: './api' });|await api.destroy();%%
 * @property {function(): void} shutdown - Convenience alias for `slothlet.shutdown()`. Shuts down the instance and invokes any user-provided shutdown hook first. %%sig: (): void%% %%example: // ESM usage via slothlet API|import slothlet from "@cldmv/slothlet";|const api = await slothlet({ dir: './api' });|await api.shutdown();%% %%example: // ESM usage via slothlet API (inside async function)|async function example() {|  const { default: slothlet } = await import("@cldmv/slothlet");|  const api = await slothlet({ dir: './api' });|  await api.shutdown();|}%% %%example: // CJS usage via slothlet API (top-level)|let slothlet;|(async () => {|  ({ slothlet } = await import("@cldmv/slothlet"));|  const api = await slothlet({ dir: './api' });|  await api.shutdown();|})();%% %%example: // CJS usage via slothlet API (inside async function)|const slothlet = require("@cldmv/slothlet");|const api = await slothlet({ dir: './api' });|await api.shutdown();%%
 * @property {object} slothlet - Built-in control namespace. All framework internals live here to avoid collisions with loaded modules.
 * @property {object} slothlet.api - Runtime API mutation methods — availability controlled by `api.mutations` config option.
 * @property {Function} slothlet.api.add - Mount a new API module at runtime. %%sig: (apiPath: string, folderPath: string, [options]: Object): Promise.<void>%% %%example: // ESM usage via slothlet API|import slothlet from "@cldmv/slothlet";|const api = await slothlet({ dir: './api' });|await api.slothlet.api.add('utils.math', './api/utils/math');%% %%example: // ESM usage via slothlet API (inside async function)|async function example() {|  const { default: slothlet } = await import("@cldmv/slothlet");|  const api = await slothlet({ dir: './api' });|  await api.slothlet.api.add('utils.math', './api/utils/math');|}%% %%example: // CJS usage via slothlet API (top-level)|let slothlet;|(async () => {|  ({ slothlet } = await import("@cldmv/slothlet"));|  const api = await slothlet({ dir: './api' });|  await api.slothlet.api.add('utils.math', './api/utils/math');|})();%% %%example: // CJS usage via slothlet API (inside async function)|const slothlet = require("@cldmv/slothlet");|const api = await slothlet({ dir: './api' });|await api.slothlet.api.add('utils.math', './api/utils/math');%%
 * @property {Function} slothlet.api.reload - Hot-reload a specific module or directory path. %%sig: ([pathOrModuleId]: string|null, [options]: Object): Promise.<void>%% %%example: // ESM usage via slothlet API|import slothlet from "@cldmv/slothlet";|const api = await slothlet({ dir: './api' });|// Reload a specific module|await api.slothlet.api.reload('utils.math');|// Reload everything|await api.slothlet.api.reload();%% %%example: // ESM usage via slothlet API (inside async function)|async function example() {|  const { default: slothlet } = await import("@cldmv/slothlet");|  const api = await slothlet({ dir: './api' });|  // Reload a specific module|  await api.slothlet.api.reload('utils.math');|  // Reload everything|  await api.slothlet.api.reload();|}%% %%example: // CJS usage via slothlet API (top-level)|let slothlet;|(async () => {|  ({ slothlet } = await import("@cldmv/slothlet"));|  const api = await slothlet({ dir: './api' });|  // Reload a specific module|  await api.slothlet.api.reload('utils.math');|  // Reload everything|  await api.slothlet.api.reload();|})();%% %%example: // CJS usage via slothlet API (inside async function)|const slothlet = require("@cldmv/slothlet");|const api = await slothlet({ dir: './api' });|// Reload a specific module|await api.slothlet.api.reload('utils.math');|// Reload everything|await api.slothlet.api.reload();%%
 * @property {Function} slothlet.api.remove - Unmount an API module at runtime. %%sig: (pathOrModuleId: string): Promise.<void>%% %%example: // ESM usage via slothlet API|import slothlet from "@cldmv/slothlet";|const api = await slothlet({ dir: './api' });|await api.slothlet.api.remove('utils.math');%% %%example: // ESM usage via slothlet API (inside async function)|async function example() {|  const { default: slothlet } = await import("@cldmv/slothlet");|  const api = await slothlet({ dir: './api' });|  await api.slothlet.api.remove('utils.math');|}%% %%example: // CJS usage via slothlet API (top-level)|let slothlet;|(async () => {|  ({ slothlet } = await import("@cldmv/slothlet"));|  const api = await slothlet({ dir: './api' });|  await api.slothlet.api.remove('utils.math');|})();%% %%example: // CJS usage via slothlet API (inside async function)|const slothlet = require("@cldmv/slothlet");|const api = await slothlet({ dir: './api' });|await api.slothlet.api.remove('utils.math');%%
 * @property {object} slothlet.context - Per-request context helpers.
 * @property {Function} slothlet.context.get - Get a value from the current per-request context store. %%sig: ([key]: string): *%% %%example: // ESM usage via slothlet API|import slothlet from "@cldmv/slothlet";|const api = await slothlet({ dir: './api' });|await api.slothlet.context.run({ userId: 42 }, async () => {|  const userId = api.slothlet.context.get('userId'); // 42|});%% %%example: // ESM usage via slothlet API (inside async function)|async function example() {|  const { default: slothlet } = await import("@cldmv/slothlet");|  const api = await slothlet({ dir: './api' });|  await api.slothlet.context.run({ userId: 42 }, async () => {|    const userId = api.slothlet.context.get('userId'); // 42|  });|}%% %%example: // CJS usage via slothlet API (top-level)|let slothlet;|(async () => {|  ({ slothlet } = await import("@cldmv/slothlet"));|  const api = await slothlet({ dir: './api' });|  await api.slothlet.context.run({ userId: 42 }, async () => {|    const userId = api.slothlet.context.get('userId'); // 42|  });|})();%% %%example: // CJS usage via slothlet API (inside async function)|const slothlet = require("@cldmv/slothlet");|const api = await slothlet({ dir: './api' });|await api.slothlet.context.run({ userId: 42 }, async () => {|  const userId = api.slothlet.context.get('userId'); // 42|});%%
 * @property {function(): Object} slothlet.context.inspect - Return a snapshot of the current context state (for debugging). %%sig: (): Object%% %%example: // ESM usage via slothlet API|import slothlet from "@cldmv/slothlet";|const api = await slothlet({ dir: './api' });|await api.slothlet.context.run({ userId: 42 }, async () => {|  const snapshot = api.slothlet.context.inspect();|  // { data: { userId: 42 }, ... }|});%% %%example: // ESM usage via slothlet API (inside async function)|async function example() {|  const { default: slothlet } = await import("@cldmv/slothlet");|  const api = await slothlet({ dir: './api' });|  await api.slothlet.context.run({ userId: 42 }, async () => {|    const snapshot = api.slothlet.context.inspect();|    // { data: { userId: 42 }, ... }|  });|}%% %%example: // CJS usage via slothlet API (top-level)|let slothlet;|(async () => {|  ({ slothlet } = await import("@cldmv/slothlet"));|  const api = await slothlet({ dir: './api' });|  await api.slothlet.context.run({ userId: 42 }, async () => {|    const snapshot = api.slothlet.context.inspect();|    // { data: { userId: 42 }, ... }|  });|})();%% %%example: // CJS usage via slothlet API (inside async function)|const slothlet = require("@cldmv/slothlet");|const api = await slothlet({ dir: './api' });|await api.slothlet.context.run({ userId: 42 }, async () => {|  const snapshot = api.slothlet.context.inspect();|  // { data: { userId: 42 }, ... }|});%%
 * @property {Function} slothlet.context.run - Execute a callback with isolated context data merged in. %%sig: (contextData: Object, callback: function, args: *): *%% %%example: // ESM usage via slothlet API|import slothlet from "@cldmv/slothlet";|const api = await slothlet({ dir: './api' });|const result = await api.slothlet.context.run({ userId: 42 }, async () => {|  return api.myModule.getUser(); // sees context.userId = 42|});%% %%example: // ESM usage via slothlet API (inside async function)|async function example() {|  const { default: slothlet } = await import("@cldmv/slothlet");|  const api = await slothlet({ dir: './api' });|  const result = await api.slothlet.context.run({ userId: 42 }, async () => {|    return api.myModule.getUser(); // sees context.userId = 42|  });|}%% %%example: // CJS usage via slothlet API (top-level)|let slothlet;|(async () => {|  ({ slothlet } = await import("@cldmv/slothlet"));|  const api = await slothlet({ dir: './api' });|  const result = await api.slothlet.context.run({ userId: 42 }, async () => {|    return api.myModule.getUser(); // sees context.userId = 42|  });|})();%% %%example: // CJS usage via slothlet API (inside async function)|const slothlet = require("@cldmv/slothlet");|const api = await slothlet({ dir: './api' });|const result = await api.slothlet.context.run({ userId: 42 }, async () => {|  return api.myModule.getUser(); // sees context.userId = 42|});%%
 * @property {Function} slothlet.context.scope - Execute a function with structured context options (`context`, `fn`, `args`, `merge`, `isolation`). %%sig: (options: Object): *%% %%example: // ESM usage via slothlet API|import slothlet from "@cldmv/slothlet";|const api = await slothlet({ dir: './api' });|const result = await api.slothlet.context.scope({|  context: { userId: 42 },|  fn: async () => api.myModule.getUser()|});%% %%example: // ESM usage via slothlet API (inside async function)|async function example() {|  const { default: slothlet } = await import("@cldmv/slothlet");|  const api = await slothlet({ dir: './api' });|  const result = await api.slothlet.context.scope({|    context: { userId: 42 },|    fn: async () => api.myModule.getUser()|  });|}%% %%example: // CJS usage via slothlet API (top-level)|let slothlet;|(async () => {|  ({ slothlet } = await import("@cldmv/slothlet"));|  const api = await slothlet({ dir: './api' });|  const result = await api.slothlet.context.scope({|    context: { userId: 42 },|    fn: async () => api.myModule.getUser()|  });|})();%% %%example: // CJS usage via slothlet API (inside async function)|const slothlet = require("@cldmv/slothlet");|const api = await slothlet({ dir: './api' });|const result = await api.slothlet.context.scope({|  context: { userId: 42 },|  fn: async () => api.myModule.getUser()|});%%
 * @property {Function} slothlet.context.set - Set a value in the current per-request context store. %%sig: (key: string, value: *): void%% %%example: // ESM usage via slothlet API|import slothlet from "@cldmv/slothlet";|const api = await slothlet({ dir: './api' });|await api.slothlet.context.run({}, async () => {|  api.slothlet.context.set('traceId', 'abc-123');|});%% %%example: // ESM usage via slothlet API (inside async function)|async function example() {|  const { default: slothlet } = await import("@cldmv/slothlet");|  const api = await slothlet({ dir: './api' });|  await api.slothlet.context.run({}, async () => {|    api.slothlet.context.set('traceId', 'abc-123');|  });|}%% %%example: // CJS usage via slothlet API (top-level)|let slothlet;|(async () => {|  ({ slothlet } = await import("@cldmv/slothlet"));|  const api = await slothlet({ dir: './api' });|  await api.slothlet.context.run({}, async () => {|    api.slothlet.context.set('traceId', 'abc-123');|  });|})();%% %%example: // CJS usage via slothlet API (inside async function)|const slothlet = require("@cldmv/slothlet");|const api = await slothlet({ dir: './api' });|await api.slothlet.context.run({}, async () => {|  api.slothlet.context.set('traceId', 'abc-123');|});%%
 * @property {object} [slothlet.diag] - Diagnostics namespace — only present when `diagnostics: true`. Do not enable in production.
 * @property {object} [slothlet.diag.caches] - Cache diagnostics sub-namespace.
 * @property {function(): Object} [slothlet.diag.caches.get] - Get full cache diagnostic data (`{ totalCaches, caches[] }`). Only available when `diagnostics: true`. %%sig: (): Object%% %%example: // ESM usage via slothlet API|import slothlet from "@cldmv/slothlet";|const api = await slothlet({ dir: './api', diagnostics: true });|const cacheData = api.slothlet.diag.caches.get();|// { totalCaches: 2, caches: [...] }%% %%example: // ESM usage via slothlet API (inside async function)|async function example() {|  const { default: slothlet } = await import("@cldmv/slothlet");|  const api = await slothlet({ dir: './api', diagnostics: true });|  const cacheData = api.slothlet.diag.caches.get();|  // { totalCaches: 2, caches: [...] }|}%% %%example: // CJS usage via slothlet API (top-level)|let slothlet;|(async () => {|  ({ slothlet } = await import("@cldmv/slothlet"));|  const api = await slothlet({ dir: './api', diagnostics: true });|  const cacheData = api.slothlet.diag.caches.get();|  // { totalCaches: 2, caches: [...] }|})();%% %%example: // CJS usage via slothlet API (inside async function)|const slothlet = require("@cldmv/slothlet");|const api = await slothlet({ dir: './api', diagnostics: true });|const cacheData = api.slothlet.diag.caches.get();|// { totalCaches: 2, caches: [...] }%%
 * @property {function(): string[]} [slothlet.diag.caches.getAllModuleIDs] - Return all moduleIDs currently in cache. Only available when `diagnostics: true`. %%sig: (): string[]%% %%example: // ESM usage via slothlet API|import slothlet from "@cldmv/slothlet";|const api = await slothlet({ dir: './api', diagnostics: true });|const ids = api.slothlet.diag.caches.getAllModuleIDs();|// ['utils/math.mjs', 'utils/strings.mjs']%% %%example: // ESM usage via slothlet API (inside async function)|async function example() {|  const { default: slothlet } = await import("@cldmv/slothlet");|  const api = await slothlet({ dir: './api', diagnostics: true });|  const ids = api.slothlet.diag.caches.getAllModuleIDs();|  // ['utils/math.mjs', 'utils/strings.mjs']|}%% %%example: // CJS usage via slothlet API (top-level)|let slothlet;|(async () => {|  ({ slothlet } = await import("@cldmv/slothlet"));|  const api = await slothlet({ dir: './api', diagnostics: true });|  const ids = api.slothlet.diag.caches.getAllModuleIDs();|  // ['utils/math.mjs', 'utils/strings.mjs']|})();%% %%example: // CJS usage via slothlet API (inside async function)|const slothlet = require("@cldmv/slothlet");|const api = await slothlet({ dir: './api', diagnostics: true });|const ids = api.slothlet.diag.caches.getAllModuleIDs();|// ['utils/math.mjs', 'utils/strings.mjs']%%
 * @property {Function} [slothlet.diag.caches.has] - Check whether a cache entry exists for a given moduleID. Only available when `diagnostics: true`. %%sig: (moduleID: string): boolean%% %%example: // ESM usage via slothlet API|import slothlet from "@cldmv/slothlet";|const api = await slothlet({ dir: './api', diagnostics: true });|const exists = api.slothlet.diag.caches.has('utils/math.mjs'); // true or false%% %%example: // ESM usage via slothlet API (inside async function)|async function example() {|  const { default: slothlet } = await import("@cldmv/slothlet");|  const api = await slothlet({ dir: './api', diagnostics: true });|  const exists = api.slothlet.diag.caches.has('utils/math.mjs'); // true or false|}%% %%example: // CJS usage via slothlet API (top-level)|let slothlet;|(async () => {|  ({ slothlet } = await import("@cldmv/slothlet"));|  const api = await slothlet({ dir: './api', diagnostics: true });|  const exists = api.slothlet.diag.caches.has('utils/math.mjs'); // true or false|})();%% %%example: // CJS usage via slothlet API (inside async function)|const slothlet = require("@cldmv/slothlet");|const api = await slothlet({ dir: './api', diagnostics: true });|const exists = api.slothlet.diag.caches.has('utils/math.mjs'); // true or false%%
 * @property {object} [slothlet.diag.context] - The `context` config value as passed to `slothlet()`.
 * @property {Function} [slothlet.diag.describe] - Describe API structure. Pass `true` to return the full API object; omit for top-level keys only. Only available when `diagnostics: true`. %%sig: ([showAll]: boolean): *%% %%example: // ESM usage via slothlet API|import slothlet from "@cldmv/slothlet";|const api = await slothlet({ dir: './api', diagnostics: true });|const keys = api.slothlet.diag.describe();|const full = api.slothlet.diag.describe(true);%% %%example: // ESM usage via slothlet API (inside async function)|async function example() {|  const { default: slothlet } = await import("@cldmv/slothlet");|  const api = await slothlet({ dir: './api', diagnostics: true });|  const keys = api.slothlet.diag.describe();|  const full = api.slothlet.diag.describe(true);|}%% %%example: // CJS usage via slothlet API (top-level)|let slothlet;|(async () => {|  ({ slothlet } = await import("@cldmv/slothlet"));|  const api = await slothlet({ dir: './api', diagnostics: true });|  const keys = api.slothlet.diag.describe();|  const full = api.slothlet.diag.describe(true);|})();%% %%example: // CJS usage via slothlet API (inside async function)|const slothlet = require("@cldmv/slothlet");|const api = await slothlet({ dir: './api', diagnostics: true });|const keys = api.slothlet.diag.describe();|const full = api.slothlet.diag.describe(true);%%
 * @property {function(): Object} [slothlet.diag.getAPI] - Return the live bound API proxy object. Only available when `diagnostics: true`. %%sig: (): Object%% %%example: // ESM usage via slothlet API|import slothlet from "@cldmv/slothlet";|const api = await slothlet({ dir: './api', diagnostics: true });|const proxy = api.slothlet.diag.getAPI(); // the live bound API proxy%% %%example: // ESM usage via slothlet API (inside async function)|async function example() {|  const { default: slothlet } = await import("@cldmv/slothlet");|  const api = await slothlet({ dir: './api', diagnostics: true });|  const proxy = api.slothlet.diag.getAPI(); // the live bound API proxy|}%% %%example: // CJS usage via slothlet API (top-level)|let slothlet;|(async () => {|  ({ slothlet } = await import("@cldmv/slothlet"));|  const api = await slothlet({ dir: './api', diagnostics: true });|  const proxy = api.slothlet.diag.getAPI(); // the live bound API proxy|})();%% %%example: // CJS usage via slothlet API (inside async function)|const slothlet = require("@cldmv/slothlet");|const api = await slothlet({ dir: './api', diagnostics: true });|const proxy = api.slothlet.diag.getAPI(); // the live bound API proxy%%
 * @property {function(): Object} [slothlet.diag.getOwnership] - Return ownership diagnostics for all registered API paths. Only available when `diagnostics: true`. %%sig: (): Object%% %%example: // ESM usage via slothlet API|import slothlet from "@cldmv/slothlet";|const api = await slothlet({ dir: './api', diagnostics: true });|const ownership = api.slothlet.diag.getOwnership();%% %%example: // ESM usage via slothlet API (inside async function)|async function example() {|  const { default: slothlet } = await import("@cldmv/slothlet");|  const api = await slothlet({ dir: './api', diagnostics: true });|  const ownership = api.slothlet.diag.getOwnership();|}%% %%example: // CJS usage via slothlet API (top-level)|let slothlet;|(async () => {|  ({ slothlet } = await import("@cldmv/slothlet"));|  const api = await slothlet({ dir: './api', diagnostics: true });|  const ownership = api.slothlet.diag.getOwnership();|})();%% %%example: // CJS usage via slothlet API (inside async function)|const slothlet = require("@cldmv/slothlet");|const api = await slothlet({ dir: './api', diagnostics: true });|const ownership = api.slothlet.diag.getOwnership();%%
 * @property {object} [slothlet.diag.hook] - Hook system diagnostics sub-namespace (present only when hooks are enabled).
 * @property {function(): Object} [slothlet.diag.inspect] - Return a full diagnostic snapshot of current instance state. Only available when `diagnostics: true`. %%sig: (): Object%% %%example: // ESM usage via slothlet API|import slothlet from "@cldmv/slothlet";|const api = await slothlet({ dir: './api', diagnostics: true });|const snapshot = api.slothlet.diag.inspect();|console.log(snapshot.modules, snapshot.hooks);%% %%example: // ESM usage via slothlet API (inside async function)|async function example() {|  const { default: slothlet } = await import("@cldmv/slothlet");|  const api = await slothlet({ dir: './api', diagnostics: true });|  const snapshot = api.slothlet.diag.inspect();|  console.log(snapshot.modules, snapshot.hooks);|}%% %%example: // CJS usage via slothlet API (top-level)|let slothlet;|(async () => {|  ({ slothlet } = await import("@cldmv/slothlet"));|  const api = await slothlet({ dir: './api', diagnostics: true });|  const snapshot = api.slothlet.diag.inspect();|  console.log(snapshot.modules, snapshot.hooks);|})();%% %%example: // CJS usage via slothlet API (inside async function)|const slothlet = require("@cldmv/slothlet");|const api = await slothlet({ dir: './api', diagnostics: true });|const snapshot = api.slothlet.diag.inspect();|console.log(snapshot.modules, snapshot.hooks);%%
 * @property {object} [slothlet.diag.owner] - Ownership sub-namespace for diagnostics.
 * @property {Function} [slothlet.diag.owner.get] - Get the owning moduleIDs for a specific API path. Only available when `diagnostics: true`. %%sig: (apiPath: string): string[]%% %%example: // ESM usage via slothlet API|import slothlet from "@cldmv/slothlet";|const api = await slothlet({ dir: './api', diagnostics: true });|const owners = api.slothlet.diag.owner.get('math.add');|// ['utils/math.mjs']%% %%example: // ESM usage via slothlet API (inside async function)|async function example() {|  const { default: slothlet } = await import("@cldmv/slothlet");|  const api = await slothlet({ dir: './api', diagnostics: true });|  const owners = api.slothlet.diag.owner.get('math.add');|  // ['utils/math.mjs']|}%% %%example: // CJS usage via slothlet API (top-level)|let slothlet;|(async () => {|  ({ slothlet } = await import("@cldmv/slothlet"));|  const api = await slothlet({ dir: './api', diagnostics: true });|  const owners = api.slothlet.diag.owner.get('math.add');|  // ['utils/math.mjs']|})();%% %%example: // CJS usage via slothlet API (inside async function)|const slothlet = require("@cldmv/slothlet");|const api = await slothlet({ dir: './api', diagnostics: true });|const owners = api.slothlet.diag.owner.get('math.add');|// ['utils/math.mjs']%%
 * @property {object} [slothlet.diag.reference] - The `reference` config value as passed to `slothlet()`.
 * @property {function(): SlothletWarning} [slothlet.diag.SlothletWarning] - The `SlothletWarning` class — access `.captured` for warnings emitted during tests. Only available when `diagnostics: true`. %%sig: (): SlothletWarning%% %%example: // ESM usage via slothlet API|import slothlet from "@cldmv/slothlet";|const api = await slothlet({ dir: './api', diagnostics: true });|const SlothletWarning = api.slothlet.diag.SlothletWarning;|console.log(SlothletWarning.captured); // array of captured warnings%% %%example: // ESM usage via slothlet API (inside async function)|async function example() {|  const { default: slothlet } = await import("@cldmv/slothlet");|  const api = await slothlet({ dir: './api', diagnostics: true });|  const SlothletWarning = api.slothlet.diag.SlothletWarning;|  console.log(SlothletWarning.captured); // array of captured warnings|}%% %%example: // CJS usage via slothlet API (top-level)|let slothlet;|(async () => {|  ({ slothlet } = await import("@cldmv/slothlet"));|  const api = await slothlet({ dir: './api', diagnostics: true });|  const SlothletWarning = api.slothlet.diag.SlothletWarning;|  console.log(SlothletWarning.captured); // array of captured warnings|})();%% %%example: // CJS usage via slothlet API (inside async function)|const slothlet = require("@cldmv/slothlet");|const api = await slothlet({ dir: './api', diagnostics: true });|const SlothletWarning = api.slothlet.diag.SlothletWarning;|console.log(SlothletWarning.captured); // array of captured warnings%%
 * @property {object} slothlet.hook - Hook registration surface — only present when the `hook` option is enabled.
 * @property {Function} slothlet.hook.clear - Alias for `remove()`. %%sig: ([filter]: Object): void%% %%example: // ESM usage via slothlet API|import slothlet from "@cldmv/slothlet";|const api = await slothlet({ dir: './api', hook: true });|api.slothlet.hook.clear({ type: 'before' });%% %%example: // ESM usage via slothlet API (inside async function)|async function example() {|  const { default: slothlet } = await import("@cldmv/slothlet");|  const api = await slothlet({ dir: './api', hook: true });|  api.slothlet.hook.clear({ type: 'before' });|}%% %%example: // CJS usage via slothlet API (top-level)|let slothlet;|(async () => {|  ({ slothlet } = await import("@cldmv/slothlet"));|  const api = await slothlet({ dir: './api', hook: true });|  api.slothlet.hook.clear({ type: 'before' });|})();%% %%example: // CJS usage via slothlet API (inside async function)|const slothlet = require("@cldmv/slothlet");|const api = await slothlet({ dir: './api', hook: true });|api.slothlet.hook.clear({ type: 'before' });%%
 * @property {Function} slothlet.hook.disable - Disable hooks matching a filter (empty = disable all). %%sig: ([filter]: Object): void%% %%example: // ESM usage via slothlet API|import slothlet from "@cldmv/slothlet";|const api = await slothlet({ dir: './api', hook: true });|api.slothlet.hook.disable(); // disable all|api.slothlet.hook.disable({ type: 'before' }); // disable only before hooks%% %%example: // ESM usage via slothlet API (inside async function)|async function example() {|  const { default: slothlet } = await import("@cldmv/slothlet");|  const api = await slothlet({ dir: './api', hook: true });|  api.slothlet.hook.disable(); // disable all|  api.slothlet.hook.disable({ type: 'before' }); // disable only before hooks|}%% %%example: // CJS usage via slothlet API (top-level)|let slothlet;|(async () => {|  ({ slothlet } = await import("@cldmv/slothlet"));|  const api = await slothlet({ dir: './api', hook: true });|  api.slothlet.hook.disable(); // disable all|  api.slothlet.hook.disable({ type: 'before' }); // disable only before hooks|})();%% %%example: // CJS usage via slothlet API (inside async function)|const slothlet = require("@cldmv/slothlet");|const api = await slothlet({ dir: './api', hook: true });|api.slothlet.hook.disable(); // disable all|api.slothlet.hook.disable({ type: 'before' }); // disable only before hooks%%
 * @property {Function} slothlet.hook.enable - Enable hooks matching a filter (empty = enable all). %%sig: ([filter]: Object): void%% %%example: // ESM usage via slothlet API|import slothlet from "@cldmv/slothlet";|const api = await slothlet({ dir: './api', hook: true });|api.slothlet.hook.disable();|// later...|api.slothlet.hook.enable(); // re-enable all%% %%example: // ESM usage via slothlet API (inside async function)|async function example() {|  const { default: slothlet } = await import("@cldmv/slothlet");|  const api = await slothlet({ dir: './api', hook: true });|  api.slothlet.hook.disable();|  // later...|  api.slothlet.hook.enable(); // re-enable all|}%% %%example: // CJS usage via slothlet API (top-level)|let slothlet;|(async () => {|  ({ slothlet } = await import("@cldmv/slothlet"));|  const api = await slothlet({ dir: './api', hook: true });|  api.slothlet.hook.disable();|  // later...|  api.slothlet.hook.enable(); // re-enable all|})();%% %%example: // CJS usage via slothlet API (inside async function)|const slothlet = require("@cldmv/slothlet");|const api = await slothlet({ dir: './api', hook: true });|api.slothlet.hook.disable();|// later...|api.slothlet.hook.enable(); // re-enable all%%
 * @property {Function} slothlet.hook.list - List registered hooks matching a filter. %%sig: ([filter]: Object): Object[]%% %%example: // ESM usage via slothlet API|import slothlet from "@cldmv/slothlet";|const api = await slothlet({ dir: './api', hook: true });|const allHooks = api.slothlet.hook.list();|const beforeHooks = api.slothlet.hook.list({ type: 'before' });%% %%example: // ESM usage via slothlet API (inside async function)|async function example() {|  const { default: slothlet } = await import("@cldmv/slothlet");|  const api = await slothlet({ dir: './api', hook: true });|  const allHooks = api.slothlet.hook.list();|  const beforeHooks = api.slothlet.hook.list({ type: 'before' });|}%% %%example: // CJS usage via slothlet API (top-level)|let slothlet;|(async () => {|  ({ slothlet } = await import("@cldmv/slothlet"));|  const api = await slothlet({ dir: './api', hook: true });|  const allHooks = api.slothlet.hook.list();|  const beforeHooks = api.slothlet.hook.list({ type: 'before' });|})();%% %%example: // CJS usage via slothlet API (inside async function)|const slothlet = require("@cldmv/slothlet");|const api = await slothlet({ dir: './api', hook: true });|const allHooks = api.slothlet.hook.list();|const beforeHooks = api.slothlet.hook.list({ type: 'before' });%%
 * @property {Function} slothlet.hook.off - Remove hooks by ID or filter object (v2 alias for `remove()`). %%sig: (idOrFilter: string|Object): void%% %%example: // ESM usage via slothlet API|import slothlet from "@cldmv/slothlet";|const api = await slothlet({ dir: './api', hook: true });|const hookId = api.slothlet.hook.on('before:math.*', handler);|api.slothlet.hook.off(hookId); // remove by ID|api.slothlet.hook.off({ type: 'after' }); // remove by filter%% %%example: // ESM usage via slothlet API (inside async function)|async function example() {|  const { default: slothlet } = await import("@cldmv/slothlet");|  const api = await slothlet({ dir: './api', hook: true });|  const hookId = api.slothlet.hook.on('before:math.*', handler);|  api.slothlet.hook.off(hookId); // remove by ID|  api.slothlet.hook.off({ type: 'after' }); // remove by filter|}%% %%example: // CJS usage via slothlet API (top-level)|let slothlet;|(async () => {|  ({ slothlet } = await import("@cldmv/slothlet"));|  const api = await slothlet({ dir: './api', hook: true });|  const hookId = api.slothlet.hook.on('before:math.*', handler);|  api.slothlet.hook.off(hookId); // remove by ID|  api.slothlet.hook.off({ type: 'after' }); // remove by filter|})();%% %%example: // CJS usage via slothlet API (inside async function)|const slothlet = require("@cldmv/slothlet");|const api = await slothlet({ dir: './api', hook: true });|const hookId = api.slothlet.hook.on('before:math.*', handler);|api.slothlet.hook.off(hookId); // remove by ID|api.slothlet.hook.off({ type: 'after' }); // remove by filter%%
 * @property {Function} slothlet.hook.on - Register a hook handler for a type:pattern (e.g. `"before:math.*"`). %%sig: (typePattern: string, handler: function, [options]: Object): string%% %%example: // ESM usage via slothlet API|import slothlet from "@cldmv/slothlet";|const api = await slothlet({ dir: './api', hook: true });|const hookId = api.slothlet.hook.on('before:math.*', ({ args }) => {|  console.log('math called with', args);|});%% %%example: // ESM usage via slothlet API (inside async function)|async function example() {|  const { default: slothlet } = await import("@cldmv/slothlet");|  const api = await slothlet({ dir: './api', hook: true });|  const hookId = api.slothlet.hook.on('before:math.*', ({ args }) => {|    console.log('math called with', args);|  });|}%% %%example: // CJS usage via slothlet API (top-level)|let slothlet;|(async () => {|  ({ slothlet } = await import("@cldmv/slothlet"));|  const api = await slothlet({ dir: './api', hook: true });|  const hookId = api.slothlet.hook.on('before:math.*', ({ args }) => {|    console.log('math called with', args);|  });|})();%% %%example: // CJS usage via slothlet API (inside async function)|const slothlet = require("@cldmv/slothlet");|const api = await slothlet({ dir: './api', hook: true });|const hookId = api.slothlet.hook.on('before:math.*', ({ args }) => {|  console.log('math called with', args);|});%%
 * @property {Function} slothlet.hook.remove - Remove hooks matching a filter (`id`, `type`, `pattern`). %%sig: ([filter]: Object): void%% %%example: // ESM usage via slothlet API|import slothlet from "@cldmv/slothlet";|const api = await slothlet({ dir: './api', hook: true });|api.slothlet.hook.remove({ type: 'before', pattern: 'math.*' });%% %%example: // ESM usage via slothlet API (inside async function)|async function example() {|  const { default: slothlet } = await import("@cldmv/slothlet");|  const api = await slothlet({ dir: './api', hook: true });|  api.slothlet.hook.remove({ type: 'before', pattern: 'math.*' });|}%% %%example: // CJS usage via slothlet API (top-level)|let slothlet;|(async () => {|  ({ slothlet } = await import("@cldmv/slothlet"));|  const api = await slothlet({ dir: './api', hook: true });|  api.slothlet.hook.remove({ type: 'before', pattern: 'math.*' });|})();%% %%example: // CJS usage via slothlet API (inside async function)|const slothlet = require("@cldmv/slothlet");|const api = await slothlet({ dir: './api', hook: true });|api.slothlet.hook.remove({ type: 'before', pattern: 'math.*' });%%
 * @property {object} slothlet.lifecycle - Lifecycle event emitter.
 * @property {Function} slothlet.lifecycle.off - Unsubscribe a handler from a lifecycle event. %%sig: (event: string, handler: function): void%% %%example: // ESM usage via slothlet API|import slothlet from "@cldmv/slothlet";|const api = await slothlet({ dir: './api' });|const handler = () => console.log('shutdown');|api.slothlet.lifecycle.on('shutdown', handler);|api.slothlet.lifecycle.off('shutdown', handler);%% %%example: // ESM usage via slothlet API (inside async function)|async function example() {|  const { default: slothlet } = await import("@cldmv/slothlet");|  const api = await slothlet({ dir: './api' });|  const handler = () => console.log('shutdown');|  api.slothlet.lifecycle.on('shutdown', handler);|  api.slothlet.lifecycle.off('shutdown', handler);|}%% %%example: // CJS usage via slothlet API (top-level)|let slothlet;|(async () => {|  ({ slothlet } = await import("@cldmv/slothlet"));|  const api = await slothlet({ dir: './api' });|  const handler = () => console.log('shutdown');|  api.slothlet.lifecycle.on('shutdown', handler);|  api.slothlet.lifecycle.off('shutdown', handler);|})();%% %%example: // CJS usage via slothlet API (inside async function)|const slothlet = require("@cldmv/slothlet");|const api = await slothlet({ dir: './api' });|const handler = () => console.log('shutdown');|api.slothlet.lifecycle.on('shutdown', handler);|api.slothlet.lifecycle.off('shutdown', handler);%%
 * @property {Function} slothlet.lifecycle.on - Subscribe to a lifecycle event (e.g. `"materialized:complete"`). %%sig: (event: string, handler: function): void%% %%example: // ESM usage via slothlet API|import slothlet from "@cldmv/slothlet";|const api = await slothlet({ dir: './api' });|api.slothlet.lifecycle.on('shutdown', () => {|  console.log('Slothlet is shutting down');|});%% %%example: // ESM usage via slothlet API (inside async function)|async function example() {|  const { default: slothlet } = await import("@cldmv/slothlet");|  const api = await slothlet({ dir: './api' });|  api.slothlet.lifecycle.on('shutdown', () => {|    console.log('Slothlet is shutting down');|  });|}%% %%example: // CJS usage via slothlet API (top-level)|let slothlet;|(async () => {|  ({ slothlet } = await import("@cldmv/slothlet"));|  const api = await slothlet({ dir: './api' });|  api.slothlet.lifecycle.on('shutdown', () => {|    console.log('Slothlet is shutting down');|  });|})();%% %%example: // CJS usage via slothlet API (inside async function)|const slothlet = require("@cldmv/slothlet");|const api = await slothlet({ dir: './api' });|api.slothlet.lifecycle.on('shutdown', () => {|  console.log('Slothlet is shutting down');|});%%
 * @property {object} slothlet.materialize - Lazy materialization tracking (meaningful only when `mode: "lazy"`).
 * @property {function(): Object} slothlet.materialize.get - Get current materialization statistics (`{ total, materialized, remaining, percentage }`). %%sig: (): Object%% %%example: // ESM usage via slothlet API|import slothlet from "@cldmv/slothlet";|const api = await slothlet({ dir: './api', mode: 'lazy' });|const stats = api.slothlet.materialize.get();|// { total: 5, materialized: 3, remaining: 2, percentage: 60 }%% %%example: // ESM usage via slothlet API (inside async function)|async function example() {|  const { default: slothlet } = await import("@cldmv/slothlet");|  const api = await slothlet({ dir: './api', mode: 'lazy' });|  const stats = api.slothlet.materialize.get();|  // { total: 5, materialized: 3, remaining: 2, percentage: 60 }|}%% %%example: // CJS usage via slothlet API (top-level)|let slothlet;|(async () => {|  ({ slothlet } = await import("@cldmv/slothlet"));|  const api = await slothlet({ dir: './api', mode: 'lazy' });|  const stats = api.slothlet.materialize.get();|  // { total: 5, materialized: 3, remaining: 2, percentage: 60 }|})();%% %%example: // CJS usage via slothlet API (inside async function)|const slothlet = require("@cldmv/slothlet");|const api = await slothlet({ dir: './api', mode: 'lazy' });|const stats = api.slothlet.materialize.get();|// { total: 5, materialized: 3, remaining: 2, percentage: 60 }%%
 * @property {boolean} slothlet.materialize.materialized - `true` once all lazy folders have been fully loaded.
 * @property {function(): Promise.<void>} slothlet.materialize.wait - Returns a Promise that resolves when all lazy folders are fully materialized. %%sig: (): Promise.<void>%% %%example: // ESM usage via slothlet API|import slothlet from "@cldmv/slothlet";|const api = await slothlet({ dir: './api', mode: 'lazy' });|await api.slothlet.materialize.wait(); // resolves when all lazy modules are loaded%% %%example: // ESM usage via slothlet API (inside async function)|async function example() {|  const { default: slothlet } = await import("@cldmv/slothlet");|  const api = await slothlet({ dir: './api', mode: 'lazy' });|  await api.slothlet.materialize.wait(); // resolves when all lazy modules are loaded|}%% %%example: // CJS usage via slothlet API (top-level)|let slothlet;|(async () => {|  ({ slothlet } = await import("@cldmv/slothlet"));|  const api = await slothlet({ dir: './api', mode: 'lazy' });|  await api.slothlet.materialize.wait(); // resolves when all lazy modules are loaded|})();%% %%example: // CJS usage via slothlet API (inside async function)|const slothlet = require("@cldmv/slothlet");|const api = await slothlet({ dir: './api', mode: 'lazy' });|await api.slothlet.materialize.wait(); // resolves when all lazy modules are loaded%%
 * @property {object} slothlet.metadata - Module metadata accessor.
 * @property {function(): Object|null} slothlet.metadata.caller - Get metadata for the function that invoked the current one (runtime-injected). %%sig: (): Object|null%% %%example: // ESM usage via slothlet API|import slothlet from "@cldmv/slothlet";|const api = await slothlet({ dir: './api' });|// Inside an API module, get metadata of the calling function:|const callerMeta = api.slothlet.metadata.caller(); // null if no caller%% %%example: // ESM usage via slothlet API (inside async function)|async function example() {|  const { default: slothlet } = await import("@cldmv/slothlet");|  const api = await slothlet({ dir: './api' });|  // Inside an API module, get metadata of the calling function:|  const callerMeta = api.slothlet.metadata.caller(); // null if no caller|}%% %%example: // CJS usage via slothlet API (top-level)|let slothlet;|(async () => {|  ({ slothlet } = await import("@cldmv/slothlet"));|  const api = await slothlet({ dir: './api' });|  // Inside an API module, get metadata of the calling function:|  const callerMeta = api.slothlet.metadata.caller(); // null if no caller|})();%% %%example: // CJS usage via slothlet API (inside async function)|const slothlet = require("@cldmv/slothlet");|const api = await slothlet({ dir: './api' });|// Inside an API module, get metadata of the calling function:|const callerMeta = api.slothlet.metadata.caller(); // null if no caller%%
 * @property {Function} slothlet.metadata.get - Get metadata for a specific function reference. %%sig: (fn: function): Object%% %%example: // ESM usage via slothlet API|import slothlet from "@cldmv/slothlet";|const api = await slothlet({ dir: './api' });|api.slothlet.metadata.set(api.math.add, 'label', 'Addition');|const meta = api.slothlet.metadata.get(api.math.add);|// { label: 'Addition' }%% %%example: // ESM usage via slothlet API (inside async function)|async function example() {|  const { default: slothlet } = await import("@cldmv/slothlet");|  const api = await slothlet({ dir: './api' });|  api.slothlet.metadata.set(api.math.add, 'label', 'Addition');|  const meta = api.slothlet.metadata.get(api.math.add);|  // { label: 'Addition' }|}%% %%example: // CJS usage via slothlet API (top-level)|let slothlet;|(async () => {|  ({ slothlet } = await import("@cldmv/slothlet"));|  const api = await slothlet({ dir: './api' });|  api.slothlet.metadata.set(api.math.add, 'label', 'Addition');|  const meta = api.slothlet.metadata.get(api.math.add);|  // { label: 'Addition' }|})();%% %%example: // CJS usage via slothlet API (inside async function)|const slothlet = require("@cldmv/slothlet");|const api = await slothlet({ dir: './api' });|api.slothlet.metadata.set(api.math.add, 'label', 'Addition');|const meta = api.slothlet.metadata.get(api.math.add);|// { label: 'Addition' }%%
 * @property {Function} slothlet.metadata.remove - Remove per-function metadata (all keys or a specific key). %%sig: (fn: function, [key]: string): void%% %%example: // ESM usage via slothlet API|import slothlet from "@cldmv/slothlet";|const api = await slothlet({ dir: './api' });|api.slothlet.metadata.set(api.math.add, 'label', 'Addition');|api.slothlet.metadata.remove(api.math.add, 'label'); // remove key|api.slothlet.metadata.remove(api.math.add); // remove all%% %%example: // ESM usage via slothlet API (inside async function)|async function example() {|  const { default: slothlet } = await import("@cldmv/slothlet");|  const api = await slothlet({ dir: './api' });|  api.slothlet.metadata.set(api.math.add, 'label', 'Addition');|  api.slothlet.metadata.remove(api.math.add, 'label'); // remove key|  api.slothlet.metadata.remove(api.math.add); // remove all|}%% %%example: // CJS usage via slothlet API (top-level)|let slothlet;|(async () => {|  ({ slothlet } = await import("@cldmv/slothlet"));|  const api = await slothlet({ dir: './api' });|  api.slothlet.metadata.set(api.math.add, 'label', 'Addition');|  api.slothlet.metadata.remove(api.math.add, 'label'); // remove key|  api.slothlet.metadata.remove(api.math.add); // remove all|})();%% %%example: // CJS usage via slothlet API (inside async function)|const slothlet = require("@cldmv/slothlet");|const api = await slothlet({ dir: './api' });|api.slothlet.metadata.set(api.math.add, 'label', 'Addition');|api.slothlet.metadata.remove(api.math.add, 'label'); // remove key|api.slothlet.metadata.remove(api.math.add); // remove all%%
 * @property {Function} slothlet.metadata.removeFor - Remove path-level metadata for a given API path or moduleID. %%sig: (pathOrModuleId: string, [key]: string|Array.<string>): void%% %%example: // ESM usage via slothlet API|import slothlet from "@cldmv/slothlet";|const api = await slothlet({ dir: './api' });|api.slothlet.metadata.removeFor('math', 'label'); // remove 'label' from all math functions|api.slothlet.metadata.removeFor('math'); // remove all metadata%% %%example: // ESM usage via slothlet API (inside async function)|async function example() {|  const { default: slothlet } = await import("@cldmv/slothlet");|  const api = await slothlet({ dir: './api' });|  api.slothlet.metadata.removeFor('math', 'label'); // remove 'label' from all math functions|  api.slothlet.metadata.removeFor('math'); // remove all metadata|}%% %%example: // CJS usage via slothlet API (top-level)|let slothlet;|(async () => {|  ({ slothlet } = await import("@cldmv/slothlet"));|  const api = await slothlet({ dir: './api' });|  api.slothlet.metadata.removeFor('math', 'label'); // remove 'label' from all math functions|  api.slothlet.metadata.removeFor('math'); // remove all metadata|})();%% %%example: // CJS usage via slothlet API (inside async function)|const slothlet = require("@cldmv/slothlet");|const api = await slothlet({ dir: './api' });|api.slothlet.metadata.removeFor('math', 'label'); // remove 'label' from all math functions|api.slothlet.metadata.removeFor('math'); // remove all metadata%%
 * @property {function(): Object|null} slothlet.metadata.self - Get metadata for the currently-executing API function (runtime-injected). %%sig: (): Object|null%% %%example: // ESM usage via slothlet API|import slothlet from "@cldmv/slothlet";|const api = await slothlet({ dir: './api' });|api.slothlet.metadata.set(api.math.add, 'label', 'Addition');|// Inside api.math.add, get its own metadata:|const ownMeta = api.slothlet.metadata.self(); // { label: 'Addition' }%% %%example: // ESM usage via slothlet API (inside async function)|async function example() {|  const { default: slothlet } = await import("@cldmv/slothlet");|  const api = await slothlet({ dir: './api' });|  api.slothlet.metadata.set(api.math.add, 'label', 'Addition');|  // Inside api.math.add, get its own metadata:|  const ownMeta = api.slothlet.metadata.self(); // { label: 'Addition' }|}%% %%example: // CJS usage via slothlet API (top-level)|let slothlet;|(async () => {|  ({ slothlet } = await import("@cldmv/slothlet"));|  const api = await slothlet({ dir: './api' });|  api.slothlet.metadata.set(api.math.add, 'label', 'Addition');|  // Inside api.math.add, get its own metadata:|  const ownMeta = api.slothlet.metadata.self(); // { label: 'Addition' }|})();%% %%example: // CJS usage via slothlet API (inside async function)|const slothlet = require("@cldmv/slothlet");|const api = await slothlet({ dir: './api' });|api.slothlet.metadata.set(api.math.add, 'label', 'Addition');|// Inside api.math.add, get its own metadata:|const ownMeta = api.slothlet.metadata.self(); // { label: 'Addition' }%%
 * @property {Function} slothlet.metadata.set - Set per-function metadata by direct function reference. %%sig: (fn: function, key: string, value: *): void%% %%example: // ESM usage via slothlet API|import slothlet from "@cldmv/slothlet";|const api = await slothlet({ dir: './api' });|api.slothlet.metadata.set(api.math.add, 'label', 'Addition');|api.slothlet.metadata.set(api.math.add, 'tags', ['math', 'util']);%% %%example: // ESM usage via slothlet API (inside async function)|async function example() {|  const { default: slothlet } = await import("@cldmv/slothlet");|  const api = await slothlet({ dir: './api' });|  api.slothlet.metadata.set(api.math.add, 'label', 'Addition');|  api.slothlet.metadata.set(api.math.add, 'tags', ['math', 'util']);|}%% %%example: // CJS usage via slothlet API (top-level)|let slothlet;|(async () => {|  ({ slothlet } = await import("@cldmv/slothlet"));|  const api = await slothlet({ dir: './api' });|  api.slothlet.metadata.set(api.math.add, 'label', 'Addition');|  api.slothlet.metadata.set(api.math.add, 'tags', ['math', 'util']);|})();%% %%example: // CJS usage via slothlet API (inside async function)|const slothlet = require("@cldmv/slothlet");|const api = await slothlet({ dir: './api' });|api.slothlet.metadata.set(api.math.add, 'label', 'Addition');|api.slothlet.metadata.set(api.math.add, 'tags', ['math', 'util']);%%
 * @property {Function} slothlet.metadata.setFor - Set metadata for all functions reachable under an API path or moduleID. %%sig: (pathOrModuleId: string, keyOrObj: string|Object, [value]: *): void%% %%example: // ESM usage via slothlet API|import slothlet from "@cldmv/slothlet";|const api = await slothlet({ dir: './api' });|api.slothlet.metadata.setFor('math', 'category', 'utilities');|api.slothlet.metadata.setFor('math', { category: 'utils', version: '1.0' });%% %%example: // ESM usage via slothlet API (inside async function)|async function example() {|  const { default: slothlet } = await import("@cldmv/slothlet");|  const api = await slothlet({ dir: './api' });|  api.slothlet.metadata.setFor('math', 'category', 'utilities');|  api.slothlet.metadata.setFor('math', { category: 'utils', version: '1.0' });|}%% %%example: // CJS usage via slothlet API (top-level)|let slothlet;|(async () => {|  ({ slothlet } = await import("@cldmv/slothlet"));|  const api = await slothlet({ dir: './api' });|  api.slothlet.metadata.setFor('math', 'category', 'utilities');|  api.slothlet.metadata.setFor('math', { category: 'utils', version: '1.0' });|})();%% %%example: // CJS usage via slothlet API (inside async function)|const slothlet = require("@cldmv/slothlet");|const api = await slothlet({ dir: './api' });|api.slothlet.metadata.setFor('math', 'category', 'utilities');|api.slothlet.metadata.setFor('math', { category: 'utils', version: '1.0' });%%
 * @property {Function} slothlet.metadata.setGlobal - Set global metadata applied to every function in the instance. %%sig: (key: string, value: *): void%% %%example: // ESM usage via slothlet API|import slothlet from "@cldmv/slothlet";|const api = await slothlet({ dir: './api' });|api.slothlet.metadata.setGlobal('version', '2.0');|// Every function now has metadata: { version: '2.0' }%% %%example: // ESM usage via slothlet API (inside async function)|async function example() {|  const { default: slothlet } = await import("@cldmv/slothlet");|  const api = await slothlet({ dir: './api' });|  api.slothlet.metadata.setGlobal('version', '2.0');|  // Every function now has metadata: { version: '2.0' }|}%% %%example: // CJS usage via slothlet API (top-level)|let slothlet;|(async () => {|  ({ slothlet } = await import("@cldmv/slothlet"));|  const api = await slothlet({ dir: './api' });|  api.slothlet.metadata.setGlobal('version', '2.0');|  // Every function now has metadata: { version: '2.0' }|})();%% %%example: // CJS usage via slothlet API (inside async function)|const slothlet = require("@cldmv/slothlet");|const api = await slothlet({ dir: './api' });|api.slothlet.metadata.setGlobal('version', '2.0');|// Every function now has metadata: { version: '2.0' }%%
 * @property {object} slothlet.owner - Direct path ownership accessor (shorthand for `slothlet.ownership`).
 * @property {Function} slothlet.owner.get - Get ownership info for a specific API path. %%sig: (apiPath: string): Object%% %%example: // ESM usage via slothlet API|import slothlet from "@cldmv/slothlet";|const api = await slothlet({ dir: './api' });|const info = api.slothlet.owner.get('math.add');|// { path: 'math.add', owners: Set { 'utils/math.mjs' } }%% %%example: // ESM usage via slothlet API (inside async function)|async function example() {|  const { default: slothlet } = await import("@cldmv/slothlet");|  const api = await slothlet({ dir: './api' });|  const info = api.slothlet.owner.get('math.add');|  // { path: 'math.add', owners: Set { 'utils/math.mjs' } }|}%% %%example: // CJS usage via slothlet API (top-level)|let slothlet;|(async () => {|  ({ slothlet } = await import("@cldmv/slothlet"));|  const api = await slothlet({ dir: './api' });|  const info = api.slothlet.owner.get('math.add');|  // { path: 'math.add', owners: Set { 'utils/math.mjs' } }|})();%% %%example: // CJS usage via slothlet API (inside async function)|const slothlet = require("@cldmv/slothlet");|const api = await slothlet({ dir: './api' });|const info = api.slothlet.owner.get('math.add');|// { path: 'math.add', owners: Set { 'utils/math.mjs' } }%%
 * @property {object} slothlet.ownership - Module ownership registry.
 * @property {Function} slothlet.ownership.get - Get the set of moduleIDs that own a given API path. %%sig: (apiPath: string): Set.<string>%% %%example: // ESM usage via slothlet API|import slothlet from "@cldmv/slothlet";|const api = await slothlet({ dir: './api' });|const owners = api.slothlet.ownership.get('math.add');|// Set { 'utils/math.mjs' }%% %%example: // ESM usage via slothlet API (inside async function)|async function example() {|  const { default: slothlet } = await import("@cldmv/slothlet");|  const api = await slothlet({ dir: './api' });|  const owners = api.slothlet.ownership.get('math.add');|  // Set { 'utils/math.mjs' }|}%% %%example: // CJS usage via slothlet API (top-level)|let slothlet;|(async () => {|  ({ slothlet } = await import("@cldmv/slothlet"));|  const api = await slothlet({ dir: './api' });|  const owners = api.slothlet.ownership.get('math.add');|  // Set { 'utils/math.mjs' }|})();%% %%example: // CJS usage via slothlet API (inside async function)|const slothlet = require("@cldmv/slothlet");|const api = await slothlet({ dir: './api' });|const owners = api.slothlet.ownership.get('math.add');|// Set { 'utils/math.mjs' }%%
 * @property {Function} slothlet.ownership.unregister - Unregister a module from all ownership records. %%sig: (moduleID: string): void%% %%example: // ESM usage via slothlet API|import slothlet from "@cldmv/slothlet";|const api = await slothlet({ dir: './api' });|await api.slothlet.api.remove('math');|api.slothlet.ownership.unregister('utils/math.mjs');%% %%example: // ESM usage via slothlet API (inside async function)|async function example() {|  const { default: slothlet } = await import("@cldmv/slothlet");|  const api = await slothlet({ dir: './api' });|  await api.slothlet.api.remove('math');|  api.slothlet.ownership.unregister('utils/math.mjs');|}%% %%example: // CJS usage via slothlet API (top-level)|let slothlet;|(async () => {|  ({ slothlet } = await import("@cldmv/slothlet"));|  const api = await slothlet({ dir: './api' });|  await api.slothlet.api.remove('math');|  api.slothlet.ownership.unregister('utils/math.mjs');|})();%% %%example: // CJS usage via slothlet API (inside async function)|const slothlet = require("@cldmv/slothlet");|const api = await slothlet({ dir: './api' });|await api.slothlet.api.remove('math');|api.slothlet.ownership.unregister('utils/math.mjs');%%
 * @property {object} [slothlet.reference] - The `reference` object from config, merged onto the root API and accessible here.
 * @property {Function} slothlet.reload - Reload the entire instance (re-scans the directory and recreates all module references). Accepts `{ keepInstanceID: boolean }`. %%sig: ([options]: Object): Promise.<void>%% %%example: // ESM usage via slothlet API|import slothlet from "@cldmv/slothlet";|const api = await slothlet({ dir: './api' });|await api.slothlet.reload(); // full reload%% %%example: // ESM usage via slothlet API (inside async function)|async function example() {|  const { default: slothlet } = await import("@cldmv/slothlet");|  const api = await slothlet({ dir: './api' });|  await api.slothlet.reload(); // full reload|}%% %%example: // CJS usage via slothlet API (top-level)|let slothlet;|(async () => {|  ({ slothlet } = await import("@cldmv/slothlet"));|  const api = await slothlet({ dir: './api' });|  await api.slothlet.reload(); // full reload|})();%% %%example: // CJS usage via slothlet API (inside async function)|const slothlet = require("@cldmv/slothlet");|const api = await slothlet({ dir: './api' });|await api.slothlet.reload(); // full reload%%
 * @property {Function} slothlet.run - Execute a callback with isolated per-request context data. Convenience alias for `slothlet.context.run()`. %%sig: (contextData: Object, callback: function, args: *): *%% %%example: // ESM usage via slothlet API|import slothlet from "@cldmv/slothlet";|const api = await slothlet({ dir: './api' });|const result = await api.slothlet.run({ userId: 42 }, async () => {|  return api.myModule.getUser();|});%% %%example: // ESM usage via slothlet API (inside async function)|async function example() {|  const { default: slothlet } = await import("@cldmv/slothlet");|  const api = await slothlet({ dir: './api' });|  const result = await api.slothlet.run({ userId: 42 }, async () => {|    return api.myModule.getUser();|  });|}%% %%example: // CJS usage via slothlet API (top-level)|let slothlet;|(async () => {|  ({ slothlet } = await import("@cldmv/slothlet"));|  const api = await slothlet({ dir: './api' });|  const result = await api.slothlet.run({ userId: 42 }, async () => {|    return api.myModule.getUser();|  });|})();%% %%example: // CJS usage via slothlet API (inside async function)|const slothlet = require("@cldmv/slothlet");|const api = await slothlet({ dir: './api' });|const result = await api.slothlet.run({ userId: 42 }, async () => {|  return api.myModule.getUser();|});%%
 * @property {Function} slothlet.scope - Execute a function with full structured per-request context options. Convenience alias for `slothlet.context.scope()`. %%sig: (options: Object): *%% %%example: // ESM usage via slothlet API|import slothlet from "@cldmv/slothlet";|const api = await slothlet({ dir: './api' });|const result = await api.slothlet.scope({|  context: { userId: 42 },|  fn: async () => api.myModule.getUser()|});%% %%example: // ESM usage via slothlet API (inside async function)|async function example() {|  const { default: slothlet } = await import("@cldmv/slothlet");|  const api = await slothlet({ dir: './api' });|  const result = await api.slothlet.scope({|    context: { userId: 42 },|    fn: async () => api.myModule.getUser()|  });|}%% %%example: // CJS usage via slothlet API (top-level)|let slothlet;|(async () => {|  ({ slothlet } = await import("@cldmv/slothlet"));|  const api = await slothlet({ dir: './api' });|  const result = await api.slothlet.scope({|    context: { userId: 42 },|    fn: async () => api.myModule.getUser()|  });|})();%% %%example: // CJS usage via slothlet API (inside async function)|const slothlet = require("@cldmv/slothlet");|const api = await slothlet({ dir: './api' });|const result = await api.slothlet.scope({|  context: { userId: 42 },|  fn: async () => api.myModule.getUser()|});%%
 * @property {function(): Promise.<void>} slothlet.shutdown - Shut down the instance and release all resources. %%sig: (): Promise.<void>%% %%example: // ESM usage via slothlet API|import slothlet from "@cldmv/slothlet";|const api = await slothlet({ dir: './api' });|await api.slothlet.shutdown();%% %%example: // ESM usage via slothlet API (inside async function)|async function example() {|  const { default: slothlet } = await import("@cldmv/slothlet");|  const api = await slothlet({ dir: './api' });|  await api.slothlet.shutdown();|}%% %%example: // CJS usage via slothlet API (top-level)|let slothlet;|(async () => {|  ({ slothlet } = await import("@cldmv/slothlet"));|  const api = await slothlet({ dir: './api' });|  await api.slothlet.shutdown();|})();%% %%example: // CJS usage via slothlet API (inside async function)|const slothlet = require("@cldmv/slothlet");|const api = await slothlet({ dir: './api' });|await api.slothlet.shutdown();%%
 */
