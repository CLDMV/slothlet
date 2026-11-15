/**
 *
 *	@Project: @cldmv/slothlet
 *	@Filename: /api_tests/api_test_api_root_integrity/writer/ops.mjs
 *	@Date: 2026-11-15T00:00:00-08:00 (1794729600)
 *	@Author: Nate Corcoran <CLDMV>
 *	@Email: <Shinrai@users.noreply.github.com>
 *	-----
 *	@Last modified by: Nate Corcoran <CLDMV> (Shinrai@users.noreply.github.com)
 *	@Last modified time: 2026-11-15T00:00:00-08:00 (1794729600)
 *	-----
 *	@Copyright: Copyright (c) 2013-2026 Catalyzed Motivation Inc. All rights reserved.
 *
 */

/**
 * @fileoverview Changes the api, at the root or at a node, through `self`, the api `self.slothlet.diag.getAPI()` hands
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
 * @param {"self"|"api"|"given"} via - Through `self`, `self.slothlet.diag.getAPI()`, or the api handed in.
 * @param {string} path - The node's path; empty for the root.
 * @param {object} [given] - The api the host handed in.
 * @returns {object} The answer.
 */
export function change(name, via, path, given) {
	const root = via === "given" ? given : via === "api" ? self.slothlet.diag.getAPI() : self;
	try {
		return CHANGES[name](at(root, path));
	} catch (error) {
		return { threw: error?.code ?? error?.name ?? "threw" };
	}
}
