/**
 *	@Project: @cldmv/slothlet
 *	@Filename: /src/lib/handlers/context-async.mjs
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
 * @fileoverview AsyncLocalStorage-based context manager
 * @module @cldmv/slothlet/handlers/context-async
 */
import { AsyncLocalStorage } from "node:async_hooks";
import { SlothletError } from "@cldmv/slothlet/errors";
import { runtime_isClassInstance, runtime_wrapClassInstance } from "@cldmv/slothlet/helpers/class-instance-wrapper";
import { setApiContextChecker } from "@cldmv/slothlet/helpers/eventemitter-context";

/**
 * AsyncLocalStorage-based context manager for async runtime
 * Uses ALS for full context isolation across async operations
 * @public
 */
export class AsyncContextManager {
	constructor() {
		this.als = new AsyncLocalStorage();
		this.instances = new Map(); // instanceID → context data
	}

	/**
	 * Register the EventEmitter context checker
	 * Must be called AFTER EventEmitter patching is enabled
	 * @public
	 */
	registerEventEmitterContextChecker() {
		setApiContextChecker(() => {
			const store = this.als.getStore();
			return store && store.instanceID ? true : false;
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
		return store;
	}

	/**
	 * Run function with instance context active
	 * @param {string} instanceID - Instance to run in context of
	 * @param {Function} fn - Function to execute
	 * @param {*} thisArg - this binding for function
	 * @param {Array} args - Arguments to pass to function
	 * @param {Object} [currentWrapper] - Current wrapper being executed (for metadata.self())
	 * @returns {*} Result of function execution
	 * @public
	 */
	runInContext(instanceID, fn, thisArg, args, currentWrapper) {
		// Check if we're already in an active ALS context
		const activeStore = this.als.getStore();
		let baseStore;

		// CHILD INSTANCE APPROACH: Check if active store is this instance OR a child of this instance
		const isActiveOurInstance =
			activeStore &&
			(activeStore.instanceID === instanceID ||
				activeStore.parentInstanceID === instanceID);

		if (isActiveOurInstance) {
			// Already in context for this instance (base or child) - use active store to preserve modifications
			baseStore = activeStore;
		} else {
			// Not in context or different instance - get base store
			baseStore = this.instances.get(instanceID);
			if (!baseStore) {
				throw new SlothletError("CONTEXT_NOT_FOUND", {
					instanceID,
					availableInstances: Array.from(this.instances.keys())
				});
			}
		}

		// Create a new store with currentWrapper for this execution
		const executionStore = { ...baseStore };
		if (currentWrapper) {
			executionStore.callerWrapper = baseStore.currentWrapper;
			executionStore.currentWrapper = currentWrapper;
		}

		// Only wrap in als.run() if we're not already in the right context
		if (isActiveOurInstance) {
			// Already in correct context - use a child ALS context so currentWrapper/callerWrapper propagate correctly
			return this.als.run(executionStore, () => {
				try {
					const result = fn.apply(thisArg, args);
					// Wrap class instances to preserve context
					if (runtime_isClassInstance(result)) {
						const instanceCache = new WeakMap();
						return runtime_wrapClassInstance(result, this, instanceID, instanceCache);
					}
					return result;
				} catch (error) {
					throw new SlothletError(
						"CONTEXT_EXECUTION_FAILED",
						{
							instanceID
						},
						error
					);
				}
			});
		}

		// Not in context or switching instance - create new ALS context
		return this.als.run(executionStore, () => {
			try {
				const result = fn.apply(thisArg, args);
				// Wrap class instances to preserve context
				if (runtime_isClassInstance(result)) {
					const instanceCache = new WeakMap();
					return runtime_wrapClassInstance(result, this, instanceID, instanceCache);
				}
				return result;
			} catch (error) {
				throw new SlothletError(
					"CONTEXT_EXECUTION_FAILED",
					{
						instanceID
					},
					error
				);
			}
		});
	}

	/**
	 * Get current active context
	 * @returns {Object} Current context store
	 * @throws {SlothletError} If no active context
	 * @public
	 */
	getContext() {
		const store = this.als.getStore();
		if (!store) {
			throw new SlothletError("NO_ACTIVE_CONTEXT_ASYNC", {}, null, { validationError: true });
		}
		return store;
	}

	/**
	 * Try to get context (returns undefined instead of throwing)
	 * @returns {Object|undefined} Current context store or undefined
	 * @public
	 */
	tryGetContext() {
		return this.als.getStore();
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
	}

	/**
	 * Get diagnostic information
	 * @returns {Object} Diagnostic data
	 * @public
	 */
	getDiagnostics() {
		return {
			type: "async",
			activeStore: this.als.getStore()?.instanceID || null,
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
 * Singleton async context manager
 * @public
 */
export const asyncContextManager = new AsyncContextManager();
