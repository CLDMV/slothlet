# Hot Reload Fix - Issues Checklist

**Date Created:** January 22, 2026  
**Status:** Investigation Phase

---

## Critical Issues Identified

### 1. ❌ apiPath Inconsistency with apiPathPrefix
**Issue:** When `buildAPI` is called with `apiPathPrefix="config"`, the returned structure shows:
```javascript
{
  main: <wrapper apiPath="config.main">,     // ✓ Has prefix
  config: <wrapper apiPath="config">         // ✗ Missing prefix! Should be "config.config"
}
```

**Expected:** If `apiPathPrefix="config"`, ALL paths should have that prefix:
```javascript
{
  main: <wrapper apiPath="config.main">,
  config: <wrapper apiPath="config.config">  // Should have full prefix
}
```

**Impact:** Path inconsistency breaks proper integration and merging logic.

**Investigation Status:** ✅ INVESTIGATED

**Root Cause:** 
`buildApiPath()` function in `modes.mjs` line 149 has anti-double-prefix logic:
```javascript
if (path === apiPathPrefix || path.startsWith(`${apiPathPrefix}.`)) {
    return path;  // Don't add prefix if already present
}
```

When processing `config/` subdirectory with `apiPathPrefix="config"`:
- `categoryName` = `"config"` (from folder name)
- `buildApiPath("config")` checks: `"config" === "config"` → TRUE
- Returns `"config"` unchanged (no prefix added)
- Result: `apiPath="config"` instead of `"config.config"`

**Why This Exists:** Prevents `"config.config.config..."` when recursing through nested folders.

**Is This Correct?** UNCLEAR - needs clarification:
- If we load `api_smart_flatten_folder_config/` as initial dir (no prefix), we get `{main, config}`
- If we load same folder WITH prefix `"config"`, should we get `{config.main, config.config}` or `{main, config}`?

**Fix Required:** Determine intended behavior, then either:
1. Keep current logic and fix integration to handle it
2. Change logic to always apply prefix, handle name collisions differently


---

### 2. ❌ Unused api_assignment.mjs Module
**Issue:** Created `src/lib/helpers/api_assignment.mjs` (entire new file) but only used in ONE location.

**Original Request:** Extract merge logic from `buildAPI`/`processFiles` to be reusable by both initial load and hot reload.

**What Was Done:** Created separate module with `assignToApiPath()` and `mergeApiObjects()` functions.

**Actual Usage:** Only `mergeApiObjects` is imported and used once in `hot_reload.mjs` line 355 `mutateApiValue()`.

**Problem:** 
- 364 lines added, 80 removed
- No closer to solving the core issue
- Merge logic still embedded in `processFiles()`
- Not achieving the stated goal

**Investigation Status:** ✅ INVESTIGATED

**Root Cause:**
Misunderstood the task. The goal was to extract the EXISTING merge logic from `processFiles()` so that:
1. `processFiles()` uses the extracted function during initial load
2. `hot_reload` uses the same extracted function during hot reload
3. Both paths guaranteed to behave identically

**What Actually Happened:**
1. Created NEW merge functions in separate file
2. Only hot reload uses the new function (line 355 in mutateApiValue)
3. `processFiles()` still has its own embedded merge logic
4. Two different code paths still exist

**Functions in api_assignment.mjs:**
- `assignToApiPath()` - NOT USED ANYWHERE
- `mergeApiObjects()` - Used once in hot_reload.mjs

**Fix Required:**
Option 1: Remove api_assignment.mjs entirely, use existing processFiles logic
Option 2: Extract ACTUAL logic from processFiles into api_assignment, have BOTH paths use it
Option 3: Keep minimal merge helper, but focus on fixing integration first


---

### 3. ❌ isRoot Always True Despite apiPathPrefix
**Issue:** When calling `processFiles`, we pass `apiPathPrefix` (not empty) AND `isRoot=true` at the same time.

**Location:** `src/lib/modes/eager.mjs` line 52

**Code:**
```javascript
await processFiles(
    api,
    structure.files,
    rootDirectory,
    ownership,
    contextManager,
    instanceID,
    config,
    0,
    "eager",
    true,        // ← isRoot=true
    true,        // ← recursive=true
    false,       // populateDirectly
    apiPathPrefix // ← Could be "config" or other non-empty value
);
```

**Question:** If `isRoot` is ALWAYS `true` in the initial call, why is it even a parameter?

**Impact:** Logic that depends on `isRoot` vs non-root context may be broken.

**Investigation Status:** ✅ INVESTIGATED

**Root Cause:**
`isRoot` controls **root contributor pattern detection**, not directory nesting level.

**What isRoot Does:**
- Line 206 in modes.mjs: `if (isRoot && typeof moduleContent === "function")` - detects root contributors
- Line 288: `if (!isRoot && moduleName === categoryName)` - enables flattening logic
- Line 552: `const localPath = isRoot ? propertyName : "${categoryName}.${propertyName}"` - path construction

**Why Both Can Be True:**
- `isRoot=true` means "detecting root contributors from THIS directory"
- `apiPathPrefix` means "prepend this to all generated paths"
- They control different concerns:
  - `isRoot`: Whether to look for root contributor pattern
  - `apiPathPrefix`: What namespace to put results under

**Is This Correct?** YES - Both can legitimately be set:
- Hot reload: `isRoot=true` (no root contributors in sub-add), `apiPathPrefix="config"` (results go under api.config)
- Initial load: `isRoot=true`, `apiPathPrefix=""` (results go at api root)

**Fix Required:** NONE - This is intentional design. Documentation should clarify the distinction.


---

### 4. ✅ FIXED - Cascading Eager Load in Lazy Materialization

**Original Analysis:**

When `createLazySubdirectoryWrapper` materializes a lazy wrapper, it calls `processFiles` with:
- `mode="eager"` - To eagerly load files in the accessed directory
- `recursive=true` - ⚠️ This causes cascading through subdirectories

**Code Location:** `src/lib/helpers/modes.mjs` line 867 (before fix)

**Problem Identified:**
The combination of `mode="eager"` + `recursive=true` causes cascading eager load:
1. User accesses `api.config` (lazy wrapper)
2. Materialization runs with `recursive=true`
3. Line 602: `if (recursive)` → TRUE → processes subdirectories recursively
4. Line 690: Recursively calls `processFiles` for EACH subdirectory with same `mode="eager"`, `recursive=true`
5. **Cascades down ENTIRE tree, defeating the purpose of lazy loading**

---

**User Confirmation:**

> "that is the point of lazy, we only materialize at each point of a path as we go through... so api.config.get() would only materialize everything in the config folder, any other folders would sit as lazy folders. then say we go down to api.config.get.services.shell() it would materialize config, then config.get, then config.get.services to be able to serve us the shell function."

**Expected Behavior:** Materialize ONE LEVEL at a time:
- `api.config` → Materialize files in `config/`, create lazy wrappers for `get/`, `service/`, etc.
- `api.config.get` → Materialize files in `config/get/`, create lazy wrappers for subdirectories
- `api.config.get.service.shell()` → Each level materializes only when accessed

---

**Fix Applied:**

Changed line 867 in `createLazySubdirectoryWrapper` from:
```javascript
true, // Recursive (materialize subdirectories for this wrapper)
```

To:
```javascript
false, // NOT recursive - create lazy wrappers for subdirectories, don't cascade eager load
```

**Result:**
- Files in current directory: Eagerly loaded during materialization ✓
- Subdirectories: Processed by `recursive=false` path (line 708) ✓
- Creates lazy wrappers for subdirectories (no cascading) ✓
- Each level materializes only when individually accessed ✓

---

**VALIDATION TEST RESULTS:**

Test: `tmp/test-lazy-cascade-fix.mjs`

**Test Methodology:**
1. Load API in lazy mode
2. Access `api.advanced.__type` to trigger materialization
3. Wait for materialization to complete
4. Access `api.advanced.nest` (subdirectory)
5. Check if `nest.__type` returns a symbol (lazy) vs string (materialized)

**Results:**
```
[DIRECTORY CHECK PASSED] Will check recursive flag: false
✓ Advanced materialized after 1 attempts
  _impl type: object
  _impl keys: []
  _childCache size: 5

nest wrapper mode: lazy
nest wrapper materialized: false
nest wrapper inFlight: false
nest.__type: Symbol(inFlight)
Is __type a symbol? true

✅ PASS: Subdirectory remained lazy after parent materialized!
```

**Key Findings:**
- Subdirectories stored in `_childCache` (size: 5), not eagerly in `_impl` ✓
- `nest` is a proper UnifiedWrapper in lazy mode ✓
- `nest.__type` returns `Symbol(inFlight)` (not materialized) ✓
- Each subdirectory materializes only when directly accessed ✓

**STATUS: ✅ VALIDATED - Fix is working correctly**

**Testing Status:** 
- ✅ Code change applied successfully (line 867 changed from `true` to `false`)
- ✅ Module loads without syntax errors
- ❌ Initial test was baseless - used `typeof` which always returns `"function"` in lazy mode
- ⚠️ **Proper testing required:** Should use `.__type` property to check materialization state
  - `UNMATERIALIZED` symbol = not loaded yet
  - `IN_FLIGHT` symbol = loading in progress  
  - `"object"/"function"` = materialized
- See: `docs/v3/changelog/type-property.md` and `docs/v3/changelog/typeof-always-function-lazy-mode.md`

**Conclusion:** ✅ FIXED - Code change is correct (recursive=false prevents cascading). Testing methodology was flawed but fix is valid based on code analysis.


---

### 5. ❌ Code Bloat Without Progress
**Issue:** Significant code growth without solving the core problem.

**Stats:**
- Debug logging added: ~50+ lines
- api_assignment.mjs created: ~160 lines
- Modifications to existing files: ~150+ lines
- Total added: 364 lines
- Total removed: 80 lines
- **Net change: +284 lines**

**Core Problem Status:** Integration of `buildAPI` result into existing API still broken.

**Investigation Status:** ✅ ACKNOWLEDGED

**Root Cause:** Approached problem by adding new code instead of understanding and fixing existing flow.

**Fix Required:** 
- Remove unnecessary debug logging
- Evaluate if api_assignment.mjs should be kept or removed
- Focus on minimal changes to fix actual integration logic


---

### 6. ❌ buildAPI Integration Not Properly Recursive
**Issue:** `addApiComponent` extracts only `finalKey` from `buildAPI` result, discarding siblings.

**Example:**
```javascript
// buildAPI returns:
{
  main: <wrapper>,
  config: <wrapper>
}

// Current extraction:
apiToMerge = newApi["config"];  // Only extracts config, loses main!
```

**Expected:** ALL top-level keys should be merged as children of the target location.

**Investigation Status:** ✅ KNOWN ISSUE (documented in INITIAL-VS-HOTRELOAD-PATHS.md)

**Root Cause:** Single-key extraction logic doesn't handle multi-key results.

**Fix Required:** Implement recursive integration that walks entire `buildAPI` result and merges all keys.


---

## Investigation Plan

1. **Phase 1: Understand Current State**
   - [x] Find all locations where `apiPathPrefix` is used
   - [x] Trace how `buildApiPath()` handles prefixes
   - [x] Document why category wrapper has `apiPath="config"` not `"config.config"`
   - [x] Find `createLazySubdirectoryWrapper` mode parameter usage

2. **Phase 2: Analyze Issues**
   - [x] Determine if `isRoot=true` + `apiPathPrefix` is intentional or bug (INTENTIONAL)
   - [x] Evaluate if api_assignment.mjs serves its intended purpose (NO - misunderstood task)
   - [x] Review all added debug logging and mark for removal
   - [x] Check if initial load would produce correct paths without prefix

3. **Phase 3: Design Fix**
   - [ ] Define correct behavior for `apiPath` with prefixes
   - [ ] Design proper integration logic for `addApiComponent`
   - [ ] Determine if/how to use api_assignment.mjs functions (LIKELY REMOVE)
   - [ ] Plan minimal changes to fix integration

4. **Phase 4: Implementation**
   - [ ] Fix apiPath prefix handling OR accept current behavior and document
   - [ ] Implement recursive integration in `addApiComponent`
   - [ ] Clean up debug logging
   - [ ] Test with smart-flattening suite

5. **Phase 5: Cleanup**
   - [ ] Remove or properly integrate api_assignment.mjs (LIKELY REMOVE)
   - [ ] Remove temporary debug scripts
   - [ ] Update documentation with final solution


---

## Key Findings Summary

### Issues That Are Actually Problems
1. ✅ **recursive=false bug** - FIXED in eager.mjs line 52
2. ❌ **Integration logic incomplete** - Only extracts finalKey, loses siblings
3. ❌ **api_assignment.mjs unused** - Should be removed or properly integrated

### Issues That Are By Design
1. ✅ **isRoot + apiPathPrefix** - Both serve different purposes, correct as-is
2. ✅ **"eager" in lazy materialization** - Lazy at boundaries, eager within - correct pattern
3. ⚠️ **apiPath prefix logic** - Anti-double-prefix may be correct, needs clarification

### Core Problem Remains
**buildAPI returns structure with multiple keys, but integration only uses one key, discarding the rest.**

Example:
```javascript
// buildAPI with apiPathPrefix="config" returns:
{
  main: <wrapper apiPath="config.main">,
  config: <wrapper apiPath="config">
}

// addApiComponent extracts only config:
apiToMerge = newApi["config"];  // main is lost!

// Should instead merge BOTH as children:
api.config.main = newApi.main;
api.config[...children from newApi.config...]
```


---

## Reference Documentation

**Existing Analysis Files:**
- `docs/v3/HOT-RELOAD-FLATTENING-ISSUE.md` - Original flattening bug analysis
- `docs/v3/HOT-RELOAD-MERGE-DUPLICATION.md` - Duplicate merge logic issue
- `docs/v3/INITIAL-VS-HOTRELOAD-PATHS.md` - Path comparison and recursive bug fix

**Key Files Involved:**
- `src/lib/modes/eager.mjs` - Calls processFiles with isRoot=true
- `src/lib/helpers/modes.mjs` - Main file processing logic
- `src/lib/helpers/hot_reload.mjs` - addApiComponent integration logic
- `src/lib/helpers/api_assignment.mjs` - Unused merge extraction (REVIEW NEEDED)
- `src/lib/handlers/unified-wrapper.mjs` - Wrapper class implementation


---

## Next Steps

1. ✅ Create this checklist
2. ✅ Investigate each issue systematically  
3. ✅ Update checklist with findings
4. 🔄 **CURRENT:** Design proper fix based on understanding
5. ⏳ Implement minimal fix
6. ⏳ Test and validate
7. ⏳ Clean up temporary code

---

## Recommended Action Plan

### Immediate Priority: Fix Integration Logic

The core issue is in `hot_reload.mjs` `addApiComponent` function (lines 630-670). Current logic:

```javascript
// Current (BROKEN):
const finalKey = normalizedPath.split(".").pop();
if (newApi[finalKey] !== undefined) {
    apiToMerge = newApi[finalKey];  // Only extracts ONE key
}
mutateApiValue(api[finalKey], apiToMerge, ...);  // Merges only that one
```

**Problem:** When `buildAPI` returns `{main: ..., config: ...}`, only `config` is extracted and merged. `main` is discarded.

**Solution:** Iterate ALL keys from `buildAPI` result and integrate each:

```javascript
// Proposed fix:
for (const [key, value] of Object.entries(newApi)) {
    // Each key is a child that should go under api[finalKey]
    // api.config.main = newApi.main
    // api.config.getNestedConfig = newApi.config.getNestedConfig (flatten)
    await mutateApiValue(
        api[finalKey][key],  // Target location
        value,               // Source value
        options
    );
}
```

### Secondary Priority: Cleanup

1. Remove extensive debug logging from modes.mjs
2. Evaluate api_assignment.mjs:
   - If not needed for integration fix, remove entirely
   - If helpful, keep minimal merge utility
3. Remove tmp-debug-*.mjs test scripts after validation
4. Update documentation with correct flow

### Documentation Needed

1. Clarify `isRoot` vs `apiPathPrefix` distinction in code comments
2. Document lazy-at-boundaries materialization pattern
3. Explain anti-double-prefix logic in `buildApiPath()`
4. Update HOT-RELOAD docs with final solution
