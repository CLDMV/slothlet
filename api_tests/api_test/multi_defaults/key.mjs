/**
 *	@Project: @cldmv/slothlet
 *	@Filename: /api_tests/api_test/multi_defaults/key.mjs
 *	@Date: 2025-10-23T12:08:52-07:00 (1761246532)
 *	@Author: Nate Hyson <CLDMV>
 *	@Email: <Shinrai@users.noreply.github.com>
 *	-----
 *	@Last modified by: Nate Hyson <CLDMV> (Shinrai@users.noreply.github.com)
 *	@Last modified time: 2026-02-10 18:02:01 -08:00 (1770775321)
 *	-----
 *	@Copyright: Copyright (c) 2013-2026 Catalyzed Motivation Inc. All rights reserved.
 */

/**
 * ADB API module for Android TV Remote - Dummy implementation for testing.
 */
export function press(keyName) {
	return `Key pressed: ${keyName}`;
}

export function getKeyCode(keyName) {
	return `Code for ${keyName}`;
}

function sendKey(keyName) {
	return `Sent key: ${keyName}`;
}

export default sendKey;

