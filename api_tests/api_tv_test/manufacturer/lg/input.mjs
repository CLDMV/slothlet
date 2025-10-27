/**
 * @fileoverview Simplified LG TV input functionality for testing.
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