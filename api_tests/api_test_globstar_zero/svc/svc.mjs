/**
 *
 *	@Project: @cldmv/slothlet
 *	@Filename: /api_tests/api_test_globstar_zero/svc/svc.mjs
 *	@Date: 2026-11-11T20:58:48-08:00 (1794459528)
 *	@Author: Nate Corcoran <CLDMV>
 *	@Email: <Shinrai@users.noreply.github.com>
 *	-----
 *	@Last modified by: Nate Corcoran <CLDMV> (Shinrai@users.noreply.github.com)
 *	@Last modified time: 2026-11-12T01:56:15-08:00 (1794477375)
 *	-----
 *	@Copyright: Copyright (c) 2013-2026 Catalyzed Motivation Inc. All rights reserved.
 *
 */

/**
 * @fileoverview A callable folder: `api.svc()` and `api.svc.start()`, for patterns ending in `.**`.
 * @module api_test_globstar_zero.svc
 * @memberof module:api_test_globstar_zero
 */

/**
 * The folder's own function.
 * @function svc
 * @memberof module:api_test_globstar_zero.svc
 * @returns {string} "svc"
 * @example
 * api.svc(); // "svc"
 */
export default function svc() {
	(globalThis.__slothletGlobstarLog ??= []).push("svc");
	return "svc";
}

/**
 * A function below the folder's own.
 * @function start
 * @memberof module:api_test_globstar_zero.svc
 * @returns {string} "svc.start"
 * @example
 * api.svc.start(); // "svc.start"
 */
export function start() {
	(globalThis.__slothletGlobstarLog ??= []).push("svc.start");
	return "svc.start";
}
