/**
 * @file api/devices/firetv.mjs - Fire TV control (stripped for testing)
 * @description Minimal device control module for testing slothlet proxy behavior
 */
/**
 * Initializes Fire TV/Android TV controller (mock)
 * @param {Object} config - Android TV configuration
 * @returns {Promise<Object|null>} Mock device instance or null if disabled
 */
export function initialize(config: any): Promise<any | null>;
/**
 * Powers on Fire TV device (mock)
 * @param {string} deviceId - Device identifier
 * @returns {Promise<boolean>} Success status
 */
export function powerOn(deviceId?: string): Promise<boolean>;
/**
 * Powers off Fire TV device (mock)
 * @param {string} deviceId - Device identifier
 * @returns {Promise<boolean>} Success status
 */
export function powerOff(deviceId?: string): Promise<boolean>;
/**
 * Sends key to Fire TV device (mock)
 * @param {string} deviceId - Device identifier
 * @param {string} keyCode - Key to send
 * @returns {Promise<boolean>} Success status
 */
export function sendKey(deviceId: string, keyCode: string): Promise<boolean>;
export namespace REMOTE_KEYS {
    let POWER: string;
    let SLEEP: string;
    let HOME: string;
    let BACK: string;
    let MENU: string;
    let UP: string;
    let DOWN: string;
    let LEFT: string;
    let RIGHT: string;
    let CENTER: string;
    let SELECT: string;
    let VOLUME_UP: string;
    let VOLUME_DOWN: string;
    let MUTE: string;
    let PLAY: string;
    let PAUSE: string;
    let PLAY_PAUSE: string;
    let STOP: string;
    let NEXT: string;
    let PREVIOUS: string;
    let FAST_FORWARD: string;
    let REWIND: string;
}
//# sourceMappingURL=firetv.d.mts.map