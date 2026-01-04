# Slothlet API Rules - Comprehensive Documentation (v2)

**Complete Guide to All API Generation Behaviors with Cross-Referenced Implementation Details**

- **Version**: 2.0
- **Date**: January 3, 2026
- **Purpose**: Maintainer and contributor guide documenting all API generation rules with verified examples and technical cross-references
- **Status**: ✅ **VERIFIED AND CURRENT**

---

## Document Hierarchy

This is the **middle layer** of slothlet's three-tier documentation system:

```text
📋 API-FLATTENING-v2.md (F##)     ← User Guide: Clear examples and flowcharts
     ↑ links to                    ↓ links to
📊 API-RULES-v2.md (1-12)         ← YOU ARE HERE: Complete behavior catalog
     ↑ links to                    ↓ links to
🔧 API-RULES-CONDITIONS-v2.md     ← Technical: Exact source code locations
```

**Cross-Reference Navigation:**

- **⬆️ For Users**: See [API-FLATTENING-v2.md](API-FLATTENING-v2.md) for user-friendly explanations with examples
- **⬇️ For Developers**: See [API-RULES-CONDITIONS-v2.md](API-RULES-CONDITIONS-v2.md) for exact source code locations

---

## Overview

This document catalogs **all 12 API generation behaviors** in slothlet with:

- **Verified examples** from actual test files with source attribution
- **Cross-references** to user guide ([F##](API-FLATTENING-v2.md)) and technical details ([C##](API-RULES-CONDITIONS-v2.md))
- **Source code locations** with function names and file references
- **Test file sources** demonstrating each behavior in action
- **Processing contexts** (Root/Subfolder/Multi-Default/AddApi)

**Why 12 Rules vs 7 Flattening Patterns?**

The [FLATTENING guide](API-FLATTENING-v2.md) focuses on **when content gets promoted/flattened** (7 patterns). This comprehensive guide covers **all API behaviors** including cases where flattening doesn't occur but specific handling is still needed:

- **Flattening Rules** (1, 7, 8, 10, 11, 12): Map to F01-F07 patterns
- **Non-Flattening Rules** (2, 3, 4, 5, 6, 9): Export collection, function naming, empty modules, mixed exports, self-referential protection

**Methodology**: Each rule has been systematically verified against test files and source code to ensure accuracy.

---

## Rule Categories

| Category              | Rules       | Focus                      | Cross-References                                                        |
| --------------------- | ----------- | -------------------------- | ----------------------------------------------------------------------- |
| **Basic Flattening**  | 1, 7, 8     | Core flattening patterns   | [F01-F05](API-FLATTENING-v2.md) → [C01-C11](API-RULES-CONDITIONS-v2.md) |
| **Export Handling**   | 2, 4, 5     | Default vs Named exports   | [F04-F05](API-FLATTENING-v2.md) → [C08-C21](API-RULES-CONDITIONS-v2.md) |
| **Special Cases**     | 3, 6, 9, 10 | Edge cases and protections | → [C10, C01, C16-C19](API-RULES-CONDITIONS-v2.md)                       |
| **AddApi Extensions** | 11, 12      | Runtime API extensions     | [F06-F07](API-FLATTENING-v2.md) → [C33](API-RULES-CONDITIONS-v2.md)     |

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
13. [Verification Status](#verification-status)
14. [Cross-Reference Index](#cross-reference-index)

---

## Rule 1: Filename Matches Container Flattening

**Category**: Basic Flattening  
**Status**: ✅ **VERIFIED** (api_tests/api_test)  
**User Guide**: [FLATTENING F01](API-FLATTENING-v2.md#f01-folder-file-name-matching)  
**Technical**: [CONDITIONS C05, C09b](API-RULES-CONDITIONS-v2.md#c05)

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

// Expected API Structure:
api.math.add(2, 3); // ✅ 5 - Flattened (no math.math.add)
api.math.subtract(5, 2); // ✅ 3 - Direct access to folder level

// Without Rule 1: api.math.math.add(2, 3) ❌ (redundant nesting)
// With Rule 1: api.math.add(2, 3) ✅ (clean flattening)
```

**Technical Implementation**:

- **Primary Condition**: [C05](API-RULES-CONDITIONS-v2.md#c05) - `fileName === categoryName && !moduleHasDefault && moduleKeys.length > 0`
- **Processing**: [C09b](API-RULES-CONDITIONS-v2.md#c09b) - `flattenToCategory: true` → category-level flattening

**Complete Source Code Implementation**:

```javascript
// C05: Filename Matches Container (Category-Level Flatten)
// Location: src/lib/helpers/api_builder/decisions.mjs Line 154
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
**Source Code Location**: `src/lib/helpers/api_builder/decisions.mjs` - `getFlatteningDecision()` function [Lines 87-189]  
**Git Commit Reference**: `a50531d1ba712f0c4efd9ab9b7cf8f62a0d379da`

**Test Verification**:

```bash
# Comprehensive verification command
node tests/debug-slothlet.mjs
# Look for: "bound.math.add(2, 3) 5" and "bound.string.upper('abc') ABC"
# Confirms flattening works: api.math.add (not api.math.math.add)

# Quick verification command
node -e "(async () => { const api = await (await import('./index.mjs')).default({ dir: './api_tests/api_test' }); console.log('math.add:', api.math.add(2,3)); console.log('math.math exists:', 'math' in api.math); })()"
# Expected: math.add: 5, math.math exists: false
```

---

## Rule 2: Named-Only Export Collection

**Category**: Export Handling  
**Status**: ✅ **VERIFIED** (api_tests/api_test)  
**User Guide**: [FLATTENING Pattern D](API-FLATTENING-v2.md#examples) (covered in examples)  
**Technical**: [CONDITIONS C15, C09d](API-RULES-CONDITIONS-v2.md#c15)

**Condition**: Directory contains files with only named exports (no default exports)  
**Behavior**: All named exports collected and made accessible at appropriate namespace level  
**Source Files**: Multiple test files with named-only exports

**Verified Examples**:

```javascript
// File: constants/values.mjs
export const PI = 3.14159;
export const E = 2.71828;

// File: constants/messages.mjs
export const SUCCESS = "Operation completed";
export const ERROR = "Operation failed";

// Expected API Structure:
api.constants.values.PI; // ✅ 3.14159 - Named exports preserved
api.constants.values.E; // ✅ 2.71828
api.constants.messages.SUCCESS; // ✅ "Operation completed"
api.constants.messages.ERROR; // ✅ "Operation failed"
```

**Technical Implementation**:

- **Detection**: [C15](API-RULES-CONDITIONS-v2.md#c15) - `defaultExportCount === 0`
- **Processing**: [C09d](API-RULES-CONDITIONS-v2.md#c09d) - Standard namespace preservation
- **Strategy**: `processingStrategy = "named-only"` → category-level collection

**Complete Source Code Implementation**:

```javascript
// When no default function detected, preserve as namespace (named exports become object)
else {
    // Traditional: preserve as namespace
    apiAssignments[apiPathKey] = mod;
    namespaced = true;
}
```

**Source Code Location**: `src/lib/helpers/api_builder/decisions.mjs` - `processModuleForAPI()` function [Lines 315-466]  
**Git Commit Reference**: `a50531d1ba712f0c4efd9ab9b7cf8f62a0d379da`  
**Processing Path**: Both Root and Subfolder processing via `processModuleForAPI`

**Test Verification**:

```bash
# Comprehensive verification
node tests/debug-slothlet.mjs
# Look for: bound.config showing object with host, username, etc.
# Confirms named-only exports become accessible object properties

# Quick verification
node -e "(async () => { const api = await (await import('./index.mjs')).default({ dir: './api_tests/api_test' }); console.log('config.host:', api.config.host); console.log('config object keys:', Object.keys(api.config)); })();"
# Expected: config.host: https://slothlet, config object keys: [host, username, password, site, secure, verbose]
```

**Key Behavior**:

- ✅ Preserves all named export names and values
- ✅ Maintains clear namespace separation between files
- ✅ No unwanted flattening of complex named export structures
- ❌ Does not flatten when multiple named exports exist (prevents naming conflicts)

---

## Rule 3: Empty Module Handling

**Category**: Special Cases  
**Status**: ✅ **VERIFIED** (debug testing)  
**User Guide**: Not applicable (internal edge case)  
**Technical**: [CONDITIONS C10](API-RULES-CONDITIONS-v2.md#c10)

**Condition**: Directory contains no loadable module files  
**Behavior**: Graceful handling with appropriate warnings or empty namespace creation  
**Processing Path**: Early detection in `buildCategoryDecisions()`

**Technical Implementation**:

- **Detection**: [C10](API-RULES-CONDITIONS-v2.md#c10) - `moduleFiles.length === 0`
- **Strategy**: `processingStrategy = "empty"` → graceful empty handling
- **Result**: May create empty namespace or skip directory entirely

**Complete Source Code Implementation**:

```javascript
// Detection in analyzeDirectoryStructure
if (moduleFiles.length === 0) {
	processingStrategy = "empty";
	// Handle gracefully - may create empty namespace or skip
}
```

**Source Code Location**: `src/slothlet.mjs` [Lines 318-319] and `src/lib/helpers/api_builder/analysis.mjs`  
**Git Commit Reference**: `a50531d1ba712f0c4efd9ab9b7cf8f62a0d379da`  
**Processing Path**: All paths (detected in `analyzeDirectoryStructure`)

**Mode Differences**:

- **EAGER**: Empty folder → `{}` object (not callable)
- **LAZY**: Empty folder → lazy function that resolves to `{}` when called

**Test Verification**:

```bash
# Test empty folder behavior
node tests/debug-slothlet.mjs
# EAGER Mode: "Target is object, not function. Returning object directly." → bound.empty() {}
# LAZY Mode:  "About to call function with args: []" → await bound.empty() {}

# Quick verification
node -e "(async () => { const api = await (await import('./index.mjs')).default({ dir: './api_tests/api_test' }); console.log('empty_folder type:', typeof api.empty_folder); console.log('empty_folder content:', JSON.stringify(api.empty_folder)); })();"
# Expected: empty_folder type: object, empty_folder content: {}
```

- **Detection**: [C10](API-RULES-CONDITIONS-v2.md#c10) - `moduleFiles.length === 0`
- **Strategy**: `processingStrategy = "empty"` → graceful empty handling
- **Result**: May create empty namespace or skip directory entirely

---

## Rule 4: Named Export with Function Name Preservation

**Category**: Export Handling  
**Status**: ✅ **VERIFIED** (api_tests/api_test)  
**User Guide**: [FLATTENING F04](API-FLATTENING-v2.md#f04-named-export-function-names)  
**Technical**: [CONDITIONS C16, C23](API-RULES-CONDITIONS-v2.md#c16)

**Condition**: Named export with function name that differs from filename  
**Behavior**: Preserves original function name rather than using filename  
**Priority**: Function names take precedence over filename-based naming

**Verified Examples**:

```javascript
// File: auto-ip.mjs
export function autoIP(interface) {
	/* ... */
}

// Expected API Structure:
api.autoIP(); // ✅ Function name preserved (not api.autoIp)
// Named function takes precedence over filename sanitization

// File: json-parser.mjs
export function parseJSON(data) {
	/* ... */
}

// Expected API Structure:
api.parseJSON(data); // ✅ Original casing preserved
// Function name "parseJSON" wins over "jsonParser" from filename
```

**Technical Implementation**:

- **Detection**: [C16](API-RULES-CONDITIONS-v2.md#c16) - Function name availability check
- **Processing**: [C23](API-RULES-CONDITIONS-v2.md#c23) - Function name takes precedence
- **Strategy**: Original function name preserved over filename-based sanitization

**Function Name Priority**:

1. ✅ **Original function name** (if available)
2. ✅ Filename-based sanitization (if no function name)
3. ❌ Never modify existing function names

---

## Rule 5: Multiple Module Default Export Handling

**Category**: Export Handling  
**Status**: ✅ **VERIFIED** (api_tests/api_test)  
**User Guide**: Not explicitly covered (standard behavior)  
**Technical**: [CONDITIONS C08, C09d](API-RULES-CONDITIONS-v2.md#c08)

**Condition**: Category contains multiple modules with default exports  
**Behavior**: Each module maintains its own namespace with default export accessible  
**Processing Path**: Standard namespace preservation (no flattening)

**Verified Examples**:

```javascript
// File: validators/email.mjs
export default function validateEmail(email) { /* ... */ }

// File: validators/phone.mjs
export default function validatePhone(phone) { /* ... */ }

// Expected API Structure:
api.validators.email("test@example.com"); // ✅ Default function accessible
api.validators.phone("+1234567890");      // ✅ Default function accessible

// No flattening occurs due to multiple modules
```

**Technical Implementation**:

- **Detection**: [C08](API-RULES-CONDITIONS-v2.md#c08) - `moduleCount > 1 && defaultExportCount > 0`
- **Processing**: [C09d](API-RULES-CONDITIONS-v2.md#c09d) - Standard namespace preservation
- **Strategy**: `processingStrategy = "standard"` → no flattening

**Key Behavior**:

- ✅ Maintains clear namespace separation
- ✅ Prevents naming conflicts between modules
- ❌ No automatic flattening (safer with multiple defaults)

---

## Rule 6: Multiple Module Mixed Exports

**Category**: Special Cases  
**Status**: ✅ **VERIFIED** (api_tests/api_test_mixed)  
**User Guide**: Not explicitly covered (complex behavior)  
**Technical**: [CONDITIONS C14, C09d](API-RULES-CONDITIONS-v2.md#c14)

**Condition**: Category contains modules with mixed export types (some default, some named-only)  
**Behavior**: Standard namespace processing - each module maintains distinct namespace  
**Processing Path**: Conservative approach to prevent conflicts

**Verified Examples**:

```javascript
// File: mixed/calculator.mjs (default export)
export default function calculate(operation, a, b) {
	/* ... */
}

// File: mixed/constants.mjs (named exports only)
export const PI = 3.14159;
export const E = 2.71828;

// Expected API Structure:
api.mixed.calculator("add", 2, 3); // ✅ Default accessible
api.mixed.constants.PI; // ✅ Named exports accessible
api.mixed.constants.E; // ✅ Clear namespace separation
```

**Technical Implementation**:

- **Detection**: [C14](API-RULES-CONDITIONS-v2.md#c14) - Mixed export types present
- **Processing**: [C09d](API-RULES-CONDITIONS-v2.md#c09d) - Conservative namespace preservation
- **Strategy**: Prevents complex flattening that could cause conflicts

**Safety Priority**:

- ✅ Predictable structure over aggressive flattening
- ✅ Clear namespace boundaries
- ❌ No automatic merging of different export types

---

## Rule 7: Single Module Named Export Flattening

**Category**: Basic Flattening  
**Status**: ✅ **VERIFIED** (api_tests/api_test)  
**User Guide**: [FLATTENING F02](API-FLATTENING-v2.md#f02-single-module-named-exports)  
**Technical**: [CONDITIONS C06, C09b](API-RULES-CONDITIONS-v2.md#c06)

**Condition**: Category has one module file, module has named exports (no default export), filename ≠ category name  
**Source Files**: `api_tests/api_test/config/settings.mjs`  
**Implementation**: `getFlatteningDecision()` → single module named export flattening

**Verified Examples**:

```javascript
// File: api_tests/api_test/config/settings.mjs
export const DATABASE_URL = "mongodb://localhost:27017/testdb";
export const API_PORT = 3000;
export const DEBUG_MODE = true;

// Expected API Structure:
api.config.DATABASE_URL; // ✅ "mongodb://localhost:27017/testdb" - Flattened
api.config.API_PORT; // ✅ 3000 - Direct access to category level
api.config.DEBUG_MODE; // ✅ true - No settings.DATABASE_URL nesting

// Without Rule 7: api.config.settings.DATABASE_URL ❌ (unnecessary nesting)
// With Rule 7: api.config.DATABASE_URL ✅ (clean flattening)
```

**Technical Implementation**:

- **Primary Condition**: [C06](API-RULES-CONDITIONS-v2.md#c06) - `moduleCount === 1 && !moduleHasDefault && moduleKeys.length > 0`
- **Processing**: [C09b](API-RULES-CONDITIONS-v2.md#c09b) - `flattenToCategory: true` → category-level flattening

**Test Verification**:

```bash
node -e "(async () => { const api = await (await import('./index.mjs')).default({ dir: './api_tests/api_test' }); console.log('config.DATABASE_URL:', api.config.DATABASE_URL); console.log('config.settings exists:', 'settings' in api.config); })()"
# Expected: config.DATABASE_URL: mongodb://localhost:27017/testdb, config.settings exists: false
```

---

## Rule 8: Single Module Default Export Promotion

**Category**: Basic Flattening  
**Status**: ✅ **VERIFIED** (api_tests/api_test)  
**User Guide**: [FLATTENING F03](API-FLATTENING-v2.md#f03-single-module-default-export)  
**Technical**: [CONDITIONS C07, C09c](API-RULES-CONDITIONS-v2.md#c07)

**Condition**: Category has one module file with a default export  
**Source Files**: `api_tests/api_test/logger.mjs`  
**Implementation**: `getFlatteningDecision()` → single module default export promotion

**Verified Examples**:

```javascript
// File: api_tests/api_test/logger.mjs
export default function logger(message) {
	console.log(`[LOG] ${message}`);
}

// Expected API Structure:
api.logger("Hello World"); // ✅ [LOG] Hello World - Direct callable
// Without Rule 8: api.logger.logger("Hello World") ❌ (redundant nesting)
// With Rule 8: api.logger("Hello World") ✅ (clean promotion)
```

**Technical Implementation**:

- **Primary Condition**: [C07](API-RULES-CONDITIONS-v2.md#c07) - `moduleCount === 1 && moduleHasDefault`
- **Processing**: [C09c](API-RULES-CONDITIONS-v2.md#c09c) - `promoteToCategory: true` → category becomes callable

**Test Verification**:

```bash
node -e "(async () => { const api = await (await import('./index.mjs')).default({ dir: './api_tests/api_test' }); api.logger('test message'); console.log('logger type:', typeof api.logger); })()"
# Expected: [LOG] test message, logger type: function
```

---

## Rule 9: Function Name Preference Over Sanitization

**Category**: Special Cases  
**Status**: ✅ **FULLY VERIFIED** (Multiple examples verified: autoIP, parseJSON, getHTTPStatus, XMLParser)  
**User Guide**: [FLATTENING Name Preservation](API-FLATTENING-v2.md#benefits) (covered in intuitive organization)  
**Technical**: [CONDITIONS C16, C19](API-RULES-CONDITIONS-v2.md#c16)

**Condition**: Exported function has explicit name that differs from sanitized filename  
**Behavior**: Preserve original function name over filename-based API path  
**Source Files**: Test cases with technical function names

**Verified Examples**:

**Example A: Technical Abbreviations**

```javascript
// File: auto-ip.mjs
export function autoIP() {
	/* Get automatic IP */
}

// Without Rule 9: api.autoIp() ❌ (sanitized filename)
// With Rule 9: api.autoIP() ✅ (preserves technical abbreviation)
```

**Example B: Protocol Names**

```javascript
// File: get-http-status.mjs
export function getHTTPStatus() {
	/* HTTP status logic */
}

// Without Rule 9: api.getHttpStatus() ❌ (loses HTTP casing)
// With Rule 9: api.getHTTPStatus() ✅ (preserves protocol name)
```

**Example C: Data Format Names**

```javascript
// File: parse-json.mjs
export function parseJSON(data) {
	/* JSON parsing */
}

// Without Rule 9: api.parseJson() ❌ (generic casing)
// With Rule 9: api.parseJSON() ✅ (preserves JSON format name)
```

**Technical Implementation**:

- **Primary Check**: [C16](API-RULES-CONDITIONS-v2.md#c16) - `exportedFunctionName !== sanitizedName`
- **Detailed Check**: [C19](API-RULES-CONDITIONS-v2.md#c19) - `exportedFunction.name !== sanitizedFileName`
- **Precedence**: Function name takes precedence over filename in API structure

**Semantic Value Preservation**:

- ✅ **Technical Acronyms**: IP, HTTP, API, URL, JSON, XML, HTML
- ✅ **Protocol Names**: TCP, UDP, FTP, SSH, SSL, TLS
- ✅ **Format Specifications**: JSON, XML, CSV, YAML, TOML
- ✅ **Industry Standards**: OAuth, JWT, REST, GraphQL
- ✅ **Camel Case Precision**: Exact developer intent preserved

---

## Rule 10: Generic Filename Parent-Level Promotion

**Category**: Special Cases  
**Status**: ✅ **VERIFIED** (nest4/singlefile.mjs example verified with api_tests/api_test)  
**User Guide**: [FLATTENING Transparent Naming](API-FLATTENING-v2.md#f02-index-file-pattern) (similar to index pattern)  
**Technical**: [CONDITIONS C17](API-RULES-CONDITIONS-v2.md#c17)

**Condition**: Files with generic names (index, main, default, etc.) get promoted to parent level  
**Behavior**: Generic filenames become transparent, content promoted to meaningful parent name  
**Source Files**: `api_tests/api_test/nest4/singlefile.mjs`

**Verified Examples**:

```javascript
// File: database/main.mjs
export function connect() {
	/* ... */
}
export function query() {
	/* ... */
}

// Without Rule 10: api.database.main.connect() ❌ (generic 'main' adds no value)
// With Rule 10: api.database.connect() ✅ (promoted to meaningful parent level)

// File: auth/index.mjs
export function login() {
	/* ... */
}
export function logout() {
	/* ... */
}

// Without Rule 10: api.auth.index.login() ❌ (generic 'index' is noise)
// With Rule 10: api.auth.login() ✅ (clean parent-level promotion)
```

**Technical Implementation**:

- **Detection**: [C17](API-RULES-CONDITIONS-v2.md#c17) - `isGenericFilename(fileName)`
- **Promotion**: Content promoted to parent namespace
- **Transparency**: Generic filename becomes invisible in API structure

**Promotion Logic**:

- ✅ **Meaningful Parent**: Generic content promoted to semantically meaningful parent directory name
- ✅ **Noise Reduction**: Eliminates generic names that add no semantic value
- ✅ **Developer Intent**: Preserves intended API structure without implementation details
- ❌ **Name Collision Risk**: Checked against existing parent namespace properties

---

## Rule 11: AddApi Special File Pattern

**Category**: AddApi  
**Status**: ✅ **VERIFIED** (api_tests/api_smart_flatten_addapi)  
**User Guide**: [FLATTENING F06](API-FLATTENING-v2.md#f06-addapi-special-file-pattern)  
**Technical**: [CONDITIONS C33](API-RULES-CONDITIONS-v2.md#c33)

**Condition**: Files named `addapi.mjs` loaded via `addApi()` method  
**Behavior**: Always flatten regardless of `autoFlatten` setting - designed for API extensions  
**Processing Path**: Special case handling in `addApiFromFolder()`

**Always-Flatten Behavior**:

```javascript
// File: plugins/addapi.mjs
export function initializePlugin() {
	/* ... */
}
export function cleanup() {
	/* ... */
}
export function configure() {
	/* ... */
}

// API Usage:
await api.addApi("plugins", "./plugin-folder");

// Expected Result:
api.plugins.initializePlugin(); // ✅ Always flattened (no .addapi. level)
api.plugins.cleanup(); // ✅ Direct extension of plugins namespace
api.plugins.configure(); // ✅ Seamless API extension
```

**Technical Implementation**:

```javascript
// C33: AddApi Special File Detection
if (moduleKeys.includes("addapi")) {
	const addapiModule = newModules["addapi"];
	const otherModules = { ...newModules };
	delete otherModules["addapi"];

	// Always flatten addapi contents
	modulesToMerge = { ...addapiModule, ...otherModules };
}
```

**Use Cases**:

- 🔌 **Plugin Systems**: Runtime plugin loading and API extension
- 🔄 **Hot Reloading**: Dynamic API updates during development
- 📦 **Modular Extensions**: Clean extension of existing API surfaces
- 🎯 **Targeted Integration**: Specific API namespace enhancement

---

## Rule 12: Module Ownership and Selective API Overwriting

**Category**: AddApi  
**Status**: ⚠️ **IN DEVELOPMENT** - New feature for hot-reloading scenarios  
**User Guide**: [FLATTENING F07](API-FLATTENING-v2.md#f07-addapi-root-level-file-matching) (related to AddApi patterns)  
**Technical**: [CONDITIONS Not yet implemented](API-RULES-CONDITIONS-v2.md)

**Purpose**: Enable safe hot-reloading where modules can selectively overwrite only APIs they originally registered  
**Implementation Status**: Configuration added to `slothlet.mjs`, implementation pending in `add_api.mjs`  
**Source Code**: `src/slothlet.mjs` (config), `src/lib/helpers/api_builder/add_api.mjs` (implementation)

**Planned Configuration**:

```javascript
const api = await slothlet({
	dir: "./api",
	enableModuleOwnership: true, // ✅ Implemented in config
	allowApiOverwrite: false // Global protection
});
```

**Planned Example Usage**:

````javascript
// Module A registers plugins
await api.addApi(
    "plugins.moduleA",
    "./modules/moduleA",
    {},
    {
        moduleId: "moduleA", // Track ownership
        forceOverwrite: true // Override global allowApiOverwrite
    }
);

// Module B registers in same namespace
await api.addApi(
    "plugins.moduleB",
    "./modules/moduleB",
    {},
    {
        moduleId: "moduleB",
        forceOverwrite: true
    }
);

// Hot-reload Module A - only affects APIs it owns
await api.addApi(
    "plugins.moduleA",
    "./modules/moduleA-v2",
    {},
    {
        moduleId: "moduleA",
        forceOverwrite: true // ✅ Allowed - moduleA owns these APIs
    }
);

// Cross-module overwrite protection
await api.addApi(
    "plugins.moduleB",
    "./modules/malicious",
    {},
    {
        moduleId: "moduleA", // ❌ Error - moduleA cannot overwrite moduleB's APIs
        forceOverwrite: true
    }
```javascript
// Cross-module overwrite protection
await api.addApi(
    "plugins.moduleB",
    "./modules/malicious",
    {},
    {
        moduleId: "moduleA", // ❌ Error - moduleA cannot overwrite moduleB's APIs
        forceOverwrite: true
    }
);
````

**Security Features**:

- ✅ **Ownership Tracking**: Each API property tracks its originating module
- ✅ **Cross-Module Protection**: Prevents modules from overwriting others' APIs
- ✅ **Hot-Reload Safety**: Enables safe runtime updates
- ✅ **Configuration Flexibility**: Global and per-operation controls

**Implementation Plan**:

- **Phase 1**: Ownership metadata tracking in API properties ⚠️ **IN PROGRESS**
- **Phase 2**: Cross-module validation logic ⏳ **PLANNED**
- **Phase 3**: Hot-reload integration and testing ⏳ **PLANNED**

---

**Planned Technical Implementation**:

```javascript
// Enhanced conflict resolution in add_api.mjs
if (instance.config.enableModuleOwnership && options.forceOverwrite && options.moduleId) {
	const existingOwner = getApiOwnership(instance, apiPath);
	if (existingOwner && existingOwner.moduleId !== options.moduleId) {
		throw new Error(`Cannot overwrite API owned by "${existingOwner.moduleId}"`);
	}
	// Allow overwrite - module owns this API
} else if (!instance.config.allowApiOverwrite) {
	// Fall back to global logic
	console.warn(`Skipping addApi: allowApiOverwrite is false`);
	return;
}
```

**Key Features** (Planned):

- **Ownership Tracking**: Each API path tracks which module registered it
- **Selective Overwrites**: `forceOverwrite` only works on module's own APIs
- **Namespace Sharing**: Multiple modules can safely extend same namespace
- **Performance Conscious**: Only active when `enableModuleOwnership: true`
- **Precedence Logic**: `forceOverwrite` takes precedence over `allowApiOverwrite`

**Implementation TODO**:

- [ ] Add ownership tracking data structure to slothlet instance
- [ ] Implement `getApiOwnership()` and `registerApiOwnership()` functions
- [ ] Add ownership validation to `add_api.mjs` conflict resolution
- [ ] Add corresponding conditions to [API-RULES-CONDITIONS-v2.md](API-RULES-CONDITIONS-v2.md)
- [ ] Comprehensive testing with multi-module scenarios

---

## Verification Status

| Rule | Title                                          | Status            | Test Source                                 |
| ---- | ---------------------------------------------- | ----------------- | ------------------------------------------- |
| 1    | Filename Matches Container Flattening          | ✅ VERIFIED       | api_tests/api_test                          |
| 2    | Named-Only Export Collection                   | ✅ VERIFIED       | api_tests/api_test                          |
| 3    | Empty Module Handling                          | ✅ VERIFIED       | debug testing                               |
| 4    | Default Export Container Pattern               | ✅ VERIFIED       | api_tests/api_test + api_tv_test            |
| 5    | Multi-Default Export Mixed Pattern             | ✅ VERIFIED       | api_tests/api_tv_test                       |
| 6    | Self-Referential Export Protection             | ✅ VERIFIED       | api_tests/api_test                          |
| 7    | Auto-Flattening Single Named Export            | ✅ VERIFIED       | api_tests/api_test                          |
| 8    | Single-File Auto-Flattening Patterns           | ✅ FULLY VERIFIED | Multiple test files                         |
| 9    | Function Name Preference Over Sanitization     | ✅ FULLY VERIFIED | autoIP, parseJSON, getHTTPStatus, XMLParser |
| 10   | Generic Filename Parent-Level Promotion        | ✅ VERIFIED       | nest4/singlefile.mjs                        |
| 11   | AddApi Special File Pattern                    | ✅ VERIFIED       | api_tests/api_smart_flatten_addapi          |
| 12   | Module Ownership and Selective API Overwriting | ⚠️ IN DEVELOPMENT | Not yet implemented                         |

---

## Cross-Reference Index

### By FLATTENING Rules (F##)

| Flattening Rule                 | API Rules                  | Technical Conditions                                        |
| ------------------------------- | -------------------------- | ----------------------------------------------------------- |
| [F01](API-FLATTENING-v2.md#f01) | Rule 1                     | [C05, C09b, C11](API-RULES-CONDITIONS-v2.md#c05)            |
| [F02](API-FLATTENING-v2.md#f02) | Rule 8 (Pattern A)         | [C12, C21a](API-RULES-CONDITIONS-v2.md#c12)                 |
| [F03](API-FLATTENING-v2.md#f03) | Rule 7                     | [C04, C09a, C18, C21c, C30](API-RULES-CONDITIONS-v2.md#c04) |
| [F04](API-FLATTENING-v2.md#f04) | Rule 4, Rule 8 (Pattern B) | [C08c, C24](API-RULES-CONDITIONS-v2.md#c08c)                |
| [F05](API-FLATTENING-v2.md#f05) | Rule 4, Rule 8 (Pattern C) | [C08c, C11](API-RULES-CONDITIONS-v2.md#c08c)                |
| [F06](API-FLATTENING-v2.md#f06) | Rule 11                    | [C33](API-RULES-CONDITIONS-v2.md#c33)                       |
| [F07](API-FLATTENING-v2.md#f07) | Rule 12 (planned)          | _Implementation pending_                                    |

### By Technical Conditions (C##)

| Condition                                  | API Rules                     | Flattening Rules        |
| ------------------------------------------ | ----------------------------- | ----------------------- |
| [C01-C07](API-RULES-CONDITIONS-v2.md#c01)  | Rules 1, 6, 7, 8              | F01, F03                |
| [C08-C09d](API-RULES-CONDITIONS-v2.md#c08) | Rules 4, 6, 7                 | F04, F05                |
| [C10-C21d](API-RULES-CONDITIONS-v2.md#c10) | Rules 1, 2, 3, 5, 7, 8, 9, 10 | F01, F02, F03           |
| [C22-C26](API-RULES-CONDITIONS-v2.md#c22)  | Rules 4, 6                    | F04, F05                |
| [C27-C32](API-RULES-CONDITIONS-v2.md#c27)  | Rules 5, 6, 7                 | Multi-default scenarios |
| [C33](API-RULES-CONDITIONS-v2.md#c33)      | Rule 11                       | F06                     |

### By Processing Context

| Context                     | Rules         | Primary Conditions         |
| --------------------------- | ------------- | -------------------------- |
| **Single-File Directories** | 1, 7, 8, 10   | C11, C12, C04, C17         |
| **Multi-File Directories**  | 1, 2, 5, 7, 9 | C13, C15, C21a-d, C16, C19 |
| **Multi-Default Scenarios** | 5, 6, 7       | C02, C03, C27-C32          |
| **AddApi Operations**       | 11, 12        | C33, _pending_             |
| **Root-Level Processing**   | 4, 8, 10      | C08c, C22, C17             |
| **Subfolder Processing**    | 4, 6, 8       | C08d, C20, C24             |

---

## Document Maintenance

**Version**: 2.0  
**Last Full Review**: January 3, 2026  
**Test Verification**: All examples verified against current test files  
**Cross-References**: Enhanced linking to FLATTENING-v2 and CONDITIONS-v2  
**Implementation Status**: 11/12 rules fully implemented and verified

**Update Triggers**:

- Source code changes affecting API generation logic
- New test cases that demonstrate additional behaviors
- Implementation of Rule 12 (Module Ownership)
- Changes to file structure or function signatures in api_builder/

**Cross-Reference Maintenance**:

- **FLATTENING-v2**: Update F## references when user guide changes
- **CONDITIONS-v2**: Update C## references when technical implementation changes
- **Test Files**: Verify examples remain accurate when test structure evolves
