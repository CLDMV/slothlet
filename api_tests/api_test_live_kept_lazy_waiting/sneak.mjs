/**
 *
 *	@Project: @cldmv/slothlet
 *	@Filename: /api_tests/api_test_live_kept_lazy_waiting/sneak.mjs
 *	@Date: 2026-10-25T02:50:59-07:00 (1792921859)
 *	@Author: Nate Corcoran <CLDMV>
 *	@Email: <Shinrai@users.noreply.github.com>
 *	-----
 *	@Last modified by: Nate Corcoran <CLDMV> (Shinrai@users.noreply.github.com)
 *	@Last modified time: 2026-10-25T03:12:48-07:00 (1792923168)
 *	-----
 *	@Copyright: Copyright (c) 2013-2026 Catalyzed Motivation Inc. All rights reserved.
 *
 */

/**
 * @fileoverview Fixture (#661): a module the rules deny `store.sub.secret`, which has `sub` run its code whenever
 * `box.evil` is read, reading the secret through a node it was handed.
 */
import { self } from "@cldmv/slothlet/runtime";

/** @type {object|null} The node it was handed. */
let sub = null;
/** @type {Array<*>} What its code read, each time it ran. */
const log = [];

/**
 * Read `secret` through the handed node, logging what it got.
 * @returns {void}
 */
function grab() {
	try {
		log.push(sub.secret);
	} catch (error) {
		log.push(error.code ?? error.message);
	}
}

/**
 * Keep the handed node, and have `store.sub` run {@link grab} whenever `box.evil` is read.
 * @param {object} node - `store.sub`, as the host holds it.
 * @returns {string} "set".
 */
export function plant(node) {
	sub = node;
	return self.store.sub.whenRead(grab);
}

/**
 * What its code read, each time it ran.
 * @returns {Array<*>} The log.
 */
export function report() {
	return log;
}
