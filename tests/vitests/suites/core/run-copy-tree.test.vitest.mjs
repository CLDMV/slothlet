/**
 *
 *	@Project: @cldmv/slothlet
 *	@Filename: tests/vitests/suites/core/run-copy-tree.test.vitest.mjs
 *	@Date: 2026-11-17T21:18:28-08:00 (1794979108)
 *	@Author: Nate Corcoran <CLDMV>
 *	@Email: <Shinrai@users.noreply.github.com>
 *	-----
 *	@Last modified by: Nate Corcoran <CLDMV> (Shinrai@users.noreply.github.com)
 *	@Last modified time: 2026-11-28T04:31:42-08:00 (1795869102)
 *	-----
 *	@Copyright: Copyright (c) 2013-2026 Catalyzed Motivation Inc. All rights reserved.
 *
 */

/**
 * @fileoverview A `run()` / `scope()` changes an api tree of its own. `api.slothlet.api.add()` / `remove()` / `reload()`,
 * and what code writes into the tree once the run has its own, change the run's tree only: the instance, sibling runs
 * and a run opened in it before the change never see it, and what the instance changes after the run started never
 * reaches the run. A nested run starts from its parent's tree. `reload()`, `restart()` and `shutdown()` called in a run
 * rebuild, start over or shut down the run's copy and leave the instance as it is. A run open across an instance
 * restart keeps its tree, its handlers and its modules. The copy uses the modules the copied tree uses, so module state
 * is shared, as a shallow copy shares what it holds. A run's tree, and every module mounted only in it, is torn down
 * once the run and its work have finished.
 *
 * Fixture (written at run time): `calls/calls.mjs`, whose `stamp()` answers the value `globalThis[STAMP]` held when the
 * file loaded and whose `bump()` counts in module state; `data/data.mjs` (a data member `n`); `extra/extra.mjs` to add.
 */
import path from "node:path";
import { mkdirSync, rmSync, writeFileSync } from "node:fs";
import { describe, it, expect, beforeAll, afterAll, afterEach } from "vitest";
import slothlet from "@cldmv/slothlet";
import { runCopyCounts } from "#helpers/flow-stores";

const ROOT = path.join(process.cwd(), "tmp", "run-copy-tree");
const BASE = path.join(ROOT, "api");
const EXTRA = path.join(ROOT, "extra");
const STAMP = Symbol.for("slothlet.test.run-copy-tree.stamp");

beforeAll(() => {
	rmSync(ROOT, { recursive: true, force: true });
	mkdirSync(path.join(BASE, "calls"), { recursive: true });
	mkdirSync(path.join(BASE, "data"), { recursive: true });
	mkdirSync(EXTRA, { recursive: true });
	writeFileSync(
		path.join(BASE, "calls", "calls.mjs"),
		[
			'import { self } from "@cldmv/slothlet/runtime";',
			'const stamped = globalThis[Symbol.for("slothlet.test.run-copy-tree.stamp")];',
			"let count = 0;",
			"export function stamp() {",
			"\treturn stamped;",
			"}",
			"export function bump() {",
			"\treturn ++count;",
			"}",
			"export function extraVia() {",
			"\treturn typeof self.extra?.hello === 'function' ? self.extra.hello() : null;",
			"}",
			"export function setSelfN(value) {",
			"\tself.data.n = value;",
			"\treturn self.data.n;",
			"}",
			""
		].join("\n")
	);
	writeFileSync(path.join(BASE, "data", "data.mjs"), "export const n = 1;\n");
	writeFileSync(path.join(EXTRA, "extra.mjs"), 'export function hello() {\n\treturn "hello";\n}\n');
});

afterAll(() => {
	rmSync(ROOT, { recursive: true, force: true });
});

afterEach(() => {
	delete globalThis[STAMP];
});

/**
 * A promise with its resolve function.
 * @returns {{promise: Promise<*>, release: Function}} The gate.
 */
function gate() {
	let release;
	const promise = new Promise((resolve) => {
		release = resolve;
	});
	return { promise, release };
}

/**
 * Let a few macrotasks pass: a run's copy is torn down on one once the run's work has finished.
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

describe.each([["async"], ["live"]])("a run changes an api tree of its own — %s runtime", (runtime) => {
	describe.each([["none"], ["off"], ["on"]])("permissions %s", (mode) => {
		describe.each([["eager"], ["lazy"]])("%s mode", (loadMode) => {
			/**
			 * Make an instance whose files load with `globalThis[STAMP]` set to 1.
			 * @returns {Promise<object>} The api.
			 */
			async function make() {
				globalThis[STAMP] = 1;
				return slothlet({ base: BASE, runtime, mode: loadMode, silent: true, ...(mode === "none" ? {} : { permissions: mode }) });
			}

			it("a module a run adds is the run's alone, and goes with the run", async () => {
				const api = await make();
				try {
					const entered = gate();
					const go = gate();
					const run = api.slothlet.context.run({ user: "r" }, async () => {
						await api.slothlet.api.add("extra", EXTRA, { id: "extra" });
						entered.release();
						await go.promise;
						return { hello: await api.extra.hello(), viaSelf: await api.calls.extraVia() };
					});
					await entered.promise;
					expect(api.extra).toBeUndefined();
					expect(await api.calls.extraVia()).toBe(null);
					const sibling = await api.slothlet.context.run({ user: "s" }, async () => typeof api.extra);
					expect(sibling).toBe("undefined");
					go.release();
					expect(await run).toEqual({ hello: "hello", viaSelf: "hello" });
					await idle();
					expect(runCopyCounts()).toEqual(BASELINE);
					expect(api.extra).toBeUndefined();
				} finally {
					await api.slothlet.shutdown();
				}
			});

			it("a removal in a run leaves the instance's tree as it was", async () => {
				const api = await make();
				try {
					const inside = await api.slothlet.context.run({ user: "r" }, async () => {
						await api.slothlet.api.remove("data");
						return typeof api.data;
					});
					expect(inside).toBe("undefined");
					expect(api.data).toBeDefined();
					expect(await api.calls.bump()).toBe(1);
				} finally {
					await api.slothlet.shutdown();
				}
			});

			it("what the instance adds after a run started does not reach it", async () => {
				const api = await make();
				try {
					const entered = gate();
					const go = gate();
					const run = api.slothlet.context.run({ user: "r" }, async () => {
						entered.release();
						await go.promise;
						return { extra: typeof api.extra, viaSelf: await api.calls.extraVia() };
					});
					await entered.promise;
					await api.slothlet.api.add("extra", EXTRA, { id: "extra" });
					expect(await api.extra.hello()).toBe("hello");
					go.release();
					expect(await run).toEqual({ extra: "undefined", viaSelf: null });
				} finally {
					await api.slothlet.shutdown();
				}
			});

			it("a nested run starts from its parent's tree, and neither one's later changes reach the other", async () => {
				const api = await make();
				try {
					const result = await api.slothlet.context.run({ user: "p" }, async () => {
						await api.slothlet.api.add("extra", EXTRA, { id: "extra" });
						const entered = gate();
						const go = gate();
						const nested = api.slothlet.context.run({ user: "n" }, async () => {
							await api.slothlet.api.remove("data");
							entered.release();
							await go.promise;
							return { started: api.extra !== undefined, data: api.data !== undefined, again: api.again !== undefined };
						});
						await entered.promise;
						await api.slothlet.api.add("again", EXTRA, { id: "again" });
						const parent = { data: api.data !== undefined, again: api.again !== undefined };
						go.release();
						return { parent, nested: await nested };
					});
					expect(result.parent).toEqual({ data: true, again: true });
					expect(result.nested).toEqual({ started: true, data: false, again: false });
					expect(api.extra).toBeUndefined();
					expect(api.again).toBeUndefined();
				} finally {
					await api.slothlet.shutdown();
				}
			});

			it("the copy uses the modules the instance uses: module state is shared", async () => {
				const api = await make();
				try {
					expect(await api.calls.bump()).toBe(1);
					const inside = await api.slothlet.context.run({ user: "r" }, async () => {
						await api.slothlet.api.add("extra", EXTRA, { id: "extra" });
						return { bump: await api.calls.bump(), stamp: await api.calls.stamp() };
					});
					expect(inside).toEqual({ bump: 2, stamp: 1 });
					expect(await api.calls.bump()).toBe(3);
				} finally {
					await api.slothlet.shutdown();
				}
			});

			it("a node read before the run changed its tree answers from the run's tree", async () => {
				const api = await make();
				try {
					const inside = await api.slothlet.context.run({ user: "r" }, async () => {
						const calls = api.calls;
						await api.slothlet.api.add("extra", EXTRA, { id: "extra" });
						return await calls.extraVia();
					});
					expect(inside).toBe("hello");
				} finally {
					await api.slothlet.shutdown();
				}
			});

			it("a write through self in a run that has its own tree stays in the run", async () => {
				const api = await make();
				try {
					const inside = await api.slothlet.context.run({ user: "r" }, async () => {
						await api.slothlet.api.add("extra", EXTRA, { id: "extra" });
						return { written: await api.calls.setSelfN(5), read: await api.data.n };
					});
					expect(inside).toEqual({ written: 5, read: 5 });
					expect(await api.data.n).toBe(1);
				} finally {
					await api.slothlet.shutdown();
				}
			});

			it("reload() in a run rebuilds the run's tree from disk and leaves the instance as it is", async () => {
				const api = await make();
				try {
					// Loaded now: a lazy node the instance has not loaded yet loads the file as it is when first reached.
					expect(await api.calls.stamp()).toBe(1);
					globalThis[STAMP] = 2;
					const inside = await api.slothlet.context.run({ user: "r" }, async () => {
						await api.slothlet.reload();
						return { stamp: await api.calls.stamp(), bump: await api.calls.bump() };
					});
					expect(inside).toEqual({ stamp: 2, bump: 1 });
					expect(await api.calls.stamp()).toBe(1);
					await idle();
					expect(runCopyCounts()).toEqual(BASELINE);
				} finally {
					await api.slothlet.shutdown();
				}
			});

			it("restart() in a run starts the run's copy over and leaves the instance as it is", async () => {
				const api = await make();
				try {
					await api.slothlet.api.add("extra", EXTRA, { id: "extra" });
					expect(await api.calls.bump()).toBe(1);
					globalThis[STAMP] = 3;
					const inside = await api.slothlet.context.run({ user: "r" }, async () => {
						await api.slothlet.restart();
						return { stamp: await api.calls.stamp(), bump: await api.calls.bump(), extra: typeof api.extra };
					});
					expect(inside).toEqual({ stamp: 3, bump: 1, extra: "undefined" });
					expect(await api.calls.stamp()).toBe(1);
					expect(await api.calls.bump()).toBe(2);
					expect(await api.extra.hello()).toBe("hello");
				} finally {
					await api.slothlet.shutdown();
				}
			});

			it("shutdown() in a run shuts down the run's copy only", async () => {
				const api = await make();
				try {
					await api.slothlet.context.run({ user: "r" }, async () => {
						await api.slothlet.shutdown();
					});
					expect(await api.calls.bump()).toBe(1);
					// The instance is still loaded: it takes a module as it did before.
					await api.slothlet.api.add("extra", EXTRA, { id: "extra" });
					expect(await api.extra.hello()).toBe("hello");
				} finally {
					await api.slothlet.shutdown();
				}
			});

			it("a run open across an instance restart keeps its tree and its modules", async () => {
				const api = await make();
				try {
					const entered = gate();
					const go = gate();
					const run = api.slothlet.context.run({ user: "r" }, async () => {
						const before = await api.calls.bump();
						entered.release();
						await go.promise;
						return { before, after: await api.calls.bump(), stamp: await api.calls.stamp() };
					});
					await entered.promise;
					globalThis[STAMP] = 4;
					await api.slothlet.restart();
					expect(await api.calls.stamp()).toBe(4);
					expect(await api.calls.bump()).toBe(1);
					go.release();
					expect(await run).toEqual({ before: 1, after: 2, stamp: 1 });
				} finally {
					await api.slothlet.shutdown();
				}
			});
		});
	});
});
