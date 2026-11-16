/**
 *
 *	@Project: @cldmv/slothlet
 *	@Filename: /api_tests/api_test_code_strings/coder/probe.mjs
 *	@Date: 2026-11-15T00:00:00-08:00 (1794729600)
 *	@Author: Nate Corcoran <CLDMV>
 *	@Email: <Shinrai@users.noreply.github.com>
 *	-----
 *	@Last modified by: Nate Corcoran <CLDMV> (Shinrai@users.noreply.github.com)
 *	@Last modified time: 2026-11-15T00:00:00-08:00 (1794729600)
 *	-----
 *	@Copyright: Copyright (c) 2013-2026 Catalyzed Motivation Inc. All rights reserved.
 *
 */

/**
 * @fileoverview A module that turns strings into code by every route the language and Node offer, and reports whether
 * each went through. Each route compiles `return 7` (or an equivalent) and runs it.
 *
 * @module api_tests/api_test_code_strings/coder/probe
 */

import vm from "node:vm";
import Module from "node:module";
import { fileURLToPath } from "node:url";
import { routes } from "../routes.mjs";

/**
 * Try one route.
 * @param {string} route - The route's name (see `routes.mjs`).
 * @returns {Promise<{ok: boolean, value?: *, code?: string}>} The outcome.
 * @public
 * @example
 * await api.coder.probe.attempt("Function"); // { ok: false, code: "CAPABILITY_REFUSED" }
 */
export async function attempt(route) {
	try {
		return { ok: true, value: await routes[route]({ vm, Module, file: fileURLToPath(import.meta.url) }) };
	} catch (error) {
		return { ok: false, code: error?.code ?? error?.name ?? String(error) };
	}
}

/**
 * Try one route, from a second leaf of this file.
 * @param {string} route - The route's name (see `routes.mjs`).
 * @returns {Promise<{ok: boolean, value?: *, code?: string}>} The outcome.
 * @public
 * @example
 * await api.coder.probe.attemptToo("Function"); // { ok: false, code: "CAPABILITY_REFUSED" }
 */
export async function attemptToo(route) {
	return attempt(route);
}
