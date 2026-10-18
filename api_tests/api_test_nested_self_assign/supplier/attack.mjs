/**
 *
 *	@Project: @cldmv/slothlet
 *	@Filename: /api_tests/api_test_nested_self_assign/supplier/attack.mjs
 *	@Date: 2026-10-17T21:07:21-07:00 (1792296441)
 *	@Author: Nate Corcoran <CLDMV>
 *	@Email: <Shinrai@users.noreply.github.com>
 *	-----
 *	@Last modified by: Nate Corcoran <CLDMV> (Shinrai@users.noreply.github.com)
 *	@Last modified time: 2026-10-18T01:51:34-07:00 (1792313494)
 *	-----
 *	@Copyright: Copyright (c) 2013-2026 Catalyzed Motivation Inc. All rights reserved.
 *
 */

// Mounted at apiPath "supplier" (moduleID "supplier") by the nested self-assign ownership tests (#625).
// Each export tries a write below the top level of `self`: into another module's subtree (refused for
// an `api.add`ed module), or into its own (allowed).
import { self } from "@cldmv/slothlet/runtime";

/**
 * Replace a member of the callee module's subtree.
 * @returns {void}
 */
export function replaceCalleeMember() {
	self.callee.ops.useSecret = () => "pwned";
}

/**
 * Plant a new member directly under the callee module's mount point.
 * @returns {void}
 */
export function plantOnCallee() {
	self.callee.planted = () => self.vault.secret.secret();
}

/**
 * Write a primitive below the callee module's mount point.
 * @returns {void}
 */
export function writeCalleePrimitive() {
	self.callee.ops.flag = "set-by-supplier";
}

/**
 * Write below this module's own mount point.
 * @param {*} value - Value to write.
 * @returns {*} The value read back through `self`.
 */
export function writeOwnNested(value) {
	self.supplier.attack.note = value;
	return self.supplier.attack.note;
}

/**
 * Write a new namespace below this module's own mount point.
 * @param {*} value - Value to write.
 * @returns {*} The value read back through `self`.
 */
export function writeOwnNamespace(value) {
	self.supplier.extra = { value };
	return self.supplier.extra.value;
}

/**
 * Define a member of the callee module's subtree with `Object.defineProperty`.
 * @returns {void}
 */
export function defineOnCallee() {
	Object.defineProperty(self.callee.ops, "useSecret", {
		value: () => "pwned-by-define",
		writable: true,
		enumerable: true,
		configurable: true
	});
}

/**
 * Remove a member of the callee module's subtree.
 * @returns {void}
 */
export function deleteFromCallee() {
	delete self.callee.ops.useSecret;
}

/**
 * Mount a folder under the callee module's mount point through the framework's own `api.add`.
 * @param {string} folderPath - Folder to mount.
 * @returns {Promise<string>} The type of the mounted node.
 */
export async function addUnderCallee(folderPath) {
	await self.slothlet.api.add("callee.extra", folderPath, { moduleID: "callee-extra" });
	return typeof self.callee.extra;
}

/**
 * Write a symbol-keyed member on the callee module's node: a symbol is never an api path.
 * @returns {boolean} Whether the member reads back.
 */
export function writeCalleeSymbol() {
	const key = Symbol.for("slothlet.test.i625");
	self.callee.ops[key] = "symbol-member";
	return self.callee.ops[key] === "symbol-member";
}

/**
 * Start an `api.add` of its own, under its own mount point, without awaiting it, and write into
 * another module's subtree while the add is still in flight.
 * @param {string} folderPath - Folder to mount at `supplier.sub`.
 * @param {boolean} [afterAwait=false] - Yield once before writing.
 * @returns {Promise<void>}
 */
export async function addThenWrite(folderPath, afterAwait = false) {
	const pending = self.slothlet.api.add("supplier.sub", folderPath, { moduleID: "supplier-sub" });
	let refused = null;
	try {
		if (afterAwait) await null;
		self.callee.ops.useSecret = () => "pwned-during-add";
	} catch (error) {
		refused = error;
	}
	await pending;
	if (refused) throw refused;
}

/**
 * Start an `api.remove` that fails, without awaiting it, and write into another module's subtree
 * while it is in flight.
 * @returns {Promise<void>}
 */
export async function failingRemoveThenWrite() {
	const pending = Promise.resolve(self.slothlet.api.remove("no.such.mount")).catch(() => null);
	let refused = null;
	try {
		self.callee.ops.useSecret = () => "pwned-during-remove";
	} catch (error) {
		refused = error;
	}
	await pending;
	if (refused) throw refused;
}

/**
 * One leaf, two jobs, so two invocations of it run at once: `"add"` mounts a folder under its own
 * mount point; `"write"` writes into another module's subtree.
 * @param {"add"|"write"} job - Which job this invocation does.
 * @param {string} [folderPath] - Folder to mount for `"add"`.
 * @returns {Promise<*>}
 */
export async function dual(job, folderPath) {
	if (job === "add") return self.slothlet.api.add("supplier.dual", folderPath, { moduleID: "supplier-dual" });
	self.callee.ops.useSecret = () => "pwned-by-sibling-call";
}

let lurking = false;

/**
 * Keep trying to replace another module's member, one event-loop turn at a time, until it lands or
 * {@link stopLurk} is called.
 * @returns {Promise<string>} `"landed"` when a write got through, else `"refused"`.
 */
export async function lurk() {
	lurking = true;
	while (lurking) {
		await new Promise((resolve) => setImmediate(resolve));
		try {
			self.callee.ops.useSecret = () => "pwned-during-build";
			return "landed";
		} catch {
			// Refused; try again next turn.
		}
	}
	return "refused";
}

/**
 * Stop {@link lurk}.
 * @returns {void}
 */
export function stopLurk() {
	lurking = false;
}

/**
 * Give another module's array member a prototype of this module's choosing.
 * @returns {void}
 */
export function protoOnCalleeList() {
	Object.setPrototypeOf(self.callee.ops.list, { injected: () => "pwned-by-proto" });
}

/**
 * Give another module's namespace a prototype of this module's choosing.
 * @returns {void}
 */
export function protoOnCallee() {
	Object.setPrototypeOf(self.callee.ops, { injected: () => "pwned-by-proto" });
}

/**
 * Make another module's namespace non-extensible.
 * @returns {void}
 */
export function preventExtensionsOnCallee() {
	Object.preventExtensions(self.callee.ops);
}

/**
 * Freeze another module's namespace.
 * @returns {void}
 */
export function freezeCallee() {
	Object.freeze(self.callee.ops);
}

/**
 * Capture another module's namespace and hand back a function that writes into it later, outside
 * any call into this module.
 * @returns {Function} The deferred write.
 */
export function captureCallee() {
	const ops = self.callee.ops;
	return () => {
		ops.useSecret = () => "pwned-later";
	};
}

/**
 * Capture `self` itself and hand back a function that writes through it later (the top-level
 * counterpart of {@link captureCallee}).
 * @returns {Function} The deferred write.
 */
export function captureSelf() {
	const captured = self;
	return () => {
		captured.callee.ops.useSecret = () => "pwned-later";
	};
}

/**
 * Mount a folder under another module's mount point, reload it, and remove it again, each through
 * the framework's own operation.
 * @param {string} folderPath - Folder to mount.
 * @param {string} [apiPath="callee.extra"] - Where to mount it: below `callee`, or at `callee` itself.
 * @returns {Promise<string[]>} What the mounted path held after each step.
 */
export async function addReloadRemoveUnderCallee(folderPath, apiPath = "callee.extra") {
	const read = () => typeof apiPath.split(".").reduce((node, key) => node?.[key], self);
	const seen = [];
	await self.slothlet.api.add(apiPath, folderPath, { moduleID: "callee-extra" });
	seen.push(read());
	await self.slothlet.api.reload(apiPath);
	seen.push(read());
	await self.slothlet.api.remove("callee-extra");
	seen.push(read());
	return seen;
}

/**
 * Mount a folder at a path another module already mounted at, under a third module's mount point,
 * through the framework's own operation.
 * @param {string} apiPath - Where to mount.
 * @param {string} folderPath - Folder to mount.
 * @param {string} moduleID - Module id for the mount.
 * @returns {Promise<void>}
 */
export async function addAt(apiPath, folderPath, moduleID) {
	await self.slothlet.api.add(apiPath, folderPath, { moduleID });
}

/**
 * Read another module's namespace through `self` twice.
 * @returns {boolean} Whether both reads gave the same object.
 */
export function sameNodeTwice() {
	return self.callee.ops === self.callee.ops;
}

/**
 * Store another module's namespace, as read through `self`, under this module's own mount point.
 * @returns {void}
 */
export function storeCalleeRef() {
	self.supplier.ref = self.callee.ops;
}

/**
 * Hand back another module's node, read through `self`.
 * @returns {object} The node.
 */
export function calleeNode() {
	return self.callee.ops;
}

/**
 * Take another module's node from its parent's property descriptor, and hand back a function that
 * writes into it later, outside any call into this module.
 * @param {boolean} [all=false] - Take it from `Object.getOwnPropertyDescriptors` instead.
 * @returns {Function} The deferred write.
 */
export function descriptorLeak(all = false) {
	const ops = all ? Object.getOwnPropertyDescriptors(self.callee).ops.value : Object.getOwnPropertyDescriptor(self.callee, "ops").value;
	return () => {
		ops.useSecret = () => "pwned-by-descriptor";
	};
}

/**
 * Take another module's node as the receiver one of its methods hands back, and hand back a function
 * that writes into it later, outside any call into this module.
 * @param {boolean} [async=false] - Use the method that answers asynchronously.
 * @returns {Promise<Function>} The deferred write.
 */
export async function thisLeak(async = false) {
	const ops = async ? await self.callee.ops.getThisAsync() : self.callee.ops.getThis();
	return () => {
		ops.useSecret = () => "pwned-by-this";
	};
}

/**
 * Call a method of another module on its node that keeps its receiver, and hand the function it returns
 * on: the receiver is that module's own node, which it may write later.
 * @returns {function(*): *} The deferred write.
 */
export function keptOwnReceiver() {
	return self.callee.ops.keepThisWriter();
}

/**
 * Call a method of another module that keeps its receiver with a third module's node as the receiver,
 * and hand the function it returns on.
 * @returns {Function} The deferred write.
 */
export function borrowedReceiver() {
	return self.callee.ops.writerForThis.call(self.vault.secret);
}

/**
 * Compare another module's node, read through `self`, with what that module sees of it.
 * @returns {boolean[]} Its receiver, its return value, and its argument, each compared with its own read.
 */
export function identityChecks() {
	const ops = self.callee.ops;
	return [ops.isThisSelf(), ops.ownNode() === ops, ops.isArgSelf(ops)];
}

/**
 * Take another module's node from what one of its methods returns, and hand back a function that
 * writes into it later, outside any call into this module.
 * @param {"sync"|"async"|"thenable"} how - How the method hands the node back.
 * @returns {Promise<Function>} The deferred write.
 */
export async function returnedNodeLeak(how) {
	const ops = self.callee.ops;
	const node = how === "sync" ? ops.ownNode() : how === "async" ? await ops.ownNodeAsync() : await ops.ownNodeThenable();
	return () => {
		node.useSecret = () => "pwned-by-return";
	};
}

/**
 * Take another module's node from a plain object one of its methods returns, and hand back a function
 * that writes into it later: the module shared it.
 * @returns {function(*): *} The deferred write.
 */
export function containerShare() {
	const { ops } = self.callee.ops.ownNodeInContainer();
	return (value) => {
		ops.shared = value;
		return ops.shared;
	};
}

/**
 * Take a class instance node of another module as the receiver one of its methods hands back, and
 * write into it now and later.
 * @param {"store"|"bus"} name - The instance: a plain class instance or an EventEmitter subclass.
 * @param {boolean} [async=false] - Use the method that answers asynchronously.
 * @returns {Promise<{now: string, later: Function}>} The outcome of the write now, and the deferred write.
 */
export async function instanceLeak(name, async = false) {
	const node = self.svc[name];
	const raw = async ? await node.getThisAsync() : node.getThis();
	let now = "written";
	try {
		raw.secret = "pwned-now";
	} catch (error) {
		now = error.code ?? String(error);
	}
	return {
		now,
		later: () => {
			raw.secret = "pwned-later";
		}
	};
}

/**
 * Keep another module's node, one of its methods, and a third module's node, read through `self`, and
 * hand back functions that later call that method with the third module's node as its receiver.
 * @returns {{member: function(): Function, method: function(): Function}} The deferred calls, through the
 *   node kept and through the method kept; each returns what the method returns.
 */
export function captureBorrow() {
	const ops = self.callee.ops;
	const writerForThis = self.callee.ops.writerForThis;
	const secret = self.vault.secret;
	return {
		member: () => ops.writerForThis.call(secret),
		method: () => writerForThis.call(secret)
	};
}

/**
 * Wait on a gate, then replace a member of the callee module's subtree: a call still in flight when
 * the test removes this module.
 * @param {Promise<void>} gate - Released by the test.
 * @returns {Promise<void>} Settles once the write is made or refused.
 */
export async function writeAfter(gate) {
	await gate;
	self.callee.ops.useSecret = () => "pwned-after-removal";
}

/**
 * Pass another module's node, read through `self`, as an argument to one of its methods that keeps or
 * returns it, take it back, and hand back a function that writes into it later.
 * @param {"box"|"keep"|"boxAsync"} how - Which method takes the argument.
 * @returns {Promise<Function>} The deferred write.
 */
export async function argLeak(how) {
	const ops = self.callee.ops;
	let node;
	if (how === "box") node = ops.box(ops).x;
	else if (how === "keep") {
		ops.keep(ops);
		node = ops.all().at(-1);
	} else node = (await ops.boxAsync(ops))[0];
	return () => {
		node.useSecret = () => "pwned-by-arg";
	};
}

/**
 * Capture, from a `before` hook, the argument another module's method gets, and hand back a function
 * that writes into it later.
 * @returns {Promise<Function>} The deferred write.
 */
export async function hookLeak() {
	let captured = null;
	self.slothlet.hook.on("before:callee.ops.box", ({ args }) => {
		captured = args[0];
	});
	await self.callee.ops.box(self.callee.ops);
	return () => {
		captured.useSecret = () => "pwned-by-hook";
	};
}

/**
 * Call a method of another module with a different node of that module as its receiver, take that
 * receiver back, and hand back a function that writes into it later.
 * @param {"boxThis"|"callWith"} how - Which method hands the receiver back.
 * @returns {Function} The deferred write.
 */
export function steeredThisLeak(how) {
	const ops = self.callee.ops;
	const other = self.callee.other;
	let node;
	if (how === "boxThis") node = ops.boxThis.call(other).t;
	else ops.callWith.call(other, (t) => (node = t));
	return () => {
		node.ping = () => "pwned-by-steered-this";
	};
}

/**
 * What another module keeps and returns of what this module passes it, compared with what it passed.
 * @returns {boolean[]} Whether the kept value and the boxed value are what was passed, for another
 *   module's node and a third module's node.
 */
export function argIdentity() {
	const ops = self.callee.ops;
	const results = [];
	for (const me of [ops, self.vault.secret]) {
		ops.keep(me);
		results.push(ops.all().includes(me), ops.box(me).x === me);
	}
	return results;
}
