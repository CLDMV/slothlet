/**
 *	@Project: @cldmv/slothlet
 *	@Filename: /tests/vitests/suites/ownership/ownership-branches.test.vitest.mjs
 *	@Date: 2026-02-27T06:19:24-08:00 (1772201964)
 *	@Author: Nate Hyson <CLDMV>
 *	@Email: <Shinrai@users.noreply.github.com>
 *	-----
 *	@Last modified by: Nate Hyson <CLDMV> (Shinrai@users.noreply.github.com)
 *	@Last modified time: 2026-02-28 13:23:06 -08:00 (1772313786)
 *	-----
 *	@Copyright: Copyright (c) 2013-2026 Catalyzed Motivation Inc. All rights reserved.
 */

/**
 * @fileoverview Coverage tests for OwnershipManager uncovered branches (lines 309-311, 325, 351).
 *
 * @description
 * Tests three code paths that integration tests never reach.  Where possible, the path is
 * triggered through the public slothlet API; only line 351 uses direct instantiation.
 *
 * ### Test strategy per line
 *
 * - **Lines 309-311** — `getDiagnostics().conflictedPaths` filter/map (inside `getDiagnostics()`):
 *   `getDiagnostics()` is exposed via `api.slothlet.diag.inspect()` (requires `diagnostics: true`).
 *   The filter's inner `.map()` callback (lines 310-311) only executes when a path has
 *   stack.length > 1, i.e. two different modules have registered the same apiPath.
 *   Calling `api.slothlet.api.add("math", mathMjsPath)` AFTER the initial load adds a second
 *   moduleID under the `math` apiPath — the initial scan's `base_slothlet` module already owns
 *   `math`, so the new add creates a second stack entry, yielding stack.length === 2.
 *
 * - **Line 325** — `getPathOwnership()` returns `null` for an unknown path:
 *   `getPathOwnership()` is exposed via `api.slothlet.owner.get(apiPath)` on every loaded
 *   slothlet instance.  Passing an unregistered path returns null at line 325.
 *
 * - **Line 351** — `registerSubtree()` circular-reference guard:
 *   The guard fires when the `visited` WeakSet already contains the object being traversed.
 *   This requires an object with a self-referencing property.  While a real circular-export
 *   module could trigger this via slothlet loading, creating and maintaining such a fixture
 *   solely for this edge case would add more maintenance burden than value.  Direct
 *   instantiation is used instead, with a clear justification comment.
 *
 * @module tests/vitests/suites/ownership/ownership-branches.test.vitest
 */

import { describe, it, expect, beforeEach, afterEach } from "vitest";
import slothlet from "@cldmv/slothlet";
import { OwnershipManager } from "@cldmv/slothlet/handlers/ownership";
import { SlothletError, SlothletWarning } from "@cldmv/slothlet/errors";
import { TEST_DIRS } from "../../setup/vitest-helper.mjs";

// ─── getDiagnostics conflictedPaths (lines 309-311) — via slothlet API ────────

describe("OwnershipManager getDiagnostics — conflictedPaths filter/map via api.slothlet.diag.inspect (lines 309-311)", () => {
	let api;

	beforeEach(async () => {
		// diagnostics: true is required to expose api.slothlet.diag.inspect().
		api = await slothlet({ dir: TEST_DIRS.API_TEST, diagnostics: true, silent: true });
		// Calling api.add with path "math" and the same math.mjs file that was already loaded
		// by the initial dir scan registers a SECOND moduleID for the "math" apiPath, creating
		// a stack.length === 2 entry.  This is the simplest way to trigger the conflictedPaths
		// filter/map at lines 309-311 via the public API without constructing special fixtures.
		await api.slothlet.api.add("math", TEST_DIRS.API_TEST + "/math.mjs");
	});

	afterEach(async () => {
		if (api?.shutdown) {
			await api.shutdown();
			api = null;
		}
	});

	it("conflictedPaths is defined in the ownership diagnostics", () => {
		const diag = api.slothlet.diag.inspect();

		expect(diag.ownership).toBeDefined();
		expect(Array.isArray(diag.ownership.conflictedPaths)).toBe(true);
	});

	it("conflictedPaths contains entries after api.add registers math.mjs a second time (lines 309-311)", () => {
		const diag = api.slothlet.diag.inspect();

		// api.add("math", math.mjs) created a second ownership entry for the "math" apiPath;
		// the initial dir scan already registered it under base_slothlet.
		expect(diag.ownership.conflictedPaths.length).toBeGreaterThan(0);
	});

	it("each conflicted path entry has apiPath (line 310) and ownerStack (line 311)", () => {
		const diag = api.slothlet.diag.inspect();
		const conflicts = diag.ownership.conflictedPaths;

		// Require at least one conflict to validate the shape of the mapped objects
		expect(conflicts.length).toBeGreaterThan(0);

		const first = conflicts[0];
		expect(typeof first.apiPath).toBe("string"); // line 310: apiPath field
		expect(Array.isArray(first.ownerStack)).toBe(true); // line 311: ownerStack field
		expect(first.ownerStack.length).toBeGreaterThanOrEqual(2); // stack had length > 1
	});

	it("ownerStack contains moduleID strings for each owner (line 311)", () => {
		const diag = api.slothlet.diag.inspect();

		for (const conflict of diag.ownership.conflictedPaths) {
			for (const moduleID of conflict.ownerStack) {
				expect(typeof moduleID).toBe("string");
				expect(moduleID.length).toBeGreaterThan(0);
			}
		}
	});
});

// ─── getPathOwnership — returns null (line 325) — via api.slothlet.owner.get ──

describe("OwnershipManager.getPathOwnership — returns null for unknown path via api.slothlet.owner.get (line 325)", () => {
	let api;

	beforeEach(async () => {
		api = await slothlet({ dir: TEST_DIRS.API_TEST });
	});

	afterEach(async () => {
		if (api?.shutdown) {
			await api.shutdown();
			api = null;
		}
	});

	it("api.slothlet.owner.get returns null for an apiPath that was never registered (line 325)", () => {
		// api.slothlet.owner.get() delegates directly to ownership.getPathOwnership()
		const result = api.slothlet.owner.get("definitely.not.a.registered.path");

		expect(result).toBeNull();
	});

	it("returns null for an obviously non-existent dotted path", () => {
		expect(api.slothlet.owner.get("x.y.z.no.such.path")).toBeNull();
	});

	it("returns null for an empty string path", () => {
		expect(api.slothlet.owner.get("")).toBeNull();
	});

	it("returns a non-null value for an actually registered path (confirms line 325 is a real branch)", () => {
		// math.add should be registered; ownership should return a non-null result
		const result = api.slothlet.owner.get("math.add");

		expect(result).not.toBeNull();
	});
});

// ─── registerSubtree — circular reference guard (line 351) — direct ──────────
// Justification: triggering this via slothlet requires loading a real API module whose
// exports contain a circular reference. Creating and maintaining such a fixture solely
// for this one-line guard adds more maintenance burden than coverage value. The guard
// exists to protect the traversal loop; direct instantiation is used to verify it fires
// without corrupting state or causing an infinite loop.

/**
 * Minimal mock slothlet sufficient for OwnershipManager direct-instantiation tests.
 * Defined at file scope so it is available in all describe blocks below.
 * @returns {object}
 */
function makeMock() {
	return { config: {}, debug: () => {}, SlothletError, SlothletWarning };
}

describe("OwnershipManager.registerSubtree — circular reference guard (line 351) [direct]", () => {
	it("does not throw or infinite-loop when object has a self-reference (line 351)", () => {
		const ownership = new OwnershipManager(makeMock());

		const circular = {};
		circular.self = circular; // self-referencing object

		expect(() => ownership.registerSubtree(circular, "mod-circ", "circ")).not.toThrow();
	});

	it("registers reachable children before hitting the circular ref and stops at the duplicate (line 351)", () => {
		const ownership = new OwnershipManager(makeMock());

		const inner = { value: function val() {} };
		const outer = { inner };
		inner.parent = outer; // outer → inner → outer (circular)

		ownership.registerSubtree(outer, "mod-loop", "root");

		// The traversal reaches inner.value before hitting the circular back-ref
		const owner = ownership.getCurrentOwner("root.inner.value");
		expect(owner).not.toBeNull();
		expect(owner.moduleID).toBe("mod-loop");
	});

	it("skips the second visit when the same nested object appears under multiple keys (line 351)", () => {
		const ownership = new OwnershipManager(makeMock());

		const shared = { helper: function help() {} };
		const api = { a: shared, b: shared }; // same reference under two keys

		expect(() => ownership.registerSubtree(api, "mod-shared", "ns")).not.toThrow();
	});
});
// ─── Line 200: removeEntry — moduleID not found in stack ─────────────────────────

describe("OwnershipManager.removePath — index -1 guard (line 200)", () => {
        it("returns action:none when the specified moduleID is not in the path stack (line 200)", () => {
                const ownership = new OwnershipManager(makeMock());

                // Register a path under one module
                ownership.register({ moduleID: "mod-a", apiPath: "math.add", value: () => {}, collisionMode: "replace" });

                // Try to remove a DIFFERENT module from the same path — not in stack
                const result = ownership.removePath("math.add", "non-existent-module");

                // index === -1 → line 200 fires: return { action: "none", ... }
                expect(result.action).toBe("none");
                expect(result.removedModuleId).toBeNull();
                expect(result.restoreModuleId).toBeNull();
        });

        it("returns action:none without mutating ownership when moduleID is missing (line 200)", () => {
                const ownership = new OwnershipManager(makeMock());
                ownership.register({ moduleID: "mod-b", apiPath: "lib.util", value: () => {}, collisionMode: "replace" });

                ownership.removePath("lib.util", "ghost-module");

                // Original owner is still registered
                const owner = ownership.getCurrentOwner("lib.util");
                expect(owner.moduleID).toBe("mod-b");
        });
});

// ─── Line 269: getModulePaths ───────────────────────────────────────────────

describe("OwnershipManager.getModulePaths — returns list of owned paths (line 269)", () => {
        it("returns an empty array for an unknown moduleID (line 269)", () => {
                const ownership = new OwnershipManager(makeMock());
                const paths = ownership.getModulePaths("unknown-module");
                expect(paths).toEqual([]);
        });

        it("returns all registered paths for a known moduleID (line 269)", () => {
                const ownership = new OwnershipManager(makeMock());
                ownership.register({ moduleID: "my-mod", apiPath: "math.add", value: () => {}, collisionMode: "replace" });
                ownership.register({ moduleID: "my-mod", apiPath: "math.sub", value: () => {}, collisionMode: "replace" });

                const paths = ownership.getModulePaths("my-mod");
                expect(paths).toContain("math.add");
                expect(paths).toContain("math.sub");
                expect(paths).toHaveLength(2);
        });
});

// ─── Lines 290-291: ownsPath ─────────────────────────────────────────────────

describe("OwnershipManager.ownsPath — true/false check (lines 290-291)", () => {
        it("returns true when the module is the current owner of the path (lines 290-291)", () => {
                const ownership = new OwnershipManager(makeMock());
                ownership.register({ moduleID: "mod-x", apiPath: "math.add", value: () => {}, collisionMode: "replace" });

                expect(ownership.ownsPath("mod-x", "math.add")).toBe(true);
        });

        it("returns false when a different module owns the path (lines 290-291)", () => {
                const ownership = new OwnershipManager(makeMock());
                ownership.register({ moduleID: "mod-x", apiPath: "math.add", value: () => {}, collisionMode: "replace" });

                expect(ownership.ownsPath("mod-y", "math.add")).toBe(false);
        });

        it("returns falsy for an unregistered path (lines 290-291)", () => {
                const ownership = new OwnershipManager(makeMock());
                const result = ownership.ownsPath("any-mod", "unregistered.path");
                expect(result).toBeFalsy();
        });
});

// ─── register() input validation (lines 53, 57) ──────────────────────────────

describe("OwnershipManager.register — input validation error paths (lines 53, 57)", () => {
        it("throws OWNERSHIP_INVALID_MODULE_ID when moduleID is null (line 53)", () => {
                const ownership = new OwnershipManager(makeMock());

                expect(() =>
                        ownership.register({ moduleID: null, apiPath: "math.add", value: () => {} })
                ).toThrow(SlothletError);
        });

        it("thrown error message contains OWNERSHIP_INVALID_MODULE_ID (line 53)", () => {
                const ownership = new OwnershipManager(makeMock());

                expect(() =>
                        ownership.register({ moduleID: undefined, apiPath: "math.add", value: () => {} })
                ).toThrow(/OWNERSHIP_INVALID_MODULE_ID/);
        });

        it("throws OWNERSHIP_INVALID_API_PATH when apiPath is a number (line 57)", () => {
                const ownership = new OwnershipManager(makeMock());

                // apiPath !== "" and not a string → line 57 throws
                expect(() =>
                        ownership.register({ moduleID: "mod-1", apiPath: 42, value: () => {} })
                ).toThrow(SlothletError);
        });

        it("thrown error message contains OWNERSHIP_INVALID_API_PATH (line 57)", () => {
                const ownership = new OwnershipManager(makeMock());

                expect(() =>
                        ownership.register({ moduleID: "mod-1", apiPath: {}, value: () => {} })
                ).toThrow(/OWNERSHIP_INVALID_API_PATH/);
        });

        it("does NOT throw for empty string apiPath (root-level special case)", () => {
                const ownership = new OwnershipManager(makeMock());

                // Empty string is explicitly allowed for root-level registrations
                expect(() =>
                        ownership.register({ moduleID: "mod-root", apiPath: "", value: {} })
                ).not.toThrow();
        });
});

// ─── unregister() unknown moduleID (line 149) ────────────────────────────────

describe("OwnershipManager.unregister — unknown moduleID returns empty result (line 149)", () => {
        it("returns { removed: [], rolledBack: [] } when moduleID has no registered paths (line 149)", () => {
                const ownership = new OwnershipManager(makeMock());

                const result = ownership.unregister("totally-unknown-mod");

                expect(result).toEqual({ removed: [], rolledBack: [] });
        });

        it("does not throw when unregistering an unknown moduleID (line 149)", () => {
                const ownership = new OwnershipManager(makeMock());

                expect(() => ownership.unregister("ghost-mod")).not.toThrow();
        });
});

// ─── removePath() no matching index (line 194) ───────────────────────────────

describe("OwnershipManager.removePath — no matching entry returns action:none (line 194)", () => {
        it("returns { action: 'none', ... } when the specified moduleID is not in the path stack (line 194)", () => {
                const ownership = new OwnershipManager(makeMock());

                // Register one module under math.add
                ownership.register({ moduleID: "mod-a", apiPath: "math.add", value: () => {} });

                // Try to remove a different moduleID from the same path — no match
                const result = ownership.removePath("math.add", "mod-does-not-exist");

                expect(result.action).toBe("none");
                expect(result.removedModuleId).toBeNull();
                expect(result.restoreModuleId).toBeNull();
        });

        it("returns { action: 'none', ... } when the path itself was never registered (line 194)", () => {
                const ownership = new OwnershipManager(makeMock());

                const result = ownership.removePath("never.registered", "any-mod");

                // The outer guard `if (!stack)` returns early before reaching line 194
                // But the path not found is still action:none
                expect(result.action).toBe("none");
        });
});