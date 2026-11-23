/**
 *
 *	@Project: @cldmv/slothlet
 *	@Filename: /tests/vitests/suites/context/context-run-across-reload.test.vitest.mjs
 *	@Date: 2026-11-22T18:37:39-08:00 (1795401459)
 *	@Author: Nate Corcoran <CLDMV>
 *	@Email: <Shinrai@users.noreply.github.com>
 *	-----
 *	@Last modified by: Nate Corcoran <CLDMV> (Shinrai@users.noreply.github.com)
 *	@Last modified time: 2026-11-22T18:37:39-08:00 (1795401459)
 *	-----
 *	@Copyright: Copyright (c) 2013-2026 Catalyzed Motivation Inc. All rights reserved.
 *
 */

/**
 * @fileoverview A `context.run()` flow keeps its own context, and its module calls keep working, while the instance
 * reloads under it and across a restart, also one that fails, on both runtimes, in eager and lazy mode, with permissions
 * off and on.
 *
 * @description
 * A full reload moves the instance to a new ID before the new copy loads, and moves the runs open then over to that ID
 * once the copy is built; a restart that fails part-way has moved the instance to its new ID as well. Runs open across
 * either must still be read as runs of the instance: every module call they make reads the run's context, never the
 * instance's, and a module's call through `self` inside the run is the module's own, also from a lazy node the run first
 * reaches after the restart.
 *
 * The cases run in a plain Node process (`probe.mjs`): under vitest a lazy node loaded inside a run goes through
 * vitest's module runner, which compiles the file with `vm`, and the files load fast enough there that a reload's window
 * between the ID switch and the move of the runs is rarely hit.
 *
 * Fixture (written to tmp/): `calls.mjs` reports `context.user` directly and after a timer, and calls a sibling through
 * `self`; `bad.mjs` throws while it loads when `globalThis.__runAcrossReloadFail` is set, so a restart fails there.
 */

import path from "node:path";
import { mkdirSync, rmSync, writeFileSync } from "node:fs";
import { spawnSync } from "node:child_process";
import { describe, it, expect, beforeAll, afterAll } from "vitest";

const ROOT = path.join(process.cwd(), "tmp", "context-run-across-reload");
const PROBE = path.join(ROOT, "probe.mjs");
const FAIL_FLAG = "__runAcrossReloadFail";
const RUNS = 12;
const ROUNDS = 3;

const MATRIX = [];
for (const runtime of ["live", "async"]) {
	for (const mode of ["eager", "lazy"]) {
		for (const permissions of ["off", "on"]) MATRIX.push({ runtime, mode, permissions });
	}
}

beforeAll(() => {
	rmSync(ROOT, { recursive: true, force: true });
	mkdirSync(path.join(ROOT, "api", "calls"), { recursive: true });
	mkdirSync(path.join(ROOT, "api", "bad"), { recursive: true });
	writeFileSync(
		path.join(ROOT, "api", "calls", "calls.mjs"),
		[
			'import { self, context } from "@cldmv/slothlet/runtime";',
			"export function user() {",
			"\treturn context.user ?? null;",
			"}",
			"export async function later() {",
			"\tawait new Promise((resolve) => setTimeout(resolve, 1));",
			"\treturn context.user ?? null;",
			"}",
			"export function one() {",
			"\treturn 1;",
			"}",
			"export function viaSelf() {",
			"\treturn self.calls.one();",
			"}"
		].join("\n") + "\n"
	);
	writeFileSync(
		path.join(ROOT, "api", "bad", "bad.mjs"),
		[
			`if (globalThis.${FAIL_FLAG}) throw new Error("this module fails to load on purpose");`,
			"export function ok() {",
			"\treturn 1;",
			"}"
		].join("\n") + "\n"
	);
	// For each case: concurrent runs while the instance reloads in a loop; then open a run on a fresh tree, restart the instance (its rebuild failing when asked) while the run
	// waits, then let the run make its calls; afterwards restart once more with the module loading again.
	writeFileSync(
		PROBE,
		[
			'import path from "node:path";',
			'import slothlet from "@cldmv/slothlet";',
			`const API = ${JSON.stringify(path.join(ROOT, "api"))};`,
			`const FAIL_FLAG = ${JSON.stringify(FAIL_FLAG)};`,
			`const MATRIX = ${JSON.stringify(MATRIX)};`,
			"const code = (error) => `ERR:${error?.code ?? error?.name}`;",
			"const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));",
			"const out = {};",
			"for (const { runtime, mode, permissions } of MATRIX) {",
			"\tconst api = await slothlet({ base: API, runtime, mode, silent: true, context: { user: 'base' }, ...(permissions === 'on' ? { permissions: { mode: 'on', policy: 'allow', rules: [] } } : {}) });",
			"\tconst wrong = [];",
			`\tfor (let round = 0; round < ${ROUNDS}; round++) {`,
			"\t\tlet stop = false;",
			"\t\tconst reloading = (async () => { while (!stop) { await api.slothlet.reload(); await sleep(1); } })();",
			`\t\tconst seen = await Promise.all(Array.from({ length: ${RUNS} }, (_, index) => api.slothlet.context.run({ user: 'u' + index }, async () => {`,
			"\t\t\tconst steps = [];",
			"\t\t\tfor (let step = 0; step < 4; step++) { await sleep(index % 3); steps.push(await api.calls.user()); steps.push(await api.calls.later()); }",
			"\t\t\treturn steps;",
			"\t\t})));",
			"\t\tstop = true;",
			"\t\tawait reloading;",
			"\t\tseen.forEach((steps, index) => { if (!steps.every((value) => value === 'u' + index)) wrong.push({ round, run: index, steps }); });",
			"\t}",
			"\tout[`${runtime}/${mode}/${permissions}/concurrent`] = { wrong, instance: await api.calls.user() };",
			"\tfor (const fail of [false, true]) {",
			"\t\tawait api.slothlet.restart();",
			"\t\tlet release;",
			"\t\tconst gate = new Promise((resolve) => (release = resolve));",
			"\t\tconst run = api.slothlet.context.run({ user: 'r' }, async () => {",
			"\t\t\tawait gate;",
			"\t\t\tconst viaSelf = await Promise.resolve().then(() => api.calls.viaSelf()).catch(code);",
			"\t\t\treturn { viaSelf, user: await api.calls.user(), later: await api.calls.later() };",
			"\t\t});",
			"\t\tif (fail) globalThis[FAIL_FLAG] = true;",
			"\t\tconst restart = await api.slothlet.restart().then(() => 'restarted', () => 'failed');",
			"\t\tdelete globalThis[FAIL_FLAG];",
			"\t\trelease();",
			"\t\tconst seen = await run;",
			"\t\tawait api.slothlet.restart();",
			"\t\tconst after = { viaSelf: await Promise.resolve().then(() => api.calls.viaSelf()).catch(code), user: await api.calls.user() };",
			"\t\tout[`${runtime}/${mode}/${permissions}/${fail ? 'fails' : 'succeeds'}`] = { restart, seen, after };",
			"\t}",
			"\tawait api.shutdown();",
			"}",
			"console.log(JSON.stringify(out));"
		].join("\n") + "\n"
	);
});

afterAll(() => {
	rmSync(ROOT, { recursive: true, force: true });
});

describe("a run open across a reload or a restart (plain Node)", () => {
	let results;

	beforeAll(() => {
		const result = spawnSync(process.execPath, [PROBE], { cwd: process.cwd(), env: process.env, encoding: "utf8", timeout: 600000 });
		expect(result.status, result.stderr).toBe(0);
		results = JSON.parse(result.stdout.trim().split("\n").pop());
	}, 600000);

	it.each(MATRIX)(
		"concurrent runs read their own context at every step while the instance reloads [$runtime/$mode/permissions $permissions]",
		({ runtime, mode, permissions }) => {
			expect(results[`${runtime}/${mode}/${permissions}/concurrent`]).toEqual({ wrong: [], instance: "base" });
		}
	);

	it.each(MATRIX)(
		"keeps its context and its module's own call through self [$runtime/$mode/permissions $permissions]",
		({ runtime, mode, permissions }) => {
			const { restart, seen, after } = results[`${runtime}/${mode}/${permissions}/succeeds`];
			expect({ restart, seen, after }).toEqual({
				restart: "restarted",
				seen: { viaSelf: 1, user: "r", later: "r" },
				after: { viaSelf: 1, user: "base" }
			});
		}
	);

	it.each(MATRIX)(
		"keeps its context when the restart fails [$runtime/$mode/permissions $permissions]",
		({ runtime, mode, permissions }) => {
			const { restart, seen, after } = results[`${runtime}/${mode}/${permissions}/fails`];
			// Lazy mode loads the failing file only once something reaches it, so its rebuild goes through.
			expect(restart).toBe(mode === "lazy" ? "restarted" : "failed");
			expect({ user: seen.user, later: seen.later }).toEqual({ user: "r", later: "r" });
			// An eager restart that fails leaves the instance shut down, and the run's kept copy belongs to the instance that ended.
			expect(seen.viaSelf).toBe(mode === "lazy" ? 1 : "ERR:CONTEXT_NOT_ACTIVE_SELF");
			// A second restart, with the module loading again, puts the instance back.
			expect(after).toEqual({ viaSelf: 1, user: "base" });
		}
	);
});
