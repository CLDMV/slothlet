/**
 *
 *	@Project: @cldmv/slothlet
 *	@Filename: /tests/vitests/suites/core/run-copy-live-no-als.test.vitest.mjs
 *	@Date: 2026-11-21T15:12:44-08:00 (1795302764)
 *	@Author: Nate Corcoran <CLDMV>
 *	@Email: <Shinrai@users.noreply.github.com>
 *	-----
 *	@Last modified by: Nate Corcoran <CLDMV> (Shinrai@users.noreply.github.com)
 *	@Last modified time: 2026-11-21T16:32:05-08:00 (1795307525)
 *	-----
 *	@Copyright: Copyright (c) 2013-2026 Catalyzed Motivation Inc. All rights reserved.
 *
 */

/**
 * @fileoverview On the live runtime, `api.slothlet.api.add()` / `remove()`, `reload()`, `restart()` and `shutdown()`
 * asked for in a `run()` act on the run's copy, with `AsyncLocalStorage` and `AsyncResource` taken away from slothlet's
 * platform layer: the live runtime tells the run apart with its own flows, as it does a run's context and caller, so it
 * needs no `node:async_hooks` for it. Each is asked for synchronously in the run's callback, after an `await`, after an
 * `await` of a timer, and from a timer the run set; each time the instance is left as it was.
 *
 * Fixture (written at run time): `calls/calls.mjs`, whose `stamp()` answers the value `globalThis[STAMP]` held when the
 * file loaded and whose `bump()` counts in module state; `data/data.mjs` (a data member `n`); `extra/extra.mjs` to add.
 */
import path from "node:path";
import { mkdirSync, rmSync, writeFileSync } from "node:fs";
import { describe, it, expect, beforeAll, afterAll, afterEach, vi } from "vitest";
import slothlet from "@cldmv/slothlet";

vi.mock("#helpers/platform", async (importOriginal) => ({ ...(await importOriginal()), AsyncLocalStorage: null, AsyncResource: null }));

const ROOT = path.join(process.cwd(), "tmp", "run-copy-live-no-als");
const BASE = path.join(ROOT, "api");
const EXTRA = path.join(ROOT, "extra");
const STAMP = Symbol.for("slothlet.test.run-copy-live-no-als.stamp");

beforeAll(() => {
	rmSync(ROOT, { recursive: true, force: true });
	mkdirSync(path.join(BASE, "calls"), { recursive: true });
	mkdirSync(path.join(BASE, "data"), { recursive: true });
	mkdirSync(EXTRA, { recursive: true });
	writeFileSync(
		path.join(BASE, "calls", "calls.mjs"),
		[
			'const stamped = globalThis[Symbol.for("slothlet.test.run-copy-live-no-als.stamp")];',
			"let count = 0;",
			"export function stamp() {",
			"\treturn stamped;",
			"}",
			"export function bump() {",
			"\treturn ++count;",
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
 * The points in a run's callback an operation is asked for at.
 * @type {Array<[string, function(function(): Promise<*>): Promise<*>]>}
 */
const WHEN = [
	["synchronously", (op) => op()],
	[
		"after an await",
		async (op) => {
			await null;
			return op();
		}
	],
	[
		"after an await of a timer",
		async (op) => {
			await new Promise((resolve) => {
				setTimeout(resolve, 1);
			});
			return op();
		}
	],
	[
		"from a timer the run set",
		(op) =>
			new Promise((resolve, reject) => {
				setTimeout(() => {
					op().then(resolve, reject);
				}, 1);
			})
	]
];

describe.each([["off"], ["on"]])(
	"live runtime, no AsyncLocalStorage: operations asked for in a run act on the run's copy — permissions %s",
	(mode) => {
		describe.each([["eager"], ["lazy"]])("%s mode", (loadMode) => {
			/**
			 * Make an instance whose files load with `globalThis[STAMP]` set to 1.
			 * @returns {Promise<object>} The api.
			 */
			async function make() {
				globalThis[STAMP] = 1;
				return slothlet({ base: BASE, runtime: "live", mode: loadMode, silent: true, permissions: mode });
			}

			describe.each(WHEN)("%s", (_label, when) => {
				it("api.add() adds to the run's tree only", async () => {
					const api = await make();
					try {
						const inside = await api.slothlet.context.run({ user: "r" }, () =>
							when(async () => {
								await api.slothlet.api.add("extra", EXTRA, { id: "extra" });
								return api.extra.hello();
							})
						);
						expect(inside).toBe("hello");
						expect(api.extra).toBeUndefined();
					} finally {
						await api.slothlet.shutdown();
					}
				});

				it("api.remove() removes from the run's tree only", async () => {
					const api = await make();
					try {
						const inside = await api.slothlet.context.run({ user: "r" }, () =>
							when(async () => {
								await api.slothlet.api.remove("data");
								return typeof api.data;
							})
						);
						expect(inside).toBe("undefined");
						expect(api.data).toBeDefined();
					} finally {
						await api.slothlet.shutdown();
					}
				});

				it("reload() rebuilds the run's tree and leaves the instance as it is", async () => {
					const api = await make();
					try {
						expect(await api.calls.stamp()).toBe(1);
						globalThis[STAMP] = 2;
						const inside = await api.slothlet.context.run({ user: "r" }, () =>
							when(async () => {
								await api.slothlet.reload();
								return { stamp: await api.calls.stamp(), bump: await api.calls.bump() };
							})
						);
						expect(inside).toEqual({ stamp: 2, bump: 1 });
						expect(await api.calls.stamp()).toBe(1);
					} finally {
						await api.slothlet.shutdown();
					}
				});

				it("restart() starts the run's copy over and leaves the instance as it is", async () => {
					const api = await make();
					try {
						await api.slothlet.api.add("extra", EXTRA, { id: "extra" });
						expect(await api.calls.bump()).toBe(1);
						globalThis[STAMP] = 3;
						const inside = await api.slothlet.context.run({ user: "r" }, () =>
							when(async () => {
								await api.slothlet.restart();
								return { stamp: await api.calls.stamp(), bump: await api.calls.bump(), extra: typeof api.extra };
							})
						);
						expect(inside).toEqual({ stamp: 3, bump: 1, extra: "undefined" });
						expect(await api.calls.stamp()).toBe(1);
						expect(await api.calls.bump()).toBe(2);
						expect(await api.extra.hello()).toBe("hello");
					} finally {
						await api.slothlet.shutdown();
					}
				});

				it("shutdown() shuts down the run's copy only", async () => {
					const api = await make();
					try {
						await api.slothlet.context.run({ user: "r" }, () => when(() => api.slothlet.shutdown()));
						expect(await api.calls.bump()).toBe(1);
						await api.slothlet.api.add("extra", EXTRA, { id: "extra" });
						expect(await api.extra.hello()).toBe("hello");
					} finally {
						await api.slothlet.shutdown();
					}
				});
			});
		});
	}
);
