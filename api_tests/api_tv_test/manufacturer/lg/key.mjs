/**
 * @fileoverview Simplified LG TV key functionality for testing.
 */

export async function key(keyName, _ = {}) {
	return { success: true, key: keyName };
}

export async function sequence(keyNames, _ = {}) {
	return { success: true, keys: keyNames };
}

export async function navigation(direction, _ = {}) {
	return { success: true, direction: direction };
}

export async function number(number, _ = {}) {
	return { success: true, number: number };
}

export async function volume(action, _ = {}) {
	return { success: true, action: action };
}

export async function channel(action, _ = {}) {
	return { success: true, action: action };
}

export async function color(color, _ = {}) {
	return { success: true, color: color };
}

export default key;