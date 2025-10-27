/**
 * Presses a remote control key.
 * @param {string} keyName - Name of the key to press
 * @returns {Promise<void>}
 */
export function key(keyName: string): Promise<void>;
/**
 * Presses the power button.
 * @returns {Promise<void>}
 */
export function power(): Promise<void>;
/**
 * Presses the home button.
 * @returns {Promise<void>}
 */
export function home(): Promise<void>;
/**
 * Presses the back button.
 * @returns {Promise<void>}
 */
export function back(): Promise<void>;
/**
 * Presses navigation keys.
 * @param {string} direction - Direction ("up", "down", "left", "right")
 * @returns {Promise<void>}
 */
export function navigate(direction: string): Promise<void>;
/**
 * Presses the select/OK button.
 * @returns {Promise<void>}
 */
export function select(): Promise<void>;
/**
 * Gets available remote keys.
 * @returns {Object} Remote keys mapping
 */
export function getRemoteKeys(): any;
/**
 * Gets keycodes mapping.
 * @returns {Object} Keycodes mapping
 */
export function getKeycodes(): any;
export default press;
declare namespace press {
    export { key };
    export { power };
    export { home };
    export { back };
    export { navigate };
    export { select };
    export { getRemoteKeys };
    export { getKeycodes };
}
//# sourceMappingURL=press.d.mts.map