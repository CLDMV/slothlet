/**
 *
 *	@Project: @cldmv/slothlet
 *	@Filename: api_tests/api_test_vitest_runner_compile_helper/lib/twin.mjs
 *	@Date: 2026-11-24T00:00:00-08:00 (1795507200)
 *	@Author: Nate Corcoran <CLDMV>
 *	@Email: <Shinrai@users.noreply.github.com>
 *	-----
 *	@Last modified by: Nate Corcoran <CLDMV> (Shinrai@users.noreply.github.com)
 *	@Last modified time: 2026-11-28T04:30:09-08:00 (1795869009)
 *	-----
 *	@Copyright: Copyright (c) 2013-2026 Catalyzed Motivation Inc. All rights reserved.
 *
 */

/**
 * @fileoverview A lib file the module file imports under its instance's tag, and imports further copies of from a call
 * once the instance has loaded.
 *
 * @module api_tests/api_test_vitest_runner_compile_helper/lib/twin
 */

/**
 * Marks the real code of a copy.
 * @type {boolean}
 * @public
 * @example
 * (await import("../lib/twin.mjs")).copy; // true
 */
export const copy = true;
