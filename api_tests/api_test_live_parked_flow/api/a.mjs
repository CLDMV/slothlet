/**
 *
 *	@Project: @cldmv/slothlet
 *	@Filename: api_tests/api_test_live_parked_flow/api/a.mjs
 *	@Date: 2026-11-14T08:00:00-08:00 (1794672000)
 *	@Author: Nate Corcoran <CLDMV>
 *	@Email: <Shinrai@users.noreply.github.com>
 *	-----
 *	@Last modified by: Nate Corcoran <CLDMV> (Shinrai@users.noreply.github.com)
 *	@Last modified time: 2026-11-28T04:28:45-08:00 (1795868925)
 *	-----
 *	@Copyright: Copyright (c) 2013-2026 Catalyzed Motivation Inc. All rights reserved.
 *
 */

/**
 * @fileoverview A module that starts `alpha`'s async function in its own call and lets go of it, leaving the promise
 * where the host finds it.
 * @module api_test_live_parked_flow.a
 */
import { self } from "@cldmv/slothlet/runtime";

/**
 * The function `start` got.
 * @type {function(): Promise<string>}
 */
let kept;

/**
 * Promises left for the host to take through the api.
 * @type {Array<Promise<string>>}
 */
const parked = [];

/**
 * Get `alpha`'s function and keep it.
 * @param {boolean} boxed - Take it from the data `alpha.box()` returns instead of `alpha.giveLater()`.
 * @returns {Promise<string>} "got"
 * @example
 * await api.a.start(false); // "got"
 */
export const start = async (boxed) => {
	kept = boxed ? (await self.alpha.box()).run : await self.alpha.giveLater();
	return "got";
};

/**
 * Start the kept function and leave its promise where `where` says, without awaiting it.
 * @param {string} where - `"global"`, `"object"` (on `target`), `"list"` (for {@link take}), `"event"` (emitted on
 *   `target`), or `"resolved"` (as the value of another promise on `globalThis`).
 * @param {*} [target] - The host's object or emitter.
 * @returns {void}
 * @example
 * api.a.park("global"); await globalThis.__parkedFlow; // "SECRET"
 */
export const park = (where, target) => {
	const promise = kept();
	if (where === "global") globalThis.__parkedFlow = promise;
	else if (where === "object") target.promise = promise;
	else if (where === "list") parked.push(promise);
	else if (where === "event") target.emit("parked", promise);
	else globalThis.__parkedFlow = Promise.resolve({ promise });
};

/**
 * Take the oldest promise `park("list")` left.
 * @returns {{promise: Promise<string>}} It, nested in data.
 * @example
 * await (await api.a.take()).promise; // "SECRET"
 */
export const take = () => ({ promise: parked.shift() });

/**
 * Start the kept function and return its promise.
 * @returns {Promise<string>} The promise.
 * @example
 * await api.a.give(); // "SECRET"
 */
export const give = () => kept();
