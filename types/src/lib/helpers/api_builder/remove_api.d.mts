/**
 *	@Project: @cldmv/slothlet
 *	@Filename: /src/lib/helpers/api_builder/remove_api.mjs
 *	@Date: 2026-01-04 00:00:00 -08:00
 *	@Author: Nate Hyson <CLDMV>
 *	@Email: <Shinrai@users.noreply.github.com>
 *	-----
 *	@Last modified by: Nate Hyson <CLDMV> (Shinrai@users.noreply.github.com)
 *	@Last modified time: 2026-01-04 00:00:00 -08:00
 *	-----
 *	@Copyright: Copyright (c) 2013-2026 Catalyzed Motivation Inc. All rights reserved.
 */
/**
 * @fileoverview API removal functionality for cleaning up endpoints and ownership tracking.
 * @module @cldmv/slothlet/lib/helpers/api_builder/remove_api
 * @memberof module:@cldmv/slothlet.lib.helpers.api_builder
 * @internal
 *
 * @description
 * Provides functions for removing API endpoints from the slothlet API structure
 * and cleaning up module ownership registries. Supports removal by API path
 * or by module ID (all paths owned by a module).
 */
/**
 * @description
 * Removes a specific API path from the API structure and cleans up ownership tracking.
 *
 * @function removeApiPath
 * @memberof module:@cldmv/slothlet.lib.helpers.api_builder.remove_api
 * @async
 * @param {object} instance - Slothlet instance with api, boundapi, config, etc.
 * @param {string} apiPath - The API path to remove (e.g., "plugins.myModule")
 * @param {string} [specificModuleId] - Optional: Remove only this moduleId's ownership. If current owner, trigger rollback.
 * @returns {Promise<boolean>} True if removed, false if path didn't exist
 * @throws {TypeError} If apiPath is not a non-empty string
 * @throws {Error} If apiPath contains empty segments
 * @internal
 *
 * @example
 * await removeApiPath(instance, "plugins.myModule");
 *
 * @example
 * // Remove specific module's ownership
 * await removeApiPath(instance, "plugins.myModule", "module-v2");
 */
export function removeApiPath(instance: object, apiPath: string, specificModuleId?: string): Promise<boolean>;
/**
 * @description
 * Removes all API paths owned by a specific module ID.
 *
 * @function removeApiByModuleId
 * @memberof module:@cldmv/slothlet.lib.helpers.api_builder.remove_api
 * @async
 * @param {object} instance - Slothlet instance with api, boundapi, config, etc.
 * @param {string} moduleId - The module identifier
 * @returns {Promise<boolean>} True if any paths were removed, false otherwise
 * @throws {TypeError} If moduleId is not a non-empty string
 * @internal
 *
 * @example
 * await removeApiByModuleId(instance, "myModule");
 */
export function removeApiByModuleId(instance: object, moduleId: string): Promise<boolean>;
//# sourceMappingURL=remove_api.d.mts.map