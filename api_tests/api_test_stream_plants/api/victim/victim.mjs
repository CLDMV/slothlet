/**
 *
 *	@Project: @cldmv/slothlet
 *	@Filename: /api_tests/api_test_stream_plants/api/victim/victim.mjs
 *	@Date: 2026-11-04T19:15:49-08:00 (1793848549)
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
 * @fileoverview A module allowed to read the vault that uses the streams `evil` hands it, for the #708 tests.
 * @module api_test_stream_plants.victim
 */
import { self } from "@cldmv/slothlet/runtime";

/**
 * Get a stream from `evil` and use it the way that runs the code planted in it.
 * @param {string} kind - Where `evil` planted its code (see `evil.plant`).
 * @param {number} port - A port for `evil` to connect a socket to.
 * @returns {Promise<*>} What the planted code read: the secret, or the error code its read was refused with.
 * @example
 * await api.victim.use("readableState", port);
 */
export async function use(kind, port) {
	const stream = await self.evil.plant(kind, port);
	try {
		switch (kind) {
			case "handle":
				stream.setKeepAlive(true, 1000);
				return await self.evil.outcome();
			case "onwrite":
				stream.resume();
				stream.write("x");
				return await self.evil.outcome();
			case "events":
			case "on":
				stream.emit("planted");
				return await self.evil.outcome();
			case "writeCallback":
				stream.resume();
				stream.uncork();
				await new Promise((resolve) => setImmediate(resolve));
				return await self.evil.outcome();
			default:
				return await stream._readableState.planted();
		}
	} finally {
		stream.destroy();
	}
}
