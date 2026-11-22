/**
 *
 *	@Project: @cldmv/slothlet
 *	@Filename: /api_tests/api_test_handed_builtin_writes/guest/guest.mjs
 *	@Date: 2026-11-21T13:00:26-08:00 (1795294826)
 *	@Author: Nate Corcoran <CLDMV>
 *	@Email: <Shinrai@users.noreply.github.com>
 *	-----
 *	@Last modified by: Nate Corcoran <CLDMV> (Shinrai@users.noreply.github.com)
 *	@Last modified time: 2026-11-21T15:06:51-08:00 (1795302411)
 *	-----
 *	@Copyright: Copyright (c) 2013-2026 Catalyzed Motivation Inc. All rights reserved.
 *
 */

/**
 * @fileoverview A module with no write rule of its own: it hands built-ins, bound to a write or with their target, to
 * other modules to run, and makes the same writes itself.
 * @module api_test_handed_builtin_writes/guest
 */

import util from "node:util";
import { self } from "@cldmv/slothlet/runtime";

const replacement = () => "replaced";
const replacement2 = () => "replaced again";

/**
 * The node at a dotted api path, read through `self`.
 * @param {string} path - The path.
 * @returns {object} The node.
 */
function at(path) {
	let node = self;
	for (const part of path.split(".")) node = node[part];
	return node;
}

/**
 * Each write, as the guest makes it itself (`direct`) and as the built-in it hands the runner (`handed`).
 * @type {Record<string, {direct: function(object): *, handed: function(object, object): *}>}
 */
const WRITES = {
	protoBound: {
		direct: (owner) => Object.assign(owner.Box.prototype, { planted1: replacement }),
		handed: (owner, runner) => runner.runCb(Object.assign.bind(null, owner.Box.prototype, { planted1: replacement }))
	},
	instanceProtoBound: {
		direct: (owner) => Object.assign(Object.getPrototypeOf(owner.makeBox()), { planted2: replacement }),
		handed: (owner, runner) => runner.runCb(Object.assign.bind(null, Object.getPrototypeOf(owner.makeBox()), { planted2: replacement }))
	},
	itemProtoBound: {
		direct: (owner) => Object.assign(Object.getPrototypeOf(owner.makeItem()), { planted13: replacement }),
		handed: (owner, runner) => runner.runCb(Object.assign.bind(null, Object.getPrototypeOf(owner.makeItem()), { planted13: replacement }))
	},
	itemDunderBound: {
		direct: (owner) => Object.assign(owner.makeItem().__proto__, { planted8: replacement }),
		handed: (owner, runner) => runner.runCb(Object.assign.bind(null, owner.makeItem().__proto__, { planted8: replacement }))
	},
	newItemProtoBound: {
		direct: (owner) => Object.assign(Object.getPrototypeOf(new owner.Item()), { planted9: replacement }),
		handed: (owner, runner) => runner.runCb(Object.assign.bind(null, Object.getPrototypeOf(new owner.Item()), { planted9: replacement }))
	},
	protoUnbound: {
		direct: (owner) => Reflect.set(owner.Box.prototype, "planted3", replacement),
		handed: (owner, runner) => runner.runCb(Reflect.set, owner.Box.prototype, "planted3", replacement)
	},
	protoNodeHelper: {
		direct: (owner) => util._extend(owner.Box.prototype, { planted4: replacement }),
		handed: (owner, runner) => runner.runCb(util._extend, owner.Box.prototype, { planted4: replacement })
	},
	methodBound: {
		direct: (owner) => Object.assign(owner.Box.prototype, { method: replacement }),
		handed: (owner, runner) => runner.runCb(Object.assign.bind(null, owner.Box.prototype, { method: replacement }))
	},
	nodeBound: {
		direct: (owner) => Reflect.set(owner, "open", "W"),
		handed: (owner, runner) => runner.runCb(Reflect.set.bind(null, owner, "open", "W"))
	},
	nodeUnbound: {
		direct: (owner) => Reflect.set(owner, "open", "W2"),
		handed: (owner, runner) => runner.runCb(Reflect.set, owner, "open", "W2")
	},
	fnBound: {
		direct: (owner) => Reflect.set(owner, "fn", replacement),
		handed: (owner, runner) => runner.runCb(Reflect.set.bind(null, owner, "fn", replacement))
	},
	fnDefineBound: {
		direct: (owner) => Object.defineProperty(owner, "fn", { value: replacement2, configurable: true, writable: true, enumerable: true }),
		handed: (owner, runner) =>
			runner.runCb(
				Object.defineProperty.bind(null, owner, "fn", { value: replacement2, configurable: true, writable: true, enumerable: true })
			)
	},
	deleteBound: {
		direct: (owner) => Reflect.deleteProperty(owner, "open"),
		handed: (owner, runner) => runner.runCb(Reflect.deleteProperty.bind(null, owner, "open"))
	},
	secretBound: {
		direct: (owner) => Reflect.set(owner, "secret", "W"),
		handed: (owner, runner) => runner.runCb(Reflect.set.bind(null, owner, "secret", "W"))
	},
	secretUnbound: {
		direct: (owner) => Reflect.set(owner, "secret", "W2"),
		handed: (owner, runner) => runner.runCb(Reflect.set, owner, "secret", "W2")
	}
};

/**
 * Writes to an instance another module made that are its code: replacing a method its prototype holds, and replacing its
 * prototype. Each is made on a fresh instance of a class with no private member, so it changes nothing another write
 * sees and is decided as a write, never as a read of a private member.
 * @type {Record<string, {direct: function(object): *, handed: function(object, object): *}>}
 */
const INSTANCE_WRITES = {
	instanceMethod: {
		direct: (owner) => {
			owner.makeItem().method = replacement;
		},
		handed: (owner, runner) => runner.runCb(Reflect.set.bind(null, owner.makeItem(), "method", replacement))
	},
	newInstanceMethod: {
		direct: (owner) => {
			new owner.Item().method = replacement;
		},
		handed: (owner, runner) => runner.runCb(Reflect.set, new owner.Item(), "method", replacement)
	},
	instanceSetProto: {
		direct: (owner) => {
			Object.setPrototypeOf(owner.makeItem(), {});
		},
		handed: (owner, runner) => runner.runCb(Object.setPrototypeOf.bind(null, owner.makeItem(), {}))
	}
};

/**
 * Make a write and report how it ended.
 * @param {function(): *} write - The write.
 * @returns {string} `"done"`, or `"threw <code>"`.
 */
function attempt(write) {
	try {
		write();
		return "done";
	} catch (error) {
		return `threw ${error?.code ?? error?.name}`;
	}
}

/**
 * Make one of the writes on the module at `ownerPath` itself.
 * @param {string} name - The write.
 * @param {string} ownerPath - The module written.
 * @returns {string} How it ended.
 */
export function direct(name, ownerPath) {
	return attempt(() => WRITES[name].direct(at(ownerPath)));
}

/**
 * Hand one of the writes, as a built-in, to the module at `runnerPath` to run.
 * @param {string} name - The write.
 * @param {string} ownerPath - The module written.
 * @param {string} runnerPath - The module that runs it.
 * @returns {string} How it ended.
 */
export function handed(name, ownerPath, runnerPath) {
	return attempt(() => WRITES[name].handed(at(ownerPath), at(runnerPath)));
}

/**
 * Make one of the instance writes itself.
 * @param {string} name - The write.
 * @param {string} ownerPath - The module whose instance is written.
 * @returns {string} How it ended.
 */
export function instanceDirect(name, ownerPath) {
	return attempt(() => INSTANCE_WRITES[name].direct(at(ownerPath)));
}

/**
 * Hand one of the instance writes, as a built-in, to the module at `runnerPath` to run.
 * @param {string} name - The write.
 * @param {string} ownerPath - The module whose instance is written.
 * @param {string} runnerPath - The module that runs it.
 * @returns {string} How it ended.
 */
export function instanceHanded(name, ownerPath, runnerPath) {
	return attempt(() => INSTANCE_WRITES[name].handed(at(ownerPath), at(runnerPath)));
}

/**
 * Data written on an instance another module made stays the writer's to change.
 * @param {string} ownerPath - The module whose instance is written.
 * @returns {*} The member as read back, or `"threw <code>"`.
 */
export function instanceData(ownerPath) {
	try {
		const item = at(ownerPath).makeItem();
		item.extra = 1;
		item.v = 2;
		return `${item.extra},${item.v}`;
	} catch (error) {
		return `threw ${error?.code ?? error?.name}`;
	}
}

/**
 * Each way of reading a member private to the module through one of its instances.
 * @type {Record<string, function(object): *>}
 */
const PRIVATE_READS = {
	newData: (owner) => new owner.Box()._pdata,
	madeData: (owner) => owner.makeBox()._pdata,
	madeReflect: (owner) => Reflect.get(owner.makeBox(), "_pdata"),
	newMethod: (owner) => new owner.Box()._priv(),
	madeMethod: (owner) => owner.makeBox()._priv(),
	proto: (owner) => owner.Box.prototype._pdata
};

/**
 * Read a member private to the module at `ownerPath` through one of its instances.
 * @param {string} how - The route.
 * @param {string} ownerPath - The module.
 * @returns {*} What was read, or `"threw <code>"`.
 */
export function readPrivate(how, ownerPath) {
	try {
		return PRIVATE_READS[how](at(ownerPath));
	} catch (error) {
		return `threw ${error?.code ?? error?.name}`;
	}
}

/**
 * Read a public member through an instance of the module at `ownerPath`.
 * @param {string} ownerPath - The module.
 * @returns {string} What its method returned, read through an instance it made and one constructed through its class.
 */
export function readPublic(ownerPath) {
	const owner = at(ownerPath);
	return `${owner.makeBox().method()},${new owner.Box().method()}`;
}

/**
 * Hand the owner `Reflect.set` to run on its own prototype.
 * @param {string} ownerPath - The module written.
 * @returns {string} How it ended.
 */
export function handedOnOwnProto(ownerPath) {
	return attempt(() => at(ownerPath).runOnProto(Reflect.set, "planted5", replacement));
}

/**
 * Hand `Reflect.set`, bound to a write of the guest's own node, to the module at `runnerPath` to run.
 * @param {string} runnerPath - The module that runs it.
 * @returns {string} How it ended.
 */
export function handedOwnWrite(runnerPath) {
	return attempt(() => at(runnerPath).runCb(Reflect.set.bind(null, self.guest, "mine", "W")));
}

/** @returns {*} The guest's own member, as it reads it. */
export function readMine() {
	return self.guest.mine;
}

/**
 * Hand `Reflect.get`, bound to a read, to the module at `runnerPath` to run.
 * @param {string} ownerPath - The module read.
 * @param {string} runnerPath - The module that runs it.
 * @returns {*} What it read, or `"threw <code>"`.
 */
export function handedRead(ownerPath, runnerPath) {
	try {
		return at(runnerPath).runCb(Reflect.get.bind(null, at(ownerPath), "open"));
	} catch (error) {
		return `threw ${error?.code ?? error?.name}`;
	}
}

/**
 * Hand an unbound built-in that only reads to the module at `runnerPath` to run.
 * @param {string} runnerPath - The module that runs it.
 * @returns {*} What it returned.
 */
export function handedPure(runnerPath) {
	return at(runnerPath).runCb(Math.max, 1, 5, 3);
}

/**
 * Hand the owner `Reflect.set` and ask whether it stands for `Reflect.set`.
 * @returns {boolean} The owner's answer.
 */
export function handedIsReflectSet() {
	return self.owner.isReflectSet(Reflect.set);
}

/**
 * Hand the module at `runnerPath` a promise's `then` and a bound built-in for it to call back later: the write the
 * callback makes is held to the guest when it runs.
 * @param {string} ownerPath - The module written.
 * @param {string} runnerPath - The module that runs it.
 * @returns {Promise<string>} How it ended.
 */
export async function handedDeferred(ownerPath, runnerPath) {
	const owner = at(ownerPath);
	try {
		await at(runnerPath).runCb(
			Function.prototype.call.bind(Promise.prototype.then),
			Promise.resolve([owner.Box.prototype, "planted6", replacement]),
			Function.prototype.apply.bind(Reflect.set, null)
		);
		return "done";
	} catch (error) {
		return `threw ${error?.code ?? error?.name}`;
	}
}

let deferredOutcome = "pending";

/**
 * {@link handedDeferred} from a call that returns at once: the callback runs after the guest's call has ended.
 * @param {string} ownerPath - The module written.
 * @param {string} runnerPath - The module that runs it.
 * @returns {string} `"scheduled"`; {@link deferredResult} reads how it ended.
 */
export function handedDeferredDetached(ownerPath, runnerPath) {
	deferredOutcome = "pending";
	const owner = at(ownerPath);
	at(runnerPath)
		.runCb(
			Function.prototype.call.bind(Promise.prototype.then),
			Promise.resolve([owner.Box.prototype, "planted7", replacement]),
			Function.prototype.apply.bind(Reflect.set, null)
		)
		.then(
			() => {
				deferredOutcome = "done";
			},
			(error) => {
				deferredOutcome = `threw ${error?.code ?? error?.name}`;
			}
		);
	return "scheduled";
}

/** @returns {string} How the detached callback ended. */
export function deferredResult() {
	return deferredOutcome;
}
