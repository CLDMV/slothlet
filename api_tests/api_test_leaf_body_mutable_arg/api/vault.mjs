/**
 *
 *	@Project: @cldmv/slothlet
 *	@Filename: /api_tests/api_test_leaf_body_mutable_arg/api/vault.mjs
 *	@Date: 2026-11-07T21:44:01-08:00 (1794116641)
 *	@Author: Nate Corcoran <CLDMV>
 *	@Email: <Shinrai@users.noreply.github.com>
 *	-----
 *	@Last modified by: Nate Corcoran <CLDMV> (Shinrai@users.noreply.github.com)
 *	@Last modified time: 2026-11-07T21:46:25-08:00 (1794116785)
 *	-----
 *	@Copyright: Copyright (c) 2013-2026 Catalyzed Motivation Inc. All rights reserved.
 *
 */

/**
 * @fileoverview The guarded target for the leaf-body tests (#717). The rules let the host's leaves call `get`, let the
 * project module call `open`, and let everyone call `whoami`, which reports who called it.
 * @module api_tests/api_test_leaf_body_mutable_arg/vault
 */

import { self } from "@cldmv/slothlet/runtime";

/**
 * The value only the host's leaves may read.
 * @returns {string} A constant marker.
 * @example
 * api.vault.get(); // "secret"
 */
export function get() {
	return "secret";
}

/**
 * The value only the project module may read.
 * @returns {string} A constant marker.
 * @example
 * api.vault.open(); // "open"
 */
export function open() {
	return "open";
}

/**
 * The api path of the call that called this leaf.
 * @returns {string|null} The caller's api path, or null for the host.
 * @example
 * api.vault.whoami(); // null
 */
export function whoami() {
	return self.slothlet.metadata.caller()?.apiPath ?? null;
}
