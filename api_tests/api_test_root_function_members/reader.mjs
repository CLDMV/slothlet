/**
 *
 *	@Project: @cldmv/slothlet
 *	@Filename: api_tests/api_test_root_function_members/reader.mjs
 *	@Date: 2026-11-15T10:00:00-08:00 (1794765600)
 *	@Author: Nate Corcoran <CLDMV>
 *	@Email: <Shinrai@users.noreply.github.com>
 *	-----
 *	@Last modified by: Nate Corcoran <CLDMV> (Shinrai@users.noreply.github.com)
 *	@Last modified time: 2026-11-28T04:29:31-08:00 (1795868971)
 *	-----
 *	@Copyright: Copyright (c) 2013-2026 Catalyzed Motivation Inc. All rights reserved.
 *
 */

/**
 * @fileoverview A module that reads the api root's own function members, or those of the same folder mounted at a
 * path (`zz`), and reports what each answered.
 * @module api_test_root_function_members.reader
 */
import { self } from "@cldmv/slothlet/runtime";

/**
 * What an attempt answered: `"fn"`, `"object"`, a primitive as a string, or `"threw:<code>"`.
 * @param {function(): *} attempt - The attempt.
 * @returns {string} The outcome.
 */
function outcome(attempt) {
	try {
		const value = attempt();
		if (typeof value === "function") return "fn";
		if (typeof value === "object" && value !== null) return "object";
		return String(value);
	} catch (error) {
		return `threw:${error?.code ?? error?.name}`;
	}
}

/**
 * Read the function members of the root (`at` empty) or of the node at `at`.
 * @function probe
 * @memberof module:api_test_root_function_members.reader
 * @param {string} at - `""` for the api root, or the mount's key.
 * @returns {Record<string, string>} What each read answered.
 * @example
 * api.reader.probe(""); // { prototype: "object", … }
 */
export function probe(at) {
	const node = at === "" ? self : self[at];
	return {
		prototype: outcome(() => node.prototype),
		constructorTag: outcome(() => node.prototype.constructor.tag),
		constructorRun: outcome(() => node.prototype.constructor(1, 2)),
		name: outcome(() => node.name),
		length: outcome(() => node.length),
		source: outcome(() => node.toString().slice(0, 15)),
		call: outcome(() => node.call(null, 1, 2)),
		apply: outcome(() => node.apply(null, [1, 2])),
		bind: outcome(() => node.bind(null, 1)(2)),
		describePrototype: outcome(() => (Object.getOwnPropertyDescriptor(node, "prototype") ? "described" : "none")),
		describeName: outcome(() => (Object.getOwnPropertyDescriptor(node, "name") ? "described" : "none"))
	};
}
