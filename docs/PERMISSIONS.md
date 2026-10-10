# Permission System

The Permission System provides path-based access control for inter-module API calls. Rules use glob pattern matching (same syntax as hooks) to declare which callers may invoke which targets. Enforcement happens in the unified wrapper's `applyTrap` — before hooks or function execution — so denied calls produce zero side effects.

## Overview

When permissions are enabled, every inter-module call (`self.payments.charge.process(100)`) triggers a permission check. The `PermissionManager` collects all matching rules, determines the most specific one, and either allows or denies. If no rule matches, the configurable **default policy** applies.

> **Note:** The permission system is **off by default**. It only activates when you provide a `permissions` configuration block. Existing users who do not configure permissions pay zero runtime cost.

**Key characteristics:**

- Same glob pattern syntax as hooks (`*`, `**`, `?`, `{a,b}`, `!negation`)
- Enforcement before hooks — denied calls never trigger `before:` hooks
- Self-calls (same source file) always bypass the permission system
- Opt-in owner grant (`owner: true`) lets a module reach every leaf it owns, across its own directories
- Most-specific-wins evaluation, tiebroken by rule layer then registration order
- Compiled-pattern cache for zero-overhead repeat checks
- Caller/target result cache with automatic invalidation
- Full lifecycle event audit trail
- Multi-instance safe — each slothlet instance has its own `PermissionManager`

## Table of Contents

- [Configuration](#configuration)
- [Caller Identity & Fail-Closed Enforcement](#caller-identity--fail-closed-enforcement)
- [Runtime choice & the permission boundary](#runtime-choice--the-permission-boundary)
- [Permission Rules](#permission-rules)
- [Context-Conditional Rules](#context-conditional-rules) → [Full Reference](./PERMISSIONS-CONDITIONS.md)
- [Principals](#principals)
- [Declaring Permissions](#declaring-permissions)
- [Evaluation Order](#evaluation-order)
- [Module-Private Exports](#module-private-exports)
- [Self-Call Bypass](#self-call-bypass)
- [Owner Grant](#owner-grant)
- [Read-Level Gating](#read-level-gating)
- [Hook Permission Gating](#hook-permission-gating)
- [Event Rules](#event-rules) → [Full Reference](./EVENTS.md)
- [API Surface — api.slothlet.permissions](#api-surface--apislothletpermissions)
- [Audit Events](#audit-events)
- [Cache Behavior](#cache-behavior)
- [Lifecycle — Replay, Reload, Shutdown](#lifecycle--replay-reload-shutdown)
- [Multi-Instance Isolation](#multi-instance-isolation)
- [Error Reference](#error-reference)
- [Full Example](#full-example)

---

## Configuration

Configure permissions when creating a slothlet instance:

```javascript
const api = await slothlet({
	dir: "./api",
	permissions: {
		defaultPolicy: "deny", // "allow" (default) or "deny"
		enabled: true, // global toggle (default: true when permissions config is provided)
		audit: "verbose", // "default" or "verbose"
		readGating: false, // opt out of gating data-value reads (default: true)
		rules: [
			{ caller: "**", target: "slothlet.api.*", effect: "deny" },
			{ caller: "admin.**", target: "slothlet.api.*", effect: "allow" }
		]
	}
});
```

### Configuration Options

| Option                   | Type      | Default     | Description                                                                                                                                                                                                                                                                                                                                                                                                                                                                                 |
| ------------------------ | --------- | ----------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `defaultPolicy`          | `string`  | `"allow"`   | Fallback when no rule matches: `"allow"` or `"deny"`                                                                                                                                                                                                                                                                                                                                                                                                                                        |
| `enabled`                | `boolean` | `true`      | Global toggle; when `false`, all calls are allowed without evaluation. Defaults to `true` when a `permissions` config block is provided; the system is off entirely when no config is provided.                                                                                                                                                                                                                                                                                             |
| `audit`                  | `string`  | `"default"` | Audit level: `"default"` (denied + self-bypass only) or `"verbose"` (all decisions)                                                                                                                                                                                                                                                                                                                                                                                                         |
| `readGating`             | `boolean` | `true`      | When `true` (the default), reading a terminal data value (primitive, `Buffer`, `TypedArray`, `Date`, `Map`, etc.) off a module API path is permission-checked the same way calls are. Set `false` to gate calls only. See [Read-Level Gating](#read-level-gating).                                                                                                                                                                                                                          |
| `failOpenOnAbsentCaller` | `boolean` | `false`     | When `false` (the default), a call or read made with **no resolvable caller identity** is denied — fail closed. Set `true` to restore the pre-3.12.0 fail-open behavior for such calls. See [Caller Identity & Fail-Closed Enforcement](#caller-identity--fail-closed-enforcement).                                                                                                                                                                                                         |
| `references.capture`     | `boolean` | `true`      | When `true` (the default), a function read out of the api carries the identity of the module that read it, so it stays enforced as that module wherever it is later invoked. Costs a per-reader object per wrapper read — see the measured overhead below. Set `false` to restore the older behavior, where a reference invoked with no active caller was treated as host-initiated. See [Captured references remember who captured them](#captured-references-remember-who-captured-them). |
| `owner`                  | `boolean` | `false`     | When `true`, a module may access every leaf it currently owns — across its own subdirectories — wherever `defaultPolicy` would otherwise deny. An explicit deny rule still wins. See [Owner Grant](#owner-grant).                                                                                                                                                                                                                                                                           |
| `rules`                  | `array`   | `[]`        | Array of rule objects applied at initialization (earliest stacking order)                                                                                                                                                                                                                                                                                                                                                                                                                   |

When `permissions` is not provided or `undefined`, the permission system is **disabled** — `isEnabled()` returns `false` and no permission checks run. Existing users pay zero runtime cost.

---

## Caller Identity & Fail-Closed Enforcement

Every gated call or read is attributed to a **caller** — the module whose code initiated it — and the matching rules are evaluated against that caller's API path. Enforcement resolves the caller from the active context; a call proceeds through the rules and default policy only when a genuine, host-rooted caller identity is present.

**Fail-closed by default (v3.12.0+).** If a call or read arrives with **no resolvable caller identity** — the context is present but carries no caller, or the caller is a forged wrapper that slothlet did not create — it is **denied**, regardless of `defaultPolicy`. Earlier versions failed _open_ here, exempting such calls from enforcement entirely; that was an enforcement gap, not intended behavior. Genuine host-initiated calls — from outside any module context, and any `run()` / `scope()` descended from the host root — always carry a trusted identity and are unaffected.

To restore the old fail-open behavior for absent-caller calls, set `permissions.failOpenOnAbsentCaller: true`. Prefer leaving it closed; opt out only if a concrete flow depends on the previous behavior.

**Construction is enforced like calls.** Inter-module construction via `new self.x.Foo()` is permission-checked exactly as an ordinary call to `self.x.Foo` — earlier versions ran the `construct` trap without a permission check, so construction could bypass gating. Host-initiated construction stays exempt, mirroring call enforcement.

**Class-instance methods are enforced as their creating module.** When a module returns a class instance, calls to that instance's methods are attributed to the module that created it — so an instance method's `self.*` calls are gated identically to that module's plain functions.

---

## Runtime choice & the permission boundary

The permission system is an **enforced boundary under the async runtime** and a **cooperative / intra-app least-privilege boundary under the live runtime**. The dividing line is the runtime, not the platform — a browser is on the cooperative side because it has no `async_hooks` and therefore always runs live, but choosing `runtime: "live"` in **Node** puts you on that side as well. This is a property of what the platform can enforce, not a slothlet limitation, and it is worth understanding before relying on permissions outside the default.

**Under the async runtime** (the default, and Node-only) the boundary has teeth:

- slothlet's engine internals (`context-async`'s `getContext()`, the permission manager, the wrappers) live under the package's private `#handlers/*` / `#factories/*` `imports`, which Node resolves **only from slothlet's own modules** — external code cannot import them, and `@cldmv/slothlet/handlers/*` / `/factories/*` are not in `exports` at all (they throw `ERR_PACKAGE_PATH_NOT_EXPORTED`).
- Per-request context is isolated with **AsyncLocalStorage**, and enforcement fails closed on an absent/forged caller.

So a dependency loaded into a Node process has no supported path to the raw instance and cannot step around the gate.

**Under the live runtime the second of those guarantees is unavailable.** `AsyncLocalStorage` is what makes caller identity intrinsic: the store follows the flow across every `await`, timer, and callback because the engine carries it. The live runtime exists for hosts that have no `async_hooks` at all, so it keeps identity in a single field that unwinds when a call returns, and carries it across deferred work by **patching the boundaries** instead — `EventEmitter` registration, `setTimeout` / `setInterval` / `setImmediate` / `queueMicrotask` / `process.nextTick` / `requestAnimationFrame` / `requestIdleCallback` / `scheduler.postTask`, promise reactions (`then`, and `catch` / `finally`, which register through it), `EventTarget.addEventListener`, IDL `on*` handler properties (every `on*` accessor of every `EventTarget` interface the global object exposes — `HTMLElement`'s `onclick`, `Document`, `XMLHttpRequest`, `WebSocket`, `Worker`, `MessagePort`, IndexedDB requests and so on — plus the global object's own, such as `window.onload`), and the `MutationObserver` / `ResizeObserver` / `IntersectionObserver` / `PerformanceObserver` / `ReportingObserver` constructors. Each captures the registering module at registration (or construction), which is the only moment the information exists.

A callback is pinned to the context that actually registered it: a module call executing synchronously at registration, or a suspended call whose code is on the stack. Rule 3 above is not applied at registration — a registration it would have guessed is the host's, and so is one the stack cannot attribute. The callback then runs as the host, rather than as whichever call happens to be the only one suspended when it fires; permission checks treat it as host-initiated, as they do any host call. `await` is unaffected by the promise patch — on a native promise it does not go through `then`.

Patching covers the boundaries a module reaches through the globals it was given, which is what ordinary code does. It does not — and cannot — cover every boundary. Any Node API that takes a completion callback (`fs.readFile` and friends), a scheduler reached through a second realm (`iframe.contentWindow.setTimeout`), a listener written straight into an emitter's internal handler list instead of registered through `on()`, a reaction registered through a promise's `then` captured before slothlet loaded, and `import { setTimeout } from "node:timers"` are all outside it. That last one is worth naming because it looks patchable and is not: the builtin's ESM named exports are a snapshot taken when the module is first linked, so replacing the property afterwards has no effect on anything that imported it that way — and a library cannot arrange to load first.

Which of these each runtime actually needs differs, and it is worth being precise about:

| Boundary                                                                                                                                                                      | async runtime                                                                             | live runtime                                       |
| ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------- | -------------------------------------------------- |
| `EventEmitter` registration                                                                                                                                                   | needed — restores the store so a listener can use `self`                                  | needed — carries the registering module's identity |
| Timers / microtasks (`setTimeout`, `setInterval`, `setImmediate`, `queueMicrotask`, `process.nextTick`, `requestAnimationFrame`, `requestIdleCallback`, `scheduler.postTask`) | not needed — AsyncLocalStorage already spans them                                         | needed                                             |
| Promise reactions (`then`, `catch`, `finally`)                                                                                                                                | not needed — AsyncLocalStorage already spans them                                         | needed                                             |
| `EventTarget.addEventListener`                                                                                                                                                | needed — this boundary drops the store entirely, so `self` was unusable inside a listener | needed                                             |
| IDL `on*` handler properties (every `EventTarget` interface's, and the global object's)                                                                                       | not needed — AsyncLocalStorage already spans them                                         | needed                                             |
| Observer constructors (`MutationObserver`, `ResizeObserver`, `IntersectionObserver`, `PerformanceObserver`, `ReportingObserver`)                                              | not needed — AsyncLocalStorage already spans them                                         | needed                                             |

The patches are installed when the first instance is created and removed only once the **last** one shuts down. They replace process-global functions, so removal is global too: taking them away while another instance is still running would leave that instance's deferred work unattributed, and an unattributed caller cannot reach `self` at all — turning reads the rules permit into refusals.

**What happens at an unpatched boundary is a refusal, not an escalation.** `self` resolves only while a module is executing (see below), so deferred work that lost its identity gets no `self` at all — it throws `RUNTIME_NO_ACTIVE_CONTEXT_SELF` rather than quietly running with the host's authority. That is what keeps an unenumerable surface fail-closed, and it is why the patches above should be read as **keeping ordinary deferred code working and correctly attributed**, not as the boundary itself. The boundary is the pair of rules that do not depend on enumerating anything: `self` requires an executing module, and a reference read out of the api remembers who read it.

One route does not read `self` at call time and so is not covered by that guard: a module captures an api function while it holds it (`const fn = self.db.write.erase`) and invokes the captured reference later. It is handled a step earlier instead. **A reference read out of the api carries the identity of whoever read it**, recorded at the read — the last moment that identity is known — so the reference enforces as its capturer wherever and whenever it is called, through any boundary, patched or not.

That identity is a floor, not a substitute for the live caller: both are checked. Handing a captured reference to a module with fewer rights does not lend it anything, because the recipient is still enforced on its own account. Nothing changes for a module using its own reference, or for the host reading through the bound `api` object — with no module executing there is nothing to record, so host access is untouched.

**Overlapping calls.** The live runtime's caller field can name only one call, and it is restored call by call as each settles — in settle order, not entry order — so once module calls overlap it can name a call that is suspended, or one that has already finished. Identity is therefore resolved from what is actually in flight, in this order:

1. **A module entered synchronously is the caller** for as long as its body is on the stack — a nested leaf, or a callback pinned with `self.slothlet.lockCaller()` — however many other calls are suspended. An `await` continuation only resumes on an empty stack, so nothing else can be running underneath it.
2. **With no module call in flight**, the caller is the host (or, inside a `run()` / `scope()` a module opened, that module).
3. **With one call suspended**, that call is the caller.
4. **With two or more suspended**, the call stack decides. The resumed code's frames are matched to a suspended call by their **location** — the file the call entered through, or any file under the root folder of the call's module (`base`, or the folder given to `api.slothlet.api.add()`; the deepest root wins when one module is mounted inside another's folder). Function names are never read, since a computed method name can spell out another module's path. A stack with no suspended call on it is the host's (rule 2).

When the stack reaches a module that has several different api paths suspended and no frame tells them apart — they resume in a file they share, and none of their own entry files is on the stack — identity is **unresolved** and the access is refused rather than guessed.

A leaf entered from any of these situations takes as its caller the identity resolved this way at the moment it is entered, so `metadata.caller()` and `lockCaller.caller` report the same caller enforcement admitted the call as — never the shared field, which can name a call that has already finished.

**Several instances.** The active instance is one field shared by every instance and restored the same way, so with two instances in flight it can name the other one. It is resolved like the caller: while code runs synchronously inside a call the field is exact; otherwise the suspended calls of every instance are told apart from the stack. Each instance imports its own copy of a leaf (under a `?slothlet_instance=…` query, in Node and in the browser), so a frame also says which instance it belongs to, even for two instances built from the same folder.

Because this reads locations, it inherits their limits: code in a file outside every module root (a helper folder beside the mounted api folder) is attributed to the next frame outward, usually the call that awaited it, or to the host when there is no module frame at all; a module running another module's file (a raw import of its helper) is attributed to the module that owns the folder; a bundle that merges files, or a `//# sourceURL=` comment that renames a script, changes the locations an engine reports. These are the cooperative-boundary terms described above.

That is why the live runtime is a cooperative boundary and the async runtime is an enforced one. In Node, prefer the default async runtime whenever the permission system is load-bearing; reach for `runtime: "live"` when the host cannot provide `async_hooks`, and treat its enforcement as least-privilege among modules you trust.

**In the browser the module-privacy guarantee does not hold either**, and cannot. Every module slothlet serves — its own internals _and_ your API leaves — is a plain URL that any script on the page can `import()` directly, regardless of `exports` / `imports` or the importmap; hiding a specifier does not hide the file. Any same-origin script also has full DOM / network / storage / global authority, so it can reach shared state and interfere with setup. Browsers provide real isolation only through **iframes / Web Workers**, which the _application_ must architect — a library cannot impose it.

Concretely: the public runtime exports (`self`, `context`, `instanceID` from `@cldmv/slothlet/runtime`) hand a leaf only the **gated** api (`self.*` is enforced), context data, and an id string — no raw instance. But a leaf running in the browser could still `import()` an internal file, or a sibling leaf's file, by URL and act outside the gate. Bundling slothlet's internals would close the _internals_ door, but not the leaf-to-leaf one, so it does not make the browser a hard boundary.

### Why the browser cannot be made a hard boundary

This is worth stating outright rather than leaving as an inference: **a browser deployment cannot be made fully safe against adversarial code, and slothlet cannot change that.** Three separate things stand in the way, and none of them is a defect that a future release closes:

1. **Every module is a URL.** Any script on the page can `import()` a leaf — or slothlet's own internals — directly, bypassing the api and its gate entirely. Package-level module privacy has no browser equivalent; hiding a specifier does not hide a file that the page must be able to fetch.
2. **The page owns the globals.** A leaf can hold a reference to a scheduler captured before slothlet loaded, register a listener by writing an emitter's internal handler list rather than calling `on()`, or reach a second realm — `iframe.contentWindow.setTimeout` is an unpatched scheduler in the same process. Boundary patching is cooperative by nature; code that sets out to avoid it, can.
3. **There is no `AsyncLocalStorage`.** This is the root of it. In Node the async runtime does not patch anything: the engine carries the store across every `await`, timer and callback, so identity is intrinsic and there is nothing to step around. A browser has no equivalent, so the live runtime has to reconstruct identity at each boundary it knows about — and a reconstructed answer is only as complete as the list of boundaries.

The failure mode of all three is a **refusal, not an escalation** — work that loses its identity gets no `self` at all, and a captured reference still carries whoever captured it. So the cost of an unpatched path is that a leaf loses access it should have had, never that it gains access it should not. That is the right direction to fail, but it is not a sandbox.

The only way to close this would be to refuse to run, or to withdraw enough of the api that browser use stops being worthwhile. Neither is a trade worth making for a boundary that is cooperative by design. **If and when browsers ship an `AsyncLocalStorage` equivalent** — the TC39 `AsyncContext` proposal is the candidate — the third point goes away and the browser could run the same enforced model Node does. The first two would remain: they are properties of the platform, not of the runtime.

**Guidance.** Treat live-runtime permissions — in the browser, or in Node under `runtime: "live"` — as **least-privilege among cooperative modules you trust**: a way to keep your own code honest and catch mistakes, not a sandbox for adversarial or untrusted third-party leaves. If you need a hard boundary in the browser, isolate the untrusted code in a Worker or iframe at the application level. The enforced, adversarial-resistant boundary is **Node under the async runtime**.

### Captured references remember who captured them

A function read out of the api keeps the identity of the module that read it, so it enforces as that module whenever it is later invoked — including from a boundary that carries no caller of its own. The captured identity is enforced **in addition to** whoever is actually calling, never instead, so a reference cannot be used to lend authority to a module that does not have it:

```js
// inside callers/report.mjs — permitted to read db.metrics
const read = self.db.metrics.read; // identity recorded here

setTimeout(async () => {
	await read(); // still enforced as callers.report, not as the host
}, 1000);

// handing it to a module that may not read metrics does not help that module
await self.callers.untrusted.use(read); // refused on `untrusted`'s own account
```

Reads through the bound `api` object returned by `slothlet()` are unaffected: no module is executing, so there is nothing to record, and the host keeps its own standing.

**Both runtimes need this**, unlike the boundary patches. The live runtime needs it because a reference invoked from a boundary carrying no caller would otherwise be read as host-initiated. The async runtime is already safe there — outside a flow it has no store to inherit — but it shares the second case: without capture, an unprivileged module could hand a reference to a permitted one and have the work done on its behalf, since only the live caller would be checked.

**Cost.** Recording the reader means interposing a per-reader object on each wrapper that module reads, because telling holders apart is the entire point of having one — there is no cheaper way. Measured on a permitted inter-module call whose target does nothing (so the overhead is as visible as it can be), enabling it costs **tens of percent — repeated paired runs landed between roughly 25% and 50%, or about 5–10 µs per gated call**. The spread is that wide because the figure is sensitive to machine and load, so treat it as a magnitude rather than a number to quote; measure on your own hardware if it matters to you. Two things bound it in practice: instances with no `permissions` block skip it entirely, and the fraction shrinks as the target does real work. Set `references: { capture: false }` if you have measured it and want the older behavior back.

### `self` requires an executing module

`self` is the in-module view of the api, and what makes it safe is that every access through it is attributed to the module making it. Code that is not a module has no such attribution, so `self` refuses to resolve at all outside a module call — reads, writes, `in`, `Object.keys`, and descriptor lookups alike, so nothing discloses the api's shape either. Under the async runtime this is automatic (no store, nothing to read through); under the live runtime it is an explicit check, because the live store stays populated for the instance's whole lifetime and would otherwise resolve for any script that imported the runtime.

Reaching the api from outside a module is what the bound object returned by `slothlet()` is for. It carries the host's own standing, and is unaffected:

```js
const api = await slothlet({ base: "./api" });

await api.math.add(1, 2); // fine — the host's handle
self.math.add(1, 2); // throws RUNTIME_NO_ACTIVE_CONTEXT_SELF
```

---

## Permission Rules

A rule is a plain object with three required fields and one optional field:

```javascript
{
	caller: "payments.**",    // glob pattern matching caller API paths
	target: "db.write",       // glob pattern matching target API paths
	effect: "allow",          // "allow" or "deny"
	condition: { role: "admin" }  // optional — see Context-Conditional Rules below
}
```

**Path convention:** Rules use the **API tree path**, not the user-land variable name. The variable holding the Slothlet instance (commonly `api`) is not part of the path. What the user accesses as `api.slothlet.api.add(...)` is targeted as `slothlet.api.*` in a rule.

**Paths are the flattened surface path — what you call, is what you rule on.** Smart flattening collapses levels (a `folder/folder.mjs` pair, a mount whose folder repeats the mount's last segment — see [API flattening](./API-RULES/API-FLATTENING.md)), and a rule targets the path that survives that collapse: the one you actually invoke. A path that flattening removed is not a valid target, whether the subtree was composed from `base` or mounted later with `api.slothlet.api.add()` — both name their leaves the same way.

```javascript
// api.slothlet.api.add(["exts", "alpha"], "…/alpha")   where alpha/ holds alpha.mjs exporting op()
await api.exts.alpha.op(); //  the callable path

{ caller: "**", target: "exts.alpha.op", effect: "allow" } //  governs that call
{ caller: "**", target: "exts.alpha.alpha.op", effect: "allow" } //  no such path — never matches
```

If a rule appears to be ignored, print `Object.keys()` along the namespace to see the real surface, and target what is there.

### Pattern Syntax

| Pattern | Matches                                      |
| ------- | -------------------------------------------- |
| `*`     | Any single path segment                      |
| `**`    | Any number of path segments (including zero) |
| `?`     | Any single character                         |
| `{a,b}` | Either `a` or `b` (brace expansion)          |
| `!pat`  | Negation — matches everything _except_ `pat` |

### Examples

```javascript
// Deny untrusted modules from calling anything under admin
{ caller: "untrusted.**", target: "admin.**", effect: "deny" }

// Allow payments module to read from database
{ caller: "payments.**", target: "db.read.**", effect: "allow" }

// Deny all modules from hot-reloading or removing APIs
{ caller: "**", target: "slothlet.api.{remove,reload}", effect: "deny" }

// Allow a specific module to access a specific endpoint
{ caller: "callers.adminCaller", target: "admin.manage.deleteUser", effect: "allow" }
```

---

## Context-Conditional Rules

Any rule may include an optional `condition` field. When present, the condition is evaluated against the current per-request ALS context (set via `api.slothlet.context.run(ctx, fn)`) at the moment the permission check fires. If the condition does not match, the rule is treated as absent — other rules continue to be evaluated normally. Rules without a `condition` always participate regardless of context.

```javascript
// Allow billing module to reach payments only when the request is from a paying tenant
{
	caller: "billing.**",
	target: "payments.**",
	effect: "allow",
	condition: { tier: "paid" }
}
```

Conditions support three forms: **plain objects** (deep key matching via `===`), **functions** (called with the full context object, truthy return = match), and **arrays** (OR semantics — any entry matching is sufficient). Results for conditional rules are never written to the permission cache.

For the full reference — condition forms, deep-match semantics, validation rules, caching details, audit events, and common patterns — see **[Permission Conditions](./PERMISSIONS-CONDITIONS.md)**.

> **Conditions are synchronous.** A function condition that returns a Promise (an `async` condition, or one returning a thenable) is treated as a **non-match** and a `DEBUG_PERMISSION_CONDITION_THENABLE` diagnostic is emitted — a Promise is truthy, so evaluating it as a boolean would let an `allow` rule fail open. Facts that must be fetched asynchronously belong in a [principal](#principals).

---

## Principals

A rule condition decides a single call, synchronously. Real per-resource gates usually also need **facts about the caller** that are only available asynchronously — a user's per-project roles, an org's billing plan, a group membership looked up in a directory. A **principal** is where those facts come from: a named resolver, registered at runtime and owned by the module that registered it, that turns a caller identity into authorization facts. Slothlet resolves it asynchronously, caches the result per identity, and hands it read-only to the synchronous conditions of the rules that declare they need it.

The two jobs stay separate:

| Piece         | Answers                             | Runs                                 | Example                                   |
| ------------- | ----------------------------------- | ------------------------------------ | ----------------------------------------- |
| **Principal** | "What is true about this identity?" | Async, cached per identity           | U's roles on every project                |
| **Condition** | "May this caller make _this_ call?" | Sync, per call, sees `args`/`target` | May U `read` `project.files.list("p42")`? |

### Registering a principal

```javascript
// Inside the roles module (a function the host calls — e.g. its `initialize` routine)
self.slothlet.permissions.principal.register("roles", {
	key: (ctx) => ctx.user?.id, // how THIS principal identifies the caller (sync)
	resolve: async (userId) => loadRoles(userId), // the facts for that identity (may be async)
	maxAge: 30_000 // optional: re-resolve after 30s
});
```

- **`key(ctx)`** maps the per-request context to this principal's identity key. It must be synchronous. A `null`/`undefined` key means "no identity" — rules requiring the principal do not match for that call.
- **`resolve(identityKey)`** returns the facts. It may be async. It runs **as the module that registered it**, so anything it calls through `self` is attributed to that module — not to whichever caller's call triggered the resolve. (A host-registered resolver is invoked directly, in the flow of the call that needed it.)
- **`maxAge`** (ms) is optional. Without it, a resolved value stays current until it is invalidated.

Registering is **host-only by default**: a built-in rule denies modules access to the principal management surface, exactly like `control.**`. The host grants it to the modules that should define principals:

```javascript
// Built-in (registered for every instance):
{ caller: "**", target: "slothlet.permissions.principal.**", effect: "deny" }

// Host grant:
{ caller: "roles.**", target: "slothlet.permissions.principal.**", effect: "allow" }
```

**Name ownership.** The first registrant owns the name. Only that module (or the host) may register it again, unregister it, or invalidate it; another module claiming an owned name throws `PRINCIPAL_NAME_OWNED`, and a non-owner invalidating or unregistering it throws `PRINCIPAL_NOT_OWNER`. This stops one module from replacing another's resolver with a permissive one. The host may replace a module's resolver; the module keeps ownership.

### Rules declare the principals they need

```javascript
{
	caller: "client.**",
	target: "project.files.list",
	effect: "allow",
	requires: ["roles"],
	condition: (ctx, { args, target, principals }) => principals.roles.projects[args[0]]?.includes("read") === true
}

{
	caller: "client.**",
	target: "reports.export",
	effect: "allow",
	requires: ["roles", "billing"],
	condition: (ctx, { args, principals }) => principals.billing.plan !== "free" && Boolean(principals.roles.projects[args[0]])
}
```

`requires` is declarative data, so slothlet knows **before** the (synchronous) condition runs which principals must be current. The condition receives them as `principals`, alongside the call's `args` and `target`. A rule with `requires` and no `condition` matches whenever its principals are current.

A rule does **not match** — the call falls through to other rules and then `defaultPolicy` (fail closed under `deny`) — when any required principal is:

- not registered (never registered, unregistered, or its owning module was removed),
- dormant (its owning module was reloaded and has not registered it again — see [Principal lifecycle](#principal-lifecycle)),
- without an identity for this call (`key` returned `null`/`undefined`, threw, or returned a Promise), or
- not current and the call cannot wait for it (see below).

A `DEBUG_PERMISSION_PRINCIPAL_UNAVAILABLE` diagnostic records which principal was unavailable and why (`unregistered`, `dormant`, `no-identity`, `stale`).

### Resolution — lazy, per principal, sync fast path

Each principal keeps its own cache keyed by its own identity key, with its own epoch.

- When every principal the matching rules require is current for this identity, the call is enforced **synchronously**, exactly as before.
- When one is missing, expired, or from an older epoch, **that call alone** is promoted: slothlet resolves just the stale principals, then enforces the call against the gate inputs it captured before resolving (caller, context, args), then runs it. The promoted call returns a Promise — a synchronous leaf's result is guarded the same way as a call promoted by an async hook, so awaiting it works and value-coercion of the unawaited Promise throws `HOOK_PROMOTED_RESULT_NOT_AWAITED`.
- Concurrent calls needing the same `(principal, identity)` share one resolve.
- A resolver that throws leaves the principal unresolved; the call is denied (not crashed) and `DEBUG_PERMISSION_PRINCIPAL_RESOLVE_FAILED` is emitted.

**Enforcement sites that cannot wait.** `new` construction, read gating, hook gating, and event delivery must be answered synchronously. A rule on such a site whose required principal is not current is a **non-match** (with the `stale` diagnostic). It is honoured once the principal is current — for example after an ordinary call has resolved it for the same identity.

### Worked example

Setup — identity `U` in org `O`, cold cache:

```text
roles module     registers "roles"   key: ctx.user   resolve: → { projects: { "p42": ["read"] } }
billing module   registers "billing" key: ctx.org    resolve: → { plan: "pro" }

rule A  client.** → project.files.list   requires ["roles"]
rule B  client.** → reports.export       requires ["roles", "billing"]
```

Calls, in order, and what each one does:

```text
self.project.files.list("p42")      rule A: roles(U) missing → async: resolve roles(U) only → allowed
                                    (billing(O) is never resolved)

self.reports.export("p42")          rule B: roles(U) current, billing(O) missing → async: resolve billing(O) only → allowed

self.project.files.list("p42")      roles(U) current → synchronous fast path → allowed

self.project.files.list("p99")      roles(U) current → synchronous → condition finds no grant on p99 → default deny

roles module revokes U on p42 →
  principal.invalidate("roles", U)
self.project.files.list("p42")      roles(U) missing → async re-resolve → no longer granted → default deny
```

Different decisions from the same facts need no new mechanism: two rules both `require: ["roles"]` and apply different conditions. A separate principal is only needed when the **facts** differ (database roles vs. identity-provider group membership).

### Read-only views

Conditions receive a frozen `principals` object whose values are **read-only views**: reads pass through (nested plain objects and arrays are viewed too), and any write — assignment, `defineProperty`, `delete`, prototype change — throws `PRINCIPAL_READ_ONLY`. Only slothlet replaces a principal's value, by resolving it again. Class instances, `Date`, `Map`, and `Set` values inside a principal are handed back as-is.

Principals carry authorization **facts**, not secrets, so any rule may require any registered principal — there is no separate read gate on consuming them.

### Invalidation

```javascript
self.slothlet.permissions.principal.invalidate("roles", userId); // one identity
self.slothlet.permissions.principal.invalidate("roles"); // every identity
```

Only the owner or the host may invalidate. Invalidation keeps working after [`control.seal()`](#control--global-toggles-deny-by-default) — revoking access must not be blocked by a frozen policy. A resolve that is already in flight when its identity (or the whole principal) is invalidated is discarded when it settles, so a revocation that lands mid-resolve is never overwritten by the pre-revocation answer; the call waiting on it is denied.

Principals are independent: invalidating `billing(O)` never discards `roles(U)`.

### Principal lifecycle

| Event                            | Effect on the owner's principals                                                                                                                                                                                                                                                  |
| -------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Owner re-registers               | The resolver is replaced and the epoch bumps: every cached value is discarded and re-resolved on next use.                                                                                                                                                                        |
| `api.slothlet.api.remove(owner)` | The principals are removed; the names are free again.                                                                                                                                                                                                                             |
| `api.slothlet.api.reload(owner)` | The principals go **dormant**: the registered resolver is a closure over the pre-reload module, so it stops answering. The module keeps the names; rules requiring them do not match until the module registers again (typically from its `initialize` routine after the reload). |
| Full `api.slothlet.reload()`     | Host registrations replay as recorded. Module registrations are reserved for their owner, dormant, until the reloaded module registers again. Unregistrations replay.                                                                                                             |
| `control.seal()`                 | `register` / `unregister` throw `PERMISSION_SEALED`; `invalidate` keeps working.                                                                                                                                                                                                  |

Principals are registered from code the host calls — an `initialize` [routine](./LIFECYCLE.md#routines) is the natural place — not from a module's top level, where `self` has no active context.

### Trust boundary

Slothlet has no notion of browser vs. server. Trust comes from **where enforcement runs**: a principal resolved in an untrusted runtime (a browser, a live-runtime client) only gears the UI cooperatively and is never authoritative. A principal must never be forwarded across a link between instances (e.g. by slothlet-vine) — the trusted side resolves its own for the identity it verified. As with the rest of the permission system, the guarantee is against modules operating through slothlet's API; actively hostile in-process code can still monkey-patch.

---

## Declaring Permissions

Permissions can be declared in three ways, listed in stacking order (earliest → latest):

### 1. At Instance Config Time

Rules in `config.permissions.rules` are registered first and form the base layer:

```javascript
const api = await slothlet({
	dir: "./api",
	permissions: {
		defaultPolicy: "deny",
		rules: [
			{ caller: "admin.**", target: "**", effect: "allow" },
			{ caller: "**", target: "db.read.**", effect: "allow" }
		]
	}
});
```

### 2. At `api.add` Time (via `permissions` option)

When adding modules at runtime, declare what the new module is allowed or denied from calling:

```javascript
await api.slothlet.api.add("payments", "./payments", {
	permissions: {
		deny: ["slothlet.*", "admin.**"],
		allow: ["db.read", "cache.**"]
	}
});
```

### 3. Programmatically via `api.slothlet.permissions`

Add or remove rules at runtime:

```javascript
const ruleId = api.slothlet.permissions.addRule({
	caller: "untrusted.**",
	target: "**",
	effect: "deny"
});

// Later, remove it (another module must do this — self-modification is blocked)
api.slothlet.permissions.removeRule(ruleId);
```

---

## Evaluation Order

When `checkAccess(callerPath, targetPath)` is called, the `PermissionManager`:

1. **Self-call bypass**: If the caller and target share the same source file, return `allow` immediately. No rules are evaluated.
2. **Cache check**: If the caller→target pair has been evaluated before, return the cached result.
3. **Collect matching rules**: Find all rules where the caller pattern matches `callerPath` AND the target pattern matches `targetPath`.
4. **Sort by specificity** (most specific first):
   - Exact match (no glob characters) = 3 points
   - Single-segment glob (`*`, `?`, `{a,b}`) = 2 points
   - Multi-segment glob (`**`) = 1 point
   - Combined score = caller specificity + target specificity (range: 2–6)
5. **Tiebreak**: Among rules at the same specificity, the higher precedence **layer** wins — `runtime` > `instance` (config) > `manifest` (a module's own `slothlet.module.json` rules) > `builtin` (framework defaults) — and only within a single layer does the **last-registered** rule win. So a composing host's config or runtime rule overrides a module's manifest rule of equal specificity, which overrides a framework built-in.
6. **No match → default policy**: If no rules match, fall back to `config.permissions.defaultPolicy`.
7. **Owner grant** (only with `owner: true`): if the default policy just denied, and the caller leaf and the target are currently owned by the same module, allow instead. An explicit rule — allow or deny — that matched in steps 3–5 has already decided, so it is never overridden. See [Owner Grant](#owner-grant).

[Module-private members](#module-private-exports) resolve before step 2 and are not affected by the owner grant.

### Specificity Examples

```javascript
// Score 6: exact caller + exact target
{ caller: "payments.charge.process", target: "db.write.insert", effect: "allow" }

// Score 4: exact caller + multi-glob target
{ caller: "payments.charge.process", target: "db.**", effect: "deny" }

// Score 2: multi-glob caller + multi-glob target
{ caller: "**", target: "**", effect: "deny" }
```

If a deny rule at score 4 and an allow rule at score 6 both match, the allow rule wins because it is more specific.

---

## Module-Private Exports

An export whose name starts with `_` or `__` is **private to its module** — the directory of files that exports it. With permissions enabled:

- **Same module — allowed.** The other files of the same directory reach the member through `self`, so sibling files never have to import each other directly. (Same-module means same directory; a subdirectory is its own module, exactly as it is its own namespace.)
- **Other modules — denied.** The refusal behaves like every other denial: a direct read throws `PERMISSION_DENIED`, the key is redacted from enumeration and serialization, and `permission:denied` is emitted — never a silent vanishing.
- **The host — denied by default.** `permissions.private.host: "allow"` restores the trusted-root carve-out for private members:

```javascript
const api = await slothlet({
	base: "./api",
	permissions: {
		defaultPolicy: "allow",
		private: { host: "allow" } // default: "deny"
	}
});
```

The guarantee is **absolute**: no user rule can grant a foreign module access to a private member, because privacy resolves before rule evaluation (the api path is a lossy projection of the module tree — no glob can encode "same module"). Sharing a private member means renaming it public; that is the contract, not a limitation.

Privacy attaches to the **member name**, not the route: `mod.__rate` is private at any depth, while an underscore-prefixed _intermediate_ segment is just a public mount (`.`/`__`-prefixed files and folders are already excluded from the scan as [hidden entries](MODULE-STRUCTURE.md#hidden-entries)). Framework-reserved names (`_materialize`, `__impl`, …) never reach enforcement at all — a module file or export by those names is refused at load (`MODULE_RESERVED_FILENAME` / `MODULE_RESERVED_EXPORT`).

Without a `permissions` block the system is disabled and underscore-prefixed exports remain fully public, as before.

## Self-Call Bypass

Calls within the same source file **always** bypass the permission system. Identity is determined by comparing the caller's `filePath` to the target's `filePath` (physical file location, not API path).

This is critical because multiple API paths can originate from the same file, and a module calling its own co-located functions should never be blocked by permission rules.

```javascript
// self-caller.mjs exports both callSelf and helper
// callSelf() → self.callers.selfCaller.helper() → ALWAYS ALLOWED (same file)
export const callSelf = () => self.callers.selfCaller.helper();
export const helper = () => ({ ok: true });
```

---

## Owner Grant

A module is rarely one directory. An extension added with a single `api.slothlet.api.add(path, folder, { moduleID })` typically spreads its files over subdirectories — and each subdirectory is its own permission module. The [self-call bypass](#self-call-bypass) covers only the same file, and [private members](#module-private-exports) only the same directory, so under `defaultPolicy: "deny"` every call a module makes between its own directories is denied:

```text
launcher/                          added as moduleID "launcher-ext" at "launcher"
├── main.mjs         → launcher.main.activate()   calls self.launcher.session.store.create()
└── session/
    └── store.mjs    → launcher.session.store.create()
```

```javascript
// defaultPolicy: "deny", no owner grant
api.launcher.main.activate();
// PERMISSION_DENIED: caller 'launcher.main.activate' is not permitted to access 'launcher.session.store.create'
```

Writing rules for this means one allow per module, keyed by api path — which is exactly what a composing host cannot know in advance. `permissions.owner: true` grants it instead:

```javascript
const api = await slothlet({
	base: "./api",
	permissions: { defaultPolicy: "deny", owner: true }
});
await api.slothlet.api.add("launcher", "./extensions/launcher", { moduleID: "launcher-ext" });

api.launcher.main.activate(); // "created" — both leaves are owned by "launcher-ext"
```

**Who owns what.** Ownership is the one slothlet already tracks for `api.slothlet.api.remove()` / `reload()`: every leaf of the initial load is owned by the base module, and every leaf an `api.add()` composes is owned by that call's `moduleID`. A caller leaf owned by module M may access a target — call it or [read it](#read-level-gating) — when M is the target path's **current** owner, regardless of directory or api path. A path with no recorded owner grants nothing; under `mode: "lazy"` a leaf's ownership is recorded when it materializes, which a real call or read always does first, so only a silent query such as `global.checkAccess` about a not-yet-materialized leaf answers `false`.

**Matched by owner, not by path.** A second module mounted into the same namespace owns its own leaves, not the first module's, so it gets nothing:

```javascript
await api.slothlet.api.add("launcher", "./extensions/tools", { moduleID: "tools" });
// tools/intruder.mjs → launcher.intruder.poke() calls self.launcher.session.store.create()
api.launcher.intruder.poke(); // PERMISSION_DENIED — shared path, different owner
```

**Precedence.** The grant is an implicit allow that stands in for the default policy only:

- An explicit **deny** rule still wins — the grant applies only when no rule matched (or every matching rule's condition failed) and `defaultPolicy` denied.
- Under `defaultPolicy: "allow"` it changes nothing.
- It does not open [module-private members](#module-private-exports) across directories; privacy is still per directory.
- It never covers the framework's reserved roots (`slothlet.*`, `shutdown`, `destroy`), even though the composed tree registers them to the base module.

```javascript
permissions: {
	defaultPolicy: "deny",
	owner: true,
	rules: [{ caller: "launcher.**", target: "launcher.session.store.destroy", effect: "deny" }]
}
// launcher.main.activate() → store.create()   allowed (owner grant)
// launcher.main.teardown() → store.destroy()  denied  (explicit rule)
```

**Base-loaded modules.** Everything the initial load composes shares the base module's ownership, so with `owner: true` the base tree's modules may all reach each other. Keep `owner` off (and write rules) when the base tree itself needs internal boundaries, or add the modules that need isolating with their own `moduleID`s.

**Ownership changes follow automatically.** Ownership is read live at every check and the grant is never stored in the [resolved cache](#cache-behavior), so a runtime `api.add`, `api.slothlet.api.remove()`, and scoped or full `reload()` keep it correct with no host bookkeeping.

With `audit: "verbose"`, a granted access emits `permission:owner-allow` (see [Audit Events](#audit-events)).

---

## Read-Level Gating

Permission enforcement covers **function calls** _and_ **property reads**. Every inter-module call (`self.payments.charge.process(100)`) is checked, and so is reading a terminal data value off a module path (`self.db.secrets.token`) — both against the same rule set. Without read gating, a module exporting a `Buffer`, `TypedArray`, `Date`, primitive, etc. would be readable by any other module regardless of deny rules, because the check otherwise happens only at _invocation_ and a data value has no invocation step.

Read gating is **on by default** whenever a `permissions` block is configured. A read of `self.db.secrets.token` from another module is checked exactly like a call — the target path is the **leaf segment** (`db.secrets.token`), and a denied read throws `PERMISSION_DENIED`:

```javascript
const api = await slothlet({
	dir: "./api",
	permissions: {
		defaultPolicy: "deny",
		rules: [{ caller: "trusted.**", target: "db.secrets.token", effect: "allow" }]
	}
});
```

To gate **calls only** and leave data-value reads unchecked, opt out with `readGating: false`:

```javascript
permissions: { defaultPolicy: "deny", readGating: false, rules: [ /* … */ ] }
```

**What is gated:** terminal data values — primitives (`string`/`number`/`boolean`/`bigint`/`symbol`), `null`, and built-in objects (`Buffer`, every `TypedArray` view, `ArrayBuffer`, `DataView`, `Map`, `Set`, `WeakMap`, `WeakSet`, `Date`, `RegExp`, `Promise`, `Error`).

**What is NOT gated:**

- **Namespace traversal** — walking `self.admin` → `.manage` → `.deleteUser` returns child wrappers, not data values, so a `defaultPolicy: "deny"` configuration does **not** need an allow rule for every intermediate path segment.
- **Callable functions** — reading a function reference returns a wrapper; the eventual call is still gated by the normal call enforcement.
- **External user code** — reads from outside any module (e.g. `api.db.secrets.token` in your own application code) have no caller context and are exempt, mirroring call enforcement.

The [self-call bypass](#self-call-bypass) still applies — a module reading a data value exported from its own source file is always allowed.

> **Upgrading to v3.7.0:** read gating is on by default. A `defaultPolicy: "deny"` configuration that previously relied on data values being freely readable will now deny those cross-module reads. Add allow rules for the data paths you intend to share, or set `readGating: false` to keep the pre-v3.7.0 calls-only behavior.

**Runtime toggle:** read gating can be switched on or off after instance creation via `api.slothlet.permissions.control.readGating(true|false)`, with the current state at `api.slothlet.permissions.control.readGatingEnabled`. Like `control.enable()`/`disable()`, these routes are deny-by-default for modules (see [control.\*](#control--global-toggles-deny-by-default)).

---

## Hook Permission Gating

The [hook system](HOOKS.md) is governed by these same permission rules. When a `permissions` block is configured, **registering and firing a hook is permission-checked** through the same decision function used for calls and reads — a module can only hook a path it is itself allowed to access. This closes the side-channel where any module reaching `api.slothlet.hook.on` could otherwise observe or tamper with leaves the permission rules were meant to protect.

Hook rule targets use the `pattern:type` **suffix** form: the trailing `:type` names the hook phase (`before`, `after`, `always`, `error` or `around`), and `:hook` matches any hook type on a path. An `around` hook can rewrite arguments and results and prevent the call entirely, so grant `:around` as deliberately as `:before`.

```javascript
const api = await slothlet({
	dir: "./api",
	hook: { enabled: true },
	permissions: {
		enabled: true,
		defaultPolicy: "deny",
		rules: [
			// Plugins may hook their own subtree…
			{ caller: "plugins.**", target: "plugins.**:hook", effect: "allow" },
			// …but never the secret subtree, even via an `error` hook.
			{ caller: "plugins.**", target: "secret.*:error", effect: "deny" }
		]
	}
});
```

**Force-pinned ownership.** Module-registered hooks are pinned to their owner module by default, so a hook's own `self.*` calls and permission checks run as the registering module — preventing a hook from laundering access through the bound `api`. Opt out per-instance with `hook: { pin: false }` at init, or at runtime via `api.slothlet.hook.pin.disable()` (`.enable()` re-enables, `.enabled` reads the current state).

See [HOOKS.md](HOOKS.md#permissions-and-pinning) for the complete hook-gating and pinning reference.

---

## Event Rules

The event system (`api.slothlet.event`) is gated by a **separate rule construct** with a **three-level** effect — `deny` / `notify` / `allow` — rather than the binary `allow`/`deny` of call and hook rules. Event rules are declared under `permissions.events`, matched **most-specific-wins** with the same layered tiebreak described in [Evaluation Order](#evaluation-order), and control what each subscriber receives:

```javascript
const api = await slothlet({
	base: "./api",
	permissions: {
		events: {
			default: "notify", // base level when no rule matches (built-in default)
			rules: [{ caller: "reporting.**", event: "orders.*", effect: "allow" }]
		}
	}
});
```

`caller` matches the **subscriber's** api path and `event` matches the **event name**. A module may also declare event rules in its `slothlet.module.json` (the `manifest` layer), and the host may mutate them at runtime via the gated, host-only `api.slothlet.event.rules.*`. See [EVENTS.md](EVENTS.md) for the full reference.

The event surface itself is a `slothlet.*` route: a built-in `slothlet.event.**` deny keeps everything but `on` / `once` / `off` / `emit` host-only — `rules.*`, [`resolveLevel`](EVENTS.md#resolving-a-level-without-subscribing), and the delivery controls [`strategy` and `deliver`](EVENTS.md#host-controlled-delivery-strategy-and-deliver) — so a module calling one is refused with `PERMISSION_DENIED` under both `defaultPolicy: "allow"` and `"deny"`:

```javascript
// Built-in rules registered for every instance:
{ caller: "**", target: "slothlet.event.**",   effect: "deny" }
{ caller: "**", target: "slothlet.event.on",   effect: "allow" }
{ caller: "**", target: "slothlet.event.once", effect: "allow" }
{ caller: "**", target: "slothlet.event.off",  effect: "allow" }
{ caller: "**", target: "slothlet.event.emit", effect: "allow" }
```

---

## API Surface — api.slothlet.permissions

The permissions namespace is organized into four groups:

### Top-Level — Mutation Operations

| Method               | Description                                                                              |
| -------------------- | ---------------------------------------------------------------------------------------- |
| `addRule(rule)`      | Add a permission rule. Returns the rule ID. Gated by `config.api.mutations.permissions`. |
| `removeRule(ruleId)` | Remove a rule by ID. Self-modification blocked (throws `PERMISSION_SELF_MODIFY`).        |

### `principal.*` — Principals (Host-Only by Default)

Registers the async fact resolvers that `requires` rules consume — see [Principals](#principals). A built-in rule denies modules access to `slothlet.permissions.principal.**`; the host grants it per module.

| Method                                     | Description                                                                                                                                                         |
| ------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `principal.register(name, definition)`     | Register or replace a principal: `{ key, resolve, maxAge? }`. The first registrant owns the name. Recorded for reload replay. Gated by `api.mutations.permissions`. |
| `principal.unregister(name)`               | Remove a principal (owner or host). Returns `boolean`. Recorded for reload replay. Gated by `api.mutations.permissions`.                                            |
| `principal.invalidate(name, identityKey?)` | Discard cached facts for one identity, or for every identity when `identityKey` is omitted (owner or host). Returns `boolean`. Still works after `seal()`.          |

### `self.*` — Always Available

Scoped to the calling module via its context. A module can always introspect its own permissions.

| Method                | Description                                                                  |
| --------------------- | ---------------------------------------------------------------------------- |
| `self.access(target)` | Check if the calling module is allowed to reach `target`. Returns `boolean`. |
| `self.rules()`        | List all rules where the caller pattern matches the calling module's path.   |

### `global.*` — Gatable Diagnostics

Cross-module inspection. Can be independently denied with a single rule on `slothlet.permissions.global.**`. The one exception is `checkCall`, which is **host-only by default** (see [`checkCall` vs `checkAccess`](#checkcall-vs-checkaccess)).

| Method                                    | Description                                                                                                                                                                                                                                                                                                            |
| ----------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `global.checkAccess(caller, target)`      | Silent query: check if an arbitrary `caller` path is allowed to reach `target`. Function conditions receive `null` call metadata; nothing is audited. Returns `boolean`.                                                                                                                                               |
| `global.checkCall(caller, target, args?)` | Call-gate query: would `caller` be allowed to **call** `target` with `args`, judged exactly as the real call gate judges it — audited, `{ args, target }` forwarded to conditions, stale principals resolved. Returns `boolean`, or `Promise<boolean>` only when a principal had to be resolved. Host-only by default. |
| `global.rulesForPath(path)`               | List all rules matching a given target path.                                                                                                                                                                                                                                                                           |
| `global.rulesByModule(moduleID)`          | List all rules owned by a given module.                                                                                                                                                                                                                                                                                |

#### `checkCall` vs `checkAccess`

`checkAccess` is a **silent** query: it resolves the rule set for a caller→target pair and nothing else — no arguments, no audit trail, and a null caller identity is treated as the host. That is the right tool for diagnostics, but it cannot answer the question a trusted boundary layer (such as [`@cldmv/slothlet-vine`](https://github.com/CLDMV/slothlet-vine)) has to answer on the serving side before it forwards a remote module's call: _would the call gate let this caller make this exact call?_ `checkCall` is that question — the call-side twin of [`event.resolveLevel`](EVENTS.md#resolving-a-level-without-subscribing), which answers the same "for a supplied identity" question on the event side.

```javascript
// Host (serving) side: a remote peer identified as "client.app" wants to call project.files.list("p7").
const ok = await api.slothlet.permissions.global.checkCall("client.app", "project.files.list", ["p7"]);
if (!ok) throw new Error("refused");
```

What it does differently, point by point:

- **Call metadata.** Function conditions receive `callMeta = { args, target }` — the same shape the real call gate builds — so a rule that authorizes on the resource named in the call (`(ctx, { args }) => args[0] === ctx.projectId`) answers correctly. `args` defaults to `[]` when omitted; `checkAccess` forwards `null` (see [Second argument: call metadata](PERMISSIONS-CONDITIONS.md#second-argument-call-metadata-callmeta)).
- **Ambient context.** Conditions are evaluated against the current `context.run()` context, as `checkAccess` and `resolveLevel` are.
- **Principals.** A `requires` rule whose principal is stale for the current identity is resolved first and the decision re-evaluated, exactly as a promoted call is (see [Principals](#principals)). That is the **only** case in which `checkCall` returns a `Promise<boolean>`; when every required principal is current — or no rule requires one — it answers synchronously. Always `await` it if the rule set may carry `requires` rules.
- **The caller is a module without a source file.** The [self-call bypass](#evaluation-order) never applies, and a [module-private](#module-private-exports) (`_`-prefixed) target is **denied** outright — it is not judged by the `permissions.private.host` policy, which is what a null caller identity means to `checkAccess`. A supplied identity is a module, never the host.
- **Audited.** The decision emits the same lifecycle events a real call would — `permission:denied` always, `permission:allowed` / `permission:default` under `audit: "verbose"` — with `via: "checkCall"` in the payload, so a probing peer is visible in the audit trail and distinguishable from a real call. `checkAccess` emits nothing.
- **Disabled enforcement** answers `true`, like `checkAccess`.
- **Host-only.** A built-in rule denies modules the query, exactly as `event.resolveLevel` is kept off modules by the `slothlet.event.**` deny — a module that could ask on another identity's behalf would learn that identity's rule outcomes, and the audit trail would misattribute the probe. Since the built-in targets the exact path, an instance rule on the same exact target outranks it (equal specificity, higher layer), which is how the host grants it to a trusted boundary module:

```javascript
// Built-in rule registered for every instance:
{ caller: "**", target: "slothlet.permissions.global.checkCall", effect: "deny" }

// Host grant for a trusted boundary module:
{ caller: "vine.**", target: "slothlet.permissions.global.checkCall", effect: "allow" }
```

`checkCall` throws `INVALID_ARGUMENT` for a non-string or empty `caller` / `target`, or an `args` that is neither an array nor `null`/`undefined`.

### `control.*` — Global Toggles (Deny-by-Default)

Controls the global enforcement state. A built-in rule automatically denies all modules from calling these methods:

```javascript
{ caller: "**", target: "slothlet.permissions.control.**", effect: "deny" }
```

To allow a trusted module to toggle permissions, add a more specific allow rule:

```javascript
{ caller: "admin.**", target: "slothlet.permissions.control.**", effect: "allow" }
```

| Method                      | Description                                                                                                                                                                                                                                                                                                                              |
| --------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `control.enable()`          | Enable permission enforcement globally.                                                                                                                                                                                                                                                                                                  |
| `control.disable()`         | Disable permission enforcement globally (all calls allowed).                                                                                                                                                                                                                                                                             |
| `control.enabled`           | Accessor — current global enforcement state (`boolean`).                                                                                                                                                                                                                                                                                 |
| `control.readGating(value)` | Enable (`true`) or disable (`false`) [read-level gating](#read-level-gating) at runtime. Throws `INVALID_ARGUMENT` for a non-boolean.                                                                                                                                                                                                    |
| `control.readGatingEnabled` | Accessor — current read-gating state (`boolean`).                                                                                                                                                                                                                                                                                        |
| `control.seal()`            | One-way lock (v3.12.0+). Freezes the policy: after sealing, `enable`, `disable`, `addRule`, `removeRule`, `readGating`, and `principal.register` / `principal.unregister` throw `PERMISSION_SEALED`. Idempotent; there is no unseal. Enforcement keeps running, `principal.invalidate` keeps working, and `shutdown()` is never blocked. |
| `control.sealed`            | Accessor — whether the control surface has been sealed (`boolean`).                                                                                                                                                                                                                                                                      |

**Sealing the policy.** `control.seal()` locks the permission policy so it cannot be mutated again for the life of the instance — useful once a host has finished wiring rules and wants to guarantee no later code (including a rule-managing leaf) can widen access. Only the host or an explicitly-allowed module can call it, since `control.**` is deny-by-default for modules. The seal is preserved across `reload()`. [`restart()`](RELOAD.md#apislothletrestart) is different: it rebuilds the instance from its original config, so the new instance has only the config's rules and is **not sealed** — seal it again afterwards if needed. The seal never blocks `shutdown()`, so teardown always works, and it does not change enforcement — sealed or not, rules evaluate the same.

### `restart` — Host-Only by Default

[`api.slothlet.restart()`](RELOAD.md#apislothletrestart) rebuilds the instance from its original config and discards every runtime rule, event rule, principal and the seal. A module that could call it could undo the host's runtime policy, so a built-in rule denies it to every module:

```javascript
// Built-in rule registered for every instance:
{ caller: "**", target: "slothlet.restart", effect: "deny" }
```

Like every built-in rule, it is enforced only when the instance has a `permissions` config. With no `permissions` block the permission system is off entirely, so modules can call `restart()`; configure `permissions` (even just `{ defaultPolicy: "allow" }`) to make it host-only. The host is never gated. To let a trusted module restart the instance, add an instance rule on the same exact target — equal specificity, higher layer, so it outranks the built-in (this holds under both `defaultPolicy: "allow"` and `"deny"`):

```javascript
{ caller: "admin.**", target: "slothlet.restart", effect: "allow" }
```

### Lifecycle methods and default routines — Host-Only

Reloading or shutting the instance down is a host decision, so built-in rules deny it to modules.

**Framework methods — always.** `slothlet.reload` and `slothlet.shutdown` are fixed methods on the `slothlet.*` namespace, whatever the `routines` config says:

```javascript
// Built-in rules registered for every instance:
{ caller: "**", target: "slothlet.reload",   effect: "deny" }
{ caller: "**", target: "slothlet.shutdown", effect: "deny" }
```

**Default routines — only while they are configured.** The root path of each [default routine](LIFECYCLE.md#routines) (`slothlet.defaults.routines`: `initialize` with mode `startup`, `shutdown` with mode `shutdown`) is host-only **while that default is present in the instance's effective `routines` config**, matched on name and mode:

```javascript
// Built-in rules, added per instance only for the defaults its routines config contains:
{ caller: "**", target: "initialize", effect: "deny" } // root api.initialize() cascade
{ caller: "**", target: "shutdown",   effect: "deny" } // root api.shutdown()
```

A renamed routine, a default's name with a different mode, a replaced list or `routines: []` leaves those root paths as **plain routines**: no built-in rule, governed only by the ordinary rules the host configures on their paths (`shutdown`, `destroy`, `initialize`, or a custom routine's name). `destroy` is not a default routine, so the root `api.destroy()` never gets a built-in rule. The decision is made per instance when its config is loaded — a `reload()` applies it to the same config, a `restart()` to the original one.

> **Caveat — removing the default routines does not disarm the root teardown.** Even with the default `shutdown` routine removed (for example `routines: []`), the top-level `api.shutdown()` / `api.destroy()` are still wired to slothlet's internal teardown: they run any root `shutdown` hook and then shut the instance down (and `destroy()` then clears it). A module that can reach them can therefore tear the instance down. A host that removes the default routines and wants that protection adds its own rules:
>
> ```javascript
> { caller: "**", target: "shutdown", effect: "deny" }
> { caller: "**", target: "destroy",  effect: "deny" }
> ```

The root entry points (`api.shutdown()`, `api.destroy()`, a routine's root cascade) are checked **at entry only**. Framework-internal teardown is never gated: `destroy()`'s own shutdown, the routines and hooks the dispose path runs, and a restart's teardown all run as the host, so a module that is allowed to trigger them is not refused halfway.

As with every built-in, these rules apply only when the instance has a `permissions` config — with no `permissions` block the permission system is off and modules can call all of these. The host is never gated. To grant one to a trusted module, add an instance rule on the same exact target; it outranks the built-in under both `defaultPolicy: "allow"` and `"deny"`:

```javascript
{ caller: "admin.**", target: "slothlet.reload", effect: "allow" }
{ caller: "admin.**", target: "shutdown",        effect: "allow" }
```

### Other `slothlet.*` Routes Are Gated Too

The entire `slothlet` namespace is wrapped by an internal route proxy, so every `slothlet.*` member a module calls through `self` is a permission-gated route — including the caller-identity utilities `slothlet.lockCaller` and `slothlet.bind` (see [Caller Identity in Callbacks](HOOKS.md#caller-identity-in-callbacks)).

`slothlet.lockCaller` and `slothlet.bind` are **allowed by default** via built-in rules — they grant no security-sensitive access, they only pin a callback's caller identity, which _strengthens_ enforcement. So even a `defaultPolicy: "deny"` configuration can use them without an explicit allow rule:

```javascript
// Built-in rules registered for every instance:
{ caller: "**", target: "slothlet.lockCaller", effect: "allow" }
{ caller: "**", target: "slothlet.bind",       effect: "allow" }
```

A more specific user rule can still deny them for a particular module if needed. The whole point of `lockCaller` is downstream of this: the callback it returns runs with the caller identity set to the **registering** module, so permission rules keyed to that module match instead of failing against whatever module's async context happened to be ambient when the callback fired.

`slothlet.lockCaller.caller` is the exception: it is **denied by default**. It pins the current leaf's _caller_ onto a callback, so the callback acts as another module (or, when the leaf was called from the host, as the host) — a privilege, not a strengthening. The built-in allow on `slothlet.lockCaller` is an exact-path rule and does not cover it. The host grants it to the service modules that run callbacks on their callers' behalf; this holds under both `defaultPolicy: "allow"` and `"deny"`:

```javascript
// Built-in rule registered for every instance:
{ caller: "**", target: "slothlet.lockCaller.caller", effect: "deny" }

// Host grant — let the scheduler run jobs as the modules that scheduled them:
{ caller: "scheduler.**", target: "slothlet.lockCaller.caller", effect: "allow" }
```

A module without the grant gets `PERMISSION_DENIED`. See [`lockCaller.caller`](HOOKS.md#selfslothletlockcallercallerfn--pin-the-leafs-caller).

`slothlet.metadata.caller` and `slothlet.metadata.self` are **allowed by default** for the same reason. They reveal identity only — which module is calling this one, and which module this is — and grant no data or control access; they are what a module needs to [authorize or scope by its caller](./METADATA.md#selfslothletmetadatacaller) under a `defaultPolicy: "deny"` configuration:

```javascript
// Built-in rules registered for every instance:
{ caller: "**", target: "slothlet.metadata.caller", effect: "allow" }
{ caller: "**", target: "slothlet.metadata.self",   effect: "allow" }
```

`slothlet.metadata.get(path)` — which reads arbitrary metadata — is **not** covered and stays gated. As with the other built-ins, a user rule of equal or higher specificity overrides them (e.g. `{ caller: "untrusted.**", target: "slothlet.metadata.caller", effect: "deny" }`).

---

## Audit Events

The `PermissionManager` emits lifecycle events for enforcement decisions:

| Event                    | Payload                                                 | When                                    | Emission                |
| ------------------------ | ------------------------------------------------------- | --------------------------------------- | ----------------------- |
| `permission:denied`      | `{ caller, target, rule, conditionMatched, timestamp }` | A call was blocked                      | Always                  |
| `permission:self-bypass` | `{ caller, target, filePath, timestamp }`               | A self-call was detected and bypassed   | Always                  |
| `permission:allowed`     | `{ caller, target, rule, conditionMatched, timestamp }` | A call was explicitly allowed by a rule | `audit: "verbose"` only |
| `permission:default`     | `{ caller, target, policy, timestamp }`                 | No rule matched; default policy applied | `audit: "verbose"` only |
| `permission:owner-allow` | `{ caller, target, moduleID, timestamp }`               | The [owner grant](#owner-grant) allowed | `audit: "verbose"` only |

A decision reached through [`global.checkCall`](#checkcall-vs-checkaccess) emits the same events with an extra `via: "checkCall"` field in the payload, so an audit consumer can tell a query from the gate of a real call.

The `conditionMatched` field in `permission:allowed` and `permission:denied` payloads is `true` when the winning rule had a `condition` field, `false` otherwise.

Subscribe via the lifecycle system:

```javascript
api.slothlet.lifecycle.on("permission:denied", (data) => {
	console.log(`Blocked: ${data.caller} → ${data.target}`);
	console.log(`Rule: ${data.rule.id} (${data.rule.effect})`);
});
```

Debug-level logging is also emitted via `this.debug("permissions", ...)` for each decision, following the same pattern as versioning and hook debug output.

---

## Cache Behavior

The `PermissionManager` maintains two caches:

1. **Compiled pattern cache** — glob patterns compiled to matcher functions (reused across all `checkAccess` calls).
2. **Resolved result cache** — `Map<"${callerPath}::${targetPath}", { allowed, event, payload, hasConditionalRules }>` storing the full decision record (not a bare boolean).

**Conditional rule bypass:** When any candidate rule in an evaluation carries a `condition` or `requires` field, that evaluation's result is never written to the resolved cache (a `requires` verdict depends on principal state, which changes without any rule change). This ensures that the same caller→target pair can produce different outcomes in different request contexts. Only evaluations where every matching rule is unconditional are cached.

The resolved cache is cleared whenever the rule set changes or enforcement is toggled — **not** on a plain module-topology change:

| Event                                                        | Why                                                                                               |
| ------------------------------------------------------------ | ------------------------------------------------------------------------------------------------- |
| `addRule()` / `removeRule()`                                 | Rule set changed                                                                                  |
| `enable()` / `disable()`                                     | All cached results are invalid                                                                    |
| `shutdown()` (and a full reload, which calls it)             | State is torn down / rebuilt                                                                      |
| `api.slothlet.api.add(...)` **carrying `permissions` rules** | Those rules are applied via `addRule`, which clears the cache; a plain add with no rules does not |

A scoped `api.slothlet.api.remove(...)` or single-module `api.slothlet.api.reload(...)` does **not** by itself clear the resolved cache.

---

## Lifecycle — Replay, Reload, Shutdown

### Replay

`addRule` and `removeRule` calls are recorded in `operationHistory`. During a full reload:

1. `PermissionManager.shutdown()` clears all state.
2. Config-level rules from `config.permissions.rules` are re-applied.
3. `operationHistory` replays `addPermissionRule` and `removePermissionRule` entries in order, reconstructing the full rule stack.

Rule IDs are preserved across replays to ensure `removeRule` targets the correct rule.

`principal.register` / `principal.unregister` calls are recorded too. A host registration replays as recorded; a module registration is replayed as a dormant reservation of the name for its owner, because the recorded resolver closes over the pre-reload module — see [Principal lifecycle](#principal-lifecycle).

### Module Reload

A scoped `api.slothlet.api.reload(...)` does not itself clear the resolved cache; if the reloaded module re-declares permission rules, those `addRule` calls clear it as a side effect. A full instance reload clears everything via `shutdown()`.

### Shutdown

`PermissionManager.shutdown()` clears all rules, caches, and resets config to defaults. Called automatically by the slothlet shutdown sequence.

---

## Multi-Instance Isolation

Each slothlet instance creates its own `PermissionManager` with its own rules, caches, and config. Two instances with different permission configurations operate completely independently:

```javascript
// Instance A: deny callers → admin
const apiA = await slothlet({
	dir: "./api",
	permissions: {
		defaultPolicy: "allow",
		rules: [{ caller: "callers.**", target: "admin.**", effect: "deny" }]
	}
});

// Instance B: allow everything
const apiB = await slothlet({
	dir: "./api",
	permissions: { defaultPolicy: "allow", rules: [] }
});

// apiA denies callers → admin
// apiB allows callers → admin
// These do NOT interfere with each other
```

This holds true even when both instances use `runtime: "live"` (synchronous stack-based context). The enforcement code uses explicit instance IDs to look up the correct context store, preventing cross-contamination between instances.

---

## Error Reference

| Code                      | When                                                                                                                                                                                 |
| ------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `PERMISSION_DENIED`       | A call was blocked by a permission rule. Includes `caller` and `target` in the error context.                                                                                        |
| `PERMISSION_SELF_MODIFY`  | A module attempted to remove its own permission rule. Includes `ruleId` and `moduleID`.                                                                                              |
| `INVALID_PERMISSION_RULE` | A malformed rule was passed to `addRule()`. Includes `reason` and `received`.                                                                                                        |
| `PERMISSION_SEALED`       | A policy-mutating control method (`enable` / `disable` / `addRule` / `removeRule` / `readGating` / `principal.register` / `principal.unregister`) was called after `control.seal()`. |
| `PRINCIPAL_NAME_OWNED`    | A module tried to register a principal name another module (or the host) owns. Includes `name`, `owner`, and `claimant`.                                                             |
| `PRINCIPAL_NOT_OWNER`     | A module other than the owner tried to unregister or invalidate a principal. Includes `name`, `operation`, `owner`, and `caller`.                                                    |
| `PRINCIPAL_READ_ONLY`     | Code tried to write to a principal value handed to a condition. Includes `name`.                                                                                                     |

Absent-caller denials surface as `PERMISSION_DENIED` (fail-closed enforcement); the owner-locked / write-protected context-key errors (`CONTEXT_KEY_PROTECTED`, `CONTEXT_KEY_OWNED`, `SCOPE_INVALID_PROTECT`, `SCOPE_INVALID_OWNERS`) are documented under [Owner-Locked & Write-Protected Keys](./CONTEXT-PROPAGATION.md#owner-locked--write-protected-keys).

---

## Full Example

```javascript
import slothlet from "@cldmv/slothlet";

const api = await slothlet({
	dir: "./api",
	permissions: {
		defaultPolicy: "deny",
		audit: "verbose",
		rules: [
			// Admin modules can do everything
			{ caller: "admin.**", target: "**", effect: "allow" },
			// All modules can read from the database
			{ caller: "**", target: "db.read.**", effect: "allow" },
			// Payments can write to the database
			{ caller: "payments.**", target: "db.write.**", effect: "allow" },
			// Block untrusted plugins from everything except cache reads
			{ caller: "untrusted.**", target: "**", effect: "deny" },
			{ caller: "untrusted.**", target: "cache.store.get", effect: "allow" }
		]
	}
});

// Listen for denied calls
api.slothlet.lifecycle.on("permission:denied", (data) => {
	console.warn(`DENIED: ${data.caller} → ${data.target}`);
});

// Add a rule at runtime
const ruleId = api.slothlet.permissions.addRule({
	caller: "plugins.**",
	target: "db.write.**",
	effect: "deny"
});

// Check own access (inside an API module, via self)
const canWrite = api.slothlet.permissions.self.access("db.write.insert");

// Inspect the permission graph
const rules = api.slothlet.permissions.global.rulesForPath("db.write.insert");
console.log(rules); // All rules matching this target path
```
