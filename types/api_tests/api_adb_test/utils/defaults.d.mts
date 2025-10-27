/**
 * Gets defaults for a specific data system.
 * @param {string} dataSystemName - Name of the data system (config, device, etc.)
 * @returns {Object} Defaults for the data system
 */
export function getDefaults(dataSystemName: string): any;
/**
 * Gets all defaults organized by data system.
 * @returns {Object} All defaults
 */
export function getAllDefaults(): any;
/**
 * Reloads defaults from files (clears cache).
 * @returns {Object} Reloaded defaults
 */
export function reloadDefaults(): any;
/**
 * Creates a defaults API object for a specific data system.
 * @param {string} dataSystemName - Name of the data system
 * @param {Function} getCurrentValues - Function to get current values from the system
 * @param {Function} setValues - Function to set values in the system
 * @returns {Object} Defaults API for the data system
 */
export function createDefaultsAPI(dataSystemName: string, getCurrentValues: Function, setValues: Function): any;
declare namespace _default {
    export { getDefaults };
    export { getAllDefaults };
    export { reloadDefaults };
    export { createDefaultsAPI };
}
export default _default;
//# sourceMappingURL=defaults.d.mts.map