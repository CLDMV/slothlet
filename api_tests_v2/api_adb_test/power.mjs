/**
 * Power management API module for Android TV Remote.
 * Provides device power control, boot monitoring, and wake functionality.
 * @module power
 */

// Slothlet runtime imports for live bindings
import { self, context } from "@cldmv/slothlet/runtime";

/**
 * Powers on the Android TV device and ensures it's awake.
 * @returns {Promise<void>}
 * @example
 * await api.power.on();
 */
export async function on() {
	await self.connection.ensureConnected();

	if (!context.quiet) context.emitLog("info", "Powering on device...", "power.on");

	// Send power button press
	await self.connection.shell("input keyevent 26"); // KEYCODE_POWER

	// Wait a moment for power state to change
	await new Promise((resolve) => setTimeout(resolve, 2000));

	// Verify power state
	const powerOutput = await self.connection.shell('dumpsys power | grep -E "(mIsPowered|mWakefulness)"');
	const powerState = context.parsePowerState(powerOutput);

	if (!context.quiet) {
		context.emitLog("info", `Power state: ${powerState.mWakefulness || "Unknown"}`, "power.on");
	}
}

/**
 * Powers off the Android TV device.
 * @returns {Promise<void>}
 * @example
 * await api.power.off();
 */
export async function off() {
	await self.connection.ensureConnected();

	if (!context.quiet) context.emitLog("info", "Powering off device...", "power.off");

	// Long press power button to bring up power menu, then select power off
	await self.connection.shell("input keyevent --longpress 26"); // Long press KEYCODE_POWER
}

/**
 * Ensures the device is awake and responsive.
 * @returns {Promise<void>}
 * @example
 * await api.power.wake();
 */
export async function wake() {
	await self.connection.ensureConnected();

	// Check current power state
	const powerOutput = await self.connection.shell('dumpsys power | grep -E "(mIsPowered|mWakefulness|mScreenOn)"');
	const powerState = context.parsePowerState(powerOutput);

	if (!context.quiet) {
		context.emitLog("info", `Current wakefulness: ${powerState.mWakefulness || "Unknown"}`, "power.wake");
	}

	// If not awake, wake it up
	if (powerState.mWakefulness !== "Awake") {
		if (!context.quiet) context.emitLog("info", "Waking device...", "power.wake");

		// Send wake commands
		await self.connection.shell("input keyevent 224"); // KEYCODE_WAKEUP
		await self.connection.shell("input keyevent 82"); // KEYCODE_MENU (alternative wake)

		// Wait for device to wake
		await new Promise((resolve) => setTimeout(resolve, 1500));

		// Verify wake state
		const newPowerOutput = await self.connection.shell('dumpsys power | grep -E "(mWakefulness)"');
		const newPowerState = context.parsePowerState(newPowerOutput);

		if (!context.quiet) {
			context.emitLog("info", `New wakefulness: ${newPowerState.mWakefulness || "Unknown"}`, "power.wake");
		}
	}
}

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
export async function reboot(options = {}) {
	const { waitForBoot = true, timeout = 120000 } = options;

	await self.connection.ensureConnected();

	if (!context.quiet) context.emitLog("info", "Rebooting device...", "power.reboot");

	try {
		// Issue reboot command
		await self.connection.shell("reboot");

		if (!context.quiet) context.emitLog("info", "Reboot command sent", "power.reboot");

		if (waitForBoot) {
			await waitBootComplete({ timeout });
		}
	} catch (error) {
		context.emitError(error, "power.reboot", "Failed to reboot device");
		throw error;
	}
}

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
export async function waitBootComplete(options = {}) {
	const { timeout = 120000, pollInterval = 3000 } = options;
	const startTime = Date.now();

	if (!context.quiet) context.emitLog("info", "Waiting for device to finish booting...", "power.waitBootComplete");

	while (Date.now() - startTime < timeout) {
		try {
			// Check if boot is complete
			const bootOutput = await self.connection.shell("getprop sys.boot_completed");

			if (bootOutput.trim() === "1") {
				// Also check if package manager is ready
				const pmOutput = await self.connection.shell("pm list packages -f | head -1");

				if (pmOutput && pmOutput.includes("package:")) {
					if (!context.quiet) {
						const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
						context.emitLog("info", `Device boot completed in ${elapsed}s`, "power.waitBootComplete");
					}
					return;
				}
			}
		} catch (error) {
			// Device might not be responsive yet, continue waiting
			if (!context.quiet && error.message.includes("device offline")) {
				context.emitLog("debug", "Device still offline, continuing to wait...", "power.waitBootComplete");
			}
		}

		// Wait before next check
		await new Promise((resolve) => setTimeout(resolve, pollInterval));
	}

	// Timeout reached
	const error = new Error(`Device boot timeout after ${timeout}ms`);
	context.emitError(error, "power.waitBootComplete", "Boot completion timeout");
	throw error;
}

/**
 * Gets the current power state of the device.
 * @returns {Promise<Object>} Power state information
 * @example
 * const power = await api.power.getState();
 * console.log(power.mIsPowered); // 'true' or 'false'
 * console.log(power.mWakefulness); // 'Awake', 'Asleep', etc.
 */
export async function getState() {
	await self.connection.ensureConnected();
	const output = await self.connection.shell('dumpsys power | grep -E "(mIsPowered|mWakefulness|mWakeLocks|mScreenOn)"');
	return context.parsePowerState(output);
}

/**
 * Checks if the device is currently awake.
 * @returns {Promise<boolean>} True if device is awake
 * @example
 * const isAwake = await api.power.isAwake();
 * if (isAwake) {
 *   console.log('Device is awake');
 * }
 */
export async function isAwake() {
	const powerState = await getState();
	return powerState.mWakefulness === "Awake";
}

/**
 * Checks if the device is powered on.
 * @returns {Promise<boolean>} True if device is powered
 * @example
 * const isPowered = await api.power.isPowered();
 * if (isPowered) {
 *   console.log('Device is powered on');
 * }
 */
export async function isPowered() {
	const powerState = await getState();
	return powerState.mIsPowered === "true";
}

/**
 * Enters sleep/standby mode.
 * @returns {Promise<void>}
 * @example
 * await api.power.sleep();
 */
export async function sleep() {
	await self.connection.ensureConnected();

	if (!context.quiet) context.emitLog("info", "Putting device to sleep...", "power.sleep");

	// Send sleep/standby command
	await self.connection.shell("input keyevent 223"); // KEYCODE_SLEEP
}
