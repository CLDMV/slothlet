/**
 * @fileoverview Simplified LG TV disconnect functionality for testing.
 */

export async function disconnect(_ = {}) {
	return { success: true };
}

export async function forceDisconnect() {
	return { success: true };
}

export function isConnected() {
	return false;
}

export function isReady() {
	return true;
}

export function getStatus() {
	return "disconnected";
}

export default disconnect;
