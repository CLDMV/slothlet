/**
 *	@Project: @cldmv/slothlet
 *	@Filename: /tests/vitests/suites/typescript/typescript-helpers-coverage.test.vitest.mjs
 *	@Date: 2026-05-12T19:35:50-07:00 (1778639750)
 *	@Author: Nate Corcoran <CLDMV>
 *	@Email: <Shinrai@users.noreply.github.com>
 *	-----
 *	@Last modified by: Nate Corcoran <CLDMV> (Shinrai@users.noreply.github.com)
 *	@Last modified time: 2026-05-12 19:58:07 -07:00 (1778641087)
 *	-----
 *	@Copyright: Copyright (c) 2013-2026 Catalyzed Motivation Inc. All rights reserved.
 */

/**
 * @fileoverview Coverage-targeted tests for typescript.mjs helpers added in 3.5.0.
 *
 * Each scenario uses a fresh temp project root so the per-root sweep memo doesn't
 * suppress repeated sweeps within the same worker.
 */
import { describe, it, expect, afterAll } from "vitest";
import { mkdir, writeFile, rm, mkdtemp, readdir } from "node:fs/promises";
import { existsSync, statSync } from "node:fs";
import path from "node:path";
import { tmpdir } from "node:os";
import { createDataUrl, writeTransformedToCache } from "@cldmv/slothlet/processors/typescript";

const tempRoots = [];

async function freshProject({ withPackageJson = true } = {}) {
	const root = await mkdtemp(path.join(tmpdir(), "slothlet-ts-cov-"));
	tempRoots.push(root);
	if (withPackageJson) {
		await writeFile(path.join(root, "package.json"), JSON.stringify({ name: "tmp-pkg", version: "0.0.0" }), "utf8");
	}
	return root;
}

describe("typescript.mjs helper coverage", () => {
	afterAll(async () => {
		await Promise.allSettled(tempRoots.map((r) => rm(r, { recursive: true, force: true })));
	});

	it("createDataUrl returns a data: URL with charset and timestamp", () => {
		const url = createDataUrl("export const x = 1;");
		expect(url.startsWith("data:text/javascript;charset=utf-8,")).toBe(true);
		expect(url).toMatch(/#t=\d+$/);
	});

	it("findPackageRoot returns null when statSync throws → secure mkdtemp fallback", async () => {
		// Nonexistent path makes statSync throw → findPackageRoot returns null →
		// writeTransformedToCache falls back to a private mkdtemp dir (NOT the shared
		// tmpdir root) via the `?? getSecureFallbackRoot()` arm.
		const bogus = "/__definitely_not_a_real_path__/__nope__.ts";
		const result = await writeTransformedToCache(bogus, "export const a = 'bogus';", `cov-missing-${process.pid}`);
		try {
			expect(result.cacheDir.startsWith(tmpdir())).toBe(true);
			// CWE-377: the cache must live under a private `slothlet-` mkdtemp dir,
			// not directly in the world-readable tmpdir root (which would be
			// `<tmpdir>/.slothlet-cache/...` — first segment `.slothlet-cache`).
			const secureSeg = path.relative(tmpdir(), result.cacheDir).split(path.sep)[0];
			expect(secureSeg.startsWith("slothlet-")).toBe(true);
			if (process.platform !== "win32") {
				// mkdtemp creates the dir 0o700 (owner-only) — no group/other access.
				expect(statSync(path.join(tmpdir(), secureSeg)).mode & 0o077).toBe(0);
			}
			expect(existsSync(result.cacheDir)).toBe(true);
		} finally {
			await rm(result.cacheDir, { recursive: true, force: true });
		}
	});

	it("findPackageRoot accepts a directory startPath (ternary false arm)", async () => {
		const root = await freshProject();
		const result = await writeTransformedToCache(root, "export const a = 'dir';", `cov-dir-${process.pid}`);
		expect(result.cacheDir.startsWith(root)).toBe(true);
		expect(existsSync(result.cacheDir)).toBe(true);
	});

	it("findPackageRoot walks to filesystem root and returns null when no package.json exists", async () => {
		// Temp dir under tmpdir() — no package.json walking up to "/".
		const root = await mkdtemp(path.join(tmpdir(), "slothlet-ts-nopkg-"));
		tempRoots.push(root);
		const srcFile = path.join(root, "foo.ts");
		await writeFile(srcFile, "// fake source\n", "utf8");
		const result = await writeTransformedToCache(srcFile, "export const a = 'noroot';", `cov-noroot-${process.pid}`);
		try {
			// findPackageRoot returned null → secure mkdtemp fallback (private slothlet- dir).
			expect(result.cacheDir.startsWith(tmpdir())).toBe(true);
			const secureSeg = path.relative(tmpdir(), result.cacheDir).split(path.sep)[0];
			expect(secureSeg.startsWith("slothlet-")).toBe(true);
		} finally {
			await rm(result.cacheDir, { recursive: true, force: true });
		}
	});

	it("is a no-op when the cache file already exists (atomic wx create, EEXIST swallowed)", async () => {
		const root = await freshProject();
		const code = "export const a = 'dedup';";
		const id = `cov-dedup-${process.pid}`;
		const first = await writeTransformedToCache(root, code, id);
		const filesBefore = await readdir(first.cacheDir);
		const second = await writeTransformedToCache(root, code, id);
		const filesAfter = await readdir(second.cacheDir);
		expect(second.cacheDir).toBe(first.cacheDir);
		expect(filesAfter).toEqual(filesBefore);
		expect(second.url).toBe(first.url);
	});

	it("sweep skips non-directory entries inside .slothlet-cache/", async () => {
		const root = await freshProject();
		const cacheRoot = path.join(root, ".slothlet-cache");
		await mkdir(cacheRoot, { recursive: true });
		// Plant a regular file (not a directory) inside the cache root —
		// hits the `if (!entry.isDirectory()) return;` early-exit in the sweep.
		const strayFile = path.join(cacheRoot, "stray-file.txt");
		await writeFile(strayFile, "not a directory", "utf8");
		await writeTransformedToCache(root, "export const a = 'stray';", `cov-stray-${process.pid}`);
		expect(existsSync(strayFile)).toBe(true);
	});

	it("sweep removes dead-PID dirs, keeps live-PID dirs, and treats EPERM as live", async () => {
		const root = await freshProject();
		const cacheRoot = path.join(root, ".slothlet-cache");
		await mkdir(cacheRoot, { recursive: true });
		// Dead PID: process.kill returns ESRCH on most platforms (Linux pid_max ≤ 4194304).
		const deadPid = 2147483640;
		// Live PID: this test process itself.
		const livePid = process.pid;
		// EPERM-throwing PID: init (PID 1) on POSIX systems is owned by root and
		// not signalable by non-root callers. process.kill(1, 0) therefore throws
		// EPERM, which `isProcessAlive` must treat as alive. On the repo's Linux
		// dev/CI environment this reliably covers the `err.code !== "ESRCH"` true
		// arm. On other platforms PID 1 may behave differently, so the expected
		// keep/remove outcome is computed by probing — mirroring `isProcessAlive`.
		const epermPid = 1;
		const epermAlive = (() => {
			try {
				process.kill(epermPid, 0);
				return true;
			} catch (err) {
				return err.code !== "ESRCH";
			}
		})();
		const orphanDir = path.join(cacheRoot, `${deadPid}-stale-1`);
		const liveDir = path.join(cacheRoot, `${livePid}-foreign-1`);
		const epermDir = path.join(cacheRoot, `${epermPid}-eperm-1`);
		await mkdir(orphanDir, { recursive: true });
		await mkdir(liveDir, { recursive: true });
		await mkdir(epermDir, { recursive: true });

		await writeTransformedToCache(root, "export const a = 'sweep';", `cov-sweep-${process.pid}`);

		// Dead-PID dir removed (exercises line 186 false arm and line 187 rm call).
		expect(existsSync(orphanDir)).toBe(false);
		// Live-PID dir preserved.
		expect(existsSync(liveDir)).toBe(true);
		// PID 1: kept iff the probe says it's alive (EPERM/alive on POSIX,
		// possibly ESRCH/removed on platforms where PID 1 isn't signalable).
		expect(existsSync(epermDir)).toBe(epermAlive);
	});
});
