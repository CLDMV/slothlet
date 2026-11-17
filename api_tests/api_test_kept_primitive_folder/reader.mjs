/**
 *
 *	@Project: @cldmv/slothlet
 *	@Filename: /api_tests/api_test_kept_primitive_folder/reader.mjs
 *	@Date: 2026-11-15T11:02:58-08:00 (1794769378)
 *	@Author: Nate Corcoran <CLDMV>
 *	@Email: <Shinrai@users.noreply.github.com>
 *	-----
 *	@Last modified by: Nate Corcoran <CLDMV> (Shinrai@users.noreply.github.com)
 *	@Last modified time: 2026-11-15T12:38:44-08:00 (1794775124)
 *	-----
 *	@Copyright: Copyright (c) 2013-2026 Catalyzed Motivation Inc. All rights reserved.
 *
 */

import { self } from "@cldmv/slothlet/runtime";

/** What this module read of `zz` before each folder loaded, by name. */
const held = {};

/**
 * Read a member of `zz` through `self` and keep it.
 * @param {string} key - The member's name.
 * @returns {true|{threw: string}} True, or the code the read was refused with.
 */
export function take(key) {
	try {
		held[key] = self.zz[key];
		return true;
	} catch (error) {
		return { threw: error?.code ?? error?.name ?? "threw" };
	}
}

/**
 * Wait for a member of `zz` to load, through the node kept by `take`.
 * @param {string} key - The member's name.
 * @returns {Promise<*>} What the await gave, as `answers` reports a value.
 */
export async function settle(key) {
	try {
		return report(await held[key]);
	} catch (error) {
		return { threw: error?.code ?? error?.name ?? "threw" };
	}
}

/**
 * A value as the test compares it: a symbol by its description, a bigint as a string.
 * @param {*} value - The value.
 * @returns {*} The report.
 */
function report(value) {
	if (typeof value === "symbol") return { symbol: value.description };
	if (typeof value === "bigint") return { bigint: String(value) };
	if (value !== null && (typeof value === "object" || typeof value === "function")) return { node: true };
	return value;
}

/**
 * What the kept member (or a fresh read) answers to the coercions plain JavaScript makes of a value.
 * @param {string} key - The member's name.
 * @param {boolean} [fresh=false] - Read the member again instead of using the kept one.
 * @returns {object} The answers.
 */
export function answers(key, fresh = false) {
	return answersOf(fresh ? self.zz[key] : held[key]);
}

/**
 * What a value answers to the coercions plain JavaScript makes of it.
 * @param {*} node - The value, or a node standing for one.
 * @returns {object} The answers.
 */
export function answersOf(node) {
	const answer = (check) => {
		try {
			return report(check());
		} catch (error) {
			return { threw: error?.code ?? error?.name ?? "threw" };
		}
	};
	return {
		valueOf: answer(() => node.valueOf()),
		template: answer(() => `${node}`),
		string: answer(() => (typeof node.valueOf() === "symbol" ? node.toString() : String(node))),
		json: answer(() => JSON.stringify({ v: node }, (_, v) => (typeof v === "bigint" ? `${v}n` : v))),
		loose: answer(() => node == node.valueOf()),
		type: answer(() => self.slothlet.node(node)?.type)
	};
}
