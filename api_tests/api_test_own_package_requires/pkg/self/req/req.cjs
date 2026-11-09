/**
 *
 *	@Project: @cldmv/slothlet
 *	@Filename: /self/req/req.cjs
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
 * @fileoverview The CommonJS leaf of the `self` api (#715): requires its package's ES module helper and CommonJS
 * helper, each first by the package's own name, then by the other bare spelling, then by a relative path. Node caches
 * a required file by its path, so the first spelling decides which copy the later ones reach; the two apis put each
 * bare spelling first.
 * @module api_test_own_package_requires.pkg.self.req
 */

const hBySelf = require("own-package-requires/h").identity;
const hByImports = require("#h").identity;
const hByPath = require("../../lib/h.mjs").identity;
const cBySelf = require("own-package-requires/c").identity;
const cByImports = require("#c").identity;
const cByPath = require("../../lib/c.cjs").identity;

/**
 * Which evaluation of each helper every spelling reached.
 * @returns {Record<string, number>} Each spelling's index among its helper's evaluations.
 */
function which() {
	const { h, c } = globalThis.__ownPackageRequires;
	const at = (list, identity) => list.findIndex((entry) => entry.identity === identity);
	return {
		hByPath: at(h, hByPath),
		hByImports: at(h, hByImports),
		hBySelf: at(h, hBySelf),
		cByPath: at(c, cByPath),
		cByImports: at(c, cByImports),
		cBySelf: at(c, cBySelf)
	};
}

module.exports = { which };
