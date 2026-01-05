/**
 * Config Module - Register Lifecycle
 * Module APIs are already loaded by module loader via addApi()
 * This function handles one-time registration tasks (database, permissions, etc)
 *
 * NOTE: Logger module is not initialized during register, use bootstrap logger
 */
/**
 * Register config module
 * Called once during first load or in dev mode
 * API already loaded by module loader - don't call addApi here
 */
export default function register(): Promise<void>;
//# sourceMappingURL=register.d.mts.map