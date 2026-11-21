/**
 *
 *	@Project: @cldmv/slothlet
 *	@Filename: /api_tests/api_test_function_members/callee/bus.mjs
 *	@Date: 2026-11-03T00:00:00-08:00 (1793692800)
 *	@Author: Nate Corcoran <CLDMV>
 *	@Email: <Shinrai@users.noreply.github.com>
 *	-----
 *	@Last modified by: Nate Corcoran <CLDMV> (Shinrai@users.noreply.github.com)
 *	@Last modified time: 2026-11-03T03:43:46-08:00 (1793706226)
 *	-----
 *	@Copyright: Copyright (c) 2013-2026 Catalyzed Motivation Inc. All rights reserved.
 *
 */

/**
 * @fileoverview #632 — an emitter of a class of the callee's own: the node reports that class as its `constructor`.
 *
 * @module api_tests/api_test_function_members/callee/bus
 */

import { Bus } from "../../api_test_function_members_lib/bus-class.mjs";

/**
 * The module's emitter.
 * @type {Bus}
 * @public
 */
export default new Bus();
