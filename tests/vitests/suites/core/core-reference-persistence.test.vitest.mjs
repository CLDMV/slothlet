/**
 *	@Project: @cldmv/slothlet
 *	@Filename: /tests/vitests/suites/core/core-reference-persistence.test.vitest.mjs
 *	@Date: 2026-02-06T23:45:39-08:00 (1770450339)
 *	@Author: Nate Hyson <CLDMV>
 *	@Email: <Shinrai@users.noreply.github.com>
 *	-----
 *	@Last modified by: Nate Hyson <CLDMV> (Shinrai@users.noreply.github.com)
 *	@Last modified time: 2026-02-28 13:16:39 -08:00 (1772313399)
 *	-----
 *	@Copyright: Copyright (c) 2013-2026 Catalyzed Motivation Inc. All rights reserved.
 */

/**
 * @fileoverview Public API tests for reference persistence and live bindings.
 *
 * @description
 * These tests intentionally avoid internal wrapper imports and verify behavior
 * only through user-facing `slothlet()` APIs.
 */

import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { getMatrixConfigs, TEST_DIRS } from "../../setup/vitest-helper.mjs";

const configs = getMatrixConfigs();

for (const { config, name } of configs) {
	describe(`Reference Persistence - ${name}`, () => {
		let slothlet;
		let api;

		beforeEach(async () => {
			const slothletModule = await import("@cldmv/slothlet");
			slothlet = slothletModule.default;

			api = await slothlet({
				...config,
				dir: TEST_DIRS.API_TEST,
				api: {
					mutations: {
						add: true
					}
				}
			});
		});

		afterEach(async () => {
			if (api) {
				await api.shutdown();
				api = null;
			}
		});

		it("should keep captured root references live after api.add", async () => {
			const capturedApi = api;

			await api.slothlet.api.add("dynamic", TEST_DIRS.API_TEST);

			expect(capturedApi.dynamic).toBeDefined();
			const result = config.mode === "lazy" ? await capturedApi.dynamic.math.add(1, 1) : capturedApi.dynamic.math.add(1, 1);
			expect(result).toBe(1002);
		});

		it("should keep captured namespace references live after api.reload", async () => {
			await api.slothlet.api.add("reloadTarget", TEST_DIRS.API_TEST);
			const capturedMath = api.reloadTarget.math;

			const before = config.mode === "lazy" ? await capturedMath.add(2, 3) : capturedMath.add(2, 3);
			expect(before).toBe(1005);

			await api.slothlet.api.reload("reloadTarget");

			const after = config.mode === "lazy" ? await capturedMath.add(2, 3) : capturedMath.add(2, 3);
			expect(after).toBe(1005);
		});

		it("should keep captured function references callable after api.reload", async () => {
			await api.slothlet.api.add("reloadTarget2", TEST_DIRS.API_TEST);
			const capturedAdd = api.reloadTarget2.math.add;

			const before = config.mode === "lazy" ? await capturedAdd(4, 5) : capturedAdd(4, 5);
			expect(before).toBe(1009);

			await api.slothlet.api.reload("reloadTarget2");

			const after = config.mode === "lazy" ? await capturedAdd(4, 5) : capturedAdd(4, 5);
			expect(after).toBe(1009);
		});

		it("should keep independent captured references stable across module reloads", async () => {
			await api.slothlet.api.add("comp1", TEST_DIRS.API_TEST);
			await api.slothlet.api.add("comp2", TEST_DIRS.API_TEST);

			const ref1Add = api.comp1.math.add;
			const ref2Add = api.comp2.math.add;

			const before1 = config.mode === "lazy" ? await ref1Add(1, 1) : ref1Add(1, 1);
			const before2 = config.mode === "lazy" ? await ref2Add(1, 1) : ref2Add(1, 1);
			expect(before1).toBe(1002);
			expect(before2).toBe(1002);

			await api.slothlet.api.reload("comp1");

			const after1 = config.mode === "lazy" ? await ref1Add(1, 1) : ref1Add(1, 1);
			const after2 = config.mode === "lazy" ? await ref2Add(1, 1) : ref2Add(1, 1);
			expect(after1).toBe(1002);
			expect(after2).toBe(1002);
		});
	});
}
