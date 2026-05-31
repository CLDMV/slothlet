/**
 *	@Project: @cldmv/slothlet
 *	@Filename: /api_tests/api_test_browser/advanced/calc.mjs
 *	@Date: 2026-05-30 00:06:52 -07:00 (1780124812)
 *	@Author: Nate Corcoran <CLDMV>
 *	@Email: <Shinrai@users.noreply.github.com>
 *	@Copyright: Copyright (c) 2013-2026 Catalyzed Motivation Inc. All rights reserved.
 */

/**
 * @fileoverview Browser-mode test fixture — `self` live-binding.
 *
 * @description
 * Verifies slothlet's `self` live-binding resolves in browser / live mode: this leaf
 * calls a sibling leaf via `self.math.add` instead of a direct import. The Playwright
 * smoke uses it to confirm (a) live-bindings work in a real browser and (b) permission
 * rules gate the *internal* `self.math.add` call (external calls are exempt).
 * @module api_test_browser.advanced.calc
 */

import { self } from "@cldmv/slothlet/runtime";

/**
 * Adds two numbers via the live-bound `self.math.add` reference.
 * @param {number} a - First addend.
 * @param {number} b - Second addend.
 * @returns {number} The sum, computed through `self.math.add`.
 * @example addViaSelf(2, 3); // 5
 */
export function addViaSelf(a, b) {
	return self.math.add(a, b);
}
