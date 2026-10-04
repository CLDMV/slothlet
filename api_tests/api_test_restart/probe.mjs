/**
 *
 *	@Project: @cldmv/slothlet
 *	@Filename: /api_tests/api_test_restart/probe.mjs
 *	@Date: 2026-09-21T01:27:16+00:00 (1789954036)
 *	@Author: Nate Corcoran <CLDMV>
 *	@Email: <Shinrai@users.noreply.github.com>
 *	-----
 *	@Last modified by: Nate Corcoran <CLDMV> (Shinrai@users.noreply.github.com)
 *	@Last modified time: 2026-10-03 20:03:08 -07:00 (1791082988)
 *	-----
 *	@Copyright: Copyright (c) 2013-2026 Catalyzed Motivation Inc. All rights reserved.
 *
 */

/**
 * @fileoverview restart() fixture (#504): reads through `self` from inside a leaf, so a test can check
 * which instance `self` resolves to, and exposes a slow call for in-flight behavior.
 * @module api_test_restart.probe
 */
import { self } from "@cldmv/slothlet/runtime";

/**
 * The instance ID `self` resolves to.
 * @returns {string} `self.slothlet.instanceID`.
 */
export function instanceID() {
	return self.slothlet.instanceID;
}

/**
 * The emitter generation `self.conn` resolves to.
 * @returns {number} `self.conn.generation`.
 */
export function connGeneration() {
	return self.conn.generation;
}

/**
 * Wait, then report the emitter generation captured when the call started.
 * @param {number} ms - Delay in milliseconds.
 * @returns {Promise<number>} The generation seen at call start.
 */
export async function slow(ms) {
	const generation = self.conn.generation;
	await new Promise((resolve) => setTimeout(resolve, ms));
	return generation;
}

/**
 * Call the `blocked` leaf as this module (permission tests).
 * @returns {string} The leaf's result.
 */
export function callBlocked() {
	return self.secret.blocked();
}

/**
 * Call the `open` leaf as this module (permission tests).
 * @returns {string} The leaf's result.
 */
export function callOpen() {
	return self.secret.open();
}

/**
 * Restart the instance from inside this module (permission tests: host-only by default).
 * @returns {Promise<unknown>} The restart result.
 */
export async function restartInstance() {
	return self.slothlet.restart();
}
