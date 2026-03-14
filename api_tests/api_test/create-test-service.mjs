/**
 *	@Project: @cldmv/slothlet
 *	@Filename: /api_tests/api_test/create-test-service.mjs
 *	@Date: 2026-01-29T03:08:11-08:00 (1769684891)
 *	@Author: Nate Corcoran <CLDMV>
 *	@Email: <Shinrai@users.noreply.github.com>
 *	-----
 *	@Last modified by: Nate Corcoran <CLDMV> (Shinrai@users.noreply.github.com)
 *	@Last modified time: 2026-03-12 21:33:01 -07:00 (1773376381)
 *	-----
 *	@Copyright: Copyright (c) 2013-2026 Catalyzed Motivation Inc. All rights reserved.
 */

/**
 * @fileoverview Factory function test — creates a TestService class instance for class-as-API testing.
 * @module api_test.createTestService
 * @memberof module:api_test
 */
/**
 * @namespace createTestService
 * @memberof module:api_test
 */

import { context } from "@cldmv/slothlet/runtime";

class TestService {
	constructor(name) {
		this.name = name;
	}

	/**
	* Method that accesses slothlet context
	*/
	getContextInfo() {
		return {
			userId: context.userId,
			session: context.session,
			serviceName: this.name
		};
	}
}

/**
	* Factory function that returns a class instance
	*/
/**
 * createTestService.
 * @param {*} name - name.
 * @returns {*}
 * @example // ESM usage via slothlet API
 * import slothlet from "@cldmv/slothlet";
 * const api_test = await slothlet({ dir: './api_tests/api_test' });
 * api_test.create-test-service.createTestService('myName');
 *
 * @example // ESM usage via slothlet API (inside async function)
 * async function example() {
 *   const { default: slothlet } = await import("@cldmv/slothlet");
 *   const api_test = await slothlet({ dir: './api_tests/api_test' });
 *   api_test.create-test-service.createTestService('myName');
 * }
 *
 * @example // CJS usage via slothlet API (top-level)
 * let slothlet;
 * (async () => {
 *   ({ slothlet } = await import("@cldmv/slothlet"));
 *   const api_test = await slothlet({ dir: './api_tests/api_test' });
 *   api_test.create-test-service.createTestService('myName');
 * })();
 *
 * @example // CJS usage via slothlet API (inside async function)
 * const slothlet = require("@cldmv/slothlet");
 * const api_test = await slothlet({ dir: './api_tests/api_test' });
 * api_test.create-test-service.createTestService('myName');
 */
export function createTestService(name) {
	return new TestService(name);
}

