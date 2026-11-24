/**
 *
 *	@Project: @cldmv/slothlet
 *	@Filename: /api_tests/api_test_vitest_runner_compile/lib/probe-twin.mjs
 *	@Date: 2026-11-24T00:00:00-08:00 (1795507200)
 *	@Author: Nate Corcoran <CLDMV>
 *	@Email: <Shinrai@users.noreply.github.com>
 *	-----
 *	@Last modified by: Nate Corcoran <CLDMV> (Shinrai@users.noreply.github.com)
 *	@Last modified time: 2026-11-24T00:00:00-08:00 (1795507200)
 *	-----
 *	@Copyright: Copyright (c) 2013-2026 Catalyzed Motivation Inc. All rights reserved.
 *
 */

/**
 * @fileoverview A lib file the probe imports a copy of under its instance's tag, to forge vitest's fetch reply for that
 * copy. The forged reply replaces this code; this code runs only if the forged code is refused and the real one is
 * loaded instead.
 *
 * @module api_tests/api_test_vitest_runner_compile/lib/probe-twin
 */

/**
 * Marks the real code of the copy.
 * @type {boolean}
 * @public
 * @example
 * (await import("../lib/probe-twin.mjs")).copy; // true
 */
export const copy = true;
