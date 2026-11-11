/**
 * @fileoverview A file at the root of the base folder whose default export is a function: the api itself is callable.
 * @module api_test_toplevel_callable_root/root
 */

/**
 * The api called as a function.
 * @returns {string} `"root"`.
 */
export default function root() {
	return "root";
}

export const extra = () => "extra";
