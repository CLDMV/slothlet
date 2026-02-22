# Sanitization System

The Slothlet sanitization system transforms arbitrary strings (file names, path segments) into valid JavaScript identifiers suitable for dot-notation property access. It provides sophisticated rule-based transformation with pattern matching, case preservation, and intelligent segment handling.

## Table of Contents

- [Overview](#overview)
- [Basic Usage](#basic-usage)
- [Core Concepts](#core-concepts)
- [Options](#options)
- [Rules](#rules)
- [Pattern Matching](#pattern-matching)
- [Rule Precedence](#rule-precedence)
- [Examples](#examples)
- [Runtime Convenience Method](#runtime-convenience-method)
- [Testing](#testing)
- [Implementation Notes](#implementation-notes)
- [API Reference](#api-reference)

## Overview

The sanitization function converts filenames into camelCase identifiers while respecting various transformation rules and case preservation options:

```javascript
import { sanitizePropertyName } from "@cldmv/slothlet/helpers/sanitize";

sanitizePropertyName("auto-ip");              // "autoIp"
sanitizePropertyName("parse-JSON-data");      // "parseJSONData"
sanitizePropertyName("get-api-status");       // "getApiStatus"
```

## Basic Usage

```javascript
import { sanitizePropertyName } from "@cldmv/slothlet/helpers/sanitize";

// Simple camelCase conversion
sanitizePropertyName("my-module");           // "myModule"
sanitizePropertyName("get-user-data");       // "getUserData"

// With options
sanitizePropertyName("MyModule", { lowerFirst: false });  // "MyModule"
sanitizePropertyName("COMMON_APPS", { preserveAllUpper: true }); // "COMMON_APPS"

// With rules
sanitizePropertyName("auto-ip", {
  rules: { upper: ["*-ip"] }
}); // "autoIP"
```

## Core Concepts

### Segmentation Levels

The sanitization system uses **two-level segmentation**:

1. **Primary Segments**: Split by hyphens and other non-identifier characters (NOT underscores)
   - Example: `"get-api-status"` → `["get", "api", "status"]`
   - Primary segments are joined with camelCase

2. **Sub-Segments**: Within each primary segment, split by underscores
   - Example: `"Mixed_APPS"` → `["Mixed", "APPS"]`
   - Sub-segments are preserved with underscores
   - Individual sub-segments can have rules applied

### Transformation Order

1. **Pre-split pattern matching**: Check if patterns match the original string
2. **Segment-level rules**: Apply preservation and transformation rules to each segment
3. **CamelCase transformation**: Apply camelCase at the primary segment level
4. **Final cleanup**: Ensure valid JavaScript identifier

## Options

### `lowerFirst` (default: `true`)

Lowercase the first character of the first primary segment for camelCase convention.

```javascript
sanitizePropertyName("MyModule");                        // "myModule"
sanitizePropertyName("MyModule", { lowerFirst: false }); // "MyModule"
sanitizePropertyName("parse-json");                      // "parseJson"
```

### `preserveAllUpper` (default: `false`)

Automatically preserve sub-segments that are entirely uppercase.

```javascript
sanitizePropertyName("COMMON_APPS", { preserveAllUpper: true });  // "COMMON_APPS"
sanitizePropertyName("Mixed_APPS", { preserveAllUpper: true });   // "mixed_APPS"
sanitizePropertyName("get-API-status", { preserveAllUpper: true }); // "getAPIStatus"
```

**Note**: Only applies to sub-segments that are **entirely** uppercase. Mixed case like `"Mixed"` will still be transformed.

### `preserveAllLower` (default: `false`)

Automatically preserve sub-segments that are entirely lowercase.

```javascript
sanitizePropertyName("common_apps", { preserveAllLower: true }); // "common_apps"
sanitizePropertyName("Mixed_apps", { preserveAllLower: true });  // "mixed_apps"
```

> [!NOTE]
> `preserveAllLower` operates at the **sub-segment level** (split by underscores). Hyphens still cause primary-segment splitting, which are then joined without camelCase capitalization:
>
> ```javascript
> sanitizePropertyName("parse-xml-data", { preserveAllLower: true }); // "parsexmldata" (joined, no caps)
> sanitizePropertyName("parse-xml-data", {});                          // "parseXmlData" (normal camelCase)
> sanitizePropertyName("common_apps", { preserveAllLower: true });     // "common_apps" (underscores preserved)
> ```

## Rules

Rules provide fine-grained control over segment transformation. All rules support glob patterns and are case-insensitive by default.

### `leave` (case-sensitive)

Preserve segments exactly as-is. Case-sensitive matching.

```javascript
sanitizePropertyName("autoIP", {
  rules: { leave: ["autoIP"] }
}); // "autoIP"

sanitizePropertyName("auto-ip", {
  rules: { leave: ["ip"] }
}); // "autoip" (preserves "ip" segment)

// Case mismatch - no preservation
sanitizePropertyName("auto-ip", {
  rules: { leave: ["IP"] }
}); // "autoIp"
```

> [!IMPORTANT]
> `leave` is **case-sensitive**. This was a bug in older versions where it behaved case-insensitively.

### `leaveInsensitive` (case-insensitive)

Preserve segments exactly as-is. Case-insensitive matching.

```javascript
sanitizePropertyName("autoIP", {
  rules: { leaveInsensitive: ["autoip"] }
}); // "autoIP"

sanitizePropertyName("AutoIP", {
  rules: { leaveInsensitive: ["autoip"] }
}); // "AutoIP"
```

### `upper`

Force segments to UPPERCASE. Supports exact matches, glob patterns, and boundary patterns.

```javascript
// Exact match
sanitizePropertyName("get-http-status", {
  rules: { upper: ["http"] }
}); // "getHTTPStatus"

// Multiple segments
sanitizePropertyName("parse-json-xml-data", {
  rules: { upper: ["json", "xml"] }
}); // "parseJSONXMLData"
```

### `lower`

Force segments to lowercase. Pattern-matched segments are **preserved in lowercase** through the camelCase phase - `lower` rules take full effect symmetrically with `upper`.

```javascript
sanitizePropertyName("validate-USER-id", {
  rules: { lower: ["user"] }
}); // "validateUserId"  (exact match, no pattern - camelCase applies first char)

// Pattern-based lower - segment stays fully lowercase (Bug #6 fix)
sanitizePropertyName("get-API-status", {
  rules: { lower: ["*-api-*"] }
}); // "getapiStatus"  (api stays lowercase, not capitalized)

sanitizePropertyName("foo-API-json", {
  rules: { lower: ["json"] }
}); // "fooAPIjson"  (json stays lowercase)
```

## Pattern Matching

The sanitization system supports three types of pattern matching:

### 1. Exact Match

Simple string matching (case-insensitive for `upper`/`lower` rules).

```javascript
sanitizePropertyName("get-api-status", {
  rules: { upper: ["api"] }
}); // "getAPIStatus"
```

### 2. Glob Patterns (`*` and `?`)

Match patterns before string splitting using wildcards.

#### Pre-split patterns (with hyphens)

```javascript
// *-ip matches strings ending with "-ip"
sanitizePropertyName("auto-ip", {
  rules: { upper: ["*-ip"] }
}); // "autoIP"

// *-api-* matches strings with "-api-" in the middle
sanitizePropertyName("get-api-status", {
  rules: { upper: ["*-api-*"] }
}); // "getAPIStatus"

// Multiple patterns
sanitizePropertyName("get-http-api-status", {
  rules: { upper: ["http", "*-api-*"] }
}); // "getHTTPAPIStatus"
```

#### Underscore patterns

```javascript
// api_* matches strings starting with "api_"
sanitizePropertyName("api_helper", {
  rules: { upper: ["api_*"] }
}); // "API_helper"

// *_api_* matches strings with "_api_" in the middle
sanitizePropertyName("get_api_data", {
  rules: { upper: ["*_api_*"] }
}); // "get_API_data"
```

#### Within-segment patterns

Transform parts within already camelCased identifiers.

```javascript
// *URL* matches "url" anywhere in the segment
sanitizePropertyName("buildUrlWithParams", {
  rules: { upper: ["*URL*"] }
}); // "buildURLWithParams"

sanitizePropertyName("parseUrl", {
  rules: { upper: ["*URL*"] }
}); // "parseURL"

sanitizePropertyName("parseUrlFromUrlString", {
  rules: { upper: ["*URL*"] }
}); // "parseURLFromURLString"
```

### 3. Boundary Patterns (`**STRING**`)

Match only when surrounded by other characters (requires positive lookbehind/ahead).

```javascript
// **url** only matches "url" when it has characters before AND after
sanitizePropertyName("buildUrlWithParams", {
  rules: { upper: ["**url**"] }
}); // "buildURLWithParams"

// Standalone "url" is NOT matched
sanitizePropertyName("url", {
  rules: { upper: ["**url**"] }
}); // "url"

// Multiple boundary patterns
sanitizePropertyName("buildApiUrlParser", {
  rules: { upper: ["**api**", "**url**"] }
}); // "buildAPIURLParser"
```

## Rule Precedence

When multiple rules could apply to the same segment, they are evaluated in this order:

1. **`leave` (case-sensitive)** - Highest priority
2. **`leaveInsensitive` (case-insensitive)**
3. **`preserveAllUpper` option** - Overrides transformation rules
4. **`preserveAllLower` option** - Overrides transformation rules
5. **`upper` rules** - Takes precedence over `lower`
6. **`lower` rules**
7. **Default camelCase transformation** - Lowest priority

### Examples

```javascript
// leave overrides upper
sanitizePropertyName("autoIP", {
  rules: {
    leave: ["autoIP"],
    upper: ["ip"]
  }
}); // "autoIP"

// preserveAllUpper overrides lower
sanitizePropertyName("COMMON_APPS", {
  preserveAllUpper: true,
  rules: { lower: ["apps"] }
}); // "COMMON_APPS"

// upper overrides lower
sanitizePropertyName("foo-api", {
  rules: {
    upper: ["api"],
    lower: ["api"]
  }
}); // "fooAPI"
```

## Examples

### Basic Transformations

```javascript
// Simple camelCase
sanitizePropertyName("auto-ip");              // "autoIp"
sanitizePropertyName("root-math");            // "rootMath"
sanitizePropertyName("get-api-status");       // "getApiStatus"

// Underscore preservation
sanitizePropertyName("my_module");            // "my_module"
sanitizePropertyName("common_apps");          // "common_apps"

// Mixed hyphens and underscores
sanitizePropertyName("Mixed_APPS_some-thing"); // "mixed_APPS_someThing"
```

### Special Characters and Edge Cases

```javascript
// Special characters removed
sanitizePropertyName("my file!.mjs");         // "myFileMjs"

// Leading numbers stripped
sanitizePropertyName("2autoIP");              // "autoIP"

// Leading underscores preserved
sanitizePropertyName("_test");                // "_test"
sanitizePropertyName("__private");            // "__private"

// Empty/whitespace becomes underscore
sanitizePropertyName("");                     // "_"
sanitizePropertyName("   ");                  // "_"

// Dollar signs preserved
sanitizePropertyName("$scope");               // "$scope"
```

### Complex Combinations

```javascript
// Multiple options and rules
sanitizePropertyName("Mixed_API_some-json-DATA", {
  lowerFirst: true,
  preserveAllUpper: true,
  rules: {
    upper: ["json"],
    lower: ["data"],
    leave: ["API"]
  }
}); // "mixed_API_someJSONDATA"
// Note: preserveAllUpper keeps "DATA" uppercase, overriding lower:["data"]

// Complex pattern matching
sanitizePropertyName("get-http-api-status", {
  rules: { upper: ["http", "*-api-*"] }
}); // "getHTTPAPIStatus"

// Multiple boundary patterns
sanitizePropertyName("test-api-url-parser", {
  rules: { upper: ["**api**", "**url**"] }
}); // "testAPIURLParser"
```

### Real-World Use Cases

```javascript
// API endpoint naming
sanitizePropertyName("get-user-api");         // "getUserApi"
sanitizePropertyName("post-json-data", {
  rules: { upper: ["json"] }
}); // "postJSONData"

// File-based API generation
sanitizePropertyName("http-client.mjs", {
  rules: { upper: ["http"] }
}); // "HTTPClient"

// Database models
sanitizePropertyName("user_profile");         // "user_profile"
sanitizePropertyName("order_item_details");   // "order_item_details"

// Technical acronyms
sanitizePropertyName("parse-xml-to-json", {
  rules: { upper: ["xml", "json"] }
}); // "parseXMLToJSON"
```

---

## Runtime Convenience Method

When working with a live Slothlet API instance, a convenience method is available on `api.slothlet` that sanitizes a string using the **same sanitize configuration the instance was initialized with** - identical to what Slothlet uses when building API paths from filenames:

```javascript
const api = await slothlet({
  dir: "./api",
  sanitize: {
    rules: { upper: ["http", "api"] }
  }
});

// Uses the same sanitize config as the instance
api.slothlet.sanitize("get-http-status");  // "getHTTPStatus"
api.slothlet.sanitize("post-api-data");    // "postAPIData"
api.slothlet.sanitize("my-module");        // "myModule"
```

This is useful for predicting exactly what API path a given filename will produce at runtime.

> [!NOTE]
> `api.slothlet.sanitize()` only accepts a string. It does not accept an options object - the options come from the instance config. Use the standalone `sanitizePropertyName` export if you need to pass custom options directly.

---

## Testing

The sanitization system is covered by a single comprehensive test suite:

| Suite | Tests | Focus |
|---|---|---|
| `sanitize.test.vitest.mjs` | 104 | camelCase, all options, all rule types, patterns, precedence, edge cases |

Tests are located at:
- `tests/vitests/suites/sanitization/sanitize.test.vitest.mjs`

---

## Implementation Notes

### Internal Architecture

1. **Pattern Compilation**: Converts glob patterns to regex with proper escaping
2. **Pre-split Matching**: Evaluates patterns against original string before segmentation
3. **Segment Rules Application**: Applies transformation rules to individual segments; tracks `lower` rule applications
4. **Within-Segment Patterns**: Transforms parts within already-processed segments
5. **CamelCase Transformation**: Applies camelCase based on segment position, skipping segments marked by `lower` rules
6. **Cleanup**: Ensures valid JavaScript identifier output

### Performance Characteristics

- **Pattern caching**: Regex patterns are compiled once per call
- **Early returns**: Preservation rules short-circuit processing
- **Efficient splitting**: Two-level segmentation minimizes regex operations
- **Minimal allocations**: In-place transformations where possible

---

## API Reference

### Function Signature

```typescript
function sanitizePropertyName(
  input: string,
  options?: {
    lowerFirst?: boolean;
    preserveAllUpper?: boolean;
    preserveAllLower?: boolean;
    rules?: {
      leave?: string[];
      leaveInsensitive?: string[];
      upper?: string[];
      lower?: string[];
    };
  }
): string
```

### Parameters

- **`input`** (string): The string to sanitize (filename, path segment, etc.)
- **`options`** (object, optional): Configuration options
  - **`lowerFirst`** (boolean, default: `true`): Lowercase first character
  - **`preserveAllUpper`** (boolean, default: `false`): Preserve all-uppercase segments
  - **`preserveAllLower`** (boolean, default: `false`): Preserve all-lowercase segments
  - **`rules`** (object, optional): Transformation rules
    - **`leave`** (string[], case-sensitive): Preserve segments exactly
    - **`leaveInsensitive`** (string[], case-insensitive): Preserve segments exactly
    - **`upper`** (string[]): Force segments to UPPERCASE
    - **`lower`** (string[]): Force segments to lowercase (pattern matches preserved through camelCase)

### Returns

- **string**: Valid JavaScript identifier safe for dot-notation access

### Throws

- **TypeError**: If input is not a string (rare, as input is coerced to string)

---

## See Also

- [API-FLATTENING.md](./API-FLATTENING.md) - How sanitization integrates with API generation
- [MODULE-STRUCTURE.md](./MODULE-STRUCTURE.md) - Module loading and naming conventions
- [API-RULES.md](./API-RULES.md) - Complete API generation rule system
- [v3/changes/sanitization.md](./v3/changes/sanitization.md) - V2 → V3 migration and behavior changes
