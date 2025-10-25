# Slothlet Architecture Refactoring TODO

## 📋 **TODO Management Requirements**

### 🔄 **CRITICAL: Keep TODO Updated**

- **Requirement**: This TODO.md MUST be updated in real-time as work progresses
- **Update Triggers**:
  - ✅ Mark items complete immediately when finished
  - 🆕 Add new issues/requirements as they are discovered
  - 📝 Update descriptions when understanding improves
  - 🔄 Consolidate duplicate items to avoid confusion
  - ⚠️ Flag critical blockers and dependencies
- **Purpose**: Maintain accurate project status and prevent duplicate work
- **Responsibility**: All team members working on slothlet architecture

## Critical Issues to Address

### 1. ✅ **COMPLETED: Fix Lazy Mode Multi-Default Auto-Flattening**

- **Issue**: Lazy mode did not implement multi-default auto-flattening logic that works in eager mode
- **Solution**: Applied same multi-default detection and flattening logic to lazy mode
- **Status**: ✅ FIXED - Both eager and lazy modes now work correctly at root level
- **Files**: `src/lib/modes/slothlet_lazy.mjs` ✅

### 1.1. 🚨 **URGENT: Fix Subfolder Multi-Default Auto-Flattening**

- **Issue**: Subfolders in BOTH modes are not applying multi-default auto-flattening logic
- **Current State**: Files without defaults in subfolders (e.g., connection files) preserve namespaces instead of flattening
- **Expected**: Files without defaults should flatten exports to parent when multiple defaults exist in subfolder
- **Impact**: Inconsistent behavior between root-level and subfolder processing
- **Files**: Both `src/lib/modes/slothlet_eager.mjs` and `src/lib/modes/slothlet_lazy.mjs` subfolder logic
- **Priority**: HIGH - Core functionality missing in subfolders

### 2. 🔄 **Performance: Eliminate Redundant Module Loading**

- **Issue**: Files are being loaded up to 3 times each during processing
  - First pass: Raw module import for default export detection
  - Second pass: Processed module loading via `_loadSingleModule`
  - Third pass: Potential re-loading during materialization
- **Impact**: Severe performance degradation, especially for large APIs
- **Solution**: Implement module caching strategy
- **Priority**: HIGH - Performance critical

### 3. 🏗️ **Architecture: Consolidate Duplicate Logic**

- **Issue**: Same logic exists in multiple places creating maintenance nightmare:
  - Lazy mode root processing
  - Eager mode root processing
  - Subfolder processing (both modes)
- **Current Duplication**:
  - Multi-default detection logic
  - Self-referential detection
  - Auto-flattening conditions
  - Module processing workflows
- **Solution**: Extract shared processing logic into common utilities
- **Priority**: MEDIUM - Technical debt

### 4. 🧪 **Testing: Validate All API Structures**

- **Issue**: Need to ensure changes don't break existing functionality
- **Tests to Run**:
  - `tests/debug-slothlet.mjs` - Comprehensive API structure validation
  - `tests/test-all-api-structures.mjs` - Cross-mode consistency
  - `npm run test:node` - Full test suite
  - Performance benchmarks
- **Priority**: HIGH - Regression prevention

## Implementation Plan

### Phase 1: Fix Multi-Default Auto-Flattening (IMMEDIATE)

- [x] ✅ Apply multi-default detection logic to lazy mode
- [x] ✅ Ensure self-referential counting matches eager mode
- [x] ✅ Add debug output for lazy mode multi-default processing
- [x] ✅ Test TV API with lazy mode to verify flattening
- [ ] **CRITICAL**: Fix subfolder multi-default auto-flattening in both modes (`_buildCategory` recursive calls)
- [ ] Test subfolder scenarios (e.g., `api_tests/api_tv_test/subfolder/connection.mjs` should flatten)
- [ ] Ensure consistency between root and subfolder behavior

### Phase 2: Module Caching Strategy (SHORT TERM)

- [ ] **Investigation**: Confirm if Node.js native import caching is sufficient
- [ ] **Analysis**: Profile current loading patterns to identify bottlenecks
- [ ] **Implementation Options**:
  - [ ] Option A: Rely on Node.js native caching (if sufficient)
  - [ ] Option B: Implement explicit module cache Map
  - [ ] Option C: Lazy evaluation with materialization-time loading only
- [ ] **Benchmark**: Measure performance before/after improvements

### Phase 3: Logic Consolidation (MEDIUM TERM)

- [ ] **Extract Shared Utilities**:
  - [ ] `_detectDefaultExports()` - Multi-default and self-referential detection
  - [ ] `_shouldFlattenModule()` - Auto-flattening decision logic
  - [ ] `_processModuleExports()` - Common export processing
  - [ ] `_buildModuleStructure()` - Namespace vs root assignment
- [ ] **Refactor Mode Files**:
  - [ ] Update `slothlet_eager.mjs` to use shared utilities
  - [ ] Update `slothlet_lazy.mjs` to use shared utilities
  - [ ] Ensure subfolder processing uses same logic
- [ ] **Validate Consistency**: Ensure both modes produce identical API structures

### Phase 4: Testing & Validation (ONGOING)

- [ ] **Comprehensive Test Suite**:
  - [ ] Run all existing tests after each change
  - [ ] Add specific tests for multi-default scenarios
  - [ ] Add performance regression tests
  - [ ] Test edge cases (empty folders, mixed export types)
- [ ] **Cross-Mode Validation**:
  - [ ] Ensure lazy and eager modes produce identical APIs
  - [ ] Verify materialization works correctly after refactoring
  - [ ] Test context propagation still functions

## Technical Specifications

### Module Caching Strategy

```javascript
// Potential caching approach
class ModuleCache {
	constructor() {
		this.rawModules = new Map(); // file path -> raw module
		this.processedModules = new Map(); // file path -> processed module
		this.metadata = new Map(); // file path -> { hasDefault, isSelfRef, etc }
	}

	async getRawModule(filePath) {
		if (!this.rawModules.has(filePath)) {
			const module = await import(`file://${filePath}`);
			this.rawModules.set(filePath, module);
		}
		return this.rawModules.get(filePath);
	}
}
```

### Shared Utility Structure

```javascript
// src/lib/shared/module-processor.mjs
export class ModuleProcessor {
	static detectDefaultExports(moduleFiles, debug = false) {
		/* ... */
	}
	static shouldFlattenModule(module, hasMultipleDefaults, isSelfRef) {
		/* ... */
	}
	static processModuleExports(module, apiKey, context) {
		/* ... */
	}
}
```

## Success Criteria

### ✅ **Phase 1 Complete When**:

- [x] ✅ Lazy mode TV API test shows flattened exports: `api.connect()`, `api.getAllApps()`
- [x] ✅ No `api.connection.*` or `api.app.*` namespaces in lazy mode
- [x] ✅ Lazy and eager modes produce identical API structures (at root level)
- [ ] **NEW**: Subfolders also apply multi-default auto-flattening logic
- [ ] **NEW**: Subfolder connection files flatten properly (e.g., `api.subfolder.connect()` not `api.subfolder.connection.connect()`)
- [ ] **NEW**: Both modes handle subfolders identically

### ✅ **Phase 2 Complete When**:

- [ ] Module loading reduced from 3x to 1x per file
- [ ] Startup performance improved by >50%
- [ ] Memory usage optimized

### ✅ **Phase 3 Complete When**:

- [ ] No duplicate logic between eager/lazy modes
- [ ] Single source of truth for processing decisions
- [ ] Maintainable codebase with shared utilities

### ✅ **Phase 4 Complete When**:

- [ ] All existing tests pass
- [ ] New tests cover multi-default scenarios
- [ ] Performance benchmarks show improvements
- [ ] Cross-mode consistency validated

## Timeline Estimate

- **Phase 1**: 2-4 hours (critical fix)
- **Phase 2**: 4-8 hours (performance optimization)
- **Phase 3**: 8-16 hours (architectural refactoring)
- **Phase 4**: 4-8 hours (testing and validation)

**Total**: 18-36 hours depending on complexity and testing thoroughness

## Risk Mitigation

- **Regression Risk**: Run comprehensive test suite after each phase
- **Performance Risk**: Benchmark before/after each optimization
- **Compatibility Risk**: Ensure API contracts remain unchanged
- **Maintenance Risk**: Document new architecture patterns clearly
