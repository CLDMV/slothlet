/**
 *
 *	@Project: @cldmv/slothlet
 *	@Filename: /api_tests/smart_flatten/api_smart_flatten_file_folder_accessor/gauge.mjs
 *	@Date: 2026-10-11T22:49:06-07:00 (1791784146)
 *	@Author: Nate Corcoran <CLDMV>
 *	@Email: <Shinrai@users.noreply.github.com>
 *	-----
 *	@Last modified by: Nate Corcoran <CLDMV> (Shinrai@users.noreply.github.com)
 *	@Last modified time: 2026-10-11T23:31:02-07:00 (1791786662)
 *	-----
 *	@Copyright: Copyright (c) 2013-2026 Catalyzed Motivation Inc. All rights reserved.
 *
 */

/**
 * @fileoverview Fixture (#585 review): a file whose default object has getters, colliding with the
 * same-named folder `gauge/`.
 * @module api_smart_flatten_file_folder_accessor.gauge
 */

export default {
	level: 1,
	/**
	 * @returns {number} Twice the level, read on every access.
	 */
	get double() {
		return this.level * 2;
	},
	/**
	 * @returns {string} Which side of the collision answered.
	 */
	get shared() {
		return "file";
	}
};
