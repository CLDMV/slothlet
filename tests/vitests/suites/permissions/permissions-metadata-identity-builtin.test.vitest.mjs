/**
 *
 *	@Project: @cldmv/slothlet
 *	@Filename: /tests/vitests/suites/permissions/permissions-metadata-identity-builtin.test.vitest.mjs
 *	@Date: 2026-09-27 03:01:38 -07:00 (1790503298)
 *	@Author: Shinrai <CLDMV>
 *	@Email: <Shinrai@users.noreply.github.com>
 *	-----
 *	@Last modified by: Shinrai <CLDMV> (Shinrai@users.noreply.github.com)
 *	@Last modified time: 2026-10-03 20:04:31 -07:00 (1791083071)
 *	-----
 *	@Copyright: Copyright (c) 2013-2026 Catalyzed Motivation Inc. All rights reserved.
 *
 */

/**
 * @fileoverview #468 — `slothlet.metadata.caller` and `slothlet.metadata.self` are allowed by
 * built-in rules, like `slothlet.lockCaller` / `slothlet.bind`: they reveal identity only (who is
 * calling me / who am I), which a module needs to enforce its own policy. Under
 * `defaultPolicy: "deny"` with no user rules a module can call them; `metadata.get(path)` (reads
 * arbitrary metadata) stays gated; a user rule still overrides the built-ins.
 */

import { describe, it, expect, afterEach } from "vitest";
import slothlet from "@cldmv/slothlet";
import { getMatrixConfigs, TEST_DIRS } from "../../setup/vitest-helper.mjs";

/**
 * Assert a module-side call fails with PERMISSION_DENIED, whether it throws synchronously (eager)
 * or rejects (lazy).
 * @param {() => unknown} invoke - Zero-arg thunk performing the call.
 * @returns {Promise<void>}
 */
const expectDenied = (invoke) => expect((async () => invoke())()).rejects.toThrow(/PERMISSION_DENIED/);

describe.each(getMatrixConfigs())("Permissions > metadata identity built-ins (#468) > $name", ({ config }) => {
	let api;

	afterEach(async () => {
		if (api) await api.shutdown();
		api = null;
	});

	/**
	 * Build an instance over the standard fixture with default-deny permissions.
	 * @param {object[]} [rules=[]] - User rules.
	 * @returns {Promise<object>} Bound api.
	 */
	const build = (rules = []) => slothlet({ ...config, base: TEST_DIRS.API_TEST, permissions: { defaultPolicy: "deny", rules } });

	it("a module may call metadata.caller() and metadata.self() with no user rules", async () => {
		api = await build();
		// Host-initiated call → no module caller → null, but the read of the route itself is allowed.
		expect(await api.callerTest.getCallerMeta()).toBeNull();
		const own = await api.metadataTestHelper.getSelfMetadata();
		expect(own).toBeTruthy();
		expect(typeof own).toBe("object");
	});

	it("metadata.get(path) stays gated", async () => {
		api = await build();
		await expectDenied(() => api.metadataTestHelper.getMetadata("math.add"));
	});

	it("a user deny rule overrides the built-in allow", async () => {
		api = await build([
			{ caller: "**", target: "slothlet.metadata.caller", effect: "deny" },
			{ caller: "metadataTestHelper.**", target: "slothlet.metadata.self", effect: "deny" }
		]);
		await expectDenied(() => api.callerTest.getCallerMeta());
		await expectDenied(() => api.metadataTestHelper.getSelfMetadata());
	});
});
