/**
 *	@Project: @cldmv/slothlet
 *	@Filename: /api_tests/api_tv_test/subfolder/input.mjs
 *	@Date: 2025-10-27T09:42:13-07:00 (1761583333)
 *	@Author: Nate Corcoran <CLDMV>
 *	@Email: <Shinrai@users.noreply.github.com>
 *	-----
 *	@Last modified by: Nate Corcoran <CLDMV> (Shinrai@users.noreply.github.com)
 *	@Last modified time: 2026-03-01 20:21:18 -08:00 (1772425278)
 *	-----
 *	@Copyright: Copyright (c) 2013-2026 Catalyzed Motivation Inc. All rights reserved.
 */

/**
 * @fileoverview Input management API module for TV Remote subfolder testing.
 * @module api_tv_test.subfolder.input
 * @memberof module:api_tv_test
 */
/**
 * @namespace input
 * @memberof module:api_tv_test.subfolder
 * @alias module:api_tv_test.subfolder.input
 */
export async function setInput(inputName, _ = {}) {
	return { success: true, input: inputName };
}

export function getAllInputNames() {
	return ["HDMI1", "HDMI2", "HDMI3", "USB", "Component", "AV"];
}

export function getCurrentInput() {
	return "HDMI1";
}

export default setInput;
