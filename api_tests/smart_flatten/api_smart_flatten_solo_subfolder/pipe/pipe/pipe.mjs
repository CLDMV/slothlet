/**
 *	@Project: @cldmv/slothlet
 *	@Filename: /api_tests/smart_flatten/api_smart_flatten_solo_subfolder/pipe/pipe/pipe.mjs
 *	@Date: 2026-02-25T21:09:47-08:00 (1772082587)
 *	@Author: Nate Corcoran <CLDMV>
 *	@Email: <Shinrai@users.noreply.github.com>
 *	-----
 *	@Last modified by: Nate Corcoran <CLDMV> (Shinrai@users.noreply.github.com)
 *	@Last modified time: 2026-03-01 20:21:22 -08:00 (1772425282)
 *	-----
 *	@Copyright: Copyright (c) 2013-2026 Catalyzed Motivation Inc. All rights reserved.
 */

/**
 * Test fixture: same-name file inside the inner pipe/pipe/ subfolder.
 * Purpose: triggers the `return nestedValue.__impl ?? nestedValue` branch
 * (modes-processor.mjs line 1514).
 *
 * Outer pipe/ folder has NO pipe.mjs (no file at outer level), so the ONLY
 * key in materialized is "pipe" (the inner subfolder). The inner lazy wrapper
 * has zero pre-populated attached keys → attachedKeys.length === 0 → line 1514 fires.
 *
 * This same-name file (pipe.mjs inside pipe/pipe/) then flattens its exports
 * directly onto the inner wrapper so they are accessible as api.solo.pipe.doWork.
 */

/**
 * Performs a unit of work.
 * @returns {string} Work result.
 * @example
 * doWork(); // "pipe-done"
 */
export function doWork() {
	return "pipe-done";
}

/**
 * Returns the status of the pipe.
 * @returns {string} Status string.
 * @example
 * getStatus(); // "pipe-ready"
 */
export function getStatus() {
	return "pipe-ready";
}
