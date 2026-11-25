/**
 *
 *	@Project: @cldmv/slothlet
 *	@Filename: /api_tests/api_test_crossing_rules_kin/api/owner.mjs
 *	@Date: 2026-11-15T16:00:00-08:00 (1794787200)
 *	@Author: Nate Corcoran <CLDMV>
 *	@Email: <Shinrai@users.noreply.github.com>
 *	-----
 *	@Last modified by: Nate Corcoran <CLDMV> (Shinrai@users.noreply.github.com)
 *	@Last modified time: 2026-11-24T08:05:13-08:00 (1795536313)
 *	-----
 *	@Copyright: Copyright (c) 2013-2026 Catalyzed Motivation Inc. All rights reserved.
 *
 */

/**
 * @fileoverview One of three files loaded from one folder: exports a class, an instance of it, and functions handing
 * out new instances directly and inside data.
 * @module api_test_crossing_rules/kin/owner
 */

/** A class a node exports. */
export class Base {
	hello() {
		return "base";
	}
}

/** `Base`'s method as it was written. */
const originalHello = Base.prototype.hello;

/** An instance a node exports. */
export const inst = new Base();

/**
 * A new instance.
 * @returns {Base} The instance.
 */
export function make() {
	return new Base();
}

/**
 * A new instance inside data.
 * @returns {{inner: {inst: Base}}} The data.
 */
export function wrap() {
	return { inner: { inst: new Base() } };
}

/**
 * Run a function handed in.
 * @param {Function} fn - The function.
 * @returns {string} `"ran"`.
 */
export function run(fn) {
	fn();
	return "ran";
}

/**
 * Which members whose name starts with `prefix` `Base.prototype` holds, removing each, and whether its method is still
 * the one written (putting it back).
 * @param {string} prefix - The prefix.
 * @returns {string[]} The rest of each key found, `"hello"` when the method was replaced, and `"inst"` when the
 *   exported instance was given a method of its own (removing it).
 */
export function landed(prefix) {
	const hit = [];
	for (const key of Reflect.ownKeys(Base.prototype))
		if (typeof key === "string" && key.startsWith(prefix)) {
			hit.push(key.slice(prefix.length));
			delete Base.prototype[key];
		}
	if (Base.prototype.hello !== originalHello) {
		hit.push("hello");
		Base.prototype.hello = originalHello;
	}
	if (Object.hasOwn(inst, "hello")) {
		hit.push("inst");
		delete inst.hello;
	}
	return hit;
}
