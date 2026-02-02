# Baseline Test Failures - February 1, 2026

**Overall Status: 88 failures / 2356 tests (96.3% pass rate)**

## Summary of Changes Made Today

1. ✅ **Removed _childCache Map** - Converted to property-based storage using `Object.defineProperty()`
2. ✅ **Fixed api.add() path duplication** - Folder loads correctly under specified path
3. ✅ **Added flexible path formats** - Supports strings, arrays, root-level (`""`, `null`, `undefined`, `[]`)
4. ✅ **Fixed root-level ownership paths** - Empty string handling corrected (was creating `.feature` paths)
5. ✅ **Fixed materialize import** - Added missing import to metadata-collision-modes test

## Failed Test Files (4 total)

### 1. metadata-collision-modes.test.vitest.mjs - 28 failures (68 passed)

**Issue A: conflictingMetadata flag (16 failures)**
- **Affected tests**:
  - 8× "skip mode with metadata" 
  - 8× "warn mode with metadata"
- **Expected**: `conflictingMetadata` should be `undefined`
- **Actual**: `conflictingMetadata` is `true`
- **Root cause**: Flag not being cleaned up after collision resolution

**Issue B: Waiting proxy materialization (4 failures)**
- **Affected tests**: "merge mode - both file and folder functions available" (LAZY modes only)
- **Expected**: `await materialize(api, "math.add", 5, 7)` returns `12`
- **Actual**: Returns `[Function math_waitingProxy]`
- **Root cause**: `materialize()` helper not properly awaiting lazy proxy resolution

**Issue C: Metadata filePath (4 failures)**
- **Affected tests**: "warn mode - merges with warning" (LAZY modes only)
- **Expected**: `/[/\\]math[/\\]math\.mjs$/` (file path)
- **Actual**: `P:\Dropbox\...\api_test_collisions\math` (folder path, missing filename)
- **Root cause**: Metadata storing folder path instead of actual file path for nested modules

**Issue D: Replace mode behavior (4 failures)**
- **Affected tests**: "replace mode - last loaded wins" (LAZY modes only)
- **Expected**: Only ONE source present (file OR folder)
- **Actual**: Both file and folder functions present (merged instead of replaced)
- **Root cause**: Replace mode not actually replacing, merging instead

---

### 2. collision-config.test.vitest.mjs - 48 failures (112 passed)

**Issue: Collision file functions missing (all 48 failures)**
- **Affected tests**: All collision mode tests across all 8 matrix configs
  - "String shorthand > normalize collision mode case-insensitively (MERGE)"
  - "String shorthand > default invalid modes to merge"
  - "collision.api modes > merge mode"
  - "collision.api modes > merge-replace mode"
  - "collision.api modes > replace mode"
  - "Collision with complex structures > merge nested properties"

- **Expected**: Functions from collision file exist: `math.power`, `math.sqrt`, `math.modulo`
- **Actual**: All collision file functions are `undefined`
- **Root cause**: **CRITICAL** - Collision resolution not properly merging properties from colliding modules

**Details**:
```javascript
// Test uses api_test_collisions which has:
// - math.mjs (FILE): exports power(), sqrt(), modulo(), collisionVersion="math-collision-v1"
// - math/ (FOLDER): exports add(), multiply(), divide(), subtract()

// Expected behavior (merge mode):
api.math.add()      // ✅ From folder
api.math.power()    // ❌ Missing - from file
api.math.sqrt()     // ❌ Missing - from file
api.math.modulo()   // ❌ Missing - from file
```

---

### 3. add-api.test.vitest.mjs - 8 failures (48 passed)

**Issue: api.add() validation not rejecting null**
- **Affected test**: "should throw appropriate errors for invalid inputs" (all 8 matrix configs)
- **Expected**: `api.slothlet.api.add(null, TEST_DIRS.API_TEST_MIXED)` should reject
- **Actual**: Resolves with `undefined` instead of rejecting
- **Root cause**: Flexible path format support now accepts `null` as root-level indicator
- **Fix needed**: Add validation to distinguish between intentional root-level (`""`, `[]`) and invalid input (`null` with no context)

---

### 4. addapi-stack-trace-path.test.vitest.mjs - 4 failures (4 passed)

**Issue: API structure type mismatch**
- **Affected test**: "should resolve relative path from closure definition location" (LAZY modes only)
- **Expected**: `typeof api.test.path` should be `"object"`
- **Actual**: `typeof api.test.path` is `"function"`
- **Root cause**: API flattening or property structure changed during refactor

---

## Priority Issues to Fix

### 🔴 CRITICAL (48 failures)
**collision-config.test.vitest.mjs - Collision resolution broken**
- Collision file properties not being merged
- All collision modes affected (merge, merge-replace, replace)
- **Impact**: Core collision resolution system not working

### 🟡 HIGH (16 failures)
**metadata-collision-modes.test.vitest.mjs - conflictingMetadata cleanup**
- Flag persisting when should be removed
- Affects skip and warn modes

### 🟡 HIGH (8 failures)
**add-api.test.vitest.mjs - Validation too permissive**
- Need to validate null vs intentional root-level

### 🟢 MEDIUM (4 failures)
**metadata-collision-modes.test.vitest.mjs - Replace mode merging**
- Replace mode should replace, not merge

### 🟢 MEDIUM (4 failures)
**metadata-collision-modes.test.vitest.mjs - Metadata filePath**
- Folder path instead of file path stored

### 🟢 MEDIUM (4 failures)
**metadata-collision-modes.test.vitest.mjs - Waiting proxy**
- materialize() helper not resolving proxies

### 🟢 MEDIUM (4 failures)
**addapi-stack-trace-path.test.vitest.mjs - Type mismatch**
- API structure changed from object to function

---

## Investigation Notes

### Collision Resolution System
The collision system uses these modes:
- **merge**: Combine properties from both sources
- **merge-replace**: Merge objects, replace primitives/functions at leaves
- **replace**: Complete replacement of existing value
- **skip**: Keep original, skip new
- **warn**: Same as skip but emit warning
- **error**: Throw error on collision

**Expected merge-replace behavior**:
- Objects/functions with methods: MERGE properties recursively
- End-leaf functions (no methods): REPLACE completely
- Primitives: REPLACE completely
- Primitives should still be wrapped and have metadata available

### Root-Level Path Support
Added flexible path formats for `api.add()`:
- `"string.path"` - Nested path
- `["array", "path"]` - Array notation
- `""`, `null`, `undefined`, `[]` - Root-level additions

This may have inadvertently broken validation for actual invalid inputs.

---

## Next Steps

1. **Fix collision resolution** (48 failures)
   - Investigate why collision file properties not merging
   - Check addApiComponent merge logic
   - Verify collision mode handling in api-manager.mjs

2. **Fix conflictingMetadata cleanup** (16 failures)
   - Find where flag is set
   - Ensure it's removed after collision resolution

3. **Fix api.add() validation** (8 failures)
   - Distinguish between intentional null (root-level) and invalid input
   - May need context-aware validation

4. **Fix remaining issues** (12 failures)
   - Replace mode behavior
   - Metadata filePath
   - Waiting proxy materialization
   - API structure type

---

## Test Command

```powershell
$env:NODE_OPTIONS='--conditions=slothlet-dev'; npm run baseline
```

## Related Commits

- `ebc0b96` - feat(api): Fix api.add() path duplication and add flexible path formats
- `5d51350` - fix(ownership): Correct root-level path construction and materialize import
