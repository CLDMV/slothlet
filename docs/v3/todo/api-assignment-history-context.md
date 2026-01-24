# API Assignment Module - Design History and Context

**Created:** January 23, 2026  
**Module:** `src/lib/helpers/api_assignment.mjs` (to be moved to `builders/api-assignment.mjs`)  
**Status:** Current implementation working, planned for class-based refactor

## ⚠️ CRITICAL: Testing Instructions (READ THIS FIRST)

### How to Run Tests Properly

**Always use PowerShell to tail the last 40 lines of output:**

```powershell
# See the END of the test where results are reported
npm run debug 2>&1 | Select-Object -Last 40
npm run testv3 -- collision-config.test.vitest.mjs 2>&1 | Select-Object -Last 40
```

**Why this matters:**
- ❌ **WRONG:** Running without tailing shows the START of output, not the results
- ✅ **CORRECT:** Tailing last 40 lines shows the RESULTS at the end

### Two Critical Tests

**1. `npm run testv3 -- collision-config.test.vitest.mjs`**

Tests collision handling configuration, which heavily uses `api_assignment.mjs` logic.

**Must pass at all times.** If this breaks, the assignment logic is broken.

**2. `npm run debug`**

Validates complete API structure across 91 test paths in both lazy and eager modes.

**Expected output (acceptable):**
```
🔍 Nested differences:
  - [differingFunction] exportDefault.extra
  - [differingFunction] __slothletInstance.api.exportDefault.extra
  - [differingFunction] __slothletInstance.boundApi.exportDefault.extra
```

These 3 differences are expected and acceptable. Any OTHER differences indicate broken functionality.

**🎉 BONUS OPPORTUNITY:** If during your refactor these 3 differences disappear and `npm run debug` shows **ZERO errors**, commit immediately with:
```bash
git commit -m "fix: resolve exportDefault.extra function differences - ZERO errors achieved"
```

This would be a significant achievement and should be preserved as a separate commit!

### When to Test

**After file move**: Immediately run both tests

**After import updates**: Run both tests for each file updated

**After class conversion**: Run both tests

**After each commit**: Run both tests to ensure commit is clean

**Before final commit**: Run `npm run precommit` (includes both tests plus full validation)

### What to Do When Tests Fail

1. **DO NOT continue** to next step
2. Read error message carefully
3. Check if import paths are correct
4. Check if assignment logic was changed unintentionally
5. Use `git diff` to see what changed
6. Fix the issue
7. Re-run tests
8. Only proceed when both tests pass

---

## Why This Module Exists

The `api_assignment.mjs` module was created to solve a critical code duplication and consistency problem between two distinct API building operations:

1. **Initial API load** (`buildAPI` in `builders/builder.mjs`)
2. **Runtime API extension** (`addApiComponent` in `helpers/hot_reload.mjs`)

Both operations needed identical logic for:
- Assigning values to API paths
- Handling collision detection
- Merging wrapper proxies
- Preserving UnifiedWrapper references
- Managing property overwrites

## The Problem

### Before api_assignment.mjs

**Initial implementation had duplicated logic:**

```javascript
// In builders/builder.mjs (processFiles)
if (existing !== undefined && isWrapperProxy(existing) && isWrapperProxy(value)) {
    if (mutateExisting && syncWrapper) {
        syncWrapper(existing, value);
        return true;
    }
}

if (existing !== undefined && !allowOverwrite) {
    return false;
}

if (useCollisionDetection && safeAssign && config) {
    if (safeAssign(targetApi, key, value, config)) {
        targetApi[key] = value;
        return true;
    }
    return false;
}

targetApi[key] = value;
```

**And nearly identical logic in hot_reload.mjs (mutateApiValue):**

```javascript
// In helpers/hot_reload.mjs (mutateApiValue)
if (isWrapperProxy(existingValue) && isWrapperProxy(nextValue)) {
    await syncWrapper(existingValue, nextValue);
    return;
}

// Use unified merge logic for objects
if (existingValue && typeof existingValue === "object" && 
    nextValue && typeof nextValue === "object") {
    await mergeApiObjects(existingValue, nextValue, {
        removeMissing: options.removeMissing,
        mutateExisting: true,
        allowOverwrite: true,
        syncWrapper
    });
    return;
}
```

### The Critical Issue

When hot reload was implemented, we discovered:

1. **Logic divergence**: Initial load and hot reload had similar but slightly different assignment patterns
2. **Bug risk**: Fixing a bug in one place didn't fix it in the other
3. **Inconsistent behavior**: Same operations (like wrapper merging) behaved differently depending on context
4. **Testing burden**: Had to test identical logic in two separate code paths

**Specific example that triggered the refactor:**

During hot reload testing, we found that wrapper proxy syncing worked correctly during initial load but failed during `addApiComponent`. The root cause was that the wrapper syncing logic in `hot_reload.mjs` didn't properly handle the `_childCache` transfer pattern that was working in the initial build.

## The Solution: api_assignment.mjs

Created a **single source of truth** for API assignment operations:

### Core Functions

#### 1. `assignToApiPath(targetApi, key, value, options)`

**Purpose:** Handle all property assignment patterns consistently

**Handles:**
- Wrapper proxy syncing (when both existing and new are wrappers)
- Collision detection (via `safeAssign`)
- Overwrite control (`allowOverwrite`, `mutateExisting`)
- Direct assignment fallback

**Used by:**
- `processFiles` during initial API build
- `addApiComponent` during hot reload
- `mergeApiObjects` during recursive merges

```javascript
export function assignToApiPath(targetApi, key, value, options = {}) {
    const {
        allowOverwrite = false,
        mutateExisting = false,
        useCollisionDetection = false,
        config = null,
        syncWrapper = null,
        safeAssign = null
    } = options;

    // Case 1: Both are wrapper proxies - sync them if mutateExisting is true
    if (existing !== undefined && isWrapperProxy(existing) && isWrapperProxy(value)) {
        if (mutateExisting && syncWrapper) {
            syncWrapper(existing, value);
            return true;
        }
    }

    // Case 2: Existing value present but overwrite not allowed
    if (existing !== undefined && !allowOverwrite && !mutateExisting) {
        return false; // Assignment blocked
    }

    // Case 3: Use collision detection (safeAssign)
    if (useCollisionDetection && safeAssign && config) {
        if (safeAssign(targetApi, key, value, config)) {
            targetApi[key] = value;
            return true;
        }
        return false; // Collision detected
    }

    // Case 4: Direct assignment
    targetApi[key] = value;
    return true;
}
```

#### 2. `mergeApiObjects(targetApi, sourceApi, options)`

**Purpose:** Recursively merge source object into target using consistent assignment logic

**Handles:**
- Recursive property traversal
- Wrapper vs plain object detection
- Removal of missing keys (`removeMissing` option)
- Delegation to `assignToApiPath` for all assignments

**Critical for:**
- Hot reload wrapper syncing
- Multi-layer API merging
- Preserving nested wrapper references

```javascript
export async function mergeApiObjects(targetApi, sourceApi, options = {}) {
    const config = options.config;
    if (config?.debug?.api) {
        console.log(`[mergeApiObjects ENTRY] sourceApi keys:`, Object.keys(sourceApi));
    }

    const { removeMissing = false, ...assignOptions } = options;

    // Merge source keys into target
    const sourceKeys = new Set(Object.keys(sourceApi));
    for (const key of sourceKeys) {
        const sourceValue = sourceApi[key];
        const targetValue = targetApi[key];

        // If both are plain objects (not wrappers), recurse
        if (targetValue && typeof targetValue === "object" && !isWrapperProxy(targetValue) &&
            sourceValue && typeof sourceValue === "object" && !isWrapperProxy(sourceValue)) {
            await mergeApiObjects(targetValue, sourceValue, options);
        } else {
            // Use unified assignment logic
            assignToApiPath(targetApi, key, sourceValue, assignOptions);
        }
    }

    // Remove keys from target that don't exist in source
    if (removeMissing) {
        for (const key of Object.keys(targetApi)) {
            if (!sourceKeys.has(key)) {
                delete targetApi[key];
            }
        }
    }
}
```

## Usage Patterns

### Pattern 1: Initial API Build (processFiles)

```javascript
// In builders/builder.mjs - processFiles function
import { assignToApiPath } from "@cldmv/slothlet/helpers/api_assignment";

// During module processing
assignToApiPath(targetApi, key, wrapperProxy, {
    allowOverwrite: false,
    mutateExisting: false,
    useCollisionDetection: true,
    config,
    safeAssign
});
```

### Pattern 2: Hot Reload (addApiComponent)

```javascript
// In helpers/hot_reload.mjs - mutateApiValue function
import { mergeApiObjects } from "@cldmv/slothlet/helpers/api_assignment";

// When syncing wrappers
if (isWrapperProxy(existingValue) && !isWrapperProxy(nextValue)) {
    await mergeApiObjects(existingValue, nextValue, {
        removeMissing: false,
        mutateExisting: true,
        allowOverwrite: true,
        syncWrapper
    });
}
```

### Pattern 3: Direct Merge (hot reload wrapper sync)

```javascript
// In hot_reload.mjs - when existing is wrapper but next is plain object
await mergeApiObjects(existingValue, nextValue, {
    removeMissing: options.removeMissing,
    mutateExisting: true,
    allowOverwrite: true,
    syncWrapper,
    config
});
```

## Design Decisions

### 1. Why Not Import in Both Directions?

**Question:** Why not have `hot_reload.mjs` import from `builder.mjs` directly?

**Answer:** 
- `builder.mjs` and `hot_reload.mjs` serve different purposes
- Creating a third module (`api_assignment.mjs`) avoids circular dependencies
- Allows both modules to evolve independently
- Clear separation of concerns: assignment logic is neither "building" nor "hot reloading"

### 2. Why Separate assignToApiPath and mergeApiObjects?

**assignToApiPath:**
- Single property assignment
- Used for one-off property writes
- No recursion
- Simple boolean return (success/failure)

**mergeApiObjects:**
- Recursive object merging
- Used for deep object synchronization
- Handles nested structures
- Delegates to assignToApiPath for leaf assignments

This separation allows:
- Reusing assignment logic at any depth
- Testing assignment patterns independently
- Different collision handling at different levels

### 3. Why Pass syncWrapper as a Function?

```javascript
assignToApiPath(target, key, value, {
    syncWrapper  // Function reference passed
});
```

**Reasons:**
- `syncWrapper` is defined in `hot_reload.mjs` (has closure over hotReloadState)
- Passing as parameter avoids circular dependency
- Allows different sync strategies in different contexts
- Maintains flexibility for future sync implementations

### 4. Why Async mergeApiObjects but Sync assignToApiPath?

**assignToApiPath:** Synchronous
- Single property write (sync operation)
- Collision detection is sync
- Direct object mutation is sync

**mergeApiObjects:** Async
- Recursive traversal may hit many properties
- Calls syncWrapper which may be async (materialization)
- Future-proof for async collision handling
- Consistent with other Slothlet async patterns

## Bug Fixes Enabled by This Module

### Bug 1: Lost Child Wrappers During Hot Reload

**Problem:** When reloading a wrapper, child wrappers were not transferred

**Root cause:** Different merge logic in hot_reload vs initial build

**Fix:** Unified `mergeApiObjects` ensures `_childCache` transfer happens consistently

```javascript
// Now both initial load and hot reload use same logic
await mergeApiObjects(existingWrapper, newWrapper, {
    syncWrapper  // Properly transfers _childCache
});
```

### Bug 2: Inconsistent Collision Handling

**Problem:** Collisions during initial load threw errors, but during hot reload they silently failed

**Root cause:** Different collision detection in two places

**Fix:** Both now use `assignToApiPath` with configurable collision modes

```javascript
assignToApiPath(api, "config", value, {
    collisionMode: config.collision.initial  // "error" | "warn" | "merge" | "skip"
});
```

### Bug 3: Wrapper Reference Loss

**Problem:** Hot reload would replace wrappers instead of updating them, breaking existing references

**Root cause:** No wrapper detection in hot reload merge

**Fix:** `assignToApiPath` detects wrappers and syncs instead of replacing

```javascript
// Detects both values are wrappers and syncs
if (isWrapperProxy(existing) && isWrapperProxy(value)) {
    syncWrapper(existing, value);  // Preserves reference
}
```

## Current Status

### Files Using api_assignment.mjs

1. **`builders/builder.mjs` (processFiles)**
   - Uses `assignToApiPath` during module processing
   - Collision detection during initial load
   - Used in: 12 locations

2. **`helpers/hot_reload.mjs` (mutateApiValue, setValueAtPath)**
   - Uses `mergeApiObjects` during hot reload
   - Wrapper syncing during component reload
   - Used in: 8 locations

3. **`helpers/modes.mjs` (processFiles)**
   - Uses `assignToApiPath` for subdirectory processing
   - Category wrapper creation
   - Used in: 4 locations

### Current Location Issues

**Current:** `src/lib/helpers/api_assignment.mjs`

**Problem:** This is NOT a generic helper - it's builder/construction logic

**Should be:** `src/lib/builders/api-assignment.mjs`

**Reasoning:**
- Contains core API construction patterns
- Handles collision resolution (builder responsibility)
- Manages wrapper proxy assignment (builder concern)
- Used primarily during build operations

## Planned Refactor: Class-Based Architecture

### Current (Standalone Functions)

```javascript
// helpers/api_assignment.mjs
export function assignToApiPath(targetApi, key, value, options) {
    const { config, syncWrapper } = options;
    // Need to pass config through options
}

export async function mergeApiObjects(targetApi, sourceApi, options) {
    const { config } = options;
    if (config?.debug?.api) {
        console.log(...);  // Access config from parameter
    }
}
```

### Planned (Class-Based)

```javascript
// builders/api-assignment.mjs
export class ApiAssignment {
    constructor(instance) {
        this.instance = instance;
    }
    
    get config() { return this.instance.config; }
    get debug() { return this.instance.config?.debug; }
    
    assignToApiPath(targetApi, key, value, options = {}) {
        // No need to pass config - access via this.config
        const { allowOverwrite = false, mutateExisting = false } = options;
        
        if (this.debug?.api) {
            console.log(`Assigning ${key} to API`);
        }
        
        // ... rest of logic
    }
    
    async mergeApiObjects(targetApi, sourceApi, options = {}) {
        // Access debug directly without parameter passing
        if (this.debug?.api) {
            console.log(`Merging objects`);
        }
        
        // Can call other instance methods directly
        this.assignToApiPath(targetApi, key, value);
    }
}
```

### Benefits of Class Refactor

1. **No config parameter pollution**: Access via `this.config`
2. **Direct method calls**: `this.assignToApiPath()` instead of importing
3. **Better encapsulation**: Assignment logic grouped in one class
4. **Easier debugging**: `this.instance` always available
5. **Consistent with other builders**: All builders become classes

## Testing Considerations

### Unit Tests Required

1. **assignToApiPath scenarios:**
   - Direct assignment (no collision)
   - Wrapper sync (both are wrappers)
   - Collision detection (existing value present)
   - Overwrite control (allowOverwrite flag)

2. **mergeApiObjects scenarios:**
   - Shallow merge (one level)
   - Deep merge (nested objects)
   - Wrapper preservation (don't unwrap proxies)
   - Missing key removal (removeMissing flag)

3. **Integration tests:**
   - Initial load + hot reload consistency
   - Wrapper reference preservation across reload
   - Collision handling matches config

### Test Files

- `tests/vitests/api-assignment.test.mjs` (unit tests)
- `tests/vitests/hot-reload.test.mjs` (integration with hot reload)
- `tests/vitests/builder.test.mjs` (integration with initial build)

## Documentation Requirements

### JSDoc Updates

```javascript
/**
 * Assign a value to an API object at a given property key.
 * 
 * @param {Object} targetApi - Target object to assign to
 * @param {string|symbol} key - Property name to assign
 * @param {unknown} value - Value to assign (may be UnifiedWrapper proxy)
 * @param {Object} options - Assignment options
 * @param {boolean} [options.allowOverwrite=false] - Allow overwriting existing values
 * @param {boolean} [options.mutateExisting=false] - Sync existing wrappers instead of replacing
 * @param {Function} [options.syncWrapper] - Function to sync two wrapper proxies
 * @returns {boolean} True if assignment succeeded
 * 
 * @example
 * // Direct assignment
 * assignToApiPath(api, "math", mathWrapper, {});
 * 
 * @example
 * // Sync existing wrapper
 * assignToApiPath(api, "config", newConfigWrapper, { 
 *     mutateExisting: true, 
 *     syncWrapper 
 * });
 */
```

### Module Documentation

- Add to `docs/MODULE-STRUCTURE.md` under "Builders" section
- Update import examples in `docs/API-RULES.md`
- Document collision handling in `docs/API-RULES-CONDITIONS.md`

## Migration Checklist

### ⚠️ CRITICAL: Test After Every Step

**See "CRITICAL: Testing Instructions" at the top of this document for complete testing details.**

**Quick reference - Run after EVERY change:**
```powershell
npm run debug 2>&1 | Select-Object -Last 40
npm run testv3 -- collision-config.test.vitest.mjs 2>&1 | Select-Object -Last 40
```

**If either test fails, STOP and fix before continuing.**

### Step-by-Step Migration

- [ ] Move file: `git mv src/lib/helpers/api_assignment.mjs src/lib/builders/api-assignment.mjs`
- [ ] **⚠️ DO NOT TEST YET - imports are broken!**
- [ ] Update imports in `builders/builder.mjs` (change `helpers/api_assignment` → `builders/api-assignment`)
- [ ] Update imports in `helpers/hot_reload.mjs` (change `helpers/api_assignment` → `builders/api-assignment`)
- [ ] Update imports in `helpers/modes.mjs` (change `helpers/api_assignment` → `builders/api-assignment`)
- [ ] Update package.json exports: `node tools/build-exports.mjs`
- [ ] **NOW TEST** (tail output):
  ```powershell
  npm run debug 2>&1 | Select-Object -Last 40
  npm run testv3 -- collision-config.test.vitest.mjs 2>&1 | Select-Object -Last 40
  ```
- [ ] **CHECK**: Zero errors? If yes, special commit message!
- [ ] **COMMIT**: "refactor: move api_assignment to builders/" (or special zero-error message if applicable)
- [ ] Update JSDoc @module tags in the moved file
- [ ] Update documentation references
- [ ] **TEST**: Both critical tests (tail last 40 lines)
- [ ] **COMMIT**: "docs: update api-assignment documentation"

## Conclusion

The `api_assignment.mjs` module represents a critical architectural pattern in Slothlet:

**Single Source of Truth for API Assignment**

It was born from the need to prevent code duplication between initial load and hot reload, and has proven essential for maintaining consistency across these two distinct but related operations.

The upcoming class-based refactor will improve this further by eliminating parameter passing and making the relationship between assignment logic and instance state more explicit.

**Key Takeaway:** When two operations need identical logic, extract to a shared module rather than duplicating. This module is proof that the pattern works and prevents subtle bugs from logic divergence.
