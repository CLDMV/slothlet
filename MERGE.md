# DUAL-RUNTIME MERGE SPECIFICATION

**CRITICAL**: AI agents working on this codebase MUST reference this file at all times to understand the merge requirements and avoid overcomplicating the implementation.

## PROBLEM STATEMENT

The slothlet project needs to support two runtime systems:

1. **AsyncLocalStorage Runtime** (master branch) - Working, stable, uses AsyncLocalStorage for context
2. **Experimental Runtime** (experiment/random-idea branch) - Working, uses instance detection via stack traces

The goal is to merge both into a single codebase with a runtime configuration option that chooses which system to use.

## WHAT WENT WRONG PREVIOUSLY

The previous attempt created an overcomplicated "proxy dispatcher" system that:

- Added unnecessary complexity with runtime.mjs dispatching to sub-runtimes
- Broke basic functionality like `Object.keys(self)`
- Used complex proxy chains that made debugging difficult
- Violated the principle of keeping working code working

## CORRECT APPROACH

### Simple Runtime Selection Strategy

**DO NOT** create proxy dispatchers or complex runtime switching logic.

**DO** implement simple runtime selection:

1. **One runtime per slothlet instance** - choose at creation time
2. **Runtime modules stay independent** - don't merge their internals
3. **Selection happens in slothlet.mjs** - import the right runtime based on config
4. **Both runtimes export identical interfaces** - same API surface

### File-by-File Implementation Plan

Based on `git diff master..experiment/random-idea --name-only`, these are the key files to merge:

#### 1. Core Runtime Selection (`src/slothlet.mjs`)

- Add `runtime` config option (`"asynclocalstorage"` | `"experimental"`)
- Import appropriate runtime module based on config
- Default to `"asynclocalstorage"` for backward compatibility

#### 2. Runtime Modules

- **Keep** `src/lib/runtime/runtime.mjs` as AsyncLocalStorage implementation (master)
- **Add** `src/lib/runtime/runtime-experimental.mjs` from experiment branch
- **Export pattern**: Both modules export `{ self, context, reference, makeWrapper, etc. }`

#### 3. Helper Modules

- **Add** `src/lib/helpers/instance-manager.mjs` (needed for experimental runtime)
- **Merge** changes to existing helpers if they support both runtimes

#### 4. Entry Points (`index.mjs`, `index.cjs`)

- Pass through runtime config to slothlet
- Maintain backward compatibility (no breaking changes)

#### 5. Mode Files (`src/lib/modes/slothlet_lazy.mjs`, etc.)

- Update to work with runtime selection
- Should not care which runtime is used

#### 6. Test Files

- **Add** `tests/debug-dual-runtime.mjs` (already copied)
- **Add** `api_tests/api_test/runtime-test.mjs` (already copied)
- Update any tests that might be runtime-specific

## IMPLEMENTATION RULES

### 1. Keep Working Code Working

- AsyncLocalStorage runtime (master) should work exactly as before
- Experimental runtime should work exactly as it did in experiment branch
- No breaking changes to existing APIs

### 2. Runtime Interface Contracts

Both runtime modules MUST export:

```javascript
export const self = /* Proxy to current API instance */;
export const context = /* Proxy to current context */;
export const reference = /* Proxy to current reference */;
export function makeWrapper(ctx) { /* Function wrapper */ }
export function runWithCtx(ctx, fn, thisArg, args) { /* Context runner */ }
export function getCtx() { /* Context getter */ }
```

### 3. Configuration Schema

```javascript
const api = await slothlet({
	dir: "./api",
	runtime: "asynclocalstorage" | "experimental" // NEW OPTION
	// ... existing options
});
```

### 4. Import Pattern in slothlet.mjs

```javascript
// Simple runtime selection - NO PROXIES
let runtime;
if (this.config.runtime === "experimental") {
	runtime = await import("./lib/runtime/runtime-experimental.mjs");
} else {
	runtime = await import("./lib/runtime/runtime.mjs"); // AsyncLocalStorage
}

// Use the selected runtime
const { makeWrapper } = runtime;
```

### 5. File Export from Git Branches

When copying files from other branches, ALWAYS use Node.js with UTF-8 encoding:

```javascript
const { execSync } = require("child_process");
const fs = require("fs");
const content = execSync("git show branch:path/file.mjs", { encoding: "utf8" });
fs.writeFileSync("path/file.mjs", content, "utf8");
```

## VERIFICATION CHECKLIST

Before considering the merge complete:

- [ ] Both runtimes work independently
- [ ] `tests/debug-dual-runtime.mjs` passes with all 4 configurations
- [ ] No proxy dispatchers in the runtime chain
- [ ] `Object.keys(self)` works correctly in both runtimes
- [ ] All existing tests continue to pass
- [ ] New runtime config is optional (defaults to AsyncLocalStorage)
- [ ] No breaking changes to existing API

## KEY FILES FROM EXPERIMENT BRANCH

Extract these files with proper UTF-8 encoding:

1. `src/lib/helpers/instance-manager.mjs` - Instance detection for experimental runtime
2. `src/lib/runtime/runtime-experimental.mjs` - The experimental runtime implementation
3. `tests/test-experimental-runtime-validation.mjs` - Comprehensive experimental tests
4. `tests/test-multi-instance-isolation.mjs` - Multi-instance test
5. Any updates to `api_tests/api_test/advanced/self-object.mjs` for instance testing

## ANTI-PATTERNS TO AVOID

❌ **DON'T** create `runtime.mjs` that dispatches to other runtimes  
❌ **DON'T** use proxy chains that break basic JavaScript operations  
❌ **DON'T** overcomplicate the runtime selection  
❌ **DON'T** merge runtime internals - keep them separate  
❌ **DON'T** change working runtime implementations

✅ **DO** keep runtime selection simple and at the slothlet.mjs level  
✅ **DO** maintain identical runtime interfaces  
✅ **DO** preserve existing functionality  
✅ **DO** test both runtimes thoroughly

## SUCCESS CRITERIA

The merge is successful when:

1. User can choose runtime via config option
2. Both runtimes work exactly as they did in their original branches
3. No breaking changes to existing functionality
4. All tests pass including the new dual-runtime test
5. The implementation is simple and maintainable

**Remember: The goal is to provide choice between two working runtimes, not to create a new complex runtime system.**
