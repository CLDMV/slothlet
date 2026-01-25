# Function Metadata Tagging System

**Status:** ⚠️ NOT IMPLEMENTED  
**Priority:** 🟡 MEDIUM - V2 feature missing from V3  
**Complexity:** MEDIUM - Infrastructure exists, needs implementation  
**Related:** [docs/METADATA.md](../../METADATA.md) - Complete V2 documentation (1042 lines)

---

## System Distinction

**Metadata Tagging** (this document) is **separate** from **ApiManager** (hot reload):

- **ApiManager** ([api-manager.mjs](../../src/lib/handlers/api-manager.mjs)): ✅ **COMPLETE** - Runtime API mutation (add/remove/reload)
- **Metadata Tagging**: ❌ **MISSING** - Function tagging with user-defined metadata

**Integration point**: When ApiManager adds/reloads modules, metadata should be applied to functions. This is the only connection between these two systems.

---

## Current State

**What Exists in V3**:
- ✅ Metadata handler class: `src/lib/handlers/metadata.mjs` (structure ready, methods need implementation)
- ✅ API surface: `addApiComponent()` accepts metadata parameter (not used)
- ✅ ApiManager integration point: Can call metadata tagging after buildAPI
- ✅ Ownership system: Already tracks moduleId → apiPath → file mappings
- ✅ Loader system: Already tracks file paths for loaded modules

**What's Missing (Core Metadata System)**:
- ❌ Metadata tagging pipeline - no code to attach immutable metadata to functions
- ❌ Function metadata attachment with deep freeze protection
- ❌ Integration with ownership system to include file path information
- ❌ Stack-based caller/self introspection (metadataAPI.caller(), metadataAPI.self())
- ❌ File path and line number tracking for stack-based function identification

---

## V2 Feature Overview

### Metadata Properties (Two Types)

**System metadata** (automatically set by slothlet, IMMUTABLE, TRUSTED):
```javascript
// These are set automatically by slothlet and CANNOT be modified
{
    sourceFolder: "/abs/path/to/plugins",  // Where module was loaded from
    filePath: "/abs/path/to/plugins/auth.mjs",  // Exact source file
    apiPath: "plugins.auth.login",  // Location in API tree
    moduleId: "plugins:trusted-core",  // Module identifier
    taggedAt: 1234567890  // Timestamp when tagged
}
```

**User metadata** (optional, provided by user, MUTABLE, UNTRUSTED):
```javascript
await api.slothlet.api.add("plugins.trusted", "./trusted-plugins", {
    version: "1.0.0",
    author: "Alice",
    description: "Trusted plugin bundle",
    // This is just CONVENIENCE data, NOT for security decisions
});
```

**CRITICAL**: User metadata is NOT immutable, NOT trusted for security. Use system metadata for authorization.

### Metadata Access (Direct + Stack-based)

**Two access patterns**:

1. **Direct access** - when you have the function reference:
```javascript
// Access metadata from function reference
const myFunc = api.plugins.trusted.someFunction;
const meta = myFunc.__metadata;
// Returns: { trusted: true, version: "1.0.0", author: "Alice", 
//           sourceFolder: "/abs/path", apiPath: "plugins.trusted.someFunction", ... }

// Or use metadata handler for path-based lookup
const meta2 = await api.slothlet.metadata.get("plugins.trusted.someFunction");
```

2. **Stack-based introspection** - for security/authorization (WHO CALLED ME? WHERE AM I FROM?):
```javascript
import { metadataAPI } from "@cldmv/slothlet/runtime";

// Check caller's SOURCE FOLDER (immutable system metadata)
export async function deleteUser(userId) {
    const callerMeta = await metadataAPI.caller();
    if (!callerMeta?.sourceFolder?.startsWith("/app/trusted/")) {
        throw new Error(`Access denied: caller from ${callerMeta?.sourceFolder}`);
    }
    // Proceed with deletion
}

// Check own source location (self-introspection)
export async function myFunction() {
    const selfMeta = await metadataAPI.self();
    console.log(`I am from: ${selfMeta?.sourceFolder}`);
    console.log(`My moduleId: ${selfMeta?.moduleId}`);
}
```

**What metadataAPI.caller() returns**: System metadata of the function that called you (sourceFolder, filePath, moduleId - all IMMUTABLE)

**What metadataAPI.self() returns**: System metadata of the current function (your own sourceFolder, filePath, moduleId)

**Why stack parsing is necessary**: Node.js has no built-in way to determine "who called me". Stack traces are the only reliable method for caller identification.

**Note on user metadata**: User-provided metadata (version, author, etc.) is also included but is NOT immutable, NOT trusted for security decisions. Only use system metadata (sourceFolder, filePath, moduleId) for authorization.

### Use Cases (Security via System Metadata)

1. **Source-based Authorization** (PRIMARY SECURITY USE CASE):
   ```javascript
   import { metadataAPI } from "@cldmv/slothlet/runtime";
   
   export async function deleteUser(userId) {
       const caller = await metadataAPI.caller();
       // Check IMMUTABLE system property (sourceFolder)
       if (!caller?.sourceFolder?.startsWith("/app/trusted-plugins/")) {
           throw new Error(`Access denied: caller not from trusted folder`);
       }
       // ... perform deletion
   }
   ```

2. **Module-based Authorization** - Use external secure registry:
   ```javascript
   // Maintain permissions in secure application layer (NOT in metadata)
   const secureModuleRegistry = {
       "core:admin-tools": { canDelete: true, canModify: true },
       "plugins:readonly": { canDelete: false, canModify: false }
   };
   
   export async function deleteUser(userId) {
       const caller = await metadataAPI.caller();
       const permissions = secureModuleRegistry[caller?.moduleId];
       if (!permissions?.canDelete) {
           throw new Error(`Module ${caller?.moduleId} lacks delete permission`);
       }
       // ... perform deletion
   }
   ```

3. **Path-based sandboxing** - Restrict operations by source folder:
   ```javascript
   export async function executeCommand(cmd) {
       const caller = await metadataAPI.caller();
       const allowedFolders = ["/app/system/", "/app/admin-tools/"];
       if (!allowedFolders.some(f => caller?.sourceFolder?.startsWith(f))) {
           throw new Error("Command execution restricted to system modules");
       }
       // ... execute command
   }
   ```

4. **Multi-tenant isolation** - Map moduleId to tenantId in secure registry:
   ```javascript
   const tenantMapping = { "tenant-a:plugins": "tenant-a", "tenant-b:plugins": "tenant-b" };
   
   export async function accessData(dataId) {
       const caller = await metadataAPI.caller();
       const callerTenant = tenantMapping[caller?.moduleId];
       if (callerTenant !== data.tenantId) {
           throw new Error("Tenant isolation violation");
       }
       // ... access data
   }
   ```

5. **Self-introspection** - Function checks its own source location:
   ```javascript
   export async function adaptiveBehavior() {
       const self = await metadataAPI.self();
       if (self?.sourceFolder?.includes("/dev-plugins/")) {
           console.log("Running in development mode");
       }
       // ... behave differently based on source
   }
   ```

6. **Audit logging** - Track which modules called which for security audits (using immutable moduleId/sourceFolder)

---

## Implementation Requirements

### 1. Metadata Tagging Pipeline

**Location**: Modify `src/lib/handlers/api-manager.mjs`

**In `addApiComponent()` method**:
```javascript
async addApiComponent(params) {
    const { apiPath, folderPath, metadata = {}, options = {} } = params;
    
    // Build API as usual
    const newApi = await this.slothlet.builders.builder.buildAPI({
        dir: resolvedPath,
        mode: this.config.mode,
        apiPathPrefix: normalizedPath,
        collisionContext: "addApi"
    });
    
    // NEW: Tag all functions with immutable metadata
    // Include sourceFolder and use ownership system for per-function file paths
    await this.#tagFunctionsWithMetadata(newApi, normalizedPath, {
        ...metadata,
        sourceFolder: path.resolve(folderPath)
    });
    
    // Continue with merge...
}

/**
 * Recursively tag all functions in API tree with immutable metadata.
 * @private
 * @param {object} obj - API object tree to traverse
 * @param {string} basePath - Base API path for this tree
 * @param {object} metadata - User-provided metadata to attach
 */
async #tagFunctionsWithMetadata(obj, basePath, metadata, visited = new WeakSet(), currentPath = basePath) {
    if (visited.has(obj)) return;
    if (typeof obj !== "object" || obj === null) return;
    visited.add(obj);
    
    for (const key of Object.keys(obj)) {
        const value = obj[key];
        const apiPath = `${currentPath}.${key}`;
        
        if (typeof value === "function") {
            // Get file path from ownership system (if available)
            const ownershipEntry = this.slothlet.handlers.ownership?.getOwner?.(apiPath);
            const filePath = ownershipEntry?.filePath;  // Ownership already tracks this
            
            // Tag function with immutable metadata
            this.slothlet.handlers.metadata.tagFunction(value, {
                ...metadata,
                apiPath,          // Where in API tree
                filePath,         // Actual source file (from loader)
                moduleId: ownershipEntry?.moduleId
            });
        } else if (typeof value === "object") {
            // Recurse into nested objects
            await this.#tagFunctionsWithMetadata(value, basePath, metadata, visited, apiPath);
        }
    }
}
```

### 2. Metadata Handler Implementation

**Location**: Complete `src/lib/handlers/metadata.mjs`

**Current structure** (exists but incomplete):
```javascript
class Metadata extends ComponentBase {
    constructor(slothlet) {
        super(slothlet);
    }
    
    /**
     * Tag a function with metadata (system + user).
     * @param {Function} func - Function to tag
     * @param {object} metadata - Metadata object (system + user data)
     * 
     * System metadata (sourceFolder, filePath, apiPath, moduleId) is deeply frozen.
     * User metadata (any custom properties) is NOT frozen - just convenience data.
     * 
     * Security model:
     * - Trust ONLY system metadata for authorization decisions
     * - User metadata is mutable, untrusted, for convenience only
     * 
     * Also attaches __sourceFile for stack-based caller identification.
     */
    tagFunction(func, metadata) {
        if (typeof func !== "function") return;
        
        // Separate system metadata (immutable) from user metadata (mutable)
        const systemMetadata = {
            sourceFolder: metadata.sourceFolder,
            filePath: metadata.filePath,
            apiPath: metadata.apiPath,
            moduleId: metadata.moduleId,
            taggedAt: Date.now()
        };
        
        // User metadata (everything else) - NOT frozen, NOT trusted
        const userMetadata = { ...metadata };
        delete userMetadata.sourceFolder;
        delete userMetadata.filePath;
        delete userMetadata.apiPath;
        delete userMetadata.moduleId;
        
        // Create metadata object: frozen system + unfrozen user data
        const frozenSystem = this.#createImmutableMetadata(systemMetadata);
        const combinedMetadata = { ...frozenSystem, ...userMetadata };
        
        // Attach metadata (non-enumerable, non-writable)
        Object.defineProperty(func, "__metadata", {
            value: combinedMetadata,
            writable: false,
            enumerable: false,  // Hidden from Object.keys()
            configurable: false  // Cannot be redefined or deleted
        });
        
        // Attach source file for stack-based identification (CRITICAL for metadataAPI.caller/self)
        if (metadata.filePath) {
            Object.defineProperty(func, "__sourceFile", {
                value: metadata.filePath,
                writable: false,
                enumerable: false,
                configurable: false
            });
        }
        
        // Note: __sourceLine would need to come from source map or export analysis
        // For now, rely on file path matching (less precise but workable)
    }
    
    /**
     * Get metadata for a function (convenience method).
     * @param {Function} func - Function to query
     * @returns {object|undefined} Frozen metadata or undefined
     */
    getMetadata(func) {
        return func?.__metadata;
    }
    
    /**
     * Get metadata by API path.
     * @param {string} apiPath - Path like "plugins.trusted.someFunc"
     * @returns {object|undefined} Metadata or undefined
     */
    get(apiPath) {
        const parts = apiPath.split(".");
        let current = this.slothlet.api;
        
        for (const part of parts) {
            if (part === "api") continue;  // Skip "api" prefix if present
            current = current?.[part];
            if (!current) return undefined;
        }
        
        return typeof current === "function" ? current.__metadata : undefined;
    }
    
    /**
     * Create deeply frozen, immutable metadata object.
     * Uses Proxy to prevent ALL modifications (existing props, new props, deletions).
     * Recursively freezes nested objects and arrays.
     * @private
     */
    #createImmutableMetadata(obj, visited = new WeakSet()) {
        if (obj === null || typeof obj !== "object") return obj;
        if (visited.has(obj)) return obj;
        visited.add(obj);
        
        // Recursively freeze nested structures
        const frozen = Array.isArray(obj) ? [] : {};
        for (const [key, value] of Object.entries(obj)) {
            frozen[key] = this.#createImmutableMetadata(value, visited);
        }
        
        // Deep freeze the object
        Object.freeze(frozen);
        
        // Wrap in Proxy to enforce immutability at runtime
        return new Proxy(frozen, {
            set() { return false; },  // Reject all modifications
            deleteProperty() { return false; },  // Reject deletions
            defineProperty() { return false; }  // Reject new properties
        });
    }
}
```

### 3. metadataAPI Runtime Export

**Location**: Create/modify `src/lib/runtime/metadata-api.mjs`

**Implementation** (leverages V2 approach with V3 improvements):

```javascript
import { self } from "@cldmv/slothlet/runtime";

/**
 * Parse V8 stack trace to extract file path and line number.
 * @private
 */
function parseStackFrame(frameString) {
    // Extract file:line from stack frame like "at functionName (file:///path/file.mjs:123:45)"
    const match = frameString.match(/\((.+?):(\d+):(\d+)\)/) || frameString.match(/at (.+?):(\d+):(\d+)/);
    if (!match) return null;
    
    let filePath = match[1];
    const lineNum = parseInt(match[2], 10);
    
    // Convert file:// URLs to filesystem paths
    if (filePath.startsWith("file://")) {
        filePath = fileURLToPath(filePath);
    }
    
    return { file: filePath, line: lineNum };
}

/**
 * Find function in API tree by matching source file.
 * @private
 */
function findFunctionByStack(apiRoot, targetFile, targetLine, visited = new WeakSet()) {
    if (!apiRoot || visited.has(apiRoot)) return null;
    visited.add(apiRoot);
    
    // Check if this is a function with matching source
    if (typeof apiRoot === "function" && apiRoot.__sourceFile) {
        // Match by file path (exact or normalized)
        if (apiRoot.__sourceFile === targetFile) {
            // If we have line numbers, match those too
            if (apiRoot.__sourceLine && targetLine) {
                if (apiRoot.__sourceLine === targetLine) return apiRoot;
            } else {
                // No line number - return based on file match only
                return apiRoot;
            }
        }
    }
    
    // Recurse into properties
    if (typeof apiRoot === "object" || typeof apiRoot === "function") {
        for (const key of Object.keys(apiRoot)) {
            const result = findFunctionByStack(apiRoot[key], targetFile, targetLine, visited);
            if (result) return result;
        }
    }
    
    return null;
}

export const metadataAPI = {
    /**
     * Get metadata of the function that called the current function.
     * CRITICAL for authorization: allows secure functions to validate their caller's permissions.
     * @returns {Promise<object|null>} Caller's metadata or null
     */
    async caller() {
        const apiRoot = self;  // Runtime binding to current API instance
        if (!apiRoot) return null;
        
        // Get stack trace
        const stack = new Error().stack.split("\n");
        // stack[0]: "Error"
        // stack[1]: "at metadataAPI.caller"
        // stack[2]: current function (the one checking)
        // stack[3]: THE CALLER we want to identify
        
        if (stack.length < 4) return null;
        
        const parsed = parseStackFrame(stack[3]);
        if (!parsed) return null;
        
        // Find function by source file
        const func = findFunctionByStack(apiRoot, parsed.file, parsed.line);
        return func?.__metadata || null;
    },
    
    /**
     * Get metadata of the currently executing function.
     * @returns {Promise<object|null>} Current function's metadata or null
     */
    async self() {
        const apiRoot = self;
        if (!apiRoot) return null;
        
        const stack = new Error().stack.split("\n");
        // stack[0]: "Error"
        // stack[1]: "at metadataAPI.self"
        // stack[2]: current function (the one we want)
        
        if (stack.length < 3) return null;
        
        const parsed = parseStackFrame(stack[2]);
        if (!parsed) return null;
        
        const func = findFunctionByStack(apiRoot, parsed.file, parsed.line);
        return func?.__metadata || null;
    },
    
    /**
     * Get metadata by API path (convenience method).
     * @param {string} path - API path like "plugins.someFunc"
     * @returns {Promise<object|null>} Metadata or null
     */
    async get(path) {
        const apiRoot = self;
        if (!apiRoot) return null;
        
        const parts = path.split(".");
        let current = apiRoot;
        
        for (const part of parts) {
            current = current?.[part];
            if (!current) return null;
        }
        
        return typeof current === "function" ? current.__metadata : null;
    }
};
```

**Export from runtime.mjs**:
```javascript
export { metadataAPI } from "./metadata-api.mjs";
```

### 4. Ownership System Integration

**Location**: Ensure ownership tracks file paths

**Ownership already tracks**:
- `moduleId` → which module owns this API path
- `apiPath` → where in the API tree
- `source` → how it was added ("load" vs "add")

**Need to add** (if not already present):
- `filePath` → actual source file that was loaded

This information comes from the loader and should be passed through to ownership.register():

```javascript
// In loader or buildAPI flow
ownership.register({
    moduleId,
    apiPath,
    source: "add",
    filePath: resolvedModulePath,  // ADD THIS if missing
    collisionMode
});
```

With file paths in ownership, metadata tagging can include exact source file for each function.

---

## Testing Requirements

### Unit Tests

1. **Metadata tagging**: Verify functions have `__metadata`, `__sourceFile` properties
2. **Immutability**: Ensure metadata is deeply frozen (cannot modify existing, add new, or delete)
3. **Auto-added fields**: Verify sourceFolder, apiPath, filePath added automatically
4. **Retrieval by path**: Test `metadata.get(apiPath)` with various API structures
5. **Property protection**: Verify `__metadata` is non-writable, non-configurable
6. **Nested objects**: Ensure nested metadata objects are also immutable
7. **Arrays**: Verify metadata arrays are completely frozen
8. **Stack parsing**: Verify parseStackFrame correctly extracts file paths
9. **Function finding**: Verify findFunctionByStack locates functions by file path

### Integration Tests

1. **addApi integration**: Test metadata attached during hot reload
2. **Nested functions**: Verify nested functions get correct apiPath in metadata
3. **Multiple add operations**: Ensure metadata doesn't conflict between moduleIds
4. **Direct access**: Test `func.__metadata` property access from user code
5. **Ownership correlation**: Verify metadata.filePath matches ownership records
6. **metadataAPI.caller()**: Test caller detection in nested function calls
7. **metadataAPI.self()**: Test self-introspection from within functions
8. **Authorization patterns**: Test permission checks using caller metadata
9. **Cross-module calls**: Verify caller detection across module boundaries

---

## Implementation Priority

### Phase 1: Core Tagging (HIGH PRIORITY)
- ✅ Metadata class structure exists
- ⚠️ Implement deep freeze with Proxy protection
- ⚠️ Wire tagFunction into addApiComponent flow
- ⚠️ Add sourceFolder auto-detection
- ⚠️ Ensure ownership system tracks filePath
- ⚠️ Pass apiPath/filePath/moduleId to tagFunction
- ⚠️ Attach __sourceFile (and __sourceLine if possible) to functions

### Phase 2: Stack-based Introspection (HIGH PRIORITY - SECURITY CRITICAL)
- ⚠️ Implement metadataAPI.caller() with stack parsing
- ⚠️ Implement metadataAPI.self() with stack parsing
- ⚠️ Create parseStackFrame() helper for V8 stack traces
- ⚠️ Create findFunctionByStack() for API tree traversal
- ⚠️ Export metadataAPI from @cldmv/slothlet/runtime
- ⚠️ Handle file:// URL → filesystem path conversion

### Phase 3: Testing & Validation (HIGH PRIORITY)
- ⚠️ Unit tests for immutability enforcement
- ⚠️ Integration tests with addApi hot reload
- ⚠️ Test metadataAPI.caller() accuracy in nested calls
- ⚠️ Test authorization patterns (permission checks)
- ⚠️ Verify metadata survives reload operations
- ⚠️ Test nested object/array freezing

### Phase 3: Documentation (MEDIUM PRIORITY)
- ⏳ Update METADATA.md with V3 approach
- ⏳ Add examples to README.md
- ⏳ Document security patterns (permission checks)
- ⏳ Migration guide from V2

---

## Performance Considerations

- **WeakMap usage**: No memory leaks from tagged functions (garbage collected)
- **Frozen metadata**: Prevents accidental mutations, enables safe sharing
- **Lazy evaluation**: Only tag functions on addApi, not initial load
- **Cache API paths**: Avoid repeated tree traversal in getByPath

---

## Documentation Updates Needed

1. Update [docs/METADATA.md](../../METADATA.md) with V3-specific details
2. Add metadata examples to README.md
3. Document metadataAPI import path and methods
4. Add JSDoc annotations to metadata.mjs
5. Create migration guide from V2 to V3 metadata

---

## Migration from V2

**V2 Location**: `src2/lib/helpers/metadata-api.mjs` (stack-based runtime)

**Key Differences in V3**:
- ✅ **Kept**: `metadataAPI.caller()` and `.self()` - NECESSARY for security model
- ✅ **Improved**: Uses ownership system for accurate file path tracking
- ✅ **Added**: Direct `func.__metadata` access for when you have the reference
- ✅ **Simplified**: File tracking via loader instead of manual annotation
- ⚠️ **Changed**: May not have line-level precision (file-level matching instead)

**NO Breaking Changes** (API surface preserved):
- ✅ `import { metadataAPI } from "@cldmv/slothlet/runtime"` - still exists
- ✅ `metadataAPI.caller()` - KEPT for authorization use cases
- ✅ `metadataAPI.self()` - KEPT for self-introspection
- ✅ `metadataAPI.get(path)` - unchanged
- ➕ `func.__metadata` - NEW direct access pattern (additional convenience)

**V3 Approach (System metadata for security)**:
```javascript
import { metadataAPI } from "@cldmv/slothlet/runtime";

// Security check using IMMUTABLE system metadata
export async function deleteUser(userId) {
    const callerMeta = await metadataAPI.caller();
    
    // Option 1: Check source folder (immutable, trusted)
    if (!callerMeta?.sourceFolder?.startsWith("/app/trusted/")) {
        throw new Error("Access denied: not from trusted folder");
    }
    
    // Option 2: Use external secure registry (based on immutable moduleId)
    const permissions = secureRegistry.getPermissions(callerMeta?.moduleId);
    if (!permissions?.canDelete) {
        throw new Error("Access denied: insufficient permissions");
    }
    
    // ... proceed
}

// Self-introspection
export async function myFunction() {
    const self = await metadataAPI.self();
    console.log(`I'm from: ${self?.sourceFolder}`);
}

// Direct access for convenience (when you have function reference)
const func = api.plugins.someFunc;
const meta = func.__metadata;  // Has both system + user metadata
// meta.sourceFolder - immutable, trusted
// meta.version - mutable, untrusted (user data)
```

---

## Timeline Estimate

- **Phase 1 (Core tagging + immutability)**: 1-2 days
- **Phase 2 (Stack-based introspection)**: 2-3 days (stack parsing, testing)
- **Phase 3 (Testing & validation)**: 1-2 days (authorization patterns, edge cases)
- **Phase 4 (Documentation)**: 1 day (optional, can defer)
- **Total**: ~5-8 days for complete implementation including security features

---

## Next Steps

1. Implement `#createImmutableMetadata()` in Metadata class with Proxy + deep freeze
2. Ensure ownership system includes `filePath` in registration
3. Wire `#tagFunctionsWithMetadata()` into `addApiComponent()` flow
4. Pass apiPath, filePath, moduleId from ownership to tagFunction
5. Attach `__sourceFile` (and `__sourceLine` if possible) to functions
6. Implement `metadataAPI.caller()` and `.self()` with stack parsing
7. Create `parseStackFrame()` helper for V8 stack trace parsing
8. Create `findFunctionByStack()` for API tree search by file path
9. Write unit tests for immutability enforcement
10. Write integration tests for caller-based authorization patterns
11. Test metadataAPI accuracy across module boundaries
12. Update METADATA.md with V3 security model

---

## Related Issues

- **Hot reload**: Works correctly, metadata tagging builds on top
- **Hooks system**: Hooks may want access to function metadata
- **Security**: Metadata can be used for authorization checks
