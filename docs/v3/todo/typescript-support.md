# TypeScript Support Implementation

**Last Evaluated:** 2026-02-14  
**Status:** ✅ Complete (Fast Mode + Strict Mode)

---

### How to Run Tests Properly

**⚠️ IMPORTANT: Always tail test output (last 40 lines):**
```powershell
npm run debug 2>&1 | Select-Object -Last 40
npm run baseline 2>&1 | Select-Object -Last 40
```

**🧪 Run a single test file:**
```bash
npm run vitest <file>
```
Example:
```bash
npm run vitest tests/vitests/suites/context/per-request-context.test.vitest.mjs
```

**Why tail?**
- ❌ **WRONG:** Running without tailing shows the START of output, not results
- ✅ **CORRECT:** Tailing last 40 lines shows the RESULTS at the end

**📋 When file-based api.add() tests pass 100%:**
- Add related test files to `tests/vitests/baseline-tests.json`
- But ONLY if `npm run debug` AND `npm run baseline` both pass
- This ensures we catch regressions in working tests immediately

---

## Overview

Add native TypeScript support to Slothlet, allowing users to write modules in TypeScript that are automatically transpiled and loaded.

## Installation

TypeScript support uses **peer dependencies** to keep Slothlet lightweight. Install only what you need:

### Fast Mode (esbuild)

```bash
# Install Slothlet
npm install @cldmv/slothlet

# Install esbuild for TypeScript fast mode
npm install esbuild
```

### Strict Mode (tsc)

```bash
# Install Slothlet
npm install @cldmv/slothlet

# Install TypeScript compiler for strict mode
npm install typescript
```

### Both Modes

```bash
# Install all TypeScript dependencies
npm install @cldmv/slothlet esbuild typescript
```

**Why peer dependencies?**
- Slothlet core stays lightweight (~0.5MB)
- Users only install what they need
- esbuild adds ~8MB (only for fast mode users)
- TypeScript adds ~30MB (only for strict mode users)
- No TypeScript? No extra dependencies!

## Implementation Approach

### Architectural Design

**TypeScript support should be implemented as a separate, dedicated module** that is called only when processing `.ts` files. This ensures:

- **Separation of concerns**: Keep TypeScript transformation logic isolated
- **Optional dependency**: TypeScript support doesn't bloat core loading logic
- **Maintainability**: Easy to update or extend TypeScript handling independently
- **Performance**: Only load esbuild when actually needed

### Module Structure

Create a dedicated TypeScript transformation processor:

**File**: `src/lib/processors/typescript.mjs`

```js
import esbuild from "esbuild";
import fs from "fs";

// Lazy-load esbuild - only imported when TypeScript files are encountered
let esbuildInstance = null;

async function getEsbuild() {
  if (!esbuildInstance) {
    try {
      esbuildInstance = await import("esbuild");
    } catch (error) {
      throw new SlothletError("TYPESCRIPT_ESBUILD_NOT_INSTALLED", {
        hint: "Install esbuild: npm install esbuild"
      });
    }
  }
  return esbuildInstance;
}

/**
 * Transform TypeScript code to JavaScript using esbuild
 * @param {string} filePath - Path to the TypeScript file
 * @param {object} options - esbuild transform options
 * @returns {Promise<string>} Transformed JavaScript code
 */
export async function transformTypeScript(filePath, options = {}) {
  const esbuild = await getEsbuild(); // Check at usage time
  const code = fs.readFileSync(filePath, "utf8");
  
  const result = await esbuild.transform(code, {
    loader: "ts",
    format: "esm",
    ...options
  });
  
  return result.code;
}

/**
 * Create a data URL with cache busting for dynamic import
 * @param {string} code - Transformed JavaScript code
 * @returns {string} Data URL with cache bust fragment
 */
export function createDataUrl(code) {
  const bust = Date.now().toString(36);
  return `data:text/javascript,${encodeURIComponent(code)}#${bust}`;
}
```

### Integration Pattern

The loading modes should **call into** the TypeScript processor when needed:

```js
// In slothlet_lazy.mjs or slothlet_eager.mjs
import { transformTypeScript, createDataUrl } from "../processors/typescript.mjs";

// When encountering a .ts file:
if (filePath.endsWith(".ts") || filePath.endsWith(".mts")) {
  const jsCode = await transformTypeScript(filePath);
  const dataUrl = createDataUrl(jsCode);
  await import(dataUrl);
}
```

### Key Components

1. **TypeScript Detection**: Identify `.ts` files during module discovery
2. **Transform Pipeline**: Call dedicated transformer module for TypeScript files
3. **Data URL Import**: Use data URLs to import transformed code without file system writes
4. **Cache Management**: Implement cache busting to ensure fresh transforms

## Cache Busting Strategy

### Option A: Fragment-Based Cache Bust (Recommended)

Fragments don't affect the data payload but change the URL string that Node keys on:

```js
const bust = Date.now().toString(36);
await import(`data:text/javascript,${encodeURIComponent(result.code)}#${bust}`);
```

**Advantages:**
- Clean approach that doesn't modify the code
- Ensures cache invalidation on every import
- Minimal performance overhead

## Implementation Considerations

### Performance

- **First Load**: TypeScript files will have slightly slower initial load due to transformation
- **Caching**: Consider implementing a transform cache for production use
- **Build vs Runtime**: May want different behavior for development vs production

### Dependencies

TypeScript support uses **peer dependencies**:

```json
{
  "peerDependencies": {
    "esbuild": ">=0.19.0",      // For fast mode
    "typescript": ">=5.0.0"     // For strict mode
  },
  "peerDependenciesMeta": {
    "esbuild": { "optional": true },
    "typescript": { "optional": true }
  }
}
```

**Package Sizes:**
- `@cldmv/slothlet`: ~0.5MB (core)
- `esbuild`: ~8MB (fast mode)
- `typescript`: ~30MB (strict mode)

**User Impact:**
- No TypeScript usage → 0 extra dependencies
- Fast mode only → +8MB (esbuild)
- Strict mode only → +30MB (typescript)
- Both modes → +38MB (esbuild + typescript)

### Configuration Options

### Fast Mode (Default)

Use esbuild for fast transformation without type checking:

```javascript
const api = await slothlet.load({
  path: "./api_test",
  typescript: true  // or typescript: "fast"
});
```

### Strict Mode

Use tsc for transformation with full type checking:

```javascript
const api = await slothlet.load({
  path: "./api_test",
  typescript: {
    mode: "strict",
    types: {
      output: "./types/api.d.ts",      // Required
      interfaceName: "MyAPI",           // Required
      includeDocumentation: true,       // Optional
      fallbackType: "unknown"           // Optional: "any" | "unknown" | "never"
    }
  }
});
```

**Strict Mode Behavior:**
1. Generates/updates `.d.ts` file first (if needed/stale)
2. Uses tsc for transformation with type checking
3. Emits type errors if found
4. Slower but provides full type safety

**Fast Mode Behavior:**
1. Uses esbuild for transformation only
2. No type checking (relies on IDE)
3. Fast startup for development
4. Optional: Can still generate `.d.ts` separately (see typescript-declarations.md)

## Runtime Dependency Checking

Since the processor would be loaded when imported (even if not used), **lazy imports are required** to avoid forcing users to install peer dependencies they don't need.

### Implementation

**Lazy Import Pattern (Required):**
```javascript
// src/lib/processors/typescript.mjs
// NO static imports - only dynamic imports when needed
import fs from "fs";

let esbuildInstance = null;
let typescriptInstance = null;

async function getEsbuild() {
  if (!esbuildInstance) {
    try {
      esbuildInstance = await import("esbuild");
    } catch (error) {
      throw new this.SlothletError(
        "TYPESCRIPT_ESBUILD_NOT_INSTALLED",
        { mode: "fast" },
        error
      );
    }
  }
  return esbuildInstance;
}

async function getTypeScript() {
  if (!typescriptInstance) {
    try {
      typescriptInstance = await import("typescript");
    } catch (error) {
      throw new this.SlothletError(
        "TYPESCRIPT_TSC_NOT_INSTALLED",
        { mode: "strict" },
        error
      );
    }
  }
  return typescriptInstance;
}
```

**Usage in Transform Functions:**
```javascript
export async function transformTypeScript(filePath, options = {}) {
  const esbuild = await getEsbuild(); // Lazy load - only when actually needed
  const code = fs.readFileSync(filePath, "utf8");
  
  const result = await esbuild.transform(code, {
    loader: "ts",
    format: "esm",
    ...options
  });
  
  return result.code;
}
```

### Translation Keys

**Error Messages (en.json):**
```json
{
  "TYPESCRIPT_ESBUILD_NOT_INSTALLED": "TypeScript fast mode requires 'esbuild' to be installed.",
  "HINT_TYPESCRIPT_ESBUILD_NOT_INSTALLED": "Install it with: npm install esbuild",
  
  "TYPESCRIPT_TSC_NOT_INSTALLED": "TypeScript strict mode requires 'typescript' to be installed.",
  "HINT_TYPESCRIPT_TSC_NOT_INSTALLED": "Install it with: npm install typescript"
}
```

**Output:**
```
[TYPESCRIPT_ESBUILD_NOT_INSTALLED] SlothletError
TypeScript fast mode requires 'esbuild' to be installed.

Hint: Install it with: npm install esbuild
```

```
[TYPESCRIPT_TSC_NOT_INSTALLED] SlothletError
TypeScript strict mode requires 'typescript' to be installed.

Hint: Install it with: npm install typescript
```

### When Checks Occur

- ✅ **Fast mode**: First `.ts` file encountered during loading
- ✅ **Strict mode**: During initialization (before type generation)
- ✅ **Type generation**: When `generateTypes()` is called
- ✅ **Early detection**: Fails fast before attempting transformation

### Benefits

- Clear, actionable error messages
- No cryptic import/require errors
- Exact installation command provided
- Only checks when feature is actually used
- Lazy loading keeps startup fast when not using TypeScript

### Advanced Options

```javascript
typescript: {
  mode: "fast" | "strict",
  
  // Type generation config (required for strict mode)
  types: {
    output: string,              // Output file path
    interfaceName: string,       // Interface name
    includeDocumentation?: boolean,
    exportStyle?: "interface" | "namespace" | "both",
    fallbackType?: "any" | "unknown" | "never",
    includePrivate?: boolean
  },
  
  // Transform options
  target?: "ES2020" | "ES2022" | "ESNext",
  tsconfig?: string,            // Path to tsconfig.json
  esbuildOptions?: object       // Custom esbuild options (fast mode only)
}
```

**Validation:**
- Strict mode requires `types.output` and `types.interfaceName`
- Fast mode can omit `types` config
- `esbuildOptions` only applies to fast mode

## Integration Points

### New File: TypeScript Processor (`src/lib/processors/typescript.mjs`)

**Primary implementation file** - contains all TypeScript-specific logic:
- `transformTypeScript()` - Main transform function using esbuild
- `createDataUrl()` - Generate cache-busted data URLs
- esbuild configuration and options management
- Error handling for TypeScript compilation issues
- **Runtime dependency checking** - validates esbuild/typescript are installed

### Module Discovery (`src/lib/helpers/discovery.mjs`)

- Extend file pattern matching to include `.ts` and `.mts` extensions
- Add TypeScript file detection logic

### Module Loading (`src/lib/modes/`)

Both lazy and eager modes need minimal changes:
1. Import the TypeScript processor
2. Detect TypeScript files during module analysis
3. **Call into `transformTypeScript()` when processing `.ts` files**
4. Use returned data URL for dynamic import

**Example integration:**
```js
// At the top of slothlet_lazy.mjs / slothlet_eager.mjs
import { transformTypeScript, createDataUrl } from "../processors/typescript.mjs";

// During module loading:
const isTypeScript = filePath.endsWith(".ts") || filePath.endsWith(".mts");
const moduleUrl = isTypeScript 
  ? createDataUrl(await transformTypeScript(filePath))
  : filePath;
  
const module = await import(moduleUrl);
```

### Sanitization (`src/lib/helpers/sanitize.mjs`)

- Ensure `.ts` and `.mts` extensions are handled correctly
- Maintain consistent API naming conventions

## Testing Requirements

1. **Unit Tests**: Transform pipeline validation
2. **Integration Tests**: Full TypeScript module loading
3. **Performance Tests**: Compare TypeScript vs JavaScript loading times
4. **Mixed Projects**: Test projects with both JS and TS modules

## Example Use Cases

### Basic TypeScript Module

```typescript
// api_test/math.ts
export interface MathOptions {
  precision?: number;
}

export function add(a: number, b: number, options?: MathOptions): number {
  const result = a + b;
  return options?.precision 
    ? parseFloat(result.toFixed(options.precision))
    : result;
}
```

### Usage

**Fast Mode (Development):**
```js
import slothlet from "@cldmv/slothlet";

const api = await slothlet.load({ 
  path: "./api_test",
  typescript: true  // Fast esbuild transformation
});

const result = api.math.add(1.1, 2.2, { precision: 2 });
```

**Strict Mode (Type-Safe):**
```js
import type { MyAPI } from "./types/api";
import slothlet from "@cldmv/slothlet";

const api = await slothlet.load({ 
  path: "./api_test",
  typescript: {
    mode: "strict",
    types: {
      output: "./types/api.d.ts",
      interfaceName: "MyAPI"
    }
  }
}) as MyAPI;

const result = api.math.add(1.1, 2.2, { precision: 2 });
```

## Security Considerations

- **Code Injection**: Data URLs are safe as they don't execute arbitrary code
- **Transform Safety**: esbuild is a trusted tool with security focus
- **Input Validation**: Validate TypeScript files before transformation

## Future Enhancements

1. **Source Maps**: Generate and preserve source maps for debugging
2. **Type Checking**: Optional type checking during development
3. **Watch Mode**: Auto-reload on TypeScript file changes
4. **Declaration Files**: Generate `.d.ts` files for TypeScript consumers
5. **Custom Transformers**: Support for custom esbuild plugins

## Related Files

- **`src/lib/processors/typescript.mjs`** - **NEW: Primary TypeScript transformation logic**
- `src/lib/processors/loader.mjs` - Module loading processor (reference for patterns)
- `src/lib/modes/slothlet_lazy.mjs` - Lazy loading implementation (call into processor)
- `src/lib/modes/slothlet_eager.mjs` - Eager loading implementation (call into processor)
- `tests/vitests/` - Test suite location for new TypeScript tests

## Status

**Status**: ✅ **Complete** (Fast Mode + Strict Mode)  
**Priority**: Medium  
**Complexity**: Medium  
**Breaking Changes**: No (additive feature)

### Completed ✅

**Fast Mode** (esbuild transformation):
- `src/lib/processors/typescript.mjs` - TypeScript processor with lazy esbuild loading
- `src/lib/processors/loader.mjs` - Extended to detect and transform .ts/.mts files
- `src/lib/helpers/config.mjs` - Config normalization for TypeScript options
- `src/lib/i18n/languages/en-us.json` - Translation keys for TypeScript errors
- `package.json` - Peer dependencies: esbuild ^0.27.3, typescript ^5.9.3
- `api_tests/api_test_typescript/` - Test API with math.ts and string.ts
- `tests/vitests/suites/typescript/typescript-fast-mode.test.vitest.mjs` - 23 passing tests
- Data URL import with encodeURIComponent encoding
- Fragment-based cache busting
- Runtime dependency checking with clear error messages

**Strict Mode** (TypeScript Program API with type checking + Type Generation):
- `src/lib/processors/typescript.mjs` - Extended with `transformTypeScriptStrict()` function
- `src/lib/processors/type-generator.mjs` - **NEW: Type generation from loaded API**
- `tools/generate-types-worker.mjs` - **NEW: Fork-based worker for type generation**
- TypeScript Program API integration for full semantic type checking
- `getTypeScript()` lazy loader for typescript package
- Type error detection and formatted error reporting
- Automatic `.d.ts` generation with `self` declaration
- Fork architecture to prevent recursion and cache conflicts
- `src/lib/processors/loader.mjs` - Mode detection, strict transformation, and type generation
- `api_tests/api_test_typescript_errors/` - Test files with intentional type errors
- `tests/vitests/suites/typescript/typescript-strict-mode.test.vitest.mjs` - 13 passing tests
- Proper handling of type diagnostics with file/line/column information

### Tests Status

- ✅ Debug tests: 206 paths checked, all passed
- ✅ Baseline tests: Multiple test suites passing
- ✅ TypeScript fast mode: 23 tests, all passed
- ✅ TypeScript strict mode: 13 tests, all passed (includes type generation)

### Note on Type Generation

✅ **Type declaration generation has been implemented!** See [completed/typescript-declarations.md](./completed/typescript-declarations.md) for details.

**Completed Features:**
- Automatic `.d.ts` generation from loaded API structure
- Fork-based worker process to prevent recursion
- API traversal using `__metadata` for introspection
- Function signature extraction from TypeScript sources
- Interface generation with nested structure
- `declare const self: InterfaceName` for self-referential typing
- Full test coverage with 13 passing tests
- Integrated with strict mode for seamless type checking

### Core Bug Fixed

During implementation, discovered and fixed a bug in `src/lib/handlers/api-manager.mjs`:
- **Issue**: `api.remove()` couldn't remove base modules by API path
- **Fix**: Changed detection logic to check moduleID first, then fall back to API path lookup
- **Impact**: Base modules can now be removed by path (e.g., `api.remove("math")`)

## References

- [esbuild Transform API](https://esbuild.github.io/api/#transform)
- [Node.js Data URLs](https://nodejs.org/api/esm.html#data-imports)
- [Cache Busting Techniques](https://nodejs.org/api/esm.html#resolution-and-loading-algorithm)
