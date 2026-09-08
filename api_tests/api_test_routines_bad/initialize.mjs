/**
 *	@Project: @cldmv/slothlet
 *	@Filename: /api_tests/api_test_routines_bad/initialize.mjs
 *	@Date: 2026-09-08 00:00:00 -07:00 (1788800000)
 *	@Author: Shinrai <CLDMV>
 *	@Email: <Shinrai@users.noreply.github.com>
 *	-----
 *	@Last modified by: Shinrai <CLDMV> (Shinrai@users.noreply.github.com)
 *	@Last modified time: 2026-09-08 00:00:00 -07:00 (1788800000)
 *	-----
 *	@Copyright: Copyright (c) 2013-2026 Catalyzed Motivation Inc. All rights reserved.
 */

/**
 * @fileoverview A routine contributor that always throws, mounted after `api_test_routines_good`
 * at the same namespace, to validate that a throwing contributor produces a named, attributable
 * `ROUTINE_FAILED` error and stops the chain (#341).
 * @module api_test_routines_bad.initialize
 * @memberof module:api_test_routines_bad
 */

/**
 * @function initialize
 * @memberof module:api_test_routines_bad
 * @throws {Error} Always — `"boom"`.
 */
export default function initialize() {
	throw new Error("boom");
}
