/**
 *	@Project: @cldmv/slothlet
 *	@Filename: /api_tests/api_test/create-test-service.mjs
 *	@Date: 2026-01-29T03:08:11-08:00 (1769684891)
 *	@Author: Nate Corcoran <CLDMV>
 *	@Email: <Shinrai@users.noreply.github.com>
 *	-----
 *	@Last modified by: Nate Corcoran <CLDMV> (Shinrai@users.noreply.github.com)
 *	@Last modified time: 2026-03-01 20:16:58 -08:00 (1772425018)
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
export function createTestService(name) {
	return new TestService(name);
}

