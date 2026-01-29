# Hooks System Implementation

**Status:** ❌ NOT IMPLEMENTED (Stubbed)  
**Priority:** 🔴 HIGH - Major V2 feature missing from V3  
**Complexity:** HIGH - Full interceptor framework with pattern matching  
**Related:** [docs/HOOKS.md](../../HOOKS.md) - Complete V2 documentation (788 lines)

---

### How to Run Tests Properly

**⚠️ IMPORTANT: Always tail test output (last 40 lines):**
```powershell
npm run debug 2>&1 | Select-Object -Last 40
npm run testv3 -- --baseline 2>&1 | Select-Object -Last 40
```

**Why tail?**
- ❌ **WRONG:** Running without tailing shows the START of output, not results
- ✅ **CORRECT:** Tailing last 40 lines shows the RESULTS at the end

**📋 When hooks tests pass 100%:**
- Add hooks-related test files to `tests/vitests/baseline-tests.json`
- But ONLY if `npm run debug` AND `npm run testv3 -- --baseline` both pass
- This ensures we catch regressions in working tests immediately

---

## Current State

**V3 Status**: API surface exists but throws `NOT_IMPLEMENTED` errors

**Stubbed Methods** (in `src/lib/builders/api_builder.mjs`):
- `api.slothlet.hook.on(typePattern, handler, options)` - Hook registration (typePattern: "type:pattern", e.g., "before:math.*")
- `api.slothlet.hook.remove(filter)` - Hook removal by filter ({ pattern, id, type })
- `api.slothlet.hook.clear(filter?)` - Alias for remove() - removes hooks matching filter
- `api.slothlet.hook.enable(filter?)` - Enable hooks (all or by filter object)
- `api.slothlet.hook.disable(filter?)` - Disable hooks (all or by filter object)
- `api.slothlet.hook.list(filter?)` - List registered hooks (all or filtered)

All methods throw:
```javascript
throw new this.SlothletError("NOT_IMPLEMENTED", {
    feature: "slothlet.hook.*",
    hint: "Hooks system deferred to next prototype iteration"
});
```

---

## V2 Implementation Reference

### Core Hook Types

1. **`before` hooks** - Execute before function call
   - Can mutate arguments (return array of new args)
   - Can short-circuit execution (return value directly)
   - Chained by priority (highest first)
   - **MUST be in execution chain** - Modifies behavior, blocks execution

2. **`after` hooks** - Execute after function returns
   - Transform return value (chaining)
   - Cannot prevent function execution
   - Receive original args + return value
   - **MUST be in execution chain** - Modifies return value, blocks execution

3. **`always` hooks** - Execute regardless of function execution outcome
   - Fires whether function succeeds, fails, or is short-circuited
   - Read-only observer pattern
   - Receives result or error from execution
   - Cannot modify behavior
   - **MUST be in execution chain** - Timing guarantees (fires before caller receives result)
   - **Note**: Only fires if function execution is attempted (requires path to exist)

4. **`error` hooks** - Execute on errors only
   - Detailed error context with source tracking
   - Can suppress errors (report without throwing)
   - Source phases: before/function/after/always
   - **MUST be in execution chain** - Can prevent error propagation (suppressErrors)

**Chain Requirement Analysis:**

| Hook Type | Modifies Execution? | Can Defer/Async? | Must Be In Chain? | Reason |
|-----------|---------------------|------------------|-------------------|---------|
| `before` | ✅ Yes (args, short-circuit) | ❌ No | ✅ YES | Blocks execution, modifies inputs |
| `after` | ✅ Yes (return value) | ❌ No | ✅ YES | Transforms output, blocks return |
| `always` | ❌ No (read-only) | ❌ No | ✅ YES | Timing guarantee - must complete before return |
| `error` | ✅ Yes (suppress errors) | ❌ No | ✅ YES | Can prevent error throw |

**Why `always` hooks can't be deferred:**

Even though `always` hooks are read-only, they execute in the `finally` block which is part of the synchronous execution flow. If we deferred them:

```javascript
// Current (synchronous in chain):
const result = await api.math.add(1, 2);
// always hooks have fired by now
console.log("Done");  // User sees this after hooks complete

// If deferred (dangerous):
const result = await api.math.add(1, 2);
console.log("Done");  // User sees this first
// always hooks fire sometime later (timing unpredictable)
```

Users expect `always` hooks to complete before the function returns to the caller, maintaining execution order guarantees. Deferring would break this contract and make debugging extremely difficult.

**Conclusion:** All 4 hook types MUST be in the execution chain to maintain behavioral correctness and timing guarantees.

### Hook Registration API

**V3 Signature** (enhanced ergonomics):
```javascript
api.slothlet.hook.on(typePattern, handler, options)
```

**Parameters**:
- `typePattern` (string): Compound of type and pattern, separated by `:` (e.g., "before:math.*", "error:**")
  - Format: `"<type>:<pattern>"`
  - Type: "before", "after", "always", or "error"
  - Pattern: Glob pattern matching API paths (wildcards: `*`, `**`)
  - Examples: `"before:math.*"`, `"error:**"`, `"after:database.{create,update}"`
- `handler` (function): Hook handler function
- `options` (object, optional): Hook configuration
  - `id` (string, optional): Unique identifier (auto-generated if not provided)
  - `priority` (number, default 0): Higher = earlier execution
  - `subset` (string, default "primary"): Phase - "before", "primary", or "after"

**Examples**:
```javascript
// Simple hook with pattern
api.slothlet.hook.on("before:math.*", handler);

// Global error hook
api.slothlet.hook.on("error:**", errorHandler);

// With ID, priority, and subset
api.slothlet.hook.on("before:**", securityHandler, {
    id: "security",
    subset: "before",
    priority: 2000
});

// After hook with caching
api.slothlet.hook.on("after:**", ({ path, args, result }) => {
    const key = JSON.stringify({ path, args });
    cache.set(key, result);
    return result;
}, { priority: 100 });

// Pattern with braces
api.slothlet.hook.on("always:database.{create,update,delete}", auditHandler);
```

### Pattern Matching Features

**TypePattern Parsing**:
- Format: `"type:pattern"` where only the **FIRST** `:` is the separator
- Type: Everything before the first `:`
- Pattern: Everything after the first `:`
- Example: `"before:api:legacy:functions"` parses as:
  - Type: `"before"`
  - Pattern: `"api:legacy:functions"` (colons preserved in pattern)

**Pattern Syntax** (applied to API paths):
- Wildcards: `*` (single level), `**` (multiple levels)
- Braces: `{a,b}` (alternatives)
- Negation: `!pattern` (exclusion)
- Colons: `:` treated as literal characters in patterns (only first `:` in typePattern is special)

**Examples**:
  - `"before:database.*"` - All database functions
  - `"error:*.create"` - All create functions at any depth
  - `"always:api.{user,auth}.**"` - User and auth namespaces
  - `"after:**"` - All functions (global pattern)

### Runtime Control with Filters

```javascript
// Disable all hooks
api.slothlet.hook.disable();

// Disable hooks by pattern
api.slothlet.hook.disable({ pattern: "database.*" });

// Disable specific hook by ID
api.slothlet.hook.disable({ id: "security-check" });

// Enable all hooks
api.slothlet.hook.enable();

// Enable hooks by pattern
api.slothlet.hook.enable({ pattern: "math.*" });

// Enable specific hook types
api.slothlet.hook.enable({ type: "before" });

// Remove hooks by ID
api.slothlet.hook.remove({ id: "temp-hook" });

// Remove hooks by pattern
api.slothlet.hook.remove({ pattern: "test.*" });

// Remove hooks by type
api.slothlet.hook.remove({ type: "before" });

// Remove with multiple filters
api.slothlet.hook.remove({ type: "error", pattern: "database.*" });

// Clear is an alias for remove
api.slothlet.hook.clear({ type: "before" }); // Same as remove({ type: "before" })
api.slothlet.hook.clear(); // Remove all hooks

// List all hooks
const allHooks = api.slothlet.hook.list();

// List hooks by type
const beforeHooks = api.slothlet.hook.list({ type: "before" });

// List hooks by pattern
const mathHooks = api.slothlet.hook.list({ pattern: "math.*" });

// List enabled hooks only
const enabledHooks = api.slothlet.hook.list({ enabled: true });
```

### Error Handling

```javascript
// Error source tracking
{
    error: Error,
    source: "before" | "function" | "after" | "always",
    hookId: "hook-id",
    hookTag: "validation",
    apiPath: "api.user.create",
    timestamp: Date
}

// Error suppression
const api = await slothlet({
    hooks: {
        suppressErrors: true  // Report errors without throwing
    }
});
```

---

## Edge Cases & Behavior Clarifications

### Hook Registration for Non-Existent Paths

**Behavior**: Hooks can be registered for any API path, even if the path doesn't exist in the current API.

**Rationale**: Hooks are stored in the hook system (not attached to API functions), enabling:
- Pattern-based registration before modules are loaded
- Hook persistence across hot-reload operations
- Forward-compatible hook registration for future API additions

**Execution Rules**:
1. **Hook registration**: Always succeeds, regardless of path existence
   ```javascript
   // This succeeds even if sqrt() doesn't exist
   api.slothlet.hook.on(
       "before:math.sqrt",      // typePattern
       ({ args }) => {          // handler
           console.log("Validating sqrt args:", args);
           return args;
       },
       { id: "validate-sqrt" }  // optional ID in options
   );
   ```

2. **Hook execution with path traversal errors**: 
   
   **Critical Distinction**: When a call like `api.math.science.hard.sqrt()` is made but `api.math.science.hard` doesn't exist:
   - The UnifiedWrapper proxy system DOES get invoked (it attempts to traverse the path)
   - Error occurs INSIDE the wrapper when traversal fails
   - **`always` and `error` hooks MUST fire** for this scenario
   
   **⚠️ IMPLEMENTATION UNCERTAINTY - Requires Early Testing**:
   
   **Unknown**: Whether we can track the full requested path during traversal.
   
   **Challenge**: Each proxy `get` trap only sees the immediate property name:
   ```javascript
   // User calls: api.math.science.hard.sqrt(16)
   // Becomes a series of individual property accesses:
   get(api, "math")           // Only knows "math", not full path
   get(mathProxy, "science")  // Only knows "science", not full path
   get(scienceProxy, "hard")  // Fails here - only knows "hard"
   apply(...)                 // Never reached
   ```
   
   **Possible Solutions to Test**:
   1. **Path accumulation**: Build path incrementally through proxy chain (may work)
   2. **Stack inspection**: Try to reconstruct intent from call stack (fragile)
   3. **Partial context only**: Only report currentPath, not requestedPath (simpler but less useful)
   
   **Required Context for Hooks** (if full path tracking works):
   - **Requested path**: The full path user attempted to call (`math.science.hard.sqrt`)
   - **Current path**: Where traversal failed (`math.science` - couldn't find `hard`)
   - **Error details**: Path resolution failure
   
   **Fallback Context** (if full path tracking impossible):
   - **Current path**: Where traversal failed (`math.science`)
   - **Missing property**: What property was requested (`hard`)
   - **Error details**: Path resolution failure
   
   ```javascript
   // IDEAL (if full path tracking works):
   // always hooks receive:
   {
       requestedPath: "math.science.hard.sqrt",  // Full intended path
       currentPath: "math.science",               // Where it failed
       missingProperty: "hard",                   // What was missing
       hasError: true,
       error: "Cannot read property 'hard' of undefined",
       args: [16]
   }
   
   // FALLBACK (if only partial tracking works):
   // always hooks receive:
   {
       currentPath: "math.science",               // Where it failed
       missingProperty: "hard",                   // What was requested
       hasError: true,
       error: "Cannot read property 'hard' of undefined",
       args: [16]  // Might not be available at get trap level
   }
   
   // error hooks receive:
   {
       requestedPath: "math.science.hard.sqrt",   // If available
       currentPath: "math.science",                // Always available
       missingProperty: "hard",                    // Always available
       source: "traversal",                        // New source type!
       error: Error,
       args: [16]  // If available
   }
   ```

3. **Hook execution for existing paths**: 
   - `before` hooks: Execute before function call, can mutate args or short-circuit
   - `after` hooks: Execute after successful function return, can transform result
   - `always` hooks: Execute after any outcome (success/error/short-circuit)
   - `error` hooks: Execute only on errors (function errors, before/after hook errors, traversal errors)

**Why Path Traversal Errors Fire Hooks**:
UnifiedWrapper's proxy system intercepts ALL property access. When you call `api.math.science.hard.sqrt()`:
1. Each property access goes through proxy `get` trap
2. Final invocation goes through proxy `apply` trap  
3. Error during traversal occurs INSIDE the wrapper system
4. Hooks can observe the failure because wrapper was invoked

**Example Scenario** (assuming full path tracking works):
```javascript
const api = await slothlet({ dir: "./api", hooks: true });

// Register hooks for path that partially doesn't exist
api.slothlet.hook.on("always:math.science.hard.sqrt", ({ requestedPath, currentPath, hasError, error }) => {
    console.log("always hook fired!");
    console.log("Requested:", requestedPath);  // May not be available
    console.log("Failed at:", currentPath);
    console.log("Error:", hasError);
}, { id: "observe-sqrt" });

api.slothlet.hook.on("error:math.science.hard.sqrt", ({ requestedPath, currentPath, source, error }) => {
    console.log("error hook fired!");
    console.log("Requested:", requestedPath);  // May not be available
    console.log("Failed at:", currentPath);
    console.log("Source:", source); // "traversal"
}, { id: "catch-errors" });

// Call with partial path missing
try {
    await api.math.science.hard.sqrt(16);  // api.math.science.hard doesn't exist
} catch (error) {
    // Both always and error hooks DID fire!
    // Logs: "always hook fired!"
    // Logs: "Requested: math.science.hard.sqrt" (if full path tracking works)
    // Logs: "Failed at: math.science"
    // Logs: "Error: true"
    // Logs: "error hook fired!"
    // Logs: "Source: traversal"
}

// Later: Add missing path via hot-reload
await api.slothlet.api.add("math.science.hard", "./math-advanced");

// Now hooks execute normally (no traversal error)
await api.math.science.hard.sqrt(16);  
// always hooks fire with hasError: false
```

**⚠️ Early Implementation Testing Required**:
Before full hooks implementation, create a minimal test to verify:
1. Can we accumulate the full path during proxy traversal?
2. If not, can we provide enough context (currentPath + missingProperty)?
3. How do we handle the `apply` trap never being called (no args available)?

This will inform the final hook context API design.

**Pattern Matching Caveat**:
Wildcard patterns (`*`, `**`) match against existing API structure at registration time:
```javascript
// These hooks match existing structure
api.slothlet.hook.on("before:math.*", handler, { id: "log-all" });
// Matches: math.add, math.subtract (if they exist)
// Ignores: math.sqrt (if it doesn't exist at registration time)

// But hooks registered for specific non-existent paths can still observe traversal errors
api.slothlet.hook.on("error:math.missing.func", handler, { id: "catch-missing" });
// Will fire if someone calls api.math.missing.func() and path traversal fails
```

---

## Related Test Files

The following test files in `tests/vitests` are related to the hooks system:

- **`suites/hooks/hooks-comprehensive.test.vitest.mjs`** - Comprehensive hooks functionality tests
- **`suites/hooks/hooks-execution.test.vitest.mjs`** - Tests hook execution order and behavior
- **`suites/hooks/hooks-before-chaining.test.vitest.mjs`** - Tests chaining of before hooks
- **`suites/hooks/hooks-after-chaining.test.vitest.mjs`** - Tests chaining of after hooks
- **`suites/hooks/hooks-always-error-context.test.vitest.mjs`** - Tests always hooks and error context
- **`suites/hooks/hooks-error-source.test.vitest.mjs`** - Tests error source tracking in hooks
- **`suites/hooks/hooks-short-circuit.test.vitest.mjs`** - Tests short-circuit behavior in before hooks
- **`suites/hooks/hooks-suppress-errors.test.vitest.mjs`** - Tests error suppression in hooks
- **`suites/hooks/hooks-patterns.test.vitest.mjs`** - Tests pattern matching in hook registration
- **`suites/hooks/hooks-mixed-scenarios.test.vitest.mjs`** - Tests complex hook scenarios
- **`suites/hooks/hooks-internal-properties.test.vitest.mjs`** - Tests internal hook properties
- **`suites/hooks/hooks-debug.test.vitest.mjs`** - Tests hook debugging functionality
- **`suites/hooks/hook-subsets.test.vitest.mjs`** - Tests hook subset functionality
- **`suites/api-manager/api-manager-hooks.test.vitest.mjs`** - Tests hooks with hot reload functionality
- **`suites/listener-cleanup/listener-cleanup.test.vitest.mjs`** - Tests hook cleanup on shutdown

---

## Implementation Requirements

### 1. Core Hook Manager Class

**Location**: Create `src/lib/handlers/hook-manager.mjs`

**Responsibilities**:
- Hook registration/removal
- Pattern compilation and matching
- Priority-based execution ordering
- Subset phase management
- Enable/disable state tracking
- Hook lifecycle management

**Key Methods**:
```javascript
class HookManager extends ComponentBase {
    constructor(slothlet) { super(slothlet); }
    
    // Registration (V3 ergonomic signature)
    on(typePattern, handler, options = {})  // typePattern: "type:pattern"
    remove(filter = {})  // Filter: { type, pattern, id }
    
    // Runtime control (enhanced with filter objects)
    enable(filter = {})   // Filter: { type, pattern, id }
    disable(filter = {})  // Filter: { type, pattern, id }
    clear(filter = {})    // Alias for remove()
    list(filter = {})     // Filter: { type, pattern, id, enabled }
    
    // Internal execution
    #executeBeforeHooks(apiPath, args)
    #executeAfterHooks(apiPath, result, args)
    #executeAlwaysHooks(apiPath, resultOrError, args)
    #executeErrorHooks(apiPath, error, source, args)
    
    // Pattern matching
    #matchesPattern(apiPath, pattern)
    #compilePattern(pattern)
}
```

### 2. UnifiedWrapper Integration

**Location**: Modify `src/lib/handlers/unified-wrapper.mjs`

**Changes needed**:
- **Path tracking system**: Accumulate full path during proxy traversal (test feasibility early)
- Add hook execution in `apply` trap (before function call)
- Add hook execution after function return (after hooks)
- Add try/catch for error hooks
- Add always hooks in finally block
- Track execution phases for error source
- **Handle traversal errors in `get` trap**: Fire hooks when property access fails

**Execution Flow** (for successful function calls):
```javascript
async apply(target, thisArg, args) {
    let phase = "before";
    try {
        // Execute before hooks
        const hookResult = await this.#executeBeforeHooks(args);
        if (hookResult.shortCircuit) return hookResult.value;
        args = hookResult.args;
        
        // Execute actual function
        phase = "function";
        let result = Reflect.apply(target, thisArg, args);
        if (result instanceof Promise) result = await result;
        
        // Execute after hooks
        phase = "after";
        result = await this.#executeAfterHooks(result, args);
        
        return result;
    } catch (error) {
        // Execute error hooks
        await this.#executeErrorHooks(error, phase, args);
        throw error;
    } finally {
        // Execute always hooks
        phase = "always";
        await this.#executeAlwaysHooks(args);
    }
}
```

**Path Traversal Error Handling** (new requirement):
```javascript
get(target, prop, receiver) {
    // ... existing get trap logic ...
    
    // If property doesn't exist and we're building a path
    if (!(prop in target)) {
        // Need to track:
        // - currentPath: Where we are now
        // - requestedProperty: What was requested
        // - fullPath: What user intended (if trackable)
        
        // Fire error and always hooks with traversal error
        await this.#executeErrorHooks(
            new Error(`Cannot read property '${prop}'`),
            "traversal",
            undefined  // args not available at get trap level
        );
        
        await this.#executeAlwaysHooks(
            undefined,  // args not available
            true        // hasError
        );
        
        // Then throw the error
        throw new Error(`Cannot read property '${prop}' of ${currentPath}`);
    }
    
    // ... rest of get trap ...
}
```

### 3. Configuration Schema

**Location**: Update `src/lib/helpers/config.mjs`

**Hook configuration**:
```javascript
config.hooks = {
    enabled: true,              // Global enable/disable
    pattern: "**",              // Default pattern
    suppressErrors: false,      // Report errors without throwing
    maxPriority: 1000,          // Maximum priority value
    debug: false                // Debug hook execution
};
```

### 4. Slothlet Initialization

**Location**: Modify `src/slothlet.mjs`

**Changes**:
```javascript
// In Slothlet.load():
this.handlers.hookManager = new HookManager(this);

// Pass hookManager to UnifiedWrapper instances
// Update all wrapper creations to include hooks
```

### 5. API Surface Updates

**Location**: Modify `src/lib/builders/api_builder.mjs`

**Replace stubs with real implementations**:
```javascript
hook: {  // Singular, not plural
    on: async function slothlet_hook_on(typePattern, handler, options = {}) {
        return slothlet.handlers.hookManager.on(typePattern, handler, options);
    },
    
    remove: async function slothlet_hook_remove(filter = {}) {
        return slothlet.handlers.hookManager.remove(filter);
    },
    
    enable: async function slothlet_hook_enable(filter = {}) {
        return slothlet.handlers.hookManager.enable(filter);
    },
    
    disable: async function slothlet_hook_disable(filter = {}) {
        return slothlet.handlers.hookManager.disable(filter);
    },
    
    clear: async function slothlet_hook_clear(filter = {}) {
        // Alias for remove
        return slothlet.handlers.hookManager.remove(filter);
    },
    
    list: async function slothlet_hook_list(filter = {}) {
        return slothlet.handlers.hookManager.list(filter);
    }
}
```

---

## Testing Requirements

### Unit Tests

1. **Hook registration**: Verify on/off operations
2. **Pattern matching**: Test wildcards, braces, negation
3. **Priority ordering**: Ensure highest priority executes first
4. **Subset phases**: Verify before/primary/after execution order
5. **Short-circuit**: Test before hooks returning values
6. **Value transformation**: Test after hooks chaining
7. **Error handling**: Verify error hooks receive correct context
8. **Always hooks**: Ensure execution regardless of errors

### Integration Tests

1. **Cross-mode compatibility**: Test in lazy and eager modes
2. **Multiple hooks**: Test multiple hooks on same path
3. **Pattern filtering**: Test enable/disable by pattern
4. **Performance**: Ensure minimal overhead when disabled
5. **Cleanup**: Verify hooks removed on shutdown

---

## Performance Considerations

### ⚠️ CRITICAL: Hook Storage Architecture

**Problem with Naive Implementation:**
A single flat list that filters all hooks on every function call would cause O(n) pattern matching overhead where n = total registered hooks. With 1000+ hooks, this becomes a major bottleneck.

**Required: Pattern-Grouped Storage**

Hooks stored by type → subset → pattern - each hook stored ONCE (no duplication):

```javascript
class HookManager {
    #hooks = {
        // Group by type → subset → pattern (hooks stored once)
        before: {
            before: {               // subset: "before"
                "math.*": [hook1]
            },
            primary: {              // subset: "primary" (default)
                "math.add": [hook2],
                "**": [hook3]
            },
            after: {                // subset: "after"
                "database.*": [hook4]
            }
        },
        after: {
            before: {},
            primary: {},
            after: {}
        },
        always: {
            before: {},
            primary: {},
            after: {}
        },
        error: {
            before: {},
            primary: {},
            after: {}
        },
        
        // Global metadata index
        byId: new Map()  // Quick lookup by hook ID
    };
}
```

**Hook Registration:**

```javascript
on(typePattern, handler, options = {}) {
    const [type, pattern] = this.#parseTypePattern(typePattern);
    const subset = options.subset || "primary";
    
    const hook = {
        id: options.id || this.#generateId(),
        type,
        pattern,
        handler,
        priority: options.priority || 0,
        subset,
        enabled: true,
        _compiled: null  // Lazy compile pattern on first use
    };
    
    // Store in type → subset → pattern group (create if needed)
    if (!this.#hooks[type][subset][pattern]) {
        this.#hooks[type][subset][pattern] = [];
    }
    this.#hooks[type][subset][pattern].push(hook);
    
    // Add to ID index
    this.#hooks.byId.set(hook.id, hook);
    
    return hook.id;
}
```

**Hook Lookup Algorithm:**

```javascript
async #getHooksForPath(type, apiPath) {
    // Fast path: globally disabled
    if (!this.config.hooks.enabled) return [];
    
    const typeIndex = this.#hooks[type];
    const hooks = [];
    
    // Process subsets in order: before → primary → after
    for (const subset of ["before", "primary", "after"]) {
        const subsetIndex = typeIndex[subset];
        
        // Check each pattern group in this subset
        for (const [pattern, patternHooks] of Object.entries(subsetIndex)) {
            // Try exact match first (no compilation needed)
            if (pattern === apiPath) {
                hooks.push(...patternHooks.filter(h => h.enabled));
                continue;
            }
            
            // Check if pattern matches with cached compilation
            for (const hook of patternHooks) {
                if (!hook.enabled) continue;
                
                if (!hook._compiled) {
                    hook._compiled = this.#compilePattern(hook.pattern);
                }
                
                if (hook._compiled.test(apiPath)) {
                    hooks.push(hook);
                }
            }
        }
    }
    
    // Sort by priority once (highest first)
    return hooks.sort((a, b) => b.priority - a.priority);
}

// List all hooks for a type (used by list() method)
#getAllHooksForType(type) {
    const typeIndex = this.#hooks[type];
    const allHooks = [];
    
    for (const subsetIndex of Object.values(typeIndex)) {
        for (const patternHooks of Object.values(subsetIndex)) {
            allHooks.push(...patternHooks);
        }
    }
    
    return allHooks;
}
```

**Performance Characteristics:**

- **Type grouping:** O(1) to get relevant hook type
- **Subset ordering:** O(1) constant (always 3 subsets: before/primary/after)
- **Pattern iteration:** O(p) where p = number of unique patterns (typically p << n total hooks)
- **Exact match check:** O(1) string comparison before regex compilation
- **Pattern compilation:** Cached on first use, reused for all subsequent calls
- **Disabled hooks:** Filtered during iteration (no separate enable/disable index needed)

**Performance Comparison: Naive vs. Pattern-Grouped**

| Scenario | Naive Flat List | Pattern-Grouped | Improvement |
|----------|-----------------|-----------------|-------------|
| **1000 hooks, 50 patterns** | O(1000) iterations | O(50) iterations | **20x faster** |
| **10,000 hooks, 200 patterns** | O(10,000) iterations | O(200) iterations | **50x faster** |
| **100 hooks, 100 patterns** | O(100) iterations | O(100) iterations | Same (worst case) |
| **Exact match "math.add"** | O(n) scan + regex | O(1) string equality | **100-1000x faster** |

**Real-World Example:**

Application with 1000 hooks:
- 10 global patterns (`**`, `*.create`, etc.) → 100 hooks
- 20 namespace patterns (`database.*`, `api.*`, etc.) → 500 hooks  
- 20 exact matches (`math.add`, `user.login`, etc.) → 400 hooks
- **Total unique patterns: 50**

Function call to `api.math.add`:
- **Naive approach:** Check all 1000 hooks = 1000 pattern matches
- **Pattern-grouped:** Check 50 pattern groups = 50 pattern matches
- **With exact match:** 1 string comparison, then ~10 wildcard checks
- **Result: ~100x faster for exact matches, ~20x faster average**

**Additional Optimizations:**

- **Zero overhead when disabled**: Single boolean check before any processing
- **Pattern caching**: Compile patterns once, store on hook object
- **Exact match fast path**: String equality check before regex
- **Type isolation**: Only check hooks of relevant type (before/after/always/error)
- **Subset ordering**: Natural execution order without additional sorting
- **Async optimization**: Only await if hooks return promises
- **Memory cleanup**: Remove hooks on shutdown to prevent leaks

---

## Documentation Updates Needed

1. Update [docs/HOOKS.md](../../HOOKS.md) with V3-specific details
2. Add hook examples to README.md
3. Create migration guide from V2 hooks to V3 hooks
4. Document breaking changes (if any)
5. Add JSDoc annotations to all hook-related code

---

## Migration from V2

**V2 Location**: `src2/lib/hooks/` directory

**Key Files to Reference**:
- `src2/lib/hooks/hook-manager.mjs` - Core implementation
- `src2/lib/hooks/pattern-matcher.mjs` - Pattern compilation
- Hook integration in V2 wrapper system

**Breaking Changes**:
- API namespace change: `api.hooks.*` (V2) → `api.slothlet.hook.*` (V3, singular)
- Method renamed: `.off()` (V2) → `.remove()` (V3, clearer naming)
- `.clear()` is now an alias for `.remove()` (both use filter objects)
- **Signature change**: `.on(type, handler, { pattern, ...options })` (V2) → `.on(typePattern, handler, options)` (V3)
  - V2: `api.hooks.on("before", handler, { pattern: "math.*", priority: 100 })`
  - V3: `api.slothlet.hook.on("before:math.*", handler, { priority: 100 })`
  - TypePattern format: `"<type>:<pattern>"` (e.g., "before:math.*", "error:**")
- Enhanced filters: `.disable()`, `.enable()`, `.remove()`, `.list()` accept filter objects ({ type, pattern, id })
- Configuration structure may differ
- Integration with new UnifiedWrapper architecture

---

## Timeline Estimate

- **Core HookManager**: 2-3 days
- **UnifiedWrapper integration**: 1-2 days
- **Testing**: 2-3 days
- **Documentation**: 1 day
- **Total**: ~1 week of focused development

---

## Next Steps

### Phase 0: Path Tracking Feasibility (REQUIRED FIRST)
1. **Create minimal path traversal test** - Test if we can track full requested path during proxy chain
2. **Test `get` trap access to context** - Verify what information is available when property doesn't exist
3. **Document findings** - Update this TODO with actual capabilities before implementation
4. **Design final hook context API** - Based on what's technically possible

### Phase 1: Implementation (After Path Tracking Tests)
1. Review V2 hook-manager.mjs implementation in detail
2. Design V3 HookManager class extending ComponentBase
3. Implement pattern matching system (may reuse V2 code)
4. Integrate with UnifiedWrapper apply trap (and possibly get trap for traversal errors)
5. Write comprehensive test suite
6. Update documentation
7. Remove NOT_IMPLEMENTED stubs

---

## Related Issues

- **EventEmitter context propagation**: May need hook integration for event wrapping
- **Metadata system**: Hooks may want access to function metadata
- **Debug system**: Hook execution should use slothlet.debug("hooks", {...})
