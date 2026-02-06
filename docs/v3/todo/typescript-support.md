# TypeScript Support Implementation

**Last Evaluated:** 2026-02-06

## Overview

Add native TypeScript support to Slothlet, allowing users to write modules in TypeScript that are automatically transpiled and loaded.

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

/**
 * Transform TypeScript code to JavaScript using esbuild
 * @param {string} filePath - Path to the TypeScript file
 * @param {object} options - esbuild transform options
 * @returns {Promise<string>} Transformed JavaScript code
 */
export async function transformTypeScript(filePath, options = {}) {
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

- **esbuild**: Required as a dependency (currently a devDependency in the project)
- **Version Compatibility**: Ensure esbuild version supports required features

### Configuration Options

Consider allowing users to configure:

- `typescript`: Enable/disable TypeScript support
- `tsconfig`: Path to tsconfig.json for compiler options
- `esbuildOptions`: Custom esbuild transform options
- `cacheTransforms`: Enable transform caching for production

## Integration Points

### New File: TypeScript Processor (`src/lib/processors/typescript.mjs`)

**Primary implementation file** - contains all TypeScript-specific logic:
- `transformTypeScript()` - Main transform function using esbuild
- `createDataUrl()` - Generate cache-busted data URLs
- esbuild configuration and options management
- Error handling for TypeScript compilation issues

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

```js
import slothlet from "@cldmv/slothlet";

const api = await slothlet.load({ 
  path: "./api_test",
  typescript: true 
});

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

**Status**: Planning  
**Priority**: Medium  
**Complexity**: Medium  
**Breaking Changes**: No (additive feature)

## References

- [esbuild Transform API](https://esbuild.github.io/api/#transform)
- [Node.js Data URLs](https://nodejs.org/api/esm.html#data-imports)
- [Cache Busting Techniques](https://nodejs.org/api/esm.html#resolution-and-loading-algorithm)
