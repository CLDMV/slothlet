# TypeScript Support

Slothlet v3 has native TypeScript support built in. Write your API modules in `.ts` files and Slothlet handles transpilation automatically - no build step required. TypeScript and JavaScript modules can coexist freely in the same API directory.

TypeScript support uses **optional peer dependencies** so Slothlet core stays lightweight. Install only what you need.

---

## Table of Contents

- [Type Declarations (`@cldmv/slothlet-types`)](#type-declarations-cldmvslothlet-types)
- [Modes](#modes)
- [Installation](#installation)
- [Quick Start](#quick-start)
- [Configuration Reference](#configuration-reference)
- [Fast Mode](#fast-mode)
- [Strict Mode](#strict-mode)
- [Type Generation (.d.ts)](#type-generation-dts)
- [Generating Types On Demand (`slothlet typegen`)](#generating-types-on-demand-slothlet-typegen)
- [Mixed JavaScript and TypeScript](#mixed-javascript-and-typescript)
- [Error Handling](#error-handling)
- [Limitations](#limitations)

---

## Type Declarations (`@cldmv/slothlet-types`)

`@cldmv/slothlet` ships no `.d.mts` declarations of its own. Each of its typed exports resolves to a small stub that re-exports the real declarations from a companion package, **`@cldmv/slothlet-types`**, built and published in lockstep with the runtime. Install it (as a dev dependency) for editor autocomplete and type-checking when you consume the Slothlet API:

```bash
npm install @cldmv/slothlet
npm install -D @cldmv/slothlet-types
```

It is an **optional peer dependency**: the runtime never loads it, and pure-JavaScript projects can skip it entirely. In a TypeScript project without it, importing `@cldmv/slothlet` reports

```text
Cannot find module '@cldmv/slothlet-types' or its corresponding type declarations.
```

which names exactly what to add. The installed version of `@cldmv/slothlet-types` always matches the `@cldmv/slothlet` version it describes.

> This is separate from the `typescript` and `esbuild` peer dependencies described below — those power Slothlet's ability to **load `.ts` API modules** at runtime. `@cldmv/slothlet-types` only types Slothlet's own exported API surface.

---

## Modes

| Mode     | Transpiler | Type Checking | `.d.ts` Generation | Peer Dep     |
| -------- | ---------- | ------------- | ------------------ | ------------ |
| `fast`   | esbuild    | No            | No                 | `esbuild`    |
| `strict` | tsc        | Yes           | Yes                | `typescript` |

- **Fast mode** transpiles TypeScript using esbuild. It is extremely fast but performs no type checking. Errors in your TypeScript types will not be caught at load time.
- **Strict mode** transpiles and type-checks using the TypeScript compiler. It also generates `.d.ts` declaration files that give you full IDE autocomplete and type safety when consuming the API.

---

## Installation

### Fast Mode (esbuild)

```bash
npm install @cldmv/slothlet
npm install esbuild
```

`esbuild ^0.28.0` is required. It is an optional peer dependency - Slothlet will throw a clear error at load time if you enable TypeScript fast mode without it installed.

### Strict Mode (tsc)

```bash
npm install @cldmv/slothlet
npm install typescript
```

`typescript ^6.0.3 || ^7.0.0` is required. It is an optional peer dependency - Slothlet will throw a clear error at load time if you enable strict mode without it installed.

> **TypeScript 7.** The peer range accepts `typescript@7`, but TypeScript 7's current npm release exposes no compiler API at all (it lives under unstable `unstable/` import paths pending a stable surface promised for version 7.1) - only version metadata. **Strict mode needs the TypeScript 6 compiler API and will throw `TYPESCRIPT_STRICT_REQUIRES_TS6` on TypeScript 7 until 7.1 ships one.** Fast mode (esbuild) and `slothlet typegen` do not use the compiler API and work fine on TypeScript 7 today. If you need strict mode now, install `typescript@6`.

### Both Modes

```bash
npm install @cldmv/slothlet esbuild typescript
```

Neither dependency is needed if you are not using TypeScript files.

---

## Quick Start

Given an API directory with TypeScript modules:

```text
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
typescript: true;
// Enables fast mode. Equivalent to typescript: "fast"
```

### String shorthand

```javascript
typescript: "fast"; // Fast mode (esbuild)
typescript: "strict"; // Strict mode (tsc)
```

### Full options object

```javascript
typescript: {
    mode: "fast" | "strict",   // Required. Defaults to "fast" if omitted
    target: "es2020",          // ECMAScript target. Default: "es2020"
    sourcemap: true,           // Inline source maps. Default: on during a coverage run, otherwise off
    module: "esnext",          // Strict mode only. Module kind for the type check. Default: "esnext"
    strict: true,              // Strict mode only. tsc's strict checking. Default: true
    compilerOptions: {},       // Strict mode only. Extra tsc compiler options (tsconfig.json form)
    types: {                   // Type generation. Strict mode only.
        output: "./types/api.d.ts",   // Required. Path to write the .d.ts file
        interfaceName: "MyAPI"        // Required. Name of the generated interface
    }
}
```

#### `target`

Accepts any valid ECMAScript target string: `"es2015"`, `"es2017"`, `"es2018"`, `"es2019"`, `"es2020"`, `"es2021"`, `"es2022"`, `"esnext"`. Default is `"es2020"`.

#### `sourcemap`

When `true`, each transpiled module carries an inline source map whose `sources` entry is the absolute path of the `.ts` file. Transpiled modules are loaded from a cache directory (`.slothlet-cache/`), so without a map, stack frames point at the cached copy; with a map and Node's `--enable-source-maps` flag (or any tool that reads inline maps, such as a debugger), they point at the original `.ts` source. Applies to both fast and strict mode.

Default: not set, which means **on during a coverage run and off otherwise**. A coverage run is a vitest run with coverage enabled, or any process started with `NODE_V8_COVERAGE` set (c8, or Node's native coverage). The map is what lets coverage reach the `.ts` source at all: the code that executes is the cached copy, and coverage tools remap it through the inline map. An explicit `true` or `false` always wins. A coverage run that loads TypeScript leaves with `sourcemap: false` emits a one-shot `WARNING_COVERAGE_TS_SOURCEMAP_OFF`, because that coverage can only ever land on the cached copies. The coverage tool also has to include the cache directory — see [Testing a slothlet-composed API](TESTING.md#typescript-leaves).

The cache file name hashes the transpiled output, map included, so mapped and unmapped output never share a cache file.

```bash
node --enable-source-maps app.mjs
```

#### `module`

Strict mode only. The module kind tsc checks and emits against: `"esnext"`, `"es2022"`, `"es2020"`, `"es2015"`, `"node16"`, `"nodenext"`, and so on. Default: `"esnext"`. Slothlet loads the output as an ES module, so pick an ES module kind; a CommonJS module kind is useful only to have the type check flag ESM-only syntax such as `import.meta`.

#### `strict`

Strict mode only. Sets tsc's `strict` flag (`noImplicitAny`, `strictNullChecks`, and the rest of the strict family). Default: `true`. Set `strict: false` to type-check with the strict family off.

#### `compilerOptions`

Strict mode only. Extra tsc compiler options, written as in the `compilerOptions` block of a `tsconfig.json` (string values such as `module: "commonjs"` are accepted), applied on top of the options above. Relative paths resolve against the current working directory. An unknown option or an invalid value throws `INVALID_CONFIG`.

```javascript
typescript: {
    mode: "strict",
    types: { output: "./types/api.d.ts", interfaceName: "MyAPI" },
    compilerOptions: { noUnusedLocals: true, noUnusedParameters: true }
}
```

#### Validation

`target` and `module` must be strings, `sourcemap` and `strict` booleans, and `compilerOptions` a plain object. Any other value throws `INVALID_CONFIG` when `slothlet()` is called.

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

**Peer dependency required:** `esbuild ^0.28.0`

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

**Peer dependency required:** `typescript ^6.0.3 || ^7.0.0`

> **TypeScript 7 note:** strict mode needs the TypeScript 6 compiler API, which TypeScript 7's current npm release does not expose yet (a stable API is promised for 7.1). Installing `typescript@7` and enabling strict mode throws `TYPESCRIPT_STRICT_REQUIRES_TS6`; install `typescript@6` for strict mode in the meantime. Fast mode and `slothlet typegen` are unaffected and work with TypeScript 7.

Strict mode is slower than fast mode due to full compilation. It is well-suited for production validation, CI checks, or anywhere you want to catch type errors at startup.

How strict the check is can be tuned with [`strict`](#strict), [`module`](#module), and [`compilerOptions`](#compileroptions):

```javascript
const api = await slothlet({
	dir: "./api",
	typescript: {
		mode: "strict",
		strict: true,
		compilerOptions: { noUnusedLocals: true },
		types: { output: "./types/api.d.ts", interfaceName: "MyAPI" }
	}
});
```

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

For an API directory containing:

```text
api/
├── math.ts            export function add(a: number, b: number): number
├── logger.mjs         export default function logger(msg) + export function info(msg)
├── parity.cjs         module.exports = function parity(n) { … }
└── text.cjs           module.exports = { shout, stats }
```

the generated file references each export slothlet placed at each path:

<!-- prettier-ignore -->
```typescript
// types/api.d.ts (generated)
import type { SlothletAPI } from "@cldmv/slothlet";

export interface MyAPI {
	math: {
		add: typeof import("../api/math.js")["add"];
	};
	logger: typeof import("../api/logger.mjs")["default"] & {
		info: typeof import("../api/logger.mjs")["info"];
	};
	parity: typeof import("../api/parity.cjs");
	text: typeof import("../api/text.cjs");
}

declare module "@cldmv/slothlet/runtime" {
	interface SlothletSelf extends MyAPI {}
	interface SlothletSelf extends SlothletAPI {}
}
```

| Composed node                                                                              | Generated type                                                          |
| ------------------------------------------------------------------------------------------ | ----------------------------------------------------------------------- |
| A named export (`export function add`)                                                     | `typeof import("<leaf>")["add"]`                                        |
| A default export                                                                           | `typeof import("<leaf>")["default"]`                                    |
| A member of an exported object                                                             | `typeof import("<leaf>")["obj"]["member"]`                              |
| A CommonJS `module.exports` / one of its members                                           | `typeof import("<leaf>.cjs")` / `typeof import("<leaf>.cjs")["member"]` |
| A namespace slothlet composed (a folder, a file's named exports)                           | an object type of its members                                           |
| A callable namespace (a default function with named exports merged onto it)                | the function's type `&` an object of the merged members                 |
| A member with no module origin (a runtime `self.X = value`, in-memory `api.add()` exports) | `unknown`, with a comment saying why                                    |

> **Every leaf is typed by its own source.** Each member is `typeof import(...)` of the export slothlet actually placed there, so TypeScript reads the leaf's own types — JSDoc in `.mjs` / `.cjs`, annotations in `.ts` / `.mts` (including types it imports, such as `node:events`), frozen constants, object leaves typed through an interface. The origin comes from composition itself (slothlet records which export produced each api node), so flattened, hoisted, and merged members are typed correctly too. Specifiers are relative to the generated file and use each leaf's runtime extension (`.ts` → `.js`, `.mts` → `.mjs`), which resolves under both `NodeNext` and `Bundler`. Because JavaScript leaves are referenced directly, the program that includes the declaration needs `allowJs: true`.

### Runtime Imports (`self`, `context`, `instanceID`)

All three named exports of `@cldmv/slothlet/runtime` — `self`, `context`, and `instanceID` — work the same way from TypeScript modules as they do from `.mjs` modules. Slothlet writes the transpiled `.ts` output to a project-local cache file (see [Limitations](#limitations)) so Node's resolver can anchor bare-specifier imports normally; relative imports resolve too — to plain `.mjs` / `.cjs` / `.js` files and to other `.ts` / `.mts` modules, which are transpiled and linked automatically. Those relative helpers are per instance exactly as they are for `.mjs` leaves — see [MODULE-STRUCTURE.md → Helper Modules Are Per Instance](MODULE-STRUCTURE.md#helper-modules-are-per-instance). Nothing about TypeScript changes the runtime API surface.

```typescript
// api/utils.ts
import { self, context, instanceID } from "@cldmv/slothlet/runtime";

export function fullReport(name: string) {
	const upper = self.string.uppercase(name); // call sibling modules
	const requestId = (context as { requestId?: string }).requestId ?? "anon";
	return `[${instanceID}/${requestId}] ${upper}: ${self.math.add(1, 1)}`;
}
```

`self` is declared as `SlothletSelf`, an empty class exported by `@cldmv/slothlet/runtime`. The generated `.d.ts` extends that class with the generated interface (and with `SlothletAPI`, since `self.slothlet.*` is the same framework surface as `api.slothlet.*`), which gives `self` full autocomplete and type-checking against your API shape in every leaf that imports it — `.ts`, `.mts`, and JSDoc-checked `.mjs` / `.cjs` alike. The same anchor types the consumer side: `slothlet()` resolves to `SlothletAPI & T`, where `T` defaults to `SlothletSelf`, so `const api = await slothlet({ base: "./api" })` is typed with no annotation. A program that loads more than one api passes its interface explicitly (`slothlet<OtherApi>({ base: "./other" })`) and generates the other declarations with `augmentRuntime: false` (`--no-augment-runtime`). `context` and `instanceID` are typed by the runtime module's own `.d.ts` (no extra config needed).

See [CONTEXT-PROPAGATION.md](CONTEXT-PROPAGATION.md) for what `context` and `instanceID` carry and how they propagate across calls.

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

## Generating Types On Demand (`slothlet typegen`)

Strict mode generates a `.d.ts` automatically as a side-effect of the type-checking pass. Fast mode does not — that's the whole point. But editor diagnostics like `Property 'foo' does not exist on type '{}'` still bother users browsing their own `.ts` modules in fast mode, because nothing tells TypeScript what shape `self` has.

`slothlet typegen` is the third option: an on-demand generator that produces the same kind of declaration file strict mode emits, but you control when it runs and what to do with the output. It's a CLI **and** a programmatic export — pick whichever fits your workflow.

> **Why on demand?** Slothlet does not invoke the generator at runtime. Generating types is a build/dev-time concern: you might commit the output, gitignore it and regenerate in CI, ship it as a separate types package, or skip it entirely on production deploys. Slothlet stays out of that decision.

### CLI

```bash
# Positional
npx slothlet typegen ./api ./types/api.d.ts MyApi

# Long flags
npx slothlet typegen --dir ./api --output ./types/api.d.ts --interface-name MyApi

# Short flags
npx slothlet typegen -d ./api -o ./types/api.d.ts -n MyApi

# package.json fallback (no args)
npx slothlet typegen
```

Resolution order per option: **flag → positional → `package.json.slothlet.typegen`**. Missing fields fall through to the next source. If all three are still unset, the CLI exits non-zero with a clear error.

```json
// package.json — drop this in once and `npx slothlet typegen` works with no args
{
	"scripts": {
		"predev": "slothlet typegen",
		"prebuild": "slothlet typegen"
	},
	"slothlet": {
		"typegen": {
			"dir": "./api",
			"output": "./types/api.d.ts",
			"interfaceName": "MyApi"
		}
	}
}
```

### Programmatic

Same logic, no shell:

```js
import { generateTypes } from "@cldmv/slothlet/typegen";

const { filePath, content } = await generateTypes({
	dir: "./api",
	output: "./types/api.d.ts",
	interfaceName: "MyApi"
});
console.log(`Wrote ${filePath} (${content.length} bytes)`);
```

`generateTypes()` loads the API in eager + fast TypeScript mode internally, walks the composed structure, references each node's originating export (see [Example Generated Output](#example-generated-output)), writes the `.d.ts`, and shuts the loaded instance down before returning. It does not need the `typescript` package. If `dir`, `output`, or `interfaceName` is missing or empty, it throws `SlothletError("INVALID_CONFIG")` — the same error class everything else uses.

### What the output looks like

The generated file matches what strict mode emits — see [Example Generated Output](#example-generated-output) above. Concretely: a top-level `interface` whose members are `typeof import(...)` references to your leaves, and a `declare module "@cldmv/slothlet/runtime"` block that extends `SlothletSelf` (omitted with `augmentRuntime: false`).

### Editor / build wiring tips

- **VS Code etc.** as long as the `.d.ts` is inside your `tsconfig.json` `include` (or the workspace), the editor picks it up automatically. No restart required.
- **Source-control:** committing the file is fine (it's deterministic from your sources, so diffs reflect real API changes). Gitignoring it works too — wire `slothlet typegen` into a `predev` / `prebuild` script and let the dev/CI environment regenerate.
- **Watch mode:** there is no built-in watcher. Use a tool like `chokidar-cli`, `nodemon`, or your bundler's watcher to re-run `slothlet typegen` on file change.

---

## Mixed JavaScript and TypeScript

You can freely mix `.ts` and `.mjs`/`.js` files in the same API directory. Slothlet transpiles `.ts` files and loads `.mjs`/`.js` files directly. No special config is needed:

```text
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

```text
[TYPESCRIPT_ESBUILD_NOT_INSTALLED] SlothletError
TypeScript fast mode requires 'esbuild' to be installed.
Hint: Install it with: npm install esbuild
```

If TypeScript is not installed and you use `typescript: "strict"`:

```text
[TYPESCRIPT_TSC_NOT_INSTALLED] SlothletError
TypeScript strict mode requires 'typescript' to be installed.
Hint: Install it with: npm install typescript
```

If TypeScript **is** installed but does not expose the compiler API strict mode needs - true of TypeScript 7's current npm release, see the [TypeScript 7 note](#strict-mode) above:

```text
[TYPESCRIPT_STRICT_REQUIRES_TS6] SlothletError
TypeScript strict mode requires the TypeScript 6 compiler API; the installed 'typescript' package (version 7.0.0) does not expose it. TypeScript 7 will not expose a stable compiler API until version 7.1.
Hint: Install typescript@6 for strict mode: npm install typescript@6. Fast mode (esbuild) and 'slothlet typegen' work fine with TypeScript 7.
```

### Type errors in strict mode

When strict mode catches type errors in your source files, `slothlet()` throws with the full TypeScript diagnostic output:

```text
[TYPESCRIPT_COMPILATION_ERROR] SlothletError
TypeScript compilation failed with 2 error(s) in api/math.ts:
  api/math.ts(5,10): error TS2322: Type 'string' is not assignable to type 'number'.
  api/math.ts(12,3): error TS2304: Cannot find name 'myHelper'.
```

### Missing required `types` fields

If `mode: "strict"` is set with a `types` object but `output` or `interfaceName` is missing:

```text
SlothletError: TypeScript strict mode requires 'types.output' to be configured in your typescript config.
SlothletError: TypeScript strict mode requires 'types.interfaceName' to be configured in your typescript config.
```

---

## Limitations

- **No `.tsx` support.** Only `.ts` and `.mts` files are handled. JSX is not supported.
- **Fast mode does not type-check.** Type errors are silently ignored. Use strict mode if you need type validation.
- **Type generation reads the composed api.** Each member of the `.d.ts` references the export slothlet placed at that path; a member with no module origin (assigned at runtime, or mounted from in-memory `api.add()` exports) is typed `unknown`. JavaScript leaves are referenced directly, so compile the declaration with `allowJs: true`.
- **`self` is a runtime concept.** The `SlothletSelf` augmentation in the generated `.d.ts` provides type information only. The actual `self` value at runtime is the Slothlet proxy, imported via `import { self } from "@cldmv/slothlet/runtime"` and resolved per-instance through the module context system.
- **Generated `.d.ts` is not automatically deleted.** Slothlet does not clean up generated files after shutdown. Manage the file lifecycle yourself or use a temp directory.
- **Transformed TS is cached on disk.** Slothlet writes transformed `.ts`/`.mts` output to `<project>/.slothlet-cache/<pid>-<instanceID>/<hash>.mjs` so Node's resolver can anchor bare-specifier imports (e.g. `@cldmv/slothlet/runtime`). Relative specifiers in the transformed output are anchored at the original source directory — relative imports of plain `.mjs` / `.cjs` / `.js` files become absolute `file://` URLs, and relative imports of other `.ts` / `.mts` modules are transpiled and linked to their own cache files (import cycles included). The current instance's directory is removed on `shutdown()`. On the first TS load each process also passively sweeps sibling directories whose `<pid>` prefix no longer matches a live process (probed via signal 0 — nothing is killed), preventing orphans from accumulating when a process exits without calling `shutdown()` (SIGKILL, OOM, crash, etc.). Add `.slothlet-cache/` to your `.gitignore`.
