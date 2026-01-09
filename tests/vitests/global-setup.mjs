/**
 * @fileoverview Global setup for vitest - triggers devcheck validation
 *
 * This setup runs before any tests in the main process and imports slothlet,
 * which triggers devcheck validation. If devcheck fails, it should stop
 * vitest execution before any workers are spawned.
 */

export async function setup() {
	// console.log("🚀 GLOBAL SETUP: Starting devcheck validation...");
	// console.log("🚀 GLOBAL SETUP: NODE_ENV =", process.env.NODE_ENV);
	// console.log("🚀 GLOBAL SETUP: NODE_OPTIONS =", process.env.NODE_OPTIONS);

	// eslint-disable-next-line no-useless-catch
	try {
		// Import devcheck directly to avoid index.mjs try/catch
		await import("@cldmv/slothlet/devcheck");
		// console.log("🚀 GLOBAL SETUP: Devcheck completed");
	} catch (error) {
		// console.log("🚀 GLOBAL SETUP: Devcheck failed:", error.message);
		throw error;
	}
}
