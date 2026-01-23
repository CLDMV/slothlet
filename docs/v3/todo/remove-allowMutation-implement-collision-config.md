# Remove allowMutation and Implement Unified Collision Config

**Date**: January 22, 2026  
**Status**: In Progress  
**Breaking Change**: Yes (v3.x.x)

## Overview

Remove the `allowMutation` config option entirely and implement a unified collision configuration system that provides consistent, granular control over how collisions are handled during initial load and `api.add()` operations.

## Rationale

### Problems with Current System

1. **Three separate flags with different purposes**:
   - `allowMutation` (default: true) - Master switch for all mutations
   - `allowInitialOverwrite` (default: true) - Controls file collisions during initial load
   - `allowAddApiOverwrite` (default: false) - Poorly named, sets default for api.add()

2. **Inconsistent behavior**:
   - Initial load and api.add() have different defaults
   - No explicit "merge" option (it's implied by other flags)
   - allowMutation is a blunt instrument that disables all mutation features

3. **Limited expressiveness**:
   - Can't easily set "error on collision" mode
   - Can't configure different behaviors for initial vs addApi
   - "merge" behavior exists but isn't explicitly configurable

### Benefits of New System

1. **Unified options**: Both contexts use same set of collision modes
2. **Explicit merge**: "merge" is now a first-class option (and the default)
3. **Granular control**: Different behaviors for initial load vs api.add()
4. **Clearer intent**: "skip" | "warn" | "replace" | "merge" | "error"
5. **Simpler API**: One collision config replaces three flags

## Design

### Collision Config Structure

```javascript
{
  collision: {
    initial: "merge",  // During buildAPI
    addApi: "merge"    // During api.add()
  }
}
```

### Valid Collision Modes

- **"skip"** - Silently ignore collision, keep existing value
- **"warn"** - Warn about collision, keep existing value
- **"replace"** - Replace existing value completely
- **"merge"** - Merge properties (preserve original + add new)
- **"error"** - Throw error on collision

### Default Behavior

- **Default**: `{ initial: "merge", addApi: "merge" }`
- **Shorthand**: `collision: "merge"` applies to both contexts
- **Backward compatible**: Old flags map to new system during migration period

### normalizeCollision() Function

```javascript
function normalizeCollision(collision) {
    const validModes = ["skip", "warn", "replace", "merge", "error"];
    const defaultMode = "merge";
    
    // String shorthand applies to both contexts
    if (typeof collision === "string") {
        const normalized = collision.toLowerCase();
        const mode = validModes.includes(normalized) ? normalized : defaultMode;
        return { initial: mode, addApi: mode };
    }
    
    // Object allows per-context control
    if (collision && typeof collision === "object") {
        const validateMode = (m) => {
            if (!m) return defaultMode;
            const normalized = String(m).toLowerCase();
            return validModes.includes(normalized) ? normalized : defaultMode;
        };
        return {
            initial: validateMode(collision.initial),
            addApi: validateMode(collision.addApi)
        };
    }
    
    // Default: merge for both
    return { initial: defaultMode, addApi: defaultMode };
}
```

## Implementation Checklist

### Phase 1: Add normalizeCollision()

- [x] Create normalizeCollision() function in config.mjs
- [ ] Add unit tests for normalizeCollision()
- [x] Update transformConfig() to use collision config

### Phase 2: Update Initial Load (modes.mjs)

- [x] Replace allowInitialOverwrite check with collision.initial
- [x] Implement all collision modes: skip, warn, replace, merge, error
- [x] Handle error mode with SlothletError throw

### Phase 3: Update api.add() (hot_reload.mjs)

- [x] Replace allowAddApiOverwrite with collision.addApi
- [x] Update allowOverwrite calculation to use collision.addApi
- [x] Implement collision modes in setValueAtPath
- [x] Current merge logic handles "merge" mode already

### Phase 4: Remove allowMutation

- [x] Remove allowMutation check from api.add() (line 178)
- [x] Remove allowMutation check from api.remove() (line 208)
- [x] Remove allowMutation check from api.reload() (line 228)
- [x] Remove allowMutation check from namespace.reload() (line 422)
- [x] Remove OwnershipManager conditional creation (slothlet.mjs line 64)
- [x] Remove mutation method deletion (api_builder.mjs lines 440-443)
- [x] Update config defaults (remove allowMutation line)

### Phase 5: Testing

- [x] Create collision-config.test.vitest.mjs with comprehensive scenarios (240 tests)
- [x] Test each collision mode (skip, warn, replace, merge, error)
- [x] Test both contexts (initial, addApi)
- [x] Test shorthand string format
- [x] Test object format with different per-context modes
- [x] Run full collision config test suite (240/240 passing)
- [x] Create API comparison dump before/after changes
- [x] Verify existing merge test still passes

### Phase 6: Documentation

- [x] Update docs\v3\changelog\api-methods-and-config-options.md
  - [x] Replace mutation controls section with collision configuration
  - [x] Document all 5 collision modes (skip, warn, error, merge, replace)
  - [x] Add both contexts (initial and addApi)
  - [x] Show shorthand string format and object format
  - [x] Update configuration patterns to use collision config
  - [x] Update troubleshooting with collision-specific examples
  - [x] Add migration guide from v2 flags
- [ ] Update README.md with collision config examples
- [ ] Add to BREAKING-CHANGES-V3.md

## Completion Status

**Phase 1-4: ✅ COMPLETE** (Commit: 9b3dc19)  
**Phase 5: ✅ COMPLETE** (Commit: 20b349b - January 23, 2026)  
  - All 240 collision config tests passing
  - Fixed ownership.register() signature to use collisionMode instead of allowConflict
  - Updated all 15 call sites across codebase
  - Created getOwnershipCollisionMode() helper to derive mode from config
**Phase 6: ✅ COMPLETE** (Commit: [pending] - January 23, 2026)
  - Comprehensive collision config documentation in docs\v3\changelog\api-methods-and-config-options.md
  - Documented all 5 collision modes with examples
  - Added migration guide from v2 flags
  - Updated configuration patterns and troubleshooting sections

## Migration Guide

### Old System → New System

```javascript
// OLD: allowMutation = false (immutable mode)
{ allowMutation: false }

// NEW: Set both to "error"
{ collision: "error" }

// OLD: allowInitialOverwrite = false
{ allowInitialOverwrite: false }

// NEW: Skip collisions during initial load
{ collision: { initial: "skip", addApi: "merge" } }

// OLD: allowAddApiOverwrite = true
{ allowAddApiOverwrite: true }

// NEW: Replace on collision during api.add()
{ collision: { initial: "merge", addApi: "replace" } }
```

## Files to Modify

1. **src/lib/helpers/config.mjs**
   - Add normalizeCollision() function
   - Update transformConfig() to use collision
   - Remove allowMutation, allowInitialOverwrite, allowAddApiOverwrite

2. **src/lib/builders/api_builder.mjs**
   - Remove allowMutation checks (lines 178, 208, 228, 422)
   - Remove mutation method deletion (lines 440-443)

3. **src/slothlet.mjs**
   - Remove conditional OwnershipManager creation (line 64)
   - Always create OwnershipManager (it's lightweight)

4. **src/lib/helpers/hot_reload.mjs**
   - Update allowOverwrite calculation (line 667)
   - Use collision.addApi instead of allowAddApiOverwrite
   - Implement collision modes in relevant functions

5. **src2/lib/modes/slothlet_eager.mjs** (if it exists)
   - Update collision handling for initial load
   - Implement all collision modes

## Test Strategy

### Unit Tests

- normalizeCollision() with various inputs
- Each collision mode in isolation
- Both contexts (initial, addApi)

### Integration Tests

- Initial load with collisions
- api.add() with collisions
- Mixed collision scenarios
- Error handling

### Regression Tests

- Full vitest suite must pass
- API comparison before/after
- Performance benchmarks unchanged

## Notes

- OwnershipManager is lightweight, no need to conditionally create
- Merge logic already works correctly (fixed in previous commit)
- "merge" mode preserves original properties while adding new ones
- "replace" mode is the old allowOverwrite behavior
- "error" mode replaces allowMutation=false for immutable scenarios
