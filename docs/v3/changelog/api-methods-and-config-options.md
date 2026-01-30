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
- `moduleId` (string): Unique identifier for ownership tracking. Default: auto-generated
- `forceOverwrite` (boolean): Force complete replacement of existing values regardless of collision mode. Requires explicit `moduleId`. Use with caution.

**Collision Handling:**
- Uses `api.collision.api` config option to determine behavior on path conflicts
- Collision mode is set at initialization and cannot be overridden per-call for security reasons
- `forceOverwrite` option provides explicit override for cases requiring complete replacement
- Modes: `"skip"`, `"warn"`, `"replace"`, `"merge"` (default), `"merge-replace"`, `"error"`

**Dependencies:**
- Requires `api.mutations.add: true` in config (default: true)
- Collision behavior controlled by `api.collision.api` config setting

**Examples:**
```javascript
// Basic usage
await api.slothlet.api.add("plugins", "./plugins");

// With custom moduleId
await api.slothlet.api.add("plugins", "./plugins", {}, {
  moduleId: "plugins-v1"
});

// With metadata
await api.slothlet.api.add("plugins", "./plugins", {
  version: "1.0.0",
  author: "me"
});

// Force complete replacement (requires moduleId)
await api.slothlet.api.add("config", "./new-config", {}, {
  moduleId: "config-v2",
  forceOverwrite: true
});
```

---

### `api.slothlet.api.remove(pathOrModuleId)`

**Purpose:** Removes API modules by API path or module ID from the running instance.

**Parameters:**
- `pathOrModuleId` (string): Either an API path (e.g., `"plugins"`) or module ID used during add

**Dependencies:**
- Requires `api.mutations.remove: true` in config (default: true)

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

### `api.slothlet.sanitize(str)`

**Purpose:** Sanitizes a string using the same rules applied during API path construction.

**Parameters:**
- `str` (string): String to sanitize (e.g., filename, path segment)

**Returns:** Sanitized property name safe for API use

**Use Cases:**
- Predict what API path a given filename will become
- Validate naming conventions before creating files
- Debug API path resolution issues

**Examples:**
```javascript
// File name sanitization
api.slothlet.sanitize("my-module.mjs");  // => "myModule"
api.slothlet.sanitize("auto-IP.mjs");    // => "autoIP"
api.slothlet.sanitize("user_settings.mjs");  // => "userSettings"

// Predict API paths
const filename = "data-processor.mjs";
const apiPath = api.slothlet.sanitize(filename);
console.log(`File ${filename} will be accessible at api.${apiPath}`);
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

#### `apiDepth`
- **Type:** `number`
- **Default:** `Infinity`
- **Purpose:** Limits the maximum depth of API nesting during module loading
- **Use case:** Performance optimization for deeply nested module structures

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
  api: {
    collision: {
      initial: "merge",  // During initial API build
      api: "merge"       // During api.slothlet.api.add()
    }
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

- **`"merge-replace"`** - Merge properties (add new + overwrite existing)
  - Use case: Similar to merge but new values take precedence
  - Adds new properties and overwrites existing ones with new values

- **`"error"`** - Throw error on collision
  - Use case: Strict immutable mode, prevent any overwrites
  - Throws `SlothletError` with `OWNERSHIP_CONFLICT` code

**Examples:**
```javascript
// Development mode - merge everything
const api = await slothlet({
  dir: "./api",
  api: {
    collision: "merge"
  }
});

// Strict mode - no collisions allowed
const api = await slothlet({
  dir: "./api",
  api: {
    collision: "error"
  }
});

// Different per-context
const api = await slothlet({
  dir: "./api",
  api: {
    collision: {
      initial: "skip",  // First file wins during startup
      api: "replace"    // Later plugins override
    }
  }
});

// Case-insensitive and validated
const api = await slothlet({
  dir: "./api",
  api: {
    collision: "MERGE"  // Normalized to "merge"
  }
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
  api: {
    collision: {
      initial: "merge",
      api: "skip"
    }
  }
}
```

### API Mutation Controls

#### `api.mutations`
- **Type:** `object`
- **Default:** `{ add: true, remove: true, reload: true }`
- **Purpose:** Controls which runtime API modification methods are available
- **Properties:**
  - `add` (boolean): Enable/disable `api.slothlet.api.add()` method
  - `remove` (boolean): Enable/disable `api.slothlet.api.remove()` method
  - `reload` (boolean): Enable/disable `api.slothlet.reload()` method

**Examples:**
```javascript
// Disable all mutations (immutable mode)
const api = await slothlet({
  dir: "./api",
  api: {
    mutations: {
      add: false,
      remove: false,
      reload: false
    }
  }
});

// Allow add but disable remove/reload
const api = await slothlet({
  dir: "./api",
  api: {
    mutations: {
      add: true,
      remove: false,
      reload: false
    }
  }
});
```

**Migration from v2:**
```javascript
// OLD v2:
{ allowMutation: false }

// NEW v3:
{
  api: {
    mutations: {
      add: false,
      remove: false,
      reload: false
    }
  }
}

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
- **Purpose:** Pre-load lazy modules during initialization (lazy mode only)
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

**Examples:**
```javascript
// Enable all debug logging
const api = await slothlet({
  dir: "./api",
  debug: true
});

// Enable specific categories
const api = await slothlet({
  dir: "./api",
  debug: {
    api: true,
    ownership: true
  }
});

### Scope Configuration

#### `scope`
- **Type:** `object`
- **Default:** `{ merge: "shallow" }`
- **Purpose:** Controls how context is merged in `api.slothlet.scope()` calls
- **Properties:**
  - `merge` (string): Merge strategy - `"shallow"` or `"deep"`

**Examples:**
```javascript
// Use deep merge for nested context objects
const api = await slothlet({
  dir: "./api",
  scope: {
    merge: "deep"
  }
});
```

### Feature Flags

#### `hook`
- **Type:** `boolean | string | object`
- **Default:** `false`
- **Purpose:** Enables hooks system for API lifecycle events
- **Formats:**
  - `true`: Enable all hooks with pattern `"**"`
  - `false`: Disable hooks
  - `string`: Enable hooks with specific pattern (e.g., `"math.*"`)
  - `object`: Full configuration with `{ enabled, pattern, suppressErrors }`
- **Properties (object mode):**
  - `enabled` (boolean): Enable/disable hooks
  - `pattern` (string): Glob pattern for which API paths trigger hooks (default: `"**"`)
  - `suppressErrors` (boolean): If true, errors in hooks don't propagate to caller

**Examples:**
```javascript
// Enable all hooks
const api = await slothlet({
  dir: "./api",
  hook: true
});

// Enable hooks for specific paths
const api = await slothlet({
  dir: "./api",
  hook: "math.**"
});

// Full configuration
const api = await slothlet({
  dir: "./api",
  hook: {
    enabled: true,
    pattern: "**",
    suppressErrors: false
  }
});
```

#### `silent`
- **Type:** `boolean`
- **Default:** `false`
- **Purpose:** Suppresses all console output and warnings

## Common Configuration Patterns

### Basic Read-Only Instance
```javascript
const api = await slothlet({
  dir: "./api",
  api: {
    collision: "error",  // Strict immutable mode
    mutations: {
      add: false,
      remove: false,
      reload: false
    }
  }
});
```

### Development with Hooks
```javascript
const api = await slothlet({
  dir: "./api",
  hook: true,
  api: {
    collision: "merge"  // Default merge behavior
  },
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
  api: {
    collision: "error"  // Strict mode
  }
});
```

### Plugin System
```javascript
const api = await slothlet({
  dir: "./core-api",
  hook: true,
  api: {
    collision: {
      initial: "merge",  // Merge core modules
      api: "replace"     // Plugins override core
    }
  }
});

// Add plugins at runtime
await api.slothlet.api.add("plugins", "./plugins");
```

## Troubleshooting

### "Ownership conflict" or collision errors
**Cause:** Collision mode set to `"error"` or ownership conflict with `"warn"` mode
**Solution:** Use `api.collision: "merge"` or `"replace"` mode for your use case

### API methods added via `api.add()` are undefined
**Cause:** Collision mode `"skip"` or `"warn"` kept existing value instead of merging
**Solution:** Use `api.collision.api: "merge"` or `"replace"` mode

### Path collision silently ignored
**Cause:** Collision mode set to `"skip"`
**Solution:** Use `api.collision: "merge"` or `"warn"` to see conflicts

### Mutation methods throw errors
**Cause:** Mutation methods disabled via `api.mutations` config
**Solution:** Enable the specific mutation method needed (add/remove/reload)