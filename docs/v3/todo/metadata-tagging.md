# Function Metadata Tagging System

**Status:** ⚠️ NOT IMPLEMENTED  
**Priority:** 🟡 MEDIUM - V2 feature missing from V3  
**Complexity:** MEDIUM - Infrastructure exists, needs implementation  
**Related:** [docs/METADATA.md](../../METADATA.md) - Complete V2 documentation (1042 lines)

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

**📋 When metadata tests pass 100%:**
- Add `suites/metadata/metadata-api.test.vitest.mjs` to `tests/vitests/baseline-tests.json`
- But ONLY if `npm run debug` AND `npm run testv3 -- --baseline` both pass
- This ensures we catch regressions in working tests immediately

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
- ❌ **filePath in ownership.register()** - Ownership doesn't track file paths yet (15 call sites to update)
- ❌ **Secure metadata storage** - WeakMap system for immutable system metadata
- ❌ **Metadata tied to wrapper impl** - System metadata must track current impl, not wrapper
- ❌ **UnifiedWrapper integration** - Pass filePath/moduleId to wrapper constructor
- ❌ **Security verification** - caller() must verify stack trace matches metadata.filePath
- ❌ **User metadata API** - api.slothlet.metadata.setGlobal/set/remove methods

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

## Related Test Files

The following test files in `tests/vitests` are related to metadata tagging:

- **`suites/metadata/metadata-api.test.vitest.mjs`** - Comprehensive metadata API functionality tests including:
  - Attaching metadata to functions via addApi
  - Automatic sourceFolder addition
  - Metadata immutability (primitives and objects)
  - metadataAPI.get() path-based lookup
  - metadataAPI.caller() for access control
  - metadataAPI.self() for self-introspection

---

## Security Model & Architecture

### Core Principles

1. **System Metadata is IMMUTABLE and TRUSTED**
   - Stored in WeakMap (inaccessible externally)
   - Contains: `filePath`, `sourceFolder`, `apiPath`, `moduleId`, `taggedAt`
   - Used for security decisions (authorization, access control)
   - Updated when impl changes (tracked separately from wrapper)

2. **User Metadata is MUTABLE and UNTRUSTED**
   - Stored separately in WeakMap
   - User-provided convenience data (`version`, `author`, etc.)
   - NEVER use for security decisions
   - Can be set globally or per-function

3. **Metadata Tied to Implementation**
   - For wrappers: metadata follows current `_impl`, not wrapper itself
   - When `__setImpl()` called, metadata updates to reflect new impl
   - Prevents stale metadata after hot reload

4. **Dual Verification in caller()**
   - Stack trace provides file path (runtime truth)
   - Metadata provides stored file path (expected truth)
   - Mismatch triggers security warning
   - User gets both values to make decision

5. **Set During Creation, Not Post-Build**
   - Metadata attached when wrapper/function created
   - Works for lazy mode (before materialization)
   - No recursive post-build tagging needed

---

## Implementation Requirements

### Phase 1: Add filePath to Ownership (FOUNDATION)

**File**: `src/lib/handlers/ownership.mjs`

**Current signature** (lines 33-92):
```javascript
register({ moduleId, apiPath, value, source = "core", collisionMode = "error", config = null }) {
    // ... validation ...
    
    const entry = {
        moduleId,
        source,
        timestamp: Date.now(),
        value
        // ❌ NO filePath
    };
    
    this.pathToModule.get(apiPath).push(entry);
    return entry;
}
```

**Updated signature**:
```javascript
register({ moduleId, apiPath, value, source = "core", collisionMode = "error", config = null, filePath = null }) {
    // ... existing validation ...
    
    const entry = {
        moduleId,
        source,
        timestamp: Date.now(),
        value,
        filePath  // ✅ ADD THIS
    };
    
    this.pathToModule.get(apiPath).push(entry);
    return entry;
}
```

**Update 15 call sites**:
- `src/slothlet.mjs` (2 calls) - add `filePath: file.path`
- `src/lib/modes/lazy.mjs` (1 call) - add `filePath: file.path`
- `src/lib/handlers/api-manager.mjs` (1 call) - add `filePath: resolvedPath`
- `src/lib/builders/modes-processor.mjs` (11 calls) - add `filePath: file.path`

**Example update**:
```javascript
// Before
ownership.register({
    moduleId,
    apiPath,
    value: wrapper,
    source: "add",
    collisionMode
});

// After
ownership.register({
    moduleId,
    apiPath,
    value: wrapper,
    source: "add",
    collisionMode,
    filePath: file.path  // ✅ ADD THIS
});
```

---

### Phase 2: Create Secure Metadata Storage (SECURITY LAYER)

**File**: `src/lib/handlers/metadata.mjs`

**Add secure storage** (beginning of class):
```javascript
export class Metadata extends ComponentBase {
    static slothletProperty = "metadata";

    #secureMetadata = new WeakMap();  // target → system metadata (IMMUTABLE)
    #userMetadata = new WeakMap();     // target → user metadata (MUTABLE)
    #globalUserMetadata = {};          // global user metadata (applies to all)

    #runtimeModule = null;
    #runtimeImportPromise = null;

    constructor(slothlet) {
        super(slothlet);
    }

/**
 * Tag system metadata (SECURE, IMMUTABLE)
 * Called internally during wrapper/function creation
 * @param {Function|Object} target - Wrapper or function to tag
 * @param {Object} systemData - System metadata (filePath, apiPath, moduleId, sourceFolder)
 * @private
 */
#tagSystemMetadata(target, systemData) {
    // Store in secure WeakMap (inaccessible externally)
    const frozenSystem = Object.freeze({
        filePath: systemData.filePath,
        sourceFolder: systemData.sourceFolder,
        apiPath: systemData.apiPath,
        moduleId: systemData.moduleId,
        taggedAt: Date.now()
    });
    
    this.#secureMetadata.set(target, frozenSystem);
}

/**
 * Get metadata for a target (combines system + user)
 * For wrappers: checks current impl to ensure metadata is current
 * @param {Function|Object} target - Wrapper or function
 * @returns {Object} Combined metadata
 * @public
 */
getMetadata(target) {
    // For wrappers, verify impl hasn't changed
    if (target?.__wrapper) {
        const wrapper = target.__wrapper;
        const currentImpl = wrapper._impl;
        
        // Get system metadata for current impl (not wrapper)
        const systemData = this.#secureMetadata.get(currentImpl) || 
                          this.#secureMetadata.get(wrapper) ||
                          {};
        
        const userData = this.#userMetadata.get(wrapper) || {};
        
        return {
            ...this.#globalUserMetadata,
            ...systemData,
            ...userData
        };
    }
    
    // For direct functions
    const systemData = this.#secureMetadata.get(target) || {};
    const userData = this.#userMetadata.get(target) || {};
    
    return {
        ...this.#globalUserMetadata,
        ...systemData,
        ...userData
    };
}

/**
 * Set global user metadata (applies to all functions)
 * @param {Object} metadata - User metadata
 * @public
 */
setGlobalMetadata(metadata) {
    this.#globalUserMetadata = { ...metadata };
}

/**
 * Add/update user metadata for specific target
 * @param {string} apiPath - API path
 * @param {Object} metadata - User metadata
 * @public
 */
async setUserMetadata(apiPath, metadata) {
    const target = this.#findByPath(apiPath);
    if (target) {
        const existing = this.#userMetadata.get(target) || {};
        this.#userMetadata.set(target, { ...existing, ...metadata });
    }
}
```

**Update existing caller() method** (add security verification):
```javascript
/**
 * caller() with security verification
 * @returns {Promise<Object|null>} Caller metadata with verification
 * @public
 */
async caller() {
    await this.#ensureRuntime();
    const apiRoot = this.#getApiRoot();
    if (!apiRoot) return null;
    
    // Get stack trace
    const stack = this.slothlet.helpers.resolver.getStack(this.caller);
    if (stack.length < 1) return null;
    
    const parsed = this.#parseCallSite(stack[0]);
    if (!parsed) return null;
    
    // Find function by stack trace
    const func = this.#findFunctionByStack(apiRoot, parsed.file, parsed.line);
    if (!func) return null;
    
    // Get metadata
    const metadata = this.getMetadata(func);
    
    // SECURITY CHECK: Verify stack trace matches metadata
    const stackFilePath = this.slothlet.helpers.resolver.toFsPath(parsed.file);
    const metaFilePath = this.slothlet.helpers.resolver.toFsPath(metadata.filePath);
    
    if (stackFilePath !== metaFilePath) {
        // WARNING: Metadata mismatch (possible tampering or hot reload)
        new this.SlothletWarning("WARNING_METADATA_MISMATCH", {
            apiPath: metadata.apiPath,
            stackFile: stackFilePath,
            metadataFile: metaFilePath
        });
        
        // Return metadata with security warning
        return {
            ...metadata,
            __securityWarning: "FILE_PATH_MISMATCH",
            __stackFile: stackFilePath
        };
    }
    
    return metadata;
}
```

---

### Phase 3: Integrate with UnifiedWrapper (MODE INTEGRATION)

**File**: `src/lib/handlers/unified-wrapper.mjs`

**A. Constructor** - Attach metadata on creation (lines 87-127):
```javascript
constructor(slothlet, { 
    mode, 
    apiPath, 
    initialImpl = null, 
    materializeFunc = null, 
    isCallable, 
    materializeOnCreate = false,
    filePath = null,      // ✅ ADD THIS
    moduleId = null       // ✅ ADD THIS
}) {
    super(slothlet);
    this.mode = mode;
    this.apiPath = apiPath;
    // ... existing code ...
    
    // ✅ NEW: Tag wrapper with system metadata immediately
    if (filePath) {
        this.slothlet.handlers.metadata.#tagSystemMetadata(this, {
            filePath,
            apiPath,
            moduleId,
            sourceFolder: this.config?.dir
        });
    }
    
    // ✅ NEW: For eager mode with initial impl, also tag the impl
    if (initialImpl !== null && filePath) {
        this.slothlet.handlers.metadata.#tagSystemMetadata(initialImpl, {
            filePath,
            apiPath,
            moduleId,
            sourceFolder: this.config?.dir
        });
    }
    
    // ... rest of constructor ...
}
```

**B. __setImpl** - Update metadata when impl changes (lines 150-168):
```javascript
__setImpl(newImpl) {
    this._impl = newImpl;
    
    // ✅ NEW: Update metadata for new impl
    const wrapperMetadata = this.slothlet.handlers.metadata.getMetadata(this);
    if (wrapperMetadata && newImpl) {
        this.slothlet.handlers.metadata.#tagSystemMetadata(newImpl, {
            filePath: wrapperMetadata.filePath,
            apiPath: this.apiPath,
            moduleId: wrapperMetadata.moduleId,
            sourceFolder: wrapperMetadata.sourceFolder
        });
    }
    
    // ... rest of existing code ...
}
```

**C. Add metadata getter to proxy** (in createProxy method):
```javascript
createProxy() {
    // ... existing code ...
    
    return new Proxy(proxyTarget, {
        // ... existing traps ...
        
        get(target, prop, receiver) {
            // ✅ NEW: Add __metadata property
            if (prop === "__metadata") {
                return wrapper.slothlet.handlers.metadata.getMetadata(wrapper);
            }
            
            // ... existing get trap code ...
        }
    });
}
```

---

### Phase 4: Wire Into Build Pipeline (INTEGRATION)

**File**: `src/lib/builders/modes-processor.mjs`

**Pass filePath/moduleId to UnifiedWrapper constructor** (multiple locations):

```javascript
// Line ~90 - Eager wrapper creation for categories
if (mode === "eager") {
    const wrapper = new UnifiedWrapper(this.slothlet, {
        mode: "eager",
        apiPath: buildApiPath(categoryName),
        initialImpl,
        materializeOnCreate: config.backgroundMaterialize,
        filePath: directory.path,  // ✅ ADD THIS (folder path)
        moduleId: ownership ? `${categoryName}:${basename(directory.path)}` : null  // ✅ ADD THIS
    });
}

// Line ~108 - Lazy wrapper creation for categories
const wrapper = new UnifiedWrapper(this.slothlet, {
    mode,
    apiPath: buildApiPath(categoryName),
    materializeOnCreate: config.backgroundMaterialize,
    filePath: directory.path,  // ✅ ADD THIS
    moduleId: ownership ? `${categoryName}:${basename(directory.path)}` : null  // ✅ ADD THIS
});

// Line ~150+ - Module processing (individual files)
const wrapper = new UnifiedWrapper(this.slothlet, {
    mode,
    apiPath: buildApiPath(propertyName),
    initialImpl: mode === "eager" ? moduleContent : null,
    materializeFunc: mode === "lazy" ? async () => moduleContent : null,
    isCallable: typeof moduleContent === "function",
    materializeOnCreate: config.backgroundMaterialize,
    filePath: file.path,  // ✅ ADD THIS (module file path)
    moduleId: file.moduleId  // ✅ ADD THIS
});
```

**Update all 15+ wrapper creation sites** in modes-processor.mjs to pass filePath/moduleId.

---

### Phase 5: User Metadata API (USER INTERFACE)

**File**: `src/lib/builders/api_builder.mjs`

Add to `api.slothlet.metadata`:

```javascript
// In buildCoreAPI method, where slothlet APIs are created
{
    // Existing
    get: (path) => this.slothlet.handlers.metadata.get(path),
    caller: () => this.slothlet.handlers.metadata.caller(),
    self: () => this.slothlet.handlers.metadata.self(),
    
    // ✅ NEW: User metadata management
    setGlobal: (metadata) => this.slothlet.handlers.metadata.setGlobalMetadata(metadata),
    set: (apiPath, metadata) => this.slothlet.handlers.metadata.setUserMetadata(apiPath, metadata),
    remove: (apiPath) => this.slothlet.handlers.metadata.setUserMetadata(apiPath, {})
}
```

**Usage examples**:

```javascript
// Set global metadata (applies to all functions)
await api.slothlet.metadata.setGlobal({ 
    version: "1.0.0", 
    tenant: "acme",
    environment: "production"
});

// Set per-function metadata
await api.slothlet.metadata.set("plugins.dangerousFunc", { 
    restricted: true,
    requiresApproval: true
});

// Access combined metadata
const meta = api.plugins.dangerousFunc.__metadata;
// {
//   filePath: "/abs/path/plugins/dangerous.mjs",  // IMMUTABLE system data
//   apiPath: "plugins.dangerousFunc",             // IMMUTABLE system data
//   moduleId: "plugins:dangerous",                // IMMUTABLE system data
//   version: "1.0.0",                             // mutable user data
//   tenant: "acme",                               // mutable user data
//   restricted: true                              // mutable user data
// }

// Security check using IMMUTABLE system metadata
import { metadataAPI } from "@cldmv/slothlet/runtime";

export async function deleteUser(userId) {
    const caller = await metadataAPI.caller();
    
    // ✅ SECURE: Use immutable system metadata
    if (!caller?.filePath?.startsWith("/app/trusted/")) {
        throw new Error(`Access denied: caller from ${caller?.filePath}`);
    }
    
    // ❌ INSECURE: Don't use mutable user metadata for security
    // if (caller?.restricted) { ... }  // User can modify this!
    
    // Delete user...
}
```

---

## Key Security Features

1. **System metadata stored in WeakMap** - Inaccessible externally, can't be tampered with
2. **Metadata tied to impl** - When impl changes via __setImpl, metadata reflects current impl
3. **Double verification in caller()** - Stack trace + metadata filePath must match, warns on mismatch
4. **Metadata set during creation** - Not recursive post-build, works for lazy mode before materialization
5. **User vs system separation** - Clear distinction between trusted and untrusted data
6. **Hot reload support** - Metadata updates automatically when modules reload

---

## Testing Requirements

### Unit Tests (metadata-api.test.vitest.mjs - 160 tests)

The existing test suite covers:
- ✅ Attaching metadata to functions via addApi
- ✅ Automatic sourceFolder addition
- ✅ Metadata immutability (primitives and objects)
- ✅ metadataAPI.get() path-based lookup
- ✅ metadataAPI.caller() for access control
- ✅ metadataAPI.self() for self-introspection

**Additional tests needed**:
1. **WeakMap isolation**: Verify system metadata can't be accessed externally
2. **Impl tracking**: Verify metadata follows _impl, not wrapper
3. **__setImpl updates**: Verify metadata updates when impl changes
4. **Security verification**: Verify caller() detects file path mismatches
5. **User metadata**: Verify setGlobal/set/remove work correctly
6. **Hot reload**: Verify metadata survives reload operations

### Integration Tests

1. **Lazy mode**: Verify metadata attached before materialization
2. **Eager mode**: Verify metadata attached to initial impl
3. **Cross-module calls**: Verify caller() works across module boundaries
4. **Authorization patterns**: Test real security use cases

---

## Implementation Timeline

### Phase 1: filePath in ownership
- Update ownership.register() signature
- Update 15 call sites
- Test: Verify ownership tracks file paths
- **Estimate**: 2 hours

### Phase 2: Secure metadata storage
- Add WeakMaps to Metadata class
- Implement #tagSystemMetadata
- Implement getMetadata with impl tracking
- Update caller() with security verification
- **Estimate**: 4 hours

### Phase 3: UnifiedWrapper integration
- Update constructor signature
- Add metadata tagging in constructor
- Update __setImpl to retag
- Add __metadata getter to proxy
- **Estimate**: 3 hours

### Phase 4: Build pipeline wiring
- Update modes-processor wrapper creations
- Pass filePath/moduleId everywhere
- **Estimate**: 2 hours

### Phase 5: User metadata API
- Add setGlobal/set/remove to api.slothlet.metadata
- **Estimate**: 1 hour

### Testing & validation
- Run existing 160 tests
- Add new security tests
- Verify lazy/eager modes
- **Estimate**: 4 hours

**Total**: ~16 hours (~2 days)

---

## Next Steps

1. **Phase 1**: Add filePath to ownership.register() (foundation)
2. **Phase 2**: Implement secure WeakMap storage in Metadata class
3. **Phase 3**: Integrate with UnifiedWrapper constructor
4. **Phase 4**: Wire filePath through build pipeline
5. **Phase 5**: Add user metadata API methods
6. **Testing**: Run test suite, add security tests
7. **Documentation**: Update METADATA.md with V3 approach

---

## Migration from V2

**V2 approach** (from `src2/lib/helpers/metadata-api.mjs`):
- Metadata attached via recursive post-build tagging
- Stack-based caller/self introspection
- Direct __metadata property access

**V3 improvements**:
- ✅ **Kept**: `metadataAPI.caller()` and `.self()` - NECESSARY for security
- ✅ **Improved**: Metadata tied to impl (tracks hot reload correctly)
- ✅ **Improved**: Set during creation (works for lazy mode)
- ✅ **Enhanced**: Security verification (double-check stack vs metadata)
- ✅ **Enhanced**: User metadata API (setGlobal/set/remove)
- ✅ **Enhanced**: WeakMap storage (tamper-proof)

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
