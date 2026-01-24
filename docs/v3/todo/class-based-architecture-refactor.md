# Class-Based Architecture Refactor Plan

**Date:** January 24, 2026  
**Status:** ⏳ Phase 2: In Progress (1 of 4 steps complete) - api-manager converted  
**Checkpoint Commit:** `5f7f839` - "chore: pre-class refactor checkpoint"  
**Latest Progress:** `5495a4b` - Phase 2.1 complete - api-manager converted to ApiManager class

## Progress Summary

### ✅ Completed

**Phase 1: File Reorganization (5/5 COMPLETE)**

- **Step 1.3**: Moved `helpers/api_assignment.mjs` → `builders/api-assignment.mjs` (commits `9a3fb82`, `e265ecb`)
  - File moved with `git mv` preserving history
  - All imports updated in `api-manager.mjs` (formerly hot_reload.mjs) and `modes.mjs`
  - Collision detection unified: removed safeAssign callback, moved logic into assignToApiPath
  - 94 lines deleted from modes.mjs
  - All 240 collision tests + debug tests passing ✅

- **Step 1.2**: Moved `helpers/hot_reload.mjs` → `handlers/api-manager.mjs` (commit `ecfa60f`)
  - File renamed to kebab-case + better name (api-manager reflects add/remove/reload, not just hot reload)
  - Updated import in `api_builder.mjs`
  - Both critical tests passing (240 collision + debug) ✅

- **Step 1.1 DELETED**: `helpers/instance-manager.mjs` removed (commit `e8d21f9`)
  - File was UNUSED in V3 architecture
  - Functionality duplicated by AsyncContextManager/LiveContextManager
  - Context managers handle instance registry via `.instances` Map
  - Context managers handle active instance via AsyncLocalStorage
  - Only used in src2/ (V2 architecture) - that copy remains
  - Reverted move commits (aa197c1, c2ccbc7) before deletion

- **Step 1.5a**: Moved `helpers/loader.mjs` → `processors/loader.mjs` (commit `4ab350d`)
  - Stateless module transformer belongs in processors
  - Updated imports in lazy.mjs, eager.mjs, modes.mjs
  - Updated @module declaration
  - Debug test passing ✅

- **Step 1.5b**: Moved `helpers/flatten.mjs` → `processors/flatten.mjs` (commit `4ab350d`)
  - Stateless API flattening logic belongs in processors
  - Updated imports in eager.mjs, modes.mjs
  - Updated @module declaration
  - Debug test passing ✅

- **Step 1.4**: Split `helpers/modes.mjs` into utilities and orchestration (commit `48c3400`)
  - Created `helpers/modes-utils.mjs` with 5 pure utility functions
  - Created `builders/modes-processor.mjs` with 3 orchestration functions
  - Updated imports in lazy.mjs, eager.mjs
  - Deleted original modes.mjs
  - Both critical tests passing (240 collision + 441 debug) ✅

- **Package.json**: Added `./processors/*` wildcard export (commit `4ab350d`)

- **factories/ directory**: Created for factory pattern files (commit `73ebd93`)
  - Moved `context.mjs` from handlers/ to factories/
  - Added `./factories/*` to package.json exports
  - Factory pattern: Select/provide class instances (getContextManager selects async/live)

**Phase 2: Class Conversions (1/4 COMPLETE)**

- **Phase 2.1**: ✅ Convert api-manager.mjs to ApiManager class (commit `5495a4b`)
  - Converted function-based to class-based architecture
  - WeakMap state → instance properties (addHistory, removedModuleIds, initialConfig)
  - 14 private functions → private methods
  - 3 exported functions → public methods (addApiComponent, removeApiComponent, reloadApiComponent)
  - Added getters: config, debug, instanceID, api, boundApi
  - Updated api_builder.mjs to instantiate ApiManager and use class methods
  - Bound syncWrapper method when passing to mergeApiObjects
  - All 441 debug paths pass (3 acceptable exportDefault.extra differences)
  - All 240 collision config tests pass ✅

### 🎯 Next Steps

**Phase 2: Class Conversions (Continue)**
- **Phase 2.2**: Convert builders to classes (builder, api-builder, api-assignment, modes-processor)
- **Phase 2.3**: Convert processors to classes (loader, flatten)  
- **Phase 2.4**: Update Slothlet main class to use class-based components

### 📝 File Naming Convention
**All source files must use kebab-case** (e.g., `api-manager.mjs`, not `api_manager.mjs` or `apiManager.mjs`). This refactor includes renaming:
- `hot_reload.mjs` → `api-manager.mjs` ✅ **DONE** (commit ecfa60f) - also better name (covers add/remove/reload, not just hot reload)
- `api_assignment.mjs` → `api-assignment.mjs` ✅ **DONE** (commit e265ecb)

---

## Overview

Refactor Slothlet's helper system from standalone functions requiring config/instance parameters to be passed through every call, to a class-based architecture where components are instantiated with a reference to the Slothlet orchestrator and can access configuration directly via `this.config`.

## Two-Level Isolation Architecture

**1. Slothlet Class Instance Isolation (Orchestrator Level)**
```javascript
const slothlet1 = new Slothlet(); // Orchestrator #1
const slothlet2 = new Slothlet(); // Orchestrator #2
// Each has its own: config, api, ownership, components, etc.
// Components are bound to their parent Slothlet instance
```

**2. Runtime Context Store Isolation (Execution Level)**
```javascript
const store = contextManager.initialize(instanceID, config);
// Managed by AsyncLocalStorage (async runtime) or LiveContextManager (live runtime)
// Accessed by user API files via runtime.mjs (self, context, reference)
// Handles execution context isolation - NOT attached to Slothlet class
```

**Key Architecture Points:**
- **Components receive `slothlet`**: The Slothlet class instance (orchestrator), not a separate "instance" object
- **ComponentBase stores `this.slothlet`**: Reference to the parent Slothlet orchestrator
- **Each Slothlet creates its own components**: `slothlet1.apiManager` ≠ `slothlet2.apiManager`
- **Runtime store is internal**: Managed by contextManager, not exposed on Slothlet class
- **Error classes on Slothlet**: `this.SlothletError` accessible without imports

## Problem Statement

Current architecture requires passing `config` or `instance` parameters through deep function call chains, creating "spaghetti code":

```javascript
// Current (BAD)
async function addApiComponent(params) {
    const config = slothlet.config; // Parameter pollution starts
    await mutateApiValue(existing, next, options, config); // Pass config
}

async function mutateApiValue(existing, next, options, config) {
    if (config?.debug?.api) { // Receive config as parameter
        console.log(...);
    }
    await mergeApiObjects(target, source, options, config); // Pass it again
}

async function mergeApiObjects(target, source, options, config) {
    if (config?.debug?.api) { // Receive config AGAIN
        console.log(...);
    }
}
```

This pattern creates:
- Parameter pollution through call chains
- Hard to refactor when signatures change
- Verbose and error-prone
- Difficult to track config flow

## ⚠️ CRITICAL: Testing Strategy (READ THIS FIRST)

### Run Tests Continuously - After EVERY Change

**DO NOT proceed without running these tests after EVERY substantial change:**

**1. `npm run testv3 -- collision-config.test.vitest.mjs`**
- Tests collision handling configuration
- Must pass at all times
- If this breaks, stop and fix before continuing

**2. `npm run debug`**
- Validates complete API structure across 91 paths
- Tests both lazy and eager modes
- Compares API shapes for consistency

**Expected acceptable differences:**
```
🔍 Nested differences:
  - [differingFunction] exportDefault.extra
  - [differingFunction] __slothletInstance.api.exportDefault.extra
  - [differingFunction] __slothletInstance.boundApi.exportDefault.extra
```
- Any OTHER differences indicate broken functionality
- **🎉 BONUS:** If these 3 differences disappear during refactor and you see ZERO errors, commit immediately with message: "fix: resolve exportDefault.extra function differences - ZERO errors achieved"

### How to Run Tests Properly

**⚠️ IMPORTANT: Always tail test output (last 40 lines):**
```powershell
npm run debug 2>&1 | Select-Object -Last 40
npm run testv3 -- collision-config.test.vitest.mjs 2>&1 | Select-Object -Last 40
```

**Why tail?**
- ❌ **WRONG:** Running without tailing shows the START of output, not results
- ✅ **CORRECT:** Tailing last 40 lines shows the RESULTS at the end

### When to Test

- ✅ After file moves
- ✅ After EACH class conversion
- ✅ After updating imports
- ✅ After Slothlet refactor
- ✅ Before EVERY commit
- ✅ After console.log completion

### When Tests Fail

1. **STOP** - Do not continue to next step
2. Read error message carefully
3. Use `git diff` to see what changed
4. Fix the issue
5. Re-run tests
6. Only proceed when both tests pass

---

## Proposed Solution

Convert helpers to classes instantiated with a reference to the Slothlet orchestrator:

```javascript
// In slothlet.mjs
import { SlothletError, SlothletWarning } from "@cldmv/slothlet/errors";

export class Slothlet {
    constructor() {
        // Expose error classes to components (no imports needed)
        this.SlothletError = SlothletError;
        this.SlothletWarning = SlothletWarning;
        
        // Instance properties
        this.config = null;
        this.instanceID = null;
        this.api = null;
        this.boundApi = null;
        this.isLoaded = false;
        
        // Auto-discover and instantiate handlers/builders/processors
        // Each component receives 'this' (the Slothlet orchestrator)
        // (See "Auto-Discovery Pattern" section below for implementation)
        this._initializeComponents();
    }
    
    _initializeComponents() {
        // Handlers (stateful managers)
        // contextManager is special - set during load() based on runtime type
        this.contextManager = null;
        
        // Each component receives 'this' (the Slothlet orchestrator)
        // Components store it as 'this.slothlet' and access via getters
        this.ownership = new OwnershipHandler(this);
        this.metadata = new MetadataHandler(this);
        this.apiManager = new ApiManager(this); // Manages api.add/remove/reload
        
        // Builders (construction orchestrators)
        this.builder = new Builder(this);
        this.apiBuilder = new ApiBuilder(this);
        this.apiAssignment = new ApiAssignment(this);
        this.modesProcessor = new ModesProcessor(this);
        
        // Processors (stateless transformers with debug)
        this.loader = new Loader(this);
        this.flatten = new Flatten(this);
    }
    
    async load(userConfig) {
        this.config = normalizeConfig(userConfig);
        this.instanceID = generateInstanceID();
        
        // Context manager is runtime-specific (handles execution context isolation)
        this.contextManager = this.config.runtime === "async" 
            ? new AsyncContextManager() 
            : new LiveContextManager();
        
        // Initialize runtime store (managed by contextManager, not attached to Slothlet)
        const store = this.contextManager.initialize(this.instanceID, this.config);
        
        // Components access this.config via getters (this.slothlet.config)
        this.api = await this.builder.buildAPI({ ... });
        
        // Set store values (accessed by user API files via runtime.mjs)
        store.self = this.api;
        store.context = this.config.context || {};
        
        this.isLoaded = true;
        return this.api;
    }
}

// In src/lib/handlers/api-manager.mjs (RENAMED from helpers/hot_reload.mjs)
export class ApiManager extends ComponentBase {
    constructor(slothlet) {
        super(slothlet); // ComponentBase stores as this.slothlet
        this.state = { addHistory: [], removedModuleIds: new Set() };
    }
    
    // Inherited getters from ComponentBase (all return this.slothlet.property):
    // get config() { return this.slothlet.config; }
    // get debug() { return this.slothlet.config?.debug; }
    // get instanceID() { return this.slothlet.instanceID; }
    // get api() { return this.slothlet.api; }
    // get boundApi() { return this.slothlet.boundApi; }
    // get SlothletError() { return this.slothlet.SlothletError; }
    // get SlothletWarning() { return this.slothlet.SlothletWarning; }
    
    async addApiComponent(params) {
        // NO MORE PARAMETER PASSING!
        if (this.debug?.api) {
            console.log("Adding API component:", params.apiPath);
        }
        
        // Throw errors without imports
        if (!params.apiPath) {
            throw new this.SlothletError("INVALID_API_PATH", { params });
        }
        
        // Access other handlers via parent Slothlet
        const newApi = await this.slothlet.builder.buildAPI(...);
    }
}
```

## File Reorganization Plan

### Phase 1: Move Misplaced Files

Based on comprehensive analysis (see conversation summary):

1. **`helpers/instance-manager.mjs`** ❌ **DELETED** (commit e8d21f9)
   - File was UNUSED in V3 architecture
   - Functionality duplicated by AsyncContextManager/LiveContextManager
   - Context managers handle instance registry via `.instances` Map
   - Context managers handle active instance via AsyncLocalStorage
   - Only used in src2/ (V2 architecture) - that copy remains

2. **`helpers/hot_reload.mjs` → `handlers/api-manager.mjs`** ✅ **COMPLETED** (commit ecfa60f)
   - Reason: Manages runtime API component lifecycle (add/remove/reload)
   - Functions: `addApiComponent()`, `removeApiComponent()`, `reloadApiComponent()`
   - Maintains state WeakMap with per-instance history
   - **RENAME**: `hot_reload.mjs` → `api-manager.mjs` (kebab-case + better name - "hot reload" is only one feature)
   - **CLASS**: `ApiManager` (clearer than "HotReload" - most users use add/remove, not hot reload)
   - Updated import in `api_builder.mjs`
   - Both critical tests passing (240 collision + debug)

3. **`helpers/api_assignment.mjs` → `builders/api-assignment.mjs`** ✅ **COMPLETED** (commits 9a3fb82, e265ecb)
   - Reason: Core API construction logic, collision resolution
   - Functions: `assignToApiPath()`, `mergeApiObjects()`
   - This is builder logic, not a generic helper
   - **RENAME**: `api_assignment.mjs` → `api-assignment.mjs` (kebab-case consistency)
   - **BONUS**: Also removed safeAssign callback indirection, unified collision detection

4. **`helpers/modes.mjs` → SPLIT INTO TWO FILES** ✅ **COMPLETED** (commit 48c3400)
   - **Pure utilities** → `helpers/modes-utils.mjs` (5 functions):
     - `getSafeFunctionName()` - Sanitize names for debug output
     - `ensureNamedExportFunction()` - Named wrapper for functions (now pass-through)
     - `createNamedMaterializeFunc()` - Create named async materialization functions
     - `cloneWrapperImpl()` - Clone eager-mode exports to avoid cache mutation
     - `getOwnershipCollisionMode()` - Determine ownership conflict handling
   - **Orchestration logic** → `builders/modes-processor.mjs` (3 functions):
     - `processFiles()` - Main file/directory processing orchestrator (760 lines)
     - `createLazySubdirectoryWrapper()` - Create lazy proxies for subdirectories (163 lines)
     - `applyRootContributor()` - Merge API into root function (11 lines)
   - Updated imports in `lazy.mjs`, `eager.mjs`
   - Both critical tests passing (240 collision + 441 debug)

### Phase 2: Convert to Class-Based Architecture

**Clear Category Definitions:**
- **Helpers** = Pure functions, no config/state dependencies
- **Processors** = Stateless classes needing config for debug logging
- **Handlers** = Stateful classes managing lifecycle/state
- **Builders** = Orchestrator classes coordinating construction

#### Handlers (Stateful Managers)

**`handlers/context.mjs`** → No change needed (reference file that exports context managers)

**`handlers/context-async.mjs`** → Already class-based, may not need changes:
```javascript
export class AsyncContextManager {
    constructor() {
        this.als = new AsyncLocalStorage();
        this.instances = new Map(); // Manages runtime stores
    }
    
    // Context managers handle runtime store isolation
    // They don't need Slothlet reference - they ARE the isolation mechanism
    initialize(instanceID, config) {
        const store = { self: null, context: {}, reference: {} };
        this.instances.set(instanceID, store);
        return store;
    }
    
    // Existing methods remain unchanged
}
```

**`handlers/context-live.mjs`** → Already class-based, may not need changes:
```javascript
export class LiveContextManager {
    constructor() {
        this.instances = new Map(); // Manages runtime stores
        this.currentInstanceID = null;
    }
    
    // Context managers handle runtime store isolation
    // They don't need Slothlet reference - they ARE the isolation mechanism
    initialize(instanceID, config) {
        const store = { self: null, context: {}, reference: {} };
        this.instances.set(instanceID, store);
        this.currentInstanceID = instanceID;
        return store;
    }
    
    // Existing methods remain unchanged
}
```

**`handlers/ownership.mjs`** → Convert to class:
```javascript
export class OwnershipHandler extends ComponentBase {
    constructor(slothlet) {
        super(slothlet);
        this.registry = new Map();
        this.pathHistory = new Map();
    }
    
    // Inherited getters from ComponentBase:
    // get config() { return this.slothlet.config; }
    // get debug() { return this.slothlet.config?.debug; }
    
    register(entry) { /* ... */ }
    unregister(moduleId) { /* ... */ }
}
```

**`handlers/unified-wrapper.mjs`** → No change needed (already class-based: `UnifiedWrapper`)

**`handlers/metadata-handler.mjs`** → Convert to class:
```javascript
export class MetadataHandler extends ComponentBase {
    constructor(slothlet) {
        super(slothlet);
        this.store = new WeakMap();
    }
    
    // Inherited getters from ComponentBase:
    // get config() { return this.slothlet.config; }
    
    attachMetadata(target, metadata) { /* ... */ }
    getMetadata(target) { /* ... */ }
}
```

**`handlers/api-manager.mjs`** (MOVED from helpers/) → ✅ **COMPLETED** (Phase 2.1):
```javascript
export class ApiManager extends ComponentBase {
    constructor(slothlet) {
        super(slothlet);
        this.state = {
            addHistory: [],
            removedModuleIds: new Set(),
            initialConfig: null
        };
    }
    
    // Inherited getters from ComponentBase (all return this.slothlet.property):
    // get config() { return this.slothlet.config; }
    // get debug() { return this.slothlet.config?.debug; }
    // get instanceID() { return this.slothlet.instanceID; }
    // get api() { return this.slothlet.api; }
    // get boundApi() { return this.slothlet.boundApi; }
    // get SlothletError() { return this.slothlet.SlothletError; }
    // get SlothletWarning() { return this.slothlet.SlothletWarning; }
    
    async addApiComponent(params) { /* ... */ }
    async removeApiComponent(params) { /* ... */ }
    async reloadApiComponent(params) { /* ... */ }
}
```

#### Builders (Construction Logic)

**`builders/builder.mjs`** → Convert to class:
```javascript
export class Builder extends ComponentBase {
    constructor(slothlet) {
        super(slothlet);
    }
    
    // Inherited getters from ComponentBase:
    // get config() { return this.slothlet.config; }
    // get debug() { return this.slothlet.config?.debug; }
    
    // Direct access to other components via parent
    get ownership() { return this.slothlet.ownership; }
    get contextManager() { return this.slothlet.contextManager; }
    
    async buildAPI(options) { /* ... */ }
}
```

**`builders/api-builder.mjs`** → Convert to class:
```javascript
export class ApiBuilder extends ComponentBase {
    constructor(slothlet) {
        super(slothlet);
    }
    
    // Inherited getters from ComponentBase:
    // get config() { return this.slothlet.config; }
    
    async processModule(modulePath) { /* ... */ }
}
```

**`builders/api-assignment.mjs`** (MOVED from helpers/) → ✅ **MOVED** (commits 9a3fb82, e265ecb) / ⏳ Convert to class:
```javascript
export class ApiAssignment extends ComponentBase {
    constructor(slothlet) {
        super(slothlet);
    }
    
    // Inherited getters from ComponentBase:
    // get config() { return this.slothlet.config; }
    // get debug() { return this.slothlet.config?.debug; }
    
    assignToApiPath(targetApi, key, value, options) { /* ... */ }
    async mergeApiObjects(targetApi, sourceApi, options) { /* ... */ }
}
```
**Note:** File moved and collision detection unified, but not yet converted to class

**`builders/modes-processor.mjs`** (SPLIT from helpers/modes.mjs) → Convert to class:
```javascript
export class ModesProcessor extends ComponentBase {
    constructor(slothlet) {
        super(slothlet);
    }
    
    // Inherited getters from ComponentBase:
    // get config() { return this.slothlet.config; }
    // get debug() { return this.slothlet.config?.debug; }
    
    async processFiles(api, files, directory, options) { /* ... */ }
    createLazySubdirectoryWrapper(dir, apiPath) { /* ... */ }
    async applyRootContributor(api, rootFunction) { /* ... */ }
}
```

#### Processors (Stateless Transformers with Debug Logging)

Stateless classes that need config only for debug logging - no state management.

**`processors/loader.mjs`** (MOVED from helpers/) → Convert to class:
```javascript
export class Loader extends ComponentBase {
    constructor(slothlet) {
        super(slothlet);
    }
    
    // Inherited getters from ComponentBase:
    // get config() { return this.slothlet.config; }
    // get debug() { return this.slothlet.config?.debug; }
    
    async loadModule(modulePath) {
        if (this.debug?.modules) {
            console.log("Loading module:", modulePath);
        }
        /* ... */
    }
}
```

**`processors/flatten.mjs`** (MOVED from helpers/) → Convert to class:
```javascript
export class Flatten extends ComponentBase {
    constructor(slothlet) {
        super(slothlet);
    }
    
    // Inherited getters from ComponentBase:
    // get config() { return this.slothlet.config; }
    // get debug() { return this.slothlet.config?.debug; }
    
    shouldFlatten(apiPath, structure) {
        if (this.debug?.api) {
            console.log("Checking flatten for:", apiPath);
        }
        /* ... */
    }
}
```

#### Helpers (Pure Utilities)

Truly stateless pure functions - NO config, NO state, NO classes.

**These remain as functions:**
- `helpers/sanitize.mjs` ✅ Pure string transformations
- `helpers/utilities.mjs` ✅ Generic pure utilities
- `helpers/hint-detector.mjs` ✅ Pattern detection (no config)
- `helpers/config.mjs` ✅ Config normalization (input→output)
- `helpers/resolve-from-caller.mjs` ✅ Pure path resolution
- `helpers/modes-utils.mjs` ✅ Pure mode utilities (split from modes.mjs)

### Phase 3: Update Slothlet Class

#### Auto-Discovery Pattern (Recommended)

Instead of manually importing and instantiating each class, use auto-discovery:

```javascript
// Each class exports its Slothlet property name
// Complete mapping of ClassName → slothletProperty:

// HANDLERS
export class OwnershipHandler {
    static slothletProperty = "ownership";
    constructor(instance) { this.instance = instance; }
}

export class MetadataHandler {
    static slothletProperty = "metadata";
    constructor(instance) { this.instance = instance; }
}

export class InstanceManager {
    static slothletProperty = "instanceManager";
    constructor(instance) { this.instance = instance; }
}

export class HotReload {
    static slothletProperty = "hotReload";
    constructor(instance) { this.instance = instance; }
}

// BUILDERS
export class Builder {
    static slothletProperty = "builder";
    constructor(instance) { this.instance = instance; }
}

export class ApiBuilder {
    static slothletProperty = "apiBuilder";
    constructor(instance) { this.instance = instance; }
}

export class ApiAssignment {
    static slothletProperty = "apiAssignment";
    constructor(instance) { this.instance = instance; }
}

export class ModesProcessor {
    static slothletProperty = "modesProcessor";
    constructor(instance) { this.instance = instance; }
}

// PROCESSORS
export class Loader {
    static slothletProperty = "loader";
    constructor(instance) { this.instance = instance; }
}

export class Flatten {
    static slothletProperty = "flatten";
    constructor(instance) { this.instance = instance; }
}

// src/slothlet.mjs
import { glob } from "glob";
import { pathToFileURL } from "url";

export class Slothlet {
    constructor() {
        this.config = null;
        this.instanceID = null;
        this.api = null;
        this.boundApi = null;
        this.isLoaded = false;
        
        // Auto-initialize all components
        this._initializeComponents();
    }
    
    async _initializeComponents() {
        // Auto-discover handlers, builders, processors
        // NOTE: Does NOT auto-discover:
        //   - errors/ (throw-able classes, not instance components)
        //   - runtime/ (context managers set manually during load)
        //   - modes/ (lazy/eager mode handlers, not instance components)
        //   - i18n/ (translation utilities, not instance components)
        
        const categories = ["handlers", "builders", "processors"];
        
        for (const category of categories) {
            const pattern = `src/lib/${category}/*.mjs`;
            const files = glob.sync(pattern, { cwd: import.meta.dirname });
            
            for (const file of files) {
                const module = await import(pathToFileURL(file).href);
                
                // Find ALL exported classes with slothletProperty (supports multiple per file)
                const classExports = Object.values(module).filter(
                    exp => typeof exp === "function" && exp.slothletProperty
                );
                
                for (const ClassExport of classExports) {
                    const propName = ClassExport.slothletProperty;
                    this[propName] = new ClassExport(this);
                    
                    if (this.config?.debug?.initialization) {
                        console.log(`Initialized ${ClassExport.name} as this.${propName}`);
                    }
                }
            }
        }
        
        // Special case: contextManager is set during load based on runtime
        this.contextManager = null;
    }
    
    async load(userConfig) {
        this.config = normalizeConfig(userConfig);
        this.instanceID = generateInstanceID();
        
        // Runtime-specific context manager
        this.contextManager = this.config.runtime === "async" 
            ? new AsyncContextManager() 
            : new LiveContextManager();
        
        // All components auto-initialized in constructor
        this.instanceManager.register();
        this.api = await this.builder.buildAPI({ ... });
        
        this.isLoaded = true;
        return this.api;
    }
    
    async shutdown() {
        this.instanceManager.remove();
        this.contextManager.cleanup();
        this.isLoaded = false;
    }
}

// RESULT: Slothlet instance will have these properties:
// this.ownership (OwnershipHandler)
// this.metadata (MetadataHandler)
// this.instanceManager (InstanceManager)
// this.hotReload (HotReload)
// this.builder (Builder)
// this.apiBuilder (ApiBuilder)
// this.apiAssignment (ApiAssignment)
// this.modesProcessor (ModesProcessor)
// this.loader (Loader)
// this.flatten (Flatten)
// this.contextManager (set during load)

// EXCLUDED FROM AUTO-DISCOVERY:
// - errors/ classes (SlothletError, etc.) - throw-able classes, not instance components
// - runtime/ classes (AsyncContextManager, LiveContextManager) - manually selected during load
// - modes/ classes (lazy/eager mode handlers) - not instance components
// - i18n/ utilities - translation functions, not instance components
// - helpers/ functions - pure functions, no classes to instantiate

// If a file needs to export multiple classes (rare), each gets its own slothletProperty:
// export class ErrorHandler { static slothletProperty = "errorHandler"; }
// export class ErrorLogger { static slothletProperty = "errorLogger"; }
// Both would be instantiated since .filter() finds all matches
```

#### Manual Instantiation Pattern (Alternative)

If auto-discovery adds too much complexity during initial refactor, use manual instantiation:

```javascript
// src/slothlet.mjs
import { SlothletError, SlothletWarning } from "@cldmv/slothlet/errors";
import { OwnershipHandler } from "@cldmv/slothlet/handlers/ownership";
import { MetadataHandler } from "@cldmv/slothlet/handlers/metadata-handler";
import { ApiManager } from "@cldmv/slothlet/handlers/api-manager";
import { Builder } from "@cldmv/slothlet/builders/builder";
import { ApiBuilder } from "@cldmv/slothlet/builders/api-builder";
import { ApiAssignment } from "@cldmv/slothlet/builders/api-assignment";
import { ModesProcessor } from "@cldmv/slothlet/builders/modes-processor";
import { Loader } from "@cldmv/slothlet/processors/loader";
import { Flatten } from "@cldmv/slothlet/processors/flatten";

export class Slothlet {
    constructor() {
        // Expose error classes to components (no imports needed in component files)
        this.SlothletError = SlothletError;
        this.SlothletWarning = SlothletWarning;
        
        // Instance properties
        this.config = null;
        this.instanceID = null;
        this.api = null;
        this.boundApi = null;
        this.isLoaded = false;
        
        // Instantiate components with reference to 'this' (the Slothlet orchestrator)
        this._initializeComponents();
    }
    
    _initializeComponents() {
        // Handlers (stateful managers)
        this.contextManager = null; // Set during load based on runtime
        this.ownership = new OwnershipHandler(this); // 'this' = Slothlet orchestrator
        this.metadata = new MetadataHandler(this);
        this.apiManager = new ApiManager(this); // Manages api.add/remove/reload
        
        // Builders (construction orchestrators)
        this.builder = new Builder(this);
        this.apiBuilder = new ApiBuilder(this);
        this.apiAssignment = new ApiAssignment(this);
        this.modesProcessor = new ModesProcessor(this);
        
        // Processors (stateless transformers)
        this.loader = new Loader(this);
        this.flatten = new Flatten(this);
    }
    
    async load(userConfig) {
        this.config = normalizeConfig(userConfig);
        this.instanceID = generateInstanceID();
        
        // Context manager handles runtime store isolation
        this.contextManager = this.config.runtime === "async" 
            ? new AsyncContextManager() 
            : new LiveContextManager();
        
        // Initialize runtime store (not attached to Slothlet, managed by contextManager)
        const store = this.contextManager.initialize(this.instanceID, this.config);
        
        // Components access config via getters (this.slothlet.config)
        this.api = await this.builder.buildAPI({ ... });
        
        // Set store values for user API files (accessed via runtime.mjs)
        store.self = this.api;
        store.context = this.config.context || {};
        
        this.isLoaded = true;
        return this.api;
    }
    
    async shutdown() {
        this.contextManager.cleanup(this.instanceID);
        this.isLoaded = false;
    }
}
```

**Recommendation:** Start with manual instantiation during refactor for simplicity. Add auto-discovery as a follow-up enhancement once all classes are converted and tested
```

## Implementation Steps

### Step 1: File Reorganization (No Logic Changes)

1. **Create new directories** (if needed):
   - `src/lib/handlers/` (already exists)
   - `src/lib/builders/` (already exists)
   - `src/lib/processors/` (NEW - for stateless transformers with debug)

2. **Move files with git mv** (preserves history):
   ```bash
   # ✅ ALL COMPLETED:
   # commit ecfa60f: git mv src/lib/helpers/hot_reload.mjs src/lib/handlers/api-manager.mjs
   # commits 9a3fb82, e265ecb: git mv src/lib/helpers/api_assignment.mjs src/lib/builders/api-assignment.mjs
   # commit 4ab350d: git mv src/lib/helpers/loader.mjs src/lib/processors/loader.mjs
   # commit 4ab350d: git mv src/lib/helpers/flatten.mjs src/lib/processors/flatten.mjs
   # commit 48c3400: Split helpers/modes.mjs → helpers/modes-utils.mjs + builders/modes-processor.mjs
   
   # ❌ DELETED (commit e8d21f9):
   # helpers/instance-manager.mjs - unused, duplicated by context managers
   ```
   **⚠️ DO NOT TEST YET - imports are broken!**

3. **Split modes.mjs**:
   - Create `src/lib/helpers/modes-utils.mjs` with pure utilities
   - Create `src/lib/builders/modes-processor.mjs` with orchestration
   - Delete `src/lib/helpers/modes.mjs`

4. **Update all imports** across codebase:
   - ✅ **DONE**: `helpers/hot_reload` → `handlers/api-manager` (commit ecfa60f)
   - ✅ **DONE**: `helpers/api_assignment` → `builders/api-assignment` (commits 9a3fb82, e265ecb)
   - **TODO**: `helpers/loader` → `processors/loader`
   - **TODO**: `helpers/flatten` → `processors/flatten`
   - **TODO**: `helpers/modes` → `helpers/modes-utils` OR `builders/modes-processor`
   - **N/A**: `helpers/instance-manager` - deleted (commit e8d21f9)

5. **NOW TEST** (imports fixed, should work):
   ```bash
   npm run debug  # Verify no broken imports
   npm run testv3 -- collision-config.test.vitest.mjs  # Verify collision handling
   ```
   Both should pass (debug shows 3 acceptable diffs)

6. **COMMIT**: "refactor: reorganize files - move stateful handlers and builders"
   
   **Note:** api-assignment move was committed separately (commits 9a3fb82, e265ecb) with additional refactoring (collision detection unified, safeAssign removed)

### Step 2: Convert Handlers to Classes

**⚠️ CRITICAL: Test and commit after EACH class conversion**

1. **Convert `handlers/ownership.mjs`**:
   - Transform to class with `constructor(instance)`
   - Add `get config()` and `get debug()` getters
   - Update all method signatures to use `this.instance`
   - **TEST** (tail last 40 lines):
     ```powershell
     npm run debug 2>&1 | Select-Object -Last 40
     npm run testv3 -- collision-config.test.vitest.mjs 2>&1 | Select-Object -Last 40
     ```
   - **CHECK**: Did the 3 differences disappear? If yes, special commit!
   - **COMMIT**: "refactor(handlers): convert ownership to class"

2. **Convert `handlers/metadata-handler.mjs`**:
   - Same pattern as ownership
   - **TEST**: Both critical tests
   - **COMMIT**: "refactor(handlers): convert metadata-handler to class"

3. **Convert `handlers/api-manager.mjs`**:
   - Replace WeakMap with instance property
   - Add all convenience getters
   - Remove config parameter passing
   - **TEST**: Both critical tests (api-manager is critical!)
   - **COMMIT**: "refactor(handlers): convert api-manager to class (renamed from hot-reload)"

4. **Update imports and usage in `slothlet.mjs`**:
   - Instantiate all handlers in constructor
   - Update method calls to use `this.handlerName.method()`
   - **TEST**: Both critical tests
   - **COMMIT**: "refactor(slothlet): use class-based handlers"

### Step 3: Convert Processors to Classes

**⚠️ CRITICAL: Test and commit after EACH class conversion**

1. **Convert `processors/loader.mjs`**:
   - Stateless loader with debug logging
   - **TEST**: Both critical tests
   - **COMMIT**: "refactor(processors): convert loader to class"

2. **Convert `processors/flatten.mjs`**:
   - Stateless flattening with debug logging
   - **TEST**: Both critical tests
   - **COMMIT**: "refactor(processors): convert flatten to class"

3. **Update imports and usage**:
   - Update all processor instantiation
   - **TEST**: Both critical tests
   - **COMMIT**: "refactor(slothlet): use class-based processors"

### Step 4: Convert Builders to Classes

**⚠️ CRITICAL: Test and commit after EACH class conversion**

1. **Convert `builders/builder.mjs`**:
   - Main builder class with instance reference
   - **TEST**: `npm run debug && npm run testv3 -- collision-config.test.vitest.mjs`
   - **COMMIT**: "refactor(builders): convert builder to class"

2. **Convert `builders/api-builder.mjs`**:
   - **TEST**: Both critical tests
   - **COMMIT**: "refactor(builders): convert api-builder to class"

3. **Convert `builders/api-assignment.mjs`**:
   - ✅ **File already moved** to builders/ (commits 9a3fb82, e265ecb)
   - ⏳ **TODO**: Convert to class
   - Remove config parameter from all methods
   - Use `this.config` and `this.debug` instead
   - **TEST**: Both critical tests (assignment is critical!)
   - **COMMIT**: "refactor(builders): convert api-assignment to class"

4. **Convert `builders/modes-processor.mjs`**:
   - **TEST**: Both critical tests
   - **COMMIT**: "refactor(builders): convert modes-processor to class"

5. **Update imports and usage**:
   - Update all builder instantiation
   - **TEST**: Both critical tests
   - **COMMIT**: "refactor(slothlet): use class-based builders"

### Step 5: Refactor Slothlet Class

1. Update `slothlet.mjs` constructor to instantiate all handlers/builders
2. Update `load()` method to use class methods instead of standalone functions
3. Remove parameter passing - handlers access via `this.instance`
4. **TEST EXTENSIVELY** (tail output):
   ```powershell
   npm run debug 2>&1 | Select-Object -Last 40  # Check for zero errors!
   npm run testv3 -- collision-config.test.vitest.mjs 2>&1 | Select-Object -Last 40
   ```
   **Note:** Do NOT run `npm run test:node` - it hasn't been fully updated for v3 yet
5. **🎉 ZERO ERRORS CHECK**: Did `npm run debug` show ZERO differences?
   - If YES: Commit immediately with "fix: resolve exportDefault.extra differences - ZERO errors achieved"
   - If NO: Still commit with "refactor: complete class-based architecture - remove parameter passing"
6. **COMMIT**: (see step 5 for message)

### Step 6: Complete Console.log Wrapping

With class-based architecture, complete remaining wraps:
- `api-manager.mjs`: Use `this.debug?.api` instead of passing config
- `modes-processor.mjs`: Use `this.debug?.modes` instead of passing config

**VERIFY**:
```bash
node tools/analyze-errors.mjs  # Should show 0 unwrapped console.log
npm run debug  # Still passes
npm run testv3 -- collision-config.test.vitest.mjs  # Still passes
```

**COMMIT**: "feat: complete console.log debug wrapping with class-based getters"

### Step 7: Update Documentation

1. Update API documentation in `docs/`
2. Update `README.md` examples
3. Update JSDoc comments on all converted classes
4. **TEST**: Both critical tests one final time
5. **COMMIT**: "docs: update documentation for class-based architecture"

## Testing Checkpoints

**See "CRITICAL: Testing Strategy" section at the top of this document for full testing instructions.**

**Quick reference - Run after each step:**
```powershell
npm run debug 2>&1 | Select-Object -Last 40
npm run testv3 -- collision-config.test.vitest.mjs 2>&1 | Select-Object -Last 40
```

**After file moves (Step 1):**
- ✅ Run both tests (tail last 40 lines)
- ✅ Check for zero-error bonus
- ✅ Commit

**After each class conversion (Steps 2-3):**
- ✅ Run both tests after EACH conversion
- ✅ Fix before moving to next if tests fail
- ✅ Commit after each success

**After Slothlet refactor (Step 4):**
- ✅ Run both tests multiple times
- ✅ Check for zero-error bonus
- ✅ Commit

**After console.log completion (Step 5):**
- ✅ Run `node tools/analyze-errors.mjs`
- ✅ Run both critical tests
- ✅ Commit

**Final validation:**
- ✅ Run both critical tests one last time
- ✅ Verify no regressions

## Benefits

1. **Cleaner code**: No parameter pollution
2. **Easier debugging**: Clear instance ownership
3. **Better encapsulation**: State contained in classes
4. **Simpler refactoring**: Change signatures in one place
5. **Type safety**: Better TypeScript inference
6. **Consistent patterns**: All stateful code uses classes
7. **Easier testing**: Mock instance properties instead of parameters

## Breaking Changes

**NONE** - This is purely internal refactoring. External API remains unchanged:

```javascript
// User code stays the same
const api = await slothlet({
    dir: "./api_tests/api_test",
    mode: "lazy"
});

await api.slothlet.add("plugins", "./plugins");
```

## File Structure After Refactor

```
src/lib/
├── errors/
│   └── errors.mjs
├── i18n/
│   ├── translations.mjs
│   └── languages/
├── runtime/
│   ├── runtime.mjs
│   ├── runtime-asynclocalstorage.mjs
│   └── runtime-livebindings.mjs
├── modes/
│   ├── lazy.mjs
│   └── eager.mjs
├── handlers/ (STATEFUL MANAGERS - ALL CLASSES)
│   ├── context.mjs (ContextManager - already class)
│   ├── context-async.mjs (AsyncContextManager - already class)
│   ├── context-live.mjs (LiveContextManager - already class)
│   ├── ownership.mjs (OwnershipHandler - convert to class)
│   ├── unified-wrapper.mjs (UnifiedWrapper - already class)
│   ├── metadata-handler.mjs (MetadataHandler - convert to class)
│   └── api-manager.mjs (ApiManager - MOVED + RENAMED from hot_reload.mjs + convert to class)
├── builders/ (CONSTRUCTION ORCHESTRATORS - ALL CLASSES)
│   ├── builder.mjs (Builder - convert to class)
│   ├── api-builder.mjs (ApiBuilder - convert to class)
│   ├── api-assignment.mjs (ApiAssignment - MOVED + convert to class)
│   └── modes-processor.mjs (ModesProcessor - SPLIT from modes.mjs + convert to class)
├── processors/ (STATELESS TRANSFORMERS WITH DEBUG - ALL CLASSES)
│   ├── loader.mjs (Loader - MOVED + convert to class)
│   └── flatten.mjs (Flatten - MOVED + convert to class)
└── helpers/ (PURE UTILITIES - ALL FUNCTIONS)
    ├── sanitize.mjs ✅ Pure string transformations
    ├── utilities.mjs ✅ Generic pure utilities
    ├── hint-detector.mjs ✅ Pattern detection
    ├── config.mjs ✅ Config normalization
    ├── resolve-from-caller.mjs ✅ Pure path resolution
    └── modes-utils.mjs ✅ Pure mode utilities
```

## Success Criteria

- ✅ All files correctly categorized (handlers/builders/helpers)
- ✅ All stateful code uses class-based architecture
- ✅ Zero parameter passing for config/instance through call chains
- ✅ All console.log statements wrapped with debug guards
- ✅ Both critical tests passing (debug + collision-config)
- ✅ No breaking changes to external API
- ✅ Documentation updated
- ✅ Type definitions generated correctly

## Timeline Estimate

- **Step 1** (File moves): 1-2 hours
- **Step 2** (Handler classes): 2-3 hours
- **Step 3** (Processor classes): 1-2 hours
- **Step 4** (Builder classes): 2-3 hours
- **Step 5** (Slothlet refactor): 1-2 hours
- **Step 6** (Console.log completion): 30 minutes
- **Step 7** (Documentation): 1 hour

**Total**: ~9-14 hours of development + testing

## Notes

- This refactor enables future features like plugin systems (helpers as classes can be extended)
- Sets foundation for dependency injection patterns
- Makes testing significantly easier (mock instance properties)
- Aligns with modern JavaScript best practices
- Preserves all git history through proper file moves
