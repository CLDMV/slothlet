/**
 *	@Project: @cldmv/slothlet
 *	@Filename: /tests/vitests/suites/context/class-instance-propagation.test.vitest.mjs
 *	@Date: 2026-01-29T03:08:11-08:00 (1769684891)
 *	@Author: Nate Hyson <CLDMV>
 *	@Email: <Shinrai@users.noreply.github.com>
 *	-----
 *	@Last modified by: Nate Hyson <CLDMV> (Shinrai@users.noreply.github.com)
 *	@Last modified time: 2026-02-04 20:39:51 -08:00 (1770266391)
 *	-----
 *	@Copyright: Copyright (c) 2013-2026 Catalyzed Motivation Inc. All rights reserved.
 */

/**
 * @fileoverview Test class instance context propagation
 *
 * @description
 * Tests that class instances returned from API functions automatically have their methods
 * wrapped to preserve AsyncLocalStorage context. This allows class instances to access
 * self/context/reference within their methods.
 *
 * @module tests/vitests/suites/context/class-instance-propagation.test.vitest
 */

import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { getMatrixConfigs, TEST_DIRS } from "../../setup/vitest-helper.mjs";

describe("Class Instance Context Propagation", () => {
	describe.each(getMatrixConfigs({}))("Config: '$name'", ({ name, config }) => {
		let api;

		beforeEach(async () => {
			const { default: slothlet } = await import("@cldmv/slothlet");
			api = await slothlet({
				dir: TEST_DIRS.API_TEST,
				context: { userId: "class-test-user", session: "class-test-session" },
				...config
			});
		});

		afterEach(async () => {
			if (api?.shutdown) {
				await api.shutdown();
			}
			api = null;
		});

		it("should wrap returned class instances to preserve context in methods", async () => {
			// Verify API setup
			expect(api).toBeTruthy();

			// Skip if module not available in this config
			if (!api.createTestService) {
				// console.log(`Skipping ${name}: createTestService not available`);
				return;
			}

			// Call factory function that returns a class instance
			const service = await api.createTestService("TestServiceInstance");
			expect(service).toBeTruthy();
			expect(service.constructor.name).toBe("TestService");

			// Call method on instance - should have access to context
			const result = await service.getContextInfo();

			expect(result).toBeTruthy();
			expect(result.userId).toBe("class-test-user");
			expect(result.session).toBe("class-test-session");
			expect(result.serviceName).toBe("TestServiceInstance");
		});
	});
});
