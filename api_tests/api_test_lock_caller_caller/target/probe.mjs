/**
 *
 *	@Project: @cldmv/slothlet
 *	@Filename: /api_tests/api_test_lock_caller_caller/target/probe.mjs
 *	@Date: 2026-09-28 00:00:00 -07:00 (1790578800)
 *	@Author: Nate Corcoran <CLDMV>
 *	@Email: <Shinrai@users.noreply.github.com>
 *	-----
 *	@Last modified by: Nate Corcoran <CLDMV> (Shinrai@users.noreply.github.com)
 *	@Last modified time: 2026-10-03 20:02:50 -07:00 (1791082970)
 *	-----
 *	@Copyright: Copyright (c) 2013-2026 Catalyzed Motivation Inc. All rights reserved.
 *
 */

/**
 * @fileoverview Probe targets for the `lockCaller.caller()` tests (#477): report who called them, and
 * permission-gated routes keyed to the caller.
 *
 * @module api_tests/api_test_lock_caller_caller/target/probe
 */

import { self } from "@cldmv/slothlet/runtime";

/**
 * Report the api path of the module that called this leaf.
 * @returns {string|null} The caller's api path, or null when called from the host.
 * @public
 * @example
 * api.target.probe.whoami(); // null (host)
 */
export function whoami() {
	return self.slothlet.metadata.caller()?.apiPath ?? null;
}

/**
 * Permission-gated route: rules allow it for the client and deny it for the scheduler.
 * @returns {string} A constant marker.
 * @public
 * @example
 * api.target.probe.guarded();
 */
export function guarded() {
	return "guarded-ok";
}

/**
 * Principal-gated route (#459): allowed for the client when its roles grant "read" on `projectId`.
 * @param {string} projectId - Project id.
 * @returns {{projectId: string}} The project marker.
 * @public
 * @example
 * api.target.probe.files("p1");
 */
export function files(projectId) {
	return { projectId };
}
