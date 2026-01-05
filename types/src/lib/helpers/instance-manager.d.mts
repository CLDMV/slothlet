/**
 * Get instance data by ID
 * @param {string} instanceId - Instance identifier
 * @returns {object|null} Instance data or null if not found
 */
export function getInstanceData(instanceId: string): object | null;
/**
 * Update instance data for a specific key
 * @param {string} instanceId - Instance identifier
 * @param {string} key - Data key (self, context, reference)
 * @param {any} value - Data value
 * @returns {void}
 */
export function updateInstanceData(instanceId: string, key: string, value: any): void;
/**
 * Clean up instance data when no longer needed
 * @param {string} instanceId - Instance identifier
 * @returns {Promise<void>}
 */
export function cleanupInstance(instanceId: string): Promise<void>;
/**
 * Set the currently active instance (called during module loading)
 * @param {string|null} instanceId - Instance ID to set as active
 */
export function setActiveInstance(instanceId: string | null): void;
/**
 * Get the current active instance ID
 * @returns {string|null} Current active instance ID
 */
export function getCurrentActiveInstanceId(): string | null;
/**
 * Detect current instance ID from stack trace
 * @returns {string|null} Detected instance ID or null
 */
export function detectCurrentInstanceId(): string | null;
/**
 * Get all registered instance IDs
 * @returns {string[]} Array of instance IDs
 */
export function getAllInstanceIds(): string[];
//# sourceMappingURL=instance-manager.d.mts.map