/**
 *	@Project: @cldmv/slothlet
 *	@Filename: /tests/vitests/suites/typescript/typescript-cache-sweep.test.vitest.mjs
 *	@Date: 2026-05-12 06:10:18 -07:00 (1778591418)
 *	@Author: Nate Corcoran <CLDMV>
 *	@Email: <Shinrai@users.noreply.github.com>
 *	-----
 *	@Last modified by: Nate Corcoran <CLDMV> (Shinrai@users.noreply.github.com)
 *	@Last modified time: 2026-05-12 06:15:05 -07:00 (1778591705)
 *	-----
 *	@Copyright: Copyright (c) 2013-2026 Catalyzed Motivation Inc. All rights reserved.
 */

/**
 * @fileoverview Tests for orphaned-cache-dir sweeping on slothlet TS init.
 *
 * Cache dirs are named `<pid>-<instanceID>/`. On the first TS load per project
 * root per process, slothlet sweeps sibling dirs whose `<pid>` prefix no longer
 * identifies a live process (probed passively via `process.kill(pid, 0)`).
 *
 * Combined into a single test because the sweep is memoized per process — only
 * the first TS load triggers it, so both dead-PID and live-PID assertions must
 * ride on the same invocation.
 */
import { describe, it, expect, afterEach } from "vitest";
import { mkdir, writeFile, rm } from "node:fs/promises";
import { existsSync } from "node:fs";
import path from "node:path";
import slothlet from "../../../../index.mjs";

describe("TypeScript cache sweep", () => {
	let api;

	afterEach(async () => {
		if (api?.slothlet?.shutdown) {
			await api.slothlet.shutdown();
		}
	});

	it("removes orphans from dead PIDs while preserving dirs owned by live PIDs", async () => {
		// PID just under INT32_MAX is guaranteed not to exist on any platform
		// (Linux pid_max ≤ 4194304, macOS ≤ 99998) — `process.kill` returns ESRCH.
		const deadPid = 2147483640;
		const livePid = process.pid;
		const cacheRoot = path.resolve(".slothlet-cache");
		const orphanDir = path.join(cacheRoot, `${deadPid}-orphaned-instance`);
		const liveDir = path.join(cacheRoot, `${livePid}-foreign-instance`);
		const unlabeledDir = path.join(cacheRoot, "no-pid-prefix");

		await mkdir(orphanDir, { recursive: true });
		await writeFile(path.join(orphanDir, "marker.mjs"), "// orphan from a dead process\n", "utf8");
		await mkdir(liveDir, { recursive: true });
		await writeFile(path.join(liveDir, "marker.mjs"), "// owned by a live process\n", "utf8");
		await mkdir(unlabeledDir, { recursive: true });
		await writeFile(path.join(unlabeledDir, "marker.mjs"), "// no PID prefix\n", "utf8");

		try {
			api = await slothlet({
				base: "./api_tests/api_test_typescript_runtime",
				typescript: "fast"
			});

			// First TS load awaits the sweep, so by the time slothlet() resolves
			// the sweep has finished.
			expect(existsSync(orphanDir)).toBe(false);
			expect(existsSync(liveDir)).toBe(true);
			expect(existsSync(unlabeledDir)).toBe(true);
		} finally {
			await rm(liveDir, { recursive: true, force: true });
			await rm(unlabeledDir, { recursive: true, force: true });
		}
	});
});
