# V3 Vitest Status

Relative base: tests/v3.vitests

| Test (relative) | Feature Category | V3 Updated | Status | Notes |
| --- | --- | --- | --- | --- |
| rule-coverage.test.vitest.mjs | API Rules | No | untested | |
| suites/addapi/add-api.test.vitest.mjs | Hot Reload | ✅ Yes | untested | Updated API methods to v3 namespace |
| suites/addapi/addapi-path-resolution.test.vitest.mjs | Hot Reload | ✅ Yes | untested | Updated API methods to v3 namespace |
| suites/addapi/addapi-stack-trace-path.test.vitest.mjs | Hot Reload | ✅ Yes | untested | Updated API methods to v3 namespace |
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
| suites/hot-reload/hot-reload-allowMutation-disabled.test.vitest.mjs | Hot Reload + Config | ✅ Yes | untested | New test for allowMutation config |
| suites/hot-reload/hot-reload-advanced.test.vitest.mjs | Hot Reload | No | untested | |
| suites/hot-reload/hot-reload-basic.test.vitest.mjs | Hot Reload | ✅ Yes | untested | Updated API methods to v3 namespace |
| suites/hot-reload/hot-reload-errors.test.vitest.mjs | Hot Reload | ✅ Yes | untested | Updated API methods to v3 namespace |
| suites/hot-reload/hot-reload-hooks.test.vitest.mjs | Hot Reload + Hooks | ✅ Yes | untested | Updated API methods to v3 namespace |
| suites/hot-reload/hot-reload-reference-identity.test.vitest.mjs | Hot Reload | ✅ Yes | untested | Updated API methods to v3 namespace |
| suites/hot-reload/hot-reload-test-remove-reload-isolated.test.vitest.mjs | Hot Reload | ✅ Yes | untested | Updated API methods to v3 namespace |
| suites/isolation/multi-instance-isolation.test.vitest.mjs | Isolation | No | untested | |
| suites/isolation/tv-config-isolation.test.vitest.mjs | Isolation | No | untested | |
| suites/listener-cleanup/listener-cleanup.test.vitest.mjs | Lifecycle | No | untested | |
| suites/listener-cleanup/third-party-cleanup.test.vitest.mjs | Lifecycle | No | untested | |
| suites/metadata/metadata-api.test.vitest.mjs | Metadata | ✅ Yes | untested | Updated API methods to v3 namespace |
| suites/ownership/module-ownership-removal.test.vitest.mjs | Ownership | ✅ Yes | untested | Updated API methods to v3 namespace |
| suites/ownership/ownership-replacement.test.vitest.mjs | Ownership | ✅ Yes | untested | Updated API methods to v3 namespace |
| suites/proxies/proxy-baseline.test.vitest.mjs | Proxies | No | untested | |
| suites/ref/reference-readonly-properties.test.vitest.mjs | Reference | No | untested | |
| suites/rules/rule-12-comprehensive.test.vitest.mjs | API Rules | ✅ Yes | untested | Updated API methods to v3 namespace |
| suites/runtime/runtime-verification.test.vitest.mjs | Runtime | No | untested | |
| suites/sanitization/sanitization-v2v3-compat.test.vitest.mjs | API Sanitization | No | untested | |
| suites/sanitization/sanitize.test.vitest.mjs | API Sanitization | No | untested | |
| suites/smart-flattening/smart-flattening-case1-case2.test.vitest.mjs | Smart Flattening | ✅ Yes | untested | Updated API methods to v3 namespace |
| suites/smart-flattening/smart-flattening-case3-case4.test.vitest.mjs | Smart Flattening | ✅ Yes | untested | Updated API methods to v3 namespace |
| suites/smart-flattening/smart-flattening-edge-cases.test.vitest.mjs | Smart Flattening | ✅ Yes | untested | Updated API methods to v3 namespace |
| suites/smart-flattening/smart-flattening-folders.test.vitest.mjs | Smart Flattening | ✅ Yes | untested | Updated API methods to v3 namespace |

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
