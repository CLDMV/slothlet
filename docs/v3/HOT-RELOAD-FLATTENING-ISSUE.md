# Hot Reload API Flattening Issue

**Status:** IDENTIFIED - Root cause found, solution pending  
**Date:** January 22, 2026  
**Priority:** CRITICAL - Blocks all hot reload tests with smart flattening

## Problem Summary

When `api.add("config", folderPath)` is called with a folder that contains flattened files (e.g., `config/config.mjs`), the resulting wrapper has an empty `_childCache`, causing all existing children to be cleared during sync.

## Root Cause Analysis

### The Scenario

```
api_smart_flatten_folder_config/
  main.mjs
  config/
    config.mjs  → exports { getNestedConfig, setNestedConfig, nestedConfigVersion }
```

When calling: `api.add("config", "path/to/api_smart_flatten_folder_config")`

### Expected Behavior

1. `buildAPI()` should create a wrapper for `config` with:
   - `_childCache` containing: `{ main, getNestedConfig, setNestedConfig, nestedConfigVersion }`
2. `syncWrapper()` merges new children into existing `api.config` wrapper
3. Result: `api.config` has both old and new children

### Actual Behavior

1. `buildAPI()` creates:
   - Category wrapper for `config/` folder with **EMPTY** `_impl` and `_childCache`
   - Sibling wrappers: `config.main`, `config.getNestedConfig`, `config.setNestedConfig`
2. Flattening rule (`config/config.mjs` → `config`) makes children SIBLINGS, not children
3. `syncWrapper()` transfers from empty `_childCache` → clears everything
4. Result: `api.config._childCache` is empty after merge

## Detailed Flow Trace

### Step 1: buildAPI with apiPathPrefix

```javascript
buildAPI(instance, folder, "config")  // apiPathPrefix = "config"
```

- Processes folder as ROOT (isRoot = true)
- For `config/` subfolder: Creates category wrapper with `apiPath = "config"`
- For `config/config.mjs`: Flattening rule applies (folder+file match)

### Step 2: Wrapper Creation

**Category Wrapper** (config/ folder):
```javascript
new UnifiedWrapper({
  apiPath: "config",
  initialImpl: {}  // EMPTY - no direct files in category
})
// Result: _childCache size = 0
```

**File Wrappers** (flattened to siblings):
```javascript
// These are created as ROOT-LEVEL properties, not children of category wrapper
new UnifiedWrapper({ apiPath: "config.main", ... })          // ✓ Has 2 children
new UnifiedWrapper({ apiPath: "config.getNestedConfig", ... }) // ✓ Function
new UnifiedWrapper({ apiPath: "config.setNestedConfig", ... }) // ✓ Function
```

### Step 3: buildAPI Returns

```javascript
{
  main: <wrapper apiPath="config.main">,
  config: <wrapper apiPath="config" with EMPTY _childCache>
}
```

The `config` key is the **category wrapper**, not a file wrapper!

### Step 4: Extraction in addApiComponent

```javascript
// OLD CODE (WRONG):
if (newApiKeys.length === 1 && newApiKeys[0] === finalKey) {
  apiToMerge = newApi[finalKey];  // Only extracts if single key
}

// NEW CODE (FIXED):
if (newApi[finalKey] !== undefined) {
  apiToMerge = newApi[finalKey];  // Always extract finalKey if present
}
```

✅ **This part is now fixed** - we correctly extract the category wrapper

### Step 5: syncWrapper Called

```javascript
syncWrapper(existingConfigWrapper, newCategoryWrapper)
```

**Existing wrapper:**
- `_childCache`: `{ host, username, password, site, secure, verbose }` (6 items)

**New wrapper:**
- `_childCache`: `[]` (0 items - EMPTY!)

**Result after sync:**
```javascript
existingWrapper._childCache.clear();  // Clears all 6 items
// Copies 0 items from new wrapper
// Final: _childCache is EMPTY
```

## Why Category Wrapper is Empty

The flattening logic in `processFiles()` does:

1. **Creates category wrapper** for `config/` folder
   - `initialImpl: {}` because no direct files
   - `_adoptImplChildren()` runs but `_impl` is empty
   - Result: `_childCache` size = 0

2. **Creates file wrappers** for `config/config.mjs`
   - Flattening rule: `config/config.mjs` → `config`
   - But wait! There's already a category wrapper with `apiPath="config"`
   - So these get created as CHILDREN: `config.getNestedConfig`, `config.setNestedConfig`
   - They're added to the ROOT api object, NOT to the category wrapper

3. **Assigns to root API**
   - `api["config"]` = category wrapper (empty)
   - `api["main"]` = main.mjs wrapper
   - BUT: The flattened children (`getNestedConfig`, etc.) are NOT stored anywhere!

## The Architectural Issue

**Problem:** Flattening creates children at the WRONG LEVEL

When `config/config.mjs` is flattened to `config`:
- File wrapper path: `config` (conflicts with category wrapper)
- Children paths: `config.getNestedConfig`, `config.setNestedConfig`

These children should be **IN** the category wrapper's `_childCache`, but they're being created as separate wrappers at the root level.

## Solution Approaches

### Option 1: Populate Category Wrapper After Flattening

After `processFiles()` completes, check if a category wrapper exists and has flattened children:
- Find all wrappers with `apiPath.startsWith("categoryPath.")`
- Add them to category wrapper's `_childCache`
- Remove them from root API

### Option 2: Don't Create Category Wrapper for Fully-Flattened Folders

If a folder has only one file that gets completely flattened:
- Don't create the category wrapper
- Return the FILE wrapper directly
- Its children become its `_childCache` entries

### Option 3: Merge During Flattening

When flattening detects a conflict (category + file with same name):
- Use the FILE wrapper as the category wrapper
- Populate its `_childCache` with the file's exports
- Don't create a separate category wrapper

## Recommended Solution

**Option 3** is most architecturally sound:

1. In `processFiles()`, when processing `config/config.mjs`:
   - Check if category wrapper exists for `config/`
   - If yes, AND file flattens to same name (`config`):
     - Call `__setImpl()` on category wrapper with file's exports
     - This populates `_childCache` via `_adoptImplChildren()`
   - If no, create file wrapper normally

2. This way:
   - Category wrapper becomes the container
   - File's exports become its children
   - `buildAPI()` returns a populated wrapper
   - `syncWrapper()` has content to merge

## Test Case

**File:** `tests/vitests_v2/suites/smart-flattening/smart-flattening-folders.test.vitest.mjs`

**Scenario:** "Folder with config subfolder containing config.mjs"

Expected after `api.add("config", folder)`:
```javascript
api.config.main.getRootInfo()       // ✓ Should work
api.config.getNestedConfig()         // ✗ Currently undefined
api.config.setNestedConfig(value)    // ✗ Currently undefined
```

## Files Involved

- `src/lib/helpers/modes.mjs` - processFiles() function (lines 120-750)
- `src/lib/helpers/hot_reload.mjs` - addApiComponent() + syncWrapper()
- `src/lib/handlers/unified-wrapper.mjs` - __setImpl() + _adoptImplChildren()

## Related Issues

- **Duplicate merge logic** - Partially solved with `api_assignment.mjs`, but not used due to this issue
- **apiPathPrefix implementation** - Works correctly, but exposes this flattening bug

## Next Steps

1. Implement Option 3 in `processFiles()`
2. Test with smart-flattening test suite
3. Verify `syncWrapper()` receives populated wrappers
4. Clean up debug logging
5. Run full test suite to check for regressions
