/**
 *
 *	@Project: @cldmv/slothlet
 *	@Filename: /api_tests/api_test_load_nested/inner/writer.mjs
 *	@Date: 2026-11-11T23:40:44-08:00 (1794469244)
 *	@Author: Nate Corcoran <CLDMV>
 *	@Email: <Shinrai@users.noreply.github.com>
 *	-----
 *	@Last modified by: Nate Corcoran <CLDMV> (Shinrai@users.noreply.github.com)
 *	@Last modified time: 2026-11-12T01:57:19-08:00 (1794477439)
 *	-----
 *	@Copyright: Copyright (c) 2013-2026 Catalyzed Motivation Inc. All rights reserved.
 *
 */

/**
 * @fileoverview Functions of the inner instance that change the top level of their own `self`.
 * @module api_test_load_nested.inner.writer
 * @memberof module:api_test_load_nested
 */
import { self } from "@cldmv/slothlet/runtime";

/**
 * Report what a change answered: "ok", or the code of the error it threw.
 * @param {function(): *} change - Makes the change.
 * @returns {Promise<string>} The answer.
 */
async function attempt(change) {
	try {
		await change();
		return "ok";
	} catch (error) {
		return error.code ?? String(error);
	}
}

/**
 * Assign a member of `self` in the call's synchronous part.
 * @function writeSync
 * @memberof module:api_test_load_nested.inner.writer
 * @returns {Promise<string>} "ok", or the code of the refusal.
 * @example
 * await api.writer.writeSync(); // "ok"
 */
export const writeSync = () =>
	attempt(() => {
		self.madeSync = { a() {} };
	});

/**
 * Assign a member of `self` after an `await`.
 * @function writeAfterAwait
 * @memberof module:api_test_load_nested.inner.writer
 * @returns {Promise<string>} "ok", or the code of the refusal.
 * @example
 * await api.writer.writeAfterAwait(); // "ok"
 */
export const writeAfterAwait = () =>
	attempt(async () => {
		await null;
		self.madeAsync = { a() {} };
	});

/**
 * Read a member of `self` after an `await`.
 * @function readAfterAwait
 * @memberof module:api_test_load_nested.inner.writer
 * @returns {Promise<string>} The type of the member read, or the code of the refusal.
 * @example
 * await api.writer.readAfterAwait(); // "function"
 */
export async function readAfterAwait() {
	try {
		await null;
		return typeof self.other.ping;
	} catch (error) {
		return error.code ?? String(error);
	}
}

/**
 * Delete a member of `self` after an `await`.
 * @function removeAfterAwait
 * @memberof module:api_test_load_nested.inner.writer
 * @returns {Promise<string>} "ok", or the code of the refusal.
 * @example
 * await api.writer.removeAfterAwait(); // "ok"
 */
export const removeAfterAwait = () =>
	attempt(async () => {
		self.gone = { a() {} };
		await null;
		delete self.gone;
	});

/**
 * Define a member of `self` after an `await`.
 * @function defineAfterAwait
 * @memberof module:api_test_load_nested.inner.writer
 * @returns {Promise<string>} "ok", or the code of the refusal.
 * @example
 * await api.writer.defineAfterAwait(); // "ok"
 */
export const defineAfterAwait = () =>
	attempt(async () => {
		await null;
		Object.defineProperty(self, "defined", { value: { a() {} }, configurable: true, enumerable: true, writable: true });
	});
