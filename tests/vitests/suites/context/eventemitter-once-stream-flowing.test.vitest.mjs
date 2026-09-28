/**
 *	@Project: @cldmv/slothlet
 *	@Filename: /tests/vitests/suites/context/eventemitter-once-stream-flowing.test.vitest.mjs
 *	@Date: 2026-09-28T10:14:31-07:00 (1790615671)
 *	@Author: Nate Corcoran <CLDMV>
 *	@Email: <Shinrai@users.noreply.github.com>
 *	-----
 *	@Last modified by: Nate Corcoran <CLDMV> (Shinrai@users.noreply.github.com)
 *	@Last modified time: 2026-09-28 10:14:31 -07:00 (1790615671)
 *	-----
 *	@Copyright: Copyright (c) 2013-2026 Catalyzed Motivation Inc. All rights reserved.
 */

/**
 * @fileoverview `once` must dispatch through the emitter's own `on` / `removeListener` (#503).
 *
 * @description
 * Native `EventEmitter.prototype.once` attaches with `this.on(...)` and detaches with
 * `this.removeListener(...)`, so a subclass override of either runs. `Readable` relies on that:
 * `Readable.prototype.on("data")` is what calls `resume()` and switches a paused stream into flowing
 * mode, and `Readable.prototype.on("readable")` is what arms `readableListening`.
 *
 * The patched `once` / `prependOnceListener` in `src/lib/helpers/eventemitter-context.mjs` used to
 * attach through the saved base `EventEmitter.prototype.on` / `prependListener` and detach through
 * the saved base `removeListener`, skipping every subclass override. The listener was attached, but
 * a paused stream never started flowing — `socket.once("data")` and `events.once(socket, "data")`
 * never fired while `socket.on("data")` did.
 *
 * These tests pin the native dispatch, and re-check that the fix did not undo the v3.8.0
 * once/removeListener double-wrap fix (the once-wrapper is not wrapped a second time by the
 * patched `on`) or the context capture that is the reason the patch exists.
 *
 * @module tests/vitests/suites/context/eventemitter-once-stream-flowing.test.vitest
 */

import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { EventEmitter, once as eventsOnce } from "node:events";
import { AsyncLocalStorage } from "node:async_hooks";
import { Readable } from "node:stream";
import net from "node:net";
import slothlet from "@cldmv/slothlet";
import { TEST_DIRS } from "../../setup/vitest-helper.mjs";

/**
 * Race a promise against a timeout so a listener that never fires fails the test instead of hanging it.
 * @param {Promise<*>} promise - Promise expected to settle.
 * @param {number} [ms=2000] - Timeout in milliseconds.
 * @returns {Promise<*>} The promise's value, or the string "timeout".
 */
function withTimeout(promise, ms = 2000) {
	let timer;
	const timeout = new Promise((resolve) => {
		timer = setTimeout(() => resolve("timeout"), ms);
	});
	return Promise.race([promise, timeout]).finally(() => clearTimeout(timer));
}

/**
 * Open a loopback TCP server, connect a client that writes `payload`, and hand the server-side
 * socket to `onConnection`. Resolves with whatever `onConnection` resolves with.
 * @param {(conn: net.Socket) => Promise<*>} onConnection - Registers the listener under test.
 * @param {string} [payload="hello"] - Bytes the client writes.
 * @returns {Promise<*>} The value `onConnection` resolves with, or "timeout".
 */
async function serverSide(onConnection, payload = "hello") {
	const server = net.createServer();
	const sockets = [];
	try {
		const result = new Promise((resolve) => {
			server.on("connection", (conn) => {
				sockets.push(conn);
				resolve(onConnection(conn));
			});
		});
		await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
		const client = net.connect(server.address().port, "127.0.0.1", () => client.write(payload));
		client.on("error", () => {});
		sockets.push(client);
		return await withTimeout(result);
	} finally {
		for (const s of sockets) s.destroy();
		await new Promise((resolve) => server.close(() => resolve()));
	}
}

describe("EventEmitter — once dispatches through the emitter's own on/removeListener (#503)", () => {
	let api;
	beforeAll(async () => {
		api = await slothlet({
			base: TEST_DIRS.API_TEST,
			mode: "eager",
			runtime: "async",
			silent: true
		});
	});
	afterAll(async () => {
		await api?.shutdown?.();
	});

	// ─── Streams: once("data") must start the flow ──────────────────────────

	it("Readable.once('data') resumes a paused stream and fires", async () => {
		const stream = new Readable({ read() {} });
		stream.push("chunk");

		const got = await withTimeout(new Promise((resolve) => stream.once("data", (d) => resolve(String(d)))));

		expect(got).toBe("chunk");
		expect(stream.readableFlowing).toBe(true);
		expect(stream.listenerCount("data")).toBe(0);
		stream.destroy();
	});

	it("Readable.once('readable') fires and detaches", async () => {
		const stream = new Readable({ read() {} });
		stream.push("chunk");

		const got = await withTimeout(new Promise((resolve) => stream.once("readable", () => resolve(String(stream.read())))));

		expect(got).toBe("chunk");
		expect(stream.listenerCount("readable")).toBe(0);
		stream.destroy();
	});

	it("server-side net.Socket once('data') fires with the client's bytes", async () => {
		const got = await serverSide((conn) => new Promise((resolve) => conn.once("data", (d) => resolve(String(d)))));
		expect(got).toBe("hello");
	});

	it("events.once(socket, 'data') resolves", async () => {
		const got = await serverSide(async (conn) => {
			const [d] = await eventsOnce(conn, "data");
			return String(d);
		});
		expect(got).toBe("hello");
	});

	it("on('data') on a server-side socket is unchanged", async () => {
		const got = await serverSide((conn) => new Promise((resolve) => conn.on("data", (d) => resolve(String(d)))));
		expect(got).toBe("hello");
	});

	// ─── Subclass overrides are honoured, exactly like native once ──────────

	it("once / prependOnceListener call the subclass's on / prependListener / removeListener", () => {
		const calls = [];
		class Recording extends EventEmitter {
			on(event, fn) {
				calls.push(`on:${String(event)}`);
				return super.on(event, fn);
			}
			prependListener(event, fn) {
				calls.push(`prependListener:${String(event)}`);
				return super.prependListener(event, fn);
			}
			removeListener(event, fn) {
				calls.push(`removeListener:${String(event)}`);
				return super.removeListener(event, fn);
			}
		}

		const emitter = new Recording();
		let a = 0;
		let b = 0;
		emitter.once("a", () => a++);
		emitter.prependOnceListener("b", () => b++);
		emitter.emit("a");
		emitter.emit("a");
		emitter.emit("b");
		emitter.emit("b");

		expect(a).toBe(1);
		expect(b).toBe(1);
		expect(calls).toEqual(["on:a", "prependListener:b", "removeListener:a", "removeListener:b"]);
		expect(emitter.listenerCount("a")).toBe(0);
		expect(emitter.listenerCount("b")).toBe(0);
	});

	// ─── Plain EventEmitter: once semantics and no double-wrap ──────────────

	it("plain EventEmitter once fires exactly once and leaves a single, introspectable wrapper", () => {
		const emitter = new EventEmitter();
		let calls = 0;
		const fn = () => calls++;

		emitter.once("e", fn);
		const raw = emitter.rawListeners("e");
		// Routing the attach through the patched `on` must not wrap the once-wrapper again.
		expect(raw).toHaveLength(1);
		expect(raw[0].listener).toBe(fn);

		emitter.emit("e");
		emitter.emit("e");
		expect(calls).toBe(1);
		expect(emitter.listenerCount("e")).toBe(0);
	});

	it("removeListener of a once-listener before it fires detaches it", () => {
		const emitter = new EventEmitter();
		let calls = 0;
		const fn = () => calls++;

		emitter.once("e", fn);
		emitter.prependOnceListener("e", fn);
		expect(emitter.listenerCount("e")).toBe(2);

		emitter.removeListener("e", fn);
		emitter.removeListener("e", fn);
		emitter.emit("e");

		expect(calls).toBe(0);
		expect(emitter.listenerCount("e")).toBe(0);
	});

	it("once and on for the same function coexist: once detaches only itself", () => {
		const emitter = new EventEmitter();
		let calls = 0;
		const fn = () => calls++;

		emitter.on("e", fn);
		emitter.once("e", fn);
		emitter.emit("e");
		expect(calls).toBe(2);
		expect(emitter.listenerCount("e")).toBe(1);

		emitter.emit("e");
		expect(calls).toBe(3);

		emitter.removeListener("e", fn);
		expect(emitter.listenerCount("e")).toBe(0);
	});

	it("events.once on a plain EventEmitter resolves with the emitted args", async () => {
		const emitter = new EventEmitter();
		setImmediate(() => emitter.emit("ready", 1, 2));
		const args = await withTimeout(eventsOnce(emitter, "ready"));
		expect(args).toEqual([1, 2]);
		expect(emitter.listenerCount("ready")).toBe(0);
	});

	// ─── The patch's purpose survives: once listeners still capture context ──

	it("a once listener still runs in the async context it was registered in", () => {
		const als = new AsyncLocalStorage();
		const emitter = new EventEmitter();
		let seen = "unset";

		als.run("registered", () => {
			emitter.once("e", () => {
				seen = als.getStore();
			});
		});
		als.run("emitted", () => emitter.emit("e"));

		expect(seen).toBe("registered");
	});
});
