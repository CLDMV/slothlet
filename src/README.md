# Slothlet Prototype (src3)

Clean architecture prototype for Slothlet with fixed core issues.

## Architecture Goals

1. **Single AsyncLocalStorage** - One ALS instance in `context.mjs`, no confusion
2. **Centralized Ownership** - All ownership tracking in `ownership.mjs`
3. **Universal Wrapper** - Single wrapper system in `wrapper.mjs` for both modes
4. **Clear Separation** - Each module has ONE responsibility
5. **Meaningful Errors** - Custom `SlothletError` with context at every failure point

## File Structure

```
src3/
  slothlet.mjs          # Main class - simple orchestration
  context.mjs           # Single ALS + context management
  builder.mjs           # API building orchestration
  ownership.mjs         # Centralized ownership tracking
  wrapper.mjs           # Universal function wrapping
  errors.mjs            # Custom error classes
  
  modes/
    eager.mjs           # Eager loading (immediate)
  
  helpers/
    sanitize.mjs        # Filename transformations
    flatten.mjs         # API flattening logic
    loader.mjs          # Module loading utilities
    utilities.mjs       # General helpers
```

## Current Scope

**Included in Prototype:**
- ✅ Core infrastructure (context, errors, ownership)
- ✅ Eager mode implementation
- ✅ Function wrapping with context isolation
- ✅ Ownership tracking system
- ✅ Basic API flattening (Rules 1, 2, 7, 8)
- ✅ Meaningful error messages

**Deferred to Later:**
- ⏸️ Lazy mode (complex proxy logic)
- ⏸️ Hot reload (addApi/removeApi/reloadApi)
- ⏸️ Hooks system
- ⏸️ Live bindings mode
- ⏸️ Per-request context (scope)

## Usage

```javascript
import { Slothlet } from "./src3/slothlet.mjs";

const instance = new Slothlet();
const api = await instance.load({
  dir: "./api_tests/api_test",
  mode: "eager",
  runtime: "async"
});

// Use API
const result = await api.math.add(2, 3);

// Diagnostics
console.log(instance.getDiagnostics());
console.log(instance.getOwnership());

// Cleanup
await instance.shutdown();
```

## Key Improvements

1. **No Multiple ALS Confusion** - Single `contextManager` with one ALS instance
2. **Clear Ownership** - All Maps in one place, easy to reason about
3. **Better Errors** - Every error tells you what happened and how to fix it
4. **Testable** - Each module can be tested in isolation
5. **Simple Flow** - load() → build() → wrap() → return

## Testing

Create `src3/test.mjs` to validate against existing test modules:

```javascript
import { Slothlet } from "./slothlet.mjs";
import { resolve } from "node:path";

const api = await new Slothlet().load({
  dir: resolve(import.meta.dirname, "../api_tests/api_test"),
  mode: "eager"
});

console.log("API loaded:", Object.keys(api));
```

## Next Steps

1. Validate eager mode against existing tests
2. Add basic hot reload support (addApi/removeApi)
3. Implement lazy mode with unified wrapper
4. Add hooks system
5. Migrate full test suite
