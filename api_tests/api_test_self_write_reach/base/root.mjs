/**
 *
 *	@Project: @cldmv/slothlet
 *	@Filename: /api_tests/api_test_self_write_reach/base/root.mjs
 *	@Date: 2026-10-18T18:42:03-07:00 (1792374123)
 *	@Author: Nate Corcoran <CLDMV>
 *	@Email: <Shinrai@users.noreply.github.com>
 *	-----
 *	@Last modified by: Nate Corcoran <CLDMV> (Shinrai@users.noreply.github.com)
 *	@Last modified time: 2026-10-18T21:34:51-07:00 (1792384491)
 *	-----
 *	@Copyright: Copyright (c) 2013-2026 Catalyzed Motivation Inc. All rights reserved.
 *
 */

/**
 * @fileoverview Base-module code, which owns the whole api tree, changing `self` itself (#625).
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
 * Define, read, and delete a member of `self`, as the owner of the whole tree.
 * @returns {Record<string, *>} Outcome of each change, and what was read back.
 * @example
 * changeSelf();
 */
export function changeSelf() {
	const define = attempt(() => {
		Object.defineProperty(self, "baseDefined", { value: 7, configurable: true, writable: true, enumerable: true });
	});
	const read = self.baseDefined;
	const remove = attempt(() => {
		if (!delete self.baseDefined) throw new Error("NOT_DELETED");
	});
	const gone = self.baseDefined === undefined;
	// `self` is shared by every module of every instance, so a member it held fixed could never be released:
	// the definition is refused, and nothing is defined.
	const defineFixed = attempt(() => {
		Object.defineProperty(self, "baseFixed", { value: 1, configurable: false });
	});
	const accessor = attempt(() => {
		Object.defineProperty(self, "baseGetter", { get: () => 8, configurable: true, enumerable: false });
	});
	const accessorRead = self.baseGetter;
	delete self.baseGetter;
	// `self` keeps its prototype and stays extensible, as it is one object for every instance.
	const setPrototypeOf = attempt(() => {
		Object.setPrototypeOf(self, null);
	});
	const preventExtensions = attempt(() => {
		Object.preventExtensions(self);
	});
	return {
		define,
		read,
		remove,
		gone,
		defineFixed,
		fixedGone: self.baseFixed === undefined,
		accessor,
		accessorRead,
		setPrototypeOf,
		preventExtensions
	};
}

/**
 * List the members of `self`.
 * @returns {number} How many members `self` has.
 * @example
 * listSelf(); // 4
 */
export function listSelf() {
	return Object.keys(self).length;
}

/**
 * Write a member of the framework namespace, as the owner of the whole tree.
 * @returns {string} `"done"`, or the error code it was refused with.
 * @example
 * writeNamespace(); // "PERMISSION_DENIED"
 */
export function writeNamespace() {
	return attempt(() => {
		self.slothlet.lifted = 1;
	});
}

/**
 * Add a rule granting writes to the framework namespace, from module code.
 * @returns {string} `"done"`, or the error code it was refused with.
 * @example
 * grantByRule(); // "INVALID_PERMISSION_RULE"
 */
export function grantByRule() {
	return attempt(() => {
		self.slothlet.permissions.addRule({ caller: "**", target: "slothlet.**:write", effect: "allow" });
	});
}

/**
 * Mount a folder with a rule granting writes to the framework namespace, from module code.
 * @param {string} folder - Folder to mount at `granted`.
 * @returns {Promise<string>} `"done"`, or the error code it was refused with.
 * @example
 * await grantByAdd("/abs/victim"); // "INVALID_PERMISSION_RULE"
 */
export async function grantByAdd(folder) {
	try {
		await self.slothlet.api.add("granted", folder, { moduleID: "granted", permissions: { allow: ["slothlet.**:write"] } });
		return "done";
	} catch (error) {
		return error?.code ?? error?.name ?? String(error);
	}
}

/**
 * Define, read, and delete a member of `self` inside a scope the host opened with full isolation.
 * @returns {{define: string, read: *, accessor: string, remove: string, gone: boolean}} Outcomes.
 * @example
 * changeScopedSelf();
 */
export function changeScopedSelf() {
	const define = attempt(() => {
		Object.defineProperty(self, "scoped", { value: 3, configurable: true, writable: true, enumerable: true });
	});
	const read = self.scoped;
	const accessor = attempt(() => {
		Object.defineProperty(self, "scopedGetter", { get: () => 4, configurable: true });
	});
	const remove = attempt(() => {
		if (!delete self.scoped) throw new Error("NOT_DELETED");
	});
	return { define, read, accessor, remove, gone: self.scoped === undefined };
}

/**
 * Add rules from module code that grant nothing a module may not: a rule denying writes, a rule allowing a call,
 * and a malformed rule.
 * @returns {{deny: string, call: string, malformed: string}} Outcome of each.
 * @example
 * addOtherRules(); // { deny: "done", call: "done", malformed: "INVALID_PERMISSION_RULE" }
 */
export function addOtherRules() {
	return {
		deny: attempt(() => {
			self.slothlet.permissions.addRule({ caller: "**", target: "victim.**:write", effect: "deny" });
		}),
		call: attempt(() => {
			self.slothlet.permissions.addRule({ caller: "**", target: "victim.**", effect: "allow" });
		}),
		malformed: attempt(() => {
			self.slothlet.permissions.addRule({ caller: "**", effect: "allow" });
		})
	};
}

/**
 * Write a member of the framework namespace a rule manager granted this module.
 * @returns {string} `"done"`, or the error code it was refused with.
 * @example
 * writeManaged(); // "done"
 */
export function writeManaged() {
	return attempt(() => {
		self.slothlet.managed = 1;
	});
}
