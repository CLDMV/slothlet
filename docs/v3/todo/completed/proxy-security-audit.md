# Proxy Security Audit — Public API Surface

**Date:** 2026-02-20  
**Branch:** `refactor/unified-wrapper-poc`  
**HEAD:** `6c3425b` → steps 5–6 complete (C/D blocked, getPrototypeOf trap added)  
**Scope:** Everything accessible through a user-facing slothlet proxy (`api.foo`, `api.foo.bar`, waiting proxies in lazy mode).  
**Current test count:** 232 passing / 0 failures / 0 skips (`proxy-internals-attack.test.vitest.mjs`, 8 matrix configs)

---

## Legend

| Symbol | Meaning |
|--------|---------|
| ✅ BLOCKED | Key is not reachable from outside — returns `undefined`, `false`, or is silently absorbed |
| ⚠️ EXPOSED | Key passes through the proxy and is currently accessible from outside |
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
| Prototype chain walk | ✅ BLOCKED ✔️ TESTED | `getPrototypeOf` trap returns `null` — proxy exposes no prototype chain at all. Both main proxy and waiting proxy. |
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

## C. Framework Mutation / Disruption APIs — ✅ BLOCKED (Step 5)

**Current status: ✅ COMPLETE.** All three are removed from `allowedInternals` and the `hasTrap` allowlist, blocked in `setTrap.blockedKeys` and `deletePropertyTrap.internalKeys`. All internal call sites converted to use `resolveWrapper(proxy).___setImpl(...)` etc. Tests C1–C2 passing.

| Property | What it does | Status |
|---|---|---|
| `___setImpl(newImpl)` | Replaces the wrapper's implementation entirely | ✅ BLOCKED — use `resolveWrapper(proxy).___setImpl` internally |
| `___resetLazy(newMaterializeFunc)` | Clears impl, invalidates children, resets materialization state | ✅ BLOCKED — use `resolveWrapper(proxy).___resetLazy` internally |
| `___invalidate()` | Marks wrapper as invalid — next access throws or re-fetches | ✅ BLOCKED — use `resolveWrapper(proxy).___invalidate` internally |

---

## D. Implementation Info — Partially Blocked (Step 6)

**Current status:** `__impl` and `_impl` are blocked. `__filePath`, `__sourceFolder`, and `__moduleID` are intentionally **exposed read-only** — they are informational props with no security risk to the framework itself.

| Property | What it exposes | Status |
|---|---|---|
| `__impl` | Raw implementation (function/object) — exposes module internals | ✅ BLOCKED — use `resolveWrapper(proxy).__impl` internally |
| `_impl` | Alias for `__impl` — same risk, two names | ✅ BLOCKED — use `resolveWrapper(proxy).__impl` internally |
| `__filePath` | Absolute server-side file path of the source module | ✅ EXPOSED READ-ONLY — informational, write/delete blocked |
| `__sourceFolder` | Absolute server-side directory of the source module | ✅ EXPOSED READ-ONLY — informational, write/delete blocked |
| `__moduleID` | Internal module identifier string | ✅ EXPOSED READ-ONLY — informational, write/delete blocked |

### Decision

`__impl` / `_impl` are blocked because they expose raw module internals (callable functions, closure scope). The path props (`__filePath`, `__sourceFolder`, `__moduleID`) are informational metadata with no mutation risk — they are exposed read-only through the proxy (same treatment as `__mode`, `__apiPath`, etc.) and are blocked from write/delete by `setTrap`/`deletePropertyTrap`.

Internal callers use `resolveWrapper(proxy).__impl` for raw implementation access.

---

## E. Read-Only Metadata / State Accessors

These are low-risk reads that expose no mutable internals.

All of these are now enforced read-only by both `setTrap` and `deletePropertyTrap` blocklists.

| Property | What it exposes | Risk level |
|---|---|---|
| `__mode` | `"eager"` or `"lazy"` | Low — configuration info ✔️ TESTED |
| `__apiPath` / `__slothletPath` | Dot-path string e.g. `"math.add"` | Low — no filesystem info ✔️ TESTED |
| `__isCallable` | Boolean | Low ✔️ TESTED |
| `__materializeOnCreate` | Boolean | Low ✔️ TESTED |
| `__displayName` | Display string | Low ✔️ TESTED |
| `__type` | `"function"`, `"object"`, or type Symbol | Low ✔️ TESTED |
| `__metadata` | User-defined metadata object (from `__slothlet_jsdoc.mjs`) | Medium — depends on what host puts there ✔️ TESTED |
| `__state` | Alias for `___getState()` result — ✅ BLOCKED (removed from allowedInternals) | ✅ BLOCKED ✔️ TESTED |
| `__invalid` | Boolean invalid flag | Low ✔️ TESTED |
| `__materialized` | Boolean — whether the lazy wrapper has finished loading | Low — intentionally exposed ✔️ TESTED |
| `__inFlight` | Boolean — whether materialization is currently in progress | Low — intentionally exposed ✔️ TESTED |
| `__filePath` | Absolute server-side file path | ✅ EXPOSED READ-ONLY — write/delete blocked |
| `__sourceFolder` | Absolute server-side directory | ✅ EXPOSED READ-ONLY — write/delete blocked |
| `__moduleID` | Internal module identifier string | ✅ EXPOSED READ-ONLY — write/delete blocked |

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

## Summary — Action Order

| Step | Item | Status |
|---|---:|---|
| 1 | `_proxyRegistry` + `resolveWrapper` + block `____slothletInternal` | ✅ Done — commit `256f48e` |
| 2 | Delete `___getState()` from prototype; block `__state`; add `__materialized`/`__inFlight` | ✅ Done — commit `8bd2393` |
| 3 | Enforce read-only on all E-section informational props; add E1–E3 + F tests | ✅ Done — commit `6c3425b` |
| 4 | Block `___setImpl` / `___resetLazy` / `___invalidate`; convert all internal callers | ✅ Done |
| 5 | Block `__impl` / `_impl`; expose `__filePath` / `__sourceFolder` / `__moduleID` read-only | ✅ Done |
| 6 | Add `getPrototypeOf: () => null` trap to main proxy + waiting proxy | ✅ Done |
| 7 | Rewrite C/D/A9 test sections to assert new BLOCKED state | ✅ Done — 232/232 passing |

---

## Files Changed in This Sprint (steps 5–6)

- `src/lib/handlers/unified-wrapper.mjs`
  - Removed `___setImpl`, `___resetLazy`, `___invalidate`, `__impl`, `_impl` from `allowedInternals`
  - Removed the `hasTrap` allowlist branch for those five props (only `_materialize` remains)
  - Removed explicit getTrap handlers for all five; added `__filePath` / `__sourceFolder` / `__moduleID` getTrap handlers (exposed read-only)
  - Added `__filePath`, `__sourceFolder`, `__moduleID` to `allowedInternals` (read-only informational)
  - Added all five blocked props to `setTrap.blockedKeys` and `deletePropertyTrap.internalKeys`
  - Added `getPrototypeOf: () => null` trap to both the main proxy and the waiting proxy
  - Converted internal call sites in `___resetLazy` and `___adoptImplChildren` that called C props through proxy children to use `resolveWrapper(child).___invalidate()` etc.
- `src/lib/handlers/api-manager.mjs`
  - Rollback loop (lines ~1696–1703): replaced `existingWrapper?.___setImpl` duck-type guard with `resolveWrapper(existingWrapper)` guard + raw call
  - All other `___setImpl` / `___resetLazy` call sites confirmed raw (via `resolveWrapper` or direct `new UnifiedWrapper` instances)
- `src/lib/handlers/ownership.mjs`
  - `getCurrentValue()`: replaced `"__impl" in value` proxy duck-type check with `resolveWrapper(value)` — the `in` check broke when `__impl` was removed from `hasTrap`
  - Added `import { resolveWrapper } from "@cldmv/slothlet/handlers/unified-wrapper"`
- `tests/vitests/suites/proxies/proxy-internals-attack.test.vitest.mjs`
  - Added `___setImpl`, `___resetLazy`, `___invalidate`, `__impl`, `_impl` to `BLOCKED_KEYS` array
  - Rewrote C1 (was: asserts methods are callable through proxy) → asserts `undefined` through proxy
  - Rewrote C2 (was: calls `___invalidate()` through proxy) → asserts `resolveWrapper` gives access
  - Rewrote D1 → asserts `__impl`/`_impl` are `undefined` through proxy; verifies raw wrapper access
  - Rewrote D2 → asserts `__filePath`/`__sourceFolder`/`__moduleID` are readable and match `____slothletInternal` values
  - Updated `READ_ONLY_INFO_PROPS` comment for server-info props
  - **232 tests passing, 0 skips, 0 failures**
- `docs/v3/todo/proxy-security-audit.md` — updated throughout to reflect completion

---


- `src/lib/handlers/unified-wrapper.mjs` — added `__materialized` / `__inFlight` to main getTrap + waiting proxy getTrap; expanded `setTrap.blockedKeys` and `deletePropertyTrap.internalKeys` to cover all E-section read-only props (`__mode`, `__apiPath`, `__slothletPath`, `__isCallable`, `__materializeOnCreate`, `__displayName`, `__type`, `__filePath`, `__sourceFolder`, `__moduleID`, `__metadata`, `__invalid`, `__materialized`, `__inFlight`)
- `tests/vitests/suites/proxies/proxy-internals-attack.test.vitest.mjs` — added E1–E3 (read-only prop write/delete immutability); renamed old E (resolveWrapper) → F (F1–F5) to match audit section ordering; **232 tests passing, 0 skips, 0 failures**

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
