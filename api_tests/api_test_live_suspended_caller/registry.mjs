/**
 *	@Project: @cldmv/slothlet
 *	@Filename: /api_tests/api_test_live_suspended_caller/registry.mjs
 *	@Date: 2026-09-28 18:00:00 -07:00 (1790644800)
 *	@Author: Nate Corcoran <CLDMV>
 *	@Email: <Shinrai@users.noreply.github.com>
 *	-----
 *	@Last modified by: Nate Corcoran <CLDMV> (Shinrai@users.noreply.github.com)
 *	@Last modified time: 2026-09-28 18:00:00 -07:00 (1790644800)
 *	-----
 *	@Copyright: Copyright (c) 2013-2026 Catalyzed Motivation Inc. All rights reserved.
 */

/**
 * @fileoverview Host registry: holds callbacks an extension registers and invokes them later.
 *
 * @description
 * Mirrors a host view registry — an extension registers a render callback during activation and the
 * host renders it later, from the host's own flow, after the activation has settled.
 *
 * @module api_test_live_suspended_caller.registry
 */
import { attempt } from "./shared/attempt.mjs";

const callbacks = [];

/**
 * Store a callback for a later {@link renderAll}.
 * @param {Function} callback - Callback to hold.
 * @returns {number} Number of held callbacks.
 */
export function register(callback) {
	callbacks.push(callback);
	return callbacks.length;
}

/**
 * Invoke and drop every held callback. Each is invoked synchronously; only the results are awaited.
 * @returns {Promise<Array<*>>} Each callback's result, or `"denied"`.
 */
export function renderAll() {
	return Promise.all(callbacks.splice(0).map((callback) => attempt(callback)));
}

/**
 * Number of held callbacks — a call the host's own leaves are permitted to make.
 * @returns {number} Held callback count.
 */
export function list() {
	return callbacks.length;
}
