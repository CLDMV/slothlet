/**
 *
 *	@Project: @cldmv/slothlet
 *	@Filename: /tests/vitests/suites/runtime/runtime-instanceid.test.vitest.mjs
 *	@Date: 2026-02-22T13:20:41-08:00 (1771795241)
 *	@Author: Nate Corcoran <CLDMV>
 *	@Email: <Shinrai@users.noreply.github.com>
 *	-----
 *	@Last modified by: Nate Corcoran <CLDMV> (Shinrai@users.noreply.github.com)
 *	@Last modified time: 2026-10-03T22:15:21-07:00 (1791090921)
 *	-----
 *	@Copyright: Copyright (c) 2013-2026 Catalyzed Motivation Inc. All rights reserved.
 *
 */

/**
 * @fileoverview `instance` from runtime-asynclocalstorage: `instance.id` is undefined outside a call and the running
 * instance's id, a real string, inside one.
 * @module tests/vitests/suites/runtime/runtime-instanceid.test.vitest
 */

import { describe, it, expect, afterEach } from "vitest";
import { instance } from "@cldmv/slothlet/runtime/async";
import { TEST_DIRS } from "../../setup/vitest-helper.mjs";

describe("runtime-asynclocalstorage: instance.id", () => {
	let api;

	afterEach(async () => {
		if (api && typeof api.shutdown === "function") {
			await api.shutdown();
		}
		api = null;
	});

	it("is undefined outside a call", () => {
		expect(instance.id).toBeUndefined();
	});

	it("is frozen and read-only", () => {
		expect(Object.isFrozen(instance)).toBe(true);
		expect(Object.keys(instance)).toEqual(["id"]);
	});

	it.each(["eager", "lazy"])("is the running instance's id, a real string, inside a call (%s)", async (mode) => {
		const slothletModule = await import("@cldmv/slothlet");
		api = await slothletModule.default({ base: TEST_DIRS.API_TEST, mode, runtime: "async", context: { user: "instance-test" } });

		const result = await api.runtimeTest.getAsyncInstanceID();
		expect(result).toEqual({ id: api.slothlet.instance.id, type: "string", frozen: true });
		expect(result.id === api.slothlet.instance.id).toBe(true);
	});
});
