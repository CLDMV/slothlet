# V2 Feature Parity Checklist

**Purpose:** Comprehensive verification of V2 features in V3 implementation  
**Created:** January 27, 2026  
**Source:** README.md, V2-V3-GAP-LIST.md, and V2 documentation

---

## ✅ Core Features - IMPLEMENTED

### Loading Modes

- [x] **Eager Loading** ✅ IMPLEMENTED
  - Status: Production-ready in V3
  - Location: `src/lib/modes/slothlet_eager.mjs`
  - Tests: Full test coverage in `tests/vitests/suites/eager/`
  - Evidence: Baseline tests passing (1232/1232)

- [x] **Lazy Loading** ✅ IMPLEMENTED
  - Status: Production-ready in V3 with copy-left materialization
  - Location: `src/lib/modes/slothlet_lazy.mjs`
  - Tests: Full test coverage in `tests/vitests/suites/lazy/`
  - Evidence: Baseline tests passing (1232/1232)

- [x] **Copy-Left Materialization** ✅ IMPLEMENTED
  - Status: Fully working in lazy mode
  - Behavior: Modules stay materialized after first access
  - Performance: 1.14μs vs 1.23μs eager (within 8% measurement noise)

### API Structure & Transformation

- [x] **Smart API Flattening** ✅ IMPLEMENTED
  - Status: All 12 flattening rules implemented
  - Location: `src/lib/helpers/modes.mjs` (processFiles)
  - Tests: 168-scenario test coverage
  - Rules: filename-matches-container, single-named-export, root contributors, etc.
  - Evidence: docs/API-FLATTENING.md documents all rules

- [x] **Smart Naming/Sanitization** ✅ IMPLEMENTED
  - Status: Preserves original capitalization (autoIP, parseJSON, getHTTPStatus)
  - Location: `src/lib/helpers/sanitize.mjs`
  - Tests: Comprehensive sanitization tests
  - Features:
    - Function name preference over filename
    - Acronym preservation (IP, JSON, HTTP, API)
    - Custom sanitization rules with glob/boundary patterns
    - lowerFirst, preserveAllUpper, preserveAllLower options

- [x] **Mixed Module Support (ESM/CJS)** ✅ IMPLEMENTED
  - Status: Seamless ESM and CJS interoperability
  - Evidence: api_test_mixed/ tests passing
  - Tests: Mixed module loading tests in baseline

- [x] **Root Contributor Pattern** ✅ IMPLEMENTED
  - Status: Callable API root when root-level file exports default function
  - Behavior: `api()` callable + `api.method()` properties
  - Tests: Verified in API structure tests

- [x] **Hybrid Exports (Default + Named)** ✅ IMPLEMENTED
  - Status: Modules with default + named exports create callable namespaces
  - Example: `api.logger()` + `api.logger.info()`, `api.logger.warn()`
  - Tests: Verified in export handling tests

### Runtime & Context System

- [x] **AsyncLocalStorage Context Isolation** ✅ IMPLEMENTED
  - Status: Per-instance context isolation working
  - Location: `src/lib/runtime/runtime.mjs`
  - API: `import { self, context, reference } from "@cldmv/slothlet/runtime"`
  - Tests: Context isolation tests in `tests/vitests/suites/context/`

- [x] **Live Bindings Mode** ✅ IMPLEMENTED
  - Status: Alternative to ALS for older Node.js versions
  - Config: `runtime: "live"` option
  - Behavior: Dynamic binding system without ALS

- [x] **Per-Instance Isolation** ✅ IMPLEMENTED
  - Status: Multiple instances with separate contexts
  - Behavior: No query strings needed (automatic isolation)
  - Tests: Multiple instance tests passing

### Hot Reload System (API Manager)

- [x] **api.slothlet.api.add()** ✅ IMPLEMENTED
  - Status: Fully functional dynamic API extension
  - Location: `src/lib/handlers/api-manager.mjs`
  - Tests: 136 tests passing in `tests/vitests/suites/addapi/`
  - Features:
    - Add modules at runtime
    - Create nested API structures
    - Metadata tagging support
    - Path resolution (relative/absolute/caller-based)

- [x] **api.slothlet.api.remove()** ✅ IMPLEMENTED
  - Status: Fully functional API endpoint removal
  - Location: `src/lib/handlers/api-manager.mjs`
  - Tests: Removal tests in api-manager suite
  - Features: Ownership-based removal, stack history

- [x] **api.slothlet.api.reload()** ✅ IMPLEMENTED
  - Status: Fully functional API reload
  - Location: `src/lib/handlers/api-manager.mjs`
  - Tests: Reload tests in api-manager suite
  - Features: Replace modules with new implementations

- [x] **Ownership Tracking System** ✅ IMPLEMENTED
  - Status: Stack-based history with bidirectional tracking
  - Location: `src/lib/ownership/index.mjs`
  - Documentation: `docs/v3/changelog/ownership-and-history-system.md` (850+ lines)
  - Tests: 96 tests across 2 test suites
  - Features:
    - Module→paths tracking
    - Path→modules tracking (stack-based)
    - Ownership history for rollback
    - Add/remove/reload integration

### Metadata System

- [x] **Function Metadata Tagging** ✅ IMPLEMENTED
  - Status: Comprehensive WeakMap-based metadata system
  - Location: `src/lib/metadata/index.mjs`
  - Documentation: `docs/v3/changelog/metadata-system.md` (750+ lines)
  - Tests: 672 tests across 6 test suites
  - API: `api.slothlet.metadata.*` methods

- [x] **metadataAPI Runtime Introspection** ✅ IMPLEMENTED
  - Status: Full runtime metadata access
  - Import: `import { metadataAPI } from "@cldmv/slothlet/runtime"`
  - Methods:
    - `metadataAPI.self()` - Current function metadata
    - `metadataAPI.caller()` - Caller metadata
    - `metadataAPI.get(path)` - Get metadata by path
  - Use Cases: Security, authorization, auditing

- [x] **Metadata Security/Authorization** ✅ IMPLEMENTED
  - Status: Immutable metadata with trusted/permissions tagging
  - Features:
    - `trusted: true/false` flag
    - `permissions: [...]` arrays
    - Version tracking
    - Caller verification
  - Example: Check caller.trusted before sensitive operations

### Configuration System

- [x] **Standard Configuration Options** ✅ IMPLEMENTED
  - All V2 config options working:
    - `dir` - Directory path
    - `mode` / `lazy` - Loading strategy
    - `runtime` - ALS vs live-bindings
    - `apiDepth` - Traversal depth
    - `debug` - Verbose logging
    - `context` - User context data
    - `reference` - Merged reference object
    - `sanitize` - Naming rules
    - `allowApiOverwrite` - Overwrite protection

- [x] **Collision Configuration** ✅ IMPLEMENTED
  - Status: Collision handling configuration exists in V3
  - Features: Control collision behavior for API operations
  - Evidence: Collision configuration present in codebase

### Developer Experience

- [x] **TypeScript Support** ✅ IMPLEMENTED
  - Status: Auto-generated .d.ts from JSDoc
  - Build: `npm run build:types`
  - Tests: `npm run test:types` validates all exports

- [x] **Debug Logging** ✅ IMPLEMENTED
  - Status: Comprehensive debug output
  - Flags: `--slothletdebug`, `SLOTHLET_DEBUG=true`
  - Coverage: Module analysis, flattening decisions, API structure

- [x] **Error Handling** ✅ IMPLEMENTED (Basic)
  - Status: Standard JavaScript error handling
  - Custom Error Class: `SlothletError` in `src/lib/errors/index.mjs`
  - Note: Enhanced error messages planned for future

---

## ❌ Major Features - NOT IMPLEMENTED

### 1. Hooks System

- [ ] **Hooks API Surface** ❌ NOT IMPLEMENTED
  - Status: **STUBBED** - Methods exist but throw `NOT_IMPLEMENTED`
  - Location: Stubs in `src/lib/builders/api_builder.mjs`
  - TODO File: `docs/v3/todo/hooks-system.md` (376 lines)
  - Missing Methods:
    - `api.slothlet.hooks.on(tag, type, handler, options)` - Register hook
    - `api.slothlet.hooks.off(nameOrPattern)` - Remove hook
    - `api.slothlet.hooks.enable(pattern)` - Enable hooks
    - `api.slothlet.hooks.disable(pattern)` - Disable hooks
    - `api.slothlet.hooks.clear(type)` - Clear hooks
    - `api.slothlet.hooks.list(type)` - List registered hooks

- [ ] **Hook Types** ❌ NOT IMPLEMENTED
  - `before` - Modify arguments or cancel execution
  - `after` - Transform return values
  - `always` - Observe final results (read-only)
  - `error` - Monitor errors with source tracking

- [ ] **Hook Features** ❌ NOT IMPLEMENTED
  - Pattern matching (glob patterns: `*`, `**`, `{a,b}`, `!pattern`)
  - Priority ordering (higher priority first)
  - Subset phases (before → primary → after)
  - Short-circuit support (return value from before hook)
  - Error suppression (suppressErrors option)
  - Runtime enable/disable by pattern
  - Hook cleanup on shutdown

**Impact:** HIGH - Major V2 feature completely missing from V3

**V2 Documentation:** [docs/HOOKS.md](../../HOOKS.md) (788 lines)

### 2. EventEmitter Context Propagation

- [ ] **EventEmitter Wrapping** ❌ NOT IMPLEMENTED
  - Status: **NO CODE** - Feature completely missing
  - TODO File: `docs/v3/todo/eventemitter-context-propagation.md` (473 lines)
  - Missing: No EventEmitter patching system
  - Missing: No AsyncResource-based listener wrapping
  - Missing: No auto-wrap system for event-driven code

- [ ] **Class Instance Propagation** ❌ NOT IMPLEMENTED
  - Status: **NO CODE** - Feature completely missing
  - Missing: No class method wrapping for context preservation

**Impact:** CRITICAL - Breaks event-driven APIs (TCP servers, HTTP servers, custom EventEmitters)

**V2 Documentation:** [docs/CONTEXT-PROPAGATION.md](../../CONTEXT-PROPAGATION.md)

**Why Critical:**
Event handlers execute in different async context than registration, causing:
- `context` to be `undefined` in event callbacks
- `self` to reference wrong API instance
- Complete context loss in nested event handlers (socket.on("data", ...))

**Affects:**
- TCP servers (net.createServer)
- HTTP servers (http.createServer)
- WebSocket servers
- Custom EventEmitters
- Third-party event-driven libraries

### 3. Per-Request Context (Scope System)

- [ ] **api.run() Method** ❌ NOT IMPLEMENTED
  - V2 API: `api.run(context, callback, ...args)` - Execute callback with isolated context
  - Status: Not present in V3
  - Use Case: Per-request isolation without creating new instances

- [ ] **api.scope() Method** ❌ NOT IMPLEMENTED
  - V2 API: `api.scope({ context, fn, args, merge })` - Create scoped API instance
  - Status: Not present in V3
  - Use Case: Create request-specific API with isolated context

**Impact:** MEDIUM - Alternative: Create multiple instances (works but less ergonomic)

**V2 Documentation:** 
- [docs/CONTEXT-PROPAGATION.md](../../CONTEXT-PROPAGATION.md) - Complete API reference
- [docs/changelog/v2.9.md](../../changelog/v2.9.md) - V2.9 release notes

---

## ⚠️ Configuration Gaps

### 1. allowMutation Config

- [ ] **config.api.mutations** ❌ NOT IMPLEMENTED
  - V2 Feature: `allowMutation` config option to control API modifications
  - V3 Status: No equivalent configuration
  - TODO File: `docs/v3/todo/allowMutation-config-option.md`
  - Proposed V3 Structure:
    ```javascript
    config: {
      api: {
        mutations: {
          add: true/false,     // Allow api.slothlet.api.add()
          remove: true/false,  // Allow api.slothlet.api.remove()
          reload: true/false   // Allow api.slothlet.api.reload()
        }
      }
    }
    ```

**Impact:** LOW - Methods work, just missing fine-grained control

---

## 🔧 Minor Features & Enhancements

### 1. CJS Default Export Handling

- [ ] **CJS module.exports Normalization** ❌ NOT IMPLEMENTED
  - Issue: CJS modules expose `.default` property unnecessarily
  - TODO File: `docs/v3/todo/cjs-default-exports.md` (82 lines)
  - Current Behavior:
    ```javascript
    // CJS: module.exports = { multiply: ..., divide: ... }
    api.mathCjs.default.multiply(2, 3) // ❌ Shouldn't need .default
    ```
  - Expected Behavior:
    ```javascript
    api.mathCjs.multiply(2, 3) // ✅ Direct access like ESM
    ```

**Impact:** LOW - Inconsistency between ESM and CJS API paths

**Fix:** Normalize in `src/lib/processors/loader.mjs` extractExports()

---

## 🎯 Experimental Features (V2 Status Unknown)

These features are documented in V3 but status in V2 is unclear:

### Engine Modes

- [ ] **Worker Mode** ⚠️ EXPERIMENTAL
  - Status: In development (both V2 and V3)
  - Feature: Thread isolation for API execution

- [ ] **Fork Mode** ⚠️ EXPERIMENTAL
  - Status: In development (both V2 and V3)
  - Feature: Process isolation for API execution

- [ ] **Child Mode** ⚠️ EXPERIMENTAL
  - Status: In development (both V2 and V3)
  - Feature: Child process execution

- [ ] **VM Mode** ⚠️ EXPERIMENTAL
  - Status: In development (both V2 and V3)
  - Feature: Virtual machine context isolation

**Note:** These modes are marked experimental in both V2 and V3 README

---

## 📊 Summary Statistics

### Implementation Status

**Core Features:**
- ✅ Implemented: 21 features (includes collision config)
- ❌ Not Implemented: 3 major features (Hooks, EventEmitter, Scope)
- ⚠️ Partial/Config Gaps: 1 feature (allowMutation config - has TODO)
- 🔧 Minor Missing: 1 feature (CJS normalization)

**Test Coverage:**
- Baseline Tests: 1232/1232 passing (12 test files)
- Metadata Tests: 672 tests passing (6 suites)
- Ownership Tests: 96 tests passing (2 suites)
- API Manager Tests: 136 tests passing (3 suites)

**Documentation:**
- V3 Comprehensive Docs: 2 major systems documented (1600+ lines)
- V3 TODO Files: 6 active feature gaps documented
- V2 Feature Docs: Complete documentation preserved in docs/

### Priority Ranking for Implementation

**🔴 HIGH PRIORITY (Blocking production parity):**
1. **Hooks System** - Major feature, extensively documented, 376-line TODO
2. **EventEmitter Context Propagation** - Critical for event-driven APIs

**🟡 MEDIUM PRIORITY (Nice to have):**
3. **Per-Request Context (api.run/scope)** - Ergonomic improvement

**🟢 LOW PRIORITY (Minor enhancements):**
4. **allowMutation Config** - Fine-grained control (has TODO file)
5. **CJS Default Export Normalization** - API consistency

---

## 🔍 Verification Methodology

**How features were verified:**

1. **Code Search:** Searched V3 codebase (`src/`) for implementation
2. **Test Coverage:** Checked `tests/vitests/` for passing tests
3. **Baseline Tests:** Verified 1232/1232 tests passing
4. **Documentation:** Cross-referenced with TODO files and comprehensive docs
5. **API Structure:** Verified exposed API methods in `src/lib/builders/api_builder.mjs`

**Sources:**
- `README.md` - V2 feature list and documentation
- `docs/v3/old/V2-V3-GAP-LIST.md` - Known gaps from early V3
- `docs/v3/todo/*.md` - Current active TODOs (6 files)
- `docs/v3/changelog/*.md` - Completed feature documentation
- Test results from baseline test runs

---

## 📝 Next Steps

### For Developers

1. **Review this checklist** against project priorities
2. **Choose features to implement** based on priority ranking
3. **Follow TODO files** for detailed implementation guidance
4. **Update this checklist** as features are completed

### For Documentation

1. **Keep TODO files updated** with implementation progress
2. **Move completed items** to `docs/v3/todo/completed/`
3. **Create comprehensive docs** like metadata/ownership when features complete
4. **Update this checklist** to reflect current status

---

**Last Updated:** January 27, 2026  
**Next Review:** After major feature implementations
