/**
 *	@Project: @cldmv/slothlet
 *	@Filename: /tests/vitests/setup/vitest.setup.mjs
 *	@Date: 2026-01-29T22:04:09-08:00 (1769753049)
 *	@Author: Nate Corcoran <CLDMV>
 *	@Email: <Shinrai@users.noreply.github.com>
 *	-----
 *	@Last modified by: Nate Corcoran <CLDMV> (Shinrai@users.noreply.github.com)
 *	@Last modified time: 2026-03-01 20:21:41 -08:00 (1772425301)
 *	-----
 *	@Copyright: Copyright (c) 2013-2026 Catalyzed Motivation Inc. All rights reserved.
 */

import { existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";
import { suppressSlothletDebugOutput } from "./vitest-helper.mjs";

// Install synchronously at module-load time so every fork suppresses debug
// noise from the very first test. The async setup() below is too late because
// Vitest can start running tests before its awaited imports resolve.
suppressSlothletDebugOutput();

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
	const distPath = path.join(path.dirname(fileURLToPath(import.meta.url)), "../../../dist");
	if (existsSync(distPath)) {
		return;
	}

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

await setup();
