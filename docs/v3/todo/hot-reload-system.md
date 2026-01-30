# Hot Reload System - COMPLETE ✅

**Status**: COMPLETE  
**Priority**: HIGH  
**Created**: January 30, 2026  
**Completed**: January 30, 2026  
**Target Version**: v4.0.x

## Overview

The reload system provides a simple API for reloading all modules in the Slothlet instance at runtime. This is a production feature that allows applications to pick up code changes without requiring a full process restart.

## Implementation Status

### Functional APIs ✅
- `api.slothlet.reload()` - Reloads all modules in the API
- `api.slothlet.api.reload()` - Alternative access path (same functionality)

### Completed Features
- ✅ Module cache invalidation (CommonJS)
- ✅ ESM cache-busting via query parameters with timestamps
- ✅ Full API structure rebuild
- ✅ Hook preservation across reloads
- ✅ Context data preservation
- ✅ Live binding updates (`self`, `reference`)
- ✅ Works in both eager and lazy loading modes
- ✅ Multiple sequential reloads supported
- ✅ Proper error handling
- ✅ Configuration control via `api.mutations.reload`

## Implementation Summary

### What Was Implemented

1. **Core Reload Logic** (`src/slothlet.mjs`)
   - `reload()` method in Slothlet class
   - CommonJS cache clearing for configured directory
   - ESM cache-busting using timestamp-based query parameters
   - Full API rebuild with new module instances
   - Hook preservation (hooks automatically re-attach by path matching)
   - Context manager store updates for live bindings

2. **Cache Invalidation Strategy**
   - **CommonJS**: Direct `require.cache` deletion for modules in config.dir
   - **ESM**: Cache-busting via `?slothlet_instance=ID&module=baseID_reload_timestamp`
   - Timestamp ensures every reload gets fresh modules from disk

3. **Live Binding Updates**
   - Updates `contextManager.instances` Map with new API reference
   - `self` proxy automatically resolves to new API
   - `context` data preserved across reloads
   - `reference` object re-applied after reload

4. **Hook Preservation**
   - Hooks stored in hook manager persist across reloads
   - Pattern matching automatically attaches hooks to new function instances
   - All hook types (before, after, always) preserved

### Test Coverage ✅

**Test File**: `tests/vitests/suites/core/core-reload.test.vitest.mjs`  
**Total Tests**: 64 tests (8 tests × 8 matrix configurations)  
**Status**: All passing

Tests verify:
- ✅ Basic reload functionality
- ✅ Hook preservation (before, after, always)
- ✅ API structure consistency
- ✅ Context data preservation
- ✅ Multiple sequential reloads
- ✅ Alternative API access path
- ✅ Config-based enable/disable

### How It Works

```javascript
// 1. Clear CommonJS require cache for modules in config.dir
for (const key of Object.keys(require.cache)) {
    if (key.startsWith(absoluteTargetDir)) {
        delete require.cache[key];
    }
}

// 2. Generate cache-busting ID with timestamp
const reloadId = `reload_${Date.now()}`;
const moduleId = `${baseModuleId}_${reloadId}`;

// 3. Rebuild API (loader uses moduleId for cache-busting query params)
this.api = await this.builders.builder.buildAPI({
    dir: this.config.dir,
    mode: this.config.mode,
    moduleId // Used in: filePath?slothlet_instance=ID&module=moduleId
});

// 4. Update context manager's instances Map
const store = this.contextManager.instances.get(this.instanceID);
store.self = this.boundApi; // New API reference

// 5. Hooks automatically re-attach (managed by hook system)
```

## Known Limitations & Considerations

1. **In-Flight Operations**
   - Async operations that started before reload will complete using old module code
   - New calls after reload use new module code
   - This is expected and acceptable behavior

2. **Module-Level State**
   - Module-level variables/state is cleared on reload (by design)
   - State should be stored in `context` if persistence needed across reloads

3. **Ownership Tracking**
   - Currently generates new moduleId for each reload
   - Old module ownership records not explicitly cleaned up
   - May need enhancement for long-running apps with many reloads

4. **Performance**
   - Full rebuild on every reload (no selective reloading)
   - For large APIs, reload may take time
   - Consider impact in production (likely only used in dev/staging)

## Usage Examples

### Basic Reload

```javascript
const api = await slothlet({
    dir: "./api",
    api: {
        mutations: {
            reload: true // Must be explicitly enabled
        }
    }
});

// Call function
console.log(await api.math.add(1, 2)); // 3

// ... edit ./api/math.mjs on disk ...

// Reload to pick up changes
await api.slothlet.reload();

// Call function with new code
console.log(await api.math.add(1, 2)); // Uses reloaded code
```

### With Hooks

```javascript
// Register hooks
api.slothlet.hook.on("before:*", (ctx) => {
    console.log("Before:", ctx.path);
});

await api.math.add(1, 2); // Hook fires

// Reload
await api.slothlet.reload();

await api.math.add(3, 4); // Hook still fires (preserved)
```

### Context Preservation

```javascript
// Set context data
api.slothlet.context.userId = "user123";

// Reload
await api.slothlet.reload();

// Context data persists
console.log(api.slothlet.context.userId); // "user123"
```

## Production Considerations

- Reload is NOT just for development - it's a production feature
- Use cases:
  - Zero-downtime code updates
  - Hot-fix deployment without process restart
  - A/B testing code variations
  - Dynamic plugin loading

- Best practices:
  - Enable via config (`api.mutations.reload: true`)
  - Coordinate reloads across multiple instances (external orchestration)
  - Test reload in staging first
  - Monitor for errors after reload
  - Consider queuing/draining active requests before reload

## Future Enhancements

Potential improvements (not currently planned):

- Selective reload (specific modules/paths only)
- Reload hooks (before/after reload callbacks)
- Automatic file watching integration
- Rollback mechanism on reload failure
- Graceful request draining before reload
- Ownership cleanup for old module registrations

## Documentation Status

### Completed
- ✅ Implementation documentation (this file)
- ✅ JSDoc comments in `src/slothlet.mjs` for `reload()` method
- ✅ Usage examples
- ✅ Test coverage documentation

### Todo
- ⏳ Add reload examples to main README.md
- ⏳ Update API reference documentation
- ⏳ Add reload section to user guide
- ⏳ Document in changelog

## References

- Implementation: [src/slothlet.mjs](../../src/slothlet.mjs) - `reload()` method
- Tests: [tests/vitests/suites/core/core-reload.test.vitest.mjs](../../tests/vitests/suites/core/core-reload.test.vitest.mjs)
- Cache-busting: [src/lib/processors/loader.mjs](../../src/lib/processors/loader.mjs) - `loadModule()` method
- Context manager: [src/lib/handlers/context-async.mjs](../../src/lib/handlers/context-async.mjs)

## References

- [Node.js Module System](https://nodejs.org/api/modules.html)
- [ES Module Caching](https://nodejs.org/api/esm.html#esm_resolution_algorithm)
- Related Issue: TBD
- Related PR: TBD
