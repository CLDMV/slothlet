/**
 *	@Project: @cldmv/slothlet
 *	@Filename: /tests/lib/clean-tmp-artifacts.mjs
 *	@Date: 2026-05-18T09:38:51-07:00 (1779122331)
 *	@Author: Nate Corcoran <CLDMV>
 *	@Email: <Shinrai@users.noreply.github.com>
 *	-----
 *	@Last modified by: Nate Corcoran <CLDMV> (Shinrai@users.noreply.github.com)
 *	@Last modified time: 2026-05-18 09:38:51 -07:00 (1779122331)
 *	-----
 *	@Copyright: Copyright (c) 2013-2026 Catalyzed Motivation Inc. All rights reserved.
 */

/**
 * @fileoverview Shared precheck that sweeps stale per-run temp folders out of `tmp/`.
 *
 * @description
 * Test suites and the TypeScript validator each copy fixtures or generate `.d.ts`
 * files into uniquely-named directories under `tmp/` (e.g. `api_test_collisions_multi_<ts>`,
 * `slothlet-test-types-<ts>`, `ts-validate-<hash>`). Those directories are meant to be
 * removed by the suite that created them, but a crashed worker, a killed process, or a
 * `SIGINT` mid-run leaves them behind — they accumulate indefinitely.
 *
 * This module is the cleanup counterpart: run it as a precheck at the start of any
 * test/build path that produces such folders. Coverage and full-test runs are already
 * serialized (one at a time), so at the moment a run starts every matching folder is
 * guaranteed stale and safe to delete. A short `minAgeMs` guard still skips folders
 * touched in the last few seconds, in case an unrelated sibling process just created one.
 *
 * @module tests/lib/clean-tmp-artifacts
 */

import fs from "fs";
import path from "path";

/**
 * Glob-ish prefixes of per-run temp directories created under `tmp/`.
 * A directory is a sweep candidate when its name starts with one of these prefixes.
 * Keep this list in sync with the code that creates the folders:
 *  - `api_test_collisions_multi_` — tests/vitests/suites/api/lazy/api-assignment-collision-lazy.test.vitest.mjs
 *  - `slothlet-test-types-`       — tests/vitests/suites/typescript/typescript-strict-mode.test.vitest.mjs
 *  - `ts-validate-`               — tests/validate-typescript.mjs
 * @type {string[]}
 */
export const TMP_ARTIFACT_PREFIXES = ["api_test_collisions_multi_", "slothlet-test-types-", "ts-validate-"];

/**
 * Remove stale per-run temp directories from `tmp/`.
 *
 * @public
 * @param {object} [options] - Sweep options.
 * @param {string} [options.projectRoot=process.cwd()] - Project root containing `tmp/`.
 * @param {string[]} [options.prefixes=TMP_ARTIFACT_PREFIXES] - Directory-name prefixes to match.
 * @param {number} [options.minAgeMs=5000] - Skip directories modified more recently than this (ms).
 * @param {boolean} [options.quiet=false] - Suppress the per-run summary line.
 * @returns {{ removed: string[], skipped: string[], failed: string[] }} Sweep result.
 *
 * @example
 * // Precheck at the start of a test or build path.
 * import { cleanTmpArtifacts } from "./lib/clean-tmp-artifacts.mjs";
 * cleanTmpArtifacts();
 */
export function cleanTmpArtifacts(options = {}) {
	const { projectRoot = process.cwd(), prefixes = TMP_ARTIFACT_PREFIXES, minAgeMs = 5000, quiet = false } = options;

	const tmpDir = path.join(projectRoot, "tmp");
	const result = { removed: [], skipped: [], failed: [] };

	let entries;
	try {
		entries = fs.readdirSync(tmpDir, { withFileTypes: true });
	} catch (err) {
		// No tmp/ yet (fresh checkout) — nothing to sweep.
		if (err.code === "ENOENT") return result;
		throw err;
	}

	const now = Date.now();

	for (const entry of entries) {
		if (!entry.isDirectory()) continue;
		if (!prefixes.some((prefix) => entry.name.startsWith(prefix))) continue;

		const fullPath = path.join(tmpDir, entry.name);

		// Safety guard: skip folders a sibling process may have just created.
		try {
			const { mtimeMs } = fs.statSync(fullPath);
			if (now - mtimeMs < minAgeMs) {
				result.skipped.push(entry.name);
				continue;
			}
		} catch {
			// Stat failed (race with another sweeper) — treat as already gone.
			continue;
		}

		try {
			fs.rmSync(fullPath, { recursive: true, force: true });
			result.removed.push(entry.name);
		} catch {
			result.failed.push(entry.name);
		}
	}

	if (!quiet && (result.removed.length || result.failed.length)) {
		const parts = [`🧹 tmp precheck: removed ${result.removed.length} stale folder(s)`];
		if (result.skipped.length) parts.push(`${result.skipped.length} too-recent skipped`);
		if (result.failed.length) parts.push(`${result.failed.length} failed`);
		console.log(parts.join(", "));
	}

	return result;
}
