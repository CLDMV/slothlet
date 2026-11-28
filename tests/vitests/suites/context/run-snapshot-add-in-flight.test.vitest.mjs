/**
 *
 *	@Project: @cldmv/slothlet
 *	@Filename: tests/vitests/suites/context/run-snapshot-add-in-flight.test.vitest.mjs
 *	@Date: 2026-11-22T00:00:00-08:00 (1795334400)
 *	@Author: Nate Corcoran <CLDMV>
 *	@Email: <Shinrai@users.noreply.github.com>
 *	-----
 *	@Last modified by: Nate Corcoran <CLDMV> (Shinrai@users.noreply.github.com)
 *	@Last modified time: 2026-11-28T04:31:31-08:00 (1795869091)
 *	-----
 *	@Copyright: Copyright (c) 2013-2026 Catalyzed Motivation Inc. All rights reserved.
 *
 */

/**
 * @fileoverview A run opened while an instance `add()` is still loading reads the instance as of its start: the module
 * the add mounts afterwards never appears in it.
 *
 * @description
 * A run reads a snapshot of the instance as it was when the run started. The expected values are what a plain object
 * copied at the run's start answers: a member the instance gains later is not in the copy, and one it drops later is
 * still there. A run opened after the add resolved has the module.
 *
 * Fixture (written at run time): `api/probe/probe.mjs` reads `self.slow` by name; `slow/thing.mjs` is the added
 * module and, when a gate is set, waits on it while it loads (a top-level await).
 */
import path from "node:path";
import { mkdirSync, rmSync, writeFileSync } from "node:fs";
import { describe, it, expect, beforeAll, afterAll, afterEach } from "vitest";
import slothlet from "@cldmv/slothlet";

const ROOT = path.join(process.cwd(), "tmp", "run-snapshot-add-in-flight");
const BASE = path.join(ROOT, "api");
const SLOW = path.join(ROOT, "slow");
const GATE = "__slothletRunAddInFlightGate";

const PROBE_SOURCE = `
import { self } from "@cldmv/slothlet/runtime";
export function read() {
	return { self: typeof self.slow, hello: typeof self.slow?.thing?.hello };
}
`;

const SLOW_SOURCE = `
const gate = globalThis.${GATE};
if (gate) {
	gate.started();
	await gate.wait;
}
export function hello() {
	return "hello";
}
`;

beforeAll(() => {
	rmSync(ROOT, { recursive: true, force: true });
	mkdirSync(path.join(BASE, "probe"), { recursive: true });
	mkdirSync(SLOW, { recursive: true });
	writeFileSync(path.join(BASE, "probe", "probe.mjs"), PROBE_SOURCE);
	writeFileSync(path.join(SLOW, "thing.mjs"), SLOW_SOURCE);
});

afterAll(() => {
	delete globalThis[GATE];
	rmSync(ROOT, { recursive: true, force: true });
});

const CONFIGS = [];
for (const mode of ["eager", "lazy"])
	for (const runtime of ["async", "live"]) for (const permissions of ["none", "on"]) CONFIGS.push({ mode, runtime, permissions });

/**
 * A gate the added module waits on while it loads.
 * @returns {{started: Promise<void>, open: function(): void}} The gate.
 */
function closeGate() {
	let started;
	let open;
	const gate = {
		started: new Promise((resolve) => {
			started = resolve;
		}),
		open: () => open()
	};
	globalThis[GATE] = {
		started: () => started(),
		wait: new Promise((resolve) => {
			open = resolve;
		})
	};
	return gate;
}

/**
 * Open a run that reads, on request, what it sees of `slow` through the probe's `self`. (The host's `api` is the
 * instance in a run too, so a read through it is not the run's.)
 * @param {object} api - The api.
 * @returns {{read: function(): Promise<object>, close: function(): Promise<void>}} The run's handle.
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
				job.resolve(await api.probe.read());
			} catch (error) {
				job.resolve({ threw: `${error?.code ?? error?.name} ${error?.message}` });
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
		read: () => new Promise((resolve) => push({ resolve })),
		close: async () => {
			push(null);
			await done;
		}
	};
}

const ABSENT = { self: "undefined", hello: "undefined" };
const PRESENT = { self: "object", hello: "function" };

describe.each(CONFIGS)(
	"a run opened while an instance add() loads — $mode / $runtime / permissions $permissions",
	({ mode, runtime, permissions }) => {
		let api;

		afterEach(async () => {
			delete globalThis[GATE];
			await api?.slothlet.shutdown();
			api = null;
		});

		/**
		 * Load the instance.
		 * @returns {Promise<object>} The api.
		 */
		async function load() {
			delete globalThis[GATE];
			api = await slothlet({
				base: BASE,
				mode,
				runtime,
				silent: true,
				...(permissions === "on" ? { permissions: { mode: "on", policy: "allow", rules: [] } } : {})
			});
			await api.probe.read();
			return api;
		}

		it("a run opened right after add() was called never sees the module appear", async () => {
			await load();
			const gate = closeGate();
			const adding = api.slothlet.api.add("slow", SLOW);
			const run = openRun(api);
			expect(await run.read()).toEqual(ABSENT);
			await Promise.race([gate.started, adding]);
			gate.open();
			await adding;
			expect(typeof api.slow).toBe("object");
			expect(await api.slow.thing.hello()).toBe("hello");
			expect(await run.read()).toEqual(ABSENT);
			await run.close();
		});

		it("a run opened while the added file is loading never sees the module appear", async () => {
			await load();
			const gate = closeGate();
			let added = false;
			const adding = api.slothlet.api.add("slow", SLOW).then(() => {
				added = true;
			});
			await gate.started;
			expect(added).toBe(false);
			const run = openRun(api);
			expect(await run.read()).toEqual(ABSENT);
			gate.open();
			await adding;
			expect(await api.slow.thing.hello()).toBe("hello");
			expect(await run.read()).toEqual(ABSENT);
			await run.close();
		});

		it("a run opened before an instance remove() keeps the module at the root", async () => {
			await load();
			await api.slothlet.api.add("slow", SLOW);
			const run = openRun(api);
			expect(await run.read()).toEqual(PRESENT);
			await api.slothlet.api.remove("slow");
			expect(typeof api.slow).toBe("undefined");
			expect(await run.read()).toMatchObject({ self: "object" });
			await run.close();
		});

		it("a run opened after add() resolved has the module", async () => {
			await load();
			const gate = closeGate();
			const adding = api.slothlet.api.add("slow", SLOW);
			await Promise.race([gate.started, adding]);
			gate.open();
			await adding;
			const run = openRun(api);
			expect(await run.read()).toEqual(PRESENT);
			await run.close();
		});
	}
);
