/**
 *	@Project: @cldmv/slothlet
 *	@Filename: /api_tests/api_test/create-test-service.mjs
 *	@Date: 2026-01-29T03:08:11-08:00 (1769684891)
 *	@Author: Nate Hyson <CLDMV>
 *	@Email: <Shinrai@users.noreply.github.com>
 *	-----
 *	@Last modified by: Nate Hyson <CLDMV> (Shinrai@users.noreply.github.com)
 *	@Last modified time: 2026-02-10 18:02:01 -08:00 (1770775321)
 *	-----
 *	@Copyright: Copyright (c) 2013-2026 Catalyzed Motivation Inc. All rights reserved.
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

