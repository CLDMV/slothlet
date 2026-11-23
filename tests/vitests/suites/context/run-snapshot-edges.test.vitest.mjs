/**
 *
 *	@Project: @cldmv/slothlet
 *	@Filename: /tests/vitests/suites/context/run-snapshot-edges.test.vitest.mjs
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
 * @fileoverview Two edges of a run's snapshot: a method of a class with `#private` fields that the instance replaces
 * after the run started, and a plain function's default prototype (holding only `constructor` at the start) that the
 * instance adds a member to after the start.
 *
 * @description
 * Every expected value is what plain JavaScript answers on a twin of the module's values as they were when the run
 * started, with what the run did itself applied in order. A `#private` class's methods run on the instance itself in a
 * run (its private fields are there), whichever version of the method the run reads.
 *
 * Fixture (written at run time): `api/data/data.mjs` exports the values and functions that change them as module code,
 * `api/probe/probe.mjs` runs named reads with its `self`.
 */
import path from "node:path";
import { mkdirSync, rmSync, writeFileSync } from "node:fs";
import { describe, it, expect, beforeAll, afterAll, afterEach } from "vitest";
import slothlet from "@cldmv/slothlet";

const ROOT = path.join(process.cwd(), "tmp", "run-snapshot-edges");
const BASE = path.join(ROOT, "api");

/**
 * The module's values. `Counter.swap()` replaces `inc` on the prototype with a method that also reaches the private
 * field, from inside the class body.
 * @type {string}
 */
const DATA_SOURCE = `
export class Counter {
	#hits = 0;
	inc() {
		return ++this.#hits;
	}
	hits() {
		return this.#hits;
	}
	static swap() {
		Counter.prototype.inc = function () {
			this.#hits += 100;
			return this.#hits;
		};
	}
}
export const counter = new Counter();
export function swapInc() {
	Counter.swap();
}
export function ownInc() {
	counter.inc = function () {
		return -1;
	};
}
export function Thing() {
	this.made = 1;
}
export function extendThing() {
	Thing.prototype.extra = 1;
}
`;

/**
 * The reads the probe runs with its `self`, by name.
 * @type {string}
 */
const PROBE_SOURCE = `
import { self } from "@cldmv/slothlet/runtime";
const READS = {
	inc: () => self.data.counter.inc(),
	hits: () => self.data.counter.hits(),
	extra: () => self.data.Thing.prototype.extra,
	hasExtra: () => "extra" in self.data.Thing.prototype,
	keys: () => Object.keys(self.data.Thing.prototype),
	madeExtra: () => new self.data.Thing().extra,
	made: () => new self.data.Thing().made
};
export function read(name) {
	return READS[name]();
}
`;

beforeAll(() => {
	rmSync(ROOT, { recursive: true, force: true });
	for (const dir of ["data", "probe"]) mkdirSync(path.join(BASE, dir), { recursive: true });
	writeFileSync(path.join(BASE, "data", "data.mjs"), DATA_SOURCE);
	writeFileSync(path.join(BASE, "probe", "probe.mjs"), PROBE_SOURCE);
});

afterAll(() => {
	rmSync(ROOT, { recursive: true, force: true });
});

const CONFIGS = [];
for (const mode of ["eager", "lazy"])
	for (const runtime of ["async", "live"]) for (const permissions of ["off", "on"]) CONFIGS.push({ mode, runtime, permissions });

/**
 * Open a run that runs the probe's named reads on request, until closed.
 * @param {object} api - The api.
 * @returns {{read: function(string): Promise<*>, attempt: function(string): Promise<object>, close: function(): Promise<void>}} The run's handle.
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
				job.resolve({ value: await api.probe.read(job.name) });
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
	const attempt = (name) => new Promise((resolve) => push({ name, resolve }));
	return {
		attempt,
		read: (name) =>
			attempt(name).then((outcome) => {
				if ("threw" in outcome) throw new Error(`run read threw ${outcome.threw}: ${name}`);
				return outcome.value;
			}),
		close: async () => {
			push(null);
			await done;
		}
	};
}

/**
 * The slothlet options for a config.
 * @param {{mode: string, runtime: string, permissions: string}} config - The config.
 * @returns {object} The options.
 */
function optionsFor({ mode, runtime, permissions }) {
	return {
		base: BASE,
		mode,
		runtime,
		silent: true,
		...(permissions === "on" ? { permissions: { mode: "on", policy: "allow", rules: [] } } : {})
	};
}

describe.each(CONFIGS)("a run's snapshot edges — $mode / $runtime / permissions $permissions", (config) => {
	let api;

	afterEach(async () => {
		await api?.slothlet.shutdown();
		api = null;
	});

	/**
	 * Load the fixture, with the data module loaded.
	 * @returns {Promise<object>} The api.
	 */
	async function load() {
		api = await slothlet(optionsFor(config));
		await api.probe.read("hits");
		await api.probe.read("made");
		return api;
	}

	describe("a #private class's method replaced by the instance after the start", () => {
		it("on the class's prototype by module code: the run calls the method as of its start, on the instance", async () => {
			await load();
			const run = openRun(api);
			expect(await run.read("hits")).toBe(0);
			await api.data.swapInc();
			// Plain JS as of the start: the original `inc`, with the instance as `this`.
			expect(await run.attempt("inc")).toEqual({ value: 1 });
			expect(await run.read("hits")).toBe(1);
			await run.close();
			// The instance has the new method, and the private field the run's call changed.
			expect(await api.data.counter.inc()).toBe(101);
		});

		it("on the class's prototype by module code before the run first reads the instance", async () => {
			await load();
			const run = openRun(api);
			await api.data.swapInc();
			expect(await run.attempt("inc")).toEqual({ value: 1 });
			await run.close();
			expect(await api.data.counter.hits()).toBe(1);
		});

		it("on the class's prototype by the host through the tree: the run calls the method as of its start, on the instance", async () => {
			await load();
			const run = openRun(api);
			expect(await run.read("hits")).toBe(0);
			api.data.Counter.prototype.inc = function () {
				return -2;
			};
			expect(await run.attempt("inc")).toEqual({ value: 1 });
			await run.close();
			expect(await api.data.counter.inc()).toBe(-2);
			expect(await api.data.counter.hits()).toBe(1);
		});

		it("as the instance's own member by module code: the run calls the inherited method as of its start, on the instance", async () => {
			await load();
			const run = openRun(api);
			expect(await run.read("hits")).toBe(0);
			await api.data.ownInc();
			expect(await run.attempt("inc")).toEqual({ value: 1 });
			await run.close();
			expect(await api.data.counter.inc()).toBe(-1);
			expect(await api.data.counter.hits()).toBe(1);
		});

		it("as the instance's own member by the host through the tree: the run calls the inherited method, on the instance", async () => {
			await load();
			const run = openRun(api);
			expect(await run.read("hits")).toBe(0);
			api.data.counter.inc = function () {
				return -3;
			};
			expect(await run.attempt("inc")).toEqual({ value: 1 });
			await run.close();
			expect(await api.data.counter.inc()).toBe(-3);
			expect(await api.data.counter.hits()).toBe(1);
		});
	});

	describe("a plain function's default prototype the instance adds a member to after the start", () => {
		const READS = ["extra", "hasExtra", "keys", "madeExtra", "made"];
		// Plain JS as of the start: the default prototype holds only `constructor`.
		const START = [undefined, false, [], undefined, 1];

		/**
		 * Run every read of {@link READS} in the run.
		 * @param {ReturnType<typeof openRun>} run - The run.
		 * @returns {Promise<Array<*>>} The values.
		 */
		async function readAll(run) {
			const out = [];
			for (const name of READS) out.push(await run.read(name));
			return out;
		}

		it("by module code, after the run read it: the run reads it as of the start", async () => {
			await load();
			const run = openRun(api);
			expect(await readAll(run)).toEqual(START);
			await api.data.extendThing();
			expect(await readAll(run)).toEqual(START);
			await run.close();
			expect(api.data.Thing.prototype.extra).toBe(1);
		});

		it("by module code, before the run first reads it: the run reads it as of the start", async () => {
			await load();
			const run = openRun(api);
			await api.data.extendThing();
			expect(await readAll(run)).toEqual(START);
			await run.close();
			expect(new api.data.Thing().extra).toBe(1);
		});

		it("by the host through the tree: the run reads it as of the start", async () => {
			await load();
			const run = openRun(api);
			expect(await readAll(run)).toEqual(START);
			api.data.Thing.prototype.extra = 1;
			expect(await readAll(run)).toEqual(START);
			await run.close();
			expect(api.data.Thing.prototype.extra).toBe(1);
		});

		it("a run opened after the change reads the member", async () => {
			await load();
			await api.data.extendThing();
			const run = openRun(api);
			expect(await readAll(run)).toEqual([1, true, ["extra"], 1, 1]);
			await run.close();
		});
	});
});
