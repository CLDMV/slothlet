/**
 *
 *	@Project: @cldmv/slothlet
 *	@Filename: tests/vitests/suites/permissions/permissions-lazy-node-after-reload.test.vitest.mjs
 *	@Date: 2026-11-22T20:56:03-08:00 (1795409763)
 *	@Author: Nate Corcoran <CLDMV>
 *	@Email: <Shinrai@users.noreply.github.com>
 *	-----
 *	@Last modified by: Nate Corcoran <CLDMV> (Shinrai@users.noreply.github.com)
 *	@Last modified time: 2026-11-28T04:32:31-08:00 (1795869151)
 *	-----
 *	@Copyright: Copyright (c) 2013-2026 Catalyzed Motivation Inc. All rights reserved.
 *
 */

/**
 * @fileoverview A run's first call to a lazy node it had not loaded before an instance `reload()` / `restart()` is made
 * with the module's own standing, as in eager mode, on both runtimes, with permissions off and on.
 *
 * @description
 * A run open across a reload keeps the copy it started with. A lazy node of that copy that the run first reaches after
 * the reload loads apart from the run's flow; its nodes must still be made as the copy's, with the copy's metadata, so a
 * call the module makes through `self` is read as that module's: allowed by the policy, and denied where a rule denies
 * that module.
 *
 * The cases run in a plain Node process (`probe.mjs`): under vitest a lazy node goes through vitest's module runner,
 * which compiles the file with `vm` and hides the case.
 *
 * Fixture (written to tmp/): `calls/calls.mjs` calls its sibling `calls.one` through `self`; `other/other.mjs` makes the
 * same call, and a rule denies callers under `other` that target.
 */

import path from "node:path";
import { mkdirSync, rmSync, writeFileSync } from "node:fs";
import { spawnSync } from "node:child_process";
import { describe, it, expect, beforeAll, afterAll } from "vitest";

const ROOT = path.join(process.cwd(), "tmp", "permissions-lazy-node-after-reload");
const PROBE = path.join(ROOT, "probe.mjs");

const MATRIX = [];
for (const runtime of ["live", "async"]) {
	for (const mode of ["eager", "lazy"]) {
		for (const permissions of ["off", "on"]) {
			for (const op of ["reload", "restart"]) {
				for (const touched of [false, true]) MATRIX.push({ runtime, mode, permissions, op, touched });
			}
		}
	}
}

const keyOf = ({ runtime, mode, permissions, op, touched }) =>
	`${runtime}/${mode}/${permissions}/${op}/${touched ? "touched" : "untouched"}`;

beforeAll(() => {
	rmSync(ROOT, { recursive: true, force: true });
	mkdirSync(path.join(ROOT, "api", "calls"), { recursive: true });
	mkdirSync(path.join(ROOT, "api", "other"), { recursive: true });
	writeFileSync(
		path.join(ROOT, "api", "calls", "calls.mjs"),
		[
			'import { self, context } from "@cldmv/slothlet/runtime";',
			"export function user() {",
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
		path.join(ROOT, "api", "other", "other.mjs"),
		['import { self } from "@cldmv/slothlet/runtime";', "export function viaSelf() {", "\treturn self.calls.one();", "}"].join("\n") + "\n"
	);
	// For each case: open a run, touch the nodes first or not, reload or restart the instance while the run waits, then let the run make its calls.
	writeFileSync(
		PROBE,
		[
			'import slothlet from "@cldmv/slothlet";',
			`const API = ${JSON.stringify(path.join(ROOT, "api"))};`,
			`const MATRIX = ${JSON.stringify(MATRIX)};`,
			"const code = (error) => `ERR:${error?.code ?? error?.name}`;",
			"const call = (fn) => Promise.resolve().then(fn).catch(code);",
			"const out = {};",
			"for (const { runtime, mode, permissions, op, touched } of MATRIX) {",
			"\tconst rules = [{ caller: 'other.**', target: 'calls.one', effect: 'deny' }];",
			"\tconst api = await slothlet({ base: API, runtime, mode, silent: true, context: { user: 'base' }, ...(permissions === 'on' ? { permissions: { mode: 'on', policy: 'allow', rules } } : {}) });",
			"\tlet release;",
			"\tconst gate = new Promise((resolve) => (release = resolve));",
			"\tconst run = api.slothlet.context.run({ user: 'r' }, async () => {",
			"\t\tif (touched) { await call(() => api.calls.viaSelf()); await call(() => api.other.viaSelf()); }",
			"\t\tawait gate;",
			"\t\tconst first = { calls: await call(() => api.calls.viaSelf()), other: await call(() => api.other.viaSelf()) };",
			"\t\tconst second = { calls: await call(() => api.calls.viaSelf()), other: await call(() => api.other.viaSelf()) };",
			"\t\treturn { first, second, user: await api.calls.user() };",
			"\t});",
			"\tawait new Promise((resolve) => setTimeout(resolve, 5));",
			"\tawait api.slothlet[op]();",
			"\trelease();",
			"\tconst seen = await run;",
			"\tconst after = { calls: await call(() => api.calls.viaSelf()), other: await call(() => api.other.viaSelf()) };",
			"\tout[`${runtime}/${mode}/${permissions}/${op}/${touched ? 'touched' : 'untouched'}`] = { seen, after };",
			"\tawait api.shutdown();",
			"}",
			"console.log(JSON.stringify(out));"
		].join("\n") + "\n"
	);
});

afterAll(() => {
	rmSync(ROOT, { recursive: true, force: true });
});

describe("a run's first call to a lazy node after a reload (plain Node)", () => {
	let results;

	beforeAll(() => {
		const result = spawnSync(process.execPath, [PROBE], { cwd: process.cwd(), env: process.env, encoding: "utf8", timeout: 600000 });
		expect(result.status, result.stderr).toBe(0);
		results = JSON.parse(result.stdout.trim().split("\n").pop());
	}, 600000);

	it.each(MATRIX)(
		"a module's call through self keeps the module's standing [$runtime/$mode/permissions $permissions/$op/touched $touched]",
		(entry) => {
			// With permissions on, the rule denies `other`'s call, and only that one.
			const other = entry.permissions === "on" ? "ERR:PERMISSION_DENIED" : 1;
			const calls = { calls: 1, other };
			expect(results[keyOf(entry)]).toEqual({ seen: { first: calls, second: calls, user: "r" }, after: calls });
		}
	);
});
