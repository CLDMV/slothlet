# Hooks System Implementation

**Status:** ❌ NOT IMPLEMENTED (Stubbed)  
**Priority:** 🔴 HIGH - Major V2 feature missing from V3  
**Complexity:** HIGH - Full interceptor framework with pattern matching  
**Related:** [docs/HOOKS.md](../../HOOKS.md) - Complete V2 documentation (788 lines)

---

## Current State

**V3 Status**: API surface exists but throws `NOT_IMPLEMENTED` errors

**Stubbed Methods** (in `src/lib/builders/api_builder.mjs`):
- `api.slothlet.hooks.on(tag, type, handler, options)` - Hook registration
- `api.slothlet.hooks.off(nameOrPattern)` - Hook removal
- `api.slothlet.hooks.enable(pattern)` - Enable hooks by pattern
- `api.slothlet.hooks.disable(pattern)` - Disable hooks by pattern
- `api.slothlet.hooks.clear(type)` - Clear all hooks of type
- `api.slothlet.hooks.list(type)` - List registered hooks

All methods throw:
```javascript
throw new this.SlothletError("NOT_IMPLEMENTED", {
    feature: "slothlet.hooks.*",
    hint: "Hooks system deferred to next prototype iteration"
});
```

---

## V2 Implementation Reference

### Core Hook Types

1. **`before` hooks** - Execute before function call
   - Can mutate arguments (return array of new args)
   - Can short-circuit execution (return value directly)
   - Chained by priority (highest first)

2. **`after` hooks** - Execute after function returns
   - Transform return value (chaining)
   - Cannot prevent function execution
   - Receive original args + return value

3. **`always` hooks** - Execute regardless of success/error
   - Read-only observer pattern
   - Receives result or error
   - Cannot modify behavior

4. **`error` hooks** - Execute on errors only
   - Detailed error context with source tracking
   - Can suppress errors (report without throwing)
   - Source phases: before/function/after/always

### Hook Registration Options

```javascript
api.slothlet.hooks.on(tag, type, handler, {
    pattern: "**",              // Glob pattern matching API paths
    priority: 0,                // Higher = earlier execution
    subset: "before",           // Phase: before|primary|after
    id: "hook-unique-id"        // Optional unique identifier
});
```

### Pattern Matching Features

- Wildcards: `*` (single level), `**` (multiple levels)
- Braces: `{a,b}` (alternatives)
- Negation: `!pattern` (exclusion)
- Examples:
  - `"database.*"` - All database functions
  - `"*.create"` - All create functions at any depth
  - `"api.{user,auth}.**"` - User and auth namespaces

### Runtime Control

```javascript
// Disable all hooks temporarily
api.slothlet.hooks.disable();

// Enable only database hooks
api.slothlet.hooks.enable("database.*");

// Clear all before hooks
api.slothlet.hooks.clear("before");

// List active hooks with metadata
const hooks = api.slothlet.hooks.list();
```

### Error Handling

```javascript
// Error source tracking
{
    error: Error,
    source: "before" | "function" | "after" | "always",
    hookId: "hook-id",
    hookTag: "validation",
    apiPath: "api.user.create",
    timestamp: Date
}

// Error suppression
const api = await slothlet({
    hooks: {
        suppressErrors: true  // Report errors without throwing
    }
});
```

---

## Implementation Requirements

### 1. Core Hook Manager Class

**Location**: Create `src/lib/handlers/hook-manager.mjs`

**Responsibilities**:
- Hook registration/removal
- Pattern compilation and matching
- Priority-based execution ordering
- Subset phase management
- Enable/disable state tracking
- Hook lifecycle management

**Key Methods**:
```javascript
class HookManager extends ComponentBase {
    constructor(slothlet) { super(slothlet); }
    
    // Registration
    on(tag, type, handler, options = {})
    off(nameOrPattern)
    
    // Runtime control
    enable(pattern)
    disable(pattern)
    clear(type)
    list(type)
    
    // Internal execution
    #executeBeforeHooks(apiPath, args)
    #executeAfterHooks(apiPath, result, args)
    #executeAlwaysHooks(apiPath, resultOrError, args)
    #executeErrorHooks(apiPath, error, source, args)
    
    // Pattern matching
    #matchesPattern(apiPath, pattern)
    #compilePattern(pattern)
}
```

### 2. UnifiedWrapper Integration

**Location**: Modify `src/lib/handlers/unified-wrapper.mjs`

**Changes needed**:
- Add hook execution in `apply` trap (before function call)
- Add hook execution after function return (after hooks)
- Add try/catch for error hooks
- Add always hooks in finally block
- Track execution phases for error source

**Execution Flow**:
```javascript
async apply(target, thisArg, args) {
    let phase = "before";
    try {
        // Execute before hooks
        const hookResult = await this.#executeBeforeHooks(args);
        if (hookResult.shortCircuit) return hookResult.value;
        args = hookResult.args;
        
        // Execute actual function
        phase = "function";
        let result = Reflect.apply(target, thisArg, args);
        if (result instanceof Promise) result = await result;
        
        // Execute after hooks
        phase = "after";
        result = await this.#executeAfterHooks(result, args);
        
        return result;
    } catch (error) {
        // Execute error hooks
        await this.#executeErrorHooks(error, phase, args);
        throw error;
    } finally {
        // Execute always hooks
        phase = "always";
        await this.#executeAlwaysHooks(args);
    }
}
```

### 3. Configuration Schema

**Location**: Update `src/lib/helpers/config.mjs`

**Hook configuration**:
```javascript
config.hooks = {
    enabled: true,              // Global enable/disable
    pattern: "**",              // Default pattern
    suppressErrors: false,      // Report errors without throwing
    maxPriority: 1000,          // Maximum priority value
    debug: false                // Debug hook execution
};
```

### 4. Slothlet Initialization

**Location**: Modify `src/slothlet.mjs`

**Changes**:
```javascript
// In Slothlet.load():
this.handlers.hookManager = new HookManager(this);

// Pass hookManager to UnifiedWrapper instances
// Update all wrapper creations to include hooks
```

### 5. API Surface Updates

**Location**: Modify `src/lib/builders/api_builder.mjs`

**Replace stubs with real implementations**:
```javascript
hooks: {
    on: async function slothlet_hooks_on(tag, type, handler, options = {}) {
        return slothlet.handlers.hookManager.on(tag, type, handler, options);
    },
    
    off: async function slothlet_hooks_off(nameOrPattern) {
        return slothlet.handlers.hookManager.off(nameOrPattern);
    },
    
    // ... etc for enable, disable, clear, list
}
```

---

## Testing Requirements

### Unit Tests

1. **Hook registration**: Verify on/off operations
2. **Pattern matching**: Test wildcards, braces, negation
3. **Priority ordering**: Ensure highest priority executes first
4. **Subset phases**: Verify before/primary/after execution order
5. **Short-circuit**: Test before hooks returning values
6. **Value transformation**: Test after hooks chaining
7. **Error handling**: Verify error hooks receive correct context
8. **Always hooks**: Ensure execution regardless of errors

### Integration Tests

1. **Cross-mode compatibility**: Test in lazy and eager modes
2. **Multiple hooks**: Test multiple hooks on same path
3. **Pattern filtering**: Test enable/disable by pattern
4. **Performance**: Ensure minimal overhead when disabled
5. **Cleanup**: Verify hooks removed on shutdown

---

## Performance Considerations

- **Zero overhead when disabled**: No pattern matching if hooks globally disabled
- **Pattern caching**: Compile patterns once, reuse compiled versions
- **Early exit**: Skip hook execution if no hooks registered for path
- **Async optimization**: Only await if hooks return promises
- **Memory cleanup**: Remove hooks on shutdown to prevent leaks

---

## Documentation Updates Needed

1. Update [docs/HOOKS.md](../../HOOKS.md) with V3-specific details
2. Add hook examples to README.md
3. Create migration guide from V2 hooks to V3 hooks
4. Document breaking changes (if any)
5. Add JSDoc annotations to all hook-related code

---

## Migration from V2

**V2 Location**: `src2/lib/hooks/` directory

**Key Files to Reference**:
- `src2/lib/hooks/hook-manager.mjs` - Core implementation
- `src2/lib/hooks/pattern-matcher.mjs` - Pattern compilation
- Hook integration in V2 wrapper system

**Breaking Changes**:
- API namespace change: `api.hooks.*` (V2) → `api.slothlet.hooks.*` (V3)
- Configuration structure may differ
- Integration with new UnifiedWrapper architecture

---

## Timeline Estimate

- **Core HookManager**: 2-3 days
- **UnifiedWrapper integration**: 1-2 days
- **Testing**: 2-3 days
- **Documentation**: 1 day
- **Total**: ~1 week of focused development

---

## Next Steps

1. Review V2 hook-manager.mjs implementation in detail
2. Design V3 HookManager class extending ComponentBase
3. Implement pattern matching system (may reuse V2 code)
4. Integrate with UnifiedWrapper apply trap
5. Write comprehensive test suite
6. Update documentation
7. Remove NOT_IMPLEMENTED stubs

---

## Related Issues

- **EventEmitter context propagation**: May need hook integration for event wrapping
- **Metadata system**: Hooks may want access to function metadata
- **Debug system**: Hook execution should use slothlet.debug("hooks", {...})
