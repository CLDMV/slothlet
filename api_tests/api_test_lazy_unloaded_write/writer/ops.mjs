/**
 *
 *	@Project: @cldmv/slothlet
 *	@Filename: /api_tests/api_test_lazy_unloaded_write/writer/ops.mjs
 *	@Date: 2026-11-03T08:00:39-08:00 (1793721639)
 *	@Author: Nate Corcoran <CLDMV>
 *	@Email: <Shinrai@users.noreply.github.com>
 *	-----
 *	@Last modified by: Nate Corcoran <CLDMV> (Shinrai@users.noreply.github.com)
 *	@Last modified time: 2026-11-04T00:58:31-08:00 (1793782711)
 *	-----
 *	@Copyright: Copyright (c) 2013-2026 Catalyzed Motivation Inc. All rights reserved.
 *
 */

/**
 * @fileoverview Another module writing the holder's nested node through `self` (#653). Mounted twice, as `writer` and
 * as `intruder`, so a test can grant the write to one and not the other.
 */
import { self } from "@cldmv/slothlet/runtime";

/**
 * Run a change and report its outcome.
 * @param {function(): *} change - The change.
 * @returns {string} `"done"`, or the code it was refused with.
 * @example
 * attempt(() => {}); // "done"
 */
function attempt(change) {
	try {
		change();
		return "done";
	} catch (error) {
		return error?.code ?? error?.name ?? String(error);
	}
}

/**
 * Assign a member on `holder.deep.inner`.
 * @param {string} key - The member's name.
 * @param {*} value - Its value.
 * @returns {string} The outcome.
 * @example
 * assign("byWriter", 1); // "done"
 */
export function assign(key, value) {
	return attempt(() => {
		self.holder.deep.inner[key] = value;
	});
}

/**
 * Load `holder.deep.inner` by awaiting it.
 * @returns {Promise<boolean>} Whether it loaded with its leaf.
 * @example
 * await touch(); // true
 */
export async function touch() {
	const inner = await self.holder.deep.inner;
	return typeof inner.leaf === "function";
}

/**
 * Close `holder.deep.inner` with `Object.freeze`, `Object.seal`, or `Object.preventExtensions`.
 * @param {"freeze"|"seal"|"preventExtensions"} kind - How to close it.
 * @returns {string} The outcome.
 * @example
 * close("freeze"); // "done"
 */
export function close(kind) {
	return attempt(() => Object[kind](self.holder.deep.inner));
}

/**
 * Define a callable `then` on `holder.deep.inner`.
 * @returns {string} The outcome.
 * @example
 * defineThen(); // "API_MEMBER_THEN_RESERVED"
 */
export function defineThen() {
	return attempt(() => Object.defineProperty(self.holder.deep.inner, "then", { value: () => {} }));
}

/**
 * Whether `holder.deep.inner` has a member, as this module sees it.
 * @param {string} key - The member's name.
 * @returns {boolean} Whether `key in` the node.
 * @example
 * peek("byWriter"); // true
 */
export function peek(key) {
	return key in self.holder.deep.inner;
}
