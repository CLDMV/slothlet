/**
 *
 *	@Project: @cldmv/slothlet
 *	@Filename: api_tests/api_test_browser_fn_members/klass/klass.mjs
 *	@Date: 2026-11-15T12:30:32-08:00 (1794774632)
 *	@Author: Nate Corcoran <CLDMV>
 *	@Email: <Shinrai@users.noreply.github.com>
 *	-----
 *	@Last modified by: Nate Corcoran <CLDMV> (Shinrai@users.noreply.github.com)
 *	@Last modified time: 2026-11-28T04:27:32-08:00 (1795868852)
 *	-----
 *	@Copyright: Copyright (c) 2013-2026 Catalyzed Motivation Inc. All rights reserved.
 *
 */

/**
 * @fileoverview A default class beside named exports called `prototype` and `name`.
 * @module api_test_browser_fn_members/klass/klass
 */

/** The default class. */
export default class Klass {
	constructor() {
		this.v = 1;
	}
}

/** A named export called like a class's own `prototype`. */
export const prototype = "P";

/** A named export called like a class's own `name`. */
export const name = "K";
