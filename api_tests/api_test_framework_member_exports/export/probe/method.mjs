/**
 *
 *	@Project: @cldmv/slothlet
 *	@Filename: api_tests/api_test_framework_member_exports/export/probe/method.mjs
 *	@Date: 2026-11-25T13:13:43-08:00 (1795641223)
 *	@Author: Nate Corcoran <CLDMV>
 *	@Email: <Shinrai@users.noreply.github.com>
 *	-----
 *	@Last modified by: Nate Corcoran <CLDMV> (Shinrai@users.noreply.github.com)
 *	@Last modified time: 2026-11-28T04:28:00-08:00 (1795868880)
 *	-----
 *	@Copyright: Copyright (c) 2013-2026 Catalyzed Motivation Inc. All rights reserved.
 *
 */

/**
 * @fileoverview A top-level export named for one of the wrapper's own methods (`___createChildWrapper`). The loader
 * refuses it: the name belongs to the framework.
 * @module api_test_framework_member_exports.export.probe.method
 */

import { note } from "../../lib/capture.mjs";

/**
 * Named like the wrapper's child factory.
 * @returns {undefined}
 */
export function ___createChildWrapper() {
	note("___createChildWrapper");
	return undefined;
}

/** A member adopted after the export above. */
export const zeta = { inner: { leaf: 1 } };

export { calls } from "../../lib/capture.mjs";
