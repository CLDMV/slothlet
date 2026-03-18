/**
 *	@Project: @cldmv/slothlet
 *	@Filename: /tools/build/build-dist.mjs
 *	@Date: 2026-03-17 00:00:00 -07:00 (1773907200)
 *	@Author: Nate Corcoran <CLDMV>
 *	@Email: <Shinrai@users.noreply.github.com>
 *	-----
 *	@Last modified by: Nate Corcoran <CLDMV> (Shinrai@users.noreply.github.com)
 *	@Last modified time: 2026-03-17 00:00:00 -07:00 (1773907200)
 *	-----
 *	@Copyright: Copyright (c) 2013-2026 Catalyzed Motivation Inc. All rights reserved.
 */

/**
 * @fileoverview Resilient dist build step: copies src/ contents into dist/.
 *
 * @description
 * Replaces the bare `shx cp -r src/* dist/` shell command in `build:dist` with a Node.js
 * script that:
 *   1. Guards against a missing src/ directory (which happens in CI when `ci:cleanup-src`
 *      already deleted it in a previous pipeline step, and build:ci runs again).
 *   2. Copies each top-level entry in src/ into dist/ recursively — exactly equivalent
 *      to `shx cp -r src/* dist/`.
 *
 * Compatible with Node.js >= 16.7.0 (`fs.cpSync` was introduced in 16.7.0).
 *
 * @module @cldmv/slothlet/tools/build/build-dist
 * @package
 * @internal
 */

import { cpSync, existsSync, readdirSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const projectRoot = path.resolve(__dirname, "../..");
const srcDir = path.join(projectRoot, "src");
const distDir = path.join(projectRoot, "dist");

/**
 * Copy the contents of src/ into dist/ (equivalent to `cp -r src/* dist/`).
 * Exits cleanly when src/ does not exist — this is expected in CI after
 * ci:cleanup-src has already run and removed the source directory.
 *
 * @returns {void}
 * @example
 * node tools/build/build-dist.mjs
 */
function buildDist() {
	if (!existsSync(srcDir)) {
		console.log("⚠️  src/ not found — already cleaned up, skipping copy.");
		process.exit(0);
	}

	const entries = readdirSync(srcDir);

	if (entries.length === 0) {
		console.log("⚠️  src/ is empty — nothing to copy.");
		process.exit(0);
	}

	for (const entry of entries) {
		const srcEntry = path.join(srcDir, entry);
		const destEntry = path.join(distDir, entry);
		cpSync(srcEntry, destEntry, { recursive: true, force: true });
	}

	console.log(`✅ Copied ${entries.length} entries from src/ to dist/`);
}

buildDist();
