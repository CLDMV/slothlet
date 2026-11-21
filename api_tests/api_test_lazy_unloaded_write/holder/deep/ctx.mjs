/**
 *
 *	@Project: @cldmv/slothlet
 *	@Filename: /api_tests/api_test_lazy_unloaded_write/holder/deep/ctx.mjs
 *	@Date: 2026-11-03T23:32:38-08:00 (1793777558)
 *	@Author: Nate Corcoran <CLDMV>
 *	@Email: <Shinrai@users.noreply.github.com>
 *	-----
 *	@Last modified by: Nate Corcoran <CLDMV> (Shinrai@users.noreply.github.com)
 *	@Last modified time: 2026-11-04T00:03:12-08:00 (1793779392)
 *	-----
 *	@Copyright: Copyright (c) 2013-2026 Catalyzed Motivation Inc. All rights reserved.
 *
 */

/**
 * @fileoverview A setter that records the request context it runs in (#653).
 */
import { context } from "@cldmv/slothlet/runtime";

const seen = [];

/**
 * An object whose `s` setter records the `tenant` of the context it is assigned in.
 * @type {{s: *}}
 */
export const probe = {
	set s(value) {
		seen.push(context?.tenant ?? null);
	},
	get s() {
		return seen.length;
	}
};

/**
 * The tenants the setter has seen, in order.
 * @returns {Array<string|null>} The tenants.
 * @example
 * tenants(); // ["A"]
 */
export function tenants() {
	return [...seen];
}
