/**
 *
 *	@Project: @cldmv/slothlet
 *	@Filename: /api_tests/api_test_self_write_reach/guest/x.mjs
 *	@Date: 2026-10-18T18:42:03-07:00 (1792374123)
 *	@Author: Nate Corcoran <CLDMV>
 *	@Email: <Shinrai@users.noreply.github.com>
 *	-----
 *	@Last modified by: Nate Corcoran <CLDMV> (Shinrai@users.noreply.github.com)
 *	@Last modified time: 2026-10-19T00:44:42-07:00 (1792395882)
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

/**
 * Write the victim's node and a member reached through it, by name and by symbol key: assign, define, and
 * delete, then the changes to a node itself.
 * @returns {Record<string, string>} Outcome of each change.
 * @example
 * writeVictim();
 */
export function writeVictim() {
	const node = self.victim.v;
	const key = Symbol.for("slothlet.test.i625.grant");
	return {
		assignName: attempt(() => {
			node.note = 1;
		}),
		defineName: attempt(() => {
			Object.defineProperty(node, "noteDefined", { value: 2, configurable: true, writable: true, enumerable: true });
		}),
		deleteName: attempt(() => {
			if (!delete node.note) throw new Error("NOT_DELETED");
		}),
		assignSymbol: attempt(() => {
			node[key] = 1;
		}),
		defineSymbol: attempt(() => {
			Object.defineProperty(node, key, { value: 2, configurable: true, writable: true });
		}),
		deleteSymbol: attempt(() => {
			if (!delete node[key]) throw new Error("NOT_DELETED");
		}),
		prototypeMember: attempt(() => {
			node.Account.prototype.granted = 1;
		}),
		setPrototypeOf: attempt(() => {
			Object.setPrototypeOf(node.conf, Object.prototype);
		}),
		preventExtensions: attempt(() => {
			Object.preventExtensions(node.conf);
		}),
		seal: attempt(() => {
			Object.seal(node.conf);
		}),
		freeze: attempt(() => {
			Object.freeze(node.conf);
		})
	};
}

/**
 * Keep the victim's node and hand back a function that writes it later, from outside any call.
 * @returns {function(): string} Writes the kept node and reports the outcome.
 * @example
 * keepVictimNode()();
 */
export function keepVictimNode() {
	const node = self.victim.v;
	return function writeKept() {
		return attempt(() => {
			node.keptNote = 1;
		});
	};
}

/**
 * Write the node at `apiPath`, read through `self`, by name and by symbol key: assign, define, and delete.
 * @param {string} apiPath - Dotted path of the node.
 * @returns {Record<string, string>} Outcome of each change.
 * @example
 * writeAt("victim.v");
 */
export function writeAt(apiPath) {
	const node = apiPath.split(".").reduce((value, key) => value[key], self);
	const key = Symbol.for("slothlet.test.i625.module-grant");
	return {
		assignName: attempt(() => {
			node.granted = 1;
		}),
		defineName: attempt(() => {
			Object.defineProperty(node, "grantedDefined", { value: 2, configurable: true, writable: true, enumerable: true });
		}),
		deleteName: attempt(() => {
			if (!delete node.granted) throw new Error("NOT_DELETED");
		}),
		assignSymbol: attempt(() => {
			node[key] = 1;
		}),
		defineSymbol: attempt(() => {
			Object.defineProperty(node, key, { value: 2, configurable: true, writable: true });
		}),
		deleteSymbol: attempt(() => {
			if (!delete node[key]) throw new Error("NOT_DELETED");
		})
	};
}

/**
 * Add a permission rule from this module's code.
 * @param {object} rule - The rule.
 * @returns {string} The rule's id, or the error code it was refused with.
 * @example
 * addRuleFor({ caller: "guest.**", target: "victim.**:write", effect: "allow" });
 */
export function addRuleFor(rule) {
	try {
		return self.slothlet.permissions.addRule(rule);
	} catch (error) {
		return error?.code ?? String(error);
	}
}

/**
 * Write the framework's metadata key on the victim's node.
 * @returns {string} `"done"`, or the error code it was refused with.
 * @example
 * writeVictimMetadata(); // "PERMISSION_DENIED"
 */
export function writeVictimMetadata() {
	return attempt(() => {
		Object.defineProperty(self.victim.v, "__metadata", { value: {}, configurable: true });
	});
}

/**
 * Remove a permission rule from this module's code.
 * @param {string} ruleId - The rule's id.
 * @returns {*} What `removeRule` returned, or the error code it was refused with.
 * @example
 * removeRuleFor("perm-12");
 */
export function removeRuleFor(ruleId) {
	try {
		return self.slothlet.permissions.removeRule(ruleId);
	} catch (error) {
		return error?.code ?? String(error);
	}
}

/**
 * Call a member of the victim.
 * @returns {*} What it returned, or the error code the call was refused with.
 * @example
 * callVictim(); // 100
 */
export function callVictim() {
	try {
		return self.victim.v.balanceOfNew();
	} catch (error) {
		return error?.code ?? String(error);
	}
}

/**
 * Write a member of the framework namespace.
 * @param {string} name - The member.
 * @param {*} value - The value.
 * @returns {string} `"done"`, or the error code it was refused with.
 * @example
 * writeNamespaceMember("lifted", 1);
 */
export function writeNamespaceMember(name, value) {
	return attempt(() => {
		self.slothlet[name] = value;
	});
}

/**
 * Call the victim's secret.
 * @returns {string} What it returned, or the error code the call was refused with.
 * @example
 * callVictimSecret(); // "PERMISSION_DENIED"
 */
export function callVictimSecret() {
	try {
		return self.victim.v.secret();
	} catch (error) {
		return error?.code ?? String(error);
	}
}

/**
 * Add a rule whose target answers `early` for its first `reads` reads and `late` after, from this module's code.
 * @param {string} early - The target read first.
 * @param {string} late - The target read later.
 * @param {string} [effect="allow"] - The rule's effect.
 * @param {number} [reads=4] - How many reads answer `early`.
 * @returns {string} The rule's id, or the error code it was refused with.
 * @example
 * addShiftingRule("guest.**", "victim.v.secret");
 */
export function addShiftingRule(early, late, effect = "allow", reads = 4) {
	let n = 0;
	const rule = {
		caller: "guest.**",
		effect,
		get target() {
			return n++ < reads ? early : late;
		}
	};
	try {
		return self.slothlet.permissions.addRule(rule);
	} catch (error) {
		return error?.code ?? String(error);
	}
}

/**
 * Mount a folder at `guest.sub` whose `permissions` option answers differently on later reads.
 * @param {string} folder - Folder to mount.
 * @param {string} how - `"array"` (the `allow` array grows), or `"entry"` (an entry's target shifts).
 * @returns {Promise<string>} `"done"`, or the error code the mount was refused with.
 * @example
 * await mountShifting("/abs/guest", "array");
 */
export async function mountShifting(folder, how) {
	let n = 0;
	const permissions =
		how === "array"
			? {
					get allow() {
						return n++ < 2 ? ["guest.**"] : ["guest.**", "victim.**"];
					}
				}
			: {
					allow: [
						{
							get target() {
								return n++ < 2 ? "guest.**" : "victim.**";
							}
						}
					]
				};
	try {
		await self.slothlet.api.add("guest.sub", folder, { moduleID: "guest-sub", permissions });
		return "done";
	} catch (error) {
		return error?.code ?? String(error);
	}
}

/**
 * A rule this module added and kept, to change after the add.
 * @type {object|null}
 */
let keptRule = null;

/**
 * Add a rule for this module's own subtree and keep the object.
 * @returns {string} The rule's id, or the error code it was refused with.
 * @example
 * addKeptRule();
 */
export function addKeptRule() {
	keptRule = { caller: "guest.**", target: "guest.**", effect: "allow" };
	try {
		return self.slothlet.permissions.addRule(keptRule);
	} catch (error) {
		return error?.code ?? String(error);
	}
}

/**
 * Change the target of the rule this module kept.
 * @param {string} target - The new target.
 * @returns {void}
 * @example
 * changeKeptRule("victim.v.secret");
 */
export function changeKeptRule(target) {
	keptRule.target = target;
}

/**
 * Mount a folder from this module's code.
 * @param {string} apiPath - Where to mount it.
 * @param {string} folder - Folder to mount.
 * @param {object} [options] - `api.add` options.
 * @returns {Promise<string>} `"done"`, or the error code the mount was refused with.
 * @example
 * await addAt("guest.sub", "/abs/guest");
 */
export async function addAt(apiPath, folder, options = {}) {
	try {
		await self.slothlet.api.add(apiPath, folder, options);
		return "done";
	} catch (error) {
		return error?.code ?? String(error);
	}
}

/**
 * Remove a mount from this module's code.
 * @param {string} target - Api path or moduleID.
 * @param {string} [scopedApiPath] - With a moduleID, the path to remove only its share of.
 * @returns {Promise<*>} What `api.remove` returned, or the error code it was refused with.
 * @example
 * await removeAt("guest.sub");
 */
export async function removeAt(target, scopedApiPath) {
	try {
		return scopedApiPath === undefined ? await self.slothlet.api.remove(target) : await self.slothlet.api.remove(target, scopedApiPath);
	} catch (error) {
		return error?.code ?? String(error);
	}
}

/**
 * Call the function at `apiPath`, read through `self`, with no arguments.
 * @param {string} apiPath - Dotted path of the function.
 * @returns {Promise<*>} What it returned, or the error code the call was refused with.
 * @example
 * await callAt("outer.x.listSelf");
 */
export async function callAt(apiPath) {
	try {
		return await apiPath.split(".").reduce((value, key) => value[key], self)();
	} catch (error) {
		return error?.code ?? String(error);
	}
}

/**
 * A conditional rule this module added and kept, to change after the add.
 * @type {object|null}
 */
let keptConditionalRule = null;

/**
 * Add a rule granting `other` writes into this module's subtree in tenant `a`, and keep the object.
 * @returns {string} The rule's id, or the error code it was refused with.
 * @example
 * addKeptConditionalRule();
 */
export function addKeptConditionalRule() {
	keptConditionalRule = { caller: "other.**", target: "guest.**:write", effect: "allow", condition: { tenant: "a" } };
	try {
		return self.slothlet.permissions.addRule(keptConditionalRule);
	} catch (error) {
		return error?.code ?? String(error);
	}
}

/**
 * Change the tenant of the condition of the rule this module kept.
 * @param {string} tenant - The new tenant.
 * @returns {void}
 * @example
 * changeKeptCondition("b");
 */
export function changeKeptCondition(tenant) {
	keptConditionalRule.condition.tenant = tenant;
}
