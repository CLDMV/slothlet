/**
 *
 *	@Project: @cldmv/slothlet
 *	@Filename: /tests/lib/clean-tmp-artifacts.mjs
 *	@Date: 2026-05-18T09:38:51-07:00 (1779122331)
 *	@Author: Nate Corcoran <CLDMV>
 *	@Email: <Shinrai@users.noreply.github.com>
 *	-----
 *	@Last modified by: Nate Corcoran <CLDMV> (Shinrai@users.noreply.github.com)
 *	@Last modified time: 2026-10-03 20:03:40 -07:00 (1791083020)
 *	-----
 *	@Copyright: Copyright (c) 2013-2026 Catalyzed Motivation Inc. All rights reserved.
 *
 */

/**
 * @fileoverview Shared precheck that sweeps stale per-run temp folders out of `tmp/`.
 *
 * @description
 * Test suites and the TypeScript validator each copy fixtures or generate `.d.ts`
 * files into uniquely-named directories under `tmp/` (e.g. `api_test_collisions_multi_<pid>_<ts>`,
 * `slothlet-test-types-<pid>-<ts>`, `ts-validate-<pid>-<hash>`). The segment after the
 * prefix is always `<pid><delimiter>...`, so the PID is followed by a `-` or `_`. Those
 * directories are meant to be removed by the suite that created them, but a crashed
 * worker, a killed process, or a `SIGINT` mid-run leaves them behind — they accumulate
 * indefinitely.
 *
 * This module is the cleanup counterpart: run it as a precheck at the start of any
 * test/build path that produces such folders.
 *
 * **Ownership safety.** Test runs are not globally serialized — a second `run-all-vitest`
 * or `validate-typescript` process can be active while this precheck runs. Deleting a
 * folder purely by age would race that sibling and remove an in-use fixture/output
 * directory. To avoid that, each per-run folder name embeds the creating process's PID
 * right after its prefix. The sweep deletes a folder only when that PID is no longer
 * alive (`process.kill(pid, 0)` → `ESRCH`). This can never delete a live run's folder:
 * a live owner is always seen as alive, so the worst case is leaving a genuinely stale
 * folder one run longer (e.g. when a dead PID has since been reused). Legacy folders
 * predate the PID segment and were named with a bare timestamp (`<prefix><ts>`, no
 * delimiter after the digits); they have no parseable PID and fall back to the
 * `minAgeMs` mtime guard so an in-use legacy directory is never raced.
 *
 * **`tmp/test-fixtures/`.** Test suites create their scratch directories there through
 * `tests/vitests/setup/test-fixtures-tmp.mjs`, named `<pid>-<label>-XXXXXX`. Everything in that
 * directory is test-owned, so it is swept with no prefix list: the leading PID decides, exactly
 * as above. The prefixes below remain for folders created before suites moved there.
 *
 * @module tests/lib/clean-tmp-artifacts
 */

import fs from "fs";
import path from "path";

/**
 * Glob-ish prefixes of per-run temp directories created under `tmp/`.
 * A directory is a sweep candidate when its name starts with one of these prefixes.
 * The name segment immediately after the prefix is the creating process's PID.
 * Keep this list in sync with the code that creates the folders:
 *  - `api_test_collisions_multi_` — tests/vitests/suites/api/lazy/api-assignment-collision-lazy.test.vitest.mjs
 *  - `slothlet-test-types-`       — tests/vitests/suites/typescript/typescript-strict-mode.test.vitest.mjs
 *  - `ts-validate-`               — tests/validate-typescript.mjs
 * @type {string[]}
 */
export const TMP_ARTIFACT_PREFIXES = ["api_test_collisions_multi_", "slothlet-test-types-", "ts-validate-"];

/**
 * Report whether a process id is still alive.
 * @internal
 * @private
 * @param {number} pid - Process id to probe.
 * @returns {boolean} `true` when the process exists (or exists but is owned by another user).
 */
function isProcessAlive(pid) {
	try {
		// Signal 0 performs existence/permission checks without delivering a signal.
		process.kill(pid, 0);
		return true;
	} catch (err) {
		// EPERM → the process exists but is owned by another user: treat it as alive.
		// ESRCH (or anything else) → no such process.
		return err.code === "EPERM";
	}
}

/**
 * Extract the owning PID embedded in a per-run temp directory name.
 *
 * Current names embed the PID right after the prefix, always followed by a `-` or `_`
 * delimiter (`<prefix><pid><delimiter>...`). Legacy names were a bare timestamp with no
 * delimiter (`<prefix><ts>`); requiring the delimiter keeps those from being misread as
 * a PID, so they correctly fall back to the mtime guard.
 * @internal
 * @private
 * @param {string} name - Directory name.
 * @param {string} prefix - Matched prefix (the PID is the leading digits after it).
 * @returns {number|null} The PID, or `null` for legacy names with no PID segment.
 */
function ownerPidOf(name, prefix) {
	const match = /^(\d+)[-_]/.exec(name.slice(prefix.length));
	return match ? Number(match[1]) : null;
}

/**
 * Name of the directory under `tmp/` that holds test-suite scratch directories.
 * @type {string}
 */
export const TEST_FIXTURES_DIR = "test-fixtures";

/**
 * Remove one candidate directory unless it belongs to a live run (or, with no PID segment, is
 * younger than `minAgeMs`). Records the outcome in `result`.
 * @internal
 * @private
 * @param {string} parent - Directory holding the candidate.
 * @param {string} name - Candidate directory name.
 * @param {string} prefix - Matched prefix (`""` inside `tmp/test-fixtures/`).
 * @param {number} now - Sweep timestamp.
 * @param {number} minAgeMs - mtime guard for names with no PID segment.
 * @param {{ removed: string[], skipped: string[], failed: string[] }} result - Accumulated result.
 * @returns {void}
 */
function sweepEntry(parent, name, prefix, now, minAgeMs, result) {
	const fullPath = path.join(parent, name);
	const ownerPid = ownerPidOf(name, prefix);

	if (ownerPid !== null) {
		// PID-stamped folder: defer to ownership, never to age.
		if (isProcessAlive(ownerPid)) {
			result.skipped.push(name);
			return;
		}
	} else {
		// Legacy folder with no PID segment: fall back to the mtime guard so a
		// sibling process that just created one is not raced.
		try {
			const { mtimeMs } = fs.statSync(fullPath);
			if (now - mtimeMs < minAgeMs) {
				result.skipped.push(name);
				return;
			}
		} catch {
			// Stat failed (race with another sweeper) — treat as already gone.
			return;
		}
	}

	try {
		fs.rmSync(fullPath, { recursive: true, force: true });
		result.removed.push(name);
	} catch {
		result.failed.push(name);
	}
}

/**
 * Remove stale per-run temp directories from `tmp/` and `tmp/test-fixtures/`.
 *
 * @public
 * @param {object} [options] - Sweep options.
 * @param {string} [options.projectRoot=process.cwd()] - Project root containing `tmp/`.
 * @param {string[]} [options.prefixes=TMP_ARTIFACT_PREFIXES] - Directory-name prefixes to match.
 * @param {number} [options.minAgeMs=5000] - Fallback mtime guard for legacy folders with no PID segment.
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
		const prefix = prefixes.find((p) => entry.name.startsWith(p));
		if (!prefix) continue;
		sweepEntry(tmpDir, entry.name, prefix, now, minAgeMs, result);
	}

	// Everything under tmp/test-fixtures/ is test-owned: no prefix list, the leading PID decides.
	const fixturesDir = path.join(tmpDir, TEST_FIXTURES_DIR);
	let fixtureEntries = [];
	try {
		fixtureEntries = fs.readdirSync(fixturesDir, { withFileTypes: true });
	} catch (err) {
		// No test-fixtures/ yet — nothing to sweep there.
		if (err.code !== "ENOENT") throw err;
	}
	for (const entry of fixtureEntries) {
		if (entry.isDirectory()) sweepEntry(fixturesDir, entry.name, "", now, minAgeMs, result);
	}

	if (!quiet && (result.removed.length || result.failed.length)) {
		const parts = [`🧹 tmp precheck: removed ${result.removed.length} stale folder(s)`];
		if (result.skipped.length) parts.push(`${result.skipped.length} owned-by-live-process skipped`);
		if (result.failed.length) parts.push(`${result.failed.length} failed`);
		console.log(parts.join(", "));
	}

	return result;
}
