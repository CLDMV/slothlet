/**
 *
 *	@Project: @cldmv/slothlet
 *	@Filename: /api_tests/api_test_function_member_routes/cls/k.mjs
 *	@Date: 2026-11-15T16:00:00-08:00 (1794787200)
 *	@Author: Nate Corcoran <CLDMV>
 *	@Email: <Shinrai@users.noreply.github.com>
 *	-----
 *	@Last modified by: Nate Corcoran <CLDMV> (Shinrai@users.noreply.github.com)
 *	@Last modified time: 2026-11-15T16:00:00-08:00 (1794787200)
 *	-----
 *	@Copyright: Copyright (c) 2013-2026 Catalyzed Motivation Inc. All rights reserved.
 *
 */

/**
 * @fileoverview A class with a static data member (`K.tag`): mounted at `cls`, it is the node `api.cls.k.K`.
 * @module api_test_function_member_routes.cls.k
 */

/**
 * A class.
 * @example
 * new api.cls.k.K().v; // 1
 */
export class K {
	constructor() {
		this.v = 1;
	}
}
K.tag = "KTAG";

/**
 * Make an instance of the class.
 * @returns {K} The instance.
 * @example
 * api.cls.k.make().v; // 1
 */
export function make() {
	return new K();
}
