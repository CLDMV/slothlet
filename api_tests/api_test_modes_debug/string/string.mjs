/**
 *	@Project: @cldmv/slothlet
 *	@Filename: /api_tests/api_test_modes_debug/string/string.mjs
 *	@Date: 2026-02-27T00:00:00-08:00
 *	@Author: Nate Hyson <CLDMV>
 *	@Email: <Shinrai@users.noreply.github.com>
 *	-----
 *	@Copyright: Copyright (c) 2013-2026 Catalyzed Motivation Inc. All rights reserved.
 */

/**
 * String utilities for modes-processor debug coverage testing.
 * Uses folder/folder.mjs pattern with single named object export (Case 1).
 * This exports a single const named "string" matching the folder name "string"
 * to trigger the Case 1 single-file-folder-detected path, including the
 * debug.modes guard for `categoryName === "string"`.
 */
export const string = {
	/**
	 * @param {string} s
	 * @returns {string}
	 */
	format(s) {
		return s.toUpperCase();
	},

	/**
	 * @param {string} s
	 * @returns {string}
	 */
	trim(s) {
		return s.trim();
	}
};
