/**
 *
 *	@Project: @cldmv/slothlet
 *	@Filename: /api_tests/api_test_private_order/tool.mjs
 *	@Date: 2026-11-25T11:33:17-08:00 (1795635197)
 *	@Author: Nate Corcoran <CLDMV>
 *	@Email: <Shinrai@users.noreply.github.com>
 *	-----
 *	@Last modified by: Nate Corcoran <CLDMV> (Shinrai@users.noreply.github.com)
 *	@Last modified time: 2026-11-25T11:50:25-08:00 (1795636225)
 *	-----
 *	@Copyright: Copyright (c) 2013-2026 Catalyzed Motivation Inc. All rights reserved.
 *
 */

/**
 * @fileoverview A file whose private members another mount of the same folder must not reach. Each export reaches a
 * member at a dotted api path through `self`, so the caller is a leaf of this very file.
 * @module api_test_private_order/tool
 */
import { self } from "@cldmv/slothlet/runtime";

/** @type {number} */
export const _value = 41;

/**
 * A private function.
 * @param {string} x - Any text.
 * @returns {string} The text, marked.
 */
export function _secret(x) {
	return `secret:${x}`;
}

/**
 * A public function.
 * @param {string} x - Any text.
 * @returns {string} The text, marked.
 */
export function pub(x) {
	return `pub:${x}`;
}

/**
 * The member at a dotted path.
 * @param {string} path - Dotted api path.
 * @returns {*} The member.
 */
const at = (path) => path.split(".").reduce((node, key) => node[key], self);

/**
 * Call the member at a path.
 * @param {string} path - Dotted api path.
 * @param {...*} args - Arguments.
 * @returns {Promise<{value: *, error: string|null}>} The result or the refusal's code.
 */
export async function callAt(path, ...args) {
	try {
		return { value: await at(path)(...args), error: null };
	} catch (error) {
		return { value: undefined, error: error?.code ?? String(error) };
	}
}

/**
 * Read the member at a path.
 * @param {string} path - Dotted api path.
 * @returns {Promise<{value: *, error: string|null}>} The value (a function as its type) or the refusal's code.
 */
export async function readAt(path) {
	try {
		const value = await at(path);
		return { value: typeof value === "function" ? "function" : value, error: null };
	} catch (error) {
		return { value: undefined, error: error?.code ?? String(error) };
	}
}

/**
 * Write the member at a path.
 * @param {string} path - Dotted api path.
 * @param {*} value - The value to write.
 * @returns {Promise<{value: *, error: string|null}>} `true` when written, or the refusal's code.
 */
export async function writeAt(path, value) {
	try {
		const cut = path.lastIndexOf(".");
		at(path.slice(0, cut))[path.slice(cut + 1)] = value;
		return { value: true, error: null };
	} catch (error) {
		return { value: undefined, error: error?.code ?? String(error) };
	}
}
