/**
 *	@Project: @cldmv/slothlet
 *	@Filename: /tests/vitests/suites/permissions/permissions-hook-manager-refactor.test.vitest.mjs
 *	@Date: 2026-04-14 17:21:08 -07:00 (1776212468)
 *	@Author: Nate Corcoran <CLDMV>
 *	@Email: <Shinrai@users.noreply.github.com>
 *	-----
 *	@Last modified by: Nate Corcoran <CLDMV> (Shinrai@users.noreply.github.com)
 *	@Last modified time: 2026-04-14 17:33:59 -07:00 (1776213239)
 *	-----
 *	@Copyright: Copyright (c) 2013-2026 Catalyzed Motivation Inc. All rights reserved.
 */

import { describe, it, expect, afterEach } from "vitest";
import slothlet from "@cldmv/slothlet";
import { getMatrixConfigs, TEST_DIRS } from "../../setup/vitest-helper.mjs";

const BASE = TEST_DIRS.API_TEST;

describe.each(getMatrixConfigs())("Permissions > HookManager Refactor Regression > $name", ({ config }) => {
	let api;

	afterEach(async () => {
		if (api) await api.shutdown();
		api = null;
	});

	it("hooks still fire correctly after pattern-matcher extraction", async () => {
		api = await slothlet({
			...config,
			dir: BASE,
			hook: { enabled: true }
		});

		let hookFired = false;

		api.slothlet.hook.on("before:math.*", (data) => {
			hookFired = true;
		});

		// api_test/math.mjs add() returns a + b + 1000 (collision test file)
		const result = await api.math.add(2, 3);
		expect(result).toBe(1005);
		expect(hookFired).toBe(true);
	});

	it("glob patterns in hooks still work with ** patterns", async () => {
		api = await slothlet({
			...config,
			dir: BASE,
			hook: { enabled: true }
		});

		const calls = [];

		api.slothlet.hook.on("before:**", (data) => {
			calls.push(data);
		});

		await api.math.add(1, 2);

		expect(calls.length).toBeGreaterThan(0);
	});

	it("brace expansion in hook patterns still works", async () => {
		api = await slothlet({
			...config,
			dir: BASE,
			hook: { enabled: true }
		});

		const calls = [];

		api.slothlet.hook.on("before:{math,utils}.*", (data) => {
			calls.push(data);
		});

		await api.math.add(1, 2);

		expect(calls.length).toBeGreaterThan(0);
	});
});
