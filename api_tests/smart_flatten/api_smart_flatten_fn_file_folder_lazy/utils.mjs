/**
 *	@Project: @cldmv/slothlet
 *	@Filename: /api_tests/smart_flatten/api_smart_flatten_fn_file_folder_lazy/utils.mjs
 *	@Date: 2026-03-02T00:00:00-08:00 (1772467200)
 *	@Author: Nate Corcoran <CLDMV>
 *	@Email: <Shinrai@users.noreply.github.com>
 *	-----
 *	@Last modified by: Nate Corcoran <CLDMV> (Shinrai@users.noreply.github.com>
 *	@Last modified time: 2026-03-02 00:00:00 -08:00 (1772467200)
 *	-----
 *	@Copyright: Copyright (c) 2013-2026 Catalyzed Momentum Inc. All rights reserved.
 */

/**
 * @fileoverview Second root-level function default — forces "multiple root contributors" mode.
 * When two function-default files exist at root level, slothlet namespaces ALL of them
 * (instead of making one the root callable). This forces api.services to be a namespaced
 * wrapper, which is required for the file-folder collision detection at line 1119 to kick in.
 */

/**
 * Utility helper function.
 * @returns {string} Utility identifier.
 * @example
 * utils(); // "root-utils"
 */
function utils() {
	return "root-utils";
}

export default utils;
