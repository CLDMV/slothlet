# Slothlet API Building Rules - COMPLETE SYSTEM

This document defines **ALL** the rules used by slothlet to transform file structures into API objects. Slothlet has **multiple processing paths** with both **shared** and **unique** rules.

## Processing Path Architecture

Slothlet uses **3 different processing systems**:

1. **Root Level Processing** (in `slothlet_eager.mjs`/`slothlet_lazy.mjs`):
   - Uses: `processModuleForAPI()` + `getFlatteningDecision()`
   - Context: `currentDepth === 0` (root directory files)

2. **Subfolder Processing** (in `slothlet.mjs` `_buildCategory()`):
   - Uses: `buildCategoryDecisions()` or `buildCategoryStructure()`
   - Context: `currentDepth > 0` (subdirectory files)

3. **Multi-Default Processing** (in `multidefault.mjs`):
   - Uses: `multidefault_getFlatteningDecision()`
   - Context: When multiple files have default exports

## Complete Rule System

### Universal Rules (Used by All Processing Paths)

#### Rule U1: Self-Referential Preservation

**Paths**: Root, Subfolder, Multi-Default  
**Condition**: `isSelfReferential === true`  
**Action**: Always preserve as namespace, never flatten  
**Reason**: Avoid infinite recursion in self-referential exports

#### Rule U2a: Multi-Default WITH Default Preservation

**Paths**: Root, Subfolder, Multi-Default  
**Condition**: `hasMultipleDefaultExports && moduleHasDefault`  
**Action**: Preserve as namespace  
**Reason**: In multi-default contexts, preserve modules that have default exports

#### Rule U2b: Multi-Default WITHOUT Default Flattening

**Paths**: Root, Subfolder, Multi-Default  
**Condition**: `hasMultipleDefaultExports && !moduleHasDefault && hasNamedExports`  
**Action**: Flatten named exports to parent level  
**Reason**: In multi-default contexts, flatten modules without defaults

#### Rule U3: Auto-Flattening (Single Named Export Match)

**Paths**: Root, Subfolder, Multi-Default  
**Condition**: `namedExports.length === 1 && namedExports[0] === sanitizedFilename`  
**Action**: Use the named export contents directly  
**Reason**: Avoid double-nesting like `api.string.string.method()`

#### Rule U4: Single File Context Flattening

**Paths**: Root, Multi-Default  
**Condition**: `totalModules === 1 && !moduleHasDefault && hasNamedExports`  
**Action**: Flatten to root level  
**Reason**: Single files with only named exports don't need namespace wrapper

#### Rule U5: Default Preservation

**Paths**: Root, Subfolder, Multi-Default  
**Condition**: All other cases (fallback)  
**Action**: Preserve as namespace  
**Reason**: Traditional namespace preservation for complex exports

### Root-Specific Rules

#### Rule R1: Filename-Container Flattening

**Paths**: Root only  
**Condition**: `filename === containerName && !moduleHasDefault && hasNamedExports`  
**Action**: Flatten to container level  
**Reason**: Avoid redundant nesting when filename matches container

### Subfolder-Specific Rules (currentDepth > 0)

#### Rule S1: Function-Folder Match Flattening

**Condition**: `sanitizedFilename === folderName && typeof module === 'function' && currentDepth > 0`  
**Action**: Use function directly with folder name  
**Reason**: Avoid `api.math.math()` in favor of `api.math()`

#### Rule S2: Default Export Object Flattening

**Condition**: `hasDefaultExport && defaultType === 'object' && filename === folderName && currentDepth > 0`  
**Action**: Flatten default export contents  
**Reason**: Spread default object exports to avoid double-nesting

#### Rule S3: Filename-Folder Exact Match

**Condition**: `fileBasename === folderName && hasNamedExports && currentDepth > 0`  
**Action**: Flatten to avoid double-nesting  
**Reason**: Prevent `nest.nest.method` patterns

#### Rule S4: Parent-Level Generic Filename Flattening

**Condition**: `isGenericFilename && singleExport && currentDepth > 0`  
**Action**: Promote export to parent level  
**Reason**: Generic names like "index.mjs" or "main.mjs" add no semantic value

#### Rule S5: Function Name Matches Folder (Case-Insensitive)

**Condition**: `functionName.toLowerCase() === folderName.toLowerCase() && currentDepth > 0`  
**Action**: Flatten with original function name  
**Reason**: Preserve intended function capitalization

#### Rule S6: Function Name Preference

**Condition**: `functionName.toLowerCase() === filename.toLowerCase() && functionName !== sanitizedFilename`  
**Action**: Use original function name over sanitized filename  
**Reason**: Preserve meaningful capitalization (e.g., autoIP vs autoIp)

#### Rule S7: Default Function Export Flattening

**Condition**: `typeof module === 'function' && isDefaultExport && currentDepth > 0`  
**Action**: Use function directly with folder name  
**Reason**: Default functions should be directly callable

#### Rule S8: Category-Match Object Merging

**Condition**: `filename === categoryName && typeof module === 'object'`  
**Action**: Merge object contents with category  
**Reason**: Special category-level merging behavior

#### Rule S9: Multi-Default Filename Handling

**Condition**: `hasMultipleDefaultExports && moduleHasDefault && !isSelfReferential`  
**Action**: Use sanitized filename as API key  
**Reason**: In multi-default contexts, use consistent filename-based naming

#### Rule S10: Single Default Object Flattening (No Multi-Default)

**Condition**: `!hasMultipleDefaultExports && hasDefaultExport && defaultType === 'object'`  
**Action**: Flatten default object contents  
**Reason**: Single default objects should be flattened for simpler APIs

#### Rule S11: Preferred Export Names

**Condition**: Export function names match filename case-insensitively but have different capitalization  
**Action**: Use original export names over sanitized versions  
**Reason**: Preserve intended export name capitalization

## Rule Priority and Application Order

Rules are applied in **priority order** with **early returns**:

1. **Self-Referential** (highest priority - prevents infinite recursion)
2. **Multi-Default Rules** (context-specific behavior)
3. **Flattening Rules** (auto-flattening, container matching, etc.)
4. **Name Preference Rules** (function name preservation)
5. **Default Preservation** (fallback for all other cases)

Within each processing path, **currentDepth** determines which rule set applies:

- `currentDepth === 0`: Universal + Root rules only
- `currentDepth > 0`: Universal + Subfolder rules only

## Architecture Overview

Slothlet transforms a directory structure like this:

```text
api_test/
├── root-function.mjs          → api() (callable)
├── root-math.mjs             → api.rootMath
├── config.mjs                → api.config
├── math/
│   └── math.mjs             → api.math (auto-flattened)
├── nested/
│   └── date/
│       └── date.mjs         → api.nested.date (auto-flattened)
└── multi_func/
    ├── alpha.mjs            → api.multi_func.alpha
    ├── beta/
    │   └── hello.mjs        → api.multi_func.beta.hello
    └── unique-one.mjs       → api.multi_func.uniqueOne
```

Into an API structure like this:

```javascript
api(); // calls root-function.mjs default export
api.rootMath.add(2, 3);
api.config.host;
api.math.add(2, 3); // auto-flattened from math/math.mjs
api.nested.date.today(); // auto-flattened from nested/date/date.mjs
api.multi_func.alpha("test");
api.multi_func.beta.hello();
api.multi_func.uniqueOne("test");
```

## Processing Rules by Type

### Universal Rules (Apply to All Contexts)

#### Rule 1: Root Default Export Resolution

**Condition**: `moduleExports.default && Object.keys(moduleExports).length === 1 && !Array.isArray(moduleExports.default)`

**Description**: When a module exports only a default export (no named exports), that default becomes the identity of the folder.

**Real Example**:

```javascript
// root-function.mjs - only default export
export default function (name) {
	return `Hello, ${name}!`;
}

// Result: api() becomes callable
api("World"); // → "Hello, World!"
```

---

#### Rule 2: Hybrid Export Handling

**Condition**: `moduleExports.default && Object.keys(moduleExports).length > 1`

**Description**: When a module has both default and named exports, the default becomes callable and named exports become methods.

**Real Example**:

```javascript
// root-function.mjs with both exports
export default function (name) {
	return `Hello, ${name}!`;
}
export function rootFunctionShout(name) {
	return `HELLO, ${name.toUpperCase()}!`;
}
export function rootFunctionWhisper(name) {
	return `hello, ${name.toLowerCase()}.`;
}

// Result: callable API with methods
api("World"); // → "Hello, World!"
api.rootFunctionShout("World"); // → "HELLO, WORLD!"
api.rootFunctionWhisper("World"); // → "hello, world."
```

---

#### Rule 3: Object Export Preservation

**Condition**: `typeof moduleExports.default === "object" && moduleExports.default !== null`

**Description**: Object exports are preserved as-is without flattening.

**Real Example**:

```javascript
// math.mjs - object export
export default {
	add: (a, b) => a + b,
	multiply: (a, b) => a * b
};

// Result: preserved object structure
api.math.add(2, 3); // → 5
api.math.multiply(2, 3); // → 6
```

---

#### Rule 4: Named-Only Export Collection

**Condition**: `!moduleExports.default && Object.keys(moduleExports).length > 0`

**Description**: Modules with only named exports get collected into an object.

**Real Example**:

```javascript
// config.mjs - only named exports
export const host = "https://slothlet";
export const username = "admin";
export const password = "password";

// Result: collected into object
api.config.host; // → "https://slothlet"
api.config.username; // → "admin"
api.config.password; // → "password"
```

---

#### Rule 5: Empty Module Handling

**Condition**: `!moduleExports.default && Object.keys(moduleExports).length === 0`

**Description**: Empty modules create empty objects.

**Real Example**:

```javascript
// empty.mjs - no exports
// (empty file or no exports)

// Result: empty object
api.empty; // → {}
```

---

#### Rule 6: Multi-Default Object/Function Detection

**Condition**: `hasMultiple && Boolean(moduleExports.default?.__slothletDefault)`

**Description**: In folders with multiple files, functions OR objects marked with `__slothletDefault` become directly callable while retaining their methods/properties. Additionally, files without default exports get their named exports flattened to the folder level.

**Real Example**:

```javascript
// multi_defaults/key.mjs (function case)
const key = function (keyName) {
	return `Sent key: ${keyName}`;
};
key.press = (keyName) => `Key pressed: ${keyName}`;
key.__slothletDefault = true; // Special marker

export default key;

// Result: callable function with methods preserved
api.multi_defaults.key("ENTER"); // → "Sent key: ENTER"
api.multi_defaults.key.press("ESC"); // → "Key pressed: ESC"

// Objects can also have __slothletDefault: true
// and become the callable identity while preserving their structure

// Files without default exports in multi-default folders get flattened:
// api_tv_test/app.mjs - NO default export, only named exports
export async function setApp(appName) {
	/* ... */
}
export function getCurrentApp() {
	/* ... */
}

// Result: flattened to parent level (no api.app namespace)
api.setApp("Netflix"); // → directly accessible (not api.app.setApp)
api.getCurrentApp(); // → directly accessible
```

---

#### Rule 7: Multi-Default Flattening Rule

**Condition**: `hasMultipleDefaultExports && !moduleExports.default && Object.keys(moduleExports).length > 0`

**Description**: In multi-default contexts, modules WITHOUT default exports get their named exports flattened to the parent level.

**Real Example**:

```javascript
// api_tv_test folder has multiple files with defaults:
// power.mjs, volume.mjs, input.mjs, key.mjs (all have export default)
// BUT app.mjs has ONLY named exports:

// app.mjs - NO default export
export async function setApp(appName) {
	/* ... */
}
export function getCurrentApp() {
	/* ... */
}
export function getAllApps() {
	/* ... */
}

// Result: flattened to root level (bypasses api.app namespace)
api.setApp("Netflix"); // → directly accessible
api.getCurrentApp(); // → directly accessible
api.getAllApps(); // → directly accessible

// While files WITH defaults keep their namespace:
api.power(); // → calls power.mjs default
api.volume(); // → calls volume.mjs default
```

---

#### Rule 8: Function Name Preservation

**Condition**: Function export name differs from sanitized filename but matches case-insensitively

**Description**: Preserves original function capitalization over filename-based sanitization.

**Real Example**:

```javascript
// File: task/auto-ip.mjs → sanitized: "autoIp"
export async function autoIP() {
	return "testAutoIP";
}

// Result: preserves "autoIP" over "autoIp"
api.task.autoIP(); // → "testAutoIP" (preserves IP capitalization)
```

---

### Subfolder-Only Rules (currentDepth > 0)

#### Rule 9: Auto-Flattening (Single Named Export Matching Filename)

**Condition**: `moduleKeys.length === 1 && moduleKeys[0] === apiPathKey`

**Description**: When a module has exactly one named export that matches the sanitized filename, auto-flatten by promoting the export contents directly.

**Real Example**:

```javascript
// string/string.mjs - single named export matches filename
export const string = {
	shout: (text) => text.toUpperCase() + "!",
	whisper: (text) => text.toLowerCase()
};

// Result: auto-flattened (api.string.string → api.string)
api.string.shout("hello"); // → "HELLO!" (not api.string.string.shout)
api.string.whisper("WORLD"); // → "world" (not api.string.string.whisper)
```

---

#### Rule 10: Filename Matches Container Flattening

**Condition**: `categoryName && fileName === categoryName && !moduleHasDefault && moduleKeys.length > 0`

**Description**: When filename matches the containing folder name AND the file has no default export AND has named exports, flatten to container level.

**Real Example**:

```javascript
// util/util.mjs - filename matches folder name
export function parseJSON(str) {
	return JSON.parse(str);
}
export function stringifyJSON(obj) {
	return JSON.stringify(obj);
}

// Result: flattened to container level (util.util → util)
api.util.parseJSON('{"test": true}'); // → {test: true} (not api.util.util.parseJSON)
api.util.stringifyJSON({ test: true }); // → '{"test":true}' (not api.util.util.stringifyJSON)
```

---

#### Rule 11: Single File Context Flattening

**Condition**: `totalModules === 1 && !moduleHasDefault && moduleKeys.length > 0`

**Description**: When a folder contains only one file AND that file has no default export AND has named exports, flatten to root level.

**Real Example**:

```javascript
// funcmod/funcmod.mjs - single file in folder with only named exports
// BUT this example actually has a default export, so different behavior

// Better example would be a folder with single file having only named exports
// hypothetical: singlefolder/onlyfile.mjs with only named exports
export function method1() {
	return "method1";
}
export function method2() {
	return "method2";
}

// Result: flattened to root level
api.method1(); // → "method1" (not api.singlefolder.method1)
api.method2(); // → "method2" (not api.singlefolder.method2)
```

---

#### Rule 12: Multi-File Folder Processing - Mixed Patterns

**Condition**: `hasMultiple && currentDepth > 0`

**Description**: Folders with multiple files apply different rules based on each file's export pattern.

**Real Example from api_tv_test**:

```javascript
// api_tv_test/ folder demonstrates both patterns:

// 1. Files with ONLY named exports → FLATTENED (Rule 7)
// app.mjs - no default export
export async function setApp(appName) { /* ... */ }
export function getCurrentApp() { /* ... */ }
export function getAllApps() { /* ... */ }

// 2. Files with default + named exports → NAMESPACE PRESERVED (Rule 6)
// power.mjs - has default export
export async function on() { /* ... */ }
export async function off() { /* ... */ }
export default toggle;

// volume.mjs - has default export
export async function up() { /* ... */ }
export async function down() { /* ... */ }
export default set;

// Result: mixed API structure
// Flattened (from app.mjs):
api.setApp("Netflix")        // → from app.mjs (no namespace)
api.getCurrentApp()          // → from app.mjs (no namespace)
api.getAllApps()            // → from app.mjs (no namespace)

// Namespace preserved (from power.mjs, volume.mjs):
api.power()                  // → calls toggle (default)
api.power.on()              // → named export
api.volume()                // → calls set (default)
api.volume.up()             // → named export
```

---

#### Rule 13: Nested Multi-File Folders

**Condition**: `hasMultiple && currentDepth > 0` with nested structure

**Description**: Multi-file processing works recursively through nested folders.

**Real Example**:

```javascript
// util/ folder with nested structure:
// ├── controller/
// │   ├── get-default.mjs     → api.util.controller.getDefault
// │   ├── detect-endpoint-type.mjs → api.util.controller.detectEndpointType
// │   └── detect-device-type.mjs → api.util.controller.detectDeviceType
// ├── extract/
// │   ├── data.mjs            → api.util.extract.data
// │   ├── section.mjs         → api.util.extract.section
// │   └── nvr-section.mjs     → api.util.extract.NVRSection
// └── url/
//     ├── build-url-with-params.mjs → api.util.url.buildUrlWithParams
//     └── clean-endpoint.mjs        → api.util.url.cleanEndpoint

// Result: deeply nested namespaces
api.util.controller.getDefault();
api.util.extract.data();
api.util.url.buildUrlWithParams("10.0.0.1", { "foo": "bar" });
```

---

#### Rule 14: Default + Named Export Merging in Subfolders

**Condition**: `moduleExports.default && Object.keys(moduleExports).length > 1 && currentDepth > 0`

**Description**: In subfolders, default exports become callable while named exports become methods.

**Real Example**:

```javascript
// exportDefault/export-default.mjs
export default function () {
	return "exportDefault default";
}
export function extra() {
	return "extra method overridden";
}

// Result: callable with methods
api.exportDefault(); // → "exportDefault default"
api.exportDefault.extra(); // → "extra method overridden"
```

---

#### Rule 15: Deep Nesting with Mixed Patterns

**Condition**: Complex nested folders with different export patterns

**Description**: Rules apply recursively, creating complex nested structures.

**Real Example**:

```javascript
// advanced/ folder structure:
// ├── nest/
// │   └── alpha.mjs           → api.advanced.nest.alpha
// ├── nest2/
// │   ├── alpha/
// │   │   └── hello.mjs       → api.advanced.nest2.alpha.hello
// │   └── beta/
// │       └── world.mjs       → api.advanced.nest2.beta.world
// ├── nest3.mjs               → api.advanced.nest3 (single file)
// └── nest4/
//     └── beta.mjs            → api.advanced.nest4.beta

// Result: mixed nesting patterns
api.advanced.nest.alpha("slothlet"); // → "alpha: slothlet"
api.advanced.nest2.alpha.hello(); // → "alpha hello"
api.advanced.nest2.beta.world(); // → "beta world"
api.advanced.nest3("slothlet"); // → "Hello, slothlet!"
api.advanced.nest4.beta("singlefile"); // → "Hello, singlefile!"
```

---

#### Rule 16: ObjectDefaultMethod Pattern

**Condition**: `typeof moduleExports.default === "function" && currentDepth > 0` with additional methods

**Description**: Function exports with attached methods become callable objects.

**Real Example**:

```javascript
// objectDefaultMethod/object-default-method.mjs
const logger = function (msg) {
	return `INFO: ${msg}`;
};
logger.info = (msg) => `INFO: ${msg}`;
logger.warn = (msg) => `WARN: ${msg}`;
logger.error = (msg) => `ERROR: ${msg}`;

export default logger;

// Result: callable function with methods
api.objectDefaultMethod("Hello World"); // → "INFO: Hello World"
api.objectDefaultMethod.info("Test"); // → "INFO: Test"
api.objectDefaultMethod.warn("Test"); // → "WARN: Test"
api.objectDefaultMethod.error("Test"); // → "ERROR: Test"
```

---

### Root-Only Rules (currentDepth === 0)

#### Rule 17: Root Contributor Pattern

**Condition**: `currentDepth === 0 && (moduleExports.default || Object.keys(moduleExports).length > 0)`

**Description**: Root files contribute directly to the main API object, not to nested namespaces.

**Real Example**:

```javascript
// root-function.mjs (at root level)
export default function (name) {
	return `Hello, ${name}!`;
}
export function rootFunctionShout(name) {
	return `HELLO, ${name.toUpperCase()}!`;
}
export function rootFunctionWhisper(name) {
	return `hello, ${name.toLowerCase()}.`;
}

// root-math.mjs (at root level)
export const rootMath = {
	add: (a, b) => a + b,
	multiply: (a, b) => a * b
};

// Result: contribute to root API
api("World"); // → from root-function.mjs default
api.rootFunctionShout("World"); // → from root-function.mjs named export
api.rootMath.add(2, 3); // → from root-math.mjs named export
```

---

#### Rule 18: Root Reference Merging

**Condition**: `currentDepth === 0` with reference objects

**Description**: Root-level reference objects get merged into the API.

**Real Example**:

```javascript
// Reference objects at root level (e.g., md5 function)
// These get merged into the root API namespace

// Result: available at root level
api.md5; // → reference function available directly on API
```

---

## File Name Sanitization

Slothlet converts filenames to valid JavaScript property names:

### Sanitization Examples

| Filename                    | API Property                | Rule Applied               |
| --------------------------- | --------------------------- | -------------------------- |
| `root-function.mjs`         | `rootFunction`              | Dash to camelCase          |
| `auto-ip.mjs`               | `autoIp` → `autoIP`         | Function name preservation |
| `unique-one.mjs`            | `uniqueOne`                 | Dash to camelCase          |
| `math.mjs`                  | `math`                      | Already valid              |
| `nvr-section.mjs`           | `nvrSection` → `NVRSection` | Function name preservation |
| `get-default.mjs`           | `getDefault`                | Dash to camelCase          |
| `build-url-with-params.mjs` | `buildUrlWithParams`        | Multiple dash conversion   |

### Function Name Preference

When a function's name differs from the sanitized filename but matches case-insensitively, slothlet preserves the function's original capitalization:

```javascript
// File: auto-ip.mjs, Function: autoIP
// Sanitized: "autoIp" vs Function: "autoIP"
// Result: api.task.autoIP (preserves IP capitalization)

// File: nvr-section.mjs, Function: NVRSection
// Sanitized: "nvrSection" vs Function: "NVRSection"
// Result: api.util.extract.NVRSection (preserves NVR capitalization)
```

## Critical Multi-File Pattern: Named-Only vs Default+Named

The **api_tv_test** folder demonstrates the most important multi-file behavior that distinguishes slothlet from simple module loaders:

### File Structure and Export Patterns

```text
api_tv_test/
├── app.mjs           → NAMED-ONLY exports (Rule 6: FLATTENED)
├── power.mjs         → DEFAULT + named exports (Rule 7: NAMESPACE PRESERVED)
├── volume.mjs        → DEFAULT + named exports (Rule 7: NAMESPACE PRESERVED)
├── config.mjs        → DEFAULT + named exports (Rule 7: NAMESPACE PRESERVED)
├── connection.mjs    → NAMED-ONLY exports (Rule 6: FLATTENED)
└── manufacturer/
    └── lg/
        ├── connect.mjs    → DEFAULT + named exports (Rule 7: NAMESPACE PRESERVED)
        ├── disconnect.mjs → DEFAULT + named exports (Rule 7: NAMESPACE PRESERVED)
        └── ...
```

### Resulting API Structure

```javascript
// FLATTENED functions (from files with ONLY named exports)
api.setApp("Netflix"); // ← from app.mjs (NO api.app namespace)
api.getCurrentApp(); // ← from app.mjs
api.getAllApps(); // ← from app.mjs
api.connect(); // ← from connection.mjs (NO api.connection namespace)
api.disconnect(); // ← from connection.mjs

// NAMESPACE PRESERVED (from files with default + named exports)
api.power(); // ← calls power.mjs default export (toggle)
api.power.on(); // ← from power.mjs named export
api.power.off(); // ← from power.mjs named export
api.power.getState(); // ← from power.mjs named export

api.volume(); // ← calls volume.mjs default export (set)
api.volume.up(); // ← from volume.mjs named export
api.volume.down(); // ← from volume.mjs named export
api.volume.mute(); // ← from volume.mjs named export

// Nested namespaces work the same way
api.manufacturer.lg.connect(); // ← calls connect.mjs default
api.manufacturer.lg.connect.disconnect(); // ← connect.mjs named export
api.manufacturer.lg.disconnect(); // ← calls disconnect.mjs default
api.manufacturer.lg.disconnect.forceDisconnect(); // ← disconnect.mjs named export
```

### The Rule: Default Export as Namespace Gatekeeper

**Key Insight**: The presence or absence of a **default export** determines whether a file keeps its namespace in multi-file folders:

- ✅ **Has default export** → File gets its own namespace + default becomes callable
- ❌ **No default export** → File's named exports get flattened to parent level

This creates a powerful API design pattern where:

- **Core functionality** (files with defaults) gets organized namespaces
- **Utility functions** (named-only files) become convenient top-level functions

## Architecture Issue: Processing Inconsistency

**Current Problem**: Slothlet uses **two different processing approaches** for the same behavior:

### Root Processing (currentDepth === 0)

- **Location**: `src/lib/modes/slothlet_lazy.mjs` and `slothlet_eager.mjs`
- **Method**: Hard-coded if-statements in `processModuleForAPI()` + `getFlatteningDecision()`
- **Code**: ~100 lines of duplicate logic per mode file

### Subfolder Processing (currentDepth > 0)

- **Location**: `src/slothlet.mjs`
- **Method**: Decision objects via `buildCategoryDecisions()`
- **Code**: Clean, reusable decision system

**Impact**: The same logical rules (especially Rules 1-7) are implemented twice using different code patterns, creating maintenance burden and architectural inconsistency.

**Solution**: Unify both approaches using a single decision system that handles both root and subfolder contexts via the `currentDepth` parameter.

## Summary

These 17 rules define how slothlet transforms any file structure into a cohesive API. The rules work together to:

1. **Preserve intuitive access patterns** (folders become namespaces)
2. **Handle complex export scenarios** (default + named, multi-file folders)
3. **Maintain function identity** (auto-flattening, name preservation)
4. **Support deep nesting** (recursive rule application)
5. **Enable root contributions** (files that enhance the main API)

Understanding these rules is essential for predicting how any file structure will be transformed into the final slothlet API.
