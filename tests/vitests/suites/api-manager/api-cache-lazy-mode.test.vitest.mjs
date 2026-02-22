/**
 *	@Project: @cldmv/slothlet
 *	@Filename: /tests/vitests/suites/api-manager/api-cache-lazy-mode.test.vitest.mjs
 *	@Date: 2026-02-21T10:42:58-08:00 (1771699378)
 *	@Author: Nate Hyson <CLDMV>
 *	@Email: <Shinrai@users.noreply.github.com>
 *	-----
 *	@Last modified by: Nate Hyson <CLDMV> (Shinrai@users.noreply.github.com)
 *	@Last modified time: 2026-02-21 15:36:26 -08:00 (1771716986)
 *	-----
 *	@Copyright: Copyright (c) 2013-2026 Catalyzed Motivation Inc. All rights reserved.
 */

/**
 * @fileoverview Verifies that the API cache system correctly respects lazy mode.
 *
 * The core concern: when `mode: "lazy"` is set, the cache entry is created
 * eagerly at startup (one entry per module), but the *contents* of the entry —
 * the subdirectory wrappers stored in `entry.api` — must remain unmaterialized
 * (`__materialized === false`) until a user explicitly accesses them.
 *
 * If anything in the cache creation or diagnostic path inadvertently iterates
 * the lazy wrappers (e.g. via `Object.entries()`), it would fire `_materialize()`
 * as a side effect and silently defeat lazy mode at startup.
 *
 * Test subject: `api.string` — a pure subdirectory in `api_test/` with no
 * matching root-level file, so it is guaranteed to start as an unmaterialized
 * lazy wrapper (`__materialized === false`, `__inFlight === false`).
 *
 * Only runs against lazy matrix configs since eager mode has no materialization
 * concept.
 *
 * @see src/lib/handlers/api-cache-manager.mjs — cache storage and `_countPaths()`
 * @see src/lib/handlers/unified-wrapper.mjs — lazy materialization logic
 * @see docs/v3/todo/api-cache-lazy-mode-verification.md — full analysis
 */

process.env.SLOTHLET_INTERNAL_TEST_MODE = "true";

import { describe, it, expect, beforeEach, afterEach } from "vitest";
import slothlet from "@cldmv/slothlet";
import { getMatrixConfigs, TEST_DIRS } from "../../setup/vitest-helper.mjs";

// Only lazy configs — these tests are meaningless for eager mode
const lazyConfigs = getMatrixConfigs({ mode: "lazy" });

for (const { config, name } of lazyConfigs) {
	describe(`API Cache — Lazy Mode | ${name}`, () => {
		let api;

		beforeEach(async () => {
			api = await slothlet({
				...config,
				dir: TEST_DIRS.API_TEST,
				api: {
					collision: {
						initial: "replace",
						api: "replace"
					},
					mutations: {
						add: true,
						remove: true,
						reload: true
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

		// ─── 1. Cache is created eagerly at startup ───

		it("should have exactly one cache entry after startup", () => {
			const diag = api.slothlet.diag.caches.get();
			expect(diag.totalCaches).toBe(1);
			expect(diag.caches[0].mode).toBe("lazy");
		});

		// ─── 2. Subdirectory wrappers in the cache are unmaterialized at startup ───

		it("should store unmaterialized wrappers for subdirectories at startup", () => {
			// api.string is a pure subdirectory in api_test/ — no matching root-level file —
			// so it must be an unmaterialized lazy wrapper immediately after slothlet() resolves.
			// The cache stores this.api directly, so checking api.string here is checking
			// what is inside the cached entry's api tree.
			expect(api.string.__materialized).toBe(false);
			expect(api.string.__inFlight).toBe(false);
		});

		// ─── 3. First access through the live api triggers materialization ───

		it("should materialize a lazy wrapper only on first access through the api", async () => {
			expect(api.string.__materialized).toBe(false);

			// Accessing a function through the proxy fires getTrap → _materialize().
			// The await ensures materialization has completed before the assertion.
			const result = await api.string.upper("hello");
			expect(result).toBe("HELLO");

			expect(api.string.__materialized).toBe(true);
		});

		// ─── 4. getCacheDiagnostics() must NOT trigger materialization ───

		it("getCacheDiagnostics() should not cause lazy wrappers to materialize", () => {
			// Baseline — wrapper is not materialized before diagnostics call
			expect(api.string.__materialized).toBe(false);
			expect(api.string.__inFlight).toBe(false);

			// getCacheDiagnostics() internally calls _countPaths(entry.api).
			// If _countPaths() uses Object.entries() on the api tree, it hits the
			// ownKeysTrap on the lazy proxy which fires _materialize() as a
			// fire-and-forget side effect — setting __inFlight = true synchronously.
			// This assertion confirms that does NOT happen.
			api.slothlet.diag.caches.get();

			// State must be completely unchanged after a diagnostic call
			expect(api.string.__materialized).toBe(false);
			expect(api.string.__inFlight).toBe(false);
		});

		// ─── 5. api.add() in lazy mode also stores lazy wrappers ───

		it("should store unmaterialized wrappers for api.add() modules in lazy mode", async () => {
			// api_test_mixed has: math-cjs.cjs, math-esm.mjs (root files — loaded eagerly),
			// and interop/ subdirectory (no matching root file — must be lazy wrapper)
			await api.slothlet.api.add("plugins", TEST_DIRS.API_TEST_MIXED);

			const diag = api.slothlet.diag.caches.get();
			expect(diag.totalCaches).toBe(2);

			// The interop/ subdir has no matching root-level file so the cache must have
			// stored a lazy (unmaterialized) wrapper — not a fully loaded module.
			// Note: __inFlight may be true at this point if background materialization
			// has started post-add(); that is expected and orthogonal to this check.
			expect(api.plugins.interop.__materialized).toBe(false);
		});
	});
}
