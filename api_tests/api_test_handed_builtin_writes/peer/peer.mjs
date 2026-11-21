/**
 *
 *	@Project: @cldmv/slothlet
 *	@Filename: /api_tests/api_test_handed_builtin_writes/peer/peer.mjs
 *	@Date: 2026-11-21T12:56:33-08:00 (1795294593)
 *	@Author: Nate Corcoran <CLDMV>
 *	@Email: <Shinrai@users.noreply.github.com>
 *	-----
 *	@Last modified by: Nate Corcoran <CLDMV> (Shinrai@users.noreply.github.com)
 *	@Last modified time: 2026-11-21T13:27:04-08:00 (1795296424)
 *	-----
 *	@Copyright: Copyright (c) 2013-2026 Catalyzed Motivation Inc. All rights reserved.
 *
 */

/**
 * @fileoverview A mounted module that runs a callback it is handed with the arguments it is handed.
 * @module api_test_handed_builtin_writes/peer
 */

/**
 * Run a callback with what it is handed.
 * @param {Function} cb - The callback.
 * @param {...*} args - Its arguments.
 * @returns {*} What it returned.
 */
export function runCb(cb, ...args) {
	return cb(...args);
}
