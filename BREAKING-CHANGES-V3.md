# Breaking Changes in v3.0.0

This document tracks breaking changes between v2.x and v3.0.0.

## Architecture Changes

### 1. Built-in API Structure - `api.slothlet.*`

**v2.x Structure:**
```javascript
const api = await slothlet({ dir: "./api" });

// Top-level methods
api.shutdown();
api.destroy();
api.addApi();
api.removeApi();     // removed in v3
api.reloadApi();
api.scope();
api.run();
api.describe();      // removed in v3

// Direct property access (test mode only)
api.context;         // changed in v3
api.reference;       // changed in v3
```

**v3.0.0 Structure:**
```javascript
const api = await slothlet({ dir: "./api" });

// All built-ins under slothlet namespace
api.slothlet.shutdown();
api.slothlet.api.add();      // formerly addApi
api.slothlet.api.reload();   // formerly reloadApi
api.slothlet.api.remove();   // formerly removeApi
api.slothlet.reload();       // full instance reload
api.slothlet.scope();
api.slothlet.run();

// Diagnostics under slothlet.diag (NEW in v3)
api.slothlet.diag.inspect();
api.slothlet.diag.reference();
api.slothlet.diag.context();

// Convenience: Root-level shutdown/destroy still available
api.shutdown();  // alias to api.slothlet.shutdown()
api.destroy();   // permanent destruction
```

**Migration:**
- Replace `api.addApi()` → `api.slothlet.api.add()`
- Replace `api.removeApi()` → `api.slothlet.api.remove()`
- Replace `api.reloadApi()` → `api.slothlet.api.reload()`
- Replace `api.scope()` → `api.slothlet.scope()`
- Replace `api.run()` → `api.slothlet.run()`
- Root-level `api.shutdown()` and `api.destroy()` still work as convenience aliases

**Reason:** Prevents namespace conflicts with user API modules and provides clearer organization.

---

### 2. API Inspection Methods - `api.describe()`, `api.context`, `api.reference`

**v2.x:**
```javascript
const api = await slothlet({ 
  dir: "./api",
  reference: { md5: someFn, version: "1.0" }
});

// Describe API structure
const keys = api.describe();           
// Returns: Top-level keys as array (Reflect.ownKeys)

const full = await api.describe(true); 
// Returns: Fully resolved API object
// - Lazy mode: Recursively resolves ALL lazy proxies
// - Eager mode: Shallow copy of full API

// Direct property access (SLOTHLET_INTERNAL_TEST_MODE only)
api.context;    // Direct access to context object
api.reference;  // Direct access to reference object { md5, version }
```

**v3.0.0:**
```javascript
const api = await slothlet({ 
  dir: "./api",
  reference: { md5: someFn, version: "1.0" },
  diagnostics: true  // Must enable diagnostics
});

// Same describe() functionality, now under diagnostics:
const keys = api.slothlet.diag.describe();
// Returns: Top-level keys array (same as v2)

const full = api.slothlet.diag.describe(true);
// Returns: Full API structure (same as v2 eager mode)

// Direct access moved to diagnostics namespace:
const ctx = api.slothlet.diag.context();     // Context object
const ref = api.slothlet.diag.reference();   // Reference object { md5, version }
const info = api.slothlet.diag.inspect();    // Full instance diagnostics
```

**Migration:**
- Replace `api.describe()` → `api.slothlet.diag.describe()` (requires `diagnostics: true`)
- Replace `api.describe(true)` → `api.slothlet.diag.describe(true)` (requires `diagnostics: true`)
- Replace `api.context` → `api.slothlet.diag.context()` (requires `diagnostics: true`)
- Replace `api.reference` → `api.slothlet.diag.reference()` (requires `diagnostics: true`)
- Add `diagnostics: true` to config to enable diagnostic methods

**Reason:** 
- Diagnostics consolidated under `api.slothlet.diag.*` namespace for better organization
- `describe()` functionality preserved but moved to diagnostics (opt-in via config)
- `context` and `reference` are now methods (not properties) for consistency
- Diagnostics are opt-in via `diagnostics: true` configuration flag

---

### 3. Metadata API Import Path

**v2.x:**
```javascript
import { metadataAPI } from "@cldmv/slothlet/runtime";

const meta = await metadataAPI.get("some.function");
```

**v3.0.0:**
```javascript
import { metadataAPI } from "@cldmv/slothlet/handlers/metadata";

const meta = await metadataAPI.get("some.function");
```

**Migration:**
- Update import path from `@cldmv/slothlet/runtime` to `@cldmv/slothlet/handlers/metadata`

**Reason:** Clearer module organization - metadata functionality is a handler, not a core runtime export.

---

### 4. Runtime Exports Cleanup

**v2.x:**
```javascript
import { self, context, reference } from "@cldmv/slothlet/runtime";
```

**v3.0.0:**
```javascript
// Only self and context are exported
import { self, context } from "@cldmv/slothlet/runtime";

// reference has been removed
```

**Migration:**
- Remove any usage of `reference` from runtime imports
- Use `self` to access the full API within module functions
- Use `api.slothlet.diag.reference()` if you need the raw user modules (diagnostics mode only)

**Reason:** `reference` was redundant with `self` and caused confusion about which to use.

---

## Dual Context Manager System

### New: Context Manager Selection

**v3.0.0 introduces two context isolation strategies:**

1. **AsyncLocalStorage (default)** - `runtime: "async"`
   - Uses Node.js AsyncLocalStorage for automatic context propagation
   - Better for async/await heavy code
   - Import from: `@cldmv/slothlet/runtime/async`

2. **Live Bindings** - `runtime: "live"`
   - Direct global bindings for maximum performance
   - Requires manual context management
   - Import from: `@cldmv/slothlet/runtime/live"`

**Configuration:**
```javascript
const api = await slothlet({
    dir: "./api",
    runtime: "async"  // or "live"
});
```

**Migration:**
- v2.x behavior maps to `runtime: "async"` (default in v3)
- No code changes needed if using default configuration
- For performance-critical applications, test with `runtime: "live"`

---

## API Structure Fixes

### 5. Export Default Flattening - Logger Pattern Fixed

**v2.x Behavior (BUG):**
```javascript
// logger/logger.mjs exports default function log() + other files
const api = await slothlet({ dir: "./api" });

// V2 incorrectly creates object with .log() method
api.logger.log("message");          // Works but wrong pattern
typeof api.logger;                   // "object" (should be "function")

// Other files in folder work correctly
api.logger.utils.debug("debug");     // Works
```

**v3.0.0 Behavior (FIXED):**
```javascript
// logger/logger.mjs exports default function log() + other files
const api = await slothlet({ dir: "./api" });

// V3 correctly makes logger callable
api.logger("message");               // NOW WORKS - logger IS the function
typeof api.logger;                   // "function" (correct!)

// Other files still work as namespaces
api.logger.utils.debug("debug");     // Still works
```

**Pattern Explanation:**

When a folder contains a file matching the folder name with a default export:
- `logger/logger.mjs` with `export default function log()`
- The default function BECOMES the namespace itself
- Other files in the folder become properties on that function

This pattern now works consistently at both:
- **Root level**: `root-function.mjs` → `api()` is callable
- **Category level**: `logger/logger.mjs` → `api.logger()` is callable

**Migration:**

If you were using `api.logger.log()` in v2:
```javascript
// v2 (worked but was incorrect pattern)
api.logger.log("message");

// v3 (correct pattern)
api.logger("message");
```

If you have other modules following this pattern (`folder/folder.mjs` with default export):
- **v2**: Would create `.folderName()` method on object
- **v3**: Creates callable namespace directly

**Reason:** 
- V2 had inconsistent flattening - root-level worked, but folder-level didn't
- V3 applies the same pattern at all levels for consistency
- JSDoc in v2 logger indicated this was the INTENDED behavior but never worked

---

## i18n System

### 6. New: Internationalization Support

**v3.0.0 adds full i18n support:**

All error messages, warnings, and debug output now use the translation system:

```javascript
import { t, setLanguage } from "@cldmv/slothlet/i18n";

// Set language (defaults to "en-us")
await setLanguage("es-mx");

// Use in code
console.warn(t("WARNING_LANGUAGE_UNAVAILABLE", { lang }));

// Errors automatically use current language
throw new SlothletError("INVALID_CONFIG", { ... });
```

**Supported languages:**
- `en-us` - English (US) - default
- `es-mx` - Spanish (Mexico)

**Migration:**
- No breaking changes - existing code continues to work
- Error messages may appear in different language if user's environment is configured
- Custom error handling should expect translated messages

---

## Summary of Required Changes

### High Priority (Breaking)

1. ✅ **Update built-in API calls:**
   - `api.addApi()` → `api.slothlet.api.add()`
   - `api.removeApi()` → `api.slothlet.api.remove()`
   - `api.reloadApi()` → `api.slothlet.api.reload()`
   - `api.scope()` → `api.slothlet.scope()`
   - `api.run()` → `api.slothlet.run()`

2. ✅ **Update inspection/diagnostic methods:**
   - `api.describe()` → `api.slothlet.diag.describe()` (requires `diagnostics: true` in config)
   - `api.describe(true)` → `api.slothlet.diag.describe(true)` (requires `diagnostics: true` in config)
   - `api.context` → `api.slothlet.diag.context()` (requires `diagnostics: true` in config)
   - `api.reference` → `api.slothlet.diag.reference()` (requires `diagnostics: true` in config)

3. ✅ **Update metadata imports:**
   - `import { metadataAPI } from "@cldmv/slothlet/runtime"` 
   - → `import { metadataAPI } from "@cldmv/slothlet/handlers/metadata"`

4. ✅ **Remove reference usage:**
   - `import { self, context, reference }` → `import { self, context }`

### Medium Priority (Recommended)

5. **Test with new runtime options:**
   - Try `runtime: "live"` for performance-critical code
   - Verify async context propagation works correctly

6. **Add i18n support to custom error messages:**
   - Consider translating user-facing messages
   - Add new language files if needed

### Low Priority (Optional)

7. **Leverage new features:**
   - Use `diagnostics: true` to enable inspection methods
   - Use `api.slothlet.diag.describe()` for API structure inspection
   - Use `api.slothlet.diag.inspect()` for comprehensive instance state
   - Use `api.slothlet.diag.context()` for debugging context state
   - Use `api.slothlet.diag.reference()` to access reference object passed to slothlet
   - Implement custom language translations

---

## Timeline

- **v2.12.0** - Final v2 release with bug fixes
- **v3.0.0-alpha** - Breaking changes, testing phase
- **v3.0.0** - Stable release with full migration guide
