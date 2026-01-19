/**
 * @fileoverview Instance registry for runtime detection
 * @module @cldmv/slothlet/helpers/instance-manager
 * @internal
 */

/**
 * Registry of active instances with their configuration
 * @type {Map<string, {config: Object, contextManager: Object}>}
 */
const instanceRegistry = new Map();

/**
 * Currently active instance ID (set by wrapper during function calls)
 * @type {string|null}
 */
let activeInstanceID = null;

/**
 * Register an instance with its configuration
 * @param {string} instanceID - Instance identifier
 * @param {Object} config - Instance configuration
 * @param {Object} contextManager - Context manager for this instance
 * @public
 */
export function registerInstance(instanceID, config, contextManager) {
	instanceRegistry.set(instanceID, { config, contextManager });
}

/**
 * Unregister an instance
 * @param {string} instanceID - Instance identifier
 * @public
 */
export function unregisterInstance(instanceID) {
	instanceRegistry.delete(instanceID);
	if (activeInstanceID === instanceID) {
		activeInstanceID = null;
	}
}

/**
 * Get instance data
 * @param {string} instanceID - Instance identifier
 * @returns {Object|null} Instance data or null
 * @public
 */
export function getInstanceData(instanceID) {
	return instanceRegistry.get(instanceID) || null;
}

/**
 * Set currently active instance (called by wrapper)
 * @param {string|null} instanceID - Instance identifier or null
 * @public
 */
export function setActiveInstance(instanceID) {
	activeInstanceID = instanceID;
}

/**
 * Get currently active instance ID
 * @returns {string|null} Active instance ID or null
 * @public
 */
export function getActiveInstanceID() {
	return activeInstanceID;
}

/**
 * Detect current instance runtime type
 * @returns {string} Runtime type ("async" or "live")
 * @public
 */
export function detectRuntimeType() {
	if (activeInstanceID) {
		const data = instanceRegistry.get(activeInstanceID);
		if (data && data.config && data.config.runtime) {
			return data.config.runtime;
		}
	}

	// Default to async
	return "async";
}

/**
 * Get context manager for active instance
 * @returns {Object|null} Context manager or null
 * @public
 */
export function getActiveContextManager() {
	if (activeInstanceID) {
		const data = instanceRegistry.get(activeInstanceID);
		return data ? data.contextManager : null;
	}
	return null;
}
