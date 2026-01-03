/**
 * Config Module - Register Lifecycle
 * Module APIs are already loaded by module loader via addApi()
 * This function handles one-time registration tasks (database, permissions, etc)
 *
 * NOTE: Logger module is not initialized during register, use bootstrap logger
 */

import { self } from "@cldmv/slothlet/runtime";
/**
 * Register config module
 * Called once during first load or in dev mode
 * API already loaded by module loader - don't call addApi here
 */
export default async function register() {
	// self.log.info("[Config Module] Registering...");
	// One-time registration tasks go here:
	// - Register module in database
	// - Register permissions
	// - Register settings schema
	// - etc.
	// NOTE: Do NOT call self.addApi() here
	// The module loader already called addApi() before this function
	// based on package.json's asbuilt.backend.apiPath and apiFolder
	// self.log.info("[Config Module] Registration complete");
}
