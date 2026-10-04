/**
 *
 *	@Project: @cldmv/slothlet
 *	@Filename: /api_tests/api_test_helper_imports/__mixed/api/esmcjs/esmcjs.mjs
 *	@Date: 2026-10-02 12:27:51 -07:00 (1790969271)
 *	@Author: Shinrai <CLDMV>
 *	@Email: <Shinrai@users.noreply.github.com>
 *	-----
 *	@Last modified by: Shinrai <CLDMV> (Shinrai@users.noreply.github.com)
 *	@Last modified time: 2026-10-03 20:02:38 -07:00 (1791082958)
 *	-----
 *	@Copyright: Copyright (c) 2013-2026 Catalyzed Motivation Inc. All rights reserved.
 *
 */

/**
 * @fileoverview ESM leaf importing relative CommonJS helpers (#534).
 * @module api_test_helper_imports.mixed.esmcjs
 */
import counter, { bump, innerBump, deepBump } from "../../lib/cjs-counter.cjs";
import objectHelper, { bump as objectBump, label } from "../../lib/cjs-object.cjs";

/**
 * Bump the `cjs-counter.cjs` counter through a named import.
 * @returns {number} The counter after incrementing.
 */
export function count() {
	return bump();
}

/**
 * Bump the `cjs-counter.cjs` counter through the default import (`module.exports`).
 * @returns {number} The counter after incrementing.
 */
export function viaDefault() {
	return counter.bump();
}

/**
 * Bump the CommonJS helper below `cjs-counter.cjs`.
 * @returns {number} The counter after incrementing.
 */
export function inner() {
	return innerBump();
}

/**
 * Bump the ES module `cjs-counter.cjs` requires.
 * @returns {number} The counter after incrementing.
 */
export function deep() {
	return deepBump();
}

/**
 * Bump the `module.exports = { … }` helper through a named import.
 * @returns {number} The counter after incrementing.
 */
export function object() {
	return objectBump();
}

/**
 * Describe how the object-literal helper was imported.
 * @returns {{ defaultIsExports: boolean, label: string }} Whether the default import is `module.exports`, and the named `label`.
 */
export function shape() {
	return { defaultIsExports: objectHelper.bump === objectBump, label };
}
