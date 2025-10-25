/**
 * @fileoverview Simplified TV input functionality for testing.
 */

export async function setInput(inputName, _ = {}) {
	return { success: true, input: inputName };
}

export function getAllInputNames() {
	return ["HDMI1", "HDMI2", "HDMI3", "USB", "Component", "AV"];
}

export function getCurrentInput() {
	return "HDMI1";
}

export default setInput;