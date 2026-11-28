/**
 *
 *	@Project: @cldmv/slothlet
 *	@Filename: /api_tests/api_test_framework_name_routes/routes/probe/classy.mjs
 *	@Date: 2026-11-25T14:52:50-08:00 (1795647170)
 *	@Author: Nate Corcoran <CLDMV>
 *	@Email: <Shinrai@users.noreply.github.com>
 *	-----
 *	@Last modified by: Nate Corcoran <CLDMV> (Shinrai@users.noreply.github.com)
 *	@Last modified time: 2026-11-25T16:03:27-08:00 (1795651407)
 *	-----
 *	@Copyright: Copyright (c) 2013-2026 Catalyzed Motivation Inc. All rights reserved.
 *
 */

/**
 * @fileoverview A class instance whose class carries a method named with the framework's prefix.
 * @module api_test_framework_name_routes.routes.probe.classy
 */

import { planted } from "../../lib/capture.mjs";

const call = planted("classy.___createChildWrapper");

/** A class with such a method. */
class Holder {
	___createChildWrapper(...args) {
		return call(...args);
	}

	/** An ordinary member. */
	zeta = { leaf: 1 };
}

/** The instance. */
export const instance = new Holder();

export { calls } from "../../lib/capture.mjs";
