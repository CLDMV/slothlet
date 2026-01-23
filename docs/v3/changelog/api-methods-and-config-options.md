# API Methods and Configuration Options Reference

**Added:** v3.0.0  
**Status:** Implemented  
**Related:** Hot reload, mutation controls, runtime configuration

## Overview

This document provides comprehensive reference for all `api.slothlet.*` methods and their options, as well as every slothlet initialization configuration option. Understanding these is crucial for proper usage of slothlet's runtime API modification capabilities.

## API Methods

### `api.slothlet.api.add(apiPath, folderPath, metadata?, options?)`

**Purpose:** Dynamically adds API modules from a folder into the running slothlet instance.

**Parameters:**
- `apiPath` (string): The API path where modules will be mounted (e.g., `"plugins"`, `"config.database"`)
- `folderPath` (string): Absolute or relative path to folder containing modules
- `metadata` (object, optional): Metadata object passed to loaded modules
- `options` (object, optional): Configuration options for the add operation

**Options:**
- `mutateExisting` (boolean): Allow merging into existing API paths instead of requiring empty paths. Default: `false`
- `moduleId` (string): Unique identifier for ownership tracking. Default: auto-generated

**Collision Handling:**
- Uses `collision.addApi` config option to determine behavior on path conflicts
- Modes: `"skip"`, `"warn"`, `"replace"`, `"merge"` (default), `"error"`
- Can be overridden per-call with `options.mutateExisting` and `options.allowOverwrite`

**Dependencies:**
- No longer requires `allowMutation: true` (v3 allows runtime modifications by default)
- Collision behavior controlled by `collision.addApi` config option

**Examples:**
```javascript
// Basic usage
await api.slothlet.api.add("plugins", "./plugins");

// With custom moduleId
await api.slothlet.api.add("plugins", "./plugins", {}, {
  moduleId: "plugins-v1"
});

// Merge into existing path
await api.slothlet.api.add("utils", "./utils", {}, {
  mutateExisting: true
});
```

---

### `api.slothlet.api.remove(pathOrModuleId)`

**Purpose:** Removes API modules by API path or module ID from the running instance.

**Parameters:**
- `pathOrModuleId` (string): Either an API path (e.g., `"plugins"`) or module ID used during add

**Dependencies:**
- Requires `allowMutation: true` in initial config

**Examples:**
```javascript
// Remove by API path
await api.slothlet.api.remove("plugins");

// Remove by module ID
await api.slothlet.api.remove("config-v1");
```

---

### `api.slothlet.api.reload(pathOrModuleId)`

**Purpose:** Reloads API modules that were previously added, preserving existing references.

**Parameters:**
- `pathOrModuleId` (string): API path or module ID to reload

**Dependencies:**
- No longer requires `allowMutation: true` (v3 allows runtime modifications by default)
- Only works on modules previously added via `api.add()`

**Examples:**
```javascript
// Reload by API path
await api.slothlet.api.reload("plugins");

// Reload by module ID
await api.slothlet.api.reload("config-v1");
```

---

### `api.slothlet.reload()`

**Purpose:** Performs a full reload of the entire slothlet instance, creating new API references.

**Dependencies:**
- No longer requires `allowMutation: true` (v3 allows runtime modifications by default)

**Examples:**
```javascript
await api.slothlet.reload();
```

---

### `api.slothlet.shutdown()`

**Purpose:** Shuts down the slothlet instance and cleans up resources.

**Examples:**
```javascript
await api.slothlet.shutdown();
```

---

### `api.slothlet.scope(fn, context?)`

**Purpose:** Creates a per-request scope with custom context for the provided function.

**Parameters:**
- `fn` (function): Function to execute within the scoped context
- `context` (object, optional): Custom context to merge

**Examples:**
```javascript
const result = api.slothlet.scope(() => {
  // Function runs with isolated context
  return api.config.getValue();
});
```

---

### `api.slothlet.run(fn, context?)`

**Purpose:** Runs a function with specific context, handling both async and live runtime modes.

**Parameters:**
- `fn` (function): Function to execute
- `context` (object, optional): Context to use

**Examples:**
```javascript
await api.slothlet.run(() => {
  return api.math.add(2, 3);
}, { userId: 123 });
```

## Configuration Options

### Core Configuration

#### `dir` (required)
- **Type:** `string`
- **Purpose:** Root directory containing API modules
- **Resolution:** Automatically resolved relative to caller's file
- **Example:** `"./api"`, `"/absolute/path/to/api"`

#### `mode`
- **Type:** `string`
- **Values:** `"eager"` (default), `"lazy"`
- **Purpose:** Controls when modules are loaded
- **Variants:** `"deferred"`, `"proxy"` → `"lazy"`; `"immediate"`, `"preload"` → `"eager"`
- **Behavior:**
  - `"eager"`: Load all modules immediately during initialization
  - `"lazy"`: Load modules on first access via proxies

#### `runtime`
- **Type:** `string`
- **Values:** `"async"` (default), `"live"`
- **Purpose:** Controls context propagation mechanism
- **Variants:** `"asynclocal"`, `"asynclocalstorage"` → `"async"`; `"livebindings"`, `"experimental"` → `"live"`
- **Behavior:**
  - `"async"`: Uses AsyncLocalStorage for per-request context
  - `"live"`: Uses live bindings (experimental)

### Collision Configuration

#### `collision`
- **Type:** `string | object`
- **Default:** `"merge"` (applies to both contexts)
- **Purpose:** Unified collision handling configuration for API path conflicts
- **Added:** v3.0.0
- **Replaces:** `allowInitialOverwrite`, `allowAddApiOverwrite` (v2 flags)

**String Shorthand:**
```javascript
{ collision: "merge" }  // Applies to both initial and addApi contexts
```

**Object Format (per-context control):**
```javascript
{
  collision: {
    initial: "merge",  // During initial API build
    addApi: "merge"    // During api.slothlet.api.add()
  }
}
```

**Valid Collision Modes:**

- **`"skip"`** - Silently ignore collision, keep existing value
  - Use case: Preserve first-loaded module, ignore duplicates
  - No warnings or errors, collision silently ignored

- **`"warn"`** - Warn about collision, keep existing value
  - Use case: Development/debugging mode
  - Logs warning to console, keeps existing value

- **`"replace"`** - Replace existing value completely
  - Use case: Plugin system where later modules override earlier ones
  - Completely overwrites existing API path with new value

- **`"merge"`** (default) - Merge properties (preserve original + add new)
  - Use case: Most common - combine functionality from multiple sources
  - Preserves existing properties, adds new ones
  - For wrapper conflicts, syncs child implementations

- **`"error"`** - Throw error on collision
  - Use case: Strict immutable mode, prevent any overwrites
  - Throws `SlothletError` with `OWNERSHIP_CONFLICT` code

**Examples:**
```javascript
// Development mode - merge everything
const api = await slothlet({
  dir: "./api",
  collision: "merge"
});

// Strict mode - no collisions allowed
const api = await slothlet({
  dir: "./api",
  collision: "error"
});

// Different per-context
const api = await slothlet({
  dir: "./api",
  collision: {
    initial: "skip",    // First file wins during startup
    addApi: "replace"   // Later plugins override
  }
});

// Case-insensitive and validated
const api = await slothlet({
  dir: "./api",
  collision: "MERGE"  // Normalized to "merge"
});
```

**Migration from v2:**
```javascript
// OLD v2 flags:
{
  allowInitialOverwrite: true,
  allowAddApiOverwrite: false
}

// NEW v3 collision config:
{
  collision: {
    initial: "merge",
    addApi: "skip"
  }
}
```

### Deprecated Mutation Controls (v2 compatibility)

#### `allowMutation` (REMOVED in v3)
- **v2 Behavior:** Enabled/disabled runtime API modification methods
- **v3 Change:** Runtime modifications always available via `api.slothlet.api.*`
- **Migration:** Remove this flag - use `collision: "error"` for immutable mode

#### `allowInitialOverwrite` (REMOVED in v3)
- **v2 Behavior:** Allowed overwriting during initial API build
- **v3 Replacement:** Use `collision.initial` mode
- **Migration:** `allowInitialOverwrite: true` → `collision.initial: "merge"`

#### `allowAddApiOverwrite` (REMOVED in v3)
- **v2 Behavior:** Allowed `api.add()` to overwrite existing paths
- **v3 Replacement:** Use `collision.addApi` mode
- **Migration:** `allowAddApiOverwrite: true` → `collision.addApi: "replace"`

### Hot Reload Features

#### `hotReload`
- **Type:** `boolean`
- **Default:** `false`
- **Purpose:** Enables ownership tracking for advanced module management
- **Enables:** Module ownership tracking and conflict detection

### Context and References

#### `context`
- **Type:** `object | null`
- **Default:** `null`
- **Purpose:** Global context available to all modules
- **Access:** Available as `context` in module scope

#### `reference`
- **Type:** `object | null`
- **Default:** `null`
- **Purpose:** Reference object merged into API root
- **Access:** Available as `reference` in module scope

### Performance and Debugging

#### `backgroundMaterialize`
- **Type:** `boolean`
- **Default:** `false`
- **Purpose:** Pre-load lazy modules during initialization
- **Trade-off:** Faster first access vs slower startup
- **Enables:** Accurate `typeof` checks immediately after init

#### `debug`
- **Type:** `boolean | object`
- **Default:** `false` (all debug flags disabled)
- **Purpose:** Enables detailed logging for troubleshooting
- **Boolean mode:** `true` enables all debug flags
- **Object mode:** Fine-grained control over debug categories
- **Categories:**
  - `builder`: API building process
  - `api`: API operations and modifications
  - `index`: Module indexing and discovery
  - `modes`: Mode-specific behavior (lazy/eager)
  - `wrapper`: Proxy and wrapper operations
  - `ownership`: Ownership tracking and conflicts
  - `context`: Context propagation and management

### Feature Flags

#### `hooks`
- **Type:** `boolean`
- **Default:** `false`
- **Purpose:** Enables hooks system (not yet implemented in v3)
- **Current status:** Throws `NOT_IMPLEMENTED` errors
- **Future:** Event system for API operations

#### `diagnostics`
- **Type:** `boolean`
- **Default:** `false`
- **Purpose:** Enables diagnostic mode with additional introspection
- **Behavior:** Preserves mutation methods even when `allowMutation: false`

#### `silent`
- **Type:** `boolean`
- **Default:** `false`
- **Purpose:** Suppresses all console output and warnings

## Common Configuration Patterns

### Basic Read-Only Instance
```javascript
const api = await slothlet({
  dir: "./api",
  collision: "error"  // Strict immutable mode
});
```

### Development with Hot Reload
```javascript
const api = await slothlet({
  dir: "./api",
  hotReload: true,
  collision: "merge",  // Default merge behavior
  debug: { api: true, ownership: true }
});
```

### Production Optimized
```javascript
const api = await slothlet({
  dir: "./api",
  mode: "eager",  // Faster calls
  runtime: "async",  // Stable context
  silent: true,  // No console output
  collision: "error"  // Strict mode
});
```

### Plugin System
```javascript
const api = await slothlet({
  dir: "./core-api",
  hotReload: true,
  collision: {
    initial: "merge",    // Merge core modules
    addApi: "replace"    // Plugins override core
  }
});

// Add plugins at runtime
await api.slothlet.api.add("plugins", "./plugins");
```

## Troubleshooting

### "Ownership conflict" or collision errors
**Cause:** Collision mode set to `"error"` or ownership conflict with `"warn"` mode
**Solution:** Use `collision: "merge"` or `collision: "replace"` mode for your use case

### API methods added via `api.add()` are undefined
**Cause:** Collision mode `"skip"` or `"warn"` kept existing value instead of merging
**Solution:** Use `collision.addApi: "merge"` or `"replace"` mode

### Path collision silently ignored
**Cause:** Collision mode set to `"skip"`
**Solution:** Use `collision: "merge"` or `"warn"` to see conflicts