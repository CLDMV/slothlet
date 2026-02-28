/**
 *	@Project: @cldmv/slothlet
 *	@Filename: /tests/vitests/suites/builders/api-assignment-merge.test.vitest.mjs
 *	@Date: 2026-02-26T07:16:44-08:00 (1772119004)
 *	@Author: Nate Hyson <CLDMV>
 *	@Email: <Shinrai@users.noreply.github.com>
 *	-----
 *	@Last modified by: Nate Hyson <CLDMV> (Shinrai@users.noreply.github.com)
 *	@Last modified time: 2026-02-28 13:16:32 -08:00 (1772313392)
 *	-----
 *	@Copyright: Copyright (c) 2013-2026 Catalyzed Motivation Inc. All rights reserved.
 */

/**
 * @fileoverview Unit tests for ApiAssignment.mergeApiObjects (api-assignment.mjs lines 584-656).
 *
 * @description
 * `mergeApiObjects` is called during hot-reload when an API path maps to a plain object
 * on both sides (existing and next). In production it's reached via api-manager.mjs's
 * `mutateApiValue` when neither value is a UnifiedWrapper proxy. Because integration tests
 * always work with wrapped values, this path is never reached there.
 *
 * These direct unit tests instantiate `ApiAssignment` with a minimal mock slothlet and
 * call `mergeApiObjects` to cover all branches:
 * - Lines 584-596: normal entry path with valid source → starts processing
 * - Lines 597-605: early return when sourceApi is null/undefined/primitive
 * - Lines 607-626: outer loop with debug logging (config.debug.api = true)
 * - Lines 627-638: if both target and source values are plain objects → recurse
 * - Lines 639-651: else-branch → call assignToApiPath for non-object values
 * - Lines 653-658: removeMissing=true → delete target keys absent from source
 * - Line 554 (assignToApiPath): "return false" when existing is defined and overwrite is blocked
 *
 * @module tests/vitests/suites/builders/api-assignment-merge.test.vitest
 */

import { describe, it, expect, vi } from "vitest";
import { ApiAssignment } from "@cldmv/slothlet/builders/api-assignment";

/**
 * Create an ApiAssignment instance with a minimal mock slothlet.
 * @param {object} [debugOverride] - Override for the debug function.
 * @returns {{ assignment: ApiAssignment, debugCalls: string[] }} Instance and captured debug keys.
 */
function makeAssignment(debugOverride) {
	const debugCalls = [];
	const mockSlothlet = {
		debug: debugOverride ?? ((__, args) => debugCalls.push(args?.key))
	};
	const assignment = new ApiAssignment(mockSlothlet);
	return { assignment, debugCalls };
}

describe("ApiAssignment.mergeApiObjects", () => {
	// ─── Early-return for invalid / falsy source (lines 597-605) ───────────

	it("should be a no-op when sourceApi is null", async () => {
		const { assignment } = makeAssignment();
		const target = { a: 1 };
		await assignment.mergeApiObjects(target, null, {});
		expect(target).toEqual({ a: 1 });
	});

	it("should be a no-op when sourceApi is undefined", async () => {
		const { assignment } = makeAssignment();
		const target = { a: 1 };
		await assignment.mergeApiObjects(target, undefined, {});
		expect(target).toEqual({ a: 1 });
	});

	it("should be a no-op when sourceApi is a number (non-object primitive)", async () => {
		const { assignment } = makeAssignment();
		const target = { a: 1 };
		await assignment.mergeApiObjects(target, 42, {});
		expect(target).toEqual({ a: 1 });
	});

	it("should be a no-op when sourceApi is a string", async () => {
		const { assignment } = makeAssignment();
		const target = { a: 1 };
		await assignment.mergeApiObjects(target, "hello", {});
		expect(target).toEqual({ a: 1 });
	});

	// ─── Basic merge: flat objects (lines 639-651, assignToApiPath) ─────────

	it("should merge new keys from sourceApi into targetApi", async () => {
		const { assignment } = makeAssignment();
		const target = { a: 1 };
		await assignment.mergeApiObjects(target, { b: 2 }, { allowOverwrite: true });
		expect(target.b).toBe(2);
	});

	it("should overwrite existing scalar keys when allowOverwrite is true", async () => {
		const { assignment } = makeAssignment();
		const target = { x: 1 };
		await assignment.mergeApiObjects(target, { x: 99 }, { allowOverwrite: true });
		expect(target.x).toBe(99);
	});

	// ─── Assignment-blocked path (line 554 in assignToApiPath) ──────────────

	it("should NOT overwrite existing scalar keys when allowOverwrite is false (line 554)", async () => {
		// allowOverwrite=false (default), mutateExisting=false, useCollisionDetection=false
		// → assignToApiPath returns false → value stays unchanged
		const { assignment } = makeAssignment();
		const target = { x: 1 };
		await assignment.mergeApiObjects(target, { x: 99 }, {});
		// x should remain 1 because the assignment was blocked
		expect(target.x).toBe(1);
	});

	// ─── Recursive merge for nested plain objects (lines 627-638) ───────────

	it("should recursively merge nested plain objects", async () => {
		const { assignment } = makeAssignment();
		const target = { nested: { a: 1, b: 2 } };
		await assignment.mergeApiObjects(target, { nested: { b: 99, c: 3 } }, { allowOverwrite: true });
		// b gets overwritten (allowOverwrite), c gets added
		expect(target.nested.a).toBe(1); // untouched
		expect(target.nested.b).toBe(99); // overwritten
		expect(target.nested.c).toBe(3); // new
	});

	it("should deeply recurse through 3-level nested plain objects", async () => {
		const { assignment } = makeAssignment();
		const target = { lvl1: { lvl2: { val: "old" } } };
		await assignment.mergeApiObjects(target, { lvl1: { lvl2: { val: "new", extra: true } } }, { allowOverwrite: true });
		expect(target.lvl1.lvl2.val).toBe("new");
		expect(target.lvl1.lvl2.extra).toBe(true);
	});

	it("should handle a function-type source (functions are also valid object-like sources)", async () => {
		const { assignment } = makeAssignment();
		const fn = function myFn() {};
		fn.helper = "value";
		const target = {};
		await assignment.mergeApiObjects(target, fn, { allowOverwrite: true });
		// "helper" should be merged into target
		expect(target.helper).toBe("value");
	});

	// ─── removeMissing=true (lines 653-658) ─────────────────────────────────

	it("should delete target keys not present in source when removeMissing=true", async () => {
		const { assignment } = makeAssignment();
		const target = { keep: 1, remove: 2, alsoRemove: 3 };
		await assignment.mergeApiObjects(target, { keep: 10, newKey: 4 }, { removeMissing: true, allowOverwrite: true });
		expect(target.keep).toBe(10); // updated
		expect(target.newKey).toBe(4); // added
		expect("remove" in target).toBe(false); // deleted
		expect("alsoRemove" in target).toBe(false); // deleted
	});

	it("should NOT delete target keys when removeMissing is false (default)", async () => {
		const { assignment } = makeAssignment();
		const target = { a: 1, b: 2 };
		await assignment.mergeApiObjects(target, { a: 10 }, { allowOverwrite: true });
		expect(target.b).toBe(2); // b still present
	});

	// ─── Debug logging paths (lines 584-622 with config.debug.api=true) ────

	it("should invoke debug logging for entry, source-keys, and per-key when config.debug.api=true", async () => {
		const debugCalls = [];
		const mockSlothlet = { debug: (__, args) => debugCalls.push(args?.key) };
		const assignment = new ApiAssignment(mockSlothlet);

		const target = { a: 1 };
		await assignment.mergeApiObjects(target, { a: 10, b: 5 }, {
			config: { debug: { api: true } },
			allowOverwrite: true
		});

		// Should have fired entry, source-keys, and per-key debug messages
		expect(debugCalls).toContain("DEBUG_MODE_MERGE_API_OBJECTS_ENTRY");
		expect(debugCalls).toContain("DEBUG_MODE_MERGE_API_OBJECTS_SOURCE_KEYS");
		expect(debugCalls).toContain("DEBUG_MODE_MERGE_API_OBJECTS_PROCESSING_KEY");
	});

	it("should log a recursing debug message when both target and source values are plain objects", async () => {
		const debugCalls = [];
		const mockSlothlet = { debug: (__, args) => debugCalls.push(args?.key) };
		const assignment = new ApiAssignment(mockSlothlet);

		const target = { nested: { x: 1 } };
		await assignment.mergeApiObjects(target, { nested: { x: 2 } }, {
			config: { debug: { api: true } },
			allowOverwrite: true
		});

		expect(debugCalls).toContain("DEBUG_MODE_MERGE_API_OBJECTS_RECURSING");
	});

	it("should log exit-invalid-source when source is null + debug.api=true (lines 597-605)", async () => {
		const debugCalls = [];
		const mockSlothlet = { debug: (__, args) => debugCalls.push(args?.key) };
		const assignment = new ApiAssignment(mockSlothlet);

		await assignment.mergeApiObjects({}, null, { config: { debug: { api: true } } });

		// The early-return path logs the invalid source exit message
		expect(debugCalls).toContain("DEBUG_MODE_MERGE_API_OBJECTS_EXIT_INVALID_SOURCE");
	});

	it("should log the assign debug message when assignToApiPath is called (non-object value)", async () => {
		const debugCalls = [];
		const mockSlothlet = { debug: (__, args) => debugCalls.push(args?.key) };
		const assignment = new ApiAssignment(mockSlothlet);

		await assignment.mergeApiObjects({}, { scalarKey: 42 }, {
			config: { debug: { api: true } },
			allowOverwrite: true
		});

		expect(debugCalls).toContain("DEBUG_MODE_MERGE_API_OBJECTS_CALLING_ASSIGN");
	});

	// ─── Edge cases ──────────────────────────────────────────────────────────

	it("should handle empty source (no keys) without errors", async () => {
		const { assignment } = makeAssignment();
		const target = { a: 1 };
		await assignment.mergeApiObjects(target, {}, { removeMissing: true });
		// removeMissing=true with empty source should clear the target
		expect("a" in target).toBe(false);
	});

	it("should add deeply nested paths that do not exist in target", async () => {
		const { assignment } = makeAssignment();
		const target = {};
		await assignment.mergeApiObjects(target, { brand: { new: true } }, { allowOverwrite: true });
		// brand is new in target → not a case for recursion (target.brand is undefined)
		// assignToApiPath should set it directly
		expect(target.brand).toBeDefined();
	});
});
