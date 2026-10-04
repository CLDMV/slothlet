/**
 *
 *	@Project: @cldmv/slothlet
 *	@Filename: /api_tests/api_test_helper_imports/api/shared/shared.mjs
 *	@Date: 2026-09-28T20:29:31-07:00 (1790652571)
 *	@Author: Shinrai <CLDMV>
 *	@Email: <Shinrai@users.noreply.github.com>
 *	-----
 *	@Last modified by: Shinrai <CLDMV> (Shinrai@users.noreply.github.com)
 *	@Last modified time: 2026-10-03T22:14:34-07:00 (1791090874)
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
 * @returns {{ runtime: object, EventEmitter: Function, Parser: Function }} The imported references.
 */
export function refs() {
	return { runtime, EventEmitter, Parser };
}

/**
 * Reach a sibling through the live-binding runtime, proving it serves this instance.
 * @returns {Promise<number>} The `peer.count()` result.
 */
export async function viaSelf() {
	return self.peer.count();
}
