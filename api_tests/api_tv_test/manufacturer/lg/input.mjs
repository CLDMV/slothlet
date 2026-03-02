/**
 *	@Project: @cldmv/slothlet
 *	@Filename: /api_tests/api_tv_test/manufacturer/lg/input.mjs
 *	@Date: 2025-10-27T09:42:13-07:00 (1761583333)
 *	@Author: Nate Corcoran <CLDMV>
 *	@Email: <Shinrai@users.noreply.github.com>
 *	-----
 *	@Last modified by: Nate Corcoran <CLDMV> (Shinrai@users.noreply.github.com)
 *	@Last modified time: 2026-03-01 20:21:17 -08:00 (1772425277)
 *	-----
 *	@Copyright: Copyright (c) 2013-2026 Catalyzed Motivation Inc. All rights reserved.
 */

/**
 * ADB API module for Android TV Remote - Dummy implementation for testing.
 */
export async function setInput(inputName, _ = {}) {
	return { success: true, input: inputName };
}

export function getAllInputNames() {
	return ["HDMI1", "HDMI2", "USB", "AV"];
}

export function getCurrentInput() {
	return "HDMI1";
}
