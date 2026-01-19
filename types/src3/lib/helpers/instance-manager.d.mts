/**
 * Register an instance with its configuration
 * @param {string} instanceID - Instance identifier
 * @param {Object} config - Instance configuration
 * @param {Object} contextManager - Context manager for this instance
 * @public
 */
export function registerInstance(instanceID: string, config: any, contextManager: any): void;
/**
 * Unregister an instance
 * @param {string} instanceID - Instance identifier
 * @public
 */
export function unregisterInstance(instanceID: string): void;
/**
 * Get instance data
 * @param {string} instanceID - Instance identifier
 * @returns {Object|null} Instance data or null
 * @public
 */
export function getInstanceData(instanceID: string): any | null;
/**
 * Set currently active instance (called by wrapper)
 * @param {string|null} instanceID - Instance identifier or null
 * @public
 */
export function setActiveInstance(instanceID: string | null): void;
/**
 * Get currently active instance ID
 * @returns {string|null} Active instance ID or null
 * @public
 */
export function getActiveInstanceID(): string | null;
/**
 * Detect current instance runtime type
 * @returns {string} Runtime type ("async" or "live")
 * @public
 */
export function detectRuntimeType(): string;
/**
 * Get context manager for active instance
 * @returns {Object|null} Context manager or null
 * @public
 */
export function getActiveContextManager(): any | null;
//# sourceMappingURL=instance-manager.d.mts.map
