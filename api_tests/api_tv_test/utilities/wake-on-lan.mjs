/**
 * @fileoverview Simplified wake-on-lan utility for testing.
 */

export async function wake(macAddress, _ = {}) {
	return { success: true, macAddress: macAddress };
}

export function isValidMacAddress(macAddress) {
	return typeof macAddress === "string" && macAddress.length > 0;
}

export function normalizeMacAddress(macAddress) {
	return macAddress.toUpperCase().replace(/[^A-F0-9]/g, "");
}