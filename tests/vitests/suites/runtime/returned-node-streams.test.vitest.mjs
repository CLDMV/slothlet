/**
 *
 *	@Project: @cldmv/slothlet
 *	@Filename: /tests/vitests/suites/runtime/returned-node-streams.test.vitest.mjs
 *	@Date: 2026-11-04T17:46:49-08:00 (1793843209)
 *	@Author: Nate Corcoran <CLDMV>
 *	@Email: <Shinrai@users.noreply.github.com>
 *	-----
 *	@Last modified by: Nate Corcoran <CLDMV> (Shinrai@users.noreply.github.com)
 *	@Last modified time: 2026-11-10T21:30:04-08:00 (1794375004)
 *	-----
 *	@Copyright: Copyright (c) 2013-2026 Catalyzed Motivation Inc. All rights reserved.
 *
 */

/**
 * @fileoverview Node's streams and sockets a module hands out (#708).
 * @description
 * A socket, a stream or a zlib stream a module makes is Node's object: none of its code is the module's. It comes back
 * as the object itself, to the host and to another module, so Node's native methods on it (`setKeepAlive`, `destroy`,
 * which reach the socket's native handle) get the real object as their receiver. A stream of the module's own class, or
 * one carrying the module's own transform, is the module's code and still comes back as a stand-in; a native method
 * reached through such a stand-in (its socket's handle) still gets the native object as its receiver.
 */

import { describe, it, expect, beforeAll, afterAll, afterEach } from "vitest";
import path from "node:path";
import net from "node:net";
import { once } from "node:events";
import { PassThrough } from "node:stream";
import { fileURLToPath } from "node:url";
import { types } from "node:util";
import { createHash } from "node:crypto";
import slothlet from "@cldmv/slothlet";

const BASE = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../../../api_tests/api_test_stream_handout");

const CONFIGS = [];
for (const mode of ["eager", "lazy"])
	for (const runtime of ["async", "live"])
		for (const permissions of [false, true])
			CONFIGS.push({ mode, runtime, permissions, label: permissions ? "permissions on" : "permissions off" });

/**
 * Write to a stream, end it and wait for it to finish.
 * @param {import("node:stream").Duplex} stream - The stream.
 * @returns {Promise<void>} Resolves at its `end`.
 */
async function drain(stream) {
	stream.resume();
	const ended = once(stream, "end");
	stream.write("data");
	stream.end();
	await ended;
}

let server;
let port;
const connections = new Set();

beforeAll(async () => {
	server = net.createServer((connection) => {
		connections.add(connection);
		connection.on("error", () => {});
		connection.on("close", () => connections.delete(connection));
	});
	server.listen(0, "127.0.0.1");
	await once(server, "listening");
	port = server.address().port;
});

afterAll(async () => {
	for (const connection of connections) connection.destroy();
	server.close();
	await once(server, "close");
});

describe.each(CONFIGS)("Node's streams a module hands out (#708) — $mode / $runtime / $label", ({ mode, runtime, permissions }) => {
	let api = null;

	afterEach(async () => {
		await api?.slothlet.shutdown();
		api = null;
	});

	/**
	 * Create an instance over the fixture.
	 * @returns {Promise<object>} The api.
	 */
	async function create() {
		api = await slothlet({
			base: BASE,
			mode,
			runtime,
			silent: true,
			...(permissions ? { permissions: { defaultPolicy: "allow", rules: [] } } : {})
		});
		return api;
	}

	it("hands the host a socket as itself, with its native methods working", async () => {
		await create();
		const socket = await api.maker.socket(port);
		// A stand-in's failing native close surfaces as an `error` event; keep it to the assertions.
		socket.on("error", () => {});
		try {
			expect(types.isProxy(socket)).toBe(false);
			expect(socket).toBeInstanceOf(net.Socket);
			expect(() => socket.setKeepAlive(true, 1000)).not.toThrow();
		} finally {
			socket.destroy();
		}
		expect(socket.destroyed).toBe(true);
	});

	it("hands another module a socket as itself, with its native methods working", async () => {
		await create();
		expect(await api.user.socket(port)).toEqual({ proxy: false, keepAlive: true, destroyed: true });
	});

	it.each(["passthrough", "gzip"])("hands the host a %s stream as itself, writable and endable", async (kind) => {
		await create();
		const stream = await api.maker[kind]();
		expect(types.isProxy(stream)).toBe(false);
		await drain(stream);
	});

	it.each(["passthrough", "gzip"])("hands another module a %s stream as itself, writable and endable", async (kind) => {
		await create();
		expect(await api.user.stream(kind)).toEqual({ proxy: false, ended: true });
	});

	it("hands out a plain emitter as itself", async () => {
		await create();
		expect(types.isProxy(await api.maker.emitter())).toBe(false);
		expect(await api.user.emitter()).toEqual({ proxy: false, heard: true });
	});

	it("hands out the same stream object every time, as Node's own class", async () => {
		await create();
		const stream = await api.maker.held();
		expect(types.isProxy(stream)).toBe(false);
		expect(await api.maker.held()).toBe(stream);
		expect(Object.getPrototypeOf(stream)).toBe(PassThrough.prototype);
		expect(await api.user.held()).toEqual({ proxy: false, same: true });
	});

	it("hands the host a hash as itself, digesting", async () => {
		await create();
		const hash = await api.maker.hash();
		expect(types.isProxy(hash)).toBe(false);
		expect(hash.update("data").digest("hex")).toBe(createHash("sha256").update("data").digest("hex"));
	});

	it("hands another module a hash as itself, digesting", async () => {
		await create();
		expect(await api.user.hash()).toEqual({ proxy: false, digest: createHash("sha256").update("data").digest("hex") });
	});

	it("keeps a socket of the module's own class as the module's, its native methods working through the stand-in", async () => {
		await create();
		const socket = await api.maker.keptSocket(port);
		socket.on("error", () => {});
		try {
			// A stand-in only while the permission system is on: with it off nothing a module returns is wrapped (#726).
			expect(types.isProxy(socket)).toBe(permissions);
			expect(socket.tag()).toBe("kept");
			expect(() => socket.setKeepAlive(true, 1000)).not.toThrow();
			expect(() => socket.setNoDelay(true)).not.toThrow();
			expect(typeof socket.address().port).toBe("number");
			expect(socket.write("data")).toBe(true);
		} finally {
			socket.destroy();
		}
		expect(socket.destroyed).toBe(true);
	});

	it("keeps a socket of the module's own class working once the module was handed its handle's prototype", async () => {
		await create();
		const plain = await api.maker.socket(port);
		plain.on("error", () => {});
		const handlePrototype = Object.getPrototypeOf(plain._handle);
		plain.destroy();
		expect(await api.maker.accept(handlePrototype)).toBe(true);
		const socket = await api.maker.keptSocket(port);
		socket.on("error", () => {});
		try {
			expect(types.isProxy(socket)).toBe(permissions);
			expect(() => socket.setKeepAlive(true, 1000)).not.toThrow();
			expect(typeof socket.address().port).toBe("number");
		} finally {
			socket.destroy();
		}
		expect(socket.destroyed).toBe(true);
	});

	it("reports the native class of a handle reached through a socket of the module's own class as the class itself", async () => {
		await create();
		const plain = await api.maker.socket(port);
		plain.on("error", () => {});
		const handleClass = plain._handle.constructor;
		plain.destroy();
		const socket = await api.maker.keptSocket(port);
		socket.on("error", () => {});
		try {
			expect(socket._handle.constructor).toBe(handleClass);
		} finally {
			socket.destroy();
		}
	});

	it("hands another module a socket of the module's own class, its native methods working through the stand-in", async () => {
		await create();
		expect(await api.user.keptSocket(port)).toEqual({ proxy: permissions, tag: "kept", destroyed: true });
	});

	it("keeps a stream of the module's own class as the module's, working", async () => {
		await create();
		const stream = await api.maker.tagged();
		expect(types.isProxy(stream)).toBe(permissions);
		expect(stream.tag()).toBe("tagged");
		await drain(stream);
	});

	it("hands out a stream of Node's own class carrying the module's transform as the stream itself, working", async () => {
		await create();
		const stream = await api.maker.transformed();
		// An instance of Node's own class holding an option function is data, as `return new PassThrough({ transform })`
		// is in plain JavaScript: only a value that is itself a module's code is a stand-in (#726).
		expect(types.isProxy(stream)).toBe(false);
		await drain(stream);
	});
});
