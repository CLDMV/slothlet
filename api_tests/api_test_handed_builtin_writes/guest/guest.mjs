/**
 *
 *	@Project: @cldmv/slothlet
 *	@Filename: /api_tests/api_test_handed_builtin_writes/guest/guest.mjs
 *	@Date: 2026-11-21T13:00:26-08:00 (1795294826)
 *	@Author: Nate Corcoran <CLDMV>
 *	@Email: <Shinrai@users.noreply.github.com>
 *	-----
 *	@Last modified by: Nate Corcoran <CLDMV> (Shinrai@users.noreply.github.com)
 *	@Last modified time: 2026-11-21T13:27:04-08:00 (1795296424)
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
