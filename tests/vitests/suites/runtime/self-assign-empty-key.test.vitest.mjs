/**
 *
 *	@Project: @cldmv/slothlet
 *	@Filename: tests/vitests/suites/runtime/self-assign-empty-key.test.vitest.mjs
 *	@Date: 2026-11-25T11:18:36-08:00 (1795634316)
 *	@Author: Nate Corcoran <CLDMV>
 *	@Email: <Shinrai@users.noreply.github.com>
 *	-----
 *	@Last modified by: Nate Corcoran <CLDMV> (Shinrai@users.noreply.github.com)
 *	@Last modified time: 2026-11-28T04:32:59-08:00 (1795869179)
 *	-----
 *	@Copyright: Copyright (c) 2013-2026 Catalyzed Motivation Inc. All rights reserved.
 *
 */

/**
 * @fileoverview A self write to an empty or blank key is refused.
 *
 * @description
 * The runtime's `self` set trap hands `String(prop)` to `setOwnedProperty`, so `self[""] = v` and `self["  "] = v`
 * normalize to no path segments at all. There is no key to set, so the write is refused with API_PATH_INVALID
 * rather than landing on the api root.
 */
import { describe, it, expect, afterEach } from "vitest";
import slothlet from "../../../../index.mjs";
import { self } from "@cldmv/slothlet/runtime";
import { withSuppressedSlothletErrorOutputSync } from "../../setup/vitest-helper.mjs";

describe("self[<empty key>] = ...", () => {
	let api;

	afterEach(async () => {
		if (api?.slothlet?.shutdown) await api.slothlet.shutdown();
		api = null;
	});

	for (const key of ["", "  "]) {
		it(`refuses self[${JSON.stringify(key)}] = value`, async () => {
			api = await slothlet({ base: "./api_tests/api_test", mode: "eager" });

			await api.slothlet.context.run({}, () => {
				withSuppressedSlothletErrorOutputSync(() => {
					expect(() => {
						self[key] = "value";
					}).toThrow(/API_PATH_INVALID/);
				});
			});

			expect(Object.hasOwn(api, key)).toBe(false);
		});
	}
});
