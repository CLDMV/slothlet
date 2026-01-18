/**
 * Powers on the Android TV device and ensures it's awake.
 * @returns {Promise<void>}
 * @example
 * await api.power.on();
 */
export function on(): Promise<void>;
/**
 * Powers off the Android TV device.
 * @returns {Promise<void>}
 * @example
 * await api.power.off();
 */
export function off(): Promise<void>;
/**
 * Ensures the device is awake and responsive.
 * @returns {Promise<void>}
 * @example
 * await api.power.wake();
 */
export function wake(): Promise<void>;
/**
 * Reboots the Android TV device.
 * @param {Object} [options={}] - Reboot options
 * @param {boolean} [options.waitForBoot=true] - Wait for device to finish booting
 * @param {number} [options.timeout=120000] - Boot timeout in milliseconds
 * @returns {Promise<void>}
 * @example
 * await api.power.reboot();
 *
 * // Reboot without waiting
 * await api.power.reboot({ waitForBoot: false });
 */
export function reboot(options?: {
    waitForBoot?: boolean;
    timeout?: number;
}): Promise<void>;
/**
 * Waits for the device to complete booting.
 * @param {Object} [options={}] - Wait options
 * @param {number} [options.timeout=120000] - Boot timeout in milliseconds
 * @param {number} [options.pollInterval=3000] - Polling interval in milliseconds
 * @returns {Promise<void>}
 * @example
 * await api.power.waitBootComplete();
 *
 * // Custom timeout
 * await api.power.waitBootComplete({ timeout: 180000 });
 */
export function waitBootComplete(options?: {
    timeout?: number;
    pollInterval?: number;
}): Promise<void>;
/**
 * Gets the current power state of the device.
 * @returns {Promise<Object>} Power state information
 * @example
 * const power = await api.power.getState();
 * console.log(power.mIsPowered); // 'true' or 'false'
 * console.log(power.mWakefulness); // 'Awake', 'Asleep', etc.
 */
export function getState(): Promise<any>;
/**
 * Checks if the device is currently awake.
 * @returns {Promise<boolean>} True if device is awake
 * @example
 * const isAwake = await api.power.isAwake();
 * if (isAwake) {
 *   console.log('Device is awake');
 * }
 */
export function isAwake(): Promise<boolean>;
/**
 * Checks if the device is powered on.
 * @returns {Promise<boolean>} True if device is powered
 * @example
 * const isPowered = await api.power.isPowered();
 * if (isPowered) {
 *   console.log('Device is powered on');
 * }
 */
export function isPowered(): Promise<boolean>;
/**
 * Enters sleep/standby mode.
 * @returns {Promise<void>}
 * @example
 * await api.power.sleep();
 */
export function sleep(): Promise<void>;
//# sourceMappingURL=power.d.mts.map