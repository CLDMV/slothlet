/**
 * @fileoverview Pure proxy test for slothlet - only default export
 */

/**
 * Mock TV Controller class for testing proxy behavior.
 */
class TVController {
	constructor(tvId) {
		this.tvId = tvId;
		console.log(`📺 TVController created for ${tvId}`);
	}

	powerOn() {
		console.log(`🟢 ${this.tvId} powered on`);
		return `${this.tvId} is now ON`;
	}

	powerOff() {
		console.log(`🔴 ${this.tvId} powered off`);
		return `${this.tvId} is now OFF`;
	}

	getStatus() {
		return `${this.tvId} status: active`;
	}
}

/**
 * LG TV Controllers proxy object that provides dynamic TV controller access.
 * This is the ONLY export to test pure proxy behavior.
 */
const LGTVControllers = new Proxy(
	{},
	{
		get(target, prop) {
			console.log(`🔍 Proxy get called with prop: "${String(prop)}" (type: ${typeof prop})`);
			// Handle numeric indices (0, 1, 2, 3 -> tv1, tv2, tv3, tv4)
			if (typeof prop === "string" && /^\d+$/.test(prop)) {
				const index = parseInt(prop);
				const tvId = `tv${index + 1}`; // Convert 0->tv1, 1->tv2, etc.
				return new TVController(tvId);
			}

			// Handle direct TV IDs (tv1, tv2, etc.)
			if (typeof prop === "string" && prop.startsWith("tv")) {
				return new TVController(prop);
			}

			// Return undefined for invalid properties
			return undefined;
		}
	}
);

console.log("🏗️ LGTVControllers proxy created during module initialization");

export default LGTVControllers;
