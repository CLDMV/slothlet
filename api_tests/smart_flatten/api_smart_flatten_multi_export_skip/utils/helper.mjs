/**
 *	@Project: @cldmv/slothlet
 *	@Filename: /api_tests/smart_flatten/api_smart_flatten_multi_export_skip/utils/helper.mjs
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
 * @fileoverview Second file in utils/ to make it a multi-file subfolder.
 * Without this, the single-file subfolder special handling (L819) would apply,
 * and we'd never reach the multi-file recursive call (L1066) that leads to L499.
 */

/**
 * Helper function unique to utils/helper.mjs.
 * @returns {string} "helper"
 */
const helper = () => "helper";

export default helper;
