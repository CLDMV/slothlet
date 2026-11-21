/**
 *
 *	@Project: @cldmv/slothlet
 *	@Filename: /api_tests/api_test_handed_builtin_writes/host/vault.mjs
 *	@Date: 2026-11-21T12:56:33-08:00 (1795294593)
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
 * @fileoverview The base module: a class, a member another module may be refused reading, and a function that runs a
 * callback it is handed with the arguments it is handed.
 * @module api_test_handed_builtin_writes/host/vault
 */

/** A class whose prototype another module may not write. */
export class Box {
	/** @returns {string} Marker. */
	method() {
		return "method";
	}
}

/** A member another module may be refused reading. */
export const secret = "SECRET";

/** A member another module may not replace. */
export const open = "open";

/** @returns {string} Marker. */
export function fn() {
	return "fn";
}

/** @returns {Box} A fresh instance. */
export function makeBox() {
	return new Box();
}

/**
 * Run a callback with what it is handed.
 * @param {Function} cb - The callback.
 * @param {...*} args - Its arguments.
 * @returns {*} What it returned.
 */
export function runCb(cb, ...args) {
	return cb(...args);
}

/** @returns {{method: string, protoKeys: string[]}} The prototype as the module holds it. */
export function protoState() {
	return { method: new Box().method(), protoKeys: Object.getOwnPropertyNames(Box.prototype).sort() };
}
