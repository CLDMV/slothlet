/**
 *
 *	@Project: @cldmv/slothlet
 *	@Filename: /tests/vitests/suites/context/run-snapshot-deep.test.vitest.mjs
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
 * @fileoverview A value the instance hands out while a `run()` is open is saved for the run however deep it is: a call
 * returning a linked list tens of thousands of nodes long works the same with a run open as without one, and the run
 * reads the list as it was when it started.
 *
 * @description
 * Plain JS is the reference: returning a deep structure needs no stack of its own, and a run that started before the
 * instance changed the list's last node reads the value that node had at the run's start.
 *
 * Fixture (written at run time): `list/list.mjs`, `get()` (the head of a {@link DEPTH}-node list) and `setTail(v)`;
 * `reader/reader.mjs`, `tail()` (walks `self.list.get()` to its last node).
 */
import path from "node:path";
import { mkdirSync, rmSync, writeFileSync } from "node:fs";
import { describe, it, expect, beforeAll, afterAll, afterEach } from "vitest";
import slothlet from "@cldmv/slothlet";
import { snapshotCounts } from "#helpers/run-snapshot";

const ROOT = path.join(process.cwd(), "tmp", "run-snapshot-deep");
const BASE = path.join(ROOT, "api");

/**
 * How many nodes the list has: far deeper than a call stack holds frames.
 * @type {number}
 */
const DEPTH = 50000;

beforeAll(() => {
	rmSync(ROOT, { recursive: true, force: true });
	mkdirSync(path.join(BASE, "list"), { recursive: true });
	mkdirSync(path.join(BASE, "reader"), { recursive: true });
	writeFileSync(
		path.join(BASE, "list", "list.mjs"),
		[
			"let head = null;",
			"let last = null;",
			`for (let i = 0; i < ${DEPTH}; i++) {`,
			"\thead = { i, next: head };",
			"\tif (last === null) last = head;",
			"}",
			"export function get() {",
			"\treturn head;",
			"}",
			"export function setTail(v) {",
			"\tlast.i = v;",
			"\treturn v;",
			"}"
		].join("\n") + "\n"
	);
	writeFileSync(
		path.join(BASE, "reader", "reader.mjs"),
		[
			'import { self } from "@cldmv/slothlet/runtime";',
			"export function tail() {",
			"\tlet node = self.list.get();",
			"\tlet steps = 0;",
			"\twhile (node.next !== null) {",
			"\t\tnode = node.next;",
			"\t\tsteps++;",
			"\t}",
			"\treturn [steps, node.i];",
			"}"
		].join("\n") + "\n"
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
for (const mode of ["eager", "lazy"]) for (const runtime of ["async", "live"]) CONFIGS.push({ mode, runtime });

describe.each(CONFIGS)("a deep value handed out while a run is open — $mode / $runtime", ({ mode, runtime }) => {
	let api;

	afterEach(async () => {
		await api?.slothlet.shutdown();
		api = null;
	});

	it("a host call returning a deep linked list works with a run open, and the run reads it as of its start", async () => {
		api = await slothlet({ base: BASE, runtime, mode, silent: true });
		const plain = await api.list.get();
		expect(plain.i).toBe(DEPTH - 1);
		const baseline = snapshotCounts().versions;
		const run = openRun(api);
		await run.host(() => null);
		const head = await api.list.get();
		expect(head).toBe(plain);
		expect(await api.list.setTail(-1)).toBe(-1);
		// Plain JS: the run started before the change and reads the last node as it was then.
		expect(await run.host(() => api.reader.tail())).toEqual([DEPTH - 1, 0]);
		expect(await api.reader.tail()).toEqual([DEPTH - 1, -1]);
		await run.close();
		await settled();
		expect(snapshotCounts().versions).toBe(baseline);
	}, 60000);
});
