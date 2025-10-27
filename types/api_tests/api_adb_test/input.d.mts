/**
 * Sends text input to the device.
 * @param {string} text - Text to input
 * @returns {Promise<void>}
 */
export function text(text: string): Promise<void>;
/**
 * Sends a key event.
 * @param {string|number} key - Key name or code
 * @returns {Promise<void>}
 */
export function key(key: string | number): Promise<void>;
/**
 * Sends a tap event at coordinates.
 * @param {number} x - X coordinate
 * @param {number} y - Y coordinate
 * @returns {Promise<void>}
 */
export function tap(x: number, y: number): Promise<void>;
/**
 * Sends a swipe gesture.
 * @param {number} startX - Start X coordinate
 * @param {number} startY - Start Y coordinate
 * @param {number} endX - End X coordinate
 * @param {number} endY - End Y coordinate
 * @param {number} [duration=300] - Swipe duration in ms
 * @returns {Promise<void>}
 */
export function swipe(startX: number, startY: number, endX: number, endY: number, duration?: number): Promise<void>;
/**
 * Gets available keyboard keys.
 * @returns {Object} Keyboard keys mapping
 */
export function getKeyboardKeys(): any;
/**
 * Gets keycodes mapping.
 * @returns {Object} Keycodes mapping
 */
export function getKeycodes(): any;
export default input;
declare namespace input {
    export { text };
    export { key };
    export { tap };
    export { swipe };
    export { getKeyboardKeys };
    export { getKeycodes };
}
//# sourceMappingURL=input.d.mts.map