# Hot Reload Architecture

## Overview

Slothlet v3's hot reload system (api.add/remove/reload) uses a **wrapper-based architecture** with **ownership stacking** to enable runtime module updates while preserving API references.

## Core Components

### 1. addApiComponent Flow

**Location**: `src/lib/helpers/hot_reload.mjs`

```javascript
export async function addApiComponent(params) {
    // 1. Validate and normalize
    const { apiPath: normalizedPath, parts } = normalizeApiPath(apiPath);
    const resolvedFolderPath = await resolveFolderPath(folderPath);
    
    // 2. Build new API subtree using existing buildAPI
    const newApi = await buildAPI({
        dir: resolvedFolderPath,
        mode: instance.config.mode,
        ownership: instance.ownership,
        contextManager: instance.contextManager,
        instanceID: instance.instanceID,
        config: instance.config
    });
    
    // 3. Extract nested structure if needed
    // buildAPI may return { config: {...} } when we want just {...}
    let apiToMerge = newApi;
    const finalKey = parts[parts.length - 1];
    if (Object.keys(newApi).length === 1 && Object.keys(newApi)[0] === finalKey) {
        apiToMerge = newApi[finalKey];
    }
    
    // 4. Merge into existing API at target path
    await setValueAtPath(
        instance.api,
        parts,
        apiToMerge,
        {
            mutateExisting: !!(options.mutateExisting || instance.config.allowAddApiOverwrite),
            allowOverwrite
        },
        instance
    );
    
    // 5. Register ownership (stack-based history)
    if (instance.ownership && moduleId) {
        registerOwnership(instance.ownership, moduleId, normalizedPath, apiToMerge);
    }
}
```

### 2. setValueAtPath - The Merge Point

**Location**: `src/lib/helpers/hot_reload.mjs`

This function navigates to the target API path and either:
- **Overwrites** (when no existing value or allowOverwrite=true)
- **Mutates in-place** (when mutateExisting=true)

```javascript
async function setValueAtPath(root, parts, value, options) {
    const parent = ensureParentPath(root, parts);
    const finalKey = parts[parts.length - 1];
    const existing = parent[finalKey];
    
    if (existing !== undefined && options.mutateExisting) {
        // THIS IS WHERE THE BUG WAS
        await mutateApiValue(existing, value, { removeMissing: false });
        return;
    }
    
    parent[finalKey] = value;
}
```

### 3. mutateApiValue - Wrapper Detection

**Location**: `src/lib/helpers/hot_reload.mjs`

Detects if both values are UnifiedWrapper proxies:

```javascript
async function mutateApiValue(existingValue, nextValue, options) {
    if (isWrapperProxy(existingValue)) {
        if (isWrapperProxy(nextValue)) {
            // Both are wrappers - sync them
            await syncWrapper(existingValue, nextValue);
            return;
        }
        
        if (existingValue.__setImpl) {
            existingValue.__setImpl(nextValue?.__impl ?? nextValue);
            return;
        }
    }
    
    // Object merging fallback...
}
```

### 4. syncWrapper - The Bug Location

**Location**: `src/lib/helpers/hot_reload.mjs`

**THE BUG**: This function transferred `_childCache` entries but never called `__setImpl` to update the actual implementation.

**Why this is critical**:
- `_impl` is the **execution source** for the wrapper
- For callable wrappers (functions), `_impl` IS the function that executes
- For object wrappers, `_impl` holds properties not yet wrapped
- `__setImpl()` exists specifically to update wrappers during reload

**What `__setImpl()` does** (`src/lib/handlers/unified-wrapper.mjs`):
```javascript
__setImpl(newImpl) {
    this._impl = newImpl;                    // Update implementation
    this._adoptImplChildren();               // Move properties to _childCache
    this._state.materialized = true;         // Mark as materialized
    this._state.inFlight = false;
}
```

`_adoptImplChildren()` handles:
- Looping through `_impl` properties
- Creating/updating child wrappers in `_childCache`
- Attaching children to `_proxyTarget`
- Recursively updating existing child wrappers

**The Fix**:
```javascript
async function syncWrapper(existingProxy, nextProxy) {
    if (!isWrapperProxy(existingProxy) || !isWrapperProxy(nextProxy)) {
        return false;
    }
    
    const existingWrapper = existingProxy.__wrapper || existingProxy;
    const nextWrapper = nextProxy.__wrapper || nextProxy;
    
    // Copy materialize function if present (lazy mode)
    if (nextWrapper._materializeFunc) {
        existingWrapper._materializeFunc = nextWrapper._materializeFunc;
    }
    
    // THE FIX: Update implementation using __setImpl
    // This updates _impl and calls _adoptImplChildren() automatically
    if (existingProxy.__setImpl) {
        existingProxy.__setImpl(nextProxy.__impl);
    }
    
    return true;
}
```

## UnifiedWrapper Data Flow

### Property Storage Locations

1. **`_impl`**: The actual module exports (source of truth)
2. **`_childCache`**: Map of property names → child UnifiedWrapper instances
3. **`_proxyTarget`**: The object/function that the Proxy wraps

### The Adoption Process

When you call `wrapper.__setImpl(newImpl)`:

```
BEFORE:
_impl = { add: fn1, subtract: fn2 }
_childCache = Map()

AFTER __setImpl({ add: fn3, subtract: fn4, multiply: fn5 }):
_impl = { } or function (depends on type)
_childCache = Map([
  ['add', UnifiedWrapper(fn3)],
  ['subtract', UnifiedWrapper(fn4)],
  ['multiply', UnifiedWrapper(fn5)]
])
```

Properties are **moved from `_impl` to `_childCache`** during adoption. This is why:
- `Object.keys(wrapper.__impl)` returns `[]` (empty)
- `Object.keys(wrapper)` returns `['add', 'subtract', 'multiply']` (via proxy)

### Why Ownership Doesn't Break

Ownership tracks the **wrapper instance**, not its contents:

```javascript
// Initial state
const wrapper = new UnifiedWrapper({ initialImpl: { a: 1 } });
api.config = wrapper.createProxy();
ownership.register({ moduleId: "core", apiPath: "config", value: api.config });

// Hot reload - update same wrapper
wrapper.__setImpl({ b: 2 });  // Wrapper instance stays same
// api.config STILL POINTS TO SAME WRAPPER
// ownership.pathToModule.get("config") STILL POINTS TO SAME WRAPPER
// Consumer references STILL WORK

// Add new module on top
wrapper.__setImpl({ c: 3 });
ownership.register({ moduleId: "module-a", apiPath: "config", value: api.config });
// Stack now: [core, module-a] both pointing to SAME wrapper

// Remove module-a
ownership.removePath("config", "module-a");
// Stack pops to: [core]
// Restore core's implementation: wrapper.__setImpl(stackEntry.value.__impl);
```

## Ownership Stack Architecture

**Location**: `src/lib/handlers/ownership.mjs`

### Data Structures

```javascript
class OwnershipManager {
    moduleToPath: Map<moduleId, Set<apiPath>>;
    pathToModule: Map<apiPath, Array<{moduleId, source, timestamp, value}>>;
}
```

### Stack Operations

**Register (Push)**:
```javascript
register({ moduleId, apiPath, value }) {
    this.pathToModule.get(apiPath).push({
        moduleId,
        source: "add",
        timestamp: Date.now(),
        value  // Stores wrapper reference
    });
}
```

**RemovePath (Pop)**:
```javascript
removePath(apiPath, moduleId) {
    const stack = this.pathToModule.get(apiPath);
    const [removed] = stack.splice(index, 1);
    
    if (stack.length === 0) {
        return { action: "delete" };  // No more owners
    }
    
    const previous = stack[stack.length - 1];
    return { 
        action: "restore",
        restoreModuleId: previous.moduleId
    };
}
```

### Example Timeline

```
T0: Initial load
    api.config = wrapper
    pathToModule["config"] = [{ moduleId: "core", value: wrapper }]

T1: api.add("config", folder1)
    wrapper.__setImpl(newImpl1)  ← Wrapper updated
    pathToModule["config"] = [
        { moduleId: "core", value: wrapper },
        { moduleId: "mod-a", value: wrapper }  ← Same wrapper!
    ]

T2: api.add("config", folder2)
    wrapper.__setImpl(newImpl2)  ← Wrapper updated again
    pathToModule["config"] = [
        { moduleId: "core", value: wrapper },
        { moduleId: "mod-a", value: wrapper },
        { moduleId: "mod-b", value: wrapper }  ← Still same wrapper!
    ]

T3: api.remove("mod-b")
    stack.pop()  ← Remove mod-b entry
    wrapper.__setImpl(stack.top().value.__impl)  ← Restore mod-a's impl
    pathToModule["config"] = [
        { moduleId: "core", value: wrapper },
        { moduleId: "mod-a", value: wrapper }
    ]
```

## Why buildAPI Doesn't Need Fixing

`buildAPI()` creates a **new, fresh object graph**:
- Scans directory
- Loads modules
- Creates wrappers with `new UnifiedWrapper({ initialImpl })`
- Returns complete API tree

The wrappers are **fully initialized** with implementations already set. No syncing needed.

`addAPI` reuses `buildAPI` - it just needs to **attach the result** to an existing API path. The only complexity is:
1. **When to overwrite vs mutate** (handled by `setValueAtPath`)
2. **How to sync wrappers** (the bug we fixed)

## Testing the Fix

**Test case**: `api.add("config", folder)` where:
- `api.config` already exists with some properties
- `folder` contains new implementation with different properties

**Expected behavior**:
- Wrapper instance stays same (ownership preserved)
- `api.config` properties updated to new implementation
- Functions are callable and execute new code
- Consumer references still work

**What was broken**:
- `api.config` keys became empty `[]`
- Functions undefined
- Properties missing
- Reason: `_impl` was never updated, only `_childCache` was transferred (incorrectly)

**What fix does**:
- Calls `existingWrapper.__setImpl(nextWrapper.__impl)`
- This updates `_impl` with new implementation
- Calls `_adoptImplChildren()` which processes all properties
- Creates/updates child wrappers in `_childCache`
- Marks wrapper as materialized
- Everything works!
