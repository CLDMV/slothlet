/**
 * @fileoverview The ES module leaf of the `imports` api (#715): imports its package's helpers by the package's
 * `#imports`, so the fixture can tell whether the `.cjs` leaf of the same instance reached the same copies.
 * @module api_test_own_package_requires.pkg.imports.esm
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
