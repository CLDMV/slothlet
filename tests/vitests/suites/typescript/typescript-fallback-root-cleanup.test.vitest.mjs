/**
 *	@Project: @cldmv/slothlet
 *	@Filename: /tests/vitests/suites/typescript/typescript-fallback-root-cleanup.test.vitest.mjs
 *	@Date: 2026-09-27 02:49:06 -07:00 (1790502546)
 *	@Author: Shinrai <CLDMV>
 *	@Email: <Shinrai@users.noreply.github.com>
 *	-----
 *	@Last modified by: Shinrai <CLDMV> (Shinrai@users.noreply.github.com)
 *	@Last modified time: 2026-09-27 03:27:32 -07:00 (1790504852)
 *	-----
 *	@Copyright: Copyright (c) 2013-2026 Catalyzed Motivation Inc. All rights reserved.
 */

/**
 * @fileoverview #465 — the TypeScript transform cache's secure fallback root
 * (`os.tmpdir()/slothlet-<pid>-XXXXXX`, used when a `.mts` file has no package root above it) is
 * removed once the last instance using it shuts down, and roots left by dead processes are swept.
 *
 * This suite necessarily works in the SYSTEM temp directory: the fallback only engages for a file
 * with no `package.json` anywhere above it, which is impossible inside the repo. Every entry it
 * creates there is removed in `afterEach`.
 */

import { describe, it, expect, afterEach } from "vitest";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import slothlet from "@cldmv/slothlet";
import { releaseSecureFallbackRoot, sweepStaleFallbackRoots } from "@cldmv/slothlet/processors/typescript";

/** A PID no process holds (beyond Linux's pid_max), so it always reads as dead. */
const DEAD_PID = 999999999;

/**
 * This process's fallback roots currently present in the system temp directory.
 * @returns {string[]} Absolute paths.
 */
const ownRoots = () =>
	fs
		.readdirSync(os.tmpdir())
		.filter((name) => name.startsWith(`slothlet-${process.pid}-`))
		.map((name) => path.join(os.tmpdir(), name));

describe("TypeScript fallback cache root cleanup (#465)", () => {
	const created = [];

	afterEach(async () => {
		for (const dir of created.splice(0)) fs.rmSync(dir, { recursive: true, force: true });
		await releaseSecureFallbackRoot();
	});

	/**
	 * A directory in the system temp dir with no package.json above it, holding one `.mts` module.
	 * @returns {string} The directory.
	 */
	const makePackagelessBase = () => {
		const base = fs.mkdtempSync(path.join(os.tmpdir(), "slothlet-465-base-"));
		created.push(base);
		fs.writeFileSync(path.join(base, "greet.mts"), "export const hello = (name: string): string => `hi ${name}`;\n");
		return base;
	};

	it("creates the fallback root with the owning PID in its name, and removes it on shutdown", async () => {
		const api = await slothlet({ base: makePackagelessBase(), mode: "eager", typescript: true });
		expect(await api.greet.hello("x")).toBe("hi x");

		const roots = ownRoots();
		expect(roots).toHaveLength(1);
		expect(fs.statSync(roots[0]).mode & 0o077).toBe(0); // still owner-only (CWE-377)

		await api.shutdown();
		expect(ownRoots()).toHaveLength(0);
	});

	it("keeps the root while another instance in the process still uses it", async () => {
		const base = makePackagelessBase();
		const first = await slothlet({ base, mode: "eager", typescript: true });
		const second = await slothlet({ base, mode: "eager", typescript: true });
		expect(ownRoots()).toHaveLength(1);

		await first.shutdown();
		expect(ownRoots()).toHaveLength(1);
		expect(await second.greet.hello("y")).toBe("hi y");

		await second.shutdown();
		expect(ownRoots()).toHaveLength(0);
	});

	it("sweeps roots whose owning process is gone, and keeps a live owner's", async () => {
		const dead = path.join(os.tmpdir(), `slothlet-${DEAD_PID}-aB3dE9`);
		const live = path.join(os.tmpdir(), `slothlet-${process.ppid}-Zz9yX8`);
		for (const dir of [dead, live]) {
			fs.mkdirSync(path.join(dir, ".slothlet-cache", "1-x"), { recursive: true, mode: 0o700 });
			created.push(dir);
		}

		await sweepStaleFallbackRoots();

		expect(fs.existsSync(dead)).toBe(false);
		expect(fs.existsSync(live)).toBe(true);
	});

	it("sweeps an old pre-PID root with no live cache, keeps a fresh one and unrelated slothlet- dirs", async () => {
		const old = path.join(os.tmpdir(), "slothlet-Qw3rT1");
		const fresh = path.join(os.tmpdir(), "slothlet-Po9iU8");
		const unrelated = path.join(os.tmpdir(), "slothlet-465-unrelated-x");
		for (const dir of [old, fresh, unrelated]) {
			fs.mkdirSync(path.join(dir, ".slothlet-cache"), { recursive: true, mode: 0o700 });
			created.push(dir);
		}
		const twoDaysAgo = new Date(Date.now() - 2 * 24 * 60 * 60 * 1000);
		fs.utimesSync(path.join(old, ".slothlet-cache"), twoDaysAgo, twoDaysAgo);
		fs.utimesSync(old, twoDaysAgo, twoDaysAgo);
		fs.utimesSync(unrelated, twoDaysAgo, twoDaysAgo);

		await sweepStaleFallbackRoots();

		expect(fs.existsSync(old)).toBe(false);
		expect(fs.existsSync(fresh)).toBe(true);
		expect(fs.existsSync(unrelated)).toBe(true);
	});

	it("keeps an old pre-PID root that still holds a live process's cache directory", async () => {
		const old = path.join(os.tmpdir(), "slothlet-Lv1nG2");
		fs.mkdirSync(path.join(old, ".slothlet-cache", `${process.ppid}-inst`), { recursive: true, mode: 0o700 });
		created.push(old);
		const twoDaysAgo = new Date(Date.now() - 2 * 24 * 60 * 60 * 1000);
		fs.utimesSync(old, twoDaysAgo, twoDaysAgo);

		await sweepStaleFallbackRoots();

		expect(fs.existsSync(old)).toBe(true);
	});
});
