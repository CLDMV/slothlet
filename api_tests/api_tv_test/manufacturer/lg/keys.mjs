/**
 * @fileoverview Simplified LG TV keys and inputs for testing.
 */

export const inputs = {
	HDMI1: "HDMI_1",
	HDMI2: "HDMI_2",
	USB: "USB"
};

export const keys = {
	POWER: "POWER",
	HOME: "HOME",
	UP: "UP",
	DOWN: "DOWN"
};

export const keyMap = new Map([
	["POWER", "POWER"],
	["HOME", "HOME"],
	["UP", "UP"],
	["DOWN", "DOWN"]
]);

export function getKeyCode(keyName) {
	return keys[keyName] || "UNKNOWN";
}

export function getKeyCommand(keyName) {
	return `cmd_${keyName}`;
}

export function isValidKey(keyName) {
	return keyName in keys;
}

export function getAllKeyNames() {
	return Object.keys(keys);
}

export function getAllInputNames() {
	return Object.keys(inputs);
}

export function getInputCode(inputName) {
	return inputs[inputName] || "UNKNOWN";
}

export function isValidInput(inputName) {
	return inputName in inputs;
}