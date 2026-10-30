/**
 *
 *	@Project: @cldmv/slothlet
 *	@Filename: /api_tests/api_test_caller_supplied_ceiling/relay/queue.mjs
 *	@Date: 2026-10-17T00:00:00-07:00 (1792220400)
 *	@Author: Nate Corcoran <CLDMV>
 *	@Email: <Shinrai@users.noreply.github.com>
 *	-----
 *	@Last modified by: Nate Corcoran <CLDMV> (Shinrai@users.noreply.github.com)
 *	@Last modified time: 2026-10-17T00:00:00-07:00 (1792220400)
 *	-----
 *	@Copyright: Copyright (c) 2013-2026 Catalyzed Motivation Inc. All rights reserved.
 *
 */

/**
 * @fileoverview A relay for the ceiling tests (#597): runs a callback later as whoever called it, through
 * `lockCaller.caller`, which the rules grant this module.
 *
 * @module api_tests/api_test_caller_supplied_ceiling/relay/queue
 */

import { self } from "@cldmv/slothlet/runtime";

/**
 * Run `fn` after a timer tick as this leaf's caller, and settle its outcome.
 * @param {function(): *} fn - Work to run.
 * @returns {Promise<{ok: boolean, value?: *, code?: string}>} The outcome.
 * @public
 * @example
 * await api.relay.queue.later(() => 1);
 */
export function later(fn) {
	const pinned = self.slothlet.lockCaller.caller(fn);
	return new Promise((resolve) => setTimeout(resolve, 0)).then(() =>
		Promise.resolve()
			.then(() => pinned())
			.then(
				(value) => ({ ok: true, value }),
				(error) => ({ ok: false, code: error?.code ?? String(error) })
			)
	);
}
