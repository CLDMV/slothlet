# Slothlet API Rules

**Complete Guide to All API Generation Behaviors**

---

## Document Hierarchy

This is the **middle layer** of slothlet's three-tier documentation system:

```text
📋 API-RULES/API-FLATTENING.md (F##)     ← User Guide: Clear examples and flowcharts
          ↑ links to                          ↓ links to
📊 API-RULES.md (Rules 1-21)             ← YOU ARE HERE: Complete behavior catalog
          ↑ links to                          ↓ links to
🔧 Condition series (per family)         ← Technical: Exact source code locations
   • API-RULES/API-RULES-CONDITIONS.md   (C## — flattening/placement)
   • API-RULES/API-DISCOVERY-CONDITIONS.md   (G## — discovery/inclusion)
   • API-RULES/API-NAMING-CONDITIONS.md      (N## — leaf-name derivation)
   • API-RULES/API-COLLISION-CONDITIONS.md   (O## — collision/ownership)
   • API-RULES/API-MUTATION-CONDITIONS.md    (M## — add/remove/reload)
   • API-RULES/API-VERSIONING-CONDITIONS.md  (V## — versioned mounts)
   • API-RULES/API-ROUTINE-CONDITIONS.md     (T## — routines/cascades)
   • API-RULES/API-BUILTIN-CONDITIONS.md     (B## — reserved keys/built-ins)
                                              ↓ mapped in
🗺️ API-RULES/API-RULE-MAPPING.md         ← Traceability Matrix: Rule # ↔ F## ↔ C##/G##/…
```

**Cross-Reference Navigation:**

- **For Users**: See [API-RULES/API-FLATTENING.md](API-RULES/API-FLATTENING.md) for user-friendly explanations with examples
- **For Developers**: See [API-RULES/API-RULES-CONDITIONS.md](API-RULES/API-RULES-CONDITIONS.md) for exact source code locations
- **Rule Mapping**: See [API-RULES/API-RULE-MAPPING.md](API-RULES/API-RULE-MAPPING.md) for complete Rule # ↔ F## ↔ C## traceability matrix

---

## Overview

This document catalogs **all 21 API generation behaviors** in slothlet with:

- Verified examples from actual test files with source attribution
- Cross-references to user guide (F##) and technical details (per-family condition series)
- Source code locations with function names and file references
- Test file sources demonstrating each behavior in action
- Processing contexts (Discovery/Naming/Root/Subfolder/Multi-Default/Collision/Mutation/Versioning/Routines/AddApi)

**Why 21 Rules vs Flattening Patterns?**

The [Flattening guide](API-RULES/API-FLATTENING.md) focuses on **when content gets promoted/flattened**. This comprehensive guide covers **every api-generation behavior** — how files become leaves, how they are named, how they flatten, how collisions resolve, and how the tree is mutated, versioned, and extended at runtime:

- **Flattening / Placement** (1, 7, 8, 10, 11, 13): core flattening patterns (conditions `C##`)
- **Non-Flattening Placement** (2, 3, 4, 5, 6, 9): export collection, function naming, empty modules, mixed exports
- **Discovery & Inclusion** (14, 15): which files/folders/packages become leaves (`G##`)
- **Naming** (16): leaf-name derivation / sanitization (`N##`)
- **Collision & Ownership** (12, 17): which value wins, ownership stack (`O##`)
- **Mutation** (18): runtime add/remove/reload placement (`M##`)
- **Versioning** (19): versioned mounts (`V##`)
- **Routines** (20): stackable routines & cascades (`T##`)
- **Reserved / Built-in** (21): reserved keys & the `slothlet.*` surface (`B##`)

**Methodology**: Each rule has been systematically verified against test files and source code.

---

## Rule Categories

| Category                | Rules       | Focus                       | Cross-References                                                                       |
| ----------------------- | ----------- | --------------------------- | -------------------------------------------------------------------------------------- |
| **Basic Flattening**    | 1, 7, 8     | Core flattening patterns    | [F01-F05](API-RULES/API-FLATTENING.md) → [C01-C11](API-RULES/API-RULES-CONDITIONS.md)  |
| **Export Handling**     | 2, 4, 5     | Default vs Named exports    | [F04-F05](API-RULES/API-FLATTENING.md) → [C08-C18](API-RULES/API-RULES-CONDITIONS.md)  |
| **Special Cases**       | 3, 6, 9, 10 | Edge cases and protections  | [C01, C09a, C14-C16](API-RULES/API-RULES-CONDITIONS.md)                                |
| **AddApi Extensions**   | 11, 12, 13  | Runtime API extensions      | [F06-F08](API-RULES/API-FLATTENING.md) → [C24, C25](API-RULES/API-RULES-CONDITIONS.md) |
| **Discovery**           | 14, 15      | File/package → leaf gating  | [G01-G14](API-RULES/API-DISCOVERY-CONDITIONS.md)                                       |
| **Naming**              | 16          | Leaf-name derivation        | [N01-N08](API-RULES/API-NAMING-CONDITIONS.md)                                          |
| **Collision/Ownership** | 12, 17      | Which value wins; ownership | [O01-O15](API-RULES/API-COLLISION-CONDITIONS.md)                                       |
| **Mutation**            | 18          | Runtime add/remove/reload   | [M01-M09](API-RULES/API-MUTATION-CONDITIONS.md)                                        |
| **Versioning**          | 19          | Versioned mounts            | [V01-V08](API-RULES/API-VERSIONING-CONDITIONS.md)                                      |
| **Routines**            | 20          | Stackable routines/cascades | [T01-T10](API-RULES/API-ROUTINE-CONDITIONS.md)                                         |
| **Built-in**            | 21          | Reserved keys/`slothlet.*`  | [B01-B04](API-RULES/API-BUILTIN-CONDITIONS.md)                                         |

---

## Table of Contents

1. [Rule 1: Filename Matches Container Flattening](#rule-1-filename-matches-container-flattening)
2. [Rule 2: Single Function File Promotion](#rule-2-single-function-file-promotion)
3. [Rule 3: No Empty Leaves](#rule-3-no-empty-leaves)
4. [Rule 4: Default Export Promotion](#rule-4-default-export-promotion)
5. [Rule 5: Multiple Module Default Export Handling](#rule-5-multiple-module-default-export-handling)
6. [Rule 6: Self-Referential / Circular Reference Prevention](#rule-6-self-referential--circular-reference-prevention)
7. [Rule 7: Auto-Flattening – Single Named Export](#rule-7-auto-flattening--single-named-export)
8. [Rule 8: Object / Namespace Default Flattening](#rule-8-object--namespace-default-flattening)
9. [Rule 9: Function Name Preference](#rule-9-function-name-preference)
10. [Rule 10: Generic Filename Parent-Level Promotion](#rule-10-generic-filename-parent-level-promotion)
11. [Rule 11: AddApi Special File Pattern](#rule-11-addapi-special-file-pattern)
12. [Rule 12: Module Ownership and Selective API Overwriting](#rule-12-module-ownership-and-selective-api-overwriting)
13. [Rule 13: AddApi Path Deduplication Flattening](#rule-13-addapi-path-deduplication-flattening)
14. [Rule 14: API Directory Scan & Inclusion](#rule-14-api-directory-scan--inclusion)
15. [Rule 15: External Module Discovery](#rule-15-external-module-discovery)
16. [Rule 16: Leaf Name Derivation (Sanitization)](#rule-16-leaf-name-derivation-sanitization)
17. [Rule 17: Collision Resolution](#rule-17-collision-resolution)
18. [Rule 18: Dynamic API Mutation](#rule-18-dynamic-api-mutation)
19. [Rule 19: Versioned Mounts](#rule-19-versioned-mounts)
20. [Rule 20: Stackable Routines & Cascades](#rule-20-stackable-routines--cascades)
21. [Rule 21: Reserved Keys & Built-in Surface](#rule-21-reserved-keys--built-in-surface)
22. [Verification Status](#verification-status)
23. [Cross-Reference Index](#cross-reference-index)

---

## Rule 1: Filename Matches Container Flattening

**Category**: Basic Flattening
**Status**: ✅ Verified (`api_tests/api_test`)
**User Guide**: [F01](API-RULES/API-FLATTENING.md#f01-folder-file-name-matching)
**Technical**: [C05, C09, C09b, C13](API-RULES/API-RULES-CONDITIONS.md#c05)

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
api.math.add(2, 3); // 5
api.math.subtract(5, 2); // 3
```

**Technical Implementation**:

- **Primary Condition**: [C05](API-RULES/API-RULES-CONDITIONS.md#c05) - `fileName === categoryName && !moduleHasDefault && moduleKeys.length > 0`
- **Processing**: [C09b](API-RULES/API-RULES-CONDITIONS.md#c09b) - `flattenToCategory: true` → category-level flattening

```javascript
// C05: Filename Matches Container (Category-Level Flatten)
// Location: src/lib/processors/flatten.mjs
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
**Source Code Location**: `src/lib/processors/flatten.mjs` - `getFlatteningDecision()`

---

## Rule 2: Single Function File Promotion

**Category**: Export Handling
**Status**: ✅ Verified (`api_tests/api_test`)
**User Guide**: [F01](API-RULES/API-FLATTENING.md#f01)
**Technical**: [C07, C10, C13, C20, C21](API-RULES/API-RULES-CONDITIONS.md#c10)

**Condition**: A folder contains a single file whose exported function matches the folder/flatten anchor. When no single-function match applies, the default fallback (C07) preserves each file as its own namespace.
**Behavior**: The matching single-function file's export is promoted to the folder level; otherwise namespaces are preserved.

**Verified Examples**:

```javascript
// Promotion (C10 / C13): tools/tools.mjs exports one function named `tools`
api.tools("x"); // ✅ promoted to the folder level (no api.tools.tools nesting)

// Fallback (C07): constants/values.mjs + constants/messages.mjs (multi-file, named-only)
api.constants.values.PI; // ✅ each file preserved as its own namespace
api.constants.messages.SUCCESS; // ✅ clear namespace separation
```

**Technical Implementation**:

- **Promotion**: [C10](API-RULES/API-RULES-CONDITIONS.md#c10) - single-file function whose name matches the folder
- **Exact match**: [C13](API-RULES/API-RULES-CONDITIONS.md#c13) - filename/folder exact-match flattening
- **Fallback**: [C07](API-RULES/API-RULES-CONDITIONS.md#c07) - default fallback, preserve as namespace

**Source Code Location**: `src/lib/processors/flatten.mjs` - `getFlatteningDecision()` / `processModuleForAPI()`

---

## Rule 3: No Empty Leaves

**Category**: Special Cases
**Status**: ✅ Verified
**Conditions**: [G06](API-RULES/API-DISCOVERY-CONDITIONS.md#g06-empty-container-produces-no-leaf) (empty folder) · [M04](API-RULES/API-MUTATION-CONDITIONS.md#m04-deletepath-prunes-empty-ancestor-containers) / [M05](API-RULES/API-MUTATION-CONDITIONS.md#m05-empty-add-is-a-no-op) (empty add + empty-ancestor prune) · empty-value leaf placement (`modes-processor.mjs`)

**Purpose**: An empty structure never produces a leaf. This is a cross-cutting rule realized at three layers, each with its own condition:

- **Empty folder** (discovery — [G06](API-RULES/API-DISCOVERY-CONDITIONS.md#g06-empty-container-produces-no-leaf)): a folder that yields no files and no kept subfolders is skipped — it does **not** create an empty `{}` namespace.
- **Empty add** (mutation — [M05](API-RULES/API-MUTATION-CONDITIONS.md#m05-empty-add-is-a-no-op)): an `api.slothlet.api.add()` whose resolved export map has nothing to mount warns and mounts nothing (a no-op, not a leaf); deleting a leaf also prunes any now-empty ancestor container ([M04](API-RULES/API-MUTATION-CONDITIONS.md#m04-deletepath-prunes-empty-ancestor-containers)).
- **Empty-value leaf** (placement): a category whose content is a single callable becomes that callable directly, never an empty object wrapper.

**Behavior-change note**: earlier versions created a `{}` leaf for an empty folder; **#156** inverted that — empty folders are now skipped. There is no single "empty" strategy in the flatten pipeline; the conditions above are the authoritative sites.

**Source Code**: `src/lib/processors/loader.mjs:510-513` (G06, #156) · `src/lib/handlers/api-manager.mjs:1468-1474,2200` (M04/M05, #136) · `src/lib/builders/modes-processor.mjs:761` (empty-value leaf, #333)

---

## Rule 4: Default Export Promotion

**Category**: Export Handling
**Status**: ✅ Verified (`api_tests/api_test`)
**User Guide**: [F04](API-RULES/API-FLATTENING.md#f04)
**Technical**: [C11, C17, C19](API-RULES/API-RULES-CONDITIONS.md#c11)

**Condition**: A module exposes a default export (function or object)
**Behavior**: The default export is promoted to the module's api slot rather than nested under a `default` key; named exports attach as properties of it. Shares its conditions with [Rule 8](#rule-8-object--namespace-default-flattening) (object/namespace default flattening).

**Verified Examples**:

```javascript
// File: greet.mjs
export default function greet(name) {
	return `hi ${name}`;
}
export const VERSION = 1;

api.greet("x"); // ✅ default promoted to the slot (not api.greet.default)
api.greet.VERSION; // ✅ named export attached as a property
```

**Technical Implementation**:

- **Detection**: [C11](API-RULES/API-RULES-CONDITIONS.md#c11) - default export flattening
- **Function default**: [C17](API-RULES/API-RULES-CONDITIONS.md#c17) - default function export flattening

**Note**: preserving a function's own name over the sanitized filename is a separate concern — see [Rule 9](#rule-9-function-name-preference).

**Source Code Location**: `src/lib/processors/flatten.mjs` - `processModuleForAPI()`

---

## Rule 5: Multiple Module Default Export Handling

**Category**: Export Handling
**Status**: ✅ Verified (`api_tests/api_test`)
**Technical**: [C02, C03](API-RULES/API-RULES-CONDITIONS.md#c02-multi-default-context-with-default-export)

**Condition**: Category contains multiple modules with default exports
**Behavior**: Files with a default export (C02) are preserved as their own named namespace. Files without a default export (C03) have their named exports hoisted directly into the parent folder namespace — the file's own intermediate namespace is dissolved.
**Processing Path**: C02 → `preserveAsNamespace: true`; C03 → `flattenToRoot: true` (keys merged into `targetApi`)

> **Bug Fix (PR [#116](https://github.com/CLDMV/slothlet/pull/116))**: Prior to this fix, C03 fell through to standard namespace wrapping, causing named-only files to appear nested under a `filename` sub-namespace (e.g. `api.notifications.helpers.formatPhone`) instead of being hoisted to the folder level (`api.notifications.formatPhone`). If you depend on the pre-fix nested behavior and need time to migrate, you can temporarily restore it with `suppressFixes: ["C03_116"]` — see [Bug-Fix Suppression](../docs/CONFIGURATION.md#bug-fix-suppression-suppressfixes) in the configuration docs. This option will be removed in v4.

**Verified Examples**:

```javascript
// File: notifications/email.mjs
export default function send(to, msg) { /* ... */ }

// File: notifications/sms.mjs
export default function send(to, msg) { /* ... */ }

// File: notifications/helpers.mjs  (no default export)
export function formatPhone(p) { /* ... */ }
export const RETRY_LIMIT = 3;

api.notifications.email("a@x", "hi");    // ✅ Default callable (C02 — has default, preserved)
api.notifications.sms("+1...", "hi");    // ✅ Default callable (C02 — has default, preserved)
api.notifications.formatPhone("...");    // ✅ Hoisted (C03 — no default, dissolved)
api.notifications.RETRY_LIMIT;          // ✅ Hoisted (C03 — no default, dissolved)
// api.notifications.helpers            — does not exist
```

**Technical Implementation**:

- **Detection**: `hasMultipleDefaults` flag set by category scan when ≥ 2 files in the folder have a default export
- **C02** ([details](API-RULES/API-RULES-CONDITIONS.md#c02-multi-default-context-with-default-export)): module has a default → `preserveAsNamespace: true`
- **C03** ([details](API-RULES/API-RULES-CONDITIONS.md#c03-multi-default-context-without-default-export)): module has no default → `flattenToRoot: true` (named exports hoisted into parent namespace)

**Key Behavior**:

- Default-exporting files maintain their own named namespace (C02)
- Named-only files have their exports dissolved into the folder level (C03)
- Applies consistently regardless of how many files are in the folder, as long as ≥ 2 have defaults

---

## Rule 6: Self-Referential / Circular Reference Prevention

**Category**: Special Cases
**Status**: ✅ Verified (`api_tests/api_test_mixed`)
**Technical**: [C01, C09a](API-RULES/API-RULES-CONDITIONS.md#c01)

**Condition**: A module exports itself as a named export (`mod[moduleName] === mod`), or a self-referential non-function value is detected
**Behavior**: The module must not be flattened into itself — the self-reference is preserved as-is rather than recursively expanded, preventing a circular api structure.

**Verified Examples**:

```javascript
// File: widget.mjs
function widget() {
	/* ... */
}
widget.widget = widget; // self-referential named export
export { widget };

api.widget(); // ✅ callable
api.widget.widget === api.widget; // ✅ self-reference preserved, not re-flattened
```

**Technical Implementation**:

- **Self-reference (function)**: [C01](API-RULES/API-RULES-CONDITIONS.md#c01) - `#checkSelfReferential` (`mod[moduleName] === mod`) → `shouldFlatten: false`
- **Self-reference (non-function)**: [C09a](API-RULES/API-RULES-CONDITIONS.md#c09a) - self-referential non-function handling

**Source Code Location**: `src/lib/processors/flatten.mjs` - `getFlatteningDecision()` (`#checkSelfReferential`)

---

## Rule 7: Auto-Flattening – Single Named Export

**Category**: Basic Flattening
**Status**: ✅ Verified (`api_tests/api_test`)
**User Guide**: [F02](API-RULES/API-FLATTENING.md#f02), [F03](API-RULES/API-FLATTENING.md#f03)
**Technical**: [C04, C08, C12, C18](API-RULES/API-RULES-CONDITIONS.md#c04)

**Condition**: A module has exactly one named export whose key matches the file's api-path key (`moduleKeys.length === 1 && moduleKeys[0] === apiPathKey`)
**Behavior**: The single matching named export is auto-flattened onto the api path — no intermediate `filename` namespace is created.

**Verified Examples**:

```javascript
// File: config/config.mjs
export const config = { port: 3000 };

// Without Rule 7: api.config.config       ❌ (redundant nesting)
// With Rule 7:    api.config              ✅ (single matching named export auto-flattened)
api.config.port; // 3000
```

**Technical Implementation**:

- **Detection**: [C04](API-RULES/API-RULES-CONDITIONS.md#c04) - single named export matching filename → auto-flatten candidate
- **Auto-flatten**: [C08](API-RULES/API-RULES-CONDITIONS.md#c08) - auto-flattening; [C12](API-RULES/API-RULES-CONDITIONS.md#c12) - object auto-flatten; [C18](API-RULES/API-RULES-CONDITIONS.md#c18) - object auto-flatten final check

**Source Code Location**: `src/lib/processors/flatten.mjs` - `getFlatteningDecision()` / `buildCategoryDecisions()`

---

## Rule 8: Object / Namespace Default Flattening

**Category**: Basic Flattening
**Status**: ✅ Verified (`api_tests/api_test`)
**User Guide**: [F04](API-RULES/API-FLATTENING.md#f04), [F05](API-RULES/API-FLATTENING.md#f05)
**Technical**: [C11, C17, C23](API-RULES/API-RULES-CONDITIONS.md#c11)

**Condition**: A module's default export is an object or function that becomes the namespace itself (e.g. a folder-name-matching file with a default export)
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
typeof api.logger; // "function"
```

**Callable Namespace Pattern**: When a folder contains a file matching the folder name with a default export (e.g. `logger/logger.mjs`), the default function becomes the namespace itself. Other files in the folder become properties on that function:

```javascript
// File: logger/logger.mjs → export default function log()
// File: logger/utils.mjs  → named exports
api.logger("message"); // calls the default function
api.logger.utils.debug("x"); // other files remain as namespace properties
```

This pattern applies consistently at root level and category level.

**Technical Implementation**:

- **Detection**: [C11](API-RULES/API-RULES-CONDITIONS.md#c11) - default export flattening
- **Function default**: [C17](API-RULES/API-RULES-CONDITIONS.md#c17) - default function export flattening (callable namespace)

---

## Rule 9: Function Name Preference

**Category**: Special Cases
**Status**: ✅ Fully Verified (autoIP, parseJSON, getHTTPStatus, XMLParser)
**User Guide**: [API-RULES/API-FLATTENING.md - Name Preservation](API-RULES/API-FLATTENING.md)
**Technical**: [C15, C16](API-RULES/API-RULES-CONDITIONS.md#c15)

**Condition**: Exported function has an explicit name that differs from the sanitized filename
**Behavior**: Preserve the original function name over the filename-based API path

**Verified Examples**:

```javascript
// File: auto-ip.mjs
export function autoIP() {
	/* Get automatic IP */
}
// Sanitized filename: "autoIp"      ❌
// Function name:      "autoIP"      ✅

// File: get-http-status.mjs
export function getHTTPStatus() {
	/* ... */
}
// Sanitized filename: "getHttpStatus"   ❌
// Function name:      "getHTTPStatus"   ✅

// File: parse-json.mjs
export function parseJSON(data) {
	/* ... */
}
// Sanitized filename: "parseJson"   ❌
// Function name:      "parseJSON"   ✅
```

**Technical Implementation**:

- **Primary Check**: [C16](API-RULES/API-RULES-CONDITIONS.md#c16) - `exportedFunctionName !== sanitizedName`
- **Detailed Check**: [C16](API-RULES/API-RULES-CONDITIONS.md#c16) - `exportedFunction.name !== sanitizedFileName`
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
**User Guide**: [API-RULES/API-FLATTENING.md - Index File Pattern](API-RULES/API-FLATTENING.md)
**Technical**: [C17](API-RULES/API-RULES-CONDITIONS.md#c17)

**Condition**: File has a generic name (`index`, `main`, `default`, etc.)
**Behavior**: Generic filename becomes transparent; content is promoted to the meaningful parent name

**Verified Examples**:

```javascript
// File: database/main.mjs
export function connect() {
	/* ... */
}
export function query() {
	/* ... */
}

// Without Rule 10: api.database.main.connect()  ❌ (generic 'main' adds no value)
// With Rule 10:    api.database.connect()        ✅ (promoted to parent level)

// File: auth/index.mjs
export function login() {
	/* ... */
}
export function logout() {
	/* ... */
}

// Without Rule 10: api.auth.index.login()  ❌ (generic 'index' is noise)
// With Rule 10:    api.auth.login()        ✅ (clean parent-level promotion)
```

**Technical Implementation**:

- **Detection**: [C17](API-RULES/API-RULES-CONDITIONS.md#c17) - `isGenericFilename(fileName)`
- **Promotion**: Content promoted to parent namespace; generic filename becomes invisible

**Note**: Promotion is guarded against name collisions - checked against existing parent namespace properties before promoting.

---

## Rule 11: AddApi Special File Pattern

**Category**: AddApi
**Status**: ✅ Verified (`api_tests/api_smart_flatten_addapi`)
**User Guide**: [F06](API-RULES/API-FLATTENING.md#f06)
**Technical**: [C24](API-RULES/API-RULES-CONDITIONS.md#c33)

**Condition**: A file named `addapi.mjs` is loaded via `api.slothlet.api.add()`
**Behavior**: Exports are always flattened to the mount namespace regardless of other settings
**Processing Path**: Detection in `getFlatteningDecision()` (`src/lib/processors/flatten.mjs`); execution in `src/lib/builders/modes-processor.mjs`

**Verified Example**:

```javascript
// File: plugin-folder/addapi.mjs
export function initializePlugin() {
	/* ... */
}
export function cleanup() {
	/* ... */
}
export function configure() {
	/* ... */
}

await api.slothlet.api.add("plugins", "./plugin-folder");

// addapi.mjs exports are always flattened - never nested:
api.plugins.initializePlugin(); // ✅
api.plugins.cleanup(); // ✅
api.plugins.configure(); // ✅
// NOT: api.plugins.addapi.initializePlugin() ❌
```

**Technical Implementation**:

```javascript
// C24: AddApi Special File Detection
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
**Conditions**: [O01–O15](API-RULES/API-COLLISION-CONDITIONS.md) — the ownership stack, rollback, merge-loss, shadow capture, and user-assigned survival (collision-mode value resolution is [Rule 17](#rule-17-collision-resolution))

**Purpose**: Track which module registered each API path, enabling safe hot-reloading and cross-module conflict protection.

**Implementation**: Stack-based ownership system. Each API path maintains an independent ownership history stack. Removing a module automatically rolls back to the previous owner. Collision behavior is controlled by the `api.collision` configuration.

### Configuration

```javascript
const api = await slothlet({
	dir: "./api",
	api: {
		collision: {
			initial: "merge", // During initial API build
			api: "replace" // During api.slothlet.api.add()
		}
	}
});
```

### moduleID Tracking

Each `api.slothlet.api.add()` call accepts an optional `moduleID` in its options object (the third argument — `api.add(apiPath, folderPath, options, versionConfig?)`; the optional fourth argument is `versionConfig` for versioned mounts, not a second options bag). This is the key for ownership tracking:

```javascript
// Module A registers plugins namespace
await api.slothlet.api.add("plugins.moduleA", "./modules/moduleA", {
	moduleID: "moduleA"
});

// Module B registers in the same parent namespace
await api.slothlet.api.add("plugins.moduleB", "./modules/moduleB", {
	moduleID: "moduleB"
});

// Hot-reload Module A - ownership system allows this because moduleA owns these paths
await api.slothlet.api.add("plugins.moduleA", "./modules/moduleA-v2", {
	moduleID: "moduleA",
	forceOverwrite: true
});

// Cross-module overwrite - blocked if the instance's configured collision mode is "error"
await api.slothlet.api.add("plugins.moduleB", "./modules/other", {
	moduleID: "moduleA", // moduleA does not own moduleB's paths
	forceOverwrite: true // Throws OWNERSHIP_CONFLICT when the instance's collision mode is "error"
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

Collision mode is fixed at instance initialization (the `collision` config option — see [CONFIGURATION.md](CONFIGURATION.md)). Passing `collisionMode` to an individual `api.add()` call is locked by default — it emits a `WARNING_API_ADD_OPTION_LOCKED` warning and is ignored (the add still succeeds), unless `api.mutations.allowCollisionOverride: true` is set, which makes a per-call `collisionMode` take effect. `forceOverwrite` (below) is the always-available per-call escape hatch regardless of that flag.

| Mode                | Behavior                                   |
| ------------------- | ------------------------------------------ |
| `"merge"` (default) | Preserve existing properties, add new ones |
| `"merge-replace"`   | Add new properties, overwrite existing     |
| `"replace"`         | Completely replace the existing value      |
| `"skip"`            | Keep existing value, silently ignore new   |
| `"warn"`            | Keep existing value, log a warning         |
| `"error"`           | Throw `OWNERSHIP_CONFLICT` error           |

### forceOverwrite

`forceOverwrite: true` performs a complete replacement regardless of the instance's configured collision mode (a `moduleID` is auto-generated when you don't supply one). Use for cases where a module must fully replace its own prior registration:

```javascript
await api.slothlet.api.add("config", "./new-config", {
	moduleID: "config-v2",
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
**Technical**: [C25](API-RULES/API-RULES-CONDITIONS.md#c34)

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

**Guard - `isDirectChild`**: Rule 13 only fires when the matching key's `filePath` is **directly** inside `resolvedFolderPath/lastPart`. This prevents false positives when a deeper nested folder coincidentally shares the mount-path name:

```javascript
// Should NOT hoist (services/services/services.mjs):
// api.add("services", folder)  →  newApi has key "services"
// but filePath = .../services/services/services.mjs
//     dirname  = .../services/services   ≠ resolvedFolderPath/services
// → Rule 13 does NOT fire
// → api.services.services.getNestedService remains properly nested ✅
```

**Childless leaf case**: When the matching key's value has no children of its own — a single self-named file such as `thing.mjs` exporting a function named `thing`, mounted at `api.add("thing", folder)` — there is nothing to spread up from it. The value itself is what belongs at the mount path, so Rule 13 uses it directly rather than hoisting an empty set of children:

```javascript
// Folder structure: addfolder/
//   thing.mjs   ← exports a single function named `thing`, no siblings

await api.slothlet.api.add("thing", "./addfolder", {});

api.thing("x"); // ✅ the leaf itself, mounted directly (nothing to hoist)
```

**Implementation**: `src/lib/handlers/api-manager.mjs` - immediately after `buildAPI` call, before `setValueAtPath`

---

## Rule 14: API Directory Scan & Inclusion

> **New in v3**

**Category**: Discovery
**Status**: ✅ Implemented (`src/lib/processors/loader.mjs`)
**Conditions**: [G01–G08](API-RULES/API-DISCOVERY-CONDITIONS.md) — Loadable-Extension Gate, Hidden Folder/File Exclusion, Consumer `hidden` Glob, `fileFilter` Gate, Empty Container → No Leaf, Depth/Non-Recursive Truncation, Reserved-Filename Rejection

**Purpose**: Governs which files and folders in an api directory become leaves, before any flattening runs. A file must clear every inclusion gate — extension allowlist, hidden-prefix, consumer `hidden` glob, `fileFilter`, depth limit — and a reserved filename aborts the scan. An empty folder produces no leaf (shared with [Rule 3](#rule-3-no-empty-leaves)).

**Note**: the disk scan and the browser-manifest reader are two realizations of these conditions; the browser reader relies on build-time filtering by `generate-manifest` (see [#423](https://github.com/CLDMV/slothlet/issues/423)).

---

## Rule 15: External Module Discovery

> **New in v3**

**Category**: Discovery
**Status**: ✅ Implemented (`src/lib/helpers/module-discovery.mjs`, `src/lib/helpers/module-manifest-validator.mjs`)
**Conditions**: [G09–G14](API-RULES/API-DISCOVERY-CONDITIONS.md#g09-reserved-mountpath-root-rejection) — Reserved MountPath-Root Rejection, External-Module Validity Gate, Real-Path Dedupe & Duplicate `name@version`, Content-Filter Veto, ScanRoot Mode Auto-Detect, CJS Interop Export Shaping

**Purpose**: Governs which installed packages / external modules become part of the api during `discover()` / `addModules()`. A candidate must have a valid `package.json` and resolvable manifest, must not duplicate a `name@version` at a different real path, must survive the consumer content-filter, and must not claim a reserved mount root. npm-mode vs folder-mode scanning selects the candidate universe.

---

## Rule 16: Leaf Name Derivation (Sanitization)

> **New in v3**

**Category**: Naming
**Status**: ✅ Implemented (`src/lib/helpers/sanitize.mjs`)
**Conditions**: [N01–N08](API-RULES/API-NAMING-CONDITIONS.md) — Base Name, All-Upper/All-Lower Preservation, Segment Split, camelCase Join, Configured Rule Cascade, Underscore Preservation, Illegal-Character Handling

**Purpose**: Governs how a filename or export name becomes the api accessor key: strip the extension, preserve acronyms/configured names, split on hyphens/non-identifier runs, camelCase-join, preserve underscores, and normalize illegal characters to a valid JS identifier.

**Note**: choosing a function's own name over the sanitized filename is a separate, older decision — see [Rule 9](#rule-9-function-name-preference) (C15/C16).

---

## Rule 17: Collision Resolution

> **New in v3**

**Category**: Composition
**Status**: ✅ Implemented (`src/lib/handlers/ownership.mjs`, `src/lib/builders/api-assignment.mjs`, `src/lib/handlers/api-manager.mjs`)
**Conditions**: [O01–O13](API-RULES/API-COLLISION-CONDITIONS.md) — the six collision modes (`merge`, `merge-replace`, `replace`, `skip`, `warn`, `error`), `forceOverwrite`, Merge-Loss, Namespace-vs-Callable, Wrapper/Plain fall-throughs, `removeMissing`, Load Order, Mount Preflight

**Purpose**: Governs which value wins when two contributions land at the same api path. The six collision modes are the primary policy; `forceOverwrite` overrides per call; merge-loss and the wrapper/plain shape fall-throughs resolve mixed shapes; load order sets precedence. Ownership tracking, the ownership stack, and rollback stay with [Rule 12](#rule-12-module-ownership-and-selective-api-overwriting).

**Note**: `warn` is intentionally context-dependent — a cross-module conflict keeps the existing owner, an intra-build file/folder collision merges (see O05).

---

## Rule 18: Dynamic API Mutation

> **New in v3**

**Category**: Mutation
**Status**: ✅ Implemented (`src/lib/handlers/api-manager.mjs`)
**Conditions**: [M01–M09](API-RULES/API-MUTATION-CONDITIONS.md) — Parent-Path Container Creation, Non-Object Mount Block, Wrap-on-Set, Empty-Ancestor Prune, Empty-Add No-Op, Synthetic Add, One-Key Unwrap, Callable Container, Remove-if-Sole vs Revert-if-Shared

**Purpose**: Governs how the api tree is reshaped by runtime `api.slothlet.api.add()` / `remove()` / `mount` / reload — parent-container creation, synthetic/in-memory adds, single-key unwrap, and removal semantics that revert shared nodes to a prior owner rather than blanket-deleting. Empty-ancestor pruning and empty-add no-op are shared with [Rule 3](#rule-3-no-empty-leaves).

---

## Rule 19: Versioned Mounts

> **New in v3**

**Category**: Versioning
**Status**: ✅ Implemented (`src/lib/handlers/version-manager.mjs`)
**Conditions**: [V01–V08](API-RULES/API-VERSIONING-CONDITIONS.md) — Duplicate Register Block, Atomic Version Segment, Multi-Version Sibling Mount, Default-Version Resolution, Per-Access Dispatch, Enumeration Union, Unregister Teardown/Rebuild, Atomic Rollback

**Purpose**: Governs how multiple versions of a module coexist at a path and which one a caller observes. A versioned mount nests under an atomic version segment; a plain path resolves to the elected default (or a per-access discriminator); enumeration reports the union across versions; a failed versioned add rolls back atomically.

---

## Rule 20: Stackable Routines & Cascades

> **New in v3**

**Category**: Routines
**Status**: ✅ Implemented (`src/lib/handlers/routine-manager.mjs`)
**Conditions**: [T01–T10](API-RULES/API-ROUTINE-CONDITIONS.md) — `stackRoutines` Gate, Name Matching, Slot-Type Selection, Last-Wins, Cascade-Slot Exclusivity, `cascade:false` Suppression, Root-Builtin Exclusion, Execution Order, `.for`/`.contributors` Surface, Return Shape

**Purpose**: Governs how contributions to a named routine are collected and whether an api slot becomes a plain value, a per-path stacked callable, or a root cascade callable — including the contributor gate, name matching, execution order, and the scalar-vs-array return shape.

---

## Rule 21: Reserved Keys & Built-in Surface

> **New in v3**

**Category**: Built-in
**Status**: ✅ Implemented (`src/lib/builders/api_builder.mjs`)
**Conditions**: [B01–B04](API-RULES/API-BUILTIN-CONDITIONS.md) — Reserved Root Keys, `slothlet.diag` Gating, `api.add` Option Lock, `versioning.unregister` No-Op

**Purpose**: Governs the framework-owned surface: reserved root keys (`slothlet` replaced with a warning; `shutdown`/`destroy` captured as user hooks and invoked), the diagnostics namespace gate, and the `api.add` option lock. Reserved-key protection at the file/export/mount layers is enforced by G08/G09 (Rules 14/15).

---

## Verification Status

| Rule | Title                                            | Status      | Test Source                                               |
| ---- | ------------------------------------------------ | ----------- | --------------------------------------------------------- |
| 1    | Filename Matches Container Flattening            | ✅ Verified | `api_tests/api_test`                                      |
| 2    | Single Function File Promotion                   | ✅ Verified | `api_tests/api_test`                                      |
| 3    | No Empty Leaves                                  | ✅ Verified | `api_tests` (empty-folder/add/value)                      |
| 4    | Default Export Promotion                         | ✅ Verified | `api_tests/api_test`, `api_tests/api_tv_test`             |
| 5    | Multiple Module Default Export Handling          | ✅ Verified | `api_tests/api_tv_test`                                   |
| 6    | Self-Referential / Circular Reference Prevention | ✅ Verified | `api_tests/api_test_mixed`                                |
| 7    | Auto-Flattening – Single Named Export            | ✅ Verified | `api_tests/api_test`                                      |
| 8    | Object / Namespace Default Flattening            | ✅ Verified | Multiple test files                                       |
| 9    | Function Name Preference                         | ✅ Verified | autoIP, parseJSON, getHTTPStatus, XMLParser               |
| 10   | Generic Filename Parent-Level Promotion          | ✅ Verified | `api_tests/api_test/nest4/singlefile.mjs`                 |
| 11   | AddApi Special File Pattern                      | ✅ Verified | `api_tests/api_smart_flatten_addapi`                      |
| 12   | Module Ownership and Selective API Overwriting   | ✅ Verified | `src/lib/handlers/ownership.mjs`                          |
| 13   | AddApi Path Deduplication Flattening             | ✅ Verified | `api_tests/smart_flatten/api_smart_flatten_folder_config` |
| 14   | API Directory Scan & Inclusion                   | ✅ Verified | `src/lib/processors/loader.mjs`                           |
| 15   | External Module Discovery                        | ✅ Verified | `src/lib/helpers/module-discovery.mjs`                    |
| 16   | Leaf Name Derivation (Sanitization)              | ✅ Verified | `src/lib/helpers/sanitize.mjs`                            |
| 17   | Collision Resolution                             | ✅ Verified | `src/lib/handlers/ownership.mjs`, `api-assignment.mjs`    |
| 18   | Dynamic API Mutation                             | ✅ Verified | `src/lib/handlers/api-manager.mjs`                        |
| 19   | Versioned Mounts                                 | ✅ Verified | `src/lib/handlers/version-manager.mjs`                    |
| 20   | Stackable Routines & Cascades                    | ✅ Verified | `src/lib/handlers/routine-manager.mjs`                    |
| 21   | Reserved Keys & Built-in Surface                 | ✅ Verified | `src/lib/builders/api_builder.mjs`                        |

---

## Cross-Reference Index

### By Condition Series

Each rule's conditions live in a per-family series. The flatten/placement series (`C##`) stays in `API-RULES-CONDITIONS.md`; every other family has its own document.

| Series | Family                      | Rules             | Document                                                               |
| ------ | --------------------------- | ----------------- | ---------------------------------------------------------------------- |
| `C##`  | Flattening / placement      | 1-10              | [API-RULES-CONDITIONS.md](API-RULES/API-RULES-CONDITIONS.md)           |
| `F##`  | Flattening patterns (guide) | 1, 4, 7, 8, 10-13 | [API-FLATTENING.md](API-RULES/API-FLATTENING.md)                       |
| `G##`  | Discovery / inclusion       | 3, 14, 15         | [API-DISCOVERY-CONDITIONS.md](API-RULES/API-DISCOVERY-CONDITIONS.md)   |
| `N##`  | Leaf-name derivation        | 16                | [API-NAMING-CONDITIONS.md](API-RULES/API-NAMING-CONDITIONS.md)         |
| `O##`  | Collision / ownership       | 12, 17            | [API-COLLISION-CONDITIONS.md](API-RULES/API-COLLISION-CONDITIONS.md)   |
| `M##`  | Dynamic mutation            | 3, 18             | [API-MUTATION-CONDITIONS.md](API-RULES/API-MUTATION-CONDITIONS.md)     |
| `V##`  | Versioned mounts            | 19                | [API-VERSIONING-CONDITIONS.md](API-RULES/API-VERSIONING-CONDITIONS.md) |
| `T##`  | Routines / cascades         | 20                | [API-ROUTINE-CONDITIONS.md](API-RULES/API-ROUTINE-CONDITIONS.md)       |
| `B##`  | Reserved keys / built-ins   | 21                | [API-BUILTIN-CONDITIONS.md](API-RULES/API-BUILTIN-CONDITIONS.md)       |

### By Rule → Conditions (`C##` flatten series)

| Rule | Conditions              | Flattening Pattern |
| ---- | ----------------------- | ------------------ |
| 1    | C05, C09, C09b, C13     | F01                |
| 2    | C07, C10, C13, C20, C21 | -                  |
| 3    | G06, M04, M05, C22      | —                  |
| 4    | C11, C17, C19           | F04                |
| 5    | C02, C03                | —                  |
| 6    | C01, C09a               | —                  |
| 7    | C04, C08, C12, C18      | F02, F03           |
| 8    | C11, C17, C23           | F02, F04, F05      |
| 9    | C15, C16                | —                  |
| 10   | C14                     | F02                |
| 11   | C24                     | F06                |
| 12   | — (O01-O15 ownership)   | F07                |
| 13   | C25                     | F08                |

Rules 14-21 use the `G/N/O/M/V/T/B` series above; see each rule's **Conditions** line and the linked family document.
