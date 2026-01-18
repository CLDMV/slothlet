/**
 * @fileoverview AsyncLocalStorage-based context manager
 * @module @cldmv/slothlet/handlers/context-async
 */
import { AsyncLocalStorage } from "node:async_hooks";
import { SlothletError } from "@cldmv/slothlet/errors";

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
	 * @returns {*} Result of function execution
	 * @public
	 */
	runInContext(instanceID, fn, thisArg, args) {
		const store = this.instances.get(instanceID);
		if (!store) {
			throw new SlothletError("CONTEXT_NOT_FOUND", {
				instanceID,
				availableInstances: Array.from(this.instances.keys())
			});
		}

		return this.als.run(store, () => {
			try {
				return fn.apply(thisArg, args);
			} catch (error) {
				throw new SlothletError(
					"CONTEXT_EXECUTION_FAILED",
					{
						instanceID,
						apiPath: fn.__slothletPath || "unknown"
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
			throw new SlothletError("CONTEXT_NOT_FOUND", { instanceID }, null, { validationError: true });
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
