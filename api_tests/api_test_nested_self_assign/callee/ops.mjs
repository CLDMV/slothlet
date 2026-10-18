/**
 *
 *	@Project: @cldmv/slothlet
 *	@Filename: /api_tests/api_test_nested_self_assign/callee/ops.mjs
 *	@Date: 2026-10-17T21:07:21-07:00 (1792296441)
 *	@Author: Nate Corcoran <CLDMV>
 *	@Email: <Shinrai@users.noreply.github.com>
 *	-----
 *	@Last modified by: Nate Corcoran <CLDMV> (Shinrai@users.noreply.github.com)
 *	@Last modified time: 2026-10-18T00:22:38-07:00 (1792308158)
 *	-----
 *	@Copyright: Copyright (c) 2013-2026 Catalyzed Motivation Inc. All rights reserved.
 *
 */

// Mounted at apiPath "callee" (moduleID "callee") by the nested self-assign ownership tests (#625).
// `useSecret` is the member another module tries to replace; `writeOwnNested` writes under the
// module's own subtree, which stays allowed.
import { self } from "@cldmv/slothlet/runtime";

/**
 * The member a foreign module tries to replace.
 * @returns {string} The callee's own answer.
 */
export function useSecret() {
	return "callee-original";
}

/**
 * Write a value under this module's own mount point, below the top level.
 * @param {*} value - Value to write.
 * @returns {*} The value read back through `self`.
 */
export function writeOwnNested(value) {
	self.callee.ops.note = value;
	return self.callee.ops.note;
}

/**
 * An array member: another module setting its prototype would reach the module's own array.
 * @type {string[]}
 */
export const list = ["a", "b"];

/**
 * Stay suspended on the gate: a call of this module in flight while another module's code runs.
 * @param {Promise<void>} gate - Released by the test.
 * @returns {Promise<string>} `"held"`.
 */
export async function hold(gate) {
	await gate;
	return "held";
}

/**
 * Keep this module's own node, read through `self`, and hand back a function that writes into it later,
 * outside any call into this module.
 * @returns {function(*): *} The deferred write; returns what it reads back.
 */
export function deferOwnWrite() {
	const ops = self.callee.ops;
	return (value) => {
		ops.later = value;
		return ops.later;
	};
}

/**
 * Hand back this module's own node, read through `self`.
 * @returns {object} The node.
 */
export function ownNode() {
	return self.callee.ops;
}

/**
 * Hand back the receiver it was called on.
 * @returns {*} `this`.
 */
export function getThis() {
	return this;
}

/**
 * Hand back the receiver it was called on, asynchronously.
 * @returns {Promise<*>} `this`.
 */
export async function getThisAsync() {
	return this;
}

/**
 * Hand back a function that writes into the receiver this was called on, later.
 * @returns {Function} The deferred write.
 */
export function writerForThis() {
	const node = this;
	return () => {
		node.useSecret = () => "pwned-by-kept-receiver";
	};
}
