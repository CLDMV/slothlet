/**
 *	@Project: @cldmv/slothlet
 *	@Filename: /api_tests/api_test_cross_instance/probe.mjs
 *	@Author: Nate Corcoran <CLDMV>
 *	@Email: <Shinrai@users.noreply.github.com>
 *	@Copyright: Copyright (c) 2013-2026 Catalyzed Motivation Inc. All rights reserved.
 */

import { self } from "@cldmv/slothlet/runtime";

/**
 * Report this module's own identity via `self.slothlet.caller()` — a same-instance sanity check that
 * the accessor still names this module correctly when its OWN instance's flow is active.
 * @returns {string|null} This module's dotted api path.
 */
export function whoami() {
	return self.slothlet.caller();
}

/**
 * Invoke `callback` synchronously from inside THIS module's extent and return its result. Lets a test
 * drive arbitrary code while this module is the active caller — in particular, code that touches a
 * DIFFERENT slothlet instance, to prove that instance does not mistake this module for its own caller
 * across the process-shared async context.
 * @param {() => T} callback - Invoked with no arguments, inside this module's extent.
 * @returns {T} Whatever `callback` returns.
 * @template T
 */
export function runHere(callback) {
	return callback();
}
