/**
 *
 *	@Project: @cldmv/slothlet
 *	@Filename: /tests/vitests/suites/devcheck/devcheck.test.vitest.mjs
 *	@Date: 2026-08-14T20:50:00-07:00 (1786765800)
 *	@Author: Nate Corcoran <CLDMV>
 *	@Email: <Shinrai@users.noreply.github.com>
 *	-----
 *	@Last modified by: Nate Corcoran <CLDMV> (Shinrai@users.noreply.github.com)
 *	@Last modified time: 2026-11-01T09:11:10-08:00 (1793553070)
 *	-----
 *	@Copyright: Copyright (c) 2013-2026 Catalyzed Motivation Inc. All rights reserved.
 *
 */

import { test, expect, describe, beforeAll, afterAll } from "vitest";
import { spawnSync } from "node:child_process";
import { existsSync, mkdtempSync, mkdirSync, copyFileSync, rmSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

// devcheck.mjs resolves `src/` relative to its own file location and reads process.env
// / process.execArgv, so each case runs a COPY of it in a purpose-built fixture
// directory with a from-scratch env (only PATH), preventing the real CI environment
// this suite runs in from leaking `CI`/`GITHUB_ACTIONS`/`NODE_OPTIONS` into the
// subprocess.
// The repo root is the nearest directory above this test that holds devcheck.mjs, so the file
// works unchanged wherever a repo keeps its tests.
function findRepoRoot(dir) {
	while (!existsSync(path.join(dir, "devcheck.mjs"))) {
		const parent = path.dirname(dir);
		if (parent === dir) throw new Error("devcheck.mjs not found above the devcheck test");
		dir = parent;
	}
	return dir;
}
const repoRoot = findRepoRoot(path.dirname(fileURLToPath(import.meta.url)));
const devcheckSrc = path.join(repoRoot, "devcheck.mjs");

// The suite is the same in every repo: the package name and its dev condition come from the
// repo's own package.json, exactly as devcheck.mjs works them out.
const packageName = JSON.parse(readFileSync(path.join(repoRoot, "package.json"), "utf8")).name;
const shortName = packageName.split("/").pop();
const COND = `${shortName}-dev`;

let tmpRoot;
let counter = 0;

beforeAll(() => {
	tmpRoot = mkdtempSync(path.join(tmpdir(), `${shortName}-devcheck-`));
});

afterAll(() => {
	if (tmpRoot) rmSync(tmpRoot, { recursive: true, force: true });
});

// Materialize a fixture dir with a copy of devcheck.mjs, a package.json carrying `name`
// (omitted when null), and optional src/ and dist/, optionally nested under
// node_modules/<scope>/<pkg> to simulate an installed package.
function makeFixture({ src = true, dist = false, installed = false, name = packageName } = {}) {
	const base = path.join(tmpRoot, `f${counter++}`);
	const pkgDir = installed ? path.join(base, "node_modules", ...packageName.split("/")) : path.join(base, shortName);
	mkdirSync(pkgDir, { recursive: true });
	if (src) mkdirSync(path.join(pkgDir, "src"), { recursive: true });
	if (dist) mkdirSync(path.join(pkgDir, "dist"), { recursive: true });
	if (name !== null) writeFileSync(path.join(pkgDir, "package.json"), JSON.stringify({ name }));
	copyFileSync(devcheckSrc, path.join(pkgDir, "devcheck.mjs"));
	return path.join(pkgDir, "devcheck.mjs");
}

// nodeArgs are passed on the node CLI (i.e. become process.execArgv); env is a
// from-scratch environment (only PATH plus whatever is given).
function runDevcheck(fixtureOpts, { env = {}, nodeArgs = [] } = {}) {
	const devcheck = makeFixture(fixtureOpts);
	const result = spawnSync(process.execPath, [...nodeArgs, devcheck], {
		env: { PATH: process.env.PATH, ...env },
		encoding: "utf8"
	});
	return { status: result.status, stderr: result.stderr || "" };
}

describe("devcheck", () => {
	test("nags in a source checkout when the dev condition is not set", () => {
		const { status, stderr } = runDevcheck({ src: true });
		expect(status).toBe(1);
		expect(stderr).toContain("Development environment not properly configured");
		expect(stderr).toContain(`--conditions=${COND}`);
	});

	test("stays silent when the condition is set via NODE_OPTIONS", () => {
		const { status, stderr } = runDevcheck({ src: true }, { env: { NODE_OPTIONS: `--conditions=${COND}` } });
		expect(status).toBe(0);
		expect(stderr).toBe("");
	});

	test("stays silent when the condition is passed on the node CLI (execArgv, = form)", () => {
		// vitest passes --conditions to workers this way, so devcheck must detect it here too.
		const { status, stderr } = runDevcheck({ src: true }, { nodeArgs: [`--conditions=${COND}`] });
		expect(status).toBe(0);
		expect(stderr).toBe("");
	});

	test("stays silent when the condition is passed space-separated (--conditions <name>-dev)", () => {
		const { status, stderr } = runDevcheck({ src: true }, { nodeArgs: ["--conditions", COND] });
		expect(status).toBe(0);
		expect(stderr).toBe("");
	});

	test("stays silent when the dev condition is one of several repeated --conditions flags", () => {
		const { status } = runDevcheck({ src: true }, { nodeArgs: ["--conditions=foo", `--conditions=${COND}`] });
		expect(status).toBe(0);
	});

	test("stays silent via the -C short flag (Node's alias for --conditions)", () => {
		// Node accepts `-C <value>` (space form) but rejects `-C=<value>`, so only the
		// space form is a real input to detect.
		const { status, stderr } = runDevcheck({ src: true }, { nodeArgs: ["-C", COND] });
		expect(status).toBe(0);
		expect(stderr).toBe("");
	});

	test("NODE_ENV=development alone does NOT silence it (only the condition selects src/)", () => {
		// Keying off NODE_ENV would be a false negative: dev env set but no condition means
		// the package is still resolving to dist/, which is exactly what should be flagged.
		const { status } = runDevcheck({ src: true }, { env: { NODE_ENV: "development" } });
		expect(status).toBe(1);
	});

	test("STILL nags when dist/ has been built but the condition is not set", () => {
		// A build must NOT silence the check: with src/ present the developer should be on
		// src/ via the condition, not the stale dist/.
		const { status } = runDevcheck({ src: true, dist: true });
		expect(status).toBe(1);
	});

	test("does NOT accept a generic development condition (namespacing)", () => {
		const { status } = runDevcheck({ src: true }, { nodeArgs: ["--conditions=development"] });
		expect(status).toBe(1);
	});

	test("does NOT match a condition that merely contains the dev condition as a substring", () => {
		// Exact-value match, not substring: --conditions=not-<name>-dev must NOT silence it.
		const { status } = runDevcheck({ src: true }, { nodeArgs: [`--conditions=not-${COND}`] });
		expect(status).toBe(1);
	});

	test("does NOT treat a comma-joined value as separate conditions", () => {
		// Node does not split --conditions on `,`: `foo,<name>-dev,bar` is one literal
		// condition, so <name>-dev is NOT enabled and devcheck must still nag.
		const { status } = runDevcheck({ src: true }, { nodeArgs: [`--conditions=foo,${COND},bar`] });
		expect(status).toBe(1);
	});

	test("does NOT treat a pipe-joined value as separate conditions", () => {
		// Likewise Node does not split on `|` (it's a valid condition character, e.g.
		// Vite's `development|production`): `<name>-dev|production` does not enable <name>-dev.
		const { status } = runDevcheck({ src: true }, { nodeArgs: [`--conditions=${COND}|production`] });
		expect(status).toBe(1);
	});

	test("skips in CI", () => {
		const { status, stderr } = runDevcheck({ src: true }, { env: { CI: "true" } });
		expect(status).toBe(0);
		expect(stderr).toBe("");
	});

	test("skips when installed as a dependency (node_modules/<scope>/<pkg>)", () => {
		const { status, stderr } = runDevcheck({ src: true, installed: true });
		expect(status).toBe(0);
		expect(stderr).toBe("");
	});

	test("does nothing when there is no src/ (published dist-only layout)", () => {
		const { status, stderr } = runDevcheck({ src: false, dist: true });
		expect(status).toBe(0);
		expect(stderr).toBe("");
	});

	test("names the package and its condition in the message", () => {
		const { stderr } = runDevcheck({ src: true });
		expect(stderr).toContain(packageName);
		expect(stderr).toContain(`'${COND}'`);
	});

	test("derives the condition from whatever package.json it sits next to", () => {
		// Same file in another repo: @cldmv/other-pkg checks other-pkg-dev, not this repo's.
		const other = { src: true, name: "@cldmv/other-pkg" };
		expect(runDevcheck(other, { nodeArgs: [`--conditions=${COND}`] }).status).toBe(1);
		expect(runDevcheck(other, { nodeArgs: ["--conditions=other-pkg-dev"] }).status).toBe(0);
	});

	test("derives the condition from an unscoped name", () => {
		expect(runDevcheck({ src: true, name: "plainpkg" }, { nodeArgs: ["--conditions=plainpkg-dev"] }).status).toBe(0);
	});

	test("skips when there is no package.json beside it", () => {
		const { status, stderr } = runDevcheck({ src: true, name: null });
		expect(status).toBe(0);
		expect(stderr).toBe("");
	});
});
