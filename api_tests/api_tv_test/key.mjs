/**
 *	@Project: @cldmv/slothlet
 *	@Filename: /api_tests/api_tv_test/key.mjs
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
 * @fileoverview Key input API module for TV Remote testing.
 * @module api_tv_test.key
 * @memberof module:api_tv_test
 */
export async function key(keyName, _ = {}) {
	return { success: true, key: keyName };
}

export function getAllKeyNames() {
	return ["POWER", "HOME", "UP", "DOWN", "LEFT", "RIGHT", "OK", "BACK"];
}

export function getKeyCode(keyName) {
	const codes = {
		POWER: 1,
		HOME: 2,
		UP: 3,
		DOWN: 4
	};
	return codes[keyName] || 0;
}

export default key;
