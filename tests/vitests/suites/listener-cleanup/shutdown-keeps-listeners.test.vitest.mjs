/**
 *
 *	@Project: @cldmv/slothlet
 *	@Filename: /tests/vitests/suites/listener-cleanup/shutdown-keeps-listeners.test.vitest.mjs
 *	@Date: 2026-10-10T19:32:01-07:00 (1791685921)
 *	@Author: Nate Corcoran <CLDMV>
 *	@Email: <Shinrai@users.noreply.github.com>
 *	-----
 *	@Last modified by: Nate Corcoran <CLDMV> (Shinrai@users.noreply.github.com)
 *	@Last modified time: 2026-10-10T19:32:01-07:00 (1791685921)
 *	-----
 *	@Copyright: Copyright (c) 2013-2026 Catalyzed Motivation Inc. All rights reserved.
 *
 */

/**
 * @fileoverview The last shutdown leaves a module's emitters with the listeners it registered (#605).
 *
 * @description
 * An emitter a module creates can outlive slothlet: undici keeps a `fetch` socket in its keep-alive
 * pool with its `error` and `close` listeners attached, and later destroys it with an error. Shutdown
 * removes no listener: one registered with `on` is swapped back for the function the code registered,
 * and one registered with `once` for a plain one-shot wrapper holding no slothlet state, which reports
 * that function through `.listener` as Node's own does. So that error still has its listener, and a
 * listener firing after shutdown runs as plain code.
 *
 * @module tests/vitests/suites/listener-cleanup/shutdown-keeps-listeners
 */

import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { mkdir, writeFile, rm } from "node:fs/promises";
import net from "node:net";
import { join, resolve } from "node:path";
import slothlet from "@cldmv/slothlet";
import { getMatrixConfigs } from "../../setup/vitest-helper.mjs";

const CONN = `
import { EventEmitter } from "node:events";
import net from "node:net";

const seen = [];
const onError = (error) => seen.push("error:" + error.message);
const onClose = () => seen.push("close");
const onReady = () => seen.push("ready");

export function getSeen() {
	return seen;
}

export function open() {
	const conn = new EventEmitter();
	conn.on("error", onError);
	conn.once("close", onClose);
	conn.prependOnceListener("ready", onReady);
	return { conn, onError, onClose, onReady };
}

export function connect(port) {
	return new Promise((resolve, reject) => {
		const socket = net.connect(port, "127.0.0.1", () => {
			socket.off("error", reject);
			socket.on("error", onError);
			resolve(socket);
		});
		socket.once("error", reject);
	});
}
`;

describe.each(getMatrixConfigs({}))("the last shutdown keeps a module's listeners > $name", ({ config }) => {
	let root;
	let api;
	let server;
	const sockets = new Set();

	beforeEach(async () => {
		root = resolve("tmp", `slothlet-605-${Date.now()}-${Math.random().toString(36).slice(2)}`);
		await mkdir(root, { recursive: true });
		await writeFile(join(root, "conn.mjs"), CONN);
	});

	afterEach(async () => {
		await api?.shutdown?.();
		api = null;
		for (const socket of sockets) socket.destroy();
		sockets.clear();
		if (server) await new Promise((done) => server.close(done));
		server = null;
		await rm(root, { recursive: true, force: true });
	});

	it("leaves the registered functions on the emitter, and they run after shutdown", async () => {
		api = await slothlet({ ...config, base: root });
		const { conn, onError, onClose } = await api.conn.open();
		const seen = await api.conn.getSeen();
		await api.shutdown();
		api = null;

		expect(conn.listenerCount("error")).toBe(1);
		expect(conn.listeners("error")).toEqual([onError]);
		expect(conn.listeners("close")).toEqual([onClose]);
		// The once listener that has not fired yet holds nothing of slothlet's.
		const [pendingOnce] = conn.rawListeners("close");
		expect(pendingOnce.listener).toBe(onClose);
		expect(pendingOnce._slothletOriginal).toBeUndefined();
		expect(pendingOnce._slothletResource).toBeUndefined();
		expect(() => conn.emit("error", new Error("late"))).not.toThrow();
		conn.emit("close");
		conn.emit("close");
		expect(seen).toEqual(["error:late", "close"]);
	});

	it("a once wrapper invoked directly more than once calls its listener once, before and after shutdown", async () => {
		api = await slothlet({ ...config, base: root });
		const seen = await api.conn.getSeen();

		// While slothlet runs: the wrappers it attached, read back with rawListeners(), are one-shot.
		const live = await api.conn.open();
		const [liveClose] = live.conn.rawListeners("close");
		const [liveReady] = live.conn.rawListeners("ready");
		liveClose.call(live.conn);
		liveClose.call(live.conn);
		liveReady.call(live.conn);
		liveReady.call(live.conn);
		expect(seen).toEqual(["close", "ready"]);

		// After the last shutdown: the plain one-shot wrappers that replace them are one-shot too.
		const later = await api.conn.open();
		await api.shutdown();
		api = null;
		const [laterClose] = later.conn.rawListeners("close");
		const [laterReady] = later.conn.rawListeners("ready");
		expect(laterClose.listener).toBe(later.onClose);
		expect(laterReady.listener).toBe(later.onReady);
		laterClose.call(later.conn);
		laterClose.call(later.conn);
		laterReady.call(later.conn);
		laterReady.call(later.conn);
		expect(seen).toEqual(["close", "ready", "close", "ready"]);
		expect(later.conn.listenerCount("close")).toBe(0);
		expect(later.conn.listenerCount("ready")).toBe(0);
	});

	it("an emitter whose listener table cannot be written does not stop the release of the others", async () => {
		api = await slothlet({ ...config, base: root });
		const frozen = await api.conn.open();
		const open = await api.conn.open();
		Object.freeze(frozen.conn._events);
		await expect(api.shutdown()).resolves.not.toThrow();
		api = null;
		expect(open.conn.listeners("error")).toEqual([open.onError]);
		expect(frozen.conn.listenerCount("error")).toBe(1);
	});

	it("a socket opened inside an api call keeps its error listener, so a later destroy is handled", async () => {
		server = net.createServer((socket) => sockets.add(socket));
		await new Promise((done) => server.listen(0, "127.0.0.1", done));
		api = await slothlet({ ...config, base: root });
		const socket = await api.conn.connect(server.address().port);
		sockets.add(socket);
		const seen = await api.conn.getSeen();
		await api.shutdown();
		api = null;

		expect(socket.listenerCount("error")).toBeGreaterThan(0);
		const closed = new Promise((done) => socket.once("close", done));
		socket.destroy(new Error("socket idle timeout"));
		await closed;
		expect(seen).toContain("error:socket idle timeout");
	});
});
