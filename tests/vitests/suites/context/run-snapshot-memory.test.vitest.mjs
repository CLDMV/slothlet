/**
 *
 *	@Project: @cldmv/slothlet
 *	@Filename: tests/vitests/suites/context/run-snapshot-memory.test.vitest.mjs
 *	@Date: 2026-11-22T00:00:00-08:00 (1795334400)
 *	@Author: Nate Corcoran <CLDMV>
 *	@Email: <Shinrai@users.noreply.github.com>
 *	-----
 *	@Last modified by: Nate Corcoran <CLDMV> (Shinrai@users.noreply.github.com)
 *	@Last modified time: 2026-11-28T04:31:32-08:00 (1795869092)
 *	-----
 *	@Copyright: Copyright (c) 2013-2026 Catalyzed Motivation Inc. All rights reserved.
 *
 */

/**
 * @fileoverview Values the instance hands out while a `run()` is open are saved for that run, and what the host drops
 * is still collected: a run that stays open does not keep alive every object the instance made and handed out since it
 * started.
 *
 * @description
 * Plain JS is the reference: an object a call makes and the caller drops is unreachable, so the engine collects it,
 * whether or not a run is open somewhere. The run still reads the instance as of its start.
 *
 * Fixture (written at run time): `mk/mk.mjs`, `make(i)` (a fresh object each call), `state` and `bump()`;
 * `reader/reader.mjs`, `n()` (reads `self.mk.state.n`).
 */
import path from "node:path";
import vm from "node:vm";
import v8 from "node:v8";
import { mkdirSync, rmSync, writeFileSync } from "node:fs";
import { describe, it, expect, beforeAll, afterAll, afterEach } from "vitest";
import slothlet from "@cldmv/slothlet";
import { snapshotCounts } from "#helpers/run-snapshot";

const ROOT = path.join(process.cwd(), "tmp", "run-snapshot-memory");
const BASE = path.join(ROOT, "api");

/**
 * How many objects the host has the instance make, and drops, while the run is open.
 * @type {number}
 */
const MADE = 20000;

/**
 * The heap the dropped objects may still hold once collected, in bytes: well under what keeping them costs (about
 * 36 MB for {@link MADE} objects of three members each).
 * @type {number}
 */
const HEAP_SLACK = 12e6;

/**
 * The host's own scheduler, taken before any instance patches the globals.
 */
const rawSetImmediate = globalThis.setImmediate;
const rawSetTimeout = globalThis.setTimeout;

beforeAll(() => {
	rmSync(ROOT, { recursive: true, force: true });
	mkdirSync(path.join(BASE, "mk"), { recursive: true });
	mkdirSync(path.join(BASE, "reader"), { recursive: true });
	writeFileSync(
		path.join(BASE, "mk", "mk.mjs"),
		[
			"export function make(i) {",
			"\treturn { i, inner: { deep: [i] } };",
			"}",
			"export const state = { n: 0 };",
			"export function bump() {",
			"\tstate.n++;",
			"\treturn state.n;",
			"}"
		].join("\n") + "\n"
	);
	writeFileSync(
		path.join(BASE, "reader", "reader.mjs"),
		['import { self } from "@cldmv/slothlet/runtime";', "export function n() {", "\treturn self.mk.state.n;", "}"].join("\n") + "\n"
	);
});

afterAll(() => {
	rmSync(ROOT, { recursive: true, force: true });
});

/**
 * Let the work queued now run, then collect garbage several times.
 * @returns {Promise<void>}
 */
async function collect() {
	v8.setFlagsFromString("--expose-gc");
	const gc = globalThis.gc ?? vm.runInNewContext("gc");
	for (let round = 0; round < 6; round++) {
		for (let step = 0; step < 3; step++) await new Promise((resolve) => rawSetImmediate(resolve));
		gc();
		await new Promise((resolve) => rawSetTimeout(resolve, 5));
	}
}

/**
 * Wait for the runs closed to be torn down: a run's snapshot closes once the run has returned and its work is done,
 * a few turns after.
 * @returns {Promise<void>}
 */
async function settled() {
	for (let turn = 0; turn < 50 && snapshotCounts().runs !== 0; turn++) await new Promise((resolve) => rawSetImmediate(resolve));
}

/**
 * Open a run that runs host code inside it on request, until closed.
 * @param {object} api - The api.
 * @returns {{host: function(function(): *): Promise<*>, close: function(): Promise<void>}} The run's handle.
 */
function openRun(api) {
	const queue = [];
	let wake = null;
	const next = () =>
		queue.length
			? Promise.resolve(queue.shift())
			: new Promise((resolve) => {
					wake = resolve;
				});
	const done = api.slothlet.context.run({}, async () => {
		for (;;) {
			const job = await next();
			if (job === null) return;
			try {
				job.resolve({ value: await job.fn() });
			} catch (error) {
				job.resolve({ threw: error });
			}
		}
	});
	const push = (job) => {
		if (wake !== null) {
			const resolve = wake;
			wake = null;
			resolve(job);
		} else queue.push(job);
	};
	return {
		host: (fn) =>
			new Promise((resolve) => push({ fn, resolve })).then((outcome) => {
				if ("threw" in outcome) throw outcome.threw;
				return outcome.value;
			}),
		close: async () => {
			push(null);
			await done;
		}
	};
}

describe.each([{ runtime: "async" }, { runtime: "live" }])(
	"a run that stays open keeps no dropped objects alive — $runtime",
	({ runtime }) => {
		let api;

		afterEach(async () => {
			await api?.slothlet.shutdown();
			api = null;
		});

		it(`objects made and dropped after the run started are collected, and the run still reads the instance as of its start`, async () => {
			api = await slothlet({ base: BASE, runtime, mode: "eager", silent: true });
			await api.mk.make(0);
			const baseline = snapshotCounts().versions;
			await collect();
			const before = process.memoryUsage().heapUsed;
			const run = openRun(api);
			expect(await run.host(() => api.reader.n())).toBe(0);
			for (let index = 0; index < MADE; index++) await api.mk.make(index);
			expect(await api.mk.bump()).toBe(1);
			await collect();
			const growth = process.memoryUsage().heapUsed - before;
			expect(growth).toBeLessThan(HEAP_SLACK);
			// Plain JS for a run that started before the bump: the state as it was then.
			expect(await run.host(() => api.reader.n())).toBe(0);
			expect(await api.reader.n()).toBe(1);
			await run.close();
			await settled();
			expect(snapshotCounts().versions).toBe(baseline);
		}, 60000);
	}
);
