/**
 *
 *	@Project: @cldmv/slothlet
 *	@Filename: /api_tests/api_test_self_closed/lib/operations.mjs
 *	@Date: 2026-11-25T01:30:04-08:00 (1795599004)
 *	@Author: Nate Corcoran <CLDMV>
 *	@Email: <Shinrai@users.noreply.github.com>
 *	-----
 *	@Last modified by: Nate Corcoran <CLDMV> (Shinrai@users.noreply.github.com)
 *	@Last modified time: 2026-11-25T01:36:58-08:00 (1795599418)
 *	-----
 *	@Copyright: Copyright (c) 2013-2026 Catalyzed Motivation Inc. All rights reserved.
 *
 */

/**
 * @fileoverview Each operation the language has on an object, done on a closed api root (the host's `api`, or a
 * module's `self`), with what it gave: membership, the keys, each member's descriptor flags, reads, writes,
 * definitions, deletions, the prototype, closing it again, and a call and a construction of the root.
 */

/**
 * What an operation gives: its value, or the kind of error it threw.
 * @param {function(): *} run - The operation.
 * @returns {{value: *}|{threw: string}} The outcome.
 */
const outcome = (run) => {
	try {
		return { value: run() };
	} catch (error) {
		return { threw: error?.constructor?.name ?? String(error) };
	}
};

/**
 * A descriptor's flags, without its value or accessors.
 * @param {PropertyDescriptor|undefined} descriptor - The descriptor.
 * @returns {object|undefined} Its flags.
 */
const flags = (descriptor) =>
	descriptor === undefined
		? undefined
		: {
				configurable: descriptor.configurable,
				enumerable: descriptor.enumerable,
				writable: descriptor.writable,
				data: "value" in descriptor
			};

/**
 * Each operation on a closed root of a function, as it answers.
 * @param {Function} root - The root.
 * @param {boolean} [write=true] - Whether to try `Reflect.set` of a new member too.
 * @returns {Record<string, *>} What each operation gave.
 */
export function operations(root, write = true) {
	const done = {
		hasMember: outcome(() => "math" in root),
		hasMissing: outcome(() => "missing" in root),
		keys: outcome(() => Reflect.ownKeys(root).map(String).sort()),
		described: outcome(() =>
			Object.fromEntries(Reflect.ownKeys(root).map((key) => [String(key), flags(Reflect.getOwnPropertyDescriptor(root, key))]))
		),
		describeMissing: outcome(() => flags(Reflect.getOwnPropertyDescriptor(root, "missing"))),
		readMember: outcome(() => typeof root.math?.add),
		readMissing: outcome(() => root.missing),
		define: outcome(() => Reflect.defineProperty(root, "added", { value: 1, configurable: true, writable: true, enumerable: true })),
		readAssigned: outcome(() => root.assigned),
		remove: outcome(() => Reflect.deleteProperty(root, "missing")),
		prototype: outcome(() => Reflect.getPrototypeOf(root) === Function.prototype),
		samePrototype: outcome(() => Reflect.setPrototypeOf(root, Function.prototype)),
		otherPrototype: outcome(() => Reflect.setPrototypeOf(root, null)),
		closeAgain: outcome(() => Reflect.preventExtensions(root)),
		extensible: outcome(() => Object.isExtensible(root)),
		call: outcome(() => root(21)),
		construct: outcome(() => typeof new root(21))
	};
	if (write) done.set = outcome(() => Reflect.set(root, "assigned", 1));
	return done;
}
