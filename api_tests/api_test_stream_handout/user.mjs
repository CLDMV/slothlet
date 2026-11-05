/**
 *
 *	@Project: @cldmv/slothlet
 *	@Filename: /api_tests/api_test_stream_handout/user.mjs
 *	@Date: 2026-11-04T17:35:06-08:00 (1793842506)
 *	@Author: Nate Corcoran <CLDMV>
 *	@Email: <Shinrai@users.noreply.github.com>
 *	-----
 *	@Last modified by: Nate Corcoran <CLDMV> (Shinrai@users.noreply.github.com)
 *	@Last modified time: 2026-11-04T18:53:05-08:00 (1793847185)
 *	-----
 *	@Copyright: Copyright (c) 2013-2026 Catalyzed Motivation Inc. All rights reserved.
 *
 */

/**
 * @fileoverview Receives what `maker` hands out and uses it, for the #708 tests.
 * @module api_test_stream_handout.user
 */
import util from "node:util";
import { self } from "@cldmv/slothlet/runtime";

/**
 * Get a socket from `maker` and make native calls on it.
 * @param {number} port - The port to connect to.
 * @returns {Promise<{proxy: boolean, keepAlive: boolean, destroyed: boolean}>} What it saw.
 * @example
 * await api.user.socket(port);
 */
export async function socket(port) {
	const s = await self.maker.socket(port);
	const proxy = util.types.isProxy(s);
	s.setKeepAlive(true, 1000);
	s.destroy();
	return { proxy, keepAlive: true, destroyed: s.destroyed };
}

/**
 * Get a stream from `maker`, write to it and end it.
 * @param {string} kind - `"passthrough"` or `"gzip"`.
 * @returns {Promise<{proxy: boolean, ended: boolean}>} What it saw.
 * @example
 * await api.user.stream("gzip");
 */
export async function stream(kind) {
	const s = await self.maker[kind]();
	const proxy = util.types.isProxy(s);
	s.resume();
	const finished = new Promise((resolve, reject) => {
		s.once("end", resolve);
		s.once("error", reject);
	});
	s.write("data");
	s.end();
	await finished;
	return { proxy, ended: true };
}

/**
 * Get an emitter from `maker` and emit on it.
 * @returns {Promise<{proxy: boolean, heard: boolean}>} What it saw.
 * @example
 * await api.user.emitter();
 */
export async function emitter() {
	const e = await self.maker.emitter();
	let heard = false;
	e.on("ping", () => (heard = true));
	e.emit("ping");
	return { proxy: util.types.isProxy(e), heard };
}

/**
 * Whether `maker` hands this module its kept stream as the same object every time.
 * @returns {Promise<{proxy: boolean, same: boolean}>} What it saw.
 * @example
 * await api.user.held();
 */
export async function held() {
	const first = await self.maker.held();
	return { proxy: util.types.isProxy(first), same: first === (await self.maker.held()) };
}

/**
 * Get a socket of `maker`'s own class and make native calls on it.
 * @param {number} port - The port to connect to.
 * @returns {Promise<{proxy: boolean, tag: string, destroyed: boolean}>} What it saw.
 * @example
 * await api.user.keptSocket(port);
 */
export async function keptSocket(port) {
	const s = await self.maker.keptSocket(port);
	const proxy = util.types.isProxy(s);
	s.setKeepAlive(true, 1000);
	s.setNoDelay(true);
	const tag = s.tag();
	s.destroy();
	return { proxy, tag, destroyed: s.destroyed };
}

/**
 * Get a hash from `maker` and digest through it.
 * @returns {Promise<{proxy: boolean, digest: string}>} What it saw.
 * @example
 * await api.user.hash();
 */
export async function hash() {
	const h = await self.maker.hash();
	return { proxy: util.types.isProxy(h), digest: h.update("data").digest("hex") };
}
