# AGENT-USAGE.md: Building Slothlet API Folders

> **Critical**: This guide prevents AI agents from making architectural mistakes when building Slothlet API modules.

## 📋 **Related Documentation**

- **[API-RULES.md](./API-RULES.md)** - 778+ lines of verified API transformation rules with test examples
- **[README.md](./README.md)** - Complete project overview and usage examples
- **[api_tests/\*/README.md](./api_tests/)** - Live examples demonstrating each pattern mentioned below

---

## 🚫 NEVER DO: Cross-Module Imports

**The #1 mistake AI agents make with Slothlet**: Trying to import API files from each other.

```js
// ❌ WRONG - Do NOT import API modules from each other
import { math } from "./math/math.mjs"; // BREAKS SLOTHLET
import { config } from "../config.mjs"; // BREAKS SLOTHLET
import { util } from "./util/util.mjs"; // BREAKS SLOTHLET

// ❌ WRONG - Do NOT use relative imports between API modules
import { someFunction } from "../../other-api.mjs"; // BREAKS SLOTHLET
```

**Why this breaks Slothlet**:

- Slothlet builds your API structure dynamically
- Cross-imports create circular dependencies
- Breaks lazy loading and context isolation
- Defeats the purpose of module loading framework

## ✅ CORRECT: Use Slothlet's Live-Binding System

```js
// ✅ CORRECT - Import from Slothlet runtime for cross-module access
import { self, context, reference } from "@cldmv/slothlet/runtime";

// ✅ CORRECT - Access other modules through `self`
export const myModule = {
	async processData(input) {
		// Access other API modules via `self`
		const mathResult = self.math.add(2, 3);
		const configValue = self.config.get("setting");

		return `Processed: ${input}, Math: ${mathResult}, Config: ${configValue}`;
	}
};
```

## 🏗️ Slothlet API Module Patterns

### Pattern 1: Simple Object Export (Most Common)

**File**: `math/math.mjs` → **API**: `api.math.add()`, `api.math.multiply()`

```js
/**
 * @fileoverview Math operations module. Internal file (not exported in package.json).
 * @module api_test.math
 * @memberof module:api_test
 */

// ✅ Import runtime for cross-module access (if needed)
// import { self, context, reference } from "@cldmv/slothlet/runtime";

/**
 * Math operations object accessed as `api.math`.
 * @alias module:api_test.math
 */
export const math = {
	add(a, b) {
		return a + b;
	},

	multiply(a, b) {
		return a * b;
	}
};
```

**Result**: Filename matches folder (`math/math.mjs`) → Auto-flattening → `api.math.add()` (not `api.math.math.add()`)

> 📖 **See**: [API-RULES.md Rule 1](./API-RULES.md#rule-1-filename-matches-container-flattening) for technical implementation details

### Pattern 2: Multiple Files in Folder

**Files**: `multi/alpha.mjs`, `multi/beta.mjs` → **API**: `api.multi.alpha.hello()`, `api.multi.beta.world()`

```js
// File: multi/alpha.mjs
export const alpha = {
	hello() {
		return "alpha hello";
	}
};

// File: multi/beta.mjs
export const beta = {
	world() {
		return "beta world";
	}
};
```

**Result**: Different filenames from folder → No flattening → Nested structure preserved

> 📖 **See**: [API-RULES.md Rule 2](./API-RULES.md#rule-2-named-only-export-collection) for multi-file folder processing

### Pattern 3: Default Function Export

**File**: `funcmod/funcmod.mjs` → **API**: `api.funcmod(name)`

```js
/**
 * Default function export accessed as `api.funcmod()`.
 * @param {string} name - Name to greet
 * @returns {string} Greeting message
 */
export default function funcmod(name) {
	return `Hello, ${name}!`;
}
```

**Result**: Filename matches folder + default export → Function flattened to `api.funcmod()`

### Pattern 4: Root-Level API Functions

**File**: `root-function.mjs` → **API**: `api(name)` + `api.rootFunctionShout()`

```js
// ✅ Root-level file creates top-level API methods
export default function greet(name) {
	return `Hello, ${name}!`;
}

export function rootFunctionShout(message) {
	return message.toUpperCase();
}
```

**Result**: Root file with default export → `api()` callable + named exports as `api.methodName()`

> 📖 **See**: [API-RULES.md Rule 4](./API-RULES.md#rule-4-default-export-container-pattern) for root-level default export handling

## 🔄 Cross-Module Communication Patterns

### ✅ Using Live Bindings

```js
// File: interop/esm-module.mjs
import { self, context } from "@cldmv/slothlet/runtime";

export const interopEsm = {
	async testCrossCall(a, b) {
		console.log(`ESM Context: User=${context.user}`);

		// ✅ CORRECT - Access other modules via self
		if (self?.mathCjs?.multiply) {
			const result = self.mathCjs.multiply(a, b);
			return result;
		}

		throw new Error("CJS mathCjs.multiply not available via self");
	}
};
```

### ✅ Context Isolation

```js
// Each Slothlet instance gets isolated context
const api1 = await slothlet({
	dir: "./api",
	context: { user: "alice", session: "session1" }
});

const api2 = await slothlet({
	dir: "./api",
	context: { user: "bob", session: "session2" }
});

// Contexts are isolated - alice can't see bob's data
```

## 📁 File Organization Best Practices

### ✅ Clean Folder Structure

```text
api/
├── config.mjs              → api.config.*
├── math/
│   └── math.mjs            → api.math.* (flattened)
├── util/
│   ├── util.mjs            → api.util.* (flattened methods)
│   ├── extract.mjs         → api.util.extract.*
│   └── controller.mjs      → api.util.controller.*
├── nested/
│   └── date/
│       └── date.mjs        → api.nested.date.*
└── multi/
    ├── alpha.mjs           → api.multi.alpha.*
    └── beta.mjs            → api.multi.beta.*
```

### ✅ Module Naming Conventions

- **Filename matches folder** → Auto-flattening (cleaner API)
- **Different filename** → Nested structure preserved
- **Dash-separated names** → camelCase API (`auto-ip.mjs` → `api.autoIP`)
- **Function name preference** → Original capitalization preserved (`autoIP`, `parseJSON`) - [See API-RULES.md Rule 9](./API-RULES.md#rule-9-function-name-preference-over-sanitization)

## 🧪 JSDoc Documentation Patterns

> 📖 **For detailed JSDoc templates and examples**, see [.github/copilot-instructions.md - JSDoc Standards](./.github/copilot-instructions.md#-jsdoc-standards--patterns)

### ✅ Primary Module File (One per folder)

```js
/**
 * @fileoverview Math operations for API testing.
 * @module api_test
 * @name api_test
 * @alias @cldmv/slothlet/api_tests/api_test
 */
```

### ✅ Secondary Contributing Files

```js
/**
 * @fileoverview Math utilities. Internal file (not exported in package.json).
 * @module api_test.math
 * @memberof module:api_test
 */
```

### ✅ Live-Binding Imports Pattern

```js
// ✅ Always include runtime imports (even if commented out for structure)
// import { self, context, reference } from "@cldmv/slothlet/runtime";
```

## 🚨 Common AI Agent Mistakes

> 📖 **For complete technical details on all API transformation rules**, see [API-RULES.md](./API-RULES.md) (778+ lines of verified examples)

### ❌ Mistake 1: Cross-Module Imports

```js
// ❌ WRONG
import { config } from "./config.mjs";
```

### ❌ Mistake 2: Missing Runtime Imports

```js
// ❌ WRONG - No way to access other modules
export const module = {
	method() {
		// How do I access other modules? 🤔
	}
};
```

### ❌ Mistake 3: Wrong JSDoc Module Patterns

```js
// ❌ WRONG - Multiple @module declarations create duplicates
/**
 * @module api_test     ← Already declared elsewhere
 * @module api_test.math  ← Should only use @memberof
 */
```

### ❌ Mistake 4: Breaking Auto-Flattening

```js
// File: math/calculator.mjs  (different name than folder)
export const math = {
	/* methods */
};
// Result: api.math.calculator.math.* (nested, not flattened)

// ✅ CORRECT: File math/math.mjs
export const math = {
	/* methods */
};
// Result: api.math.* (flattened)
```

## ✅ AI Agent Checklist

When building Slothlet API modules:

- [ ] **NO cross-module imports** - Use `self` from runtime instead
- [ ] **Import runtime** - `import { self, context, reference } from "@cldmv/slothlet/runtime"`
- [ ] **Match filename to folder** for cleaner APIs (auto-flattening)
- [ ] **Use proper JSDoc patterns** - One `@module` per folder, `@memberof` for secondary files
- [ ] **Test cross-module access** via `self.otherModule.method()`
- [ ] **Include context usage** if module needs user/session data
- [ ] **Double quotes everywhere** - Follow Slothlet coding standards

## 📚 Reference Examples

- **Auto-flattening**: `api_tests/api_test/math/math.mjs`
- **Multi-file folders**: `api_tests/api_test/multi/`
- **Cross-module calls**: `api_tests/api_test_mixed/interop/`
- **Root-level APIs**: `api_tests/api_test/root-function.mjs`
- **Nested structures**: `api_tests/api_test/nested/date/`

## 📖 Essential Documentation for AI Agents

### 🏗️ **Core Architecture & Patterns**

- **[`API-RULES.md`](./API-RULES.md)** - **CRITICAL** - Comprehensive verified rules for API transformation (778+ lines of verified examples)
- **[`API-RULES-CONDITIONS.md`](./API-RULES-CONDITIONS.md)** - Technical reference for all conditional logic controlling API generation

### � **Usage & Installation**

- **[`README.md`](./README.md)** - Complete project overview, installation, and usage examples

### 🧪 **Live Examples & Patterns**

- **[`api_tests/api_test/README.md`](./api_tests/api_test/README.md)** - ESM module patterns and filename-folder flattening
- **[`api_tests/api_test_cjs/README.md`](./api_tests/api_test_cjs/)** - CommonJS module patterns and interoperability
- **[`api_tests/api_test_mixed/README.md`](./api_tests/api_test_mixed/)** - Mixed ESM/CJS patterns and live-binding examples

### 🔧 **Advanced Pattern Documentation**

- **[`docs/api_tests/`](./docs/api_tests/)** - Generated documentation for all test module patterns

### ⚡ **Critical Reading Order for AI Agents**

1. **This file (`AGENT-USAGE.md`)** - Prevents major architectural mistakes
2. **[`README.md`](./README.md)** - Complete project context and installation
3. **[`API-RULES.md`](./API-RULES.md)** - Understand verified API transformation patterns
4. **[`api_tests/*/README.md`](./api_tests/)** - Live examples of each pattern

Understanding these patterns and documentation is essential for building effective Slothlet APIs that work with the framework rather than against it.
