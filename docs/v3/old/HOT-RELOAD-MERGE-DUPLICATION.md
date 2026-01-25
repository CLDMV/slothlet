# Hot Reload Merge Logic Duplication Issue

## Problem Statement

We have **duplicate merge logic** in the codebase:
- `processFiles()` in `modes.mjs` contains complex logic for assigning modules to API paths, wrapping them, handling flattening, etc.
- `addApiComponent()` in `hot_reload.mjs` calls `buildAPI()` to get new wrappers, but then uses completely different merge logic (`mutateApiValue()`, `syncWrapper()`, etc.)

This causes inconsistencies - new wrappers created by `buildAPI()` have correct structure, but when merged via `addApiComponent()`, they get unwrapped or lose properties.

## Root Cause

**buildAPI does EVERYTHING:**
- Creates UnifiedWrapper instances with correct apiPath
- Handles smart flattening
- Manages root contributors
- Wraps functions with context binding
- Stores wrappers in `_childCache` as proxies
- Assigns values using specific patterns (safeAssign, direct assignment, etc.)

**addApiComponent tries to recreate this:**
- Calls buildAPI() ✓
- Gets a properly structured API ✓
- But then uses `mutateApiValue()` which:
  - Recursively walks objects
  - Tries to merge properties one by one
  - Uses different assignment logic than initial build
  - Causes proxies to be unwrapped or stored incorrectly

## The Real Solution

**Extract the assignment/merge logic from `processFiles()` into a reusable function** that can be used by both:
1. Initial API build (current behavior in `processFiles`)
2. Hot reload merge (replace `mutateApiValue` with extracted logic)

### Key Logic to Extract

From `processFiles()` in `modes.mjs`, the assignment patterns that need extraction:

```javascript
// Pattern 1: Direct assignment (line ~540)
targetApi[propertyName] = wrapper.createProxy();

// Pattern 2: safeAssign with collision detection (line ~515)
if (safeAssign(targetApi, preferredName, wrapper.createProxy(), config)) {
    targetApi[preferredName] = wrapper.createProxy();
}

// Pattern 3: Wrapper sync when target already exists (line ~160)
if (existingTarget && existingTarget.__wrapper) {
    targetApi = existingTarget; // Reuse existing wrapper
}

// Pattern 4: Replace existing non-wrapper with new wrapper (line ~162)
else if (existingTarget === undefined || (typeof existingTarget === "object")) {
    const wrapper = new UnifiedWrapper({...});
    api[categoryName] = wrapper.createProxy();
}
```

### Proposed Function Signature

```javascript
/**
 * Assign a value to an API path, handling wrapper sync, collision detection, and smart merging
 * @param {Object} targetApi - Target object to assign to
 * @param {string} key - Property name
 * @param {unknown} value - Value to assign (may be wrapper proxy, raw value, etc.)
 * @param {Object} options - Assignment options
 * @param {boolean} options.allowOverwrite - Allow overwriting existing values
 * @param {boolean} options.mutateExisting - Sync existing wrappers instead of replacing
 * @param {Object} options.config - Slothlet config
 * @returns {boolean} True if assignment succeeded
 */
function assignToApiPath(targetApi, key, value, options) {
    const existing = targetApi[key];
    
    // If both are wrapper proxies, sync them
    if (isWrapperProxy(existing) && isWrapperProxy(value)) {
        if (options.mutateExisting) {
            return syncWrapper(existing, value);
        }
    }
    
    // Use safeAssign logic for collision detection
    if (safeAssign(targetApi, key, value, options.config)) {
        targetApi[key] = value;
        return true;
    }
    
    return false;
}
```

## Implementation Steps

1. **Extract `assignToApiPath()` function** from `processFiles()` assignment patterns
2. **Update `processFiles()`** to use `assignToApiPath()` instead of direct assignments
3. **Update `mutateApiValue()`** to use `assignToApiPath()` instead of recursive object walking
4. **Test** that both initial build and hot reload use consistent logic

## Why This Fixes Everything

- **No more duplicate logic** - one source of truth for assignments
- **Consistent wrapper handling** - same code path for initial build and hot reload
- **Correct proxy preservation** - assignment logic knows how to handle UnifiedWrapper proxies
- **Proper collision detection** - safeAssign logic reused everywhere
- **Maintainable** - future changes to assignment logic only need to happen in one place

## Current Status

- [x] Identified the duplication
- [x] Traced through buildAPI → processFiles flow
- [x] Documented wrapper architecture (UnifiedWrapper, _childCache, etc.)
- [x] Created `api_assignment.mjs` with extracted `assignToApiPath()` and `mergeApiObjects()` functions
- [ ] Update processFiles() to use assignToApiPath()
- [ ] Update mutateApiValue() to use mergeApiObjects()
- [ ] Test api.add(), api.remove(), api.reload()

## Next Steps

1. Import `assignToApiPath` in `modes.mjs` and replace direct assignment patterns
2. Import `mergeApiObjects` in `hot_reload.mjs` and replace `mutateApiValue` implementation
3. Pass required functions (syncWrapper, safeAssign) as options to assignment functions
4. Run tests to verify both initial build and hot reload work identically
