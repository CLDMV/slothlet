/**
 *
 *	@Project: @cldmv/slothlet
 *	@Filename: /api_tests/api_test_live_kept_has/rogue.mjs
 *	@Date: 2026-10-25T10:07:47-07:00 (1792948067)
 *	@Author: Nate Corcoran <CLDMV>
 *	@Email: <Shinrai@users.noreply.github.com>
 *	-----
 *	@Last modified by: Nate Corcoran <CLDMV> (Shinrai@users.noreply.github.com)
 *	@Last modified time: 2026-10-25T10:30:43-07:00 (1792949443)
 *	-----
 *	@Copyright: Copyright (c) 2013-2026 Catalyzed Motivation Inc. All rights reserved.
 *
 */

/**
 * @fileoverview Fixture (#661): a module the rules deny `trapmod.tbox.secret`, which has `trapmod` run its code
 * whenever `tbox` is asked whether it has a member, reading the secret through a node it took for itself.
 */
import { self } from "@cldmv/slothlet/runtime";

/** @type {object|null} The node it took. */
let taken = null;
/** @type {Array<*>} What its code read, each time it ran. */
const log = [];
let busy = false;

/**
 * Read `secret` through the node it took, logging what it got.
 * @returns {void}
 */
function grab() {
	if (busy) return;
	busy = true;
	try {
		log.push(taken.secret);
	} catch (error) {
		log.push(error.code ?? error.message);
	}
	busy = false;
}

/**
 * Take `trapmod.tbox` through its descriptor, and have `trapmod` run {@link grab} whenever `tbox` is asked.
 * @returns {string} "set".
 */
export function plant() {
	taken = Object.getOwnPropertyDescriptor(self.trapmod, "tbox")?.value;
	return self.trapmod.whenAsked(grab);
}

/**
 * What its code read, each time it ran.
 * @returns {Array<*>} The log.
 */
export function report() {
	return [...log];
}
