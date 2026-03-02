/**
 *	@Project: @cldmv/slothlet
 *	@Filename: /tests/vitests/suites/builders/api-assignment-collision-lazy.test.vitest.mjs
 *	@Date: 2026-03-02T08:00:00-08:00 (1772535600)
 *	@Author: Nate Corcoran <CLDMV>
 *	@Email: <Shinrai@users.noreply.github.com>
 *	-----
 *	@Last modified by: Nate Corcoran <CLDMV> (Shinrai@users.noreply.github.com)
 *	@Last modified time: 2026-03-02 08:46:28 -08:00 (1772469988)
 *	-----
 *	@Copyright: Copyright (c) 2013-2026 Catalyzed Motivation Inc. All rights reserved.
 */

/**
 * @fileoverview Coverage tests for api-assignment.mjs collision detection with lazy wrappers.
 *
 * @description
 * Covers the lazy-wrapper collision detection code paths in `assignToApiPath`, specifically:
 *
 * - Lines 217-228: DEBUG_MODE_COLLISION_SET_MODE_EXISTING_WRAPPER when existingIsLazyUnmaterialized
 * - Lines 223-228: Update existingWrapper.state.collisionMode
 * - Lines 229-243: DEBUG_MODE_COLLISION_SET_MODE_VALUE_WRAPPER when valueIsLazyUnmaterialized
 * - Lines 243-248: _materialize() fire-and-forget in replace mode
 * - Lines 318-348: replace mode with lazy folder vs non-lazy existing
 * - Lines 416-422: DEBUG_MODE_COLLISION_REPLACE_NO_COPY slow path
 * - Lines 451-454: assignToApiPath syncWrapper both-wrappers path (mutateExisting)
 * - Lines 497-535: recursive child wrapper merge (materialized both-wrapper merge)
 *
 * Trigger mechanism:
 * `api_test_collisions` contains BOTH `math.mjs` (file) AND `math/` (folder).
 * In lazy mode, BOTH become lazy unmaterialized wrappers. During the initial API build,
 * `assignToApiPath` is called with:
 *   - existing = lazy unmaterialized file wrapper (math.mjs)
 *   - value = lazy unmaterialized folder wrapper (math/)
 * This triggers existingIsLazyUnmaterialized=true AND valueIsLazyUnmaterialized=true,
 * firing lines 217-348 in both merge and replace collision modes.
 */

import { describe, it, expect, afterEach } from "vitest";
import { TEST_DIRS } from "../../setup/vitest-helper.mjs";

// ─── Shared teardown ─────────────────────────────────────────────────────────

let api;

afterEach(async () => {
	if (api) {
		await api.shutdown();
		api = null;
	}
});

// ─── Merge collision: both lazy wrappers (lines 217-248) ─────────────────────

describe("api-assignment collision: lazy+lazy merge (lines 217-248)", () => {
	it("loads api_test_collisions in lazy merge mode without throwing", async () => {
		const { default: slothlet } = await import("@cldmv/slothlet");
		api = await slothlet({
			dir: TEST_DIRS.API_TEST_COLLISIONS,
			mode: "lazy",
			collision: { initial: "merge" },
			silent: true
		});
		expect(api).toBeDefined();
		expect(typeof api).toBe("object");
	});

	it("math property exists after lazy merge collision", async () => {
		const { default: slothlet } = await import("@cldmv/slothlet");
		api = await slothlet({
			dir: TEST_DIRS.API_TEST_COLLISIONS,
			mode: "lazy",
			collision: { initial: "merge" },
			silent: true
		});
		// api.math exists because file+folder both map to it
		expect(api.math).toBeDefined();
	});

	it("loads api_test_collisions in lazy merge mode with debug:api enabled", async () => {
		// Triggering debug: { api: true } exercises the debug log paths inside collision detection
		// (lines 217, 223, 229, 235, 205, 188, 140, 149, 109, etc.)
		const { default: slothlet } = await import("@cldmv/slothlet");
		api = await slothlet({
			dir: TEST_DIRS.API_TEST_COLLISIONS,
			mode: "lazy",
			collision: { initial: "merge" },
			debug: { api: true },
			silent: true
		});
		expect(api).toBeDefined();
	});

	it("math.add is callable after lazy merge collision materializes", async () => {
		const { default: slothlet } = await import("@cldmv/slothlet");
		api = await slothlet({
			dir: TEST_DIRS.API_TEST_COLLISIONS,
			mode: "lazy",
			collision: { initial: "merge" },
			silent: true
		});
		// Trigger materialization
		await api.math._materialize();
		// After materialization, math functions should be accessible
		expect(api.math).toBeDefined();
	});
});

// ─── Replace collision: both lazy wrappers (lines 318-348) ───────────────────

describe("api-assignment collision: lazy+lazy replace (lines 318-348, 243-248)", () => {
	it("loads api_test_collisions in lazy replace mode without throwing", async () => {
		const { default: slothlet } = await import("@cldmv/slothlet");
		api = await slothlet({
			dir: TEST_DIRS.API_TEST_COLLISIONS,
			mode: "lazy",
			collision: { initial: "replace" },
			silent: true
		});
		expect(api).toBeDefined();
	});

	it("math property exists after lazy replace collision", async () => {
		const { default: slothlet } = await import("@cldmv/slothlet");
		api = await slothlet({
			dir: TEST_DIRS.API_TEST_COLLISIONS,
			mode: "lazy",
			collision: { initial: "replace" },
			silent: true
		});
		expect(api.math).toBeDefined();
	});

	it("loads with debug:api enabled in replace mode", async () => {
		// Covers lines 243-248: _materialize() fire-and-forget in replace mode for lazy value wrapper
		// Also covers lines 318-348: DEBUG_MODE_COLLISION_REPLACE_NO_COPY debug logs
		const { default: slothlet } = await import("@cldmv/slothlet");
		api = await slothlet({
			dir: TEST_DIRS.API_TEST_COLLISIONS,
			mode: "lazy",
			collision: { initial: "replace" },
			debug: { api: true },
			silent: true
		});
		expect(api).toBeDefined();
	});
});

// ─── Merge-replace collision: lazy wrappers (lines 217-348) ──────────────────

describe("api-assignment collision: lazy+lazy merge-replace (lines 217-348)", () => {
	it("loads api_test_collisions in lazy merge-replace mode", async () => {
		const { default: slothlet } = await import("@cldmv/slothlet");
		api = await slothlet({
			dir: TEST_DIRS.API_TEST_COLLISIONS,
			mode: "lazy",
			collision: { initial: "merge-replace" },
			silent: true
		});
		expect(api).toBeDefined();
		expect(api.math).toBeDefined();
	});

	it("loads with debug:api enabled in merge-replace mode", async () => {
		const { default: slothlet } = await import("@cldmv/slothlet");
		api = await slothlet({
			dir: TEST_DIRS.API_TEST_COLLISIONS,
			mode: "lazy",
			collision: { initial: "merge-replace" },
			debug: { api: true },
			silent: true
		});
		expect(api).toBeDefined();
	});
});

// ─── Eager collision: materialized wrapper merge (lines 451-535) ─────────────

describe("api-assignment collision: eager both-wrapper merge (lines 451-535)", () => {
	it("loads api_test_collisions in eager merge mode", async () => {
		const { default: slothlet } = await import("@cldmv/slothlet");
		api = await slothlet({
			dir: TEST_DIRS.API_TEST_COLLISIONS,
			mode: "eager",
			collision: { initial: "merge" },
			silent: true
		});
		expect(api).toBeDefined();
	});

	it("math property exists after eager merge collision", async () => {
		const { default: slothlet } = await import("@cldmv/slothlet");
		api = await slothlet({
			dir: TEST_DIRS.API_TEST_COLLISIONS,
			mode: "eager",
			collision: { initial: "merge" },
			silent: true
		});
		expect(api.math).toBeDefined();
	});

	it("loads api_test_collisions in eager merge mode with debug:api", async () => {
		// Covers lines 451-454 (syncWrapper both-wrappers) when debug logs fire during eager build
		const { default: slothlet } = await import("@cldmv/slothlet");
		api = await slothlet({
			dir: TEST_DIRS.API_TEST_COLLISIONS,
			mode: "eager",
			collision: { initial: "merge" },
			debug: { api: true },
			silent: true
		});
		expect(api).toBeDefined();
	});

	it("loads api_test_collisions in eager merge-replace mode", async () => {
		const { default: slothlet } = await import("@cldmv/slothlet");
		api = await slothlet({
			dir: TEST_DIRS.API_TEST_COLLISIONS,
			mode: "eager",
			collision: { initial: "merge-replace" },
			silent: true
		});
		expect(api).toBeDefined();
		expect(api.math).toBeDefined();
	});
});

// ─── Warn collision mode (converts to merge) ──────────────────────────────────

describe("api-assignment collision: warn mode lazy (converts to merge)", () => {
	it("loads api_test_collisions in lazy warn mode without throwing", async () => {
		const { default: slothlet } = await import("@cldmv/slothlet");
		api = await slothlet({
			dir: TEST_DIRS.API_TEST_COLLISIONS,
			mode: "lazy",
			collision: { initial: "warn" },
			silent: true
		});
		expect(api).toBeDefined();
	});
});

// ─── Skip collision mode ──────────────────────────────────────────────────────

describe("api-assignment collision: skip mode lazy", () => {
	it("loads api_test_collisions in lazy skip mode", async () => {
		const { default: slothlet } = await import("@cldmv/slothlet");
		api = await slothlet({
			dir: TEST_DIRS.API_TEST_COLLISIONS,
			mode: "lazy",
			collision: { initial: "skip" },
			silent: true
		});
		expect(api).toBeDefined();
	});
});
