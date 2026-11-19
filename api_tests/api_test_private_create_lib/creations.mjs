/**
 *
 *	@Project: @cldmv/slothlet
 *	@Filename: /api_tests/api_test_private_create_lib/creations.mjs
 *	@Date: 2026-11-18T18:18:34-08:00 (1795054714)
 *	@Author: Nate Corcoran <CLDMV>
 *	@Email: <Shinrai@users.noreply.github.com>
 *	-----
 *	@Last modified by: Nate Corcoran <CLDMV> (Shinrai@users.noreply.github.com)
 *	@Last modified time: 2026-11-18T21:57:34-08:00 (1795067854)
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
 * The routes to the prototype of the node's class, by name: the class's `prototype`, and an instance's prototype
 * through `Object.getPrototypeOf` and through `__proto__`.
 * @type {Record<string, function(object): object>}
 */
export const PROTOTYPES = {
	classPrototype: (node) => node.Box.prototype,
	instancePrototype: (node) => Object.getPrototypeOf(node.inst),
	protoAccessor: (node) => node.inst.__proto__
};

/** The prototype routes, by name. */
export const PROTOTYPE_ROUTES = Object.keys(PROTOTYPES);

/**
 * What a prototype reached by a route lists and describes of its own members: `Object.keys`, a spread, a
 * `JSON.stringify`, `Object.getOwnPropertyNames`, and the descriptor of each of the named members, each listing kept to
 * the named members.
 * @param {object} node - The node.
 * @param {string} route - The route, a key of {@link PROTOTYPES}.
 * @param {string[]} names - The members whose descriptors are described.
 * @returns {string} The listing, as JSON, or the error code it was refused with.
 * @example
 * list(node, "classPrototype", ["__hidden"]);
 */
export function list(node, route, names) {
	return attempt(() => {
		const prototype = PROTOTYPES[route](node);
		const described = {};
		for (const name of names) {
			const descriptor = Object.getOwnPropertyDescriptor(prototype, name);
			described[name] = descriptor === undefined ? "none" : { value: descriptor.value, enumerable: descriptor.enumerable };
		}
		// Only the named members are compared: a member another case created on the same prototype is left aside.
		const named = (keys) => keys.filter((key) => names.includes(key));
		return JSON.stringify({
			keys: named(Object.keys(prototype)),
			spread: named(Object.keys({ ...prototype })),
			json: named(Object.keys(JSON.parse(JSON.stringify(prototype)))),
			names: named(Object.getOwnPropertyNames(prototype)),
			described
		});
	});
}

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
