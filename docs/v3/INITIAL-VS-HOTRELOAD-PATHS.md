# Initial Load vs Hot Reload: Path Comparison

**Date:** January 22, 2026  
**Purpose:** Document differences between initial `buildAPI()` and hot reload `api.add()` paths

## Executive Summary

**Initial load works perfectly** - `buildAPI()` correctly creates and populates wrappers with flattened children.

**Hot reload fails** - Despite calling the same `buildAPI()`, wrapper extraction and structure handling differs, resulting in empty category wrappers.

**Original Intent:** Extract merge logic from `buildAPI` into reusable functions for both paths to use.

**Current Reality:** Merge logic remains embedded in `processFiles()`, and hot reload doesn't properly utilize the built structure.

---

## Initial Load Path (Working Correctly)

### Entry Point
```javascript
// src/slothlet.mjs line 68
this.api = await buildAPI({
  dir: config.dir,
  mode: config.mode,
  ownership: this.ownership,
  contextManager: this.contextManager,
  instanceID: this.instanceID,
  config: this.config,
  apiPathPrefix: ""  // ← NO PREFIX on initial load
});
```

### Flow Trace

**1. buildAPI() → buildEagerAPI() → processFiles()**
- `dir`: User-specified directory
- `apiPathPrefix`: Empty string `""`
- `isRoot`: `true` (processing from root)
- `targetApi`: Fresh empty object `{}`

**2. processFiles() Processes config/config.mjs**

Location: `src/lib/helpers/modes.mjs` lines 120-750

```javascript
// Folder structure:
// config/
//   config.mjs → exports { getNestedConfig, setNestedConfig, nestedConfigVersion }

// Step A: Create category wrapper for config/ folder
if (!isRoot && shouldWrap && !populateDirectly) {
  // Line 161-176
  const wrapper = new UnifiedWrapper({
    mode,
    apiPath: "config",  // ← buildApiPath("config") with no prefix = "config"
    initialImpl: {},    // Empty - no direct files in config/
    ...
  });
  api["config"] = wrapper.createProxy();
  targetApi = api["config"];  // ← Category wrapper becomes target
}
```

At this point:
- `api.config` = category wrapper with empty `_childCache`
- `targetApi` = reference to that wrapper's proxy

**Step B: Process config/config.mjs file**

```javascript
// Line 520-548: Main module wrapping logic
const localPath = isRoot ? propertyName : `${categoryName}.${propertyName}`;
// Since isRoot=false (inside category), localPath = "config.config"

// Smart flattening check (line 480-485):
if (propertyName === categoryName && !hasDefaultMethod) {
  // ✓ propertyName "config" === categoryName "config"
  // FLATTEN: Use category's existing properties as children
  
  // Line 506-519: Handle object exports with flattening
  for (const key in mod) {
    const preferredName = /* function name preference logic */;
    
    const wrapper = new UnifiedWrapper({
      mode,
      apiPath: `${categoryName}.${preferredName}`,  // "config.getNestedConfig"
      initialImpl: mod[key],
      isCallable: typeof mod[key] === "function"
    });
    
    targetApi[preferredName] = wrapper.createProxy();  // ← ADDED TO CATEGORY WRAPPER
  }
}
```

**Critical difference:** `targetApi` points to the CATEGORY WRAPPER, so assignments go into its proxy, triggering the SET trap which stores children in `_childCache`.

**Step C: Category wrapper's SET trap stores children**

Location: `src/lib/handlers/unified-wrapper.mjs` lines 857-868

```javascript
setTrap(target, prop, value) {
  // ...
  wrapper._childCache.set(prop, value);  // ← Stores proxy in _childCache
  target[prop] = value;                   // ← Also stores in _proxyTarget
  return true;
}
```

**Result after processFiles():**
```javascript
api.config = {
  __wrapper: {
    apiPath: "config",
    _childCache: Map {
      "getNestedConfig" => <proxy apiPath="config.getNestedConfig">,
      "setNestedConfig" => <proxy apiPath="config.setNestedConfig">,
      "nestedConfigVersion" => <proxy apiPath="config.nestedConfigVersion">
    }
  }
}
```

✅ **Category wrapper is properly populated with flattened children!**

---

## Hot Reload Path (Currently Broken)

### Entry Point
```javascript
// src/lib/helpers/hot_reload.mjs line 632
const newApi = await buildAPI({
  dir: resolvedFolderPath,
  mode: instance.mode,
  ownership: instance.ownership,
  contextManager: instance.contextManager,
  instanceID: instance.instanceID,
  config: instance.config,
  apiPathPrefix: normalizedPath  // ← "config" (the target path)
});
```

### Flow Trace

**1. buildAPI() with apiPathPrefix="config"**

Same `buildAPI()` → `buildEagerAPI()` → `processFiles()` as initial load, BUT:

- `apiPathPrefix`: `"config"` (not empty)
- Folder is treated as ROOT because we're building from it
- Fresh target API object created: `{}`

**2. processFiles() Processes folder structure**

```javascript
// Folder structure:
// api_smart_flatten_folder_config/
//   main.mjs
//   config/
//     config.mjs

// With apiPathPrefix="config", buildApiPath works like:
buildApiPath = (path) => {
  if (!apiPathPrefix) return path;
  if (path === apiPathPrefix) return path;  // Prevent "config.config"
  return `${apiPathPrefix}.${path}`;
}
```

**Step A: Process main.mjs (root level file)**

```javascript
const localPath = isRoot ? propertyName : `${categoryName}.${propertyName}`;
// isRoot=true, so localPath = "main"

const wrapper = new UnifiedWrapper({
  apiPath: buildApiPath("main"),  // → "config.main" (prefix added!)
  initialImpl: /* main.mjs exports */,
  ...
});

targetApi["main"] = wrapper.createProxy();
```

Result: `api["main"]` = wrapper with `apiPath="config.main"` ✓

**Step B: Create category wrapper for config/ subfolder**

```javascript
if (!isRoot && shouldWrap && !populateDirectly) {
  // BUT: isRoot=true! This entire block is SKIPPED!
  // No category wrapper is created at this stage
}
```

⚠️ **Key Issue #1:** When processing the root folder with a prefix, subdirectories don't get category wrappers created via the normal path because `isRoot=true`.

Actually, let me check the recursive call...

**Step C: Recursive call for config/ subfolder**

```javascript
// Line 595-660: Directory processing
if (shouldWrap) {
  const subResult = await processFiles({
    // ...
    isRoot: false,  // ← NOW it's not root
    categoryName: buildApiPath(subDirName)  // "config"
  });
}
```

So the recursive call WILL have `isRoot=false`, which means it WILL create a category wrapper!

Let me trace more carefully...

**Step B (Corrected): Recursive call processes config/ subfolder**

```javascript
// Recursive call with:
// - isRoot: false
// - categoryName: "config" (from buildApiPath("config"))
// - apiPathPrefix: "config" (inherited)

// Line 161: Create category wrapper
const wrapper = new UnifiedWrapper({
  apiPath: buildApiPath("config"),  // → "config" (already has prefix!)
  initialImpl: {},
  ...
});
api["config"] = wrapper.createProxy();
targetApi = api["config"];  // ← Category wrapper
```

So a category wrapper IS created with `apiPath="config"` and empty `_impl`.

**Step C: Process config/config.mjs inside category**

```javascript
// Now processing with:
// - isRoot: false
// - categoryName: "config"
// - targetApi: category wrapper proxy

const localPath = `${categoryName}.${propertyName}`;
// localPath = "config.config"

// Flattening check:
if (propertyName === categoryName) {  // "config" === "config" ✓
  // FLATTEN: Iterate exports
  for (const key in mod) {
    const wrapper = new UnifiedWrapper({
      apiPath: buildApiPath(`${categoryName}.${preferredName}`),
      // buildApiPath("config.getNestedConfig")
      // → Already has "config" prefix, so returns "config.getNestedConfig" unchanged
      ...
    });
    
    targetApi[preferredName] = wrapper.createProxy();  // ← Store in category wrapper
  }
}
```

Wait, this should work the same as initial load! The `targetApi` is the category wrapper, so assignments should go into its `_childCache`.

Let me check the debug output again... We saw that wrappers were created with:
- `apiPath="config.getNestedConfig"` ✓
- `apiPath="config.setNestedConfig"` ✓

But the category wrapper's `_childCache` was empty!

**The Real Issue:** Let me look at what `buildApiPath()` actually returns...

```javascript
// Line 146-153
const buildApiPath = (path) => {
  if (!apiPathPrefix) return path;
  if (path === apiPathPrefix) return path;               // ← Prevent double-prefix
  if (path.startsWith(apiPathPrefix + ".")) return path; // ← Already has prefix
  return `${apiPathPrefix}.${path}`;
};
```

When called with `buildApiPath("config")`:
- `path === apiPathPrefix` → `"config" === "config"` → returns `"config"` ✓

When called with `buildApiPath("config.getNestedConfig")`:
- `path.startsWith("config.")` → TRUE → returns `"config.getNestedConfig"` unchanged ✓

So `buildApiPath()` is working correctly!

**The Real Real Issue:** Let me check if the assignment is actually happening...

Looking at the debug output from earlier:
```
[UnifiedWrapper constructor] apiPath="config.getNestedConfig": _impl has 0 keys: []
```

These child wrappers ARE being created. But are they being assigned to the category wrapper?

**Step D: Where are the children being stored?**

In the debug output, we saw the category wrapper was created first:
```
[UnifiedWrapper constructor] apiPath="config": _impl has 0 keys: []
[UnifiedWrapper constructor] apiPath="config": after adopt, _childCache size=0
```

Then later, the children were created:
```
[UnifiedWrapper constructor] apiPath="config.getNestedConfig": ...
[UnifiedWrapper constructor] apiPath="config.setNestedConfig": ...
```

But the category wrapper's cache stayed at size=0. This means the assignment `targetApi[preferredName] = wrapper.createProxy()` is NOT triggering the SET trap, or the trap isn't storing them!

**Step E: Why isn't SET trap being triggered?**

Two possibilities:
1. `targetApi` is not pointing to the category wrapper proxy
2. The SET trap is being triggered but not storing the values

Let me check what `targetApi` is after category wrapper creation...

In the recursive call:
```javascript
// Line 176
api["config"] = wrapper.createProxy();
targetApi = api["config"];  // ← Should be the category wrapper's proxy
```

Wait! But `api` here is NOT the root api object - it's the PARENT's api object!

Let me trace the recursive structure more carefully...

**Recursive Call Structure:**

Initial call:
- `api = {}` (fresh object)
- Processes `api_smart_flatten_folder_config/`
- `isRoot = true`

When it encounters `config/` subdirectory, it makes a recursive call:
- Passes same `api` object
- `isRoot = false`
- Creates category wrapper: `api["config"] = wrapper.createProxy()`
- Sets `targetApi = api["config"]`
- Processes files with `targetApi` as the target

So `targetApi` SHOULD be the category wrapper proxy. But then why doesn't the assignment work?

**THE ACTUAL ISSUE:** Let me check the exact assignment path in the flattening logic...

Looking at lines 506-519 more carefully:

```javascript
// Line 506-519: Object exports with named properties
if (hasNonDefaultExports && !hasDefaultMethod) {
  for (const key in mod) {
    // ...
    const wrapper = new UnifiedWrapper({ ... });
    
    // Line 514: Assignment
    targetApi[preferredName] = wrapper.createProxy();
  }
  continue;  // ← CONTINUE! Skips the normal assignment below
}

// Line 544: Normal assignment (NOT reached when flattening)
targetApi[propertyName] = wrapper.createProxy();
```

So the flattened children ARE assigned to `targetApi`. But wait... let me check if there's something special happening with the category wrapper...

**FOUND IT!** Looking at line 164:

```javascript
// Line 163-166
if (existingTarget && existingTarget.__wrapper) {
  targetApi = existingTarget;  // ← REUSE existing wrapper if found
} else if (...) {
  // Create new wrapper
}
```

During hot reload, when the recursive call tries to create a category wrapper for `config/`, it checks if `api["config"]` already exists. 

In initial load: `api["config"]` is undefined, so a new wrapper is created.

In hot reload: `api["config"]` might already exist from a previous operation!

But wait, the `api` object in `buildAPI` is a FRESH object, not the existing instance's API. So this shouldn't be the issue either.

Let me look at the actual return value from `buildAPI()`...

**Step F: What buildAPI returns**

After processing completes, `buildAPI` returns the `api` object which should contain:
```javascript
{
  main: <wrapper apiPath="config.main">,
  config: <wrapper apiPath="config">
}
```

We confirmed in debug output that `newApi.config.__wrapper._childCache.size = 0`. So the children were NOT stored in the category wrapper's cache!

**THE REAL ACTUAL ISSUE:** The category wrapper's `_impl` is empty, so even if children are assigned, they might not be staying...

Wait! Let me check if there's a `cloneWrapperImpl` call that might be cloning the existing api.config wrapper!

Line 171 in the category wrapper creation:
```javascript
initialImpl: cloneWrapperImpl(existingTarget || {}, mode)
```

And we fixed this earlier to check if `existingTarget` is a wrapper... but that was in a different context. Let me check if THIS code path has the issue:

```javascript
// Line 161-176
if (!isRoot && shouldWrap && !populateDirectly) {
  const existingTarget = api[categoryName];
  if (existingTarget && existingTarget.__wrapper) {
    targetApi = existingTarget;  // ← Reuse existing
  } else if (existingTarget === undefined || ...) {
    const initialImpl = (existingTarget && existingTarget.__wrapper) 
      ? {} 
      : cloneWrapperImpl(existingTarget || {}, mode);
    
    const wrapper = new UnifiedWrapper({
      apiPath: buildApiPath(categoryName),
      initialImpl,  // ← Should be {} if existingTarget is wrapper
      ...
    });
  }
}
```

We added the check `(existingTarget && existingTarget.__wrapper) ? {}`, so that should handle it. But during hot reload, `api` is a FRESH object, so `existingTarget` would be undefined, not a wrapper.

**MYSTERY:** Why isn't the category wrapper receiving the children?

Let me think about this differently... Maybe the issue is that `buildAPI` creates the structure correctly, but then we're looking at the WRONG wrapper when checking `newApi.config`?

Maybe there are TWO wrappers both with `apiPath="config"`:
1. The category wrapper (empty)
2. A file wrapper (populated)

And `buildAPI` returns the category wrapper instead of the file wrapper?

Actually, looking at the debug output again:
```
[UnifiedWrapper constructor] apiPath="config.main": ... _childCache size=2, keys: [ 'getRootInfo', 'rootVersion' ]
```

The `config.main` wrapper HAS children! So child adoption IS working for normal files.

But for the config/ category:
```
[UnifiedWrapper constructor] apiPath="config": ... _childCache size=0
```

Empty!

So the question is: Where are `config.getNestedConfig` and friends being stored?

---

## The Critical Difference

### Initial Load: Working

1. Category wrapper created with `apiPath="config"`
2. `targetApi` points to category wrapper's proxy
3. Flattened children assigned: `targetApi["getNestedConfig"] = wrapper.createProxy()`
4. SET trap stores in `_childCache`
5. Result: Category wrapper has 3 children in `_childCache`

### Hot Reload: Broken

1. Category wrapper created with `apiPath="config"` (same!)
2. `targetApi` SHOULD point to category wrapper's proxy
3. Flattened children assigned: `targetApi["getNestedConfig"] = wrapper.createProxy()`
4. SET trap SHOULD store in `_childCache`
5. Result: Category wrapper has 0 children in `_childCache` ❌

**Something is different between these two paths that prevents the SET trap from storing the children!**

---

## Hypothesis: Different Processing Order

Maybe during hot reload, the children are being processed BEFORE the category wrapper is fully set up?

Or maybe the `targetApi` reference is being changed between wrapper creation and child assignment?

Or maybe there's a second category wrapper being created that overwrites the first?

Looking at the debug output order:
```
1. [UnifiedWrapper constructor] apiPath="config": ... (initial, size=6) - INITIAL LOAD
2. [UnifiedWrapper constructor] apiPath="config.main": ...              - HOT RELOAD
3. [UnifiedWrapper constructor] apiPath="config.getNestedConfig": ...   - HOT RELOAD
4. [UnifiedWrapper constructor] apiPath="config.setNestedConfig": ...   - HOT RELOAD
```

We only see ONE `apiPath="config"` wrapper being created, and it's from the initial load!

**REVELATION:** During hot reload, NO NEW category wrapper is being created for `config`!

The children (`config.main`, `config.getNestedConfig`, etc.) are being created, but there's no PARENT category wrapper to hold them!

This means the check at line 163 is REUSING the existing wrapper:
```javascript
if (existingTarget && existingTarget.__wrapper) {
  targetApi = existingTarget;  // ← REUSE existing wrapper
}
```

But `existingTarget` here is the EXISTING `api.config` from the instance, not from the fresh `api` object being built by `buildAPI`!

**THE BUG:** The `api` object passed to recursive calls is NOT isolated - it's somehow referencing the existing instance's API!

Actually, no... the `api` object in `buildAPI` starts as `{}`, so it can't have the existing wrapper.

Let me re-examine the structure...

---

## The Missing Piece

Looking at the recursive call again:

```javascript
// Line 595-660: Processing subdirectories
const subResult = await processFiles({
  directory: subDir,
  api: api,  // ← Same api object!
  isRoot: false,
  categoryName: buildApiPath(subDirName),
  // ...
});
```

The `api` object is passed to the recursive call. So when the recursive call creates:
```javascript
api["config"] = wrapper.createProxy();
targetApi = api["config"];
```

This modifies the PARENT's `api` object, adding the category wrapper. Then child assignments go to `targetApi`.

So the structure SHOULD be:
```javascript
api = {
  main: <wrapper>,
  config: <category wrapper with children>
}
```

But the debug shows the category wrapper is empty!

**Final Theory:** Maybe the children are being created at the WRONG scope level?

Let me check if there's a scope issue with the `api` variable...

Actually, I think I need to instrument the code more to see exactly where the children are being stored. Let me document what we know so far and mark this as requiring further investigation.

---

## Summary

**ROOT CAUSE IDENTIFIED:**

1. **`recursive=false` bug**: `buildEagerAPI` was passing `false` for the `recursive` parameter, preventing subdirectory processing during hot reload
   - **FIXED**: Changed line 52 in `src/lib/modes/eager.mjs` from `false` to `true`
   - Result: Subdirectories are now processed, category wrappers are created with proper children

2. **Integration logic incomplete**: `addApiComponent` extracts only `finalKey` from `buildAPI` result, discarding sibling entries
   - `buildAPI` with `apiPathPrefix="config"` returns: `{ main: wrapper, config: wrapper }`
   - Current code: Extracts only `config` wrapper, loses `main` wrapper
   - **NEEDED**: Integration logic that merges ALL top-level keys as children of the target location

**What buildAPI returns (hot reload with apiPathPrefix="config"):**
```javascript
{
  main: <wrapper apiPath="config.main" with 2 children>,    ← DISCARDED!
  config: <wrapper apiPath="config" with 3 flattened children>  ← EXTRACTED
}
```

**What should happen:**
- Take the ENTIRE buildAPI result
- Merge ALL top-level keys (`main`, `config`) as children of `api.config`
- Result: `api.config.main` and `api.config.getNestedConfig` both accessible

**Original Intent (Not Achieved):**
Extract the merge logic from `processFiles()` into reusable functions that both initial load and hot reload can use. This would eliminate the duplicate code and ensure both paths behave identically.

**Current Reality:**
The merge logic is still embedded in `processFiles()`, and while both paths call the same function, the hot reload path had two critical bugs:
1. ✅ **FIXED**: `recursive=false` prevented subdirectory processing
2. ❌ **REMAINING**: Integration logic only extracts one key, discarding siblings

**Next Steps:**
1. Fix integration logic in `addApiComponent` to merge all top-level keys from buildAPI result
2. Walk through the structure recursively, merging wrappers and updating paths
3. Respect `allowOverwrite` settings during merge
4. Handle conflicts properly (merge _childCache, update _impl if allowed)
