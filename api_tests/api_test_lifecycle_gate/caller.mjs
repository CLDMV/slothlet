/**
 *	@Project: @cldmv/slothlet
 *	@Filename: /api_tests/api_test_lifecycle_gate/caller.mjs
 *	@Date: 2026-09-28T22:30:00-07:00 (1790659800)
 *	@Author: Nate Corcoran <CLDMV>
 *	@Email: <Shinrai@users.noreply.github.com>
 *	-----
 *	@Last modified by: Nate Corcoran <CLDMV> (Shinrai@users.noreply.github.com)
 *	@Last modified time: 2026-09-28 22:30:00 -07:00 (1790659800)
 *	-----
 *	@Copyright: Copyright (c) 2013-2026 Catalyzed Motivation Inc. All rights reserved.
 */

/**
 * @fileoverview Fixture for #529: a module that calls the framework's lifecycle methods and the root routine paths.
 * @module api_test_lifecycle_gate.caller
 */
import { self } from "@cldmv/slothlet/runtime";

/**
 * Call `self.slothlet.reload()` as this module.
 * @returns {Promise<unknown>} The reload result.
 */
export async function nsReload() {
	return self.slothlet.reload();
}

/**
 * Call `self.slothlet.shutdown()` as this module.
 * @returns {Promise<unknown>} The shutdown result.
 */
export async function nsShutdown() {
	return self.slothlet.shutdown();
}

/**
 * Call the root `self.shutdown()` as this module.
 * @returns {Promise<unknown>} The shutdown result.
 */
export async function rootShutdown() {
	return self.shutdown();
}

/**
 * Call a root-level function by name as this module (routine paths such as a renamed routine).
 * @param {string} name - Root key.
 * @returns {Promise<unknown>} The call's result.
 */
export async function callRoot(name) {
	return self[name]();
}

/**
 * Call the root `self.destroy()` as this module (framework-internal shutdown must not be gated).
 * @returns {Promise<unknown>} The destroy result.
 */
export async function rootDestroy() {
	return self.destroy();
}
