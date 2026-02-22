# TypeScript Support

Slothlet v3 has native TypeScript support built in. Write your API modules in `.ts` files and Slothlet handles transpilation automatically - no build step required. TypeScript and JavaScript modules can coexist freely in the same API directory.

TypeScript support uses **optional peer dependencies** so Slothlet core stays lightweight. Install only what you need.

---

## Table of Contents

- [Modes](#modes)
- [Installation](#installation)
- [Quick Start](#quick-start)
- [Configuration Reference](#configuration-reference)
- [Fast Mode](#fast-mode)
- [Strict Mode](#strict-mode)
- [Type Generation (.d.ts)](#type-generation-dts)
- [Mixed JavaScript and TypeScript](#mixed-javascript-and-typescript)
- [Error Handling](#error-handling)
- [Limitations](#limitations)

---

## Modes

| Mode | Transpiler | Type Checking | `.d.ts` Generation | Peer Dep |
|------|-----------|--------------|-------------------|----------|
| `fast` | esbuild | No | No | `esbuild` |
| `strict` | tsc | Yes | Yes | `typescript` |

- **Fast mode** transpiles TypeScript using esbuild. It is extremely fast but performs no type checking. Errors in your TypeScript types will not be caught at load time.
- **Strict mode** transpiles and type-checks using the TypeScript compiler. It also generates `.d.ts` declaration files that give you full IDE autocomplete and type safety when consuming the API.

---

## Installation

### Fast Mode (esbuild)

```bash
npm install @cldmv/slothlet
npm install esbuild
```

`esbuild ^0.27.3` is required. It is an optional peer dependency - Slothlet will throw a clear error at load time if you enable TypeScript fast mode without it installed.

### Strict Mode (tsc)

```bash
npm install @cldmv/slothlet
npm install typescript
```

`typescript ^5.9.3` is required. It is an optional peer dependency - Slothlet will throw a clear error at load time if you enable strict mode without it installed.

### Both Modes

```bash
npm install @cldmv/slothlet esbuild typescript
```

Neither dependency is needed if you are not using TypeScript files.

---

## Quick Start

Given an API directory with TypeScript modules:

```
api/
  math.ts
  string.ts
```

```typescript
// api/math.ts
export function add(a: number, b: number): number {
    return a + b;
}

export function subtract(a: number, b: number): number {
    return a - b;
}
```

Load with fast mode (install `esbuild`):

```javascript
import slothlet from "@cldmv/slothlet";

const api = await slothlet({
    dir: "./api",
    typescript: true // enables fast mode
});

api.math.add(1, 2); // 3
```

---

## Configuration Reference

The `typescript` config key accepts a boolean, a string shorthand, or a full options object.

### Boolean

```javascript
typescript: true
// Enables fast mode. Equivalent to typescript: "fast"
```

### String shorthand

```javascript
typescript: "fast"    // Fast mode (esbuild)
typescript: "strict"  // Strict mode (tsc)
```

### Full options object

```javascript
typescript: {
    mode: "fast" | "strict",   // Required. Defaults to "fast" if omitted
    target: "es2020",          // ECMAScript target. Default: "es2020"
    sourcemap: false,          // Generate source maps. Default: false
    types: {                   // Type generation. Strict mode only.
        output: "./types/api.d.ts",   // Required. Path to write the .d.ts file
        interfaceName: "MyAPI"        // Required. Name of the generated interface
    }
}
```

#### `target`

Accepts any valid ECMAScript target string: `"es2015"`, `"es2017"`, `"es2018"`, `"es2019"`, `"es2020"`, `"es2021"`, `"es2022"`, `"esnext"`. Default is `"es2020"`.

#### `sourcemap`

When `true`, source maps are generated and inlined. Useful for debugging in development. Default: `false`.

---

## Fast Mode

Fast mode uses esbuild to strip TypeScript syntax and transpile to JavaScript. It does **not** run type checking. This is the recommended mode for development and when you want the fastest possible startup time.

```javascript
const api = await slothlet({
    dir: "./api",
    typescript: {
        mode: "fast",
        target: "es2022",
        sourcemap: true
    }
});
```

**Peer dependency required:** `esbuild ^0.27.3`

Fast mode supports `.ts` and `.mts` files.

---

## Strict Mode

Strict mode uses the TypeScript compiler (`tsc`) to transpile and type-check your modules. Type errors in your source files will cause `slothlet()` to throw with a descriptive error message listing each diagnostic.

```javascript
const api = await slothlet({
    dir: "./api",
    typescript: {
        mode: "strict",
        target: "es2020"
    }
});
```

**Peer dependency required:** `typescript ^5.9.3`

Strict mode is slower than fast mode due to full compilation. It is well-suited for production validation, CI checks, or anywhere you want to catch type errors at startup.

---

## Type Generation (.d.ts)

Strict mode can generate a `.d.ts` declaration file from the loaded API structure. This gives consumers of your API full type safety and IDE autocomplete without any manual type writing.

Both `types.output` and `types.interfaceName` are required when `types` is specified:

```javascript
const api = await slothlet({
    dir: "./api",
    typescript: {
        mode: "strict",
        types: {
            output: "./types/api.d.ts",
            interfaceName: "MyAPI"
        }
    }
});
```

The `.d.ts` file is generated **before** modules are loaded, so TypeScript files in the directory can reference the interface immediately.

### Example Generated Output

For an API directory containing `math.ts` and `string.ts`:

```typescript
// types/api.d.ts (generated)
export interface MyAPI {
    math: {
        add(a: number, b: number): number;
        subtract(a: number, b: number): number;
        multiply(a: number, b: number): number;
    };
    string: {
        capitalize(str: string): string;
        lowercase(str: string): string;
        uppercase(str: string): string;
    };
}

declare const self: MyAPI;
```

### The `self` Constant

The generated `.d.ts` includes `declare const self: InterfaceName`. This allows TypeScript modules in the same API directory to reference the full API through `self` with full type-checking:

```typescript
// api/utils.ts
// "self" is typed as MyAPI - full autocomplete and type checking
export function fullReport(name: string) {
    const upper = self.string.uppercase(name);
    return `${upper}: ${self.math.add(1, 1)}`;
}
```

The `self` declaration is included automatically whenever `types.interfaceName` is set.

### Reuse on Subsequent Loads

If the `.d.ts` file already exists at `types.output`, Slothlet reuses it instead of regenerating it. This keeps subsequent loads fast. Delete the file to force regeneration (e.g., after changing your API structure).

### Cleanup

The `.d.ts` file persists after `slothlet()` returns. It is your responsibility to clean it up when no longer needed. You can delete it programmatically:

```javascript
import fs from "fs";
import path from "path";

const outputPath = "./types/api.d.ts";
const api = await slothlet({ dir: "./api", typescript: { mode: "strict", types: { output: outputPath, interfaceName: "MyAPI" } } });

// ...use api...

if (fs.existsSync(outputPath)) fs.unlinkSync(outputPath);
```

---

## Mixed JavaScript and TypeScript

You can freely mix `.ts` and `.mjs`/`.js` files in the same API directory. Slothlet transpiles `.ts` files and loads `.mjs`/`.js` files directly. No special config is needed:

```
api/
  math.ts         <- transpiled by Slothlet
  string.ts       <- transpiled by Slothlet
  config.mjs      <- loaded normally
  helpers/
    format.ts     <- transpiled
    constants.mjs <- loaded normally
```

All files are merged into the same unified API surface as usual.

---

## Error Handling

### Missing peer dependency

If esbuild is not installed and you enable `typescript: true` or `typescript: "fast"`:

```
[TYPESCRIPT_ESBUILD_NOT_INSTALLED] SlothletError
TypeScript fast mode requires 'esbuild' to be installed.
Hint: Install it with: npm install esbuild
```

If TypeScript is not installed and you use `typescript: "strict"`:

```
[TYPESCRIPT_TSC_NOT_INSTALLED] SlothletError
TypeScript strict mode requires 'typescript' to be installed.
Hint: Install it with: npm install typescript
```

### Type errors in strict mode

When strict mode catches type errors in your source files, `slothlet()` throws with the full TypeScript diagnostic output:

```
[TYPESCRIPT_COMPILATION_ERROR] SlothletError
TypeScript compilation failed with 2 error(s) in api/math.ts:
  api/math.ts(5,10): error TS2322: Type 'string' is not assignable to type 'number'.
  api/math.ts(12,3): error TS2304: Cannot find name 'myHelper'.
```

### Missing required `types` fields

If `mode: "strict"` is set with a `types` object but `output` or `interfaceName` is missing:

```
SlothletError: types.output is required when using TypeScript strict mode with type generation
SlothletError: types.interfaceName is required when using TypeScript strict mode with type generation
```

---

## Limitations

- **No `.tsx` support.** Only `.ts` and `.mts` files are handled. JSX is not supported.
- **Fast mode does not type-check.** Type errors are silently ignored. Use strict mode if you need type validation.
- **Type generation reads from API metadata.** Function signatures in the `.d.ts` are extracted from TypeScript source files using the TypeScript Compiler API. Plain JavaScript files get generic signatures in the generated declaration.
- **`self` is a runtime concept.** The `declare const self: InterfaceName` in the generated `.d.ts` provides type information only. The actual `self` value at runtime is the Slothlet proxy, injected via the module context system.
- **Generated `.d.ts` is not automatically deleted.** Slothlet does not clean up generated files after shutdown. Manage the file lifecycle yourself or use a temp directory.
