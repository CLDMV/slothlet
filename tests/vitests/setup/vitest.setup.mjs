/**
 *
 *	@Project: @cldmv/slothlet
 *	@Filename: tests/vitests/setup/vitest.setup.mjs
 *	@Date: 2026-01-29T22:04:09-08:00 (1769753049)
 *	@Author: Nate Corcoran <CLDMV>
 *	@Email: <Shinrai@users.noreply.github.com>
 *	-----
 *	@Last modified by: Nate Corcoran <CLDMV> (Shinrai@users.noreply.github.com)
 *	@Last modified time: 2026-11-28T04:31:05-08:00 (1795869065)
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
 * Set the slothlet dev flags and keep SlothletWarning output out of the test log before the tests run.
 * @returns {Promise<void>} Resolves when setup completes.
 */
// export async function globalSetup() {
// export default async function setup() {
export async function setup() {
	// console.log("🚀 GLOBAL SETUP: NODE_ENV =", process.env.NODE_ENV);
	// console.log("🚀 GLOBAL SETUP: NODE_OPTIONS =", process.env.NODE_OPTIONS);

	ensureDevEnvFlags();

	// Keep SlothletWarning console output out of the test log. Every warning is recorded on the class it was raised
	// through whatever is printed (#838), so tests assert on `captured`; a test that spies on console.warn installs its
	// spy over this filter and still sees every call.
	const original = globalThis.console.warn;
	let dropDetails = false;
	globalThis.console.warn = function slothletTestWarnFilter(first, ...rest) {
		if (typeof first === "string" && first.startsWith("\n⚠️  [")) {
			dropDetails = true;
			return;
		}
		if (dropDetails && (first === "Context:" || first === "Cause:")) return;
		dropDetails = false;
		return Reflect.apply(original, this, [first, ...rest]);
	};
}

await setup();
