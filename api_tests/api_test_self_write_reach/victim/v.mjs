/**
 *
 *	@Project: @cldmv/slothlet
 *	@Filename: /api_tests/api_test_self_write_reach/victim/v.mjs
 *	@Date: 2026-10-18T18:42:03-07:00 (1792374123)
 *	@Author: Nate Corcoran <CLDMV>
 *	@Email: <Shinrai@users.noreply.github.com>
 *	-----
 *	@Last modified by: Nate Corcoran <CLDMV> (Shinrai@users.noreply.github.com)
 *	@Last modified time: 2026-10-18T19:51:09-07:00 (1792378269)
 *	-----
 *	@Copyright: Copyright (c) 2013-2026 Catalyzed Motivation Inc. All rights reserved.
 *
 */

/**
 * @fileoverview The module whose class, nodes, and members another module tries to change through `self` (#625).
 */
import { self } from "@cldmv/slothlet/runtime";

/**
 * An account class the victim exports. Its prototype is part of the victim's subtree.
 * @example
 * new Account().balance(); // 100
 */
export class Account {
	/**
	 * @returns {number} The balance.
	 * @example
	 * new Account().balance(); // 100
	 */
	balance() {
		return 100;
	}

	/**
	 * @returns {string} A label.
	 * @example
	 * new Account().label; // "account"
	 */
	get label() {
		return "account";
	}
}

// Plain values the class's prototype holds, of the kinds a module reaches through `self`: an array, a function
// that is no constructor, a bound constructor, and a built-in object with internal state.
Account.prototype.kinds = ["basic"];
Account.prototype.arrow = () => 1;
Account.prototype.Bound = function Bound() {}.bind(null);
Account.prototype.registry = new Map();
// A value that is itself a proxy, which declines to be closed to extension.
Account.prototype.stubborn = new Proxy(
	{},
	{
		preventExtensions() {
			return false;
		}
	}
);

/**
 * Configuration the victim exports, with an accessor.
 * @type {{level: number}}
 */
export const conf = {
	/**
	 * @returns {number} The level.
	 */
	get level() {
		return 1;
	}
};

/**
 * Hand back what it was given.
 * @param {*} value - Anything.
 * @returns {*} `value`.
 * @example
 * echo(1); // 1
 */
export function echo(value) {
	return value;
}

/**
 * Put an object under a symbol key on the victim's own node.
 * @returns {void}
 * @example
 * plantSymbolBox();
 */
export function plantSymbolBox() {
	self.victim.v[Symbol.for("slothlet.test.i625.box")] = { n: 1 };
}

/**
 * An instance the victim hands out: data it chose to share (#597).
 * @returns {Account} A new account.
 * @example
 * makeAccount().balance(); // 100
 */
export function makeAccount() {
	return new Account();
}

/**
 * What a new account of the victim's own reports, as the victim sees it.
 * @returns {number} The balance.
 * @example
 * balanceOfNew(); // 100
 */
export function balanceOfNew() {
	return new Account().balance();
}

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
 * The victim changing its own class's prototype through `self`, as plain JS does.
 * @returns {{assign: string, read: number, remove: string}} Outcome of each change and what an account then reports.
 * @example
 * writeOwnPrototype(); // { assign: "done", read: 5, remove: "done" }
 */
export function writeOwnPrototype() {
	const proto = self.victim.v.Account.prototype;
	const assign = attempt(() => {
		proto.bonus = () => 5;
	});
	const read = new Account().bonus();
	const remove = attempt(() => {
		delete proto.bonus;
	});
	return { assign, read, remove };
}

/**
 * The victim writing a symbol-keyed member on its own node through `self`, as plain JS does.
 * @returns {{assign: string, read: *, define: string, remove: string, gone: boolean}} Outcome of each change.
 * @example
 * writeOwnSymbol(); // { assign: "done", read: 1, define: "done", remove: "done", gone: true }
 */
export function writeOwnSymbol() {
	const key = Symbol.for("slothlet.test.i625.own");
	const node = self.victim.v;
	const assign = attempt(() => {
		node[key] = 1;
	});
	const read = node[key];
	const define = attempt(() => {
		Object.defineProperty(node, key, { value: 2, configurable: true, writable: true, enumerable: false });
	});
	const remove = attempt(() => {
		delete node[key];
	});
	return { assign, read, define, remove, gone: node[key] === undefined };
}

/**
 * List the members of `self`, as any module may.
 * @returns {number} How many members `self` has.
 * @example
 * listSelf(); // 4
 */
export function listSelf() {
	return Object.keys(self).length;
}

/**
 * The victim's own class prototype as it reads it through `self`, handed to whoever calls.
 * @returns {object} The prototype.
 * @example
 * ownPrototype();
 */
export function ownPrototype() {
	return self.victim.v.Account.prototype;
}

/**
 * Keep the victim's own class prototype, read through `self`, for a write made later from outside any call.
 * @returns {function(): string} Writes the kept prototype and reports the outcome.
 * @example
 * keepOwnPrototype()(); // "done"
 */
export function keepOwnPrototype() {
	const proto = self.victim.v.Account.prototype;
	return function writeKept() {
		const outcome = attempt(() => {
			proto.later = 1;
		});
		delete Account.prototype.later;
		return outcome;
	};
}

/**
 * Use the victim's own class prototype, read through `self`, as plain JS uses an object: its array, functions,
 * a built-in object it holds, a member defined fixed, a frozen object, and an object whose prototype and
 * extensibility it changes.
 * @returns {Record<string, *>} What each use gave.
 * @example
 * useOwnMembers();
 */
export function useOwnMembers() {
	Account.prototype.kinds = ["basic"];
	Account.prototype.holder = {};
	Account.prototype.box = { a: 1, b: 2 };
	const rawBox = Account.prototype.box;
	Account.prototype.frozen = Object.freeze({ inner: { n: 1 } });
	const proto = self.victim.v.Account.prototype;
	const out = {};
	out.isArray = Array.isArray(proto.kinds);
	proto.kinds.push("gold");
	out.kinds = [...proto.kinds].join(",");
	out.arrow = proto.arrow();
	out.bound = typeof new proto.Bound();
	out.constructed = new proto.constructor().balance();
	proto.registry.set("k", 1);
	out.registry = proto.registry.get("k");
	Object.defineProperty(proto.holder, "fixed", { value: { deep: 1 }, configurable: false, writable: false, enumerable: true });
	out.fixedSame = proto.holder.fixed === proto.holder.fixed;
	out.fixedDeep = proto.holder.fixed.deep;
	out.fixedDescriptor = Object.getOwnPropertyDescriptor(proto.holder, "fixed").value === proto.holder.fixed;
	const frozen = proto.frozen;
	out.isFrozen = Object.isFrozen(frozen);
	out.frozenKeys = Object.keys(frozen).join(",");
	out.frozenInner = frozen.inner.n;
	out.frozenProto = Object.getPrototypeOf(frozen) === Object.prototype;
	const box = proto.box;
	out.boxProto = Object.getPrototypeOf(box) === Object.prototype;
	Object.setPrototypeOf(box, null);
	Object.preventExtensions(box);
	out.boxClosed = !Object.isExtensible(box) && Object.getPrototypeOf(box) === null;
	out.boxSameProto = Reflect.setPrototypeOf(box, null);
	out.boxHas = "a" in box;
	delete box.a;
	// A member the value loses other than through the view is gone from the view too.
	delete rawBox.b;
	out.boxGone = !("a" in box) && Object.keys(box).length === 0;
	out.labelGetter = typeof Object.getOwnPropertyDescriptor(proto, "label").get;
	Object.defineProperty(proto.holder, "computed", { get: () => 2, configurable: true });
	out.computed = proto.holder.computed;
	out.fixedDelete = Reflect.deleteProperty(proto.holder, "fixed");
	out.frozenDefine = Reflect.defineProperty(frozen, "x", { value: 1 });
	out.frozenSetPrototype = Reflect.setPrototypeOf(frozen, null);
	out.stubborn = Reflect.preventExtensions(proto.stubborn);
	class Savings extends proto.constructor {}
	out.subclassed = new Savings().balance();
	return out;
}
