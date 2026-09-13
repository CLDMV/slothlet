/**
 *	@Project: @cldmv/slothlet
 *	@Filename: /api_tests/api_test_routines_cascade_args/initialize.mjs
 *	@Date: 2026-09-13 00:00:00 -07:00 (1789200000)
 *	@Author: Shinrai <CLDMV>
 *	@Email: <Shinrai@users.noreply.github.com>
 *	-----
 *	@Last modified by: Shinrai <CLDMV> (Shinrai@users.noreply.github.com)
 *	@Last modified time: 2026-09-13 00:00:00 -07:00 (1789200000)
 *	-----
 *	@Copyright: Copyright (c) 2013-2026 Catalyzed Motivation Inc. All rights reserved.
 */

/**
 * @fileoverview Root-level `initialize` contributor that records whatever arguments it was called
 * with (#362 review — the root cascade previously took no arguments at all).
 * @module api_test_routines_cascade_args.initialize
 * @memberof module:api_test_routines_cascade_args
 */

/**
 * Root-level contributor — records its own received arguments on the global test log.
 * @function initialize
 * @memberof module:api_test_routines_cascade_args
 * @param {...*} args - Whatever the cascade forwarded.
 * @returns {void}
 */
export default function initialize(...args) {
	(globalThis.__slothletRoutineCascadeArgsLog ??= []).push(args);
}
