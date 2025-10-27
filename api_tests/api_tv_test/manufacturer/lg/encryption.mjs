/**
 * @fileoverview Simplified LG TV encryption functionality for testing.
 */

export function deriveKey(keycode, _ = {}) {
	return "derived_key_" + keycode;
}

export function generateRandomBytes(length) {
	return new Array(length).fill(0).map(() => Math.floor(Math.random() * 256));
}

export function addPadding(message, _ = 16) {
	return message;
}

export function removePadding(message) {
	return message;
}

export function encrypt(message, _ = {}) {
	return "encrypted_" + message;
}

export function decrypt(encryptedData, _ = {}) {
	return encryptedData.replace("encrypted_", "");
}

export function clearKeyCache() {
	// No operation
}
