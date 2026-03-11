/**
 *	@Project: @cldmv/slothlet
 *	@Filename: /api_tests/api_test_modes_debug/logger/logger-meta.mjs
 *	@Date: 2026-03-01 15:15:00 -08:00 (1772406900)
 *	@Author: Nate Corcoran <CLDMV>
 *	@Email: <Shinrai@users.noreply.github.com>
 *	-----
 *	@Last modified by: Nate Corcoran <CLDMV> (Shinrai@users.noreply.github.com)
 *	@Last modified time: 2026-03-01 20:21:14 -08:00 (1772425274)
 *	-----
 *	@Copyright: Copyright (c) 2013-2026 Catalyzed Motivation Inc. All rights reserved.
 */

/**
 * @fileoverview Secondary logger-meta module for modes-processor debug coverage testing.
 * @module api_test_modes_debug.logger.loggerMeta
 * @memberof module:api_test_modes_debug
 */
/**
 * @namespace loggerMeta
 * @memberof module:api_test_modes_debug.logger
 * @alias module:api_test_modes_debug.logger.loggerMeta
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
