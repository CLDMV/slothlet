/**
 *
 *	@Project: @cldmv/slothlet
 *	@Filename: /api/a/a.mjs
 *	@Date: 2026-11-08T16:46:18-08:00 (1794185178)
 *	@Author: Nate Corcoran <CLDMV>
 *	@Email: <Shinrai@users.noreply.github.com>
 *	-----
 *	@Last modified by: Nate Corcoran <CLDMV> (Shinrai@users.noreply.github.com)
 *	@Last modified time: 2026-11-08T16:56:52-08:00 (1794185812)
 *	-----
 *	@Copyright: Copyright (c) 2013-2026 Catalyzed Motivation Inc. All rights reserved.
 *
 */

/**
 * @fileoverview Leaf `a` (#715): imports its package's helper by a relative path.
 * @module api_test_own_package_imports.pkg.api.a
 */

import { identity } from "../../lib/h.mjs";

/**
 * Which evaluation of the helper this leaf's import reached.
 * @returns {number} Its index among the helper's evaluations.
 */
export function which() {
	return globalThis.__ownPackageImports.identities.indexOf(identity);
}
