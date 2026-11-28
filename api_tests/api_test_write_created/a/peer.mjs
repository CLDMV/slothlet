/**
 *
 *	@Project: @cldmv/slothlet
 *	@Filename: api_tests/api_test_write_created/a/peer.mjs
 *	@Date: 2026-11-17T11:57:13-08:00 (1794945433)
 *	@Author: Nate Corcoran <CLDMV>
 *	@Email: <Shinrai@users.noreply.github.com>
 *	-----
 *	@Last modified by: Nate Corcoran <CLDMV> (Shinrai@users.noreply.github.com)
 *	@Last modified time: 2026-11-28T04:30:12-08:00 (1795869012)
 *	-----
 *	@Copyright: Copyright (c) 2013-2026 Catalyzed Motivation Inc. All rights reserved.
 *
 */

/**
 * @fileoverview The first module's code that reads and replaces a member the second module created.
 */
import { self } from "@cldmv/slothlet/runtime";

/**
 * Run a step and report its outcome.
 * @param {function(): *} step - The step.
 * @returns {string} `"done"` or the step's result, or the error code it was refused with.
 * @example
 * attempt(() => {}); // "done"
 */
function attempt(step) {
	try {
		const result = step();
		return typeof result === "string" ? result : "done";
	} catch (error) {
		return error?.code ?? error?.name ?? String(error);
	}
}

/**
 * The node a created member sits on, by where it was created.
 * @param {string} where - `"mount"`, `"node"` or `"own"` (see `b/maker.mjs`).
 * @returns {object} The node.
 * @example
 * holder("mount"); // self.p
 */
function holder(where) {
	if (where === "mount") return self.p;
	if (where === "node") return self.p.store;
	return self.p.maker;
}

/**
 * Read the member the second module created.
 * @param {string} where - Where it was created.
 * @returns {string} What it holds, or the error code the read was refused with.
 * @example
 * readMade("mount");
 */
export function readMade(where) {
	return attempt(() => {
		const value = holder(where).made;
		if (typeof value === "function") return String(value());
		if (value !== null && typeof value === "object") return String(value.v);
		return String(value);
	});
}

/**
 * Replace the member the second module created.
 * @param {string} where - Where it was created.
 * @returns {string} Its outcome.
 * @example
 * replaceMade("mount");
 */
export function replaceMade(where) {
	return attempt(() => {
		holder(where).made = "peer";
	});
}
