/**
 *
 *	@Project: @cldmv/slothlet
 *	@Filename: /api_tests/api_test_code_strings_browser/routes.mjs
 *	@Date: 2026-11-15T00:00:00-08:00 (1794729600)
 *	@Author: Nate Corcoran <CLDMV>
 *	@Email: <Shinrai@users.noreply.github.com>
 *	-----
 *	@Last modified by: Nate Corcoran <CLDMV> (Shinrai@users.noreply.github.com)
 *	@Last modified time: 2026-11-15T00:00:00-08:00 (1794729600)
 *	-----
 *	@Copyright: Copyright (c) 2013-2026 Catalyzed Motivation Inc. All rights reserved.
 *
 */

/**
 * @fileoverview Every route from a string to code a browser offers that the tests try, by name. Imported by the module
 * and run by the host alike: the file is a helper, not an api file.
 *
 * @module api_tests/api_test_code_strings_browser/routes
 */

/**
 * Run a string timer and resolve with what its code passed on.
 * @param {Function} schedule - `setTimeout` or `setInterval`.
 * @returns {Promise<number>} 7.
 * @private
 */
const stringTimer = (schedule) =>
	new Promise((resolve, reject) => {
		let id;
		globalThis.__slothletCodeStringsTimer = (value) => {
			clearInterval(id);
			resolve(value);
		};
		try {
			id = schedule("globalThis.__slothletCodeStringsTimer(7)", 0);
		} catch (error) {
			reject(error);
		}
	});

/**
 * The routes.
 * @type {Record<string, function(): *>}
 * @public
 */
export const routes = {
	Function: () => Function("return 7")(),
	newFunction: () => new Function("return 7")(),
	functionConstructor: () => function () {}.constructor("return 7")(),
	functionPrototypeConstructor: () => Function.prototype.constructor("return 7")(),
	asyncFunction: () => (async () => {}).constructor("return 7")(),
	generatorFunction: () =>
		Object.getPrototypeOf(function* () {})
			.constructor("yield 7")()
			.next().value,
	asyncGeneratorFunction: async () =>
		(
			await Object.getPrototypeOf(async function* () {})
				.constructor("yield 7")()
				.next()
		).value,
	reflectConstruct: () => Reflect.construct(Function, ["return 7"])(),
	subclass: () => new (class extends Function {})("return 7")(),
	bound: () => Function.bind(null, "return 7")()(),
	stringTimeout: () => stringTimer(setTimeout),
	stringInterval: () => stringTimer(setInterval)
};
