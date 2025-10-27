/**
 * Initializes ADB client and device connection.
 * @param {string} host - Device host/IP
 * @param {number} [port=5555] - ADB port
 * @returns {Promise<void>}
 */
export function initialize(host: string, port?: number): Promise<void>;
/**
 * Gets the current ADB client instance.
 * @returns {Object} ADB client
 */
export function getClient(): any;
/**
 * Gets the current device instance.
 * @returns {Object} ADB device
 */
export function getDevice(): any;
/**
 * Gets the current device ID.
 * @returns {string} Device ID
 */
export function getDeviceId(): string;
/**
 * Executes an ADB shell command.
 * @param {string} command - Shell command to execute
 * @returns {Promise<string>} Command output
 */
export function shell(command: string): Promise<string>;
/**
 * Connects to the device.
 * @returns {Promise<void>}
 */
export function connect(): Promise<void>;
/**
 * Disconnects from the device.
 * @returns {Promise<void>}
 */
export function disconnect(): Promise<void>;
/**
 * Executes an input command.
 * @param {string} inputCommand - Input command (keyevent, text, tap, etc.)
 * @returns {Promise<string>} Command output
 */
export function input(inputCommand: string): Promise<string>;
/**
 * Takes a screenshot and returns the buffer.
 * @returns {Promise<Buffer>} Screenshot buffer
 */
export function screenshot(): Promise<Buffer>;
/**
 * Lists installed packages.
 * @returns {Promise<string[]>} Array of package names
 */
export function listPackages(): Promise<string[]>;
/**
 * Gets device properties.
 * @returns {Promise<Object>} Device properties
 */
export function getProperties(): Promise<any>;
export default adb;
declare namespace adb {
    export { initialize };
    export { getClient };
    export { getDevice };
    export { getDeviceId };
    export { shell };
    export { connect };
    export { disconnect };
    export { input };
    export { screenshot };
    export { listPackages };
    export { getProperties };
}
//# sourceMappingURL=adb.d.mts.map