# backgroundMaterialize Config Option

**Added:** v3.0.0  
**Status:** Implemented  
**Related:** `__type` property, TYPE_STATES

## Overview

The `backgroundMaterialize` configuration option enables lazy-mode modules to materialize (load) immediately during proxy creation instead of waiting for first access. This improves first-call performance while maintaining lazy mode's deferred execution model.

## Configuration

```javascript
const api = await slothlet({
  dir: './api',
  mode: 'lazy',
  backgroundMaterialize: true  // Default: false
});
```

## Behavior

### Without backgroundMaterialize (default: false)

```javascript
const api = await slothlet({ 
  dir: './api', 
  mode: 'lazy',
  backgroundMaterialize: false 
});

// Modules NOT loaded yet
console.log(api.math.__type); // TYPE_STATES.UNMATERIALIZED or IN_FLIGHT

// First call triggers materialization (slower)
await api.math.add(2, 3); // Loads module, then executes

// Subsequent calls are fast (module already loaded)
await api.math.add(5, 7);
```

### With backgroundMaterialize (true)

```javascript
const api = await slothlet({ 
  dir: './api', 
  mode: 'lazy',
  backgroundMaterialize: true 
});

// Modules loaded during initialization
console.log(api.math.__type); // "object" (materialized)

// First call is fast (module pre-loaded)
await api.math.add(2, 3); // Executes immediately
```

## Performance Characteristics

### Initialization Time
- **backgroundMaterialize: false** - Faster initialization (modules not loaded)
- **backgroundMaterialize: true** - Slower initialization (all modules loaded)

### First Call Time
- **backgroundMaterialize: false** - Slower first call (loads then executes)
- **backgroundMaterialize: true** - Faster first call (already loaded)

### Use Cases

**Use `backgroundMaterialize: false` when:**
- Fast startup is critical
- Not all modules will be used
- Large API with many modules
- Memory-constrained environments

**Use `backgroundMaterialize: true` when:**
- First-call performance is critical
- Most/all modules will be used
- Testing/development (accurate `__type` immediately)
- Predictable latency requirements

## Implementation

### How It Works

1. **Proxy Creation:** When `createProxy()` is called for a lazy wrapper
2. **Check Flag:** If `materializeOnCreate && mode === 'lazy'`
3. **Trigger Materialization:** Calls `wrapper._materialize()` (fire-and-forget async)
4. **Continue:** Proxy is created and returned immediately
5. **Background Loading:** Module loads in background
6. **Ready:** First access finds module already loaded

### Code Location

- **Config normalization:** `src/lib/helpers/config.mjs` (line 149)
- **Wrapper parameter:** `src/lib/handlers/unified-wrapper.mjs` (line 76)
- **Materialization trigger:** `src/lib/handlers/unified-wrapper.mjs` (line 468)
- **All instantiations:** 13 locations in `modes.mjs` and `lazy.mjs`

### Parameter Flow

```
config.backgroundMaterialize (user config)
  ↓
materializeOnCreate (wrapper parameter)
  ↓
wrapper.materializeOnCreate (instance property)
  ↓
createProxy() checks flag
  ↓
wrapper._materialize() (if true)
```

## Integration with __type

The `__type` property provides accurate type information based on materialization state:

```javascript
import { TYPE_STATES } from "@cldmv/slothlet";

// Without backgroundMaterialize
const api1 = await slothlet({ mode: 'lazy', backgroundMaterialize: false });
console.log(api1.math.__type); // TYPE_STATES.IN_FLIGHT or UNMATERIALIZED

// With backgroundMaterialize
const api2 = await slothlet({ mode: 'lazy', backgroundMaterialize: true });
console.log(api2.math.__type); // "object" (accurate immediately)
```

## Comparison with Eager Mode

| Feature | Lazy (bgMaterialize: false) | Lazy (bgMaterialize: true) | Eager |
|---------|----------------------------|---------------------------|-------|
| **Initialization** | Fast | Medium | Slow |
| **First Call** | Slow | Fast | Fast |
| **Memory Usage** | Low (unused not loaded) | High (all loaded) | High |
| **`__type` accuracy** | Delayed | Immediate | Immediate |
| **`typeof` result** | Always `"function"` | Always `"function"` | Correct |

## Testing

```javascript
import { describe, test, expect } from "vitest";
import slothlet, { TYPE_STATES } from "@cldmv/slothlet";

test("backgroundMaterialize: false - delayed materialization", async () => {
  const api = await slothlet({ 
    mode: "lazy",
    backgroundMaterialize: false
  });
  
  // Not materialized yet
  const typeValue = api.math.__type;
  expect(
    typeValue === TYPE_STATES.UNMATERIALIZED || 
    typeValue === TYPE_STATES.IN_FLIGHT
  ).toBe(true);
  
  await api.shutdown();
});

test("backgroundMaterialize: true - immediate type accuracy", async () => {
  const api = await slothlet({ 
    mode: "lazy",
    backgroundMaterialize: true
  });
  
  // Already materialized
  expect(api.math.__type).toBe("object");
  
  // First call is fast (no load delay)
  const start = Date.now();
  const result = await api.math.add(2, 3);
  const duration = Date.now() - start;
  
  expect(result).toBe(5);
  expect(duration).toBeLessThan(50); // Should be nearly instant
  
  await api.shutdown();
});
```

## Configuration Options

```javascript
{
  backgroundMaterialize: false,  // Default - lazy load on first access
  backgroundMaterialize: true    // Pre-load during initialization
}
```

## Default Value

**Default:** `false`

The default is `false` to maintain backward compatibility and preserve the core benefit of lazy loading - fast startup with deferred module loading.

## CommonJS Usage

```javascript
const slothlet = require("@cldmv/slothlet");

(async () => {
  const api = await slothlet({ 
    dir: './api',
    mode: 'lazy',
    backgroundMaterialize: true 
  });
  
  const TYPE_STATES = await slothlet.TYPE_STATES;
  console.log(api.math.__type); // "object"
})();
```

## Related

- [__type property](./type-property.md)
- [TYPE_STATES symbols](./type-property.md#type_states-symbols)
- [Lazy Loading](../PERFORMANCE.md#lazy-loading)
- [Unified Wrapper](../MODULE-STRUCTURE.md#unified-wrapper)

## Notes

- **Not for eager mode:** This option only affects lazy mode
- **Fire-and-forget:** Materialization is async and non-blocking
- **No await needed:** Initialization doesn't wait for background loads to complete
- **Race condition safe:** First access waits if materialization still in-flight
- **Memory trade-off:** Pre-loading increases memory usage for faster first access
