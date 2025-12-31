# Slothlet Source Code Conditions Reference

**Reference Document for All API Generation Conditional Logic**

- **Commit ID**: `a50531d1ba712f0c4efd9ab9b7cf8f62a0d379da`
- **Date**: December 30, 2025
- **Purpose**: Complete traceability of all conditional statements that control slothlet API structure generation
- **Status**: ? **CURRENT AND ACCURATE**

---

## Overview

This document catalogs every conditional statement in slothlet's API generation system. Each condition is numbered (C01, C02, etc.) with exact line numbers and direct links to source code.

**Core Decision Functions:**

- [`getFlatteningDecision()`](#getflatteningdecision-conditions) - 4 rules controlling when modules flatten
- [`processModuleForAPI()`](#processmoduleforapi-conditions) - 9 conditions for module processing
- [`buildCategoryDecisions()`](#buildcategorydecisions-conditions) - 11 decisions for directory structure
- [`buildCategoryStructure()`](#buildcategorystructure-conditions) - 6 structural assembly conditions
- [`multidefault_getFlatteningDecision()`](#multidefault_getflatteningdecision-conditions) - 4 multi-default rules

---

## Table of Contents

1. [getFlatteningDecision() Conditions](#getflatteningdecision-conditions) (4 rules)
2. [processModuleForAPI() Conditions](#processmoduleforapi-conditions) (9 conditions)
3. [buildCategoryDecisions() Conditions](#buildcategorydecisions-conditions) (11 decisions)
4. [buildCategoryStructure() Conditions](#buildcategorystructure-conditions) (6 structural)
5. [multidefault_getFlatteningDecision() Conditions](#multidefault_getflatteningdecision-conditions) (4 rules)

---

## getFlatteningDecision() Conditions

**File**: [`src/lib/helpers/api_builder/decisions.mjs`](../src/lib/helpers/api_builder/decisions.mjs#L87-L189)  
**Function**: `getFlatteningDecision(options)`  
**Lines**: [87-189](../src/lib/helpers/api_builder/decisions.mjs#L87-L189)

This function determines whether and how to flatten module exports to avoid unnecessary nesting.

### C01: Self-Referential Check

**Line**: [105](../src/lib/helpers/api_builder/decisions.mjs#L105)  
**Condition**: `if (isSelfReferential)`  
**Purpose**: Self-referential exports (where filename matches an exported property) never flatten to avoid infinite nesting  
**Result**: `shouldFlatten: false, preserveAsNamespace: true`  
**Reason**: `"self-referential export"`

**Example**: `math.mjs` exports `{ math: { add, subtract } }` → preserves as namespace to avoid circular structure

---

### C02: Multi-Default Context With Default Export

**Line**: [117](../src/lib/helpers/api_builder/decisions.mjs#L117)  
**Condition**: `if (hasMultipleDefaultExports)` → [118](../src/lib/helpers/api_builder/decisions.mjs#L118): `if (moduleHasDefault)`  
**Purpose**: In multi-default context, modules WITH default exports are preserved as namespaces to avoid conflicts  
**Result**: `shouldFlatten: false, preserveAsNamespace: true`  
**Reason**: `"multi-default context with default export"`

**Example**: Folder has 3 files with default exports → each keeps namespace to prevent collision

---

### C03: Multi-Default Context Without Default Export

**Line**: [117](../src/lib/helpers/api_builder/decisions.mjs#L117) → [129](../src/lib/helpers/api_builder/decisions.mjs#L129): `else`  
**Condition**: `if (hasMultipleDefaultExports)` → `else` (when !moduleHasDefault)  
**Purpose**: In multi-default context, modules WITHOUT default exports flatten to avoid empty namespaces  
**Result**: `shouldFlatten: true, flattenToRoot: true, flattenToCategory: true`  
**Reason**: `"multi-default context without default export"`

**Example**: Folder has mix of default/named exports → named-only files flatten to category level

---

### C04: Auto-Flatten Single Named Export Matching Filename

**Line**: [142](../src/lib/helpers/api_builder/decisions.mjs#L142)  
**Condition**: `if (moduleKeys.length === 1 && moduleKeys[0] === apiPathKey)`  
**Purpose**: When module exports single named export matching filename, use the export directly  
**Result**: `shouldFlatten: true, useAutoFlattening: true`  
**Reason**: `"auto-flatten single named export matching filename"`

**Example**: `math.mjs` exports `{ math: { add } }` → becomes `api.math.add()` not `api.math.math.add()`

---

### C05: Filename Matches Container (Category-Level Flatten)

**Line**: [154](../src/lib/helpers/api_builder/decisions.mjs#L154)  
**Condition**: `if (categoryName && fileName === categoryName && !moduleHasDefault && moduleKeys.length > 0)`  
**Purpose**: When filename matches folder name and has named exports but no default, flatten to category level  
**Result**: `shouldFlatten: true, flattenToCategory: true`  
**Reason**: `"filename matches container, flatten to category"`

**Example**: `math/math.mjs` with named exports → flattens to `api.math.add()` not `api.math.math.add()`

---

### C06: Single File Context (COMMENTED OUT)

**Lines**: [169-182](../src/lib/helpers/api_builder/decisions.mjs#L169-L182)  
**Status**: ?? **DISABLED** - Commented out in current code  
**Original Purpose**: Flatten single-file folders with named exports only  
**Comment**: "This rule reduces API path flexibility. If users want flattening, they can use other rules like naming the file to match the folder."

---

### C07: Default Fallback - Preserve as Namespace

**Line**: [184](../src/lib/helpers/api_builder/decisions.mjs#L184)  
**Condition**: Default case (no conditions matched)  
**Purpose**: Traditional namespace preservation when no flattening rules apply  
**Result**: `shouldFlatten: false, preserveAsNamespace: true`  
**Reason**: `"traditional namespace preservation"`

---

## processModuleForAPI() Conditions

**File**: [`src/lib/helpers/api_builder/decisions.mjs`](../src/lib/helpers/api_builder/decisions.mjs#L315-L466)  
**Function**: `processModuleForAPI(options)`  
**Lines**: [315-466](../src/lib/helpers/api_builder/decisions.mjs#L315-L466)

This function processes individual modules and determines how they integrate into the API structure.

### C08: Has Default Function Export

**Line**: [345](../src/lib/helpers/api_builder/decisions.mjs#L345)  
**Condition**: `if (hasDefaultFunction)`  
**Purpose**: Handles modules that export functions as default (either direct function or mod.default function)  
**Branches**: 3 major sub-conditions (C08a, C08b, C08c)

---

#### C08a: Multi-Default Function (Non-Self-Referential)

**Line**: [351](../src/lib/helpers/api_builder/decisions.mjs#L351)  
**Condition**: `if (hasMultipleDefaultExports && !isSelfReferential)`  
**Purpose**: In multi-default context, function defaults use filename as API key to avoid conflicts  
**Result**: `apiAssignments[apiPathKey] = mod, namespaced = true`

**Example**: Multiple files with function defaults → each uses filename as namespace key

---

#### C08b: Self-Referential Function

**Line**: [361](../src/lib/helpers/api_builder/decisions.mjs#L361)  
**Condition**: `else if (isSelfReferential)`  
**Purpose**: Self-referential function exports preserve as namespace  
**Result**: `apiAssignments[apiPathKey] = mod, namespaced = true`

**Example**: `logger.mjs` exports function with `logger` property → preserves namespace structure

---

#### C08c: Traditional Default Function - Root API

**Line**: [378](../src/lib/helpers/api_builder/decisions.mjs#L378)  
**Condition**: `if (mode === "root" && getRootDefault && setRootDefault && !hasMultipleDefaultExports && !getRootDefault())`  
**Purpose**: In root context with no existing root function, set as the callable root API  
**Result**: `setRootDefault(defaultFunction), rootDefaultSet = true`

**Example**: Root folder has single default function → API becomes callable: `api()`

---

#### C08d: Function As Namespace (Subfolder Context)

**Line**: [387](../src/lib/helpers/api_builder/decisions.mjs#L387)  
**Condition**: `else` (when C08c doesn't apply)  
**Purpose**: In subfolder context or when root already exists, treat function as namespace  
**Result**: `apiAssignments[apiPathKey] = mod, namespaced = true`

---

### C09: Non-Function Modules (Objects/Named Exports)

**Line**: [398](../src/lib/helpers/api_builder/decisions.mjs#L398)  
**Condition**: `else` (when !hasDefaultFunction)  
**Purpose**: Handles object exports, named-only exports, and non-function defaults  
**Branches**: 4 sub-conditions based on flattening decision

---

#### C09a: Use Auto-Flattening

**Line**: [425](../src/lib/helpers/api_builder/decisions.mjs#L425)  
**Condition**: `if (decision.useAutoFlattening)`  
**Purpose**: Apply auto-flattening decision from getFlatteningDecision()  
**Result**: `apiAssignments[apiPathKey] = mod[moduleKeys[0]], flattened = true`

---

#### C09b: Flatten To Root/Category

**Line**: [429](../src/lib/helpers/api_builder/decisions.mjs#L429)  
**Condition**: `else if (decision.flattenToRoot || decision.flattenToCategory)`  
**Purpose**: Merge all named exports into target based on flattening decision  
**Result**: Loop assigns `apiAssignments[key] = mod[key], flattened = true`

---

#### C09c: Self-Referential Non-Function

**Line**: [440](../src/lib/helpers/api_builder/decisions.mjs#L440)  
**Condition**: `else if (isSelfReferential)`  
**Purpose**: Self-referential non-function exports use direct property access  
**Result**: `apiAssignments[apiPathKey] = mod[apiPathKey] || mod, namespaced = true`

---

#### C09d: Traditional Namespace Preservation

**Line**: [444](../src/lib/helpers/api_builder/decisions.mjs#L444)  
**Condition**: `else`  
**Purpose**: Default behavior preserves module as namespace  
**Result**: `apiAssignments[apiPathKey] = mod, namespaced = true`

---

## buildCategoryDecisions() Conditions

**File**: [`src/lib/helpers/api_builder/decisions.mjs`](../src/lib/helpers/api_builder/decisions.mjs#L505-L899)  
**Function**: `buildCategoryDecisions(categoryPath, options)`  
**Lines**: [505-899](../src/lib/helpers/api_builder/decisions.mjs#L505-L899)

Centralized category building decisions - analyzes directories and returns structural decisions.

### C10: Single-File Function Folder Match

**Line**: [584](../src/lib/helpers/api_builder/decisions.mjs#L584)  
**Condition**: `if (moduleName === categoryName && typeof mod === "function" && currentDepth > 0)`  
**Purpose**: Flatten when filename matches folder name and exports function (not at root level)  
**Result**: `shouldFlatten: true, flattenType: "function-folder-match"`

**Example**: `nest/nest.mjs` exports function → becomes `api.nest()` not `api.nest.nest()`

---

### C11: Default Export Flattening (CJS/ESM Uniform)

**Line**: [593](../src/lib/helpers/api_builder/decisions.mjs#L593)  
**Condition**: `if (analysis.hasDefault && analysis.defaultExportType === "object" && moduleName === categoryName && currentDepth > 0)`  
**Purpose**: Flatten default object exports when filename matches folder (handles both CJS and ESM uniformly)  
**Result**: `shouldFlatten: true, flattenType: "default-export-flatten"`

---

### C12: Object Auto-Flatten (Single Named Export Match)

**Line**: [604](../src/lib/helpers/api_builder/decisions.mjs#L604)  
**Condition**: `if (moduleName === categoryName && mod && typeof mod === "object" && !Array.isArray(mod) && currentDepth > 0)`  
**Sub-condition**: [609](../src/lib/helpers/api_builder/decisions.mjs#L609): `if (moduleKeys.length === 1 && moduleKeys[0] === moduleName)`  
**Purpose**: When single named export matches filename, flatten the object contents  
**Result**: `shouldFlatten: true, flattenType: "object-auto-flatten"`

---

### C13: Filename-Folder Exact Match Flattening

**Line**: [619](../src/lib/helpers/api_builder/decisions.mjs#L619)  
**Condition**: `if (fileBaseName === categoryName && moduleKeys.length > 0)`  
**Purpose**: Avoid double nesting when file basename matches folder (e.g., nest/nest.mjs)  
**Result**: `shouldFlatten: true, flattenType: "filename-folder-match-flatten"`

---

### C14: Parent-Level Flattening (Generic Filenames)

**Line**: [641](../src/lib/helpers/api_builder/decisions.mjs#L641)  
**Condition**: `if (moduleFiles.length === 1 && currentDepth > 0 && mod && typeof mod === "object" && !Array.isArray(mod))`  
**Sub-condition**: [649](../src/lib/helpers/api_builder/decisions.mjs#L649): `if (moduleKeys.length === 1 && isGenericFilename)`  
**Purpose**: Eliminate intermediate namespace for generic filenames (singlefile, index, main, default)  
**Result**: `shouldFlatten: true, flattenType: "parent-level-flatten"`

**Example**: `nest4/singlefile.mjs` → `api.nest4.beta()` not `api.nest4.singlefile.beta()`

---

### C15: Function Name Matches Folder

**Line**: [663](../src/lib/helpers/api_builder/decisions.mjs#L663)  
**Condition**: `if (functionNameMatchesFolder && currentDepth > 0)`  
**Purpose**: Flatten when function name matches folder name (case-insensitive), prefer function name  
**Result**: `shouldFlatten: true, flattenType: "function-folder-match", preferredName: mod.name`

---

### C16: Function Name Matches Filename (Name Preference)

**Line**: [671](../src/lib/helpers/api_builder/decisions.mjs#L671)  
**Condition**: `if (functionNameMatchesFilename)`  
**Purpose**: Use original function name instead of sanitized filename when they match semantically  
**Result**: `shouldFlatten: false, preferredName: mod.name`

**Example**: `auto-ip.mjs` exports `autoIP` function → uses `autoIP` not `autoIp`

---

### C17: Default Function Export

**Line**: [680](../src/lib/helpers/api_builder/decisions.mjs#L680)  
**Condition**: `if (typeof mod === "function" && (!mod.name || mod.name === "default" || mod.__slothletDefault === true) && currentDepth > 0)`  
**Purpose**: Flatten functions marked as default exports (not at root level)  
**Result**: `shouldFlatten: true, flattenType: "default-function"`

---

### C18: Single Named Export Match (Secondary Check)

**Line**: [693](../src/lib/helpers/api_builder/decisions.mjs#L693)  
**Condition**: `if (moduleKeys.length === 1 && moduleKeys[0] === moduleName)`  
**Purpose**: Auto-flatten when module exports single named export matching filename  
**Result**: `shouldFlatten: true, flattenType: "object-auto-flatten"`

---

### C19: Multi-File Function with Preferred Name

**Line**: [844](../src/lib/helpers/api_builder/decisions.mjs#L844)  
**Condition**: `if (hasPreferredName)` (from function name preference logic)  
**Purpose**: Use original function names over sanitized filenames when they match semantically  
**Result**: `specialHandling: "preferred-export-names"`

---

### C20: Multi-File Self-Referential

**Line**: [846](../src/lib/helpers/api_builder/decisions.mjs#L846)  
**Condition**: `else if (selfReferentialFiles.has(moduleName))`  
**Purpose**: Self-referential files in multi-file context get special namespace handling  
**Result**: `type: "self-referential"`

---

### C21: Multi-File Flattening Scenarios

**Line**: [753](../src/lib/helpers/api_builder/decisions.mjs#L753)  
**Condition**: `else` (standard multi-file processing)  
**Sub-conditions**: 4 flattening scenarios (C21a-C21d)

#### C21a: Single Default Object

**Line**: [859](../src/lib/helpers/api_builder/decisions.mjs#L859)  
**Condition**: `if (!hasMultipleDefaultExports && mod.default && typeof mod.default === "object")`  
**Result**: `shouldFlatten: true, flattenType: "single-default-object"`

#### C21b: Multi-Default No Default

**Line**: [863](../src/lib/helpers/api_builder/decisions.mjs#L863)  
**Condition**: `else if (hasMultipleDefaultExports && !mod.default && moduleKeys.length > 0)`  
**Result**: `shouldFlatten: true, flattenType: "multi-default-no-default"`

#### C21c: Single Named Export Match

**Line**: [867](../src/lib/helpers/api_builder/decisions.mjs#L867)  
**Condition**: `else if (moduleKeys.length === 1 && moduleKeys[0] === apiPathKey)`  
**Result**: `shouldFlatten: true, flattenType: "single-named-export-match"`

#### C21d: Category Name Match Flatten

**Line**: [873](../src/lib/helpers/api_builder/decisions.mjs#L873)  
**Condition**: `else if (!mod.default && moduleKeys.length > 0 && moduleName === categoryName)`  
**Result**: `shouldFlatten: true, flattenType: "category-name-match-flatten"`

---

## buildCategoryStructure() Conditions

**File**: [`src/lib/helpers/api_builder/construction.mjs`](../src/lib/helpers/api_builder/construction.mjs#L125-L555)  
**Function**: `buildCategoryStructure(categoryPath, options)`  
**Lines**: [125-555](../src/lib/helpers/api_builder/construction.mjs#L125-L555)

Assembles the actual API structure based on decisions from buildCategoryDecisions().

### C22: Single-File Flattening Cases

**Line**: [145](../src/lib/helpers/api_builder/construction.mjs#L145)  
**Condition**: `if (decisions.shouldFlatten)`  
**Purpose**: Apply flattening decisions to single-file cases  
**Branches**: 5 flatten types handled via switch statement [146-175](../src/lib/helpers/api_builder/construction.mjs#L146-L175)

### C23: Single-File Preferred Name (No Flatten)

**Line**: [180](../src/lib/helpers/api_builder/construction.mjs#L180)  
**Condition**: `if (decisions.preferredName && decisions.preferredName !== moduleName)`  
**Purpose**: Use preferred name without flattening  
**Result**: `return { [decisions.preferredName]: mod }`

### C24: Category Merge Special Handling

**Line**: [195](../src/lib/helpers/api_builder/construction.mjs#L195)  
**Condition**: `if (specialHandling === "category-merge")`  
**Purpose**: Merge logic when module filename matches category name  
**Result**: Merges module contents into categoryModules

### C25: Multi-File Flattening

**Line**: [217](../src/lib/helpers/api_builder/construction.mjs#L217)  
**Condition**: `if (shouldFlatten)`  
**Purpose**: Apply various flattening strategies in multi-file context  
**Branches**: Switch statement handling 4 flatten types [218-318](../src/lib/helpers/api_builder/construction.mjs#L218-L318)

**Special Case - Double Proxy Layer**: [245-290](../src/lib/helpers/api_builder/construction.mjs#L245-L290)  
When Proxy assignment fails, creates wrapper proxy to ensure API completeness while preserving original proxy behavior

### C26: Upward Flattening (Single Key Matching Category)

**Line**: [384](../src/lib/helpers/api_builder/construction.mjs#L384)  
**Condition**: `if (keys.length === 1)`  
**Sub-condition**: [386](../src/lib/helpers/api_builder/construction.mjs#L386): `if (singleKey === categoryName)`  
**Purpose**: When category contains single key matching category name, flatten upward  
**Result**: Return contents directly, avoiding redundant nesting

---

## multidefault_getFlatteningDecision() Conditions

**File**: [`src/lib/helpers/multidefault.mjs`](../src/lib/helpers/multidefault.mjs#L178-L262)  
**Function**: `multidefault_getFlatteningDecision(options)`  
**Lines**: [178-262](../src/lib/helpers/multidefault.mjs#L178-L262)

Specialized flattening logic for multi-default export contexts.

### C27: Multi-Default Self-Referential

**Line**: [199](../src/lib/helpers/multidefault.mjs#L199)  
**Condition**: `if (isSelfReferential)`  
**Purpose**: Self-referential default exports in multi-default context preserve as namespace  
**Result**: `shouldFlatten: false, preserveAsNamespace: true`  
**Reason**: `"self-referential default export"`

### C28: Multi-Default With Default Export

**Line**: [202](../src/lib/helpers/multidefault.mjs#L202)  
**Condition**: `if (hasMultipleDefaultExports)` → [203](../src/lib/helpers/multidefault.mjs#L203): `if (moduleHasDefault)`  
**Purpose**: Modules WITH default exports in multi-default context preserve as namespaces  
**Result**: `shouldFlatten: false, preserveAsNamespace: true`  
**Reason**: `"multi-default context with default export"`

### C29: Multi-Default Without Default Export

**Line**: [209](../src/lib/helpers/multidefault.mjs#L209) ? [219](../src/lib/helpers/multidefault.mjs#L219): `else`
**Condition**: `if (hasMultipleDefaultExports)` → `else` (when !moduleHasDefault)  
**Purpose**: Modules WITHOUT default exports in multi-default context flatten to root  
**Result**: `shouldFlatten: true, flattenToRoot: true`  
**Reason**: `"multi-default context without default export"`

### C30: Single Named Export Match

**Line**: [227](../src/lib/helpers/multidefault.mjs#L227)  
**Condition**: `if (moduleKeys.length === 1 && moduleKeys[0] === apiPathKey)`  
**Purpose**: Single named export matching filename in multi-default context  
**Result**: `shouldFlatten: true, flattenToRoot: false`  
**Reason**: `"single named export matching filename"`

### C31: Single File No Default (Commented Out)

**Lines**: [238-247](../src/lib/helpers/multidefault.mjs#L238-L247)  
**Status**: ⚠️ **DISABLED** - Commented out  
**Original Purpose**: Flatten single file with named exports only in multi-default context

### C32: Default Namespace Preservation

**Line**: [250](../src/lib/helpers/multidefault.mjs#L250)  
**Condition**: Default case  
**Purpose**: Preserve as namespace when no multi-default flattening rules apply  
**Result**: `shouldFlatten: false, preserveAsNamespace: true`  
**Reason**: `"default namespace preservation"`

---

## Summary

**Total Active Conditions**: 32 documented conditions (2 commented out: C06, C31)  
**Primary Functions**: 5 key functions containing API generation logic  
**File Locations**: 3 source files across api_builder/ and multidefault.mjs

### Condition Categories

- **Flattening Rules** (7): C01-C07
- **Module Processing** (9): C08-C09d
- **Category Decisions** (13): C10-C21d
- **Structural Assembly** (5): C22-C26
- **Multi-Default Logic** (6): C27-C32

### Key Architectural Patterns

1. **Self-Referential Protection**: Multiple conditions (C01, C08b, C09c, C20, C27) prevent circular structures
2. **Multi-Default Coordination**: Specialized handling (C02, C03, C08a, C21b, C28, C29) prevents naming conflicts
3. **Smart Flattening**: Auto-detection (C04, C05, C12, C13, C18, C30) reduces unnecessary nesting
4. **Name Preservation**: Function name preference (C16, C19) maintains semantic meaning
5. **Depth Awareness**: Many conditions check `currentDepth > 0` to preserve root-level structure

---

## Document Maintenance

**Last Full Audit**: December 30, 2025  
**Commit**: a50531d1ba712f0c4efd9ab9b7cf8f62a0d379da  
**Lines Verified**: All line numbers manually verified against source code  
**Links**: All GitHub-style links use `#Lxxx-Lyyy` format for precise navigation
