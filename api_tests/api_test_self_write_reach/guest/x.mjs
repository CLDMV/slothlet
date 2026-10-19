/**
 *
 *	@Project: @cldmv/slothlet
 *	@Filename: /api_tests/api_test_self_write_reach/guest/x.mjs
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
 * @fileoverview The module that tries to change another module's class, members, and `self` itself (#625).
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
 * Change the prototype of the victim's class, reached through `self`, at any depth.
 * @returns {Record<string, string>} Outcome of each change.
 * @example
 * changeVictimPrototype();
 */
export function changeVictimPrototype() {
	const Account = self.victim.v.Account;
	return {
		assign: attempt(() => {
			Account.prototype.balance = () => 0;
		}),
		plant: attempt(() => {
			Account.prototype.planted = 1;
		}),
		define: attempt(() => {
			Object.defineProperty(Account.prototype, "balance", { value: () => 0, configurable: true, writable: true });
		}),
		remove: attempt(() => {
			if (!delete Account.prototype.balance) throw new Error("NOT_DELETED");
		}),
		setPrototypeOf: attempt(() => {
			Object.setPrototypeOf(Account.prototype, null);
		}),
		preventExtensions: attempt(() => {
			Object.preventExtensions(Account.prototype);
		}),
		freeze: attempt(() => {
			Object.freeze(Account.prototype);
		}),
		methodMember: attempt(() => {
			Account.prototype.balance.planted = 1;
		}),
		methodPrototype: attempt(() => {
			Object.setPrototypeOf(Account.prototype.balance, null);
		}),
		constructorMember: attempt(() => {
			Account.prototype.constructor.planted = 1;
		}),
		throughDescriptor: attempt(() => {
			Object.getOwnPropertyDescriptor(Account, "prototype").value.balance = () => 0;
		}),
		throughMethodDescriptor: attempt(() => {
			Object.getOwnPropertyDescriptor(Account.prototype, "balance").value.planted = 1;
		})
	};
}

/**
 * Change the victim's class prototype the victim itself handed back: handed to this module, it is held to this
 * module's ownership.
 * @returns {Record<string, string>} Outcome of each change.
 * @example
 * changeHandedPrototype();
 */
export function changeHandedPrototype() {
	const proto = self.victim.v.ownPrototype();
	return {
		assign: attempt(() => {
			proto.balance = () => 0;
		}),
		define: attempt(() => {
			Object.defineProperty(proto, "planted", { value: 1, configurable: true });
		})
	};
}

/**
 * Keep the victim's class prototype and hand back a function that writes it later, from outside any call.
 * @returns {function(): string} Writes the kept prototype and reports the outcome.
 * @example
 * keepVictimPrototype()(); // "RUNTIME_NO_ACTIVE_CONTEXT_SELF"
 */
export function keepVictimPrototype() {
	const proto = self.victim.v.Account.prototype;
	return function writeKept() {
		return attempt(() => {
			proto.balance = () => 0;
		});
	};
}

/**
 * Use the victim's class as plain JS does: instances, `instanceof`, and a subclass with members of its own.
 * @returns {Record<string, *>} What it saw.
 * @example
 * useVictimClass(); // { instance: true, subclass: true, balance: 100, own: 1, read: "function", … }
 */
export function useVictimClass() {
	// Before anything loads the class (a lazy node), nothing is an instance of it yet.
	const early = {} instanceof self.victim.v.Account;
	const Account = self.victim.v.Account;
	class Savings extends Account {}
	const savings = new Savings();
	savings.own = 1;
	return {
		instance: self.victim.v.makeAccount() instanceof Account,
		subclass: savings instanceof Account && savings instanceof Savings,
		balance: savings.balance(),
		own: savings.own,
		read: typeof Account.prototype.balance,
		early,
		primitive: 1 instanceof Account,
		namespace: attempt(() => ({}) instanceof self.victim.v)
	};
}

/**
 * Change a member of the framework namespace the host stored on the victim's class prototype.
 * @returns {string} Outcome of the change.
 * @example
 * changeStoredNamespace(); // "PERMISSION_DENIED"
 */
export function changeStoredNamespace() {
	return attempt(() => {
		self.victim.v.Account.prototype.namespace.planted = 1;
	});
}

/**
 * Change the prototype of an instance the victim returned: data the victim chose to share (#597).
 * @returns {string} Outcome of the change.
 * @example
 * changeReturnedInstancePrototype(); // "done"
 */
export function changeReturnedInstancePrototype() {
	const proto = Object.getPrototypeOf(self.victim.v.makeAccount());
	return attempt(() => {
		proto.shared = 1;
	});
}

/**
 * Write symbol-keyed members on the victim's node.
 * @returns {Record<string, string>} Outcome of each change.
 * @example
 * changeVictimSymbol();
 */
export function changeVictimSymbol() {
	const key = Symbol.for("slothlet.test.i625.guest");
	return {
		assign: attempt(() => {
			self.victim.v[key] = 1;
		}),
		define: attempt(() => {
			Object.defineProperty(self.victim.v, key, { value: 1, configurable: true, writable: true });
		}),
		remove: attempt(() => {
			delete self.victim.v[Symbol.iterator];
		})
	};
}

/**
 * Change what the victim's node holds under a symbol key, and the accessor of its configuration.
 * @returns {Record<string, string>} Outcome of each change.
 * @example
 * changeVictimHeld();
 */
export function changeVictimHeld() {
	return {
		symbolBox: attempt(() => {
			self.victim.v[Symbol.for("slothlet.test.i625.box")].n = 2;
		}),
		getter: attempt(() => {
			Object.getOwnPropertyDescriptor(self.victim.v.conf, "level").get.planted = 1;
		})
	};
}

/**
 * Hand the victim its own class prototype, as this module read it, take it back, and write through it.
 * @returns {string} Outcome of the write.
 * @example
 * echoPrototype(); // "LOOSE_SET_NOT_OWNED"
 */
export function echoPrototype() {
	const echoed = self.victim.v.echo(self.victim.v.Account.prototype);
	return attempt(() => {
		echoed.echoed = 1;
	});
}

/**
 * Write a symbol-keyed member on the guest's own node.
 * @returns {{assign: string, read: *}} Outcome and what was read back.
 * @example
 * writeOwnSymbol(); // { assign: "done", read: 1 }
 */
export function writeOwnSymbol() {
	const key = Symbol.for("slothlet.test.i625.guest.own");
	const assign = attempt(() => {
		self.guest.x[key] = 1;
	});
	return { assign, read: self.guest.x[key] };
}

/**
 * Change `self` itself: define, delete, swap the prototype, close it to extension, freeze.
 * @returns {Record<string, string>} Outcome of each change.
 * @example
 * changeSelf();
 */
export function changeSelf() {
	return {
		defineFixed: attempt(() => {
			Object.defineProperty(self, "zz", { value: 1, configurable: false });
		}),
		define: attempt(() => {
			Object.defineProperty(self, "zz", { value: 1, configurable: true, writable: true, enumerable: true });
		}),
		remove: attempt(() => {
			if (!delete self.victim) throw new Error("NOT_DELETED");
		}),
		setPrototypeOf: attempt(() => {
			Object.setPrototypeOf(self, null);
		}),
		preventExtensions: attempt(() => {
			Object.preventExtensions(self);
		}),
		freeze: attempt(() => {
			Object.freeze(self);
		}),
		symbol: attempt(() => {
			self[Symbol.for("slothlet.test.i625.self")] = 1;
		})
	};
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
