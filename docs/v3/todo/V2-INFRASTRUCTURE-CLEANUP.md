# V2/V3 Dual-Version Infrastructure Cleanup

**Created:** 2026-02-06  
**Status:** Partially Complete  
**Priority:** Medium - Post V3 Stabilization  
**Last Updated:** 2026-02-10

---

## Overview

During V3 development, infrastructure was added to allow running V2 or V3 code without switching branches. This included:
- Dual source folders (src/, src2/)
- Dual test folders (tests/vitests/, tests/vitests_v2/)
- Dual API test folders (api_tests/, api_tests_v2/)
- Conditional exports in package.json
- Environment-based version switching

**These folders have now been moved to `reference/v2/` (gitignored) to avoid confusion.**

The codebase still contains v2/v3 switching logic that needs cleanup.

---

## ✅ Deleted / Moved to reference/v2/ (gitignored)

- `src2/` — ✅ Deleted
- `api_tests_v2/` — ✅ Deleted  
- `tests/vitests_v2/` — ✅ Deleted
- `index2.mjs` — ✅ Deleted
- `index2.cjs` — ✅ Deleted

---

## Infrastructure to Remove

### 1. Package.json Conditional Exports

**Current (Dual Version):**
```json
"./slothlet": {
  "slothlet-two-dev": {
    "types": "./types/src2/slothlet.d.mts",
    "import": "./src2/slothlet.mjs"
  },
  "slothlet-dev": {
    "types": "./types/src/slothlet.d.mts",
    "import": "./src/slothlet.mjs"
  },
  "types": "./types/dist/slothlet.d.mts",
  "import": "./dist/slothlet.mjs"
}
```

**Target (V3 Only):**
```json
"./slothlet": {
  "slothlet-dev": {
    "types": "./types/src/slothlet.d.mts",
    "import": "./src/slothlet.mjs"
  },
  "types": "./types/dist/slothlet.d.mts",
  "import": "./dist/slothlet.mjs"
}
```

**Action Items:**
- [ ] Remove all `slothlet-two-dev` conditional exports from package.json (⚠️ **14 entries still present**)
- [ ] Remove dual-version exports for all submodules (runtime, modes, etc.)
- [ ] Update devcheck.mjs to remove V2 detection logic

### 2. Source Folder Structure

**Current:**
- `src/` - V3 source (keep)
- ~~`src2/`~~ - ✅ Deleted
- `src copy/` - ⚠️ **Still exists** — Unknown purpose, needs investigation and removal

**Target:**
- `src/` - V3 source only

**Action Items:**
- [x] Delete `src2/` folder
- [ ] Investigate and remove `src copy/` folder
- [x] Update any build scripts referencing src2/

### 3. Test Infrastructure

**Current:**
- `tests/vitests/` - V3 tests (keep)
- ~~`tests/vitests_v2/`~~ - ✅ Deleted
- `api_tests/` - V3 API test modules (keep)
- ~~`api_tests_v2/`~~ - ✅ Deleted

**Target:**
- `tests/vitests/` - V3 tests only
- `api_tests/` - V3 API test modules only

**Action Items:**
- [x] Delete `tests/vitests_v2/` folder
- [x] Delete `api_tests_v2/` folder
- [ ] Remove references to vitests_v2 from package.json scripts (⚠️ `test:unit` and `vitest:all` still point to `tests/vitests_v2/`)
- [ ] Update test runners that check for both versions

### 4. Entry Points

**Current:**
- `index.mjs` / `index.cjs` - V3 entry points (keep)
- ~~`index2.mjs` / `index2.cjs`~~ - ✅ Deleted

**Target:**
- `index.mjs` / `index.cjs` - V3 entry points only

**Action Items:**
- [x] Delete `index2.mjs` and `index2.cjs`
- [ ] Remove index2 references from package.json exports (⚠️ 3 references still present: types, import, require)
- [ ] Update type definitions to remove index2.d.mts

### 5. Environment Detection Logic

**Files with V2/V3 switching logic:**
- `tests/debug-slothlet.mjs` - Has `ensureDevEnvFlags(forceV2)` parameter
- `tests/vitests/setup/*.mjs` - May have v2/v3 detection
- `.configs/vitest.config.mjs` - Has `slothlet-two-dev` condition handling
- `devcheck.mjs` - Detects v2 vs v3 mode

**Action Items:**
- [ ] Remove `forceV2` parameter from debug-slothlet.mjs
- [ ] Remove `--v2` CLI flag support from test scripts
- [ ] Remove `slothlet-two-dev` condition from vitest.config.mjs
- [ ] Simplify devcheck.mjs to only check v3 conditions
- [ ] Remove `useV2` variables and logic from all test helpers

### 6. Package.json Scripts

**Scripts still pointing to V2 paths:**
```json
"test:unit": "node tests/vitests_v2/run-all-vitest.mjs",  // ⚠️ BROKEN - folder deleted
"vitest:all": "node tests/vitests_v2/run-all-vitest.mjs",  // ⚠️ BROKEN - folder deleted
```

**Action Items:**
- [ ] Fix `test:unit` and `vitest:all` to point to `tests/vitests/` (or remove if redundant)
- [ ] Remove scripts pointing to api_tests_v2/
- [ ] Verify all npm scripts work with v3-only structure

### 7. Documentation

**Files to update:**
- `README.md` - May reference dual-version setup
- `CONTRIBUTING.md` - May reference v2 testing
- `.github/copilot-instructions.md` - May reference v2/v3 switching
- Any docs mentioning `--v2` flag or src2/ folder

**Action Items:**
- [ ] Search for `slothlet-two-dev` in all markdown files
- [ ] Search for `src2` references
- [ ] Search for `index2` references
- [ ] Search for `vitests_v2` references
- [ ] Update all documentation to reflect v3-only structure

---

## Verification Steps

After cleanup:
1. [ ] Run `npm run debug` - should work with v3 only
2. [ ] Run `npm run baseline` - should use tests/vitests/ only
3. [ ] Run `npm run analyze` - should work with v3 only
4. [ ] Verify no broken imports from deleted folders
5. [ ] Verify package.json exports all resolve correctly
6. [ ] Verify TypeScript types compile without errors
7. [ ] Search codebase for remaining v2 references:
   - `grep -r "slothlet-two-dev"`
   - `grep -r "src2"`
   - `grep -r "index2"`
   - `grep -r "vitests_v2"`
   - `grep -r "api_tests_v2"`

---

## Breaking Changes

**None** - This is internal cleanup only. The v2 API is already deprecated and moved to reference/.

---

## Timeline

- **Phase 1:** Remove folder references (package.json, scripts) - 1 hour
- **Phase 2:** Clean up conditional exports - 1 hour  
- **Phase 3:** Remove environment detection logic - 2 hours
- **Phase 4:** Update documentation - 1 hour
- **Phase 5:** Verification testing - 1 hour

**Total Estimate:** ~6 hours of cleanup work

---

## Notes

- Keep reference/v2/ folder in .gitignore for historical reference
- Do NOT publish reference/ folder to npm
- V2 is deprecated and no longer supported
- All new development should target V3 only
