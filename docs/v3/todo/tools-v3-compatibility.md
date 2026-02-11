# Tools V3 Compatibility Status

**Last Evaluated:** 2026-02-10  
**Last Updated:** 2026-02-10

This document tracks the status of all tools in the `tools/` folder for v3 compatibility and working status.

## Status Key

- **Updated to V3**: ✅ Yes | ⚠️ Partial | ❌ No | 🔍 Unknown
- **Working**: ✅ Yes | ⚠️ Issues | ❌ Broken | 🔍 Not Tested

## Tools Status Table

| File | Updated to V3 | Working | Notes |
|------|---------------|---------|-------|
| analyze-errors.mjs | ✅ Yes | ✅ Yes | Validates SlothletError/Warning usage and translations - **KEEP: Critical for code quality** |
| build-exports.mjs | ✅ Yes | ✅ Yes | Generates types/index.d.mts from src/slothlet.mjs - **KEEP: Required for TypeScript** |
| build-with-tests.mjs | ⚠️ Broken | ❌ Delete | Orchestrates build + tests but references deleted test:unit - **DELETE: Obsolete, users can run `npm run build && npm test`** |
| ci-cleanup-src.mjs | ✅ Yes | ✅ Yes | Removes src/ in CI to force dist/ testing - **KEEP: Critical for CI validation** |
| fix-headers.mjs | ✅ Yes | ✅ Yes | Automated file header maintenance (611 lines) - **KEEP: Permanent maintenance tool** |
| inspect-api-structure.mjs | ✅ Yes | ✅ Yes | Debug tool for lazy/eager API structure - **KEEP: Essential for development** |
| list-vitest-tests.mjs | ❌ Broken | ❌ Delete | Lists tests but searches wrong directories - **DELETE: Broken & unnecessary** |
| precommit-validation.mjs | ✅ Yes | ✅ Yes | Pre-commit validation (run via `npm run precommit`) - **KEEP: Comprehensive validation sequence** |
| prepend-license.mjs | ✅ Yes | ✅ Yes | Adds Apache license to dist/ files (424 lines) - **KEEP: Required for publishing** |
| prepublish-check.mjs | ⚠️ Broken | ⚠️ Fix | Pre-publish validation with path bugs - **FIX: Replace pathname manipulation with fileURLToPath** |
| run-vitest-shards.mjs | ❌ Deprecated | ❌ Delete | Superseded by run-all-vitest.mjs - **DELETE: Deprecated** |
| lib/header-config.mjs | ✅ Yes | ✅ Yes | Shared config for header validation - **KEEP: Used by multiple tools** |

## Action Items

### Summary (Updated 2026-02-10)
**Deep Dive Complete:** All 12 tools analyzed for purpose, V3 compatibility, and actual necessity.

**Status Breakdown:**
- ✅ Keep & Working (7): analyze-errors, build-exports, ci-cleanup-src, fix-headers, inspect-api-structure, prepend-license, precommit-validation, lib/header-config
- ⚠️ Keep but Fix (1): prepublish-check
- ❌ Delete (3): build-with-tests, list-vitest-tests, run-vitest-shards

### High Priority  
- [x] Deep dive into each tool's actual purpose and necessity
- [x] Fix precommit-validation.mjs - Change test:unit → vitest
- [ ] Fix prepublish-check.mjs - Replace pathname manipulation with fileURLToPath
- [ ] Delete obsolete tools: build-with-tests.mjs, list-vitest-tests.mjs, run-vitest-shards.mjs

### Medium Priority
- [ ] Consider setting up actual git pre-commit hook for precommit-validation.mjs
- [ ] Add --help flags to remaining tools without them
- [ ] Document tool usage in main README or CONTRIBUTING.md

## Deep Dive Analysis (2026-02-10)

### ci-cleanup-src.mjs
**Purpose**: Removes `src/` folder in CI environments after build to force testing against `dist/` folder  
**V3 Compatibility**: ✅ Yes - no V2-specific code  
**Still Needed?**: ✅ YES - Critical for ensuring published package works correctly  
**Working?**: ✅ Yes - Properly detects CI environment and safely removes src/  
**Notes**: Safety mechanism prevents accidental deletion in dev environments. This ensures CI tests run against the actual distribution code that will be published.

### fix-headers.mjs  
**Purpose**: Automated file header maintenance tool (611 lines)
- Validates header format against expected standard
- Extracts actual git creation dates
- Fixes date format issues (timezone format)
- Adds missing Unix timestamps
- Removes duplicate headers
- Fixes broken JSDoc comments
- Normalizes excessive whitespace
- Supports dry-run mode for testing

**V3 Compatibility**: ✅ Yes - Created during V3 development (2026-02-04)  
**Still Needed?**: ✅ YES - Permanent tool, not temporary  
**Working?**: ✅ Yes - Fully functional with git integration  
**Notes**: Uses shared config from `lib/header-config.mjs`. This is a maintenance tool that should be kept.

### list-vitest-tests.mjs
**Purpose**: Lists Vitest test files and extracts test titles for quick inspection  
**V3 Compatibility**: ⚠️ Broken - Hardcoded wrong directories  
**Still Needed?**: ❌ NO - Can just use `find` or file explorer  
**Working?**: ❌ NO - Only searches `tests/vitests/` and `tests/vitests/process/` but tests are in `tests/vitests/suites/` and `tests/vitests/processed/`  
**Issue**: Line 73 hardcodes: `const dirs = [vitestRoot, path.join(vitestRoot, "process")];`  
**Actual locations**: Tests are in `tests/vitests/suites/` and `tests/vitests/processed/`  
**Recommendation**: DELETE - Tool provides no value over basic file listing

### precommit-validation.mjs
**Purpose**: Pre-commit validation sequence that runs 7 steps:
1. Clean Build Artifacts (`build:cleanup`)
2. API Structure Debug (`debug`)
3. Node Test Suite (`test:node`)
4. Build Distribution (`build:dist`)
5. Vitest Suite (`vitest`)
6. Build TypeScript Types (`build:types`)
7. Validate TypeScript (`test:types`)

**V3 Compatibility**: ✅ Yes - Fixed to use correct script names  
**Still Needed?**: ✅ YES - Run via `npm run precommit` for comprehensive validation  
**Working?**: ✅ YES - All steps reference valid npm scripts  
**Usage**: Run manually with `npm run precommit` before committing changes  
**Notes**: Not a git hook itself, but can be added as pre-commit hook if desired. Provides comprehensive validation sequence.

### prepend-license.mjs  
**Purpose**: Adds Apache License 2.0 headers to all files in dist/ before publishing (424 lines)
- Auto-detects owner from package.json
- Supports multiple file types with appropriate comment syntax
- Preserves shebang lines
- Skips files that already have license headers
- Used in build pipeline

**V3 Compatibility**: ✅ Yes - no V2-specific code  
**Still Needed?**: ✅ YES - Required for publishing  
**Working?**: ✅ YES - Successfully prepended licenses to 33 files in dist/  
**Notes**: Part of CI build pipeline (`build:ci` and `build:unsafe` scripts). Critical for legal compliance.

### prepublish-check.mjs
**Purpose**: Pre-publish validation that:
1. Creates temp directory
2. Installs the packed .tgz file
3. Tests require/import in production mode
4. Cleans up temp files

**V3 Compatibility**: ⚠️ Has bugs - Path resolution issues  
**Still Needed?**: ✅ YES - Validates package before publishing  
**Working?**: ⚠️ Partially - Has path resolution bugs with `pathname.replace()` pattern  
**Issue**: Line 20-22 uses complex pathname manipulation that fails: 
```javascript
const tmpDir = path.resolve(path.dirname(new URL(import.meta.url).pathname.replace(/^\\?\/[A-Za-z]:/, "")), "..", "tmp-npm-test");
```
Results in `undefined` in path on some systems.  
**Recommendation**: FIX - Simplify to use `fileURLToPath(import.meta.url)` pattern like other tools

### Summary of Findings

**Tools Status:**
- ✅ **Keep & Working** (7): ci-cleanup-src, fix-headers, prepend-license, analyze-errors, inspect-api-structure, build-exports, precommit-validation
- ⚠️ **Keep but Fix** (1): prepublish-check (fix path resolution)
- ❌ **Delete** (3): list-vitest-tests (broken & unnecessary), run-vitest-shards (deprecated), build-with-tests (obsolete)
