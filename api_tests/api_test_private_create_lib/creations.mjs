/**
 *
 *	@Project: @cldmv/slothlet
 *	@Filename: /api_tests/api_test_private_create_lib/creations.mjs
 *	@Date: 2026-11-18T18:18:34-08:00 (1795054714)
 *	@Author: Nate Corcoran <CLDMV>
 *	@Email: <Shinrai@users.noreply.github.com>
 *	-----
 *	@Last modified by: Nate Corcoran <CLDMV> (Shinrai@users.noreply.github.com)
 *	@Last modified time: 2026-11-18T18:27:21-08:00 (1795055241)
 *	-----
 *	@Copyright: Copyright (c) 2013-2026 Catalyzed Motivation Inc. All rights reserved.
 *
 */

/**
 * @fileoverview Every way plain JS creates a member on a module's node, and the matching read of it, shared by the
 * modules of `api_test_private_create` and by the plain-JS twin the test compares them with.
 *
 * Each creation takes the node (a module's namespace node, reached through `self`, or a plain object holding the same
 * exports) and the member name; each read takes the same and answers what the member holds.
 */

/** Descriptor for a created data member. */
const DATA = { value: 1, writable: true, enumerable: true, configurable: true };

/**
 * Every way of creating a member, by name.
 * @type {Record<string, function(object, string): void>}
 */
export const CREATIONS = {
	set: (node, key) => {
		node[key] = 1;
	},
	define: (node, key) => {
		Object.defineProperty(node, key, DATA);
	},
	reflectSet: (node, key) => {
		if (!Reflect.set(node, key, 1)) throw new Error("NOT_SET");
	},
	reflectDefine: (node, key) => {
		if (!Reflect.defineProperty(node, key, DATA)) throw new Error("NOT_DEFINED");
	},
	functionOwn: (node, key) => {
		node.fn[key] = 1;
	},
	classPrototype: (node, key) => {
		node.Box.prototype[key] = 1;
	},
	instancePrototype: (node, key) => {
		Object.getPrototypeOf(node.inst)[key] = 1;
	},
	protoAccessor: (node, key) => {
		node.inst.__proto__[key] = 1;
	}
};

/**
 * The read of the member each creation makes, by the creation's name.
 * @type {Record<string, function(object, string): *>}
 */
export const READS = {
	set: (node, key) => node[key],
	define: (node, key) => node[key],
	reflectSet: (node, key) => Reflect.get(node, key),
	reflectDefine: (node, key) => Reflect.get(node, key),
	functionOwn: (node, key) => node.fn[key],
	classPrototype: (node, key) => node.Box.prototype[key],
	instancePrototype: (node, key) => Object.getPrototypeOf(node.inst)[key],
	protoAccessor: (node, key) => node.inst.__proto__[key]
};

/** The creations, by name. */
export const HOWS = Object.keys(CREATIONS);

/**
 * Run a step and report its outcome.
 * @param {function(): *} step - The step.
 * @returns {string} `"done"`, the step's result as a string when it returns one, or the error code it was refused with.
 * @example
 * attempt(() => {}); // "done"
 */
export function attempt(step) {
	try {
		const result = step();
		return result === undefined ? "done" : String(result);
	} catch (error) {
		return error?.code ?? error?.name ?? String(error);
	}
}

/**
 * Create a member on a node.
 * @param {object} node - The node.
 * @param {string} how - The creation, a key of {@link CREATIONS}.
 * @param {string} key - The member name.
 * @returns {string} Its outcome.
 * @example
 * create({}, "set", "x"); // "done"
 */
export function create(node, how, key) {
	return attempt(() => CREATIONS[how](node, key));
}

/**
 * Read a member made by a creation.
 * @param {object} node - The node.
 * @param {string} how - The creation, a key of {@link READS}.
 * @param {string} key - The member name.
 * @returns {string} What it holds, as a string, or the error code the read was refused with.
 * @example
 * read({ x: 1 }, "set", "x"); // "1"
 */
export function read(node, how, key) {
	return attempt(() => String(READS[how](node, key)));
}
