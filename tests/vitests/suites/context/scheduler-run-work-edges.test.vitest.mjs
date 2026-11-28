/**
 *
 *	@Project: @cldmv/slothlet
 *	@Filename: /tests/vitests/suites/context/scheduler-run-work-edges.test.vitest.mjs
 *	@Date: 2026-11-25T01:36:48-08:00 (1795599408)
 *	@Author: Nate Corcoran <CLDMV>
 *	@Email: <Shinrai@users.noreply.github.com>
 *	-----
 *	@Last modified by: Nate Corcoran <CLDMV> (Shinrai@users.noreply.github.com)
 *	@Last modified time: 2026-11-25T01:51:40-08:00 (1795600300)
 *	-----
 *	@Copyright: Copyright (c) 2013-2026 Catalyzed Motivation Inc. All rights reserved.
 *
 */

/**
 * @fileoverview The scheduler patch counting deferred callbacks as a run's work, on handles of every shape.
 *
 * @description
 * While a callback is scheduled in a `run()` / `scope()`, the scheduler patch holds the run's work until the callback
 * has run, or the timer, frame, idle callback or task was cleared or aborted. The runtime decides whether there is a
 * run to count for (`holdForCurrentFlow` / `recordOfCurrentFlow` in `helpers/caller-pinning`); here a stand-in strategy
 * answers that, counting every hold and release, so each kind of handle can be driven directly:
 *
 * - Node's own timer objects, cleared by object, by the id they answered as a primitive, or by their own methods, and
 *   re-armed with `refresh()` while pending and after they fired.
 * - browser-shaped schedulers, given as globals before the patch is turned on: `requestAnimationFrame` answering
 *   numbers or objects, `requestIdleCallback` answering a function, `scheduler.postTask` with and without a signal.
 * - a timer handle of a class whose clearing methods cannot be replaced.
 * - a platform with no `node:timers` builtin.
 *
 * Each case loads its own copy of the module, so the patch state of one never reaches another, and turns the patch
 * off again.
 * @module tests/vitests/suites/context/scheduler-run-work-edges
 */

import { pathToFileURL } from "node:url";
import { describe, it, expect, afterEach, vi } from "vitest";
import { setApiCallerPinner } from "#helpers/caller-pinning";
import { internalLibPath } from "../../setup/internal-resolve.mjs";

let copyCount = 0;

/**
 * A copy of `helpers/scheduler-context` of its own.
 * @returns {Promise<object>} The module.
 */
const freshCopy = () => import(`${pathToFileURL(internalLibPath("helpers/scheduler-context.mjs")).href}?copy=run-work-${++copyCount}`);

/**
 * Register a strategy that counts every callback as work of a run, with `record` as the run's record. Once a case
 * opens a run with `inRun`, only callbacks scheduled inside one count, as the runtime's own strategy counts only those
 * scheduled in a `run()` / `scope()`: a timer vitest itself sets while the patch is on (its task updates, whenever the
 * case waits on the event loop) is then no run's work (#1039).
 * @param {object|null} record - What `recordOfCurrentFlow` answers.
 * @returns {{holds: number, released: number, inRun: function(function(): *): *}} The running counts, and `inRun`,
 *   which runs a function as code of a run and returns what it returns.
 */
function countingStrategy(record = null) {
	let windowed = false;
	let inside = false;
	const counts = { holds: 0, released: 0 };
	Object.defineProperty(counts, "inRun", {
		value: (fn) => {
			windowed = true;
			inside = true;
			try {
				return fn();
			} finally {
				inside = false;
			}
		}
	});
	const outsideRun = () => windowed && !inside;
	const strategy = (callback) => callback;
	strategy.hold = () => {
		if (outsideRun()) return null;
		counts.holds++;
		let done = false;
		return () => {
			if (done) return;
			done = true;
			counts.released++;
		};
	};
	strategy.record = () => (outsideRun() ? null : record);
	setApiCallerPinner(strategy);
	return counts;
}

/**
 * Wait for a macrotask with the host's own `setImmediate`, read before any patch.
 * @type {function(): Promise<void>}
 */
const realSetImmediate = globalThis.setImmediate;
const realSetTimeout = globalThis.setTimeout;
const nextMacrotask = () => new Promise((resolve) => realSetImmediate(resolve));

let active = null;
const restoreGlobals = [];

afterEach(() => {
	active?.disableSchedulerPatching();
	active = null;
	setApiCallerPinner(null);
	while (restoreGlobals.length) restoreGlobals.pop()();
});

/**
 * Set a global for the rest of the case.
 * @param {string} name - The global's name.
 * @param {*} value - Its value.
 * @returns {void}
 */
function setGlobal(name, value) {
	const had = Object.prototype.hasOwnProperty.call(globalThis, name);
	const before = globalThis[name];
	globalThis[name] = value;
	restoreGlobals.push(() => {
		if (had) globalThis[name] = before;
		else delete globalThis[name];
	});
}

describe("Context > scheduler run work > Node timers", () => {
	it("keeps a pending timer's count when it is refreshed, and releases it when cleared", async () => {
		active = await freshCopy();
		active.enableSchedulerPatching();
		const counts = countingStrategy({ torn: true });
		const timer = setTimeout(() => {}, 100000);
		expect(counts.holds).toBe(1);
		timer.refresh();
		expect(counts.holds).toBe(1);
		clearTimeout(timer);
		expect(counts.released).toBe(1);
		// Cleared: Node leaves it as it is, and nothing is counted again.
		timer.refresh();
		expect(counts.holds).toBe(1);
	});

	it("counts nothing again when a fired timer is refreshed after its run has ended", async () => {
		active = await freshCopy();
		active.enableSchedulerPatching();
		const counts = countingStrategy({ torn: true });
		let ran = 0;
		const timer = counts.inRun(() => setTimeout(() => ran++, 0));
		await new Promise((resolve) => realSetTimeout(resolve, 5));
		expect(ran).toBe(1);
		expect(counts.released).toBe(1);
		timer.refresh();
		clearTimeout(timer);
		expect(counts.holds).toBe(1);
	});

	it("releases a timer cleared by its id, and one cleared by object after another answered its id", async () => {
		active = await freshCopy();
		active.enableSchedulerPatching();
		const counts = countingStrategy();
		const first = setTimeout(() => {}, 100000);
		const second = setTimeout(() => {}, 100000);
		const id = +first;
		clearTimeout(second);
		expect(counts.released).toBe(1);
		clearTimeout(String(id));
		expect(counts.released).toBe(2);
		// A handle the patch never held: closing it releases nothing.
		setApiCallerPinner(null);
		const loose = setTimeout(() => {}, 100000);
		loose.close();
		expect(counts.released).toBe(2);
	});
});

describe("Context > scheduler run work > browser-shaped schedulers", () => {
	it("counts animation frames whatever their handle, and releases them when cancelled or run", async () => {
		const frames = new Map();
		let next = 0;
		let objectHandles = false;
		setGlobal("requestAnimationFrame", (callback) => {
			const handle = objectHandles ? { frame: ++next } : ++next;
			frames.set(handle, callback);
			return handle;
		});
		setGlobal("cancelAnimationFrame", (handle) => frames.delete(handle));
		active = await freshCopy();
		active.enableSchedulerPatching();
		const counts = countingStrategy();

		const numbered = requestAnimationFrame(() => {});
		cancelAnimationFrame(numbered);
		expect(counts).toEqual({ holds: 1, released: 1 });

		objectHandles = true;
		let ran = 0;
		const objectHandle = requestAnimationFrame(() => ran++);
		frames.get(objectHandle)(0);
		expect(ran).toBe(1);
		expect(counts).toEqual({ holds: 2, released: 2 });
	});

	it("counts a frame whose handle is no number or object until it runs, and clearing nothing releases nothing", async () => {
		const frames = [];
		setGlobal("requestAnimationFrame", (callback) => {
			frames.push(callback);
			return undefined;
		});
		setGlobal("cancelAnimationFrame", () => {});
		active = await freshCopy();
		active.enableSchedulerPatching();
		const counts = countingStrategy();
		expect(requestAnimationFrame(() => {})).toBe(undefined);
		cancelAnimationFrame(undefined);
		expect(counts).toEqual({ holds: 1, released: 0 });
		frames[0](0);
		expect(counts).toEqual({ holds: 1, released: 1 });
	});

	it("releases a posted task the platform refuses, and throws as the platform does", async () => {
		setGlobal("scheduler", {
			postTask(callback, options) {
				if (options?.priority === "nonsense") throw new TypeError("bad priority");
				return Promise.resolve();
			}
		});
		active = await freshCopy();
		active.enableSchedulerPatching();
		const counts = countingStrategy();
		expect(() => scheduler.postTask(() => {}, { priority: "nonsense" })).toThrow("bad priority");
		expect(counts).toEqual({ holds: 1, released: 1 });
	});

	it("releases an idle callback whose handle is a function when it is cancelled", async () => {
		const callbacks = new Map();
		setGlobal("requestIdleCallback", (callback) => {
			const handle = () => {};
			callbacks.set(handle, callback);
			return handle;
		});
		setGlobal("cancelIdleCallback", (handle) => callbacks.delete(handle));
		active = await freshCopy();
		active.enableSchedulerPatching();
		const counts = countingStrategy();
		const handle = requestIdleCallback(() => {});
		expect(typeof handle).toBe("function");
		cancelIdleCallback(handle);
		expect(counts).toEqual({ holds: 1, released: 1 });
		// A handle never held releases nothing.
		cancelIdleCallback(() => {});
		expect(counts.released).toBe(1);
	});

	it("releases a posted task when it runs, when its signal aborts, or at once when the signal had aborted", async () => {
		const tasks = [];
		setGlobal("scheduler", {
			postTask(callback) {
				tasks.push(callback);
				return Promise.resolve();
			}
		});
		active = await freshCopy();
		active.enableSchedulerPatching();
		const counts = countingStrategy();

		// No options, options with no signal object, and a signal that is no EventTarget: released when the task runs.
		counts.inRun(() => {
			scheduler.postTask(() => {});
			scheduler.postTask(() => {}, { signal: null });
			scheduler.postTask(() => {}, { signal: { aborted: false } });
		});
		for (const task of tasks.splice(0)) task();
		expect(counts).toEqual({ holds: 3, released: 3 });

		// Aborted before it was posted: released at once.
		const aborted = new AbortController();
		aborted.abort();
		counts.inRun(() => scheduler.postTask(() => {}, { signal: aborted.signal }));
		expect(counts).toEqual({ holds: 4, released: 4 });
		tasks.splice(0);

		// A signal that aborts later: released then, and the task the platform would not run releases nothing more.
		const later = new AbortController();
		counts.inRun(() => scheduler.postTask(() => {}, { signal: later.signal }));
		later.abort();
		expect(counts).toEqual({ holds: 5, released: 5 });
		tasks.splice(0)[0]();
		expect(counts.released).toBe(5);

		// A task that runs first stops listening; a later abort releases nothing more.
		const after = new AbortController();
		counts.inRun(() => scheduler.postTask(() => {}, { signal: after.signal }));
		tasks.splice(0)[0]();
		expect(counts).toEqual({ holds: 6, released: 6 });
		after.abort();
		expect(counts.released).toBe(6);
		await nextMacrotask();
	});
});

describe("Context > scheduler run work > a handle class whose clearing methods cannot be replaced", () => {
	it("leaves those methods as they are and still releases the handle through clearTimeout", async () => {
		class Handle {}
		const close = function close() {};
		Object.defineProperty(Handle.prototype, "close", { value: close, writable: false, configurable: true });
		Object.defineProperty(Handle.prototype, Symbol.toPrimitive, { value: () => ({}), writable: false, configurable: true });
		const pending = new Set();
		setGlobal("setTimeout", () => {
			const handle = new Handle();
			pending.add(handle);
			return handle;
		});
		setGlobal("clearTimeout", (handle) => pending.delete(handle));
		active = await freshCopy();
		active.enableSchedulerPatching();
		const counts = countingStrategy({ torn: true });
		const handle = globalThis.setTimeout(() => {}, 10);
		expect(Handle.prototype.close).toBe(close);
		globalThis.clearTimeout(handle);
		expect(counts).toEqual({ holds: 1, released: 1 });
		active.disableSchedulerPatching();
		active = null;
	});

	it("keeps no id for a handle whose primitive is no number or string", async () => {
		class Handle {
			[Symbol.toPrimitive]() {
				return null;
			}
		}
		setGlobal("setTimeout", () => new Handle());
		setGlobal("clearTimeout", () => {});
		active = await freshCopy();
		active.enableSchedulerPatching();
		const counts = countingStrategy();
		const handle = globalThis.setTimeout(() => {}, 10);
		expect(handle[Symbol.toPrimitive]()).toBe(null);
		globalThis.clearTimeout(handle);
		expect(counts).toEqual({ holds: 1, released: 1 });
		active.disableSchedulerPatching();
		active = null;
	});

	it("counts a timer whose handle is a number without patching any prototype", async () => {
		let id = 0;
		setGlobal("setTimeout", () => ++id);
		setGlobal("clearTimeout", () => {});
		active = await freshCopy();
		active.enableSchedulerPatching();
		const counts = countingStrategy({ torn: true });
		const handle = globalThis.setTimeout(() => {}, 10);
		expect(typeof handle).toBe("number");
		globalThis.clearTimeout(handle);
		expect(counts).toEqual({ holds: 1, released: 1 });
		active.disableSchedulerPatching();
		active = null;
	});
});

describe("Context > scheduler run work > a platform with no node:timers", () => {
	afterEach(() => {
		vi.doUnmock("#helpers/intrinsics");
		vi.resetModules();
	});

	it("patches the globals only, and turns off cleanly", async () => {
		vi.resetModules();
		vi.doMock("#helpers/intrinsics", async (importOriginal) => {
			const original = await importOriginal();
			return {
				...original,
				Processes: {
					...original.Processes,
					getBuiltinModule: (id) => (id === "node:timers" ? undefined : original.Processes.getBuiltinModule(id))
				}
			};
		});
		const before = globalThis.setTimeout;
		active = await import("#helpers/scheduler-context");
		active.enableSchedulerPatching();
		expect(globalThis.setTimeout).not.toBe(before);
		active.disableSchedulerPatching();
		active = null;
		expect(globalThis.setTimeout).toBe(before);
	});
});
