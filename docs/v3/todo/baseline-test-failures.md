# Baseline Test Failures - V3 Unified Wrapper Integration

**Date:** January 31, 2026  
**Context:** After fixing v3 lazy mode performance and metadata system  
**Status:** 136 failures out of 2356 tests (136 failed | 2220 passed)

---

## ✅ Fixed Issues

- [x] V3 lazy mode performance (recursive=false fix)
- [x] Lazy subdirectory wrapper filePath (null → dir.path)
- [x] User metadata lookup for nested paths (176/176 tests passing)
- [x] System metadata tagging via lifecycle events
- [x] Spread nested metadata key to root level

---

## 🔴 Critical Issues (Must Fix)

### 1. API Removal Not Working (32 failures)

**Files Affected:**
- `tests/vitests/suites/ownership/module-ownership-removal.test.vitest.mjs` (32/72 failed)

**Symptoms:**
```javascript
await api.slothlet.api.remove("test.module");
expect(api.test?.module).toBeUndefined(); // FAILS - still exists
```

**Root Cause Analysis:**
- [ ] Container wrappers created in `ensureParentPath()` may not be tracked properly
- [ ] `deletePath()` in api-manager.mjs may not handle UnifiedWrapper proxies
- [ ] Lifecycle events for removal (`impl:removed`) may not be firing
- [ ] Child paths inside wrappers not being cleaned up recursively

**Investigation Steps:**
1. [ ] Check if `deletePath()` handles `wrapper.__wrapper` targets
2. [ ] Verify lifecycle event `impl:removed` fires for all wrappers
3. [ ] Check if ownership.removePath() works with wrapper moduleIds
4. [ ] Trace actual deletion path: api.remove() → deletePath() → delete operator

**Expected Fix Location:**
- `src/lib/handlers/api-manager.mjs` - deletePath() method
- `src/lib/handlers/ownership.mjs` - removePath() method
- Container wrapper tracking/cleanup logic

---

### 2. Metadata Not Cleaned Up on Removal (32 failures)

**Files Affected:**
- `tests/vitests/suites/metadata/metadata-collision-modes.test.vitest.mjs` (32/96 failed)
- `tests/vitests/suites/metadata/metadata-api-manager.test.vitest.mjs` (24/96 failed)

**Symptoms:**
```javascript
await api.slothlet.api.remove("partial.config");
const meta = api.partial.config.__metadata; // FAILS - still exists
```

**Root Cause Analysis:**
- [ ] Metadata handler not subscribed to `impl:removed` lifecycle event
- [ ] User metadata store (#userMetadataStore Map) not cleaned up
- [ ] System metadata (WeakMap) persists because wrapper still referenced
- [ ] Partial path removal not cascading to child metadata

**Investigation Steps:**
1. [ ] Check if metadata.mjs subscribes to `impl:removed` events
2. [ ] Add cleanup method to remove user metadata by apiPath
3. [ ] Verify child metadata cleaned up when parent removed
4. [ ] Test: remove parent, check if child metadata gone

**Expected Fix Location:**
- `src/lib/handlers/metadata.mjs` - Add lifecycle subscription for removal
- `src/slothlet.mjs` - Subscribe to impl:removed and call metadata cleanup

---

### 3. Collision Mode Metadata Pollution (24 failures)

**Files Affected:**
- `tests/vitests/suites/metadata/metadata-collision-modes.test.vitest.mjs` (skip/warn/error modes)

**Symptoms:**
```javascript
// Skip mode should preserve original metadata
expect(currentMeta.conflictingMetadata).toBeUndefined(); // FAILS - exists as `true`
```

**Root Cause Analysis:**
- [ ] Collision detection adding `conflictingMetadata: true` flag
- [ ] Skip/warn modes should NOT modify existing metadata
- [ ] Metadata merging happening when it shouldn't (preserve, not merge)

**Investigation Steps:**
1. [ ] Find where `conflictingMetadata` flag is set
2. [ ] Check collision mode handling in setValueAtPath()
3. [ ] Verify metadata.registerUserMetadata() respects collision modes
4. [ ] Ensure skip/warn modes don't call registerUserMetadata()

**Expected Fix Location:**
- `src/lib/handlers/api-manager.mjs` - setValueAtPath() collision handling
- Metadata registration should be conditional on collision mode

---

## 🟡 Medium Priority Issues

### 4. Lazy Mode File Path Issues (8 failures)

**Files Affected:**
- `tests/vitests/suites/metadata/metadata-collision-modes.test.vitest.mjs` (4 failures)

**Symptoms:**
```javascript
// Expected: /path/to/math.mjs
// Actual: /path/to/math (directory path)
expect(powerMeta.filePath).toMatch(/[/\\]math\.mjs$/); // FAILS
```

**Root Cause Analysis:**
- [ ] Lazy wrapper created with `filePath: dir.path` (directory, not file)
- [ ] Collision between file (math.mjs) and folder (math/) in lazy mode
- [ ] Replace mode merging both instead of choosing one
- [ ] Subdirectory wrapper filePath should be null until materialized?

**Investigation Steps:**
1. [ ] Check modes-processor.mjs line 1196 - is dir.path correct?
2. [ ] Should lazy subdirectory wrappers set filePath during materialization?
3. [ ] How does collision detection work when file+folder have same name?
4. [ ] Review api_test_collisions test structure

**Expected Fix Location:**
- `src/lib/builders/modes-processor.mjs` - createLazySubdirectoryWrapper()
- May need to defer filePath assignment until materialization

---

### 5. API Removal Ownership Issues (4 failures)

**Files Affected:**
- `tests/vitests/suites/addapi/add-api.test.vitest.mjs` (4/56 failed)

**Symptoms:**
```javascript
[slothlet] Lifecycle event handler error (impl:changed):
[OWNERSHIP_INVALID_MODULE_ID] SlothletError
Details: moduleId: null
```

**Root Cause Analysis:**
- [ ] Container wrappers created with moduleId=null
- [ ] Lifecycle event `impl:changed` fired with null moduleId
- [ ] Ownership manager rejecting null moduleId
- [ ] ensureParentPath() not passing moduleId to container wrappers

**Investigation Steps:**
1. [ ] Check ensureParentPath() - does it pass moduleId to UnifiedWrapper?
2. [ ] Should container wrappers inherit parent moduleId?
3. [ ] Check lifecycle subscription in slothlet.mjs line 219
4. [ ] Make moduleId optional in ownership.register()?

**Expected Fix Location:**
- `src/lib/handlers/api-manager.mjs` - ensureParentPath() line 228
- Already passes moduleId to UnifiedWrapper, but might be undefined
- Need to ensure moduleId is always set for containers

---

## 🟢 Low Priority Issues

### 6. CJS Default Export Issues (24 failures)

**Files Affected:**
- `tests/vitests/suites/cjs/cjs-default-exports.test.vitest.mjs` (24/64 failed)

**Symptoms:**
```javascript
Error: explicitDefault.default.hasAttribute - cannot access hasAttribute of undefined
at Object.apply src/lib/handlers/unified-wrapper.mjs:649:13
```

**Root Cause Analysis:**
- [ ] Lazy mode not handling default exports correctly
- [ ] Double-default pattern: explicitDefault.default
- [ ] Property chain resolution breaking on undefined
- [ ] Waiting proxy returning undefined for nested properties

**Investigation Steps:**
1. [ ] Check unified-wrapper.mjs line 649 - property chain traversal
2. [ ] Review CJS export structure in test files
3. [ ] Test if eager mode has same issue
4. [ ] Check if background materialization affects this

**Expected Fix Location:**
- `src/lib/handlers/unified-wrapper.mjs` - property chain resolution
- May need better undefined handling in waiting proxy

---

### 7. Type Checks Failing (8 failures)

**Files Affected:**
- `tests/vitests/processed/api/api-sanitize.test.vitest.mjs` (4/104 failed)
- `tests/vitests/suites/hooks/hooks-debug.test.vitest.mjs` (2/24 failed)
- `tests/vitests/suites/metadata/system-metadata.test.vitest.mjs` (4/184 failed)

**Symptoms:**
```javascript
expect(typeof api.math).toBe("object"); // FAILS - got "function"
expect(typeof api.string).toBe("object"); // FAILS - got "function"
```

**Root Cause Analysis:**
- [ ] Lazy wrappers may be callable functions instead of objects
- [ ] Folder/folder.mjs pattern creating callable namespaces
- [ ] Tests expect object, but wrapper is callable function with properties
- [ ] This might be intentional behavior (hybrid callable objects)

**Investigation Steps:**
1. [ ] Check if math/math.mjs creates callable namespace
2. [ ] Review folder flattening logic
3. [ ] Verify if this is expected behavior change in v3
4. [ ] Update tests if behavior is correct

**Expected Fix Location:**
- May be test expectation issue, not code issue
- Or: modes-processor.mjs folder/folder.mjs handling

---

### 8. Array Access on Objects (2 failures)

**Files Affected:**
- `tests/vitests/suites/proxies/proxy-baseline.test.vitest.mjs` (2/53 failed)

**Symptoms:**
```javascript
Error: devices.lg.0 is not a function
at Object.apply src/lib/handlers/unified-wrapper.mjs:694:11
```

**Root Cause Analysis:**
- [ ] Numeric property access (array index) not handled
- [ ] Lazy wrapper treating "0" as function call
- [ ] Property chain resolution failing on numeric keys

**Investigation Steps:**
1. [ ] Check if devices.lg is an array
2. [ ] How should numeric properties be handled?
3. [ ] Is this a regression or new behavior?

**Expected Fix Location:**
- `src/lib/handlers/unified-wrapper.mjs` - numeric property handling

---

### 9. Mixed Exports (4 failures)

**Files Affected:**
- `tests/vitests/suites/metadata/metadata-edge-cases.test.vitest.mjs` (4/112 failed)

**Symptoms:**
```javascript
Error: mixed.addapi is not a function
at Object.apply src/lib/handlers/unified-wrapper.mjs:694:11
```

**Root Cause Analysis:**
- [ ] Mixed export structure not materializing correctly
- [ ] Function not detected in lazy wrapper
- [ ] Property resolution failing

**Investigation Steps:**
1. [ ] Check mixed export structure in test files
2. [ ] Verify materialization logic for mixed exports
3. [ ] Compare eager vs lazy behavior

**Expected Fix Location:**
- `src/lib/builders/modes-processor.mjs` - mixed export handling

---

### 10. Collision Config Replace Mode (4 failures)

**Files Affected:**
- `tests/vitests/suites/config/collision-config.test.vitest.mjs` (4/160 failed)

**Symptoms:**
```javascript
expect(await originalAdd(1, 2)).toBe(1003); // FAILS - got undefined
```

**Root Cause Analysis:**
- [ ] Replace mode not updating wrapper implementation
- [ ] Original reference not updated after replacement
- [ ] Wrapper state inconsistency

**Investigation Steps:**
1. [ ] Check setValueAtPath() replace mode logic
2. [ ] Verify wrapper.__setImpl() called correctly
3. [ ] Test if syncWrapper() is working

**Expected Fix Location:**
- `src/lib/handlers/api-manager.mjs` - replace mode handling

---

## 📋 Checklist: Fix Order

Priority order based on impact and dependencies:

1. **[CRITICAL]** Fix API Removal (32 failures)
   - [ ] Investigate deletePath() wrapper handling
   - [ ] Fix lifecycle event propagation for removal
   - [ ] Test partial path removal
   - [ ] Test moduleId removal
   - [ ] Verify ownership cleanup

2. **[CRITICAL]** Fix Metadata Cleanup on Removal (32 failures)
   - [ ] Subscribe to impl:removed lifecycle event
   - [ ] Add metadata cleanup methods
   - [ ] Test cascade cleanup for nested paths
   - [ ] Verify user metadata store cleaned up

3. **[CRITICAL]** Fix Collision Mode Metadata Pollution (24 failures)
   - [ ] Find conflictingMetadata flag source
   - [ ] Prevent metadata registration in skip/warn modes
   - [ ] Test all collision modes separately
   - [ ] Verify original metadata preserved

4. **[MEDIUM]** Fix Ownership ModuleId Issues (4 failures)
   - [ ] Ensure container wrappers have valid moduleId
   - [ ] Make ownership.register() handle null gracefully
   - [ ] Test container creation with moduleId

5. **[MEDIUM]** Fix Lazy Mode File Path Issues (8 failures)
   - [ ] Review lazy subdirectory wrapper filePath assignment
   - [ ] Test collision detection with same-name file/folder
   - [ ] Decide: defer filePath or use file path?

6. **[LOW]** Fix CJS Default Export Issues (24 failures)
   - [ ] Review property chain resolution
   - [ ] Add undefined handling in waiting proxy
   - [ ] Test double-default pattern

7. **[LOW]** Fix Type Check Issues (8 failures)
   - [ ] Verify if callable objects are expected
   - [ ] Update tests or fix folder/folder.mjs handling

8. **[LOW]** Fix Array Access (2 failures)
   - [ ] Add numeric property handling

9. **[LOW]** Fix Mixed Exports (4 failures)
   - [ ] Review mixed export materialization

10. **[LOW]** Fix Collision Replace Mode (4 failures)
    - [ ] Test wrapper.__setImpl() in replace mode

---

## 🔍 Investigation Notes

### Container Wrapper Tracking

**Question:** Are container wrappers created by ensureParentPath() tracked correctly?

**Code Locations:**
- `src/lib/handlers/api-manager.mjs` line 228: Creates UnifiedWrapper for containers
- Container creation: `new UnifiedWrapper(this.slothlet, { mode, apiPath, moduleId, sourceFolder })`
- Sets impl: `containerWrapper.__setImpl({})`

**Potential Issues:**
1. Container moduleId might be undefined (not passed through)
2. Container filePath is not set (should it be?)
3. Lifecycle events fire but ownership registration fails with null moduleId
4. Removal doesn't handle nested wrappers recursively

### Metadata System Architecture

**Current Flow:**
1. File loaded → UnifiedWrapper created → lifecycle.emit("impl:created")
2. slothlet.mjs subscribes → calls metadata.tagSystemMetadata()
3. User metadata registered separately via metadata.registerUserMetadata()
4. Lookup combines system + user metadata in getMetadata()

**Missing Cleanup Flow:**
1. api.remove() called → deletePath() → delete operator
2. ❌ NO lifecycle.emit("impl:removed") currently
3. ❌ Metadata never cleaned up
4. ❌ User metadata store persists

**Required Changes:**
- Add `impl:removed` lifecycle event emission in deletePath()
- Subscribe to removal events in slothlet.mjs
- Add metadata cleanup method: removeUserMetadataByApiPath()
- Clean up system metadata WeakMap (auto if wrapper GC'd)

---

## 📊 Test Execution Stats

```
Test Files  11 failed | 23 passed (34)
Tests       136 failed | 2220 passed (2356)
Duration    72.33s (tests 261.60s)
Heap        max 600 MB | avg 213 MB

Failed Test Files:
  ❌ suites/addapi/add-api.test.vitest.mjs (4 failed, 52 passed)
  ❌ suites/cjs/cjs-default-exports.test.vitest.mjs (24 failed, 40 passed)
  ❌ processed/api/api-sanitize.test.vitest.mjs (4 failed, 100 passed)
  ❌ suites/hooks/hooks-debug.test.vitest.mjs (2 failed, 22 passed)
  ❌ suites/config/collision-config.test.vitest.mjs (4 failed, 156 passed)
  ❌ suites/metadata/metadata-collision-modes.test.vitest.mjs (32 failed, 64 passed)
  ❌ suites/metadata/metadata-api-manager.test.vitest.mjs (24 failed, 72 passed)
  ❌ suites/metadata/metadata-edge-cases.test.vitest.mjs (4 failed, 108 passed)
  ❌ suites/ownership/module-ownership-removal.test.vitest.mjs (32 failed, 40 passed)
  ❌ suites/metadata/system-metadata.test.vitest.mjs (4 failed, 180 passed)
  ❌ suites/proxies/proxy-baseline.test.vitest.mjs (2 failed, 51 passed)
```

---

## 🎯 Success Criteria

All baseline tests must pass:
- ✅ 0 failures in baseline test suite
- ✅ All 2356 tests passing
- ✅ No regressions in user-metadata tests (176/176 still passing)
- ✅ npm run debug passes (854 paths checked)
- ✅ Performance maintained (lazy mode ~7.92ms startup)
