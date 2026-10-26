/**
 *
 *	@Project: @cldmv/slothlet
 *	@Filename: /api_tests/api_test_self_write_reach/guest/x.mjs
 *	@Date: 2026-10-18T18:42:03-07:00 (1792374123)
 *	@Author: Nate Corcoran <CLDMV>
 *	@Email: <Shinrai@users.noreply.github.com>
 *	-----
 *	@Last modified by: Nate Corcoran <CLDMV> (Shinrai@users.noreply.github.com)
 *	@Last modified time: 2026-10-25T17:41:48-07:00 (1792975308)
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
 * Change members the victim holds frozen — an element of a frozen list, a member of a frozen node — reached
 * through `self`: assign, define, and delete.
 * @returns {Record<string, string>} Outcome of each change.
 * @example
 * changeVictimFrozenMembers(); // { elementAssign: "LOOSE_SET_NOT_OWNED", … }
 */
export function changeVictimFrozenMembers() {
	return frozenMemberWrites(self.victim.v.shelf[0], self.victim.v.sealedBox.inner);
}

/**
 * Keep members the victim holds frozen and hand back a function that changes them later, from outside any call.
 * @returns {function(): Record<string, string>} Changes the kept members and reports each outcome.
 * @example
 * keepVictimFrozenMembers()(); // { elementAssign: "RUNTIME_NO_ACTIVE_CONTEXT_SELF", … }
 */
export function keepVictimFrozenMembers() {
	const element = self.victim.v.shelf[0];
	const inner = self.victim.v.sealedBox.inner;
	return function writeKept() {
		return frozenMemberWrites(element, inner);
	};
}

/**
 * Store an element of the victim's frozen list, read through `self`, on this module's own node.
 * @returns {string} The outcome.
 * @example
 * storeVictimElement(); // "done"
 */
export function storeVictimElement() {
	return attempt(() => {
		self.guest.x.keptElement = self.victim.v.shelf[0];
	});
}

/**
 * Assign, define, and delete on an element of a frozen list and a member of a frozen node.
 * @param {object} element - The element.
 * @param {object} inner - The member.
 * @returns {Record<string, string>} Outcome of each change.
 * @example
 * frozenMemberWrites(self.victim.v.shelf[0], self.victim.v.sealedBox.inner);
 */
function frozenMemberWrites(element, inner) {
	return {
		elementAssign: attempt(() => {
			element.planted = 1;
		}),
		elementDefine: attempt(() => {
			Object.defineProperty(element, "defined", { value: 1, configurable: true, writable: true, enumerable: true });
		}),
		elementDelete: attempt(() => {
			if (!delete element.n) throw new Error("NOT_DELETED");
		}),
		innerAssign: attempt(() => {
			inner.planted = 1;
		}),
		innerDelete: attempt(() => {
			if (!delete inner.n) throw new Error("NOT_DELETED");
		})
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

/**
 * Mount a folder as a version of `apiPath`, from this module's code.
 * @param {string} apiPath - The logical path.
 * @param {string} folder - Folder to mount.
 * @param {object} options - `api.add` options.
 * @param {string} version - The version tag.
 * @returns {Promise<string>} `"done"`, or the error code the mount was refused with.
 * @example
 * await addAtVersion("guest.lib", "/abs/guest", { moduleID: "gv" }, "v1");
 */
export async function addAtVersion(apiPath, folder, options, version) {
	try {
		await self.slothlet.api.add(apiPath, folder, options, { version });
		return "done";
	} catch (error) {
		return error?.code ?? String(error);
	}
}

/**
 * Mount inline content `{ [key]: { injected() } }` at `apiPath`, from this module's code.
 * @param {string} apiPath - Where to mount it.
 * @param {string} key - The member the content holds.
 * @param {object} [options] - `api.add` options.
 * @returns {Promise<string>} `"done"`, or the error code the mount was refused with.
 * @example
 * await addInjected("guest", "hostmount");
 */
export async function addInjected(apiPath, key, options = {}) {
	try {
		await self.slothlet.api.add(apiPath, { exports: { [key]: { injected: () => "injected" } } }, options);
		return "done";
	} catch (error) {
		return error?.code ?? String(error);
	}
}

/**
 * Call a module-manager entry point from this module's code.
 * @param {"addModule"|"addModules"|"addDiscovered"} entry - The entry point.
 * @param {*} arg - Its first argument.
 * @param {object} [options] - Its options.
 * @returns {Promise<string>} `"done"`, or the error code it was refused with.
 * @example
 * await mountModule("addDiscovered", { scanRoot: "/abs/modules" });
 */
export async function mountModule(entry, arg, options = {}) {
	try {
		await self.slothlet.api.modules[entry](arg, options);
		return "done";
	} catch (error) {
		return error?.code ?? String(error);
	}
}

/**
 * Call one of the framework's setters on a path from this module's code.
 * @param {string} what - `"setFor"`, `"removeFor"`, `"setForVersion"`, `"set"`, `"setGlobal"`, `"setDefault"`, `"setVersionMetadata"`, or
 *   `"reload"`.
 * @param {string} target - The path, moduleID, or (for `"set"`) the path of the node passed.
 * @param {string} [tag] - The version tag, where the setter takes one.
 * @returns {Promise<string>} `"done"`, or the error code it was refused with.
 * @example
 * await callSetter("setFor", "victim.v", undefined);
 */
export async function callSetter(what, target, tag) {
	try {
		const slothlet = self.slothlet;
		if (what === "setFor") slothlet.metadata.setFor(target, "planted", 1);
		else if (what === "removeFor") slothlet.metadata.removeFor(target, "planted");
		else if (what === "setForVersion") slothlet.metadata.setForVersion(target, tag, "planted", 1);
		else if (what === "set")
			slothlet.metadata.set(
				target.split(".").reduce((node, key) => node[key], self),
				"planted",
				1
			);
		else if (what === "setGlobal") slothlet.metadata.setGlobal("planted", 1);
		else if (what === "setDefault") slothlet.versioning.setDefault(target, tag);
		else if (what === "setVersionMetadata") slothlet.versioning.setVersionMetadata(target, tag, { planted: 1 });
		else await slothlet.api.reload(target);
		return "done";
	} catch (error) {
		return error?.code ?? String(error);
	}
}

/**
 * Unmount a module by package name from this module's code.
 * @param {string} name - The package name.
 * @param {object} [opts] - `removeModule` options.
 * @returns {Promise<*>} What `removeModule` returned, or the error code it was refused with.
 * @example
 * await removeModuleNamed("good"); // "LOOSE_SET_NOT_OWNED"
 */
export async function removeModuleNamed(name, opts) {
	try {
		return await self.slothlet.api.modules.removeModule(name, opts);
	} catch (error) {
		return error?.code ?? String(error);
	}
}

/**
 * Store the node at `target`, read through `self`, as a member `key` of the node at `at`: an alias in this module's
 * own subtree.
 * @param {string} at - Dotted path of the node the alias is stored on.
 * @param {string} key - The member name.
 * @param {string} target - Dotted path of the node aliased.
 * @returns {string} `"done"`, or the error code it was refused with.
 * @example
 * storeAlias("guest.x", "ref", "victim.v");
 */
export function storeAlias(at, key, target) {
	const read = (apiPath) => apiPath.split(".").reduce((value, part) => value[part], self);
	return attempt(() => {
		read(at)[key] = read(target);
	});
}

/**
 * Define an accessor `key` on the node at `at` whose getter answers the node at `target`, read through `self` once.
 * @param {string} at - Dotted path of the node the accessor is defined on.
 * @param {string} key - The member name.
 * @param {string} target - Dotted path of the node the getter answers.
 * @returns {string} `"done"`, or the error code it was refused with.
 * @example
 * defineGetterAlias("guest.x", "g", "victim.v");
 */
export function defineGetterAlias(at, key, target) {
	const read = (apiPath) => apiPath.split(".").reduce((value, part) => value[part], self);
	return attempt(() => {
		const node = read(target);
		Object.defineProperty(read(at), key, { get: () => node, configurable: true, enumerable: true });
	});
}

/**
 * Store an object at `key` on the node at `at` whose getter `inner` answers the node at `target`, read through `self`
 * once.
 * @param {string} at - Dotted path of the node the object is stored on.
 * @param {string} key - The member name.
 * @param {string} inner - The getter's name.
 * @param {string} target - Dotted path of the node the getter answers.
 * @returns {string} `"done"`, or the error code it was refused with.
 * @example
 * storeGetterObject("guest.x", "b", "r", "victim.v");
 */
export function storeGetterObject(at, key, inner, target) {
	const read = (apiPath) => apiPath.split(".").reduce((value, part) => value[part], self);
	return attempt(() => {
		const node = read(target);
		read(at)[key] = {
			get [inner]() {
				return node;
			}
		};
	});
}

/**
 * Store a Proxy at `key` on the node at `at` whose `get` trap answers the node at `target` for `inner`, and reports no
 * own member, read through `self` once.
 * @param {string} at - Dotted path of the node the Proxy is stored on.
 * @param {string} key - The member name.
 * @param {string} inner - The name the trap answers.
 * @param {string} target - Dotted path of the node the trap answers.
 * @returns {string} `"done"`, or the error code it was refused with.
 * @example
 * storeProxyObject("guest.x", "p", "r", "victim.v");
 */
export function storeProxyObject(at, key, inner, target) {
	const read = (apiPath) => apiPath.split(".").reduce((value, part) => value[part], self);
	return attempt(() => {
		const node = read(target);
		read(at)[key] = new Proxy({}, { get: (_object, name) => (name === inner ? node : undefined) });
	});
}

/**
 * Outcomes of the writes the condition of {@link addWritingCondition}'s rule made, in order. Kept outside the
 * module so a condition registered before a reload records into the same list as the reloaded module reads.
 * @type {string[]}
 */
const conditionWrites = (globalThis[Symbol.for("slothlet.test.i625.conditionWrites")] ??= []);

/**
 * Add a rule for this module's subtree whose condition, each time it is checked, writes a member on `target`
 * through `self` and records the outcome; it always matches.
 * @param {string} target - Dotted path of the node the condition writes.
 * @returns {string} The rule's id, or the error code it was refused with.
 * @example
 * addWritingCondition("victim.v");
 */
export function addWritingCondition(target) {
	const read = (apiPath) => apiPath.split(".").reduce((value, part) => value[part], self);
	try {
		return self.slothlet.permissions.addRule({
			caller: "**",
			target: "guest.**",
			effect: "allow",
			condition: () => {
				conditionWrites.push(
					attempt(() => {
						read(target).viaCondition = 1;
					})
				);
				return true;
			}
		});
	} catch (error) {
		return error?.code ?? String(error);
	}
}

/**
 * The outcomes the condition of {@link addWritingCondition}'s rule recorded, cleared on read.
 * @returns {string[]} The outcomes, in order.
 * @example
 * takeConditionWrites(); // ["LOOSE_SET_NOT_OWNED"]
 */
export function takeConditionWrites() {
	return conditionWrites.splice(0);
}

/**
 * Add an event rule from this module's code.
 * @param {object} rule - The event rule.
 * @returns {string} The rule's id, or the error code it was refused with.
 * @example
 * addEventRuleFor({ caller: "**", event: "guest.**", effect: "deny" });
 */
export function addEventRuleFor(rule) {
	try {
		return self.slothlet.event.rules.add(rule);
	} catch (error) {
		return error?.code ?? String(error);
	}
}

/**
 * Remove an event rule from this module's code.
 * @param {string} ruleId - The event rule's id.
 * @returns {*} What `rules.remove` returned, or the error code it was refused with.
 * @example
 * removeEventRuleFor("evt-3");
 */
export function removeEventRuleFor(ruleId) {
	try {
		return self.slothlet.event.rules.remove(ruleId);
	} catch (error) {
		return error?.code ?? String(error);
	}
}

/**
 * Add an event rule for this module's events whose condition, each time it is checked, writes a member on
 * `target` through `self` and records the outcome in the list {@link takeConditionWrites} reads; it always matches.
 * @param {string} target - Dotted path of the node the condition writes.
 * @returns {string} The rule's id, or the error code it was refused with.
 * @example
 * addWritingEventCondition("victim.v");
 */
export function addWritingEventCondition(target) {
	const read = (apiPath) => apiPath.split(".").reduce((value, part) => value[part], self);
	try {
		return self.slothlet.event.rules.add({
			caller: "**",
			event: "guest.**",
			effect: "allow",
			condition: () => {
				conditionWrites.push(
					attempt(() => {
						read(target).viaCondition = 1;
					})
				);
				return true;
			}
		});
	} catch (error) {
		return error?.code ?? String(error);
	}
}

/**
 * Emit `event` from this module's code.
 * @param {string} event - The event name.
 * @param {*} payload - The payload.
 * @returns {*} What `emit` returned.
 * @example
 * shout("guest.ping", { n: 1 });
 */
export function shout(event, payload) {
	return self.slothlet.event.emit(event, payload);
}

/**
 * Register a principal from this module's code whose `key`, each time it is computed, writes a member on `target`
 * through `self` and records the outcome in the list {@link takeConditionWrites} reads.
 * @param {string} name - The principal's name.
 * @param {string} target - Dotted path of the node the key writes.
 * @returns {string} `"done"`, or the error code it was refused with.
 * @example
 * registerWritingPrincipal("p", "victim.v");
 */
export function registerWritingPrincipal(name, target) {
	const read = (apiPath) => apiPath.split(".").reduce((value, part) => value[part], self);
	try {
		self.slothlet.permissions.principal.register(name, {
			key: () => {
				conditionWrites.push(
					attempt(() => {
						read(target).viaKey = 1;
					})
				);
				return "k";
			},
			resolve: () => ({ ok: true })
		});
		return "done";
	} catch (error) {
		return error?.code ?? String(error);
	}
}

/**
 * A Proxy whose `getPrototypeOf` trap, each time it runs, writes a member on `target` through `self` and records the
 * outcome in the list {@link takeConditionWrites} reads. The first run answers `Object.prototype`, every later one
 * `Array.prototype`.
 * @param {string} target - Dotted path of the node the trap writes.
 * @returns {object} The Proxy.
 */
function writingProxy(target) {
	const read = (apiPath) => apiPath.split(".").reduce((value, part) => value[part], self);
	let runs = 0;
	return new Proxy(
		{},
		{
			getPrototypeOf() {
				conditionWrites.push(
					attempt(() => {
						read(target).viaProxy = 1;
					})
				);
				return runs++ === 0 ? Object.prototype : Array.prototype;
			}
		}
	);
}

/**
 * Add a rule for this module's subtree whose object condition holds a {@link writingProxy}, nested or as the
 * condition itself, from this module's code.
 * @param {string} target - Dotted path of the node the Proxy's trap writes.
 * @param {"nested"|"whole"} where - Where the Proxy sits in the condition.
 * @param {"call"|"event"} kind - A call rule, or an event rule.
 * @returns {string} The rule's id, or the error code it was refused with.
 * @example
 * addProxyCondition("victim.v", "nested", "call");
 */
export function addProxyCondition(target, where, kind) {
	const proxy = writingProxy(target);
	const condition = where === "nested" ? { tenant: proxy } : proxy;
	try {
		return kind === "event"
			? self.slothlet.event.rules.add({ caller: "**", event: "guest.**", effect: "allow", condition })
			: self.slothlet.permissions.addRule({ caller: "**", target: "guest.**", effect: "allow", condition });
	} catch (error) {
		return error?.code ?? String(error);
	}
}

/**
 * Change what the framework's metadata and versioning getters hand this module, as plain JS changes an object:
 * another module's path metadata, its version metadata, and the version listing of a path.
 * @param {string} metaPath - A path whose metadata to read and change.
 * @param {string} logicalPath - A versioned logical path.
 * @param {string} tag - One of its version tags.
 * @returns {Record<string, string>} Outcome of each change.
 * @example
 * changeReadMetadata("victim", "svc", "v1");
 */
export function changeReadMetadata(metaPath, logicalPath, tag) {
	const { metadata, versioning } = self.slothlet;
	return {
		pathNested: attempt(() => {
			metadata.getFor(metaPath).tier.level = 9;
		}),
		pathTop: attempt(() => {
			metadata.getFor(metaPath).planted = 1;
		}),
		versionMeta: attempt(() => {
			versioning.getVersionMetadata(logicalPath, tag).version = "hijacked";
		}),
		versionNested: attempt(() => {
			versioning.getVersionMetadata(logicalPath, tag).nested.flag = "hijacked";
		}),
		listParts: attempt(() => {
			versioning.list(logicalPath).versions[tag].versionedParts.splice(0, 9, "elsewhere");
		}),
		listMeta: attempt(() => {
			versioning.list(logicalPath).versions[tag].versionMeta.nested.flag = "hijacked";
		})
	};
}

/**
 * Hand back a function that, called later, writes a member on the node at `target` through `self`, either pinned to
 * this module with `lockCaller` or as a plain closure.
 * @param {string} target - Dotted path of the node to write, read when the function runs.
 * @param {boolean} locked - Whether to pin it with `lockCaller`.
 * @returns {function(): string} Writes the node and reports the outcome.
 * @example
 * keepWriter("victim.v", true)();
 */
export function keepWriter(target, locked) {
	const write = () =>
		attempt(() => {
			target.split(".").reduce((value, part) => value[part], self).viaHeld = 1;
		});
	return locked ? self.slothlet.lockCaller(write) : write;
}

/**
 * Hand back a function pinned to this module with `lockCaller` that, called later, calls the function at `target`
 * through `self`.
 * @param {string} target - Dotted path of the function, read when the function runs.
 * @returns {function(): Promise<*>} Calls it and reports what it returned, or the error code.
 * @example
 * await keepCaller("victim.v.secret")();
 */
export function keepCaller(target) {
	return self.slothlet.lockCaller(async () => {
		try {
			return await target.split(".").reduce((value, part) => value[part], self)();
		} catch (error) {
			return error?.code ?? String(error);
		}
	});
}

/**
 * Put this module's `self` and an object of its own on the global object under a symbol key, as plain JS lets any
 * code do.
 * @returns {void}
 * @example
 * exposeOnGlobal();
 */
export function exposeOnGlobal() {
	globalThis[Symbol.for("slothlet.test.i625.global")] = { self, own: { n: 1 } };
}

/**
 * What this module's lifecycle subscribers received, kept outside the module so a removed module's subscriber
 * records into the same list a test reads.
 * @type {Array<{event: string, apiPath: *, tokenType: string}>}
 */
const lifecycleSeen = (globalThis[Symbol.for("slothlet.test.i625.lifecycleSeen")] ??= []);

/**
 * Register, from this module's code, an `after` hook on `pattern` that marks the result, an event listener on
 * `event`, and a lifecycle subscriber on `impl:removed`, each recording into a list outside the module.
 * @param {string} pattern - The hook pattern (`path:after`).
 * @param {string} event - The event to listen to.
 * @returns {Record<string, string>} Outcome of each registration.
 * @example
 * registerCallbacks("victim.v.secret:after", "victim.news");
 */
export function registerCallbacks(pattern, event) {
	const outcome = (run) => {
		try {
			run();
			return "done";
		} catch (error) {
			return error?.code ?? String(error);
		}
	};
	return {
		hook: outcome(() => self.slothlet.hook.on(pattern, ({ result }) => `HOOKED:${result}`)),
		event: outcome(() =>
			self.slothlet.event.on(event, (payload) => {
				lifecycleSeen.push({ event, apiPath: payload ?? null, tokenType: "event" });
			})
		),
		lifecycle: outcome(() =>
			self.slothlet.lifecycle.on("impl:removed", (data, token) => {
				lifecycleSeen.push({ event: "impl:removed", apiPath: data?.apiPath ?? null, tokenType: typeof token });
			})
		)
	};
}

/**
 * {@link registerCallbacks}, pinned to this module with `lockCaller` and handed back to call later.
 * @param {string} pattern - The hook pattern.
 * @param {string} event - The event to listen to.
 * @returns {function(): Record<string, string>} Registers them and reports each outcome.
 * @example
 * keepRegistering("victim.v.secret:after", "victim.news")();
 */
export function keepRegistering(pattern, event) {
	return self.slothlet.lockCaller(() => registerCallbacks(pattern, event));
}

/**
 * What this module's subscribers recorded, cleared on read.
 * @returns {Array<{event: string, apiPath: *, tokenType: string}>} The records, in order.
 * @example
 * takeLifecycleSeen();
 */
export function takeLifecycleSeen() {
	return lifecycleSeen.splice(0);
}

/**
 * Install, from this module's code, an event delivery strategy that, on every emit, writes a member on `target`
 * through `self`, records the outcome in the list {@link takeConditionWrites} reads, and delivers.
 * @param {string} target - Dotted path of the node the strategy writes.
 * @returns {string} `"done"`, or the error code it was refused with.
 * @example
 * installStrategy("victim.v");
 */
export function installStrategy(target) {
	const read = (apiPath) => apiPath.split(".").reduce((value, part) => value[part], self);
	try {
		self.slothlet.event.strategy((_envelope, _listeners, deliver) => {
			conditionWrites.push(
				attempt(() => {
					read(target).viaStrategy = 1;
				})
			);
			return deliver();
		});
		return "done";
	} catch (error) {
		return error?.code ?? String(error);
	}
}

/**
 * Call the function the host put on the global object under `key`, from this module's code.
 * @param {string} key - The `Symbol.for` key it is stored under.
 * @returns {Promise<*>} What it returned, or the error code it threw.
 * @example
 * await callGlobal("slothlet.test.i625.bridge");
 */
export async function callGlobal(key) {
	try {
		return await globalThis[Symbol.for(key)]();
	} catch (error) {
		return error?.code ?? String(error);
	}
}

/**
 * Subscribe, from this module's code, to `impl:removed`, holding open every removal of a path under `prefix` until
 * the host calls the release function it finds on the global object under `slothlet.test.i625.release`.
 * @param {string} prefix - Paths whose removal is held.
 * @returns {void}
 * @example
 * holdRemoval("bait");
 */
export function holdRemoval(prefix) {
	let release;
	const gate = new Promise((resolve) => {
		release = resolve;
	});
	globalThis[Symbol.for("slothlet.test.i625.release")] = release;
	self.slothlet.lifecycle.on("impl:removed", (data) => (String(data?.apiPath ?? "").startsWith(prefix) ? gate : undefined));
}

/**
 * Change the victim's data objects, read through `self`, every way plain JS lets code change them.
 * @returns {Record<string, string>} Outcome of each change.
 * @example
 * changeVictimData();
 */
export function changeVictimData() {
	const d = self.victim.v.data;
	return {
		mapSet: attempt(() => d.cache.set("evil", 1)),
		mapDelete: attempt(() => d.cache.delete("cfg")),
		mapClear: attempt(() => d.cache.clear()),
		mapNested: attempt(() => {
			d.cache.get("cfg").level = 9;
		}),
		mapIterated: attempt(() => {
			for (const [, value] of d.cache) value.level = 8;
		}),
		mapForEach: attempt(() => d.cache.forEach((value) => (value.level = 7))),
		mapProto: attempt(() => Object.setPrototypeOf(d.cache, null)),
		setAdd: attempt(() => d.tags.add("evil")),
		setClear: attempt(() => d.tags.clear()),
		dateSet: attempt(() => d.when.setFullYear(2000)),
		bufferTransfer: attempt(() => d.buffer.transfer()),
		bufferResize: attempt(() => d.buffer.resize(4)),
		bytesIndex: attempt(() => {
			d.bytes[0] = 9;
		}),
		bytesFill: attempt(() => d.bytes.fill(0)),
		bytesSet: attempt(() => d.bytes.set([7], 1)),
		patternCompile: attempt(() => d.pattern.compile("y")),
		patternMember: attempt(() => {
			d.pattern.extra = 1;
		}),
		defineMember: attempt(() => Object.defineProperty(d.cache, "extra", { value: 1 }))
	};
}

/**
 * Read and use the victim's data objects, read through `self`, as plain JS does.
 * @returns {Record<string, *>} What each read gave.
 * @example
 * readVictimData();
 */
export function readVictimData() {
	const d = self.victim.v.data;
	return {
		mapGet: d.cache.get("cfg").level,
		mapHas: d.cache.has("cfg"),
		mapSize: d.cache.size,
		mapIsMap: d.cache instanceof Map,
		mapSpread: [...d.cache.keys()].join(","),
		copied: new Map(d.cache).size,
		setHas: d.tags.has("a"),
		dateTime: d.when.getTime(),
		dateJson: JSON.stringify(d.when),
		bufferLength: d.buffer.byteLength,
		bytes: [...d.bytes].join(","),
		bytesSlice: [...d.bytes.slice(1)].join(","),
		bytesIndex: d.bytes[2],
		patternTest: d.pattern.test("x"),
		patternSource: d.pattern.source
	};
}

/**
 * {@link readVictimData}, reporting the error code a refused read throws instead of throwing it.
 * @returns {Record<string, *>|string} What each read gave, or the error code.
 * @example
 * readVictimDataOutcome();
 */
export function readVictimDataOutcome() {
	try {
		return readVictimData();
	} catch (error) {
		return error?.code ?? String(error);
	}
}

/**
 * Read the `Map` at `apiPath` through `self`, then add an entry to it and read one back.
 * @param {string} apiPath - Dotted path of the `Map`.
 * @returns {{read: *, change: string}} What a read gave, and the outcome of the change.
 * @example
 * changeMapAt("syn.cache");
 */
export function changeMapAt(apiPath) {
	const map = apiPath.split(".").reduce((value, part) => value[part], self);
	return {
		read: map.get("k")?.n,
		change: attempt(() => map.set("evil", 1))
	};
}

/**
 * Keep the victim's `Map`, read through `self` now, and hand back a function that lists its keys later.
 * @returns {function(): string} Lists the kept `Map`'s keys.
 * @example
 * keepVictimCache()();
 */
export function keepVictimCache() {
	const cache = self.victim.v.data.cache;
	return () => [...cache.keys()].join(",");
}

/**
 * Whether the victim's bytes, read through `self`, are the typed array itself, as native code needs.
 * @returns {{isView: boolean, copied: string}} What `ArrayBuffer.isView` says of them, and a copy of them.
 * @example
 * victimBytesNative();
 */
export function victimBytesNative() {
	const bytes = self.victim.v.data.bytes;
	return { isView: ArrayBuffer.isView(bytes), copied: [...Buffer.from(bytes)].join(",") };
}

/**
 * Change the victim's data objects, read through `self`, by routes past the plain ones: methods the engine added
 * lately, inherited definers, a callback's array argument, what a set comparison shows a set-like, an own member's
 * descriptor, and a prototype of the victim's own kind.
 * @returns {Record<string, string>} Outcome of each change.
 * @example
 * changeVictimDataByRoute();
 */
export function changeVictimDataByRoute() {
	const d = self.victim.v.data;
	return {
		getOrInsert: attempt(() => (typeof Map.prototype.getOrInsert === "function" ? d.cache.getOrInsert("evil", 1) : d.cache.set("evil", 1))),
		setFromHex: attempt(() => (typeof Uint8Array.prototype.setFromHex === "function" ? d.bytes.setFromHex("2c") : d.bytes.fill(0))),
		defineGetter: attempt(() => d.cache.__defineGetter__("x", () => 1)),
		callbackArray: attempt(() =>
			d.bytes.forEach((_value, _index, array) => {
				array[0] = 42;
			})
		),
		setLikeShown: attempt(() => {
			let shown = null;
			d.members.isSubsetOf({
				size: 9,
				has(entry) {
					shown = entry;
					return true;
				},
				keys: () => [][Symbol.iterator]()
			});
			shown.n = 1;
		}),
		ownDescriptor: attempt(() => {
			Object.getOwnPropertyDescriptor(d.registry, "meta").value.level = 1;
		}),
		ownPrototype: attempt(() => {
			Object.getPrototypeOf(d.registry).lookup = () => "pwned";
		})
	};
}

/**
 * Use the victim's data objects, read through `self`, where using them makes something of the caller's own.
 * @returns {Record<string, *>} What each use gave.
 * @example
 * useVictimDataCopies();
 */
export function useVictimDataCopies() {
	const d = self.victim.v.data;
	const union = d.members.union(new Set([5]));
	return {
		unionAdd: attempt(() => union.add(6)),
		unionSize: union.size,
		registryLookup: d.registry.lookup("k"),
		registryGet: d.registry.get("k"),
		sliceFill: attempt(() => d.bytes.slice().fill(0))
	};
}

/**
 * Run, as this module, the function the host put on the global object under `key`, handing it this module's `self`.
 * @param {string} key - The `Symbol.for` key it is stored under.
 * @returns {Promise<*>} What it returned.
 * @example
 * await runWithSelf("slothlet.test.i625.probe");
 */
export async function runWithSelf(key) {
	return globalThis[Symbol.for(key)](self);
}

/**
 * One change to each of the victim's data objects, read through `self`.
 * @returns {Record<string, string>} Outcome of each change, by kind.
 * @example
 * changeEachVictimData();
 */
export function changeEachVictimData() {
	const d = self.victim.v.data;
	return {
		map: attempt(() => d.cache.set("granted", 1)),
		set: attempt(() => d.tags.add("granted")),
		date: attempt(() => d.when.setTime(7)),
		buffer: attempt(() => d.buffer.resize(12)),
		bytes: attempt(() => {
			d.bytes[0] = 9;
		}),
		pattern: attempt(() => {
			d.pattern.lastIndex = 1;
		}),
		members: attempt(() => d.members.add("granted")),
		registry: attempt(() => d.registry.set("granted", 1))
	};
}

/**
 * One read of each of the victim's data objects, through `self`.
 * @returns {Record<string, *>} What each read gave, or the error code it was refused with.
 * @example
 * readEachVictimData();
 */
export function readEachVictimData() {
	const read = (path) => {
		try {
			return path.reduce((value, key) => value[key], self.victim.v.data) === undefined ? "missing" : "read";
		} catch (error) {
			return error?.code ?? String(error);
		}
	};
	return {
		map: read(["cache"]),
		set: read(["tags"]),
		date: read(["when"]),
		buffer: read(["buffer"]),
		bytes: read(["bytes"]),
		pattern: read(["pattern"]),
		members: read(["members"]),
		registry: read(["registry"])
	};
}

/**
 * Keep each of the victim's data objects, read through `self` now, and hand back a function reporting what each holds
 * later.
 * @returns {function(): Record<string, *>} Reports what each kept object holds.
 * @example
 * keepEachVictimData()();
 */
export function keepEachVictimData() {
	const d = self.victim.v.data;
	const kept = { cache: d.cache, tags: d.tags, when: d.when, buffer: d.buffer, bytes: d.bytes, pattern: d.pattern, members: d.members };
	return () => ({
		map: [...kept.cache.keys()].join(","),
		set: [...kept.tags].join(","),
		date: kept.when.getTime(),
		buffer: kept.buffer.byteLength,
		bytes: [...kept.bytes].join(","),
		pattern: kept.pattern.lastIndex,
		members: kept.members.size
	});
}
