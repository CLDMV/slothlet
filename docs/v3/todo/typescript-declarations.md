# TypeScript Declaration Generation

**Last Evaluated:** 2026-02-14  
**Status:** ❌ Not Started (Dependent on TypeScript Strict Mode)

---

## Prerequisites

This feature requires TypeScript strict mode to be implemented first. See `typescript-support.md` for:
- ✅ Fast mode (esbuild) - **COMPLETED**
- ❌ Strict mode (tsc with type checking) - **PENDING**

Type generation will be integrated with strict mode to generate `.d.ts` files before loading modules.

---

## Overview

Generate TypeScript declaration files (`.d.ts`) that accurately describe the shape of a loaded Slothlet API, providing type safety and IDE autocomplete when consuming the API.

## Installation

Type generation requires TypeScript to parse source files:

```bash
# Install Slothlet
npm install @cldmv/slothlet

# Install TypeScript (peer dependency)
npm install typescript
```

**Note:** Type generation works with both JavaScript and TypeScript source files. TypeScript is used for parsing and type extraction, not just for `.ts` files.

## Runtime Dependency Checking

Type generation validates TypeScript is installed before attempting to parse files. Lazy imports are required to avoid forcing installation when not using this feature.

### Implementation

**Lazy Import Pattern (Required):**
```javascript
// src/lib/processors/type-generator.mjs
// NO static imports - only dynamic imports when needed

let typescriptInstance = null;

async function getTypeScript() {
  if (!typescriptInstance) {
    try {
      typescriptInstance = await import("typescript");
    } catch (error) {
      throw new this.SlothletError(
        "TYPESCRIPT_NOT_INSTALLED",
        { feature: "type-generation" },
        error
      );
    }
  }
  return typescriptInstance;
}

export async function generateTypesCore(api, options) {
  const ts = await getTypeScript(); // Lazy load - only when actually needed
  // ... rest of implementation
}
```

### Translation Keys

**Error Message (en.json):**
```json
{
  "TYPESCRIPT_NOT_INSTALLED": "Type generation requires 'typescript' to be installed.",
  "HINT_TYPESCRIPT_NOT_INSTALLED": "Install it with: npm install typescript"
}
```

**Output:**
```
[TYPESCRIPT_NOT_INSTALLED] SlothletError
Type generation requires 'typescript' to be installed.

Hint: Install it with: npm install typescript
```

### When Checks Occur

- ✅ **CLI command**: `slothlet generate-types`
- ✅ **Programmatic API**: `await slothlet.generateTypes(api, config)`
- ✅ **Auto-generation**: During load when `types` config is present
- ✅ **Strict mode**: Before attempting type checking
- ✅ **Early detection**: Fails fast before parsing any files

### Benefits

- Clear, actionable error messages
- No cryptic TypeScript Compiler API errors
- Exact installation command provided
- Only checks when feature is used (not at module load)
- Consistent with TypeScript transform checking

## The Problem

Dynamic module loading means the API structure is determined at runtime, not compile time:

```typescript
// Current situation
const api = await slothlet.load({ path: "./api_test" });
api.math.add(1, 2);
//  ^^^^ - Type is `any`, no autocomplete, no type safety
```

**Why VS Code can't help:**
- API shape depends on what files exist in the directory
- Structure varies based on config (flattening, collision modes, etc.)
- Cannot infer types from dynamic imports

## The Solution

Generate declaration files that mirror the actual API structure:

```typescript
// Generated: slothlet-api.d.ts
export interface SlothletAPI {
  math: {
    add(a: number, b: number): number;
    subtract(a: number, b: number): number;
  };
  string: {
    capitalize(s: string): string;
    lowercase(s: string): string;
  };
}

// Usage with types
import type { SlothletAPI } from "./slothlet-api";
const api = await slothlet.load({ path: "./api_test" }) as SlothletAPI;
api.math.add(1, 2); // ✅ Fully typed
```

## Implementation Challenges

### 1. **Type Extraction from Source Files**

Once the API structure is known (from traversal), extract types from each source file:
- **TypeScript files** - Parse with TypeScript Compiler API
- **JavaScript files with JSDoc** - Extract types from JSDoc comments
- **Plain JavaScript** - Generate generic signatures or attempt inference

### 2. **Handling Lazy Wrappers**

Even in eager mode, some wrappers may not be fully materialized:
- Check if wrapper has `___materialize()` method
- Call it to ensure impl is available
- Then access `__metadata` for file path

### 3. **Circular References**

API may have circular references (parent pointers, etc.):
- Track visited nodes to avoid infinite loops
- Skip internal/private properties (e.g., `__metadata`, `___materialize`)

### 4. **Generic/Dynamic Properties**

Some properties may be added dynamically or computed:
- Focus on static structure from files
- Document limitations for dynamic additions

## Proposed Architecture

### Shared Core Generation Process

All three usage methods (CLI, programmatic, auto-on-load) use the same underlying generation process to avoid code duplication:

```javascript
// Core generation function (shared by all methods)
async function generateTypesCore(options) {
  // 1. Load API in eager mode
  const api = await slothlet.load({
    ...options.config,
    mode: "eager"  // Force materialization
  });
  
  // 2. Traverse and inspect
  const inspector = new APIInspector(api);
  const nodes = inspector.traverse();
  
  // 3. Extract types from source files
  const extractor = new TypeExtractor();
  for (const node of nodes) {
    node.types = await extractor.extractFromFile(node.metadata.filePath);
  }
  
  // 4. Generate declaration file
  const generator = new DeclarationGenerator(options);
  const output = generator.generate(nodes);
  
  // 5. Write file
  await generator.writeFile(output, options.output);
  
  return { output, nodes };
}
```

### How Each Method Uses the Core

**1. CLI Command:**
```javascript
// bin/generate-types.mjs
const args = parseArgs(process.argv);
await generateTypesCore(args);
```

**2. Programmatic API:**
```javascript
// src/lib/generators/generate-types.mjs
export async function generateTypes(options) {
  return await generateTypesCore(options);
}
```

**3. Auto-on-Load:**
```javascript
// src/slothlet.mjs
if (config.generateTypes?.enabled) {
  // Fork child process
  fork('./bin/generate-types.mjs', [
    '--path', config.path,
    '--output', config.generateTypes.output,
    '--interface-name', config.generateTypes.interfaceName,
    // ... other options
  ]);
  // Child runs CLI which calls generateTypesCore
}
```

**Result:** Single implementation, three entry points.

### Simplified Approach: Introspect Real API

**Key Insight:** Both lazy and eager modes produce identical API shapes. Instead of simulating the API builder, just load it in eager mode and traverse the result.

**Critical Feature:** Every function/object in Slothlet's API has immutable `__metadata` that tracks its source file. This makes introspection trivial.

```javascript
// 1. Load API in eager mode (forces full materialization)
const api = await slothlet.load({
  ...userConfig,
  mode: "eager" // Override to ensure everything is materialized
});

// 2. Traverse the API object
function traverseAPI(obj, path = []) {
  for (const [key, value] of Object.entries(obj)) {
    // Skip internal properties
    if (key.startsWith('_') || key.startsWith('__')) continue;
    
    if (typeof value === "function" || typeof value === "object") {
      // 3. Every wrapper has __metadata with file ownership info
      const metadata = value.__metadata;
      if (!metadata) continue; // Skip non-wrapper properties
      
      // 4. System metadata includes source file path
      const filePath = metadata.filePath;    // e.g., "/path/to/api_test/math.mjs"
      const moduleID = metadata.moduleID;    // e.g., "base_api_test_math"
      const apiPath = metadata.apiPath;      // e.g., "math"
      
      // 5. Extract types from source file
      const types = await extractTypesFromFile(filePath);
      
      // 6. Build declaration entry
      declarations.push({
        path: [...path, key],
        types,
        metadata
      });
    }
    if (typeof value === "object") {
      traverseAPI(value, [...path, key]);
    }
  }
}
```

**Why This Works:**
- ✅ **File ownership tracking**: Slothlet's metadata system tracks which file owns each function
- ✅ **Immutable metadata**: `__metadata` is frozen and reliable (see [MetadataManager](../../../src/lib/handlers/metadata.mjs))
- ✅ **No need to replicate API building logic**: Runtime already did the work
- ✅ **Guaranteed to match runtime structure**: It IS the runtime structure
- ✅ **Handles all collision modes, flattening, sanitization automatically**: Just read what was built
- ✅ **Works with any config without special handling**: Config already applied during load

### Core Components

#### 1. **API Inspector**
Loads and traverses the actual API to discover structure.

```typescript
interface APIInspector {
  loadAPI(config: SlothletConfig): Promise<any>;
  traverseAPI(api: any): APINode[];
  extractMetadata(value: any): Metadata | null; // Returns __metadata if available
}

interface Metadata {
  filePath: string;      // Source file path
  moduleID: string;      // Module identifier
  apiPath: string;       // API path (e.g., "math.add")
  sourceFolder: string;  // Root source folder
  // ... other system metadata fields
}
```

#### 2. **Type Extractor**
Extracts type information from source files.

```typescript
interface TypeExtractor {
  extractFromFile(filePath: string): Promise<TypeInfo>;
  parseTypeScript(source: string): TypeInfo;
  parseJSDoc(source: string): TypeInfo;
}
```

#### 3. **Declaration Generator**
Generates `.d.ts` files from discovered structure and types.

```typescript
interface DeclarationGenerator {
  generate(nodes: APINode[], options: GeneratorOptions): string;
  writeDeclarationFile(output: string, filePath: string): Promise<void>;
}
```

## Usage

Type declarations can be generated in multiple ways:

### Integrated with TypeScript Strict Mode (Recommended)

When using TypeScript support in strict mode, type generation happens automatically:

```javascript
const api = await slothlet.load({
  path: "./api_test",
  typescript: {
    mode: "strict",
    types: {
      output: "./types/api.d.ts",
      interfaceName: "MyAPI"
    }
  }
});
```

This generates types before loading modules, enabling full type checking.

### Standalone Generation

If using TypeScript fast mode (or no TypeScript support), you can generate types separately:

#### Method 1: CLI Command

### 1. CLI Command (Recommended for Build Scripts)

Run as a separate build step, independent of your application:

```bash
# Generate types from config
npx slothlet generate-types --config slothlet.config.mjs

# Generate types with inline options
npx slothlet generate-types \
  --path ./api_test \
  --output ./types/api.d.ts \
  --interface-name MyAPI
```

**Use in package.json:**
```json
{
  "scripts": {
    "types": "slothlet generate-types --config slothlet.config.mjs",
    "prebuild": "npm run types"
  }
}
```

#### Method 2: Programmatic API (Custom Build Scripts)

Explicitly call type generation from your own scripts:

```javascript
import { generateTypes } from "@cldmv/slothlet/generate-types";

// In your build script
await generateTypes({
  path: "./api_test",
  output: "./types/api.d.ts",
  interfaceName: "MyAPI",
  config: {
    flatten: "smart",
    mode: "lazy"  // Config used for loading API during generation
  }
});
```

**How it works:**
- Loads API in eager mode with provided config
- Traverses API structure using `__metadata` to map functions to source files
- Extracts types from source files and generates `.d.ts`
- Writes output file synchronously
- Returns when generation is complete

**Use cases:**
- Custom build tooling
- Integration with other generators
- Conditional generation logic
- Testing and validation

#### Method 3: Auto-Generation on Load (Development Convenience)

Automatically triggers type generation when loading the API:

```javascript
const api = await slothlet.load({
  path: "./api_test",
  mode: "lazy",
  generateTypes: {
    enabled: true,
    output: "./types/api.d.ts",
    interfaceName: "MyAPI"
  }
});
```

**How it works:**
1. Slothlet forks a child process when `generateTypes.enabled` is true
2. Child process loads API in eager mode (forced materialization)
3. Traverses API structure using `__metadata` to map functions to source files
4. Extracts types from source files and generates `.d.ts`
5. Writes output file and exits
6. Parent process continues with your configured mode (lazy/eager)

**Benefits:**
- ✅ Separate process = no module cache conflicts
- ✅ No instanceID collisions
- ✅ Side effects isolated to child process
- ✅ Can run async (doesn't block API loading)
- ✅ Automatically stays in sync during development

**Important:** Generated types must be manually applied by user:

```typescript
// Generated: types/api.d.ts
export interface MyAPI {
  math: {
    add(a: number, b: number): number;
  };
}

// User must type their variable:
import type { MyAPI } from "./types/api";
const api = await slothlet.load({ ... }) as MyAPI;
```

**Note:** Cannot detect variable name at runtime, so interface name must be configured and user must apply the type.

## Configuration Options

```typescript
interface TypeGenerationConfig {
  // Enable type generation
  enabled?: boolean;
  
  // Output file path (required)
  output: string;
  
  // Interface name (required - cannot detect variable name)
  interfaceName: string;  // Default: "SlothletAPI"
  
  // Include JSDoc comments in output
  includeDocumentation?: boolean;
  
  // Export style
  exportStyle?: "interface" | "namespace" | "both";
  
  // Handle missing types
  fallbackType?: "any" | "unknown" | "never";
  
  // Include internal/private properties
  includePrivate?: boolean;
  
  // Async generation (don't wait for child process)
  async?: boolean;  // Default: true for on-load, false for CLI
}
```

## Output Formats

### Option A: Interface Export (Default)

```typescript
// slothlet-api.d.ts (with interfaceName: "MyAPI")
export interface MyAPI {
  math: {
    add(a: number, b: number): number;
  };
}
```

Usage:
```typescript
import type { MyAPI } from "./slothlet-api";
const api = await slothlet.load({ ... }) as MyAPI;
```

### Option B: Namespace Export

```typescript
// slothlet-api.d.ts
declare namespace SlothletAPI {
  namespace math {
    function add(a: number, b: number): number;
  }
}

export = SlothletAPI;
```

Usage:
```typescript
import type SlothletAPI from "./slothlet-api";
const api = await slothlet.load({ ... }) as typeof SlothletAPI;
```

### Option C: Both (Recommended)

```typescript
// slothlet-api.d.ts
export interface SlothletAPI {
  math: {
    add(a: number, b: number): number;
  };
}

export namespace SlothletAPI {
  namespace math {
    function add(a: number, b: number): number;
  }
}
```

Supports both usage patterns.

## Type Extraction Strategies

### TypeScript Files

Use TypeScript Compiler API:

```typescript
import ts from "typescript";

function extractTypes(filePath: string): TypeInfo {
  const program = ts.createProgram([filePath], {});
  const sourceFile = program.getSourceFile(filePath);
  const typeChecker = program.getTypeChecker();
  
  // Extract exports and their signatures
  // ...
}
```

### JavaScript Files with JSDoc

Parse JSDoc comments:

```javascript
/**
 * @param {number} a
 * @param {number} b
 * @returns {number}
 */
export function add(a, b) {
  return a + b;
}

// Generates:
// add(a: number, b: number): number;
```

### Plain JavaScript

Generate generic signatures:

```javascript
export function add(a, b) {
  return a + b;
}

// Generates:
// add(a: any, b: any): any;
```

Or with inference:
```typescript
// add(a: number, b: number): number;  (if inference enabled)
```

## Implementation Phases

### Phase 1: Basic Introspection & Generation
- Load API in eager mode with user config
- Traverse API object to discover structure
- Extract file paths from `__metadata`
- Generate basic interface with correct nesting
- Support TypeScript files only

**Estimated Effort:** 3-4 days

### Phase 2: Advanced Type Extraction
- JSDoc parsing for JavaScript files
- Handle complex TypeScript types (generics, unions, etc.)
- Include documentation comments in output
- Support multiple export patterns

**Estimated Effort:** 1 week

### Phase 3: CLI & Automation
- CLI commands
- Watch mode (regenerate on file changes)
- Auto-generation on load
- Integration with build tools

**Estimated Effort:** 3-4 days

### Phase 4: Polish & Edge Cases
- Handle circular references
- Skip internal properties
- Improve error messages
- Performance optimization

**Estimated Effort:** 2-3 days

## Integration Points

## Integration Points

### New Files

- `src/lib/generators/type-generator-core.mjs` - **Core generation logic (shared by all methods)**
- `src/lib/generators/api-inspector.mjs` - API traversal and introspection
- `src/lib/generators/type-extractor.mjs` - Type extraction from source files
- `src/lib/generators/declaration-generator.mjs` - `.d.ts` file generation
- `src/lib/generators/generate-types.mjs` - Programmatic API export (wraps core)
- `bin/generate-types.mjs` - CLI command (calls core)

### Modified Files

- `src/slothlet.mjs` - Add `generateTypes` config option, fork child process if enabled
- `src/lib/helpers/config.mjs` - Validate type generation config

### Architecture Summary

```
CLI Command (bin/generate-types.mjs)
    ↓
    → generateTypesCore()
    
Programmatic API (src/lib/generators/generate-types.mjs)
    ↓
    → generateTypesCore()
    
Auto-on-Load (src/slothlet.mjs)
    ↓
    → fork(bin/generate-types.mjs)
        ↓
        → generateTypesCore()
```

All paths lead to the same core implementation, eliminating duplication.

## Testing Requirements

1. **Unit Tests**
   - Type extraction from TS/JS/JSDoc
   - API structure simulation with various configs
   - Declaration file generation

2. **Integration Tests**
   - Full generation pipeline with real modules
   - Config variations (flatten, collision modes)
   - Mixed TS/JS projects

3. **Validation Tests**
   - Generated types actually match runtime API
   - TypeScript compiler accepts generated declarations
   - No type errors in consumer code

## Example: Complex API

```
api_test/
  math.ts              → export { add, subtract }
  string/
    capitalize.ts      → export default function capitalize
    format/
      index.ts         → export { bold, italic }
```

With config: `{ flatten: "smart" }`

Generated:
```typescript
export interface SlothletAPI {
  math: {
    add(a: number, b: number): number;
    subtract(a: number, b: number): number;
  };
  string: {
    capitalize(s: string): string;
    format: {
      bold(s: string): string;
      italic(s: string): string;
    };
  };
}
```

## Benefits

1. **Type Safety** - Catch API usage errors at compile time
2. **IDE Support** - Autocomplete, go-to-definition, refactoring
3. **Documentation** - Generated types serve as API documentation
4. **Confidence** - Know the API shape before running code
5. **Refactoring Safety** - Breaking changes caught by TypeScript

## Limitations

1. **Snapshot in Time** - Types reflect generation time, not runtime changes
2. **Config Dependency** - Must regenerate if config changes
3. **Manual Regeneration** - Without watch mode, types can become stale
4. **Complex Types** - May struggle with very dynamic or conditional exports

## Alternative Approaches

### Option 1: Runtime Type Extraction
Generate types by actually loading the API and introspecting it.

**Pros:** Guaranteed accuracy
**Cons:** Requires running code, slow, may have side effects

### Option 2: Manual Type Definitions
Users write types themselves.

**Pros:** Full control, no tooling needed
**Cons:** Error-prone, maintenance burden, out of sync

### Option 3: Generic Typing
Provide generic `SlothletAPI<T>` type users can specialize.

**Pros:** Simple, no generation needed
**Cons:** Still requires manual work, limited type safety

## Recommendation

**Implement Phases 1-3** for core functionality. Phase 4 (polish) can be iterative based on edge cases discovered.

**Priority:** Medium-High (pairs well with TypeScript module loading support)

**Complexity:** Medium (significantly reduced by introspection approach - no need to replicate API builder logic)

**Breaking Changes:** No (additive feature)

**Estimated Total Effort:** 2-3 weeks (down from 3-4 weeks with simulation approach)

## Related Features

- **TypeScript Module Loading** - Enables writing modules in TypeScript (separate feature)
- **API Introspection** - Runtime API structure querying (could share code with type generator)
- **Documentation Generation** - Could leverage same scanning/analysis infrastructure

## Status

**Status**: Planning  
**Priority**: Medium-High  
**Complexity**: Medium (introspection approach)  
**Estimated Effort**: 2-3 weeks for Phases 1-3  
**Dependencies**: None (works with both JS and TS modules)

## References

- [TypeScript Compiler API](https://github.com/microsoft/TypeScript/wiki/Using-the-Compiler-API)
- [JSDoc Type Annotations](https://www.typescriptlang.org/docs/handbook/jsdoc-supported-types.html)
- [Declaration File Best Practices](https://www.typescriptlang.org/docs/handbook/declaration-files/do-s-and-don-ts.html)
