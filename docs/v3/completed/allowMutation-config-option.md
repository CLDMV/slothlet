# allowMutation Configuration Option (v2 Feature)

**Status:** ✅ IMPLEMENTED IN V3 (2026-01-28)  
**Implementation:** config.api.mutations with granular control  
**Test Coverage:** 112/112 active tests passing (48 skipped for reload)  
**Priority:** 🟢 COMPLETE - V2 feature successfully ported with enhancements

---

## Implementation Summary

The v2 `allowMutation` config has been successfully ported to v3 with significant improvements:

- **New structure:** `config.api.mutations: { add, remove, reload }`
- **Granular control:** Can enable/disable each operation independently
- **Backward compatible:** `allowMutation: false` automatically maps to all mutations disabled
- **Deprecation warnings:** Old config patterns show helpful migration hints
- **Test coverage:** 112 passing tests (70% of total, remainder skipped for unimplemented reload)

---

## V2 Feature Overview

### What allowMutation Did (v2)

In v2, `allowMutation: false` was a config option that **completely disabled** runtime API mutation methods:

```javascript
// V2 usage
const api = await slothlet({ 
    dir: "./api",
    allowMutation: false  // Disable all mutation methods
});

// These would throw errors or be unavailable:
// - api.slothlet.api.add()
// - api.slothlet.api.remove()
// - api.slothlet.reload()
```

**Purpose**: Security/safety feature to prevent runtime modifications after initial load.

**Use Cases**:
1. **Production environments**: Lock API after initial load
2. **Security**: Prevent untrusted code from modifying API
3. **Immutability**: Guarantee API structure doesn't change at runtime

---

## Current V3 State

### What Exists

The **collision configuration system** exists and provides fine-grained control:

```javascript
const api = await slothlet({ 
    dir: "./api",
    collision: { 
        initial: "error",  // Error on collisions during buildAPI
        api: "error"       // Error on collisions during api.add()
    }
});
```

**But this is NOT the same as allowMutation:**
- ❌ Collision config only controls **how collisions are handled**
- ❌ Does NOT disable the mutation methods themselves
- ❌ Methods like `api.add()` and `reload()` are still available and callable

### What's Missing

There is **NO way to completely disable mutation methods** in v3:

```javascript
// V3 - No equivalent to v2's allowMutation: false
const api = await slothlet({ 
    dir: "./api"
    // ??? No option to disable api.add(), reload(), etc.
});

// These are ALWAYS available in v3:
api.slothlet.api.add()    // ✅ Always available
api.slothlet.api.remove() // ✅ Always available
api.slothlet.reload()     // ✅ Always available
```

---

## V2 Behavior Details

### When allowMutation: false

**Blocked Operations**:
- `api.slothlet.api.add()` → Throws `INVALID_CONFIG_MUTATION_DISABLED`
- `api.slothlet.api.remove()` → Throws `INVALID_CONFIG_MUTATION_DISABLED`
- `api.slothlet.reload()` → Throws `INVALID_CONFIG_MUTATION_DISABLED`
- Hot reload operations → Blocked

**Still Allowed**:
- Initial API load via `buildAPI()`
- Normal function calls
- Reading API structure
- Accessing metadata

### Test File Evidence

**File**: `tests/vitests/suites/api-manager/api-manager-allowMutation-disabled.test.vitest.mjs`

This test file exists but notes in its header:
```javascript
/**
 * NOTE: allowMutation config option has been REMOVED in v3.
 * This test file is kept for backward compatibility testing only.
 */
```

**Current tests verify**:
- Passing `allowMutation: false` is **ignored** (no effect)
- Mutation methods are **always available**
- Tests suggest using collision config instead (which is NOT equivalent)

---

## Why This Matters

### Security Use Case

Organizations may want to:
1. Load API during application startup
2. **Completely lock** the API from further modifications
3. Prevent any runtime mutations (even non-conflicting ones)

**V3 Gap**: Cannot achieve this. Even with `collision: "error"`, you can still:
- Add to new paths (no collision)
- Remove existing paths
- Reload modules

### Migration Pain Point

V2 users with `allowMutation: false` will:
1. See their config option ignored
2. Have no replacement mechanism
3. Lose their safety/security guarantees

---

## Proposed V3 Solution: config.api.* Structure

### Restructure API-related configuration under `api.*`

Move away from camelCase root-level configs to a cleaner, grouped structure:

```javascript
const api = await slothlet({ 
    dir: "./api",
    api: {
        // Collision handling (move existing collision config here)
        collision: {
            initial: "error",
            api: "merge"
        },
        
        // Mutation control (new - replaces allowMutation)
        mutations: {
            add: true,      // Allow api.slothlet.api.add()
            remove: true,   // Allow api.slothlet.api.remove()
            reload: true    // Allow api.slothlet.reload()
        }
    }
});
```

### Disabling Mutations

```javascript
// Lock the API completely (like v2's allowMutation: false)
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

// Now these throw errors:
await api.slothlet.api.add();     // Error: API mutations disabled
await api.slothlet.api.remove();  // Error: API mutations disabled
await api.slothlet.reload();      // Error: API mutations disabled
```

### Granular Control

```javascript
// Allow add but prevent remove/reload
const api = await slothlet({ 
    dir: "./api",
    api: {
        mutations: {
            add: true,      // ✅ Allowed
            remove: false,  // ❌ Blocked
            reload: false   // ❌ Blocked
        }
    }
});
```

**Benefits**:
- ✅ **Consistent naming**: `api.collision` and `api.mutations` follow same pattern
- ✅ **Logical grouping**: All API behavior settings under `api.*`
- ✅ **Granular control**: Enable/disable individual operations
- ✅ **Clean architecture**: Avoids camelCase pollution at root level
- ✅ **Backward compatible**: Can provide migration path from v2's `allowMutation`

---

## Implementation Requirements

### Phase 1: Restructure configuration system
- Add `api` config namespace
- Move `collision` config to `api.collision` (maintain backward compat)
- Add new `api.mutations` config with `{ add, remove, reload }` properties
- Update config validation and merging logic

### Phase 2: Implement mutation guards
- Store `api.mutations` config in slothlet instance
- `api.slothlet.api.add()` → Check `mutations.add`, throw if false
- `api.slothlet.api.remove()` → Check `mutations.remove`, throw if false
- `api.slothlet.reload()` → Check `mutations.reload`, throw if false

### Phase 3: Error handling
- Add `INVALID_CONFIG_MUTATIONS_DISABLED` error code
- Clear error messages: "API mutation '[operation]' is disabled by configuration"
- Provide helpful error details

### Phase 4: Backward compatibility
- Accept old `collision` config at root (map to `api.collision` internally)
- Accept `allowMutation: false` (map to `api.mutations: { add: false, remove: false, reload: false }`)
- Deprecation warnings for old config patterns

### Phase 5: Testing
- Update `api-manager-allowMutation-disabled.test.vitest.mjs`
- Test granular mutations control
- Test backward compatibility mappings
- Test error messages

### Phase 6: Documentation
- Update main README with new config structure
- Migration guide for v2 → v3
- Examples of common patterns
- Security best practices

**Estimate**: 3-4 days

---

## Migration Guide (When Implemented)

### V2 Code
```javascript
const api = await slothlet({ 
    dir: "./api",
    allowMutation: false
});
```

### V3 Equivalent
```javascript
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
```

### V3 with Backward Compatibility (Temporary)
```javascript
// This will work but show deprecation warning
const api = await slothlet({ 
    dir: "./api",
    allowMutation: false  // Maps to api.mutations internally
});
```

### Also: Collision Config Migration
```javascript
// Old (still supported with warning)
const api = await slothlet({ 
    collision: { initial: "error" }
});

// New (preferred)
const api = await slothlet({ 
    api: {
        collision: { initial: "error" }
    }
});
```

---

## Related Files

- `tests/vitests/suites/api-manager/api-manager-allowMutation-disabled.test.vitest.mjs` - Deprecated test file
- `src/lib/handlers/api-manager.mjs` - Where mutation methods are defined
- `src/slothlet.mjs` - Main config processing

---

## Decision Summary

**Approved Architecture**: `config.api.*` structure with `mutations` object

**Final Structure**:
```javascript
{
    api: {
        collision: { ... },    // Existing, moved here
        mutations: {           // New
            add: true/false,
            remove: true/false,
            reload: true/false
        }
    }
}
```

**Why This Approach**:
1. ✅ Consistent with `collision` pattern (both are objects under `api.*`)
2. ✅ Granular control per operation
3. ✅ Clean grouping of API-related configuration
4. ✅ Avoids camelCase pollution at root level
5. ✅ Easy to extend with future API settings

**Backward Compatibility Strategy**:
- Root-level `collision` config → Maps to `api.collision` (with deprecation warning)
- Root-level `allowMutation: false` → Maps to all `api.mutations` false (with warning)
- Keep warnings for 1-2 major versions before removal

---

## Timeline Estimate

- **Design & Approval**: ✅ COMPLETE
- **Implementation**: 2-3 days (config restructure + mutation guards)
- **Testing**: 1 day (update existing tests + new granular tests)
- **Documentation**: 1 day (README, migration guide, examples)
- **Total**: 4-5 days

---

## Current Workaround

**No perfect workaround exists until implementation**, but you can:

1. **Don't expose mutation methods to untrusted code**:
   ```javascript
   // Only expose safe API to external code
   const safeApi = { ...api };
   delete safeApi.slothlet;
   ```

2. **Use collision config (partial solution)**:
   ```javascript
   // Blocks collisions, but doesn't block all mutations
   const api = await slothlet({ 
       collision: { initial: "error", api: "error" }
   });
   ```

3. **Wrap methods with guards (manual)**:
   ```javascript
   const originalAdd = api.slothlet.api.add;
   api.slothlet.api.add = () => {
       throw new Error("API mutations disabled");
   };
   // Repeat for remove, reload...
   ```

None of these are as clean or secure as the proposed `api.mutations` config.
