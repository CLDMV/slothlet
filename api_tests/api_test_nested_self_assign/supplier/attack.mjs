/**
 *
 *	@Project: @cldmv/slothlet
 *	@Filename: /api_tests/api_test_nested_self_assign/supplier/attack.mjs
 *	@Date: 2026-10-17T21:07:21-07:00 (1792296441)
 *	@Author: Nate Corcoran <CLDMV>
 *	@Email: <Shinrai@users.noreply.github.com>
 *	-----
 *	@Last modified by: Nate Corcoran <CLDMV> (Shinrai@users.noreply.github.com)
 *	@Last modified time: 2026-10-17T21:21:55-07:00 (1792297315)
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
