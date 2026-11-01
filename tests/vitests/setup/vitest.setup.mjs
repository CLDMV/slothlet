/**
 *
 *	@Project: @cldmv/slothlet
 *	@Filename: /tests/vitests/setup/vitest.setup.mjs
 *	@Date: 2026-01-29T22:04:09-08:00 (1769753049)
 *	@Author: Nate Corcoran <CLDMV>
 *	@Email: <Shinrai@users.noreply.github.com>
 *	-----
 *	@Last modified by: Nate Corcoran <CLDMV> (Shinrai@users.noreply.github.com)
 *	@Last modified time: 2026-11-01T09:24:38-08:00 (1793553878)
 *	-----
 *	@Copyright: Copyright (c) 2013-2026 Catalyzed Motivation Inc. All rights reserved.
 *
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
 * @fileoverview Vitest setup file: makes sure the slothlet-dev condition is set so the
 * suite runs against src/, and suppresses SlothletWarning console output.
 */

/**
 * Ensure slothlet dev flags are set when no dist/ build exists, so imports resolve to src/
 * without a manual export/set.
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
 * Set the slothlet dev flags and quiet SlothletWarning output before the tests run.
 * @returns {Promise<void>} Resolves when setup completes.
 */
// export async function globalSetup() {
// export default async function setup() {
export async function setup() {
	// console.log("🚀 GLOBAL SETUP: NODE_ENV =", process.env.NODE_ENV);
	// console.log("🚀 GLOBAL SETUP: NODE_OPTIONS =", process.env.NODE_OPTIONS);

	ensureDevEnvFlags();

	// Suppress SlothletWarning console output during tests (still captured for assertions).
	// Import via the package export (resolves to src under the slothlet-dev condition, dist otherwise),
	// NOT a relative `../../../src/...` path: this setup file is loaded by @cldmv/vitest-runner, which
	// resolves the relative specifier from the wrong base and fails with "Cannot find module /src/...".
	const { SlothletWarning } = await import("@cldmv/slothlet/errors");
	SlothletWarning.suppressConsole = true;
}

await setup();
