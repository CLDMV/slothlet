/**
 *
 *	@Project: @cldmv/slothlet
 *	@Filename: /tests/vitests/suites/context/run-snapshot-close-cost.test.vitest.mjs
 *	@Date: 2026-11-22T00:00:00-08:00 (1795334400)
 *	@Author: Nate Corcoran <CLDMV>
 *	@Email: <Shinrai@users.noreply.github.com>
 *	-----
 *	@Last modified by: Nate Corcoran <CLDMV> (Shinrai@users.noreply.github.com)
 *	@Last modified time: 2026-11-22T00:00:00-08:00 (1795334400)
 *	-----
 *	@Copyright: Copyright (c) 2013-2026 Catalyzed Motivation Inc. All rights reserved.
 *
 */

/**
 * @fileoverview Closing a `run()` costs what that run kept, not a pass over every object the instance keeps versions
 * of: with thousands of runs open and the instance handing out values in each one's window, closing them all, oldest
 * first or newest first, stays well inside a bound that a pass per close over every saved object blows through.
 *
 * @description
 * The versions are still exact: every run reads the instance as of its own start, and once every run has closed the
 * instance keeps no version.
 *
 * Fixture (written at run time): `mk/mk.mjs`, `make(i)` (a fresh object each call), `state` and `set(n)`;
 * `reader/reader.mjs`, `n()` (reads `self.mk.state.n`).
 */
import path from "node:path";
import { mkdirSync, rmSync, writeFileSync } from "node:fs";
import { describe, it, expect, beforeAll, afterAll, afterEach } from "vitest";
import slothlet from "@cldmv/slothlet";
import { snapshotCounts } from "#helpers/run-snapshot";

const ROOT = path.join(process.cwd(), "tmp", "run-snapshot-close-cost");
const BASE = path.join(ROOT, "api");

/**
 * How many runs are open at once.
 * @type {number}
 */
const RUNS = 3000;

/**
 * How long closing all {@link RUNS} runs may take, in ms: generous, as closing them takes tens of ms, where a pass per
 * close over every saved object takes seconds.
 * @type {number}
 */
const CLOSE_BOUND_MS = 1000;

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
			"export function set(n) {",
			"\tstate.n = n;",
			"\treturn n;",
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
 * The host's own scheduler, taken before any instance patches the globals.
 */
const rawSetImmediate = globalThis.setImmediate;

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

const CONFIGS = [];
for (const order of ["oldest first", "newest first"]) for (const runtime of ["async", "live"]) CONFIGS.push({ order, runtime });

describe.each(CONFIGS)("closing many runs — $order / $runtime", ({ order, runtime }) => {
	let api;

	afterEach(async () => {
		await api?.slothlet.shutdown();
		api = null;
	});

	it(`closing ${RUNS} runs, each with values handed out in its window, costs what each run kept`, async () => {
		api = await slothlet({ base: BASE, runtime, mode: "eager", silent: true });
		await api.mk.make(0);
		const baseline = snapshotCounts().versions;
		const runs = [];
		for (let index = 0; index < RUNS; index++) {
			runs.push(openRun(api));
			// Each run's window gets values of its own: two fresh objects handed out, and the state changed.
			await api.mk.make(index);
			await api.mk.make(index);
			await api.mk.set(index + 1);
		}
		// Plain JS: each run reads the state as it was at its own start.
		expect(await runs[0].host(() => api.reader.n())).toBe(0);
		expect(await runs[RUNS - 1].host(() => api.reader.n())).toBe(RUNS - 1);
		const sequence = order === "oldest first" ? runs : [...runs].reverse();
		const started = performance.now();
		for (let index = 0; index < sequence.length; index++) {
			await sequence[index].close();
			// A run still open keeps reading the state as of its start.
			if (index === sequence.length >> 1) {
				const live = sequence[index + 1];
				const expected = order === "oldest first" ? index + 1 : RUNS - index - 2;
				expect(await live.host(() => api.reader.n())).toBe(expected);
			}
		}
		const elapsed = performance.now() - started;
		expect(elapsed).toBeLessThan(CLOSE_BOUND_MS);
		await settled();
		expect(snapshotCounts().versions).toBe(baseline);
		expect(await api.reader.n()).toBe(RUNS);
	}, 120000);
});
