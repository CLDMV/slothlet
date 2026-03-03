/**
 *	@Project: @cldmv/slothlet
 *	@Filename: /api_tests/smart_flatten/api_smart_flatten_folder_with_named/logger/logger.mjs
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
 * @fileoverview logger/logger.mjs — single-file-folder with default function AND named exports.
 *
 * This fixture exercises Case 2 in modes-processor.mjs processFiles():
 *  (!isRoot && !apiPathPrefix && moduleName === categoryName && analysis.hasDefault)
 *
 * Named export inventory:
 *   - "logger"   → same reference as the default function, so
 *                  shouldAttachNamedExport returns false  → line 344 fires (continue)
 *   - "version"  → a plain string,
 *                  shouldAttachNamedExport returns true  → line 346 fires (callableModule[key] = value)
 *
 * Both checks rely on line 343 (the `if (!shouldAttachNamedExport(...))` guard),
 * so all three lines 343, 344, and 346 are covered by loading this fixture in eager mode.
 */

/**
 * Root logger function.
 * @param {string} message - Message to log.
 * @returns {string} The logged message.
 * @example
 * logger("hello"); // "hello"
 */
function logger(message) {
	return message;
}

export { logger };
export default logger;
