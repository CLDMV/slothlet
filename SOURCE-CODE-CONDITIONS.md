# Slothlet Source Code Conditions Reference

**Reference Document for All API Generation Conditional Logic**

- **Commit ID**: `c2f081a321c738f86196fdfdb19b6a5a706022ef`
- **Date**: October 27, 2025
- **Purpose**: Complete traceability of all conditional statements that control slothlet API structure generation

---

## Table of Contents

1. [getFlatteningDecision() Conditions](#getflatteningdecision-conditions)
2. [processModuleForAPI() Conditions](#processmoduleforapi-conditions)
3. [buildCategoryStructure() Single-File Conditions](#buildcategorystructure-single-file-conditions)
4. [buildCategoryDecisions() Multi-File Conditions](#buildcategorydecisions-multi-file-conditions)
5. [multidefault_getFlatteningDecision() Conditions](#multidefault_getflatteningdecision-conditions)

---

## getFlatteningDecision() Conditions

**File**: `src/lib/helpers/api_builder.mjs`  
**Function**: `getFlatteningDecision(options)`  
**Lines**: 544-632  
**Commit**: `c2f081a321c738f86196fdfdb19b6a5a706022ef`

### C01: Self-Referential Check

**Line**: 558  
**Condition**: `if (isSelfReferential)`  
**Description**: Self-referential exports (where filename matches an exported property) never flatten to avoid infinite nesting  
**Result**: Returns `preserveAsNamespace: true, shouldFlatten: false`

### C02: Multi-Default Context With Default

**Line**: 570  
**Condition**: `if (hasMultipleDefaultExports)` → `if (moduleHasDefault)`  
**Description**: In multi-default context, modules WITH default exports are preserved as namespaces  
**Result**: Returns `preserveAsNamespace: true, shouldFlatten: false`

### C03: Multi-Default Context Without Default

**Line**: 570 → 580  
**Condition**: `if (hasMultipleDefaultExports)` → `else` (when !moduleHasDefault)  
**Description**: In multi-default context, modules WITHOUT default exports are flattened to avoid empty namespaces  
**Result**: Returns `shouldFlatten: true, flattenToRoot: true, flattenToCategory: true`

### C04: Auto-Flatten Single Named Export

**Line**: 593  
**Condition**: `if (moduleKeys.length === 1 && moduleKeys[0] === apiPathKey)`  
**Description**: When module exports single named export matching filename, use the export directly  
**Result**: Returns `shouldFlatten: true, useAutoFlattening: true`

### C05: Filename Matches Container

**Line**: 605  
**Condition**: `if (categoryName && fileName === categoryName && !moduleHasDefault && moduleKeys.length > 0)`  
**Description**: When filename matches folder name and has named exports but no default, flatten to category level  
**Result**: Returns `shouldFlatten: true, flattenToCategory: true`

### C06: Single File Context

**Line**: 617  
**Condition**: `if (totalModules === 1 && !moduleHasDefault && moduleKeys.length > 0)`  
**Description**: In single-file context with named exports only, flatten to eliminate unnecessary nesting  
**Result**: Returns `shouldFlatten: true, flattenToRoot: true, flattenToCategory: true`

### C07: Default Fallback

**Line**: 629  
**Condition**: Default case (no conditions matched)  
**Description**: Traditional namespace preservation when no flattening rules apply  
**Result**: Returns `preserveAsNamespace: true, shouldFlatten: false`

---

## processModuleForAPI() Conditions

**File**: `src/lib/helpers/api_builder.mjs`  
**Function**: `processModuleForAPI(options)`  
**Lines**: 685-826  
**Commit**: `c2f081a321c738f86196fdfdb19b6a5a706022ef`

### C08: Has Default Function

**Line**: 713  
**Condition**: `if (hasDefaultFunction)`  
**Description**: Handles modules that export functions as default (either direct function or mod.default function)

#### C08a: Multi-Default Function Non-Self-Referential

**Line**: 716  
**Condition**: `if (hasMultipleDefaultExports && !isSelfReferential)`  
**Description**: In multi-default context, function defaults use filename as API key to avoid conflicts  
**Result**: `apiAssignments[apiPathKey] = mod, namespaced = true`

#### C08b: Self-Referential Function

**Line**: 728  
**Condition**: `else if (isSelfReferential)`  
**Description**: Self-referential function exports preserve as namespace  
**Result**: `apiAssignments[apiPathKey] = mod, namespaced = true`

#### C08c: Traditional Default Function

**Line**: 736 → 748  
**Condition**: `else` → `if (mode === "root" && getRootDefault && setRootDefault && !hasMultipleDefaultExports && !getRootDefault())`  
**Description**: In root context with no existing root function, set as the callable root API  
**Result**: `setRootDefault(defaultFunction), rootDefaultSet = true`

#### C08d: Function As Namespace

**Line**: 758  
**Condition**: `else` (when C08c doesn't apply)  
**Description**: In subfolder context or when root already exists, treat function as namespace  
**Result**: `apiAssignments[apiPathKey] = mod, namespaced = true`

### C09: Non-Function Modules

**Line**: 766  
**Condition**: `else` (when !hasDefaultFunction)  
**Description**: Handles object exports, named-only exports, and non-function defaults

#### C09a: Use Auto-Flattening

**Line**: 782  
**Condition**: `if (decision.useAutoFlattening)`  
**Description**: Apply auto-flattening decision from getFlatteningDecision()  
**Result**: `apiAssignments[apiPathKey] = mod[moduleKeys[0]], flattened = true`

#### C09b: Flatten To Root/Category

**Line**: 786  
**Condition**: `else if (decision.flattenToRoot || decision.flattenToCategory)`  
**Description**: Merge all named exports into target based on flattening decision  
**Result**: Loop assigns `apiAssignments[key] = mod[key], flattened = true`

#### C09c: Self-Referential Non-Function

**Line**: 797  
**Condition**: `else if (isSelfReferential)`  
**Description**: Self-referential non-function exports use direct property access  
**Result**: `apiAssignments[apiPathKey] = mod[apiPathKey] || mod, namespaced = true`

#### C09d: Traditional Namespace

**Line**: 801  
**Condition**: `else`  
**Description**: Default behavior preserves module as namespace  
**Result**: `apiAssignments[apiPathKey] = mod, namespaced = true`

---

## buildCategoryStructure() Single-File Conditions

**File**: `src/lib/helpers/api_builder.mjs`  
**Function**: `buildCategoryStructure(categoryPath, options)`  
**Lines**: 950-1080  
**Commit**: `c2f081a321c738f86196fdfdb19b6a5a706022ef`

### C10: Single-File Function Folder Match

**Line**: 984  
**Condition**: `if (moduleName === categoryName && typeof mod === "function" && currentDepth > 0)`  
**Description**: Flatten when filename matches folder name and exports function (not at root level)  
**Result**: Return function directly with name set to categoryName

### C11: Single-File Object Folder Match

**Line**: 994  
**Condition**: `if (moduleName === categoryName && mod && typeof mod === "object" && !Array.isArray(mod) && currentDepth > 0)`  
**Description**: Handle object exports where filename matches folder name (not at root level)

#### C11a: Single Named Export Match

**Line**: 1000  
**Condition**: `if (moduleKeys.length === 1 && moduleKeys[0] === moduleName)`  
**Description**: When single named export matches filename, return the export contents directly  
**Result**: `return mod[moduleName]`

#### C11b: Multiple Exports (Default Spread)

**Line**: 1009  
**Condition**: `if (moduleKeys.length > 1)`  
**Description**: Multiple exports indicate spread default + named exports, flatten the merged object  
**Result**: `return mod` (already spread)

#### C11c: Folder Match Fallback

**Line**: Default case within C11  
**Description**: Other object cases where filename matches folder  
**Result**: `return mod`

### C12: Parent-Level Flattening

**Line**: 1018  
**Condition**: `if (moduleFiles.length === 1 && currentDepth > 0 && mod && typeof mod === "object" && !Array.isArray(mod))`  
**Description**: Eliminate intermediate filename namespace for generic filenames

#### C12a: Generic Filename Single Export

**Line**: 1026  
**Condition**: `if (moduleKeys.length === 1 && isGenericFilename)`  
**Description**: Single export with generic filename (singlefile, index, main, default) gets promoted  
**Result**: `return { [moduleKeys[0]]: exportValue }`

### C13: Function Name Matches Folder

**Line**: 1039  
**Condition**: `if (functionNameMatchesFolder && currentDepth > 0)`  
**Description**: Function name matches folder name case-insensitively (not at root level)  
**Result**: Return function directly with preserved name

### C14: Function Name Matches Filename

**Line**: 1049  
**Condition**: `if (functionNameMatchesFilename)`  
**Description**: Use original function name instead of sanitized filename when they match semantically  
**Result**: `return { [mod.name]: mod }`

### C15: Default Function Export

**Line**: 1053  
**Condition**: `if (typeof mod === "function" && (!mod.name || mod.name === "default" || mod.__slothletDefault === true) && currentDepth > 0)`  
**Description**: Flatten functions marked as default exports (not at root level)  
**Result**: Return function directly with name set to categoryName

### C16: Auto-Flatten Single Named Export

**Line**: 1063  
**Condition**: `if (moduleKeys.length === 1 && moduleKeys[0] === moduleName)`  
**Description**: Second instance for auto-flattening single named export matching filename  
**Result**: `return mod[moduleName]`

### C17: Single-File Default Fallback

**Line**: 1067  
**Condition**: Default case for single files  
**Description**: Preserve as namespace when no flattening rules apply  
**Result**: `return { [moduleName]: mod }`

---

## buildCategoryDecisions() Multi-File Conditions

**File**: `src/lib/helpers/api_builder.mjs`  
**Function**: `buildCategoryDecisions(categoryPath, options)`  
**Lines**: 1710-1750  
**Commit**: `c2f081a321c738f86196fdfdb19b6a5a706022ef`

### C18: Has Preferred Export Names

**Line**: 1709  
**Condition**: `if (hasPreferredName)` (from function name preference logic)  
**Description**: Use original function names over sanitized filenames when they match semantically  
**Result**: `moduleDecision.specialHandling = "preferred-export-names"`

### C19: Self-Referential Multi-File

**Line**: 1712  
**Condition**: `else if (selfReferentialFiles.has(moduleName))`  
**Description**: Self-referential files in multi-file context get special namespace handling  
**Result**: `moduleDecision.type = "self-referential"`

### C20: Multi-File Flattening Scenarios

**Line**: 1715  
**Condition**: `else` (when not preferred names or self-referential)  
**Description**: Various flattening scenarios for standard multi-file processing

#### C20a: Single Default Object

**Line**: 1723  
**Condition**: `if (!hasMultipleDefaultExports && mod.default && typeof mod.default === "object")`  
**Description**: Single default export object (not in multi-default context) gets flattened  
**Result**: `moduleDecision.shouldFlatten = true, flattenType = "single-default-object"`

#### C20b: Multi-Default No Default

**Line**: 1727  
**Condition**: `else if (hasMultipleDefaultExports && !mod.default && moduleKeys.length > 0)`  
**Description**: In multi-default context, modules WITHOUT defaults are flattened to category  
**Result**: `moduleDecision.shouldFlatten = true, flattenType = "multi-default-no-default"`

#### C20c: Single Named Export Match

**Line**: 1731  
**Condition**: `else if (moduleKeys.length === 1 && moduleKeys[0] === apiPathKey)`  
**Description**: Auto-flatten when module exports single named export matching filename  
**Result**: `moduleDecision.shouldFlatten = true, flattenType = "single-named-export-match"`

#### C20d: Category Name Match Flatten

**Line**: 1736  
**Condition**: `else if (!mod.default && moduleKeys.length > 0 && moduleName === categoryName)`  
**Description**: Module filename matches folder name with no default → flatten to category  
**Result**: `moduleDecision.shouldFlatten = true, flattenType = "category-name-match-flatten"`

#### C20e: Standard Object Export

**Line**: 1740  
**Condition**: `else`  
**Description**: Standard object export without special flattening  
**Result**: `moduleDecision.apiPathKey = apiPathKey`

---

## multidefault_getFlatteningDecision() Conditions

**File**: `src/lib/helpers/multidefault.mjs`  
**Function**: `multidefault_getFlatteningDecision(options)`  
**Lines**: 168-220  
**Commit**: `c2f081a321c738f86196fdfdb19b6a5a706022ef`

### C21: Multi-Default Self-Referential

**Line**: 168  
**Condition**: `if (isSelfReferential)`  
**Description**: Self-referential default exports in multi-default context treat as namespace  
**Result**: Returns `shouldFlatten: false, preserveAsNamespace: true`

### C22: Multi-Default With Default

**Line**: 178 → 179  
**Condition**: `if (hasMultipleDefaultExports)` → `if (moduleHasDefault)`  
**Description**: Multi-default context modules WITH default exports preserve as namespaces  
**Result**: Returns `shouldFlatten: false, preserveAsNamespace: true`

### C23: Multi-Default Without Default

**Line**: 178 → 186  
**Condition**: `if (hasMultipleDefaultExports)` → `else` (when !moduleHasDefault)  
**Description**: Multi-default context modules WITHOUT default exports flatten to root  
**Result**: Returns `shouldFlatten: true, flattenToRoot: true`

### C24: Multi-Default Single Named Export

**Line**: 200  
**Condition**: `if (moduleKeys.length === 1 && moduleKeys[0] === apiPathKey)`  
**Description**: Single named export matching filename in multi-default context  
**Result**: Returns `shouldFlatten: true, flattenToRoot: false`

### C25: Multi-Default Single File No Default

**Line**: 211  
**Condition**: `if (!moduleHasDefault && moduleKeys.length > 0 && totalModuleCount === 1)`  
**Description**: Single file with no default, only named exports in multi-default context  
**Result**: Returns `shouldFlatten: true, flattenToRoot: true`

### C26: Multi-Default Default Fallback

**Line**: 220+  
**Condition**: Default case (no conditions matched)  
**Description**: Preserve as namespace when no multi-default flattening rules apply  
**Result**: Returns `preserveAsNamespace: true, shouldFlatten: false`

---

## Summary

**Total Conditions Found**: 26 distinct conditional statements (plus their nested conditions)  
**Primary Functions**: 5 key functions containing API generation logic  
**Coverage Gap**: Previous VERIFIED-API-RULES.md documented only 2 of these 26 conditions

**Key Finding**: The majority of slothlet's API structure decisions are controlled by these 26 conditions across 5 functions. Any changes to API generation behavior require understanding and potentially modifying these conditional statements.
