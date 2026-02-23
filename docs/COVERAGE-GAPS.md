# Coverage Gaps Analysis

> Generated: 2026-02-22  
> Overall coverage: **74.49% lines | 73.68% statements | 78.38% functions | 67.69% branches**

This document details each low-coverage file, explains **why** the coverage hole exists, and describes what tests are needed to close it.

---

## 1. `src/lib/processors/type-generator.mjs` — 1% lines 🔴

### Why coverage is so low

`generateTypes` (and all helper functions — `traverseAPI`, `extractTypesFromFile`, `extractFunctionSignature`, `generateDeclaration`, `setNestedProperty`, `generateInterfaceContent`) are never called directly from test code.

They are only invoked from `tools/generate-types-worker.mjs`, which is itself launched via **`child_process.fork()`** inside `src/lib/processors/loader.mjs`. Node.js / V8 coverage is **not** collected from forked subprocesses — the child process is a separate Node.js process with its own V8 isolate, so its execution is invisible to Vitest's coverage reporter.

The existing `typescript-strict-mode.test.vitest.mjs` tests do exercise the slothlet path that triggers `fork()`, but because `generateTypes` executes in the child, zero coverage flows back.

The only line that does register is the top-level module body (`let typescriptInstance = null`), which is why 1% rather than 0%.

### What `generateTypes` does

- Takes a loaded Slothlet `api` object and `{ output, interfaceName }` options.
- Validates both options (throws `SlothletError` if either is missing).
- Calls `traverseAPI` to walk the API tree and collect all function/object nodes.
- For each node that has `metadata.filePath`, calls `extractTypesFromFile` to parse the TypeScript source file (using `ts.createSourceFile`) and extract exported function signatures.
- Calls `generateDeclaration` to produce a `.d.ts` string.
- Writes the file to disk with `fs.writeFileSync`.
- Returns `{ output: <declaration string>, filePath: <absolute path> }`.

### Fix

Write a direct unit test that imports `generateTypes` from `@cldmv/slothlet/processors/type-generator` and calls it with a pre-built API object (or a real slothlet instance). No forking; no loader involved.

**Status: test file created** → `tests/vitests/suites/typescript/type-generator.test.vitest.mjs`

---

## 2. `src/lib/processors/loader.mjs` — 61% lines 🔴

### Uncovered regions

#### Lines 98–306 — TypeScript strict-mode `fork()` path

This block is inside `loadModule()` and is reached only when:

```
isTypeScript === true
&& typescriptConfig.mode === "strict"
&& !this.slothlet._typesGenerated  // first .ts file load in a strict instance
```

The code:

1. Dynamically imports `child_process`, `path`, and `url`.
2. Resolves `tools/generate-types-worker.mjs`.
3. Serialises `config` to `SLOTHLET_CONFIG` env var.
4. Calls `fork(scriptPath, [], { stdio: ['pipe','pipe','pipe','ipc'], env })`.
5. Listens for IPC messages (`type: 'success'` → resolves; `type: 'error'` → rejects).
6. Listens for `'error'` event (fork fails — binary not found, permissions, etc.).
7. Listens for `'exit'` — if non-zero exit code and types not yet generated, rejects.

The existing `typescript-strict-mode.test.vitest.mjs` does exercise this fork. However, **coverage from the child process itself is lost**, and the fork caller lines in the parent process are covered by the existing strict-mode tests (they do run the fork). The missing lines 98–306 may partly be the `reject` branches inside the fork promise (the error handler, the failing-exit handler).

#### Lines 370–458 — `mergeExportsIntoAPI` edge cases

`mergeExportsIntoAPI` is called to combine a loaded module's exports into the API tree. There are 5 cases:

| Case | Condition | Status |
|---|---|---|
| 1 | Single named export matching property name | ✅ Covered |
| 2 | Only `default` export | ✅ Covered |
| 3 | Single named export NOT matching property name | ❌ Not covered |
| 4a | `default` (function) + named exports | ✅ Covered |
| 4b | `default` (object) + named exports | ❌ Not covered |
| 4c | `default` (primitive) + named exports | ❌ Not covered |
| 5 | Multiple named exports → namespace object | ❌ Not covered |

Case 3, 4b, 4c, and 5 all require specific export shapes that no existing API fixture provides.

### Fix

- Create API fixtures or synthetic test modules with the missing export shapes (e.g. a CJS file with `module.exports = { default: {someObj}, namedA, namedB }` for case 4b, and a file exporting multiple named exports for case 5).
- For the fork error paths in lines 98–306, test by either mocking `fork` to emit an error/exit event, or by passing a broken script path.

---

## 3. `src/lib/handlers/metadata.mjs` — 54% lines 🟠

### Uncovered regions

#### `removePathMetadata(apiPath, key)` (lines ~630–657)

This public method is documented but never called in any test. It covers three sub-cases:

- `key === undefined` → deletes entire store entry
- `key` is an `Array<string>` → deletes each key individually (also validates each is a string, throws `INVALID_METADATA_KEY` if not)
- `key` is a `string` → deletes one key
- Invalid `key` type → throws `INVALID_METADATA_KEY`

#### `exportUserState()` / `importUserState(state)` (lines ~662–762)

These are called by `slothlet.reload()` to preserve user metadata across a hot reload. Despite `metadata-reload.test.vitest.mjs` existing, it doesn't exercise the metadata state preservation path.

`exportUserState` returns a snapshot of `#globalUserMetadata` and `#userMetadataStore`. `importUserState` merges a previously exported snapshot back into a fresh instance, with "existing keys win" merge semantics.

#### `caller()`, `self()`, `get()` (lines ~763–881)

Stack-based metadata introspection methods. All three:

1. Call `this.#ensureRuntime()` to lazy-load the runtime module.
2. Get the API root from the live Slothlet instance.
3. Use `slothlet.helpers.resolver.getStack()` to inspect the call stack.
4. Parse the top stack frame to extract `file` + `line`.
5. Walk the API tree to find the function at that source location.
6. Return `__metadata` from the matched function.

`caller()` additionally does a security cross-check — compares the stack file path against the stored metadata file path and appends a `__securityWarning` property if they mismatch.

None of these are called from any test. The closest test suite (`metadata-external-api.test.vitest.mjs`) exercises external metadata access but doesn't call `metadata.caller()` or `metadata.self()`.

### Fix

- Add tests for `removePathMetadata` with each argument shape (undefined, string, array, invalid).
- Add a reload test that calls slothlet with user metadata set, reloads, and asserts the metadata survived.
- Add tests that call an API function from within a context where `api.slothlet.metadata.self()` and `api.slothlet.metadata.caller()` are invocable.

---

## 4. `src/lib/processors/flatten.mjs` — 52% lines 🟠

### Uncovered conditions

The `getFlatteningDecision()` method implements 18 conditions (C01–C18). The following are never triggered by any test fixture:

| Condition | Description | Trigger |
|---|---|---|
| C14 | Generic filename with a single export | A file whose base name is a generic word (`index`, `util`, etc.) that has only one named export |
| C15 | Function name matches folder name | A function exported from `math/Math.mjs` where `fn.name === "Math"` (case-insensitive match) |
| C17 | Default function export with no name (or `default` name) at depth > 0 | An anonymous or `export default function(){}` in a non-root file |
| C18 | Object auto-flatten — single export key matches module name | A module whose only export key exactly equals the module name |

These conditions are in the tail of `getFlatteningDecision`, after the earlier conditions short-circuit. The `smart_flatten` test suite covers many rules but not these specific branches.

### Fix

Add fixture files in `api_tests/smart_flatten/` that trigger each untested condition, and add corresponding test cases in `smart-flattening.test.vitest.mjs`.

---

## 5. `src/lib/runtime/runtime.mjs` — 65% lines 🟡

### Uncovered proxy handlers

The `self`, `context`, and `instanceID` exports are `Proxy` objects. The covered paths are `get` traps (property access like `self.someMethod`). The uncovered handlers are:

- **`self` proxy**: `ownKeys` (for `Object.keys(self)` / spread), `has` (`'prop' in self`), `getOwnPropertyDescriptor` (`Object.getOwnPropertyDescriptor(self, 'prop')`)
- **`context` proxy**: `set` trap (`context.myKey = value` from within a live binding)
- **`instanceID` proxy**: `get`, `has` — the entire `instanceID` export is never accessed

### Fix

Add tests that enumerate `self` (spread or `Object.keys`), use the `in` operator on `self`, and access `instanceID` properties from within a context-scoped API function.

---

## 6. `src/lib/runtime/runtime-livebindings.mjs` — 61% lines 🟡

Same class of problem as `runtime.mjs` — the live runtime proxy's `ownKeys`, `has`, and `getOwnPropertyDescriptor` handlers are untested. These are exercised only when code enumerates or spreads the `self`/`context` proxies while inside a **live** (synchronous) context scope.

### Fix

Add tests using live-context scoped API functions that enumerate or spread `self`.

---

## 7. `src/lib/handlers/lifecycle.mjs` — 69% lines 🟡

### Uncovered regions

#### Async handler error path (lines ~176–180)

Inside `emit()`, when an async lifecycle handler's Promise rejects, the error is caught silently (unless `config.silent` is false, in which case it's logged). No test currently triggers an async handler that throws.

```javascript
handlerPromises.push(
    result.catch((error) => {
        if (!this.____config?.silent) {
            console.error(`[slothlet] Lifecycle event handler error (${event}):`, error);
        }
    })
);
```

#### Synchronous handler error path (lines ~195–200)

Same pattern for synchronous handlers that throw inside the `emit()` loop.

#### Utility methods (lines ~205–224)

`getEventLog()`, `clearEventLog()`, and `getSubscriberCount()` are never called in any test. These are simple accessors / mutators on internal state.

### Fix

- Add a lifecycle test where an async `on()` handler rejects — verify it doesn't crash the emit.
- Add a test where a sync handler throws — verify emit continues.
- Add tests calling `getEventLog()`, `clearEventLog()`, and `getSubscriberCount()`.

---

## Summary Table

| File | Lines | Priority | Root Cause | Fix |
|---|---|---|---|---|
| `processors/type-generator.mjs` | 1% | 🔴 Critical | Runs in forked subprocess — V8 coverage not collected | Direct unit test bypassing the loader |
| `processors/loader.mjs` | 61% | 🔴 Critical | Fork error branches + 4 missing export-shape cases in `mergeExportsIntoAPI` | Error-path mocks + new CJS/ESM export fixtures |
| `handlers/metadata.mjs` | 54% | 🟠 High | `removePathMetadata`, export/import state, and stack-introspection methods not tested | Targeted unit tests for each method |
| `processors/flatten.mjs` | 52% | 🟠 High | C14/C15/C17/C18 flattening conditions never triggered | New fixture files for each condition |
| `runtime/runtime.mjs` | 65% | 🟡 Medium | Proxy `ownKeys`, `has`, `getOwnPropertyDescriptor`, `instanceID` never accessed | Tests that enumerate proxy + access instanceID |
| `runtime/runtime-livebindings.mjs` | 61% | 🟡 Medium | Same as above but for live-context runtime | Live-context enumeration tests |
| `handlers/lifecycle.mjs` | 69% | 🟡 Medium | Async/sync error paths in `emit()` + utility methods uncalled | Error-throwing handler tests + accessor tests |
