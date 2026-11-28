/**
 *
 *	@Project: @cldmv/slothlet
 *	@Filename: /api_tests/api_test_private_fn_read/api/tool.mjs
 *	@Date: 2026-11-25T12:06:48-08:00 (1795637208)
 *	@Author: Nate Corcoran <CLDMV>
 *	@Email: <Shinrai@users.noreply.github.com>
 *	-----
 *	@Last modified by: Nate Corcoran <CLDMV> (Shinrai@users.noreply.github.com)
 *	@Last modified time: 2026-11-25T12:20:24-08:00 (1795638024)
 *	-----
 *	@Copyright: Copyright (c) 2013-2026 Catalyzed Motivation Inc. All rights reserved.
 *
 */

/**
 * @fileoverview A file with private members (a function carrying a member of its own, and a value) and a public
 * function. The folder is composed twice: as the base module and by `api.slothlet.api.add("ext", …)`.
 * @module api_test_private_fn_read/tool
 */
import { self } from "@cldmv/slothlet/runtime";
import { probe, callAt } from "../lib/probe.mjs";

/** @type {number} */
export const _value = 41;

/**
 * A private function; its source and the member it carries are the module's.
 * @param {string} x - Any text.
 * @returns {string} The text, marked.
 */
export function _secret(x) {
	return `SOURCE_7731:${x}`;
}
_secret.label = "LABEL_7731";

/**
 * A public function.
 * @param {string} x - Any text.
 * @returns {string} The text, marked.
 */
export function pub(x) {
	return `pub:${x}`;
}

/**
 * Probe the member at a path from this file.
 * @param {string} path - Dotted api path.
 * @returns {object} The outcomes.
 */
export function look(path) {
	return probe(self, path);
}

/**
 * Call the member at a path from this file.
 * @param {string} path - Dotted api path.
 * @param {...*} args - Arguments.
 * @returns {Promise<{value: *, error: string|null}>} The result or the refusal's code.
 */
export function call(path, ...args) {
	return callAt(self, path, ...args);
}
