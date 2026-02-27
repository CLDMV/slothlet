/**
 *      @Project: @cldmv/slothlet
 *      @Filename: /tests/vitests/suites/ownership/ownership-state.test.vitest.mjs
 *      @Date: 2026-07-15T00:00:00-07:00 (1752652800)
 *      @Author: Nate Hyson <CLDMV>
 *      @Email: <Shinrai@users.noreply.github.com>
 *      -----
 *      @Last modified by: Nate Hyson <CLDMV> (Shinrai@users.noreply.github.com)
 *      @Last modified time: 2026-07-15 00:00:00 -07:00 (1752652800)
 *      -----
 *      @Copyright: Copyright (c) 2013-2026 Catalyzed Motivation Inc. All rights reserved.
 */

/**
 * @fileoverview Coverage tests for OwnershipManager uncovered branches (lines 372, 409–433).
 *
 * @description
 * Directly instantiates OwnershipManager to cover two code paths never reached by
 * integration tests:
 *
 * - Line 372: `continue` inside `registerSubtree()` — fires when a key in the API
 *   object is one of the internal skipProps ("__metadata", "__type", "_materialize",
 *   "_impl", "____slothletInternal").
 *
 * - Lines 409–414: `exportState()` — serialises moduleToPath and pathToModule to plain
 *   arrays for persistence across hot-reload cycles.
 *
 * - Lines 421–433: `importState()` — restores moduleToPath and pathToModule from a
 *   previously exported state object.
 *
 * @module tests/vitests/suites/ownership/ownership-state.test.vitest
 */

import { describe, it, expect } from "vitest";
import { OwnershipManager } from "@cldmv/slothlet/handlers/ownership";
import { SlothletError, SlothletWarning } from "@cldmv/slothlet/errors";

/**
 * Minimal mock slothlet sufficient for OwnershipManager.
 *
 * @returns {object} Mock slothlet object.
 *
 * @example
 * const ownership = new OwnershipManager(makeMock());
 */
function makeMock() {
	return {
		config: {},
		debug: () => {},
		SlothletError,
		SlothletWarning
	};
}

// ─── registerSubtree skip-props continue (line 372) ───────────────────────────

describe("OwnershipManager.registerSubtree - skipProps continue (line 372)", () => {
	it("should skip __metadata key and not register it", () => {
		const ownership = new OwnershipManager(makeMock());

		const api = {
			__metadata: { type: "folder-wrapper" },
			add: function () {
				return 1;
			}
		};

		// Empty path — the top-level registration is skipped (falsy path guard).
		// The loop will find __metadata → continue (line 372) and "add" → register.
		ownership.registerSubtree(api, "mod1", "");

		// "add" should be owned (registered at childPath "add")
		const owner = ownership.getCurrentOwner("add");
		expect(owner).not.toBeNull();
		expect(owner.moduleID).toBe("mod1");

		// __metadata should NOT be in pathToModule
		expect(ownership.getCurrentOwner("__metadata")).toBeNull();
	});

	it("should skip __type key", () => {
		const ownership = new OwnershipManager(makeMock());

		const api = {
			__type: "lazy",
			compute: function () {
				return 2;
			}
		};

		ownership.registerSubtree(api, "mod2", "");

		expect(ownership.getCurrentOwner("compute")).not.toBeNull();
		expect(ownership.getCurrentOwner("__type")).toBeNull();
	});

	it("should skip _materialize, _impl, and ____slothletInternal keys", () => {
		const ownership = new OwnershipManager(makeMock());

		const api = {
			_materialize: function () {},
			_impl: {},
			____slothletInternal: true,
			visible: function () {
				return "yes";
			}
		};

		ownership.registerSubtree(api, "mod3", "");

		expect(ownership.getCurrentOwner("visible")).not.toBeNull();
		for (const key of ["_materialize", "_impl", "____slothletInternal"]) {
			expect(ownership.getCurrentOwner(key)).toBeNull();
		}
	});

	it("should handle api with ALL internal keys (nothing gets registered)", () => {
		const ownership = new OwnershipManager(makeMock());

		const api = {
			__metadata: {},
			__type: "eager"
		};

		// Should not throw and should produce no registrations
		ownership.registerSubtree(api, "mod4", "");

		expect(ownership.moduleToPath.size).toBe(0);
	});
});

// ─── exportState / importState (lines 409–433) ───────────────────────────────

describe("OwnershipManager.exportState and importState (lines 409–433)", () => {
	it("should export empty state when nothing is registered", () => {
		const ownership = new OwnershipManager(makeMock());

		const state = ownership.exportState();

		expect(state).toHaveProperty("moduleToPath");
		expect(state).toHaveProperty("pathToModule");
		expect(state.moduleToPath).toEqual([]);
		expect(state.pathToModule).toEqual([]);
	});

	it("should export state with registered entries", () => {
		const ownership = new OwnershipManager(makeMock());

		ownership.register({ moduleID: "modA", apiPath: "math.add", value: function () {} });
		ownership.register({ moduleID: "modA", apiPath: "math.mul", value: function () {} });

		const state = ownership.exportState();

		// moduleToPath should contain [["modA", ["math.add", "math.mul"]]] (order may vary)
		expect(state.moduleToPath).toHaveLength(1);
		expect(state.moduleToPath[0][0]).toBe("modA");
		expect(state.moduleToPath[0][1]).toContain("math.add");
		expect(state.moduleToPath[0][1]).toContain("math.mul");

		// pathToModule should contain entries for both paths
		const pathKeys = state.pathToModule.map(([k]) => k);
		expect(pathKeys).toContain("math.add");
		expect(pathKeys).toContain("math.mul");
	});

	it("should import state and restore ownership (lines 421–433)", () => {
		const source = new OwnershipManager(makeMock());
		const fn = function () {
			return "hello";
		};

		source.register({ moduleID: "modX", apiPath: "util.greet", value: fn });

		const state = source.exportState();

		// Import into a fresh manager
		const target = new OwnershipManager(makeMock());
		target.importState(state);

		// moduleToPath should be restored
		const paths = target.moduleToPath.get("modX");
		expect(paths).toBeDefined();
		expect(paths.has("util.greet")).toBe(true);

		// pathToModule should be restored
		const stack = target.pathToModule.get("util.greet");
		expect(stack).toBeDefined();
		expect(stack.length).toBeGreaterThan(0);
		expect(stack[stack.length - 1].moduleID).toBe("modX");
	});

	it("importState should clear existing data before restoring (line 422)", () => {
		const ownership = new OwnershipManager(makeMock());

		// Pre-populate with stale data
		ownership.register({ moduleID: "staleModule", apiPath: "stale.path", value: function () {} });

		// Import an empty state — stale data should be gone
		ownership.importState({ moduleToPath: [], pathToModule: [] });

		expect(ownership.moduleToPath.size).toBe(0);
		expect(ownership.pathToModule.size).toBe(0);
		expect(ownership.getCurrentOwner("stale.path")).toBeNull();
	});

	it("should round-trip multiple modules via export/import", () => {
		const source = new OwnershipManager(makeMock());

		source.register({ moduleID: "mod1", apiPath: "a.b", value: function () {} });
		source.register({ moduleID: "mod2", apiPath: "c.d", value: function () {} });

		const state = source.exportState();

		const target = new OwnershipManager(makeMock());
		target.importState(state);

		expect(target.moduleToPath.has("mod1")).toBe(true);
		expect(target.moduleToPath.has("mod2")).toBe(true);
		expect(target.pathToModule.has("a.b")).toBe(true);
		expect(target.pathToModule.has("c.d")).toBe(true);
	});
});
