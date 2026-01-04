# Slothlet Source Code Conditions Reference (v2)

**Complete Traceability Document for All API Generation Conditional Logic**

- **Version**: 2.0
- **Date**: January 3, 2026
- **Purpose**: Foundation documentation mapping every conditional statement in slothlet API generation to exact source code locations
- **Status**: ✅ **VERIFIED AND CURRENT** - All conditions verified against actual source code
- **Cross-Reference Support**: Provides technical foundation for [API-RULES-v2.md](API-RULES-v2.md) and [API-FLATTENING-v2.md](API-FLATTENING-v2.md)

---

## Document Hierarchy

This is the **foundation level** of slothlet's three-tier documentation system:

```text
📋 API-FLATTENING-v2.md (F##)     ← User Guide: "How flattening works"
     ↓ references
📊 API-RULES-v2.md (1-12)         ← Maintainer Guide: "All API behaviors"
     ↓ references
🔧 API-RULES-CONDITIONS-v2.md     ← Developer/Debug Guide: "Exact code locations"
```

**Numbering System**: This document uses **C##** (C01, C02, etc.) for all conditions to avoid confusion with the other files' numbering systems.

---

## Overview

This document catalogs every conditional statement in slothlet's API generation system. Each condition provides:

- **Exact line numbers** and source file locations
- **Direct GitHub-style links** for precise code navigation
- **Input parameters** and **result values** for debugging
- **Cross-references** to higher-level rules that use these conditions
- **Examples** showing the condition in action

**Architecture Pattern**: The API generation system uses 3 core functions with 18 conditional statements that determine how file structures become API surfaces.

---

## Core Decision Functions Summary

| Function                   | File                                                          | Conditions | Purpose                        |
| -------------------------- | ------------------------------------------------------------- | ---------- | ------------------------------ |
| `getFlatteningDecision()`  | [decisions.mjs](../src/lib/helpers/api_builder/decisions.mjs) | C01-C07    | Basic flattening rules         |
| `processModuleForAPI()`    | [decisions.mjs](../src/lib/helpers/api_builder/decisions.mjs) | C08-C09b   | Module-level processing        |
| `buildCategoryDecisions()` | [decisions.mjs](../src/lib/helpers/api_builder/decisions.mjs) | C10-C18    | Single-file directory handling |

---

## Table of Contents

1. [C01: Self-Referential Check](#c01-self-referential-check)
2. [C02: Multi-Default Context With Default Export](#c02-multi-default-context-with-default-export)
3. [C03: Multi-Default Context Without Default Export](#c03-multi-default-context-without-default-export)
4. [C04: Auto-Flatten Single Named Export Matching Filename](#c04-auto-flatten-single-named-export-matching-filename)
5. [C05: Filename Matches Container (Category-Level Flatten)](#c05-filename-matches-container-category-level-flatten)
6. [C06: Single File Context (COMMENTED OUT)](#c06-single-file-context-commented-out)
7. [C07: Default Fallback - Preserve as Namespace](#c07-default-fallback---preserve-as-namespace)
8. [C08: Auto-Flattening](#c08-auto-flattening)
9. [C09: Flatten To Root/Category](#c09-flatten-to-rootcategory)
10. [C09a: Self-Referential Non-Function](#c09a-self-referential-non-function)
11. [C09b: Traditional Namespace Preservation](#c09b-traditional-namespace-preservation)
12. [C10: Single-File Function Folder Match](#c10-single-file-function-folder-match)
13. [C11: Default Export Flattening](#c11-default-export-flattening)
14. [C12: Object Auto-Flatten](#c12-object-auto-flatten)
15. [C13: Filename-Folder Exact Match Flattening](#c13-filename-folder-exact-match-flattening)
16. [C14: Parent-Level Flattening (Generic Filenames)](#c14-parent-level-flattening-generic-filenames)
17. [C15: Function Name Matches Folder](#c15-function-name-matches-folder)
18. [C16: Function Name Preference](#c16-function-name-preference)
19. [C17: Default Function Export Flattening](#c17-default-function-export-flattening)
20. [C18: Object Auto-Flatten (Final Check)](#c18-object-auto-flatten-final-check)
21. [Cross-Reference Index](#cross-reference-index)

---

## C01: Self-Referential Check

**File**: [`src/lib/helpers/api_builder/decisions.mjs`](../src/lib/helpers/api_builder/decisions.mjs#L87-L189)  
**Function**: `getFlatteningDecision(options)`  
**Line**: [100](../src/lib/helpers/api_builder/decisions.mjs#L100)  
**Condition**: `if (isSelfReferential)`  
**Purpose**: Self-referential exports (where filename matches an exported property) never flatten to avoid infinite nesting  
**Input**: `isSelfReferential` (boolean)  
**Result**: `{ shouldFlatten: false, preserveAsNamespace: true, reason: "self-referential export" }`  
**Used By**: [API-RULES Rule 6](API-RULES-v2.md#rule-6-self-referential-export-protection)

**Example**:

```javascript
// math.mjs exports { math: { add, subtract } }
// → preserves as api.math.math.add() to avoid circular structure
```

---

## C02: Multi-Default Context With Default Export

**File**: [`src/lib/helpers/api_builder/decisions.mjs`](../src/lib/helpers/api_builder/decisions.mjs#L87-L189)  
**Function**: `getFlatteningDecision(options)`  
**Line**: [113](../src/lib/helpers/api_builder/decisions.mjs#L113) → [114](../src/lib/helpers/api_builder/decisions.mjs#L114)  
**Condition**: `if (hasMultipleDefaultExports) → if (moduleHasDefault)`  
**Purpose**: In multi-default context, modules WITH default exports are preserved as namespaces to avoid conflicts  
**Input**: `hasMultipleDefaultExports` (boolean), `moduleHasDefault` (boolean)  
**Result**: `{ shouldFlatten: false, preserveAsNamespace: true, reason: "multi-default context with default export" }`  
**Used By**: [API-RULES Rule 5](API-RULES-v2.md#rule-5-multi-default-export-mixed-pattern)

**Example**:

```javascript
// Folder has 3 files with default exports
// → each keeps namespace to prevent collision
```

---

## C03: Multi-Default Context Without Default Export

**File**: [`src/lib/helpers/api_builder/decisions.mjs`](../src/lib/helpers/api_builder/decisions.mjs#L87-L189)  
**Function**: `getFlatteningDecision(options)`  
**Line**: [113](../src/lib/helpers/api_builder/decisions.mjs#L113) → [125](../src/lib/helpers/api_builder/decisions.mjs#L125)  
**Condition**: `if (hasMultipleDefaultExports) → else (!moduleHasDefault)`  
**Purpose**: In multi-default context, modules WITHOUT default exports flatten to avoid empty namespaces  
**Input**: `hasMultipleDefaultExports` (boolean), `moduleHasDefault` (boolean)  
**Result**: `{ shouldFlatten: true, flattenToRoot: true, flattenToCategory: true, reason: "multi-default context without default export" }`  
**Used By**: [API-RULES Rule 5](API-RULES-v2.md#rule-5-multi-default-export-mixed-pattern)

**Example**:

```javascript
// Folder has mix of default/named exports
// → named-only files flatten to category level
```

---

## C04: Auto-Flatten Single Named Export Matching Filename

**File**: [`src/lib/helpers/api_builder/decisions.mjs`](../src/lib/helpers/api_builder/decisions.mjs#L87-L189)  
**Function**: `getFlatteningDecision(options)`  
**Line**: [138](../src/lib/helpers/api_builder/decisions.mjs#L138)  
**Condition**: `if (moduleKeys.length === 1 && moduleKeys[0] === apiPathKey)`  
**Purpose**: When module exports single named export matching filename, use the export directly  
**Input**: `moduleKeys` (array), `apiPathKey` (string)  
**Result**: `{ shouldFlatten: true, useAutoFlattening: true, reason: "auto-flatten single named export matching filename" }`  
**Used By**: [API-RULES Rule 7](API-RULES-v2.md#rule-7-auto-flattening-single-named-export) | [FLATTENING F03](API-FLATTENING-v2.md#f03)

**Example**:

```javascript
// math.mjs exports { math: { add } }
// → becomes api.math.add() not api.math.math.add()
```

---

## C05: Filename Matches Container (Category-Level Flatten)

**File**: [`src/lib/helpers/api_builder/decisions.mjs`](../src/lib/helpers/api_builder/decisions.mjs#L87-L189)  
**Function**: `getFlatteningDecision(options)`  
**Line**: [150](../src/lib/helpers/api_builder/decisions.mjs#L150)  
**Condition**: `if (categoryName && fileName === categoryName && !moduleHasDefault && moduleKeys.length > 0)`  
**Purpose**: When filename matches folder name and has named exports but no default, flatten to category level  
**Input**: `categoryName` (string), `fileName` (string), `moduleHasDefault` (boolean), `moduleKeys` (array)  
**Result**: `{ shouldFlatten: true, flattenToCategory: true, reason: "filename matches container, flatten to category" }`  
**Used By**: [API-RULES Rule 1](API-RULES-v2.md#rule-1-filename-matches-container-flattening) | [FLATTENING F01](API-FLATTENING-v2.md#f01)

**Example**:

```javascript
// math/math.mjs with named exports
// → becomes api.math.add() not api.math.math.add()
```

---

## C06: Single File Context (COMMENTED OUT)

**File**: [`src/lib/helpers/api_builder/decisions.mjs`](../src/lib/helpers/api_builder/decisions.mjs#L87-L189)  
**Function**: `getFlatteningDecision(options)`  
**Line**: [162-170](../src/lib/helpers/api_builder/decisions.mjs#L162-L170) _(commented out)_  
**Condition**: `// if (totalModules === 1 && !moduleHasDefault && moduleKeys.length > 0)`  
**Purpose**: **INTENTIONALLY DISABLED** - Would flatten single files, but removed for API path flexibility  
**Status**: **DEPRECATED** - Architectural decision documented in source comments  
**Reason**: "This rule reduces API path flexibility. If users want flattening, they can use other rules like naming the file to match the folder."

---

## C07: Default Fallback - Preserve as Namespace

**File**: [`src/lib/helpers/api_builder/decisions.mjs`](../src/lib/helpers/api_builder/decisions.mjs#L87-L189)  
**Function**: `getFlatteningDecision(options)`  
**Line**: [174](../src/lib/helpers/api_builder/decisions.mjs#L174)  
**Condition**: `else` (default case when no other conditions match)  
**Purpose**: When no flattening rules apply, preserve module as namespace  
**Input**: All other conditions failed  
**Result**: `{ shouldFlatten: false, preserveAsNamespace: true, reason: "traditional namespace preservation" }`  
**Used By**: Default behavior for all rules

**Example**:

```javascript
// Complex module structures that don't match flattening patterns
// → preserved with full namespace hierarchy
```

---

## C08: Auto-Flattening

**File**: [`src/lib/helpers/api_builder/decisions.mjs`](../src/lib/helpers/api_builder/decisions.mjs#L315-L480)  
**Function**: `processModuleForAPI(options)`  
**Line**: [424](../src/lib/helpers/api_builder/decisions.mjs#L424)  
**Condition**: `if (decision.useAutoFlattening)`  
**Purpose**: Apply auto-flattening when single named export matches filename  
**Input**: `decision.useAutoFlattening` (boolean from getFlatteningDecision)  
**Result**: `apiAssignments[apiPathKey] = mod[moduleKeys[0]], flattened = true`  
**Used By**: [API-RULES Rule 7](API-RULES-v2.md#rule-7-auto-flattening-single-named-export)

**Example**:

```javascript
// math.mjs exports { math: { add } }
// → auto-flattened to api.math.add()
```

---

## C09: Flatten To Root/Category

**File**: [`src/lib/helpers/api_builder/decisions.mjs`](../src/lib/helpers/api_builder/decisions.mjs#L315-L480)  
**Function**: `processModuleForAPI(options)`  
**Line**: [430](../src/lib/helpers/api_builder/decisions.mjs#L430)  
**Condition**: `else if (decision.flattenToRoot || decision.flattenToCategory)`  
**Purpose**: Merge all named exports into target based on flattening decision  
**Input**: `decision.flattenToRoot` or `decision.flattenToCategory` (boolean)  
**Processing**: Loop assigns `apiAssignments[key] = mod[key], flattened = true`  
**Used By**: [API-RULES Rule 1, 5](API-RULES-v2.md#rule-1-filename-matches-container-flattening)

**Example**:

```javascript
// logger.mjs exports function with properties
// → preserved as api.logger() with api.logger.info
```

---

## C09a: Self-Referential Non-Function

**File**: [`src/lib/helpers/api_builder/decisions.mjs`](../src/lib/helpers/api_builder/decisions.mjs#L315-L480)  
**Function**: `processModuleForAPI(options)`  
**Line**: [440](../src/lib/helpers/api_builder/decisions.mjs#L440)  
**Condition**: `else if (isSelfReferential)`  
**Purpose**: Self-referential non-function exports use direct property access  
**Input**: `isSelfReferential` (boolean)  
**Result**: `apiAssignments[apiPathKey] = mod[apiPathKey] || mod, namespaced = true`  
**Used By**: [API-RULES Rule 6](API-RULES-v2.md#rule-6-self-referential-export-protection)

---

## C09b: Traditional Namespace Preservation

**File**: [`src/lib/helpers/api_builder/decisions.mjs`](../src/lib/helpers/api_builder/decisions.mjs#L315-L480)  
**Function**: `processModuleForAPI(options)`  
**Line**: [444](../src/lib/helpers/api_builder/decisions.mjs#L444)  
**Condition**: `else` (default behavior)  
**Purpose**: Default behavior preserves module as namespace  
**Input**: All other conditions failed  
**Result**: `apiAssignments[apiPathKey] = mod, namespaced = true`  
**Used By**: Default behavior for complex modules

**Example**:

```javascript
// math/math.mjs named exports flatten to category level
// → api.math.add(), api.math.subtract()
```

---

## C10: Single-File Function Folder Match

**File**: [`src/lib/helpers/api_builder/decisions.mjs`](../src/lib/helpers/api_builder/decisions.mjs#L516-L715)  
**Function**: `buildCategoryDecisions(categoryPath, options)`  
**Line**: [580](../src/lib/helpers/api_builder/decisions.mjs#L580)  
**Condition**: `if (moduleName === categoryName && typeof mod === "function" && currentDepth > 0)`  
**Purpose**: Flatten when filename matches folder name and exports function (not at root level)  
**Input**: `moduleName` (string), `categoryName` (string), `typeof mod` ("function"), `currentDepth > 0`  
**Result**: `shouldFlatten: true, flattenType: "function-folder-match"`  
**Used By**: [API-RULES Rule 2](API-RULES-v2.md#rule-2-filename-folder-match-flattening)

---

## C11: Default Export Flattening

**File**: [`src/lib/helpers/api_builder/decisions.mjs`](../src/lib/helpers/api_builder/decisions.mjs#L516-L715)  
**Function**: `buildCategoryDecisions(categoryPath, options)`  
**Line**: [588](../src/lib/helpers/api_builder/decisions.mjs#L588)  
**Condition**: `if (analysis.hasDefault && analysis.defaultExportType === "object" && moduleName === categoryName && currentDepth > 0)`  
**Purpose**: Flatten default object exports when filename matches folder (handles both CJS and ESM uniformly)  
**Input**: `analysis.hasDefault`, `analysis.defaultExportType === "object"`, filename/folder match, not root level  
**Result**: `shouldFlatten: true, flattenType: "default-export-flatten"`  
**Used By**: [API-RULES Rule 4](API-RULES-v2.md#rule-4-default-export-object-flattening)

---

## C12: Object Auto-Flatten

**File**: [`src/lib/helpers/api_builder/decisions.mjs`](../src/lib/helpers/api_builder/decisions.mjs#L516-L715)  
**Function**: `buildCategoryDecisions(categoryPath, options)`  
**Line**: [596](../src/lib/helpers/api_builder/decisions.mjs#L596)  
**Condition**: `if (moduleName === categoryName && mod && typeof mod === "object" && !Array.isArray(mod) && currentDepth > 0)`  
**Sub-condition**: [601](../src/lib/helpers/api_builder/decisions.mjs#L601): `if (moduleKeys.length === 1 && moduleKeys[0] === moduleName)`  
**Purpose**: When single named export matches filename, flatten the object contents  
**Input**: Filename/category match, object type, single named export matching filename  
**Result**: `shouldFlatten: true, flattenType: "object-auto-flatten"`  
**Used By**: [API-RULES Rule 7](API-RULES-v2.md#rule-7-auto-flattening-single-named-export)

---

## C13: Filename-Folder Exact Match Flattening

**File**: [`src/lib/helpers/api_builder/decisions.mjs`](../src/lib/helpers/api_builder/decisions.mjs#L516-L715)  
**Function**: `buildCategoryDecisions(categoryPath, options)`  
**Line**: [611](../src/lib/helpers/api_builder/decisions.mjs#L611)  
**Condition**: `if (fileBaseName === categoryName && moduleKeys.length > 0)`  
**Purpose**: Avoid double nesting when file basename matches folder (e.g., nest/nest.mjs)  
**Input**: `fileBaseName === categoryName` and has named exports  
**Result**: `shouldFlatten: true, flattenType: "filename-folder-match-flatten"`  
**Used By**: [API-RULES Rule 1, 2](API-RULES-v2.md#rule-1-filename-matches-container-flattening)

---

## C14: Parent-Level Flattening (Generic Filenames)

**File**: [`src/lib/helpers/api_builder/decisions.mjs`](../src/lib/helpers/api_builder/decisions.mjs#L516-L715)  
**Function**: `buildCategoryDecisions(categoryPath, options)`  
**Line**: [653](../src/lib/helpers/api_builder/decisions.mjs#L653)  
**Condition**: `if (moduleFiles.length === 1 && currentDepth > 0 && mod && typeof mod === "object" && !Array.isArray(mod))`  
**Sub-condition**: [661](../src/lib/helpers/api_builder/decisions.mjs#L661): `if (moduleKeys.length === 1 && isGenericFilename)`  
**Purpose**: Eliminate intermediate namespace for generic filenames (singlefile, index, main, default)  
**Input**: Single file, object export, generic filename pattern: `["singlefile", "index", "main", "default"]`  
**Result**: `shouldFlatten: true, flattenType: "parent-level-flatten"`  
**Used By**: [API-RULES Rule 8](API-RULES-v2.md#rule-8-generic-filename-parent-flattening)

---

## C15: Function Name Matches Folder

**File**: [`src/lib/helpers/api_builder/decisions.mjs`](../src/lib/helpers/api_builder/decisions.mjs#L516-L715)  
**Function**: `buildCategoryDecisions(categoryPath, options)`  
**Line**: [670](../src/lib/helpers/api_builder/decisions.mjs#L670)  
**Condition**: `if (functionNameMatchesFolder && currentDepth > 0)`  
**Purpose**: Flatten when function name matches folder name (case-insensitive), prefer function name  
**Input**: Function name matches folder name (case-insensitive check), not at root level  
**Result**: `shouldFlatten: true, flattenType: "function-folder-match", preferredName: mod.name`  
**Used By**: [API-RULES Rule 9](API-RULES-v2.md#rule-9-function-name-preservation)

---

## C16: Function Name Preference

**File**: [`src/lib/helpers/api_builder/decisions.mjs`](../src/lib/helpers/api_builder/decisions.mjs#L516-L715)  
**Function**: `buildCategoryDecisions(categoryPath, options)`  
**Line**: [678](../src/lib/helpers/api_builder/decisions.mjs#L678)  
**Condition**: `if (functionNameMatchesFilename)`  
**Purpose**: Use original function name instead of sanitized filename when they match semantically  
**Input**: Function name matches filename semantically (case-insensitive, ignores sanitization differences)  
**Result**: `shouldFlatten: false, preferredName: mod.name`  
**Used By**: [API-RULES Rule 9](API-RULES-v2.md#rule-9-function-name-preservation)

---

## C17: Default Function Export Flattening

**File**: [`src/lib/helpers/api_builder/decisions.mjs`](../src/lib/helpers/api_builder/decisions.mjs#L516-L715)  
**Function**: `buildCategoryDecisions(categoryPath, options)`  
**Line**: [687](../src/lib/helpers/api_builder/decisions.mjs#L687)  
**Condition**: `if (typeof mod === "function" && (!mod.name || mod.name === "default" || mod.__slothletDefault === true) && currentDepth > 0)`  
**Purpose**: Flatten functions marked as default exports (not at root level)  
**Input**: Function with no name, "default" name, or marked as default export  
**Result**: `shouldFlatten: true, flattenType: "default-function", preferredName: categoryName`  
**Used By**: [API-RULES Rule 4](API-RULES-v2.md#rule-4-default-export-object-flattening)

---

## C18: Object Auto-Flatten (Final Check)

**File**: [`src/lib/helpers/api_builder/decisions.mjs`](../src/lib/helpers/api_builder/decisions.mjs#L516-L715)  
**Function**: `buildCategoryDecisions(categoryPath, options)`  
**Line**: [704](../src/lib/helpers/api_builder/decisions.mjs#L704)  
**Condition**: `if (moduleKeys.length === 1 && moduleKeys[0] === moduleName)`  
**Purpose**: Auto-flatten when module has single named export matching filename (final check for single-file case)  
**Input**: Single named export with name matching module name  
**Result**: `shouldFlatten: true, flattenType: "object-auto-flatten", preferredName: moduleName`  
**Used By**: [API-RULES Rule 7](API-RULES-v2.md#rule-7-auto-flattening-single-named-export)

---

## Cross-Reference Index

**By Rule Number**:

**By Rule Number**:

- **Rule 1**: [C05](#c05-filename-matches-container-category-level-flatten), [C09](#c09-flatten-to-rootcategory), [C13](#c13-filename-folder-exact-match-flattening)
- **Rule 2**: [C10](#c10-single-file-function-folder-match), [C13](#c13-filename-folder-exact-match-flattening)
- **Rule 4**: [C11](#c11-default-export-flattening), [C17](#c17-default-function-export-flattening)
- **Rule 5**: [C02](#c02-multi-default-context-with-default-export), [C03](#c03-multi-default-context-without-default-export)
- **Rule 6**: [C01](#c01-self-referential-check), [C09a](#c09a-self-referential-non-function)
- **Rule 7**: [C04](#c04-auto-flatten-single-named-export-matching-filename), [C08](#c08-auto-flattening), [C12](#c12-object-auto-flatten), [C18](#c18-object-auto-flatten-final-check)
- **Rule 8**: [C14](#c14-parent-level-flattening-generic-filenames)
- **Rule 9**: [C15](#c15-function-name-matches-folder), [C16](#c16-function-name-preference)

**By Flattening Feature**:

- **F01 (Basic Rules)**: [C01](#c01-self-referential-check), [C05](#c05-filename-matches-container-category-level-flatten), [C07](#c07-default-fallback---preserve-as-namespace)
- **F02 (Function Folder Match)**: [C10](#c10-single-file-function-folder-match), [C15](#c15-function-name-matches-folder)
- **F03 (Auto-Flatten)**: [C04](#c04-auto-flatten-single-named-export-matching-filename), [C08](#c08-auto-flattening)
- **F04 (Object Flatten)**: [C11](#c11-default-export-flattening), [C12](#c12-object-auto-flatten)
- **F05 (Processing)**: [C08](#c08-auto-flattening), [C09](#c09-flatten-to-rootcategory), [C09b](#c09b-traditional-namespace-preservation)
- **F06 (Mixed Patterns)**: [C02](#c02-multi-default-context-with-default-export), [C03](#c03-multi-default-context-without-default-export)

---

## Summary

**Total Active Conditions**: 18 documented conditions from actual source code  
**Primary Functions**: 3 main functions containing API generation logic  
**File Locations**: 1 primary source file - decisions.mjs

### Condition Categories

- **Basic Flattening** (C01-C07): Core flattening decision logic from `getFlatteningDecision()`
- **Module Processing** (C08-C09b): Module handling from `processModuleForAPI()`
- **Single-File Decisions** (C10-C18): Directory-level logic from `buildCategoryDecisions()`

### Key Architectural Patterns

1. **Self-Referential Protection**: Conditions C01, C09a prevent circular structures
2. **Multi-Default Coordination**: Conditions C02, C03 handle mixed export patterns
3. **Smart Flattening**: Auto-detection conditions C04, C08 reduce unnecessary nesting
4. **Filename Matching**: Conditions C10-C13 handle folder/file name matching
5. **Function Name Preference**: Conditions C15-C16 preserve semantic naming

### Implementation Notes

- **Line Numbers**: All verified against commit `a50531d1ba712f0c4efd9ab9b7cf8f62a0d379da`
- **GitHub Links**: Use `#Lxxx-Lyyy` format for precise source navigation
- **Test Verification**: Each condition has corresponding test cases in `/tests/` directory
- **Debug Support**: Most conditions log decisions when `config.debug` is enabled

---

## Document Maintenance

**Version**: 2.0  
**Last Full Audit**: January 3, 2026  
**Status**: ✅ **COMPLETE** - All conditions documented with technical details  
**Cross-References**: Complete integration with API-RULES-v2.md and API-FLATTENING-v2.md  
**Next Review**: When source code conditions change or new features are added

**Verification Commands**:

```bash
# Test all condition behaviors
npm run debug  # Runs comprehensive API validation
npm run test:node  # Core functionality tests

# Verify specific conditions
node tests/debug-slothlet.mjs --slothletdebug  # Detailed decision tracing
```

This section maps conditions to the higher-level documentation they support.

## Summary

**Total Active Conditions**: 33 documented conditions (2 commented out: C06, C31)  
**Primary Functions**: 6 key functions containing API generation logic  
**File Locations**: 3 source files across api_builder/ modules

### Condition Categories

- **Basic Flattening** (C01-C07): Core flattening decision logic
- **Module Processing** (C08-C09d): Individual module handling
- **Category Decisions** (C10-C21d): Directory-level coordination
- **Structural Assembly** (C22-C26): Final API structure building
- **Multi-Default Logic** (C27-C32): Specialized multi-default handling
- **AddApi Special Cases** (C33): Always-flatten AddApi behavior

### Key Architectural Patterns

1. **Self-Referential Protection**: Multiple conditions (C01, C08b, C09c, C20, C27) prevent circular structures
2. **Multi-Default Coordination**: Specialized handling (C02, C03, C08a, C21b, C28, C29) prevents naming conflicts
3. **Smart Flattening**: Auto-detection (C04, C05, C12, C13, C18, C30) reduces unnecessary nesting
4. **Name Preservation**: Function name preference (C16, C19) maintains semantic meaning
5. **Depth Awareness**: Many conditions check `currentDepth` to preserve root-level structure
6. **Special Cases**: AddApi files (C33) get always-flatten treatment for API extension

---

## Document Maintenance

**Version**: 2.0  
**Last Full Audit**: January 3, 2026  
**Lines Verified**: All line numbers manually verified against source code  
**Cross-References**: Enhanced linking to API-RULES-v2.md and API-FLATTENING-v2.md  
**Links**: All GitHub-style links use `#Lxxx-Lyyy` format for precise navigation

**Next Steps**:

- Verify line numbers after any source code changes
- Update cross-references when higher-level documentation changes

---

## C19-C22: Rule 12 Module Ownership Conditions

**Functionality**: Module ownership tracking and selective API overwriting validation  
**Primary Rule**: [Rule 12 - Module Ownership and Selective API Overwriting](API-RULES-v2.md#rule-12-module-ownership-and-selective-api-overwriting)  
**Source Code**: [slothlet.mjs](../src/slothlet.mjs) (ownership tracking), [add_api.mjs](../src/lib/helpers/api_builder/add_api.mjs) (validation)

### C19: Configuration Validation Condition

**Code Location**: [slothlet.mjs#L85-L90](../src/slothlet.mjs#L85-L90)

```javascript
if (options.forceOverwrite && !this._config.enableModuleOwnership) {
	throw new Error("forceOverwrite requires enableModuleOwnership: true in slothlet configuration");
}
```

**Triggers**: `options.forceOverwrite === true && this._config.enableModuleOwnership !== true`  
**Logic**: Configuration consistency validation  
**Result**: Throws error requiring enableModuleOwnership for forceOverwrite operations

### C20: Module ID Requirement Condition

**Code Location**: [slothlet.mjs#L90-L95](../src/slothlet.mjs#L90-L95)

```javascript
if (options.forceOverwrite && !options.moduleId) {
	throw new Error("forceOverwrite requires moduleId parameter for ownership tracking");
}
```

**Triggers**: `options.forceOverwrite === true && !options.moduleId`  
**Logic**: Module identification requirement for ownership tracking  
**Result**: Throws error requiring moduleId for ownership-tracked operations

### C21: Function Ownership Validation Condition

**Code Location**: [add_api.mjs#L145-L155](../src/lib/helpers/api_builder/add_api.mjs#L145-L155)

```javascript
if (currentTarget[finalKey] !== undefined && typeof currentTarget[finalKey] === "function" && this._config.enableModuleOwnership) {
	const existingOwner = this._getApiOwnership(fullPath);
	if (existingOwner && existingOwner !== options.moduleId) {
		throw new Error(
			`Cannot overwrite API "${fullPath}" - owned by module "${existingOwner}", attempted by module "${options.moduleId}". Modules can only overwrite APIs they own.`
		);
	}
}
```

**Triggers**: Function overwrite attempt with ownership tracking enabled  
**Logic**: Cross-module ownership violation detection for functions  
**Result**: Throws error if moduleId doesn't match existing function owner

### C22: Object Ownership Validation Condition

**Code Location**: [add_api.mjs#L160-L170](../src/lib/helpers/api_builder/add_api.mjs#L160-L170)

```javascript
if (currentTarget[finalKey] !== undefined && this._config.enableModuleOwnership && options.moduleId) {
	const existingOwner = this._getApiOwnership(fullPath);
	if (existingOwner && existingOwner !== options.moduleId) {
		throw new Error(
			`Cannot overwrite API "${fullPath}" - owned by module "${existingOwner}", attempted by module "${options.moduleId}". Modules can only overwrite APIs they own.`
		);
	}
}
```

**Triggers**: Object/namespace overwrite attempt with ownership tracking enabled  
**Logic**: Cross-module ownership violation detection for objects/namespaces  
**Result**: Throws error if moduleId doesn't match existing object owner

**Common Implementation Pattern**:

- ✅ Ownership tracking via `Map<string, string>` in `_moduleOwnership`
- ✅ Registration via `_registerApiOwnership(apiPath, moduleId)`
- ✅ Validation via `_getApiOwnership(apiPath)` lookup
- ✅ Cross-module protection regardless of `allowApiOverwrite` setting

---

## C33: AddApi Special File Detection

**Category**: AddApi  
**Related Rule**: [Rule 11](API-RULES-v2.md#rule-11-addapi-special-file-pattern)  
**Flattening Guide**: [F06: AddApi Special File Pattern](API-FLATTENING-v2.md#f06-addapi-special-file-pattern)  
**Status**: ✅ **VERIFIED** (api_tests/api_smart_flatten_addapi)

**Pattern**: Files named `addapi.mjs` loaded via `addApi()` method always flatten regardless of `autoFlatten` setting

**Purpose**: Designed for seamless API namespace extensions - `addapi.mjs` files should extend the target API path directly without creating an intermediate `.addapi.` namespace level

**Implementation Location**: [src/lib/helpers/api_builder/add_api.mjs](../../src/lib/helpers/api_builder/add_api.mjs#L266-L310) (lines 266-310)

**When Evaluated**: During `addApiFromFolder()` execution, after modules are loaded but before they are merged into the API

**Condition Check**:

```javascript
// Rule 6: AddApi Special File Pattern - Handle addapi.mjs flattening
// Check if the loaded modules contain an 'addapi' key and flatten it
if (newModules && typeof newModules === "object" && newModules.addapi) {
	if (instance.config.debug) {
		console.log(`[DEBUG] addApi: Found addapi.mjs - applying Rule 6 flattening`);
		console.log(`[DEBUG] addApi: Original structure:`, Object.keys(newModules));
		console.log(`[DEBUG] addApi: Addapi contents:`, Object.keys(newModules.addapi));
	}

	// Extract the addapi module content
	const addapiContent = newModules.addapi;

	// Remove the addapi key from newModules
	delete newModules.addapi;

	// Merge addapi content directly into the root level of newModules
	if (addapiContent && typeof addapiContent === "object") {
		// Handle both function exports and object exports
		Object.assign(newModules, addapiContent);

		if (instance.config.debug) {
			console.log(`[DEBUG] addApi: After addapi flattening:`, Object.keys(newModules));
		}
	} else if (typeof addapiContent === "function") {
		// If addapi exports a single function, merge its properties
		Object.assign(newModules, addapiContent);

		if (instance.config.debug) {
			console.log(`[DEBUG] addApi: Flattened addapi function with properties:`, Object.keys(newModules));
		}
	}
}
```

**Example Structure**:

```text
plugin-folder/
└── addapi.mjs
    export function initializePlugin() {...}
    export function cleanup() {...}
    export function configure() {...}
```

**API Usage**:

```javascript
// Load plugin folder via addApi
await api.addApi("plugins", "./plugin-folder");

// Result: addapi.mjs always flattens (no .addapi. level)
api.plugins.initializePlugin(); // ✅ Direct extension
api.plugins.cleanup(); // ✅ Seamless integration
api.plugins.configure(); // ✅ No intermediate namespace
```

**Without C33 Behavior** (hypothetical):

```javascript
// Without special handling, would create nested structure
api.plugins.addapi.initializePlugin(); // ❌ Unwanted intermediate level
api.plugins.addapi.cleanup(); // ❌ Breaks API extension pattern
```

**Key Implementation Details**:

1. **Detection**: Checks for `newModules.addapi` key in loaded module structure
2. **Extraction**: Stores content of `addapi` module in `addapiContent` variable
3. **Removal**: Deletes the `addapi` key from `newModules` to prevent namespace creation
4. **Flattening**: Merges all exports from `addapi.mjs` directly into root level of `newModules`
5. **Type Handling**: Supports both object exports and function exports with properties

**Use Cases**:

- 🔌 **Plugin Systems**: Runtime plugin loading that extends existing API namespaces
- 🔄 **Hot Reloading**: Dynamic API updates during development without intermediate levels
- 📦 **Modular Extensions**: Clean extension of existing API surfaces
- 🎯 **Targeted Integration**: Specific API namespace enhancement for add-on functionality

**Behavior Characteristics**:

- ✅ **Always Active**: Works regardless of `autoFlatten` configuration setting
- ✅ **Priority Processing**: Occurs before other flattening rules are applied
- ✅ **Transparent Integration**: Exports appear as if they were originally part of target namespace
- ✅ **Works with addApi Only**: Special handling only applies to `addApi()` method, not initial load

**Result**: `addapi.mjs` file contents are merged directly at the target API path level, eliminating the intermediate `.addapi.` namespace

**Common Implementation Pattern**:

- ✅ Detection via `newModules.addapi` property check
- ✅ Extraction and deletion of `addapi` key
- ✅ Direct merge using `Object.assign(newModules, addapiContent)`
- ✅ Support for both object and function exports
