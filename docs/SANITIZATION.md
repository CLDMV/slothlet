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
import { sanitize } from "@cldmv/slothlet/sanitize";

sanitize("auto-ip"); // "autoIp"
sanitize("parse-JSON-data"); // "parseJSONData"
sanitize("get-api-status"); // "getApiStatus"
```

## Basic Usage

```javascript
import { sanitize } from "@cldmv/slothlet/sanitize";

// Simple camelCase conversion
sanitize("my-module"); // "myModule"
sanitize("get-user-data"); // "getUserData"

// With options
sanitize("MyModule", { first: false }); // "MyModule"
sanitize("COMMON_APPS", { preserve: { upper: true } }); // "COMMON_APPS"

// With rules
sanitize("auto-ip", {
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

### `first` (default: `true`)

Lowercase the first character of the first primary segment for camelCase convention.

```javascript
sanitize("MyModule"); // "myModule"
sanitize("MyModule", { first: false }); // "MyModule"
sanitize("parse-json"); // "parseJson"
```

### `preserve.upper` (default: `false`)

Automatically preserve sub-segments that are entirely uppercase.

```javascript
sanitize("COMMON_APPS", { preserve: { upper: true } }); // "COMMON_APPS"
sanitize("Mixed_APPS", { preserve: { upper: true } }); // "mixed_APPS"
sanitize("get-API-status", { preserve: { upper: true } }); // "getAPIStatus"
```

**Note**: Only applies to sub-segments that are **entirely** uppercase. Mixed case like `"Mixed"` will still be transformed.

### `preserve.lower` (default: `false`)

Automatically preserve sub-segments that are entirely lowercase.

```javascript
sanitize("common_apps", { preserve: { lower: true } }); // "common_apps"
sanitize("Mixed_apps", { preserve: { lower: true } }); // "mixed_apps"
```

> [!NOTE]
> `preserve.lower` operates at the **sub-segment level** (split by underscores). Hyphens still cause primary-segment splitting, which are then joined without camelCase capitalization:
>
> ```javascript
> sanitize("parse-xml-data", { preserve: { lower: true } }); // "parsexmldata" (joined, no caps)
> sanitize("parse-xml-data", {}); // "parseXmlData" (normal camelCase)
> sanitize("common_apps", { preserve: { lower: true } }); // "common_apps" (underscores preserved)
> ```

## Rules

Rules provide fine-grained control over segment transformation. All rules support glob patterns and are case-insensitive by default.

### `leave` (case-sensitive)

Preserve segments exactly as-is. Case-sensitive matching.

```javascript
sanitize("autoIP", {
	rules: { leave: ["autoIP"] }
}); // "autoIP"

sanitize("auto-ip", {
	rules: { leave: ["ip"] }
}); // "autoip" (preserves "ip" segment)

// Case mismatch - no preservation
sanitize("auto-ip", {
	rules: { leave: ["IP"] }
}); // "autoIp"
```

> [!IMPORTANT]
> `leave` is **case-sensitive**. This was a bug in older versions where it behaved case-insensitively.

### `nocase` (case-insensitive)

Preserve segments exactly as-is. Case-insensitive matching.

```javascript
sanitize("autoIP", {
	rules: { nocase: ["autoip"] }
}); // "autoIP"

sanitize("AutoIP", {
	rules: { nocase: ["autoip"] }
}); // "AutoIP"
```

### `upper`

Force segments to UPPERCASE. Supports exact matches, glob patterns, and boundary patterns.

```javascript
// Exact match
sanitize("get-http-status", {
	rules: { upper: ["http"] }
}); // "getHTTPStatus"

// Multiple segments
sanitize("parse-json-xml-data", {
	rules: { upper: ["json", "xml"] }
}); // "parseJSONXMLData"
```

### `lower`

Force segments to lowercase. Pattern-matched segments are **preserved in lowercase** through the camelCase phase - `lower` rules take full effect symmetrically with `upper`.

```javascript
sanitize("validate-USER-id", {
	rules: { lower: ["user"] }
}); // "validateuserId"  (a matching lower rule suppresses capitalization for that segment)

// Pattern-based lower - segment stays fully lowercase (Bug #6 fix)
sanitize("get-API-status", {
	rules: { lower: ["*-api-*"] }
}); // "getapiStatus"  (api stays lowercase, not capitalized)

sanitize("foo-API-json", {
	rules: { lower: ["json"] }
}); // "fooAPIjson"  (json stays lowercase)
```

## Pattern Matching

The sanitization system supports three types of pattern matching:

### 1. Exact Match

Simple string matching (case-insensitive for `upper`/`lower` rules).

```javascript
sanitize("get-api-status", {
	rules: { upper: ["api"] }
}); // "getAPIStatus"
```

### 2. Glob Patterns (`*` and `?`)

Match patterns before string splitting using wildcards.

#### Pre-split patterns (with hyphens)

```javascript
// *-ip matches strings ending with "-ip"
sanitize("auto-ip", {
	rules: { upper: ["*-ip"] }
}); // "autoIP"

// *-api-* matches strings with "-api-" in the middle
sanitize("get-api-status", {
	rules: { upper: ["*-api-*"] }
}); // "getAPIStatus"

// Multiple patterns
sanitize("get-http-api-status", {
	rules: { upper: ["http", "*-api-*"] }
}); // "getHTTPAPIStatus"
```

#### Underscore patterns

```javascript
// api_* matches strings starting with "api_"
sanitize("api_helper", {
	rules: { upper: ["api_*"] }
}); // "API_helper"

// *_api_* matches strings with "_api_" in the middle
sanitize("get_api_data", {
	rules: { upper: ["*_api_*"] }
}); // "get_API_data"
```

#### Within-segment patterns

Transform parts within already camelCased identifiers.

```javascript
// *URL* matches "url" anywhere in the segment
sanitize("buildUrlWithParams", {
	rules: { upper: ["*URL*"] }
}); // "buildURLWithParams"

sanitize("parseUrl", {
	rules: { upper: ["*URL*"] }
}); // "parseURL"

sanitize("parseUrlFromUrlString", {
	rules: { upper: ["*URL*"] }
}); // "parseURLFromURLString"
```

### 3. Boundary Patterns (`**STRING**`)

Match only when surrounded by other characters (requires positive lookbehind/ahead).

```javascript
// **url** only matches "url" when it has characters before AND after
sanitize("buildUrlWithParams", {
	rules: { upper: ["**url**"] }
}); // "buildURLWithParams"

// Standalone "url" is NOT matched
sanitize("url", {
	rules: { upper: ["**url**"] }
}); // "url"

// Multiple boundary patterns
sanitize("buildApiUrlParser", {
	rules: { upper: ["**api**", "**url**"] }
}); // "buildAPIURLParser"
```

## Rule Precedence

When multiple rules could apply to the same segment, they are evaluated in this order:

1. **`leave` (case-sensitive)** - Highest priority
2. **`nocase` (case-insensitive)**
3. **`preserve.upper` option** - Overrides transformation rules
4. **`preserve.lower` option** - Overrides transformation rules
5. **`upper` rules** - Takes precedence over `lower`
6. **`lower` rules**
7. **Default camelCase transformation** - Lowest priority

### Examples

```javascript
// leave overrides upper
sanitize("autoIP", {
	rules: {
		leave: ["autoIP"],
		upper: ["ip"]
	}
}); // "autoIP"

// preserve.upper overrides lower
sanitize("COMMON_APPS", {
	preserve: { upper: true },
	rules: { lower: ["apps"] }
}); // "COMMON_APPS"

// upper overrides lower
sanitize("foo-api", {
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
sanitize("auto-ip"); // "autoIp"
sanitize("root-math"); // "rootMath"
sanitize("get-api-status"); // "getApiStatus"

// Underscore preservation
sanitize("my_module"); // "my_module"
sanitize("common_apps"); // "common_apps"

// Mixed hyphens and underscores
sanitize("Mixed_APPS_some-thing"); // "mixed_APPS_someThing"
```

### Special Characters and Edge Cases

```javascript
// Special characters removed
sanitize("my file!.mjs"); // "myFileMjs"

// Leading numbers stripped
sanitize("2autoIP"); // "autoIP"

// Leading underscores preserved
sanitize("_test"); // "_test"
sanitize("__private"); // "__private"

// Empty/whitespace becomes underscore
sanitize(""); // "_"
sanitize("   "); // "_"

// Dollar signs preserved
sanitize("$scope"); // "$scope"
```

### Complex Combinations

```javascript
// Multiple options and rules
sanitize("Mixed_API_some-json-DATA", {
	first: true,
	preserve: { upper: true },
	rules: {
		upper: ["json"],
		lower: ["data"],
		leave: ["API"]
	}
}); // "mixed_API_someJSONDATA"
// Note: preserve.upper keeps "DATA" uppercase, overriding lower:["data"]

// Complex pattern matching
sanitize("get-http-api-status", {
	rules: { upper: ["http", "*-api-*"] }
}); // "getHTTPAPIStatus"

// Multiple boundary patterns
sanitize("test-api-url-parser", {
	rules: { upper: ["**api**", "**url**"] }
}); // "testAPIURLParser"
```

### Real-World Use Cases

```javascript
// API endpoint naming
sanitize("get-user-api"); // "getUserApi"
sanitize("post-json-data", {
	rules: { upper: ["json"] }
}); // "postJSONData"

// File-based API generation (the module loader strips the file extension before sanitizing)
sanitize("http-client", {
	rules: { upper: ["http"] }
}); // "HTTPClient"

// Database models
sanitize("user_profile"); // "user_profile"
sanitize("order_item_details"); // "order_item_details"

// Technical acronyms
sanitize("parse-xml-to-json", {
	rules: { upper: ["xml", "json"] }
}); // "parseXMLToJSON"
```

---

## Runtime Convenience Method

When working with a live Slothlet API instance, a convenience method is available on `api.slothlet` that sanitizes a string using the **same sanitize configuration the instance was initialized with** - identical to what Slothlet uses when building API paths from filenames (the options are the instance's `sanitize` config, see [CONFIGURATION.md](CONFIGURATION.md#sanitize)):

```javascript
const api = await slothlet({
	base: "./api",
	sanitize: {
		rules: { upper: ["http", "api"] }
	}
});

// Uses the same sanitize config as the instance
api.slothlet.sanitize("get-http-status"); // "getHTTPStatus"
api.slothlet.sanitize("post-api-data"); // "postAPIData"
api.slothlet.sanitize("my-module"); // "myModule"
```

This is useful for predicting exactly what API path a given filename will produce at runtime.

> [!NOTE]
> `api.slothlet.sanitize()` only accepts a string. It does not accept an options object - the options come from the instance config. Use the standalone `sanitize` export if you need to pass custom options directly.

---

## Testing

The sanitization system is covered by a single comprehensive test suite:

| Suite                      | Tests | Focus                                                                    |
| -------------------------- | ----- | ------------------------------------------------------------------------ |
| `sanitize.test.vitest.mjs` | 104   | camelCase, all options, all rule types, patterns, precedence, edge cases |

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
function sanitize(
	input: string,
	options?: {
		first?: boolean;
		preserve?: {
			upper?: boolean;
			lower?: boolean;
		};
		rules?: {
			leave?: string[];
			nocase?: string[];
			upper?: string[];
			lower?: string[];
		};
	}
): string;
```

### Parameters

- **`input`** (string): The string to sanitize (filename, path segment, etc.)
- **`options`** (object, optional): Configuration options
  - **`first`** (boolean, default: `true`): Lowercase first character
  - **`preserve`** (object, optional): Names kept as they are
    - **`upper`** (boolean, default: `false`): Preserve all-uppercase segments
    - **`lower`** (boolean, default: `false`): Preserve all-lowercase segments
  - **`rules`** (object, optional): Transformation rules
    - **`leave`** (string[], case-sensitive): Preserve segments exactly
    - **`nocase`** (string[], case-insensitive): Preserve segments exactly
    - **`upper`** (string[]): Force segments to UPPERCASE
    - **`lower`** (string[]): Force segments to lowercase (pattern matches preserved through camelCase)

### Returns

- **string**: Valid JavaScript identifier safe for dot-notation access

### Throws

- Does not throw for a non-string input — the value is coerced with `String(input)` before sanitizing (e.g. `sanitize(123)` returns `"_"`).

---

## See Also

- [API-FLATTENING.md](./API-RULES/API-FLATTENING.md) - How sanitization integrates with API generation
- [MODULE-STRUCTURE.md](./MODULE-STRUCTURE.md) - Module loading and naming conventions
- [API-RULES.md](./API-RULES.md) - Complete API generation rule system
- [migration/v2-to-v3.md](./migration/v2-to-v3.md#6-sanitize-helper-export-renamed) - V2 → V3 migration and behavior changes
