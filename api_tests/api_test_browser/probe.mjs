/**
 *	@Project: @cldmv/slothlet
 *	@Filename: /api_tests/api_test_browser/probe.mjs
 *	@Date: 2026-05-30 00:06:52 -07:00 (1780124812)
 *	@Author: Nate Corcoran <CLDMV>
 *	@Email: <Shinrai@users.noreply.github.com>
 *	-----
 *	@Last modified by: Nate Corcoran <CLDMV> (Shinrai@users.noreply.github.com)
 *	@Last modified time: 2026-06-03 21:17:45 -07:00 (1780546665)
 *	-----
 *	@Copyright: Copyright (c) 2013-2026 Catalyzed Motivation Inc. All rights reserved.
 */

/**
 * @fileoverview Browser-mode test fixture — runtime probes.
 *
 * @description
 * Leaves that read the live runtime (`context`, `self`) so browser-mode tests can verify the
 * AsyncLocalStorage-vs-live context system, ambient/scoped context, and caller resolution work
 * under `platform:"browser"` (live runtime, no `node:async_hooks`).
 * @module api_test_browser.probe
 */

import { self, context } from "@cldmv/slothlet/runtime";

/**
 * Read the ambient context's `user` (seeded via config.context or overridden by context.run/scope).
 * @returns {string|null}
 * @example readUser(); // "alice"
 */
export function readUser() {
	return context && typeof context === "object" ? (context.user ?? null) : null;
}

/**
 * Read an arbitrary key off the ambient context.
 * @param {string} key
 * @returns {*}
 */
export function readContext(key) {
	return context && typeof context === "object" ? context[key] : undefined;
}

/**
 * Resolve the calling wrapper via the metadata caller() API (v1-style caller resolution).
 * @returns {*} The caller wrapper (or null when unavailable).
 * @example caller(); // wrapper or null
 */
export function caller() {
	const meta = self?.slothlet?.metadata;
	return meta && typeof meta.caller === "function" ? meta.caller() : null;
}

/**
 * Call `self.<dottedPath>(...args)` — exercises the `self` live-binding across namespaces and
 * depths (and routes the call as an INTERNAL caller, which the permission system gates).
 * @param {string} dottedPath - e.g. "math.add", "advanced.calc.addViaSelf".
 * @param {...*} args
 * @returns {*}
 * @example viaSelf("math.add", 2, 3); // 5
 */
export function viaSelf(dottedPath, ...args) {
	const fn = dottedPath.split(".").reduce((obj, key) => (obj == null ? obj : obj[key]), self);
	if (typeof fn !== "function") throw new Error(`viaSelf: '${dottedPath}' is not a function on self`);
	return fn(...args);
}
