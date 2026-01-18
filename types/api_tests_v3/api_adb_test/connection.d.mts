/**
 * Ensures the device is connected, attempting to connect if not.
 * @returns {Promise<void>}
 * @example
 * await remote.connection.ensureConnected();
 */
export function ensureConnected(): Promise<void>;
/**
 * Disconnects from the device.
 * @param {boolean} [isAutoDisconnect=false] - Whether this is an automatic disconnection.
 * @returns {Promise<void>}
 * @example
 * await remote.connection.disconnect();
 */
export function disconnect(isAutoDisconnect?: boolean): Promise<void>;
/**
 * Gets the current connection status.
 * @returns {boolean} True if connected, false otherwise.
 * @example
 * if (remote.connection.isConnected()) {
 *   // Device is connected
 * }
 */
export function isConnected(): boolean;
/**
 * Checks if the device is awake and responsive.
 * @returns {Promise<boolean>} True if device is awake, false otherwise.
 * @example
 * const awake = await remote.connection.isAwake();
 */
export function isAwake(): Promise<boolean>;
/**
 * Ensures the device is awake, waking it if necessary.
 * @returns {Promise<boolean>} True if device is awake, false otherwise.
 * @example
 * await remote.connection.ensureAwake();
 */
export function ensureAwake(): Promise<boolean>;
/**
 * Starts the heartbeat mechanism to maintain connection.
 * @returns {void}
 * @example
 * remote.connection.startHeartbeat();
 */
export function startHeartbeat(): void;
/**
 * Stops the heartbeat mechanism.
 * @returns {void}
 * @example
 * remote.connection.stopHeartbeat();
 */
export function stopHeartbeat(): void;
/**
 * Clears all active timers.
 * @returns {void}
 * @example
 * remote.connection.clearTimeouts();
 */
export function clearTimeouts(): void;
/**
 * Executes a shell command on the device.
 * @param {string} command - The shell command to execute
 * @param {Object} [options={}] - Command options
 * @param {boolean} [options.trim=true] - Whether to trim the output
 * @returns {Promise<string>} Command output
 * @example
 * const output = await remote.connection.shell('getprop ro.product.model');
 * console.log('Device model:', output);
 */
export function shell(command: string, options?: {
    trim?: boolean;
}): Promise<string>;
/**
 * Gets connection information and statistics.
 * @returns {Object} Connection information
 * @example
 * const info = remote.connection.getInfo();
 * console.log('Connection info:', info);
 */
export function getInfo(): any;
/**
 * Gets the connection event emitter for subscribing to connection events.
 * @returns {EventEmitter} The connection event emitter
 * @example
 * const emitter = remote.connection.getEmitter();
 * emitter.on('connected', (event) => {
 *   console.log('Connected to', event.host);
 * });
 */
export function getEmitter(): EventEmitter;
import { EventEmitter } from "events";
//# sourceMappingURL=connection.d.mts.map