/**
 * Sends a keycode to the device using input keyevent.
 * @param {number} keycode - The Android keycode to send
 * @returns {Promise<string>} Shell command output
 * @example
 * await api.inputHelpers.sendKeycode(3); // KEYCODE_HOME
 */
export function sendKeycode(keycode: number): Promise<string>;
/**
 * Sends text input to the device.
 * @param {string} text - The text to input
 * @returns {Promise<string>} Shell command output
 * @example
 * await api.inputHelpers.sendText('Hello World');
 */
export function sendText(text: string): Promise<string>;
/**
 * Sends a tap gesture at specified coordinates.
 * @param {number} x - X coordinate
 * @param {number} y - Y coordinate
 * @returns {Promise<string>} Shell command output
 * @example
 * await api.inputHelpers.sendTap(500, 300);
 */
export function sendTap(x: number, y: number): Promise<string>;
/**
 * Sends a swipe gesture between two points.
 * @param {number} x1 - Start X coordinate
 * @param {number} y1 - Start Y coordinate
 * @param {number} x2 - End X coordinate
 * @param {number} y2 - End Y coordinate
 * @param {number} [duration=300] - Swipe duration in milliseconds
 * @returns {Promise<string>} Shell command output
 * @example
 * await api.inputHelpers.sendSwipe(100, 500, 900, 500, 500); // Horizontal swipe
 */
export function sendSwipe(x1: number, y1: number, x2: number, y2: number, duration?: number): Promise<string>;
/**
 * Sends a long press keycode using sendevent.
 * @param {number} keycode - The keycode to long press
 * @returns {Promise<string>} Shell command output
 * @example
 * await api.inputHelpers.sendLongPress(26); // Long press power button
 */
export function sendLongPress(keycode: number): Promise<string>;
//# sourceMappingURL=inputHelpers.d.mts.map