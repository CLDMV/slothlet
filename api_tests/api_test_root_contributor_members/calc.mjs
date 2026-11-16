/**
 *
 *	@Project: @cldmv/slothlet
 *	@Filename: /api_tests/api_test_root_contributor_members/calc.mjs
 *	@Date: 2026-11-14T00:00:00-08:00 (1794643200)
 *	@Author: Nate Corcoran <CLDMV>
 *	@Email: <Shinrai@users.noreply.github.com>
 *	-----
 *	@Last modified by: Nate Corcoran <CLDMV> (Shinrai@users.noreply.github.com)
 *	@Last modified time: 2026-11-14T00:00:00-08:00 (1794643200)
 *	-----
 *	@Copyright: Copyright (c) 2013-2026 Catalyzed Motivation Inc. All rights reserved.
 *
 */

/**
 * @fileoverview The root's only file with a default-export function: the api root calls it, and its named exports
 * are members of the root (`api.add`, `api.peek`, `api.me`, `api.cfg.f`).
 * @module api_test_root_contributor_members/calc
 */
import { self } from "@cldmv/slothlet/runtime";

/**
 * The node `at` names, read through `self` (the instance's root when `at` is empty).
 * @param {string} at - Dotted path from the root, or "".
 * @returns {object} The node.
 */
function under(at) {
	return at ? at.split(".").reduce((node, key) => node[key], self) : self;
}

/**
 * Adds two numbers.
 * @param {number} a - First.
 * @param {number} b - Second.
 * @returns {number} The sum.
 */
export function add(a, b) {
	return a + b;
}

/**
 * Reads the vault placed beside this file.
 * @param {string} at - Where this folder is placed ("" at the root).
 * @returns {Promise<string>} The vault's secret.
 */
export async function peek(at) {
	return await under(at).vault.get();
}

/**
 * The path this function records for itself.
 * @returns {string|undefined} Its recorded api path.
 */
export function me() {
	return self.slothlet.metadata.self()?.apiPath;
}

/** A namespace member with a function of its own. */
export const cfg = {
	/**
	 * Returns a marker.
	 * @returns {string} The marker.
	 */
	f() {
		return "cfg.f";
	}
};

/**
 * The root's own function.
 * @param {number} a - First.
 * @param {number} b - Second.
 * @returns {number} The product.
 */
function calc(a, b) {
	return a * b;
}

export default calc;
