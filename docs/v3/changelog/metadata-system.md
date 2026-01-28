# Metadata System (v3)

**Status**: ✅ **Fully Implemented and Tested**  
**Version**: 3.0.0+  
**Files**: `src/lib/handlers/metadata.mjs`

---

## Overview

The Slothlet v3 metadata system provides **secure, immutable system metadata** combined with **flexible user metadata** for runtime introspection, authorization, auditing, and multi-tenant architectures. The system uses a dual-storage architecture with lifecycle event integration to ensure metadata accuracy and security.

### Key Features

- **Dual Metadata Storage**: Secure WeakMap for system metadata + centralized store for user metadata
- **Lifecycle Integration**: Automatic metadata tagging via `impl:created` and `impl:changed` events
- **Deep Immutability**: All metadata deeply frozen to prevent tampering
- **Security Verification**: Stack trace validation to detect metadata mismatches
- **Per-Wrapper Tracking**: Each UnifiedWrapper instance has unique metadata independent of implementation
- **Hot Reload Support**: Metadata updates automatically when implementations change

---

## Architecture

### Dual Storage System

#### 1. Secure System Metadata (WeakMap)

**Storage**: Private `#secureMetadata` WeakMap  
**Access**: Read-only via `getSystemMetadata()` and `getMetadata()`  
**Lifecycle**: Inaccessible externally, garbage-collected with wrapper

```javascript
// Stored in WeakMap (immutable, secure)
{
  filePath: "/absolute/path/to/module.mjs",
  sourceFolder: "/absolute/path/to",
  apiPath: "plugins.tools.helper",
  moduleID: "module-id:plugins/tools/helper",
  taggedAt: 1706400000000
}
```

#### 2. User Metadata Store (Map)

**Storage**: Private `#userMetadataStore` Map  
**Keys**: `moduleID` or root `apiPath`  
**Access**: Managed via `registerUserMetadata()`, `setUserMetadata()`, `removeUserMetadata()`

```javascript
// Structure in Map
"moduleID" → {
  metadata: { trusted: true, version: "1.0.0", ... },
  apiPaths: Set(["plugins.tools", "plugins.utils"])
}
```

#### 3. Global User Metadata

**Storage**: Private `#globalUserMetadata` object  
**Access**: Set via `setGlobalMetadata(key, value)`  
**Applies**: To all functions across all modules

---

## Lifecycle Integration

### Event-Driven Metadata Tagging

All metadata tagging **MUST** go through the lifecycle system. Direct calls are blocked with detailed error messages.

#### impl:created Event

Triggered when a new implementation is created (new module loaded).

```javascript
// In api-builder.mjs
lifecycle.emit("impl:created", {
  target: wrapper,
  impl: funcOrObj,
  moduleId: metadata.moduleID,
  apiPath: normalizedApiPath,
  filePath: metadata.filePath
});

// Metadata handler subscribes
lifecycle.on("impl:created", async (event) => {
  this.tagSystemMetadata(event.target, {
    filePath: event.filePath,
    apiPath: event.apiPath,
    moduleId: event.moduleId
  }, { _fromLifecycle: true });
});
```

#### impl:changed Event

Triggered when an existing wrapper's implementation changes (hot reload, collision replacement).

```javascript
// In unified-wrapper.mjs
lifecycle.emit("impl:changed", {
  target: this,
  oldImpl: this._impl,
  newImpl: impl,
  moduleId: moduleId
});

// Metadata handler updates
lifecycle.on("impl:changed", async (event) => {
  // Update system metadata with new moduleId
  this.tagSystemMetadata(event.target, {
    moduleId: event.moduleId,
    apiPath: existingMetadata.apiPath,
    filePath: existingMetadata.filePath
  }, { _fromLifecycle: true });
});
```

### Security Enforcement

```javascript
tagSystemMetadata(target, systemData, options = {}) {
  // ENFORCEMENT: All tagging MUST go through lifecycle
  if (!options._fromLifecycle) {
    throw new Error(
      "tagSystemMetadata() must be called through lifecycle system. " +
      "Use lifecycle.emit('impl:created') or lifecycle.emit('impl:changed')"
    );
  }
  // ... tagging logic
}
```

---

## API Reference

### Public Methods

#### `getMetadata(target)`

Get combined system + user metadata for a wrapper or function.

**Parameters**:
- `target` {Function|Object} - Wrapper, function, or proxy

**Returns**: `{Object}` - Deeply frozen combined metadata

**Merge Priority**: `global < user (by path) < user (by moduleID) < system`

```javascript
const meta = metadata.getMetadata(api.plugins.tools);
// {
//   trusted: true,              // user metadata (by moduleID)
//   version: "1.0.0",           // user metadata (by moduleID)
//   filePath: "/.../tools.mjs", // system metadata (highest priority)
//   apiPath: "plugins.tools",   // system metadata
//   moduleID: "mod:plugins/tools", // system metadata
//   taggedAt: 1706400000000     // system metadata
// }
```

#### `getSystemMetadata(target)`

Get **only** system metadata (no user metadata).

**Parameters**:
- `target` {Function|Object} - Wrapper or function

**Returns**: `{Object|null}` - System metadata or null

```javascript
const sysMeta = metadata.getSystemMetadata(api.plugins.tools);
// {
//   filePath: "/absolute/path/to/tools.mjs",
//   sourceFolder: "/absolute/path/to",
//   apiPath: "plugins.tools",
//   moduleID: "module-id:plugins/tools",
//   taggedAt: 1706400000000
// }
```

#### `setUserMetadata(target, key, value)`

Add/update user metadata for a specific function.

**Parameters**:
- `target` {Function|Object} - Function to tag
- `key` {string} - Metadata key
- `value` {*} - Metadata value

**Throws**:
- `INVALID_METADATA_TARGET` - Target not a function/object
- `METADATA_NO_MODULE_ID` - Target has no system metadata

```javascript
metadata.setUserMetadata(api.plugins.tools, "authorized", true);
metadata.setUserMetadata(api.plugins.tools, "maxRetries", 3);
```

#### `removeUserMetadata(target, key?)`

Remove user metadata from a function.

**Parameters**:
- `target` {Function|Object} - Function to remove metadata from
- `key` {string|string[]|Object} - Optional key(s) to remove (removes all if omitted)
  - `string`: Remove single key
  - `string[]`: Remove multiple keys
  - `{key: string[]}`: Remove nested keys from object values

```javascript
// Remove all user metadata
metadata.removeUserMetadata(api.plugins.tools);

// Remove single key
metadata.removeUserMetadata(api.plugins.tools, "authorized");

// Remove multiple keys
metadata.removeUserMetadata(api.plugins.tools, ["authorized", "maxRetries"]);

// Remove nested keys
metadata.removeUserMetadata(api.plugins.tools, {
  config: ["timeout", "retries"]
});
```

#### `setGlobalMetadata(key, value)`

Set global user metadata that applies to all functions.

**Parameters**:
- `key` {string} - Metadata key
- `value` {*} - Metadata value

```javascript
metadata.setGlobalMetadata("environment", "production");
metadata.setGlobalMetadata("tenant", "acme-corp");
```

#### `async caller()`

Get metadata of the function that called the current function.

**Returns**: `{Promise<Object|null>}` - Caller's metadata or null

**Security**: Verifies stack trace matches stored metadata

```javascript
// Inside a slothlet-loaded function
import { metadataAPI } from "@cldmv/slothlet/runtime";

async function protectedFunction() {
  const callerMeta = await metadataAPI.caller();
  
  if (!callerMeta.trusted) {
    throw new Error("Unauthorized caller");
  }
  
  // Security warning detection
  if (callerMeta.__securityWarning === "FILE_PATH_MISMATCH") {
    console.warn("Potential tampering detected!");
    console.warn("Stack file:", callerMeta.__stackFile);
  }
}
```

#### `async self()`

Get metadata of the current function.

**Returns**: `{Promise<Object|null>}` - Current function's metadata or null

```javascript
import { metadataAPI } from "@cldmv/slothlet/runtime";

async function myFunction() {
  const myMeta = await metadataAPI.self();
  console.log(`I am ${myMeta.apiPath}`);
  console.log(`Loaded from ${myMeta.filePath}`);
}
```

#### `async get(path, apiRoot?)`

Get metadata of any function by API path.

**Parameters**:
- `path` {string} - Dot-notation API path
- `apiRoot` {Object} - Optional API root (defaults to runtime's self binding)

**Returns**: `{Promise<Object|null>}` - Function's metadata or null

```javascript
const meta = await metadataAPI.get("plugins.tools.helper");
```

### Package Methods

#### `tagSystemMetadata(target, systemData, options)`

**Internal use only** - Called by lifecycle handlers.

**Parameters**:
- `target` {Function|Object} - Wrapper to tag
- `systemData` {Object} - System metadata object
- `options` {Object} - Must include `_fromLifecycle: true`

**Throws**: Error if `_fromLifecycle` is not true

#### `registerUserMetadata(apiPath, metadata)`

Register user metadata keyed by API path (used by `api.addApi()`).

**Parameters**:
- `apiPath` {string} - Root API path segment
- `metadata` {Object} - User metadata to store

```javascript
// Called internally by api.addApi()
metadata.registerUserMetadata("plugins", {
  trusted: true,
  version: "1.0.0"
});
```

#### `removeUserMetadataByApiPath(apiPath)`

Remove all user metadata for an API path (used by `api.remove()`).

**Parameters**:
- `apiPath` {string} - API path to remove

```javascript
// Called internally by api.remove()
metadata.removeUserMetadataByApiPath("plugins");
```

---

## Usage Patterns

### 1. Adding Metadata During Load

```javascript
const slothlet = await slothletFactory({ dir: "./api" });

await slothlet.api.addApi("plugins.trusted", "./trusted-plugins", {
  trusted: true,
  permissions: ["read", "write", "admin"],
  version: "1.0.0"
});

await slothlet.api.addApi("plugins.external", "./external-plugins", {
  trusted: false,
  permissions: ["read"],
  sandbox: true
});
```

### 2. Authorization Checking

```javascript
// In a protected function
import { metadataAPI } from "@cldmv/slothlet/runtime";

export async function sensitiveOperation() {
  const caller = await metadataAPI.caller();
  
  if (!caller?.trusted) {
    throw new Error("Unauthorized: Caller is not trusted");
  }
  
  if (!caller.permissions?.includes("admin")) {
    throw new Error("Unauthorized: Admin permission required");
  }
  
  // Proceed with sensitive operation
}
```

### 3. Multi-Tenant Isolation

```javascript
// Set tenant context globally
metadata.setGlobalMetadata("tenant", "acme-corp");

// In business logic
import { metadataAPI } from "@cldmv/slothlet/runtime";

export async function getCustomerData(customerId) {
  const self = await metadataAPI.self();
  const tenantId = self.tenant; // "acme-corp"
  
  // Filter data by tenant
  return db.customers.find({
    id: customerId,
    tenantId: tenantId
  });
}
```

### 4. Auditing and Logging

```javascript
import { metadataAPI } from "@cldmv/slothlet/runtime";

export async function auditedFunction(data) {
  const self = await metadataAPI.self();
  const caller = await metadataAPI.caller();
  
  console.log(`[AUDIT] ${self.apiPath} called by ${caller?.apiPath || "external"}`);
  console.log(`[AUDIT] Source: ${self.filePath}`);
  console.log(`[AUDIT] Trusted: ${caller?.trusted || false}`);
  
  // Perform operation
  const result = performOperation(data);
  
  console.log(`[AUDIT] Operation completed`);
  return result;
}
```

### 5. Dynamic Metadata Updates

```javascript
// Update metadata for specific function
metadata.setUserMetadata(api.plugins.tools.helper, "callCount", 0);

// In the function
export async function helper() {
  const self = await metadataAPI.self();
  const count = (self.callCount || 0) + 1;
  
  metadata.setUserMetadata(helper, "callCount", count);
  metadata.setUserMetadata(helper, "lastCalled", Date.now());
}
```

---

## Security Features

### 1. Stack Trace Verification

The `caller()` method verifies that the stack trace matches stored metadata:

```javascript
async caller() {
  // ... get function from stack trace
  const metadata = this.getMetadata(func);
  
  // SECURITY CHECK: Verify stack trace matches metadata
  if (stackFilePath !== metaFilePath) {
    return {
      ...metadata,
      __securityWarning: "FILE_PATH_MISMATCH",
      __stackFile: stackFilePath
    };
  }
  
  return metadata;
}
```

### 2. Immutable System Metadata

System metadata is stored in a WeakMap that's inaccessible externally:

```javascript
class Metadata {
  #secureMetadata = new WeakMap(); // Private, inaccessible
  
  tagSystemMetadata(target, systemData) {
    const frozenSystem = Object.freeze({
      filePath: systemData.filePath,
      apiPath: systemData.apiPath,
      moduleID: systemData.moduleID,
      taggedAt: Date.now()
    });
    
    this.#secureMetadata.set(target, frozenSystem);
  }
}
```

### 3. Deep Freezing

All metadata is deeply frozen to prevent tampering:

```javascript
#deepFreeze(obj) {
  if (Object.isFrozen(obj)) return obj;
  
  Object.freeze(obj);
  
  Object.getOwnPropertyNames(obj).forEach((prop) => {
    if (obj[prop] !== null && typeof obj[prop] === "object") {
      this.#deepFreeze(obj[prop]);
    }
  });
  
  return obj;
}
```

### 4. Lifecycle Enforcement

Direct metadata tagging is blocked - must go through lifecycle events:

```javascript
if (!options._fromLifecycle) {
  throw new Error(
    "tagSystemMetadata() must be called through lifecycle system. " +
    "Use lifecycle.emit('impl:created') or lifecycle.emit('impl:changed')"
  );
}
```

---

## Testing

**Test Suite**: `tests/vitests/suites/metadata/`

- ✅ `metadata-api.test.vitest.mjs` - Core API methods
- ✅ `metadata-collision-modes.test.vitest.mjs` - Collision mode handling
- ✅ `metadata-immutability.test.vitest.mjs` - Deep freeze verification
- ✅ `metadata-lifecycle.test.vitest.mjs` - Lifecycle integration
- ✅ `metadata-security.test.vitest.mjs` - Security features

**Baseline**: All metadata tests included in `baseline-tests.json`

**Coverage**: 672 tests across 8 configurations (EAGER, LAZY, HOOKS, LIVE variants)

---

## Migration from v2

### Breaking Changes

1. **Dual Storage**: System metadata now separate from user metadata
2. **Lifecycle Required**: Direct `tagSystemMetadata()` calls blocked
3. **Per-Wrapper Metadata**: Each UnifiedWrapper has unique metadata (not shared with impl)
4. **ModuleID Format**: Now includes API path: `"moduleId:api/path"`

### Migration Steps

**v2 Code**:
```javascript
// Direct metadata access
const meta = func.__metadata;
meta.customProp = "value"; // Allowed in v2
```

**v3 Code**:
```javascript
// Use metadata handler
const meta = metadata.getMetadata(func);
// meta is deeply frozen - cannot modify

// Update user metadata separately
metadata.setUserMetadata(func, "customProp", "value");
```

### Compatibility

- ✅ `__metadata` property still available on functions (for backwards compatibility)
- ✅ Runtime introspection API unchanged (`metadataAPI.caller()`, etc.)
- ✅ Metadata immutability behavior identical
- ⚠️ Internal tagging mechanism completely rewritten

---

## Internal Implementation Details

### ModuleID Construction

```javascript
let fullModuleID = systemData.moduleId;
if (systemData.apiPath && systemData.moduleId) {
  const apiPathSlashes = systemData.apiPath.replace(/\./g, "/");
  fullModuleID = `${systemData.moduleId}:${apiPathSlashes}`;
}
// Example: "my-module:plugins/tools/helper"
```

### SourceFolder Derivation

```javascript
let sourceFolder = systemData.sourceFolder;
if (!sourceFolder && systemData.filePath) {
  const pathModule = this.slothlet.helpers.resolver.path;
  sourceFolder = pathModule.dirname(systemData.filePath);
}
```

### Metadata Lookup Priority

```javascript
getMetadata(target) {
  // 1. Get system metadata (WRAPPER first, then _impl fallback)
  const systemData = 
    this.#secureMetadata.get(actualTarget) || 
    this.#secureMetadata.get(actualTarget._impl) || 
    {};
  
  // 2. Get user metadata (by path and by moduleID)
  const userMetadataByPath = rootApiPath ? 
    this.#userMetadataStore.get(rootApiPath) : null;
  const userMetadataByModule = moduleID ? 
    this.#userMetadataStore.get(moduleID) : null;
  
  // 3. Merge: global < user (path) < user (moduleID) < system
  return this.#deepFreeze({
    ...this.#globalUserMetadata,
    ...(userMetadataByPath?.metadata || {}),
    ...(userMetadataByModule?.metadata || {}),
    ...systemData // System ALWAYS wins
  });
}
```

---

## Related Documentation

- [docs/METADATA.md](../../METADATA.md) - Complete v2 documentation (1042 lines)
- [docs/v3/todo/metadata-tagging.md](../todo/metadata-tagging.md) - v3 implementation notes
- [CONTEXT-PROPAGATION.md](../../CONTEXT-PROPAGATION.md) - Context system (works with metadata)
- [API-RULES.md](../../API-RULES.md) - API construction rules

---

## Summary

The v3 metadata system provides enterprise-grade security and flexibility:

✅ **Secure**: WeakMap storage + lifecycle enforcement  
✅ **Immutable**: Deep freezing prevents tampering  
✅ **Verified**: Stack trace validation detects mismatches  
✅ **Flexible**: Dual storage for system + user metadata  
✅ **Hot-Reload Ready**: Updates automatically on impl changes  
✅ **Tested**: 672 tests across 8 configurations  

The system is production-ready and fully integrated with the ownership, lifecycle, and hot reload systems.
