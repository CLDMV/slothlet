/**
 *
 *	@Project: @cldmv/slothlet
 *	@Filename: /api_tests/smart_flatten/api_smart_flatten_file_folder_accessor/gauge/gauge.mjs
 *	@Date: 2026-10-11T23:30:00-07:00 (1791792600)
 *	@Author: Nate Corcoran <CLDMV>
 *	@Email: <Shinrai@users.noreply.github.com>
 *	-----
 *	@Last modified by: Nate Corcoran <CLDMV> (Shinrai@users.noreply.github.com)
 *	@Last modified time: 2026-10-11T23:30:00-07:00 (1791792600)
 *	-----
 *	@Copyright: Copyright (c) 2013-2026 Catalyzed Motivation Inc. All rights reserved.
 *
 */

/**
 * @fileoverview Fixture (#585 review): the folder side of the `gauge` collision, with a getter sharing a
 * name with the file's.
 * @module api_smart_flatten_file_folder_accessor.gauge.gauge
 */

export default {
	/**
	 * @returns {string} Which side of the collision answered.
	 */
	get shared() {
		return "folder";
	},
	folderOnly: 1
};
