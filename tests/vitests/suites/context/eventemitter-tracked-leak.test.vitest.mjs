/**
 *
 *	@Project: @cldmv/slothlet
 *	@Filename: /tests/vitests/suites/context/eventemitter-tracked-leak.test.vitest.mjs
 *	@Date: 2026-10-18T10:08:36-07:00 (1792343316)
 *	@Author: Nate Corcoran <CLDMV>
 *	@Email: <Shinrai@users.noreply.github.com>
 *	-----
 *	@Last modified by: Nate Corcoran <CLDMV> (Shinrai@users.noreply.github.com)
 *	@Last modified time: 2026-10-18T10:38:38-07:00 (1792345118)
 *	-----
 *	@Copyright: Copyright (c) 2013-2026 Catalyzed Motivation Inc. All rights reserved.
 *
 */

/**
 * @fileoverview Emitters that get a listener inside the api stay collectable (#611).
 *
 * @description
 * slothlet tracks every EventEmitter that gets a listener registered inside an api context, so the
 * last shutdown can release the listener wrappers it installed there. That tracking must not keep the
 * emitter alive: a socket, an undici `Fetch` or any short-lived emitter a module touches has to be
 * collectable as soon as the application lets go of it, exactly as without slothlet. Held strongly, it
 * grew the heap by 20-45 KB per `fetch()` made from a module, and ran a long-lived server out of memory.
 *
 * The last shutdown still swaps the wrappers on every emitter that is alive back for the functions the
 * code registered (#605), and leaves listeners slothlet never wrapped exactly as they are.
 */

import { describe, it, expect, beforeAll, afterAll, afterEach } from "vitest";
import { EventEmitter } from "node:events";
import http from "node:http";
import path from "node:path";
import v8 from "node:v8";
import vm from "node:vm";
import { fileURLToPath } from "node:url";
import slothlet from "@cldmv/slothlet";

v8.setFlagsFromString("--expose_gc");
/** @type {() => void} */
const gc = vm.runInNewContext("gc");

const BASE = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../../../api_tests/api_test_emitter_leak");

const CONFIGS = [
	{ name: "async / eager", config: { runtime: "async", mode: "eager" } },
	{ name: "async / lazy", config: { runtime: "async", mode: "lazy" } },
	{ name: "live / eager", config: { runtime: "live", mode: "eager" } },
	{ name: "live / lazy", config: { runtime: "live", mode: "lazy" } }
];

/**
 * Collect garbage until `done()` holds or the rounds run out, yielding to the event loop between rounds
 * so finalizers, closed sockets and pending timers settle.
 * @param {() => boolean} [done] - Stop once this returns true.
 * @param {number} [rounds] - Most rounds to run.
 * @returns {Promise<void>}
 */
async function collect(done = () => false, rounds = 20) {
	for (let round = 0; round < rounds; round++) {
		gc();
		await new Promise((resolve) => setImmediate(resolve));
		await new Promise((resolve) => setTimeout(resolve, 5));
		if (done()) return;
	}
}

/**
 * The heap in use after a full collection.
 * @returns {Promise<number>} Bytes.
 */
async function settledHeap() {
	await collect(() => false, 6);
	return process.memoryUsage().heapUsed;
}

/**
 * Create `count` emitters, have a module listen to each, and register each with `finalizer`. Nothing of
 * them is returned or kept.
 * @param {object} api - The slothlet api.
 * @param {number} count - How many emitters to create.
 * @param {FinalizationRegistry<undefined>} finalizer - Counts the emitters collected.
 * @returns {Promise<number>} How many the module listened to.
 */
async function listenToFresh(api, count, finalizer) {
	let listened = 0;
	for (let index = 0; index < count; index++) {
		const emitter = new EventEmitter();
		if (await api.emitters.listen(emitter)) listened++;
		finalizer.register(emitter, undefined);
	}
	return listened;
}

let server;
let url;

beforeAll(async () => {
	server = http.createServer((req, res) => res.end("x".repeat(512)));
	await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
	url = `http://127.0.0.1:${server.address().port}/`;
});

afterAll(async () => {
	server.closeAllConnections();
	await new Promise((resolve) => server.close(resolve));
});

describe.each(CONFIGS)("EventEmitter tracking does not retain emitters (#611) > Config: '$name'", ({ config }) => {
	let api;

	afterEach(async () => {
		if (api) await api.shutdown();
		api = null;
	});

	it("lets emitters created and listened to inside a module be collected", async () => {
		api = await slothlet({ ...config, base: BASE });
		const count = 200;
		expect(await api.emitters.create(count)).toBe(count);

		let alive = count;
		for (let round = 0; round < 20 && alive > 0; round++) {
			await collect(() => false, 1);
			alive = await api.emitters.alive();
		}
		expect(alive).toBe(0);
	});

	it("lets an emitter the application owns be collected once it lets go, after a module listened to it", async () => {
		api = await slothlet({ ...config, base: BASE });
		// Counted by finalization, not `WeakRef`: every `deref()` keeps its target alive until the job ends.
		let collected = 0;
		const finalizer = new FinalizationRegistry(() => {
			collected++;
		});
		const count = 50;
		// In a frame of its own, which has returned before the collection: the test's own frame can
		// otherwise keep the last emitter on the stack.
		expect(await listenToFresh(api, count, finalizer)).toBe(count);
		await collect(() => collected === count);
		expect(count - collected).toBe(0);
	});

	it("lets the requests, responses and sockets of HTTP calls made inside a module be collected", async () => {
		api = await slothlet({ ...config, base: BASE });
		const calls = 50;
		for (let index = 0; index < calls; index++) expect(await api.sockets.request(url)).toBe(512);
		// Every request touched a request, a response and a socket.
		let alive = calls * 3;
		for (let round = 0; round < 20 && alive > 0; round++) {
			await collect(() => false, 1);
			alive = await api.sockets.alive();
		}
		expect(alive).toBe(0);
	});

	it("keeps the heap flat over many fetch() calls made inside a module", async () => {
		api = await slothlet({ ...config, base: BASE });
		for (let index = 0; index < 200; index++) await api.net.get(url);
		const before = await settledHeap();
		const calls = 500;
		for (let index = 0; index < calls; index++) await api.net.get(url);
		const growth = (await settledHeap()) - before;
		// Held strongly, each call kept 20-45 KB alive: 10-22 MiB over these calls. Unretained, the
		// growth is noise, well under a megabyte; 4 MiB leaves room for a loaded machine.
		expect(growth).toBeLessThan(4 * 1024 * 1024);
	}, 60_000);

	it("still swaps its own wrappers back at the last shutdown and leaves foreign listeners alone", async () => {
		api = await slothlet({ ...config, base: BASE });
		const emitter = new EventEmitter();
		const foreign = () => "foreign";
		emitter.on("tick", foreign);
		expect(await api.emitters.listen(emitter)).toBe(true);
		// The module's listeners are slothlet wrappers while the instance is up.
		expect(emitter.rawListeners("tick").some((fn) => fn._slothletOriginal === emitter.leafOn)).toBe(true);

		await api.shutdown();
		api = null;

		const raw = emitter.rawListeners("tick");
		expect(raw).toHaveLength(3);
		// No slothlet wrapper is left on the emitter.
		expect(raw.some((fn) => fn._slothletOriginal !== undefined)).toBe(false);
		// The `on` listener is the very function the module registered; the `once` listener a plain
		// one-shot wrapper reporting it, as Node's own does.
		expect(raw).toContain(emitter.leafOn);
		expect(raw.find((fn) => fn.listener === emitter.leafOnce)).toBeTypeOf("function");
		// The listener registered outside the api is still there, as a function the code registered.
		expect(emitter.listeners("tick")).toContain(foreign);

		expect(emitter.listeners("tick").map((fn) => fn())).toEqual(["foreign", "on", "once"]);
	});

	it("releases the emitters still alive at the last shutdown when others were collected but not yet finalized", async () => {
		api = await slothlet({ ...config, base: BASE });
		const emitter = new EventEmitter();
		expect(await api.emitters.listen(emitter)).toBe(true);
		expect(await api.emitters.create(50)).toBe(50);
		// Collected now, but their finalizers have not run: the shutdown sweep still meets their refs. That
		// holds only while shutdown() gives the event loop no turn before the sweep; a wait added there would
		// let the finalizers run first, and this test would stop reaching the sweep's skip for a collected ref.
		await new Promise((resolve) => setImmediate(resolve));
		gc();
		await api.shutdown();
		api = null;

		// The emitter still alive was released as usual: its wrappers swapped for what the module registered.
		const raw = emitter.rawListeners("tick");
		expect(raw.some((fn) => fn._slothletOriginal !== undefined)).toBe(false);
		expect(raw).toContain(emitter.leafOn);
		expect(emitter.listeners("tick")).toEqual([emitter.leafOn, emitter.leafOnce]);
	});
});
