/**
 *
 *	@Project: @cldmv/slothlet
 *	@Filename: /api_tests/api_test_nested_self_assign/shared/symbol-writes.mjs
 *	@Date: 2026-10-18T21:05:19-07:00 (1792382719)
 *	@Author: Nate Corcoran <CLDMV>
 *	@Email: <Shinrai@users.noreply.github.com>
 *	-----
 *	@Last modified by: Nate Corcoran <CLDMV> (Shinrai@users.noreply.github.com)
 *	@Last modified time: 2026-10-18T21:34:35-07:00 (1792384475)
 *	-----
 *	@Copyright: Copyright (c) 2013-2026 Catalyzed Motivation Inc. All rights reserved.
 *
 */

/**
 * @fileoverview Symbol-keyed writes a module makes through `self` (#625), shared by `supplier` and `vault`. Each
 * reports what happened instead of throwing.
 */
import { self } from "@cldmv/slothlet/runtime";

/**
 * The symbol a write uses.
 * @param {"member"|"toPrimitive"} [which="member"] - A registered symbol, or the well-known `Symbol.toPrimitive`.
 * @returns {symbol} The key.
 * @example
 * symbolKey("toPrimitive") === Symbol.toPrimitive; // true
 */
export function symbolKey(which = "member") {
	return which === "toPrimitive" ? Symbol.toPrimitive : Symbol.for("slothlet.test.i625");
}

/**
 * Run a change and report its outcome.
 * @param {function(): *} change - The change.
 * @returns {string} `"done"`, or the error code it was refused with.
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
 * Assign, define, and delete a symbol-keyed member on the node at `apiPath`, read through `self`.
 * @param {string} apiPath - Dotted path of the node.
 * @param {"member"|"toPrimitive"} [which="member"] - The symbol.
 * @returns {{assign: string, define: string, remove: string}} Outcome of each change.
 * @example
 * writeSymbol("callee.ops");
 */
export function writeSymbol(apiPath, which = "member") {
	const node = () => apiPath.split(".").reduce((value, part) => value[part], self);
	const key = symbolKey(which);
	return {
		assign: attempt(() => {
			node()[key] = () => "symbol-member";
		}),
		define: attempt(() => {
			Object.defineProperty(node(), key, { value: () => "symbol-defined", configurable: true, writable: true });
		}),
		remove: attempt(() => {
			if (!delete node()[key]) throw new Error("NOT_DELETED");
		})
	};
}
