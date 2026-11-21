/**
 *
 *	@Project: @cldmv/slothlet
 *	@Filename: /api_tests/api_test_stream_plants/api/evil/evil.mjs
 *	@Date: 2026-11-04T19:16:52-08:00 (1793848612)
 *	@Author: Nate Corcoran <CLDMV>
 *	@Email: <Shinrai@users.noreply.github.com>
 *	-----
 *	@Last modified by: Nate Corcoran <CLDMV> (Shinrai@users.noreply.github.com)
 *	@Last modified time: 2026-11-04T19:18:25-08:00 (1793848705)
 *	-----
 *	@Copyright: Copyright (c) 2013-2026 Catalyzed Motivation Inc. All rights reserved.
 *
 */

/**
 * @fileoverview A module that hands out Node streams with its own code planted inside their internal state, for the
 * #708 tests: wherever that code ends up running, it reads the vault as this module.
 * @module api_test_stream_plants.evil
 */
import net from "node:net";
import { once } from "node:events";
import { PassThrough } from "node:stream";
import { self } from "@cldmv/slothlet/runtime";

/** The global a planted function is parked on before it goes into a stream. */
export const GLOBAL_KEY = Symbol.for("slothlet.test.i708.planted");

/** @type {Promise<*>|null} What the last planted code that ran later read. */
let last = null;

/**
 * Read the vault's secret through `self`.
 * @returns {Promise<*>} The secret, or the error code its read was refused with.
 */
async function steal() {
	try {
		return await self.vault.secret;
	} catch (error) {
		return error.code ?? error.message;
	}
}

/**
 * Keep what planted code read, for {@link outcome}.
 * @returns {void}
 */
function record() {
	last = steal();
}

/**
 * What the last planted code that ran later read.
 * @returns {Promise<*>} The secret, an error code, or null when nothing ran.
 * @example
 * await api.evil.outcome();
 */
export async function outcome() {
	const value = await last;
	last = null;
	return value;
}

/**
 * A stream, or a socket connected to `port`, carrying this module's code in its internal state.
 * @param {string} kind - Where the code goes.
 * @param {number} port - A port to connect a socket to, for `"handle"`.
 * @returns {Promise<object>} The stream.
 * @example
 * await api.evil.plant("readableState");
 */
export async function plant(kind, port) {
	if (kind === "handle") {
		const socket = net.connect(port, "127.0.0.1");
		await once(socket, "connect");
		socket._handle.setKeepAlive = () => record();
		return socket;
	}
	const stream = new PassThrough();
	switch (kind) {
		case "onwrite": {
			const state = stream._writableState;
			const original = state.onwrite;
			state.onwrite = (error) => {
				record();
				original(error);
			};
			break;
		}
		case "readableState":
			stream._readableState.planted = steal;
			break;
		case "events":
			stream._events.planted = record;
			break;
		case "on":
			stream.on("planted", record);
			break;
		case "writeCallback":
			stream.cork();
			stream.write("x", record);
			break;
		case "eval":
			// Code compiled with eval reads as no module's.
			stream._readableState.planted = eval(
				"(async () => { try { return await self.vault.secret; } catch (e) { return e.code ?? e.message; } })"
			);
			break;
		case "newFunction":
			stream._readableState.planted = new Function(
				"self",
				"return (async () => { try { return await self.vault.secret; } catch (e) { return e.code ?? e.message; } })();"
			).bind(null, self);
			break;
		case "global":
			globalThis[GLOBAL_KEY] = steal;
			stream._readableState.planted = globalThis[GLOBAL_KEY];
			break;
		default:
			throw new Error(`unknown kind ${kind}`);
	}
	return stream;
}
