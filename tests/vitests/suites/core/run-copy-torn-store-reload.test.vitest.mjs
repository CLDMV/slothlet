/**
 *
 *	@Project: @cldmv/slothlet
 *	@Filename: /tests/vitests/suites/core/run-copy-torn-store-reload.test.vitest.mjs
 *	@Date: 2026-11-22T02:57:01-08:00 (1795345021)
 *	@Author: Nate Corcoran <CLDMV>
 *	@Email: <Shinrai@users.noreply.github.com>
 *	-----
 *	@Last modified by: Nate Corcoran <CLDMV> (Shinrai@users.noreply.github.com)
 *	@Last modified time: 2026-11-22T03:31:49-08:00 (1795347109)
 *	-----
 *	@Copyright: Copyright (c) 2013-2026 Catalyzed Motivation Inc. All rights reserved.
 *
 */

/**
 * @fileoverview Code that runs in a run's store after the run's copy is torn down, through something that is no work of
 * the run (an `AsyncLocalStorage.snapshot()`, an `AsyncResource` made in the run, a snapshot a module's call made
 * there), keeps the run's context and answers from the instance. When the instance reloads or restarts after that
 * teardown, the same code still does on the live runtime: `context` reads the run's keys, as the async runtime gives
 * them, and `self.*` / `api.*` reach the rebuilt tree, as the same code made outside any run does.
 *
 * Fixture (written at run time): `calls/calls.mjs`, whose leaf answers the stamp `shared/stamp.mjs` took when the
 * instance's copy of it loaded (one copy per instance ID), and `probe/probe.mjs`, whose `read()` answers that stamp
 * through `self` with `context.who`, and whose `snap()` takes a snapshot and hands out a function that reads the same
 * inside it.
 */
import path from "node:path";
import { AsyncLocalStorage, AsyncResource } from "node:async_hooks";
import { mkdirSync, rmSync, writeFileSync } from "node:fs";
import { describe, it, expect, beforeAll, afterAll, afterEach } from "vitest";
import slothlet from "@cldmv/slothlet";
import { runCopyCounts } from "#helpers/flow-stores";

const ROOT = path.join(process.cwd(), "tmp", "run-copy-torn-store-reload");
const BASE = path.join(ROOT, "api");
const STAMP = Symbol.for("slothlet.test.run-copy-torn-store-reload.stamp");

beforeAll(() => {
	rmSync(ROOT, { recursive: true, force: true });
	mkdirSync(path.join(BASE, "calls"), { recursive: true });
	mkdirSync(path.join(BASE, "probe"), { recursive: true });
	mkdirSync(path.join(ROOT, "shared"), { recursive: true });
	writeFileSync(
		path.join(ROOT, "shared", "stamp.mjs"),
		'export const stamp = globalThis[Symbol.for("slothlet.test.run-copy-torn-store-reload.stamp")];\n'
	);
	writeFileSync(
		path.join(BASE, "calls", "calls.mjs"),
		'import { stamp } from "../../shared/stamp.mjs";\nexport function copyOf() {\n\treturn stamp;\n}\n'
	);
	writeFileSync(
		path.join(BASE, "probe", "probe.mjs"),
		[
			'import { AsyncLocalStorage } from "node:async_hooks";',
			'import { self, context } from "@cldmv/slothlet/runtime";',
			"export async function read() {",
			"\treturn { copy: await self.calls.copyOf(), who: context.who ?? null };",
			"}",
			"export function snap() {",
			"\tconst inside = AsyncLocalStorage.snapshot();",
			"\treturn () => inside(async () => ({ copy: await self.calls.copyOf(), who: context.who ?? null }));",
			"}",
			""
		].join("\n")
	);
});

afterAll(() => {
	rmSync(ROOT, { recursive: true, force: true });
});

afterEach(() => {
	delete globalThis[STAMP];
});

/**
 * Let a few macrotasks pass: teardown runs on one once the work that finished a run has.
 * @returns {Promise<void>}
 */
async function idle() {
	for (let index = 0; index < 4; index++) await new Promise((resolve) => setImmediate(resolve));
}

/**
 * What the counts look like with no run live and no copy held.
 * @type {{runs: number, held: number, readThrough: number}}
 */
const BASELINE = { runs: 0, held: 0, readThrough: 0 };

/**
 * Make a function that later runs code in the flow it was made in, the way `kind` says.
 * @param {object} api - The api.
 * @param {string} kind - "snapshot", "resource" or "module snapshot".
 * @returns {Promise<function(): Promise<{copy: number, who: string|null}>>} The function.
 */
async function handOut(api, kind) {
	const body = async () => {
		const direct = await api.calls.copyOf();
		const read = await api.probe.read();
		return { copy: direct === read.copy ? direct : { direct, read: read.copy }, who: api.slothlet.context.get().who ?? null };
	};
	if (kind === "snapshot") {
		const inside = AsyncLocalStorage.snapshot();
		return () => inside(body);
	}
	if (kind === "resource") {
		const resource = new AsyncResource("run-copy-torn-store-reload");
		return () => resource.runInAsyncScope(body);
	}
	return api.probe.snap();
}

/**
 * Make the function (in a run, or outside any), let the run's copy be torn down, reload or restart the instance with a
 * new stamp, then call the function.
 * @param {object} options - What to do.
 * @param {string} options.runtime - "async" or "live".
 * @param {string} options.mode - "eager" or "lazy".
 * @param {string} options.permissions - "none", "off" or "on".
 * @param {string} options.operation - "reload" or "restart".
 * @param {string} options.kind - See {@link handOut}.
 * @param {boolean} options.inRun - Make it in a run (true) or outside any (false).
 * @returns {Promise<{copy: number, who: string|null}>} What the function answered.
 */
async function scenario({ runtime, mode, permissions, operation, kind, inRun }) {
	globalThis[STAMP] = 1;
	const api = await slothlet({
		base: BASE,
		runtime,
		mode,
		silent: true,
		context: { who: "instance" },
		...(permissions === "none" ? {} : { permissions })
	});
	try {
		let handed = null;
		if (inRun) {
			await api.slothlet.context.run({ who: "run" }, async () => {
				handed = await handOut(api, kind);
			});
		} else handed = await handOut(api, kind);
		await idle();
		// On the live runtime none of these is work of the run, so its copy is torn down here. On the async runtime the
		// run's flow lives on in what was made in it, and the run stays open: that runtime is only the reference for what
		// the code reads.
		if (runtime === "live") expect(runCopyCounts()).toEqual(BASELINE);
		globalThis[STAMP] = 2;
		await api.slothlet[operation]();
		await idle();
		const answer = await handed();
		await idle();
		if (runtime === "live") expect(runCopyCounts()).toEqual(BASELINE);
		return answer;
	} finally {
		await api.slothlet.shutdown();
	}
}

describe.each([["reload"], ["restart"]])("live runtime: code in a torn-down run's store, run after %s()", (operation) => {
	describe.each([["eager"], ["lazy"]])("%s mode", (mode) => {
		describe.each([["none"], ["off"], ["on"]])("permissions %s", (permissions) => {
			// An `AsyncResource` checks the patch it was made under when it runs, which a restart replaces: across a restart
			// only the snapshots are covered here.
			it.each(operation === "reload" ? [["snapshot"], ["resource"], ["module snapshot"]] : [["snapshot"], ["module snapshot"]])(
				"a %s made in the run reads the run's context and the rebuilt tree",
				async (kind) => {
					// What the same host code made outside any run answers: a module's code of the copy a reload replaced has no
					// `self` outside every flow, so its reference is the host's snapshot.
					const outsideKind = kind === "module snapshot" ? "snapshot" : kind;
					const outside = await scenario({ runtime: "live", mode, permissions, operation, kind: outsideKind, inRun: false });
					expect(outside).toEqual({ copy: 2, who: "instance" });
					// The async runtime's answer for the run's context, with no permission system: what the code reads there does
					// not depend on it.
					const reference = await scenario({ runtime: "async", mode, permissions: "none", operation, kind, inRun: true });
					expect(reference.who).toBe("run");
					const actual = await scenario({ runtime: "live", mode, permissions, operation, kind, inRun: true });
					expect(actual).toEqual({ copy: outside.copy, who: reference.who });
				}
			);
		});
	});
});
