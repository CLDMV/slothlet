/**
 *	@Project: @cldmv/slothlet
 *	@Filename: /api_tests/api_test_live_view/untrusted.mjs
 *	@Date: 2026-09-28T06:11:59-07:00 (1790601119)
 *	@Author: Nate Corcoran <CLDMV>
 *	@Email: <Shinrai@users.noreply.github.com>
 *	-----
 *	@Last modified by: Nate Corcoran <CLDMV> (Shinrai@users.noreply.github.com)
 *	@Last modified time: 2026-09-28 06:11:59 -07:00 (1790601119)
 *	-----
 *	@Copyright: Copyright (c) 2013-2026 Catalyzed Motivation Inc. All rights reserved.
 */

/**
 * @fileoverview Caller-identity fixture for the live-view write tests (#495). A permission rule
 * denies `untrusted.**` against `store.**`, so `peek` must be refused even for a value that was
 * written through the view rather than present at assignment time.
 * @module api_test_live_view.untrusted
 * @memberof module:api_test_live_view
 */

import { self } from "@cldmv/slothlet/runtime";

/**
 * Reads `self.store.x.nested.inner.c.a` through the view.
 * @returns {unknown} The value served through the view (when permitted).
 */
export function peek() {
	return self.store.x.nested.inner.c.a;
}
