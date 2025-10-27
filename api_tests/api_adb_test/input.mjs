/**
 * Input management API module for Android TV Remote - Dummy implementation for testing.
 * Provides input handling and key mapping functionality.
 * @module input
 */

// Slothlet runtime imports for live bindings
import { self } from "@cldmv/slothlet/runtime";

// Dummy key data
const keyboardKeys = {
	"ENTER": "66",
	"SPACE": "62",
	"BACKSPACE": "67",
	"TAB": "61"
};

const keycodes = {
	"66": "KEYCODE_ENTER",
	"62": "KEYCODE_SPACE",
	"67": "KEYCODE_DEL",
	"61": "KEYCODE_TAB"
};

/**
 * Sends text input to the device.
 * @param {string} text - Text to input
 * @returns {Promise<void>}
 */
export async function text(text) {
	return Promise.resolve({ inputText: text });
}

/**
 * Sends a key event.
 * @param {string|number} key - Key name or code
 * @returns {Promise<void>}
 */
export async function key(key) {
	return Promise.resolve({ keyPressed: key });
}

/**
 * Sends a tap event at coordinates.
 * @param {number} x - X coordinate
 * @param {number} y - Y coordinate
 * @returns {Promise<void>}
 */
export async function tap(x, y) {
	return Promise.resolve({ tapped: { x, y } });
}

/**
 * Sends a swipe gesture.
 * @param {number} startX - Start X coordinate
 * @param {number} startY - Start Y coordinate
 * @param {number} endX - End X coordinate
 * @param {number} endY - End Y coordinate
 * @param {number} [duration=300] - Swipe duration in ms
 * @returns {Promise<void>}
 */
export async function swipe(startX, startY, endX, endY, duration = 300) {
	return Promise.resolve({
		swipe: { startX, startY, endX, endY, duration }
	});
}

/**
 * Gets available keyboard keys.
 * @returns {Object} Keyboard keys mapping
 */
export function getKeyboardKeys() {
	return keyboardKeys;
}

/**
 * Gets keycodes mapping.
 * @returns {Object} Keycodes mapping
 */
export function getKeycodes() {
	return keycodes;
}

// Default export object
const input = {
	text,
	key,
	tap,
	swipe,
	getKeyboardKeys,
	getKeycodes
};

export default input;
