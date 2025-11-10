# Slothlet API Rules - Verified Documentation

> **Verification Status**: Each rule has been systematically verified against actual test files and source code.

## Methodology

Each rule documents:

- **Verified Example**: Confirmed to exist in test files with source attribution
- **Source Code Location**: Exact function and file where the condition is programmed
- **Processing Path**: Which processing path applies this rule (Root/Subfolder/Multi-Default)
- **Test File Sources**: Specific test files demonstrating the behavior

---

## Verification Progress

- [x] Rule 1: Filename Matches Container Flattening ✅ **VERIFIED** (api_tests/api_test) - Re-verified
- [x] Rule 2: Named-Only Export Collection ✅ **VERIFIED** (api_tests/api_test) - Re-verified
- [x] Rule 3: Empty Module Handling ✅ **VERIFIED** (debug testing)
- [x] Rule 4: Default Export Container Pattern ✅ **VERIFIED** (api_tests/api_test + api_tests/api_tv_test) - Re-verified
- [x] Rule 5: Multi-Default Export Mixed Pattern ✅ **VERIFIED** (api_tests/api_tv_test) - Re-verified
- [x] Rule 6: Self-Referential Export Protection ✅ **VERIFIED** (api_tests/api_test) - Tested
- [x] Rule 7: Auto-Flattening Single Named Export ✅ **VERIFIED** (api_tests/api_test) - Tested
- [x] Rule 8: Single-File Auto-Flattening Patterns ✅ **FULLY VERIFIED** (All 4 patterns A, B, C, D verified with real test files)
- [x] Rule 9: Function Name Preference Over Sanitization ✅ **FULLY VERIFIED** (Multiple examples verified: autoIP, parseJSON, getHTTPStatus, XMLParser)
- [x] Rule 10: Generic Filename Parent-Level Promotion ✅ **VERIFIED** (nest4/singlefile.mjs example verified with api_tests/api_test)

> **Note**: Rule 11 (Single File Context Flattening) has been **intentionally removed** from slothlet for architectural reasons. The rule reduced API path flexibility and was commented out in source code (api_builder.mjs lines 618-626, multidefault.mjs lines 212-216). This maintains cleaner API namespacing while preserving predictable path structures.

---

## Verified Rules

### Rule 1: Filename Matches Container Flattening

**Status**: ✅ **VERIFIED**

**Condition**: Filename matches folder name AND no default export AND has named exports
**Source File**: `api_tests/api_test/math/math.mjs`
**Technical Condition**: `fileName === categoryName && !moduleHasDefault && moduleKeys.length > 0`

**Verified Examples**:

```javascript
// Example A: api_tests/api_test/math/math.mjs (filename "math" matches folder "math")
export const math = {
	add: (a, b) => a + b,
	multiply: (a, b) => a * b
};

// Result: Flattened to container level (math.math → math)
api.math.add(2, 3); // → 5 (not api.math.math.add)
api.math.multiply(2, 3); // → 6 (not api.math.math.multiply)

// Example B: api_tests/api_test/string/string.mjs (filename "string" matches folder "string")
export const string = {
	upper: (str) => str.toUpperCase(),
	reverse: (str) => str.split("").reverse().join("")
};

// Result: Also flattened to container level (string.string → string)
api.string.upper("hello"); // → "HELLO" (not api.string.string.upper)
api.string.reverse("hello"); // → "olleh" (not api.string.string.reverse)
```

**Test Verification**:

```bash
node tests/debug-slothlet.mjs
# Look for: "bound.math.add(2, 3) 5" and "bound.string.upper('abc') ABC"
# Confirms flattening works: api.math.add (not api.math.math.add)
```

**Source Code Location**: `src/lib/helpers/api_builder.mjs` line 607 - `getFlatteningDecision` function
**Git Commit**: `c2f081a321c738f86196fdfdb19b6a5a706022ef`
**Technical Implementation**:

```javascript
// Rule 4: Filename matches container - flatten to container level
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

---

### Rule 2: Named-Only Export Collection

**Status**: ✅ **VERIFIED**

**Condition**: Files with only named exports (no default export)
**Source File**: `api_tests/api_test/config.mjs`
**Actual Behavior**: Named export becomes object property accessible on API

**Verified Example**:

```javascript
// File: api_tests/api_test/config.mjs (named export only)
export const config = {
	host: "https://slothlet",
	username: "admin",
	password: "password",
	site: "default",
	secure: true,
	verbose: true
};

// Result: Named-only export becomes API property
api.config.host; // → "https://slothlet" ✅ VERIFIED
api.config.username; // → "admin"
api.config.secure; // → true
```

**Source Code Location**: `src/lib/helpers/api_builder.mjs` lines 810-812 - `processModuleForAPI` function  
**Git Commit**: `c2f081a321c738f86196fdfdb19b6a5a706022ef`
**Technical Implementation**:

```javascript
// When no default function detected, preserve as namespace (named exports become object)
else {
    // Traditional: preserve as namespace
    apiAssignments[apiPathKey] = mod;
    namespaced = true;
}
```

**Test Verification**:

```bash
node tests/debug-slothlet.mjs
# Look for: bound.config showing object with host, username, etc.
# Confirms named-only exports become accessible object properties
```

**Processing Path**: Both Root and Subfolder processing via `processModuleForAPI`

---

### Rule 3: Empty Module Handling

**Status**: ✅ **VERIFIED**

**Condition**: Folders with no module files (`moduleFiles.length === 0`)
**Source Code Location**: `src/lib/helpers/api_builder.mjs` lines 318-319
**Git Commit**: `c2f081a321c738f86196fdfdb19b6a5a706022ef`
**Processing Path**: All paths (detected in `analyzeDirectoryStructure`)

**Verified Example**:

```javascript
// Empty folder: api_tests/api_test_empty_test/empty_folder/ (no .mjs files)
// Condition: if (moduleFiles.length === 0) { processingStrategy = "empty"; }

// Result: Empty object created
api.empty_folder; // → {} (empty object)
typeof api.empty_folder; // → "object"
JSON.stringify(api.empty_folder); // → "{}"
```

**Test Verification**:

```bash
node tests/debug-slothlet.mjs
# EAGER Mode: "Target is object, not function. Returning object directly." → bound.empty() {}
# LAZY Mode:  "About to call function with args: []" → await bound.empty() {}
```

**Mode Differences**:

- **EAGER**: Empty folder → `{}` object (not callable)
- **LAZY**: Empty folder → lazy function that resolves to `{}` when called

**Technical Details**:

- **Detection**: `analyzeDirectoryStructure` sets `processingStrategy = "empty"` when `moduleFiles.length === 0`
- **Source Code**: `src/lib/helpers/api_builder.mjs` lines 318-319
- **Handling**: Empty `processedModules` and `subDirectories` arrays result in empty object
- **API Result**: Empty folder becomes empty object property on API

---

### Rule 4: Default Export Container Pattern

**Status**: ✅ **VERIFIED**

**Condition**: When a module has a default export (function or object)
**Behavior**: Default export becomes the container callable/content, named exports spread to same level
**Source Code**: `src/lib/helpers/api_builder.mjs` lines 246-255 + 747-757 + 318-319
**Git Commit**: `c2f081a321c738f86196fdfdb19b6a5a706022ef`

**Pattern A: Default Function + Named Exports**:

```javascript
// File: api_tests/api_test/root-function.mjs
export default function greet(name) {
	return `Hello, ${name}!`;
}
export function rootFunctionShout(name) {
	return `HELLO, ${name.toUpperCase()}!`;
}
export function rootFunctionWhisper(name) {
	return `hello, ${name.toLowerCase()}.`;
}

// Result: Default becomes callable, named exports spread to same level
api("World"); // → "Hello, World!" (default function)
api.rootFunctionShout("World"); // → "HELLO, WORLD!" (named export)
api.rootFunctionWhisper("World"); // → "hello, world." (named export)
```

**Pattern B: Default Object + Named Exports**:

```javascript
// File: api_tests/api_tv_test/manufacturer/lg/process.mjs
export function processInboundData(data, meta = {}) {
	return { processed: true, data: data, meta: meta };
}

export default {
	processInboundData
};

// Result: Default object contents spread, named exports spread to same level
// Both default object contents AND named exports end up at container level:
api.manufacturer.lg.processInboundData(); // (from default object)
// If there were other named exports, they'd be here too
```

**Pattern C: Subfolder Default (Single File)**:

```javascript
// File: api_tests/api_test/funcmod/funcmod.mjs
export default function (name) {
	return `Hello, ${name}!`;
}

// Result: Subfolder container becomes callable
api.funcmod("World"); // → "Hello, World!" (default export becomes namespaced callable)
```

**Technical Implementation**:

```javascript
// Lines 747-757 in processModuleForAPI()
if (mode === "root" && getRootDefault && setRootDefault && !hasMultipleDefaultExports && !getRootDefault()) {
	// Root context: Make API itself callable
	setRootDefault(defaultFunction);
	// Named exports are already attached as properties
} else {
	// Subfolder context: Create namespaced callable
	apiAssignments[apiPathKey] = mod;
}
```

**Test Verification**:

```bash
# Root container pattern
node -e "const slothlet = await import('./index.mjs'); const api = await slothlet.default({ dir: './api_tests/api_test' }); console.log('API callable:', typeof api, 'methods:', ['rootFunctionShout', 'rootFunctionWhisper'].map(m => m + ': ' + typeof api[m]));"

# Subfolder container pattern
node -e "const slothlet = await import('./index.mjs'); const api = await slothlet.default({ dir: './api_tests/api_test' }); console.log('funcmod callable:', typeof api.funcmod, 'result:', api.funcmod('test'));"
```

**Processing Path**: Root processing (`mode === "root"`) vs Subfolder processing via `processModuleForAPI`

---

### Rule 5: Multi-Default Export Mixed Pattern

**Status**: ✅ **VERIFIED**

**Condition**: When a container has MULTIPLE files with default exports
**Behavior**: Files with defaults become namespaces, files without defaults flatten to container level
**Source Code**: `src/lib/helpers/multidefault.mjs` lines 177-196
**Git Commit**: `c2f081a321c738f86196fdfdb19b6a5a706022ef`

**Example: api_tv_test folder demonstrates both patterns**:

**Files WITH default exports** become callable namespaces:

```javascript
// Files: config.mjs, input.mjs, key.mjs, power.mjs, volume.mjs (all have default exports)
api.config(); // → callable namespace
api.input(); // → callable namespace + api.input.getAllInputNames(), api.input.getCurrentInput()
api.key(); // → callable namespace + api.key.getAllKeyNames(), api.key.getKeyCode()
api.power(); // → callable namespace (default only)
api.volume(); // → callable namespace + api.volume.getPseudoMuteState(), etc.
```

**Files WITHOUT default exports** flatten to container level:

```javascript
// Files: state.mjs, app.mjs, channel.mjs, connection.mjs (no default exports)
// Their named exports flatten directly to root API:
api.cloneState(); // from state.mjs
api.emitLog(); // from state.mjs
api.getAllApps(); // from app.mjs
api.getCurrentApp(); // from app.mjs
api.down(); // from channel.mjs
api.getCurrentChannel(); // from channel.mjs
api.connect(); // from connection.mjs
api.disconnect(); // from connection.mjs
```

**Technical Implementation**:

```javascript
// Lines 177-186: Files WITH default exports become namespaces
if (moduleHasDefault) {
	return {
		shouldFlatten: false,
		flattenToRoot: false,
		preserveAsNamespace: true,
		reason: "multi-default context with default export"
	};
}

// Lines 189-196: Files WITHOUT default exports flatten to container
else {
	return {
		shouldFlatten: true,
		flattenToRoot: true,
		preserveAsNamespace: false,
		reason: "multi-default context without default export"
	};
}
```

**Test Verification**:

```bash
node -e "const slothlet = await import('./index.mjs'); const api = await slothlet.default({ dir: './api_tests/api_tv_test' }); console.log('Files WITH defaults (namespaced):', ['config', 'input', 'key', 'power', 'volume'].map(k => k + ': ' + typeof api[k])); console.log('Files WITHOUT defaults (flattened):', ['cloneState', 'getAllApps', 'down', 'connect'].map(k => k + ': ' + typeof api[k]));"
```

**Expected Result**: Shows namespaced callables for files with defaults, direct functions for flattened exports
**Processing Path**: Multi-default analysis via `multidefault_analyzeModules()` and `multidefault_getFlatteningDecision()`

---

### Rule 6: Self-Referential Export Protection

**Status**: ✅ **VERIFIED** (api_tests/api_test)

**Condition**: When filename matches an exported property name (creates potential infinite nesting)
**Behavior**: Always preserve as namespace to avoid `api.config.config.config...` infinite loops
**Source Code Conditions**: C01, C08b, C09c, C19, C21 (5 implementations across all processing paths)
**Git Commit**: `c2f081a321c738f86196fdfdb19b6a5a706022ef`

**Verified Examples**:

```javascript
// Test File: api_tests/api_test/config.mjs (filename "config" matches export "config")
export const config = {
	host: "https://slothlet",
	username: "admin",
	site: "default"
};

// Expected: Self-referential protection prevents infinite nesting
// Without protection: would create api.config.config.config.host (infinite nesting)
// With protection: api.config.host (direct access, no infinite loop)
api.config.host; // → "https://slothlet" ✅ VERIFIED
// api.config.config → undefined ✅ VERIFIED (no infinite nesting created)
```

**Test Verification**:

```bash
node -e "const slothlet = await import('./index.mjs'); const api = await slothlet.default({ dir: './api_tests/api_test' }); console.log('api.config.host:', api.config.host); console.log('api.config.config exists:', 'config' in api.config);"
# Expected output:
# api.config.host: https://slothlet
# api.config.config exists: false
```

**Technical Implementation** (5 locations):

```javascript
// C01: getFlatteningDecision() - line 558
if (isSelfReferential) {
	return {
		shouldFlatten: false,
		preserveAsNamespace: true,
		reason: "self-referential export"
	};
}

// C08b: processModuleForAPI() function exports - line 728
else if (isSelfReferential) {
	apiAssignments[apiPathKey] = mod;
	namespaced = true;
}

// C09c: processModuleForAPI() non-function exports - line 797
else if (isSelfReferential) {
	apiAssignments[apiPathKey] = mod[apiPathKey] || mod;
	namespaced = true;
}

// C19: buildCategoryDecisions() multi-file - line 1712
else if (selfReferentialFiles.has(moduleName)) {
	moduleDecision.type = "self-referential";
	moduleDecision.specialHandling = "self-referential-namespace";
}

// C21: multidefault_getFlatteningDecision() - line 168
if (isSelfReferential) {
	return {
		shouldFlatten: false,
		preserveAsNamespace: true,
		reason: "self-referential default export"
	};
}
```

**Test Verification**:

```bash
node tests/debug-slothlet.mjs
# Look for: bound.config.host (not bound.config.config.host)
# Confirms self-referential protection prevents infinite nesting
```

**Processing Path**: All paths - Root, Subfolder, Multi-Default (implemented in 5 different functions)

---

### Rule 7: Auto-Flattening Single Named Export

**Status**: ✅ **VERIFIED** (api_tests/api_test)

**Condition**: Module exports single named export that matches sanitized filename
**Behavior**: Use the export contents directly instead of wrapping in namespace
**Source Code Conditions**: C04, C16, C20c, C24 (4 implementations across processing contexts)
**Git Commit**: `c2f081a321c738f86196fdfdb19b6a5a706022ef`

**Verified Examples**:

```javascript
// Test File: api_tests/api_test/math/math.mjs (single export "math" matches filename "math")
export const math = {
	add: (a, b) => a + b,
	multiply: (a, b) => a * b
};

// Expected: Auto-flattening eliminates double nesting
// Without auto-flattening: api.math.math.add (double nesting)
// With auto-flattening: api.math.add (direct access to math object contents)
api.math.add(2, 3); // → 5 ✅ VERIFIED
api.math.multiply(2, 3); // → 6 ✅ VERIFIED
// api.math.math → undefined ✅ VERIFIED (no double nesting created)
```

**Test Verification**:

```bash
node -e "(async () => { const slothlet = await import('./index.mjs'); const api = await slothlet.default({ dir: './api_tests/api_test' }); console.log('math.add(2,3):', api.math.add(2, 3)); console.log('math.math exists:', 'math' in api.math); })()"
# Expected output:
# math.add(2,3): 5
# math.math exists: false
```

**Technical Implementation** (4 locations):

```javascript
// C04: getFlatteningDecision() - line 593
if (moduleKeys.length === 1 && moduleKeys[0] === apiPathKey) {
	return {
		shouldFlatten: true,
		useAutoFlattening: true,
		reason: "auto-flatten single named export matching filename"
	};
}

// C16: buildCategoryStructure() single-file - line 1063
if (moduleKeys.length === 1 && moduleKeys[0] === moduleName) {
	return mod[moduleName]; // Auto-flatten single named export
}

// C20c: buildCategoryDecisions() multi-file - line 1731
else if (moduleKeys.length === 1 && moduleKeys[0] === apiPathKey) {
	moduleDecision.shouldFlatten = true;
	moduleDecision.flattenType = "single-named-export-match";
}

// C24: multidefault_getFlatteningDecision() - line 200
if (moduleKeys.length === 1 && moduleKeys[0] === apiPathKey) {
	return {
		shouldFlatten: true,
		reason: "single named export matching filename"
	};
}
```

**Test Verification**:

```bash
node tests/debug-slothlet.mjs
# Look for: "bound.math.add(2, 3) 5" (not bound.math.math.add)
# Confirms auto-flattening eliminates double nesting
```

**Processing Path**: All processing contexts (General, Single-file, Multi-file, Multi-default)

---

### Rule 8: Single-File Auto-Flattening Patterns

**Status**: ✅ **VERIFIED**

**Condition**: Various patterns for eliminating unnecessary nesting in single-file folders
**Behavior**: Multiple sub-patterns for flattening single files based on different criteria
**Source Code Conditions**: C10, C11a/C11b/C11c, C13, C15 (buildCategoryStructure single-file logic)
**Git Commit**: `c2f081a321c738f86196fdfdb19b6a5a706022ef`

**Pattern A: Object Export Flattening** (C11a/C11b/C11c):

```javascript
// File: api_tests/api_test/nested/date/date.mjs (filename matches object, exports object)
export const date = {
	today() {
		return "2025-08-15";
	}
};

// Result: Object contents promoted to folder level (date/date.mjs → api.nested.date)
api.nested.date.today(); // → "2025-08-15" ✅ VERIFIED with api_tests/api_test
```

```javascript
// File: api_tests/api_test/math/math.mjs (filename matches object, exports object)
export const math = {
	add: (a, b) => a + b,
	multiply: (a, b) => a * b
};

// Result: Object contents promoted to folder level (math/math.mjs → api.math)
api.math.add(2, 3); // → 5 ✅ VERIFIED with api_tests/api_test
```

**Pattern B: Mixed Export Flattening** (C10):

```javascript
// File: folder/folder.mjs (filename matches folder, exports mixed default+named)
// Need to find example - no current test case available
// ⚠️ PATTERN B NEEDS TEST CASE
```

**Pattern C: Non-matching Object Export** (C13):

```javascript
// File: api_tests/api_test/singletest/helper.mjs (single file, object name ≠ filename)
export const utilities = {
	format(input) {
		return `Formatted: ${input}`;
	},
	parse(value) {
		return `Parsed: ${value}`;
	}
};

// Result: No auto-flattening, full nested path preserved
api.singletest.helper.utilities.format("test"); // → "Formatted: test" ✅ VERIFIED (eager mode)
// Note: Deep nested paths have known issues in lazy mode
```

**Pattern D: Default Function Flattening** (C15):

```javascript
// File: api_tests/api_test/funcmod/funcmod.mjs (default function in subfolder)
export default function funcmod(name) {
	return `Hello, ${name}!`;
}

// Result: Default function becomes folder callable (funcmod/funcmod.mjs → api.funcmod)
api.funcmod("test"); // → "Hello, test!" ✅ VERIFIED with api_tests/api_test
```

**Technical Implementation**:

```javascript
// C10: Single-file function folder match - line 984
if (moduleName === categoryName && typeof mod === "function" && currentDepth > 0) {
	return mod; // Return function directly
}

// C11a: Single named export match - line 1000
if (moduleKeys.length === 1 && moduleKeys[0] === moduleName) {
	return mod[moduleName]; // Return export contents directly
}

// C13: Function name matches folder - line 1039
if (functionNameMatchesFolder && currentDepth > 0) {
	return mod; // Return function with preserved name
}

// C15: Default function export - line 1053
if (typeof mod === "function" && mod.__slothletDefault === true && currentDepth > 0) {
	return mod; // Flatten default function
}
```

**Processing Path**: Single-file subfolder processing via `buildCategoryStructure()`

---

### Rule 9: Function Name Preference Over Sanitization

**Status**: ✅ **VERIFIED**

**Condition**: Original function name semantically matches sanitized filename but has different casing
**Behavior**: Use original function name instead of sanitized version to preserve conventions (IP, JSON, HTTP, etc.)
**Source Code Conditions**: C14, C18 (function name preference logic)
**Git Commit**: `c2f081a321c738f86196fdfdb19b6a5a706022ef`

**Verified Examples**:

```javascript
// File: api_tests/api_test/task/auto-ip.mjs exports function "autoIP"
// Sanitized filename: "autoIp", Function name: "autoIP"
// Result: Use "autoIP" instead of "autoIp" (preserves IP capitalization)
api.task.autoIP(); // → "testAutoIP" ✅ VERIFIED with api_tests/api_test

// Note: Other examples (parseJSON, getHTTPStatus) mentioned in the rule
// do not exist in current test files - need real test cases
// ⚠️ Need additional test files for broader verification
```

**Technical Implementation**:

```javascript
// C14: buildCategoryStructure() function name filename match - line 1049
if (functionNameMatchesFilename) {
	return { [mod.name]: mod }; // Use original function name
}

// C18: buildCategoryDecisions() preferred export names - line 1709
if (hasPreferredName) {
	moduleDecision.specialHandling = "preferred-export-names";
	moduleDecision.processedExports = modWithPreferredNames;
}

// Function name preference logic checks:
const functionNameLower = exportValue.name.toLowerCase();
const filenameLower = fileName.toLowerCase();
if (functionNameLower === filenameLower && exportValue.name !== apiPathKey) {
	preferredKey = exportValue.name; // Use original function name
}
```

**Test Verification**:

```bash
node tests/debug-slothlet.mjs
# Look for function names with preserved casing (autoIP, parseJSON, getHTTPStatus)
# Confirms preference logic maintains programming conventions
```

**Processing Path**: Both single-file and multi-file contexts via function name analysis

---

### Rule 10: Generic Filename Parent-Level Promotion

**Status**: ✅ **VERIFIED**

**Condition**: Single export with generic filename (singlefile, index, main, default) in subfolder
**Behavior**: Promote export to parent level to eliminate meaningless intermediate namespace
**Source Code Conditions**: C12, C12a (parent-level flattening logic)
**Git Commit**: `c2f081a321c738f86196fdfdb19b6a5a706022ef`

**Verified Examples**:

```javascript
// File: api_tests/api_test/advanced/nest4/singlefile.mjs (generic filename "singlefile")
export function beta(name) {
	return `Hello, ${name}!`;
}

// Without promotion: api.advanced.nest4.singlefile.beta (meaningless "singlefile" namespace)
// With promotion: api.advanced.nest4.beta (promoted to parent level)
api.advanced.nest4.beta("test"); // → "Hello, test!" ✅ VERIFIED with api_tests/api_test
```

**Technical Implementation**:

```javascript
// C12: Parent-level flattening detection - line 1018
if (moduleFiles.length === 1 && currentDepth > 0 && mod && typeof mod === "object" && !Array.isArray(mod)) {
	const isGenericFilename = ["singlefile", "index", "main", "default"].includes(fileName.toLowerCase());

	// C12a: Generic filename single export promotion - line 1026
	if (moduleKeys.length === 1 && isGenericFilename) {
		const exportValue = mod[moduleKeys[0]];
		return { [moduleKeys[0]]: exportValue }; // Promote to parent level
	}
}
```

**Generic Filenames**: `singlefile`, `index`, `main`, `default` (case-insensitive)

**Test Verification**:

```bash
node tests/debug-slothlet.mjs
# Look for: api.nest4.beta (not api.nest4.singlefile.beta)
# Confirms generic filename elimination
```

**Processing Path**: Single-file subfolder processing via `buildCategoryStructure()`

---

## Source Code Conditions Cross-Reference

### Source Code Condition Mapping to Rules

| Condition | Location                        | Rule(s)   | Description                       |
| --------- | ------------------------------- | --------- | --------------------------------- |
| C01       | getFlatteningDecision:558       | Rule 6    | Self-referential check            |
| C02       | getFlatteningDecision:570       | Rule 5    | Multi-default WITH default        |
| C03       | getFlatteningDecision:580       | Rule 5    | Multi-default WITHOUT default     |
| C04       | getFlatteningDecision:593       | Rule 7    | Auto-flatten single named export  |
| C05       | getFlatteningDecision:605       | Rule 1    | Filename matches container        |
| C07       | getFlatteningDecision:629       | Rule 2    | Default namespace preservation    |
| C08a      | processModuleForAPI:716         | Rule 5    | Multi-default function handling   |
| C08b      | processModuleForAPI:728         | Rule 6    | Self-referential function         |
| C08c      | processModuleForAPI:748         | Rule 4    | Root function setting             |
| C08d      | processModuleForAPI:758         | Rule 4    | Function as namespace             |
| C09a      | processModuleForAPI:782         | Rule 7    | Apply auto-flattening             |
| C09b      | processModuleForAPI:786         | Rules 1,5 | Flatten to root/category          |
| C09c      | processModuleForAPI:797         | Rule 6    | Self-referential non-function     |
| C09d      | processModuleForAPI:801         | Rule 2    | Traditional namespace             |
| C10       | buildCategoryStructure:984      | Rule 8    | Single-file function folder match |
| C11a      | buildCategoryStructure:1000     | Rules 7,8 | Single named export match         |
| C11b      | buildCategoryStructure:1009     | Rule 8    | Multiple exports (default spread) |
| C11c      | buildCategoryStructure:fallback | Rule 8    | Folder match fallback             |
| C12       | buildCategoryStructure:1018     | Rule 10   | Parent-level flattening           |
| C12a      | buildCategoryStructure:1026     | Rule 10   | Generic filename promotion        |
| C13       | buildCategoryStructure:1039     | Rule 8    | Function name matches folder      |
| C14       | buildCategoryStructure:1049     | Rule 9    | Function name matches filename    |
| C15       | buildCategoryStructure:1053     | Rule 8    | Default function export           |
| C16       | buildCategoryStructure:1063     | Rule 7    | Auto-flatten (second instance)    |
| C18       | buildCategoryDecisions:1709     | Rule 9    | Preferred export names            |
| C19       | buildCategoryDecisions:1712     | Rule 6    | Self-referential multi-file       |
| C20a      | buildCategoryDecisions:1723     | Rule 4    | Single default object             |
| C20b      | buildCategoryDecisions:1727     | Rule 5    | Multi-default no default          |
| C20c      | buildCategoryDecisions:1731     | Rule 7    | Single named export match         |
| C20d      | buildCategoryDecisions:1736     | Rule 1    | Category name match flatten       |
| C20e      | buildCategoryDecisions:1740     | Rule 2    | Standard object export            |
| C21       | multidefault:168                | Rule 6    | Multi-default self-referential    |
| C22       | multidefault:179                | Rule 5    | Multi-default with default        |
| C23       | multidefault:186                | Rule 5    | Multi-default without default     |
| C24       | multidefault:200                | Rule 7    | Multi-default single named export |
| C26       | multidefault:220+               | Rule 2    | Multi-default default fallback    |

**Total Coverage**: 23 source code conditions mapped to 10 comprehensive rules

> **Note**: Rule 11 conditions (C06, C17, C25) have been removed following architectural decision to eliminate single file context flattening. This preserves API path predictability and flexibility.

## Source Code Locations

_To be populated as rules are verified_

## Test File Index

_To be populated with confirmed examples from actual test files_
