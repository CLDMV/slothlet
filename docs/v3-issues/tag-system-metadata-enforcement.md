# Issue: `tagSystemMetadata()` Enforcement Is Honor-System Only

**File:** `src/lib/handlers/metadata.mjs`  
**Method:** `tagSystemMetadata(target, systemData, options)`  
**Severity:** Medium — not exploitable from normal user-land, but not actually enforced at the language level  

---

## Background

`tagSystemMetadata()` writes immutable system metadata (filePath, apiPath, moduleID, sourceFolder,
taggedAt) into a private `#secureMetadata` WeakMap. This is the ground truth for all metadata
lookups. It is intended to be called **only** by the internal lifecycle system when a wrapper is
created or updated — never directly by user code or even by other internal subsystems.

The two legitimate callers are:

- `src/lib/builders/modes-processor.mjs` — during eager/lazy build
- `src/slothlet.mjs` — during `load()` and reload orchestration

Both pass `{ _fromLifecycle: true }` in the options argument.

---

## The Current Check

```js
tagSystemMetadata(target, systemData, options = {}) {
    if (!options._fromLifecycle) {
        throw new Error("[slothlet] tagSystemMetadata() must be called through lifecycle system.");
    }
    // ... tag the metadata
}
```

This check is **honor-system only**. Anyone with a reference to the `Metadata` instance can bypass
it with a single trivial call:

```js
slothlet.handlers.metadata.tagSystemMetadata(anyFn, fakeData, { _fromLifecycle: true });
```

The flag is a plain boolean on a plain object. There is no cryptographic or language-level proof
that the call originated from the lifecycle system.

---

## Threat Model

### What an attacker needs

1. A reference to `slothlet.handlers.metadata` — the internal `Metadata` handler instance.
2. A reference to any function/object to forge metadata for.

### How accessible is `slothlet.handlers`?

`api.slothlet` is the user-facing namespace constructed in `api_builder.mjs`. It exposes a
**curated subset** of the internal `slothlet` object:

```
api.slothlet.metadata   → { get, set, remove, setForPath, removeForPath, self, caller, global }
api.slothlet.lifecycle  → { on, off }          ← emit is NOT exposed
api.slothlet.context    → { run, get, ... }
api.slothlet.api        → { add, remove, ... }
api.slothlet.hook       → { on, off, ... }
```

`slothlet.handlers` itself is **not on `api.slothlet`**. A user operating through the normal API
surface cannot reach `slothlet.handlers.metadata` directly.

### Can `lifecycle.mjs` be imported directly and `emit` called?

The `Lifecycle` class is exported from `src/lib/handlers/lifecycle.mjs`, but the `./handlers/*`
export entry in `package.json` is only present under the **`slothlet-dev`** Node condition. In
production (`dist/`) the handlers path either does not exist or is not in the exports map. So:

- **Production users**: Cannot import `@cldmv/slothlet/handlers/lifecycle` — not a public export.
- **Development / source users** (using `--conditions=slothlet-dev`): Can import the class, but
  importing the class alone gives you an uninstantiated handler. You would need a live `slothlet`
  instance to get the real `Lifecycle` handler off `slothlet.handlers.lifecycle` — which brings
  you back to needing `slothlet` in the first place.
- Even if you have the live handler, calling `lifecycle.emit("impl:created", fakePayload)` would
  trigger the `impl:created` subscriber in `slothlet.mjs`, which calls
  `slothlet.handlers.metadata.tagSystemMetadata(data.impl, data, { _fromLifecycle: true })`. So
  **yes — forging a lifecycle emit is a valid bypass of the `_fromLifecycle` check**.

### Remaining attack vectors

| Vector | Accessible? | Notes |
|---|---|---|
| `api.slothlet.metadata` | ✅ Yes | Only exposes user-facing methods — not `tagSystemMetadata` |
| `api.slothlet.lifecycle.emit` | ❌ No | `emit` explicitly excluded from `api.slothlet.lifecycle` (only `on`/`off`) |
| `slothlet.handlers.lifecycle.emit` | ✅ Yes — if `slothlet` is obtained | Valid bypass path once `slothlet` is in hand |
| `slothlet.handlers.metadata.tagSystemMetadata` | ✅ Yes — if `slothlet` is obtained | Direct call with `{ _fromLifecycle: true }` |
| Module import of `Metadata` class | ✅ Yes — under `slothlet-dev` only | Can instantiate with mock; only useful in dev |
| Import `Lifecycle` class + obtain live handler | ✅ Yes — under `slothlet-dev` only | Valid bypass via forged `emit` — see above |

**The key question is how a user obtains `slothlet` itself.** In a normal integration the user only
has `api` — the returned proxy object. `slothlet` is not a property of `api`. However:

- No lifecycle event payload directly contains `slothlet: this`. All six emit call sites were
  audited (see below) — none pass the raw `slothlet` instance in the payload.
- However, every payload passes `wrapper: this` and/or `impl: this`, where `this` is a
  `UnifiedWrapper` instance. `UnifiedWrapper` extends `ComponentBase`, which stores the slothlet
  reference as `this.slothlet`. The proxy's `ownKeys` trap omits `"slothlet"` via `builtinKeys`,
  but **no explicit `get` trap blocks `prop === "slothlet"`**. A lifecycle subscriber that calls
  `data.wrapper.slothlet` on the raw wrapper object (not the outer API proxy) **will receive the
  full internal `slothlet` instance**.

### Lifecycle emit payload audit (all 6 call sites)

| File | Event | Contains `slothlet`? | Notes |
|---|---|---|---|
| `modes-processor.mjs:1360` | `impl:created` | ❌ | `apiPath, impl, source, moduleID, filePath, sourceFolder` |
| `unified-wrapper.mjs:247` | `impl:created` | ❌ | `apiPath, impl, wrapper, source, moduleID, filePath, sourceFolder` — **`wrapper.slothlet` accessible** |
| `unified-wrapper.mjs:260` | `impl:created` | ❌ | Same shape as above — **`wrapper.slothlet` accessible** |
| `unified-wrapper.mjs:554` | `impl:changed` | ❌ | `apiPath, impl, wrapper, source, moduleID, filePath, sourceFolder` — **`wrapper.slothlet` accessible** |
| `api-manager.mjs:876` | `impl:removed` | ❌ | `apiPath, impl, source, moduleID, filePath, sourceFolder` — **`impl.slothlet` accessible** |
| `slothlet.mjs:290` | `materialized:complete` | ❌ | `total, timestamp` only — clean |

---

## Why the Symbol Approach Would Work

A module-private `Symbol` cannot be forged:

```js
// metadata.mjs — module scope, not exported
const LIFECYCLE_TOKEN = Symbol("slothlet.lifecycle.tagToken");

// exported alongside the class so lifecycle.mjs can import it
export { LIFECYCLE_TOKEN };
```

```js
// lifecycle.mjs — imports LIFECYCLE_TOKEN, attaches it to every emit payload
import { LIFECYCLE_TOKEN } from "@cldmv/slothlet/handlers/metadata";

async emit(event, data) {
    await this.#listeners.get(event)?.(data, LIFECYCLE_TOKEN);
}
```

```js
// metadata.mjs — tagSystemMetadata checks the Symbol
tagSystemMetadata(target, systemData, token) {
    if (token !== LIFECYCLE_TOKEN) throw ...
}
```

Because `LIFECYCLE_TOKEN` is a unique Symbol and **not re-exported from the package's public
exports**, user-land code cannot obtain it. The only way to call `tagSystemMetadata` successfully
is to have imported `LIFECYCLE_TOKEN` from the module — which requires either modifying the source
or using an internal import path not in `package.json`'s `exports` map.

### Caveat: circular import risk

`metadata.mjs` importing into `lifecycle.mjs` and `lifecycle.mjs` importing from `metadata.mjs`
creates a circular dependency. This can be resolved by extracting the token into a third file:

```
src/lib/handlers/lifecycle-token.mjs  ← exports LIFECYCLE_TOKEN only
```

Both `metadata.mjs` and `lifecycle.mjs` import from it. No circular dependency.

---

## Current Risk Assessment

Given the current architecture:

- **Normal user-land code**: Cannot reach `tagSystemMetadata`. No practical exploit path through
  the `api` surface.
- **Lifecycle subscribers (`api.slothlet.lifecycle.on(...)`)**: The payload for `impl:created` and
  `impl:changed` contains a `wrapper` reference. `wrapper.slothlet` is not blocked by the proxy
  `get` trap and returns the full internal `slothlet` instance. From there,
  `slothlet.handlers.lifecycle.emit("impl:created", fakePayload)` bypasses the `_fromLifecycle`
  check entirely. **This is the most realistic attack path from user-land.**
- **Code importing `@cldmv/slothlet/handlers/metadata` directly under `slothlet-dev`**: Can
  instantiate `Metadata` directly with a mock and call `tagSystemMetadata` freely. Production-only
  risk; `slothlet-dev` condition is not active in published builds.

---

## Recommended Fix

### Primary fix: Symbol-based token

1. Create `src/lib/handlers/lifecycle-token.mjs` exporting a single private Symbol.
2. Import it in both `metadata.mjs` (for the check) and `lifecycle.mjs` (to pass in emit).
3. Change `tagSystemMetadata(target, systemData, options = {})` to
   `tagSystemMetadata(target, systemData, token)` — drop the options object entirely.
4. Update the two call sites in `modes-processor.mjs` and `slothlet.mjs` to import and pass the
   token.
5. Do **not** export `LIFECYCLE_TOKEN` from any public `package.json` export entry.

### Secondary fix: harden `.slothlet` on the raw wrapper object

**The proxy get trap cannot solve this.** The proxy handler is an inline object literal passed
directly to `new Proxy(proxyTarget, { get: getTrap, ... })` — no external reference is ever
exposed, so the handler cannot be overwritten by user code.

But the issue is deeper: lifecycle payloads pass `wrapper: this` where `this` is the raw
`UnifiedWrapper` instance at construction time. `createProxy()` is a separate method called later
— the proxy does not exist yet when `impl:created` fires. So `data.wrapper.slothlet` accesses the
raw object property directly, **entirely bypassing the proxy and its get trap**. Adding
`if (prop === "slothlet") return undefined` to the proxy trap would have zero effect.

The actual options are:

**Option A — Redefine `.slothlet` as non-readable on the wrapper:**
```js
// in ComponentBase constructor, after this.slothlet = slothlet
Object.defineProperty(this, "slothlet", {
    get() { return undefined; },
    configurable: false,
    enumerable: false
});
```
This prevents `wrapper.slothlet` from returning anything, but also breaks every internal method
that reads `this.slothlet` — which is all of them. Would require moving internal slothlet access
to a WeakMap or closure instead.

**Option B — Store slothlet in a module-scoped WeakMap instead of on `this`:**
```js
const _slothlet = new WeakMap();
class ComponentBase {
    constructor(slothlet) { _slothlet.set(this, slothlet); }
    get slothlet() { return _slothlet.get(this); }
}
```
This keeps the property accessor working internally while making `Object.getOwnPropertyDescriptor`
and direct property access on the raw class instance return nothing useful. Still accessible via
the getter, but the getter can add caller verification.

**Option C — Strip `wrapper` from lifecycle payloads:**
Remove `wrapper: this` from the `impl:created` and `impl:changed` payloads in
`unified-wrapper.mjs`. Subscribers that need to identify the wrapper can use the `apiPath` or
`moduleID` instead and look up the proxy via `api[...]`. This is the least invasive fix and
closes the exposure without touching `ComponentBase` or the wrapper internals.

Option C is the recommended starting point as it closes the leak with minimal risk of regression.

---

## Related

- `src/lib/builders/modes-processor.mjs` — primary caller of `tagSystemMetadata`
- `src/slothlet.mjs` — secondary caller
- `src/lib/handlers/lifecycle.mjs` — `emit()` is the method that should become the only gateway
- `src/lib/builders/api_builder.mjs` lines ~961–969 — confirms `emit` is excluded from
  `api.slothlet.lifecycle`
