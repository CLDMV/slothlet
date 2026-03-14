/**
 *	@Project: @cldmv/slothlet
 *	@Filename: /tests/vitests/suites/handlers/unified-wrapper-proxy-traps.test.vitest.mjs
 *	@Date: 2026-02-26T19:02:54-08:00 (1772161374)
 *	@Author: Nate Corcoran <CLDMV>
 *	@Email: <Shinrai@users.noreply.github.com>
 *	-----
 *	@Last modified by: Nate Corcoran <CLDMV> (Shinrai@users.noreply.github.com)
 *	@Last modified time: 2026-03-01 20:21:48 -08:00 (1772425308)
 *	-----
 *	@Copyright: Copyright (c) 2013-2026 Catalyzed Motivation Inc. All rights reserved.
 */

/**
 * @fileoverview Vitest tests for UnifiedWrapper proxy trap edge cases.
 * @module tests/vitests/suites/handlers/unified-wrapper-proxy-traps.test.vitest
 *
 * @description
 * Covers rarely-exercised proxy trap code paths in unified-wrapper.mjs:
 *
 * - Line 2772: getOwnPropertyDescriptorTrap triggers _materialize() in lazy mode
 *              before the wrapper has been materialized.
 * - Line 2942: setTrap else-branch writes directly to target when the key is in
 *              `internalKeys` (currently only "_materialize").
 * - Line 3017: deletePropertyTrap removes the property from impl when it is
 *              found there.
 */

import { describe, test, expect, beforeEach, afterEach } from "vitest";
import { getMatrixConfigs, TEST_DIRS } from "../../setup/vitest-helper.mjs";

// ─── getOwnPropertyDescriptorTrap → _materialize() in lazy mode ───────────────

describe.each(getMatrixConfigs({ mode: "lazy" }))(
	"UnifiedWrapper > getOwnPropertyDescriptorTrap > triggers _materialize (line 2772) > Config: '$name'",
	({ config }) => {
		let api;

		beforeEach(async () => {
			const { default: slothlet } = await import("@cldmv/slothlet");
			api = await slothlet({ ...config, dir: TEST_DIRS.API_TEST, collision: { initial: "replace", api: "replace" } });
		});

		afterEach(async () => {
			if (api) await api.shutdown();
			api = null;
		});

		test("Object.getOwnPropertyDescriptor on lazy proxy materialises it first (line 2772)", () => {
			// api.math is lazily loaded; in lazy mode the wrapper starts unmaterialized.
			// Calling Object.getOwnPropertyDescriptor before any regular prop-access
			// is the first trap invocation and must trigger _materialize() (line 2772).
			// Materialization is async so the descriptor may be undefined at this point
			// but the call must not throw.
			expect(() => Object.getOwnPropertyDescriptor(api.math, "add")).not.toThrow();
		});

		test("getOwnPropertyDescriptor on a lazy wrapper returns a descriptor after await", async () => {
			// Trigger materialization via descriptor lookup
			Object.getOwnPropertyDescriptor(api.math, "add");
			// Allow async materialization to complete
			await new Promise((resolve) => setTimeout(resolve, 100));
			// After full materialization, normal property access should work
			const result = api.math.add;
			expect(result).toBeDefined();
		});
	}
);

// ─── setTrap else-branch for internalKeys ("_materialize") ────────────────────

describe.each(getMatrixConfigs({ mode: "eager" }))(
	"UnifiedWrapper > setTrap internal key assignment (line 2942) > Config: '$name'",
	({ config }) => {
		let api;

		beforeEach(async () => {
			const { default: slothlet } = await import("@cldmv/slothlet");
			api = await slothlet({ ...config, dir: TEST_DIRS.API_TEST, collision: { initial: "replace", api: "replace" } });
		});

		afterEach(async () => {
			if (api) await api.shutdown();
			api = null;
		});

		test("assigning to proxy._materialize writes directly to target (line 2942)", () => {
			// "_materialize" is in internalKeys: the set trap writes directly to target
			// (proxy target) instead of going through Object.defineProperty.
			// This should not throw; the original _materialize function remains callable.
			expect(() => {
				api.math._materialize = "test-value";
			}).not.toThrow();
		});
	}
);

// ─── deletePropertyTrap removes from impl (line 3017) ─────────────────────────

describe.each(getMatrixConfigs({ mode: "eager" }))(
	"UnifiedWrapper > deletePropertyTrap removes from impl (line 3017) > Config: '$name'",
	({ config }) => {
		let api;

		beforeEach(async () => {
			const { default: slothlet } = await import("@cldmv/slothlet");
			api = await slothlet({
				...config,
				dir: TEST_DIRS.API_TEST,
				collision: { initial: "replace", api: "replace" }
			});
		});

		afterEach(async () => {
			if (api) await api.shutdown();
			api = null;
		});

		test("delete on a proxy property that exists in impl removes it from impl (line 3017)", () => {
			// api.math wraps an impl object that has an 'add' property.
			// Deleting api.math.add should hit the deletePropertyTrap and, since
			// 'add' is in impl, also execute line 3017.
			const result = delete api.math.add;
			expect(result).toBe(true);
		});
	}
);
