/**
 *
 *	@Project: @cldmv/slothlet
 *	@Filename: /api_tests/api_test_helper_imports/__mixed/api/cjsesm/cjsesm.cjs
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
 * @fileoverview CommonJS leaf that `require()`s relative ES modules and a CommonJS helper (#534).
 * @module api_test_helper_imports.mixed.cjsesm
 */
const esm = require("../../lib/esm-counter.mjs");
const plain = require("../../lib/esm-plain.js");
const counter = require("../../lib/cjs-counter.cjs");

module.exports = {
	/**
	 * Bump the `esm-counter.mjs` counter.
	 * @returns {number} The counter after incrementing.
	 */
	count() {
		return esm.bump();
	},
	/**
	 * Bump the helper below `esm-counter.mjs`.
	 * @returns {number} The counter after incrementing.
	 */
	chain() {
		return esm.chain();
	},
	/**
	 * Bump the `.js` ES module's counter.
	 * @returns {number} The counter after incrementing.
	 */
	plain() {
		return plain.bump();
	},
	/**
	 * Bump the `cjs-counter.cjs` counter the ESM leaves also import.
	 * @returns {number} The counter after incrementing.
	 */
	cjs() {
		return counter.bump();
	},
	/**
	 * Describe what `require()` returned for an ES module with a default export.
	 * @returns {{ esModule: boolean, defaultType: string }} Node's `__esModule` flag and the default export's type.
	 */
	interop() {
		return { esModule: esm.__esModule === true, defaultType: typeof esm.default };
	}
};
