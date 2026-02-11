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
| analyze-errors.mjs | ✅ Yes | ✅ Yes | Analyzes SlothletError/Warning usage, validates translations, checks file headers - Updated for v3 |
| build-exports.mjs | ✅ Yes | ✅ Yes | Generates package.json exports based on source structure - Tested 2026-02-10 |
| build-with-tests.mjs | ⚠️ Partial | ⚠️ Issues | Build and test orchestration - Runs but fails due to missing test:unit script (fixed in V2 cleanup) |
| ci-cleanup-src.mjs | ✅ Yes | ✅ Yes | CI cleanup operations for source files - Works correctly (skips cleanup when not in CI) |
| fix-headers.mjs | ✅ Yes | ✅ Yes | Automated file header fixing with git integration - Created for v3 |
| inspect-api-structure.mjs | ✅ Yes | ✅ Yes | API structure inspection utility - **Updated 2026-02-10**: Removed V2 support, V3-only, tested with lazy/eager modes |
| list-vitest-tests.mjs | ⚠️ Partial | ⚠️ Issues | Lists vitest test files - Returns "No Vitest files found" (needs investigation) |
| precommit-validation.mjs | ✅ Yes | ⚠️ Issues | Pre-commit validation checks - Works but test:node currently failing (unrelated to tool) |
| prepend-license.mjs | ✅ Yes | ⚠️ Issues | Prepends license headers to files - Requires dist/ folder, used in build pipeline |
| prepublish-check.mjs | ⚠️ Partial | ⚠️ Issues | Pre-publish validation checks - Has path resolution issues, needs fixing |
| run-vitest-shards.mjs | ⚠️ Deprecated | ⚠️ Deprecated | Runs vitest tests in sharded mode - Superseded by tests/vitests/run-all-vitest.mjs |
| lib/header-config.mjs | ✅ Yes | ✅ Yes | Shared configuration for file header validation - Created for v3 |

## Action Items

### Summary (Updated 2026-02-10)
**Testing Complete:** All 12 tools have been evaluated for V3 compatibility.

**Status Breakdown:**
- ✅ Fully Working: 5 tools (analyze-errors, fix-headers, inspect-api-structure, build-exports, ci-cleanup-src, lib/header-config)
- ⚠️ Working with Issues: 4 tools (precommit-validation, build-with-tests, prepend-license, prepublish-check, list-vitest-tests)
- ❌ Deprecated: 1 tool (run-vitest-shards)

### High Priority
- [x] Test all tools marked as "🔍 Not Tested" to verify working status
- [ ] Fix prepublish-check.mjs path resolution issues
- [ ] Fix list-vitest-tests.mjs to properly detect test files
- [ ] Update build-with-tests.mjs to use correct test script name
- [ ] Consider removing or archiving run-vitest-shards.mjs (deprecated)

### Medium Priority
- [ ] Add error handling improvements to tools that may fail silently
- [ ] Standardize CLI argument parsing across all tools
- [ ] Add `--help` flags to all tools
- [ ] Consider adding shared configuration file for common tool settings

### Low Priority
- [ ] Add progress indicators to long-running tools
- [ ] Create tool usage documentation
- [ ] Add dry-run mode to destructive operations
- [ ] Consider creating a unified tool runner

## Testing Checklist

For each tool, verify:
- [ ] Runs without errors on current codebase
- [ ] Handles v3 API structure correctly (if applicable)
- [ ] Works with both lazy and eager loading modes (if applicable)
- [ ] Properly handles AsyncLocalStorage contexts (if applicable)
- [ ] File paths and imports are correct for v3 structure
- [ ] Output is accurate and useful
- [ ] Error messages are clear and actionable
- [ ] CLI flags work as documented

## Notes

### V3-Native Tools (Created During V3 Development)
- **fix-headers.mjs**: Created 2026-02-04, fully functional with git integration, auto copyright year updates
- **lib/header-config.mjs**: Created 2026-02-04, shared config between analyze-errors.mjs and fix-headers.mjs

### Confirmed Updated for V3
- **analyze-errors.mjs**: Updated to use header-config.mjs shared configuration, v3 compatible
- **inspect-api-structure.mjs**: Updated 2026-02-10, removed all V2 support (--v2 flag, useV2 parameter, slothlet-two-dev detection), now V3-only - ✅ **TESTED & WORKING** (lazy and eager modes verified)

### Recent Updates (2026-02-10)
- **inspect-api-structure.mjs**: 
  - Removed `--v2` CLI flag
  - Removed `useV2` parameter from all functions
  - Removed slothlet-two-dev condition detection
  - Updated to use V3 api_tests paths exclusively
  - Simplified forceMaterializeLazyFolders to V3-only logic
- **All tools tested**: Completed comprehensive testing of all 12 tools in tools/ directory
- **Identified issues**: 
  - build-with-tests.mjs references old test:unit script
  - prepublish-check.mjs has path resolution bugs
  - list-vitest-tests.mjs not finding test files
  - run-vitest-shards.mjs deprecated in favor of run-all-vitest.mjs

### Known Issues
- **prepublish-check.mjs**: Path resolution bug (shows undefined in path)
- **list-vitest-tests.mjs**: Returns "No Vitest files found" despite tests existing
- **build-with-tests.mjs**: References old test:unit script removed in V2 cleanup
- **precommit-validation.mjs**: test:node currently failing (unrelated to tool itself)

### Deprecation Candidates
- **run-vitest-shards.mjs**: Superseded by tests/vitests/run-all-vitest.mjs
