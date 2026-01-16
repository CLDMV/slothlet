/**
 *	@Project: @cldmv/slothlet
 *	@Filename: /api_tests/api_test/multi_defaults/key.mjs
 *	@Date: 2025-10-23 11:19:33 -07:00 (1761243573)
 *	@Author: Nate Hyson <CLDMV>
 *	@Email: <Shinrai@users.noreply.github.com>
 *	-----
 *	@Last modified by: Nate Hyson <CLDMV> (Shinrai@users.noreply.github.com)
 *	@Last modified time: 2025-10-23 11:20:01 -07:00 (1761243601)
 *	-----
 *	@Copyright: Copyright (c) 2013-2025 Catalyzed Motivation Inc. All rights reserved.
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
