/**
 *
 *	@Project: @cldmv/slothlet
 *	@Filename: /tests/vitests/suites/core/run-flows-across-restart.test.vitest.mjs
 *	@Date: 2026-11-21T00:00:00-08:00 (1795248000)
 *	@Author: Nate Corcoran <CLDMV>
 *	@Email: <Shinrai@users.noreply.github.com>
 *	-----
 *	@Last modified by: Nate Corcoran <CLDMV> (Shinrai@users.noreply.github.com)
 *	@Last modified time: 2026-11-21T00:00:00-08:00 (1795248000)
 *	-----
 *	@Copyright: Copyright (c) 2013-2026 Catalyzed Motivation Inc. All rights reserved.
 *
 */

/**
 * @fileoverview Work a module begins while it loads (a poller it starts at top level) belongs to the instance, whichever
 * load started it: the first load, a `reload()`, a `restart()`, or a lazy node's first load from inside a run that has a
 * tree of its own. Code that later runs in that work's flow is no run's: it sees the instance's tree, and a `run()` it
 * opens is an ordinary run whose changes stay in it.
 *
 * Fixture (written at run time): `calls/calls.mjs` (`ping()` answers `"pong"`), `ticker/ticker.mjs` (starts an interval
 * at load that drains a queue of callbacks kept per load generation), and `extra/extra.mjs`, a module the runs add.
 */
import path from "node:path";
import { mkdirSync, rmSync, writeFileSync } from "node:fs";
import { describe, it, expect, beforeAll, afterAll, beforeEach, afterEach } from "vitest";
import slothlet from "@cldmv/slothlet";
import { runCopyCounts } from "#helpers/flow-stores";

const ROOT = path.join(process.cwd(), "tmp", "run-flows-across-restart");
const BASE = path.join(ROOT, "api");
const EXTRA = path.join(ROOT, "extra");
const GEN = Symbol.for("slothlet.test.run-flows-across-restart.gen");
const QUEUES = Symbol.for("slothlet.test.run-flows-across-restart.queues");
const HANDLES = Symbol.for("slothlet.test.run-flows-across-restart.handles");

beforeAll(() => {
	rmSync(ROOT, { recursive: true, force: true });
	mkdirSync(path.join(BASE, "calls"), { recursive: true });
	mkdirSync(path.join(BASE, "ticker"), { recursive: true });
	mkdirSync(EXTRA, { recursive: true });
	writeFileSync(path.join(BASE, "calls", "calls.mjs"), 'export function ping() {\n\treturn "pong";\n}\n');
	writeFileSync(
		path.join(BASE, "ticker", "ticker.mjs"),
		[
			'const gen = globalThis[Symbol.for("slothlet.test.run-flows-across-restart.gen")];',
			'const queues = (globalThis[Symbol.for("slothlet.test.run-flows-across-restart.queues")] ??= {});',
			"const queue = (queues[gen] ??= []);",
			"const handle = setInterval(() => {",
			"\twhile (queue.length) queue.shift()();",
			"}, 2);",
			'(globalThis[Symbol.for("slothlet.test.run-flows-across-restart.handles")] ??= []).push(handle);',
			"export function generation() {",
			"\treturn gen;",
			"}",
			""
		].join("\n")
	);
	writeFileSync(path.join(EXTRA, "extra.mjs"), 'export function hello() {\n\treturn "hello";\n}\n');
});

afterAll(() => {
	rmSync(ROOT, { recursive: true, force: true });
});

/**
 * The instances a test made: shut down after it, also when it failed before its own `shutdown()`.
 * @type {Set<object>}
 */
const made = new Set();

/**
 * Make an instance, shut down after the test.
 * @param {object} config - The config.
 * @returns {Promise<object>} The api.
 */
async function make(config) {
	const api = await slothlet(config);
	made.add(api);
	return api;
}

afterEach(async () => {
	for (const api of made) await api.slothlet.shutdown().catch(() => {});
	made.clear();
	for (const handle of globalThis[HANDLES] ?? []) clearInterval(handle);
	delete globalThis[HANDLES];
	delete globalThis[QUEUES];
	delete globalThis[GEN];
});

let generationCounter = 0;

/**
 * Start a new load generation: the ticker module loaded next records it and drains its own queue.
 * @returns {number} The generation.
 */
function nextGeneration() {
	globalThis[GEN] = ++generationCounter;
	return generationCounter;
}

/**
 * Run `fn` in the async flow of the interval the ticker of generation `gen` started at load.
 * @param {number} gen - The generation.
 * @param {Function} fn - What runs there.
 * @returns {Promise<*>} What it returns, or `"ERR:<code>"` when it throws.
 */
function inPoller(gen, fn) {
	const queues = (globalThis[QUEUES] ??= {});
	return new Promise((resolve) => {
		(queues[gen] ??= []).push(() => resolve(outcome(fn)));
	});
}

/**
 * What `fn` returns, or `"ERR:<code>"` when it throws.
 * @param {Function} fn - The function.
 * @returns {Promise<*>} The outcome.
 */
async function outcome(fn) {
	try {
		return await fn();
	} catch (error) {
		return `ERR:${error?.code ?? error?.name}`;
	}
}

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
 * @param {number} [count=8] - How many.
 * @returns {Promise<void>}
 */
async function idle(count = 8) {
	for (let index = 0; index < count; index++) await new Promise((resolve) => setImmediate(resolve));
}

/**
 * The run and copy counts when the test started: a test leaves them as it found them (they count across every instance
 * of the process, so each test is compared with its own start).
 * @type {{runs: number, held: number, readThrough: number}}
 */
let startCounts;

beforeEach(() => {
	startCounts = runCopyCounts();
});

/**
 * From the poller's flow, open a run that adds a module, adds a hook and sets global metadata; then what the run saw
 * and what the instance shows afterwards.
 * @param {object} api - The api.
 * @param {number} gen - The poller's generation.
 * @param {string} label - The metadata value.
 * @returns {Promise<object>} The run's view and the instance's.
 */
async function changesFromPoller(api, gen, label) {
	const inRun = await inPoller(gen, () =>
		api.slothlet.context.run({ user: "req" }, async () => {
			await api.slothlet.api.add("extra", EXTRA, { id: "extra" });
			api.slothlet.hook.on("calls.ping:after", ({ result }) => `${result}!`);
			api.slothlet.metadata.global("fromRun", label);
			return [typeof api.extra, await api.calls.ping()];
		})
	);
	await idle();
	return {
		inRun,
		instanceExtra: typeof api.extra,
		instancePing: await outcome(async () => await api.calls.ping()),
		instanceMeta: await outcome(async () => (await api.slothlet.metadata.get(api.calls.ping))?.fromRun ?? null)
	};
}

/**
 * What a plain isolated run gives: the run sees its own module, hook and metadata; the instance sees none of it.
 * @type {object}
 */
const ISOLATED = { inRun: ["object", "pong!"], instanceExtra: "undefined", instancePing: "pong", instanceMeta: null };

describe.each([["async"], ["live"]])("work a module begins at load belongs to the instance — %s runtime", (runtime) => {
	describe.each([["none"], ["on"]])("permissions %s", (permissions) => {
		// With permissions on, the poller's code is the ticker module's: the host grants it what the runs below do.
		const grants = ["slothlet.metadata.global", "slothlet.shutdown"];
		const rules = [];
		for (const caller of ["ticker", "ticker.**"]) for (const target of grants) rules.push({ caller, target, effect: "allow" });
		const permissionConfig = permissions === "none" ? {} : { permissions: { mode: permissions, rules } };

		describe.each([["eager"], ["lazy"]])("%s mode", (mode) => {
			/**
			 * Make an instance with hooks on, shut down after the test.
			 * @returns {Promise<object>} The api.
			 */
			const makeOne = () => make({ base: BASE, runtime, mode, silent: true, hook: { enabled: true }, ...permissionConfig });

			it("a run opened from work the first load began keeps its changes to itself", async () => {
				const gen = nextGeneration();
				const api = await makeOne();
				expect(await api.ticker.generation()).toBe(gen);
				expect(await changesFromPoller(api, gen, "first")).toEqual(ISOLATED);
				await idle();
				expect(runCopyCounts()).toEqual(startCounts);
				await api.slothlet.shutdown();
			});

			it("a run opened from work a restart()'s load began keeps its changes to itself", async () => {
				const first = nextGeneration();
				const api = await makeOne();
				expect(await api.ticker.generation()).toBe(first);
				const gen = nextGeneration();
				await api.slothlet.restart();
				expect(await api.ticker.generation()).toBe(gen);
				expect(await changesFromPoller(api, gen, "second")).toEqual(ISOLATED);
				await idle();
				expect(runCopyCounts()).toEqual(startCounts);
				await api.slothlet.shutdown();
			});

			it("a run opened from work a restart()'s load began, while the restart is still under way, keeps its changes to itself", async () => {
				let api = null;
				let during = null;
				// A `restarted` subscriber runs before restart() resolves: from there, the new poller opens a run.
				const restarted = async () => {
					if (api === null) return;
					const gen = await api.ticker.generation();
					during = await changesFromPoller(api, gen, "during");
				};
				nextGeneration();
				api = await make({
					base: BASE,
					runtime,
					mode,
					silent: true,
					hook: { enabled: true },
					lifecycle: { restarted },
					...permissionConfig
				});
				await api.ticker.generation();
				nextGeneration();
				await api.slothlet.restart();
				expect(during).toEqual(ISOLATED);
				expect([typeof api.extra, await api.calls.ping()]).toEqual(["undefined", "pong"]);
				await idle();
				expect(runCopyCounts()).toEqual(startCounts);
				await api.slothlet.shutdown();
			});

			it("a shutdown() in a run opened from work a restart()'s load began shuts down the run's copy only", async () => {
				nextGeneration();
				const api = await makeOne();
				await api.ticker.generation();
				const gen = nextGeneration();
				await api.slothlet.restart();
				expect(await api.ticker.generation()).toBe(gen);
				const down = await inPoller(gen, () =>
					api.slothlet.context.run({}, async () => {
						await api.slothlet.shutdown();
						return "ran";
					})
				);
				await idle();
				expect([down, await outcome(async () => await api.calls.ping())]).toEqual(["ran", "pong"]);
				await api.slothlet.shutdown();
			});

			it("code in work a restart()'s load began, outside any run, reads and writes the instance", async () => {
				nextGeneration();
				const api = await makeOne();
				await api.ticker.generation();
				const gen = nextGeneration();
				await api.slothlet.restart();
				expect(await api.ticker.generation()).toBe(gen);
				// Outside any run the poller's code is the instance's: what it adds, the instance has.
				const added = await inPoller(gen, async () => {
					await api.slothlet.api.add("extra", EXTRA, { id: "extra" });
					return typeof api.extra;
				});
				expect([added, typeof api.extra]).toEqual(["object", "object"]);
				await api.slothlet.shutdown();
			});

			it("a run opened from work a reload()'s load began keeps its changes to itself", async () => {
				nextGeneration();
				const api = await makeOne();
				await api.ticker.generation();
				const gen = nextGeneration();
				await api.slothlet.reload();
				expect(await api.ticker.generation()).toBe(gen);
				expect(await changesFromPoller(api, gen, "second")).toEqual(ISOLATED);
				await idle();
				expect(runCopyCounts()).toEqual(startCounts);
				await api.slothlet.shutdown();
			});
		});

		it("lazy: work begun by a node a run with a tree of its own loaded first answers as the instance once the run is done", async () => {
			const gen = nextGeneration();
			const api = await make({ base: BASE, runtime, mode: "lazy", silent: true, hook: { enabled: true }, ...permissionConfig });
			const inRun = await api.slothlet.context.run({ user: "first" }, async () => {
				await api.slothlet.api.add("extra", EXTRA, { id: "extra" });
				return [await api.ticker.generation(), typeof api.extra];
			});
			expect(inRun).toEqual([gen, "object"]);
			await idle();
			expect(runCopyCounts()).toEqual(startCounts);
			// Another run holding a fork of its own makes the instance read its fields through the copies.
			const hold = gate();
			const other = api.slothlet.context.run({ user: "other" }, async () => {
				api.slothlet.hook.on("calls.ping:after", ({ result }) => result);
				await hold.promise;
			});
			await idle();
			expect(await api.ticker.generation()).toBe(gen);
			const seen = await inPoller(gen, async () => [typeof api.extra, await api.calls.ping()]);
			expect(seen).toEqual(["undefined", "pong"]);
			const viaRun = await inPoller(gen, () =>
				api.slothlet.context.run({ user: "late" }, async () => {
					await api.slothlet.api.add("extra2", EXTRA, { id: "extra2" });
					return [typeof api.extra, typeof api.extra2];
				})
			);
			expect(viaRun).toEqual(["undefined", "object"]);
			hold.release();
			await other;
			await idle();
			expect([typeof api.extra, typeof api.extra2]).toEqual(["undefined", "undefined"]);
			expect(runCopyCounts()).toEqual(startCounts);
			await api.slothlet.shutdown();
		});
	});
});
