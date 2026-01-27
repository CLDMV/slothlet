/*
 * @Project: @cldmv/slothlet
 * @Filename: /tests/vitests/TEST-STATUS.md
 * @Date: 2026-01-23 15:47:00 -08:00 (1769212020)
 * @Author: Nate Hyson <CLDMV>
 * @Email: <Shinrai@users.noreply.github.com>
 * -----
 * @Last modified by: Nate Hyson <CLDMV> (Shinrai@users.noreply.github.com)
 * @Last modified time: 2026-01-26 15:21:54 -08:00 (1769469714)
 * -----
 * @Copyright: Copyright (c) 2013-2026 Catalyzed Motivation Inc. All rights reserved.
 */






# V3 Vitest Status

**Instructions for maintaining this file:**
- When updating test status, include datetime in ISO format (YYYY-MM-DD HH:MM:SS)
- Update "V3 Updated" column when test is modified for v3 compatibility
- Run the test after updates and record the result in "Status" with datetime
- Update "Notes" column with relevant details about changes or test results
- Format: `✅ pass (2026-01-20 21:30:00)` or `❌ fail - retest` or `untested`

### How to Run Tests Properly

**⚠️ IMPORTANT: Always tail test output (last 40 lines):**
```powershell
npm run debug 2>&1 | Select-Object -Last 40
npm run testv3 -- --baseline 2>&1 | Select-Object -Last 60
npm run testv3 -- suites/<folder>/<test-file>.test.vitest.mjs 2>&1 | Select-Object -Last 40
```

**Why tail?**
- ❌ **WRONG:** Running without tailing shows the START of output, not results
- ✅ **CORRECT:** Tailing last 40 lines shows the RESULTS at the end


Relative base: tests/vitests

| Test (relative) | Feature Category | V3 Updated | Status | Notes |
| --- | --- | --- | --- | --- |
| rule-coverage.test.vitest.mjs | API Rules | No | untested | |
| suites/addapi/add-api.test.vitest.mjs | Hot Reload | ✅ Yes (2026-01-20 21:30) | ❌ fail (2026-01-21 01:04:31) | 112/112 tests fail - V3 BUGS: (1) `api.slothlet` undefined for non-mutate configs (2) "state is not defined" at hot_reload.mjs:657 for mutate configs (3) Broken error message: "Invalid configuration: ' ' = ' '. Expected: ." |
| suites/addapi/addapi-path-resolution.test.vitest.mjs | Hot Reload | ✅ Yes (2026-01-20 21:30) | ❌ fail (2026-01-21 01:05:13) | 21+/144 tests fail + heap OOM crash - Same V3 BUGS: (1) `api.slothlet` undefined for non-mutate configs (2) "state is not defined" for mutate configs (3) Broken error messages. Also: helper-executor.mjs line 32 still uses `api.addApi()` instead of `api.slothlet.api.add()` |
| suites/addapi/addapi-stack-trace-path.test.vitest.mjs | Hot Reload | ✅ Yes (2026-01-20 21:30) | ❌ fail - retest | Parse error - FILE CORRUPT/INCOMPLETE - missing closing braces, test code cuts off at line 61, needs repair |
| suites/api/eager/api-eager-basic.test.vitest.mjs | Core API | No | untested | |
| suites/api/eager/api-eager-hooks.test.vitest.mjs | Core API + Hooks | No | untested | |
| suites/api/eager/api-eager-hot.test.vitest.mjs | Core API + Hot Reload | No | untested | |
| suites/api/eager/api-eager-live.test.vitest.mjs | Core API + Live Binding | No | untested | |
| suites/api/function-name-preservation.test.vitest.mjs | API Sanitization | No | untested | |
| suites/api/lazy/api-lazy-basic.test.vitest.mjs | Core API | No | untested | |
| suites/api/lazy/api-lazy-hooks.test.vitest.mjs | Core API + Hooks | No | untested | |
| suites/api/lazy/api-lazy-hot.test.vitest.mjs | Core API + Hot Reload | No | untested | |
| suites/api/lazy/api-lazy-live.test.vitest.mjs | Core API + Live Binding | No | untested | |
| suites/api-structures/all-api-structures.test.vitest.mjs | Core API | No | untested | |
| suites/config/background-materialize.test.vitest.mjs | Config | ✅ Yes (2026-01-21 15:51:00) | ✅ pass (2026-01-21 16:23:00) | 24/24 pass - **FIXED**: Was failing due to Node.js module cache pollution. When multiple slothlet instances loaded same modules sequentially, Node cached them causing wrapper/state bleed between instances. Fixed by appending `?slothlet_instance=${instanceID}` to import URLs in loader.mjs for cache busting. Each instance now gets fresh module imports. Test properly uses api.slothlet.types symbols. Note: typeof ALWAYS returns "function" in lazy mode (see docs/v3/changelog/typeof-always-function-lazy-mode.md). |
| suites/config/collision-config.test.vitest.mjs | Config | ✅ Yes (2026-01-27 08:18:00) | ✅ pass (2026-01-27 08:18:00) | 160/160 pass (100%) - Tests unified collision config system (skip/warn/replace/merge/merge-replace/error modes). **FIXED (2026-01-27)**: Replace mode now implemented in setValueAtPath - preserves unified wrapper by calling mutateApiValue, syncWrapper clears _childCache and replaces children while maintaining wrapper references (mathNew === mathOld). **FIXED (2026-01-26)**: Warn mode now correctly merges file and folder exports instead of using replace behavior. |
| suites/context/als-cleanup.test.vitest.mjs | Context Management | No | untested | |
| suites/context/auto-context-propagation.test.vitest.mjs | Context Management + EventEmitter | No | untested | Related to eventemitter-context-propagation.md |
| suites/context/map-set-proxy-fix.test.vitest.mjs | Context Management | No | untested | |
| suites/context/per-request-context.test.vitest.mjs | Context Management | No | untested | |
| suites/context/tcp-context-propagation.test.vitest.mjs | Context Management + EventEmitter | No | untested | Related to eventemitter-context-propagation.md |
| suites/context/tcp-eventemitter-context.test.vitest.mjs | Context Management + EventEmitter | No | untested | Related to eventemitter-context-propagation.md |
| suites/diagnostics/mixed-diagnostic.test.vitest.mjs | Diagnostics | No | untested | |
| suites/hooks/hooks-after-chaining.test.vitest.mjs | Hooks | No | untested | Related to hooks-system.md |
| suites/hooks/hooks-always-error-context.test.vitest.mjs | Hooks | No | untested | Related to hooks-system.md |
| suites/hooks/hooks-before-chaining.test.vitest.mjs | Hooks | No | untested | Related to hooks-system.md |
| suites/hooks/hooks-comprehensive.test.vitest.mjs | Hooks | No | untested | Related to hooks-system.md |
| suites/hooks/hooks-debug.test.vitest.mjs | Hooks | No | untested | Related to hooks-system.md |
| suites/hooks/hooks-error-source.test.vitest.mjs | Hooks | No | untested | Related to hooks-system.md |
| suites/hooks/hooks-execution.test.vitest.mjs | Hooks | No | untested | Related to hooks-system.md |
| suites/hooks/hooks-internal-properties.test.vitest.mjs | Hooks | No | untested | Related to hooks-system.md |
| suites/hooks/hooks-mixed-scenarios.test.vitest.mjs | Hooks | No | untested | Related to hooks-system.md |
| suites/hooks/hooks-patterns.test.vitest.mjs | Hooks | No | untested | Related to hooks-system.md |
| suites/hooks/hooks-short-circuit.test.vitest.mjs | Hooks | No | untested | Related to hooks-system.md |
| suites/hooks/hooks-suppress-errors.test.vitest.mjs | Hooks | No | untested | Related to hooks-system.md |
| suites/hooks/hook-subsets.test.vitest.mjs | Hooks | No | untested | Related to hooks-system.md |
| suites/hot-reload/hot-reload-allowMutation-disabled.test.vitest.mjs | Hot Reload + Config | ✅ Yes (2026-01-20 21:30) | ❌ fail (2026-01-21 01:05:37) | 143/256 tests fail, 113 pass - V3 BUGS: (1) Broken error message "Invalid configuration: ' ' = ' '. Expected: ." instead of "INVALID_CONFIG_MUTATION_DISABLED" (2) LAZY modes: mathAdd undefined or "math.add is not a function" error |
| suites/hot-reload/hot-reload-advanced.test.vitest.mjs | Hot Reload | No | untested | |
| suites/hot-reload/hot-reload-basic.test.vitest.mjs | Hot Reload Basic | ✅ Yes (2026-01-20 21:30) | ❌ fail (2026-01-21 01:06:51) | 224/224 tests fail, 0 pass - V3 BUGS: (1) api.slothlet.reload/api undefined for non-MUTATE (2) "state is not defined" at hot_reload.mjs:657 (3) Broken error messages "Invalid configuration: ' ' = ' '. Expected: ." (4) LAZY modes: "math.add is not a function" (5) "Reload functionality not yet implemented" for MUTATE configs |
| suites/hot-reload/hot-reload-errors.test.vitest.mjs | Hot Reload + Error Handling | ✅ Yes (2026-01-20 21:30) | ❌ fail (2026-01-21 01:13:25) | 5/5 tests fail, 0 pass - V3 BUGS: (1) "api.slothlet.reload is not a function" (2) "Cannot read properties of undefined (reading 'reload')" - api.slothlet.api undefined (3) "Cannot read properties of undefined (reading 'add')" |
| suites/hot-reload/hot-reload-hooks.test.vitest.mjs | Hot Reload + Hooks | ✅ Yes (2026-01-20 21:30) | ❌ fail (2026-01-21 01:13:45) | 16/16 tests fail, 0 pass - V3 BUG: "Cannot read properties of undefined (reading 'on')" - api.hooks undefined for hooks configs. Related to hooks-system.md |
| suites/hot-reload/hot-reload-reference-identity.test.vitest.mjs | Hot Reload + Reference Identity | ✅ Yes (2026-01-20 21:30) | ❌ fail (2026-01-21 01:14:10) | 22/22 tests fail, 0 pass + HEAP OOM crash at 12.5s - V3 BUGS: (1) "api.slothlet.reload is not a function" (2) "Cannot read properties of undefined (reading 'add')" - api.slothlet.api undefined (3) "state is not defined" at hot_reload.mjs:657 (4) MUTATE: "Reload functionality not yet implemented" |
| suites/hot-reload/hot-reload-test-remove-reload-isolated.test.vitest.mjs | Hot Reload + Remove/Reload | ✅ Yes (2026-01-20 21:30) | ❌ fail (2026-01-21 01:14:39) | 32/32 tests fail, 0 pass - V3 BUGS: (1) "Cannot read properties of undefined (reading 'add')" - api.slothlet.api undefined (2) "state is not defined" at hot_reload.mjs:657 (3) Broken error message "Invalid configuration: ' ' = ' '. Expected: ." |
| suites/isolation/multi-instance-isolation.test.vitest.mjs | Isolation | No | untested | |
| suites/isolation/tv-config-isolation.test.vitest.mjs | Isolation | No | untested | |
| suites/listener-cleanup/listener-cleanup.test.vitest.mjs | Lifecycle + EventEmitter + Hooks | No | untested | Related to eventemitter-context-propagation.md and hooks-system.md |
| suites/listener-cleanup/third-party-cleanup.test.vitest.mjs | Lifecycle + EventEmitter | No | untested | Related to eventemitter-context-propagation.md |
| suites/metadata/metadata-api-manager.test.vitest.mjs | Metadata - API Manager | ✅ Yes (2026-01-26) | ✅ pass (2026-01-26 21:12:45) | 96/96 tests pass (100%) - Tests metadata with api.add/remove cycles + internal API tests (self.slothlet.metadata.*). **NEW TESTS**: Added 5 internal API tests for add/remove scenarios. **FIXED**: (1) Null-to-undefined conversion in helper (2) getMetadata() now looks up user metadata by BOTH moduleID AND rootApiPath to support both api.add() (stores by apiPath) and metadata.set() (stores by moduleID). All tests passing. Related to metadata-tagging.md |
| suites/metadata/metadata-collision-modes.test.vitest.mjs | Metadata - Collision Modes | ✅ Yes (2026-01-27 08:18:00) | ✅ pass (2026-01-27 08:18:00) | 96/96 tests pass (100%) - Tests metadata behavior across collision modes (skip/warn/replace/merge/merge-replace/error). **FIXED (2026-01-27)**: Replace mode now fully implemented in setValueAtPath - preserves unified wrapper via mutateApiValue. **FIXED (2026-01-27 earlier)**: (1) Unified wrapper pattern preserves references across addApi via __setImpl (2) syncWrapper receives collisionMode parameter (3) Merge/merge-replace modes update child impl while preserving wrappers. Related to metadata-tagging.md |
| suites/metadata/metadata-edge-cases.test.vitest.mjs | Metadata - Edge Cases | ✅ Yes (2026-01-26) | ✅ pass (2026-01-26 21:12:45) | 112/112 tests pass (100%) - Tests edge cases: root contributor, deep nesting, special chars, large objects. All tests passing. Related to metadata-tagging.md |
| suites/metadata/metadata-external-api.test.vitest.mjs | Metadata - External API | ✅ Yes (2026-01-26) | ✅ pass (2026-01-26 21:58:00) | 176/176 tests pass (100%) - Tests external metadata API (api.slothlet.metadata.set/remove/setGlobal). **ENHANCED**: (1) Added array/object parameter support to metadata.remove() - can now remove multiple keys or nested keys in one call. (2) Added 6 new tests for array/object removal. **FIXED**: (1) Tests using non-existent functions (rootMath.subtract → multiply, config.settings → nested.date.today). (2) Global metadata test expectations - global metadata is LIVE data, not snapshotted. (3) Test directory usage - reverted testFunc from API_TEST to API_SMART_FLATTEN with correct function. All tests passing. Related to metadata-tagging.md |
| suites/metadata/metadata-reload.test.vitest.mjs | Metadata - Hot Reload | ✅ Yes (2026-01-26) | ❌ fail (2026-01-26 19:56:40) | HEAP OOM + RangeError: Maximum call stack size exceeded - Tests metadata with api.slothlet.reload() and api.slothlet.api.reload(). **NEW TESTS**: Added 5 internal API tests for reload scenarios. **CRITICAL BUG**: Infinite recursion in unified-wrapper.mjs:582 `await current.__materialize()` and line 620 error handling. Test crashes with stack overflow. Related to metadata-tagging.md |
| suites/metadata/system-metadata.test.vitest.mjs | Metadata - System | ✅ Yes (2026-01-27 08:18:00) | ✅ pass (2026-01-27 08:18:00) | 184/184 tests pass (100%) - Tests immutable system metadata (moduleID, filePath, apiPath, sourceFolder) + internal API tests (self.slothlet.metadata.*) + lazy mode __type behavior. **FIXED (2026-01-27)**: Lazy mode __type test expectations - __type triggers materialization then returns symbol (UNMATERIALIZED/IN_FLIGHT) if pending or typeof string ('function') if complete. After materialization returns 'function' not undefined. **FIXED (2026-01-26)**: Null-to-undefined conversion in helper. Related to metadata-tagging.md |
| suites/metadata/user-metadata.test.vitest.mjs | Metadata - User | ✅ Yes (2026-01-26) | ✅ pass (2026-01-26 21:24:00) | 176/176 tests pass (100%) - Tests user metadata via add(), init, merge, metadata API (self.slothlet.metadata.*). **NEW TESTS**: Added 7 complex path scenario tests. **FIXED**: Missing beforeEach() in "Complex Path Scenarios" test suite - tests were attempting to use uninitialized API instance. All tests now passing. Related to metadata-tagging.md |
| suites/ownership/module-ownership-removal.test.vitest.mjs | Ownership | ✅ Yes (2026-01-27 08:34:00) | ❌ fail (2026-01-27 08:34:00) | 0/0 tests fail - **FIXED**: Syntax error (duplicate code lines 204-206) and TEST_MATRIX import. **NEW BUG**: TypeError: "api._getApiOwnership is not a function" - internal ownership API not exposed or changed in v3. Tests run but can't access ownership tracking methods even with SLOTHLET_INTERNAL_TEST_MODE=true. Needs investigation of v3 ownership API. |
| suites/ownership/ownership-replacement.test.vitest.mjs | Ownership Tracking | ✅ Yes (2026-01-27 08:34:00) | ❌ fail (2026-01-27 08:34:00) | 24/24 tests fail (across 8 configs x 3 tests) - **FIXED**: Changed from getMatrixConfigs({ hotReload: true }) to TEST_MATRIX since hot reload always available in v3. **BUG**: TypeError: "api._getApiOwnership is not a function" for all tests. Tests expect internal ownership tracking API (api._getApiOwnership) which is not exposed even with SLOTHLET_INTERNAL_TEST_MODE=true. All 3 test scenarios fail: (1) rollback chain core→v1→v2→v1→core (2) v2 overwrites v1 with ownership accumulation (3) merge preserves shared ownership. Needs v3 ownership API implementation or exposure. |
| suites/proxies/proxy-baseline.test.vitest.mjs | Proxies | No | untested | |
| suites/ref/reference-readonly-properties.test.vitest.mjs | Reference | No | untested | |
| suites/rules/rule-12-comprehensive.test.vitest.mjs | API Rules | ✅ Yes (2026-01-20 21:30) | ❌ fail - retest | 7+/70 tests fail + heap OOM crash - V3 BUGS: (1) `api.slothlet.api` undefined for non-mutate configs - 6 tests fail with `TypeError: Cannot read properties of undefined (reading 'add')` (2) "state is not defined" for EAGER_MUTATE - 1 test fails at hot_reload.mjs:657 (3) Test suite crashes with heap overflow before completing all 70 tests |
| suites/runtime/runtime-verification.test.vitest.mjs | Runtime | No | untested | |
| suites/sanitization/sanitization-v2v3-compat.test.vitest.mjs | API Sanitization | No | untested | |
| suites/sanitization/sanitize.test.vitest.mjs | API Sanitization | No | untested | |
| suites/smart-flattening/smart-flattening-case1-case2.test.vitest.mjs | Smart Flattening | ✅ Yes (2026-01-21 17:05:00) | ❌ fail (2026-01-21 17:05:00) | 32/32 tests fail, 0 pass - **TEST BUGS FIXED**: (1) Changed from TEST_MATRIX to getMatrixConfigs({ allowMutation: true }) (2) Added { mutateExisting: true } to api.add() calls to allow merging onto existing paths. **SRC BUG**: Functions undefined after api.add() - api.config.getConfig, api.plugins.initializePlugin all undefined. Hot reload addApiComponent not properly merging/flattening dynamically added APIs. File exports exist (getConfig, setConfig, validateConfig in config.mjs) but don't appear on API after add operation. |
| suites/smart-flattening/smart-flattening-case3-case4.test.vitest.mjs | Smart Flattening | ✅ Yes (2026-01-20 21:30) | ❌ fail (2026-01-21 05:37:09) | 80/80 tests fail, 0 pass - NOT typeof issues. Same hot reload bugs as case1-case2: (1) Non-MUTATE: mutation disabled errors (2) MUTATE: "state is not defined" and path conflicts |
| suites/smart-flattening/smart-flattening-edge-cases.test.vitest.mjs | Smart Flattening | ✅ Yes (2026-01-20 21:30) | ❌ fail (2026-01-21 05:37:33) | 96/96 tests fail, 0 pass - NOT typeof issues. Same hot reload bugs: Non-MUTATE mutation disabled, MUTATE "state is not defined" and path conflicts, type mismatches |
| suites/smart-flattening/smart-flattening-folders.test.vitest.mjs | Smart Flattening | ✅ Yes (2026-01-20 21:30) | ❌ fail (2026-01-21 14:57:00) | 112/112 tests fail, 0 pass - Same pattern as case1-case2: NOT typeof issues. All failures due to hot reload bugs: (1) Non-MUTATE configs: `INVALID_CONFIG_MUTATION_DISABLED` when tests call api.slothlet.api.add() (2) MUTATE configs: `ReferenceError: state is not defined` at hot_reload.mjs:662 and path conflict errors. Tests have many typeof checks (lines 28, 30, 38, 57-62, 90-97, 124-152, 175) but typeof not the issue - hot reload is broken. |

## Feature Categories

- **Core API**: Basic API loading and structure tests
- **Hot Reload**: Tests for api.slothlet.api.add/remove/reload and api.slothlet.reload
- **Hooks**: Tests for the hooks system
- **Context Management**: AsyncLocalStorage and context propagation tests
- **Ownership**: Module ownership tracking and cleanup
- **Smart Flattening**: API flattening rules and behavior
- **API Rules**: Rule-based API transformation tests
- **Diagnostics**: Diagnostic mode tests
- **Isolation**: Multi-instance isolation tests
- **Lifecycle**: Cleanup and shutdown behavior
- **Metadata**: Module metadata handling
- **Proxies**: Proxy wrapper behavior
- **Reference**: Reference and binding tests
- **Runtime**: Runtime mode tests (async/live)
- **API Sanitization**: Filename to API property name transformation
- **Config**: Configuration option tests

## V3 Update Status

✅ **Updated for V3** (13 files): All test files using hot reload APIs (add/remove/reload) have been updated to use the new `api.slothlet.api.*` and `api.slothlet.reload()` namespace structure, including signature changes (removeApi now takes string directly instead of object) |
