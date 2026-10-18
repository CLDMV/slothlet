/**
 *
 *	@Project: @cldmv/slothlet
 *	@Filename: /api_tests/api_test_emitter_leak/sockets.mjs
 *	@Date: 2026-10-18T10:08:12-07:00 (1792343292)
 *	@Author: Nate Corcoran <CLDMV>
 *	@Email: <Shinrai@users.noreply.github.com>
 *	-----
 *	@Last modified by: Nate Corcoran <CLDMV> (Shinrai@users.noreply.github.com)
 *	@Last modified time: 2026-10-18T10:33:20-07:00 (1792344800)
 *	-----
 *	@Copyright: Copyright (c) 2013-2026 Catalyzed Motivation Inc. All rights reserved.
 *
 */

/**
 * @fileoverview `Connection: close` HTTP requests made from inside a module (#611).
 *
 * @description
 * Every request, response and socket a request touches carries listeners registered inside the api.
 * A `FinalizationRegistry` counts the ones collected, so the test can ask how many are still alive
 * without holding them.
 */

import http from "node:http";

/**
 * How many requests, responses and sockets `request` touched, and how many of them have been collected.
 * @type {{created: number, collected: number}}
 */
const counts = { created: 0, collected: 0 };

/**
 * Counts each collected object.
 * @type {FinalizationRegistry<undefined>}
 */
const finalizer = new FinalizationRegistry(() => {
	counts.collected++;
});

/**
 * Count `target` as touched, to be counted again once it is collected.
 * @param {object} target - A request, response or socket.
 * @returns {void}
 */
function watch(target) {
	finalizer.register(target, undefined);
	counts.created++;
}

/**
 * GET `url` over a fresh, non-pooled connection and read the whole body.
 * @param {string} url - URL to fetch.
 * @returns {Promise<number>} The body length.
 */
export function request(url) {
	return new Promise((resolve, reject) => {
		const req = http.get(url, { agent: false, headers: { connection: "close" } }, (res) => {
			let length = 0;
			res.on("data", (chunk) => {
				length += chunk.length;
			});
			res.on("end", () => resolve(length));
			watch(res);
		});
		req.on("error", reject);
		req.on("socket", (socket) => {
			socket.on("close", () => {});
			watch(socket);
		});
		watch(req);
	});
}

/**
 * How many of the requests, responses and sockets `request` touched are still alive.
 * @returns {number} Live objects.
 */
export function alive() {
	return counts.created - counts.collected;
}
