/**
 *	@Project: @cldmv/slothlet
 *	@Filename: /tests/test-conditional.mjs
 *	@Date: 2025-09-09T08:06:19-07:00 (1757430379)
 *	@Author: Nate Corcoran <CLDMV>
 *	@Email: <Shinrai@users.noreply.github.com>
 *	-----
 *	@Last modified by: Nate Corcoran <CLDMV> (Shinrai@users.noreply.github.com)
 *	@Last modified time: 2026-03-01 20:21:40 -08:00 (1772425300)
 *	-----
 *	@Copyright: Copyright (c) 2013-2026 Catalyzed Motivation Inc. All rights reserved.
 */

/**
 * @fileoverview Conditional test runner that skips Vitest on Node.js < 18
 * @module scripts/test-conditional
 */

import { execSync } from "child_process";
import { existsSync } from "node:fs";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

/**
 * Get the current Node.js major version
 * @returns {number} Major version number
 */
function getNodeMajorVersion() {
	return parseInt(process.version.slice(1).split(".")[0], 10);
}

/**
 * Build an environment object safe for running test:node.
 * When src/ has been deleted (post-build), strips the slothlet-dev
 * condition from NODE_OPTIONS so that imports resolve to dist/ instead.
 *
 * Uses the same token-aware stripping as run-all-tests.mjs to handle all
 * NODE_OPTIONS formats used in CI, including combined conditions such as
 * `--conditions=slothlet-dev,other` and the space-separated form
 * `--conditions slothlet-dev`.  A simple exact-token match would silently
 * fail for those cases and leave slothlet-dev active, causing every
 * `@cldmv/slothlet/*` sub-path import to resolve to the (deleted) src/
 * tree instead of dist/.
 *
 * @returns {NodeJS.ProcessEnv} Environment object to pass to execSync.
 */
function buildTestNodeEnv() {
	const srcExists = existsSync(path.resolve(__dirname, "../src/slothlet.mjs"));
	if (srcExists) {
		// Pre-build: inherit everything as-is
		return process.env;
	}

	// Post-build: src/ was removed by ci-cleanup-src — strip slothlet-dev
	// from NODE_OPTIONS so package exports resolve to dist/ correctly.
	console.log("ℹ️  src/ not found — running test:node against dist/ (stripping slothlet-dev condition)");

	const tokens = (process.env.NODE_OPTIONS ?? "").split(/\s+/u).filter(Boolean);
	const cleaned = [];
	let i = 0;
	while (i < tokens.length) {
		const token = tokens[i];
		if (token === "--conditions" && i + 1 < tokens.length) {
			// Space-separated form: --conditions slothlet-dev
			const conditions = tokens[i + 1]
				.split(/[|,]/u)
				.filter((c) => c !== "slothlet-dev");
			if (conditions.length > 0) cleaned.push(`--conditions=${conditions.join(",")}`);
			i += 2;
		} else if (token.startsWith("--conditions=")) {
			// Equals form: --conditions=slothlet-dev or --conditions=slothlet-dev,other
			const conditions = token
				.slice("--conditions=".length)
				.split(/[|,]/u)
				.filter((c) => c !== "slothlet-dev");
			if (conditions.length > 0) cleaned.push(`--conditions=${conditions.join(",")}`);
			i += 1;
		} else {
			cleaned.push(token);
			i += 1;
		}
	}

	// Do NOT use `|| undefined` — in some Node.js versions (notably Node 16) an
	// undefined env value is stringified to the literal string "undefined", which
	// is an invalid NODE_OPTIONS flag.  Delete the key entirely when nothing remains.
	const env = { ...process.env };
	const cleanedStr = cleaned.join(" ");
	if (cleanedStr) {
		env.NODE_OPTIONS = cleanedStr;
	} else {
		delete env.NODE_OPTIONS;
	}
	return env;
}

/**
 * Run tests conditionally based on Node.js version
 * @async
 * @returns {Promise<void>}
 */
async function runConditionalTests() {
	const nodeMajorVersion = getNodeMajorVersion();

	console.log(`Running tests on Node.js ${process.version} (major: ${nodeMajorVersion})`);

	try {
		if (nodeMajorVersion >= 18) {
			console.log("✅ Node.js >= 18: Running full test suite including Vitest");
			execSync("npm run vitest", { stdio: "inherit" });
		} else {
			console.log("⚠️  Node.js < 18: Skipping Vitest tests due to compatibility issues");
			console.log("   (Vitest requires Node.js >= 18 for proper operation)");
		}

		// Always run the Node.js native tests
		console.log("🚀 Running Node.js native tests");
		execSync("npm run test:node", { stdio: "inherit", env: buildTestNodeEnv() });

		console.log("✅ All compatible tests completed successfully");
	} catch (error) {
		console.error("❌ Tests failed:", error.message);
		process.exit(1);
	}
}

// Run if this script is executed directly
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
	runConditionalTests();
}

export { runConditionalTests, getNodeMajorVersion };
