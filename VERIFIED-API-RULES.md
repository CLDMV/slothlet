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

- [ ] Rule 1: Auto-flattening in Single-file Folders
- [ ] Rule 2: Root Contributors with Named Exports
- [ ] Rule 3: Object Export Preservation
- [ ] Rule 4: Named-Only Export Collection
- [ ] Rule 5: Empty Module Handling
- [ ] Rules 6-18: _[TO BE VERIFIED]_

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
    apiAssignments[apiKey] = mod;
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
	apiAssignments[apiKey] = mod;
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

## Source Code Locations

_To be populated as rules are verified_

## Test File Index

_To be populated with confirmed examples from actual test files_
