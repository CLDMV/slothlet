
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
npm run baseline 2>&1 | Select-Object -Last 60
npm run vitest suites/<folder>/<test-file>.test.vitest.mjs 2>&1 | Select-Object -Last 40
```

**Why tail?**
- ❌ **WRONG:** Running without tailing shows the START of output, not results
- ✅ **CORRECT:** Tailing last 40 lines shows the RESULTS at the end


Relative base: tests/vitests

| Test (relative) | Feature Category | V3 Updated | Status | Notes |
| --- | --- | --- | --- | --- |
| suites/rules/rule-coverage.test.vitest.mjs | API Rules | ✅ 1st pass (2026-01-28 14:27) | ✅ baseline (2026-02-16) | Verified passing in baseline |
| suites/rules/rule-12-comprehensive.test.vitest.mjs | API Rules | ✅ Yes (2026-02-15) | ✅ baseline (2026-02-16) | Verified passing in baseline |
| suites/addapi/add-api.test.vitest.mjs | API Manager | ✅ Yes (2026-01-27 20:52) | ✅ baseline (2026-02-16) | Verified passing in baseline |
| suites/addapi/add-api-files.test.vitest.mjs | API Manager | ✅ Yes (2026-02-14) | ✅ baseline (2026-02-16) | Verified passing in baseline |
| suites/addapi/addapi-path-resolution.test.vitest.mjs | API Manager | ✅ Yes (2026-02-15) | ✅ baseline (2026-02-16) | Verified passing in baseline |
| suites/addapi/addapi-stack-trace-path.test.vitest.mjs | API Manager | ✅ Yes (2026-02-15) | ✅ baseline (2026-02-16) | Verified passing in baseline |
| suites/api/api-sanitize.test.vitest.mjs | API Methods | ✅ Yes (2026-01-30 11:30) | ✅ baseline (2026-02-16) | Verified passing in baseline |
| suites/api/eager/api-eager-basic.test.vitest.mjs | Core API | ✅ Yes (2026-02-14) | ✅ baseline (2026-02-16) | 44/44 tests pass (100%) |
| suites/api/eager/api-eager-hooks.test.vitest.mjs | Core API + Hooks | ✅ Yes (2026-02-14) | ✅ baseline (2026-02-16) | 44/44 tests pass (100%) |
| suites/api/eager/api-eager-hot.test.vitest.mjs | Core API + API Manager | ✅ Yes (2026-02-14) | ✅ baseline (2026-02-16) | 88/88 tests pass (100%) |
| suites/api/eager/api-eager-live.test.vitest.mjs | Core API + Live Binding | ✅ Yes (2026-02-14) | ✅ baseline (2026-02-16) | 88/88 tests pass (100%) |
| suites/api/function-name-preservation.test.vitest.mjs | API Sanitization | ✅ Yes (2026-01-28 14:38) | ✅ baseline (2026-02-16) | Verified passing in baseline |
| suites/api/lazy/api-lazy-basic.test.vitest.mjs | Core API | ✅ Yes (2026-02-14) | ✅ baseline (2026-02-16) | 44/44 tests pass (100%) |
| suites/cjs/cjs-default-exports.test.vitest.mjs | CJS Interop | ✅ Yes (2026-01-28) | ✅ baseline (2026-02-16) | Verified passing in baseline |
| suites/api/lazy/api-lazy-hooks.test.vitest.mjs | Core API + Hooks | ✅ Yes (2026-02-14) | ✅ baseline (2026-02-16) | 44/44 tests pass (100%) |
| suites/api/lazy/api-lazy-hot.test.vitest.mjs | Core API + API Manager | ✅ Yes (2026-02-14) | ✅ baseline (2026-02-16) | 88/88 tests pass (100%) |
| suites/api/lazy/api-lazy-live.test.vitest.mjs | Core API + Live Binding | ✅ Yes (2026-02-14) | ✅ baseline (2026-02-16) | 88/88 tests pass (100%) |
| suites/api-structures/all-api-structures.test.vitest.mjs | Core API | ✅ Yes (2026-02-15) | ✅ baseline (2026-02-16) | 84/84 tests pass (100%) |
| suites/config/allowInitialOverwrite.test.vitest.mjs | Config | ✅ Yes (2026-02-14) | ✅ baseline (2026-02-16) | 48 tests pass - Fixed by adding add() function to api_test_collections/math.mjs and updating test for v3 collision API |
| suites/config/background-materialize.test.vitest.mjs | Config | ✅ Yes (2026-01-21 15:51:00) | ✅ baseline (2026-02-16) | 12 tests pass - Fixed by updating expected value to 1005 (file version of math.add wins collision with folder) |
| suites/config/collision-config.test.vitest.mjs | Config | ✅ Yes (2026-01-27 08:18:00) | ✅ baseline (2026-02-16) | Verified passing in baseline |
| suites/context/als-cleanup.test.vitest.mjs | Context Management | ✅ 1st pass (2026-01-28 14:27) | ❌ fail (2026-02-15) | 12/24 failed - Old instance IDs not removed from context manager after shutdown |
| suites/context/auto-context-propagation.test.vitest.mjs | Context Management + EventEmitter | ✅ 1st pass (2026-01-28 14:27) | ✅ baseline (2026-02-16) | 8/8 tests pass (100%) |
| suites/context/class-instance-propagation.test.vitest.mjs | Context Management | ✅ 1st pass (2026-01-29 09:40) | ✅ baseline (2026-02-15) | 8/8 pass - Fixed by adding context import to create-test-service.mjs |
| suites/context/map-set-proxy-fix.test.vitest.mjs | Context Management | ✅ 1st pass (2026-01-28 14:34) | ✅ baseline (2026-02-16) | 16/16 tests pass (100%) |
| suites/context/per-request-context.test.vitest.mjs | Context Management | ✅ Updated (2025-01-28 23:58) | ✅ baseline (2026-02-16) | Verified passing in baseline |
| suites/context/tcp-eventemitter-context.test.vitest.mjs | Context Management + EventEmitter | ✅ 1st pass (2026-01-28 14:34) | ✅ baseline (2026-02-16) | 40/40 tests pass (100%) |
| suites/core/core-reference-persistence.test.vitest.mjs | Core API | ✅ Yes (2026-02-14) | ❌ fail (2026-02-16 02:13) | 88/104 tests failed (16 passed) - From systematic audit |
| suites/core/core-reload-full.test.vitest.mjs | Core API + API Manager | ✅ Yes (2026-02-14) | ✅ baseline (2026-02-16) | Verified passing in baseline |
| suites/core/core-reload-lazy-mode.test.vitest.mjs | Core API + API Manager | ✅ Yes (2026-02-14) | ✅ baseline (2026-02-16) | Verified passing in baseline |
| suites/core/core-reload-path-multicache.test.vitest.mjs | Core API + API Manager | ✅ Yes (2026-02-14) | ✅ baseline (2026-02-16) | Verified passing in baseline |
| suites/core/core-reload-selective.test.vitest.mjs | Core API + API Manager | ✅ Yes (2026-02-14) | ✅ baseline (2026-02-16) | Verified passing in baseline |
| suites/diagnostics/mixed-diagnostic.test.vitest.mjs | Diagnostics | ✅ 1st pass (2026-01-28 14:38) | ✅ baseline (2026-02-16) | 48/48 tests pass (100%) |
| suites/hooks/hooks-after-chaining.test.vitest.mjs | Hooks | ✅ Yes (2026-01-29 22:12) | ✅ baseline (2026-02-16) | Verified passing in baseline |
| suites/hooks/hooks-always-error-context.test.vitest.mjs | Hooks | ✅ Yes (2026-01-30 11:34) | ✅ baseline (2026-02-16) | Verified passing in baseline |
| suites/hooks/hooks-async-timing.test.vitest.mjs | Hooks | ✅ Yes (2026-01-30 11:34) | ✅ baseline (2026-02-16) | Verified passing in baseline |
| suites/hooks/hooks-before-chaining.test.vitest.mjs | Hooks | ✅ Yes (2026-02-16) | ✅ baseline (2026-02-16) | 12/12 tests pass (100%) |
| suites/hooks/hooks-comprehensive.test.vitest.mjs | Hooks | ✅ Yes (2026-01-29 22:12) | ✅ baseline (2026-02-16) | Verified passing in baseline |
| suites/hooks/hooks-debug.test.vitest.mjs | Hooks | ✅ Yes (2026-01-30 11:34) | ✅ baseline (2026-02-16) | Verified passing in baseline |
| suites/hooks/hooks-error-source.test.vitest.mjs | Hooks | ✅ Yes (2026-01-29 22:12) | ✅ baseline (2026-02-16) | Verified passing in baseline |
| suites/hooks/hooks-execution.test.vitest.mjs | Hooks | ✅ Yes (2026-01-29 22:12) | ✅ baseline (2026-02-16) | Verified passing in baseline |
| suites/hooks/hooks-internal-properties.test.vitest.mjs | Hooks | ✅ Yes (2026-01-30 11:34) | ✅ baseline (2026-02-16) | Verified passing in baseline |
| suites/hooks/hooks-mixed-scenarios.test.vitest.mjs | Hooks | ✅ Yes (2026-01-29 22:12) | ✅ baseline (2026-02-16) | Verified passing in baseline |
| suites/hooks/hooks-patterns.test.vitest.mjs | Hooks | ✅ Yes (2026-01-30 09:10) | ✅ baseline (2026-02-16) | Verified passing in baseline |
| suites/hooks/hooks-short-circuit.test.vitest.mjs | Hooks | ✅ Yes (2026-01-29 22:12) | ✅ baseline (2026-02-16) | Verified passing in baseline |
| suites/hooks/hooks-suppress-errors.test.vitest.mjs | Hooks | ✅ Yes (2026-01-30 11:34) | ✅ baseline (2026-02-16) | Verified passing in baseline |
| suites/hooks/hook-subsets.test.vitest.mjs | Hooks | ✅ Yes (2026-01-30 11:34) | ✅ baseline (2026-02-16) | Verified passing in baseline |
| suites/api-manager/api-mutations-control.test.vitest.mjs | API Manager + Config | ✅ Yes (2026-01-28 16:40) | ✅ baseline (2026-02-16) | 176 tests pass - Fixed by changing collision.api from 'error' to 'warn' (v3 error mode rejects api.add with internal collisions) |
| suites/api-manager/api-manager-advanced.test.vitest.mjs | API Manager | ✅ 1st pass (2026-01-28 14:28) | ❌ fail (2026-02-16 02:13) | 64/112 tests failed (48 passed) - From systematic audit |
| suites/api-manager/api-manager-basic.test.vitest.mjs | API Manager Basic | ✅ Yes (2026-02-14) | ✅ baseline (2026-02-16) | 112 tests pass - Fixed by updating expected values for v3 collision behavior (file wins, adds 1000) |
| suites/api-manager/api-manager-errors.test.vitest.mjs | API Manager + Error Handling | ✅ Yes (2026-02-14) | ✅ baseline (2026-02-16) | 5 tests pass - Fixed by updating for v3 error codes (INVALID_ARGUMENT, INVALID_API_PATH) and behavior changes |
| suites/api-manager/api-manager-hooks.test.vitest.mjs | API Manager + Hooks | ✅ Yes (2026-01-28 14:19) | ❌ fail (2026-02-15) | 8/8 failed - Hooks not preserved after full reload |
| suites/api-manager/api-manager-reference-identity.test.vitest.mjs | API Manager + Reference Identity | ✅ Yes (2026-02-14) | ❌ fail (2026-02-16 02:13) | 64/80 tests failed (16 passed) - From systematic audit |
| suites/api-manager/api-manager-test-remove-reload-isolated.test.vitest.mjs | API Manager + Remove/Reload | ✅ Yes (2026-02-14) | ✅ baseline (2026-02-16) | 16/16 tests pass (100%) |
| suites/isolation/multi-instance-isolation.test.vitest.mjs | Isolation | ✅ Yes (2026-01-28 14:05) | ✅ baseline (2026-02-16) | 42 tests pass - Fixed by updating expected values for v3 collision behavior and adding missing dir config to lazyApi |
| suites/isolation/tv-config-isolation.test.vitest.mjs | Isolation | ✅ Yes (2026-01-28 14:05) | ✅ baseline (2026-02-16) | Verified passing in baseline |
| suites/lazy/lazy-background-materialization.test.vitest.mjs | Lazy Loading | ✅ Yes (2026-02-14) | ✅ baseline (2026-02-16) | 48/48 tests pass (100%) |
| suites/lazy/lazy-materialization-tracking.test.vitest.mjs | Lazy Loading | ✅ Yes (2026-02-14) | ✅ baseline (2026-02-16) | 72/72 tests pass (100%) |
| suites/lazy/public-lifecycle-api.test.vitest.mjs | Lazy Loading + Lifecycle | ✅ Yes (2026-02-14) | ✅ baseline (2026-02-16) | 16/16 tests pass (100%) |
| suites/listener-cleanup/listener-cleanup.test.vitest.mjs | Lifecycle + EventEmitter + Hooks | ✅ Yes (2026-01-28 12:52) | ❌ fail (2026-02-15) | 8/8 failed - Test expects slothlet to remove EventEmitter listeners created in test code (bad test expectation) |
| suites/listener-cleanup/third-party-cleanup.test.vitest.mjs | Lifecycle + EventEmitter | ✅ 1st pass (2026-01-28 14:27) | ❌ fail (2026-02-16 02:13) | 32/40 tests failed (8 passed) - From systematic audit |
| suites/metadata/metadata-api-manager.test.vitest.mjs | Metadata - API Manager | ✅ Yes (2026-01-27) | ✅ baseline (2026-02-16) | Verified passing in baseline |
| suites/metadata/metadata-collision-modes.test.vitest.mjs | Metadata - Collision Modes | ✅ Yes (2026-01-27 08:18:00) | ✅ baseline (2026-02-16) | Verified passing in baseline |
| suites/metadata/metadata-edge-cases.test.vitest.mjs | Metadata - Edge Cases | ✅ Yes (2026-01-26) | ✅ baseline (2026-02-16) | Verified passing in baseline |
| suites/metadata/metadata-external-api.test.vitest.mjs | Metadata - External API | ✅ Yes (2026-01-26) | ✅ baseline (2026-02-16) | Verified passing in baseline |
| suites/metadata/metadata-reload.test.vitest.mjs | Metadata - API Manager | ✅ Yes (2026-01-26) | ❌ fail (2026-02-16 02:13) | 24/168 tests failed (144 passed) - From systematic audit |
| suites/metadata/system-metadata.test.vitest.mjs | Metadata - System | ✅ Yes (2026-01-27 08:18:00) | ✅ baseline (2026-02-16) | Verified passing in baseline |
| suites/metadata/user-metadata.test.vitest.mjs | Metadata - User | ✅ Yes (2026-01-26) | ✅ baseline (2026-02-16) | Verified passing in baseline |
| suites/ownership/module-ownership-removal.test.vitest.mjs | Ownership | ✅ Yes (2026-01-27 08:34:00) | ✅ baseline (2026-02-16) | Verified passing in baseline |
| suites/ownership/ownership-replacement.test.vitest.mjs | Ownership Tracking | ✅ Yes (2026-01-27 14:18:00) | ✅ baseline (2026-02-16) | Verified passing in baseline |
| suites/proxies/proxy-baseline.test.vitest.mjs | Proxies | ✅ Yes (2026-01-28 14:42) | ✅ baseline (2026-02-16) | Verified passing in baseline |
| suites/ref/reference-readonly-properties.test.vitest.mjs | Reference | ✅ Yes (2026-01-28 14:25) | ✅ baseline (2026-02-16) | Verified passing in baseline |
| suites/runtime/runtime-verification.test.vitest.mjs | Runtime | ✅ Yes (2026-01-28 14:05) | ❌ fail (2026-02-15) | 19/19 failed - Context not available, cross-calls failing, runtime type detection wrong |
| suites/sanitization/sanitization-v2v3-compat.test.vitest.mjs | API Sanitization | ✅ Yes (2026-01-28 14:28) | ✅ baseline (2026-02-16) | 83/83 tests pass (6 skipped) - Passing after Bug #6 fix |
| suites/sanitization/sanitize.test.vitest.mjs | API Sanitization | ✅ 1st pass (2026-01-28 14:30) | ✅ baseline (2026-02-16) | 42/42 pass - Fixed lower pattern rule bug (#6) - tracking applied during segment processing to preserve lowercase through camelCase |
| suites/smart-flattening/smart-flattening-case1-case2.test.vitest.mjs | Smart Flattening | ✅ 1st pass (2026-01-28 15:05) | ❌ fail (2026-02-15) | 32/32 failed - addapi.mjs special file not being flattened (api.plugins.initializePlugin undefined) |
| suites/smart-flattening/smart-flattening-case3-case4.test.vitest.mjs | Smart Flattening | ✅ Yes (2026-01-20 21:30) | ❌ fail (2026-02-16 02:13) | 16/32 tests failed (16 passed) - From systematic audit |
| suites/smart-flattening/smart-flattening-edge-cases.test.vitest.mjs | Smart Flattening | ✅ Yes (2026-01-20 21:30) | ❌ fail (2026-02-16 02:13) | 40/48 tests failed (8 passed) - From systematic audit |
| suites/smart-flattening/smart-flattening-folders.test.vitest.mjs | Smart Flattening | ✅ Yes (2026-01-20 21:30) | ❌ fail (2026-02-16 02:13) | 52/56 tests failed (4 passed) - From systematic audit |
| suites/typescript/typescript-fast-mode.test.vitest.mjs | TypeScript | ✅ Yes (2026-02-14 19:00) | ✅ baseline (2026-02-16) | 23/23 tests pass (100%) |
| suites/typescript/typescript-strict-mode.test.vitest.mjs | TypeScript | ✅ Yes (2026-02-14 19:00) | ✅ baseline (2026-02-16) | 13/13 tests pass (100%) |

## Feature Categories

- **Core API**: Basic API loading and structure tests
- **API Manager**: Tests for api.slothlet.api.add/remove/reload and api.slothlet.reload
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
- **TypeScript**: TypeScript file loading and type checking tests
- **Lazy Loading**: Lazy mode materialization and lifecycle tests

## V3 Update Status

✅ **Updated for V3** (13 files): All test files using API manager APIs (add/remove/reload) have been updated to use the new `api.slothlet.api.*` and `api.slothlet.reload()` namespace structure, including signature changes (removeApi now takes string directly instead of object) |
