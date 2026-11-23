/**
 *
 *	@Project: @cldmv/slothlet
 *	@Filename: /tests/vitests/suites/context/run-snapshot-cached-cost.test.vitest.mjs
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
 * @fileoverview A large value a module keeps and hands out again in each new run's window is not copied again while it
 * has not changed: the version saved for the runs open already is the content the new run reads, so handing it out
 * keeps no second copy and costs far less than the first copy did. A member the instance changed is saved again.
 *
 * @description
 * Plain JS is the reference: each run reads the value as it was at its own start, whichever window the value was
 * handed out in, and the instance reads it as it is.
 *
 * Fixture (written at run time): `big/big.mjs`, `get()` (an object of {@link MEMBERS} members, made once);
 * `reader/reader.mjs`, `v(key)` (reads `self.big.get()[key].v`).
 */
import path from "node:path";
import { mkdirSync, rmSync, writeFileSync } from "node:fs";
import { describe, it, expect, beforeAll, afterAll, afterEach } from "vitest";
import slothlet from "@cldmv/slothlet";
import { snapshotCounts } from "#helpers/run-snapshot";

const ROOT = path.join(process.cwd(), "tmp", "run-snapshot-cached-cost");
const BASE = path.join(ROOT, "api");

/**
 * How many members the cached value has.
 * @type {number}
 */
const MEMBERS = 50000;

/**
 * How many new run windows it is handed out in.
 * @type {number}
 */
const WINDOWS = 10;

beforeAll(() => {
	rmSync(ROOT, { recursive: true, force: true });
	mkdirSync(path.join(BASE, "big"), { recursive: true });
	mkdirSync(path.join(BASE, "reader"), { recursive: true });
	writeFileSync(
		path.join(BASE, "big", "big.mjs"),
		[
			"const big = {};",
			`for (let i = 0; i < ${MEMBERS}; i++) big["k" + i] = { v: i };`,
			"export function get() {",
			"\treturn big;",
			"}"
		].join("\n") + "\n"
	);
	writeFileSync(
		path.join(BASE, "reader", "reader.mjs"),
		['import { self } from "@cldmv/slothlet/runtime";', "export function v(key) {", "\treturn self.big.get()[key].v;", "}"].join("\n") +
			"\n"
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

describe.each([{ runtime: "async" }, { runtime: "live" }])("a cached value handed out in each new run window — $runtime", ({ runtime }) => {
	let api;

	afterEach(async () => {
		await api?.slothlet.shutdown();
		api = null;
	});

	it(`handing out an unchanged ${MEMBERS}-member value in ${WINDOWS} new windows copies nothing again`, async () => {
		api = await slothlet({ base: BASE, runtime, mode: "eager", silent: true });
		const big = await api.big.get();
		const baseline = snapshotCounts().versions;
		const holder = openRun(api);
		await holder.host(() => null);
		let started = performance.now();
		expect(await api.big.get()).toBe(big);
		const firstCopy = performance.now() - started;
		const saved = snapshotCounts().versions - baseline;
		expect(saved).toBeGreaterThan(MEMBERS);
		let again = 0;
		for (let window = 0; window < WINDOWS; window++) {
			const run = openRun(api);
			await run.host(() => null);
			started = performance.now();
			expect(await api.big.get()).toBe(big);
			again += performance.now() - started;
			// The versions saved for the holder answer this run too: nothing new is kept for it.
			expect(snapshotCounts().versions - baseline - saved).toBeLessThan(100);
			await run.close();
		}
		// Generous: every window copying the value again costs about WINDOWS first copies.
		expect(again).toBeLessThan(Math.max(WINDOWS * firstCopy * 0.6, 250));
		await holder.close();
		await settled();
		expect(snapshotCounts().versions).toBe(baseline);
	}, 120000);

	it("a member changed between windows is saved again, and every run reads the value as of its own start", async () => {
		api = await slothlet({ base: BASE, runtime, mode: "eager", silent: true });
		const big = await api.big.get();
		const first = openRun(api);
		await first.host(() => null);
		await api.big.get();
		// Changed by the host where slothlet does not see it, after the first run started and before the second.
		big.k6.v = -6;
		const second = openRun(api);
		await second.host(() => null);
		await api.big.get();
		// Changed again after the second run started, once the value was handed out in its window.
		big.k5.v = -5;
		big.k6.v = -66;
		const third = openRun(api);
		await third.host(() => null);
		const reads = (run) => run.host(async () => [await api.reader.v("k5"), await api.reader.v("k6"), await api.reader.v("k7")]);
		expect(await reads(first)).toEqual([5, 6, 7]);
		expect(await reads(second)).toEqual([5, -6, 7]);
		expect(await reads(third)).toEqual([-5, -66, 7]);
		expect([await api.reader.v("k5"), await api.reader.v("k6")]).toEqual([-5, -66]);
		await third.close();
		await second.close();
		await first.close();
	}, 120000);
});
