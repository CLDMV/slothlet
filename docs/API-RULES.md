# Slothlet API Rules

**Complete Guide to All API Generation Behaviors**

---

## Document Hierarchy

This is the **middle layer** of slothlet's three-tier documentation system:

```text
📋 API-RULES/API-FLATTENING.md (F##)     ← User Guide: Clear examples and flowcharts
          ↑ links to                          ↓ links to
📊 API-RULES.md (1-13)                   ← YOU ARE HERE: Complete behavior catalog
          ↑ links to                          ↓ links to
🔧 API-RULES/API-RULES-CONDITIONS.md     ← Technical: Exact source code locations
                                              ↓ mapped in
🗺️ API-RULES/API-RULE-MAPPING.md         ← Traceability Matrix: Rule # ↔ F## ↔ C##
```

**Cross-Reference Navigation:**

- **For Users**: See [API-RULES/API-FLATTENING.md](API-RULES/API-FLATTENING.md) for user-friendly explanations with examples
- **For Developers**: See [API-RULES/API-RULES-CONDITIONS.md](API-RULES/API-RULES-CONDITIONS.md) for exact source code locations
- **Rule Mapping**: See [API-RULES/API-RULE-MAPPING.md](API-RULES/API-RULE-MAPPING.md) for complete Rule # ↔ F## ↔ C## traceability matrix

---

## Overview

This document catalogs **all 13 API generation behaviors** in slothlet with:

- Verified examples from actual test files with source attribution
- Cross-references to user guide (F##) and technical details (C##)
- Source code locations with function names and file references
- Test file sources demonstrating each behavior in action
- Processing contexts (Root/Subfolder/Multi-Default/AddApi)

**Why 13 Rules vs Flattening Patterns?**

The [Flattening guide](API-RULES/API-FLATTENING.md) focuses on **when content gets promoted/flattened**. This comprehensive guide covers **all API behaviors** including cases where flattening doesn't occur but specific handling is still needed:

- **Flattening Rules** (1, 7, 8, 10, 11, 13): Core flattening patterns
- **Non-Flattening Rules** (2, 3, 4, 5, 6, 9): Export collection, function naming, empty modules, mixed exports
- **AddApi Rules** (11, 12, 13): Runtime API extension behaviors

**Methodology**: Each rule has been systematically verified against test files and source code.

---

## Rule Categories

| Category              | Rules        | Focus                       | Cross-References |
| --------------------- | ------------ | --------------------------- | ---------------- |
| **Basic Flattening**  | 1, 7, 8      | Core flattening patterns    | [F01-F05](API-RULES/API-FLATTENING.md) → [C01-C11](API-RULES/API-RULES-CONDITIONS.md) |
| **Export Handling**   | 2, 4, 5      | Default vs Named exports    | [F04-F05](API-RULES/API-FLATTENING.md) → [C08-C21](API-RULES/API-RULES-CONDITIONS.md) |
| **Special Cases**     | 3, 6, 9, 10  | Edge cases and protections  | [C10, C01, C16-C19](API-RULES/API-RULES-CONDITIONS.md) |
| **AddApi Extensions** | 11, 12, 13   | Runtime API extensions      | [F06-F08](API-RULES/API-FLATTENING.md) → [C33, C34](API-RULES/API-RULES-CONDITIONS.md) |

---

## Table of Contents

1. [Rule 1: Filename Matches Container Flattening](#rule-1-filename-matches-container-flattening)
2. [Rule 2: Named-Only Export Collection](#rule-2-named-only-export-collection)
3. [Rule 3: Empty Module Handling](#rule-3-empty-module-handling)
4. [Rule 4: Named Export with Function Name Preservation](#rule-4-named-export-with-function-name-preservation)
5. [Rule 5: Multiple Module Default Export Handling](#rule-5-multiple-module-default-export-handling)
6. [Rule 6: Multiple Module Mixed Exports](#rule-6-multiple-module-mixed-exports)
7. [Rule 7: Single Module Named Export Flattening](#rule-7-single-module-named-export-flattening)
8. [Rule 8: Single Module Default Export Promotion](#rule-8-single-module-default-export-promotion)
9. [Rule 9: Function Name Preference Over Sanitization](#rule-9-function-name-preference-over-sanitization)
10. [Rule 10: Generic Filename Parent-Level Promotion](#rule-10-generic-filename-parent-level-promotion)
11. [Rule 11: AddApi Special File Pattern](#rule-11-addapi-special-file-pattern)
12. [Rule 12: Module Ownership and Selective API Overwriting](#rule-12-module-ownership-and-selective-api-overwriting)
13. [Rule 13: AddApi Path Deduplication Flattening](#rule-13-addapi-path-deduplication-flattening)
14. [Verification Status](#verification-status)
15. [Cross-Reference Index](#cross-reference-index)

---

## Rule 1: Filename Matches Container Flattening

**Category**: Basic Flattening  
**Status**: ✅ Verified (`api_tests/api_test`)  
**User Guide**: [F01](API-RULES/API-FLATTENING.md#f01-folder-file-name-matching)  
**Technical**: [C05, C09b](API-RULES/API-RULES-CONDITIONS.md#c05)

**Condition**: Filename matches folder name AND no default export AND has named exports  
**Source Files**: `api_tests/api_test/math/math.mjs`  
**Implementation**: `buildCategoryDecisions()` → `getFlatteningDecision()` → `processModuleForAPI()`

**Verified Examples**:

```javascript
// File: api_tests/api_test/math/math.mjs
export function add(a, b) {
	return a + b;
}
export function subtract(a, b) {
	return a - b;
}

// Without Rule 1: api.math.math.add(2, 3)  ❌ (redundant nesting)
// With Rule 1:    api.math.add(2, 3)        ✅ (clean flattening)
api.math.add(2, 3);      // 5
api.math.subtract(5, 2); // 3
```

**Technical Implementation**:

- **Primary Condition**: [C05](API-RULES/API-RULES-CONDITIONS.md#c05) — `fileName === categoryName && !moduleHasDefault && moduleKeys.length > 0`
- **Processing**: [C09b](API-RULES/API-RULES-CONDITIONS.md#c09b) — `flattenToCategory: true` → category-level flattening

```javascript
// C05: Filename Matches Container (Category-Level Flatten)
// Location: src/lib/helpers/api_builder/decisions.mjs
if (categoryName && fileName === categoryName && !moduleHasDefault && moduleKeys.length > 0) {
	return {
		shouldFlatten: true,
		flattenToRoot: false,
		flattenToCategory: true,
		preserveAsNamespace: false,
		useAutoFlattening: false,
		reason: "filename matches container, flatten to category"
	};
}
```

**Processing Path**: Subfolder processing via `getFlatteningDecision()` (currentDepth > 0)  
**Source Code Location**: `src/lib/helpers/api_builder/decisions.mjs` — `getFlatteningDecision()`

---

## Rule 2: Named-Only Export Collection

**Category**: Export Handling  
**Status**: ✅ Verified (`api_tests/api_test`)  
**User Guide**: [F04](API-RULES/API-FLATTENING.md#f04)  
**Technical**: [C15, C09d](API-RULES/API-RULES-CONDITIONS.md#c15)

**Condition**: Directory contains files with only named exports (no default exports)  
**Behavior**: All named exports collected and made accessible at the appropriate namespace level  

**Verified Examples**:

```javascript
// File: constants/values.mjs
export const PI = 3.14159;
export const E = 2.71828;

// File: constants/messages.mjs
export const SUCCESS = "Operation completed";
export const ERROR = "Operation failed";

api.constants.values.PI;          // 3.14159
api.constants.values.E;           // 2.71828
api.constants.messages.SUCCESS;   // "Operation completed"
api.constants.messages.ERROR;     // "Operation failed"
```

**Technical Implementation**:

- **Detection**: [C15](API-RULES/API-RULES-CONDITIONS.md#c15) — `defaultExportCount === 0`
- **Processing**: [C09d](API-RULES/API-RULES-CONDITIONS.md#c09d) — Standard namespace preservation
- **Strategy**: `processingStrategy = "named-only"` → category-level collection

**Key Behavior**:

- Preserves all named export names and values
- Maintains clear namespace separation between files
- No flattening when multiple named exports exist (prevents naming conflicts)

**Source Code Location**: `src/lib/helpers/api_builder/decisions.mjs` — `processModuleForAPI()`  
**Processing Path**: Both Root and Subfolder processing via `processModuleForAPI`

---

## Rule 3: Empty Module Handling

**Category**: Special Cases  
**Status**: ✅ Verified  
**Technical**: [C10](API-RULES/API-RULES-CONDITIONS.md#c10)

**Condition**: Directory contains no loadable module files  
**Behavior**: Graceful handling — creates empty namespace  
**Processing Path**: Early detection in `buildCategoryDecisions()`

**Mode Differences**:

- **EAGER**: Empty folder → `{}` object (not callable)
- **LAZY**: Empty folder → lazy proxy that resolves to `{}` when called

**Technical Implementation**:

- **Detection**: [C10](API-RULES/API-RULES-CONDITIONS.md#c10) — `moduleFiles.length === 0`
- **Strategy**: `processingStrategy = "empty"` → graceful empty handling

```javascript
// Detection in analyzeDirectoryStructure
if (moduleFiles.length === 0) {
	processingStrategy = "empty";
}
```

**Source Code Location**: `src/lib/helpers/api_builder/analysis.mjs`  
**Processing Path**: All paths (detected in `analyzeDirectoryStructure`)

---

## Rule 4: Named Export with Function Name Preservation

**Category**: Export Handling  
**Status**: ✅ Verified (`api_tests/api_test`)  
**User Guide**: [F04](API-RULES/API-FLATTENING.md#f04)  
**Technical**: [C16, C23](API-RULES/API-RULES-CONDITIONS.md#c16)

**Condition**: Named export with a function name that differs from the sanitized filename  
**Behavior**: Preserves the original function name rather than using the filename-derived name  
**Priority**: Function names take precedence over filename-based naming

**Verified Examples**:

```javascript
// File: auto-ip.mjs
export function autoIP() { /* ... */ }
api.autoIP(); // ✅ Function name preserved (not api.autoIp)

// File: json-parser.mjs
export function parseJSON(data) { /* ... */ }
api.parseJSON(data); // ✅ Original casing preserved (not api.jsonParser)
```

**Function Name Priority**:

1. Original function name (if available)
2. Filename-based sanitization (if no function name)

**Technical Implementation**:

- **Detection**: [C16](API-RULES/API-RULES-CONDITIONS.md#c16) — Function name availability check
- **Processing**: [C23](API-RULES/API-RULES-CONDITIONS.md#c23) — Function name takes precedence

---

## Rule 5: Multiple Module Default Export Handling

**Category**: Export Handling  
**Status**: ✅ Verified (`api_tests/api_test`)  
**Technical**: [C08, C09d](API-RULES/API-RULES-CONDITIONS.md#c08)

**Condition**: Category contains multiple modules with default exports  
**Behavior**: Each module maintains its own namespace with the default export accessible directly  
**Processing Path**: Standard namespace preservation (no flattening)

**Verified Examples**:

```javascript
// File: validators/email.mjs
export default function validateEmail(email) { /* ... */ }

// File: validators/phone.mjs
export default function validatePhone(phone) { /* ... */ }

api.validators.email("test@example.com"); // ✅ Default function callable
api.validators.phone("+1234567890");      // ✅ Default function callable
```

**Technical Implementation**:

- **Detection**: [C08](API-RULES/API-RULES-CONDITIONS.md#c08) — `moduleCount > 1 && defaultExportCount > 0`
- **Processing**: [C09d](API-RULES/API-RULES-CONDITIONS.md#c09d) — Standard namespace preservation
- **Strategy**: `processingStrategy = "standard"` → no flattening

**Key Behavior**:

- Maintains clear namespace separation between modules
- Prevents naming conflicts where multiple defaults would collide
- No automatic flattening when multiple defaults are present

---

## Rule 6: Multiple Module Mixed Exports

**Category**: Special Cases  
**Status**: ✅ Verified (`api_tests/api_test_mixed`)  
**Technical**: [C14, C09d](API-RULES/API-RULES-CONDITIONS.md#c14)

**Condition**: Category contains modules with mixed export types (some default, some named-only)  
**Behavior**: Standard namespace processing — each module maintains a distinct namespace  
**Processing Path**: Conservative approach to prevent conflicts

**Verified Examples**:

```javascript
// File: mixed/calculator.mjs (default export)
export default function calculate(operation, a, b) { /* ... */ }

// File: mixed/constants.mjs (named exports only)
export const PI = 3.14159;
export const E = 2.71828;

api.mixed.calculator("add", 2, 3); // ✅ Default accessible
api.mixed.constants.PI;            // ✅ Named exports accessible
api.mixed.constants.E;             // ✅ Clear namespace separation
```

**Technical Implementation**:

- **Detection**: [C14](API-RULES/API-RULES-CONDITIONS.md#c14) — Mixed export types present
- **Processing**: [C09d](API-RULES/API-RULES-CONDITIONS.md#c09d) — Conservative namespace preservation

---

## Rule 7: Single Module Named Export Flattening

**Category**: Basic Flattening  
**Status**: ✅ Verified (`api_tests/api_test`)  
**User Guide**: [F02](API-RULES/API-FLATTENING.md#f02)  
**Technical**: [C06, C09b](API-RULES/API-RULES-CONDITIONS.md#c06)

**Condition**: Category has one module file, module has named exports (no default export), filename ≠ category name  
**Source Files**: `api_tests/api_test/config/settings.mjs`  
**Implementation**: `getFlatteningDecision()` → single module named export flattening

**Verified Examples**:

```javascript
// File: api_tests/api_test/config/settings.mjs
export const DATABASE_URL = "mongodb://localhost:27017/testdb";
export const API_PORT = 3000;
export const DEBUG_MODE = true;

// Without Rule 7: api.config.settings.DATABASE_URL  ❌ (unnecessary nesting)
// With Rule 7:    api.config.DATABASE_URL            ✅ (clean flattening)
api.config.DATABASE_URL; // "mongodb://localhost:27017/testdb"
api.config.API_PORT;     // 3000
api.config.DEBUG_MODE;   // true
```

**Technical Implementation**:

- **Primary Condition**: [C06](API-RULES/API-RULES-CONDITIONS.md#c06) — `moduleCount === 1 && !moduleHasDefault && moduleKeys.length > 0`
- **Processing**: [C09b](API-RULES/API-RULES-CONDITIONS.md#c09b) — `flattenToCategory: true`

---

## Rule 8: Single Module Default Export Promotion

**Category**: Basic Flattening  
**Status**: ✅ Verified (`api_tests/api_test`)  
**User Guide**: [F03](API-RULES/API-FLATTENING.md#f03)  
**Technical**: [C07, C09c](API-RULES/API-RULES-CONDITIONS.md#c07)

**Condition**: Category has one module file with a default export  
**Source Files**: `api_tests/api_test/logger.mjs`  
**Implementation**: `getFlatteningDecision()` → single module default export promotion

**Verified Examples**:

```javascript
// File: api_tests/api_test/logger.mjs
export default function logger(message) {
	console.log(`[LOG] ${message}`);
}

// Without Rule 8: api.logger.logger("Hello World")  ❌ (redundant nesting)
// With Rule 8:    api.logger("Hello World")          ✅ (direct callable)
api.logger("Hello World"); // [LOG] Hello World
typeof api.logger;         // "function"
```

**Callable Namespace Pattern**: When a folder contains a file matching the folder name with a default export (e.g. `logger/logger.mjs`), the default function becomes the namespace itself. Other files in the folder become properties on that function:

```javascript
// File: logger/logger.mjs → export default function log()
// File: logger/utils.mjs  → named exports
api.logger("message");       // calls the default function
api.logger.utils.debug("x"); // other files remain as namespace properties
```

This pattern applies consistently at root level and category level.

**Technical Implementation**:

- **Primary Condition**: [C07](API-RULES/API-RULES-CONDITIONS.md#c07) — `moduleCount === 1 && moduleHasDefault`
- **Processing**: [C09c](API-RULES/API-RULES-CONDITIONS.md#c09c) — `promoteToCategory: true`

---

## Rule 9: Function Name Preference Over Sanitization

**Category**: Special Cases  
**Status**: ✅ Fully Verified (autoIP, parseJSON, getHTTPStatus, XMLParser)  
**User Guide**: [API-RULES/API-FLATTENING.md — Name Preservation](API-RULES/API-FLATTENING.md)  
**Technical**: [C16, C19](API-RULES/API-RULES-CONDITIONS.md#c16)

**Condition**: Exported function has an explicit name that differs from the sanitized filename  
**Behavior**: Preserve the original function name over the filename-based API path  

**Verified Examples**:

```javascript
// File: auto-ip.mjs
export function autoIP() { /* Get automatic IP */ }
// Sanitized filename: "autoIp"      ❌
// Function name:      "autoIP"      ✅

// File: get-http-status.mjs
export function getHTTPStatus() { /* ... */ }
// Sanitized filename: "getHttpStatus"   ❌
// Function name:      "getHTTPStatus"   ✅

// File: parse-json.mjs
export function parseJSON(data) { /* ... */ }
// Sanitized filename: "parseJson"   ❌
// Function name:      "parseJSON"   ✅
```

**Technical Implementation**:

- **Primary Check**: [C16](API-RULES/API-RULES-CONDITIONS.md#c16) — `exportedFunctionName !== sanitizedName`
- **Detailed Check**: [C19](API-RULES/API-RULES-CONDITIONS.md#c19) — `exportedFunction.name !== sanitizedFileName`
- **Precedence**: Function name takes precedence over filename in API structure

**Common Preserved Patterns**:

- Technical acronyms: IP, HTTP, API, URL, JSON, XML, HTML
- Protocol names: TCP, UDP, FTP, SSH, SSL, TLS
- Format specs: JSON, XML, CSV, YAML, TOML
- Industry standards: OAuth, JWT, REST, GraphQL

---

## Rule 10: Generic Filename Parent-Level Promotion

**Category**: Special Cases  
**Status**: ✅ Verified (`api_tests/api_test/nest4/singlefile.mjs`)  
**User Guide**: [API-RULES/API-FLATTENING.md — Index File Pattern](API-RULES/API-FLATTENING.md)  
**Technical**: [C17](API-RULES/API-RULES-CONDITIONS.md#c17)

**Condition**: File has a generic name (`index`, `main`, `default`, etc.)  
**Behavior**: Generic filename becomes transparent; content is promoted to the meaningful parent name  

**Verified Examples**:

```javascript
// File: database/main.mjs
export function connect() { /* ... */ }
export function query() { /* ... */ }

// Without Rule 10: api.database.main.connect()  ❌ (generic 'main' adds no value)
// With Rule 10:    api.database.connect()        ✅ (promoted to parent level)

// File: auth/index.mjs
export function login() { /* ... */ }
export function logout() { /* ... */ }

// Without Rule 10: api.auth.index.login()  ❌ (generic 'index' is noise)
// With Rule 10:    api.auth.login()        ✅ (clean parent-level promotion)
```

**Technical Implementation**:

- **Detection**: [C17](API-RULES/API-RULES-CONDITIONS.md#c17) — `isGenericFilename(fileName)`
- **Promotion**: Content promoted to parent namespace; generic filename becomes invisible

**Note**: Promotion is guarded against name collisions — checked against existing parent namespace properties before promoting.

---

## Rule 11: AddApi Special File Pattern

**Category**: AddApi  
**Status**: ✅ Verified (`api_tests/api_smart_flatten_addapi`)  
**User Guide**: [F06](API-RULES/API-FLATTENING.md#f06)  
**Technical**: [C33](API-RULES/API-RULES-CONDITIONS.md#c33)

**Condition**: A file named `addapi.mjs` is loaded via `api.slothlet.api.add()`  
**Behavior**: Exports are always flattened to the mount namespace regardless of other settings  
**Processing Path**: Detection in `getFlatteningDecision()` (`src/lib/processors/flatten.mjs`); execution in `src/lib/builders/modes-processor.mjs`

**Verified Example**:

```javascript
// File: plugin-folder/addapi.mjs
export function initializePlugin() { /* ... */ }
export function cleanup() { /* ... */ }
export function configure() { /* ... */ }

await api.slothlet.api.add("plugins", "./plugin-folder");

// addapi.mjs exports are always flattened — never nested:
api.plugins.initializePlugin(); // ✅
api.plugins.cleanup();          // ✅
api.plugins.configure();        // ✅
// NOT: api.plugins.addapi.initializePlugin() ❌
```

**Technical Implementation**:

```javascript
// C33: AddApi Special File Detection
if (moduleKeys.includes("addapi")) {
	const addapiModule = newModules["addapi"];
	const otherModules = { ...newModules };
	delete otherModules["addapi"];
	modulesToMerge = { ...addapiModule, ...otherModules };
}
```

**Use Cases**:

- Plugin systems that extend the API at a known namespace
- Hot-reloadable API extension points
- Clean integration of external modules into a live API surface

---

## Rule 12: Module Ownership and Selective API Overwriting

**Category**: AddApi  
**Status**: ✅ Implemented (`src/lib/handlers/ownership.mjs`)  
**User Guide**: [F07](API-RULES/API-FLATTENING.md#f07)  
**Technical**: [C19-C22](API-RULES/API-RULES-CONDITIONS.md#c19)

**Purpose**: Track which module registered each API path, enabling safe hot-reloading and cross-module conflict protection.

**Implementation**: Stack-based ownership system. Each API path maintains an independent ownership history stack. Removing a module automatically rolls back to the previous owner. Collision behavior is controlled by the `api.collision` configuration.

### Configuration

```javascript
const api = await slothlet({
	dir: "./api",
	api: {
		collision: {
			initial: "merge",   // During initial API build
			api: "replace"      // During api.slothlet.api.add()
		}
	}
});
```

### moduleId Tracking

Each `api.slothlet.api.add()` call accepts an optional `moduleId`. This is the key for ownership tracking:

```javascript
// Module A registers plugins namespace
await api.slothlet.api.add("plugins.moduleA", "./modules/moduleA", {}, {
	moduleId: "moduleA"
});

// Module B registers in the same parent namespace
await api.slothlet.api.add("plugins.moduleB", "./modules/moduleB", {}, {
	moduleId: "moduleB"
});

// Hot-reload Module A — ownership system allows this because moduleA owns these paths
await api.slothlet.api.add("plugins.moduleA", "./modules/moduleA-v2", {}, {
	moduleId: "moduleA",
	forceOverwrite: true
});

// Cross-module overwrite — blocked if collision mode is "error"
await api.slothlet.api.add("plugins.moduleB", "./modules/other", {}, {
	moduleId: "moduleA",        // moduleA does not own moduleB's paths
	forceOverwrite: true        // Throws OWNERSHIP_CONFLICT in "error" mode
});
```

### Ownership Stack

Each API path has a history stack. When a module is removed, the previous owner is automatically restored:

```javascript
// Stack for "plugins.tools": [module-a, module-b]  (module-b is current owner)
await api.slothlet.api.remove("module-b");
// Stack restored to: [module-a]  (module-a is active again)
```

### Collision Modes

| Mode | Behavior |
| ---- | -------- |
| `"merge"` (default) | Preserve existing properties, add new ones |
| `"merge-replace"` | Add new properties, overwrite existing |
| `"replace"` | Completely replace the existing value |
| `"skip"` | Keep existing value, silently ignore new |
| `"warn"` | Keep existing value, log a warning |
| `"error"` | Throw `OWNERSHIP_CONFLICT` error |

### forceOverwrite

`forceOverwrite: true` requires an explicit `moduleId` and performs a complete replacement regardless of collision mode. Use for cases where a module must fully replace its own prior registration:

```javascript
await api.slothlet.api.add("config", "./new-config", {}, {
	moduleId: "config-v2",
	forceOverwrite: true
});
```

**Source Code**: `src/lib/handlers/ownership.mjs`

---

## Rule 13: AddApi Path Deduplication Flattening

> **New in v3**

**Category**: AddApi  
**Status**: ✅ Implemented (`api_tests/smart_flatten/api_smart_flatten_folder_config`)  
**User Guide**: [F08](API-RULES/API-FLATTENING.md#f08)  
**Technical**: [C34](API-RULES/API-RULES-CONDITIONS.md#c34)

**Purpose**: When `api.slothlet.api.add("config", folder)` is called and the folder contains a subfolder whose name matches the last segment of the mount path (e.g. `config/config.mjs`), prevent double-nesting `api.config.config.*` by hoisting the subfolder's exports up to `api.config.*`.

**Condition**: After `buildAPI` returns `newApi`, if `newApi` contains a key equal to `lastPart` (last segment of `normalizedPath`) AND the matching value's `filePath` has its parent directory equal to `resolvedFolderPath/lastPart` (direct child check), hoist that key's own exports to the same level as the other keys in `newApi` and remove the duplicate key.

**Verified Example**:

```javascript
// Folder structure: api_smart_flatten_folder_config/
//   main.mjs          ← exports getRootInfo, setRootConfig
//   config/
//     config.mjs      ← exports getNestedConfig, setNestedConfig

await api.slothlet.api.add("config", "./api_smart_flatten_folder_config", {});

// Without Rule 13 (double-nested):
api.config.config.getNestedConfig(); // ❌

// With Rule 13 (hoisted):
api.config.getNestedConfig(); // ✅ subfolder exports promoted
api.config.setNestedConfig(); // ✅
api.config.main.getRootInfo(); // ✅ other files unaffected
```

**Guard — `isDirectChild`**: Rule 13 only fires when the matching key's `filePath` is **directly** inside `resolvedFolderPath/lastPart`. This prevents false positives when a deeper nested folder coincidentally shares the mount-path name:

```
// Should NOT hoist (services/services/services.mjs):
// api.add("services", folder)  →  newApi has key "services"
// but filePath = .../services/services/services.mjs
//     dirname  = .../services/services   ≠ resolvedFolderPath/services
// → Rule 13 does NOT fire
// → api.services.services.getNestedService remains properly nested ✅
```

**Implementation**: `src/lib/handlers/api-manager.mjs` — immediately after `buildAPI` call, before `setValueAtPath`

---

## Verification Status

| Rule | Title                                          | Status       | Test Source |
| ---- | ---------------------------------------------- | ------------ | ----------- |
| 1    | Filename Matches Container Flattening          | ✅ Verified  | `api_tests/api_test` |
| 2    | Named-Only Export Collection                   | ✅ Verified  | `api_tests/api_test` |
| 3    | Empty Module Handling                          | ✅ Verified  | debug testing |
| 4    | Named Export with Function Name Preservation   | ✅ Verified  | `api_tests/api_test`, `api_tests/api_tv_test` |
| 5    | Multiple Module Default Export Handling        | ✅ Verified  | `api_tests/api_tv_test` |
| 6    | Multiple Module Mixed Exports                  | ✅ Verified  | `api_tests/api_test_mixed` |
| 7    | Single Module Named Export Flattening          | ✅ Verified  | `api_tests/api_test` |
| 8    | Single Module Default Export Promotion         | ✅ Verified  | Multiple test files |
| 9    | Function Name Preference Over Sanitization     | ✅ Verified  | autoIP, parseJSON, getHTTPStatus, XMLParser |
| 10   | Generic Filename Parent-Level Promotion        | ✅ Verified  | `api_tests/api_test/nest4/singlefile.mjs` |
| 11   | AddApi Special File Pattern                    | ✅ Verified  | `api_tests/api_smart_flatten_addapi` |
| 12   | Module Ownership and Selective API Overwriting | ✅ Verified  | `src/lib/handlers/ownership.mjs` |
| 13   | AddApi Path Deduplication Flattening           | ✅ Verified  | `api_tests/smart_flatten/api_smart_flatten_folder_config` |

---

## Cross-Reference Index

### By Flattening Pattern (F##)

| Flattening Pattern | API Rules | Technical Conditions |
| ------------------ | --------- | -------------------- |
| [F01](API-RULES/API-FLATTENING.md#f01) | Rule 1 | [C05, C09b, C11](API-RULES/API-RULES-CONDITIONS.md#c05) |
| [F02](API-RULES/API-FLATTENING.md#f02) | Rule 8 (Pattern A) | [C12, C21a](API-RULES/API-RULES-CONDITIONS.md#c12) |
| [F03](API-RULES/API-FLATTENING.md#f03) | Rule 7 | [C04, C09a, C18, C21c, C30](API-RULES/API-RULES-CONDITIONS.md#c04) |
| [F04](API-RULES/API-FLATTENING.md#f04) | Rule 4, Rule 8 (Pattern B) | [C08c, C24](API-RULES/API-RULES-CONDITIONS.md#c08c) |
| [F05](API-RULES/API-FLATTENING.md#f05) | Rule 4, Rule 8 (Pattern C) | [C08c, C11](API-RULES/API-RULES-CONDITIONS.md#c08c) |
| [F06](API-RULES/API-FLATTENING.md#f06) | Rule 11 | [C33](API-RULES/API-RULES-CONDITIONS.md#c33) |
| [F07](API-RULES/API-FLATTENING.md#f07) | Rule 12 | [C19-C22](API-RULES/API-RULES-CONDITIONS.md#c19) |
| [F08](API-RULES/API-FLATTENING.md#f08) | Rule 13 | [C34](API-RULES/API-RULES-CONDITIONS.md#c34) |

### By Technical Condition (C##)

| Condition | API Rules | Flattening Patterns |
| --------- | --------- | ------------------- |
| [C01-C07](API-RULES/API-RULES-CONDITIONS.md#c01) | Rules 1, 6, 7, 8 | F01, F03 |
| [C08-C09d](API-RULES/API-RULES-CONDITIONS.md#c08) | Rules 4, 6, 7 | F04, F05 |
| [C10-C21d](API-RULES/API-RULES-CONDITIONS.md#c10) | Rules 1, 2, 3, 5, 7, 8, 9, 10 | F01, F02, F03 |
| [C22-C26](API-RULES/API-RULES-CONDITIONS.md#c22) | Rules 4, 6 | F04, F05 |
| [C27-C32](API-RULES/API-RULES-CONDITIONS.md#c27) | Rules 5, 6, 7 | Multi-default scenarios |
| [C33](API-RULES/API-RULES-CONDITIONS.md#c33) | Rule 11 | F06 |
| [C34](API-RULES/API-RULES-CONDITIONS.md#c34) | Rule 13 | F08 |

### By Processing Context

| Context | Rules | Primary Conditions |
| ------- | ----- | ------------------ |
| **Single-File Directories** | 1, 7, 8, 10 | C11, C12, C04, C17 |
| **Multi-File Directories** | 1, 2, 5, 7, 9 | C13, C15, C21a-d, C16, C19 |
| **Multi-Default Scenarios** | 5, 6, 7 | C02, C03, C27-C32 |
| **AddApi Operations** | 11, 12, 13 | C33, C34, C19-C22 |
| **Root-Level Processing** | 4, 8, 10 | C08c, C22, C17 |
| **Subfolder Processing** | 4, 6, 8 | C08d, C20, C24 |
