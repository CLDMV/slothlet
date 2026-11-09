/**
 * @fileoverview The CommonJS leaf of the `imports` api (#715): requires its package's ES module helper and CommonJS
 * helper, each first by `#imports`, then by the other bare spelling, then by a relative path. Node caches a required
 * file by its path, so the first spelling decides which copy the later ones reach; the two apis put each bare spelling
 * first.
 * @module api_test_own_package_requires.pkg.imports.req
 */

const hByImports = require("#h").identity;
const hBySelf = require("own-package-requires/h").identity;
const hByPath = require("../../lib/h.mjs").identity;
const cByImports = require("#c").identity;
const cBySelf = require("own-package-requires/c").identity;
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
