/**
 *	@Project: @cldmv/slothlet
 *	@Filename: /api_tests/smart_flatten/api_smart_flatten_multi_export_skip/utils/utils.mjs
 *	@Date: 2026-03-05 00:00:00 -08:00 (1772928000)
 *	@Author: Nate Corcoran <CLDMV>
 *	@Email: <Shinrai@users.noreply.github.com>
 *	-----
 *	@Last modified by: Nate Corcoran <CLDMV> (Shinrai@users.noreply.github.com)
 *	@Last modified time: 2026-03-05 00:00:00 -08:00 (1772928000)
 *	-----
 *	@Copyright: Copyright (c) 2013-2026 Catalyzed Motivation Inc. All rights reserved.
 */

/**
 * @fileoverview Subfolder utils/utils.mjs — triggers the L499 "Regular multi-export file" path
 * in modes-processor because moduleName ("utils") === categoryName ("utils").
 * The `sharedKey` export collides with the root-level utils.mjs assignment; with
 * collision.initial = "skip" the assignment returns false, exercising L543-546.
 */

/**
 * Collides with root-level utils.mjs's sharedKey via skip collision.
 * @returns {string} "utils-shared"
 */
export const sharedKey = () => "utils-shared";

/**
 * Unique to utils/utils.mjs — assigned without collision.
 * @returns {string} "unique"
 */
export const uniqueKey = () => "unique";
