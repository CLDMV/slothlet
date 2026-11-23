/**
 *
 *	@Project: @cldmv/slothlet
 *	@Filename: /tests/vitests/suites/core/run-rebuild-script-records.test.vitest.mjs
 *	@Date: 2026-11-22T16:25:09-08:00 (1795393509)
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
 * @fileoverview A run's own reload or restart builds its copy's CommonJS leaves from scripts of their own, which tell
 * their code apart from the code of the copies the run read before (#912). However many times a run rebuilds its copy,
 * the code of every copy still standing keeps being recognised: the instance's own code, outside the run and in it,
 * keeps its standing across the run's reloads, and so does the code of a copy a reload in the run built; code a
 * restart in the run replaced stays refused, however many reloads follow. Code running at the CommonJS leaf's file in a
 * script that is none of the file's loads (compiled under its name) is no one's: it is refused, never taken for the
 * host's code because a run is open. Both runtimes, both modes, permissions on.
 *
 * Fixture (written at run time): `calls/calls.mjs` answers a value; `cjsprobe/cjsprobe.cjs` hands out, from `later()`,
 * a function reading `self.calls.value()` and `context.who`, and from `holder()` an object whose method does the same.
 */
import path from "node:path";
import vm from "node:vm";
import { mkdirSync, rmSync, writeFileSync } from "node:fs";
import { describe, it, expect, beforeAll, afterAll } from "vitest";
import slothlet from "@cldmv/slothlet";

const ROOT = path.join(process.cwd(), "tmp", "run-rebuild-script-records");
const BASE = path.join(ROOT, "api");

// More rebuilds of the same file than any fixed number of scripts kept per file would hold.
const REBUILDS = 20;

beforeAll(() => {
	rmSync(ROOT, { recursive: true, force: true });
	for (const dir of ["calls", "cjsprobe"]) mkdirSync(path.join(BASE, dir), { recursive: true });
	writeFileSync(path.join(BASE, "calls", "calls.mjs"), "export function value() {\n\treturn 42;\n}\n");
	writeFileSync(
		path.join(BASE, "cjsprobe", "cjsprobe.cjs"),
		[
			"let self;",
			"let context;",
			"(async () => {",
			'\t({ self, context } = await import("@cldmv/slothlet/runtime"));',
			"})();",
			"exports.later = function later() {",
			"\treturn async () => ({ value: await self.calls.value(), who: context.who ?? null });",
			"};",
			"exports.holder = function holder() {",
			"\treturn {",
			"\t\tasync read() {",
			"\t\t\treturn { value: await self.calls.value(), who: context.who ?? null };",
			"\t\t}",
			"\t};",
			"};",
			""
		].join("\n")
	);
});

afterAll(() => {
	rmSync(ROOT, { recursive: true, force: true });
});

/**
 * Hand out the CommonJS leaf's code.
 * @param {object} api - The api.
 * @param {string} kind - "function" or "method".
 * @returns {Promise<function(): Promise<{value: *, who: string|null}>>} A call of it.
 */
async function handOut(api, kind) {
	if (kind === "method") {
		const object = await api.cjsprobe.holder();
		return () => object.read();
	}
	return api.cjsprobe.later();
}

/**
 * Call it, answering the error code it threw as `value`.
 * @param {function(): Promise<object>} fn - The call.
 * @returns {Promise<{value: *, who: string|null}>} The answer.
 */
async function attempt(fn) {
	try {
		return await fn();
	} catch (error) {
		return { value: error?.code ?? String(error), who: null };
	}
}

/**
 * Open an instance with the permission system on and hand it to `body`.
 * @param {string} runtime - "async" or "live".
 * @param {string} mode - "eager" or "lazy".
 * @param {function(object): Promise<*>} body - What to do.
 * @returns {Promise<*>} What `body` answered.
 */
async function withInstance(runtime, mode, body) {
	const api = await slothlet({ base: BASE, runtime, mode, silent: true, context: { who: "instance" }, permissions: "on" });
	try {
		await api.calls.value();
		await api.cjsprobe.later();
		return await body(api);
	} finally {
		await api.slothlet.shutdown();
	}
}

/**
 * Reload the run's copy a number of times.
 * @param {object} api - The api.
 * @param {number} times - How many.
 * @returns {Promise<void>}
 */
async function reloads(api, times) {
	for (let index = 0; index < times; index++) {
		await api.slothlet.reload();
		await api.cjsprobe.later();
	}
}

describe.each([["async"], ["live"]])("%s runtime: a run rebuilding its copy many times", (runtime) => {
	describe.each([["eager"], ["lazy"]])("%s mode", (mode) => {
		it("code compiled under the CommonJS leaf's file name, called in a run, is refused", async () => {
			const answer = await withInstance(runtime, mode, async (api) => {
				const { self } = await import("@cldmv/slothlet/runtime");
				const compiled = vm.compileFunction("return (async () => ({ value: await self.calls.value(), who: null }))();", ["self"], {
					filename: path.join(BASE, "cjsprobe", "cjsprobe.cjs")
				});
				return api.slothlet.context.run({ who: "run" }, () => attempt(() => compiled(self)));
			});
			expect(answer).toEqual({ value: "PERMISSION_DENIED", who: null });
		});

		describe.each([["function"], ["method"]])("a CommonJS module %s", (kind) => {
			it("the instance's modules handed out outside the run keeps working outside it", async () => {
				const answer = await withInstance(runtime, mode, async (api) => {
					const held = await handOut(api, kind);
					for (let index = 0; index < REBUILDS; index++) await api.slothlet.context.run({ who: "run" }, () => api.slothlet.reload());
					return attempt(held);
				});
				expect(answer).toEqual({ value: 42, who: "instance" });
			});

			it("made in the run before its reloads keeps its standing in the run", async () => {
				const answer = await withInstance(runtime, mode, (api) =>
					api.slothlet.context.run({ who: "run" }, async () => {
						const held = await handOut(api, kind);
						await reloads(api, REBUILDS);
						return attempt(held);
					})
				);
				expect(answer).toEqual({ value: 42, who: "run" });
			});

			it("made by a copy a reload in the run built keeps its standing in the run after more reloads", async () => {
				const answer = await withInstance(runtime, mode, (api) =>
					api.slothlet.context.run({ who: "run" }, async () => {
						await api.slothlet.reload();
						const held = await handOut(api, kind);
						await reloads(api, REBUILDS);
						return attempt(held);
					})
				);
				expect(answer).toEqual({ value: 42, who: "run" });
			});

			it("made in the run before a restart there stays refused after many reloads", async () => {
				const answer = await withInstance(runtime, mode, (api) =>
					api.slothlet.context.run({ who: "run" }, async () => {
						const held = await handOut(api, kind);
						await api.slothlet.restart();
						await reloads(api, REBUILDS);
						return attempt(held);
					})
				);
				expect(answer).toEqual({ value: "PERMISSION_DENIED", who: null });
			});

			it("made by a copy a reload in the run built, before a restart there, stays refused after many reloads", async () => {
				const answer = await withInstance(runtime, mode, (api) =>
					api.slothlet.context.run({ who: "run" }, async () => {
						await reloads(api, REBUILDS);
						const held = await handOut(api, kind);
						await api.slothlet.restart();
						await reloads(api, REBUILDS);
						return attempt(held);
					})
				);
				expect(answer).toEqual({ value: "PERMISSION_DENIED", who: null });
			});
		});
	});
});
