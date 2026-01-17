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
let activeInstanceId = null;

/**
 * Register an instance with its configuration
 * @param {string} instanceId - Instance identifier
 * @param {Object} config - Instance configuration
 * @param {Object} contextManager - Context manager for this instance
 * @public
 */
export function registerInstance(instanceId, config, contextManager) {
	instanceRegistry.set(instanceId, { config, contextManager });
}

/**
 * Unregister an instance
 * @param {string} instanceId - Instance identifier
 * @public
 */
export function unregisterInstance(instanceId) {
	instanceRegistry.delete(instanceId);
	if (activeInstanceId === instanceId) {
		activeInstanceId = null;
	}
}

/**
 * Get instance data
 * @param {string} instanceId - Instance identifier
 * @returns {Object|null} Instance data or null
 * @public
 */
export function getInstanceData(instanceId) {
	return instanceRegistry.get(instanceId) || null;
}

/**
 * Set currently active instance (called by wrapper)
 * @param {string|null} instanceId - Instance identifier or null
 * @public
 */
export function setActiveInstance(instanceId) {
	activeInstanceId = instanceId;
}

/**
 * Get currently active instance ID
 * @returns {string|null} Active instance ID or null
 * @public
 */
export function getActiveInstanceId() {
	return activeInstanceId;
}

/**
 * Detect current instance runtime type
 * @returns {string} Runtime type ("async" or "live")
 * @public
 */
export function detectRuntimeType() {
	if (activeInstanceId) {
		const data = instanceRegistry.get(activeInstanceId);
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
	if (activeInstanceId) {
		const data = instanceRegistry.get(activeInstanceId);
		return data ? data.contextManager : null;
	}
	return null;
}
