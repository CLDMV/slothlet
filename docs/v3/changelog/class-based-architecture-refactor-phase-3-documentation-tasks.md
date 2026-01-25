# Phase 3: Documentation & Cleanup Tasks

**Status:** DEFERRED - To be completed after V3 feature parity is achieved  
**Date Created:** January 24, 2026  
**Related:** [class-based-architecture-refactor.md](../todo/class-based-architecture-refactor.md)

---

## Overview

Phase 2 of the class-based architecture refactor is complete (11 classes converted, all helpers converted, 475 debug paths passing). Phase 3 documentation tasks are deferred until V3 reaches feature parity with V2 and all tests are rewritten for V3.

---

## 📋 Documentation Tasks (DEFERRED)

### 1. Architecture Documentation Updates

**Files to Update:**

#### `docs/MODULE-STRUCTURE.md`
- **What needs updating:** Document class-based component system
- **Current state:** Documents function-based helper system with parameter passing
- **Changes needed:**
  - Remove references to passing `config`/`instance` through function parameters
  - Document ComponentBase pattern (`class MyComponent extends ComponentBase`)
  - Document `this.slothlet` reference pattern for accessing orchestrator
  - Document `this.config`, `this.SlothletError`, `this.SlothletWarning` convenience properties
  - Update component instantiation examples (Slothlet creates instances in constructor)
  - Document helper access pattern: `this.slothlet.helpers.sanitize`, `this.slothlet.helpers.utilities`, etc.
  - Update diagrams showing component relationships and orchestrator pattern

#### `docs/CONTEXT-PROPAGATION.md`
- **What needs updating:** Document new component access patterns and slothlet parameter passing
- **Current state:** May reference old parameter passing patterns
- **Changes needed:**
  - Document how components receive `slothlet` parameter (not individual config/instance params)
  - Document `this.slothlet.helpers.*` access pattern (37+ imports eliminated)
  - Document ComponentBase pattern for context propagation
  - Clarify distinction between:
    - **Slothlet instance isolation** (orchestrator level - each Slothlet has own components)
    - **Runtime context store isolation** (execution level - AsyncLocalStorage/LiveContextManager)
  - Update examples showing components accessing config via `this.config` instead of parameters
  - Document that runtime store is managed by contextManager, not exposed on Slothlet class
  - Show before/after examples of helper access (import vs `this.slothlet.helpers.*`)

#### `docs/API-RULES.md`, `docs/API-FLATTENING.md`, etc.
- **What needs updating:** Any references to function-based helpers
- **Changes needed:**
  - Update code examples showing helper usage
  - Replace `import { sanitizePropertyName } from ...` with `this.slothlet.helpers.sanitize.sanitizePropertyName(...)`
  - Update any diagrams showing component interactions

---

### 2. CONTEXT-PROPAGATION.md Specific Changes

**Document Structure Needed:**

```markdown
## Component Architecture

### Orchestrator Pattern (Slothlet Instance)
- Each Slothlet instance is an orchestrator
- Components are instantiated with reference to parent Slothlet
- Components access other components via `this.slothlet.*`
- Example: `this.slothlet.helpers.sanitize.sanitizePropertyName(name)`

### ComponentBase Pattern
- All components extend ComponentBase
- Automatic property setup: `this.slothlet`, `this.config`, `this.SlothletError`, `this.SlothletWarning`
- No need to pass config through parameters
- Pattern: `class MyComponent extends ComponentBase { constructor(slothlet) { super(slothlet); } }`

### Helper Component Access
- **Old pattern (eliminated):**
  ```javascript
  import { sanitizePropertyName } from "@cldmv/slothlet/helpers/sanitize";
  const name = sanitizePropertyName("my-file.mjs");
  ```
- **New pattern (current):**
  ```javascript
  // Inside component class:
  const name = this.slothlet.helpers.sanitize.sanitizePropertyName("my-file.mjs");
  ```
- **Benefits:**
  - Zero imports needed in components
  - Automatic instance isolation
  - Access to same helper instances across component tree
  - Backwards compatibility maintained (standalone exports still work for external use)

### Two-Level Isolation

**Level 1: Slothlet Instance Isolation (Orchestrator)**
```javascript
const slothlet1 = new Slothlet();
const slothlet2 = new Slothlet();
// Each has isolated: config, api, ownership, all components
```

**Level 2: Runtime Context Store Isolation (Execution)**
```javascript
// Managed by contextManager (AsyncLocalStorage or LiveContextManager)
// Accessed by user API files via runtime.mjs (self, context, reference)
// NOT exposed on Slothlet class - internal implementation detail
```

### Parameter Passing Patterns

**Functions receive `slothlet` parameter:**
- `buildLazyAPI({ dir, apiPathPrefix, collisionContext, slothlet })`
- `createLazyWrapper(dir, apiPath, slothlet)`
- Access resources: `slothlet.config`, `slothlet.processors.loader`, `slothlet.handlers.ownership`

**Classes receive `slothlet` in constructor:**
- `class ApiManager extends ComponentBase { constructor(slothlet) { super(slothlet); } }`
- Access via `this.slothlet.*` throughout class methods
```

---

### 3. Class Conversion Summary Documentation

**New File Needed:** `docs/v3/changelog/class-based-architecture-summary.md`

**Content outline:**
- List all 11 converted classes with before/after examples
- Show parameter signature changes
- Document eliminated imports (37+ across 8 files)
- Show helper access pattern changes
- Performance/maintainability benefits
- Breaking changes (if any for external API consumers)
- Migration guide for extending Slothlet

**Classes to document:**
1. **Handlers:** ApiManager, UnifiedWrapper, Ownership
2. **Builders:** Builder, ApiBuilder, ApiAssignment, ModesProcessor  
3. **Processors:** Loader, Flatten
4. **Helpers:** Utilities, Sanitize, Config, Resolver, ModesUtils, HintDetector (6 total)
5. **Context Managers:** Already classes (AsyncContextManager, LiveContextManager)

---

### 4. README.md Updates

**What to check:**
- Architecture overview section - does it mention function-based helpers?
- Code examples - do they show old import patterns?
- Getting started examples - do they reflect current architecture?
- Feature list - mention class-based architecture as benefit?

**Potential additions:**
- Highlight class-based architecture for better maintainability
- Note zero-import component design
- Mention ComponentBase pattern for extensions

---

### 5. API Documentation Generation

**Task:** Generate updated JSDoc-based API documentation

**Commands to run:**
```bash
npm run build:types
# Verify TypeScript definitions reflect new class exports
```

**What to verify:**
- Class exports properly documented
- ComponentBase properly typed
- Helper classes show correct method signatures
- Backwards-compatible function exports still present for external use

---

## 🧪 Testing Tasks (DEFERRED)

**Note:** Most tests have not been rewritten for V3 yet, not all features are in V3 yet.

### When V3 reaches feature parity:

**1. Verify all test suites pass:**
- `npm run test` (full suite)
- `npm run test:node` (Node.js specific)
- `npm run test:unit` (unit tests)
- All vitest suites in `tests/vitests/`

**2. Verify debug tests:**
- `npm run debug` (already passing - 475 paths, 3 acceptable differences)

**3. Verify collision tests:**
- `npm run testv3 -- collision-config.test.vitest.mjs` (already passing - 240 tests)

**4. Performance testing:**
- Compare lazy vs eager mode performance
- Verify class instantiation overhead is negligible
- Check memory usage with multiple Slothlet instances

---

## 🧹 Cleanup Tasks (DEFERRED)

### 1. Remove Unnecessary Standalone Exports

**Current state:** All helper classes maintain standalone function exports for backwards compatibility

**Evaluation needed:**
- Determine if any external code depends on standalone helper exports
- If no external dependencies, consider removing standalone exports for:
  - Internal helpers only used by Slothlet components
  - Functions that duplicate class methods
- Keep exports that are part of public API surface

**Files to review:**
- `src/lib/helpers/utilities.mjs`
- `src/lib/helpers/sanitize.mjs`
- `src/lib/helpers/config.mjs`
- `src/lib/helpers/resolver.mjs`
- `src/lib/helpers/modes-utils.mjs`
- `src/lib/helpers/hint-detector.mjs`

### 2. Verify Package.json Exports

**Current exports:**
```json
"./helpers/*": "./dist/lib/helpers/*.mjs",
"./handlers/*": "./dist/lib/handlers/*.mjs",
"./builders/*": "./dist/lib/builders/*.mjs",
"./processors/*": "./dist/lib/processors/*.mjs",
"./factories/*": "./dist/lib/factories/*.mjs"
```

**Verify:**
- All class exports are accessible
- Standalone function exports work (if kept)
- No broken import paths

### 3. Update Component Access Patterns

**Status:** COMPLETE (37+ imports eliminated)

**Files updated:**
- ✅ `modes-processor.mjs` - 37 replacements
- ✅ `slothlet.mjs` - transformConfig
- ✅ `eager.mjs`, `lazy.mjs` - sanitizePropertyName
- ✅ `loader.mjs` - getModuleId, shouldAttachNamedExport
- ✅ `metadata.mjs` - getStack, toFsPath
- ✅ `api-manager.mjs` - resolvePathFromCaller
- ✅ `config.mjs` - resolvePathFromCaller

**Verification needed later:**
- Confirm no remaining imports that could be converted
- Check error message examples (do they reference old patterns?)

---

## 📊 Current Status (January 24, 2026)

### ✅ Completed
- Phase 1: File reorganization (5 steps)
- Phase 2: Class conversions (11 classes)
- Phase 2.5: Helper conversions (6 helpers, 37+ import eliminations)
- All critical tests passing:
  - `npm run debug` - 475 paths passing
  - `npm run testv3 -- collision-config.test.vitest.mjs` - 240 tests passing

### ⏳ Deferred (This Document)
- Phase 3: Documentation updates
- Phase 3: Full test suite verification (waiting for V3 feature parity)
- Phase 3: Cleanup tasks
- Phase 3: API documentation regeneration

### 🎯 Next Steps

**When ready to complete Phase 3:**

1. Verify V3 has feature parity with V2
2. Rewrite remaining tests for V3
3. Complete documentation updates using this file as guide
4. Run full test suite verification
5. Perform cleanup tasks
6. Regenerate API documentation
7. Update README with architecture highlights
8. Mark Phase 3 as COMPLETE in `class-based-architecture-refactor.md`

---

## 🔗 Related Files

- [class-based-architecture-refactor.md](../todo/class-based-architecture-refactor.md) - Main refactor tracking document
- `docs/MODULE-STRUCTURE.md` - Architecture documentation (needs update)
- `docs/CONTEXT-PROPAGATION.md` - Context system documentation (needs update)
- `docs/API-RULES.md` - API flattening rules (may need examples updated)
- `README.md` - Project overview (needs architecture section update)
