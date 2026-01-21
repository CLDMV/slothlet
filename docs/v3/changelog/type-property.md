# __type Property and api.slothlet.types

**Added:** v3.0.0  
**Status:** Implemented  
**Related:** `backgroundMaterialize` config option

## Overview

The `__type` property provides a way to check the actual implementation type of lazy-loaded modules without relying on JavaScript's `typeof` operator, which always checks the proxy target type rather than the underlying implementation.

Type state symbols are available at `api.slothlet.types` for checking materialization progress.

## Problem

In lazy mode, all proxies use a function as the target (to make them callable), which means `typeof` always returns `"function"` even for modules that export objects:

```javascript
const api = await slothlet({ dir: './api', mode: 'lazy' });
console.log(typeof api.math);        // "function" (proxy target)
console.log(typeof api.math.__impl); // "object" (actual impl after materialization)
```

This creates a discrepancy between eager and lazy modes:
- **Eager mode:** `typeof api.math` correctly returns `"object"` for object exports
- **Lazy mode:** `typeof api.math` always returns `"function"` regardless of actual type

## Solution

The `__type` property returns the actual type of the underlying implementation:

```javascript
const api = await slothlet({ dir: './api', mode: 'lazy' });
console.log(typeof api.math);   // "function" (proxy target)
console.log(api.math.__type);   // "object" (actual impl type)
```

### Type State Symbols

For lazy mode modules that haven't materialized yet, `__type` returns one of two symbols from `api.slothlet.types`:

- `api.slothlet.types.UNMATERIALIZED` - Module not loaded yet, materialization not started
- `api.slothlet.types.IN_FLIGHT` - Materialization in progress

Once materialized, `__type` returns standard typeof strings:
- `"function"` - Module exports a function
- `"object"` - Module exports an object
- `"undefined"` - Module has no exports or undefined impl

## Usage

### ESM

```javascript
import slothlet from "@cldmv/slothlet";

const api = await slothlet({ 
  dir: './api', 
  mode: 'lazy',
  backgroundMaterialize: true 
});

// Check actual type
if (api.math.__type === "object") {
  console.log("Math module is an object");
}

// Check materialization state using api.slothlet.types
if (api.logger.__type === api.slothlet.types.IN_FLIGHT) {
  console.log("Logger is still loading");
}
```

### CommonJS

```javascript
const slothlet = require("@cldmv/slothlet");

(async () => {
  const api = await slothlet({ 
    dir: './api', 
    mode: 'lazy' 
  });
  
  // Types available at api.slothlet.types
  if (api.math.__type === api.slothlet.types.UNMATERIALIZED) {
    console.log("Math module not loaded yet");
  }
})();
```

## Behavior by Mode

### Eager Mode
- `typeof api.math` → Correct type (`"object"`, `"function"`, etc.)
- `api.math.__type` → Same as `typeof` (always accurate)

### Lazy Mode (without backgroundMaterialize)
- `typeof api.math` → `"function"` (proxy target)
- `api.math.__type` → `TYPE_STATES.UNMATERIALIZED` or `TYPE_STATES.IN_FLIGHT` initially
- After access → `api.math.__type` returns actual type (`"object"`, `"function"`)

### Lazy Mode (with backgroundMaterialize)
- `typeof api.math` → `"function"` (proxy target)
- `api.math.__type` → Actual type immediately (`"object"`, `"function"`) because materialization completes during initialization

## Integration with backgroundMaterialize

The `backgroundMaterialize` config option triggers materialization during proxy creation, ensuring `__type` returns the correct value immediately:

```javascript
const api = await slothlet({ 
  dir: './api', 
  mode: 'lazy',
  backgroundMaterialize: true  // Materialize immediately
});

// No waiting needed - __type is accurate immediately
console.log(api.math.__type);   // "object" (correct)
console.log(api.logger.__type); // "function" (correct)
```

Without `backgroundMaterialize`, there's a race condition:

```javascript
const api = await slothlet({ 
  dir: './api', 
  mode: 'lazy',
  backgroundMaterialize: false
});

// May return IN_FLIGHT or UNMATERIALIZED
console.log(api.math.__type); // TYPE_STATES.IN_FLIGHT

// Wait for materialization
await new Promise(r => setTimeout(r, 100));
console.log(api.math.__type); // "object" (after materialization)
```

## Testing

Tests can use `__type` to verify correct module types without relying on `typeof`:

```javascript
import { describe, test, expect } from "vitest";
import slothlet from "@cldmv/slothlet";

test("lazy mode with backgroundMaterialize has correct types", async () => {
  const api = await slothlet({ 
    mode: "lazy",
    backgroundMaterialize: true
  });
  
  expect(api.math.__type).toBe("object");
  expect(api.logger.__type).toBe("function");
  
  await api.shutdown();
});

test("lazy mode without backgroundMaterialize returns state symbols", async () => {
  const api = await slothlet({ 
    mode: "lazy",
    backgroundMaterialize: false
  });
  
  const typeValue = api.math.__type;
  const isNotMaterialized = 
    typeValue === api.slothlet.types.UNMATERIALIZED || 
    typeValue === api.slothlet.types.IN_FLIGHT;
  
  expect(isNotMaterialized).toBe(true);
  
  await api.shutdown();
});
```

## Implementation Details

### Location
- **Defined:** `src/lib/handlers/unified-wrapper.mjs` (getTrap handler)
- **Exported:** `src/slothlet.mjs`, `index.mjs`, `index.cjs`

### How It Works

The `__type` property is implemented as a getter in the proxy's getTrap:

1. **Trigger materialization if needed** (for lazy mode)
2. **Check state first:**
   - If `inFlight` → return `TYPE_STATES.IN_FLIGHT`
   - If not materialized → return `TYPE_STATES.UNMATERIALIZED`
3. **Check actual impl:**
   - If function → return `"function"`
   - If object with default function → return `"function"`
   - If object → return `"object"`
   - Otherwise → return `"undefined"`

### Symbols Definition

Available at `api.slothlet.types`:

```javascript
{
  UNMATERIALIZED: Symbol("unmaterialized"),
  IN_FLIGHT: Symbol("inFlight")
}
```

Using symbols ensures these state values are unique and cannot be confused with actual type strings.

### Location

The types object is attached to every Slothlet API instance at `api.slothlet.types`, making it easily accessible without separate imports.

## Benefits

1. **Consistent type checking** across eager and lazy modes
2. **Test reliability** - tests can verify actual module types
3. **Debug visibility** - developers can inspect materialization state
4. **No typeof limitations** - bypasses proxy target type checking
5. **Backward compatible** - doesn't affect existing `typeof` usage

## Related

- [backgroundMaterialize config](./background-materialize.md)
- [Unified Wrapper](../MODULE-STRUCTURE.md#unified-wrapper)
- [Lazy Loading](../PERFORMANCE.md#lazy-loading)
