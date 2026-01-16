/**
 * @fileoverview Simplified TV key functionality for testing.
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