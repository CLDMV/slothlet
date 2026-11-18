/**
 *
 *	@Project: @cldmv/slothlet
 *	@Filename: /tests/vitests/suites/core/run-copy-teardown.test.vitest.mjs
 *	@Date: 2026-11-17T20:11:44-08:00 (1794975104)
 *	@Author: Nate Corcoran <CLDMV>
 *	@Email: <Shinrai@users.noreply.github.com>
 *	-----
 *	@Last modified by: Nate Corcoran <CLDMV> (Shinrai@users.noreply.github.com)
 *	@Last modified time: 2026-11-17T20:35:16-08:00 (1794976516)
 *	-----
 *	@Copyright: Copyright (c) 2013-2026 Catalyzed Motivation Inc. All rights reserved.
 *
 */

/**
 * @fileoverview A `run()` / `scope()`'s copy of the instance lives while the run's callback has not settled and while
 * work the run began is still to finish: a timer, an interval, a promise, a listener on an emitter or an `EventTarget`,
 * a Node callback. Once all of it has finished the copy is torn down, on a later macrotask, and the instance reads its
 * own fields directly again. What a run hands out through the runtime `context` export does not keep it. `shutdown()`
 * tears down whatever is left. A lazy node of a copy a run keeps across a reload loads as that copy did.
 *
 * Fixture (written at run time): `calls/calls.mjs` and `other/other.mjs`, whose leaves answer the stamp
 * `shared/stamp.mjs` took when the instance's copy of it loaded (outside the api tree, one copy per instance ID).
 */
import path from "node:path";
import { EventEmitter } from "node:events";
import { mkdirSync, rmSync, writeFileSync } from "node:fs";
import { stat } from "node:fs";
import { describe, it, expect, beforeAll, afterAll, afterEach } from "vitest";
import slothlet from "@cldmv/slothlet";
import { runCopyCounts } from "#helpers/flow-stores";

const ROOT = path.join(process.cwd(), "tmp", "run-copy-teardown");
const BASE = path.join(ROOT, "api");
const STAMP = Symbol.for("slothlet.test.run-copy-teardown.stamp");

beforeAll(() => {
	rmSync(ROOT, { recursive: true, force: true });
	mkdirSync(path.join(BASE, "calls"), { recursive: true });
	mkdirSync(path.join(BASE, "other"), { recursive: true });
	mkdirSync(path.join(ROOT, "shared"), { recursive: true });
	writeFileSync(
		path.join(ROOT, "shared", "stamp.mjs"),
		'export const stamp = globalThis[Symbol.for("slothlet.test.run-copy-teardown.stamp")];\n'
	);
	const leaf = 'import { stamp } from "../../shared/stamp.mjs";\nexport function copyOf() {\n\treturn stamp;\n}\n';
	writeFileSync(path.join(BASE, "calls", "calls.mjs"), leaf);
	writeFileSync(path.join(BASE, "other", "other.mjs"), leaf);
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

describe.each([["async"], ["live"]])("a run's copy is torn down once the run and its work have finished — %s runtime", (runtime) => {
	describe.each([["none"], ["off"], ["on"]])("permissions %s", (mode) => {
		/**
		 * Make an instance.
		 * @param {object} [config] - More config.
		 * @returns {Promise<object>} The api.
		 */
		async function make(config = {}) {
			globalThis[STAMP] = 1;
			return slothlet({ base: BASE, runtime, mode: "eager", silent: true, ...(mode === "none" ? {} : { permissions: mode }), ...config });
		}

		/**
		 * The global metadata tag the calling code sees.
		 * @param {object} api - The api.
		 * @returns {*} The tag.
		 */
		function tag(api) {
			return api.slothlet.metadata.get(api.calls.copyOf).tag ?? null;
		}

		it("a run that forks and leaves no work is torn down; the instance reads its own fields directly again", async () => {
			const api = await make();
			try {
				expect(runCopyCounts()).toEqual(BASELINE);
				await api.slothlet.context.run({}, async () => {
					api.slothlet.metadata.global("tag", "run");
					await null;
					expect(tag(api)).toBe("run");
				});
				// Torn down when the instance is idle, not as the callback settles.
				expect(runCopyCounts()).toMatchObject({ runs: 0, held: 1 });
				await idle();
				expect(runCopyCounts()).toEqual(BASELINE);
				expect(tag(api)).toBe(null);
				expect(api.calls.copyOf()).toBe(1);
			} finally {
				await api.slothlet.shutdown();
			}
		});

		it("a pending timer keeps the copy, and runs on it; the copy goes once it has fired", async () => {
			const api = await make();
			try {
				const fired = gate();
				await api.slothlet.context.run({}, () => {
					api.slothlet.metadata.global("tag", "run");
					setTimeout(() => fired.release(tag(api)), 20);
				});
				await idle();
				expect(runCopyCounts()).toMatchObject({ runs: 1, held: 1 });
				expect(await fired.promise).toBe("run");
				await idle();
				expect(runCopyCounts()).toEqual(BASELINE);
			} finally {
				await api.slothlet.shutdown();
			}
		});

		it("a cleared timer or interval no longer keeps the copy", async () => {
			const api = await make();
			try {
				let timer;
				let interval;
				await api.slothlet.context.run({}, () => {
					api.slothlet.metadata.global("tag", "run");
					timer = setTimeout(() => {}, 60_000);
					interval = setInterval(() => {}, 5);
				});
				await new Promise((resolve) => setTimeout(resolve, 20));
				await idle();
				expect(runCopyCounts()).toMatchObject({ runs: 1, held: 1 });
				clearTimeout(timer);
				await idle();
				expect(runCopyCounts()).toMatchObject({ runs: 1, held: 1 });
				clearInterval(interval);
				await idle();
				expect(runCopyCounts()).toEqual(BASELINE);
			} finally {
				await api.slothlet.shutdown();
			}
		});

		it("work the run's last piece of work begins while it runs keeps the copy too", async () => {
			const api = await make();
			try {
				const fired = gate();
				await api.slothlet.context.run({}, () => {
					api.slothlet.metadata.global("tag", "run");
					const interval = setInterval(() => {
						clearInterval(interval);
						setTimeout(() => fired.release(tag(api)), 20);
					}, 5);
				});
				expect(await fired.promise).toBe("run");
				await idle();
				expect(runCopyCounts()).toEqual(BASELINE);
			} finally {
				await api.slothlet.shutdown();
			}
		});

		it("a pending promise keeps the copy until it settles", async () => {
			const api = await make();
			try {
				const hold = gate();
				const seen = gate();
				await api.slothlet.context.run({}, () => {
					api.slothlet.metadata.global("tag", "run");
					hold.promise.then(() => seen.release(tag(api)));
				});
				await idle();
				expect(runCopyCounts()).toMatchObject({ runs: 1, held: 1 });
				hold.release();
				expect(await seen.promise).toBe("run");
				await idle();
				expect(runCopyCounts()).toEqual(BASELINE);
			} finally {
				await api.slothlet.shutdown();
			}
		});

		it("a listener keeps the copy until it is taken off its emitter or target; a once listener until it has run", async () => {
			const api = await make();
			try {
				const emitter = new EventEmitter();
				const target = new EventTarget();
				const heard = [];
				const onPing = () => heard.push(tag(api));
				const onPong = () => heard.push(`target:${tag(api)}`);
				await api.slothlet.context.run({}, () => {
					api.slothlet.metadata.global("tag", "run");
					emitter.on("ping", onPing);
					emitter.once("once", onPing);
					target.addEventListener("pong", onPong);
				});
				await idle();
				expect(runCopyCounts()).toMatchObject({ runs: 1, held: 1 });
				emitter.emit("ping");
				emitter.emit("once");
				target.dispatchEvent(new Event("pong"));
				emitter.off("ping", onPing);
				await idle();
				expect(runCopyCounts()).toMatchObject({ runs: 1, held: 1 });
				target.removeEventListener("pong", onPong);
				await idle();
				expect(heard).toEqual(["run", "run", "target:run"]);
				expect(runCopyCounts()).toEqual(BASELINE);
			} finally {
				await api.slothlet.shutdown();
			}
		});

		it("a Node callback keeps the copy until it has been called", async () => {
			const api = await make();
			try {
				const called = gate();
				await api.slothlet.context.run({}, () => {
					api.slothlet.metadata.global("tag", "run");
					stat(ROOT, () => called.release(tag(api)));
				});
				expect(await called.promise).toBe("run");
				await idle();
				expect(runCopyCounts()).toEqual(BASELINE);
			} finally {
				await api.slothlet.shutdown();
			}
		});

		it("what a run hands out through context does not keep its copy; reached later it answers as the instance", async () => {
			let handed = null;
			const api = await make({ context: { outbox: (fn) => (handed = fn) } });
			try {
				await api.slothlet.context.run({}, async () => {
					api.slothlet.metadata.global("tag", "run");
					const made = Promise.resolve("made in the run");
					api.slothlet.context.get().outbox(async () => [await made, tag(api)]);
				});
				await idle();
				expect(runCopyCounts()).toEqual(BASELINE);
				api.slothlet.metadata.global("tag", "instance");
				expect(await handed()).toEqual(["made in the run", "instance"]);
				await idle();
				expect(runCopyCounts()).toEqual(BASELINE);
			} finally {
				await api.slothlet.shutdown();
			}
		});

		it("shutdown() tears down a copy that work which never finishes keeps", async () => {
			const api = await make();
			const emitter = new EventEmitter();
			await api.slothlet.context.run({}, () => {
				api.slothlet.metadata.global("tag", "run");
				emitter.on("never", () => {});
			});
			await idle();
			expect(runCopyCounts()).toMatchObject({ runs: 1, held: 1, readThrough: 1 });
			await api.slothlet.shutdown();
			expect(runCopyCounts()).toEqual(BASELINE);
			emitter.removeAllListeners();
			expect(runCopyCounts()).toEqual(BASELINE);
		});

		it("a nested run's work keeps its copy; the parent's goes once the parent's own work is done", async () => {
			const api = await make();
			try {
				const fired = gate();
				await api.slothlet.context.run({}, async () => {
					api.slothlet.metadata.global("tag", "outer");
					await api.slothlet.context.run({}, () => {
						api.slothlet.metadata.global("tag", "inner");
						setTimeout(() => fired.release(tag(api)), 20);
					});
				});
				await idle();
				expect(runCopyCounts()).toMatchObject({ runs: 1, held: 1 });
				expect(await fired.promise).toBe("inner");
				await idle();
				expect(runCopyCounts()).toEqual(BASELINE);
			} finally {
				await api.slothlet.shutdown();
			}
		});
	});

	it("in lazy mode, a node a run keeps across a reload loads as the old copy did; the old ID goes with the copy", async () => {
		globalThis[STAMP] = 1;
		const api = await slothlet({ base: BASE, runtime, mode: "lazy", silent: true });
		try {
			const inside = gate();
			const step = gate();
			const result = api.slothlet.context.run({}, async () => {
				const calls = await api.calls.copyOf();
				inside.release();
				await step.promise;
				// `other` was never loaded by the old copy: it loads now under the old copy's ID, which shares its stamp.
				return { calls, other: await api.other.copyOf() };
			});
			await inside.promise;
			globalThis[STAMP] = 2;
			await api.slothlet.reload();
			expect(await api.calls.copyOf()).toBe(2);
			step.release();
			expect(await result).toEqual({ calls: 1, other: 1 });
			await idle();
			expect(runCopyCounts()).toEqual(BASELINE);
			expect(await api.other.copyOf()).toBe(2);
		} finally {
			await api.slothlet.shutdown();
		}
	});
});
