# Proxy Security Audit — Public API Surface

**Date:** 2026-02-20  
**Branch:** `refactor/unified-wrapper-poc`  
**Scope:** Everything accessible through a user-facing slothlet proxy (`api.foo`, `api.foo.bar`, waiting proxies in lazy mode).

---

## Legend

| Symbol | Meaning |
|--------|---------|
| ✅ BLOCKED | Key is not reachable from outside — returns `undefined`, `false`, or is silently absorbed |
| ⚠️ EXPOSED | Key passes through the proxy — intentional framework extension point |
| 🔴 RISK | Exposed key creates a concrete attack vector that is not yet mitigated |
| ✔️ TESTED | A vitest covers this surface (`proxy-internals-attack.test.vitest.mjs`) |

---

## A. Private State Bag — `____slothletInternal`

The canonical private state object. Backed by a `#internal` ES private field (step 1). The prototype getter `get ____slothletInternal()` only works on class instances that own `#internal`.

| Attack Vector | Status | Notes |
|---|---|---|
| Direct read / bracket notation | ✅ BLOCKED ✔️ TESTED | `allowedInternals` filter in getTrap returns `undefined` |
| `in` operator (hasTrap) | ✅ BLOCKED ✔️ TESTED | Not in hasTrap allowlist |
| `Object.getOwnPropertyDescriptor` | ✅ BLOCKED ✔️ TESTED | Returns `undefined` |
| `Object.keys` / `getOwnPropertyNames` / `Reflect.ownKeys` | ✅ BLOCKED ✔️ TESTED | Not included in ownKeysTrap output |
| `for..in` enumeration | ✅ BLOCKED ✔️ TESTED | Follows ownKeys |
| Spread `{ ...proxy }` | ✅ BLOCKED ✔️ TESTED | Follows ownKeys |
| `Object.assign` | ✅ BLOCKED ✔️ TESTED | Follows ownKeys |
| Prototype chain walk | ✅ BLOCKED ✔️ TESTED | Getter on prototype throws if `this` has no `#internal` — fixed to return `undefined` via brand check |
| Mutation via `set` | ✅ BLOCKED ✔️ TESTED | setTrap silently absorbs write; does not shadow `#internal` getter on wrapper instance |
| Mutation via `Object.defineProperty` | ✅ BLOCKED ✔️ TESTED | Either throws or is absorbed; key remains unreadable |
| `delete proxy.____slothletInternal` | ✅ BLOCKED ✔️ TESTED | deletePropertyTrap returns `true` silently (was `false` which threw TypeError leaking key existence) |
| Waiting proxy (lazy pre-materialization) | ✅ BLOCKED ✔️ TESTED | Was leaking (`return wrapper.____slothletInternal`) — fixed in this sprint |

---

## B. `___getState()` — Blocked & Method Deleted

**Current status: ✅ BLOCKED ✔️ TESTED**

`___getState` has been **deleted from `UnifiedWrapper.prototype`** entirely (not just blocked in the proxy). `__state` alias has been removed from `allowedInternals`. Both return `undefined` through any user-facing proxy. Internal framework code uses `resolveWrapper(proxy).____slothletInternal.state` directly instead.

All call sites in `unified-wrapper.mjs`, `api-manager.mjs`, and `modes-processor.mjs` that previously used `___getState` through a proxy have been converted to `resolveWrapper`.

Because the method no longer exists on the prototype, the A9 (prototype chain walk) test now passes for `___getState` for all configs.

No action needed.

---

## C. Framework Mutation / Disruption APIs

All three are in `allowedInternals` and in the `hasTrap` allowlist, making them fully accessible.

| Property | What it does | Status |
|---|---|---|
| `___setImpl(newImpl)` | Replaces the wrapper's implementation entirely | ⚠️ EXPOSED ✔️ TESTED |
| `___resetLazy(newMaterializeFunc)` | Clears impl, invalidates children, resets materialization state | ⚠️ EXPOSED ✔️ TESTED |
| `___invalidate()` | Marks wrapper as invalid — next access throws or re-fetches | ⚠️ EXPOSED ✔️ TESTED |

### Concrete risks

| Risk | Impact |
|---|---|
| `proxy.___setImpl(() => (...args) => exploit(...args))` | Injects arbitrary function as the API implementation |
| `proxy.___resetLazy(() => { /* nothing */ })` | Silently neuters the API — every call becomes a no-op |
| `proxy.___invalidate()` | Disrupts all consumers of this proxy |

### Decision needed

- [ ] **Option A — Move these behind `resolveWrapper`** (recommended): Remove from `allowedInternals` and the `hasTrap` allowlist. All internal framework callers must use `resolveWrapper(proxy).___setImpl(...)` instead of `proxy.___setImpl(...)`. This is a breaking change for any host-side reload code.
- [ ] **Option B — Add a capability token**: Require a non-transferable token argument (e.g. a Symbol minted at `slothlet()` creation time) as a first parameter. Rejects calls without the correct token.
- [ ] **Option C — Accept risk**: Document as trusted host-only extension points; unchanged.

---

## D. Implementation & Filesystem Path Info Leaks

| Property | What it exposes | Status |
|---|---|---|
| `__impl` | Raw implementation (function/object) — exposes module internals | ⚠️ EXPOSED ✔️ TESTED |
| `_impl` | Alias for `__impl` — same risk, two names | ⚠️ EXPOSED |
| `__filePath` | Absolute server-side file path of the source module | ⚠️ EXPOSED ✔️ TESTED |
| `__sourceFolder` | Absolute server-side directory of the source module | ⚠️ EXPOSED ✔️ TESTED |
| `__moduleID` | Internal module identifier string | ⚠️ EXPOSED |

### Concrete risks

| Risk | Impact |
|---|---|
| `proxy.__filePath` | Leaks server filesystem layout to client — path traversal context |
| `proxy.__sourceFolder` | Same as above |
| `proxy.__impl` | Exposes raw function — caller can read `.toString()`, inspect closure scope, call it unbound |

### Decision needed

- [ ] **Option A — Remove `__filePath` / `__sourceFolder` / `__moduleID` from `allowedInternals`**: Internal callers should use `resolveWrapper`. Low risk of breakage.
- [ ] **Option B — Keep for debugging; add a `debug` config flag**: Only expose in `debug: true` mode.
- [ ] **Option C — Keep `__impl` for host reload patterns; remove path props**: `__impl` is used by some host patterns; paths are purely internal.

---

## E. Read-Only Metadata / State Accessors

These are low-risk reads that expose no mutable internals.

| Property | What it exposes | Risk level |
|---|---|---|
| `__mode` | `"eager"` or `"lazy"` | Low — configuration info |
| `__apiPath` / `__slothletPath` | Dot-path string e.g. `"math.add"` | Low — no filesystem info |
| `__isCallable` | Boolean | Low |
| `__materializeOnCreate` | Boolean | Low |
| `__displayName` | Display string | Low |
| `__type` | `"function"`, `"object"`, or type Symbol | Low |
| `__metadata` | User-defined metadata object (from `__slothlet_jsdoc.mjs`) | Medium — depends on what host puts there |
| `__state` | Alias for `___getState()` result — ✅ BLOCKED (removed from allowedInternals) | ✅ BLOCKED ✔️ TESTED |
| `__invalid` | Boolean invalid flag | Low — read only, no write path |
| `__materialized` | Boolean — whether the lazy wrapper has finished loading | Low — intentionally exposed for test/debug use |
| `__inFlight` | Boolean — whether materialization is currently in progress | Low — intentionally exposed for test/debug use |

---

## F. `resolveWrapper` — Safe Internal Access Path

`resolveWrapper(value)` is the correct way for framework internals to obtain the `UnifiedWrapper` from a proxy. It consults `_proxyRegistry` (a module-private `WeakMap`) and never goes through the proxy traps.

| Property | Status |
|---|---|
| `resolveWrapper(proxy)` returns real wrapper | ✅ Correct ✔️ TESTED |
| `resolveWrapper(waitingProxy)` returns real wrapper | ✅ Correct ✔️ TESTED |
| `resolveWrapper(non-proxy)` returns `null` | ✅ Correct ✔️ TESTED |
| Raw wrapper exposes `____slothletInternal` (framework use) | ✅ Intentional ✔️ TESTED |

**No action needed here.** This is the intended pattern.

---

## Summary — Recommended Action Order

| Priority | Item | Effort |
|---|---|---|
| ✅ Done | `___getState` / `__state` blocked, all call sites converted to `resolveWrapper` | — |
| 🟠 Medium | Remove `___setImpl` / `___resetLazy` / `___invalidate` from proxy `allowedInternals` (force `resolveWrapper` usage) | Medium — requires internal call-site audit |
| 🟠 Medium | Remove `__filePath` / `__sourceFolder` / `__moduleID` from `allowedInternals` | Low |
| 🟡 Low | Remove `_impl` alias (duplicate of `__impl`) | Low |
| 🟡 Low | Decide whether `__impl` stays or requires `resolveWrapper` | Medium |

---

## Files Changed in This Sprint (step 2)

- `src/lib/handlers/unified-wrapper.mjs` — `_proxyRegistry`, `resolveWrapper`, blocked `____slothletInternal` in all 4 traps + waiting proxy, `deletePropertyTrap` returns `true` instead of `false` for blocked keys
- `tests/vitests/suites/proxies/proxy-internals-attack.test.vitest.mjs` — 208 tests across 8 matrix configs, no skips

## Files Changed in This Sprint (step 3)

- `src/lib/handlers/unified-wrapper.mjs` — deleted `___getState()` from `UnifiedWrapper.prototype`; removed `___getState`/`__state` from `allowedInternals`; added `setTrap` blocklist for those keys; converted all internal duck-type checks and state reads to `resolveWrapper`; added `__materialized` / `__inFlight` to `allowedInternals` + main getTrap + waiting proxy getTrap
- `src/lib/handlers/api-manager.mjs` — all `___getState` duck-type checks replaced with `resolveWrapper(value) !== null`; state reads use `resolveWrapper(x).____slothletInternal.state`
- `src/lib/builders/modes-processor.mjs` — `___getState` duck-type check replaced with `resolveWrapper(nestedValue) !== null`
- `tests/debug-slothlet.mjs` — `___getState` duck-type + state read replaced with `resolveWrapper`
- `tests/vitests/suites/core/core-reload-lazy-mode.test.vitest.mjs` — `resolveWrapper` import removed; `getWrapperState()` now uses `proxy.__materialized` / `proxy.__inFlight`
- `tests/vitests/suites/proxies/proxy-internals-attack.test.vitest.mjs` — restructured A section: `describe.each(BLOCKED_KEYS)` replaced with flat `it` tests that loop over `BLOCKED_KEYS` internally (fixes hang from excessive `beforeEach` invocations); 448 tests across 8 matrix configs, 0 skips, 0 failures
