# API Rules Conditions

**Document Hierarchy**:
[API Rules Index](../API-RULES.md) → [Flattening Patterns](API-FLATTENING.md) → **Conditions Reference** → [Rule Mapping](API-RULE-MAPPING.md)

**Purpose**: Complete reference for all source-level conditions that implement flattening behavior.
Each entry maps to the rule and flattening pattern it enforces, and links directly to the source function and line range.

---

## Core Decision Functions

The flattening logic lives in three functions across two source files:

| Function | File | Description |
|---|---|---|
| `getFlatteningDecision()` | `src/lib/helpers/api_builder/decisions.mjs` | Per-module single-file flattening verdict |
| `processModuleForAPI()` | `src/lib/helpers/api_builder/decisions.mjs` | Applies flattening decision during module processing |
| `buildCategoryDecisions()` | `src/lib/helpers/api_builder/decisions.mjs` | Directory-level flattening for multi-file folders |

---

## C01: Self-Referential Check

**Category**: Basic Flattening  
**Related Rule**: [Rule 6](../API-RULES.md#rule-6-self-referential-circular-reference-prevention)  
**Flattening Guide**: [F01: Basic Flattening Rules](API-FLATTENING.md#f01-basic-flattening-rules)  
**Status**: ✅ Active

**Pattern**: A module that exports itself as a named export is self-referential and must not be flattened into itself.

**Function**: `getFlatteningDecision()`  
**Source**: `src/lib/helpers/api_builder/decisions.mjs` ~L100

**Condition Check**:

```javascript
if (isSelfReferential) {
  return { shouldFlatten: false, flattenType: "self-referential" };
}
```

**Triggers**: `isSelfReferential === true`  
**Result**: `shouldFlatten: false, flattenType: "self-referential"`  
**Used By**: [API-RULES Rule 6](../API-RULES.md#rule-6-self-referential-circular-reference-prevention)

---

## C02: Multi-Default Context with Default Export

**Category**: Basic Flattening  
**Related Rule**: [Rule 5](../API-RULES.md#rule-5-multi-default-export-coordination)  
**Status**: ✅ Active

**Pattern**: In a multi-default context, if the current module has a default export, flatten to the root using the default export as the primary value.

**Function**: `getFlatteningDecision()`  
**Source**: `src/lib/helpers/api_builder/decisions.mjs` ~L113-L123

**Condition Check**:

```javascript
if (hasMultipleDefaultExports) {
  if (moduleHasDefault) {
    return { shouldFlatten: true, flattenType: "root", preferredValue: moduleDefault };
  }
```

**Triggers**: `hasMultipleDefaultExports === true && moduleHasDefault === true`  
**Result**: `shouldFlatten: true, flattenType: "root"`  
**Used By**: [API-RULES Rule 5](../API-RULES.md#rule-5-multi-default-export-coordination)

---

## C03: Multi-Default Context Without Default Export

**Category**: Basic Flattening  
**Related Rule**: [Rule 5](../API-RULES.md#rule-5-multi-default-export-coordination)  
**Status**: ✅ Active

**Pattern**: In a multi-default context, if the current module does NOT have a default export, preserve as a namespace instead of forcing a flatten.

**Function**: `getFlatteningDecision()`  
**Source**: `src/lib/helpers/api_builder/decisions.mjs` ~L125

**Condition Check**:

```javascript
if (hasMultipleDefaultExports) {
  // ...
  else {
    return { shouldFlatten: false, flattenType: "namespace" };
  }
}
```

**Triggers**: `hasMultipleDefaultExports === true && moduleHasDefault === false`  
**Result**: `shouldFlatten: false, flattenType: "namespace"`  
**Used By**: [API-RULES Rule 5](../API-RULES.md#rule-5-multi-default-export-coordination)

---

## C04: Auto-Flatten Single Named Export Matching Filename

**Category**: Basic Flattening  
**Related Rule**: [Rule 7](../API-RULES.md#rule-7-auto-flattening-single-named-export)  
**Flattening Guide**: [F03: Auto-Flatten](API-FLATTENING.md#f03-auto-flatten-single-named-export)  
**Status**: ✅ Active

**Pattern**: A module with exactly one named export, and that export key matches the file's API path key, is an auto-flatten candidate — no intermediate namespace is needed.

**Function**: `getFlatteningDecision()`  
**Source**: `src/lib/helpers/api_builder/decisions.mjs` ~L138

**Condition Check**:

```javascript
if (moduleKeys.length === 1 && moduleKeys[0] === apiPathKey) {
  return { shouldFlatten: true, flattenType: "auto-flatten", preferredName: moduleKeys[0] };
}
```

**Triggers**: `moduleKeys.length === 1 && moduleKeys[0] === apiPathKey`  
**Result**: `shouldFlatten: true, flattenType: "auto-flatten"`  
**Used By**: [API-RULES Rule 7](../API-RULES.md#rule-7-auto-flattening-single-named-export)

---

## C05: Filename Matches Container / Category-Level Flatten

**Category**: Basic Flattening  
**Related Rule**: [Rule 1](../API-RULES.md#rule-1-category-name-matching)  
**Flattening Guide**: [F01: Basic Flattening Rules](API-FLATTENING.md#f01-basic-flattening-rules)  
**Status**: ✅ Active

**Pattern**: When a file at the category level has the same name as its containing folder (and exports named members but no default), flatten those exports directly into the category namespace.

**Function**: `getFlatteningDecision()`  
**Source**: `src/lib/helpers/api_builder/decisions.mjs` ~L150

**Condition Check**:

```javascript
if (categoryName && fileName === categoryName && !moduleHasDefault && moduleKeys.length > 0) {
  return { shouldFlatten: true, flattenType: "category", preferredName: categoryName };
}
```

**Triggers**: `categoryName != null && fileName === categoryName && !moduleHasDefault && moduleKeys.length > 0`  
**Result**: `shouldFlatten: true, flattenType: "category"`  
**Used By**: [API-RULES Rule 1](../API-RULES.md#rule-1-category-name-matching)

---

## C06: Deprecated Condition

**Category**: Basic Flattening  
**Status**: ⛔ **Intentionally disabled / commented out**

**Note**: This condition was removed from the active decision path. The code block remains in source as a historical reference but is not evaluated during normal execution. No rules depend on this condition.

**Source**: `src/lib/helpers/api_builder/decisions.mjs` ~L162-L170 (commented out)

---

## C07: Default Fallback — Preserve as Namespace

**Category**: Basic Flattening  
**Related Rule**: All rules (fallback)  
**Status**: ✅ Active

**Pattern**: When no other condition matches, preserve the module under its own namespace key. This is the safe default.

**Function**: `getFlatteningDecision()`  
**Source**: `src/lib/helpers/api_builder/decisions.mjs` ~L174

**Condition Check**:

```javascript
else {
  return { shouldFlatten: false, flattenType: "namespace" };
}
```

**Triggers**: No prior condition matched  
**Result**: `shouldFlatten: false, flattenType: "namespace"`

---

## C08: Auto-Flattening

**Category**: Module Processing  
**Related Rule**: [Rule 7](../API-RULES.md#rule-7-auto-flattening-single-named-export)  
**Flattening Guide**: [F03: Auto-Flatten](API-FLATTENING.md#f03-auto-flatten-single-named-export)  
**Status**: ✅ Active

**Pattern**: If the flattening decision verdict is `useAutoFlattening`, apply auto-flatten processing to the module during `processModuleForAPI()`.

**Function**: `processModuleForAPI()`  
**Source**: `src/lib/helpers/api_builder/decisions.mjs` ~L424

**Condition Check**:

```javascript
if (decision.useAutoFlattening) {
  // apply auto-flatten processing
}
```

**Triggers**: `decision.useAutoFlattening === true`  
**Used By**: [API-RULES Rule 7](../API-RULES.md#rule-7-auto-flattening-single-named-export)

---

## C09: Flatten to Root/Category

**Category**: Module Processing  
**Related Rules**: [Rule 1](../API-RULES.md#rule-1-category-name-matching), [Rule 5](../API-RULES.md#rule-5-multi-default-export-coordination)  
**Status**: ✅ Active

**Pattern**: If the decision specifies `flattenToRoot` or `flattenToCategory`, merge the module's exports into the target namespace level directly.

**Function**: `processModuleForAPI()`  
**Source**: `src/lib/helpers/api_builder/decisions.mjs` ~L430

**Condition Check**:

```javascript
else if (decision.flattenToRoot || decision.flattenToCategory) {
  // merge exports into target namespace
}
```

**Triggers**: `decision.flattenToRoot === true || decision.flattenToCategory === true`  
**Used By**: [API-RULES Rule 1](../API-RULES.md#rule-1-category-name-matching), [Rule 5](../API-RULES.md#rule-5-multi-default-export-coordination)

---

## C09a: Self-Referential Non-Function

**Category**: Module Processing  
**Related Rule**: [Rule 6](../API-RULES.md#rule-6-self-referential-circular-reference-prevention)  
**Status**: ✅ Active

**Pattern**: During module processing, if a self-referential condition is present but the export is not a function, bypass flattening and preserve as a namespace.

**Function**: `processModuleForAPI()`  
**Source**: `src/lib/helpers/api_builder/decisions.mjs` ~L440

**Condition Check**:

```javascript
else if (isSelfReferential) {
  // preserve as namespace, no flatten
}
```

**Triggers**: `isSelfReferential === true` (non-function case)  
**Used By**: [API-RULES Rule 6](../API-RULES.md#rule-6-self-referential-circular-reference-prevention)

---

## C09b: Traditional Namespace Preservation

**Category**: Module Processing  
**Status**: ✅ Active

**Pattern**: Final fallback in `processModuleForAPI()` — if no processing branch matches, preserve the module under its namespace key.

**Function**: `processModuleForAPI()`  
**Source**: `src/lib/helpers/api_builder/decisions.mjs` ~L444

**Condition Check**:

```javascript
else {
  // standard namespace preservation
}
```

**Triggers**: No prior processing branch matched  
**Result**: Module placed under its own namespace key

---

## C10: Single-File Function — Folder Match

**Category**: Category Decisions  
**Related Rule**: [Rule 2](../API-RULES.md#rule-2-single-function-file-promotion)  
**Status**: ✅ Active

**Pattern**: In a directory with a single `.mjs` file, if the file exports a function and the module name matches the category name, promote the function directly to the category key (no intermediate namespace).

**Function**: `buildCategoryDecisions()`  
**Source**: `src/lib/helpers/api_builder/decisions.mjs` ~L580

**Condition Check**:

```javascript
if (moduleName === categoryName && typeof mod === "function" && currentDepth > 0) {
  // promote function to category level
}
```

**Triggers**: `moduleName === categoryName && typeof mod === "function" && currentDepth > 0`  
**Used By**: [API-RULES Rule 2](../API-RULES.md#rule-2-single-function-file-promotion)

---

## C11: Default Export Flattening

**Category**: Category Decisions  
**Related Rule**: [Rule 4](../API-RULES.md#rule-4-default-export-promotion)  
**Flattening Guide**: [F04: Default Export Object Flattening](API-FLATTENING.md#f04-default-export-object-flattening)  
**Status**: ✅ Active

**Pattern**: When a module has a default export that is an object and its name matches the category name, flatten the object's properties into the category namespace.

**Function**: `buildCategoryDecisions()`  
**Source**: `src/lib/helpers/api_builder/decisions.mjs` ~L588

**Condition Check**:

```javascript
if (
  analysis.hasDefault &&
  analysis.defaultExportType === "object" &&
  moduleName === categoryName &&
  currentDepth > 0
) {
  // flatten default object into category
}
```

**Triggers**: Has default object export + module name matches category name + nested context  
**Used By**: [API-RULES Rule 4](../API-RULES.md#rule-4-default-export-promotion)

---

## C12: Object Auto-Flatten

**Category**: Category Decisions  
**Related Rule**: [Rule 7](../API-RULES.md#rule-7-auto-flattening-single-named-export)  
**Flattening Guide**: [F04: Default Export Object Flattening](API-FLATTENING.md#f04-default-export-object-flattening)  
**Status**: ✅ Active

**Pattern**: When a module exports a plain object (not array, not function) and its name matches the category name, auto-flatten the object's properties into the category level.

**Function**: `buildCategoryDecisions()`  
**Source**: `src/lib/helpers/api_builder/decisions.mjs` ~L596

**Condition Check**:

```javascript
if (
  moduleName === categoryName &&
  mod &&
  typeof mod === "object" &&
  !Array.isArray(mod) &&
  currentDepth > 0
) {
  // auto-flatten object
}
```

**Triggers**: Module is plain object + name matches category + nested context  
**Used By**: [API-RULES Rule 7](../API-RULES.md#rule-7-auto-flattening-single-named-export)

---

## C13: Filename / Folder Exact Match Flattening

**Category**: Category Decisions  
**Related Rules**: [Rule 1](../API-RULES.md#rule-1-category-name-matching), [Rule 2](../API-RULES.md#rule-2-single-function-file-promotion)  
**Status**: ✅ Active

**Pattern**: When the file's base name matches the category name and the module has at least one export, flatten those exports up to the category level.

**Function**: `buildCategoryDecisions()`  
**Source**: `src/lib/helpers/api_builder/decisions.mjs` ~L611

**Condition Check**:

```javascript
if (fileBaseName === categoryName && moduleKeys.length > 0) {
  // flatten to category
}
```

**Triggers**: `fileBaseName === categoryName && moduleKeys.length > 0`  
**Used By**: [API-RULES Rule 1](../API-RULES.md#rule-1-category-name-matching), [Rule 2](../API-RULES.md#rule-2-single-function-file-promotion)

---

## C14: Parent-Level Flattening — Generic Filenames

**Category**: Category Decisions  
**Related Rule**: [Rule 10](../API-RULES.md#rule-10-parent-level-promotion-generic-filenames)  
**Flattening Guide**: [F02: Function Folder Matching](API-FLATTENING.md#f02-function-folder-matching)  
**Status**: ✅ Active

**Pattern**: When a folder contains exactly one file, that file has a generic name (e.g. `index`, `main`, `helpers`), and there is nested depth, flatten the module's exports to the parent level to avoid pointless nesting.

**Function**: `buildCategoryDecisions()`  
**Source**: `src/lib/helpers/api_builder/decisions.mjs` ~L653-L661

**Condition Check**:

```javascript
if (
  moduleFiles.length === 1 &&
  currentDepth > 0 &&
  /* ... various generic-name checks ... */ &&
  isGenericFilename
) {
  // flatten to parent
}
```

**Triggers**: Single file in folder + nested context + filename is generic  
**Used By**: [API-RULES Rule 10](../API-RULES.md#rule-10-parent-level-promotion-generic-filenames)

---

## C15: Function Name Matches Folder

**Category**: Category Decisions  
**Related Rule**: [Rule 9](../API-RULES.md#rule-9-function-name-preference)  
**Status**: ✅ Active

**Pattern**: When a module exports a function whose name matches the containing folder name, that function name takes precedence over the file name as the API key.

**Function**: `buildCategoryDecisions()`  
**Source**: `src/lib/helpers/api_builder/decisions.mjs` ~L670

**Condition Check**:

```javascript
if (functionNameMatchesFolder && currentDepth > 0) {
  // use function name as API key
}
```

**Triggers**: `functionNameMatchesFolder === true && currentDepth > 0`  
**Used By**: [API-RULES Rule 9](../API-RULES.md#rule-9-function-name-preference)

---

## C16: Function Name Preference

**Category**: Category Decisions  
**Related Rule**: [Rule 9](../API-RULES.md#rule-9-function-name-preference)  
**Status**: ✅ Active

**Pattern**: When a module exports a function whose name matches the filename (even without folder match), the function's own name is used as the API key rather than the file's name.

**Function**: `buildCategoryDecisions()`  
**Source**: `src/lib/helpers/api_builder/decisions.mjs` ~L678

**Condition Check**:

```javascript
if (functionNameMatchesFilename) {
  // use function name as preferred key
}
```

**Triggers**: `functionNameMatchesFilename === true`  
**Used By**: [API-RULES Rule 9](../API-RULES.md#rule-9-function-name-preference)

---

## C17: Default Function Export Flattening

**Category**: Category Decisions  
**Related Rule**: [Rule 4](../API-RULES.md#rule-4-default-export-promotion)  
**Status**: ✅ Active

**Pattern**: When a module exports a function as its default and has no explicit name (or is explicitly marked as a slothlet default), promote the function to the parent category level.

**Function**: `buildCategoryDecisions()`  
**Source**: `src/lib/helpers/api_builder/decisions.mjs` ~L687

**Condition Check**:

```javascript
if (
  typeof mod === "function" &&
  (!mod.name || mod.name === "default" || mod.__slothletDefault === true) &&
  currentDepth > 0
) {
  // promote anonymous default function
}
```

**Triggers**: Module is an anonymous/unnamed function or explicit default + nested context  
**Used By**: [API-RULES Rule 4](../API-RULES.md#rule-4-default-export-promotion)

---

## C18: Object Auto-Flatten — Final Check

**Category**: Category Decisions  
**Related Rule**: [Rule 7](../API-RULES.md#rule-7-auto-flattening-single-named-export)  
**Status**: ✅ Active

**Pattern**: Final single-file auto-flatten check: when a module has exactly one named export and that export's name matches the module name, flatten it. This catches cases not resolved by C04/C12.

**Function**: `buildCategoryDecisions()`  
**Source**: `src/lib/helpers/api_builder/decisions.mjs` ~L704

**Condition Check**:

```javascript
if (moduleKeys.length === 1 && moduleKeys[0] === moduleName) {
  return { shouldFlatten: true, flattenType: "object-auto-flatten", preferredName: moduleName };
}
```

**Triggers**: `moduleKeys.length === 1 && moduleKeys[0] === moduleName`  
**Result**: `shouldFlatten: true, flattenType: "object-auto-flatten"`  
**Used By**: [API-RULES Rule 7](../API-RULES.md#rule-7-auto-flattening-single-named-export)

---

## C33: AddApi Special File Detection

**Category**: AddApi  
**Related Rule**: [Rule 11](../API-RULES.md#rule-11-addapi-special-file-pattern)  
**Flattening Guide**: [F06: AddApi Special File Pattern](API-FLATTENING.md#f06-addapi-special-file-pattern)  
**Status**: ✅ Active

**Pattern**: Files named `addapi.mjs` loaded via `api.slothlet.api.add()` always flatten regardless of the `autoFlatten` setting. The file is designed for seamless namespace extensions — it should never create an intermediate `.addapi.` level.

**Function**: `addApiFromFolder()`  
**Source**: `src/lib/helpers/api_builder/add_api.mjs` ~L266-L310

**Condition Check**:

```javascript
if (newModules && typeof newModules === "object" && newModules.addapi) {
  const addapiContent = newModules.addapi;
  delete newModules.addapi;
  if (typeof addapiContent === "object") {
    Object.assign(newModules, addapiContent);
  } else if (typeof addapiContent === "function") {
    Object.assign(newModules, addapiContent);
  }
}
```

**Triggers**: After modules are loaded, `newModules.addapi` key is present  
**Result**: `addapi.mjs` exports are merged directly into the mount path namespace  
**Used By**: [API-RULES Rule 11](../API-RULES.md#rule-11-addapi-special-file-pattern)

**Example**:

```text
plugin-folder/
└── addapi.mjs    ← exports: initializePlugin, cleanup, configure
```

```javascript
await api.slothlet.api.add("plugins", "./plugin-folder");

api.plugins.initializePlugin(); // ✅ Direct extension
api.plugins.cleanup();          // ✅ No .addapi. intermediate level
```

**Key details**:

1. Detection: `newModules.addapi` key check
2. Extraction: content stored, `addapi` key deleted from `newModules`
3. Flattening: `Object.assign(newModules, addapiContent)` merges exports flat
4. Works regardless of `autoFlatten` setting
5. Applies only when loading via `api.slothlet.api.add()` — not initial load

---

## C34: AddApi Path Deduplication

**Category**: AddApi  
**Related Rule**: [Rule 13](../API-RULES.md#rule-13-addapi-path-deduplication-flattening)  
**Flattening Guide**: [F08: AddApi Path Deduplication Flattening](API-FLATTENING.md#f08-addapi-path-deduplication-flattening)  
**Status**: ✅ Active (New in v3)

**Pattern**: After `buildAPI` returns for an `api.slothlet.api.add()` call, if the result contains a key matching the last segment of the mount path, AND that key's value originated from a **direct subfolder** of the mounted directory (`isDirectChild` guard), hoist that key's exports one level up and remove the duplicate key.

**Purpose**: Prevents double-nesting when a mounted folder contains a same-named subfolder. `api.slothlet.api.add("config", folder)` should produce `api.config.*`, not `api.config.config.*`.

**Function**: `addApiComponent()`  
**Source**: `src/lib/handlers/api-manager.mjs` — immediately after single-file unwrap block

**Guard — `isDirectChild`**:

```javascript
// Ensures the matching key came from mountDir/lastPart/, not a deeper nested folder
const isDirectChild = dirname(filePath) === path.join(resolvedFolderPath, lastPart);
```

This guard prevents incorrect hoisting when a deeply nested folder happens to share the mount path's last segment name.

**Condition Check**:

```javascript
if (newApi[lastPart] !== undefined && isDirectChild) {
  // hoist exports from newApi[lastPart] up to newApi level
  Object.assign(newApi, newApi[lastPart]);
  delete newApi[lastPart];
}
```

**Triggers**: `newApi` has key matching mount path's last segment + `isDirectChild === true`  
**Result**: Exports hoisted one level; duplicate key removed  
**Used By**: [API-RULES Rule 13](../API-RULES.md#rule-13-addapi-path-deduplication-flattening)

**Example**:

```text
api_smart_flatten_folder_config/
└── config/
    └── config.mjs    ← exports: getNestedConfig
```

```javascript
await api.slothlet.api.add("config", "./api_smart_flatten_folder_config");

// Without C34: api.config.config.getNestedConfig() ← double-nested
// With C34:    api.config.getNestedConfig()         ← correctly hoisted
```

**`isDirectChild` examples**:

| Mount path | Folder structure | `isDirectChild` | Action |
|---|---|---|---|
| `"config"` | `folder/config/config.mjs` | `true` | Hoist ✅ |
| `"services"` | `folder/services/services.mjs` | `true` | Hoist ✅ |
| `"api"` | `folder/api/nested/api.mjs` | `false` | No hoist ✅ |

---

## Cross-Reference Index

### By Rule Number

- **Rule 1**: [C05](#c05-filename-matches-container--category-level-flatten), [C09](#c09-flatten-to-rootcategory), [C13](#c13-filename--folder-exact-match-flattening)
- **Rule 2**: [C10](#c10-single-file-function--folder-match), [C13](#c13-filename--folder-exact-match-flattening)
- **Rule 4**: [C11](#c11-default-export-flattening), [C17](#c17-default-function-export-flattening)
- **Rule 5**: [C02](#c02-multi-default-context-with-default-export), [C03](#c03-multi-default-context-without-default-export)
- **Rule 6**: [C01](#c01-self-referential-check), [C09a](#c09a-self-referential-non-function)
- **Rule 7**: [C04](#c04-auto-flatten-single-named-export-matching-filename), [C08](#c08-auto-flattening), [C12](#c12-object-auto-flatten), [C18](#c18-object-auto-flatten--final-check)
- **Rule 9**: [C15](#c15-function-name-matches-folder), [C16](#c16-function-name-preference)
- **Rule 10**: [C14](#c14-parent-level-flattening--generic-filenames)
- **Rule 11**: [C33](#c33-addapi-special-file-detection)
- **Rule 13**: [C34](#c34-addapi-path-deduplication)

### By Flattening Pattern

- **F01**: [C01](#c01-self-referential-check), [C05](#c05-filename-matches-container--category-level-flatten), [C07](#c07-default-fallback--preserve-as-namespace)
- **F02**: [C10](#c10-single-file-function--folder-match), [C15](#c15-function-name-matches-folder)
- **F03**: [C04](#c04-auto-flatten-single-named-export-matching-filename), [C08](#c08-auto-flattening)
- **F04**: [C11](#c11-default-export-flattening), [C12](#c12-object-auto-flatten)
- **F05**: [C08](#c08-auto-flattening), [C09](#c09-flatten-to-rootcategory), [C09b](#c09b-traditional-namespace-preservation)
- **F06**: [C33](#c33-addapi-special-file-detection)
- **F08**: [C34](#c34-addapi-path-deduplication)

---

## Summary

**Total Active Conditions**: 20 (C01-C05, C07-C18, C33, C34)  
**Deprecated Conditions**: 1 (C06 — intentionally disabled)  
**Primary Source Files**: `src/lib/helpers/api_builder/decisions.mjs`, `src/lib/helpers/api_builder/add_api.mjs`, `src/lib/handlers/api-manager.mjs`

### Condition Categories

- **Basic Flattening** (C01-C07): Core per-module flattening verdict from `getFlatteningDecision()`
- **Module Processing** (C08-C09b): Module handling during `processModuleForAPI()`
- **Category Decisions** (C10-C18): Directory-level coordination in `buildCategoryDecisions()`
- **AddApi Special Cases** (C33-C34): Always-flatten and deduplication for `api.slothlet.api.add()` calls

### Key Architectural Patterns

1. **Self-Referential Protection**: C01, C09a prevent circular structures
2. **Multi-Default Coordination**: C02, C03 handle mixed export patterns across a folder
3. **Smart Flattening**: Auto-detect conditions C04, C08, C12, C18 reduce unnecessary nesting
4. **Filename/Folder Matching**: C05, C10, C13 harmonize file and folder naming
5. **Function Name Preference**: C15, C16 preserve semantic naming over file structure names
6. **Depth Awareness**: Most C10-C18 conditions check `currentDepth > 0` to avoid flattening at root
7. **AddApi Extension**: C33, C34 ensure `api.slothlet.api.add()` produces clean, non-doubled namespaces

---

See [API-RULE-MAPPING.md](API-RULE-MAPPING.md) for the complete traceability matrix: Rule ↔ F## ↔ C## ↔ implementation file.
