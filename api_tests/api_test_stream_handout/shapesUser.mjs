/**
 *
 *	@Project: @cldmv/slothlet
 *	@Filename: /api_tests/api_test_stream_handout/shapesUser.mjs
 *	@Date: 2026-11-04T19:14:00-08:00 (1793848440)
 *	@Author: Nate Corcoran <CLDMV>
 *	@Email: <Shinrai@users.noreply.github.com>
 *	-----
 *	@Last modified by: Nate Corcoran <CLDMV> (Shinrai@users.noreply.github.com)
 *	@Last modified time: 2026-11-04T19:58:29-08:00 (1793851109)
 *	-----
 *	@Copyright: Copyright (c) 2013-2026 Catalyzed Motivation Inc. All rights reserved.
 *
 */

/**
 * @fileoverview Receives what `shapes` hands out and uses it, for the #708 tests.
 * @module api_test_stream_handout.shapesUser
 */
import util from "node:util";
import { once } from "node:events";
import { self } from "@cldmv/slothlet/runtime";

/**
 * Get one of `shapes`' objects, make native calls on it and close it.
 * @param {string} kind - `"timedSocket"`, `"serverSide"`, `"httpExchange"`, `"tlsSocket"`, `"tlsSession"`, `"child"` or `"udp"`.
 * @param {number} port - The port of the test's plain TCP server, or of its TLS echo server for `"tlsSession"`.
 * @returns {Promise<object>} What it saw: which values were stand-ins, and what the calls gave.
 * @example
 * await api.shapesUser.use("udp", port);
 */
export async function use(kind, port) {
	const isProxy = util.types.isProxy;
	switch (kind) {
		case "timedSocket":
		case "tlsSocket": {
			const socket = await self.shapes[kind](port);
			const proxy = isProxy(socket);
			socket.on("error", () => {});
			socket.setKeepAlive(true, 1000);
			socket.setNoDelay(true);
			socket.destroy();
			return { proxy, destroyed: socket.destroyed };
		}
		case "tlsSession": {
			const socket = await self.shapes.tlsSession(port);
			socket.setKeepAlive(true, 1000);
			const echoed = once(socket, "data");
			socket.write("hello");
			const [data] = await echoed;
			const protocol = socket.getProtocol();
			const closed = once(socket, "close");
			socket.end();
			await closed;
			return { data: String(data), protocol, closed: true };
		}
		case "serverSide": {
			const { server, client, socket } = await self.shapes.serverSide();
			const proxy = [isProxy(server), isProxy(client), isProxy(socket)];
			socket.setKeepAlive(true, 1000);
			const port = socket.address().port;
			const closed = once(server, "close");
			socket.destroy();
			client.destroy();
			server.close();
			await closed;
			return { proxy, port: port > 0, destroyed: socket.destroyed };
		}
		case "httpExchange": {
			const { server, request, clientResponse, serverRequest, serverResponse } = await self.shapes.httpExchange();
			request.setNoDelay(true);
			serverRequest.socket.setKeepAlive(true, 1000);
			request.end();
			const body = [];
			clientResponse.on("data", (chunk) => body.push(String(chunk)));
			const ended = once(clientResponse, "end");
			serverResponse.end("z");
			await ended;
			const closed = once(server, "close");
			server.close();
			server.closeAllConnections();
			await closed;
			return { status: clientResponse.statusCode, body: body.join("") };
		}
		case "child": {
			const child = await self.shapes.child();
			const out = [];
			child.stdout.on("data", (chunk) => out.push(String(chunk)));
			const exited = once(child, "exit");
			child.stdin.end("hi");
			const [code] = await exited;
			return { pid: child.pid > 0, out: out.join(""), code };
		}
		case "udp": {
			const socket = await self.shapes.udp();
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
