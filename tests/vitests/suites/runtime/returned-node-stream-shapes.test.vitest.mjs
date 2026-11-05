/**
 *
 *	@Project: @cldmv/slothlet
 *	@Filename: /tests/vitests/suites/runtime/returned-node-stream-shapes.test.vitest.mjs
 *	@Date: 2026-11-04T19:14:21-08:00 (1793848461)
 *	@Author: Nate Corcoran <CLDMV>
 *	@Email: <Shinrai@users.noreply.github.com>
 *	-----
 *	@Last modified by: Nate Corcoran <CLDMV> (Shinrai@users.noreply.github.com)
 *	@Last modified time: 2026-11-04T19:19:33-08:00 (1793848773)
 *	-----
 *	@Copyright: Copyright (c) 2013-2026 Catalyzed Motivation Inc. All rights reserved.
 *
 */

/**
 * @fileoverview More of Node's stream-based objects a module hands out (#708): http's requests and responses on both
 * sides, a TLS socket, a child process and its stdio, a UDP socket, a socket with an idle timer and a server's side of
 * a connection.
 * @description
 * Each is usable from the host and from another module: native calls on it work and it closes. A socket with an idle
 * timer and a server's side of a connection hold only Node's own state and come back as themselves.
 */

import { describe, it, expect, beforeAll, afterAll, afterEach } from "vitest";
import path from "node:path";
import net from "node:net";
import { once } from "node:events";
import { fileURLToPath } from "node:url";
import { types } from "node:util";
import slothlet from "@cldmv/slothlet";

const BASE = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../../../api_tests/api_test_stream_handout");

const CONFIGS = [];
for (const mode of ["eager", "lazy"])
	for (const runtime of ["async", "live"])
		for (const permissions of [false, true])
			CONFIGS.push({ mode, runtime, permissions, label: permissions ? "permissions on" : "permissions off" });

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

/**
 * Use one of the fixture's objects from the host the way `shapesUser.use` does from a module.
 * @param {object} api - The api.
 * @param {string} kind - The object's kind.
 * @returns {Promise<object>} What it saw.
 */
async function useFromHost(api, kind) {
	const isProxy = types.isProxy;
	switch (kind) {
		case "timedSocket":
		case "tlsSocket": {
			const socket = await api.shapes[kind](port);
			const proxy = isProxy(socket);
			socket.on("error", () => {});
			socket.setKeepAlive(true, 1000);
			socket.setNoDelay(true);
			socket.destroy();
			return { proxy, destroyed: socket.destroyed };
		}
		case "serverSide": {
			const { server: own, client, socket } = await api.shapes.serverSide();
			const proxy = [isProxy(own), isProxy(client), isProxy(socket)];
			socket.setKeepAlive(true, 1000);
			const local = socket.address().port;
			const closed = once(own, "close");
			socket.destroy();
			client.destroy();
			own.close();
			await closed;
			return { proxy, port: local > 0, destroyed: socket.destroyed };
		}
		case "httpExchange": {
			const { server: own, request, clientResponse, serverRequest, serverResponse } = await api.shapes.httpExchange();
			request.setNoDelay(true);
			serverRequest.socket.setKeepAlive(true, 1000);
			request.end();
			const body = [];
			clientResponse.on("data", (chunk) => body.push(String(chunk)));
			const ended = once(clientResponse, "end");
			serverResponse.end("z");
			await ended;
			const closed = once(own, "close");
			own.close();
			own.closeAllConnections();
			await closed;
			return { status: clientResponse.statusCode, body: body.join("") };
		}
		case "child": {
			const child = await api.shapes.child();
			const out = [];
			child.stdout.on("data", (chunk) => out.push(String(chunk)));
			const exited = once(child, "exit");
			child.stdin.end("hi");
			const [code] = await exited;
			return { pid: child.pid > 0, out: out.join(""), code };
		}
		case "udp": {
			const socket = await api.shapes.udp();
			const address = socket.address();
			socket.setTTL(10);
			const received = once(socket, "message");
			socket.send("ping", address.port, "127.0.0.1");
			const [message] = await received;
			const closed = once(socket, "close");
			socket.close();
			await closed;
			return { message: String(message) };
		}
		default:
			throw new Error(`unknown kind ${kind}`);
	}
}

const EXPECTED = {
	timedSocket: { proxy: false, destroyed: true },
	serverSide: { proxy: [false, false, false], port: true, destroyed: true },
	httpExchange: { status: 200, body: "yz" },
	tlsSocket: { destroyed: true },
	child: { pid: true, out: "hi", code: 0 },
	udp: { message: "ping" }
};

describe.each(CONFIGS)(
	"more of Node's stream-based objects a module hands out (#708) — $mode / $runtime / $label",
	({ mode, runtime, permissions }) => {
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

		it.each(Object.keys(EXPECTED))("hands the host a %s it can use and close", async (kind) => {
			await create();
			expect(await useFromHost(api, kind)).toMatchObject(EXPECTED[kind]);
		});

		it.each(Object.keys(EXPECTED))("hands another module a %s it can use and close", async (kind) => {
			await create();
			expect(await api.shapesUser.use(kind, port)).toMatchObject(EXPECTED[kind]);
		});
	}
);
