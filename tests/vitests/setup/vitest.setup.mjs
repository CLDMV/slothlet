/**
 *	@Project: @cldmv/slothlet
 *	@Filename: /tests/vitests/setup/vitest.setup.mjs
 *	@Date: 2026-01-29T22:04:09-08:00 (1769753049)
 *	@Author: Nate Hyson <CLDMV>
 *	@Email: <Shinrai@users.noreply.github.com>
 *	-----
 *	@Last modified by: Nate Hyson <CLDMV> (Shinrai@users.noreply.github.com)
 *	@Last modified time: 2026-02-04 20:39:45 -08:00 (1770266385)
 *	-----
 *	@Copyright: Copyright (c) 2013-2026 Catalyzed Motivation Inc. All rights reserved.
 */

/**
 * @fileoverview Global setup for vitest - triggers devcheck validation
 *
 * This setup runs before any tests in the main process and imports slothlet,
 * which triggers devcheck validation. If devcheck fails, it should stop
 * vitest execution before any workers are spawned.
 */

/**
 * Ensure the main Vitest process has slothlet dev flags before devcheck runs.
 * Vitest applies `test.env` and `nodeOptions` to workers, but devcheck executes
 * in the main process, so we set defaults here to avoid manual export/sets.
 * @returns {void}
 * @example
 * // Automatically invoked by setup(); no manual call required.
 * ensureDevEnvFlags();
 */
function ensureDevEnvFlags() {
	if (!process.env.NODE_ENV) {
		process.env.NODE_ENV = "development";
	}

	const devFlag = "--conditions=slothlet-dev";
	const current = process.env.NODE_OPTIONS || "";
	if (!current.includes(devFlag)) {
		const next = current ? `${current} ${devFlag}` : devFlag;
		process.env.NODE_OPTIONS = next;
	}
}
// ensureDevEnvFlags();
/**
 * Run devcheck prior to all Vitest workers with ensured dev env flags.
 * @returns {Promise<void>} Resolves when devcheck completes.
 */
// export async function globalSetup() {
// export default async function setup() {
export async function setup() {
	// console.log("🚀 GLOBAL SETUP: Starting devcheck validation...");
	// console.log("🚀 GLOBAL SETUP: NODE_ENV =", process.env.NODE_ENV);
	// console.log("🚀 GLOBAL SETUP: NODE_OPTIONS =", process.env.NODE_OPTIONS);

	ensureDevEnvFlags();

	// eslint-disable-next-line no-useless-catch
	try {
		// Import devcheck directly to avoid index.mjs try/catch
		// await import("@cldmv/slothlet/devcheck");
		await import("../../../devcheck.mjs");
		// console.log("🚀 GLOBAL SETUP: Devcheck completed");
	} catch (error) {
		// console.log("🚀 GLOBAL SETUP: Devcheck failed:", error.message);
		throw error;
	}

	// Suppress SlothletWarning console output during tests (still captured for assertions)
	// const { SlothletWarning } = await import("@cldmv/slothlet/errors");
	const { SlothletWarning } = await import("../../../src/lib/errors");
	SlothletWarning.suppressConsole = true;
}

setup();
