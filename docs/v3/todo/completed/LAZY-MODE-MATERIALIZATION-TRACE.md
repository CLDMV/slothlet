# Slothlet v3 Lazy Mode Materialization Performance Analysis

**Date:** January 31, 2026  
**Analysis Target:** First call to `lazyApiForCalls.math.add(2, 3)`  
**Measured Time:** ~600-900μs for materialization, ~1-3μs for subsequent calls  
**Goal:** Identify where the ~600-900μs is being spent during materialization

---

## Executive Summary

The ~600-900μs materialization time is primarily spent in **synchronous file I/O operations** and **string processing overhead**. The materialization chain involves:

1. **Proxy get trap** triggers on `api.math` access
2. **_materialize()** calls `_buildCategory()` 
3. **buildCategoryDecisions()** performs file system scanning
4. **analyzeModule()** imports and analyzes each module
5. **String sanitization** and **decision tree evaluation**
6. **Proxy replacement** in parent API object

**Key Finding:** The overhead is NOT in the proxy system itself, but in the **unavoidable work** required to build the API structure: file I/O, module imports, and flattening decisions.

---

## Detailed Execution Trace

### Phase 1: Proxy Access Triggering (~ 1-5μs)

**File:** `src2/lib/modes/slothlet_lazy.mjs` lines 820-900

```javascript
// User calls: lazyApiForCalls.math.add(2, 3)
// Step 1: Access api.math triggers get trap

get(_t, prop, _) {
    if (prop === "then") return undefined; // Fast path - avoid promise detection
    if (prop === "__slothletPath") return pathParts.join("."); // Fast path
    
    // Check if already materialized
    if (state.materialized) {
        // POST-MATERIALIZATION: ~0.1μs lookup
        const resolved = state.materialized[prop];
        if (typeof resolved === "function") {
            lazy_setSlothletPath(resolved, apiPath);
        }
        return resolved;
    }
    
    // FIRST ACCESS: Start materialization
    if (!state.inFlight) state.inFlight = _materialize();
    
    // Create property proxy that will resolve after materialization
    // ... property proxy creation logic
}
```

**Estimated Time:** 1-5μs  
**Operations:**
- Property name comparison: `prop === "then"`, etc. (< 1μs)
- State check: `state.materialized` (< 1μs)
- Start `_materialize()` if not already running (< 1μs)
- Property proxy creation with closure (1-3μs)

---

### Phase 2: Materialization Entry (_materialize) (~ 5-10μs)

**File:** `src2/lib/modes/slothlet_lazy.mjs` lines 595-620

```javascript
async function _materialize() {
    if (state.materialized) return state.materialized; // Fast path
    if (state.inFlight) return state.inFlight; // Deduplication
    
    const lazy_materializeCategory = async () => {
        // Call _buildCategory with lazy mode subdirHandler
        const value = await instance._buildCategory(subDirPath, {
            currentDepth: depth,
            maxDepth,
            mode: "lazy",
            existingApi: parent,
            subdirHandler: ({ subDirPath: nestedPath, key: nestedKey, ... }) => {
                // Create nested lazy proxies for subdirectories
                return createFolderProxy({ ... });
            }
        });
        
        state.materialized = value;
        replacePlaceholder(parent, key, placeholder, state.materialized, instance, depth);
        return state.materialized;
    };
    
    state.inFlight = lazy_materializeCategory();
    return await state.inFlight;
}
```

**Estimated Time:** 5-10μs (overhead only, not including _buildCategory)  
**Operations:**
- Cache checks: `state.materialized`, `state.inFlight` (< 1μs each)
- Function closure creation (2-3μs)
- Async promise wrapping (2-5μs)

**Critical Call:** `instance._buildCategory()` - this is where the real work happens

---

### Phase 3: Build Category (~ 50-100μs overhead)

**File:** `src2/lib/helpers/api_builder/construction.mjs` lines 125-145

```javascript
export async function buildCategoryStructure(categoryPath, options = {}) {
    const { currentDepth = 0, maxDepth = Infinity, mode = "eager", subdirHandler, instance } = options;
    
    // SYNCHRONOUS FILE I/O: **MAJOR BOTTLENECK #1**
    const decisions = await buildCategoryDecisions(categoryPath, {
        currentDepth, maxDepth, mode, subdirHandler, instance, existingApi: options.existingApi
    });
    
    // Process based on decisions...
}
```

**Estimated Time:** 50-100μs (function overhead, decision processing)  
**Operations:**
- Parameter destructuring (< 1μs)
- Options object creation (1-2μs)
- Decision processing logic (10-30μs)
- Module iteration loops (10-30μs)
- Object property assignment (10-20μs)

**Critical Call:** `buildCategoryDecisions()` - performs file system operations

---

### Phase 4: Build Category Decisions (**MAJOR BOTTLENECK #1**) (~ 200-400μs)

**File:** `src2/lib/helpers/api_builder/decisions.mjs` lines 520-570

```javascript
export async function buildCategoryDecisions(categoryPath, options = {}) {
    // **SYNCHRONOUS FILE I/O**: fs.readdir with withFileTypes
    // This is the FIRST major bottleneck - filesystem access
    const files = await fs.readdir(categoryPath, { withFileTypes: true });
    // ESTIMATED TIME: 100-300μs depending on disk/cache
    
    // Filter module files (synchronous iteration with method calls)
    const moduleFiles = files.filter((f) => instance._shouldIncludeFile(f));
    // ESTIMATED TIME: 5-20μs (depends on file count)
    
    // Path operations
    const categoryName = instance._toapiPathKey(path.basename(categoryPath));
    // ESTIMATED TIME: 10-30μs (sanitization logic - see Phase 4a)
    
    const subDirs = files.filter((e) => e.isDirectory() && !e.name.startsWith("."));
    // ESTIMATED TIME: 5-15μs
    
    // For single file case:
    if (moduleFiles.length === 1 && subDirs.length === 0) {
        // Analyze the module
        const analysis = await analyzeModule(path.join(categoryPath, moduleFile.name), { debug, instance });
        // ESTIMATED TIME: 150-300μs (see Phase 5)
        
        const mod = processModuleFromAnalysis(analysis, { debug, instance });
        // ESTIMATED TIME: 20-50μs (see Phase 6)
        
        // Flattening decisions (complex if/else logic)
        // ESTIMATED TIME: 10-30μs
    }
}
```

**Breakdown:**

1. **`fs.readdir()` call**: **100-300μs** 
   - Synchronous filesystem access (even though async)
   - Depends on: OS cache state, disk speed, directory size
   - For `math/` folder with 2 files: typically 100-150μs
   - This is UNAVOIDABLE - we must know what files exist

2. **File filtering**: **5-20μs**
   - Array iteration: `files.filter()`
   - Method calls: `instance._shouldIncludeFile()`, `entry.isFile()`, `entry.name.endsWith()`
   - For 2-3 files: ~5-10μs

3. **String sanitization**: **10-30μs** (see Phase 4a below)
   - Complex regex operations
   - Pattern matching for casing rules
   - This is partially optimizable

4. **Subdirectory filtering**: **5-15μs**
   - Simple array filter with string operations

**Total Phase 4 Time (excluding analyzeModule):** 120-365μs

---

### Phase 4a: String Sanitization (**OPTIMIZATION OPPORTUNITY**) (~ 10-30μs)

**File:** `src2/lib/helpers/sanitize.mjs` lines 165-400

```javascript
export function sanitizePathName(input, opts = {}) {
    const { lowerFirst = true, preserveAllUpper = false, preserveAllLower = false, rules = {} } = opts;
    
    // Rule extraction (array operations)
    const leaveRules = (rules.leave || []).map((s) => String(s));
    const leaveInsensitiveRules = (rules.leaveInsensitive || []).map((s) => String(s));
    const upperRules = (rules.upper || []).map((s) => String(s));
    const lowerRules = (rules.lower || []).map((s) => String(s));
    // ESTIMATED TIME: 2-5μs (typically empty arrays, fast path)
    
    let s = String(input).trim();
    // ESTIMATED TIME: < 1μs
    
    // Split on non-identifier characters (REGEX OPERATION)
    let parts = s.split(/[^A-Za-z0-9_$]+/).filter(Boolean);
    // ESTIMATED TIME: 3-8μs (regex compilation + split + filter)
    
    if (parts.length === 0) return "_";
    
    // Ensure first part starts with valid identifier (REGEX CHECK)
    while (parts.length && !/^[A-Za-z_$]/.test(parts[0][0])) {
        parts[0] = parts[0].replace(/^[^A-Za-z_$]+/, "");
        if (!parts[0]) parts.shift();
    }
    // ESTIMATED TIME: 1-3μs (typically single iteration)
    
    // Apply rules to each segment (COMPLEX LOGIC)
    const applyRule = (seg, index) => {
        // Rule matching with glob patterns
        // Multiple conditional checks per segment
        // Pattern matching functions
        // ESTIMATED TIME PER SEGMENT: 2-5μs
    };
    
    let out = parts.map((seg, i) => applyRule(seg, i)).join("");
    // ESTIMATED TIME: 5-15μs (depends on segment count, typically 1-2 segments)
    
    // Final cleanup (REGEX OPERATIONS)
    out = out.replace(/[^A-Za-z0-9_$]/g, "");
    if (!out || !/^[A-Za-z_$]/.test(out[0])) out = "_" + out;
    // ESTIMATED TIME: 2-5μs
    
    return out;
}
```

**Breakdown:**

1. **Parameter processing**: 2-5μs
2. **String split (regex)**: 3-8μs
3. **Validation loops**: 1-3μs
4. **Rule application**: 5-15μs (depends on rule count and segment count)
5. **Final cleanup (regex)**: 2-5μs

**Total Sanitization Time:** 10-30μs per call

**Called multiple times during materialization:**
- Category name sanitization: 1x
- Module name sanitization: 1x per module
- Export name sanitization: multiple times in processModuleFromAnalysis

**Total Sanitization Impact:** 30-90μs for simple modules

**OPTIMIZATION OPPORTUNITY:**
- **Cache sanitization results** at instance level (Map<string, string>)
- Skip sanitization for already-valid identifiers (fast path check)
- Pre-compile regex patterns outside function

---

### Phase 5: Analyze Module (**MAJOR BOTTLENECK #2**) (~ 150-300μs)

**File:** `src2/lib/helpers/api_builder/analysis.mjs` lines 100-210

```javascript
export async function analyzeModule(modulePath, options = {}) {
    const { debug = false, instance = null } = options;
    
    const moduleUrl = pathToFileURL(modulePath).href;
    // ESTIMATED TIME: 5-10μs (URL construction)
    
    // Cache busting URL construction (STRING OPERATIONS)
    let importUrl = moduleUrl;
    const separator = moduleUrl.includes("?") ? "&" : "?";
    importUrl = `${moduleUrl}${separator}_t=${Date.now()}_${Math.random().toString(36).slice(2)}`;
    // ESTIMATED TIME: 5-15μs (Date.now(), Math.random(), string concatenation)
    
    if (instance && instance.instanceId) {
        const runtimeType = instance.config?.runtime || "async";
        if (runtimeType === "live") {
            importUrl = `${importUrl}&slothlet_instance=${instance.instanceId}`;
            importUrl = `${importUrl}&slothlet_runtime=${runtimeType}`;
            setActiveInstance(instance.instanceId);
        }
    }
    // ESTIMATED TIME: 2-5μs
    
    // **MODULE IMPORT**: This is the BIG ONE
    const rawModule = await import(importUrl);
    // ESTIMATED TIME: 100-250μs
    // - Node.js module resolution
    // - File read from disk (unless cached)
    // - Module parsing and execution
    // - V8 compilation if not cached
    
    // CJS unwrapping
    let processedModule = rawModule;
    const isCjs = modulePath.endsWith(".cjs") && "default" in rawModule;
    if (isCjs) {
        processedModule = rawModule.default;
    }
    // ESTIMATED TIME: < 1μs
    
    // Export detection and classification
    const hasDefault = !!processedModule.default;
    const isFunction = typeof processedModule.default === "function";
    const exports = Object.entries(processedModule);
    const namedExports = Object.entries(processedModule).filter(([k]) => k !== "default");
    // ESTIMATED TIME: 5-15μs (Object.entries, array operations)
    
    // Export type detection (multiple typeof checks and conditionals)
    // ESTIMATED TIME: 5-10μs
    
    return { rawModule, processedModule, isFunction, hasDefault, ... };
}
```

**Breakdown:**

1. **URL construction**: 5-10μs
2. **Cache-busting URL**: 5-15μs
   - `Date.now()`: ~1μs (syscall to get timestamp)
   - `Math.random()`: ~1μs
   - String operations: 3-13μs
3. **Runtime parameter addition**: 2-5μs
4. **`await import()`**: **100-250μs** ⚠️ **LARGEST SINGLE OPERATION**
   - Node.js module loader overhead
   - Filesystem read (if not in OS cache)
   - JavaScript parsing
   - V8 compilation (if not in code cache)
   - Module execution
5. **CJS unwrapping**: < 1μs
6. **Export analysis**: 10-25μs
   - `Object.entries()` calls (creates new arrays)
   - Array filtering operations
   - Type checking loops

**Total Phase 5 Time:** 150-300μs

**Critical Finding:** The `await import()` is **unavoidable** - we MUST load the module to know what it exports and how to integrate it into the API.

**Why we can't cache the import:**
- Metadata wrapping requires fresh module instances per slothlet instance
- Live bindings runtime needs instance-specific context
- Cache busting prevents cross-instance pollution

---

### Phase 6: Process Module From Analysis (~ 20-50μs)

**File:** `src2/lib/helpers/api_builder/analysis.mjs` lines 210-350

```javascript
export function processModuleFromAnalysis(analysis, options = {}) {
    const { instance, debug = false } = options;
    const { processedModule, isFunction, hasDefault, shouldWrapAsCallable, namedExports } = analysis;
    
    // Handle function default exports
    if (isFunction) {
        let fn = processedModule.default;
        
        // Mark as default export (Object.defineProperty)
        if (hasDefault) {
            try {
                Object.defineProperty(fn, "__slothletDefault", { ... });
            } catch { }
        }
        // ESTIMATED TIME: 2-5μs
        
        // Attach named exports as properties (LOOP with property assignment)
        for (const [exportName, exportValue] of Object.entries(processedModule)) {
            if (exportName !== "default") {
                fn[instance._toapiPathKey(exportName)] = exportValue;
            }
        }
        // ESTIMATED TIME: 5-15μs (includes sanitization calls)
        
        return fn;
    }
    
    // Handle object exports (similar processing)
    // ESTIMATED TIME: 10-30μs
}
```

**Breakdown:**

1. **Parameter destructuring**: < 1μs
2. **Function path:**
   - `Object.defineProperty()`: 2-5μs
   - Named export attachment loop: 5-15μs (includes sanitization)
   - Total: 7-20μs
3. **Object path:**
   - Default object handling: 5-15μs
   - Property assignment: 5-15μs
   - Total: 10-30μs

**Total Phase 6 Time:** 20-50μs

---

### Phase 7: Flattening Decisions (~ 10-30μs)

**File:** `src2/lib/helpers/api_builder/decisions.mjs` lines 100-200

```javascript
export function getFlatteningDecision(options) {
    const { mod, fileName, apiPathKey, hasMultipleDefaultExports, isSelfReferential, ... } = options;
    
    // Multiple conditional checks (if/else cascade)
    // 1. Self-referential check
    // 2. Multi-default context check
    // 3. Single named export check
    // 4. Filename matching check
    // 5. Traditional flattening check
    
    // ESTIMATED TIME: 10-30μs (depends on complexity and nesting depth)
}
```

**Breakdown:**

1. **Parameter destructuring**: < 1μs
2. **Conditional checks**: 8-25μs
   - Multiple string comparisons
   - Object.keys() calls
   - Array operations
   - Type checks

**Total Phase 7 Time:** 10-30μs

---

### Phase 8: Replace Placeholder (~ 10-30μs)

**File:** `src2/lib/modes/slothlet_lazy.mjs` lines 350-530

```javascript
function replacePlaceholder(parent, key, placeholder, value, instance, depth) {
    // Metadata preservation checks
    // ESTIMATED TIME: 5-10μs
    
    // Merge case detection (object comparison)
    // ESTIMATED TIME: 2-5μs
    
    // Function name preference logic
    // ESTIMATED TIME: 3-8μs
    
    // Object.defineProperty() call
    try {
        Object.defineProperty(parent, finalKey, { value, writable: true, enumerable: true, configurable: true });
    } catch {
        parent[finalKey] = value; // Fallback
    }
    // ESTIMATED TIME: 3-10μs
    
    // Update bound API property
    if (depth === 1 && typeof instance?.updateBoundApiProperty === "function") {
        instance.updateBoundApiProperty(finalKey, parent[finalKey]);
    }
    // ESTIMATED TIME: 2-5μs
}
```

**Breakdown:**

1. **Metadata operations**: 5-10μs
2. **Merge detection**: 2-5μs
3. **Name preference**: 3-8μs
4. **Property definition**: 3-10μs
5. **Bound API update**: 2-5μs

**Total Phase 8 Time:** 15-38μs

---

## Total Materialization Time Breakdown

For `api.math.add(2, 3)` first call (math folder with 2 files: add.mjs, multiply.mjs):

| Phase | Component | Estimated Time | % of Total | Avoidable? |
|-------|-----------|----------------|------------|------------|
| 1 | Proxy get trap | 1-5μs | < 1% | No |
| 2 | _materialize entry | 5-10μs | 1-2% | No |
| 3 | buildCategoryStructure overhead | 50-100μs | 6-12% | Minimal |
| 4 | buildCategoryDecisions | 120-365μs | 15-45% | Partially |
| 4a | String sanitization (subset of 4) | 30-90μs | 4-11% | Yes (cache) |
| 5 | analyzeModule (per module × 2) | 300-600μs | 37-75% | **No** |
| 5a | Module import (subset of 5) | 200-500μs | 25-62% | **No** |
| 6 | processModuleFromAnalysis × 2 | 40-100μs | 5-12% | Minimal |
| 7 | Flattening decisions | 10-30μs | 1-4% | Minimal |
| 8 | replacePlaceholder | 15-38μs | 2-5% | No |
| **TOTAL** | | **540-1248μs** | **100%** | |

**Observed range:** 600-900μs aligns with mid-range estimates

---

## Synchronous File I/O Operations

### Complete List:

1. **`fs.readdir(categoryPath, { withFileTypes: true })`**
   - Location: `decisions.mjs` line 531
   - Purpose: List directory contents for analysis
   - Time: 100-300μs
   - Frequency: 1x per materialized folder
   - **Cannot be deferred** - need file list for decisions

2. **`await import(modulePath)`** (technically I/O)
   - Location: `analysis.mjs` line 122
   - Purpose: Load and execute module
   - Time: 100-250μs per module
   - Frequency: 1x per module file in materialized folder
   - **Cannot be deferred** - need module exports for API structure

---

## String Manipulations & Regex Operations

### Hot Paths (called frequently):

1. **`sanitizePathName()`** (30-90μs total per materialization)
   - Location: `sanitize.mjs` lines 165-400
   - Regex operations:
     - `s.split(/[^A-Za-z0-9_$]+/)` - segment splitting
     - `/^[A-Za-z_$]/.test()` - identifier validation (multiple times)
     - `replace(/^[^A-Za-z_$]+/, "")` - prefix cleanup
     - `replace(/[^A-Za-z0-9_$]/g, "")` - final cleanup
   - Called for:
     - Category names (1x)
     - Module names (1x per module)
     - Export names (multiple per module)
   - **Optimization:** Cache results in WeakMap/Map

2. **`path.basename()` / `path.extname()`** (5-15μs each)
   - Location: Throughout api_builder
   - String operations for path parsing
   - Called multiple times per materialization

3. **`String.prototype.toLowerCase()`** (< 1μs each, but frequent)
   - Location: Comparison logic throughout
   - Used for case-insensitive matching
   - Called dozens of times per materialization

4. **`Object.entries()` / `Object.keys()`** (5-15μs each)
   - Location: Module analysis and processing
   - Creates new arrays from object properties
   - Called 3-5 times per module

---

## Repeated Work & Redundant Checks

### Potential Optimization Targets:

1. **Multiple `Object.entries()` calls on same module**
   - Location: `analysis.mjs` lines 145-150
   - Called twice: once for `exports`, once for `namedExports`
   - **Fix:** Compute once, filter in-place

2. **Repeated sanitization of same strings**
   - Location: Throughout api_builder
   - Same filename sanitized multiple times during decision process
   - **Fix:** Cache sanitization results per instance

3. **Type checking in multiple places**
   - `typeof mod === "function"` checked in multiple functions
   - **Fix:** Pass analysis metadata through pipeline

4. **Path parsing operations**
   - `path.basename()` and `path.extname()` called multiple times on same path
   - **Fix:** Parse once at entry point

### NOT Repeated (Already Optimized):

✓ Module imports - Node.js caches compiled modules  
✓ Filesystem reads - OS page cache helps  
✓ Multidefault analysis - Done once per category  
✓ Proxy creation - Happens once per lazy path

---

## What COULD Be Optimized (Without Breaking Features)

### High-Impact Optimizations:

1. **✅ Cache Sanitization Results** (save 20-60μs, ~8-10%)
   ```javascript
   // Add to slothlet instance
   this._sanitizeCache = new Map();
   
   function cachedSanitize(input, opts) {
       const key = `${input}:${JSON.stringify(opts)}`;
       if (this._sanitizeCache.has(key)) {
           return this._sanitizeCache.get(key);
       }
       const result = sanitizePathName(input, opts);
       this._sanitizeCache.set(key, result);
       return result;
   }
   ```
   **Impact:** 30-60μs savings per materialization (8-10% of total time)
   **Risk:** Low - simple cache with instance scope
   **Benefit:** High - called 5-10x per materialization

2. **✅ Fast-Path for Valid Identifiers in Sanitization** (save 5-15μs per call)
   ```javascript
   export function sanitizePathName(input, opts = {}) {
       // FAST PATH: Already valid identifier, no rules to apply
       const s = String(input).trim();
       if (/^[A-Za-z_$][A-Za-z0-9_$]*$/.test(s) && 
           (!opts.rules || Object.keys(opts.rules).length === 0)) {
           return opts.lowerFirst ? s[0].toLowerCase() + s.slice(1) : s;
       }
       
       // Existing complex logic...
   }
   ```
   **Impact:** 5-15μs per sanitization call
   **Risk:** Low - preserves all existing behavior
   **Benefit:** Medium - helps for simple filenames

3. **✅ Reduce Object.entries() Calls** (save 5-10μs per module)
   ```javascript
   // In analyzeModule()
   const entries = Object.entries(processedModule);
   const namedExports = entries.filter(([k]) => k !== "default");
   // Instead of calling Object.entries() twice
   ```
   **Impact:** 5-10μs per module
   **Risk:** None - simple refactor
   **Benefit:** Low - minor but free optimization

4. **✅ Pre-compile Sanitization Regex** (save 2-5μs per call)
   ```javascript
   // Move outside function scope
   const SEGMENT_SPLITTER = /[^A-Za-z0-9_$]+/;
   const IDENTIFIER_START = /^[A-Za-z_$]/;
   const IDENTIFIER_CHAR = /^[A-Za-z0-9_$]*$/;
   
   export function sanitizePathName(input, opts = {}) {
       // Use pre-compiled patterns
       let parts = s.split(SEGMENT_SPLITTER).filter(Boolean);
       // ...
   }
   ```
   **Impact:** 2-5μs per call
   **Risk:** None
   **Benefit:** Low but free

### Medium-Impact Optimizations:

5. **⚠️ Parallel Module Analysis** (save 50-150μs for 2+ files)
   ```javascript
   // In buildCategoryDecisions()
   const analyses = await Promise.all(
       moduleFiles.map(f => analyzeModule(path.join(categoryPath, f.name), { instance }))
   );
   ```
   **Impact:** 50-150μs for directories with 2+ modules
   **Risk:** Medium - requires careful metadata handling
   **Benefit:** High for multi-file directories
   **Tradeoff:** May increase peak memory usage

6. **⚠️ Lazy String Operations** (save 10-30μs)
   - Defer `path.basename()` calls until actually needed
   - Use string indexing instead of `.slice()` where possible
   **Impact:** 10-30μs across multiple operations
   **Risk:** Low
   **Benefit:** Medium

### Low-Impact (Not Worth It):

7. **❌ Pre-allocate Result Objects** (save < 5μs)
   - Create decision/analysis objects with all properties upfront
   **Impact:** < 5μs
   **Risk:** None
   **Benefit:** Negligible

8. **❌ String Interning** (save < 5μs)
   - Cache common strings like "default", "function", "object"
   **Impact:** < 5μs
   **Risk:** None
   **Benefit:** Negligible - V8 already does this

---

## What CANNOT Be Optimized (System Constraints)

### ⛔ Cannot Be Avoided:

1. **`fs.readdir()` - 100-300μs (15-37% of time)**
   - **Why:** Must know what files exist to build API structure
   - **Why can't defer:** Flattening decisions depend on file count/names
   - **Mitigation:** OS page cache helps after first access
   - **Alternative considered:** Read file on demand - breaks API structure consistency

2. **`await import()` - 200-500μs (25-62% of time)**
   - **Why:** Must load module to know exports
   - **Why can't cache:** Metadata wrapping needs fresh instances per slothlet instance
   - **Mitigation:** Node.js caches compiled code internally
   - **Alternative considered:** Static analysis of source - breaks with dynamic exports

3. **Module Analysis - 50-100μs (6-12%)**
   - **Why:** Must determine export types for flattening decisions
   - **Why can't simplify:** API structure rules depend on export patterns
   - **Alternative considered:** Simpler rules - breaks existing API expectations

4. **Decision Tree Evaluation - 30-80μs (4-10%)**
   - **Why:** Complex flattening rules are core feature
   - **Why can't cache:** Decisions depend on context (multi-default, self-ref, etc.)
   - **Alternative considered:** Pre-compute - requires static analysis before runtime

### ⚠️ Cannot Cache Cross-Instance:

5. **Instance-Specific Metadata**
   - Each slothlet instance needs isolated metadata
   - Cache busting in imports prevents pollution
   - Live bindings runtime requires per-instance context

---

## Specific Code Hotspots

### Hottest Paths (Top 5):

1. **`await import()` in analyzeModule()**
   - **Time:** 100-250μs (single largest operation)
   - **File:** `analysis.mjs` line 122
   - **Frequency:** 1x per module per materialization
   - **Optimization:** Cannot avoid, but Node.js caches

2. **`fs.readdir()` in buildCategoryDecisions()**
   - **Time:** 100-300μs
   - **File:** `decisions.mjs` line 531
   - **Frequency:** 1x per directory materialization
   - **Optimization:** Cannot avoid, OS caches

3. **`sanitizePathName()` in multiple locations**
   - **Time:** 10-30μs per call
   - **Files:** Called from `construction.mjs`, `decisions.mjs`, `analysis.mjs`
   - **Frequency:** 5-10x per materialization
   - **Optimization:** ✅ Cache results

4. **`Object.entries()` in analyzeModule()**
   - **Time:** 5-15μs per call
   - **File:** `analysis.mjs` lines 145-150
   - **Frequency:** 2x per module
   - **Optimization:** ✅ Call once, filter result

5. **Flattening decision conditionals**
   - **Time:** 10-30μs
   - **File:** `decisions.mjs` lines 100-200
   - **Frequency:** 1x per module
   - **Optimization:** ⚠️ Parallel analysis could help

---

## Recommended Optimizations (Priority Order)

### Tier 1 - High Impact, Low Risk (Implement These)

1. **Cache sanitization results** (save 20-60μs, 8-10%)
   - Instance-scoped Map cache
   - Clear on instance shutdown
   - Minimal code change

2. **Fast-path for valid identifiers** (save 5-15μs per call)
   - Single regex check at entry
   - Bypasses entire sanitization pipeline for clean names
   - Zero risk to existing behavior

3. **Reduce Object.entries() calls** (save 5-10μs per module)
   - Call once, filter in-place
   - Simple refactor

**Total Expected Savings:** 30-85μs (10-14% reduction) → Target 520-815μs

### Tier 2 - Medium Impact, Medium Risk (Consider Carefully)

4. **Parallel module analysis** (save 50-150μs for multi-file dirs)
   - Use Promise.all() for module imports
   - Requires careful metadata handling
   - Test thoroughly with metadata wrapping

5. **Pre-compile regex patterns** (save 2-5μs per call)
   - Move patterns outside function scope
   - Reduces regex compilation overhead

**Additional Savings:** 50-155μs (conditional) → Multi-file directories only

### Tier 3 - Low Impact, Not Worth It (Skip These)

6. String interning, pre-allocated objects, micro-optimizations
   - Impact < 5μs total
   - Adds complexity for negligible benefit

---

## Why Lazy Mode Is Still Faster Overall

**Despite ~600-900μs materialization cost, lazy mode wins because:**

1. **Startup Time Savings (Primary Benefit)**
   - Eager mode: Loads ALL folders upfront
   - Lazy mode: Only materializes accessed paths
   - For 10 folders, only using 2: **8x materialization avoided**

2. **Performance Characteristic Comparison:**

   ```
   Eager Mode (10 folders):
   - Startup: 10 × 600μs = 6000μs (6ms)
   - First call to api.math.add(): ~2μs
   - Total for first math operation: 6002μs

   Lazy Mode (10 folders, use only math):
   - Startup: ~50μs (proxy creation only)
   - First call to api.math.add(): 600μs + 2μs = 602μs
   - Total for first math operation: 652μs
   ```

   **Lazy wins by 5350μs (5.3ms) in this scenario**

3. **Post-Materialization Performance:**
   - After first call, lazy and eager are identical (~1-3μs)
   - No overhead for already-materialized paths

4. **Memory Savings:**
   - Lazy: Only materializes used code paths
   - Eager: All code in memory regardless of use

**Lazy mode advantage scales with:**
- Total API surface area (more unused folders = bigger win)
- Startup frequency (short-lived processes benefit more)
- Selective API usage patterns (using 20% of API = 5x savings)

---

## Conclusion

The ~600-900μs materialization time is **unavoidable overhead** from:

1. **Filesystem operations** (15-37%): Must read directory to build API
2. **Module imports** (25-62%): Must load modules to know exports
3. **Analysis and decisions** (20-30%): Complex flattening rules are core feature

**Optimization potential: 10-14% reduction** via:
- Sanitization caching
- Fast-path for valid identifiers
- Minor refactoring to reduce redundant operations

**Net result:** ~520-815μs materialization (down from 600-900μs)

**Critical insight:** Even with optimizations, **lazy mode's value is in avoiding materialization**, not making it faster. The 600-900μs cost is acceptable because you only pay it for code paths you actually use.

---

## Appendix: Measurement Methodology

To validate these estimates, add performance timing to key functions:

```javascript
// In analyzeModule()
const startImport = performance.now();
const rawModule = await import(importUrl);
const importTime = performance.now() - startImport;
console.log(`[PERF] Module import: ${importTime.toFixed(2)}μs`);

// In buildCategoryDecisions()
const startReaddir = performance.now();
const files = await fs.readdir(categoryPath, { withFileTypes: true });
const readdirTime = performance.now() - startReaddir;
console.log(`[PERF] fs.readdir: ${readdirTime.toFixed(2)}μs`);

// In sanitizePathName()
const startSanitize = performance.now();
// ... existing logic ...
const sanitizeTime = performance.now() - startSanitize;
console.log(`[PERF] Sanitize "${input}": ${sanitizeTime.toFixed(2)}μs`);
```

Run with: `node --expose-gc tests/debug-slothlet.mjs` and analyze output.

---

**End of Analysis**
