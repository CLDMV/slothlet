/**
 *
 *	@Project: @cldmv/slothlet
 *	@Filename: /tests/vitests/suites/runtime/returned-node-stream-shapes.test.vitest.mjs
 *	@Date: 2026-11-04T19:14:21-08:00 (1793848461)
 *	@Author: Nate Corcoran <CLDMV>
 *	@Email: <Shinrai@users.noreply.github.com>
 *	-----
 *	@Last modified by: Nate Corcoran <CLDMV> (Shinrai@users.noreply.github.com)
 *	@Last modified time: 2026-11-04T19:59:41-08:00 (1793851181)
 *	-----
 *	@Copyright: Copyright (c) 2013-2026 Catalyzed Motivation Inc. All rights reserved.
 *
 */

/**
 * @fileoverview More of Node's stream-based objects a module hands out (#708): http's requests and responses on both
 * sides, a TLS socket, a child process and its stdio, a UDP socket, a socket with an idle timer and a server's side of
 * a connection.
 * @description
 * The TLS socket is used twice: once before any handshake (its server is a plain TCP one) and once after a real
 * handshake with a TLS echo server, writing and reading over it. Each is usable from the host and from another module: native calls on it work and it closes. A socket with an idle
 * timer and a server's side of a connection hold only Node's own state and come back as themselves.
 */

import { describe, it, expect, beforeAll, afterAll, afterEach } from "vitest";
import path from "node:path";
import net from "node:net";
import { once } from "node:events";
import { fileURLToPath } from "node:url";
import { types } from "node:util";
import crypto from "node:crypto";
import tls from "node:tls";
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
let tlsServer;
let tlsPort;

/**
 * A throwaway self-signed Ed25519 key and certificate for `localhost`, made for this test run only and never stored:
 * the TLS server the fixture's sockets complete a real handshake with. Node has no API that writes a certificate, so
 * the X.509 structure is encoded here by hand (DER), signed with the key.
 * @returns {{key: string, cert: string}} The PEM key and certificate.
 */
function selfSignedCertificate() {
	const der = (tag, ...parts) => {
		const body = Buffer.concat(parts);
		const length = [];
		for (let left = body.length; left > 0; left >>= 8) length.unshift(left & 0xff);
		const header = body.length < 0x80 ? [body.length] : [0x80 | length.length, ...length];
		return Buffer.concat([Buffer.from([tag, ...header]), body]);
	};
	const ed25519 = der(0x30, der(0x06, Buffer.from([0x2b, 0x65, 0x70])));
	const name = der(0x30, der(0x31, der(0x30, der(0x06, Buffer.from([0x55, 0x04, 0x03])), der(0x0c, Buffer.from("localhost")))));
	const validity = der(0x30, der(0x17, Buffer.from("250101000000Z")), der(0x17, Buffer.from("491231235959Z")));
	const { publicKey, privateKey } = crypto.generateKeyPairSync("ed25519");
	const version = der(0xa0, der(0x02, Buffer.from([2])));
	const tbs = der(
		0x30,
		version,
		der(0x02, Buffer.from([1])),
		ed25519,
		name,
		validity,
		name,
		publicKey.export({ type: "spki", format: "der" })
	);
	const certificate = der(0x30, tbs, ed25519, der(0x03, Buffer.from([0]), crypto.sign(null, tbs, privateKey)));
	const lines = certificate
		.toString("base64")
		.match(/.{1,64}/g)
		.join("\n");
	return {
		key: privateKey.export({ type: "pkcs8", format: "pem" }),
		cert: `-----BEGIN CERTIFICATE-----\n${lines}\n-----END CERTIFICATE-----\n`
	};
}

beforeAll(async () => {
	server = net.createServer((connection) => {
		connections.add(connection);
		connection.on("error", () => {});
		connection.on("close", () => connections.delete(connection));
	});
	server.listen(0, "127.0.0.1");
	await once(server, "listening");
	port = server.address().port;
	// An echo server that completes a real TLS handshake.
	tlsServer = tls.createServer(selfSignedCertificate(), (connection) => {
		connection.on("error", () => {});
		connection.pipe(connection);
	});
	tlsServer.listen(0, "127.0.0.1");
	await once(tlsServer, "listening");
	tlsPort = tlsServer.address().port;
});

afterAll(async () => {
	for (const connection of connections) connection.destroy();
	server.close();
	tlsServer.close();
	await Promise.all([once(server, "close"), once(tlsServer, "close")]);
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
		case "tlsSession": {
			const socket = await api.shapes.tlsSession(tlsPort);
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
	tlsSession: { data: "hello", protocol: "TLSv1.3", closed: true },
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
			expect(await api.shapesUser.use(kind, kind === "tlsSession" ? tlsPort : port)).toMatchObject(EXPECTED[kind]);
		});
	}
);
