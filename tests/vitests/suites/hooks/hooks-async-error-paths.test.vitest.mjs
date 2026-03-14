/**
 *	@Project: @cldmv/slothlet
 *	@Filename: /tests/vitests/suites/hooks/hooks-async-error-paths.test.vitest.mjs
 *	@Date: 2026-02-27T20:33:02-08:00 (1772253182)
 *	@Author: Nate Corcoran <CLDMV>
 *	@Email: <Shinrai@users.noreply.github.com>
 *	-----
 *	@Last modified by: Nate Corcoran <CLDMV> (Shinrai@users.noreply.github.com)
 *	@Last modified time: 2026-03-01 20:21:49 -08:00 (1772425309)
 *	-----
 *	@Copyright: Copyright (c) 2013-2026 Catalyzed Motivation Inc. All rights reserved.
 */

/**
 * @fileoverview Tests for async hooks error paths in the unified-wrapper apply trap.
 *
 * @description
 * Covers the uncovered async code paths:
 * 1. After hook that throws during async function resolution (catch block in .then handler)
 * 2. Async function that rejects with hooks registered (rejection handler)
 * 3. suppressErrors=true with async rejection (returns undefined instead of throwing)
 * 4. suppressErrors=true with after hook throwing (returns undefined instead of throwing)
 *
 * @module tests/vitests/suites/hooks/hooks-async-error-paths.test.vitest
 */

import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { getMatrixConfigs, TEST_DIRS } from "../../setup/vitest-helper.mjs";

const configs = getMatrixConfigs({ hook: { enabled: true } });

describe.each(configs)("Hooks Async Error Paths > Config: '$name'", ({ config }) => {
	let slothlet;
	let api;

	afterEach(async () => {
		if (api) {
			await api.shutdown();
			api = null;
		}
		slothlet = null;
	});

	describe("After hook throws during async resolution", () => {
		beforeEach(async () => {
			const slothletModule = await import("@cldmv/slothlet");
			slothlet = slothletModule.default;
			api = await slothlet({
				...config,
				dir: TEST_DIRS.API_TEST,
				collision: { initial: "replace", api: "replace" }
			});
		});

		it("should call error hooks when after hook throws during async resolution", async () => {
			let errorHookFired = false;
			let errorHookSource = null;

			// Register after hook that throws
			api.slothlet.hook.on(
				"after:task.autoIP",
				() => {
					throw new Error("after-hook-threw");
				},
				{ id: "throwing-after-hook" }
			);

			// Register error hook to capture the error
			api.slothlet.hook.on(
				"error:task.autoIP",
				({ source }) => {
					errorHookFired = true;
					errorHookSource = source;
				},
				{ id: "error-capture" }
			);

			// Should throw because after hook threw and suppressErrors is not set
			await expect(api.task.autoIP()).rejects.toThrow("after-hook-threw");

			expect(errorHookFired).toBe(true);
			expect(errorHookSource).not.toBeNull();
		});

		it("should call always hooks when after hook throws during async resolution", async () => {
			let alwaysHookFired = false;
			let alwaysHookHasError = false;

			// Register after hook that throws
			api.slothlet.hook.on(
				"after:task.autoIP",
				() => {
					throw new Error("after-hook-threw");
				},
				{ id: "throwing-after-hook" }
			);

			// Register always hook to verify it fires even on error
			api.slothlet.hook.on(
				"always:task.autoIP",
				({ hasError }) => {
					alwaysHookFired = true;
					alwaysHookHasError = hasError;
				},
				{ id: "always-capture" }
			);

			// Should throw because after hook threw
			await expect(api.task.autoIP()).rejects.toThrow("after-hook-threw");

			expect(alwaysHookFired).toBe(true);
			expect(alwaysHookHasError).toBe(true);
		});
	});

	describe("After hook throws with suppressErrors=true", () => {
		beforeEach(async () => {
			const slothletModule = await import("@cldmv/slothlet");
			slothlet = slothletModule.default;
			api = await slothlet({
				...config,
				dir: TEST_DIRS.API_TEST,
				collision: { initial: "replace", api: "replace" },
				hook: {
					...config.hook,
					suppressErrors: true
				}
			});
		});

		it("should allow function to return normally when after hook throws with suppressErrors=true", async () => {
			// Register after hook that throws
			api.slothlet.hook.on(
				"after:task.autoIP",
				() => {
					throw new Error("after-hook-threw");
				},
				{ id: "throwing-after-hook" }
			);

			// With suppressErrors=true, the hook manager swallows the hook error internally.
			// The apply trap catch block is never reached, so the function returns its actual result.
			const result = await api.task.autoIP();
			expect(result).toBe("testAutoIP");
		});
	});

	describe("Async function rejection with hooks", () => {
		beforeEach(async () => {
			const slothletModule = await import("@cldmv/slothlet");
			slothlet = slothletModule.default;
			api = await slothlet({
				...config,
				dir: TEST_DIRS.API_TEST,
				collision: { initial: "replace", api: "replace" }
			});
		});

		it("should call error hooks when async function rejects", async () => {
			let errorHookFired = false;
			let errorHookSourceType = null;

			// Register error hook to capture async rejection
			api.slothlet.hook.on(
				"error:task.asyncReject",
				({ source }) => {
					errorHookFired = true;
					errorHookSourceType = source?.type;
				},
				{ id: "error-capture" }
			);

			// Should reject because async function throws
			await expect(api.task.asyncReject()).rejects.toThrow("async-rejected");

			expect(errorHookFired).toBe(true);
			expect(errorHookSourceType).toBe("function");
		});

		it("should call always hooks when async function rejects", async () => {
			let alwaysHookFired = false;
			let alwaysHookHasError = false;

			// Register always hook to verify it fires even on rejection
			api.slothlet.hook.on(
				"always:task.asyncReject",
				({ hasError }) => {
					alwaysHookFired = true;
					alwaysHookHasError = hasError;
				},
				{ id: "always-capture" }
			);

			// Should reject
			await expect(api.task.asyncReject()).rejects.toThrow("async-rejected");

			expect(alwaysHookFired).toBe(true);
			expect(alwaysHookHasError).toBe(true);
		});

		it("should propagate async rejection when no hooks registered", async () => {
			// No hooks registered — just verify the rejection propagates correctly
			await expect(api.task.asyncReject()).rejects.toThrow("async-rejected");
		});
	});

	describe("Async rejection with suppressErrors=true", () => {
		beforeEach(async () => {
			const slothletModule = await import("@cldmv/slothlet");
			slothlet = slothletModule.default;
			api = await slothlet({
				...config,
				dir: TEST_DIRS.API_TEST,
				collision: { initial: "replace", api: "replace" },
				hook: {
					...config.hook,
					suppressErrors: true
				}
			});
		});

		it("should return undefined when async function rejects with suppressErrors=true", async () => {
			// With suppressErrors=true, async rejection should resolve to undefined
			const result = await api.task.asyncReject();
			expect(result).toBeUndefined();
		});
	});
});

/**
 * Covers the false branch of `if (hasHooks)` in the async rejection handler:
 * when hooks are globally disabled, the always-hook block is skipped entirely.
 * hasHooks = hookManager && hookManager.enabled && ... → false when enabled=false.
 */
describe("Hooks Async Error Paths > Hooks disabled (no-hook branch)", () => {
	let api;

	afterEach(async () => {
		if (api) {
			await api.shutdown();
			api = null;
		}
	});

	it("should propagate async rejection when hooks are globally disabled", async () => {
		const slothletModule = await import("@cldmv/slothlet");
		const slothlet = slothletModule.default;
		api = await slothlet({
			dir: TEST_DIRS.API_TEST,
			collision: { initial: "replace", api: "replace" },
			hook: { enabled: false }
		});

		// No hooks → hasHooks=false in rejection handler; always-hook block is skipped.
		await expect(api.task.asyncReject()).rejects.toThrow("async-rejected");
	});
});
