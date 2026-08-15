/**
 *	@Project: @cldmv/slothlet
 *	@Filename: /tests/vitests/suites/devcheck/devcheck.test.vitest.mjs
 *	@Date: 2026-08-14 20:50:00 -07:00 (1786765800)
 *	@Author: Nate Corcoran <CLDMV>
 *	@Email: <Shinrai@users.noreply.github.com>
 *	-----
 *	@Last modified by: Nate Corcoran <CLDMV> (Shinrai@users.noreply.github.com)
 *	@Last modified time: 2026-08-14 20:50:00 -07:00 (1786765800)
 *	-----
 *	@Copyright: Copyright (c) 2013-2026 Catalyzed Motivation Inc. All rights reserved.
 */

/**
 * @fileoverview Regression tests for the root `devcheck.mjs` dev-environment guard (#270).
 *
 * `devcheck.mjs` runs at import time and calls `process.exit(1)` when it thinks a dev is
 * running against `src/` without slothlet's dev resolver condition. It cannot be imported
 * in-process (it would kill the worker), so each case copies the real `devcheck.mjs` into a
 * throwaway layout — a sibling `src/` dir and no `dist/`, satisfying the outer
 * `existsSync(src) && !existsSync(dist)` guard — and spawns a fresh Node against it with a
 * CI-free, per-case environment. The two bugs covered:
 *
 *   1. Dev-condition detection only read `NODE_OPTIONS`, missing the CLI/worker form where the
 *      flag lands in `process.execArgv` (`node --conditions=slothlet-dev file.mjs`, and how
 *      vitest passes conditions to its workers) — so the guard fired a false `exit(1)`.
 *   2. The installed-package guard checked `basename(dirname(__dirname)) === "node_modules"`,
 *      which is `@cldmv` (the scope dir) for slothlet's own scoped install — so it never
 *      tripped, and a git/tarball install (ships `src/`, no `dist/`) would `exit(1)` inside a
 *      consumer.
 */
import { describe, it, expect, afterAll } from "vitest";
import { spawn } from "node:child_process";
import { mkdtemp, mkdir, copyFile, rm } from "node:fs/promises";
import path from "node:path";
import { tmpdir } from "node:os";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(__dirname, "../../../..");
const DEVCHECK_SRC = path.join(REPO_ROOT, "devcheck.mjs");

// Every CI signal devcheck.mjs consults — cleared from the child so the guard is actually
// exercised under CI (otherwise `isCI` short-circuits the whole block and every case exits 0).
const CI_ENV_KEYS = ["CI", "GITHUB_ACTIONS", "TRAVIS", "CIRCLECI", "GITLAB_CI", "BUILDKITE", "JENKINS_URL", "TF_BUILD"];

const tempRoots = [];

/**
 * Stage a copy of the real `devcheck.mjs` at `<tmp>/<subpath>/devcheck.mjs` with a sibling
 * `src/` dir and no `dist/`, so the guard's outer condition is satisfied.
 * @param {string} subpath - Layout under the temp root (e.g. "slothlet" or "node_modules/@cldmv/slothlet").
 * @returns {Promise<string>} Absolute path to the staged devcheck.mjs.
 */
async function stageDevcheck(subpath) {
	const root = await mkdtemp(path.join(tmpdir(), "slothlet-devcheck-"));
	tempRoots.push(root);
	const dir = path.join(root, subpath);
	await mkdir(path.join(dir, "src"), { recursive: true });
	await copyFile(DEVCHECK_SRC, path.join(dir, "devcheck.mjs"));
	return path.join(dir, "devcheck.mjs");
}

/**
 * Spawn `node [execArgs] <file>` with a CI-free, controlled environment. The runner's own
 * `NODE_OPTIONS` / `NODE_ENV` are dropped unless a case sets them, so detection is deterministic.
 * @param {string} file - Absolute path to a staged devcheck.mjs.
 * @param {{ execArgs?: string[], env?: Record<string, string> }} [opts]
 * @returns {Promise<{ code: number, stdout: string, stderr: string }>}
 */
function runDevcheck(file, { execArgs = [], env = {} } = {}) {
	return new Promise((resolve, reject) => {
		const childEnv = { ...process.env, ...env };
		for (const key of CI_ENV_KEYS) delete childEnv[key];
		if (!("NODE_OPTIONS" in env)) delete childEnv.NODE_OPTIONS;
		if (!("NODE_ENV" in env)) delete childEnv.NODE_ENV;
		const child = spawn(process.execPath, [...execArgs, file], { env: childEnv });
		let stdout = "";
		let stderr = "";
		child.stdout.on("data", (chunk) => (stdout += chunk.toString()));
		child.stderr.on("data", (chunk) => (stderr += chunk.toString()));
		child.on("error", reject);
		child.on("close", (code) => resolve({ code: code ?? 0, stdout, stderr }));
	});
}

describe("devcheck.mjs dev-environment guard (#270)", () => {
	afterAll(async () => {
		await Promise.allSettled(tempRoots.map((r) => rm(r, { recursive: true, force: true })));
	});

	describe("guard is active (baseline)", () => {
		it("exits 1 with a config message when no dev condition is set at all", async () => {
			const file = await stageDevcheck("slothlet");
			const { code, stderr } = await runDevcheck(file);
			expect(code).toBe(1);
			expect(stderr).toMatch(/not properly configured/);
		});
	});

	describe("dev-condition detection reads execArgv, not just NODE_OPTIONS (bug 1)", () => {
		it("does not fire when --conditions=slothlet-dev is passed on the CLI (execArgv)", async () => {
			const file = await stageDevcheck("slothlet");
			const { code, stderr } = await runDevcheck(file, { execArgs: ["--conditions=slothlet-dev"] });
			expect(code).toBe(0);
			expect(stderr).toBe("");
		});

		it("still detects slothlet-dev via NODE_OPTIONS (original path preserved)", async () => {
			const file = await stageDevcheck("slothlet");
			const { code } = await runDevcheck(file, { env: { NODE_OPTIONS: "--conditions=slothlet-dev" } });
			expect(code).toBe(0);
		});

		it("shows the generic-dev redirect message when --conditions=development is on the CLI", async () => {
			const file = await stageDevcheck("slothlet");
			const { code, stderr } = await runDevcheck(file, {
				execArgs: ["--conditions=development"],
				env: { NODE_ENV: "development" }
			});
			expect(code).toBe(1);
			expect(stderr).toMatch(/Incorrect development environment detected/);
		});
	});

	describe("installed-package guard detects a node_modules segment anywhere (bug 2)", () => {
		it("does not fire for a scoped install under node_modules/@cldmv/slothlet", async () => {
			const file = await stageDevcheck(path.join("node_modules", "@cldmv", "slothlet"));
			const { code, stderr } = await runDevcheck(file);
			expect(code).toBe(0);
			expect(stderr).toBe("");
		});

		it("does not fire for an unscoped install under node_modules/slothlet (original path preserved)", async () => {
			const file = await stageDevcheck(path.join("node_modules", "slothlet"));
			const { code } = await runDevcheck(file);
			expect(code).toBe(0);
		});
	});
});
