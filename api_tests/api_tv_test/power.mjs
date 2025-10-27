/**
 * @fileoverview Simplified TV power functionality for testing.
 */

export async function on(_ = {}) {
	return { success: true, state: "on" };
}

export async function off(_ = {}) {
	return { success: true, state: "off" };
}

export async function toggle(_ = {}) {
	return { success: true, state: "toggled" };
}

export async function getState(_ = {}) {
	return { state: "on" };
}

export default toggle;