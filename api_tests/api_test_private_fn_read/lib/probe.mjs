/**
 *
 *	@Project: @cldmv/slothlet
 *	@Filename: /api_tests/api_test_private_fn_read/lib/probe.mjs
 *	@Date: 2026-11-25T12:06:48-08:00 (1795637208)
 *	@Author: Nate Corcoran <CLDMV>
 *	@Email: <Shinrai@users.noreply.github.com>
 *	-----
 *	@Last modified by: Nate Corcoran <CLDMV> (Shinrai@users.noreply.github.com)
 *	@Last modified time: 2026-11-25T12:20:24-08:00 (1795638024)
 *	-----
 *	@Copyright: Copyright (c) 2013-2026 Catalyzed Motivation Inc. All rights reserved.
 *
 */

/**
 * @fileoverview What a reader learns of a member it reaches through `self`: the read itself, and the member's key on
 * the node holding it.
 * @module api_test_private_fn_read/lib/probe
 */
import { inspect } from "node:util";

/**
 * Run one attempt, as its value or the refusal's code.
 * @param {Function} fn - The attempt.
 * @returns {{value: *, error: string|null}} The outcome.
 */
const attempt = (fn) => {
	try {
		return { value: fn(), error: null };
	} catch (error) {
		return { value: undefined, error: error?.code ?? String(error) };
	}
};

/**
 * The node at a dotted path.
 * @param {object} root - Where the path starts.
 * @param {string} path - Dotted path.
 * @returns {*} The node.
 */
const walk = (root, path) => path.split(".").reduce((node, key) => node[key], root);

/**
 * Probe a member.
 * @param {object} self - The reader's `self`.
 * @param {string} path - Dotted api path of the member.
 * @returns {object} One outcome per attempt; a function read is reported by its type, its source and what it holds.
 */
export function probe(self, path) {
	const cut = path.lastIndexOf(".");
	const key = path.slice(cut + 1);
	const parent = walk(self, path.slice(0, cut));
	const read = attempt(() => walk(self, path));
	const value = read.value;
	return {
		read: { value: typeof value === "function" ? "function" : value, error: read.error },
		reflectGet: attempt(() => typeof Reflect.get(parent, key)),
		listed: Object.keys(parent).includes(key),
		ownKeys: Reflect.ownKeys(parent).map(String).includes(key),
		described: Object.getOwnPropertyDescriptor(parent, key) !== undefined,
		spread: Object.keys({ ...parent }).includes(key),
		inspected: inspect(parent, { depth: 0 }),
		source: typeof value === "function" ? attempt(() => Function.prototype.toString.call(value)).value : undefined,
		held: typeof value === "function" ? attempt(() => value.label).value : undefined
	};
}

/**
 * Call the member at a path.
 * @param {object} self - The caller's `self`.
 * @param {string} path - Dotted api path.
 * @param {...*} args - Arguments.
 * @returns {Promise<{value: *, error: string|null}>} The result or the refusal's code.
 */
export async function callAt(self, path, ...args) {
	try {
		return { value: await walk(self, path)(...args), error: null };
	} catch (error) {
		return { value: undefined, error: error?.code ?? String(error) };
	}
}
