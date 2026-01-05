/**
 * Config Module - Init Lifecycle
 *
 * SECURITY EXCEPTION: This is the ONLY module that receives parameters to init().
 * The module loader hard-codes special handling for core-config to pass the
 * internal config accessor functions. This maintains security by keeping these
 * functions OUTSIDE the slothlet API, preventing modules from bypassing
 * core-config's security checks.
 *
 * Other modules call core-config API endpoints, never get direct access to
 * getConfig/isConfigLoaded. This preserves the security boundary.
 */
/**
 * Initialize config module with internal config accessor functions
 *
 * @param {Function} getConfig - Internal config accessor (NOT on slothlet API)
 * @param {Function} setConfig - Internal config setter (module: namespace only)
 * @param {Function} isConfigLoaded - Config loaded status checker
 *
 * SECURITY: Module loader passes these as parameters (hard-coded exception).
 * These functions stay OUTSIDE slothlet API to maintain security boundary.
 * Modules must call core-config API endpoints, cannot bypass security.
 */
export default function init(getConfig: Function, setConfig: Function, isConfigLoaded: Function): Promise<void>;
//# sourceMappingURL=init.d.mts.map