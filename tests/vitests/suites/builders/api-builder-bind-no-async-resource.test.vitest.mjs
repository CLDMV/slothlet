/**
 *
 *	@Project: @cldmv/slothlet
 *	@Filename: tests/vitests/suites/builders/api-builder-bind-no-async-resource.test.vitest.mjs
 *	@Date: 2026-11-28T10:44:16-08:00 (1795891456)
 *	@Author: Nate Corcoran <CLDMV>
 *	@Email: <Shinrai@users.noreply.github.com>
 *	-----
 *	@Last modified by: Nate Corcoran <CLDMV> (Shinrai@users.noreply.github.com)
 *	@Last modified time: 2026-11-28T12:15:24-08:00 (1795896924)
 *	-----
 *	@Copyright: Copyright (c) 2013-2026 Catalyzed Motivation Inc. All rights reserved.
 *
 */

/**
 * @fileoverview `api.slothlet.bind()` on the async runtime when the host's `node:async_hooks` has no AsyncResource.
 *
 * @description
 * bind() wraps the callback with `AsyncResource.bind` so it runs in the context it was bound in. A host whose
 * async_hooks offers AsyncLocalStorage but not AsyncResource has nothing to bind with, and bind() hands the callback
 * back as it is. Here AsyncResource is taken away from slothlet's platform layer.
 *
 * @module tests/vitests/suites/builders/api-builder-bind-no-async-resource
 */

import { describe, it, expect, vi } from "vitest";
import slothlet from "@cldmv/slothlet";
import { TEST_DIRS } from "../../setup/vitest-helper.mjs";

vi.mock("#helpers/platform", async (importOriginal) => ({ ...(await importOriginal()), AsyncResource: null }));

describe("api_builder – bind without AsyncResource", () => {
	it("returns the callback itself", async () => {
		const api = await slothlet({ mode: "eager", runtime: "async", base: TEST_DIRS.API_TEST });
		try {
			const fn = () => "called";
			const bound = api.slothlet.bind(fn);
			expect(bound).toBe(fn);
			expect(bound()).toBe("called");
		} finally {
			await api.shutdown();
		}
	});
});
