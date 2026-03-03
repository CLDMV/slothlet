/**
 *	@Project: @cldmv/slothlet
 *	@Filename: /api_tests/smart_flatten/api_smart_flatten_folder_with_named/logger/helper.mjs
 *	@Date: 2026-03-02T19:00:00-08:00 (1772514000)
 *	@Author: Nate Corcoran <CLDMV>
 *	@Email: <Shinrai@users.noreply.github.com>
 *	-----
 *	@Last modified by: Nate Corcoran <CLDMV> (Shinrai@users.noreply.github.com)
 *	@Last modified time: 2026-03-02 19:00:00 -08:00 (1772514000)
 *	-----
 *	@Copyright: Copyright (c) 2013-2026 Catalyzed Motivation Inc. All rights reserved.
 */

/**
 * @fileoverview helper.mjs — second file in logger/ folder.
 *
 * The presence of this file ensures logger/ has TWO files, which prevents the
 * single-file-folder shortcut in modes-processor.mjs from firing.  The regular
 * processFiles() recursive call is used instead, which triggers Case 2 in the
 * namedKeys loop for logger/logger.mjs.
 */

/**
 * Format a log entry.
 * @param {string} level - Log level string.
 * @param {string} message - Message text.
 * @returns {string} Formatted log entry.
 * @example
 * formatEntry("info", "started"); // "[info] started"
 */
export function formatEntry(level, message) {
	return `[${level}] ${message}`;
}
