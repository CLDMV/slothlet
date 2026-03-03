/**
 *	@Project: @cldmv/slothlet
 *	@Filename: /api_tests/smart_flatten/api_smart_flatten_fn_file_folder_lazy/services.mjs
 *	@Date: 2026-03-02T00:00:00-08:00 (1772467200)
 *	@Author: Nate Corcoran <CLDMV>
 *	@Email: <Shinrai@users.noreply.github.com>
 *	-----
 *	@Last modified by: Nate Corcoran <CLDMV> (Shinrai@users.noreply.github.com)
 *	@Last modified time: 2026-03-02 16:10:28 -08:00 (1772496628)
 *	-----
 *	@Copyright: Copyright (c) 2013-2026 Catalyzed Motivation Inc. All rights reserved.
 */

/**
 * @fileoverview Root-level services.mjs with function default + named version export.
 * In lazy mode with collision.initial="merge": creates a lazy wrapper at api.services
 * whose impl is a FUNCTION (not an object). The wrapper also has "version" as a child key.
 *
 * When the services/ subfolder is encountered (lazy subdir loop, line ~1119):
 * - modes_initialCollisionMode = "merge" → enters the collision block
 * - existImpl = services function → typeof existImpl === "object" = false → modes_fileFolderImpl stays null
 * - existChildKeys includes "version" (the child wrapper)
 * - `if (!modes_fileFolderImpl) modes_fileFolderImpl = {}` ← LINE 1139 FIRES
 * - modes_fileFolderImpl gets "version" added
 */

/**
 * Root-level services function.
 * @returns {string} Service identifier.
 * @example
 * services(); // "root-services"
 */
function services() {
	return "root-services";
}

export default services;

/**
 * Returns the root-level version. This is a FUNCTION so that ___adoptImplChildren
 * will adopt it as a child proxy key on the api.services wrapper.
 * (String properties are not adopted — functions are.)
 * @returns {string} Version string.
 * @example
 * getVersion(); // "root-v1"
 */
export function getVersion() {
	return "root-v1";
}
