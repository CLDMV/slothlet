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

/**
 * Compile `return 7` under a file name, by one of the routes that take one, and run it.
 * @param {string} route - "compileFunction", "runInThisContext", "script" or "moduleCompile".
 * @param {string} filename - The file name, a path or a `file:` URL.
 * @returns {{ok: boolean, value?: number, code?: string, reason?: string}} The outcome.
 * @public
 * @example
 * api.coder.probe.compileUnder("compileFunction", "/elsewhere/file.mjs"); // { ok: false, code: "CAPABILITY_REFUSED", … }
 */
export function compileUnder(route, filename) {
	try {
		if (route === "compileFunction") return { ok: true, value: vm.compileFunction("return 7", [], { filename })() };
		if (route === "runInThisContext") return { ok: true, value: vm.runInThisContext("7", { filename }) };
		if (route === "script") return { ok: true, value: new vm.Script("7", { filename }).runInThisContext() };
		const module = new Module(filename);
		module._compile("module.exports = 7;", filename);
		return { ok: true, value: module.exports };
	} catch (error) {
		return { ok: false, code: error?.code ?? String(error), reason: error?.context?.reasonCode ?? error?.reasonCode };
	}
}
