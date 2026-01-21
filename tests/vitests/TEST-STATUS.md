# V3 Vitest Status

**Instructions for maintaining this file:**
- When updating test status, include datetime in ISO format (YYYY-MM-DD HH:MM:SS)
- Update "V3 Updated" column when test is modified for v3 compatibility
- Run the test after updates and record the result in "Status" with datetime
- Update "Notes" column with relevant details about changes or test results
- Format: `✅ pass (2026-01-20 21:30:00)` or `❌ fail (2026-01-20 21:30:00)` or `untested`

Relative base: tests/vitests

| Test (relative) | Feature Category | V3 Updated | Status | Notes |
| --- | --- | --- | --- | --- |
| rule-coverage.test.vitest.mjs | API Rules | No | untested | |
| suites/addapi/add-api.test.vitest.mjs | Hot Reload | ✅ Yes (2026-01-20 21:30) | ❌ fail (2026-01-20 21:51) | 112/112 tests fail - V3 BUGS: (1) `api.slothlet` undefined for non-mutate configs (2) "state is not defined" at hot_reload.mjs:657 for mutate configs (3) Broken error message: "Invalid configuration: ' ' = ' '. Expected: ." |
| suites/addapi/addapi-path-resolution.test.vitest.mjs | Hot Reload | ✅ Yes (2026-01-20 21:30) | ❌ fail (2026-01-20 21:55) | 21+/144 tests fail (heap OOM crash) - Same V3 BUGS as add-api test: (1) `api.slothlet` undefined for non-mutate configs (2) "state is not defined" for mutate configs (3) Broken error messages. Also: helper-executor.mjs line 32 still uses `api.addApi()` instead of `api.slothlet.api.add()` |
| suites/addapi/addapi-stack-trace-path.test.vitest.mjs | Hot Reload | ✅ Yes (2026-01-20 21:30) | ❌ fail (2026-01-20 21:55) | Parse error - FILE CORRUPT/INCOMPLETE - missing closing braces, test code cuts off at line 61, needs repair |
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
| suites/context/als-cleanup.test.vitest.mjs | Context Management | No | untested | |
| suites/context/auto-context-propagation.test.vitest.mjs | Context Management | No | untested | |
| suites/context/map-set-proxy-fix.test.vitest.mjs | Context Management | No | untested | |
| suites/context/per-request-context.test.vitest.mjs | Context Management | No | untested | |
| suites/context/tcp-context-propagation.test.vitest.mjs | Context Management | No | untested | |
| suites/context/tcp-eventemitter-context.test.vitest.mjs | Context Management | No | untested | |
| suites/diagnostics/mixed-diagnostic.test.vitest.mjs | Diagnostics | No | untested | |
| suites/hooks/hooks-after-chaining.test.vitest.mjs | Hooks | No | untested | |
| suites/hooks/hooks-always-error-context.test.vitest.mjs | Hooks | No | untested | |
| suites/hooks/hooks-before-chaining.test.vitest.mjs | Hooks | No | untested | |
| suites/hooks/hooks-comprehensive.test.vitest.mjs | Hooks | No | untested | |
| suites/hooks/hooks-debug.test.vitest.mjs | Hooks | No | untested | |
| suites/hooks/hooks-error-source.test.vitest.mjs | Hooks | No | untested | |
| suites/hooks/hooks-execution.test.vitest.mjs | Hooks | No | untested | |
| suites/hooks/hooks-internal-properties.test.vitest.mjs | Hooks | No | untested | |
| suites/hooks/hooks-mixed-scenarios.test.vitest.mjs | Hooks | No | untested | |
| suites/hooks/hooks-patterns.test.vitest.mjs | Hooks | No | untested | |
| suites/hooks/hooks-short-circuit.test.vitest.mjs | Hooks | No | untested | |
| suites/hooks/hooks-suppress-errors.test.vitest.mjs | Hooks | No | untested | |
| suites/hooks/hook-subsets.test.vitest.mjs | Hooks | No | untested | |
| suites/hot-reload/hot-reload-allowMutation-disabled.test.vitest.mjs | Hot Reload + Config | ✅ Yes (2026-01-20 21:30) | ❌ fail (2026-01-20 22:00) | 143/256 tests fail - Same V3 BUGS: (1) Wrong error message "Invalid configuration: ' ' = ' '. Expected: ." instead of "INVALID_CONFIG_MUTATION_DISABLED" (2) LAZY modes: mathAdd undefined or "math.add is not a function" error |
| suites/hot-reload/hot-reload-advanced.test.vitest.mjs | Hot Reload | No | untested | |
| suites/hot-reload/hot-reload-basic.test.vitest.mjs | Hot Reload | ✅ Yes (2026-01-20 21:30) | ❌ fail (2026-01-20 22:05) | 224/224 tests fail - Same V3 BUGS: (1) `api.slothlet` undefined/api.reload undefined for non-mutate (2) "state is not defined" for mutate (3) Broken error messages (4) LAZY modes: "math.add is not a function" (5) MUTATE modes: "INVALID_CONFIG_RELOAD_NOT_IMPL" error |
| suites/hot-reload/hot-reload-errors.test.vitest.mjs | Hot Reload | ✅ Yes (2026-01-20 21:30) | ❌ fail (2026-01-20 22:10) | 5/5 tests fail - Same V3 BUGS: (1) "state is not defined" for mutate configs (2) LAZY modes function errors (3) Non-mutate api.slothlet undefined |
| suites/hot-reload/hot-reload-hooks.test.vitest.mjs | Hot Reload + Hooks | ✅ Yes (2026-01-20 21:30) | ❌ fail (2026-01-20 22:10) | 16/16 tests fail - Same V3 BUGS: (1) `api.hooks` undefined for hooks configs (2) `api.slothlet` undefined for non-mutate (3) "state is not defined" for mutate (4) Broken error messages |
| suites/hot-reload/hot-reload-reference-identity.test.vitest.mjs | Hot Reload | ✅ Yes (2026-01-20 21:30) | ❌ fail (2026-01-20 22:15) | 22/22 tests fail + heap OOM crash - Same V3 BUGS: (1) `api.slothlet` undefined for non-mutate configs (2) "state is not defined" for mutate configs (3) Broken error messages. Test creates 10 nested APIs which causes heap overflow during cleanup |
| suites/hot-reload/hot-reload-test-remove-reload-isolated.test.vitest.mjs | Hot Reload | ✅ Yes (2026-01-20 21:30) | ❌ fail (2026-01-20 22:20) | 32/32 tests fail - Same V3 BUGS: (1) `api.slothlet` undefined for non-mutate configs (2) "state is not defined" for EAGER_MUTATE (3) Invalid config error for other mutate configs (4) LAZY modes function errors |
| suites/isolation/multi-instance-isolation.test.vitest.mjs | Isolation | No | untested | |
| suites/isolation/tv-config-isolation.test.vitest.mjs | Isolation | No | untested | |
| suites/listener-cleanup/listener-cleanup.test.vitest.mjs | Lifecycle | No | untested | |
| suites/listener-cleanup/third-party-cleanup.test.vitest.mjs | Lifecycle | No | untested | |
| suites/metadata/metadata-api.test.vitest.mjs | Metadata | ✅ Yes (2026-01-20 21:30) | ❌ fail (2026-01-20 21:44) | 136/160 tests fail, 24 pass - V3 BUGS: (1) `api.slothlet.api` undefined for 8 non-mutate configs - 80 tests fail with `TypeError: Cannot read properties of undefined (reading 'add')` at api.slothlet.api.add() (2) "state is not defined" for EAGER_MUTATE - 16 tests fail at hot_reload.mjs:657 (3) Invalid config error for 7 mutate configs - 40 tests fail with broken error message template (4) Only read-only metadata utilities (get/caller/self) pass for non-mutate/non-hooks configs |
| suites/ownership/module-ownership-removal.test.vitest.mjs | Ownership | ✅ Yes (2026-01-20 21:30) | ❌ fail (2026-01-20 21:46) | Parse error - FILE CORRUPT/INCOMPLETE - "Failed to parse source for import analysis because the content contains invalid JS syntax" at line 207 - missing closing braces |
| suites/ownership/ownership-replacement.test.vitest.mjs | Ownership | ✅ Yes (2026-01-20 21:30) | ❌ fail (2026-01-20 21:47) | 48/48 tests fail - V3 BUGS: (1) `api._getApiOwnership is not a function` for all configs - 16 tests fail (2) `api.slothlet.api` undefined for 8 non-mutate configs - 16 tests fail (3) "state is not defined" for mutate configs - 16 tests fail |
| suites/proxies/proxy-baseline.test.vitest.mjs | Proxies | No | untested | |
| suites/ref/reference-readonly-properties.test.vitest.mjs | Reference | No | untested | |
| suites/rules/rule-12-comprehensive.test.vitest.mjs | API Rules | ✅ Yes (2026-01-20 21:30) | ❌ fail (2026-01-20 21:47) | 7+/70 tests fail + heap OOM crash - V3 BUGS: (1) `api.slothlet.api` undefined for non-mutate configs - 6 tests fail with `TypeError: Cannot read properties of undefined (reading 'add')` (2) "state is not defined" for EAGER_MUTATE - 1 test fails at hot_reload.mjs:657 (3) Test suite crashes with heap overflow before completing all 70 tests |
| suites/runtime/runtime-verification.test.vitest.mjs | Runtime | No | untested | |
| suites/sanitization/sanitization-v2v3-compat.test.vitest.mjs | API Sanitization | No | untested | |
| suites/sanitization/sanitize.test.vitest.mjs | API Sanitization | No | untested | |
| suites/smart-flattening/smart-flattening-case1-case2.test.vitest.mjs | Smart Flattening | ✅ Yes (2026-01-20 21:30) | untested | Updated API methods to v3 namespace |
| suites/smart-flattening/smart-flattening-case3-case4.test.vitest.mjs | Smart Flattening | ✅ Yes (2026-01-20 21:30) | untested | Updated API methods to v3 namespace |
| suites/smart-flattening/smart-flattening-edge-cases.test.vitest.mjs | Smart Flattening | ✅ Yes (2026-01-20 21:30) | untested | Updated API methods to v3 namespace |
| suites/smart-flattening/smart-flattening-folders.test.vitest.mjs | Smart Flattening | ✅ Yes (2026-01-20 21:30) | untested | Updated API methods to v3 namespace |

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
