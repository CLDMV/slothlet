/**
 *
 *	@Project: @cldmv/slothlet
 *	@Filename: /api_tests/api_test_runtime_instanceid/probe/probe.mjs
 *	@Date: 2026-11-13T08:00:00-08:00 (1794585600)
 *	@Author: Nate Corcoran <CLDMV>
 *	@Email: <Shinrai@users.noreply.github.com>
 *	-----
 *	@Last modified by: Nate Corcoran <CLDMV> (Shinrai@users.noreply.github.com)
 *	@Last modified time: 2026-11-13T08:00:00-08:00 (1794585600)
 *	-----
 *	@Copyright: Copyright (c) 2013-2026 Catalyzed Motivation Inc. All rights reserved.
 *
 */

/**
 * @fileoverview A module that reads `instanceID` from each runtime entry: the auto-selecting one and the two runtimes'.
 * @module api_test_runtime_instanceid.probe
 * @memberof module:api_test_runtime_instanceid
 */
import * as auto from "@cldmv/slothlet/runtime";
import * as asyncRuntime from "@cldmv/slothlet/runtime/async";
import * as liveRuntime from "@cldmv/slothlet/runtime/live";

const ENTRIES = { auto, async: asyncRuntime, live: liveRuntime };

/**
 * How `instanceID` of one entry reads.
 * @param {string} entry - `"auto"`, `"async"` or `"live"`.
 * @returns {{text: string, length: *, hasLength: boolean, hasMissing: boolean}} `String(instanceID)` (or the error's
 *   name), its `length`, and whether `length` and a missing member are `in` it.
 */
function read(entry) {
	const { instanceID } = ENTRIES[entry];
	let text;
	try {
		text = String(instanceID);
	} catch (error) {
		text = error.name;
	}
	return { text, length: instanceID.length, hasLength: "length" in instanceID, hasMissing: "missing" in instanceID };
}

/**
 * Read it in the call.
 * @function now
 * @memberof module:api_test_runtime_instanceid.probe
 * @param {string} entry - The entry.
 * @returns {object} The read.
 * @example
 * api.probe.now("auto").text; // the instance's id
 */
export function now(entry) {
	return read(entry);
}

/**
 * Read it after the call waited on a timer.
 * @function later
 * @memberof module:api_test_runtime_instanceid.probe
 * @param {string} entry - The entry.
 * @returns {Promise<object>} The read.
 * @example
 * (await api.probe.later("auto")).text; // the instance's id
 */
export async function later(entry) {
	await new Promise((resolve) => setTimeout(resolve, 1));
	return read(entry);
}
