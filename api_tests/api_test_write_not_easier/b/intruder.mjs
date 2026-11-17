/**
 *
 *	@Project: @cldmv/slothlet
 *	@Filename: /api_tests/api_test_write_not_easier/b/intruder.mjs
 *	@Date: 2026-11-17T07:36:48-08:00 (1794929808)
 *	@Author: Nate Corcoran <CLDMV>
 *	@Email: <Shinrai@users.noreply.github.com>
 *	-----
 *	@Last modified by: Nate Corcoran <CLDMV> (Shinrai@users.noreply.github.com)
 *	@Last modified time: 2026-11-17T07:55:49-08:00 (1794930949)
 *	-----
 *	@Copyright: Copyright (c) 2013-2026 Catalyzed Motivation Inc. All rights reserved.
 *
 */

/**
 * @fileoverview The second module mounted at `p`: it calls, reads and writes the first module's members, and its
 * own, reporting each outcome.
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
 * Answer who answered, for the second module.
 * @returns {string} `"b"`.
 * @example
 * mine(); // "b"
 */
export function mine() {
	return "b";
}

/**
 * Call and read the first module's members.
 * @returns {Record<string, string>} Outcome of each access.
 * @example
 * access();
 */
export function access() {
	return {
		call: attempt(() => self.p.shared.who()),
		read: attempt(() => String(self.p.shared.count)),
		construct: attempt(() => new self.p.shared.Box().label())
	};
}

/**
 * One write to another module's member, by its name.
 * @type {Record<string, function(): *>}
 */
const WRITES = {
	assign: () => {
		self.p.shared.who = () => "b";
	},
	define: () => {
		Object.defineProperty(self.p.shared, "who", { value: () => "b", configurable: true, writable: true, enumerable: true });
	},
	remove: () => {
		if (!delete self.p.shared.who) throw new Error("NOT_DELETED");
	},
	held: () => {
		const node = self.p.shared;
		node.who = () => "b";
	},
	data: () => {
		self.p.shared.count = 2;
	},
	prototype: () => {
		self.p.shared.Box.prototype.label = () => "b-box";
	},
	reflect: () => {
		if (!Reflect.set(self.p.shared, "who", () => "b")) throw new Error("NOT_SET");
	}
};

/**
 * Make one write to the first module's members.
 * @param {string} name - The write, a key of WRITES.
 * @returns {string} Its outcome.
 * @example
 * write("assign");
 */
export function write(name) {
	return attempt(WRITES[name]);
}

/**
 * Add a member that does not exist yet.
 * @param {string} where - `"node"` for one on the first module's node, `"mount"` for one at the shared mount point,
 *   `"own"` for one on the second module's own node.
 * @returns {string} Its outcome.
 * @example
 * add("mount");
 */
export function add(where) {
	return attempt(() => {
		if (where === "node") self.p.shared.extra = () => "b";
		else if (where === "mount") self.p.extra = () => "b";
		else self.p.intruder.extra = () => "b";
	});
}

/**
 * Replace the second module's own member.
 * @returns {string} Its outcome.
 * @example
 * writeOwn();
 */
export function writeOwn() {
	return attempt(() => {
		self.p.intruder.mine = () => "b2";
	});
}

/**
 * Mount a folder through `api.add` from module code, forcing past what is there.
 * @param {string} apiPath - Where to mount it.
 * @param {string} folder - The folder.
 * @returns {Promise<string>} `"done"`, or the error code it was refused with.
 * @example
 * await addAt("p.shared", folder);
 */
export async function addAt(apiPath, folder) {
	try {
		await self.slothlet.api.add(apiPath, folder, { id: "B-over", collision: { force: true } });
		return "done";
	} catch (error) {
		return error?.code ?? String(error);
	}
}

/**
 * Remove a path through `api.remove` from module code.
 * @param {string} apiPath - The path.
 * @returns {Promise<string>} `"done"`, or the error code it was refused with.
 * @example
 * await removeAt("p.shared.who");
 */
export async function removeAt(apiPath) {
	try {
		await self.slothlet.api.remove(apiPath);
		return "done";
	} catch (error) {
		return error?.code ?? String(error);
	}
}

/**
 * One write that replaces, redefines or deletes a node holding the first module's members, by its name.
 * @type {Record<string, function(): *>}
 */
const CONTAINER_WRITES = {
	assign: () => {
		self.p.shared = { who: () => "b" };
	},
	define: () => {
		Object.defineProperty(self.p, "shared", { value: { who: () => "b" }, configurable: true, writable: true, enumerable: true });
	},
	remove: () => {
		if (!delete self.p.shared) throw new Error("NOT_DELETED");
	},
	mount: () => {
		self.p = { shared: { who: () => "b" } };
	}
};

/**
 * Make one write to a node holding the first module's members.
 * @param {string} name - The write, a key of CONTAINER_WRITES.
 * @returns {string} Its outcome.
 * @example
 * containerWrite("assign");
 */
export function containerWrite(name) {
	return attempt(CONTAINER_WRITES[name]);
}

/**
 * One write that replaces, redefines, deletes or freezes a node holding the first module's data values, by its name.
 * @type {Record<string, function(): *>}
 */
const HOLDER_WRITES = {
	assign: () => {
		self.p.shared = { count: 2 };
	},
	define: () => {
		Object.defineProperty(self.p, "shared", { value: { count: 2 }, configurable: true, writable: true, enumerable: true });
	},
	remove: () => {
		if (!delete self.p.shared) throw new Error("NOT_DELETED");
	},
	data: () => {
		self.p.shared.data = { v: 2 };
	},
	freeze: () => {
		Object.freeze(self.p.shared);
	},
	mount: () => {
		if (!delete self.p) throw new Error("NOT_DELETED");
	}
};

/**
 * Make one write to a node holding the first module's data values.
 * @param {string} name - The write, a key of HOLDER_WRITES.
 * @returns {string} Its outcome.
 * @example
 * holderWrite("assign");
 */
export function holderWrite(name) {
	return attempt(HOLDER_WRITES[name]);
}

/**
 * Read one of the first module's data values.
 * @param {string} name - `count`, `v` (`data.v`), `when` or `table`.
 * @returns {string} `"done"`, or the error code the read was refused with.
 * @example
 * read("count");
 */
export function read(name) {
	return attempt(() => {
		if (name === "v") void self.p.shared.data.v;
		else if (name === "when") void self.p.shared.when.getTime();
		else if (name === "table") void self.p.shared.table.get("k");
		else void self.p.shared[name];
	});
}

/**
 * Replace the second module's own node.
 * @returns {string} Its outcome.
 * @example
 * containerWriteOwn();
 */
export function containerWriteOwn() {
	return attempt(() => {
		self.p.intruder = { mine: () => "b2" };
	});
}

/**
 * One write that shadows a member the first module's values inherit, by its name.
 * @type {Record<string, function(): *>}
 */
const SHADOW_WRITES = {
	call: () => {
		self.p.shared.who.call = () => "b";
	},
	push: () => {
		self.p.shared.data.list.push = () => "b";
	},
	toJSON: () => {
		self.p.shared.data.toJSON = () => "b";
	},
	toString: () => {
		self.p.shared.Box.prototype.toString = () => "b";
	}
};

/**
 * Shadow one inherited member of the first module's values.
 * @param {string} name - The write, a key of SHADOW_WRITES.
 * @returns {string} Its outcome.
 * @example
 * shadowWrite("call");
 */
export function shadowWrite(name) {
	return attempt(SHADOW_WRITES[name]);
}
