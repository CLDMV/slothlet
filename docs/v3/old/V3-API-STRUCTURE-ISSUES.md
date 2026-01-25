# V3 API Structure Issues vs V2

> **⚠️ OUTDATED DOCUMENT**  
> **Last Updated**: Early January 2026 (before fixes)  
> **Current Status**: All API structure issues (Issues #1-7) have been **FIXED** in V3  
> **Moved to**: `docs/v3/old/` - Kept for historical reference only  
> **See instead**: `docs/v3/todo/` for remaining feature gaps (hooks, EventEmitter context, metadata)

---

## Tool Usage & Verification

### Inspecting API Structure

Use the `tools/inspect-api-structure.mjs` tool to compare V3 against V2:

```powershell
# Test V3 (current development)
$env:NODE_OPTIONS='--conditions=slothlet-three-dev'
node tools/inspect-api-structure.mjs api_test --eager --depth 3 --v3

# Test V2 (baseline reference) 
$env:NODE_OPTIONS='--conditions=development'
node tools/inspect-api-structure.mjs api_test --eager --depth 3
```

### V2 Reference Outputs

Baseline V2 API structure dumps are available in the root directory:
- `v2-eager-output.txt` - V2 eager mode API structure (1494 lines)
- `v2-lazy-output.txt` - V2 lazy mode API structure

### Examining V2 Implementation

When porting features or fixing issues, reference the V2 codebase:
- **V2 Source**: `src2/` folder - stable V2 reference (archived)
- **V3 Source**: `src/` folder - current development version (**NOT src3**)
- **Key V2 Files**:
  - `src/lib/modes/eager.mjs` - Eager mode implementation
  - `src/lib/modes/lazy.mjs` - Lazy mode implementation
  - `src/lib/helpers/flatten.mjs` - Flattening logic
  - `src/lib/helpers/sanitize.mjs` - Naming conventions
  - `src/lib/api_builder/analysis.mjs` - Module analysis

Compare V2 and V3 implementations to understand architectural differences and missing features.

---

## Issue 1: Root API Behavior - Object vs Function

**V2 Behavior**: `api` is callable function with properties → `api()` works + `api.rootFunctionShout()`
**V3 Behavior**: `api` is plain object (not callable) → `api()` would fail + `api.rootFunction()` works

**Status**: ✅ FIXED

**Root Cause**:
V2 uses the **"Root Contributor Pattern"** where if ANY root-level file exports a default function, that function becomes the API itself (with other modules as properties). This is implemented via `rootDefaultFunction` in eager.mjs lines 323-449:

```javascript
let rootDefaultFunction = null;
// ... process modules ...
if (mode === "root" && !hasMultipleDefaultExports && !getRootDefault()) {
  setRootDefault(defaultFunction);  // This becomes the API!
}
// ... at end ...
if (rootDefaultFunction) {
  Object.assign(rootDefaultFunction, api);  // Add other modules as properties
  finalApi = rootDefaultFunction;  // API IS the function
}
```

**V3 Issue**: V3 doesn't implement this pattern. All modules go into `api` object, no root function promotion.

**Fix**: Port root contributor pattern to v3.

---

## Issue 2: Missing Root-Level Methods

**V2 Behavior**: `api.rootFunctionShout()`, `api.rootFunctionWhisper()` (root-level direct access)
**V3 Behavior**: `api.rootFunction.rootFunctionShout()`, `api.rootFunction.rootFunctionWhisper()` (nested)

**Status**: ✅ FIXED

**Root Cause**:
This is a direct consequence of Issue #1. In V2, when root-function.mjs exports a default function with additional named exports (rootFunctionShout, rootFunctionWhisper), the default function becomes the API itself, and the named exports are attached as properties to that function:

```javascript
// root-function.mjs exports:
export default function greet(name) { return `Hello, ${name}!`; }
export function rootFunctionShout(name) { return `HELLO, ${name.toUpperCase()}!`; }
export function rootFunctionWhisper(name) { return `hello, ${name.toLowerCase()}...`; }

// V2 result: api IS greet() function with properties
api() // calls greet
api.rootFunctionShout()  // direct access
api.rootFunctionWhisper() // direct access

// V3 result: api.rootFunction is the namespace
api.rootFunction() // calls greet
api.rootFunction.rootFunctionShout()  // nested under namespace
```

This is handled by `processModuleFromAnalysis` in v2 which attaches named exports to the default function before it becomes rootDefaultFunction.

**Fix**: Same as Issue #1 - implement root contributor pattern.

---

## Issue 3: Sanitization Differences

**V2 Behavior**: `api.multi_defaults.*`, `api.multi_func.*` (underscores preserved)
**V3 Behavior**: `api.multi_defaults.*`, `api.multi_func.*` (underscores preserved)

**Status**: ✅ FIXED / NON-ISSUE

**Verification** (January 24, 2026):
```javascript
// Actual V3 behavior matches V2:
api.multi_defaults // object (underscores preserved)
api.multi_func     // object (underscores preserved)
```

**Notes**:
- Initial report was incorrect
- V3 preserves underscores just like V2
- No breaking change

---

## Issue 4: Export Default Handling - Mixed Exports

**V2 Behavior**: Modules with default + named exports are callable at namespace level:
- `api.exportDefault()` + `api.exportDefault.extra()`
- `api.funcmod()`
- `api.mixed()` + `api.mixed.mixedAnother()`, `api.mixed.mixedNamed()`
- `api.objectDefaultMethod()` + `api.objectDefaultMethod.info()`, etc.
- `api.advanced.nest3()` (function at that level)

**V3 Behavior**: Lost callable defaults:
- `api.exportDefault.extra()` only (**no `api.exportDefault()`**)
- `api.funcmod` is empty object (**no callable**)
- `api.mixed.mixedAnother()` only (**no `api.mixed()`**)
- `api.objectDefaultMethod.default()` (**default renamed, not callable at namespace**)
- `api.advanced.nest3.singlefile()` (**nested differently**)

**Status**: ✅ FIXED

**Root Cause**:
V2 uses `processModuleFromAnalysis` which attaches named exports as properties to the default export BEFORE processing. From v2 api_builder/analysis.mjs:

```javascript
// When a module has both default and named exports:
if (analysis.hasDefault && analysis.namedExportsCount > 0) {
  // Attach named exports as properties on the default
  for (const key of analysis.namedExports) {
    if (key !== 'default') {
      processedModule.default[key] = processedModule[key];
    }
  }
}
// Return the MODULE OBJECT (not just default)
// So mod.default is the function WITH named exports attached as properties
```

Then in `processModuleForAPI`, when assigning to the API:
```javascript
apiAssignments[apiPathKey] = mod; // mod has .default function + named exports
```

The result: `api.exportDefault` IS the function (mod.default) with extra() as a property.

**V3 Issue**: V3's mergeExportsIntoAPI doesn't replicate this behavior. Case 4 creates separate properties instead of making the namespace callable.

**Fix**: V3 needs to merge named exports onto the default function, then assign the function as the namespace (not create separate properties).

---

## Issue 5: Function Naming Differences

**V2 Behavior**: `api.task.autoIP()`, `api.task.parseJSON()` (preserved capitalization)
**V3 Behavior**: `api.task.autoIP()`, `api.task.parseJSON()` (preserved capitalization)

**Status**: ✅ FIXED

**Problem 1: Capitalization (autoIP → autoIp)**
- File: `auto-ip.mjs`, Function: `autoIP()`
- V2 uses `applyFunctionNamePreference()` which checks if the module has a SINGLE named export that matches the filename, and if so, uses the function name instead of sanitized filename
- V2 result: `api.task.autoIP()` (uses function name)
- V3 result: `api.task.autoIp()` (uses sanitized filename)
- **Fix**: V3 needs function name preference logic

**Problem 2: Over-Nesting (parseJSON becomes parseJson.parseJSON)**
- File: `parse-json.mjs`, Export: `{ parseJSON }`
- This is a single named export (no default)
- V2 auto-flattening rule: "single named export matching filename" → use export directly
- In v2, `parse-json.mjs` with `export { parseJSON }` should match filename and flatten
- V2 result: `api.task.parseJSON()` (flattened)
- V3 result: `api.task.parseJson.parseJSON()` (created namespace)
- **Fix**: V3's flattening logic needs to handle this case - when single named export exists, check if it's the "same" as filename (accounting for different casing/sanitization)

---

## Issue 6: Logger Module - Different Structure (V3 IMPROVEMENT)

**V2 Behavior**: `api.logger.log()` + `api.logger.utils.debug()`, `api.logger.utils.error()` (logger NOT callable)
**V3 Behavior**: `api.logger()` + `api.logger.utils.debug()`, `api.logger.utils.error()` (logger IS callable)

**Status**: ✅ V3 CORRECT / V2 BUG FIXED

**Analysis**:
V3 actually **fixed a V2 bug**! The pattern is now consistent:

**Root level pattern:**
- `root-function.mjs` exports `default function greet()` + named exports
- Result: `api()` is callable, named exports flattened to root (`api.rootFunctionShout()`)
- Other root files (config.mjs, root-math.mjs) → namespaces

**Category level pattern (same rule):**
- `logger/logger.mjs` exports `default function log()`
- Result: `api.logger()` is callable (logger IS the function)
- Other files in logger/ (utils.mjs) → namespace (`api.logger.utils.*`)

**V2 Bug**: V2 failed to apply the folder/folder.mjs pattern to logger, making it just an object with `.log()` method instead of a callable function. The JSDoc comment "Default logger function - makes the namespace callable" was the INTENTION but V2 never implemented it correctly.

**V3 Fix**: Case 2 in eager.mjs now correctly handles `folder/folder.mjs` with default export, making the category callable while preserving other files as namespaces.

---

## Issue 7: Util Module Over-Nesting

**V2 Behavior**: `api.util.getHTTPStatus()` (flat at util level)
**V3 Behavior**: `api.util.getHTTPStatus()` (flat at util level)

**Status**: ✅ FIXED

**Root Cause**:
File structure: `util/get-http-status.mjs` with function `getHTTPStatus()`

This is the function name preference issue:
- Sanitized filename: `getHttpStatus`
- Actual function name: `getHTTPStatus`
- V2: Uses function name → `api.util.getHTTPStatus()`
- V3: Uses sanitized name → creates namespace `api.util.getHttpStatus` with function inside as `.getHTTPStatus()`

This is NOT over-nesting - it's the wrong name being used for the namespace. If the namespace was named `getHTTPStatus`, it would work correctly. The "over-nesting" appearance is because:
- File has single default export (function)
- Should be assigned directly: `api.util[name] = function`
- V3 is creating object: `api.util[name] = { getHTTPStatus: function }`

**Fix**: Same as Issue 5 Problem 1 - implement function name preference logic that preserves capitalization like HTTP, IP, JSON, API, etc.

---

## Issue 8: Hooks System Missing

**V2 Behavior**: Full hooks API: `api.hooks.on()`, `api.hooks.off()`, `api.hooks.enable()`, `api.hooks.disable()`, `api.hooks.clear()`, `api.hooks.list()`
**V3 Behavior**: **Completely missing hooks** (replaced by `api.slothlet.*` internal API)

**Status**: ❌ CONFIRMED MISSING

**Notes**:
- User confirmed: hooks system is completely missing from v3
- This is not a flattening issue - it's genuinely not implemented
- Need to add hooks system to v3
- Check v2 hooks implementation and port to v3

---

## Issue 9: Built-in API Namespace Differences

**V2 Behavior**: No built-in namespace exposed, hooks at `api.hooks.*`
**V3 Behavior**: `api.slothlet.*` for instance methods + `api.shutdown()`, `api.destroy()` at root

**Status**: ℹ️ DESIGN CHANGE

**Notes**:
- This appears to be an intentional v3 design change
- V3 exposes instance management methods
- Not necessarily a problem, but a breaking change
- Document in breaking changes

---

## Next Steps - Prioritized Action Plan

### 1. **Implement Root Contributor Pattern** (Fixes Issues #1, #2)
**Priority**: CRITICAL - Core architectural difference
**Files to modify**:
- `src3/lib/modes/eager.mjs` - Add `rootDefaultFunction` tracking and final assembly
- `src3/lib/modes/lazy.mjs` - Same pattern for lazy mode
- `src3/lib/helpers/flatten.mjs` - Update `processModuleForAPI` to support root function

**Implementation**:
```javascript
// In eager.mjs create() function:
let rootDefaultFunction = null;

// When processing root modules:
if (mode === "root" && defaultFunction && !hasMultipleDefaultExports) {
  rootDefaultFunction = defaultFunction; // Save the function
  // Named exports already attached by processModuleFromAnalysis
}

// At end of create():
if (rootDefaultFunction) {
  Object.assign(rootDefaultFunction, api); // Merge all modules as properties
  finalApi = rootDefaultFunction; // API IS the function
} else {
  finalApi = api; // API is plain object
}
```

### 2. **Fix Mixed Export Handling** (Fixes Issue #4)
**Priority**: HIGH - Common pattern, many modules affected
**Files to modify**:
- `src3/lib/helpers/loader.mjs` - Update `mergeExportsIntoAPI` Case 4
- `src3/lib/helpers/analysis.mjs` (if exists) - Port `processModuleFromAnalysis` logic

**Implementation**:
```javascript
// When module has default + named exports:
if (exports.default && exportKeys.length > 0) {
  // Attach named exports as properties on the default
  for (const key of exportKeys) {
    exports.default[key] = exports[key];
  }
  // Assign the enhanced default as the namespace
  target[propertyName] = exports.default;
  return;
}
```

### 3. **Add Function Name Preference Logic** (Fixes Issues #5 Problem 1, #7)
**Priority**: HIGH - Affects many technical terms (IP, JSON, HTTP, API)
**Files to modify**:
- Create `src3/lib/helpers/naming.mjs` - Port `applyFunctionNamePreference` from v2
- Update `src3/lib/modes/eager.mjs` - Use function names over sanitized names
- Update `src3/lib/modes/lazy.mjs` - Same for lazy mode

**Implementation**:
```javascript
// Check if module has single export matching filename
function applyFunctionNamePreference(mod, fileName, sanitizedName) {
  const keys = Object.keys(mod).filter(k => k !== 'default');
  
  // Single named export
  if (keys.length === 1 && typeof mod[keys[0]] === 'function') {
    return mod[keys[0]].name || sanitizedName;
  }
  
  // Single default function
  if (mod.default && typeof mod.default === 'function' && keys.length === 0) {
    return mod.default.name || sanitizedName;
  }
  
  return sanitizedName;
}
```

### 4. **Fix Auto-Flattening for Single Named Exports** (Fixes Issue #5 Problem 2)
**Priority**: MEDIUM - Affects parseJSON-style modules
**Files to modify**:
- `src3/lib/helpers/flatten.mjs` - Update flattening decision logic

**Implementation**:
```javascript
// In getFlatteningDecision:
// Check if single named export's name is "similar" to filename
// (accounting for case differences and sanitization)
if (moduleKeys.length === 1 && !mod.default) {
  const exportName = moduleKeys[0];
  const normalizedExport = exportName.toLowerCase().replace(/[^a-z0-9]/g, '');
  const normalizedFile = apiPathKey.toLowerCase().replace(/[^a-z0-9]/g, '');
  
  if (normalizedExport === normalizedFile) {
    // Flatten: use export directly
    return { shouldFlatten: true, useAutoFlattening: true };
  }
}
```

### 5. **Fix Category Building** (Fixes Issue #6)
**Priority**: HIGH - Core API building logic
**Files to modify**:
- `src3/lib/modes/eager.mjs` - `_buildCategory` method
- Check if it processes BOTH files AND subdirectories at category level

**Investigation needed**:
- Does `_buildCategory` load category-level files (e.g., logger/logger.mjs)?
- Does it merge those with subdirectory results (logger/utils/)?
- Port v2's `buildCategoryDecisions` if needed

### 6. **Port Hooks System** (Fixes Issue #8)
**Priority**: CRITICAL - Completely missing feature
**Files to create/modify**:
- Create `src3/lib/hooks/` directory
- Port hooks implementation from `src/lib/hooks/`
- Integrate into slothlet instance creation

**Components**:
- Event system for lifecycle hooks
- beforeLoad, afterLoad, beforeCall, afterCall hooks
- Hook management API: on, off, enable, disable, clear, list

### 7. **Document Breaking Changes** (Issue #9)
**Priority**: LOW - Documentation only
**Files to create**:
- `docs/BREAKING-CHANGES-V3.md`

**Content**:
- Document `api.slothlet.*` namespace (new in v3)
- Document instance management methods
- Note removal of `api.hooks.*` in favor of new hook system
- Explain architectural improvements

### 8. **Testing & Validation**
**Priority**: CONTINUOUS
**Tasks**:
- Run inspector after each fix
- Compare v3 output to v2 baselines
- Ensure all test cases pass
- Add new tests for v3-specific features
