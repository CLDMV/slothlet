# V3 Migration Status - api.__ctx Issue

**Date:** 2026-01-28 12:20

## Critical Issue Found

`api.__ctx` **does not exist in v3**. Many tests use this internal property which needs to be updated.

## V3 API Replacements

### Without Diagnostics
- `api.__ctx` → ❌ Does not exist
- `api.__ctx.instanceId` → `api.slothlet.instanceID` ✅
- `api.__ctx.self` → Not exposed (internal)
- `api.__ctx.context` → Not exposed without diagnostics
- `api.__ctx.als` → Not exposed (internal ALS implementation)
- `api.__ctx.hookManager` → `api.slothlet.hooks` (when hooks enabled)

### With `diagnostics: true`
- `api.slothlet.diag.context` → User context
- `api.slothlet.diag.reference` → Reference object
- `api.slothlet.diag.inspect()` → Instance diagnostics
- `api.slothlet.diag.describe()` → API structure description

## Files Using api.__ctx (29 occurrences)

### Context Tests (15 occurrences)
1. **als-cleanup.test.vitest.mjs** - 9 occurrences
   - Tests internal ALS implementation directly
   - Uses `api.__ctx.als`, `api.__ctx.self`, `api.__ctx.context`, `api.__ctx.instanceId`
   - **Status:** Needs major rewrite or skip - tests internals not exposed in v3

2. **auto-context-propagation.test.vitest.mjs** - 1 occurrence  
   - Line 50: `expect(api.__ctx).toBeTruthy();`
   - **Fix:** Remove test or test diagnostics mode

### Hooks Tests (11 occurrences)
3. **hooks-debug.test.vitest.mjs** - 6 occurrences
   - Uses `api.__ctx.hookManager`
   - **Fix:** Use `api.slothlet.hooks` instead (when hooks enabled)

4. **hooks-internal-properties.test.vitest.mjs** - 4 occurrences
   - Tests that accessing `__ctx` doesn't trigger hooks
   - **Fix:** Test v3 internal properties or skip

5. **hook-subsets.test.vitest.mjs** - 1 occurrence
   - Line 46: `console.log("HookManager enabled (__ctx):", api.__ctx?.hookManager?.enabled);`
   - **Fix:** Use `api.slothlet.hooks` instead

### Isolation Tests (4 occurrences)
6. **multi-instance-isolation.test.vitest.mjs** - 4 occurrences
   - Lines 67-68, 70-71: `api1.__ctx.context.name`, `api1.__ctx.context.value`
   - **Fix:** Enable diagnostics and use `api.slothlet.diag.context`

## Test Files Marked as "1st Pass" (Not Fully V3 Compatible)

These were updated for hotReload filter removal but NOT checked for `api.__ctx` usage:

### API Tests (8 files)
- api-eager-basic.test.vitest.mjs
- api-eager-hooks.test.vitest.mjs
- api-eager-hot.test.vitest.mjs
- api-eager-live.test.vitest.mjs
- api-lazy-basic.test.vitest.mjs
- api-lazy-hooks.test.vitest.mjs
- api-lazy-hot.test.vitest.mjs
- api-lazy-live.test.vitest.mjs

### Context Tests (1 file) 
- als-cleanup.test.vitest.mjs - CRITICAL: Heavy `__ctx` usage

### Diagnostics (1 file)
- mixed-diagnostic.test.vitest.mjs

### API Manager (6 files)
- api-manager-advanced.test.vitest.mjs
- api-manager-basic.test.vitest.mjs
- api-manager-errors.test.vitest.mjs
- api-manager-hooks.test.vitest.mjs
- api-manager-reference-identity.test.vitest.mjs
- api-manager-test-remove-reload-isolated.test.vitest.mjs

### Isolation (1 file)
- multi-instance-isolation.test.vitest.mjs - Uses `api.__ctx.context`

### Runtime (1 file)
- runtime-verification.test.vitest.mjs

### Rules (1 file)
- rule-12-comprehensive.test.vitest.mjs

## Tests Not Yet Updated for V3

### Hooks Tests (13 files) - May use `__ctx`
- hooks-after-chaining.test.vitest.mjs
- hooks-always-error-context.test.vitest.mjs
- hooks-before-chaining.test.vitest.mjs
- hooks-comprehensive.test.vitest.mjs
- hooks-debug.test.vitest.mjs ✅ Known to use `__ctx`
- hooks-error-source.test.vitest.mjs
- hooks-execution.test.vitest.mjs
- hooks-internal-properties.test.vitest.mjs ✅ Known to use `__ctx`
- hooks-mixed-scenarios.test.vitest.mjs
- hooks-patterns.test.vitest.mjs
- hooks-short-circuit.test.vitest.mjs
- hooks-suppress-errors.test.vitest.mjs
- hook-subsets.test.vitest.mjs ✅ Known to use `__ctx`

### Context Tests (5 files)
- auto-context-propagation.test.vitest.mjs ✅ Known to use `__ctx`
- map-set-proxy-fix.test.vitest.mjs
- per-request-context.test.vitest.mjs
- tcp-context-propagation.test.vitest.mjs
- tcp-eventemitter-context.test.vitest.mjs

### Other Tests (6 files)
- api-structures/all-api-structures.test.vitest.mjs
- api/function-name-preservation.test.vitest.mjs
- isolation/tv-config-isolation.test.vitest.mjs
- listener-cleanup/listener-cleanup.test.vitest.mjs
- listener-cleanup/third-party-cleanup.test.vitest.mjs
- proxies/proxy-baseline.test.vitest.mjs
- ref/reference-readonly-properties.test.vitest.mjs
- sanitization/sanitization-v2v3-compat.test.vitest.mjs
- sanitization/sanitize.test.vitest.mjs
- rules/rule-coverage.test.vitest.mjs

## Recommended Next Steps

1. **Fix hooks tests**: Replace `api.__ctx.hookManager` with `api.slothlet.hooks`
2. **Fix isolation tests**: Enable diagnostics, use `api.slothlet.diag.context`
3. **Skip/rewrite ALS tests**: `als-cleanup.test.vitest.mjs` tests internals not exposed in v3
4. **Audit all "1st pass" tests**: Check each for hidden `__ctx` usage
5. **Update remaining untested files**: Check for `__ctx`, `hotReload`, `index2.mjs` usage

## Summary

- **Total files with __ctx:** 6 identified files, 29 occurrences
- **Files marked "1st pass":** 19 files (not fully v3 compatible)
- **Files not yet updated:** ~30 files
- **Critical blockers:** ALS internal tests, hooks internal property tests
