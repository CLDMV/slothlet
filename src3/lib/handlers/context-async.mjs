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
		this.instances = new Map(); // instanceId → context data
	}

	/**
	 * Initialize context for a new instance
	 * @param {string} instanceId - Unique instance identifier
	 * @param {Object} config - Instance configuration
	 * @returns {Object} Created context store
	 * @public
	 */
	initialize(instanceId, config = {}) {
		if (this.instances.has(instanceId)) {
			throw new SlothletError("CONTEXT_ALREADY_EXISTS", { instanceId });
		}

		const store = {
			instanceId,
			self: {},
			context: {},
			reference: {},
			config: { ...config },
			createdAt: Date.now()
		};

		this.instances.set(instanceId, store);
		return store;
	}

	/**
	 * Run function with instance context active
	 * @param {string} instanceId - Instance to run in context of
	 * @param {Function} fn - Function to execute
	 * @param {*} thisArg - this binding for function
	 * @param {Array} args - Arguments to pass to function
	 * @returns {*} Result of function execution
	 * @public
	 */
	runInContext(instanceId, fn, thisArg, args) {
		const store = this.instances.get(instanceId);
		if (!store) {
			throw new SlothletError("CONTEXT_NOT_FOUND", {
				instanceId,
				availableInstances: Array.from(this.instances.keys())
			});
		}

		return this.als.run(store, () => {
			try {
				return fn.apply(thisArg, args);
			} catch (error) {
				throw new SlothletError("CONTEXT_EXECUTION_FAILED", {
					instanceId,
					apiPath: fn.__slothletPath || "unknown",
					originalError: error
				});
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
			throw new SlothletError("NO_ACTIVE_CONTEXT_ASYNC");
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
	 * @param {string} instanceId - Instance to cleanup
	 * @public
	 */
	cleanup(instanceId) {
		const store = this.instances.get(instanceId);
		if (!store) {
			throw new SlothletError("CONTEXT_NOT_FOUND", { instanceId });
		}

		// Clear the store data
		store.self = {};
		store.context = {};
		store.reference = {};

		// Remove from instances map
		this.instances.delete(instanceId);
	}

	/**
	 * Get diagnostic information
	 * @returns {Object} Diagnostic data
	 * @public
	 */
	getDiagnostics() {
		return {
			type: "async",
			activeStore: this.als.getStore()?.instanceId || null,
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
