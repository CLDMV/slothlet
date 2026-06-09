/**
 *	@Project: @cldmv/slothlet
 *	@Filename: /tests/vitests/suites/runtime/self-assign-wrap.test.vitest.mjs
 *	@Date: 2026-05-12T22:20:24-07:00 (1778649624)
 *	@Author: Nate Corcoran <CLDMV>
 *	@Email: <Shinrai@users.noreply.github.com>
 *	-----
 *	@Last modified by: Nate Corcoran <CLDMV> (Shinrai@users.noreply.github.com)
 *	@Last modified time: 2026-05-12 22:32:56 -07:00 (1778650376)
 *	-----
 *	@Copyright: Copyright (c) 2013-2026 Catalyzed Motivation Inc. All rights reserved.
 */

/**
 * @fileoverview Stage 3 tests for wrap-on-set behavior of `self.X = …`.
 *
 * When the assigned value is a function or object, it gets a `UnifiedWrapper`
 * (verifiable via `resolveWrapper`). Primitives stay as-is.
 *
 * Hook / permission / lifecycle integration on these synthetic wrappers
 * requires a separate metadata-registration pass that's deferred to a
 * follow-up — covered by `lifecycle:impl:changed` partially today, but full
 * `hook.on("X:after")` interception on values added this way is not yet
 * guaranteed. Don't rely on it; use `api.slothlet.api.add()` for fully
 * lifecycle-integrated mounts.
 *
 * Stage 3 covers TOP-LEVEL writes through the runtime self set trap. Deep-path
 * writes via `self.X.foo = …` still use the existing `UnifiedWrapper.setTrap`
 * and are scope for a follow-up.
 */
import { describe, it, expect, afterEach } from "vitest";
import slothlet from "../../../../index.mjs";
import { self } from "@cldmv/slothlet/runtime";
import { resolveWrapper } from "@cldmv/slothlet/handlers/unified-wrapper";

describe("self.X = ... (Stage 3: wrap-on-set)", () => {
	let api;

	afterEach(async () => {
		if (api?.slothlet?.shutdown) {
			await api.slothlet.shutdown();
		}
	});

	it("wraps an assigned function in a UnifiedWrapper", async () => {
		api = await slothlet({ base: "./api_tests/api_test", mode: "eager" });

		await api.slothlet.run({}, () => {
			self.computeBase = (a, b) => a + b;
		});

		// The proxy at api.computeBase resolves through the wrapper registry —
		// proves wrap-on-set construction took place (would be `null` if the
		// raw function were stored verbatim).
		expect(resolveWrapper(api.computeBase)).not.toBeNull();
		// And it's still callable.
		expect(await api.computeBase(2, 3)).toBe(5);
	});

	it("wraps an assigned plain object in a UnifiedWrapper", async () => {
		api = await slothlet({ base: "./api_tests/api_test", mode: "eager" });

		await api.slothlet.run({}, () => {
			self.config = { timeout: 5000, retries: 3 };
		});

		expect(resolveWrapper(api.config)).not.toBeNull();
		expect(api.config.timeout).toBe(5000);
		expect(api.config.retries).toBe(3);
	});

	it("stores primitives verbatim (no wrapping)", async () => {
		api = await slothlet({ base: "./api_tests/api_test", mode: "eager" });

		await api.slothlet.run({}, () => {
			self.maxRetries = 5;
			self.appName = "demo";
			self.flags = null;
		});

		expect(api.maxRetries).toBe(5);
		expect(api.appName).toBe("demo");
		expect(api.flags).toBe(null);
		// Primitives can't go through a Proxy, so resolveWrapper won't find one.
		expect(resolveWrapper(api.maxRetries)).toBeNull();
	});
});
