/**
 *
 *	@Project: @cldmv/slothlet
 *	@Filename: /api_tests/api_test_run_prototype_writes/prober/p.mjs
 *	@Date: 2026-11-18T00:00:00-08:00 (1794988800)
 *	@Author: Nate Corcoran <CLDMV>
 *	@Email: <Shinrai@users.noreply.github.com>
 *	-----
 *	@Last modified by: Nate Corcoran <CLDMV> (Shinrai@users.noreply.github.com)
 *	@Last modified time: 2026-11-18T19:28:00-08:00 (1795058880)
 *	-----
 *	@Copyright: Copyright (c) 2013-2026 Catalyzed Motivation Inc. All rights reserved.
 *
 */

/**
 * @fileoverview Changes another module's class prototype and node shape through `self`, reporting what it sees. The
 * `…On` functions take the class or object to change, so the same steps run on plain objects as the reference.
 */
import { self } from "@cldmv/slothlet/runtime";

/**
 * Run a change and report its outcome.
 * @param {function(): *} change - The change.
 * @returns {string} `"done"`, or the error code it was refused with.
 * @example
 * attempt(() => {}); // "done"
 */
function attempt(change) {
	try {
		change();
		return "done";
	} catch (error) {
		return error?.code ?? error?.name ?? String(error);
	}
}

/**
 * Write a class's prototype, then make an instance and read the write back through it.
 * @param {Function} Account - The class.
 * @returns {Record<string, *>} What was seen.
 * @example
 * classWritesOn(class {});
 */
export function classWritesOn(Account) {
	const prototype = Account.prototype;
	const out = {};
	out.write = attempt(() => {
		prototype.granted = 1;
	});
	out.readBack = prototype.granted;
	out.readAgain = Account.prototype.granted;
	const instance = new Account();
	out.instanceRead = instance.granted;
	out.instanceOf = instance instanceof Account;
	out.prototypeOfInstance = Object.getPrototypeOf(instance) === Account.prototype;
	out.balance = instance.balance();
	out.label = instance.label;
	out.addMethod = attempt(() => {
		prototype.added = function added() {
			return this.balance() + 1;
		};
	});
	out.added = attempt(() => instance.added()) === "done" ? instance.added() : "NOT_CALLABLE";
	out.ownField = attempt(() => {
		instance.own = 2;
	});
	out.ownRead = instance.own;
	out.ownHasOwn = Object.hasOwn(instance, "own");
	out.prototypeOwn = Object.hasOwn(prototype, "own");
	out.remove = attempt(() => {
		if (!delete prototype.granted) throw new Error("NOT_DELETED");
	});
	out.afterRemove = instance.granted;
	return out;
}

/**
 * Change an object's prototype and close it, reading each change back.
 * @param {object} conf - The object.
 * @returns {Record<string, *>} What was seen.
 * @example
 * shapeChangesOn({});
 */
export function shapeChangesOn(conf) {
	const given = { tag: "given" };
	const out = {};
	out.sameProto = attempt(() => Object.setPrototypeOf(conf, Object.getPrototypeOf(conf)));
	out.otherProto = attempt(() => Object.setPrototypeOf(conf, given));
	out.protoIsGiven = Object.getPrototypeOf(conf) === given;
	out.inherited = conf.tag;
	out.level = conf.level;
	out.preventExtensions = attempt(() => Object.preventExtensions(conf));
	out.extensible = Object.isExtensible(conf);
	out.seal = attempt(() => Object.seal(conf));
	out.freeze = attempt(() => Object.freeze(conf));
	out.frozen = Object.isFrozen(conf);
	out.add = attempt(() => {
		conf.extra = 1;
	});
	out.extra = conf.extra;
	return out;
}

/**
 * {@link classWritesOn} on the victim's class, read through `self`.
 * @returns {Record<string, *>} What was seen.
 * @example
 * classWrites();
 */
export function classWrites() {
	return classWritesOn(self.victim.v.Account);
}

/**
 * {@link shapeChangesOn} on the victim's `conf` node, read through `self`.
 * @returns {Record<string, *>} What was seen.
 * @example
 * shapeChanges();
 */
export function shapeChanges() {
	return shapeChangesOn(self.victim.v.conf);
}

/**
 * Whether an instance the victim makes is an instance of the class as read through `self`.
 * @returns {boolean} The answer.
 * @example
 * madeIsInstance(); // true
 */
export function madeIsInstance() {
	return self.victim.v.makeAccount() instanceof self.victim.v.Account;
}
