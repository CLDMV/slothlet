/**
 *
 *	@Project: @cldmv/slothlet
 *	@Filename: tests/vitests/suites/core/run-copy-garbage-work.test.vitest.mjs
 *	@Date: 2026-11-21T13:01:35-08:00 (1795294895)
 *	@Author: Nate Corcoran <CLDMV>
 *	@Email: <Shinrai@users.noreply.github.com>
 *	-----
 *	@Last modified by: Nate Corcoran <CLDMV> (Shinrai@users.noreply.github.com)
 *	@Last modified time: 2026-11-28T04:31:41-08:00 (1795869101)
 *	-----
 *	@Copyright: Copyright (c) 2013-2026 Catalyzed Motivation Inc. All rights reserved.
 *
 */

/**
 * @fileoverview A `run()` / `scope()`'s record and copy are released once the run has returned and nothing reachable can
 * still run its code, on both runtimes: work the run left behind that has become garbage (a promise nobody can settle,
 * a listener on an emitter or `EventTarget` nobody holds, a handler on a signal nobody holds, an observer nobody holds) does not keep the record.
 * Work still reachable keeps it, and runs in the run's context, until it is done.
 *
 * Plain JS is the reference: every object the "garbage" cases leave is unreachable once the run's callback has
 * returned, so the engine collects it, and nothing it would have run can run any more.
 *
 * Fixture (written at run time): `calls/calls.mjs`, `ping()` and `user()` (reports `context.user`).
 */
import path from "node:path";
import vm from "node:vm";
import v8 from "node:v8";
import http from "node:http";
import { EventEmitter } from "node:events";
import { mkdirSync, rmSync, writeFileSync } from "node:fs";
import { describe, it, expect, beforeAll, afterAll, afterEach } from "vitest";
import slothlet from "@cldmv/slothlet";
import { runCopyCounts } from "#helpers/flow-stores";

const ROOT = path.join(process.cwd(), "tmp", "run-copy-garbage-work");
const BASE = path.join(ROOT, "api");

/**
 * The host's own scheduler, taken before any instance patches the globals, so waiting on it is no run's work.
 */
const rawSetImmediate = globalThis.setImmediate;
const rawSetTimeout = globalThis.setTimeout;

/**
 * A stand-in observer (`MutationObserver` is no Node global), installed before any instance patches the globals.
 */
class FakeMutationObserver {
	constructor(callback) {
		this.callback = callback;
	}
	observe() {}
	disconnect() {}
}
if (typeof globalThis.MutationObserver !== "function") globalThis.MutationObserver = FakeMutationObserver;

beforeAll(() => {
	rmSync(ROOT, { recursive: true, force: true });
	mkdirSync(path.join(BASE, "calls"), { recursive: true });
	writeFileSync(
		path.join(BASE, "calls", "calls.mjs"),
		[
			'import { context } from "@cldmv/slothlet/runtime";',
			'export function ping() { return "pong"; }',
			"export function user() { return context.user ?? null; }",
			""
		].join("\n")
	);
});

afterAll(() => {
	rmSync(ROOT, { recursive: true, force: true });
	if (globalThis.MutationObserver === FakeMutationObserver) delete globalThis.MutationObserver;
});

/**
 * Let the work queued now run, then collect garbage several times, giving finalizers and the instance's idle teardown
 * their turns in between.
 * @returns {Promise<void>}
 */
async function collect() {
	v8.setFlagsFromString("--expose-gc");
	const gc = globalThis.gc ?? vm.runInNewContext("gc");
	for (let round = 0; round < 10; round++) {
		for (let step = 0; step < 3; step++) await new Promise((resolve) => rawSetImmediate(resolve));
		gc();
		await new Promise((resolve) => rawSetTimeout(resolve, 5));
	}
}

/**
 * What each case leaves behind when its run returns. Every object made here is unreachable once the callback returns.
 */
const GARBAGE = {
	"an unreachable promise that never settles": () => {
		new Promise(() => {});
	},
	"an abandoned async function awaiting a promise that never settles": () => {
		(async () => {
			await new Promise(() => {});
		})();
	},
	"the pending loser of a Promise.race": async () => {
		await Promise.race([Promise.resolve(1), new Promise(() => {})]);
	},
	"a listener on an EventEmitter nobody holds": () => {
		new EventEmitter().on("data", () => {});
	},
	"a listener on an EventTarget nobody holds": () => {
		new EventTarget().addEventListener("x", () => {});
	},
	"an abort listener on a signal nobody holds": () => {
		new AbortController().signal.addEventListener("abort", () => {});
	},
	"an onabort handler on a signal nobody holds": () => {
		new AbortController().signal.onabort = () => {};
	},
	"an observer nobody holds that still observes": () => {
		new globalThis.MutationObserver(() => {}).observe({});
	}
};

const RUNS = 100;

const MATRIX = ["async", "live"].flatMap((runtime) =>
	["eager", "lazy"].flatMap((mode) =>
		[
			["no permissions config", undefined],
			["permissions on", { mode: "on" }]
		].map(([permissionsName, permissions]) => ({ runtime, mode, permissionsName, permissions }))
	)
);

describe.each(MATRIX)("a run's record goes once what the run left is garbage > $runtime / $mode / $permissionsName", (setup) => {
	let api = null;
	const make = async () => {
		api = await slothlet({ base: BASE, runtime: setup.runtime, mode: setup.mode, permissions: setup.permissions, silent: true });
		return api;
	};

	// A failed expectation must not leave its instance's runs behind for the next case.
	afterEach(async () => {
		if (api !== null) await api.slothlet.shutdown();
		api = null;
	});

	for (const [kind, leave] of Object.entries(GARBAGE)) {
		it(`${kind}: ${RUNS} runs leave no record after gc`, async () => {
			await make();
			await collect();
			const before = runCopyCounts();
			for (let index = 0; index < RUNS; index++) {
				const answer = await api.slothlet.context.run({ user: index }, async () => {
					const pong = await api.calls.ping();
					await leave();
					return pong;
				});
				expect(answer).toBe("pong");
			}
			await collect();
			expect(runCopyCounts()).toEqual(before);
		});
	}

	it("a run's copy goes once what it left is garbage, after the run wrote its own metadata", async () => {
		await make();
		await collect();
		const before = runCopyCounts();
		for (let index = 0; index < RUNS; index++) {
			await api.slothlet.context.run({ user: index }, async () => {
				api.slothlet.metadata.global("tag", index);
				new EventEmitter().on("data", () => {});
				new Promise(() => {});
			});
		}
		await collect();
		expect(runCopyCounts()).toEqual(before);
	});

	it("work still reachable keeps the run's record and context until it is done", async () => {
		await make();
		await collect();
		const before = runCopyCounts();
		const emitters = [];
		const settles = [];
		const seen = [];
		for (let index = 0; index < 5; index++) {
			await api.slothlet.context.run({ user: `u${index}` }, async () => {
				const emitter = new EventEmitter();
				emitter.once("go", async () => seen.push(["listener", await api.calls.user()]));
				emitters.push(emitter);
				new Promise((resolve) => settles.push(resolve)).then(async () => seen.push(["promise", await api.calls.user()]));
			});
		}
		await collect();
		// Five runs, each held by a listener still on an emitter someone holds and a promise someone can still settle.
		expect(runCopyCounts().runs - before.runs).toBe(5);
		for (const emitter of emitters) emitter.emit("go");
		await collect();
		// The promises still hold them.
		expect(runCopyCounts().runs - before.runs).toBe(5);
		for (const settle of settles) settle();
		await collect();
		expect(runCopyCounts()).toEqual(before);
		expect(seen).toEqual([
			["listener", "u0"],
			["listener", "u1"],
			["listener", "u2"],
			["listener", "u3"],
			["listener", "u4"],
			["promise", "u0"],
			["promise", "u1"],
			["promise", "u2"],
			["promise", "u3"],
			["promise", "u4"]
		]);
	});
});

describe.each(["async", "live"])("an http server running each request in its own run > %s", (runtime) => {
	it("leaves no run record once the requests are done and collected", async () => {
		const api = await slothlet({ base: BASE, runtime, silent: true });
		const server = http.createServer((req, res) => {
			api.slothlet.context.run({ user: req.url }, async () => {
				req.resume();
				await new Promise((resolve) => req.on("end", resolve));
				res.end(String(await api.calls.user()));
			});
		});
		await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
		const { port } = server.address();
		const get = (index) =>
			new Promise((resolve, reject) => {
				http
					.get({ host: "127.0.0.1", port, path: `/u${index}`, agent: false }, (res) => {
						let body = "";
						res.on("data", (chunk) => (body += chunk));
						res.on("end", () => resolve(body));
					})
					.on("error", reject);
			});
		await collect();
		const before = runCopyCounts();
		const answers = [];
		for (let index = 0; index < RUNS; index++) answers.push(await get(index));
		expect(answers).toEqual(Array.from({ length: RUNS }, (_, index) => `/u${index}`));
		await new Promise((resolve) => server.close(resolve));
		// Node's http server refreshes its cached Date header from a timer it starts while answering a request (up to a
		// second later): pending work of that request's run, on the async runtime, until it fires.
		await new Promise((resolve) => rawSetTimeout(resolve, 1100));
		await collect();
		try {
			expect(runCopyCounts()).toEqual(before);
		} finally {
			await api.slothlet.shutdown();
		}
	});
});
