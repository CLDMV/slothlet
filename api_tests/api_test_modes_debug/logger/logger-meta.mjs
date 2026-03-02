/**
 *	@Project: @cldmv/slothlet
 *	@Filename: /api_tests/api_test_modes_debug/logger/logger-meta.mjs
 *	@Date: 2026-03-01 15:15:00 -08:00 (1772406900)
 *	@Author: Nate Hyson <CLDMV>
 *	@Email: <Shinrai@users.noreply.github.com>
 *	-----
 *	@Last modified by: Nate Hyson <CLDMV> (Shinrai@users.noreply.github.com)
 *	@Last modified time: 2026-03-01 16:31:15 -08:00 (1772411475)
 *	-----
 *	@Copyright: Copyright (c) 2013-2026 Catalyzed Motivation Inc. All rights reserved.
 */

/**
 * Secondary file in logger/ folder.
 * Its presence forces processDirectory to recurse into logger/ instead of
 * using the single-file smart-flatten shortcut (line 819 of modes-processor.mjs),
 * enabling coverage of lines 164, 186, and Case 2 (lines 338-399).
 */

/** @type {string} */
export const version = "1.0.0";

/** @type {string[]} */
export const levels = ["debug", "info", "warn", "error"];
