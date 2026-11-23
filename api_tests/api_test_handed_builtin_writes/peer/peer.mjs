/**
 *
 *	@Project: @cldmv/slothlet
 *	@Filename: /api_tests/api_test_handed_builtin_writes/peer/peer.mjs
 *	@Date: 2026-11-21T12:56:33-08:00 (1795294593)
 *	@Author: Nate Corcoran <CLDMV>
 *	@Email: <Shinrai@users.noreply.github.com>
 *	-----
 *	@Last modified by: Nate Corcoran <CLDMV> (Shinrai@users.noreply.github.com)
 *	@Last modified time: 2026-11-21T15:06:52-08:00 (1795302412)
 *	-----
 *	@Copyright: Copyright (c) 2013-2026 Catalyzed Motivation Inc. All rights reserved.
 *
 */

/**
 * @fileoverview A mounted module that runs a callback it is handed with the arguments it is handed.
 * @module api_test_handed_builtin_writes/peer
 */

import { self } from "@cldmv/slothlet/runtime";

/**
 * Each way of reading a member private to another module through one of its instances.
 * @type {Record<string, function(object): *>}
 */
const PRIVATE_READS = {
	newData: (owner) => new owner.Box()._pdata,
	madeData: (owner) => owner.makeBox()._pdata,
	madeMethod: (owner) => owner.makeBox()._priv()
};

/**
 * Read a member private to the module at `ownerPath` through one of its instances.
 * @param {string} how - The route.
 * @param {string} ownerPath - The module.
 * @returns {*} What was read, or `"threw <code>"`.
 */
export function readPrivate(how, ownerPath) {
	try {
		return PRIVATE_READS[how](self[ownerPath]);
	} catch (error) {
		return `threw ${error?.code ?? error?.name}`;
	}
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

/**
 * Run the function a data object holds on the target, key and value it holds.
 * @param {{fn: Function, target: object, key: string, value: *}} data - The function and what to call it with.
 * @returns {*} What it returned.
 */
export function runData(data) {
	return data.fn(data.target, data.key, data.value);
}
