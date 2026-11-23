/**
 *
 *	@Project: @cldmv/slothlet
 *	@Filename: /tests/vitests/suites/cjs/cjs-await-before-self.test.vitest.mjs
 *	@Date: 2026-11-22T16:20:41-08:00 (1795393241)
 *	@Author: Nate Corcoran <CLDMV>
 *	@Email: <Shinrai@users.noreply.github.com>
 *	-----
 *	@Last modified by: Nate Corcoran <CLDMV> (Shinrai@users.noreply.github.com)
 *	@Last modified time: 2026-11-22T16:54:26-08:00 (1795395266)
 *	-----
 *	@Copyright: Copyright (c) 2013-2026 Catalyzed Motivation Inc. All rights reserved.
 *
 */

/**
 * @fileoverview A function or method a module hands out that awaits before it reads `self` keeps its definer's standing
 * after the await, from an ES module and from a CommonJS file alike, called by the host or passed into another
 * module's call (#917). Both runtimes, both modes, with the permission system off and on.
 *
 * Fixture (written at run time): `calls/calls.mjs` answers a value; `relay/relay.mjs`'s `pass(fn)` calls what it is
 * given; `esm/esm.mjs` and `cjs/cjs.cjs` each hand out, from `later()`, a function that awaits and then reads
 * `self.calls.value()`, and from `holder()` an object whose method does the same; `early()` hands out one that reads
 * `self` before its first await.
 */
import path from "node:path";
import { mkdirSync, rmSync, writeFileSync } from "node:fs";
import { describe, it, expect, beforeAll, afterAll } from "vitest";
import slothlet from "@cldmv/slothlet";

const ROOT = path.join(process.cwd(), "tmp", "cjs-await-before-self");
const BASE = path.join(ROOT, "api");

const BODIES = [
	"exports.later = function later() {",
	"\treturn async () => {",
	"\t\tawait null;",
	"\t\tawait new Promise((resolve) => setTimeout(resolve, 1));",
	"\t\treturn { value: await self.calls.value(), who: context.who ?? null };",
	"\t};",
	"};",
	"exports.early = function early() {",
	"\treturn async () => {",
	"\t\tconst pending = self.calls.value();",
	"\t\tawait null;",
	"\t\treturn { value: await pending, who: context.who ?? null };",
	"\t};",
	"};",
	"exports.holder = function holder() {",
	"\treturn {",
	"\t\tasync read() {",
	"\t\t\tawait null;",
	"\t\t\tawait new Promise((resolve) => setTimeout(resolve, 1));",
	"\t\t\treturn { value: await self.calls.value(), who: context.who ?? null };",
	"\t\t}",
	"\t};",
	"};",
	""
];

beforeAll(() => {
	rmSync(ROOT, { recursive: true, force: true });
	for (const dir of ["calls", "relay", "esm", "cjs"]) mkdirSync(path.join(BASE, dir), { recursive: true });
	writeFileSync(path.join(BASE, "calls", "calls.mjs"), "export function value() {\n\treturn 42;\n}\n");
	writeFileSync(path.join(BASE, "relay", "relay.mjs"), "export async function pass(fn) {\n\treturn fn();\n}\n");
	writeFileSync(
		path.join(BASE, "esm", "esm.mjs"),
		[
			'import { self, context } from "@cldmv/slothlet/runtime";',
			...BODIES.map((line) => line.replace(/^exports\.(\w+) = /, "export const $1 = "))
		].join("\n")
	);
	writeFileSync(
		path.join(BASE, "cjs", "cjs.cjs"),
		[
			"let self;",
			"let context;",
			"(async () => {",
			'\t({ self, context } = await import("@cldmv/slothlet/runtime"));',
			"})();",
			...BODIES
		].join("\n")
	);
});

afterAll(() => {
	rmSync(ROOT, { recursive: true, force: true });
});

/**
 * Hand out the module's code and call it.
 * @param {object} options - What to do.
 * @param {string} options.runtime - "async" or "live".
 * @param {string} options.mode - "eager" or "lazy".
 * @param {string} options.permissions - "off" or "on".
 * @param {string} options.source - "esm" or "cjs".
 * @param {string} options.kind - "later", "early" or "holder".
 * @param {boolean} options.passed - Hand it to `relay.pass()` to call, instead of calling it.
 * @returns {Promise<{value: *, who: string|null}>} What it answered, or the error code it threw as `value`.
 */
async function scenario({ runtime, mode, permissions, source, kind, passed }) {
	const api = await slothlet({ base: BASE, runtime, mode, silent: true, context: { who: "instance" }, permissions });
	try {
		await api.calls.value();
		await api[source].later();
		// The CommonJS file takes `self` from an import its top level starts: done before the code is handed out.
		for (let index = 0; index < 4; index++) await new Promise((resolve) => setImmediate(resolve));
		const handed = kind === "holder" ? await api[source].holder() : await api[source][kind]();
		const fn = kind === "holder" ? () => handed.read() : handed;
		try {
			return await (passed ? api.relay.pass(fn) : fn());
		} catch (error) {
			return { value: error?.code ?? String(error), who: null };
		}
	} finally {
		await api.slothlet.shutdown();
	}
}

describe.each([["async"], ["live"]])("%s runtime: module code that awaits before reading self", (runtime) => {
	describe.each([["eager"], ["lazy"]])("%s mode", (mode) => {
		describe.each([["off"], ["on"]])("permissions %s", (permissions) => {
			describe.each([["esm"], ["cjs"]])("%s leaf", (source) => {
				it.each([
					["later", false],
					["later", true],
					["early", false],
					["early", true],
					["holder", false],
					["holder", true]
				])("%s, passed into another module's call: %s, keeps its definer's standing", async (kind, passed) => {
					const answer = await scenario({ runtime, mode, permissions, source, kind, passed });
					expect(answer).toEqual({ value: 42, who: "instance" });
				});
			});
		});
	});
});
