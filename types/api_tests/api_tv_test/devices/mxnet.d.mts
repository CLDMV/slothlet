/**
 * @file api/devices/mxnet.mjs - MXNet device control (stripped for testing)
 * @description Minimal device control module for testing slothlet behavior
 */
/**
 * Initializes MXNet device controller (mock)
 * @param {Object} config - MXNet configuration
 * @returns {Promise<Object|null>} Mock device instance or null if disabled
 */
export function initialize(config: any): Promise<any | null>;
/**
 * Powers on MXNet device (mock)
 * @param {string} deviceId - Device identifier
 * @returns {Promise<boolean>} Success status
 */
export function powerOn(deviceId?: string): Promise<boolean>;
/**
 * Powers off MXNet device (mock)
 * @param {string} deviceId - Device identifier
 * @returns {Promise<boolean>} Success status
 */
export function powerOff(deviceId?: string): Promise<boolean>;
/**
 * Sends command to MXNet device (mock)
 * @param {string} deviceId - Device identifier
 * @param {string} command - Command to send
 * @returns {Promise<Object>} Command response
 */
export function sendCommand(deviceId: string, command: string): Promise<any>;
/**
 * Gets device status (mock)
 * @param {string} deviceId - Device identifier
 * @returns {Promise<Object>} Device status
 */
export function getStatus(deviceId?: string): Promise<any>;
/**
 * Helper function to validate command constants (demonstrates usage)
 * @param {string} command - Command to validate
 * @returns {boolean} True if command is valid
 * @example
 * isValidCommand(COMMANDS.POWER_ON); // true
 */
export function isValidCommand(command: string): boolean;
export namespace COMMANDS {
    let POWER_ON: string;
    let POWER_OFF: string;
    let STATUS: string;
    let REBOOT: string;
    let RESET: string;
}
//# sourceMappingURL=mxnet.d.mts.map