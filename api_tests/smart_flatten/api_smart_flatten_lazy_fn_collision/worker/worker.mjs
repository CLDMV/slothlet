/**
 *	@Project: @cldmv/slothlet
 *	@Filename: /api_tests/smart_flatten/api_smart_flatten_lazy_fn_collision/worker/worker.mjs
 *	@Date: 2026-03-02T00:00:00-08:00 (1772467200)
 *	@Author: Nate Corcoran <CLDMV>
 *	@Email: <Shinrai@users.noreply.github.com>
 *	-----
 *	@Last modified by: Nate Corcoran <CLDMV> (Shinrai@users.noreply.github.com)
 *	@Last modified time: 2026-03-02 16:10:28 -08:00 (1772496628)
 *	-----
 *	@Copyright: Copyright (c) 2013-2026 Catalyzed Motivation Inc. All rights reserved.
 */

/**
 * @fileoverview worker/worker.mjs — function default with pre-attached property.
 * Tests lazy single-file folder materialization when the default export function
 * already has a property whose name conflicts with a named export.
 *
 * Lines triggered in modes-processor.mjs:
 * - 1313-1316: implToWrap = exports.default (function), enters hybrid pattern block
 * - 1330: continue on merge/skip collision (status conflict)
 * - 1339: throw on error collision (status conflict)
 * - 1349: SlothletWarning on warn collision (status conflict)
 * @module api_smart_flatten_lazy_fn_collision.worker
 */

/**
 * Worker entry-point function with a pre-attached status property.
 * @returns {string} Worker identifier.
 * @example
 * worker(); // "worker-impl"
 */
function worker() {
	return "worker-impl";
}

// Pre-attached property — conflicts with the named `status` export below
worker.status = "built-in-status";

export default worker;

/**
 * Intentionally conflicts with worker.status to trigger hasExisting collision paths.
 * @type {string}
 */
export const status = "named-status-override";

/**
 * Version — no conflict with any pre-attached property.
 * @type {string}
 */
export const version = "v1";
