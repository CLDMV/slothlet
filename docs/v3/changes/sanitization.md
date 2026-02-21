# Sanitization Changes: V2 → V3

## Summary

V3 fixes two correctness bugs in the sanitization system, expands pattern matching capabilities, renames the exported function, and adds a runtime convenience method.

---

## Breaking Changes

### Function Renamed: `sanitizePathName` → `sanitizePropertyName`

```javascript
// V2
import { sanitizePathName } from "@cldmv/slothlet/helpers/sanitize";
sanitizePathName("my-module");

// V3
import { sanitizePropertyName } from "@cldmv/slothlet/helpers/sanitize";
sanitizePropertyName("my-module");
```

---

## Bug Fixes

### Bug #6: `lower` Pattern Rules Overridden by CamelCase

Pattern-based `lower` rules were silently discarded by the subsequent camelCase phase. A segment lowercased by a pattern match would still get its first character capitalized.

```javascript
// V2 (incorrect)
sanitizePropertyName("get-API-status", { rules: { lower: ["*-api-*"] } });
// → "getApiStatus"  ❌ (camelCase re-capitalized "api")

// V3 (correct)
sanitizePropertyName("get-API-status", { rules: { lower: ["*-api-*"] } });
// → "getapiStatus"  ✅ (lowercase preserved through camelCase phase)
```

`upper` and `lower` rules are now fully symmetric.

**Fix**: Added `lowerRuleApplied` tracking during segment processing. Segments marked as having a `lower` pattern applied skip camelCase capitalization.

---

### Bug Fix: `leave` Rule is Now Case-Sensitive

In V2, the `leave` rule behaved case-insensitively despite the documentation saying otherwise. V3 enforces strict case-sensitivity. Use `leaveInsensitive` when case-insensitive matching is needed.

```javascript
// V2 (incorrectly preserved despite case mismatch)
sanitizePropertyName("auto-ip", { rules: { leave: ["IP"] } });
// → "autoip"  ❌ (shouldn't have matched)

// V3 (correct)
sanitizePropertyName("auto-ip", { rules: { leave: ["IP"] } });
// → "autoIp"  ✅ (case mismatch = no match, normal camelCase applied)
```

---

## New Features

### Two-Level Segmentation

V3 properly handles underscore-separated sub-segments within hyphenated primary segments. Rules and `preserveAllUpper` apply at the sub-segment level, not just the top level.

```javascript
sanitizePropertyName("Mixed_APPS_some-thing", { preserveAllUpper: true });
// → "mixed_APPS_someThing"  ✅

sanitizePropertyName("mixed__APPS");   // → "mixed__APPS"  (consecutive underscores preserved)
sanitizePropertyName("test___value");  // → "test___value" (triple underscores preserved)
```

---

### Underscore Glob Patterns

V3 supports glob patterns containing underscores, enabling rules on underscore-delimited segments.

```javascript
sanitizePropertyName("api_helper", { rules: { upper: ["api_*"] } });
// → "API_helper"

sanitizePropertyName("get_api_data", { rules: { upper: ["*_api_*"] } });
// → "get_API_data"
```

---

## New API: `api.slothlet.sanitize(str)`

A runtime convenience method that sanitizes a string using the **same sanitize config the instance was initialized with** — identical to what Slothlet uses when building API paths from filenames. Useful for predicting API paths without importing the helper directly.

```javascript
const api = await slothlet({
  dir: "./api",
  sanitize: { rules: { upper: ["http"] } }
});

api.slothlet.sanitize("get-http-status"); // → "getHTTPStatus"
api.slothlet.sanitize("my-module.mjs");  // → "myModule"

// Predict what API path a file will get
const filename = "data-processor.mjs";
const apiPath = api.slothlet.sanitize(filename);
console.log(`api.${apiPath}`); // → "api.dataProcessor"
```

---

## Backward Compatibility

All standard use cases produce identical results between V2 and V3. The consolidated test suite (`tests/vitests/suites/sanitization/sanitize.test.vitest.mjs`, 104 tests) validates this. Only edge cases involving `leave` case-sensitivity or `lower` pattern rules differ — both were bugs in V2.
