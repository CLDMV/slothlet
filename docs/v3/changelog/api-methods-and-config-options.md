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

**Dependencies:**
- Requires `allowMutation: true` in initial config
- Falls back to `allowAddApiOverwrite` config if no explicit options provided

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
- Requires `allowMutation: true` in initial config
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
- Requires `allowMutation: true` in initial config

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

### Mutation Controls

#### `allowMutation`
- **Type:** `boolean`
- **Default:** `true`
- **Purpose:** Enables/disables runtime API modification methods
- **Controls:** `api.slothlet.api.*`, `api.slothlet.reload()`
- **When `false`:** Removes `api`, `reload` properties from `api.slothlet`

#### `allowInitialOverwrite`
- **Type:** `boolean`
- **Default:** `true`
- **Purpose:** Allows overwriting existing files during initial API build
- **Use Case:** Multiple modules claiming same API path during startup

#### `allowAddApiOverwrite`
- **Type:** `boolean`
- **Default:** `false`
- **Purpose:** Allows `api.slothlet.api.add()` to overwrite existing API paths
- **Behavior:** Sets default `mutateExisting: true` for all add operations
- **Alternative:** Use `mutateExisting: true` in individual add calls

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
  allowMutation: false  // No runtime modifications
});
```

### Development with Hot Reload
```javascript
const api = await slothlet({
  dir: "./api",
  hotReload: true,
  allowMutation: true,
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
  allowMutation: false  // Immutable
});
```

### Plugin System
```javascript
const api = await slothlet({
  dir: "./core-api",
  hotReload: true,
  allowMutation: true,
  allowAddApiOverwrite: true  // Allow plugin overwrites
});

// Add plugins at runtime
await api.slothlet.api.add("plugins", "./plugins");
```

## Troubleshooting

### "Cannot perform 'api.add' - mutation is disabled"
**Cause:** `allowMutation: false` in config
**Solution:** Set `allowMutation: true` or remove mutation-dependent code

### "Ownership conflict"
**Cause:** Multiple modules claiming same API path with different ownership
**Solution:** Use `allowAddApiOverwrite: true` in config, or use `mutateExisting: true` in add options

### API methods undefined
**Cause:** `allowMutation: false` removes `api.slothlet.api` object
**Solution:** Set `allowMutation: true` or avoid mutation operations