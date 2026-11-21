/**
 *
 *	@Project: @cldmv/slothlet
 *	@Filename: /tests/vitests/suites/context/context-live-run-isolation.test.vitest.mjs
 *	@Date: 2026-11-17T12:00:00-08:00 (1794945600)
 *	@Author: Nate Corcoran <CLDMV>
 *	@Email: <Shinrai@users.noreply.github.com>
 *	-----
 *	@Last modified by: Nate Corcoran <CLDMV> (Shinrai@users.noreply.github.com)
 *	@Last modified time: 2026-11-17T12:00:00-08:00 (1794945600)
 *	-----
 *	@Copyright: Copyright (c) 2013-2026 Catalyzed Motivation Inc. All rights reserved.
 *
 */

/**
 * @fileoverview Concurrent `context.run()` flows are isolated from each other in every permission mode, on both runtimes.
 *
 * @description
 * Two `run()` flows are opened one after the other and both left waiting. Code of each flow then picks up again through
 * one route (an `await`, a `then` reaction, a timer, an immediate, `process.nextTick`, `queueMicrotask`, an EventEmitter
 * listener) while the other flow is still open, and reports the context it sees and who called it. Each flow must see
 * only its own context and its own caller, whichever flow was opened last; host code registered outside any `run()`
 * sees the instance's own context; a `run()` nested in another one's callback still inherits from it.
 *
 * Fixture (written to tmp/): `one.*` and `two.*` are the same probe file mounted twice, so a report names the module
 * whose code picked up; `who.caller()` reports `{ tag: context.tag, caller: metadata.caller() api path }`.
 */

import path from "node:path";
import { EventEmitter } from "node:events";
import { mkdirSync, rmSync, writeFileSync } from "node:fs";
import { describe, it, expect, beforeAll, afterAll, afterEach } from "vitest";
import slothlet from "@cldmv/slothlet";

const ROOT = path.join(process.cwd(), "tmp", "context-live-run-isolation");

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

/**
 * The probe: each export picks up through one route and reports from there.
 * @type {string[]}
 */
const PROBE = [
	'import { self } from "@cldmv/slothlet/runtime";',
	"const report = () => Promise.resolve(self.who.caller());",
	"export async function settle(hold) {",
	"\tawait hold;",
	"\treturn report();",
	"}",
	"export function reaction(hold) {",
	"\treturn hold.then(() => report());",
	"}",
	"export function timeout(ms) {",
	"\treturn new Promise((resolve, reject) => setTimeout(() => report().then(resolve, reject), ms));",
	"}",
	"export function immediate() {",
	"\treturn new Promise((resolve, reject) => setImmediate(() => report().then(resolve, reject)));",
	"}",
	"export function tick() {",
	"\treturn new Promise((resolve, reject) => process.nextTick(() => report().then(resolve, reject)));",
	"}",
	"export function microtask() {",
	"\treturn new Promise((resolve, reject) => queueMicrotask(() => report().then(resolve, reject)));",
	"}",
	"export function listen(bus, name) {",
	"\treturn new Promise((resolve, reject) => bus.once(name, () => report().then(resolve, reject)));",
	"}"
];

beforeAll(() => {
	rmSync(ROOT, { recursive: true, force: true });
	write("api/one/one.mjs", PROBE);
	write("api/two/two.mjs", PROBE);
	write("api/who/who.mjs", [
		'import { self, context } from "@cldmv/slothlet/runtime";',
		"export function caller() {",
		"\tconst found = self.slothlet.metadata.caller();",
		'\tconst at = found ? (found.apiPath ?? (Array.isArray(found.path) ? found.path.join(".") : "?")) : null;',
		"\treturn { tag: context.tag ?? null, caller: at };",
		"}"
	]);
});

afterAll(() => {
	rmSync(ROOT, { recursive: true, force: true });
});

/**
 * A promise and the function that settles it.
 * @returns {{promise: Promise<void>, release: function(): void}} The gate.
 */
function gate() {
	let release;
	const promise = new Promise((resolve) => (release = resolve));
	return { promise, release };
}

const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

const PERMISSIONS = [
	["no permissions config", undefined],
	["permissions off", { mode: "off" }],
	["permissions disabled", { mode: "disabled" }],
	["permissions on", { mode: "on" }]
];

const MATRIX = ["async", "live"].flatMap((runtime) => PERMISSIONS.map(([name, permissions]) => ({ runtime, name, permissions })));

describe.each(MATRIX)("concurrent context.run() flows are isolated > $runtime / $name", ({ runtime, permissions }) => {
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

	/**
	 * Open a `run()` with a tag.
	 * @param {string} tag - The tag.
	 * @param {function(): *} fn - The callback.
	 * @returns {Promise<*>} What `run()` returned.
	 */
	const run = (tag, fn) => api.slothlet.context.run({ tag }, fn);

	/**
	 * Start a module call through a route in each of two flows, the second flow opened while the first waits, and pick
	 * them up in the order `pickUp` gives.
	 * @param {function(object, number): Promise<*>} start - Starts flow `index`'s call on probe module `probe`.
	 * @param {function(): void} [pickUp] - Lets the waiting calls pick up.
	 * @param {boolean} [sameModule=false] - Whether both flows call the same probe module.
	 * @returns {Promise<Array<*>>} What the two flows reported, in open order.
	 */
	async function interleave(start, pickUp, sameModule = false) {
		const first = run("one", () => start(api.one, 0));
		const second = run("two", () => start(sameModule ? api.one : api.two, 1));
		pickUp?.();
		return Promise.all([first, second]);
	}

	const expected = (route, sameModule = false) => [
		{ tag: "one", caller: `one.${route}` },
		{ tag: "two", caller: `${sameModule ? "one" : "two"}.${route}` }
	];

	afterEach(async () => {
		// Every flow returned: the host's own call sees the instance's context again.
		expect(await api.who.caller()).toEqual({ tag: "base", caller: null });
	});

	describe.each([
		["two modules", false],
		["one module", true]
	])("module code picking up (%s)", (_label, sameModule) => {
		it("after an await, released in open order", async () => {
			const gates = [gate(), gate()];
			const seen = interleave(
				(probe, index) => probe.settle(gates[index].promise),
				() => {
					gates[0].release();
					gates[1].release();
				},
				sameModule
			);
			expect(await seen).toEqual(expected("settle", sameModule));
		});

		it("after an await, released in reverse order", async () => {
			const gates = [gate(), gate()];
			const seen = interleave(
				(probe, index) => probe.settle(gates[index].promise),
				() => {
					gates[1].release();
					gates[0].release();
				},
				sameModule
			);
			expect(await seen).toEqual(expected("settle", sameModule));
		});

		it("in a then() reaction", async () => {
			const gates = [gate(), gate()];
			const seen = interleave(
				(probe, index) => probe.reaction(gates[index].promise),
				() => {
					gates[0].release();
					gates[1].release();
				},
				sameModule
			);
			expect(await seen).toEqual(expected("reaction", sameModule));
		});

		it("in a timer", async () => {
			expect(await interleave((probe, index) => probe.timeout(index === 0 ? 5 : 25), null, sameModule)).toEqual(
				expected("timeout", sameModule)
			);
		});

		it("in an immediate", async () => {
			expect(await interleave((probe) => probe.immediate(), null, sameModule)).toEqual(expected("immediate", sameModule));
		});

		it("in process.nextTick", async () => {
			expect(await interleave((probe) => probe.tick(), null, sameModule)).toEqual(expected("tick", sameModule));
		});

		it("in queueMicrotask", async () => {
			expect(await interleave((probe) => probe.microtask(), null, sameModule)).toEqual(expected("microtask", sameModule));
		});

		it("in an EventEmitter listener", async () => {
			const bus = new EventEmitter();
			const seen = interleave(
				(probe, index) => probe.listen(bus, `e${index}`),
				() => {
					bus.emit("e0");
					bus.emit("e1");
				},
				sameModule
			);
			expect(await seen).toEqual(expected("listen", sameModule));
		});
	});

	describe("host code of a run() callback picking up", () => {
		/**
		 * Two `run()` callbacks that each read their context through a route, the second opened while the first waits.
		 * @param {function(function(): *, number): Promise<*>} later - Runs the read through the route, in flow `index`.
		 * @param {function(): void} [pickUp] - Lets the waiting reads run.
		 * @returns {Promise<Array<*>>} The tags the two flows read.
		 */
		const hostInterleave = (later, pickUp) => {
			const read = () => api.slothlet.context.get().tag;
			const first = run("one", () => later(read, 0));
			const second = run("two", () => later(read, 1));
			pickUp?.();
			return Promise.all([first, second]);
		};

		it("after an await", async () => {
			const gates = [gate(), gate()];
			const seen = hostInterleave(
				async (read, index) => {
					await gates[index].promise;
					return read();
				},
				() => {
					gates[0].release();
					gates[1].release();
				}
			);
			expect(await seen).toEqual(["one", "two"]);
		});

		it("in a then() reaction", async () => {
			const gates = [gate(), gate()];
			const seen = hostInterleave(
				(read, index) => gates[index].promise.then(read),
				() => {
					gates[0].release();
					gates[1].release();
				}
			);
			expect(await seen).toEqual(["one", "two"]);
		});

		it("in a timer", async () => {
			expect(
				await hostInterleave((read, index) => new Promise((resolve) => setTimeout(() => resolve(read()), index === 0 ? 5 : 25)))
			).toEqual(["one", "two"]);
		});

		it("in an immediate", async () => {
			expect(await hostInterleave((read) => new Promise((resolve) => setImmediate(() => resolve(read()))))).toEqual(["one", "two"]);
		});

		it("in process.nextTick", async () => {
			expect(await hostInterleave((read) => new Promise((resolve) => process.nextTick(() => resolve(read()))))).toEqual(["one", "two"]);
		});

		it("in queueMicrotask", async () => {
			expect(await hostInterleave((read) => new Promise((resolve) => queueMicrotask(() => resolve(read()))))).toEqual(["one", "two"]);
		});

		it("in an EventEmitter listener", async () => {
			const bus = new EventEmitter();
			const seen = hostInterleave(
				(read, index) => new Promise((resolve) => bus.once(`e${index}`, () => resolve(read()))),
				() => {
					bus.emit("e0");
					bus.emit("e1");
				}
			);
			expect(await seen).toEqual(["one", "two"]);
		});
	});

	describe("host code outside every run()", () => {
		/**
		 * Hold a `run()` open, run `fn` outside it, then let the `run()` return.
		 * @param {function(): Promise<*>} fn - The host code.
		 * @returns {Promise<*>} What `fn` returned.
		 */
		async function besideOpenRun(fn) {
			const hold = gate();
			const open = run("one", () => api.one.settle(hold.promise));
			try {
				return await fn();
			} finally {
				hold.release();
				await open;
			}
		}

		it("a timer it registers sees the instance's own context", async () => {
			const tag = await besideOpenRun(() => new Promise((resolve) => setTimeout(() => resolve(api.slothlet.context.get().tag), 5)));
			expect(tag).toBe("base");
		});

		it("an immediate it registers sees the instance's own context", async () => {
			const tag = await besideOpenRun(() => new Promise((resolve) => setImmediate(() => resolve(api.slothlet.context.get().tag))));
			expect(tag).toBe("base");
		});

		it("a module call it makes after an await sees the instance's own context", async () => {
			const result = await besideOpenRun(async () => {
				await wait(5);
				return api.who.caller();
			});
			expect(result).toEqual({ tag: "base", caller: null });
		});
	});

	describe("nested run()", () => {
		it("a run() opened in another run()'s timer inherits from it while a sibling run() is open", async () => {
			const hold = gate();
			const sibling = run("two", () => api.two.settle(hold.promise));
			const nested = run(
				"one",
				() =>
					new Promise((resolve) => setTimeout(() => resolve(api.slothlet.context.run({ level: 2 }, () => api.slothlet.context.get())), 5))
			);
			const seen = await nested;
			hold.release();
			await sibling;
			expect(seen).toEqual({ tag: "one", level: 2 });
		});

		it("a run() opened in another run()'s callback after an await inherits from it while a sibling run() is open", async () => {
			const hold = gate();
			const sibling = run("two", () => api.two.settle(hold.promise));
			const seen = await run("one", async () => {
				await wait(5);
				return api.slothlet.context.run({ level: 2 }, () => api.slothlet.context.get());
			});
			hold.release();
			await sibling;
			expect(seen).toEqual({ tag: "one", level: 2 });
		});
	});
});
