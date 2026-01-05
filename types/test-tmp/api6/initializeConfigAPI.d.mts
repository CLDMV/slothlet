/**
 * Initialize config API with accessor functions from bootstrap
 * SECURITY: Only callable by module init lifecycle (trusted code)
 * @param {function} getConfigValueFn - Function to get config values
 * @param {function} setConfigValueFn - Function to set config values (module: namespace only)
 * @param {function} isConfigLoadedFn - Function to check if config loaded
 */
export default function initializeConfigAPI(getConfigValueFn: Function, setConfigValueFn: Function, isConfigLoadedFn: Function): void;
//# sourceMappingURL=initializeConfigAPI.d.mts.map