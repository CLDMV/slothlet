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
- [V2 vs V3 Differences](#v2-vs-v3-differences)

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

Force segments to lowercase.

```javascript
sanitizePropertyName("validate-USER-id", { 
  rules: { lower: ["user"] } 
}); // "validateUserid"

sanitizePropertyName("foo-API-json", { 
  rules: { lower: ["json"] } 
}); // "fooAPIjson"
```

## Pattern Matching

The sanitization system supports three types of pattern matching:

### 1. Exact Match

Simple string matching (case-insensitive for upper/lower rules).

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

#### Underscore patterns (V3 only)

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

## V2 vs V3 Differences

### Improvements in V3

1. **Two-level segmentation**: V3 properly handles underscore-separated parts within hyphenated segments
   ```javascript
   // V2 and V3 both produce:
   sanitizePropertyName("Mixed_APPS_some-thing", { preserveAllUpper: true });
   // "mixed_APPS_someThing"
   ```

2. **Underscore pattern support**: V3 supports patterns with underscores
   ```javascript
   // V3 only:
   sanitizePropertyName("api_helper", { rules: { upper: ["api_*"] } });
   // "API_helper"
   ```

3. **Proper case preservation**: V3 better handles case preservation with two-level segmentation
   ```javascript
   sanitizePropertyName("mixed__APPS");  // "mixed__APPS" (preserves uppercase APPS)
   ```

### Behavior Compatibility

V3 maintains full backward compatibility with V2 behavior for all standard use cases. The comprehensive test suite (89 tests) validates both V2 and V3 produce identical results for:

- Basic camelCase transformations
- All options (lowerFirst, preserveAllUpper, preserveAllLower)
- All rule types (leave, leaveInsensitive, upper, lower)
- Pattern matching (exact, glob, boundary, within-segment)
- Rule precedence and conflicts
- Edge cases and special characters

### Migration Notes

If migrating from V2 to V3:

- **V2 bugs fixed in V3**:
  - `leave` rule is now properly case-sensitive (V2 was incorrectly case-insensitive)
  - Proper full camelCase transformation (V2 only changed first character of segments)
  
- **Improved consistency**: Two-level segmentation provides more predictable results with mixed delimiter types

**Note**: While most common use cases produce identical results between V2 and V3, edge cases involving the `leave` rule or complex case transformations may differ due to the bug fixes above. Current V3 has full feature parity with V2 plus these improvements.

## Testing

The sanitization system is comprehensively tested with 89 tests covering:

- 14 basic camelCase tests
- 4 lowerFirst option tests
- 9 preserve option tests
- 11 rule tests (leave, leaveInsensitive, upper, lower)
- 16 pattern matching tests
- 5 conflict resolution tests
- 3 lowerFirst interaction tests
- 5 pattern edge case tests
- 2 stress tests
- 4 V3-specific improvement tests

Tests are located at:
- `tests/vitests/suites/sanitization/sanitization-v2v3-compat.test.vitest.mjs` (V2/V3 compatibility)
- `tests/vitests/suites/sanitization/sanitize.test.vitest.mjs` (pattern focus)

## Implementation Notes

### Internal Architecture

1. **Pattern Compilation**: Converts glob patterns to regex with proper escaping
2. **Pre-split Matching**: Evaluates patterns against original string before segmentation
3. **Segment Rules Application**: Applies transformation rules to individual segments
4. **Within-Segment Patterns**: Transforms parts within already-processed segments
5. **CamelCase Transformation**: Applies final camelCase based on segment position
6. **Cleanup**: Ensures valid JavaScript identifier output

### Performance Characteristics

- **Pattern caching**: Regex patterns are compiled once per call
- **Early returns**: Preservation rules short-circuit processing
- **Efficient splitting**: Two-level segmentation minimizes regex operations
- **Minimal allocations**: In-place transformations where possible

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
    - **`lower`** (string[]): Force segments to lowercase

### Returns

- **string**: Valid JavaScript identifier safe for dot-notation access

### Throws

- **TypeError**: If input is not a string (rare, as input is coerced to string)

## See Also

- [API Flattening](./API-FLATTENING.md) - How sanitization integrates with API generation
- [Module Structure](./MODULE-STRUCTURE.md) - Module loading and naming conventions
- [API Rules](./API-RULES.md) - Complete API generation rule system
