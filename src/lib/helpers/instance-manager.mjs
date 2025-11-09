/**
 * @fileoverview Instance-specific runtime manager for slothlet.
 * @module @cldmv/slothlet/helpers/instance-manager
 * @internal
 * @package
 */

/**
 * Registry of active instance IDs and their runtime data
 * @type {Map<string, {self: any, context: object, reference: object}>}
 */
const instanceRegistry = new Map();

/**
 * Current active instance ID for stack trace detection fallback
 * @type {string|null}
 */
let currentActiveInstanceId = null;

/**
 * Get instance data by ID
 * @param {string} instanceId - Instance identifier
 * @returns {object|null} Instance data or null if not found
 */
export function getInstanceData(instanceId) {
	return instanceRegistry.get(instanceId) || null;
}

/**
 * Update instance data for a specific key
 * @param {string} instanceId - Instance identifier
 * @param {string} key - Data key (self, context, reference)
 * @param {any} value - Data value
 * @returns {void}
 */
export function updateInstanceData(instanceId, key, value) {
	// console.log(`[INSTANCE DEBUG] updateInstanceData called with:
	//   instanceId: ${instanceId}
	//   key: ${key}
	//   value type: ${typeof value}
	//   value keys: ${value && typeof value === "object" ? Object.keys(value).length : "N/A"}`);

	let instanceData = instanceRegistry.get(instanceId);
	if (!instanceData) {
		instanceData = {
			self: null,
			context: {},
			reference: {}
		};
		instanceRegistry.set(instanceId, instanceData);
	}
	instanceData[key] = value;

	// console.log(`[INSTANCE DEBUG] Successfully updated ${key} for instance ${instanceId}`);
}

/**
 * Clean up instance data when no longer needed
 * @param {string} instanceId - Instance identifier
 * @returns {Promise<void>}
 */
export async function cleanupInstance(instanceId) {
	// Remove instance from in-memory registry
	instanceRegistry.delete(instanceId);

	if (currentActiveInstanceId === instanceId) {
		currentActiveInstanceId = null;
	}
}

/**
 * Set the currently active instance (called during module loading)
 * @param {string|null} instanceId - Instance ID to set as active
 */
export function setActiveInstance(instanceId) {
	currentActiveInstanceId = instanceId;
	// console.log(`[INSTANCE DEBUG] Set active instance: ${instanceId}`);
}

/**
 * Get the current active instance ID
 * @returns {string|null} Current active instance ID
 */
export function getCurrentActiveInstanceId() {
	return currentActiveInstanceId;
}

/**
 * Detect current instance ID from stack trace
 * @returns {string|null} Detected instance ID or null
 */
export function detectCurrentInstanceId() {
	// console.log(`[DETECT DEBUG] detectCurrentInstanceId() called
	//   currentActiveInstanceId: ${currentActiveInstanceId}
	//   instanceRegistry.size: ${instanceRegistry.size}
	//   available instances: [${Array.from(instanceRegistry.keys())
	// 	.map((id) => `  '${id}'`)
	// 	.join(",\n")}]`);

	// Use current active instance FIRST (set by function wrappers)
	if (currentActiveInstanceId && instanceRegistry.has(currentActiveInstanceId)) {
		return currentActiveInstanceId;
	}

	// Fallback to stack trace detection for unwrapped calls
	const stack = new Error().stack;
	if (stack) {
		// Look for slothlet_instance parameter in URLs
		const matches = stack.match(/slothlet_instance=([^&\s):]+)/g);

		if (matches && matches.length > 0) {
			// Extract the instance ID from the parameter
			const instanceParam = matches[0];
			const instanceId = instanceParam.replace(/slothlet_instance=([^&\s):]+).*/, "$1");

			if (instanceRegistry.has(instanceId)) {
				return instanceId;
			}
		}
	}

	// console.log(`[DETECT DEBUG] No instance found`);
	return null;
}

/**
 * Get all registered instance IDs
 * @returns {string[]} Array of instance IDs
 */
export function getAllInstanceIds() {
	return Array.from(instanceRegistry.keys());
}
