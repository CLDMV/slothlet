/**
 *
 *	@Project: @cldmv/slothlet
 *	@Filename: /tests/vitests/suites/context/context-live-after-run.test.vitest.mjs
 *	@Date: 2026-11-17T14:44:18-08:00 (1794955458)
 *	@Author: Nate Corcoran <CLDMV>
 *	@Email: <Shinrai@users.noreply.github.com>
 *	-----
 *	@Last modified by: Nate Corcoran <CLDMV> (Shinrai@users.noreply.github.com)
 *	@Last modified time: 2026-11-18T06:10:25-08:00 (1795011025)
 *	-----
 *	@Copyright: Copyright (c) 2013-2026 Catalyzed Motivation Inc. All rights reserved.
 *
 */

/**
 * @fileoverview Work a `context.run()` schedules keeps the run's context after the run's callback has returned, in every
 * permission mode, on both runtimes.
 *
 * @description
 * Each case opens `run({ tag: "alice" }, fn)` whose callback returns at once, after scheduling a read of the context
 * through one route: a timer, an interval, an immediate, `process.nextTick`, `queueMicrotask`, a detached promise chain,
 * a module call nobody awaits, an fs callback that starts a timer, an EventEmitter listener emitted after the run has
 * ended, and the middleware shape `run(ctx, next)` whose handler outlives `next`. The `run()` is awaited first, so every
 * read happens once the run has returned. Each read must see "alice", as on the async runtime.
 *
 * Isolation still holds: a second run open while the first one's late work runs sees only its own context, host code
 * outside every run sees the instance's own context before and after, and a run nested in late work inherits from the
 * finished run. On the live runtime a finished run's store is released once nothing tied to it remains: thousands of
 * short runs with completed timers leave no store behind.
 *
 * Work a run leaves behind keeps the run's context across a `reload()` of the instance too, on both runtimes.
 *
 * Fixture (written to tmp/): `who.tag()` reports `context.tag`; `late.read(hold)` waits for `hold`, then reports the tag;
 * `late.tagWhen(ready, done)` reports the tag from an interval of the module's own once `ready()` is true.
 */

import path from "node:path";
import vm from "node:vm";
import v8 from "node:v8";
import { EventEmitter } from "node:events";
import { mkdirSync, readFile, rmSync, writeFileSync } from "node:fs";
import { describe, it, expect, beforeAll, afterAll, afterEach } from "vitest";
import slothlet from "@cldmv/slothlet";
import { resolveWrapper } from "#handlers/unified-wrapper";

const ROOT = path.join(process.cwd(), "tmp", "context-live-after-run");

/**
 * Write a fixture file, creating its folder.
 * @param {string} file - Path below the fixture root.
 * @param {string[]} lines - File contents, one line each.
 * @returns {void}
 */
function write(file, lines) {
	const target = path.join(ROOT, file);
	mkdirSync(path.dirname(target), { recursive: true });
	writeFileSync(target, lines.join("\n") + "\n");
}

beforeAll(() => {
	rmSync(ROOT, { recursive: true, force: true });
	write("api/who/who.mjs", [
		'import { context } from "@cldmv/slothlet/runtime";',
		"export function tag() {",
		"\treturn context.tag ?? null;",
		"}"
	]);
	write("api/late/late.mjs", [
		'import { self, context } from "@cldmv/slothlet/runtime";',
		"export async function read(hold) {",
		"\tawait hold;",
		"\treturn { own: context.tag ?? null, viaSelf: self.who.tag() };",
		"}",
		"export function timer(ms, done) {",
		"\tsetTimeout(() => done({ own: context.tag ?? null, viaSelf: self.who.tag() }), ms);",
		"}",
		"export function tagWhen(ready, done) {",
		"\tconst handle = setInterval(() => {",
		"\t\tif (!ready()) return;",
		"\t\tclearInterval(handle);",
		"\t\tdone(context.tag ?? null);",
		"\t}, 5);",
		"}"
	]);
});

afterAll(() => {
	rmSync(ROOT, { recursive: true, force: true });
});

/**
 * A promise and the function that settles it.
 * @returns {{promise: Promise<*>, release: function(*=): void}} The gate.
 */
function gate() {
	let release;
	const promise = new Promise((resolve) => (release = resolve));
	return { promise, release };
}

const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

/**
 * Run the engine's garbage collector, exposing it first when the process was started without `--expose-gc`.
 * @returns {Promise<void>}
 */
async function collect() {
	v8.setFlagsFromString("--expose-gc");
	const gc = globalThis.gc ?? vm.runInNewContext("gc");
	for (let i = 0; i < 4; i++) {
		gc();
		await wait(5);
	}
}

const PERMISSIONS = [
	["no permissions config", undefined],
	["permissions off", { mode: "off" }],
	["permissions disabled", { mode: "disabled" }],
	["permissions on", { mode: "on" }]
];

const MATRIX = ["async", "live"].flatMap((runtime) => PERMISSIONS.map(([name, permissions]) => ({ runtime, name, permissions })));

describe.each(MATRIX)("work a run() schedules keeps its context after the run returns > $runtime / $name", ({ runtime, permissions }) => {
	let api;

	beforeAll(async () => {
		api = await slothlet({
			base: path.join(ROOT, "api"),
			runtime,
			mode: "eager",
			silent: true,
			context: { tag: "base" },
			...(permissions ? { permissions } : {})
		});
	});

	afterAll(async () => {
		await api?.shutdown();
		api = null;
	});

	afterEach(async () => {
		// Host code outside every run sees the instance's own context once the late work is done.
		expect(api.slothlet.context.get().tag).toBe("base");
		expect(api.who.tag()).toBe("base");
		await wait(1);
		expect(api.slothlet.context.get().tag).toBe("base");
	});

	/**
	 * What host code and a module call read in the context running now.
	 * @returns {{host: *, module: *}} The tags.
	 */
	const read = () => ({ host: api.slothlet.context.get().tag, module: api.who.tag() });
	const ALICE = { host: "alice", module: "alice" };

	/**
	 * Open `run({ tag: "alice" })` whose callback schedules work through a route and returns at once; wait for the run
	 * to return, then for the late work to report.
	 * @param {function(function(*): void, {release: function(): void, promise: Promise<void>}): void} schedule -
	 *   Schedules the read; calls `done` with what the late work saw. `after` is released once the run has returned.
	 * @returns {Promise<*>} What the late work saw.
	 */
	async function afterRun(schedule) {
		const seen = gate();
		const after = gate();
		let returned = false;
		await api.slothlet.context.run({ tag: "alice" }, () => {
			schedule((value) => seen.release({ value, returned }), after);
		});
		returned = true;
		after.release();
		const { value, returned: wasReturned } = await seen.promise;
		expect(wasReturned).toBe(true);
		return value;
	}

	it("a timer", async () => {
		expect(await afterRun((done) => setTimeout(() => done(read()), 10))).toEqual(ALICE);
	});

	it("an interval, on every tick until it is cleared", async () => {
		const seen = await afterRun((done) => {
			const ticks = [];
			const handle = setInterval(() => {
				ticks.push(read());
				if (ticks.length === 3) {
					clearInterval(handle);
					done(ticks);
				}
			}, 5);
		});
		expect(seen).toEqual([ALICE, ALICE, ALICE]);
	});

	it("an immediate", async () => {
		expect(await afterRun((done) => setImmediate(() => done(read())))).toEqual(ALICE);
	});

	it("process.nextTick queued after the run returned", async () => {
		expect(await afterRun((done, after) => after.promise.then(() => process.nextTick(() => done(read()))))).toEqual(ALICE);
	});

	it("queueMicrotask queued after the run returned", async () => {
		expect(await afterRun((done, after) => after.promise.then(() => queueMicrotask(() => done(read()))))).toEqual(ALICE);
	});

	it("a detached promise chain", async () => {
		expect(
			await afterRun((done, after) =>
				after.promise
					.then(() => wait(5))
					.then(() => read())
					.then(done)
			)
		).toEqual(ALICE);
	});

	it("a detached async function's code after an await", async () => {
		expect(
			await afterRun((done, after) => {
				(async () => {
					await after.promise;
					await wait(5);
					done(read());
				})();
			})
		).toEqual(ALICE);
	});

	it("a detached module call", async () => {
		expect(await afterRun((done, after) => api.late.read(after.promise).then(done))).toEqual({ own: "alice", viaSelf: "alice" });
	});

	it("a module's own timer", async () => {
		expect(await afterRun((done) => api.late.timer(10, done))).toEqual({ own: "alice", viaSelf: "alice" });
	});

	it("an fs callback that starts a timer", async () => {
		expect(await afterRun((done) => readFile(import.meta.filename, () => setTimeout(() => done(read()), 5)))).toEqual(ALICE);
	});

	it("an EventEmitter listener emitted after the run has ended, every time", async () => {
		const bus = new EventEmitter();
		await api.slothlet.context.run({ tag: "alice" }, () => {
			bus.on("ping", (out) => out.push(read()));
		});
		const out = [];
		bus.emit("ping", out);
		await wait(5);
		bus.emit("ping", out);
		expect(out).toEqual([ALICE, ALICE]);
		bus.removeAllListeners();
	});

	it("a run(ctx, next) middleware whose handler outlives next", async () => {
		const finished = gate();
		const handler = async () => {
			await wait(5);
			const first = read();
			await wait(5);
			finished.release([first, read()]);
		};
		const middleware = (ctx, next) => api.slothlet.context.run(ctx, next);
		await middleware({ tag: "alice" }, () => {
			handler();
		});
		expect(await finished.promise).toEqual([ALICE, ALICE]);
	});

	it("late work beside another open run sees only its own run's context", async () => {
		const bobGate = gate();
		const late = afterRun((done) => setTimeout(() => done(read()), 10));
		const bob = api.slothlet.context.run({ tag: "bob" }, async () => {
			await bobGate.promise;
			return read();
		});
		expect(await late).toEqual(ALICE);
		bobGate.release();
		expect(await bob).toEqual({ host: "bob", module: "bob" });
	});

	it("a run nested in late work inherits from the finished run", async () => {
		const seen = await afterRun((done) =>
			setTimeout(async () => {
				done(await api.slothlet.context.run({ level: 2 }, () => api.slothlet.context.get()));
			}, 5)
		);
		expect(seen).toMatchObject({ tag: "alice", level: 2 });
	});

	it("host code registered outside every run sees the instance's own context", async () => {
		const seen = gate();
		setTimeout(() => seen.release(read()), 5);
		expect(await seen.promise).toEqual({ host: "base", module: "base" });
	});
});

describe.each(PERMISSIONS)("live runtime: a finished run's store is released once nothing is tied to it > %s", (_name, permissions) => {
	it("thousands of short runs with completed timers and chains leave no store behind", async () => {
		const api = await slothlet({
			base: path.join(ROOT, "api"),
			runtime: "live",
			mode: "eager",
			silent: true,
			context: { tag: "base" },
			...(permissions ? { permissions } : {})
		});
		try {
			const manager = resolveWrapper(api.who.tag).____slothlet.contextManager;
			const before = manager.instances.size;
			let collected = 0;
			const registry = new FinalizationRegistry(() => collected++);
			const RUNS = 10000;
			const pending = [];
			for (let i = 0; i < RUNS; i++) {
				await api.slothlet.context.run({ tag: `r${i}` }, () => {
					// The run's own store, as the manager holds it while the run is open.
					for (const [id, store] of manager.instances) if (store.context?.tag === `r${i}`) registry.register(store, id);
					pending.push(
						new Promise((resolve) => setTimeout(resolve, 0)),
						Promise.resolve().then(() => api.who.tag())
					);
				});
			}
			const tags = await Promise.all(pending);
			expect(tags.filter((tag) => typeof tag === "string").every((tag) => tag.startsWith("r"))).toBe(true);
			pending.length = 0;
			tags.length = 0;
			expect(manager.instances.size).toBe(before);
			await collect();
			// Allow for the handful the engine may still hold in its last few job records.
			expect(collected).toBeGreaterThan(RUNS - 50);
			expect(api.slothlet.context.get().tag).toBe("base");
		} finally {
			await api.shutdown();
		}
	}, 60000);

	it("an interval keeps its run's context until it is cleared, then the store goes", async () => {
		const api = await slothlet({
			base: path.join(ROOT, "api"),
			runtime: "live",
			mode: "eager",
			silent: true,
			context: { tag: "base" },
			...(permissions ? { permissions } : {})
		});
		try {
			const manager = resolveWrapper(api.who.tag).____slothlet.contextManager;
			let collected = false;
			const registry = new FinalizationRegistry(() => (collected = true));
			let handle;
			const ticks = [];
			await api.slothlet.context.run({ tag: "alice" }, () => {
				for (const [id, store] of manager.instances) if (store.context?.tag === "alice") registry.register(store, id);
				handle = setInterval(() => ticks.push(api.who.tag()), 2);
			});
			await wait(30);
			await collect();
			expect(collected).toBe(false);
			clearInterval(handle);
			handle = null;
			expect(ticks.length).toBeGreaterThan(2);
			expect(new Set(ticks)).toEqual(new Set(["alice"]));
			await collect();
			expect(collected).toBe(true);
		} finally {
			await api.shutdown();
		}
	}, 30000);

	it("late work of a run whose instance has shut down still runs, with no store of the run put back", async () => {
		const api = await slothlet({
			base: path.join(ROOT, "api"),
			runtime: "live",
			mode: "eager",
			silent: true,
			context: { tag: "base" },
			...(permissions ? { permissions } : {})
		});
		const manager = resolveWrapper(api.who.tag).____slothlet.contextManager;
		const after = gate();
		const fired = [];
		let runID = null;
		await api.slothlet.context.run({ tag: "alice" }, () => {
			for (const [id, store] of manager.instances) if (store.context?.tag === "alice") runID = id;
			setTimeout(() => fired.push(["timer", manager.instances.has(runID)]), 10);
			after.promise.then(() => fired.push(["chain", manager.instances.has(runID)]));
		});
		await api.shutdown();
		after.release();
		await wait(30);
		expect(runID).not.toBe(null);
		expect(fired).toEqual([
			["chain", false],
			["timer", false]
		]);
	});
});

describe.each(PERMISSIONS)("live runtime: shutdown once work a run left behind has run leaves no store > %s", (_name, permissions) => {
	/**
	 * Open a live instance, run a `run()` whose callback schedules work through a route, wait for that work, then shut the
	 * instance down from outside any run, and return the manager's instance ids from before the instance was made and
	 * after it has shut down.
	 * @param {function(object, function(): void): void} schedule - Schedules `done()` from the run.
	 * @returns {Promise<{before: string[], after: string[]}>} The instance ids.
	 */
	async function shutdownAfterLateWork(schedule) {
		const probe = await slothlet({ base: path.join(ROOT, "api"), runtime: "live", mode: "eager", silent: true });
		const manager = resolveWrapper(probe.who.tag).____slothlet.contextManager;
		await probe.shutdown();
		const before = [...manager.instances.keys()];
		const api = await slothlet({
			base: path.join(ROOT, "api"),
			runtime: "live",
			mode: "eager",
			silent: true,
			context: { tag: "base" },
			...(permissions ? { permissions } : {})
		});
		const done = gate();
		await api.slothlet.context.run({ tag: "alice" }, () => schedule(api, () => done.release()));
		await done.promise;
		await api.slothlet.shutdown();
		await wait(5);
		return { before, after: [...manager.instances.keys()] };
	}

	it("a timer", async () => {
		const { before, after } = await shutdownAfterLateWork((api, done) => setTimeout(() => done(), 10));
		expect(after).toEqual(before);
	});

	it("a promise chain", async () => {
		const { before, after } = await shutdownAfterLateWork((api, done) => {
			wait(10).then(() => done());
		});
		expect(after).toEqual(before);
	});

	it("an EventEmitter listener", async () => {
		const bus = new EventEmitter();
		const { before, after } = await shutdownAfterLateWork((api, done) => {
			bus.once("stop", () => done());
			setTimeout(() => bus.emit("stop"), 10);
		});
		expect(after).toEqual(before);
	});
});

describe.each(MATRIX)(
	"shutdown from work a run left behind shuts down the run's copy only > $runtime / $name",
	({ runtime, permissions }) => {
		/**
		 * Open an instance, run a `run()` whose callback schedules `shutdown()` through a route, wait for it, and report
		 * what the instance answers afterwards; then shut the instance down from outside any run and return the manager's
		 * instance ids from before the instance was made and after it has shut down.
		 * @param {function(object, function(Promise<void>): void): void} schedule - Schedules `done(api.slothlet.shutdown())`
		 *   from the run.
		 * @returns {Promise<{tag: unknown, before: string[], after: string[]}>} What the instance answered, and the ids.
		 */
		async function shutdownFromLateWork(schedule) {
			const probe = await slothlet({ base: path.join(ROOT, "api"), runtime, mode: "eager", silent: true });
			const manager = resolveWrapper(probe.who.tag).____slothlet.contextManager;
			await probe.shutdown();
			const before = [...manager.instances.keys()];
			const api = await slothlet({
				base: path.join(ROOT, "api"),
				runtime,
				mode: "eager",
				silent: true,
				context: { tag: "base" },
				...(permissions ? { permissions } : {})
			});
			let tag;
			try {
				const done = gate();
				await api.slothlet.context.run({ tag: "alice" }, () => schedule(api, (shutdown) => done.release(shutdown)));
				await await done.promise;
				await wait(5);
				tag = api.who.tag();
			} finally {
				await api.slothlet.shutdown();
			}
			await wait(5);
			return { tag, before, after: [...manager.instances.keys()] };
		}

		it("a timer", async () => {
			const { tag, before, after } = await shutdownFromLateWork((api, done) => setTimeout(() => done(api.slothlet.shutdown()), 10));
			expect(tag).toBe("base");
			expect(after).toEqual(before);
		});

		it("a promise chain", async () => {
			const { tag, before, after } = await shutdownFromLateWork((api, done) => {
				wait(10).then(() => done(api.slothlet.shutdown()));
			});
			expect(tag).toBe("base");
			expect(after).toEqual(before);
		});

		it("an EventEmitter listener", async () => {
			const bus = new EventEmitter();
			const { tag, before, after } = await shutdownFromLateWork((api, done) => {
				bus.once("stop", () => done(api.slothlet.shutdown()));
				setTimeout(() => bus.emit("stop"), 10);
			});
			expect(tag).toBe("base");
			expect(after).toEqual(before);
		});
	}
);

describe.each(MATRIX)("work a run() leaves behind keeps its context across a reload > $runtime / $name", ({ runtime, permissions }) => {
	let api;

	beforeAll(async () => {
		api = await slothlet({
			base: path.join(ROOT, "api"),
			runtime,
			mode: "eager",
			silent: true,
			context: { tag: "base" },
			...(permissions ? { permissions } : {})
		});
	});

	afterAll(async () => {
		await api?.shutdown();
		api = null;
	});

	afterEach(() => {
		expect(api.slothlet.context.get().tag).toBe("base");
		expect(api.who.tag()).toBe("base");
	});

	// The intervals report only once the reload has finished: the api is not called while it reloads.
	it("a module's own interval set in the run reports after a reload", async () => {
		const seen = gate();
		let reloaded = false;
		await api.slothlet.context.run({ tag: "alice" }, () => api.late.tagWhen(() => reloaded, seen.release));
		await api.slothlet.reload();
		reloaded = true;
		expect(await seen.promise).toBe("alice");
	});

	it("an interval set in the run reports after a reload", async () => {
		const seen = gate();
		let reloaded = false;
		await api.slothlet.context.run({ tag: "alice" }, () => {
			const handle = setInterval(() => {
				if (!reloaded) return;
				clearInterval(handle);
				seen.release({ host: api.slothlet.context.get().tag, module: api.who.tag() });
			}, 5);
		});
		await api.slothlet.reload();
		reloaded = true;
		expect(await seen.promise).toEqual({ host: "alice", module: "alice" });
	});

	it("a promise chain started in the run picks up after a reload", async () => {
		const seen = gate();
		const hold = gate();
		await api.slothlet.context.run({ tag: "alice" }, () => {
			hold.promise.then(() => seen.release({ host: api.slothlet.context.get().tag, module: api.who.tag() }));
		});
		await api.slothlet.reload();
		hold.release();
		expect(await seen.promise).toEqual({ host: "alice", module: "alice" });
	});

	it("a run open across a reload that keeps the instance ID keeps its context, and so does its late work", async () => {
		const seen = gate();
		let reloaded = false;
		const inside = await api.slothlet.context.run({ tag: "alice" }, async () => {
			const handle = setInterval(() => {
				if (!reloaded) return;
				clearInterval(handle);
				seen.release(api.who.tag());
			}, 5);
			await api.slothlet.reload({ instance: "keep" });
			return { host: api.slothlet.context.get().tag, module: api.who.tag() };
		});
		reloaded = true;
		expect(inside).toEqual({ host: "alice", module: "alice" });
		expect(await seen.promise).toBe("alice");
	});

	it("an EventEmitter listener added in the run fires after two reloads", async () => {
		const bus = new EventEmitter();
		const seen = [];
		await api.slothlet.context.run({ tag: "alice" }, () => {
			bus.on("ping", () => seen.push(api.who.tag()));
		});
		await api.slothlet.reload();
		bus.emit("ping");
		await api.slothlet.reload();
		bus.emit("ping");
		bus.removeAllListeners();
		expect(seen).toEqual(["alice", "alice"]);
	});
});
