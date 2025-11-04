/**
 * @fileoverview TV controllers in subfolder - testing proxy behavior in nested structure
 */

/**
 * Mock TV Controller class for testing proxy behavior in subfolder.
 */
class SubfolderTVController {
	constructor(tvId) {
		this.tvId = tvId;
		console.log(`📺 SubfolderTVController created for ${tvId}`);
	}

	powerOn() {
		console.log(`🟢 Subfolder ${this.tvId} powered on`);
		return `Subfolder ${this.tvId} is now ON`;
	}

	powerOff() {
		console.log(`🔴 Subfolder ${this.tvId} powered off`);
		return `Subfolder ${this.tvId} is now OFF`;
	}

	getStatus() {
		return `Subfolder ${this.tvId} status: active`;
	}
}

/**
 * Helper function for subfolder controllers.
 */
export function getControllerCount() {
	return 4;
}

/**
 * Helper function to validate TV ID.
 */
export function validateTvId(tvId) {
	return typeof tvId === "string" && tvId.startsWith("tv");
}

/**
 * Subfolder TV Controllers proxy - has both default export (proxy) and named exports.
 */
const SubfolderControllers = new Proxy(
	{},
	{
		get(target, prop) {
			console.log(`🔍 Subfolder Proxy get called with prop: "${String(prop)}" (type: ${typeof prop})`);

			// First check if the property exists on the target (for attached named exports)
			if (prop in target) {
				return target[prop];
			}

			// Handle numeric indices (0, 1, 2, 3 -> tv1, tv2, tv3, tv4)
			if (typeof prop === "string" && /^\d+$/.test(prop)) {
				const index = parseInt(prop);
				const tvId = `tv${index + 1}`; // Convert 0->tv1, 1->tv2, etc.
				return new SubfolderTVController(tvId);
			}

			// Handle direct TV IDs (tv1, tv2, etc.)
			if (typeof prop === "string" && prop.startsWith("tv")) {
				return new SubfolderTVController(prop);
			}

			// Return undefined for invalid properties
			return undefined;
		}
	}
);

console.log("🏗️ SubfolderControllers proxy created during module initialization");

export default SubfolderControllers;
