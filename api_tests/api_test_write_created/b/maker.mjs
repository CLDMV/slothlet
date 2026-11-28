/**
 *
 *	@Project: @cldmv/slothlet
 *	@Filename: api_tests/api_test_write_created/b/maker.mjs
 *	@Date: 2026-11-17T11:57:13-08:00 (1794945433)
 *	@Author: Nate Corcoran <CLDMV>
 *	@Email: <Shinrai@users.noreply.github.com>
 *	-----
 *	@Last modified by: Nate Corcoran <CLDMV> (Shinrai@users.noreply.github.com)
 *	@Last modified time: 2026-11-28T04:30:13-08:00 (1795869013)
 *	-----
 *	@Copyright: Copyright (c) 2013-2026 Catalyzed Motivation Inc. All rights reserved.
 *
 */

/**
 * @fileoverview The second module mounted at `p`: it writes beneath the first module's data, and creates, reads,
 * replaces and deletes members of its own, reporting each outcome.
 */
import { self } from "@cldmv/slothlet/runtime";

/**
 * Run a step and report its outcome.
 * @param {function(): *} step - The step.
 * @returns {string} `"done"` or the step's result, or the error code it was refused with.
 * @example
 * attempt(() => {}); // "done"
 */
function attempt(step) {
	try {
		const result = step();
		return typeof result === "string" ? result : "done";
	} catch (error) {
		return error?.code ?? error?.name ?? String(error);
	}
}

/**
 * One write beneath the first module's `data`, by its name.
 * @type {Record<string, function(): *>}
 */
const DATA_WRITES = {
	assign: () => {
		self.p.store.data.x = 2;
	},
	define: () => {
		Object.defineProperty(self.p.store.data, "x", { value: 2, configurable: true, writable: true, enumerable: true });
	},
	remove: () => {
		if (!delete self.p.store.data.x) throw new Error("NOT_DELETED");
	},
	reflect: () => {
		if (!Reflect.set(self.p.store.data, "x", 2)) throw new Error("NOT_SET");
	},
	held: () => {
		const data = self.p.store.data;
		data.x = 2;
	},
	nested: () => {
		self.p.store.data.nested.y = 3;
	},
	heldNested: () => {
		const nested = self.p.store.data.nested;
		nested.y = 3;
	},
	create: () => {
		self.p.store.data.fresh = 1;
	}
};

/**
 * Make one write beneath the first module's `data`.
 * @param {string} name - The write, a key of DATA_WRITES.
 * @returns {string} Its outcome.
 * @example
 * dataWrite("assign");
 */
export function dataWrite(name) {
	return attempt(DATA_WRITES[name]);
}

/**
 * Read beneath the first module's `data`, and beneath its `plain`.
 * @returns {{data: string, nested: string, plain: string}} What each read gave, or the error code it was refused with.
 * @example
 * dataRead();
 */
export function dataRead() {
	return {
		data: attempt(() => String(self.p.store.data.x)),
		nested: attempt(() => String(self.p.store.data.nested.y)),
		plain: attempt(() => String(self.p.store.plain.z))
	};
}

/**
 * Write beneath the first module's `plain`, which no rule names.
 * @returns {string} Its outcome.
 * @example
 * plainWrite();
 */
export function plainWrite() {
	return attempt(() => {
		self.p.store.plain.z = 2;
	});
}

/**
 * The node a member is created on.
 * @param {string} where - `"mount"` for the shared mount point `p`, `"node"` for the first module's node `p.store`,
 *   `"own"` for the second module's own node `p.maker`.
 * @returns {object} The node.
 * @example
 * holder("mount"); // self.p
 */
function holder(where) {
	if (where === "mount") return self.p;
	if (where === "node") return self.p.store;
	return self.p.maker;
}

/**
 * The value a member is created with, by its kind.
 * @type {Record<string, function(): *>}
 */
const KINDS = {
	value: () => 1,
	fn: () => () => "made",
	obj: () => ({ v: 1 })
};

/**
 * One way of creating a member, by its name.
 * @type {Record<string, function(object, *): *>}
 */
const CREATES = {
	assign: (node, value) => {
		node.made = value;
	},
	define: (node, value) => {
		Object.defineProperty(node, "made", { value, configurable: true, writable: true, enumerable: true });
	},
	reflect: (node, value) => {
		if (!Reflect.set(node, "made", value)) throw new Error("NOT_SET");
	}
};

/**
 * Create the member `made`, which does not exist yet.
 * @param {string} where - Where (see {@link holder}).
 * @param {string} kind - `"value"`, `"fn"` or `"obj"`.
 * @param {string} [route="assign"] - How: a key of CREATES.
 * @returns {string} Its outcome.
 * @example
 * create("mount", "value");
 */
export function create(where, kind, route = "assign") {
	return attempt(() => CREATES[route](holder(where), KINDS[kind]()));
}

/**
 * Read the member `made` back.
 * @param {string} where - Where it was created.
 * @returns {string} What it holds, or the error code the read was refused with.
 * @example
 * readMade("mount");
 */
export function readMade(where) {
	return attempt(() => {
		const value = holder(where).made;
		if (typeof value === "function") return String(value());
		if (value !== null && typeof value === "object") return String(value.v);
		return String(value);
	});
}

/**
 * Replace the member `made`.
 * @param {string} where - Where it was created.
 * @returns {string} Its outcome.
 * @example
 * replaceMade("mount");
 */
export function replaceMade(where) {
	return attempt(() => {
		holder(where).made = 2;
	});
}

/**
 * Delete the member `made`.
 * @param {string} where - Where it was created.
 * @returns {string} Its outcome.
 * @example
 * deleteMade("mount");
 */
export function deleteMade(where) {
	return attempt(() => {
		if (!delete holder(where).made) throw new Error("NOT_DELETED");
	});
}
