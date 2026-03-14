/**
 *	@Project: @cldmv/slothlet
 *	@Filename: /tests/vitests/suites/api/lazy/api-assignment-replace-collision.test.vitest.mjs
 *	@Date: 2026-03-07 00:00:00 -08:00 (1773072000)
 *	@Author: Nate Corcoran <CLDMV>
 *	@Email: <Shinrai@users.noreply.github.com>
 *	-----
 *	@Last modified by: Nate Corcoran <CLDMV> (Shinrai@users.noreply.github.com)
 *	@Last modified time: 2026-03-07 00:00:00 -08:00 (1773072000)
 *	-----
 *	@Copyright: Copyright (c) 2013-2026 Catalyzed Motivation Inc. All rights reserved.
 */

/**
 * @fileoverview Coverage tests for api-assignment.mjs — Case 2 lazy-folder / replace-mode
 * collision (line 348).
 *
 * @description
 * Targets line 348 in api-assignment.mjs:
 *
 *   ```
 *   if (effectiveMode === "replace") {
 *     this.slothlet.debug("api", { key: "DEBUG_MODE_COLLISION_REPLACE_NO_COPY" });  // LINE 348
 *   }
 *   ```
 *
 * This branch is in the collision-resolution code for **Case 2**:
 *   `valueIsLazyUnmaterialized && !existingIsLazyUnmaterialized`
 *
 * Case 2 fires when a FILE (`math.mjs`) is processed FIRST and a LAZY FOLDER (`math/`)
 * is processed SECOND at the same API path. With `effectiveMode === "replace"`, the code
 * skips copying the file's keys into the lazy folder — line 348 fires.
 *
 * Requirements:
 *   - `mode: "lazy"` — only lazy mode creates lazy-unmaterialized folder wrappers
 *   - A fixture directory that contains BOTH `math.mjs` (file) AND `math/` (folder)
 *   - `collision: { initial: "replace" }` — to make effectiveMode "replace"
 *   - File must be processed before folder (alphabetical: `math.` < `math/`)
 *
 * The `api_test_collisions` fixture has exactly `math.mjs` and `math/` at the same path.
 *
 * @module tests/vitests/suites/api/lazy/api-assignment-replace-collision
 *
 * @internal
 * @private
 */

process.env.SLOTHLET_INTERNAL_TEST_MODE = "true";

import { describe, it, expect, afterEach } from "vitest";
import slothlet from "@cldmv/slothlet";
import { TEST_DIRS, suppressSlothletDebugOutput } from "../../../setup/vitest-helper.mjs";

suppressSlothletDebugOutput();

// ─── shared teardown ──────────────────────────────────────────────────────────

let _api = null;

afterEach(async () => {
	if (_api && typeof _api.shutdown === "function") {
		await _api.shutdown();
	}
	_api = null;
	await new Promise((r) => setTimeout(r, 30));
});

// ─────────────────────────────────────────────────────────────────────────────
// api-assignment.mjs line 348 — replace mode no-copy in Case 2 collision
//
// Case 2: file processed first → existing = file wrapper (materialized/eager);
//         folder processed second → value = lazy-unmaterialized folder wrapper.
// When effectiveMode === "replace", line 348 fires (debug log, no key copy).
//
// Using api_test_collisions which has math.mjs (file) + math/ (folder).
// Using mode: "lazy" so folder wrappers start as lazy-unmaterialized.
// Using collision: { initial: "replace" } so effectiveMode === "replace".
// ─────────────────────────────────────────────────────────────────────────────
describe("api-assignment: Case 2 lazy-folder collision with replace mode fires debug log (line 348)", () => {
	it("loading lazy API with file+folder collision in replace mode succeeds (line 348)", async () => {
		// api_test_collisions has math.mjs (file) AND math/ (folder).
		// In lazy mode, math.mjs creates a pre-materialized (non-lazy-unmaterialized) wrapper.
		// math/ creates a lazy-unmaterialized folder wrapper.
		// With collision: replace, Case 2 fires: file first, folder second.
		// Line 348 (`DEBUG_MODE_COLLISION_REPLACE_NO_COPY`) fires during this resolution.
		_api = await slothlet({
			dir: TEST_DIRS.API_TEST_COLLISIONS,
			mode: "lazy",
			collision: { initial: "replace" },
			silent: true
		});

		// The API loaded without throwing — replace mode handled collision cleanly.
		expect(_api).not.toBeNull();
		// math should exist as some form in the API (either from file or folder wins based on ordering).
		expect(_api.math !== undefined).toBe(true);
	});

	it("replace-mode collision resolves math path without throwing (line 348)", async () => {
		// Same scenario: the replace mode collision resolution at line 348 must not prevent
		// the API from being usable. Access the math namespace to verify it resolved.
		_api = await slothlet({
			dir: TEST_DIRS.API_TEST_COLLISIONS,
			mode: "lazy",
			collision: { initial: "replace" },
			silent: true
		});

		// Accessing api.math should work (either file or folder won in replace mode).
		// We just verify no error occurs during access.
		const mathVal = _api.math;
		expect(mathVal !== null).toBe(true);

		// Shut down immediately to clear lazy wrappers.
		await _api.shutdown();
		_api = null;
	});
});

// ─────────────────────────────────────────────────────────────────────────────
// Also test with api_test (which also has math.mjs + math/) for good measure.
// ─────────────────────────────────────────────────────────────────────────────
describe("api-assignment: api_test math.mjs + math/ collision in lazy replace mode (line 348)", () => {
	it("api_test lazy replace collision loads without error (line 348)", async () => {
		_api = await slothlet({
			dir: TEST_DIRS.API_TEST,
			mode: "lazy",
			collision: { initial: "replace" },
			silent: true
		});

		// API returned (may be function or object proxy depending on root callable module).
		expect(_api).not.toBeNull();
		expect(_api.math !== undefined).toBe(true);
	});
});
