/**
 *	@Project: @cldmv/slothlet
 *	@Filename: /api_tests/api_adb_test/inputHelpers.mjs
 *	@Date: 2025-10-27T11:28:27-07:00 (1761589707)
 *	@Author: Nate Corcoran <CLDMV>
 *	@Email: <Shinrai@users.noreply.github.com>
 *	-----
 *	@Last modified by: Nate Corcoran <CLDMV> (Shinrai@users.noreply.github.com)
 *	@Last modified time: 2026-03-01 20:16:57 -08:00 (1772425017)
 *	-----
 *	@Copyright: Copyright (c) 2013-2026 Catalyzed Motivation Inc. All rights reserved.
 */

// Slothlet runtime imports for live bindings
import { self, context } from "@cldmv/slothlet/runtime";

/**
	* Sends a keycode to the device using input keyevent.
	*	@param {number} keycode - The Android keycode to send
	*	@returns {Promise<string>} Shell command output
	*	@example
	* await api.inputHelpers.sendKeycode(3); // KEYCODE_HOME
	*/
export async function sendKeycode(keycode) {
	await self.connection.ensureConnected();
	self.connection.resetDisconnectTimer();
	return await context.device.shell(`input keyevent ${keycode}`);
}

/**
	* Sends text input to the device.
	*	@param {string} text - The text to input
	*	@returns {Promise<string>} Shell command output
	*	@example
	* await api.inputHelpers.sendText('Hello World');
	*/
export async function sendText(text) {
	const escaped = text.replace(/ /g, "%s");
	await self.connection.ensureConnected();
	self.connection.resetDisconnectTimer();
	return await context.device.shell('input text "' + escaped + '"');
}

/**
	* Sends a tap gesture at specified coordinates.
	*	@param {number} x - X coordinate
	*	@param {number} y - Y coordinate
	*	@returns {Promise<string>} Shell command output
	*	@example
	* await api.inputHelpers.sendTap(500, 300);
	*/
export async function sendTap(x, y) {
	await self.connection.ensureConnected();
	self.connection.resetDisconnectTimer();
	return await context.device.shell(`input tap ${x} ${y}`);
}

/**
	* Sends a swipe gesture between two points.
	*	@param {number} x1 - Start X coordinate
	*	@param {number} y1 - Start Y coordinate
	*	@param {number} x2 - End X coordinate
	*	@param {number} y2 - End Y coordinate
	*	@param {number} [duration=300] - Swipe duration in milliseconds
	*	@returns {Promise<string>} Shell command output
	*	@example
	* await api.inputHelpers.sendSwipe(100, 500, 900, 500, 500); // Horizontal swipe
	*/
export async function sendSwipe(x1, y1, x2, y2, duration = 300) {
	await self.connection.ensureConnected();
	self.connection.resetDisconnectTimer();
	return await context.device.shell(`input swipe ${x1} ${y1} ${x2} ${y2} ${duration}`);
}

/**
	* Sends a long press keycode using sendevent.
	*	@param {number} keycode - The keycode to long press
	*	@returns {Promise<string>} Shell command output
	*	@example
	* await api.inputHelpers.sendLongPress(26); // Long press power button
	*/
export async function sendLongPress(keycode) {
	const cmd = `sendevent ${context.inputDevice} 1 ${keycode} 1 && sleep 1 && sendevent ${context.inputDevice} 1 ${keycode} 0`;
	await self.connection.ensureConnected();
	self.connection.resetDisconnectTimer();
	return await context.device.shell(cmd);
}

