/**
 *
 *	@Project: @cldmv/slothlet
 *	@Filename: /self/esm/esm.mjs
 *	@Date: 2026-11-09T00:27:02-08:00 (1794212822)
 *	@Author: Nate Corcoran <CLDMV>
 *	@Email: <Shinrai@users.noreply.github.com>
 *	-----
 *	@Last modified by: Nate Corcoran <CLDMV> (Shinrai@users.noreply.github.com)
 *	@Last modified time: 2026-11-09T00:36:30-08:00 (1794213390)
 *	-----
 *	@Copyright: Copyright (c) 2013-2026 Catalyzed Motivation Inc. All rights reserved.
 *
 */

/**
 * @fileoverview The ES module leaf of the `self` api (#715): imports its package's helpers by the package's
 * `#imports`, so the fixture can tell whether the `.cjs` leaf of the same instance reached the same copies.
 * @module api_test_own_package_requires.pkg.self.esm
 */

import { identity as h } from "#h";
import { identity as c } from "#c";

/**
 * Which evaluation of each helper this leaf's imports reached.
 * @returns {{h: number, c: number}} Each helper's index among its evaluations.
 */
export function which() {
	const state = globalThis.__ownPackageRequires;
	const at = (list, identity) => list.findIndex((entry) => entry.identity === identity);
	return { h: at(state.h, h), c: at(state.c, c) };
}
