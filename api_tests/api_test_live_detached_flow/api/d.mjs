/**
 *
 *	@Project: @cldmv/slothlet
 *	@Filename: /api_tests/api_test_live_detached_flow/api/d.mjs
 *	@Date: 2026-11-13T08:00:00-08:00 (1794585600)
 *	@Author: Nate Corcoran <CLDMV>
 *	@Email: <Shinrai@users.noreply.github.com>
 *	-----
 *	@Last modified by: Nate Corcoran <CLDMV> (Shinrai@users.noreply.github.com)
 *	@Last modified time: 2026-11-13T08:00:00-08:00 (1794585600)
 *	-----
 *	@Copyright: Copyright (c) 2013-2026 Catalyzed Motivation Inc. All rights reserved.
 *
 */

/**
 * @fileoverview A module that gets `alpha`'s async function and starts it in ways that leave its flow behind.
 * @module api_test_live_detached_flow.d
 * @memberof module:api_test_live_detached_flow
 */
import { self } from "@cldmv/slothlet/runtime";

/**
 * The function `start` got.
 * @type {function(): Promise<string>}
 */
let kept;

/**
 * What the last flow `detach` or `raw` started settles to.
 * @type {Promise<*>|null}
 */
let started = null;

/**
 * Await a promise, reporting a refusal by its code.
 * @param {Promise<*>} promise - The promise.
 * @returns {Promise<*>} What it resolved to, or the code of the error it rejected with.
 */
async function settle(promise) {
	try {
		return await promise;
	} catch (error) {
		return error.code ?? error.name;
	}
}

/**
 * Get `alpha`'s function and keep it.
 * @function start
 * @memberof module:api_test_live_detached_flow.d
 * @param {boolean} boxed - Take it from the data `alpha.box()` returns instead of `alpha.giveLater()`.
 * @returns {Promise<string>} "got"
 * @example
 * await api.d.start(false); // "got"
 */
export const start = async (boxed) => {
	kept = boxed ? (await self.alpha.box()).run : await self.alpha.giveLater();
	return "got";
};

/**
 * Run the kept function and await it in this call.
 * @function direct
 * @memberof module:api_test_live_detached_flow.d
 * @returns {Promise<*>} What it answered, or the code of the refusal.
 * @example
 * await api.d.direct(); // "SECRET"
 */
export const direct = () => settle(kept());

/**
 * Start the kept function, awaited by a function of this file that the call does not wait for, and return.
 * @function detach
 * @memberof module:api_test_live_detached_flow.d
 * @returns {void}
 * @example
 * api.d.detach(); await api.d.outcome(); // "SECRET"
 */
export const detach = () => {
	started = settle(kept());
};

/**
 * Start the kept function, awaited by no one, and return.
 * @function raw
 * @memberof module:api_test_live_detached_flow.d
 * @returns {void}
 * @example
 * api.d.raw(); await api.d.outcome(); // "SECRET"
 */
export const raw = () => {
	const promise = kept();
	promise.catch(() => {});
	started = promise;
};

/**
 * What the last flow `detach` or `raw` started settled to, read once it has.
 * @function outcome
 * @memberof module:api_test_live_detached_flow.d
 * @returns {Promise<*>} Its answer, or the code of the refusal.
 * @example
 * await api.d.outcome(); // "SECRET"
 */
export const outcome = () => settle(started);

/**
 * Have `w` await the kept function this call starts.
 * @function viaW
 * @memberof module:api_test_live_detached_flow.d
 * @returns {Promise<*>} What `w` answered.
 * @example
 * await api.d.viaW(); // "SECRET"
 */
export const viaW = () => self.w.wait(kept());
