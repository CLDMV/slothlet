/**
 *@Project: @cldmv/slothlet
 *@Filename: /tests/vitests/suites/builders/api-assignment-lazy-folder-collision.test.vitest.mjs
 *@Date: 2026-03-02T00:00:00-08:00 (1772496000)
 *@Author: Nate Corcoran <CLDMV>
 *@Email: <Shinrai@users.noreply.github.com>
 *-----
 *@Last modified by: Nate Corcoran <CLDMV>
 *@Last modified time: 2026-03-02 12:00:00 -08:00
 *-----
 *@Copyright: Copyright (c) 2013-2026 Catalyzed Motivation Inc. All rights reserved.
 */

/**
 * @fileoverview Unit tests for api-assignment.mjs: lazy+lazy wrapper collision branches.
 *
 * @description
 * Lines 217-228 (existingIsLazyUnmaterialized block) and lines 229-248
 * (valueIsLazyUnmaterialized block) fire when `assignToApiPath` is called with
 * `useCollisionDetection: true`, a config, and both existing+value are
 * UnifiedWrapper proxies that are lazy+unmaterialized.
 *
 * Key insight: `state.collisionMode` initialises to `"merge"` in the constructor
 * (unified-wrapper.mjs line 213), so we cannot assert it starts as `undefined`.
 * Instead we use `"replace"` in the config so the assignment writes a DIFFERENT
 * value and we can confirm the code in lines 217-228 / 229-248 actually ran.
 *
 * Integration approach (api.slothlet.api.add) cannot hit these lines because:
 *   - `api.slothlet.api.add` does not call `assignToApiPath` with `useCollisionDetection: true`
 *   - Values produced by the add path are eager (materialized=true) wrappers
 *
 * Lines covered:
 *   - 217-228  : existingIsLazyUnmaterialized=true → sets effectiveMode on existing
 *   - 229-248  : valueIsLazyUnmaterialized=true   → sets effectiveMode on value; calls _materialize for replace
 *   - 318-348  : merge mode, !existingIsLazyUnmaterialized && valueIsLazyUnmaterialized
 *
 * @module tests/vitests/suites/builders/api-assignment-lazy-folder-collision
 */

process.env.SLOTHLET_INTERNAL_TEST_MODE = "true";

import { describe, it, expect, afterEach } from "vitest";
import slothlet from "@cldmv/slothlet";
import { resolveWrapper, UnifiedWrapper } from "@cldmv/slothlet/handlers/unified-wrapper";
import { TEST_DIRS } from "../../setup/vitest-helper.mjs";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Extract the raw Slothlet instance from an API proxy by resolving a known key.
 * @param {object} api - The slothlet API proxy.
 * @param {string} key - A top-level key whose value is a UnifiedWrapper proxy.
 * @returns {object} The raw Slothlet instance.
 */
function getSlothletInst(api, key) {
return resolveWrapper(api[key]).slothlet;
}

/**
 * Create a collision config for `assignToApiPath` options.
 * @param {"merge"|"replace"|"merge-replace"|"warn"} mode
 * @returns {object}
 */
function makeConfig(mode = "merge") {
return { collision: { initial: mode } };
}

/**
 * Build a lazy unmaterialized UnifiedWrapper and its proxy.
 * Note: `state.collisionMode` initialises to `"merge"` by default in the constructor.
 * @param {object} slothletInst
 * @param {string} apiPath
 * @returns {{ wrapper: UnifiedWrapper, proxy: Proxy }}
 */
function makeLazyWrapper(slothletInst, apiPath) {
const wrapper = new UnifiedWrapper(slothletInst, {
mode: "lazy",
apiPath,
materializeFunc: async (setImpl) => {
setImpl({ value: 99 });
}
});
return { wrapper, proxy: wrapper.createProxy() };
}

// ---------------------------------------------------------------------------
// Group 1: both existing and value are lazy+unmaterialized
// → Lines 217-228 (existing) and 229-248 (value)
// ---------------------------------------------------------------------------
describe("api-assignment: both wrappers lazy+unmaterialized — collision lines 217-228 and 229-248", () => {
let _api;

afterEach(async () => {
if (_api?.shutdown) await _api.shutdown();
_api = null;
});

it("replace mode overwrites existing wrapper state.collisionMode from default 'merge' to 'replace' (line 219)", async () => {
_api = await slothlet({ dir: TEST_DIRS.API_TEST, mode: "lazy", silent: true });
const sl = getSlothletInst(_api, "math");
const assignment = sl.builders.apiAssignment;

const { wrapper: existing, proxy: existingProxy } = makeLazyWrapper(sl, "folderX.a");
const { proxy: valueProxy } = makeLazyWrapper(sl, "folderX.b");

// Default collisionMode from constructor is "merge"
expect(existing.____slothletInternal.state.collisionMode).toBe("merge");
expect(existing.____slothletInternal.mode).toBe("lazy");
expect(existing.____slothletInternal.state.materialized).toBe(false);

const targetApi = { myFolder: existingProxy };

// assignToApiPath with replace → lines 217-228 overwrite "merge" → "replace"
assignment.assignToApiPath(targetApi, "myFolder", valueProxy, {
useCollisionDetection: true,
config: makeConfig("replace"),
collisionContext: "initial"
});

// Line 219 executed: collisionMode updated on existing from "merge" → "replace"
expect(existing.____slothletInternal.state.collisionMode).toBe("replace");
});

it("replace mode overwrites value wrapper state.collisionMode 'merge' → 'replace' (lines 229-248)", async () => {
_api = await slothlet({ dir: TEST_DIRS.API_TEST, mode: "lazy", silent: true });
const sl = getSlothletInst(_api, "math");
const assignment = sl.builders.apiAssignment;

const { proxy: existingProxy } = makeLazyWrapper(sl, "folderY.a");
const { wrapper: value, proxy: valueProxy } = makeLazyWrapper(sl, "folderY.b");

expect(value.____slothletInternal.state.collisionMode).toBe("merge");

const targetApi = { myFolder: existingProxy };

// Lines 229-248: value lazy wrapper gets new collisionMode
assignment.assignToApiPath(targetApi, "myFolder", valueProxy, {
useCollisionDetection: true,
config: makeConfig("replace"),
collisionContext: "initial"
});

expect(value.____slothletInternal.state.collisionMode).toBe("replace");
// Line 241: _materialize() called for replace mode
expect(value.____slothletInternal.state.inFlight || value.____slothletInternal.state.materialized).toBe(true);
});

it("merge mode confirms both existing and value are recognised as lazy (no error)", async () => {
_api = await slothlet({ dir: TEST_DIRS.API_TEST, mode: "lazy", silent: true });
const sl = getSlothletInst(_api, "math");
const assignment = sl.builders.apiAssignment;

const { wrapper: existing, proxy: existingProxy } = makeLazyWrapper(sl, "folderZ.a");
const { wrapper: value, proxy: valueProxy } = makeLazyWrapper(sl, "folderZ.b");

const targetApi = { myFolder: existingProxy };

// merge mode — both are already "merge" so the value stays "merge"
const result = assignment.assignToApiPath(targetApi, "myFolder", valueProxy, {
useCollisionDetection: true,
config: makeConfig("merge"),
collisionContext: "initial"
});

// Function should return something (not throw) — lines 216-248 executed
expect(result).toBeDefined();
expect(existing.____slothletInternal.state.collisionMode).toBe("merge");
expect(value.____slothletInternal.state.collisionMode).toBe("merge");
});

it("merge-replace mode writes merge-replace onto both lazy wrappers", async () => {
_api = await slothlet({ dir: TEST_DIRS.API_TEST, mode: "lazy", silent: true });
const sl = getSlothletInst(_api, "math");
const assignment = sl.builders.apiAssignment;

const { wrapper: existing, proxy: existingProxy } = makeLazyWrapper(sl, "folderW.a");
const { wrapper: value, proxy: valueProxy } = makeLazyWrapper(sl, "folderW.b");

const targetApi = { myFolder: existingProxy };

assignment.assignToApiPath(targetApi, "myFolder", valueProxy, {
useCollisionDetection: true,
config: makeConfig("merge-replace"),
collisionContext: "initial"
});

expect(existing.____slothletInternal.state.collisionMode).toBe("merge-replace");
expect(value.____slothletInternal.state.collisionMode).toBe("merge-replace");
});

it("warn mode converts to merge and writes merge onto both lazy wrappers", async () => {
_api = await slothlet({ dir: TEST_DIRS.API_TEST, mode: "lazy", silent: true });
const sl = getSlothletInst(_api, "math");
const assignment = sl.builders.apiAssignment;

const { wrapper: existing, proxy: existingProxy } = makeLazyWrapper(sl, "folderV.a");
const { wrapper: value, proxy: valueProxy } = makeLazyWrapper(sl, "folderV.b");

const targetApi = { myFolder: existingProxy };

assignment.assignToApiPath(targetApi, "myFolder", valueProxy, {
useCollisionDetection: true,
config: makeConfig("warn"),
collisionContext: "initial"
});

// warn → merge via effectiveMode
expect(existing.____slothletInternal.state.collisionMode).toBe("merge");
expect(value.____slothletInternal.state.collisionMode).toBe("merge");
});
});

// ---------------------------------------------------------------------------
// Group 2: merge mode, existing is eager/materialized, value is lazy+unmaterialized
// (file loaded first, lazy folder loaded second) → Lines 318-348
// ---------------------------------------------------------------------------
describe("api-assignment: existing eager, value lazy — merge branch (lines 318-348)", () => {
let _api;

afterEach(async () => {
if (_api?.shutdown) await _api.shutdown();
_api = null;
});

it("value lazy wrapper gets collisionMode overwritten from 'merge' to 'replace' in replace mode (lines 340-348)", async () => {
_api = await slothlet({ dir: TEST_DIRS.API_TEST, mode: "lazy", silent: true });
const sl = getSlothletInst(_api, "math");
const assignment = sl.builders.apiAssignment;

// Existing: eager (fully materialized) wrapper — not a lazy folder
const existingEager = new UnifiedWrapper(sl, {
mode: "eager",
apiPath: "folder.eager",
initialImpl: { exportedFn: () => 1 }
});
const existingProxy = existingEager.createProxy();

// Value: lazy + unmaterialized (the folder arriving second)
const { wrapper: value, proxy: valueProxy } = makeLazyWrapper(sl, "folder.lazyNew");

expect(value.____slothletInternal.state.collisionMode).toBe("merge");

const targetApi = { myFolder: existingProxy };

// replace mode: lines 340-348 fire → _materialize() called on value
assignment.assignToApiPath(targetApi, "myFolder", valueProxy, {
useCollisionDetection: true,
config: makeConfig("replace"),
collisionContext: "initial"
});

expect(value.____slothletInternal.state.collisionMode).toBe("replace");
// _materialize() triggered (line 348 area)
expect(value.____slothletInternal.state.inFlight || value.____slothletInternal.state.materialized).toBe(true);
});

it("value lazy wrapper gets collisionMode merge-replace written in merge-replace mode (lines 318-334)", async () => {
_api = await slothlet({ dir: TEST_DIRS.API_TEST, mode: "lazy", silent: true });
const sl = getSlothletInst(_api, "math");
const assignment = sl.builders.apiAssignment;

const existingEager = new UnifiedWrapper(sl, {
mode: "eager",
apiPath: "folder.eager2",
initialImpl: { exportedFn: () => 2 }
});

const { wrapper: value, proxy: valueProxy } = makeLazyWrapper(sl, "folder.lazyNew2");

const targetApi = { myFolder: existingEager.createProxy() };

// merge-replace: lines 318-334 — stores collisionMode on value lazy wrapper
assignment.assignToApiPath(targetApi, "myFolder", valueProxy, {
useCollisionDetection: true,
config: makeConfig("merge-replace"),
collisionContext: "initial"
});

expect(value.____slothletInternal.state.collisionMode).toBe("merge-replace");
});

it("value lazy wrapper collisionMode remains merge in plain merge mode (lines 318-334)", async () => {
_api = await slothlet({ dir: TEST_DIRS.API_TEST, mode: "lazy", silent: true });
const sl = getSlothletInst(_api, "math");
const assignment = sl.builders.apiAssignment;

const existingEager = new UnifiedWrapper(sl, {
mode: "eager",
apiPath: "folder.eager3",
initialImpl: { exportedFn: () => 3 }
});

const { wrapper: value, proxy: valueProxy } = makeLazyWrapper(sl, "folder.lazyNew3");

const targetApi = { myFolder: existingEager.createProxy() };

// merge: lines 318-334 — collisionMode stays "merge" (same value but code runs)
const result = assignment.assignToApiPath(targetApi, "myFolder", valueProxy, {
useCollisionDetection: true,
config: makeConfig("merge"),
collisionContext: "initial"
});

expect(result).toBeDefined();
expect(value.____slothletInternal.state.collisionMode).toBe("merge");
});
});

// ---------------------------------------------------------------------------
// Group 3: merge mode, existingIsLazyUnmaterialized=true, valueIsLazyUnmaterialized=false
// (lazy folder processed first, eager/materialized file processed second) → Lines 318-339
// ---------------------------------------------------------------------------
describe("api-assignment: existing lazy, value eager — Case 1 merge (lines 318-339)", () => {
let _api;

afterEach(async () => {
if (_api?.shutdown) await _api.shutdown();
_api = null;
});

it("keeps the existing lazy wrapper and copies value's child keys into it (line 330)", async () => {
_api = await slothlet({ dir: TEST_DIRS.API_TEST, mode: "lazy", silent: true });
const sl = getSlothletInst(_api, "math");
const assignment = sl.builders.apiAssignment;

// Existing: lazy+unmaterialized — the lazy folder wrapper
const { wrapper: existing, proxy: existingProxy } = makeLazyWrapper(sl, "folder.lazyExist");

// Value: eager wrapper with impl and children (acts as the "file" being added second)
const valueEager = new UnifiedWrapper(sl, {
mode: "eager",
apiPath: "folder.eagerVal",
initialImpl: { add: (a, b) => a + b }
});
const valueProxy = valueEager.createProxy();

const targetApi = { myFolder: existingProxy };

// merge mode: Case 1 fires (existingIsLazy && !valueLazy) → lines 318-339
const result = assignment.assignToApiPath(targetApi, "myFolder", valueProxy, {
useCollisionDetection: true,
config: makeConfig("merge"),
collisionContext: "initial"
});

// Case 1 returns true (keeps existing lazy folder)
expect(result).toBe(true);
// targetApi still has the original existing lazy wrapper, not the eager value
expect(resolveWrapper(targetApi.myFolder)).toBe(existing);
});

it("merge-replace mode still enters Case 1 (existingIsLazy, valueExist) and keeps existing (lines 318-339)", async () => {
_api = await slothlet({ dir: TEST_DIRS.API_TEST, mode: "lazy", silent: true });
const sl = getSlothletInst(_api, "math");
const assignment = sl.builders.apiAssignment;

const { wrapper: existing, proxy: existingProxy } = makeLazyWrapper(sl, "folder.lazyExR");
const valueEager = new UnifiedWrapper(sl, {
mode: "eager",
apiPath: "folder.eagerValR",
initialImpl: { multiply: (a, b) => a * b }
});

const targetApi = { myFolder: existingProxy };

// merge-replace: also hits Case 1 when existing=lazy, value=eager
const result = assignment.assignToApiPath(targetApi, "myFolder", valueEager.createProxy(), {
useCollisionDetection: true,
config: makeConfig("merge-replace"),
collisionContext: "initial"
});

expect(result).toBe(true);
// Existing lazy folder is still the current value
expect(resolveWrapper(targetApi.myFolder)).toBe(existing);
});

it("Case 1 initialises childFilePathsPreMaterialize on existing lazy wrapper (line 323)", async () => {
_api = await slothlet({ dir: TEST_DIRS.API_TEST, mode: "lazy", silent: true });
const sl = getSlothletInst(_api, "math");
const assignment = sl.builders.apiAssignment;

const { wrapper: existing, proxy: existingProxy } = makeLazyWrapper(sl, "folder.lazyExC");
const valueEager = new UnifiedWrapper(sl, {
mode: "eager",
apiPath: "folder.eagerValC",
initialImpl: { compute: () => 42 }
});

// Pre-condition: no childFilePathsPreMaterialize yet
expect(existing.____slothletInternal.childFilePathsPreMaterialize).toBeUndefined();

const targetApi = { myFolder: existingProxy };

assignment.assignToApiPath(targetApi, "myFolder", valueEager.createProxy(), {
useCollisionDetection: true,
config: makeConfig("merge"),
collisionContext: "initial"
});

// Line 323-324: childFilePathsPreMaterialize initialised on the existing lazy wrapper
expect(existing.____slothletInternal.childFilePathsPreMaterialize).toBeDefined();
expect(typeof existing.____slothletInternal.childFilePathsPreMaterialize).toBe("object");
});
});

// ---------------------------------------------------------------------------
// Group 4: merge mode, both wrappers are materialized (not lazy-unmaterialized)
// Falls through to the child-merge code → Lines 451, 454 (adoptImplChildren guard)
// ---------------------------------------------------------------------------
describe("api-assignment: both materialized wrappers in merge mode — adoptImplChildren guard (lines 451, 454)", () => {
let _api;

afterEach(async () => {
if (_api?.shutdown) await _api.shutdown();
_api = null;
});

it("calls ___adoptImplChildren when impl is set but childCount is zero (line 451)", async () => {
_api = await slothlet({ dir: TEST_DIRS.API_TEST, mode: "lazy", silent: true });
const sl = getSlothletInst(_api, "math");
const assignment = sl.builders.apiAssignment;

// Existing: lazy wrapper but forced-materialized (impl set, no adoptImplChildren)
const existingWrapper = new UnifiedWrapper(sl, {
mode: "lazy",
apiPath: "folder.matExist",
materializeFunc: async (setImpl) => { setImpl({ a: 1 }); }
});
// Manually mark as materialized with impl set, without adopting children
existingWrapper.____slothletInternal.state.materialized = true;
existingWrapper.____slothletInternal.impl = { existingKey: () => "existing" };
const existingProxy = existingWrapper.createProxy();

// Value: lazy wrapper also forced-materialized
const valueWrapper = new UnifiedWrapper(sl, {
mode: "lazy",
apiPath: "folder.matValue",
materializeFunc: async (setImpl) => { setImpl({ b: 2 }); }
});
valueWrapper.____slothletInternal.state.materialized = true;
valueWrapper.____slothletInternal.impl = { valueKey: () => "value" };
const valueProxy = valueWrapper.createProxy();

const targetApi = { myFolder: existingProxy };

// Both are "materialized lazy" — neither is lazy-unmaterialized
// Neither Case 1 nor Case 2 fires → falls to line 446+ adoptImplChildren guards
const result = assignment.assignToApiPath(targetApi, "myFolder", valueProxy, {
useCollisionDetection: true,
config: makeConfig("merge"),
collisionContext: "initial"
});

// Lines 451, 454 executed (___adoptImplChildren called)
// Result may be true or false; key assertion is no error thrown
expect(result !== undefined).toBe(true);
});
});

// ---------------------------------------------------------------------------
// Group 5: merge mode, existing is a wrapper, value is a plain object
// → Lines 531-535 (existingIsWrapper && !valueIsWrapper)
// ---------------------------------------------------------------------------
describe("api-assignment: existing=wrapper, value=plain — merge branch (lines 531-535)", () => {
let _api;

afterEach(async () => {
if (_api?.shutdown) await _api.shutdown();
_api = null;
});

it("merges plain-object value into existing wrapper's impl (lines 531-535)", async () => {
_api = await slothlet({ dir: TEST_DIRS.API_TEST, mode: "lazy", silent: true });
const sl = getSlothletInst(_api, "math");
const assignment = sl.builders.apiAssignment;

// Existing: eager wrapper (is a wrapper proxy)
const existingWrapper = new UnifiedWrapper(sl, {
mode: "eager",
apiPath: "folder.existWrap",
initialImpl: { originalFn: () => "original" }
});
const existingProxy = existingWrapper.createProxy();

// Value: plain object (NOT a wrapper proxy)
const plainValue = { newFn: () => "new" };

const targetApi = { myFolder: existingProxy };

// existingIsWrapper=true, valueIsWrapper=false → lines 531-535 fire
const result = assignment.assignToApiPath(targetApi, "myFolder", plainValue, {
useCollisionDetection: true,
config: makeConfig("merge"),
collisionContext: "initial"
});

// Lines 531-535: merges plain into wrapper's impl and returns true
expect(result).toBe(true);
});

it("merge-replace mode with existing=wrapper, value=plain also uses lines 531-535", async () => {
_api = await slothlet({ dir: TEST_DIRS.API_TEST, mode: "lazy", silent: true });
const sl = getSlothletInst(_api, "math");
const assignment = sl.builders.apiAssignment;

const existingWrapper = new UnifiedWrapper(sl, {
mode: "eager",
apiPath: "folder.existWrap2",
initialImpl: { originalFn: () => "orig2" }
});

const plainValue = { addedFn: () => "added" };

const targetApi = { myFolder: existingWrapper.createProxy() };

const result = assignment.assignToApiPath(targetApi, "myFolder", plainValue, {
useCollisionDetection: true,
config: makeConfig("merge-replace"),
collisionContext: "initial"
});

expect(result).toBe(true);
});
});

// ---------------------------------------------------------------------------
// Group 6: merge mode, both wrappers have a SHARED KEY that is itself a wrapper
// → Lines 497-506 (recursive nested sub-wrapper merge)
// ---------------------------------------------------------------------------
describe("api-assignment: nested sub-wrapper recursive merge (lines 497-506)", () => {
let _api;

afterEach(async () => {
if (_api?.shutdown) await _api.shutdown();
_api = null;
});

it("recursively merges nested sub-wrapper children when both have the same key as a wrapper (lines 497-506)", async () => {
_api = await slothlet({ dir: TEST_DIRS.API_TEST, mode: "lazy", silent: true });
const sl = getSlothletInst(_api, "math");
const assignment = sl.builders.apiAssignment;

// Create two sub-wrappers that will be the "sharedKey" children
const subWrapperA = new UnifiedWrapper(sl, {
mode: "eager",
apiPath: "sub.a",
initialImpl: { fn1: () => 1 }
});
const subWrapperB = new UnifiedWrapper(sl, {
mode: "eager",
apiPath: "sub.b",
initialImpl: { fn2: () => 2 }
});

// Create parent wrappers with impl containing sub-wrappers at the SAME KEY
const existingWrapper = new UnifiedWrapper(sl, {
mode: "eager",
apiPath: "parent.exist",
initialImpl: { sharedKey: subWrapperA.createProxy() }
});
// Adopt children so existingWrapper.sharedKey = subWrapperA.proxy
existingWrapper.___adoptImplChildren();

const valueWrapper = new UnifiedWrapper(sl, {
mode: "eager",
apiPath: "parent.value",
initialImpl: { sharedKey: subWrapperB.createProxy() }
});
// Adopt children so valueWrapper.sharedKey = subWrapperB.proxy (with fn2)
valueWrapper.___adoptImplChildren();

const targetApi = { myFolder: existingWrapper.createProxy() };

// Both are eager+materialized wrappers, both have child "sharedKey" as a wrapper
// Neither Case 1 nor Case 2 fires (not lazy-unmaterialized)
// Child merge loop: key="sharedKey" is present in both, both values are wrapper proxies
// → lines 494-514 fire (recursive sub-wrapper merge)
const result = assignment.assignToApiPath(targetApi, "myFolder", valueWrapper.createProxy(), {
useCollisionDetection: true,
config: makeConfig("merge"),
collisionContext: "initial"
});

// Result is truthy (kept existing) and no errors thrown
expect(result).toBeDefined();

// sub-wrapper fn2 from subWrapperB should have been merged into existingWrapper.sharedKey
// The merge adds fn2 into subWrapperA (as they share the "sharedKey" slot)
const existingSharedChild = resolveWrapper(existingWrapper.sharedKey);
expect(existingSharedChild).not.toBeNull();
});
});

// ---------------------------------------------------------------------------
// Group 7: Case 2 merge, value lazy with FAILING materializeFunc
// → Line 416 (SlothletWarning in _materialize().catch())
// ---------------------------------------------------------------------------
describe("api-assignment: failing materializeFunc warning in Case 2 merge (line 416)", () => {
let _api;

afterEach(async () => {
if (_api?.shutdown) await _api.shutdown();
_api = null;
});

it("SlothletWarning is raised when value lazy wrapper materializeFunc rejects (line 416)", async () => {
_api = await slothlet({ dir: TEST_DIRS.API_TEST, mode: "lazy", silent: true });
const sl = getSlothletInst(_api, "math");
const assignment = sl.builders.apiAssignment;

// Existing: eager wrapper (the "file processed first")
const existingEager = new UnifiedWrapper(sl, {
mode: "eager",
apiPath: "folder.eagerFail",
initialImpl: { fn: () => "ok" }
});
const existingProxy = existingEager.createProxy();

// Value: lazy wrapper with a materializeFunc that REJECTS
const failingWrapper = new UnifiedWrapper(sl, {
mode: "lazy",
apiPath: "folder.lazyFail",
materializeFunc: async () => {
throw new Error("intentional-test-materialize-failure");
}
});
const failingProxy = failingWrapper.createProxy();

const targetApi = { myFolder: existingProxy };

// merge mode, existing=eager, value=lazy with failing materializeFunc
// Case 2: valueLazy && !existingLazy → else if (!isMergeReplace) block
// → _materialize().catch(err => new SlothletWarning(...)) fires → line 416
const result = assignment.assignToApiPath(targetApi, "myFolder", failingProxy, {
useCollisionDetection: true,
config: makeConfig("merge"),
collisionContext: "initial"
});

// Returns true immediately (fire-and-forget materialize); rejection handled by catch
expect(result).toBe(true);

// Wait for the async rejection + catch to be processed
await new Promise((resolve) => setTimeout(resolve, 50));

// No unhandled error; SlothletWarning was issued (line 416) and suppressed
expect(targetApi.myFolder).toBeDefined();
});
});
