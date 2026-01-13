/**
 * @file api/devices/lg.mjs - LG TV control (stripped for testing)
 * @description Minimal device control module with proxy for testing slothlet proxy behavior
 */

/**
 * TV Controller class for individual TV operations (mock)
 * Enables array-style access like lg[0].power.on()
 */
class TVController {
	constructor(tvId) {
		this.tvId = tvId;
		this.power = {
			on: () => {
				console.log(`Mock: Powering on TV ${tvId}`);
				return Promise.resolve(true);
			},
			off: () => {
				console.log(`Mock: Powering off TV ${tvId}`);
				return Promise.resolve(true);
			}
		};
		this.volume = {
			set: (level) => {
				console.log(`Mock: Setting volume on TV ${tvId} to ${level}`);
				return Promise.resolve(true);
			},
			up: (step = 1) => {
				console.log(`Mock: Volume up on TV ${tvId} by ${step}`);
				return Promise.resolve(true);
			},
			down: (step = 1) => {
				console.log(`Mock: Volume down on TV ${tvId} by ${step}`);
				return Promise.resolve(true);
			}
		};
		this.input = {
			set: (source) => {
				console.log(`Mock: Setting input on TV ${tvId} to ${source}`);
				return Promise.resolve(true);
			}
		};
	}
}

/**
 * Cache for TV controller instances to ensure lg[0] === lg[0]
 */
const tvControllerCache = new Map();

/**
 * Get or create a TV controller instance with caching
 * @param {string} tvId - TV identifier (tv1, tv2, etc.)
 * @returns {TVController} TV controller instance
 */
function getTVController(tvId) {
	if (!tvControllerCache.has(tvId)) {
		tvControllerCache.set(tvId, new TVController(tvId));
	}
	return tvControllerCache.get(tvId);
}

// Mock named export functions for slothlet to attach

/**
 * Powers on all TVs (mock)
 * @returns {Promise<boolean>} Success status
 */
export async function powerOnAll() {
	console.log("Mock: Powering on all TVs");
	return true;
}

/**
 * Powers off all TVs (mock)
 * @returns {Promise<boolean>} Success status
 */
export async function powerOffAll() {
	console.log("Mock: Powering off all TVs");
	return true;
}

/**
 * Gets TV status (mock)
 * @param {string} tvId - TV identifier
 * @returns {Promise<Object>} TV status
 */
export async function getStatus(tvId) {
	if (process.env.DEBUG_MOCK === "1" || process.env.DEBUG_MOCK === "true") console.log(`Mock: Getting status for TV ${tvId}`);
	return {
		tvId,
		power: "on",
		volume: 50,
		input: "HDMI1",
		connected: true
	};
}

/**
 * Clear the TV controller cache (mock)
 */
export function clearCache() {
	console.log("Mock: Clearing TV controller cache");
	tvControllerCache.clear();
}

/**
 * Combined LG TV Controller object (Slothlet-compatible)
 * Provides both named exports (lg.power.on, lg.volume.set) and array-style access (lg[0], lg.tv1)
 * Uses caching to ensure consistent instances: lg[0] === lg[0]
 */
const LGTVControllers = new Proxy(
	{},
	{
		get(target, prop) {
			if (process.env.DEBUG_PROXY === "1" || process.env.DEBUG_PROXY === "true")
				console.log(`🔍 Proxy get called with prop: "${String(prop)}" (type: ${typeof prop})`);

			// ✅ FIRST: Check if property exists on target (Slothlet-attached named exports)
			if (prop in target) {
				if (process.env.DEBUG_PROXY === "1" || process.env.DEBUG_PROXY === "true")
					console.log(`📋 Found property "${String(prop)}" in target`);
				return target[prop];
			}

			// ✅ THEN: Handle custom proxy logic for TV access
			// Handle numeric indices (0, 1, 2, 3 -> tv1, tv2, tv3, tv4)
			if (typeof prop === "string" && /^\d+$/.test(prop)) {
				const index = parseInt(prop);
				const tvId = `tv${index + 1}`; // Convert 0->tv1, 1->tv2, etc.
				if (process.env.DEBUG_PROXY === "1" || process.env.DEBUG_PROXY === "true")
					console.log(`🎯 Creating TVController for index ${index} → ${tvId}`);
				return getTVController(tvId);
			}

			// Handle direct TV IDs (tv1, tv2, etc.)
			if (typeof prop === "string" && prop.startsWith("tv")) {
				if (process.env.DEBUG_PROXY === "1" || process.env.DEBUG_PROXY === "true")
					console.log(`🎯 Creating TVController for TV ID: ${prop}`);
				return getTVController(prop);
			}

			// Return undefined for invalid properties
			if (process.env.DEBUG_PROXY === "1" || process.env.DEBUG_PROXY === "true") console.log(`❓ Property "${String(prop)}" not found`);
			return undefined;
		}
	}
);

/**
 * Default export of LGTVControllers proxy.
 * @default
 */
export default LGTVControllers;
