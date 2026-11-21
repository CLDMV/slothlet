/**
 *
 *	@Project: @cldmv/slothlet
 *	@Filename: /tests/smoke/runtime-floor-api/report.mjs
 *	@Date: 2026-11-17T00:00:00-08:00 (1794902400)
 *	@Author: Nate Corcoran <CLDMV>
 *	@Email: <Shinrai@users.noreply.github.com>
 *	-----
 *	@Last modified by: Nate Corcoran <CLDMV> (Shinrai@users.noreply.github.com)
 *	@Last modified time: 2026-11-17T00:00:00-08:00 (1794902400)
 *	-----
 *	@Copyright: Copyright (c) 2013-2026 Catalyzed Motivation Inc. All rights reserved.
 *
 */

/**
 * @fileoverview Leaf for the runtime-floor smoke check that reaches a sibling through `self` and
 * reads the instance context, so the live bindings from `@cldmv/slothlet/runtime` are exercised.
 * @module api_runtime_floor.report
 * @internal
 */

import { self, context } from "@cldmv/slothlet/runtime";

/**
 * Adds two numbers through `self.math.add` and reports the context's `user`.
 * @param {number} a - First addend.
 * @param {number} b - Second addend.
 * @returns {{ sum: number, user: string }} The sum and the context user.
 */
export function report(a, b) {
	return { sum: self.math.add(a, b), user: context.user };
}
