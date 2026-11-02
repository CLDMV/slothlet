/**
 *
 *	@Project: @cldmv/slothlet
 *	@Filename: /api_tests/api_test_returned_packages/api/cjs/cjs.cjs
 *	@Date: 2026-10-27T06:57:33-07:00 (1793109453)
 *	@Author: Nate Corcoran <CLDMV>
 *	@Email: <Shinrai@users.noreply.github.com>
 *	-----
 *	@Last modified by: Nate Corcoran <CLDMV> (Shinrai@users.noreply.github.com)
 *	@Last modified time: 2026-10-30T23:03:19-07:00 (1793426599)
 *	-----
 *	@Copyright: Copyright (c) 2013-2026 Catalyzed Motivation Inc. All rights reserved.
 *
 */

/**
 * @fileoverview Fixture (#597): a CommonJS module handing out a CommonJS package's exports it required.
 * @module api_test_returned_packages.cjs
 */
const fakeCjs = require("fake-cjs");

/** @type {object|undefined} slothlet's runtime `self`, loaded with the module. */
let self;
const loading = import("@cldmv/slothlet/runtime").then((runtime) => {
	self = runtime.self;
});

module.exports = {
	/**
	 * The package's exports and two of its members, handed on.
	 * @returns {{fakeCjs: object, fn: Function, inner: Function}} The values.
	 */
	refs() {
		return { fakeCjs, fn: fakeCjs.fn, inner: fakeCjs.nested.inner };
	},

	/**
	 * A function this module makes that reads the vault's secret through `self` from a timer.
	 * @returns {Promise<function(): Promise<*>>} The function: the secret, or the error code its read was refused with.
	 */
	async laterReader() {
		await loading;
		return () =>
			new Promise((resolve) =>
				setTimeout(() => {
					try {
						Promise.resolve(self.vault.secret).then(resolve, (error) => resolve(error.code ?? error.message));
					} catch (error) {
						resolve(error.code ?? error.message);
					}
				}, 5)
			);
	}
};
