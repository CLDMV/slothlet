/**
 *
 *	@Project: @cldmv/slothlet
 *	@Filename: /api_tests/api_test_helper_imports/api/shared/shared.mjs
 *	@Date: 2026-09-28T20:29:31-07:00 (1790652571)
 *	@Author: Nate Corcoran <CLDMV>
 *	@Email: <Shinrai@users.noreply.github.com>
 *	-----
 *	@Last modified by: Nate Corcoran <CLDMV> (Shinrai@users.noreply.github.com)
 *	@Last modified time: 2026-10-30T23:02:59-07:00 (1793426579)
 *	-----
 *	@Copyright: Copyright (c) 2013-2026 Catalyzed Motivation Inc. All rights reserved.
 *
 */

/**
 * @fileoverview Leaf importing a bare package specifier, a node builtin and slothlet's own runtime —
 * all three must stay SHARED across instances, never duplicated per instance (#518).
 * @module api_test_helper_imports.shared
 */
import { self } from "@cldmv/slothlet/runtime";
import * as runtime from "@cldmv/slothlet/runtime";
import { EventEmitter } from "node:events";
import { Parser } from "acorn";

/**
 * The module objects this leaf imported, for identity comparison across instances.
 * @returns {{ runtime: object, EventEmitter: Function }} The imported references.
 */
export function refs() {
	return { runtime, EventEmitter };
}

/**
 * Whether the package this instance's copy of the leaf imported is the one the first instance's copy did: the first
 * call keeps its own on the global object. Compared here, since the package's class handed out of the api comes back
 * as each instance's own stand-in (#597).
 * @returns {boolean} True when it is the same `Parser`.
 */
export function sameParser() {
	const key = Symbol.for("api_test_helper_imports.firstParser");
	globalThis[key] ??= Parser;
	return Parser === globalThis[key];
}

/**
 * Reach a sibling through the live-binding runtime, proving it serves this instance.
 * @returns {Promise<number>} The `peer.count()` result.
 */
export async function viaSelf() {
	return self.peer.count();
}
