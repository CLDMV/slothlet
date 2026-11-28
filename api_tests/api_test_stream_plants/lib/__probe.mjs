/**
 *
 *	@Project: @cldmv/slothlet
 *	@Filename: api_tests/api_test_stream_plants/lib/__probe.mjs
 *	@Date: 2026-11-04T19:16:52-08:00 (1793848612)
 *	@Author: Nate Corcoran <CLDMV>
 *	@Email: <Shinrai@users.noreply.github.com>
 *	-----
 *	@Last modified by: Nate Corcoran <CLDMV> (Shinrai@users.noreply.github.com)
 *	@Last modified time: 2026-11-28T04:29:53-08:00 (1795868993)
 *	-----
 *	@Copyright: Copyright (c) 2013-2026 Catalyzed Motivation Inc. All rights reserved.
 *
 */

/**
 * @fileoverview Runs the #708 plant fixture under Node's own loader, where a module's code is told apart by its file,
 * and prints what each planted read gave, as JSON, for every mode, runtime and permission set.
 * @module api_tests/api_test_stream_plants/lib/__probe
 */
import net from "node:net";
import path from "node:path";
import { once } from "node:events";
import { fileURLToPath } from "node:url";
import slothlet from "@cldmv/slothlet";

const BASE = path.join(path.dirname(fileURLToPath(import.meta.url)), "..", "api");
const KINDS = ["onwrite", "readableState", "events", "on", "writeCallback", "handle", "global", "eval", "newFunction"];
const PERMISSIONS = {
	// Code from strings is a built-in capability (D4 ruling part 1); the probe is about where the planted code runs.
	evilDenied: {
		policy: "allow",
		rules: [
			{ caller: "evil.**", target: "vault.**", effect: "deny" },
			{ caller: "**", target: "capability:code", effect: "allow" }
		]
	},
	allAllowed: { policy: "allow", rules: [{ caller: "**", target: "capability:code", effect: "allow" }] }
};

const connections = new Set();
const server = net.createServer((connection) => {
	connections.add(connection);
	connection.on("error", () => {});
	connection.on("close", () => connections.delete(connection));
});
server.listen(0, "127.0.0.1");
await once(server, "listening");
const port = server.address().port;

const out = {};
for (const mode of ["eager", "lazy"])
	for (const runtime of ["async", "live"])
		for (const [name, permissions] of Object.entries(PERMISSIONS)) {
			const api = await slothlet({ base: BASE, mode, runtime, silent: true, permissions });
			const results = {};
			for (const kind of KINDS) results[kind] = await api.victim.use(kind, port);
			delete globalThis[Symbol.for("slothlet.test.i708.planted")];
			await api.slothlet.shutdown();
			out[`${mode}/${runtime}/${name}`] = results;
		}
for (const connection of connections) connection.destroy();
server.close();
console.log(JSON.stringify(out));
