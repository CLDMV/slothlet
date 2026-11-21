/**
 *
 *	@Project: @cldmv/slothlet
 *	@Filename: /api_tests/api_test_stream_handout/maker.mjs
 *	@Date: 2026-11-04T17:35:06-08:00 (1793842506)
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
 * @fileoverview Hands out objects Node makes (a socket, streams, an emitter) and one of the module's own stream
 * subclasses, for the #708 tests.
 * @module api_test_stream_handout.maker
 */
import net from "node:net";
import zlib from "node:zlib";
import { once, EventEmitter } from "node:events";
import { PassThrough } from "node:stream";
import { createHash } from "node:crypto";

/**
 * A stream class of this module's own.
 */
class Tagged extends PassThrough {
	/**
	 * The module's own method.
	 * @returns {string} The tag.
	 */
	tag() {
		return "tagged";
	}
}

/**
 * A socket class of this module's own, so its instances are the module's and reach Node's native handle through it.
 */
class KeptSocket extends net.Socket {
	/**
	 * The module's own method.
	 * @returns {string} The tag.
	 */
	tag() {
		return "kept";
	}
}

/**
 * A socket connected to `port` on the loopback address.
 * @param {number} port - The port to connect to.
 * @returns {Promise<net.Socket>} The connected socket.
 * @example
 * const socket = await api.maker.socket(port);
 */
export async function socket(port) {
	const s = new net.Socket();
	s.connect(port, "127.0.0.1");
	await once(s, "connect");
	return s;
}

/**
 * A pass-through stream.
 * @returns {PassThrough} The stream.
 * @example
 * api.maker.passthrough();
 */
export function passthrough() {
	return new PassThrough();
}

/**
 * A gzip stream.
 * @returns {zlib.Gzip} The stream.
 * @example
 * api.maker.gzip();
 */
export function gzip() {
	return zlib.createGzip();
}

/**
 * A plain emitter.
 * @returns {EventEmitter} The emitter.
 * @example
 * api.maker.emitter();
 */
export function emitter() {
	return new EventEmitter();
}

/**
 * A stream of this module's own class.
 * @returns {Tagged} The stream.
 * @example
 * api.maker.tagged();
 */
export function tagged() {
	return new Tagged();
}

/**
 * A pass-through stream carrying this module's own transform.
 * @returns {PassThrough} The stream.
 * @example
 * api.maker.transformed();
 */
export function transformed() {
	return new PassThrough({
		transform(chunk, _encoding, callback) {
			callback(null, chunk);
		}
	});
}

/**
 * The module's one kept stream.
 * @type {PassThrough}
 */
const kept = new PassThrough();

/**
 * The same stream on every call.
 * @returns {PassThrough} The kept stream.
 * @example
 * api.maker.kept() === api.maker.kept(); // true
 */
export function held() {
	return kept;
}

/**
 * A socket of this module's own class, connected to `port` on the loopback address.
 * @param {number} port - The port to connect to.
 * @returns {Promise<KeptSocket>} The connected socket.
 * @example
 * const socket = await api.maker.keptSocket(port);
 */
export async function keptSocket(port) {
	const s = new KeptSocket();
	s.connect(port, "127.0.0.1");
	await once(s, "connect");
	return s;
}

/**
 * A sha256 hash.
 * @returns {import("node:crypto").Hash} The hash.
 * @example
 * api.maker.hash().update("x").digest("hex");
 */
export function hash() {
	return createHash("sha256");
}

/**
 * Take a value handed in, so it counts as handed to this module.
 * @param {*} value - The value.
 * @returns {boolean} True.
 * @example
 * await api.maker.accept(value);
 */
export function accept(value) {
	return value !== undefined;
}
