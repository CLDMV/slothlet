/**
 * @fileoverview Live bindings context manager (no AsyncLocalStorage)
 * @module @cldmv/slothlet/handlers/context-live
 */
import { SlothletError } from "@cldmv/slothlet/errors";

/**
 * Live bindings context manager (direct global state)
 * Uses direct instance tracking without AsyncLocalStorage overhead
 * @public
 */
export class LiveContextManager {
	constructor() {
		this.instances = new Map(); // instanceID → context data
		this.currentInstanceId = null; // Currently active instance
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
		if (!this.currentInstanceId) {
			this.currentInstanceId = instanceID;
		}

		return store;
	}

	/**
	 * Run function with instance context active (live mode)
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

		// Set current instance (synchronous)
		const previousInstanceId = this.currentInstanceId;
		this.currentInstanceId = instanceID;

		try {
			return fn.apply(thisArg, args);
		} catch (error) {
			throw new SlothletError(
				"CONTEXT_EXECUTION_FAILED",
				{
					instanceID
				},
				error
			);
		} finally {
			// Restore previous instance
			this.currentInstanceId = previousInstanceId;
		}
	}

	/**
	 * Get current active context
	 * @returns {Object} Current context store
	 * @throws {SlothletError} If no active context
	 * @public
	 */
	getContext() {
		if (!this.currentInstanceId) {
			throw new SlothletError("NO_ACTIVE_CONTEXT_LIVE", {}, null, { validationError: true });
		}

		const store = this.instances.get(this.currentInstanceId);
		if (!store) {
			throw new SlothletError(
				"CONTEXT_NOT_FOUND",
				{
					instanceID: this.currentInstanceId,
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
		if (!this.currentInstanceId) {
			return undefined;
		}
		return this.instances.get(this.currentInstanceId);
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
		if (this.currentInstanceId === instanceID) {
			this.currentInstanceId = null;
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
			currentInstanceId: this.currentInstanceId,
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
