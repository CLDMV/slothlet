/**
 *	@Project: @cldmv/slothlet
 *	@Filename: /api_tests/api_test_modes_debug/string/string-utils.mjs
 *	@Date: 2026-03-01 15:15:02 -08:00 (1772406902)
 *	@Author: Nate Corcoran <CLDMV>
 *	@Email: <Shinrai@users.noreply.github.com>
 *	-----
 *	@Last modified by: Nate Corcoran <CLDMV> (Shinrai@users.noreply.github.com)
 *	@Last modified time: 2026-03-01 20:21:14 -08:00 (1772425274)
 *	-----
 *	@Copyright: Copyright (c) 2013-2026 Catalyzed Motivation Inc. All rights reserved.
 */

/**
 * Secondary file in string/ folder.
 * Its presence forces processDirectory to recurse into string/ instead of
 * using the single-file smart-flatten shortcut (line 819 of modes-processor.mjs),
 * enabling coverage of lines 164, 278-305 (Case 1).
 */

/**
 * Pad a string to a fixed length.
 * @param {string} s - Input string.
 * @param {number} len - Target length.
 * @returns {string} Padded string.
 */
export function pad(s, len) {
	return String(s).padEnd(len, " ");
}
