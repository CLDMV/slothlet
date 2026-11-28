/**
 *
 *	@Project: @cldmv/slothlet
 *	@Filename: api_tests/api_test_api_root_integrity/writer/ops.mjs
 *	@Date: 2026-11-15T00:00:00-08:00 (1794729600)
 *	@Author: Nate Corcoran <CLDMV>
 *	@Email: <Shinrai@users.noreply.github.com>
 *	-----
 *	@Last modified by: Nate Corcoran <CLDMV> (Shinrai@users.noreply.github.com)
 *	@Last modified time: 2026-11-28T04:27:26-08:00 (1795868846)
 *	-----
 *	@Copyright: Copyright (c) 2013-2026 Catalyzed Motivation Inc. All rights reserved.
 *
 */

/**
 * @fileoverview Changes the api, at the root or at a node, through `self`, the api `self.slothlet.diag.api()` hands
 * a module, or an api the host handed it, and answers what each change gave.
 * @module api_test_api_root_integrity/writer/ops
 */

import { self } from "@cldmv/slothlet/runtime";

/**
 * The node at a dotted path, from a root.
 * @param {object} root - Where to start.
 * @param {string} path - The path; empty for the root.
 * @returns {*} The node.
 */
function at(root, path) {
	let node = root;
	for (const segment of path ? path.split(".") : []) node = node[segment];
	return node;
}

/**
 * A descriptor as a comparable description: its attributes, and whether it holds a value.
 * @param {PropertyDescriptor|undefined} descriptor - The descriptor.
 * @returns {object|null} Its description.
 */
function shape(descriptor) {
	if (!descriptor) return null;
	const { value, get, set, ...attributes } = descriptor;
	return { ...attributes, value: "value" in descriptor ? typeof value : undefined, get: typeof get, set: typeof set };
}

/** Each change, applied to a node, answering what it gave. */
const CHANGES = {
	set: (node) => {
		node.wset = 1;
		return { value: node.wset };
	},
	setReserved: (node) => {
		node.shutdown = 1;
		return { value: typeof node.shutdown };
	},
	setSymbol: (node) => {
		node[Symbol.for("slothlet-root-integrity")] = 1;
		return { value: node[Symbol.for("slothlet-root-integrity")] };
	},
	define: (node) => {
		Object.defineProperty(node, "wdef", { value: 2, writable: true, enumerable: true, configurable: true });
		return { value: node.wdef, descriptor: shape(Object.getOwnPropertyDescriptor(node, "wdef")) };
	},
	defineFixed: (node) => {
		Object.defineProperty(node, "wfix", { value: 3, writable: false, enumerable: true, configurable: false });
		return { value: node.wfix, descriptor: shape(Object.getOwnPropertyDescriptor(node, "wfix")) };
	},
	delete: (node) => {
		const deleted = delete node.data;
		return { deleted, has: "data" in node };
	},
	freeze: (node) => {
		Object.freeze(node);
		return { frozen: Object.isFrozen(node), extensible: Object.isExtensible(node) };
	},
	seal: (node) => {
		Object.seal(node);
		return { sealed: Object.isSealed(node), frozen: Object.isFrozen(node) };
	},
	preventExtensions: (node) => {
		Object.preventExtensions(node);
		return { extensible: Object.isExtensible(node) };
	},
	setPrototypeOf: (node) => {
		const prototype = { inherited: 5 };
		Object.setPrototypeOf(node, prototype);
		return { same: Object.getPrototypeOf(node) === prototype, inherited: node.inherited };
	}
};

/** The names of the changes. */
export const names = () => Object.keys(CHANGES);

/**
 * Make one change and answer what it gave, or the code of what it threw.
 * @param {string} name - The change.
 * @param {"self"|"api"|"given"} via - Through `self`, `self.slothlet.diag.api()`, or the api handed in.
 * @param {string} path - The node's path; empty for the root.
 * @param {object} [given] - The api the host handed in.
 * @returns {object} The answer.
 */
export function change(name, via, path, given) {
	const root = via === "given" ? given : via === "api" ? self.slothlet.diag.api() : self;
	try {
		return CHANGES[name](at(root, path));
	} catch (error) {
		return { threw: error?.code ?? error?.name ?? "threw" };
	}
}

/**
 * The root, or the prototype it reports to this module, any number of links up.
 * @param {"self"|"api"|"given"} via - Through `self`, `self.slothlet.diag.api()`, or the api handed in.
 * @param {object} given - The api the host handed in.
 * @param {number} links - `0` for the root, or how many links up its prototypes.
 * @returns {*} The value.
 */
function rootOrPrototype(via, given, links) {
	let value = via === "given" ? given : via === "api" ? self.slothlet.diag.api() : self;
	for (let i = 0; i < links; i++) value = Object.getPrototypeOf(value);
	return value;
}

/**
 * Read a member from the root, or from the prototype the root reports to this module.
 * @param {"self"|"api"|"given"} via - How the root is reached.
 * @param {string} name - The member's name.
 * @param {object} given - The api the host handed in.
 * @param {number} links - `0` for the root, or how many links up its prototypes.
 * @returns {*} The member, or `{ code, message }` when the read was refused.
 */
export function protoRead(via, name, given, links) {
	try {
		return rootOrPrototype(via, given, links)[name];
	} catch (error) {
		return { code: error?.code ?? error?.name, message: String(error?.message) };
	}
}

/**
 * Read a member the same way, as another leaf of the module.
 * @param {"self"|"api"|"given"} via - How the root is reached.
 * @param {string} name - The member's name.
 * @param {object} given - The api the host handed in.
 * @param {number} links - `0` for the root, or how many links up its prototypes.
 * @returns {*} The member, or `{ code, message }` when the read was refused.
 */
export function protoPeek(via, name, given, links) {
	try {
		return rootOrPrototype(via, given, links)[name];
	} catch (error) {
		return { code: error?.code ?? error?.name, message: String(error?.message) };
	}
}

/**
 * What the prototype the root reports to this module lists, and whether it is the given object.
 * @param {"self"|"api"|"given"} via - How the root is reached.
 * @param {object} given - The api the host handed in.
 * @param {object} prototype - The object the root was given.
 * @param {string[]} names - Names to ask for one by one.
 * @returns {object} What it shows.
 */
export function protoListed(via, given, prototype, names) {
	try {
		const root = rootOrPrototype(via, given, 0);
		const view = Object.getPrototypeOf(root);
		const forIn = [];
		for (const name in root) if (names.includes(name)) forIn.push(name);
		return {
			same: view === prototype,
			stable: view === Object.getPrototypeOf(root) && view === root.__proto__,
			keys: Object.keys(view),
			ownKeys: Reflect.ownKeys(view),
			forIn,
			spread: Object.keys({ ...view }),
			json: JSON.stringify(view),
			has: names.map((name) => name in view),
			described: names.map((name) => Object.getOwnPropertyDescriptor(view, name) !== undefined)
		};
	} catch (error) {
		return { code: error?.code ?? error?.name, message: String(error?.message) };
	}
}

/**
 * Write a member onto the prototype the root reports to this module.
 * @param {"self"|"api"|"given"} via - How the root is reached.
 * @param {object} given - The api the host handed in.
 * @returns {string} `"done"`, or the code or name of what it threw.
 */
export function protoWrite(via, given) {
	try {
		rootOrPrototype(via, given, 1).written = 1;
		return "done";
	} catch (error) {
		return error?.code ?? error?.name ?? "threw";
	}
}

/**
 * The names the prototype the root reports to this module lists as its own.
 * @param {"self"|"api"|"given"} via - How the root is reached.
 * @param {object} given - The api the host handed in.
 * @returns {string[]|{code: string}} The names.
 */
export function protoKeys(via, given) {
	try {
		return Object.keys(rootOrPrototype(via, given, 1));
	} catch (error) {
		return { code: error?.code ?? error?.name };
	}
}

/**
 * What this module lists of the object members `nothing` and `partly` the root inherits from the prototype it reports.
 * @param {"self"|"api"|"given"} via - How the root is reached.
 * @param {object} given - The api the host handed in.
 * @returns {object} What it lists, or `{ code, message }`.
 */
export function protoObjects(via, given) {
	try {
		const root = rootOrPrototype(via, given, 0);
		const view = Object.getPrototypeOf(root);
		const forIn = [];
		for (const name in root) if (name === "nothing" || name === "partly") forIn.push(name);
		return {
			keys: Object.keys(view),
			ownKeys: Reflect.ownKeys(view).filter((key) => typeof key === "string"),
			forIn,
			spread: Object.keys({ ...view }),
			json: JSON.stringify(view),
			has: ["nothing" in view, "partly" in view, "nothing" in root],
			partly: [view.partly.a, Object.keys(view.partly)]
		};
	} catch (error) {
		return { code: error?.code ?? error?.name, message: String(error?.message) };
	}
}
