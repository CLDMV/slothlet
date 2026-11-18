/**
 *
 *	@Project: @cldmv/slothlet
 *	@Filename: /tests/vitests/suites/core/run-copy-teardown-boundaries.test.vitest.mjs
 *	@Date: 2026-11-17T20:47:29-08:00 (1794977249)
 *	@Author: Nate Corcoran <CLDMV>
 *	@Email: <Shinrai@users.noreply.github.com>
 *	-----
 *	@Last modified by: Nate Corcoran <CLDMV> (Shinrai@users.noreply.github.com)
 *	@Last modified time: 2026-11-17T21:06:17-08:00 (1794978377)
 *	-----
 *	@Copyright: Copyright (c) 2013-2026 Catalyzed Motivation Inc. All rights reserved.
 *
 */

/**
 * @fileoverview A `run()` / `scope()`'s copy of the instance is kept while work the run began through the less common
 * boundaries is pending, and torn down once that work has ended however it ends: a timer cleared through the clearing
 * functions `node:timers` exports, `close()` or `[Symbol.dispose]()`; an `EventTarget` listener taken off by its
 * `signal`; on the live runtime, an `on<event>` handler property until it is replaced or cleared, an observer from its
 * first `observe()` until it is disconnected or has nothing left to observe, and a `scheduler.postTask()` callback until
 * it has run or its signal aborted it.
 *
 * Fixture (written at run time): `calls/calls.mjs`, a leaf for the instance to load. `MutationObserver`,
 * `ResizeObserver` and `scheduler` are not Node globals: fakes stand in for them while this file runs, installed before
 * any instance patches the globals.
 */
import path from "node:path";
import { mkdirSync, rmSync, writeFileSync } from "node:fs";
import { createRequire } from "node:module";
import {
	clearTimeout as timersClearTimeout,
	clearInterval as timersClearInterval,
	clearImmediate as timersClearImmediate
} from "node:timers";
import { describe, it, expect, beforeAll, afterAll } from "vitest";
import slothlet from "@cldmv/slothlet";
import { runCopyCounts } from "#helpers/flow-stores";

const ROOT = path.join(process.cwd(), "tmp", "run-copy-teardown-boundaries");
const BASE = path.join(ROOT, "api");

/**
 * The host's own timers, taken before any instance patches the globals: the fakes below schedule with these, so their
 * own scheduling is no run's work.
 */
const rawSetTimeout = globalThis.setTimeout;
const rawClearTimeout = globalThis.clearTimeout;

/**
 * A stand-in observer: records what it observes, and calls its callback when the test says so.
 */
class FakeMutationObserver {
	constructor(callback) {
		this.callback = callback;
		this.observing = false;
	}
	observe() {
		this.observing = true;
	}
	disconnect() {
		this.observing = false;
	}
	fire() {
		return this.callback([], this);
	}
}

/**
 * A stand-in observer with `unobserve()`, as `ResizeObserver` and `IntersectionObserver` have.
 */
class FakeResizeObserver {
	constructor(callback) {
		this.callback = callback;
		this.targets = new Set();
	}
	observe(target) {
		this.targets.add(target);
	}
	unobserve(target) {
		this.targets.delete(target);
	}
	disconnect() {
		this.targets.clear();
	}
}

/**
 * A stand-in for the Prioritized Task Scheduling API: runs the callback on a later macrotask unless its signal aborts it.
 */
const fakeScheduler = {
	postTask(callback, options) {
		const signal = options?.signal;
		return new Promise((resolve, reject) => {
			if (signal?.aborted) return reject(signal.reason);
			const timer = rawSetTimeout(() => {
				try {
					resolve(callback());
				} catch (error) {
					reject(error);
				}
			}, options?.delay ?? 5);
			signal?.addEventListener(
				"abort",
				() => {
					rawClearTimeout(timer);
					reject(signal.reason);
				},
				{ once: true }
			);
		});
	}
};

/** @type {Record<string, PropertyDescriptor|undefined>} */
const saved = {};

beforeAll(() => {
	rmSync(ROOT, { recursive: true, force: true });
	mkdirSync(path.join(BASE, "calls"), { recursive: true });
	writeFileSync(path.join(BASE, "calls", "calls.mjs"), "export function ping() {\n\treturn 1;\n}\n");
	for (const name of ["MutationObserver", "ResizeObserver", "scheduler"]) saved[name] = Object.getOwnPropertyDescriptor(globalThis, name);
	globalThis.MutationObserver = FakeMutationObserver;
	globalThis.ResizeObserver = FakeResizeObserver;
	globalThis.scheduler = fakeScheduler;
});

afterAll(() => {
	for (const name of Object.keys(saved)) {
		if (saved[name]) Object.defineProperty(globalThis, name, saved[name]);
		else delete globalThis[name];
	}
	rmSync(ROOT, { recursive: true, force: true });
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

/**
 * What the counts look like while one run's copy is kept.
 * @type {{runs: number, held: number}}
 */
const KEPT = { runs: 1, held: 1 };

describe.each([["async"], ["live"]])("a run's copy and the less common boundaries — %s runtime", (runtime) => {
	describe.each([["none"], ["on"]])("permissions %s", (mode) => {
		/**
		 * Make an instance.
		 * @returns {Promise<object>} The api.
		 */
		async function make() {
			return slothlet({ base: BASE, runtime, mode: "eager", silent: true, ...(mode === "none" ? {} : { permissions: mode }) });
		}

		/**
		 * The global metadata tag the calling code sees.
		 * @param {object} api - The api.
		 * @returns {*} The tag.
		 */
		function tag(api) {
			return api.slothlet.metadata.get(api.calls.ping).tag ?? null;
		}

		it("a timer cleared through node:timers, close() or [Symbol.dispose]() no longer keeps the copy", async () => {
			const api = await make();
			try {
				const handles = {};
				await api.slothlet.context.run({}, () => {
					api.slothlet.metadata.global("tag", "run");
					handles.timeout = setTimeout(() => {}, 60_000);
					handles.interval = setInterval(() => {}, 60_000);
					handles.immediate = setImmediate(() => {});
					handles.closed = setTimeout(() => {}, 60_000);
					handles.disposed = setTimeout(() => {}, 60_000);
					// Cleared before it could run: an immediate fires on the next turn.
					timersClearImmediate(handles.immediate);
				});
				await idle();
				expect(runCopyCounts()).toMatchObject(KEPT);
				timersClearTimeout(handles.timeout);
				timersClearInterval(handles.interval);
				handles.closed.close();
				await idle();
				expect(runCopyCounts()).toMatchObject(KEPT);
				handles.disposed[Symbol.dispose]();
				await idle();
				expect(runCopyCounts()).toEqual(BASELINE);
			} finally {
				await api.slothlet.shutdown();
			}
		});

		it('a timer cleared through require("node:timers") or an immediate disposed of no longer keeps the copy', async () => {
			const api = await make();
			try {
				const timers = createRequire(import.meta.url)("node:timers");
				const fired = gate();
				const handles = {};
				await api.slothlet.context.run({}, () => {
					api.slothlet.metadata.global("tag", "run");
					handles.timeout = setTimeout(() => {}, 60_000);
					handles.interval = setInterval(() => {}, 60_000);
					handles.immediate = setImmediate(() => {});
					handles.immediate[Symbol.dispose]();
					setTimeout(() => fired.release(tag(api)), 5);
				});
				expect(await fired.promise).toBe("run");
				await idle();
				expect(runCopyCounts()).toMatchObject(KEPT);
				timers.clearTimeout(handles.timeout);
				await idle();
				expect(runCopyCounts()).toMatchObject(KEPT);
				timers.clearInterval(handles.interval);
				await idle();
				expect(runCopyCounts()).toEqual(BASELINE);
			} finally {
				await api.slothlet.shutdown();
			}
		});

		it("an EventTarget listener taken off by its signal no longer keeps the copy", async () => {
			const api = await make();
			try {
				const target = new EventTarget();
				const controller = new AbortController();
				const later = new AbortController();
				const heard = [];
				const onPing = () => heard.push(tag(api));
				const onPong = () => heard.push(`pong:${tag(api)}`);
				await api.slothlet.context.run({}, () => {
					api.slothlet.metadata.global("tag", "run");
					target.addEventListener("ping", onPing, { signal: controller.signal });
					// Removed by hand first: its signal aborting later changes nothing.
					target.addEventListener("pong", onPong, { signal: later.signal });
					// Aborted already: never added, so never the run's work.
					target.addEventListener("never", () => {}, { signal: AbortSignal.abort() });
				});
				await idle();
				expect(runCopyCounts()).toMatchObject(KEPT);
				target.dispatchEvent(new Event("ping"));
				target.dispatchEvent(new Event("pong"));
				target.removeEventListener("pong", onPong);
				controller.abort();
				target.dispatchEvent(new Event("ping"));
				await idle();
				expect(heard).toEqual(["run", "pong:run"]);
				expect(runCopyCounts()).toEqual(BASELINE);
				later.abort();
				await idle();
				expect(runCopyCounts()).toEqual(BASELINE);
			} finally {
				await api.slothlet.shutdown();
			}
		});

		it("an EventTarget listener registered again with a second signal comes off when either aborts", async () => {
			const api = await make();
			try {
				const target = new EventTarget();
				const first = new AbortController();
				const second = new AbortController();
				const listener = () => {};
				await api.slothlet.context.run({}, () => {
					api.slothlet.metadata.global("tag", "run");
					target.addEventListener("ping", listener, { signal: first.signal });
					target.addEventListener("ping", listener, { signal: second.signal });
				});
				await idle();
				expect(runCopyCounts()).toMatchObject(KEPT);
				second.abort();
				await idle();
				expect(runCopyCounts()).toEqual(BASELINE);
				first.abort();
				await idle();
				expect(runCopyCounts()).toEqual(BASELINE);
			} finally {
				await api.slothlet.shutdown();
			}
		});

		it("an on<event> handler property keeps the copy until it is replaced or cleared", async () => {
			const api = await make();
			try {
				const controller = new AbortController();
				const heard = gate();
				await api.slothlet.context.run({}, () => {
					api.slothlet.metadata.global("tag", "run");
					controller.signal.onabort = () => {};
					// Replaced: the first handler's work is done, the second's is the run's.
					controller.signal.onabort = () => heard.release(tag(api));
				});
				await idle();
				expect(runCopyCounts()).toMatchObject(KEPT);
				controller.abort();
				expect(await heard.promise).toBe("run");
				controller.signal.onabort = null;
				await idle();
				expect(runCopyCounts()).toEqual(BASELINE);
			} finally {
				await api.slothlet.shutdown();
			}
		});

		it("an observer keeps the copy from its first observe() until it is disconnected (live)", async () => {
			const api = await make();
			try {
				let observer;
				let idleObserver;
				let performanceObserver;
				await api.slothlet.context.run({}, () => {
					api.slothlet.metadata.global("tag", "run");
					observer = new MutationObserver(() => tag(api));
					// Never observing: never the run's work.
					idleObserver = new MutationObserver(() => {});
					performanceObserver = new PerformanceObserver(() => {});
				});
				await idle();
				expect(runCopyCounts()).toEqual(BASELINE);
				expect(observer).toBeInstanceOf(FakeMutationObserver);
				expect(idleObserver.observing).toBe(false);

				await api.slothlet.context.run({}, () => {
					api.slothlet.metadata.global("tag", "run");
					observer = new MutationObserver(() => tag(api));
					observer.observe({});
					observer.observe({});
					performanceObserver = new PerformanceObserver(() => {});
					performanceObserver.observe({ entryTypes: ["mark"] });
				});
				await idle();
				if (runtime === "live") {
					expect(runCopyCounts()).toMatchObject(KEPT);
					expect(observer.fire()).toBe("run");
				} else expect(runCopyCounts()).toEqual(BASELINE);
				observer.disconnect();
				await idle();
				if (runtime === "live") expect(runCopyCounts()).toMatchObject(KEPT);
				performanceObserver.disconnect();
				await idle();
				expect(runCopyCounts()).toEqual(BASELINE);
				// Disconnecting again, or observing again after the copy is gone, changes nothing.
				observer.disconnect();
				observer.observe({});
				observer.disconnect();
				await idle();
				expect(runCopyCounts()).toEqual(BASELINE);
			} finally {
				await api.slothlet.shutdown();
			}
		});

		it("an observer with unobserve() keeps the copy while it observes anything (live)", async () => {
			const api = await make();
			try {
				const first = {};
				const second = {};
				let observer;
				await api.slothlet.context.run({}, () => {
					api.slothlet.metadata.global("tag", "run");
					observer = new ResizeObserver(() => {});
					observer.observe(first);
					observer.observe(second);
				});
				await idle();
				if (runtime === "live") expect(runCopyCounts()).toMatchObject(KEPT);
				observer.unobserve(first);
				await idle();
				if (runtime === "live") expect(runCopyCounts()).toMatchObject(KEPT);
				observer.unobserve(second);
				await idle();
				expect(runCopyCounts()).toEqual(BASELINE);
				expect(observer.targets.size).toBe(0);
			} finally {
				await api.slothlet.shutdown();
			}
		});

		it("a scheduler.postTask() callback keeps the copy until it has run or its signal aborted it", async () => {
			const api = await make();
			try {
				const ran = gate();
				const controller = new AbortController();
				let aborted;
				let refused;
				await api.slothlet.context.run({}, () => {
					api.slothlet.metadata.global("tag", "run");
					globalThis.scheduler.postTask(() => ran.release(tag(api)));
					aborted = globalThis.scheduler.postTask(() => {}, { signal: controller.signal, delay: 60_000 }).catch((error) => error.name);
					refused = globalThis.scheduler.postTask(() => {}, { signal: AbortSignal.abort() }).catch((error) => error.name);
				});
				expect(await ran.promise).toBe("run");
				expect(await refused).toBe("AbortError");
				await idle();
				expect(runCopyCounts()).toMatchObject(KEPT);
				controller.abort();
				expect(await aborted).toBe("AbortError");
				await idle();
				expect(runCopyCounts()).toEqual(BASELINE);
			} finally {
				await api.slothlet.shutdown();
			}
		});
	});
});
