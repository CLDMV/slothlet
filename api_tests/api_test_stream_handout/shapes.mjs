/**
 *
 *	@Project: @cldmv/slothlet
 *	@Filename: /api_tests/api_test_stream_handout/shapes.mjs
 *	@Date: 2026-11-04T19:13:47-08:00 (1793848427)
 *	@Author: Nate Corcoran <CLDMV>
 *	@Email: <Shinrai@users.noreply.github.com>
 *	-----
 *	@Last modified by: Nate Corcoran <CLDMV> (Shinrai@users.noreply.github.com)
 *	@Last modified time: 2026-11-04T19:58:28-08:00 (1793851108)
 *	-----
 *	@Copyright: Copyright (c) 2013-2026 Catalyzed Motivation Inc. All rights reserved.
 *
 */

/**
 * @fileoverview Hands out more of Node's stream-based objects (http, tls, child processes, dgram, sockets with a
 * timer or a server), for the #708 tests.
 * @module api_test_stream_handout.shapes
 */
import net from "node:net";
import http from "node:http";
import tls from "node:tls";
import dgram from "node:dgram";
import { spawn } from "node:child_process";
import { once } from "node:events";

/**
 * A socket connected to `port`, with an idle timeout set.
 * @param {number} port - The port to connect to.
 * @returns {Promise<net.Socket>} The socket.
 * @example
 * await api.shapes.timedSocket(port);
 */
export async function timedSocket(port) {
	const socket = net.connect(port, "127.0.0.1");
	await once(socket, "connect");
	socket.setTimeout(60000);
	return socket;
}

/**
 * A server, a client connected to it and the server's side of that connection.
 * @returns {Promise<{server: net.Server, client: net.Socket, socket: net.Socket}>} The three.
 * @example
 * const { socket } = await api.shapes.serverSide();
 */
export async function serverSide() {
	const server = net.createServer();
	server.listen(0, "127.0.0.1");
	await once(server, "listening");
	const accepted = once(server, "connection");
	const client = net.connect(server.address().port, "127.0.0.1");
	const [socket] = await accepted;
	return { server, client, socket };
}

/**
 * An http server and one exchange on it, both sides, with the response's headers sent and the bodies still open.
 * @returns {Promise<object>} The server, the client's request and response, and the server's request and response.
 * @example
 * const { request, clientResponse } = await api.shapes.httpExchange();
 */
export async function httpExchange() {
	const server = http.createServer();
	server.listen(0, "127.0.0.1");
	await once(server, "listening");
	const incoming = once(server, "request");
	const request = http.request({ port: server.address().port, host: "127.0.0.1", method: "POST", agent: false });
	request.write("x");
	const [serverRequest, serverResponse] = await incoming;
	const responded = once(request, "response");
	serverResponse.writeHead(200);
	serverResponse.write("y");
	const [clientResponse] = await responded;
	return { server, request, clientResponse, serverRequest, serverResponse };
}

/**
 * A TLS socket over a TCP connection to `port`; the plain server there never answers the handshake.
 * @param {number} port - The port to connect to.
 * @returns {Promise<tls.TLSSocket>} The socket.
 * @example
 * await api.shapes.tlsSocket(port);
 */
export async function tlsSocket(port) {
	const socket = tls.connect({ port, host: "127.0.0.1", rejectUnauthorized: false });
	socket.on("error", () => {});
	await once(socket, "connect");
	return socket;
}

/**
 * A TLS socket that has finished its handshake with the TLS server at `port`.
 * @param {number} port - The TLS server's port.
 * @returns {Promise<tls.TLSSocket>} The socket.
 * @example
 * await api.shapes.tlsSession(port);
 */
export async function tlsSession(port) {
	const socket = tls.connect({ port, host: "127.0.0.1", rejectUnauthorized: false });
	await once(socket, "secureConnect");
	return socket;
}

/**
 * A child Node process echoing its stdin to its stdout.
 * @returns {import("node:child_process").ChildProcess} The child.
 * @example
 * api.shapes.child();
 */
export function child() {
	return spawn(process.execPath, ["-e", "process.stdin.pipe(process.stdout)"], { stdio: ["pipe", "pipe", "pipe"] });
}

/**
 * A UDP socket bound to a free loopback port.
 * @returns {Promise<dgram.Socket>} The socket.
 * @example
 * await api.shapes.udp();
 */
export async function udp() {
	const socket = dgram.createSocket("udp4");
	socket.bind(0, "127.0.0.1");
	await once(socket, "listening");
	return socket;
}
