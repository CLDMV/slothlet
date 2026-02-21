/**
 *	@Project: @cldmv/slothlet
 *	@Filename: /src/lib/handlers/unified-wrapper.mjs
 *	@Date: 2026-01-30 16:47:31 -08:00 (1769820451)
 *	@Author: Nate Hyson <CLDMV>
 *	@Email: <Shinrai@users.noreply.github.com>
 *	-----
 *	@Last modified by: Nate Hyson <CLDMV> (Shinrai@users.noreply.github.com)
 *	@Last modified time: 2026-02-20 19:24:31 -08:00 (1771644271)
 *	-----
 *	@Copyright: Copyright (c) 2013-2026 Catalyzed Motivation Inc. All rights reserved.
 */

/**
 * @fileoverview Unified wrapper - combines __impl pattern, lazy/eager modes, materialization, and context binding
 * @module @cldmv/slothlet/handlers/unified-wrapper
 */

// Symbol to mark properties added during collision merge (so materialization knows to allow folder children alongside them)
const COLLISION_MERGED_PROPERTY = Symbol("collisionMergedProperty");
import util from "node:util";
import { ComponentBase } from "@cldmv/slothlet/factories/component-base";

/**
 * Symbol to detect errors already processed by hook error handlers
 * Must match the symbol from hook-manager.mjs
 * @private
 */
const ERROR_HOOK_PROCESSED = Symbol.for("@cldmv/slothlet/hook-error-processed");

/**
 * Check OWN properties only (not inherited from ComponentBase prototype).
 * ComponentBase defines getters like 'config', 'debug' on prototype that would
 * incorrectly match with `prop in wrapper`, shadowing adopted child wrappers.
 * @param {Object} obj - Object to check
 * @param {string|symbol} key - Property key
 * @returns {boolean} True if obj has own property key
 * @private
 */
const hasOwn = (obj, key) => Object.prototype.hasOwnProperty.call(obj, key);

/**
 * Extract the original error from a SlothletError wrapper if present.
 * Hooks should receive the actual error that occurred, not the wrapped SlothletError.
 * @param {Error} error - Error to unwrap
 * @returns {Error} Original error if wrapped, otherwise the error itself
 * @private
 */
function unwrapError(error) {
	// If error is a SlothletError with an originalError, return that
	if (error && error.name === "SlothletError" && error.originalError) {
		return error.originalError;
	}
	return error;
}

const wrapperDebugEnabled =
	process.env.SLOTHLET_DEBUG_WRAPPER === "1" ||
	process.env.SLOTHLET_DEBUG_WRAPPER === "true" ||
	process.env.SLOTHLET_DEBUG_SCRIPT_VERBOSE === "1" ||
	process.env.SLOTHLET_DEBUG_SCRIPT_VERBOSE === "true";

/**
 * Symbols for __type property states
 * @public
 */
export const TYPE_STATES = {
	UNMATERIALIZED: Symbol("unmaterialized"),
	IN_FLIGHT: Symbol("inFlight")
};

/**
 * Build a safe function name for debugging and inspection output.
 * @param {string} apiPath - API path to derive a name from.
 * @param {string} fallback - Fallback name when a safe name cannot be derived.
 * @returns {string} Safe function name.
 */
function getSafeFunctionName(apiPath, fallback) {
	const parts = String(apiPath || "")
		.split(".")
		.filter((part) => part && part !== "null");
	const baseName = parts.length > 0 ? parts[parts.length - 1] : "";
	let safeName = String(baseName || "").replace(/[^A-Za-z0-9_$]/g, "_");
	if (!safeName || !/^[A-Za-z_$]/.test(safeName[0])) {
		safeName = safeName ? `_${safeName}` : "";
	}
	return safeName || fallback;
}

/**
 * Create a named proxy target function for clearer debug output.
 * @param {string} nameHint - Name hint derived from apiPath.
 * @param {string} fallback - Fallback function name if nameHint is unusable.
 * @returns {Function} Named proxy target function.
 */
function createNamedProxyTarget(nameHint, fallback) {
	const safeName = getSafeFunctionName(nameHint, fallback);
	return { [safeName]: function () {} }[safeName];
}

/**
 * Module-level registry mapping each proxy to its backing UnifiedWrapper.
 * Populated by createProxy() and queried by resolveWrapper().
 * @private
 */
const _proxyRegistry = new WeakMap();

/**
 * Unified wrapper class that handles all proxy concerns in one place:
 * - __impl pattern for reload support
 * - Lazy/eager mode materialization
 * - Recursive waiting proxy for deep lazy loading
 * - Context binding through contextManager
 *
 * @class
 * @extends ComponentBase
 * @public
 */
export class UnifiedWrapper extends ComponentBase {
	/**
	 * @private
	 * @description
	 * Private field holding all internal wrapper state. Backed by a prototype getter so
	 * internal framework code can access `wrapper.____slothletInternal` while the proxy
	 * traps legally return `undefined` (not an own property → no proxy invariant enforcement).
	 */
	#internal = null;

	/**
	 * Internal state accessor used by framework-internal code only.
	 * Backed by the private `#internal` field — prototype property, not an own property,
	 * so proxy invariants never apply and getTrap can legally return undefined for it.
	 *
	 * Uses a private-field brand check (`#internal in this`) so the getter is safe to
	 * invoke with any receiver — including `UnifiedWrapper.prototype` itself during a
	 * prototype chain walk via `Object.getPrototypeOf` — without throwing a TypeError.
	 * @returns {Object|undefined} Internal state container, or undefined for non-instances
	 */
	get ____slothletInternal() {
		if (!(#internal in this)) return undefined;
		return this.#internal;
	}

	/**
	 * @param {Object} slothlet - Slothlet instance (provides contextManager, instanceID, ownership)
	 * @param {Object} options - Configuration options
	 * @param {string} options.mode - "lazy" or "eager"
	 * @param {string} options.apiPath - API path for this wrapper (e.g., "math.advanced.calc")
	 * @param {Object} [options.initialImpl=null] - Initial implementation (null for lazy mode)
	 * @param {Function} [options.materializeFunc=null] - Async function to materialize lazy modules
	 * @param {boolean} [options.isCallable=false] - Whether the wrapper should be callable
	 * @param {boolean} [options.materializeOnCreate=false] - Whether to materialize on creation
	 * @param {string} [options.filePath=null] - File path of the module source
	 * @param {string} [options.moduleID=null] - Module identifier
	 * @param {string} [options.sourceFolder=null] - Source folder for metadata
	 *
	 * @description
	 * Creates a unified wrapper instance for a specific API path. Extends ComponentBase
	 * to access slothlet.contextManager, slothlet.instanceID, and slothlet.handlers.ownership.
	 *
	 * @example
	 * const wrapper = new UnifiedWrapper(this.slothlet, {
	 * 	mode: "lazy",
	 * 	apiPath: "math",
	 * 	initialImpl: null,
	 * 	materializeFunc: async () => import("./math.mjs")
	 * });
	 */
	constructor(
		slothlet,
		{
			mode,
			apiPath,
			initialImpl = null,
			materializeFunc = null,
			isCallable,
			materializeOnCreate = false,
			filePath = null,
			moduleID = null,
			sourceFolder = null
		}
	) {
		super(slothlet);

		// Centralized internal state container — all wrapper metadata lives here.
		// Non-enumerable so it never appears in Object.keys() or user-facing enumerations.
		// Using a null-prototype object avoids any inherited property collisions.
		const isCallableExplicit = typeof isCallable === "boolean";
		const isCallableValue = isCallableExplicit
			? isCallable
			: typeof initialImpl === "function" || (initialImpl && typeof initialImpl.default === "function");
		// isCallableLocked: When true, callable status cannot be upgraded by ___setImpl.
		// Locked when explicitly passed or when already callable. Unlocked in lazy mode
		// where the real impl hasn't arrived yet and may turn out to be callable.
		const isCallableLocked = isCallableValue || isCallableExplicit;

		const internal = Object.create(null);
		internal.id = Math.random().toString(36).substr(2, 9); // Unique ID for debugging
		internal.mode = mode;
		internal.apiPath = apiPath;
		internal.materializeOnCreate = materializeOnCreate;
		internal.isCallable = isCallableValue;
		internal.isCallableLocked = isCallableLocked;
		internal.moduleID = moduleID;
		internal.filePath = filePath;
		internal.sourceFolder = sourceFolder;
		internal.invalid = false;
		internal.state = {
			materialized: initialImpl !== null,
			inFlight: false,
			collisionMode: "merge"
		};
		internal.displayName = apiPath ? `${String(apiPath).replace(/\./g, "__")}__UnifiedWrapper` : "UnifiedWrapper";
		// These are set dynamically by api-assignment.mjs during collision handling:
		// internal.collisionMergedKeys — Set of keys merged from another wrapper
		// internal.childFilePathsPreMaterialize — Map of child key → file path
		// internal.needsImmediateChildAdoption — boolean flag for eager adoption

		// Store internal state in private field — not an own property, invisible to proxy invariants.
		this.#internal = internal;

		// Add wrapper self-reference as getter AFTER ____slothletInternal is set (avoid circular reference in traversal)
		const wrapper = this;
		Object.defineProperty(internal, "wrapper", {
			get() {
				return wrapper;
			},
			enumerable: false,
			configurable: false
		});

		// For callable endpoints, store function in callableImpl (handled in proxy apply trap)
		// Children attach directly to wrapper as properties
		internal.callableImpl = null;

		internal.waitingProxyCache = new Map(); // Cache waiting proxies by propChain key
		internal.proxy = null;

		// Clone to protect API cache from ___adoptImplChildren's delete operations.
		// See static _cloneImpl() for full rationale.
		internal.impl = UnifiedWrapper._cloneImpl(initialImpl);

		internal.materializeFunc = materializeFunc;

		// Emit impl:created event for lifecycle management (wrapper creation)
		if (filePath && slothlet.handlers?.lifecycle) {
			slothlet.handlers.lifecycle.emit("impl:created", {
				apiPath,
				impl: this,
				wrapper: this,
				source: "initial",
				moduleID,
				filePath,
				sourceFolder: sourceFolder || slothlet.config?.dir
			});
		}

		// For eager mode with initial impl, also emit event for impl
		if (initialImpl !== null && filePath && slothlet.handlers?.lifecycle) {
			slothlet.handlers.lifecycle.emit("impl:created", {
				apiPath,
				impl: initialImpl,
				wrapper: this,
				source: "initial",
				moduleID,
				filePath,
				sourceFolder: sourceFolder || slothlet.config?.dir
			});
		}

		if (initialImpl !== null) {
			const implKeys = Object.keys(initialImpl || {});
			if ((wrapperDebugEnabled || this.____config?.debug?.wrapper) && apiPath && (apiPath === "config" || apiPath.startsWith("config."))) {
				this.slothlet.debug("wrapper", {
					message: "UnifiedWrapper constructor - impl keys",
					apiPath,
					keyCount: implKeys.length,
					keySample: implKeys.slice(0, 5)
				});
			}
			this.___adoptImplChildren();
			if ((wrapperDebugEnabled || this.____config?.debug?.wrapper) && apiPath && (apiPath === "config" || apiPath.startsWith("config."))) {
				const childKeys = Object.keys(this).filter((k) => !k.startsWith("_") && !k.startsWith("__"));
				this.slothlet.debug("wrapper", {
					message: "UnifiedWrapper constructor - after adopt",
					apiPath,
					childCount: childKeys.length,
					childKeySample: childKeys.slice(0, 5)
				});
			}
		}

		// Register lazy wrapper for materialization tracking
		if (mode === "lazy") {
			slothlet._registerLazyWrapper();

			// If background materialization is enabled, trigger it (fire-and-forget)
			if (slothlet.config.tracking?.materialization) {
				// Defer to next tick to ensure wrapper and proxy are fully constructed
				// Fire-and-forget: don't await, let it materialize in background
				setImmediate(() => {
					this._materialize().catch((err) => {
						// Silently catch errors - background materialization is best-effort
						if (slothlet.config?.debug?.materialize) {
							slothlet.debug("materialize", {
								message: "Background materialization error",
								apiPath: this.____slothletInternal?.apiPath,
								error: err.message
							});
						}
					});
				});
			}
		}
	}

	/**
	 * Custom inspect output for Node.js util.inspect.
	 * @returns {*} The actual implementation for inspection.
	 */
	[util.inspect.custom](depth, options, inspect) {
		// Show children from wrapper (filter internal properties starting with _ or __)
		const childKeys = Object.keys(this).filter((k) => !k.startsWith("_") && !k.startsWith("__"));
		if (childKeys.length > 0 && !this.____slothletInternal.isCallable) {
			const inspectObj = {};
			for (const key of childKeys) {
				// Return the proxy/wrapper directly - Node will recursively inspect it
				inspectObj[key] = this[key];
			}
			return inspectObj;
		}

		// For callables or leaf nodes - return actual _impl value if materialized
		// For unmaterialized lazy wrappers, return the proxy to show it's a function
		if (
			this.____slothletInternal.mode === "lazy" &&
			this.____slothletInternal.state &&
			!this.____slothletInternal.state.materialized &&
			this.____slothletInternal.proxy
		) {
			return this.____slothletInternal.proxy;
		}
		return this.____slothletInternal.impl;
	}

	/**
	 * Get current implementation
	 * @returns {Object|null} Current __impl value
	 * @public
	 */
	get __impl() {
		return this.____slothletInternal.impl;
	}

	/**
	 * Shallow-clone a non-Proxy object implementation to prevent ___adoptImplChildren
	 * from mutating shared module export references via its `delete this.____slothletInternal.impl[key]`
	 * operations. When concurrent materializations (e.g., old + new wrapper during reload)
	 * both load the same cached module, the first ___adoptImplChildren would destroy the
	 * shared export, causing subsequent wrappers to receive empty objects.
	 *
	 * Returns the value unchanged if it is not a plain object, or if it IS a Proxy
	 * (cloning a Proxy destroys its trap behavior — e.g., LG TV controllers using
	 * numeric-index access through custom get traps).
	 *
	 * @param {*} value - The implementation value to (maybe) clone.
	 * @returns {*} A shallow clone of `value` when it is a non-Proxy plain object,
	 *              otherwise the original `value`.
	 * @static
	 * @private
	 */
	static _cloneImpl(value) {
		if (value && typeof value === "object" && !Array.isArray(value) && typeof value !== "function") {
			if (util.types.isProxy(value)) {
				// Distinguish slothlet wrapper proxies from custom user proxies:
				// - Slothlet wrapper proxies (from api.add()) have ____slothletInternal and must
				//   be shallow-copied into a plain object so that ___adoptImplChildren's delete
				//   operations don't trigger the source proxy's deleteProperty trap (which would
				//   invalidate child wrappers on the original tree).
				// - Custom user proxies (e.g., LGTVControllers with numeric-index get traps)
				//   must NOT be cloned — cloning destroys their custom trap behavior.
				if (value.____slothletInternal) {
					const clone = {};
					for (const key of Reflect.ownKeys(value)) {
						try {
							clone[key] = value[key];
						} catch {
							// Skip keys that throw on access (e.g., proxy invariant violations)
						}
					}
					return clone;
				}
				// Custom user proxy — return as-is to preserve trap behavior
				return value;
			}
			const uw_cloneDescriptors = Object.getOwnPropertyDescriptors(value);
			return Object.create(Object.getPrototypeOf(value), uw_cloneDescriptors);
		}
		return value;
	}

	/**
	 * Reconstruct a full implementation object from a wrapper whose _impl may have
	 * been depleted by ___adoptImplChildren.
	 *
	 * @description
	 * After ___adoptImplChildren runs, children are moved from _impl onto the wrapper as
	 * own properties and deleted from _impl. This helper reconstructs the original
	 * impl by merging the remaining _impl keys with the adopted children extracted
	 * from the wrapper.
	 *
	 * Recursively walks the wrapper tree so nested objects whose _impl was also
	 * depleted are properly reconstructed. For callable (function) impls, returns
	 * the function directly since keepImplProperties prevents depletion.
	 *
	 * @param {Object} wrapper - The UnifiedWrapper instance to extract from
	 * @returns {*} The reconstructed implementation mirroring original module exports
	 * @static
	 * @private
	 */
	static _extractFullImpl(wrapper) {
		if (!wrapper) return null;

		const impl = wrapper.____slothletInternal.impl;

		// Primitives and null/undefined: return directly (no depletion possible)
		if (impl === null || impl === undefined) return impl;
		if (typeof impl !== "object" && typeof impl !== "function") return impl;

		// For functions, keepImplProperties=true means _impl is intact — return as-is
		if (typeof impl === "function") return impl;

		// For objects, reconstruct by merging remaining _impl keys with adopted children
		const extractFullImpl_result = {};

		// Copy remaining _impl keys (not adopted or metadata-protected)
		for (const key of Object.keys(impl)) {
			if (key.startsWith("__")) continue; // Skip metadata like __childFilePaths
			extractFullImpl_result[key] = impl[key];
		}

		// Preserve metadata keys needed by ___createChildWrapper for file path resolution
		if (impl.__childFilePaths) {
			extractFullImpl_result.__childFilePaths = impl.__childFilePaths;
		}
		if (impl.__childFilePathsPreMaterialize) {
			extractFullImpl_result.__childFilePathsPreMaterialize = impl.__childFilePathsPreMaterialize;
		}

		// Add adopted children from wrapper's own enumerable keys
		// Skip builtin keys that should not be extracted as part of impl
		const builtinKeys = new Set(["slothlet", "shutdown", "destroy"]);
		for (const key of Object.keys(wrapper)) {
			if (key.startsWith("_") || key.startsWith("__")) continue;
			if (builtinKeys.has(key)) continue;
			if (key in extractFullImpl_result) continue; // Already from _impl (not depleted for this key)

			const extractFullImpl_child = wrapper[key];
			const _extractChildW = resolveWrapper(extractFullImpl_child);
			if (_extractChildW) {
				// Recursively extract from child wrapper (handles nested depletion)
				extractFullImpl_result[key] = UnifiedWrapper._extractFullImpl(_extractChildW);
			} else {
				extractFullImpl_result[key] = extractFullImpl_child;
			}
		}

		return extractFullImpl_result;
	}

	/**
	 * Core implementation-application logic shared by ___setImpl and lazy materialization.
	 * Clones the implementation (protecting the API cache from ___adoptImplChildren's
	 * delete operations), clears the invalid flag, upgrades __isCallable when a
	 * callable impl arrives on a configurable wrapper, updates __filePath for lazy
	 * folder wrappers, and adopts children.
	 *
	 * @param {*} newImpl - The new implementation value.
	 * @private
	 */
	_applyNewImpl(newImpl) {
		// Clone to protect API cache from ___adoptImplChildren's delete operations.
		// See static _cloneImpl() for full rationale.
		this.____slothletInternal.impl = UnifiedWrapper._cloneImpl(newImpl);
		this.____slothletInternal.invalid = false;

		// Update isCallable if it's currently unlocked (false) and the new impl is callable.
		// In lazy mode, isCallable starts as false/unlocked because initialImpl is null.
		// When the real impl arrives and is a function, upgrade to true and lock it.
		if (
			!this.____slothletInternal.isCallableLocked &&
			!this.____slothletInternal.isCallable &&
			(typeof newImpl === "function" || (newImpl && typeof newImpl.default === "function"))
		) {
			this.____slothletInternal.isCallable = true;
			this.____slothletInternal.isCallableLocked = true;
		}

		// Update wrapper's filePath if not yet set.
		// This handles lazy folder wrappers that import a file — the file path is
		// stored on the impl by modes-processor and needs to be promoted to the wrapper.
		if (!this.____slothletInternal.filePath && this.____slothletInternal.impl && this.____slothletInternal.impl.__filePath) {
			this.____slothletInternal.filePath = this.____slothletInternal.impl.__filePath;
			this.slothlet.debug("wrapper", {
				message: "APPLY-IMPL-UPDATE-PATH: updated filePath from null",
				apiPath: this.____slothletInternal.apiPath,
				filePath: this.____slothletInternal.filePath
			});
		}

		this.___adoptImplChildren();
	}

	/**
	 * Set new implementation and adopt children.
	 * Delegates core impl work to _applyNewImpl, then emits lifecycle events
	 * and updates materialization state.
	 *
	 * @param {*} newImpl - New implementation
	 * @param {string} [moduleID] - Optional moduleID for lifecycle event (for replacements)
	 * @private
	 */
	___setImpl(newImpl, moduleID = null) {
		if ((wrapperDebugEnabled || this.____config?.debug?.wrapper) && this.____slothletInternal.apiPath === "string") {
			this.slothlet.debug("wrapper", {
				message: "___setImpl called",
				apiPath: this.____slothletInternal.apiPath,
				newImplKeys: Object.keys(newImpl || {})
			});
		}

		this._applyNewImpl(newImpl);

		// Emit impl:changed event for lifecycle management
		if (newImpl && this.slothlet.handlers?.lifecycle) {
			const wrapperMetadata = this.slothlet.handlers.metadata.getMetadata(this);
			// Use provided moduleID (for replacements) or extract from metadata
			let extractedModuleId = moduleID || (wrapperMetadata?.moduleID ? wrapperMetadata.moduleID.split(":")[0] : null);

			// CRITICAL: Ensure moduleID is a string, not an object
			// If it's an object (like a wrapper), try to extract the actual ID
			if (extractedModuleId && typeof extractedModuleId !== "string") {
				extractedModuleId = extractedModuleId.moduleID || extractedModuleId.__moduleID || String(extractedModuleId);
			}

			this.slothlet.handlers.lifecycle.emit("impl:changed", {
				apiPath: this.____slothletInternal.apiPath,
				impl: newImpl,
				wrapper: this,
				source: "hot-reload",
				moduleID: extractedModuleId,
				filePath: wrapperMetadata?.filePath,
				sourceFolder: wrapperMetadata?.sourceFolder
			});
		}

		this.____slothletInternal.state.materialized = true;
		this.____slothletInternal.state.inFlight = false;

		// Notify Slothlet that this lazy wrapper has materialized
		if (this.slothlet._onWrapperMaterialized) {
			this.slothlet._onWrapperMaterialized();
		}
	}

	/**
	 * Reset wrapper to un-materialized lazy state with a fresh materialization function.
	 * Used during reload to restore lazy wrappers to their shell state instead of
	 * eagerly loading all implementations. Preserves proxy identity so existing
	 * references continue to work — next property access triggers materialization
	 * from the fresh materializeFunc (which reads updated source files from disk).
	 * @param {Function} newMaterializeFunc - Fresh materialization function from rebuild
	 * @returns {void}
	 * @private
	 */
	___resetLazy(newMaterializeFunc) {
		this.slothlet.debug("wrapper", {
			message: "___resetLazy called",
			apiPath: this.____slothletInternal.apiPath,
			hadImpl: this.____slothletInternal.impl !== null,
			hadChildren: Object.keys(this).filter((k) => !k.startsWith("_") && !k.startsWith("__")).length
		});

		// Invalidate and clear all child wrappers
		for (const key of Reflect.ownKeys(this)) {
			if (typeof key === "string" && (key.startsWith("_") || key.startsWith("__"))) {
				continue;
			}
			const child = this[key];
			const childRaw = resolveWrapper(child);
			if (childRaw) {
				childRaw.___invalidate();
			}
			const descriptor = Object.getOwnPropertyDescriptor(this, key);
			if (descriptor?.configurable) {
				delete this[key];
			}
		}

		// Clear implementation and reset state
		this.____slothletInternal.impl = null;
		this.____slothletInternal.invalid = false;
		this.____slothletInternal.state.materialized = false;
		this.____slothletInternal.state.inFlight = false;

		// Clear materialization promise so next access starts fresh
		this.____slothletInternal.materializationPromise = null;

		// Swap in the fresh materialization function
		this.____slothletInternal.materializeFunc = newMaterializeFunc;

		// Clear waiting proxy cache — stale references from previous materialization
		if (this.____slothletInternal.waitingProxyCache) {
			this.____slothletInternal.waitingProxyCache.clear();
		}

		this.slothlet.debug("wrapper", {
			message: "___resetLazy complete — wrapper is now un-materialized",
			apiPath: this.____slothletInternal.apiPath
		});
	}

	/**
	 * Trigger materialization (lazy mode only)
	 * @returns {Promise<void>}
	 * @private
	 */
	async ___materialize() {
		// If already materialized, return immediately
		if (this.____slothletInternal.state.materialized) {
			return;
		}

		// If wrapper has been invalidated (e.g., parent module removed via api.remove()),
		// skip materialization to avoid registering stale ownership entries.
		if (this.____slothletInternal.invalid) {
			return;
		}

		// If materialization is already in progress, return the existing promise
		// This allows multiple callers to await the same materialization without polling
		if (this.____slothletInternal.materializationPromise) {
			this.slothlet.debug("wrapper", {
				message: "MATERIALIZE-AWAIT: awaiting existing materialization promise",
				apiPath: this.____slothletInternal.apiPath
			});
			return this.____slothletInternal.materializationPromise;
		}

		if ((wrapperDebugEnabled || this.____config?.debug?.wrapper) && this.apiPath === "string") {
			this.slothlet.debug("wrapper", {
				message: "_materialize start",
				apiPath: this.apiPath
			});
		}

		// Create and store the materialization promise
		this.____slothletInternal.materializationPromise = (async () => {
			this.____slothletInternal.state.inFlight = true;

			try {
				if (this.____slothletInternal.materializeFunc) {
					if ((wrapperDebugEnabled || this.____config?.debug?.wrapper) && this.____slothletInternal.apiPath === "string") {
						this.slothlet.debug("wrapper", {
							message: "_materialize calling materializeFunc",
							apiPath: this.____slothletInternal.apiPath
						});
					}
					// POC pattern: materializeFunc can set implementation synchronously via setter
					// This matches v2 behavior where 'materialized' variable is set immediately
					const lazy_setImpl = (value) => {
						this._applyNewImpl(value);
					};
					const result = await this.____slothletInternal.materializeFunc(lazy_setImpl);

					// If materializeFunc didn't call setter, set _impl from return value
					if (!this.____slothletInternal.impl) {
						this._applyNewImpl(result);
					}

					this.____slothletInternal.state.materialized = true;

					// Notify Slothlet that this lazy wrapper has materialized
					if (this.slothlet._onWrapperMaterialized) {
						this.slothlet._onWrapperMaterialized();
					}

					if ((wrapperDebugEnabled || this.____config?.debug?.wrapper) && this.____slothletInternal.apiPath === "string") {
						this.slothlet.debug("wrapper", {
							message: "_materialize complete",
							apiPath: this.____slothletInternal.apiPath,
							resultType: typeof result,
							resultKeys: Object.keys(result || {})
						});
					}
				}
			} catch (error) {
				if ((wrapperDebugEnabled || this.____config?.debug?.wrapper) && this.____slothletInternal.apiPath === "string") {
					this.slothlet.debug("wrapper", {
						message: "_materialize error",
						apiPath: this.____slothletInternal.apiPath,
						error: error.message
					});
				}
				throw error;
			} finally {
				// CRITICAL: Always clear inFlight flag and promise reference
				this.____slothletInternal.state.inFlight = false;
				this.____slothletInternal.materializationPromise = null;
			}
		})();

		// Return the promise so the caller can await it
		return this.____slothletInternal.materializationPromise;
	}

	/**
	 * @private
	 * @returns {Promise<void>}
	 *
	 * @description
	 * Exposes lazy materialization for waiting proxies and nested wrappers.
	 *
	 * @example
	 * await wrapper._materialize();
	 */
	_materialize() {
		return this.___materialize();
	}

	/**
	 * @private
	 * @returns {void}
	 *
	 * @description
	 * Invalidates this wrapper when its parent removes the API path.
	 *
	 * @example
	 * wrapper.___invalidate();
	 */
	___invalidate() {
		this.____slothletInternal.invalid = true;
		this.____slothletInternal.impl = null;
		// Clear all child properties from wrapper (filter internals)
		for (const key of Reflect.ownKeys(this)) {
			if (typeof key === "string" && (key.startsWith("_") || key.startsWith("__"))) {
				continue;
			}
			const descriptor = Object.getOwnPropertyDescriptor(this, key);
			if (descriptor?.configurable) {
				delete this[key];
			}
		}
	}

	/**
	 * @private
	 * @returns {void}
	 *
	 * @description
	 * Moves child properties off the impl and attaches them to wrapper as properties
	 * so this wrapper only represents the current API path.
	 *
	 * @example
	 * wrapper.___adoptImplChildren();
	 */
	___adoptImplChildren() {
		const preExistingKeys = Object.keys(this).filter((k) => !k.startsWith("_") && !k.startsWith("__"));
		this.slothlet.debug("wrapper", {
			message: "ADOPT-START",
			apiPath: this.____slothletInternal.apiPath,
			wrapperId: this.____slothletInternal.id || "no-id",
			preExistingKeys: preExistingKeys.join(","),
			collisionMode: this.____slothletInternal.state.collisionMode
		});

		if (
			!this.____slothletInternal.impl ||
			(typeof this.____slothletInternal.impl !== "object" && typeof this.____slothletInternal.impl !== "function")
		) {
			return;
		}

		const ownKeys = Reflect.ownKeys(this.____slothletInternal.impl);

		const internalKeys = new Set([
			"__impl",
			"___setImpl",
			"___resetLazy",
			"_materialize",
			"_impl",
			"_state",
			"_invalid",
			"____slothlet",
			"____slothletInternal"
		]);
		const keepImplProperties =
			typeof this.____slothletInternal.impl === "function" ||
			(this.____slothletInternal.impl &&
				typeof this.____slothletInternal.impl === "object" &&
				typeof this.____slothletInternal.impl.default === "function");
		if (
			keepImplProperties &&
			this.____slothletInternal.impl &&
			typeof this.____slothletInternal.impl === "object" &&
			typeof this.____slothletInternal.impl.default === "function"
		) {
			internalKeys.add("default");
		}
		const observedKeys = new Set();

		// CRITICAL: Check stored collision mode to determine how to handle existing properties
		// - For "replace" mode: Clear existing properties before adopting new ones
		// - For "merge" or "merge-replace": Keep existing properties and merge
		const existingKeys = Object.keys(this).filter((k) => !k.startsWith("_") && !k.startsWith("__"));
		const storedCollisionMode = this.____slothletInternal.state.collisionMode; // Set during collision in api-assignment.mjs
		const isMergeScenario = storedCollisionMode !== "replace" && existingKeys.length > 0;

		this.slothlet.debug("wrapper", {
			message: "ADOPT",
			apiPath: this.____slothletInternal.apiPath,
			mode: this.____slothletInternal.mode,
			storedCollisionMode,
			existingKeys: existingKeys.join(","),
			isMergeScenario
		});

		// If collision mode is "replace", clear existing properties from collision
		// CRITICAL: Save existing child wrapper references BEFORE deleting so they can be
		// reused during adoption to preserve proxy identity (reference stability across reload).
		const savedChildren = new Map();
		if (storedCollisionMode === "replace" && existingKeys.length > 0) {
			this.slothlet.debug("wrapper", {
				message: "ADOPT: REPLACE MODE - Clearing existing properties",
				count: existingKeys.length
			});

			for (const key of existingKeys) {
				const child = this[key];
				if (resolveWrapper(child) !== null) {
					savedChildren.set(key, child);
				}
				const descriptor = Object.getOwnPropertyDescriptor(this, key);
				if (descriptor?.configurable) {
					delete this[key];
				}
			}
			// Don't add to observedKeys - let them be replaced
		} else {
			// For merge modes, add existing wrapper keys to observedKeys so they don't get deleted
			for (const key of existingKeys) {
				observedKeys.add(key);
			}
		}

		// Define metadata/helper keys that should never be adopted as children
		const metadataKeys = new Set(["__childFilePaths", "__filePath", "__childFilePathsPreMaterialize"]);
		const skipKeys = typeof this.____slothletInternal.impl === "function" ? new Set(["length", "name", "prototype"]) : null;
		// Skip builtin properties that are added by buildFinalAPI (should not be wrapped as children)
		const builtinKeys = new Set(["slothlet", "shutdown", "destroy"]);

		for (const key of ownKeys) {
			if (internalKeys.has(key)) {
				continue;
			}
			// Skip metadata/helper keys
			if (typeof key === "string" && metadataKeys.has(key)) {
				continue;
			}
			// Skip builtin keys (added by buildFinalAPI, not user exports)
			if (typeof key === "string" && builtinKeys.has(key)) {
				continue;
			}
			if (skipKeys && typeof key === "string" && skipKeys.has(key)) {
				continue;
			}
			// DEFENSIVE: _impl might have changed during iteration (shouldn't happen, but safety first)
			if (
				!this.____slothletInternal.impl ||
				(typeof this.____slothletInternal.impl !== "object" && typeof this.____slothletInternal.impl !== "function")
			) {
				break;
			}
			const descriptor = Object.getOwnPropertyDescriptor(this.____slothletInternal.impl, key);
			if (!descriptor) {
				continue;
			}
			const value = this.____slothletInternal.impl[key];
			if (value === this.____slothletInternal.impl) {
				continue;
			}
			// Skip logging if key is a symbol (can't convert to string)
			if (typeof key !== "symbol") {
				this.slothlet.debug("wrapper", {
					message: "ADOPT-PROCESS",
					apiPath: this.____slothletInternal.apiPath,
					key,
					typeOf: typeof value,
					valueName: value?.name
				});
			}
			observedKeys.add(key);

			// CRITICAL: Check if wrapper already has this key (from collision merge)
			// Use hasOwn to avoid matching ComponentBase prototype getters (config, debug)
			if (hasOwn(this, key) && !key.toString().startsWith("_")) {
				// Check if this is a collision-merged property (from file)
				// Skip logging if key is a symbol
				if (typeof key !== "symbol") {
					this.slothlet.debug("wrapper", {
						message: "ADOPT-CHECK",
						apiPath: this.____slothletInternal.apiPath,
						key,
						has__collisionMergedKeys: !!this.____slothletInternal.collisionMergedKeys,
						inSet: this.____slothletInternal.collisionMergedKeys?.has(key)
					});
				}
				const isCollisionMerged = this.____slothletInternal.collisionMergedKeys && this.____slothletInternal.collisionMergedKeys.has(key);

				if (isCollisionMerged) {
					// Collision-merged means this key came from file exports that won during merge.
					// The file's version takes precedence — do NOT update with the folder's version.
					// Just clean up the impl key and skip.
					if (typeof key !== "symbol") {
						this.slothlet.debug("wrapper", {
							message: "ADOPT-SKIP: is collision-merged, keeping file version",
							apiPath: this.____slothletInternal.apiPath,
							key
						});
					}
					if (descriptor.configurable) {
						delete this.____slothletInternal.impl[key];
					}
					continue;
				}
				// Property exists but is NOT collision-merged
				// This could be from a previous materialization or folder children that should coexist
				// DON'T skip - fall through to add folder child alongside file properties
				if (typeof key !== "symbol") {
					this.slothlet.debug("wrapper", {
						message: "ADOPT-ALLOW: is NOT collision-merged, allowing",
						apiPath: this.____slothletInternal.apiPath,
						key
					});
				}
			}

			// CRITICAL: Check if child wrapper already exists to maintain live binding
			// If it exists, update its implementation instead of creating new wrapper
			// Also check savedChildren map for wrappers saved before replace-mode deletion.
			// IMPORTANT: Check savedChildren FIRST because after replace-mode deletion of
			// own properties, prototype getters (e.g. ComponentBase's '____config', 'debug')
			// shadow the lookup — this[key] returns the prototype getter result (truthy
			// but not a wrapper), preventing the || fallback from reaching savedChildren.
			const existingChild = savedChildren.get(key) || this[key];
			let wrapped;

			// LAZY REFERENCE CONTRACT: In lazy+replace mode (reload), do NOT reuse
			// existing child wrappers — create fresh ones so references break.
			// In merge mode (multi-cache subsequent modules), reuse children from
			// the current reload cycle so keys from prior modules aren't lost.
			const skipChildReuse = this.____slothletInternal.mode === "lazy" && storedCollisionMode === "replace";

			if (!skipChildReuse && existingChild && resolveWrapper(existingChild) !== null) {
				// Reuse existing wrapper - update its implementation to maintain live binding
				// CRITICAL: If value is one of our wrapper proxies, extract its raw _impl instead
				// of passing the proxy to ___setImpl — doing so causes infinite recursion in getTrap.
				if (resolveWrapper(value) !== null) {
					// Extract the raw impl from the new wrapper proxy or raw wrapper instance.
					const newWrapper = resolveWrapper(value);
					let rawImpl = newWrapper ? newWrapper.____slothletInternal.impl : null;

					// CRITICAL: _impl may be depleted — ___adoptImplChildren moves children from
					// _impl onto the wrapper as own properties and deletes them from _impl.
					// When _impl is an empty object but the wrapper has own enumerable keys,
					// use _extractFullImpl to reconstruct the complete impl from the wrapper tree.
					if (
						rawImpl &&
						typeof rawImpl === "object" &&
						!Array.isArray(rawImpl) &&
						typeof rawImpl !== "function" &&
						Object.keys(rawImpl).filter((k) => !k.startsWith("__")).length === 0
					) {
						const wrapperOwnKeys = Object.keys(newWrapper).filter((k) => !k.startsWith("_") && !k.startsWith("__"));
						if (wrapperOwnKeys.length > 0) {
							rawImpl = UnifiedWrapper._extractFullImpl(newWrapper);
						}
					}

					if (rawImpl !== null && rawImpl !== undefined) {
						resolveWrapper(existingChild).___setImpl(
							rawImpl,
							this.slothlet,
							this.____slothletInternal.moduleID,
							this.____slothletInternal.filePath
						);
					} else if (newWrapper && newWrapper.____slothletInternal.materializeFunc) {
						// Lazy wrapper not yet materialized — fully reset existing child to lazy
						// state using ___resetLazy for proper cleanup (clears stale _impl,
						// children, caches, and inFlight flag before swapping materializeFunc).
						const existingChildWrapper = resolveWrapper(existingChild);
						if (existingChildWrapper) {
							existingChildWrapper.___resetLazy(newWrapper.____slothletInternal.materializeFunc);
						}
					}
					wrapped = existingChild;
				} else {
					resolveWrapper(existingChild).___setImpl(
						value,
						this.slothlet,
						this.____slothletInternal.moduleID,
						this.____slothletInternal.filePath
					);
					wrapped = existingChild;
				}
				if (typeof key !== "symbol") {
					this.slothlet.debug("wrapper", {
						message: "ADOPT-REUSE: Reused existing child wrapper",
						apiPath: this.____slothletInternal.apiPath,
						key
					});
				}
			} else {
				// No existing wrapper - create new one
				wrapped = this.___createChildWrapper(key, value);
				if (typeof key !== "symbol") {
					this.slothlet.debug("wrapper", {
						message: "ADOPT-WRAP",
						apiPath: this.____slothletInternal.apiPath,
						key,
						wrapped: wrapped ? "YES" : wrapped === null ? "NULL" : "NO"
					});
				}
			}

			if (wrapped) {
				// Store wrapper as property on wrapper itself (where proxy handlers can see it)
				// Only define if property doesn't exist or is different wrapper
				const existing = this[key];
				const existingDescriptor = Object.getOwnPropertyDescriptor(this, key);

				// Skip if property exists with same wrapper, or if it's non-configurable (like 'slothlet' from ComponentBase)
				if (existing === wrapped || (existingDescriptor && !existingDescriptor.configurable)) {
					if (typeof key !== "symbol") {
						this.slothlet.debug("wrapper", {
							message:
								existingDescriptor && !existingDescriptor.configurable
									? "ADOPT-SKIP: property is non-configurable (inherited)"
									: "ADOPT-SKIP: property already exists with same wrapper",
							apiPath: this.____slothletInternal.apiPath,
							key
						});
					}
				} else {
					if (typeof key !== "symbol") {
						this.slothlet.debug("wrapper", {
							message: "ADOPT-DEFINE: defining on wrapper",
							apiPath: this.____slothletInternal.apiPath,
							key
						});
					}
					Object.defineProperty(this, key, {
						value: wrapped,
						writable: false,
						enumerable: true,
						configurable: true
					});
					if (typeof key !== "symbol") {
						this.slothlet.debug("wrapper", {
							message: "ADOPT-DEFINED: defined successfully on wrapper",
							apiPath: this.____slothletInternal.apiPath,
							key
						});
					}
				}
				if (descriptor.configurable && !keepImplProperties && this.____slothletInternal.impl) {
					delete this.____slothletInternal.impl[key];
				}
			} else if (wrapped === null) {
				// ___createChildWrapper returned null, meaning this value should be stored unwrapped
				Object.defineProperty(this, key, {
					value: value,
					writable: false,
					enumerable: true,
					configurable: true
				});
				if (descriptor.configurable && !keepImplProperties && this.____slothletInternal.impl) {
					delete this.____slothletInternal.impl[key];
				}
			} else {
				// wrapped is falsy but not null - shouldn't happen, but define value anyway
				Object.defineProperty(this, key, {
					value: value,
					writable: false,
					enumerable: true,
					configurable: true
				});
				if (descriptor.configurable && !keepImplProperties && this.____slothletInternal.impl) {
					delete this.____slothletInternal.impl[key];
				}
			}
		}

		// Only clean up unobserved keys if this is NOT a merge scenario
		// In merge mode (isMergeScenario=true), we want to keep ALL existing entries
		if (!isMergeScenario) {
			const currentKeys = Object.keys(this).filter((k) => !k.startsWith("_") && !k.startsWith("__"));
			for (const key of currentKeys) {
				if (!observedKeys.has(key)) {
					const existing = this[key];
					const existingRaw = resolveWrapper(existing);
					if (existingRaw) {
						existingRaw.___invalidate();
					}
					const descriptor = Object.getOwnPropertyDescriptor(this, key);
					if (descriptor?.configurable) {
						delete this[key];
					}
				}
			}
		}

		// Handle merge-after-materialize for lazy wrappers in merge-replace mode
		if (this._mergeAfterMaterialize) {
			const { existingWrapper, isMergeReplace } = this._mergeAfterMaterialize;

			// Now that this wrapper has materialized with its own keys,
			// add non-conflicting keys from the existing wrapper
			const existingKeys = Object.keys(existingWrapper).filter((k) => !k.startsWith("_") && !k.startsWith("__"));
			for (const key of existingKeys) {
				if (!(key in this) || key.startsWith("_") || key.startsWith("__")) {
					const child = existingWrapper[key];
					Object.defineProperty(this, key, {
						value: child,
						writable: false,
						enumerable: true,
						configurable: true
					});
				}
			}

			// Clear the merge info
			delete this._mergeAfterMaterialize;
		}
	}

	/**
	 * @private
	 * @param {string|symbol} key - Child property name
	 * @param {unknown} value - Child value
	 * @returns {Object|Function|undefined} Wrapped child proxy when applicable
	 *
	 * @description
	 * Creates a child wrapper for impl values, including primitives.
	 *
	 * @example
	 * const child = wrapper.___createChildWrapper("add", fn);
	 */
	___createChildWrapper(key, value) {
		if (value === undefined) {
			return undefined;
		}

		if (value && resolveWrapper(value) !== null) {
			return value;
		}

		// Return null for built-in objects that require proper 'this' binding
		// Returning null signals to the caller to store the value unwrapped
		// These include: Map, Set, WeakMap, WeakSet, Date, RegExp, Promise, Error, TypedArrays
		if (
			value instanceof Map ||
			value instanceof Set ||
			value instanceof WeakMap ||
			value instanceof WeakSet ||
			value instanceof Date ||
			value instanceof RegExp ||
			value instanceof Promise ||
			value instanceof Error ||
			ArrayBuffer.isView(value) ||
			value instanceof ArrayBuffer
		) {
			return null;
		}

		let childImpl = value;
		if (this.____slothletInternal.mode === "eager" && childImpl && typeof childImpl === "object") {
			if (Array.isArray(childImpl)) {
				childImpl = childImpl.slice();
			} else {
				const descriptors = Object.getOwnPropertyDescriptors(childImpl);
				childImpl = Object.create(Object.getPrototypeOf(childImpl), descriptors);
			}
		}

		// Get parent wrapper's metadata to inherit filePath and moduleID
		const parentMetadata = this.slothlet.handlers?.metadata?.getMetadata(this);

		// Try to get child's actual filePath from its own metadata first (if already tagged during materialization)
		const childExistingMetadata = this.slothlet.handlers?.metadata?.getMetadata(value);
		let childFilePath = childExistingMetadata?.filePath || null;
		let childModuleId = null;

		if (!childFilePath) {
			// No existing metadata on child - try __childFilePaths map from lazy materialization
			const keyStr = typeof key === "symbol" ? String(key) : key;
			this.slothlet.debug("wrapper", {
				message: "WRAP-CHILD-PATH: checking for child file path",
				apiPath: this.apiPath,
				key: keyStr,
				has_impl: !!this.____slothletInternal.impl,
				has__childFilePaths: !!(this.____slothletInternal.impl && this.____slothletInternal.impl.__childFilePaths),
				has__childFilePathsPreMaterialize: !!this.____slothletInternal.childFilePathsPreMaterialize,
				parentFilePath: parentMetadata?.filePath
			});
			if (this.____slothletInternal.impl && this.____slothletInternal.impl.__childFilePaths) {
				this.slothlet.debug("wrapper", {
					message: "WRAP-CHILD-PATH: __childFilePaths available",
					keys: Object.keys(this.____slothletInternal.impl.__childFilePaths).join(","),
					key: keyStr,
					found: !!this.____slothletInternal.impl.__childFilePaths[key]
				});
			}
			if (
				this.____slothletInternal.impl &&
				this.____slothletInternal.impl.__childFilePaths &&
				this.____slothletInternal.impl.__childFilePaths[key]
			) {
				childFilePath = this.____slothletInternal.impl.__childFilePaths[key];
				this.slothlet.debug("wrapper", {
					message: "WRAP-CHILD-PATH: Using __childFilePaths",
					childFilePath
				});
			} else if (this.____slothletInternal.childFilePathsPreMaterialize && this.____slothletInternal.childFilePathsPreMaterialize[key]) {
				// Check pre-materialize mapping from collision merge
				childFilePath = this.____slothletInternal.childFilePathsPreMaterialize[key];
				this.slothlet.debug("wrapper", {
					message: "WRAP-CHILD-PATH: Using __childFilePathsPreMaterialize",
					childFilePath
				});
			} else {
				// Fall back to parent's filePath (will be directory path for lazy wrappers)
				childFilePath = parentMetadata?.filePath || null;
				this.slothlet.debug("wrapper", {
					message: "WRAP-CHILD-PATH: Using fallback parentMetadata?.filePath",
					childFilePath
				});
			}

			// Extract SHORT moduleID from parent's FULL moduleID format "moduleID:apiPath"
			if (parentMetadata?.moduleID) {
				const colonIndex = parentMetadata.moduleID.indexOf(":");
				childModuleId = colonIndex > 0 ? parentMetadata.moduleID.substring(0, colonIndex) : parentMetadata.moduleID;
			}
		} else {
			// Child already has metadata - extract moduleID from it
			if (childExistingMetadata?.moduleID) {
				const colonIndex = childExistingMetadata.moduleID.indexOf(":");
				childModuleId = colonIndex > 0 ? childExistingMetadata.moduleID.substring(0, colonIndex) : childExistingMetadata.moduleID;
			}
		}

		const childSourceFolder = childExistingMetadata?.sourceFolder || parentMetadata?.sourceFolder || null;

		const nestedWrapper = new UnifiedWrapper(this.slothlet, {
			mode: "eager",
			apiPath: this.____slothletInternal.apiPath
				? `${this.____slothletInternal.apiPath}.${typeof key === "symbol" ? String(key) : key}`
				: String(key),
			initialImpl: childImpl,
			isCallable: typeof childImpl === "function",
			filePath: childFilePath,
			moduleID: childModuleId,
			sourceFolder: childSourceFolder
		});
		// Return proxy to maintain consistency with external assignments
		// Children are stored as proxies on wrapper, getTrap returns them as-is
		return nestedWrapper.createProxy();
	}

	/**
	 * Create recursive waiting proxy for deep lazy loading
	 * Builds property chain (e.g., ["advanced", "calc", "power"]) and waits for all parent
	 * wrappers to materialize before accessing the final property.
	 *
	 * Waiting proxies are ONLY created when not materialized or in-flight.
	 * Once materialized, we return actual cached values, not waiting proxies.
	 * Therefore, waiting proxies always represent in-flight/unmaterialized state.
	 *
	 * CRITICAL: Caches waiting proxies by propChain key to ensure subsequent accesses
	 * return the SAME proxy object, which can then delegate once materialization completes.
	 * This matches v2's propertyProxyCache behavior.
	 *
	 * @private
	 * @param {Array<string|symbol>} [propChain=[]] - Property chain to resolve.
	 * @returns {Proxy} Proxy that waits for materialization before applying calls.
	 */
	___createWaitingProxy(propChain = []) {
		const wrapper = this;

		// Create cache key from propChain
		const cacheKey = propChain.join(".");

		// Defensive: ensure waitingProxyCache exists (should be initialized in constructor,
		// but can be lost in edge cases during reload/adoption cycles)
		if (!wrapper.____slothletInternal.waitingProxyCache) {
			wrapper.____slothletInternal.waitingProxyCache = new Map();
		}

		// Return cached waiting proxy if it exists
		if (wrapper.____slothletInternal.waitingProxyCache.has(cacheKey)) {
			return wrapper.____slothletInternal.waitingProxyCache.get(cacheKey);
		}

		// Waiting proxies always use function target since they represent unknown/in-flight values
		// Native typeof will always return "function" - use __type property for actual state
		const waitingTarget = createNamedProxyTarget(`${wrapper.____slothletInternal.apiPath}_waitingProxy`, "waitingProxyTarget");
		// Note: wrapper lookup is via _proxyRegistry (set below) — do NOT attach ____slothletInternal
		// as an own property on waitingTarget; that was the attack vector we closed in step 2.

		const waitingProxy = new Proxy(waitingTarget, {
			get(___target, prop) {
				if (prop === "then") {
					// Make waiting proxies thenable so `await lg[0]` resolves after materialization
					// This enables seamless consumer access to custom proxy properties (e.g., array indices)
					// without requiring manual _materialize() calls or setTimeout hacks
					return (onFulfilled, onRejected) => {
						const waitingProxy_thenResolve = async () => {
							// Ensure materialization completes
							if (!wrapper.____slothletInternal.state.materialized) {
								await wrapper._materialize();
							}

							// Walk propChain through wrapper/impl to resolve the value
							let current = wrapper;
							for (const chainProp of propChain) {
								if (!current) return undefined;

								// If current wrapper's _impl is a custom proxy, delegate remaining chain
								if (
									current.____slothletInternal.impl &&
									typeof current.____slothletInternal.impl === "object" &&
									util.types.isProxy(current.____slothletInternal.impl)
								) {
									let result = current.____slothletInternal.impl;
									// Delegate this chainProp and all remaining to custom proxy
									const idx = propChain.indexOf(chainProp);
									for (let i = idx; i < propChain.length; i++) {
										result = result[propChain[i]];
									}
									return result;
								}

								// Check wrapper children first
								const isInternal = typeof chainProp === "string" && (chainProp.startsWith("_") || chainProp.startsWith("__"));
								if (!isInternal && hasOwn(current, chainProp)) {
									const child = current[chainProp];
									const _childW = resolveWrapper(child);
									if (_childW) {
										current = _childW;
										// Ensure child is materialized too
										if (current.____slothletInternal.mode === "lazy" && !current.____slothletInternal.state.materialized) {
											await current._materialize();
										}
										continue;
									}
									return child;
								}

								// Check _impl properties
								if (current.____slothletInternal.impl && current.____slothletInternal.impl[chainProp] !== undefined) {
									return current.____slothletInternal.impl[chainProp];
								}

								return undefined;
							}

							// If we get here with no propChain consumed, return the impl itself
							if (
								current.____slothletInternal.impl &&
								typeof current.____slothletInternal.impl === "object" &&
								util.types.isProxy(current.____slothletInternal.impl)
							) {
								return current.____slothletInternal.impl;
							}
							return current.____slothletInternal.impl;
						};

						waitingProxy_thenResolve().then(onFulfilled, onRejected);
					};
				}
				if (prop === "____slothletInternal") return undefined; // blocked: do not expose internal state through waiting proxy
				if (prop === "_materialize") return wrapper._materialize.bind(wrapper);
				if (prop === "__mode") return wrapper.____slothletInternal.mode;
				if (prop === "__materialized") return wrapper.____slothletInternal.state.materialized;
				if (prop === "__inFlight") return wrapper.____slothletInternal.state.inFlight;
				// Note: __impl / _impl are NOT exposed through the waiting proxy — use resolveWrapper(proxy).__impl internally.

				// Trigger materialization if needed (fire-and-forget)
				// This ensures lazy wrappers start loading when accessed
				if (
					wrapper.____slothletInternal.mode === "lazy" &&
					!wrapper.____slothletInternal.state.materialized &&
					!wrapper.____slothletInternal.state.inFlight
				) {
					wrapper._materialize();
				}

				if (prop === util.inspect.custom) {
					// Custom inspect for console.log
					// If in flight, return waiting proxy target
					if (wrapper.____slothletInternal.state.inFlight) {
						return waitingTarget;
					}
					// If unmaterialized, return waiting proxy target
					if (!wrapper.____slothletInternal.state.materialized) {
						return waitingTarget;
					}
					// Check if property exists after materialization
					if (wrapper.____slothletInternal.impl) {
						let current = wrapper.____slothletInternal.impl;
						for (const chainProp of propChain) {
							if (!current || current === null) {
								return undefined;
							}
							current = current[chainProp];
						}
						// Return the actual value for inspection
						return current;
					}
					return waitingTarget;
				}
				if (prop === "__type") {
					wrapper.slothlet.debug("wrapper", {
						message: "WAITING-TYPE",
						apiPath: wrapper.apiPath,
						propChain: propChain.join(","),
						materialized: wrapper.____slothletInternal.state.materialized,
						hasImpl: wrapper.____slothletInternal.impl !== null
					});
					// CRITICAL: After wrapper materialization, resolve the propChain and return actual type
					// This fixes collision merge scenarios where waiting proxies are created before materialization
					// After materialization, these proxies should report the correct type, not IN_FLIGHT
					if (
						wrapper.____slothletInternal.state.materialized ||
						(wrapper.____slothletInternal.impl !== null && wrapper.____slothletInternal.impl !== undefined)
					) {
						// Wrapper has materialized - walk propChain to determine actual type
						let current = wrapper.createProxy();
						for (const chainProp of propChain) {
							if (!current) break;
							const currentWrapper = resolveWrapper(current);
							if (current && currentWrapper) {
								const isInternal = typeof chainProp === "string" && (chainProp.startsWith("_") || chainProp.startsWith("__"));
								if (!isInternal && chainProp in currentWrapper) {
									current = currentWrapper[chainProp];
									wrapper.slothlet.debug("wrapper", {
										message: "WAITING-TYPE-WALK: found in wrapper",
										chainProp: String(chainProp),
										typeOf: typeof current
									});
									continue;
								}
								if (
									currentWrapper.____slothletInternal.impl &&
									typeof currentWrapper.____slothletInternal.impl === "object" &&
									currentWrapper.____slothletInternal.impl !== null &&
									chainProp in currentWrapper.____slothletInternal.impl
								) {
									current = currentWrapper.____slothletInternal.impl[chainProp];
									wrapper.slothlet.debug("wrapper", {
										message: "WAITING-TYPE-WALK: found in _impl",
										chainProp: String(chainProp),
										typeOf: typeof current
									});
									continue;
								}
							}
							wrapper.slothlet.debug("wrapper", {
								message: "WAITING-TYPE-WALK: accessed directly",
								chainProp: String(chainProp),
								typeOf: typeof current
							});
							current = current[chainProp];
						}
						// Return the actual type of the resolved value
						const resolvedType =
							typeof current === "function" ? "function" : typeof current === "object" && current !== null ? "object" : typeof current;
						wrapper.slothlet.debug("wrapper", {
							message: "WAITING-TYPE-RESOLVED",
							apiPath: wrapper.apiPath,
							propChain: propChain.join(","),
							resolvedType
						});
						return resolvedType;
					}
					// Waiting proxies return IN_FLIGHT if wrapper not yet materialized
					wrapper.slothlet.debug("wrapper", {
						message: "WAITING-TYPE-INFLIGHT: returning IN_FLIGHT",
						apiPath: wrapper.apiPath,
						propChain: propChain.join(",")
					});
					return TYPE_STATES.IN_FLIGHT;
				}
				if (prop === "__metadata") {
					// Return metadata through wrapper
					if (wrapper.slothlet.handlers?.metadata) {
						return wrapper.slothlet.handlers.metadata.getMetadata(wrapper);
					}
					return {};
				}
				if (typeof prop === "symbol") return undefined;
				if (prop === "length") {
					// For waiting proxies in lazy mode, we can't know the length until materialized
					// Return 0 as a placeholder - the actual length will be available after materialization
					return 0;
				}
				if (prop === "name") return waitingTarget.name || "waitingProxyTarget";
				if (prop === "toString") {
					// For waiting proxies, we can't access impl yet, so use target
					return Function.prototype.toString.bind(waitingTarget);
				}
				if (prop === "valueOf") {
					// For waiting proxies, we can't access impl yet, so use target
					return Function.prototype.valueOf.bind(waitingTarget);
				}
				if (prop === "__slothletPath") return wrapper.____slothletInternal.apiPath;

				// CRITICAL: Check if wrapper.____slothletInternal.impl is already set
				// This allows property access once _impl is populated (matches v2 behavior)
				// Lifecycle events, metadata, and ownership may still be in progress
				// This handles custom proxy behavior like array access on devices proxy
				// Custom proxies return plain objects/values that should NOT be wrapped
				if (
					wrapper.____slothletInternal.impl !== null &&
					wrapper.____slothletInternal.impl !== undefined &&
					typeof wrapper.____slothletInternal.impl === "object" &&
					util.types.isProxy(wrapper.____slothletInternal.impl)
				) {
					// Direct delegation to custom proxy
					// Traverse propChain through the custom proxy first
					let result = wrapper.____slothletInternal.impl;
					for (const chainProp of propChain) {
						result = result[chainProp];
					}
					// Then access the requested prop on the result
					return result[prop];
				}

				// CRITICAL: After materialization OR if _impl is set, resolve through property chain
				// Check _impl FIRST (not just _state.materialized) to match v2 behavior where
				// once state.materialized variable was set, values were returned synchronously
				// This allows waiting proxies to resolve immediately once _impl is available,
				// even if _state.inFlight is still true (materialization finishing up)
				if (wrapper.____slothletInternal.impl !== null && wrapper.____slothletInternal.impl !== undefined) {
					// Start from the parent wrapper and traverse using wrapper properties
					let current = wrapper;
					let remainingChain = [...propChain];

					// Traverse propChain through wrapper properties until we hit a custom proxy
					for (let i = 0; i < propChain.length; i++) {
						const chainProp = propChain[i];

						// If current wrapper has a custom proxy, delegate remaining chain to it
						if (
							current.____slothletInternal.impl &&
							typeof current.____slothletInternal.impl === "object" &&
							util.types.isProxy(current.____slothletInternal.impl)
						) {
							// Traverse remaining propChain through the custom proxy
							let proxyResult = current.____slothletInternal.impl;
							for (const remainingProp of remainingChain) {
								proxyResult = proxyResult[remainingProp];
							}

							// Now access the final prop on the result
							return proxyResult[prop];
						}

						const isInternal = typeof chainProp === "string" && (chainProp.startsWith("_") || chainProp.startsWith("__"));
						if (!isInternal && current && chainProp in current) {
							const cached = current[chainProp];

							// Get the wrapper from cached proxy
							const _cachedW2 = resolveWrapper(cached);
							if (_cachedW2) {
								current = _cachedW2;
								remainingChain.shift(); // Remove this prop from remaining chain
							} else {
								// Cached value is not a wrapper (primitive or unwrapped object)
								return undefined;
							}
						} else {
							// Property doesn't exist in property chain
							return undefined;
						}
					}

					// CRITICAL: If current wrapper's _impl is a custom proxy, delegate property access to it
					// Custom proxies handle their own property access (array indices, computed properties, etc.)
					if (
						current &&
						current.____slothletInternal.impl &&
						typeof current.____slothletInternal.impl === "object" &&
						util.types.isProxy(current.____slothletInternal.impl)
					) {
						return current.____slothletInternal.impl[prop];
					}

					// Now check if the final prop exists in the resolved wrapper
					const isFinalInternal = typeof prop === "string" && (prop.startsWith("_") || prop.startsWith("__"));
					if (!isFinalInternal && current && prop in current) {
						return current[prop];
					}

					// Property doesn't exist
					return undefined;
				}

				// CRITICAL FIX: Before materialization, check if prop exists in wrapper
				// This handles collision-merged file properties that are added to wrapper BEFORE materialization
				// For lazy folders in merge mode, file properties are attached to wrapper during collision handling
				// These properties should be accessible immediately without waiting for full materialization
				const isInternal = typeof prop === "string" && (prop.startsWith("_") || prop.startsWith("__"));
				if (!isInternal && hasOwn(wrapper, prop)) {
					wrapper.slothlet.debug("wrapper", {
						message: "WAITING-GET-PREMATURE: found in wrapper before materialization",
						apiPath: wrapper.____slothletInternal.apiPath,
						prop
					});
					return wrapper[prop];
				}

				// CRITICAL FIX #2: For collision-merged lazy folders, trigger materialization immediately
				// This ensures folder children are available on wrapper before returning
				// Without this, folder properties remain as waiting proxies instead of being accessible
				if (
					wrapper.____slothletInternal.needsImmediateChildAdoption &&
					wrapper.____slothletInternal.materializeFunc &&
					!wrapper.____slothletInternal.state.materialized &&
					!wrapper.____slothletInternal.state.inFlight
				) {
					wrapper.slothlet.debug("wrapper", {
						message: "WAITING-GET-IMMEDIATE-MAT: triggering immediate materialization for collision-merged folder",
						apiPath: wrapper.____slothletInternal.apiPath,
						prop
					});
					// Trigger materialization NOW (async but we'll check after)
					wrapper._materialize().catch((err) => {
						wrapper.slothlet.debug("wrapper", {
							message: "WAITING-GET-IMMEDIATE-MAT-ERROR: materialization failed",
							apiPath: wrapper.apiPath,
							error: err.message
						});
					});
					// Now check if prop is in wrapper after materialization started
					// ___adoptImplChildren runs synchronously within _materialize before any awaits
					const isInternal = typeof prop === "string" && (prop.startsWith("_") || prop.startsWith("__"));
					if (!isInternal && hasOwn(wrapper, prop)) {
						wrapper.slothlet.debug("wrapper", {
							message: "WAITING-GET-IMMEDIATE-MAT-SUCCESS: now available in wrapper",
							apiPath: wrapper.____slothletInternal.apiPath,
							prop
						});
						return wrapper[prop];
					}
				}

				// If materialization is in flight but not complete, return waiting proxy
				if (wrapper.____slothletInternal.state.inFlight) {
					// Materialization started but not complete yet
					// Return waiting proxy to allow chaining, but __type will return IN_FLIGHT symbol
					return wrapper.___createWaitingProxy([...propChain, prop]);
				}

				// Not yet materialized and not in flight - create waiting proxy that will trigger materialization
				return wrapper.___createWaitingProxy([...propChain, prop]);
			},

			async apply(___target, ___thisArg, args) {
				wrapper.slothlet.debug("wrapper", {
					message: "WAITING-APPLY-ENTRY",
					apiPath: wrapper.____slothletInternal.apiPath,
					propChain: propChain.join(","),
					args: args.join(",")
				});
				const chainLabel = propChain.map((prop) => String(prop)).join(".");

				if (
					wrapper.____slothletInternal.mode === "lazy" &&
					!wrapper.____slothletInternal.state.materialized &&
					!wrapper.____slothletInternal.state.inFlight
				) {
					wrapper.slothlet.debug("wrapper", {
						message: "WAITING-APPLY-MATERIALIZE: Triggering materialization",
						apiPath: wrapper.____slothletInternal.apiPath
					});
					await wrapper._materialize();
					wrapper.slothlet.debug("wrapper", {
						message: "WAITING-APPLY-MATERIALIZED: Materialization complete",
						apiPath: wrapper.____slothletInternal.apiPath
					});
				} else if (
					wrapper.____slothletInternal.mode === "lazy" &&
					!wrapper.____slothletInternal.state.materialized &&
					wrapper.____slothletInternal.state.inFlight
				) {
					// Materialization already in-flight (triggered by the get trap).
					// We MUST await the existing materialization promise before walking the chain.
					if (wrapper.____slothletInternal.materializationPromise) {
						await wrapper.____slothletInternal.materializationPromise;
					} else {
						// No promise but inFlight — spin until materialized or error
						await wrapper._materialize();
					}
				}

				wrapper.slothlet.debug("wrapper", {
					message: "WAITING-APPLY-START-WALK: Starting propChain walk",
					apiPath: wrapper.____slothletInternal.apiPath,
					propChain: propChain.join(",")
				});
				let current = wrapper.createProxy();
				let lastWrapper = wrapper;
				let lastObject = null; // Track the parent object for `this` binding

				for (const prop of propChain) {
					wrapper.slothlet.debug("wrapper", {
						message: "WAITING-APPLY-WALK",
						prop: String(prop),
						typeOf: typeof current,
						constructorName: current?.constructor?.name
					});
					if (!current) {
						// PRIORITY 1: If the chain involves ANY symbol access (like util.inspect.custom), silently return undefined
						// Check the entire propChain, not just what we've iterated so far
						// This prevents errors during Node.js inspection operations, regardless of wrapper state
						if (propChain.some((p) => typeof p === "symbol")) {
							return undefined;
						}
						// PRIORITY 2: Check if root wrapper or last tracked wrapper was invalidated/deleted during async materialization
						// This happens when api.remove() is called while lazy wrappers are still materializing
						if (
							wrapper.____slothletInternal.invalid ||
							wrapper.____slothletInternal.impl === null ||
							(lastWrapper && (lastWrapper.__invalid || lastWrapper._impl === null))
						) {
							return undefined;
						}
						// PRIORITY 3: If we're trying to access hasAttribute (or other inspect properties) on undefined,
						// return undefined instead of throwing - this happens when Node.js inspects non-existent properties
						const finalProp = propChain[propChain.length - 1];
						if (
							finalProp === "hasAttribute" ||
							finalProp === Symbol.toStringTag ||
							finalProp === "constructor" ||
							typeof finalProp === "symbol" ||
							typeof prop === "symbol"
						) {
							return undefined;
						}
						throw new Error(`${wrapper.____slothletInternal.apiPath}.${chainLabel} - cannot access ${String(prop)} of undefined`);
					}

					const currentWrapper = resolveWrapper(current);
					if (currentWrapper) {
						const state = currentWrapper.____slothletInternal.state;
						if (!state.materialized) {
							if (!state.inFlight && typeof current._materialize === "function") {
								await current._materialize();
							}
							while (!currentWrapper.____slothletInternal.state.materialized) {
								const nextState = currentWrapper.____slothletInternal.state;
								if (!nextState.inFlight && !nextState.materialized) {
									throw new Error(`${wrapper.____slothletInternal.apiPath}.${chainLabel} failed to materialize ${String(prop)}`);
								}
								await new Promise((resolve) => setImmediate(resolve));
							}
						}
					}

					if (current && currentWrapper) {
						lastWrapper = currentWrapper; // Track the wrapper we're accessing
						const isInternal = typeof prop === "string" && (prop.startsWith("_") || prop.startsWith("__"));
						if (!isInternal && prop in currentWrapper) {
							lastObject = current; // Track parent before moving to next property
							current = currentWrapper[prop];
							continue;
						}
						// Check if _impl is an object before using 'in' operator
						if (
							currentWrapper.____slothletInternal.impl &&
							typeof currentWrapper.____slothletInternal.impl === "object" &&
							currentWrapper.____slothletInternal.impl !== null &&
							prop in currentWrapper.____slothletInternal.impl
						) {
							lastObject = currentWrapper.____slothletInternal.impl; // Track parent object
							current = currentWrapper.____slothletInternal.impl[prop];
							continue;
						}
					}

					lastObject = current; // Track parent before moving to next property
					current = current[prop];
				}

				wrapper.slothlet.debug("wrapper", {
					message: "WAITING-APPLY",
					apiPath: wrapper.____slothletInternal.apiPath,
					propChain: propChain.join(","),
					typeOf: typeof current,
					currentName: current?.name,
					isFunction: typeof current === "function"
				});

				if (typeof current === "function") {
					// Call with proper `this` binding - use lastObject as `this` if available
					// This preserves `this` binding for methods called on objects
					// Use Reflect.apply to avoid accessing .apply property on proxy (which triggers another trap)
					return Reflect.apply(current, lastObject, args);
				}

				// Handle util.inspect checking for hasAttribute on primitives
				// When Node.js inspects an object, it checks for hasAttribute on all properties
				// If we're checking hasAttribute on a primitive value, just return undefined
				if (propChain[propChain.length - 1] === "hasAttribute") {
					return undefined;
				}

				// If current is undefined/null after traversing the chain, throw an error
				// The property doesn't exist after materialization
				if (current === undefined || current === null) {
					throw new Error(`${wrapper.____slothletInternal.apiPath}.${chainLabel} is not a function or does not exist`);
				}

				throw new Error(`${wrapper.____slothletInternal.apiPath}.${chainLabel} is not a function`);
			},
			getPrototypeOf: () => null
		});

		// Register waiting proxy in the global registry so resolveWrapper() can find the
		// root wrapper from it — mirrors the old .____slothletInternal.wrapper path that
		// worked on waiting proxies before step 2 blocked the property on regular proxies.
		_proxyRegistry.set(waitingProxy, wrapper);

		// Cache the waiting proxy so subsequent accesses return the same proxy object
		wrapper.____slothletInternal.waitingProxyCache.set(cacheKey, waitingProxy);

		return waitingProxy;
	}

	/**
	 * Create main proxy for this wrapper
	 * Handles lazy/eager mode logic, property access, and context binding
	 *
	 * @returns {Proxy} Main proxy for API
	 * @public
	 */
	createProxy() {
		const wrapper = this;
		if (wrapper.____slothletInternal.proxy) {
			return wrapper.____slothletInternal.proxy;
		}

		// Optional: materialize on create for lazy mode when materializeOnCreate flag is set
		// This triggers background loading - typeof will still return "function" but first access is faster
		if (
			wrapper.____slothletInternal.materializeOnCreate &&
			wrapper.____slothletInternal.mode === "lazy" &&
			!wrapper.____slothletInternal.state.materialized &&
			wrapper.____slothletInternal.materializeFunc
		) {
			wrapper._materialize(); // Fire-and-forget background materialization
		}

		// Proxy target depends on whether this is callable
		// For callable endpoints, use a function as proxy target so typeof === "function"
		// For non-callable, use wrapper itself as target
		// CRITICAL: In lazy mode with unknown callability (__isCallable === false but configurable),
		// we MUST use a function target because callability isn't known until materialization.
		// Once the proxy is created, its target type can't change, so we default to function
		// for lazy mode. The apply trap handles non-callable cases gracefully.
		const mightBeCallable =
			wrapper.____slothletInternal.isCallable ||
			(wrapper.____slothletInternal.mode === "lazy" && !wrapper.____slothletInternal.isCallableLocked);
		let proxyTarget;
		if (mightBeCallable) {
			// Create a named function as proxy target for callable wrappers
			// This ensures typeof proxy === "function" and enables function calls
			proxyTarget = createNamedProxyTarget(wrapper.____slothletInternal.apiPath, "callableProxy");
		} else {
			// Non-callable wrapper - use wrapper itself as target
			proxyTarget = wrapper;
		}

		// Add custom inspect to wrapper if not already present
		if (!(util.inspect.custom in proxyTarget)) {
			Object.defineProperty(proxyTarget, util.inspect.custom, {
				value: function () {
					// Show children from wrapper (filter internal properties)
					const childKeys = Object.keys(wrapper).filter((k) => !k.startsWith("_") && !k.startsWith("__"));
					if (childKeys.length > 0 && !wrapper.____slothletInternal.isCallable) {
						const obj = {};
						for (const key of childKeys) {
							// Return the proxy if value is a wrapper
							const child = wrapper[key];
							if (child && typeof child.createProxy === "function") {
								obj[key] = child.createProxy();
							} else {
								obj[key] = child;
							}
						}
						return obj;
					}
					// For lazy unmaterialized wrappers with null _impl, return the proxy itself
					if (
						wrapper.____slothletInternal.mode === "lazy" &&
						!wrapper.____slothletInternal.state.materialized &&
						(wrapper.____slothletInternal.impl === null || wrapper.____slothletInternal.impl === undefined)
					) {
						return wrapper.____slothletInternal.proxy || wrapper;
					}
					// Otherwise return _impl (functions, primitives, etc)
					return wrapper.____slothletInternal.impl;
				},
				writable: false,
				enumerable: false,
				configurable: true
			});
		}

		/**
		 * @private
		 * @param {Object} target - Proxy target (wrapper)
		 * @param {string|symbol} prop - Property name
		 * @param {Object} receiver - Proxy receiver
		 * @returns {unknown} Resolved property value
		 *
		 * @description
		 * Resolves properties from wrapper properties (children), impl values, or target properties.
		 * Filters internal properties (starting with _ or __) from external access.
		 */
		const getTrap = (target, prop, receiver) => {
			// CRITICAL: For non-configurable properties on target, must return actual value
			// This satisfies proxy invariants when target has __mode, __apiPath, etc.
			if (target !== wrapper && prop in target) {
				const desc = Object.getOwnPropertyDescriptor(target, prop);
				if (desc && !desc.configurable) {
					// Non-configurable property on target - must return actual value
					// But if it's a function target for callable wrapper, redirect to wrapper
					if (typeof prop === "string" && prop.startsWith("__")) {
						return wrapper[prop];
					}
					return target[prop];
				}
			}
			// When target IS the wrapper (non-callable), non-configurable props must return
			// their actual value to satisfy proxy invariants (e.g. ____slothlet from ComponentBase).
			if (target === wrapper && typeof prop === "string") {
				const desc = Object.getOwnPropertyDescriptor(target, prop);
				if (desc && !desc.configurable) {
					return target[prop];
				}
			}

			// Filter internal properties from external access (but allow access from within)
			// Internal properties start with _ or __
			const isInternalProp = typeof prop === "string" && (prop.startsWith("_") || prop.startsWith("__"));

			// Allow access to specific internal APIs that have explicit handlers below
			// CRITICAL: Every prop with an explicit handler in the getTrap MUST be listed here,
			// otherwise the filter short-circuits before the handler runs.
			const allowedInternals = new Set([
				"_materialize",
				"__mode",
				"__apiPath",
				"__isCallable",
				"__materializeOnCreate",
				"__displayName",
				"__type",
				"__materialized",
				"__inFlight",
				"__slothletPath",
				"__metadata",
				// Read-only server-info props — exposed through proxy, immutable (write/delete blocked)
				"__filePath",
				"__sourceFolder",
				"__moduleID"
			]);
			if (isInternalProp && !allowedInternals.has(prop)) {
				return undefined; // Hide internal properties from external access
			}

			// Debug logging for collision scenarios
			if (prop === "power" || prop === "add") {
				this.slothlet.debug("wrapper", {
					message: "GET-START",
					apiPath: wrapper.____slothletInternal.apiPath,
					prop: String(prop),
					mode: wrapper.____slothletInternal.mode,
					collisionMode: wrapper.____slothletInternal.state.collisionMode || "none",
					materialized: wrapper.____slothletInternal.state.materialized,
					hasImpl: wrapper.____slothletInternal.impl !== null,
					inWrapper: !isInternalProp && hasOwn(wrapper, prop)
				});
			}

			if (prop === "__mode") return wrapper.____slothletInternal.mode;
			if (prop === "__apiPath") return wrapper.____slothletInternal.apiPath;
			if (prop === "__isCallable") return wrapper.____slothletInternal.isCallable;
			if (prop === "__materializeOnCreate") return wrapper.____slothletInternal.materializeOnCreate;
			if (prop === "__materialized") return wrapper.____slothletInternal.state.materialized;
			if (prop === "__inFlight") return wrapper.____slothletInternal.state.inFlight;
			if (prop === "__displayName") return wrapper.____slothletInternal.displayName;
			if (prop === "__type") {
				// Trigger materialization if needed
				if (
					wrapper.____slothletInternal.mode === "lazy" &&
					!wrapper.____slothletInternal.state.materialized &&
					!wrapper.____slothletInternal.state.inFlight
				) {
					wrapper._materialize();
				}

				// Return state symbols for lazy mode if not ready
				if (wrapper.____slothletInternal.mode === "lazy" && wrapper.____slothletInternal.state.inFlight) {
					return TYPE_STATES.IN_FLIGHT;
				}
				if (wrapper.____slothletInternal.mode === "lazy" && !wrapper.____slothletInternal.state.materialized) {
					return TYPE_STATES.UNMATERIALIZED;
				}

				// Return typeof the actual impl (not the proxy target)
				const impl = wrapper.____slothletInternal.impl;
				if (typeof impl === "function") {
					return "function";
				}
				if (impl && typeof impl === "object" && typeof impl.default === "function") {
					return "function";
				}
				if (impl && typeof impl === "object") {
					return "object";
				}
				// Handle primitives
				if (typeof impl === "string") {
					return "string";
				}
				if (typeof impl === "number") {
					return "number";
				}
				if (typeof impl === "boolean") {
					return "boolean";
				}
				if (typeof impl === "symbol") {
					return "symbol";
				}
				if (typeof impl === "bigint") {
					return "bigint";
				}
				return "undefined";
			}
			if (prop === "_materialize") return wrapper._materialize.bind(wrapper);
			if (prop === "__slothletPath") return wrapper.____slothletInternal.apiPath;
			// Note: "____slothletInternal" is NOT in allowedInternals so the filter above returns undefined first.
			if (prop === "__metadata") {
				// Return combined system + user metadata
				if (wrapper.slothlet.handlers?.metadata) {
					return wrapper.slothlet.handlers.metadata.getMetadata(wrapper);
				}
				return {};
			}
			// Note: "__state", "_impl", "__impl" are intentionally NOT handled here — blocked from proxy.
			if (prop === "__filePath") return wrapper.____slothletInternal.filePath ?? undefined;
			if (prop === "__sourceFolder") return wrapper.____slothletInternal.sourceFolder ?? undefined;
			if (prop === "__moduleID") return wrapper.____slothletInternal.moduleID ?? undefined;
			if (prop === "__invalid") return wrapper.____slothletInternal.invalid;
			if (prop === "then") return undefined;
			if (prop === "constructor") return Object.prototype.constructor;
			if (prop === util.inspect.custom) {
				// Return function that builds object from wrapper or returns _impl
				return () => {
					// If wrapper has children and we're not a callable, show children
					const childKeys = Object.keys(wrapper).filter((k) => !k.startsWith("_") && !k.startsWith("__"));
					if (childKeys.length > 0 && !wrapper.____slothletInternal.isCallable) {
						const obj = {};
						for (const key of childKeys) {
							const child = wrapper[key];
							if (child && typeof child.createProxy === "function") {
								obj[key] = child.createProxy();
							} else {
								obj[key] = child;
							}
						}
						return obj;
					}
					// For lazy wrappers with null _impl, return the wrapper or proxy itself
					if (
						wrapper.____slothletInternal.mode === "lazy" &&
						!wrapper.____slothletInternal.state.materialized &&
						(wrapper.____slothletInternal.impl === null || wrapper.____slothletInternal.impl === undefined)
					) {
						this.slothlet.debug("wrapper", {
							message: "util.inspect.custom: Lazy unmaterialized",
							apiPath: wrapper.apiPath,
							wrapper: wrapper,
							____proxy: wrapper.____slothletInternal.proxy
						});
						return wrapper || wrapper.____slothletInternal.proxy;
					}
					// Otherwise return _impl
					return wrapper.____slothletInternal.impl;
				};
			}
			if (prop === Symbol.toStringTag) {
				// Return "Object" for object exports, "Function" for function exports
				const impl = wrapper.____slothletInternal.impl;
				if (typeof impl === "function") {
					return "Function";
				}
				if (impl && typeof impl === "object" && typeof impl.default === "function") {
					return "Function";
				}
				return "Object";
			}
			if (typeof prop === "symbol") return undefined;
			if (prop === "length") {
				// Return actual function length from impl
				const impl = wrapper.____slothletInternal.impl;
				if (typeof impl === "function") {
					return impl.length;
				}
				if (impl && typeof impl === "object" && typeof impl.default === "function") {
					return impl.default.length;
				}
				return 0;
			}
			if (prop === "name") {
				// Return name derived from API path, not the internal function name
				// This ensures consistency: api.logger should report as "logger", not "log"
				if (wrapper.____slothletInternal.apiPath) {
					const pathParts = wrapper.____slothletInternal.apiPath.split(".");
					const lastPart = pathParts[pathParts.length - 1];
					if (lastPart) {
						return lastPart;
					}
				}
				return target.name || "unifiedWrapperProxy";
			}
			if (prop === "toString") {
				// Return toString bound to the actual impl, not the proxy target
				const impl = wrapper.____slothletInternal.impl;
				if (typeof impl === "function") {
					return impl.toString.bind(impl);
				}
				if (impl && typeof impl === "object" && typeof impl.default === "function") {
					return impl.default.toString.bind(impl.default);
				}
				// For non-callable wrappers, return a descriptive string
				if (typeof target === "function") {
					return Function.prototype.toString.bind(target);
				}
				return () => `[UnifiedWrapper: ${wrapper.____slothletInternal.apiPath}]`;
			}
			if (prop === "valueOf") {
				// Return valueOf bound to the actual impl, not the proxy target
				const impl = wrapper.____slothletInternal.impl;
				if (typeof impl === "function") {
					return impl.valueOf.bind(impl);
				}
				if (impl && typeof impl === "object" && typeof impl.default === "function") {
					return impl.default.valueOf.bind(impl.default);
				}
				return Function.prototype.valueOf.bind(target);
			}

			if (wrapper.____slothletInternal.invalid) {
				return undefined;
			}

			if (
				wrapper.____slothletInternal.mode === "lazy" &&
				!wrapper.____slothletInternal.state.materialized &&
				!wrapper.____slothletInternal.state.inFlight
			) {
				wrapper._materialize();
			}

			// If lazy mode is materialized and property doesn't exist in _impl, return undefined
			// CRITICAL: Check wrapper children BEFORE creating waiting proxy
			// In lazy mode with collisions, children may already be on wrapper (from file/folder merge)
			// Return these children directly instead of creating waiting proxy
			const isInternal = typeof prop === "string" && (prop.startsWith("_") || prop.startsWith("__"));
			if (!isInternal && hasOwn(wrapper, prop)) {
				// CRITICAL: In replace mode, check if property should exist at all
				if (wrapper.____slothletInternal.state.collisionMode === "replace" && (prop === "power" || prop === "add")) {
					this.slothlet.debug("wrapper", {
						message: "GET-CACHED-REPLACE",
						apiPath: wrapper.apiPath,
						prop: String(prop),
						collisionMode: wrapper.____slothletInternal.state.collisionMode,
						wrapperKeys: Object.keys(wrapper)
							.filter((k) => !k.startsWith("_") && !k.startsWith("__"))
							.join(", ")
					});
				}
				this.slothlet.debug("wrapper", {
					message: "GET-CACHED",
					apiPath: wrapper.____slothletInternal.apiPath,
					prop: String(prop),
					materialized: wrapper.____slothletInternal.state.materialized,
					hasImpl: wrapper.____slothletInternal.impl !== null
				});
				const cached = wrapper[prop];
				// If it's a wrapper (proxy) with a primitive impl, return the unwrapped value
				// This ensures live runtime gets the actual value, not the wrapper object
				const _cachedWrapper = resolveWrapper(cached);
				if (_cachedWrapper?.____slothletInternal?.impl !== null && _cachedWrapper?.____slothletInternal?.impl !== undefined) {
					const cachedImpl = _cachedWrapper.____slothletInternal.impl;
					// For primitives, return the unwrapped value
					const cachedType = typeof cachedImpl;
					if (
						cachedType === "string" ||
						cachedType === "number" ||
						cachedType === "boolean" ||
						cachedType === "bigint" ||
						cachedType === "symbol"
					) {
						return cachedImpl;
					}
				}
				// If cached is a wrapper (proxy) in lazy mode that needs materialization, trigger it
				if (_cachedWrapper) {
					const cachedWrapper = _cachedWrapper;
					if (
						cachedWrapper.____slothletInternal.mode === "lazy" &&
						!cachedWrapper.____slothletInternal.state.materialized &&
						!cachedWrapper.____slothletInternal.state.inFlight
					) {
						cachedWrapper._materialize();
					}
				}
				// For objects and functions, return the proxy as-is
				return cached;
			}

			// CRITICAL: Check if _impl is already set (matches v2's state.materialized check)
			// This allows synchronous property access even during materialization
			// Must check BEFORE inFlight to handle synchronous setter pattern
			// Note: _impl is initialized to null, so check for non-null explicitly
			if (wrapper.____slothletInternal.impl !== null && wrapper.____slothletInternal.impl !== undefined) {
				// If _impl is a custom Proxy, delegate property access directly to it
				// Custom proxies handle their own property access logic (array indices, computed properties, etc.)
				if (typeof wrapper.____slothletInternal.impl === "object" && util.types.isProxy(wrapper.____slothletInternal.impl)) {
					return wrapper.____slothletInternal.impl[prop];
				}

				// For regular objects/functions, check wrapper children or _impl properties
				const isInternal = typeof prop === "string" && (prop.startsWith("_") || prop.startsWith("__"));
				if (!isInternal && hasOwn(wrapper, prop)) {
					if (prop === "power" || prop === "add") {
						this.slothlet.debug("wrapper", {
							message: "GET-PROXYGET: Accessing",
							prop,
							wrapperId: wrapper.____slothletInternal.id,
							apiPath: wrapper.apiPath,
							collisionMode: wrapper.____slothletInternal.state.collisionMode || "none"
						});
						this.slothlet.debug("wrapper", {
							message: "GET-PROXYGET: Found in wrapper",
							wrapperKeys: Object.keys(wrapper)
								.filter((k) => !k.startsWith("_") && !k.startsWith("__"))
								.join(", ")
						});
					}
					const cached = wrapper[prop];
					// If cached is a wrapper (proxy) in lazy mode that needs materialization, trigger it
					const _cachedWrapper4 = resolveWrapper(cached);
					if (_cachedWrapper4) {
						const cachedWrapper = _cachedWrapper4;
						if (
							cachedWrapper.____slothletInternal.mode === "lazy" &&
							!cachedWrapper.____slothletInternal.state.materialized &&
							!cachedWrapper.____slothletInternal.state.inFlight
						) {
							cachedWrapper._materialize();
						}
					}
					return cached;
				}
			}

			// If lazy mode is materialized and property doesn't exist in wrapper or _impl, return undefined
			// This prevents creating waiting proxies for properties that were deleted
			const isInternalProp2 = typeof prop === "string" && (prop.startsWith("_") || prop.startsWith("__"));
			if (
				wrapper.____slothletInternal.mode === "lazy" &&
				wrapper.____slothletInternal.state.materialized &&
				!isInternalProp2 &&
				!hasOwn(wrapper, prop) &&
				wrapper.____slothletInternal.impl &&
				!(prop in wrapper.____slothletInternal.impl)
			) {
				return undefined;
			}

			if (
				wrapper.____slothletInternal.mode === "lazy" &&
				(wrapper.____slothletInternal.state.inFlight || !wrapper.____slothletInternal.impl)
			) {
				// Trigger materialization if not started yet
				// This ensures lazy wrappers start loading when their properties are accessed
				if (!wrapper.____slothletInternal.state.materialized && !wrapper.____slothletInternal.state.inFlight) {
					wrapper._materialize();
				}

				this.slothlet.debug("wrapper", {
					message: "LAZY-GET: will create waiting proxy",
					prop: String(prop),
					collisionMode: wrapper.____slothletInternal.state.collisionMode || "none",
					apiPath: wrapper.____slothletInternal.apiPath
				});

				// If _impl is already set and is a custom proxy, delegate even during inFlight
				// This allows custom proxies to work immediately after being loaded
				if (
					wrapper.____slothletInternal.impl &&
					typeof wrapper.____slothletInternal.impl === "object" &&
					util.types.isProxy(wrapper.____slothletInternal.impl)
				) {
					const value = wrapper.____slothletInternal.impl[prop];
					return value;
				}
				return wrapper.___createWaitingProxy([prop]);
			}

			// If _impl is a custom Proxy, delegate property access directly to it
			// Custom proxies handle their own property access logic (array indices, computed properties, etc.)
			// Wrapping their results breaks their intended behavior
			if (
				wrapper.____slothletInternal.impl &&
				typeof wrapper.____slothletInternal.impl === "object" &&
				util.types.isProxy(wrapper.____slothletInternal.impl)
			) {
				const value = wrapper.____slothletInternal.impl[prop];
				// Return the value directly - don't wrap it
				// This preserves custom proxy behavior for array access, computed properties, etc.
				return value;
			}

			// Check if the property exists on impl before caching
			// This handles property descriptors (getters) correctly
			let value = wrapper.____slothletInternal.impl ? wrapper.____slothletInternal.impl[prop] : undefined;

			// If value is undefined, check if it's a getter on the impl
			if (value === undefined && wrapper.____slothletInternal.impl) {
				const descriptor = Object.getOwnPropertyDescriptor(wrapper.____slothletInternal.impl, prop);
				if (descriptor && descriptor.get) {
					// It's a getter - call it to get the actual value
					value = descriptor.get.call(wrapper.____slothletInternal.impl);
				}
			}
			if (value === undefined && Object.prototype.hasOwnProperty.call(target, prop)) {
				value = target[prop];
			}

			if (value === undefined) {
				return undefined;
			}

			// Return primitives directly without wrapping
			// Primitives: string, number, boolean, bigint, symbol, null
			const valueType = typeof value;
			if (
				value === null ||
				valueType === "string" ||
				valueType === "number" ||
				valueType === "boolean" ||
				valueType === "bigint" ||
				valueType === "symbol"
			) {
				return value;
			}

			// Return built-in objects that require proper 'this' binding directly without wrapping
			// These include: Map, Set, WeakMap, WeakSet, Date, RegExp, Promise, Error, TypedArrays
			if (
				value instanceof Map ||
				value instanceof Set ||
				value instanceof WeakMap ||
				value instanceof WeakSet ||
				value instanceof Date ||
				value instanceof RegExp ||
				value instanceof Promise ||
				value instanceof Error ||
				ArrayBuffer.isView(value) ||
				value instanceof ArrayBuffer
			) {
				return value;
			}

			// Return custom Proxy objects directly without wrapping
			// Custom proxies (like LGTVControllers) need direct access for array indices and special get traps
			// Wrapping them breaks array access patterns like proxy[0]
			if (value && typeof value === "object" && util.types.isProxy(value)) {
				return value;
			}

			if (value && (typeof value === "object" || typeof value === "function") && resolveWrapper(value) !== null) {
				return value;
			}

			const wrapped = wrapper.___createChildWrapper(prop, value);
			if (wrapped) {
				Object.defineProperty(wrapper, prop, {
					value: wrapped,
					writable: false,
					enumerable: true,
					configurable: true
				});
				return wrapped;
			}

			return value;
		};

		/**
		 * @private
		 * @param {Object} target - Proxy target
		 * @param {Object} thisArg - Call receiver
		 * @param {Array} args - Call arguments
		 * @returns {unknown} Call result
		 *
		 * @description
		 * Invokes the underlying impl with context binding when callable.
		 * Integrates hook execution (before/after/always/error) synchronously.
		 * Follows V2 pattern: hooks execute synchronously, async handling via Promise.then().
		 */
		const applyTrap = (target, thisArg, args) => {
			if (wrapper.____slothletInternal.invalid) {
				throw new TypeError(`${wrapper.____slothletInternal.apiPath || "api"} is invalidated`);
			}

			// Get hook manager if available
			const hookManager = wrapper.slothlet.handlers?.hookManager;
			// Early exit if hooks disabled globally or this is a hook API function
			const hasHooks = hookManager && hookManager.enabled && !wrapper.____slothletInternal.apiPath.startsWith("slothlet.hook");

			// Get api (bound API) and ctx (user context) for hooks
			const api = wrapper.slothlet.boundApi;
			const ctx = wrapper.slothlet.config?.context || {};

			// Declare variables outside try-catch-finally so they're accessible in all blocks
			let result;
			let finalResult;
			let isAsync = false; // Track if we're dealing with a promise

			try {
				// Execute before hooks synchronously
				if (hasHooks) {
					const beforeResult = hookManager.executeBeforeHooks(wrapper.____slothletInternal.apiPath, args, api, ctx);
					args = beforeResult.args;

					// Check for short-circuit
					if (beforeResult.shortCircuit) {
						// Set finalResult so finally block can call always hooks with correct value
						finalResult = beforeResult.value;
						return beforeResult.value;
					}
				}

				// Materialize if needed (lazy mode)
				if (
					wrapper.____slothletInternal.mode === "lazy" &&
					!wrapper.____slothletInternal.state.materialized &&
					!wrapper.____slothletInternal.state.inFlight
				) {
					wrapper._materialize();
				}

				// Wait for materialization if in flight (returns Promise)
				if (wrapper.____slothletInternal.mode === "lazy" && wrapper.____slothletInternal.state.inFlight) {
					return new Promise((resolve, reject) => {
						const checkMaterialized = () => {
							if (wrapper.____slothletInternal.state.materialized) {
								const impl = wrapper.____slothletInternal.impl;
								if (typeof impl === "function") {
									if (wrapper.slothlet.contextManager) {
										resolve(wrapper.slothlet.contextManager.runInContext(wrapper.instanceID, impl, thisArg, args, wrapper));
									} else {
										resolve(impl.apply(thisArg, args));
									}
								} else if (impl && typeof impl === "object" && typeof impl.default === "function") {
									if (wrapper.contextManager) {
										resolve(wrapper.contextManager.runInContext(wrapper.instanceID, impl.default, impl, args, wrapper));
									} else {
										resolve(impl.default.apply(impl, args));
									}
								} else {
									reject(
										new wrapper.slothlet.SlothletError(
											"INVALID_CONFIG_NOT_A_FUNCTION",
											{
												apiPath: wrapper.____slothletInternal.apiPath,
												actualType: typeof impl
											},
											null,
											{ validationError: true }
										)
									);
								}
								return;
							}
							if (!wrapper.____slothletInternal.state.inFlight) {
								reject(
									new wrapper.slothlet.SlothletError(
										"INVALID_CONFIG_LAZY_MATERIALIZATION_FAILED",
										{ apiPath: wrapper.____slothletInternal.apiPath },
										null,
										{
											validationError: true
										}
									)
								);
								return;
							}
							setImmediate(checkMaterialized);
						};
						checkMaterialized();
					});
				}

				// Execute the actual function
				const impl = wrapper.____slothletInternal.impl;

				if (typeof impl === "function") {
					if (wrapper.slothlet.contextManager) {
						result = wrapper.slothlet.contextManager.runInContext(wrapper.instanceID, impl, thisArg, args, wrapper);
					} else {
						result = impl.apply(thisArg, args);
					}
				} else if (impl && typeof impl === "object" && typeof impl.default === "function") {
					if (wrapper.slothlet.contextManager) {
						result = wrapper.slothlet.contextManager.runInContext(wrapper.instanceID, impl.default, impl, args, wrapper);
					} else {
						result = impl.default.apply(impl, args);
					}
				} else {
					throw new wrapper.SlothletError(
						"INVALID_CONFIG_NOT_A_FUNCTION",
						{
							apiPath: wrapper.____slothletInternal.apiPath,
							actualType: typeof impl
						},
						null,
						{ validationError: true }
					);
				}

				// Check if result is a Promise (async function)
				if (result && typeof result === "object" && typeof result.then === "function") {
					// Mark as async so finally block skips always hooks (we handle them in the promise chain)
					isAsync = true;
					// Async result - attach hooks to Promise chain
					return result.then(
						(resolvedResult) => {
							try {
								// Execute after hooks synchronously with resolved value
								if (hasHooks) {
									const afterResult = hookManager.executeAfterHooks(wrapper.____slothletInternal.apiPath, resolvedResult, args, api, ctx);
									const finalResult = afterResult.modified ? afterResult.result : resolvedResult;
									hookManager.executeAlwaysHooks(wrapper.____slothletInternal.apiPath, args, finalResult, false, [], api, ctx);
									return finalResult;
								}
								return resolvedResult;
							} catch (error) {
								// Error in after hook during async resolution
								if (hasHooks) {
									const originalError = unwrapError(error);
									const sourceInfo = {
										type: "after",
										timestamp: Date.now(),
										stack: originalError.stack
									};
									hookManager.executeErrorHooks(wrapper.____slothletInternal.apiPath, originalError, sourceInfo, args, api, ctx);
									hookManager.executeAlwaysHooks(wrapper.____slothletInternal.apiPath, args, undefined, true, [originalError], api, ctx);
								}

								// Check if errors should be suppressed
								const suppressErrors = wrapper.slothlet.config?.hook?.suppressErrors === true;
								if (suppressErrors) {
									return undefined;
								}

								throw error;
							}
						},
						(error) => {
							// Async function error
							if (hasHooks && !error[ERROR_HOOK_PROCESSED]) {
								const originalError = unwrapError(error);
								const sourceInfo = {
									type: "function",
									timestamp: Date.now(),
									stack: originalError.stack
								};
								hookManager.executeErrorHooks(wrapper.apiPath, originalError, sourceInfo, args, api, ctx);
							}
							// Always hooks execute for rejected promises
							if (hasHooks) {
								const originalError = unwrapError(error);
								hookManager.executeAlwaysHooks(wrapper.apiPath, args, undefined, true, [originalError], api, ctx);
							}

							// Check if errors should be suppressed
							const suppressErrors = wrapper.slothlet.config?.hook?.suppressErrors === true;
							if (suppressErrors) {
								return undefined;
							}

							throw error;
						}
					);
				}

				// Sync result - execute after hooks (can modify result)
				finalResult = result;
				if (hasHooks) {
					const afterResult = hookManager.executeAfterHooks(wrapper.____slothletInternal.apiPath, result, args, api, ctx);
					if (afterResult.modified) {
						finalResult = afterResult.result;
					}
				}
				return finalResult;
			} catch (error) {
				// Synchronous error (from before hook or function)
				this.lastSyncError = error; // Flag for finally block
				if (hasHooks && !error[ERROR_HOOK_PROCESSED]) {
					const originalError = unwrapError(error);
					const sourceInfo = {
						type: "function",
						timestamp: Date.now(),
						stack: originalError.stack
					};
					hookManager.executeErrorHooks(wrapper.____slothletInternal.apiPath, originalError, sourceInfo, args, api, ctx);
				}

				// Check if errors should be suppressed
				const suppressErrors = wrapper.slothlet.config?.hook?.suppressErrors === true;
				if (suppressErrors) {
					// Don't throw - return undefined after always hooks run
					return undefined;
				}

				throw error;
			} finally {
				// Always hooks execute once for synchronous code paths
				// (async paths handle always hooks in their promise chains)
				// Skip only if we're dealing with an async result (promise)
				if (hasHooks && !isAsync) {
					// Track error state with a flag set in catch block
					const syncError = this.lastSyncError;
					this.lastSyncError = null;
					// Use finalResult if available (successful sync call), undefined if error
					const resultValue = syncError ? undefined : typeof finalResult !== "undefined" ? finalResult : result;
					const errors = syncError ? [unwrapError(syncError)] : [];
					hookManager.executeAlwaysHooks(wrapper.____slothletInternal.apiPath, args, resultValue, !!syncError, errors, api, ctx);
				}
			}
		};

		/**
		 * @private
		 * @param {Object} target - Proxy target (wrapper)
		 * @param {string|symbol} prop - Property name
		 * @returns {boolean} True if property exists
		 *
		 * @description
		 * Checks for properties on impl, target (wrapper), filtering internals.
		 */
		const hasTrap = (target, prop) => {
			if (prop === "_materialize") {
				return true;
			}

			if (
				wrapper.____slothletInternal.mode === "lazy" &&
				!wrapper.____slothletInternal.state.materialized &&
				!wrapper.____slothletInternal.state.inFlight
			) {
				wrapper._materialize();
			}

			// Check wrapper properties (children), filter internals
			const isInternal = typeof prop === "string" && (prop.startsWith("_") || prop.startsWith("__"));
			if (!isInternal && hasOwn(wrapper, prop)) {
				return true;
			}

			if (
				wrapper.____slothletInternal.impl &&
				(typeof wrapper.____slothletInternal.impl === "object" || typeof wrapper.____slothletInternal.impl === "function") &&
				prop in wrapper.____slothletInternal.impl
			) {
				return true;
			}

			return Object.prototype.hasOwnProperty.call(target, prop);
		};

		/**
		 * @private
		 * @param {Object} target - Proxy target (wrapper)
		 * @param {string|symbol} prop - Property name
		 * @returns {PropertyDescriptor|undefined} Descriptor for the property
		 *
		 * @description
		 * Provides descriptors for target (wrapper), impl properties, filtering internals.
		 */
		const getOwnPropertyDescriptorTrap = (target, prop) => {
			if (
				wrapper.____slothletInternal.mode === "lazy" &&
				!wrapper.____slothletInternal.state.materialized &&
				!wrapper.____slothletInternal.state.inFlight
			) {
				wrapper._materialize();
			}

			if (prop === "____slothletInternal") return undefined;

			if (prop === "prototype" && typeof target === "function") {
				const desc = Object.getOwnPropertyDescriptor(target, "prototype");
				// Only return descriptor if property actually exists
				if (desc) {
					return desc;
				}
			}

			if (Object.prototype.hasOwnProperty.call(target, prop)) {
				return Object.getOwnPropertyDescriptor(target, prop);
			}

			// Check wrapper properties (children), filter internals
			const isInternal = typeof prop === "string" && (prop.startsWith("_") || prop.startsWith("__"));
			if (!isInternal && hasOwn(wrapper, prop)) {
				const desc = Object.getOwnPropertyDescriptor(wrapper, prop);
				// Return descriptor if it exists
				if (desc) {
					return desc;
				}
			}

			if (
				wrapper.____slothletInternal.impl &&
				(typeof wrapper.____slothletInternal.impl === "object" || typeof wrapper.____slothletInternal.impl === "function") &&
				prop in wrapper.____slothletInternal.impl
			) {
				return Object.getOwnPropertyDescriptor(wrapper.____slothletInternal.impl, prop);
			}

			return undefined;
		};

		/**
		 * @private
		 * @param {Object} target - Proxy target (wrapper)
		 * @returns {Array<string|symbol>} Property keys
		 *
		 * @description
		 * Returns property keys from target (wrapper), impl, filtering internals.
		 */
		const ownKeysTrap = (target) => {
			if (
				wrapper.____slothletInternal.mode === "lazy" &&
				!wrapper.____slothletInternal.state.materialized &&
				!wrapper.____slothletInternal.state.inFlight
			) {
				wrapper._materialize();
			}

			const keys = new Set();

			// CRITICAL: For function proxy targets, 'prototype' is non-configurable and MUST be included
			// This must be checked FIRST before any other logic
			// Also check if target is callable (might be wrapper with __isCallable)
			if (typeof target === "function" || (target && target.__isCallable)) {
				keys.add("prototype");
				keys.add("length");
				keys.add("name");
			}

			// Add all target keys (wrapper or function), checking configurability
			for (const key of Reflect.ownKeys(target)) {
				const descriptor = Object.getOwnPropertyDescriptor(target, key);
				// Include non-configurable properties (required by proxy invariants)
				// OR enumerable properties (child wrappers)
				if (!descriptor.configurable || descriptor.enumerable) {
					keys.add(key);
				}
			}

			// CRITICAL: When proxy target is a callable function (not the wrapper itself),
			// children are defined on wrapper, not target. Include wrapper's enumerable keys.
			if (target !== wrapper) {
				for (const key of Reflect.ownKeys(wrapper)) {
					const descriptor = Object.getOwnPropertyDescriptor(wrapper, key);
					if (descriptor && descriptor.enumerable) {
						keys.add(key);
					}
				}
			}

			// Add impl keys
			const implKeys =
				wrapper.____slothletInternal.impl &&
				(typeof wrapper.____slothletInternal.impl === "object" || typeof wrapper.____slothletInternal.impl === "function")
					? Reflect.ownKeys(wrapper.____slothletInternal.impl)
					: [];
			for (const key of implKeys) {
				// Skip 'prototype' from impl - it causes descriptor invariant violations
				if (key !== "prototype") {
					keys.add(key);
				}
			}

			return Array.from(keys);
		};

		/**
		 * @private
		 * @param {Object} target - Proxy target (wrapper)
		 * @param {string|symbol} prop - Property name
		 * @param {unknown} value - Value to assign
		 * @returns {boolean} True when set succeeds
		 *
		 * @description
		 * Allows attaching properties directly to callable proxies.
		 */
		const setTrap = (target, prop, value) => {
			if (
				wrapper.____slothletInternal.mode === "lazy" &&
				!wrapper.____slothletInternal.state.materialized &&
				!wrapper.____slothletInternal.state.inFlight
			) {
				wrapper._materialize();
			}
			// Keys that must not be settable from outside — either they shadow private state or are
			// read-only informational accessors whose values come directly from ____slothletInternal.
			// Silently absorb the write so no TypeError leaks key existence.
			const blockedKeys = new Set([
				// Critical private internals
				"____slothletInternal",
				"___getState",
				"__state",
				"__invalid",
				// Read-only mode/identity props — getTrap returns these from ____slothletInternal directly
				"__mode",
				"__apiPath",
				"__slothletPath",
				"__isCallable",
				"__materializeOnCreate",
				"__displayName",
				"__type",
				"__metadata",
				// Read-only server-info props — exposed read-only through proxy; write/delete blocked
				"__filePath",
				"__sourceFolder",
				"__moduleID",
				// Read-only lazy-state props
				"__materialized",
				"__inFlight",
				// C props — framework mutation APIs: blocked, use resolveWrapper(proxy).___setImpl / etc.
				"___setImpl",
				"___resetLazy",
				"___invalidate",
				// D props — raw implementation: blocked, use resolveWrapper(proxy).__impl internally
				"__impl",
				"_impl"
			]);
			if (blockedKeys.has(prop)) return true;

			const internalKeys = new Set(["_materialize"]);
			if (!internalKeys.has(prop)) {
				// Delete property first if it exists (to allow reassignment)
				if (hasOwn(wrapper, prop)) {
					delete wrapper[prop];
				}
				Object.defineProperty(wrapper, prop, {
					value: value,
					writable: false,
					enumerable: true,
					configurable: true
				});
			} else {
				// For internal properties, just assign directly
				target[prop] = value;
			}
			return true;
		};

		/**
		 * @private
		 * @param {Object} target - Proxy target (wrapper)
		 * @param {string|symbol} prop - Property name to delete
		 * @returns {boolean} True when deletion succeeds
		 *
		 * @description
		 * Handles property deletion from wrapper proxies, removing from wrapper and impl.
		 */
		const deletePropertyTrap = (target, prop) => {
			// Don't materialize when deleting - just delete directly
			// If lazy wrapper hasn't materialized yet, that's fine - we're deleting it anyway
			// if (wrapper.mode === "lazy" && !wrapper.____slothletInternal.state.materialized && !wrapper.____slothletInternal.state.inFlight) {
			// 	wrapper._materialize();
			// }

			// Don't allow deletion of internal or read-only properties.
			// Return true (silently absorb) rather than false to avoid leaking that these
			// keys exist via the TypeError thrown by returning falsish in strict mode.
			const internalKeys = new Set([
				// Framework mutation APIs
				"____slothletInternal",
				"__impl",
				"___setImpl",
				"___resetLazy",
				"_materialize",
				"___invalidate",
				"_impl",
				"___getState",
				"__state",
				// Read-only informational props
				"__mode",
				"__apiPath",
				"__slothletPath",
				"__isCallable",
				"__materializeOnCreate",
				"__displayName",
				"__type",
				"__metadata",
				"__invalid",
				"__filePath",
				"__sourceFolder",
				"__moduleID",
				"__materialized",
				"__inFlight"
			]);
			if (internalKeys.has(prop)) {
				return true; // silently ignore — do not expose the key's existence via TypeError
			}

			// If deleting a child wrapper, invalidate it
			const isInternal = typeof prop === "string" && (prop.startsWith("_") || prop.startsWith("__"));
			if (!isInternal && hasOwn(wrapper, prop)) {
				const childWrapper = wrapper[prop];
				const childWrapperRaw = resolveWrapper(childWrapper);
				if (childWrapperRaw) {
					childWrapperRaw.___invalidate();
				}
				const descriptor = Object.getOwnPropertyDescriptor(wrapper, prop);
				if (descriptor?.configurable) {
					delete wrapper[prop];
				}
			}

			// Remove from _impl if it's an object
			if (
				wrapper.____slothletInternal.impl &&
				typeof wrapper.____slothletInternal.impl === "object" &&
				prop in wrapper.____slothletInternal.impl
			) {
				delete wrapper.____slothletInternal.impl[prop];
			}

			// Remove from proxy target
			delete target[prop];

			return true;
		};

		wrapper.____slothletInternal.proxy = new Proxy(proxyTarget, {
			get: getTrap,
			apply: applyTrap,
			has: hasTrap,
			getOwnPropertyDescriptor: getOwnPropertyDescriptorTrap,
			ownKeys: ownKeysTrap,
			set: setTrap,
			deleteProperty: deletePropertyTrap,
			getPrototypeOf: () => null
		});

		_proxyRegistry.set(wrapper.____slothletInternal.proxy, wrapper);
		return wrapper.____slothletInternal.proxy;
	}
}

/**
 * Resolves a value to its backing UnifiedWrapper instance.
 * Accepts a proxy registered via createProxy() or a raw UnifiedWrapper instance.
 * Returns null for any other value.
 *
 * @param {unknown} value - Value to resolve
 * @returns {UnifiedWrapper|null} The backing wrapper, or null
 *
 * @example
 * const wrapper = resolveWrapper(someProxy);
 * if (wrapper) wrapper.____slothletInternal.impl = newImpl;
 */
export function resolveWrapper(value) {
	if (!value) return null;
	// Check registry first — handles all proxies created by createProxy().
	// A Proxy wrapping a UnifiedWrapper target passes instanceof UnifiedWrapper (via prototype
	// chain delegation), but the getTrap blocks ____slothletInternal, so registry must come first.
	const registered = _proxyRegistry.get(value);
	if (registered) return registered;
	// Raw UnifiedWrapper instances (not proxies): instanceof passes AND the prototype getter
	// works, so ____slothletInternal is non-null. Proxies of wrappers return undefined for it
	// (blocked in getTrap) and are handled via the registry above.
	if (value instanceof UnifiedWrapper && value.____slothletInternal != null) return value;
	return null;
}
