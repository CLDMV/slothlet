# Ownership and History System (v3)

**Status**: ✅ **Fully Implemented and Tested**  
**Version**: 3.0.0+  
**Files**: `src/lib/handlers/ownership.mjs`

---

## Overview

The Slothlet v3 ownership system provides **centralized module ownership tracking** with **stack-based history** for hot reload, rollback, and multi-module conflict resolution. Each API path maintains an independent ownership stack that tracks all modules that have registered implementations, enabling sophisticated rollback and conflict handling strategies.

### Key Features

- **Stack-Based History**: Each API path has independent ownership stack
- **Automatic Rollback**: Remove a module → restore previous owner automatically
- **Conflict Detection**: Track ownership conflicts across modules
- **Hot Reload Support**: Seamlessly handle module reloading with history preservation
- **Lifecycle Integration**: Registers ownership via `impl:created` and `impl:changed` events
- **Bidirectional Tracking**: Module → Paths AND Path → Modules mappings
- **Collision Mode Aware**: Respects collision modes (skip, warn, error, merge, replace)

---

## Architecture

### Dual Map Storage

#### 1. Module-to-Path Mapping

**Storage**: `moduleToPath` Map  
**Structure**: `moduleId → Set<apiPath>`  
**Purpose**: Fast lookup of all paths owned by a module

```javascript
moduleToPath = Map {
  "module-a" => Set(["plugins.tools", "plugins.utils.helper"]),
  "module-b" => Set(["api.auth", "api.users"])
}
```

#### 2. Path-to-Module Stack

**Storage**: `pathToModule` Map  
**Structure**: `apiPath → Array<OwnershipEntry>`  
**Purpose**: History stack for each API path

```javascript
pathToModule = Map {
  "plugins.tools" => [
    {
      moduleId: "module-a",
      source: "core",
      timestamp: 1706400000000,
      value: [Function: tools],
      filePath: "/path/to/module-a.mjs"
    },
    {
      moduleId: "module-b",
      source: "hotreload",
      timestamp: 1706400010000,
      value: [Function: toolsV2],
      filePath: "/path/to/module-b.mjs"
    }
  ]
}
```

### Ownership Entry Structure

```javascript
{
  moduleId: string,      // Module identifier
  source: string,        // "core" | "hotreload" | "user" | ...
  timestamp: number,     // Registration timestamp (Date.now())
  value: any,           // The actual implementation
  filePath: string|null  // Source file path
}
```

---

## Lifecycle Integration

### Event-Driven Ownership Registration

Ownership registration happens automatically via lifecycle events.

#### impl:created Event

Triggered when new implementation is created (initial load).

```javascript
// In api-builder.mjs
lifecycle.emit("impl:created", {
  target: wrapper,
  impl: funcOrObj,
  moduleId: metadata.moduleID,
  apiPath: normalizedApiPath,
  filePath: metadata.filePath
});

// Ownership handler subscribes
lifecycle.on("impl:created", async (event) => {
  this.register({
    moduleId: event.moduleId,
    apiPath: event.apiPath,
    value: event.impl,
    source: "core",
    filePath: event.filePath
  });
});
```

#### impl:changed Event

Triggered when existing wrapper's implementation changes (hot reload, collision).

```javascript
// In unified-wrapper.mjs
lifecycle.emit("impl:changed", {
  target: this,
  oldImpl: this._impl,
  newImpl: impl,
  moduleId: moduleId
});

// Ownership handler subscribes
lifecycle.on("impl:changed", async (event) => {
  this.register({
    moduleId: event.moduleId,
    apiPath: eventData.apiPath,
    value: event.newImpl,
    source: "hotreload",
    collisionMode: "replace"
  });
});
```

---

## API Reference

### Public Methods

#### `register(options)`

Register module ownership of an API path.

**Parameters**:
- `options.moduleId` {string} - **Required** - Module identifier
- `options.apiPath` {string} - **Required** - API path being registered
- `options.value` {*} - **Required** - The actual function/object being registered
- `options.source` {string} - Source of registration (default: `"core"`)
- `options.collisionMode` {string} - Collision handling mode (default: `"error"`)
  - `"error"`: Throw error on conflict
  - `"skip"`: Skip registration silently
  - `"warn"`: Skip with warning (unless silent)
  - `"merge"`: Allow registration (merge mode)
  - `"replace"`: Allow registration (replace mode)
  - `"merge-replace"`: Allow registration (hybrid mode)
- `options.config` {Object} - Config object for silent mode check
- `options.filePath` {string|null} - File path of module source

**Returns**: `{Object|null}` - Registration entry or null if skipped

**Throws**:
- `OWNERSHIP_INVALID_MODULE_ID` - Invalid or missing moduleId
- `OWNERSHIP_INVALID_API_PATH` - Invalid or missing apiPath
- `OWNERSHIP_CONFLICT` - Conflict detected in error mode

```javascript
ownership.register({
  moduleId: "my-module",
  apiPath: "plugins.tools",
  value: toolsFunction,
  source: "core",
  collisionMode: "error",
  filePath: "/path/to/tools.mjs"
});
```

**Duplicate Prevention**: If the same moduleId is already in the stack, the existing entry is updated instead of creating a duplicate.

```javascript
// First registration
ownership.register({
  moduleId: "module-a",
  apiPath: "api.test",
  value: funcV1
});

// Second registration with same moduleId - updates existing
ownership.register({
  moduleId: "module-a",
  apiPath: "api.test",
  value: funcV2
});

// Stack contains only ONE entry for module-a
```

#### `unregister(moduleId)`

Remove all paths owned by a module.

**Parameters**:
- `moduleId` {string} - Module to unregister

**Returns**: `{Object}` - Removal summary
```javascript
{
  removed: string[],      // Paths completely removed (no history)
  rolledBack: Array<{     // Paths restored to previous owner
    apiPath: string,
    restoredTo: string
  }>
}
```

**Example**:
```javascript
const result = ownership.unregister("module-a");
console.log(result.removed);    // ["api.temp"]
console.log(result.rolledBack); // [{ apiPath: "api.test", restoredTo: "module-b" }]
```

#### `removePath(apiPath, moduleId?)`

Remove a module owner from a specific API path.

**Parameters**:
- `apiPath` {string} - API path to modify
- `moduleId` {string|null} - Module to remove (defaults to current owner)

**Returns**: `{Object}` - Action result
```javascript
{
  action: "delete" | "restore" | "none",
  removedModuleId: string|null,
  restoreModuleId: string|null
}
```

**Actions**:
- `"delete"`: Path completely removed (stack empty)
- `"restore"`: Path restored to previous owner
- `"none"`: No action taken (module not found)

**Example**:
```javascript
// Stack: ["module-a", "module-b", "module-c"] (module-c is current)
const result = ownership.removePath("api.test", "module-c");
// result: { action: "restore", removedModuleId: "module-c", restoreModuleId: "module-b" }

// Stack now: ["module-a", "module-b"] (module-b is current)
```

#### `getCurrentOwner(apiPath)`

Get the current owner of an API path.

**Parameters**:
- `apiPath` {string} - API path to check

**Returns**: `{Object|null}` - Current owner entry or null

```javascript
const owner = ownership.getCurrentOwner("plugins.tools");
// {
//   moduleId: "module-b",
//   source: "hotreload",
//   timestamp: 1706400010000,
//   value: [Function: toolsV2],
//   filePath: "/path/to/module-b.mjs"
// }
```

#### `getCurrentValue(apiPath)`

Get the current implementation value for an API path.

**Parameters**:
- `apiPath` {string} - API path to check

**Returns**: `{*}` - Current value or undefined

```javascript
const value = ownership.getCurrentValue("plugins.tools");
// [Function: toolsV2]
```

#### `getModulePaths(moduleId)`

Get all API paths owned by a module.

**Parameters**:
- `moduleId` {string} - Module to query

**Returns**: `{Array<string>}` - Array of API paths

```javascript
const paths = ownership.getModulePaths("module-a");
// ["plugins.tools", "plugins.utils.helper"]
```

#### `getPathHistory(apiPath)`

Get the complete ownership history for an API path.

**Parameters**:
- `apiPath` {string} - API path to query

**Returns**: `{Array<Object>}` - Ownership history stack (oldest first)

```javascript
const history = ownership.getPathHistory("plugins.tools");
// [
//   { moduleId: "module-a", timestamp: 1706400000000, ... },
//   { moduleId: "module-b", timestamp: 1706400010000, ... }
// ]
```

#### `ownsPath(moduleId, apiPath)`

Check if a module currently owns an API path.

**Parameters**:
- `moduleId` {string} - Module to check
- `apiPath` {string} - API path to check

**Returns**: `{boolean}` - True if module is current owner

```javascript
const isOwner = ownership.ownsPath("module-b", "plugins.tools");
// true (module-b is current owner)
```

#### `getPathOwnership(apiPath)`

Get all modules that have ownership entries for an API path.

**Parameters**:
- `apiPath` {string} - API path to check

**Returns**: `{Set<string>|null}` - Set of moduleIds or null if path not found

```javascript
const owners = ownership.getPathOwnership("plugins.tools");
// Set(["module-a", "module-b"])
```

#### `getDiagnostics()`

Get diagnostic information about the ownership system.

**Returns**: `{Object}` - Diagnostic data
```javascript
{
  totalModules: number,
  totalPaths: number,
  modules: Array<{
    moduleId: string,
    pathCount: number
  }>,
  conflictedPaths: Array<{
    apiPath: string,
    ownerStack: string[]
  }>
}
```

**Example**:
```javascript
const diag = ownership.getDiagnostics();
// {
//   totalModules: 3,
//   totalPaths: 5,
//   modules: [
//     { moduleId: "module-a", pathCount: 2 },
//     { moduleId: "module-b", pathCount: 3 }
//   ],
//   conflictedPaths: [
//     { apiPath: "plugins.tools", ownerStack: ["module-a", "module-b"] }
//   ]
// }
```

#### `clear()`

Clear all ownership data (used for cleanup/reset).

```javascript
ownership.clear();
```

---

## Ownership Flow Patterns

### 1. Initial Module Load

```javascript
// Module "module-a" loads api.test
slothlet.api.addApi("api", "./modules/module-a.mjs");

// Ownership state:
moduleToPath = Map {
  "module-a" => Set(["api.test"])
}

pathToModule = Map {
  "api.test" => [
    {
      moduleId: "module-a",
      source: "core",
      timestamp: 1706400000000,
      value: [Function: test]
    }
  ]
}
```

### 2. Hot Reload (Replace Mode)

```javascript
// Module "module-a" reloads with new implementation
slothlet.api.addApi("api", "./modules/module-a.mjs", {}, { collisionMode: "replace" });

// Ownership state:
pathToModule = Map {
  "api.test" => [
    {
      moduleId: "module-a",
      source: "core",
      timestamp: 1706400000000,
      value: [Function: test]
    }
    // NOTE: Duplicate prevention - only ONE entry per moduleId
    // The existing entry is UPDATED instead of adding duplicate
  ]
}

// After update:
pathToModule = Map {
  "api.test" => [
    {
      moduleId: "module-a",
      source: "hotreload",        // Updated
      timestamp: 1706400010000,    // Updated
      value: [Function: testV2]    // Updated
    }
  ]
}
```

### 3. Collision (Different Module)

```javascript
// Module "module-b" tries to add to same path
slothlet.api.addApi("api", "./modules/module-b.mjs", {}, { collisionMode: "replace" });

// Ownership state (module-b becomes current owner):
pathToModule = Map {
  "api.test" => [
    {
      moduleId: "module-a",
      source: "core",
      timestamp: 1706400000000,
      value: [Function: test]
    },
    {
      moduleId: "module-b",      // New entry added
      source: "core",
      timestamp: 1706400020000,
      value: [Function: testFromB]
    }
  ]
}

moduleToPath = Map {
  "module-a" => Set(["api.test"]),
  "module-b" => Set(["api.test"])  // Both modules track the path
}
```

### 4. Module Removal with Rollback

```javascript
// Remove module "module-b"
const result = slothlet.api.remove("module-b");

// Ownership automatically rolls back to module-a:
pathToModule = Map {
  "api.test" => [
    {
      moduleId: "module-a",
      source: "core",
      timestamp: 1706400000000,
      value: [Function: test]      // Restored!
    }
  ]
}

// Result reports rollback:
result = {
  removed: [],
  rolledBack: [
    { apiPath: "api.test", restoredTo: "module-a" }
  ]
}
```

### 5. Complete Path Removal

```javascript
// Remove module "module-a" (last owner)
const result = slothlet.api.remove("module-a");

// Path completely removed:
pathToModule = Map {} // Empty

// Result reports deletion:
result = {
  removed: ["api.test"],
  rolledBack: []
}
```

---

## Integration with API Manager

### Removal Flow with Ownership

The API Manager's `removeApiComponent()` method integrates with ownership for intelligent removal:

```javascript
// In api-manager.mjs
async removeApiComponent(apiPath, moduleId) {
  const normalizedPath = this.normalizeApiPath(apiPath).normalized;
  
  // Query ownership system
  const ownershipResult = this.slothlet.handlers.ownership?.removePath(
    normalizedPath,
    moduleId
  );
  
  if (ownershipResult.action === "delete") {
    // No more owners - delete from API
    this.deletePath(this.slothlet.api, pathParts);
    this.deletePath(this.slothlet.boundApi, pathParts);
    
    // Clean up metadata
    this.slothlet.handlers.metadata?.removeUserMetadataByApiPath(normalizedPath);
    
    return true;
  }
  
  if (ownershipResult.action === "restore") {
    // Restore previous owner's implementation
    const restoredValue = this.slothlet.handlers.ownership?.getCurrentValue(normalizedPath);
    const restoredModuleId = this.slothlet.handlers.ownership?.getCurrentOwner(normalizedPath)?.moduleId;
    
    await this.setValueAtPath(this.slothlet.api, pathParts, restoredValue, {
      mutateExisting: true,
      allowOverwrite: true,
      collisionMode: "replace",
      moduleId: restoredModuleId  // Important for lifecycle events
    });
    
    return true;
  }
  
  return false;
}
```

### Nested Path Deletion Logic

The API Manager checks for child paths with other owners before deletion:

```javascript
// In api-manager.mjs
const hasChildrenWithOtherOwners = this.hasChildren(
  this.slothlet.api,
  parts,
  (childPath) => {
    const childPathNormalized = parts.concat(childPath).join(".");
    const childOwner = this.slothlet.handlers.ownership?.getCurrentOwner?.(childPathNormalized);
    
    // Only consider children with DIFFERENT owners
    return childOwner && childOwner.moduleId !== ownershipResult.removedModuleId;
  }
);

if (hasChildrenWithOtherOwners) {
  // Don't delete parent - children belong to other modules
  return false;
}
```

This prevents accidental deletion of parent paths when child paths are owned by other modules.

---

## Collision Mode Handling

### Skip Mode

```javascript
ownership.register({
  moduleId: "module-b",
  apiPath: "plugins.tools",
  value: toolsV2,
  collisionMode: "skip"
});

// If "plugins.tools" already exists:
// - Returns null (skipped)
// - No entry added to stack
// - No warning or error
```

### Warn Mode

```javascript
ownership.register({
  moduleId: "module-b",
  apiPath: "plugins.tools",
  value: toolsV2,
  collisionMode: "warn",
  config: { silent: false }
});

// If "plugins.tools" already exists:
// - Returns null (skipped)
// - Emits WARNING_OWNERSHIP_CONFLICT
// - No entry added to stack
```

### Error Mode

```javascript
ownership.register({
  moduleId: "module-b",
  apiPath: "plugins.tools",
  value: toolsV2,
  collisionMode: "error"
});

// If "plugins.tools" already exists:
// - Throws OWNERSHIP_CONFLICT error
// - No entry added to stack
```

### Merge/Replace Mode

```javascript
ownership.register({
  moduleId: "module-b",
  apiPath: "plugins.tools",
  value: toolsV2,
  collisionMode: "replace"
});

// If "plugins.tools" already exists:
// - Adds new entry to stack
// - module-b becomes current owner
// - Previous owner preserved in history
```

---

## Error Handling

### OWNERSHIP_INVALID_MODULE_ID

```javascript
// Thrown when moduleId is null, undefined, or not a string
ownership.register({
  moduleId: null,
  apiPath: "api.test",
  value: func
});

// SlothletError: Invalid ownership registration: moduleId 'null' is invalid.
```

### OWNERSHIP_INVALID_API_PATH

```javascript
// Thrown when apiPath is null, undefined, or not a string
ownership.register({
  moduleId: "module-a",
  apiPath: "",
  value: func
});

// SlothletError: Invalid ownership registration: apiPath '' is invalid.
```

### OWNERSHIP_CONFLICT

```javascript
// Thrown in error mode when conflict detected
ownership.register({
  moduleId: "module-b",
  apiPath: "plugins.tools", // Already owned by module-a
  value: toolsV2,
  collisionMode: "error"
});

// SlothletError: Ownership conflict at 'plugins.tools'
// Details: { apiPath: "plugins.tools", existingModuleId: "module-a", newModuleId: "module-b" }
```

---

## Testing

**Test Suite**: `tests/vitests/suites/ownership/`

- ✅ `module-ownership-removal.test.vitest.mjs` - Removal and rollback (72 tests)
- ✅ `ownership-replacement.test.vitest.mjs` - Replacement and history (24 tests)

**Total Tests**: 96 tests across 8 configurations

**Baseline**: Both test files included in `baseline-tests.json`

**Test Coverage**:
- Registration with duplicate prevention
- Unregistration with rollback
- Path removal (delete vs restore)
- Current owner queries
- History stack management
- Collision mode handling
- Nested path deletion logic
- Diagnostic information

---

## Usage Examples

### Basic Hot Reload

```javascript
// Initial load
await slothlet.api.addApi("plugins", "./plugins-v1");
// Ownership: module-v1 owns "plugins.*"

// Hot reload same module
await slothlet.api.addApi("plugins", "./plugins-v1", {}, { collisionMode: "replace" });
// Ownership: module-v1 still owns (entry UPDATED, no duplicate)

// Check owner
const owner = slothlet.handlers.ownership.getCurrentOwner("plugins.tools");
console.log(owner.moduleId); // "module-v1"
console.log(owner.source);   // "hotreload"
```

### Multi-Module Rollback

```javascript
// Load three versions
await slothlet.api.addApi("api", "./v1");     // v1 owns api.test
await slothlet.api.addApi("api", "./v2");     // v2 owns api.test (v1 in history)
await slothlet.api.addApi("api", "./v3");     // v3 owns api.test (v1, v2 in history)

// Check history
const history = slothlet.handlers.ownership.getPathHistory("api.test");
console.log(history.length); // 3

// Remove v3 → rollback to v2
await slothlet.api.remove("v3");
const owner = slothlet.handlers.ownership.getCurrentOwner("api.test");
console.log(owner.moduleId); // "v2"

// Remove v2 → rollback to v1
await slothlet.api.remove("v2");
const owner2 = slothlet.handlers.ownership.getCurrentOwner("api.test");
console.log(owner2.moduleId); // "v1"

// Remove v1 → complete deletion
await slothlet.api.remove("v1");
const owner3 = slothlet.handlers.ownership.getCurrentOwner("api.test");
console.log(owner3); // null
```

### Diagnostics and Debugging

```javascript
// Load multiple modules
await slothlet.api.addApi("plugins.a", "./module-a");
await slothlet.api.addApi("plugins.b", "./module-b");
await slothlet.api.addApi("plugins.a.nested", "./module-c");

// Get diagnostics
const diag = slothlet.handlers.ownership.getDiagnostics();

console.log(`Total modules: ${diag.totalModules}`);
console.log(`Total paths: ${diag.totalPaths}`);

// List all modules and their paths
for (const { moduleId, pathCount } of diag.modules) {
  console.log(`${moduleId}: ${pathCount} paths`);
  const paths = slothlet.handlers.ownership.getModulePaths(moduleId);
  console.log(`  ${paths.join(", ")}`);
}

// Check for conflicts
if (diag.conflictedPaths.length > 0) {
  console.log("Ownership conflicts detected:");
  for (const { apiPath, ownerStack } of diag.conflictedPaths) {
    console.log(`  ${apiPath}: ${ownerStack.join(" → ")}`);
  }
}
```

---

## Advanced Patterns

### Conditional Rollback

```javascript
// Register with custom rollback logic
const entry = ownership.register({
  moduleId: "plugin-a",
  apiPath: "api.test",
  value: testFunc,
  source: "user"
});

// Later, conditionally remove
if (shouldRollback) {
  const result = ownership.removePath("api.test", "plugin-a");
  
  if (result.action === "restore") {
    console.log(`Rolled back to ${result.restoreModuleId}`);
  } else if (result.action === "delete") {
    console.log("Path completely removed");
  }
}
```

### Multi-Tenant Module Isolation

```javascript
// Each tenant gets own module namespace
await slothlet.api.addApi("tenant-a", "./tenant-a-modules");
await slothlet.api.addApi("tenant-b", "./tenant-b-modules");

// Check which tenant owns a path
const owner = ownership.getCurrentOwner("api.feature");
const tenantId = owner.moduleId.split("-")[1]; // "a" or "b"

// Remove tenant's modules
await slothlet.api.remove("tenant-a");
// All tenant-a paths removed or rolled back
```

### History-Based Auditing

```javascript
// Track all changes to an API path
const history = ownership.getPathHistory("api.critical");

console.log("Implementation history:");
for (const entry of history) {
  console.log(`  ${new Date(entry.timestamp).toISOString()}`);
  console.log(`  Module: ${entry.moduleId}`);
  console.log(`  Source: ${entry.source}`);
  console.log(`  File: ${entry.filePath}`);
  console.log();
}
```

---

## Performance Considerations

### Memory Usage

- **O(M)** for moduleToPath storage (M = number of modules)
- **O(P * H)** for pathToModule storage (P = number of paths, H = average history depth)
- **WeakMap not used** - ownership entries must persist independently

### Time Complexity

- `register()`: **O(H)** - scan stack for duplicates (H = history depth)
- `unregister()`: **O(P)** - iterate all paths for module (P = paths per module)
- `removePath()`: **O(H)** - find and remove entry in stack
- `getCurrentOwner()`: **O(1)** - access last element in array
- `getModulePaths()`: **O(1)** - direct Map lookup

### Optimization Notes

- Duplicate prevention reduces memory by preventing stack bloat
- Bidirectional mapping enables fast lookups in both directions
- History depth typically small (1-3 entries in practice)

---

## Migration from v2

### Breaking Changes

1. **Centralized System**: No longer per-wrapper ownership tracking
2. **Stack-Based**: History is now automatic (not manual)
3. **Lifecycle Integration**: Registration happens via events only
4. **Duplicate Prevention**: Same module can't have multiple stack entries

### Migration Steps

**v2 Approach** (if it existed):
```javascript
// Manual ownership tracking per wrapper
wrapper.owner = "module-a";
```

**v3 Approach**:
```javascript
// Automatic via lifecycle
lifecycle.emit("impl:created", {
  moduleId: "module-a",
  apiPath: "api.test",
  // ... ownership registered automatically
});
```

---

## Related Documentation

- [metadata-system.md](./metadata-system.md) - Metadata system (complements ownership)
- [docs/MODULE-STRUCTURE.md](../../MODULE-STRUCTURE.md) - Module loading system
- [docs/CONTEXT-PROPAGATION.md](../../CONTEXT-PROPAGATION.md) - Context system
- [docs/HOOKS.md](../../HOOKS.md) - Lifecycle hooks system

---

## Summary

The v3 ownership system provides robust hot reload support:

✅ **Stack-Based History**: Automatic rollback on module removal  
✅ **Conflict Detection**: Track ownership across modules  
✅ **Lifecycle Integrated**: Automatic registration via events  
✅ **Bidirectional Tracking**: Fast lookups module→paths and path→modules  
✅ **Duplicate Prevention**: One entry per moduleId per path  
✅ **Tested**: 96 tests across 8 configurations  

The system enables sophisticated hot reload scenarios with automatic rollback and conflict resolution, making it suitable for production environments with frequent module updates.
