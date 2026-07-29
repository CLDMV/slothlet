/**
 *	@Project: @cldmv/slothlet
 *	@Filename: /src/lib/handlers/context-live.mjs
 *	@Date: 2026-01-20 20:25:54 -08:00 (1737432354)
 *	@Author: Nate Corcoran <CLDMV>
 *	@Email: <Shinrai@users.noreply.github.com>
 *	-----
 *	@Last modified by: Nate Corcoran <CLDMV> (Shinrai@users.noreply.github.com)
 *	@Last modified time: 2026-03-01 20:21:37 -08:00 (1772425297)
 *	-----
 *	@Copyright: Copyright (c) 2013-2026 Catalyzed Motivation Inc. All rights reserved.
 */

/**
 * @fileoverview Live bindings context manager (no AsyncLocalStorage)
 * @module @cldmv/slothlet/handlers/context-live
 * @internal
 */
import { SlothletError } from "@cldmv/slothlet/errors";
import { setApiContextChecker } from "@cldmv/slothlet/helpers/eventemitter-context";

/**
 * Live bindings context manager (direct global state)
 * Uses direct instance tracking without AsyncLocalStorage overhead.
 *
 * Concurrency boundary: the active instance is tracked in a single global field
 * ({@link LiveContextManager#currentInstanceID}), so this manager isolates *sequential*
 * `run()`/`scope()` calls (each restores the prior instance on exit) but NOT *interleaved*
 * concurrent calls on the same instance — across an `await`, a sibling `run()` overwrites the
 * global and a resumed callback reads the wrong context. True per-async-flow isolation requires
 * AsyncLocalStorage (see {@link module:@cldmv/slothlet/handlers/context-async}); the live manager
 * is the deliberate trade-off for environments without `node:async_hooks` (browser/worker, see
 * #123) and for the lowest-overhead single-flow case. See docs/CONTEXT-PROPAGATION.md.
 * @public
 */
export class LiveContextManager {
	constructor() {
		this.instances = new Map(); // instanceID → context data
		this.currentInstanceID = null; // Currently active instance
	}

	/**
	 * Register the EventEmitter context checker
	 * Must be called AFTER EventEmitter patching is enabled
	 * @public
	 */
	registerEventEmitterContextChecker() {
		setApiContextChecker(() => {
			return this.currentInstanceID !== null;
		});
	}

	/**
	 * Initialize context for a new instance
	 * @param {string} instanceID - Unique instance identifier
	 * @param {Object} config - Instance configuration
	 * @returns {Object} Created context store
	 * @public
	 */
	initialize(instanceID, config = {}) {
		if (this.instances.has(instanceID)) {
			throw new SlothletError("CONTEXT_ALREADY_EXISTS", { instanceID }, null, { validationError: true });
		}

		const store = {
			instanceID,
			self: {},
			context: {},
			config: { ...config },
			createdAt: Date.now()
		};

		this.instances.set(instanceID, store);

		// In live mode, automatically set as current if it's the first/only instance
		if (!this.currentInstanceID) {
			this.currentInstanceID = instanceID;
		}

		return store;
	}

	/**
	 * Run function with instance context active (live mode)
	 * @param {string} instanceID - Instance to run in context of
	 * @param {Function} fn - Function to execute
	 * @param {*} thisArg - this binding for function
	 * @param {Array} args - Arguments to pass to function
	 * @param {Object} [currentWrapper] - Current wrapper being executed (for metadata.self())
	 * @param {boolean} [rawErrors=false] - When `true`, let a non-SlothletError thrown by
	 *   `fn` propagate unchanged instead of wrapping it as `CONTEXT_EXECUTION_FAILED`. Used
	 *   for framework callbacks (`lockCaller`, pinned hooks) where the caller expects the
	 *   original error type/code/status.
	 * @returns {*} Result of function execution
	 * @public
	 */
	runInContext(instanceID, fn, thisArg, args, currentWrapper, rawErrors = false) {
		// CHILD INSTANCE APPROACH: Check if current is this instance OR a child of this instance
		const currentID = this.currentInstanceID;
		let isAlreadyInContext = false;

		if (currentID) {
			const currentStore = this.instances.get(currentID);
			isAlreadyInContext =
				currentID === instanceID || currentStore?.parentInstanceID === instanceID || currentID.startsWith(instanceID + "__run_");
		}

		// If already in correct context (base or child), just use current
		const targetInstanceID = isAlreadyInContext ? currentID : instanceID;

		const store = this.instances.get(targetInstanceID);
		if (!store) {
			throw new SlothletError("CONTEXT_NOT_FOUND", {
				instanceID: targetInstanceID,
				availableInstances: Array.from(this.instances.keys())
			});
		}

		// Set current instance (synchronous)
		const previousInstanceID = this.currentInstanceID;
		const previousWrapper = store.currentWrapper;
		const previousCallerWrapper = store.callerWrapper;

		this.currentInstanceID = targetInstanceID;
		// currentWrapper is optional; false branch is covered directly in context-live-branches tests
		// but v8 hit-counter overflows to -255 in the parallel matrix, appearing uncovered.
		/* v8 ignore next */
		if (currentWrapper) {
			store.callerWrapper = previousWrapper;
			store.currentWrapper = currentWrapper;
		}

		// Restore previous state. Idempotent: the sync and settle paths must never both apply it,
		// or a nested call's saved state would be restored twice.
		let restored = false;
		const restore = () => {
			if (restored) return;
			restored = true;
			this.currentInstanceID = previousInstanceID;
			store.currentWrapper = previousWrapper;
			store.callerWrapper = previousCallerWrapper;
		};

		try {
			const result = fn.apply(thisArg, args);
			// An async module function returns at its first `await`, long before its body is done.
			// Restoring here would drop the caller identity for the rest of that body — and an absent
			// caller reads as host-initiated, so every permission-gated read or call after an `await`
			// would be allowed outright regardless of policy. Awaiting is mandatory for lazy access,
			// so that is the normal path, not an edge case. Hold the identity until the call settles.
			//
			// This keeps the manager's documented guarantee — isolation of *sequential* calls — intact
			// for a call's whole logical duration. Interleaved concurrent calls on one instance remain
			// unisolated by design (a single global slot cannot express overlapping lifetimes); that
			// trade-off is unchanged and documented on the class.
			// Native promises only. A lazy wrapper's waiting proxy is also thenable, but it is a
			// pending *value*, not the call's completion — adopting it here would consume the
			// thenable and hand back a plain promise in its place. Those reads carry their own
			// caller snapshot taken when the proxy was created, so they stay attributed anyway.
			if (result instanceof Promise) {
				return result.then(
					(value) => {
						restore();
						return value;
					},
					(error) => {
						restore();
						throw error;
					}
				);
			}
			restore();
			return result;
		} catch (error) {
			restore();
			// Rethrow framework errors directly so they propagate with their original code.
			// rawErrors also opts out non-SlothletError throws so framework callbacks keep
			// their original error type/code/status.
			if (rawErrors || error instanceof SlothletError) throw error;
			throw new SlothletError(
				"CONTEXT_EXECUTION_FAILED",
				{
					instanceID
				},
				error
			);
		}
	}

	/**
	 * Get current active context
	 * @returns {Object} Current context store
	 * @throws {SlothletError} If no active context
	 * @public
	 */
	getContext() {
		if (!this.currentInstanceID) {
			throw new SlothletError("NO_ACTIVE_CONTEXT_LIVE", {}, null, { validationError: true });
		}

		const store = this.instances.get(this.currentInstanceID);
		if (!store) {
			throw new SlothletError(
				"CONTEXT_NOT_FOUND",
				{
					instanceID: this.currentInstanceID,
					availableInstances: Array.from(this.instances.keys()).join(", ") || "none"
				},
				null,
				{ validationError: true }
			);
		}

		return store;
	}

	/**
	 * Try to get context (returns undefined instead of throwing)
	 * @returns {Object|undefined} Current context store or undefined
	 * @public
	 */
	tryGetContext() {
		if (!this.currentInstanceID) {
			return undefined;
		}
		return this.instances.get(this.currentInstanceID);
	}

	/**
	 * Cleanup instance context
	 * @param {string} instanceID - Instance to cleanup
	 * @public
	 */
	cleanup(instanceID) {
		const store = this.instances.get(instanceID);
		if (!store) {
			throw new SlothletError(
				"CONTEXT_NOT_FOUND",
				{ instanceID, availableInstances: Array.from(this.instances.keys()).join(", ") || "none" },
				null,
				{ validationError: true }
			);
		}

		// Clear the store data
		store.self = {};
		store.context = {};

		// Remove from instances map
		this.instances.delete(instanceID);

		// Clear current instance if it was this one
		if (this.currentInstanceID === instanceID) {
			this.currentInstanceID = null;
		}
	}

	/**
	 * Get diagnostic information
	 * @returns {Object} Diagnostic data
	 * @public
	 */
	getDiagnostics() {
		return {
			type: "live",
			currentInstanceID: this.currentInstanceID,
			instances: Array.from(this.instances.entries()).map(([id, store]) => ({
				id,
				createdAt: store.createdAt,
				contextKeys: Object.keys(store.context),
				selfKeys: Object.keys(store.self)
			}))
		};
	}
}

/**
 * Singleton live context manager
 * @public
 */
export const liveContextManager = new LiveContextManager();
