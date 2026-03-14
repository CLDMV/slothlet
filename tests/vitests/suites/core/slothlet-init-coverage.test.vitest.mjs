/**
 *	@Project: @cldmv/slothlet
 *	@Filename: /tests/vitests/suites/core/slothlet-init-coverage.test.vitest.mjs
 *	@Date: 2026-03-03 00:00:00 -08:00 (1772726400)
 *	@Author: Nate Corcoran <CLDMV>
 *	@Email: <Shinrai@users.noreply.github.com>
 *	-----
 *	@Last modified by: Nate Corcoran <CLDMV> (Shinrai@users.noreply.github.com)
 *	@Last modified time: 2026-03-04 00:00:00 -08:00 (1772726400)
 *	-----
 *	@Copyright: Copyright (c) 2013-2026 Catalyzed Motivation Inc. All rights reserved.
 */

/**
 * @fileoverview Coverage tests for slothlet.mjs internals that require specific runtime conditions.
 *
 * @description
 * Targets the following uncovered branch in src/slothlet.mjs:
 *
 * - **`if (preservedInstanceID && contextManager.instances.has(preservedInstanceID))` TRUE branch**:
 *   Inside `load()`, when called with a non-null `preservedInstanceID` that IS already
 *   initialized in the context manager (i.e., the instances Map already has that ID),
 *   the old context is cleaned up before a fresh store is created.
 *
 *   Normal `reload()` creates a brand-new `_reload_` ID, so `instances.has()` is always
 *   FALSE (the fresh ID was never registered) and the TRUE branch is never taken.
 *
 *   `reload({ keepInstanceID: true })` reuses the current instanceID instead of
 *   generating a fresh one. Because the ID was registered during the first `load()`,
 *   `instances.has(preservedInstanceID)` returns TRUE, firing the cleanup branch.
 *
 * @module tests/vitests/suites/core/slothlet-init-coverage
 */

process.env.SLOTHLET_INTERNAL_TEST_MODE = "true";

import { describe, it, expect } from "vitest";
import slothlet from "@cldmv/slothlet";
import { TEST_DIRS } from "../../setup/vitest-helper.mjs";

// ─── load() preserved-context cleanup TRUE branch ──────────────────────────────
//
// Normal reload() passes a fresh `${oldID}_reload_${Date.now()}` ID to load().
// That ID has never been registered → instances.has() is FALSE → TRUE branch missed.
//
// reload({ keepInstanceID: true }) passes the CURRENT instanceID to load().
// That ID IS already registered → instances.has() is TRUE → cleanup+reinit fires.
// ──────────────────────────────────────────────────────────────────────────────────

describe("slothlet.mjs load() — preserved context cleanup TRUE branch", () => {
	it("reload({ keepInstanceID: true }) triggers the cleanup+reinit branch (async)", async () => {
		const api = await slothlet({
			dir: TEST_DIRS.API_TEST,
			silent: true,
			runtime: "async",
			api: { mutations: { reload: true } }
		});

		// reload() normally uses a brand-new ID → instances.has() is FALSE.
		// keepInstanceID: true reuses the live instanceID → instances.has() is TRUE
		// → load() takes the TRUE branch: cleanup(preservedInstanceID) + initialize(instanceID)
		await expect(api.slothlet.reload({ keepInstanceID: true })).resolves.not.toThrow();

		await api.shutdown();
	});

	it("reload({ keepInstanceID: true }) triggers the cleanup+reinit branch (live)", async () => {
		const api = await slothlet({
			dir: TEST_DIRS.API_TEST,
			silent: true,
			runtime: "live",
			api: { mutations: { reload: true } }
		});

		await expect(api.slothlet.reload({ keepInstanceID: true })).resolves.not.toThrow();

		await api.shutdown();
	});
});
