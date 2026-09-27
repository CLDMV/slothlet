/**
 *	@Project: @cldmv/slothlet
 *	@Filename: /tests/vitests/suites/helpers/clean-tmp-artifacts.test.vitest.mjs
 *	@Date: 2026-09-26 23:41:35 -07:00 (1790491295)
 *	@Author: Shinrai <CLDMV>
 *	@Email: <Shinrai@users.noreply.github.com>
 *	-----
 *	@Last modified by: Shinrai <CLDMV> (Shinrai@users.noreply.github.com)
 *	@Last modified time: 2026-09-27 00:07:11 -07:00 (1790492831)
 *	-----
 *	@Copyright: Copyright (c) 2013-2026 Catalyzed Motivation Inc. All rights reserved.
 */

/**
 * @fileoverview The tmp precheck (`tests/lib/clean-tmp-artifacts.mjs`) sweeps stale test scratch
 * directories from `tmp/` and `tmp/test-fixtures/` — removing those whose owning process is gone and
 * never touching one owned by a live process. Driven against a throwaway project root so it can
 * never remove anything real.
 */

import { describe, it, expect, afterEach } from "vitest";
import fs from "node:fs";
import path from "node:path";
import { cleanTmpArtifacts, TEST_FIXTURES_DIR } from "../../../lib/clean-tmp-artifacts.mjs";
import { makeTestTmpDirSync, TEST_FIXTURES_ROOT } from "../../setup/test-fixtures-tmp.mjs";

/** A PID no process holds (beyond Linux's pid_max), so it always reads as dead. */
const DEAD_PID = 999999999;

describe("tmp precheck (clean-tmp-artifacts)", () => {
	let projectRoot = null;

	afterEach(() => {
		if (projectRoot) fs.rmSync(projectRoot, { recursive: true, force: true });
		projectRoot = null;
	});

	/**
	 * Create `<projectRoot>/tmp/<relative>` as a directory.
	 * @param {string} relative - Path under the fake project's `tmp/`.
	 * @returns {string} Absolute path.
	 */
	const makeDir = (relative) => {
		const full = path.join(projectRoot, "tmp", relative);
		fs.mkdirSync(full, { recursive: true });
		return full;
	};

	it("sweeps tmp/test-fixtures by owning PID: dead owner removed, live owner kept", () => {
		projectRoot = makeTestTmpDirSync("precheck");
		const dead = makeDir(`${TEST_FIXTURES_DIR}/${DEAD_PID}-ownership-abc123`);
		const live = makeDir(`${TEST_FIXTURES_DIR}/${process.pid}-ownership-def456`);

		const result = cleanTmpArtifacts({ projectRoot, quiet: true });

		expect(fs.existsSync(dead)).toBe(false);
		expect(fs.existsSync(live)).toBe(true);
		expect(result.removed).toContain(`${DEAD_PID}-ownership-abc123`);
		expect(result.skipped).toContain(`${process.pid}-ownership-def456`);
	});

	it("keeps a fresh PID-less fixture directory (mtime guard) and removes an old one", () => {
		projectRoot = makeTestTmpDirSync("precheck");
		const fresh = makeDir(`${TEST_FIXTURES_DIR}/no-pid-fresh`);
		const old = makeDir(`${TEST_FIXTURES_DIR}/no-pid-old`);
		const past = new Date(Date.now() - 60_000);
		fs.utimesSync(old, past, past);

		cleanTmpArtifacts({ projectRoot, quiet: true, minAgeMs: 30_000 });

		expect(fs.existsSync(fresh)).toBe(true);
		expect(fs.existsSync(old)).toBe(false);
	});

	it("still sweeps legacy prefixed folders directly under tmp/ and ignores unrelated ones", () => {
		projectRoot = makeTestTmpDirSync("precheck");
		const legacy = makeDir(`slothlet-test-types-${DEAD_PID}-1700000000000`);
		const unrelated = makeDir(`someone-elses-dir-${DEAD_PID}-x`);

		cleanTmpArtifacts({ projectRoot, quiet: true });

		expect(fs.existsSync(legacy)).toBe(false);
		expect(fs.existsSync(unrelated)).toBe(true);
	});

	it("is a no-op when the project has no tmp/ at all", () => {
		projectRoot = makeTestTmpDirSync("precheck");
		expect(cleanTmpArtifacts({ projectRoot, quiet: true })).toEqual({ removed: [], skipped: [], failed: [] });
	});

	it("scratch directories come from tmp/test-fixtures and carry the creating PID", () => {
		projectRoot = makeTestTmpDirSync("precheck");
		expect(path.dirname(projectRoot)).toBe(TEST_FIXTURES_ROOT);
		expect(path.basename(projectRoot).startsWith(`${process.pid}-precheck-`)).toBe(true);
	});
});
