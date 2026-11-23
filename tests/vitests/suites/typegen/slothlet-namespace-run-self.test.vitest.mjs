/**
 *
 *	@Project: @cldmv/slothlet
 *	@Filename: /tests/vitests/suites/typegen/slothlet-namespace-run-self.test.vitest.mjs
 *	@Date: 2026-11-21T23:29:53-08:00 (1795332593)
 *	@Author: Nate Corcoran <CLDMV>
 *	@Email: <Shinrai@users.noreply.github.com>
 *	-----
 *	@Last modified by: Nate Corcoran <CLDMV> (Shinrai@users.noreply.github.com)
 *	@Last modified time: 2026-11-21T23:53:31-08:00 (1795334011)
 *	-----
 *	@Copyright: Copyright (c) 2013-2026 Catalyzed Motivation Inc. All rights reserved.
 *
 */

/**
 * @fileoverview TypeScript consumers can call `api.slothlet.context.run.self(...)` and pass `self: true` to
 * `api.slothlet.context.scope(...)`: the declarations type `run` as a callable with a `self` member that is itself
 * callable, and `scope` takes the option. A call whose callback does not take the view first, and a `self` that is not
 * a member of `run`, are still errors.
 *
 * Each snippet is compiled with `tsc --strict` against the in-repo declarations (`--customConditions slothlet-dev`).
 */
import path from "node:path";
import { execFileSync } from "node:child_process";
import { mkdirSync, rmSync, writeFileSync } from "node:fs";
import { describe, it, expect, beforeAll, afterAll } from "vitest";

const DIR = path.join(process.cwd(), "tmp", "run-self-types");

/**
 * Compile one snippet; the compiler's output when it fails, "" when it type-checks.
 * @param {string} name - File name.
 * @param {string[]} lines - The snippet.
 * @returns {string} The compiler's output.
 */
function compile(name, lines) {
	const file = path.join(DIR, name);
	writeFileSync(
		file,
		['import slothlet from "@cldmv/slothlet";', "const api = await slothlet({ base: './api' });", ...lines, ""].join("\n")
	);
	try {
		execFileSync(
			path.join(process.cwd(), "node_modules", ".bin", "tsc"),
			[
				"--noEmit",
				"--strict",
				"--moduleResolution",
				"bundler",
				"--customConditions",
				"slothlet-dev",
				"--module",
				"esnext",
				"--target",
				"es2022",
				file
			],
			{ cwd: process.cwd(), encoding: "utf8", stdio: "pipe" }
		);
		return "";
	} catch (error) {
		return `${error.stdout ?? ""}${error.stderr ?? ""}` || String(error);
	}
}

beforeAll(() => {
	rmSync(DIR, { recursive: true, force: true });
	mkdirSync(DIR, { recursive: true });
});

afterAll(() => {
	rmSync(DIR, { recursive: true, force: true });
});

describe("slothlet.context types", () => {
	it("accepts run.self with a callback and extra arguments", () => {
		expect(
			compile("run-self.mts", [
				"const out = await api.slothlet.context.run.self({ user: 'a' }, (view: unknown, label: string) => label + typeof view, 'x');",
				"void out;"
			])
		).toBe("");
	});

	it("still accepts run", () => {
		expect(compile("run.mts", ["await api.slothlet.context.run({ user: 'a' }, () => 1);"])).toBe("");
	});

	it("accepts scope with self: true", () => {
		expect(
			compile("scope-self.mts", ["await api.slothlet.context.scope({ context: { user: 'a' }, self: true, fn: (view: unknown) => view });"])
		).toBe("");
	});

	it("refuses a member run does not have", () => {
		expect(compile("run-other.mts", ["await api.slothlet.context.run.other({}, () => 1);"])).toContain("TS2339");
	});

	it("refuses a run.self whose context data is not an object", () => {
		expect(compile("run-self-bad.mts", ["await api.slothlet.context.run.self(1, () => 1);"])).toContain("TS2345");
	});
});
