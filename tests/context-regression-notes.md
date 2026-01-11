# Auto-context Propagation Regression Notes (Post v2.11.0)

## Scope
- Track ALS/EventEmitter context propagation regression that appeared after v2.11.0 while keeping tcp/test files untouched.
- Preserve hot reload/ownership functionality added after v2.11.0; fix must be in core/runtime, not test fixtures.

## Timeline & Regression Window
- v2.11.0: Tests passing.
- Post-v2.11.0 commits touching relevant areas: hot reload and ownership refactors (71413c0 → 24f1724) in [src/slothlet.mjs](src/slothlet.mjs); hook call signature change in [src/lib/runtime/runtime-asynclocalstorage.mjs](src/lib/runtime/runtime-asynclocalstorage.mjs#L107-L180); tcp module only gained debug gating in [api_tests/api_test/tcp/tcp.mjs](api_tests/api_test/tcp/tcp.mjs#L68-L197).
- Likely regression window: hot reload/ownership changes interacting with hooks/ALS; runtime and tcp functional behavior largely unchanged.

## Current Failures (from prior run)
- Vitest auto-context-propagation suite fails in EAGER_HOOKS/HOT/HOT_HOOKS and LAZY/LAZY_HOOKS/HOT/HOT_HOOKS configs: `data` handler reports `contextAvailable=false` (connection sometimes OK).
- Live variants passed, pointing to non-live + hooks/hot initialization ordering or ALS swap issue.

## Key Findings
- ALS runtime merges `requestALS` into ctx before hooks; still uses shared ALS and injects it into EventEmitter patcher via `setDefaultAls` then `enableAlsForEventEmitters` [src/lib/runtime/runtime-asynclocalstorage.mjs#L49-L94](src/lib/runtime/runtime-asynclocalstorage.mjs#L49-L94).
- Post-v2.11 change: hook manager invocations now pass `self/context` (before/after/error/always) [src/lib/runtime/runtime-asynclocalstorage.mjs#L118-L152](src/lib/runtime/runtime-asynclocalstorage.mjs#L118-L152).
- tcp module unchanged functionally since v2.11; only debug logs are gated [api_tests/api_test/tcp/tcp.mjs#L68-L197](api_tests/api_test/tcp/tcp.mjs#L68-L197).
- Core orchestrator now supports `hotReload`; regenerates `instanceId` on load, adds `reload/reloadApi/removeApi`, switches ownership maps to Sets, and uses recursive `mutateLiveBindingFunction` [src/slothlet.mjs#L405-L444](src/slothlet.mjs#L405-L444), [src/slothlet.mjs#L953-L1197](src/slothlet.mjs#L953-L1197). These are the only functional changes after v2.11 touching instance lifecycle.

## Hypothesis
- Hot reload/ownership refactor may rebind or replace API/ALS state in ways that leave hooks enabled but the EventEmitter wrappers bound to an outdated ALS store in certain matrix configs (especially HOT/HOT_HOOKS). The failing modes align with hot reload paths and hook-enabled runtimes.

## Next Steps (after test rewrites)
1. Bisect between 71413c0 and 24f1724 while running auto-context-propagation to pinpoint commit.
2. Instrument connection/data handlers in a scratch branch (not committed) to log ALS identity and `getCtx()` per event in failing configs.
3. Audit hot reload initialization to ensure `enableAlsForEventEmitters` runs with the current ALS after any reload/instanceId regeneration and that hooks use the same ALS instance.
4. Verify `requestALS.run()` usage in `.run`/`.scope` flows still wraps server setup in failing configs.

## Constraints
- Do not modify tcp test fixture or test files; fix must be in core/runtime code paths.
- Maintain new hot reload/ownership features and current API surface.
