# Permission System

The Permission System provides path-based access control for inter-module API calls. Rules use glob pattern matching (same syntax as hooks) to declare which callers may invoke which targets. Enforcement happens in the unified wrapper's `applyTrap` — before hooks or function execution — so denied calls produce zero side effects.

## Overview

When permissions are enabled, every inter-module call (`self.payments.charge.process(100)`) triggers a permission check. The `PermissionManager` collects all matching rules, determines the most specific one, and either allows or denies. If no rule matches, the configurable **default policy** applies.

> **Note:** The permission system is **off by default**. It only activates when you provide a `permissions` configuration block. Existing users who do not configure permissions pay zero runtime cost.

**Key characteristics:**

- Same glob pattern syntax as hooks (`*`, `**`, `?`, `{a,b}`, `!negation`)
- Enforcement before hooks — denied calls never trigger `before:` hooks
- Self-calls (same source file) always bypass the permission system
- Most-specific-wins evaluation with registration-order tiebreak
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
- [Declaring Permissions](#declaring-permissions)
- [Evaluation Order](#evaluation-order)
- [Self-Call Bypass](#self-call-bypass)
- [Read-Level Gating](#read-level-gating)
- [Hook Permission Gating](#hook-permission-gating)
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

**Under the live runtime the second of those guarantees is unavailable.** `AsyncLocalStorage` is what makes caller identity intrinsic: the store follows the flow across every `await`, timer, and callback because the engine carries it. The live runtime exists for hosts that have no `async_hooks` at all, so it keeps identity in a single field that unwinds when a call returns, and carries it across deferred work by **patching the boundaries** instead — `EventEmitter` registration, `setTimeout` / `setInterval` / `setImmediate` / `queueMicrotask` / `process.nextTick`, and `EventTarget.addEventListener`. Each captures the registering module at registration, which is the only moment the information exists.

Patching covers the boundaries a module reaches through the globals it was given, which is what ordinary code does. It does not — and cannot — cover every boundary. `Promise.prototype.then` used fire-and-forget, any Node API that takes a completion callback (`fs.readFile` and friends), a scheduler reached through a second realm (`iframe.contentWindow.setTimeout`), a listener written straight into an emitter's internal handler list instead of registered through `on()`, and `import { setTimeout } from "node:timers"` are all outside it. That last one is worth naming because it looks patchable and is not: the builtin's ESM named exports are a snapshot taken when the module is first linked, so replacing the property afterwards has no effect on anything that imported it that way — and a library cannot arrange to load first.

Which of these each runtime actually needs differs, and it is worth being precise about:

| Boundary                                                                                                | async runtime                                                                             | live runtime                                       |
| ------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------- | -------------------------------------------------- |
| `EventEmitter` registration                                                                             | needed — restores the store so a listener can use `self`                                  | needed — carries the registering module's identity |
| Timers / microtasks (`setTimeout`, `setInterval`, `setImmediate`, `queueMicrotask`, `process.nextTick`) | not needed — AsyncLocalStorage already spans them                                         | needed                                             |
| `EventTarget.addEventListener`                                                                          | needed — this boundary drops the store entirely, so `self` was unusable inside a listener | needed                                             |

The patches are installed when the first instance is created and removed only once the **last** one shuts down. They replace process-global functions, so removal is global too: taking them away while another instance is still running would leave that instance's deferred work unattributed, and an unattributed caller cannot reach `self` at all — turning reads the rules permit into refusals.

**What happens at an unpatched boundary is a refusal, not an escalation.** `self` resolves only while a module is executing (see below), so deferred work that lost its identity gets no `self` at all — it throws `RUNTIME_NO_ACTIVE_CONTEXT_SELF` rather than quietly running with the host's authority. That is what keeps an unenumerable surface fail-closed, and it is why the patches above should be read as **keeping ordinary deferred code working and correctly attributed**, not as the boundary itself. The boundary is the pair of rules that do not depend on enumerating anything: `self` requires an executing module, and a reference read out of the api remembers who read it.

One route does not read `self` at call time and so is not covered by that guard: a module captures an api function while it holds it (`const fn = self.db.write.erase`) and invokes the captured reference later. It is handled a step earlier instead. **A reference read out of the api carries the identity of whoever read it**, recorded at the read — the last moment that identity is known — so the reference enforces as its capturer wherever and whenever it is called, through any boundary, patched or not.

That identity is a floor, not a substitute for the live caller: both are checked. Handing a captured reference to a module with fewer rights does not lend it anything, because the recipient is still enforced on its own account. Nothing changes for a module using its own reference, or for the host reading through the bound `api` object — with no module executing there is nothing to record, so host access is untouched.

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
5. **Tiebreak**: Among rules at the same specificity, the **last-registered** rule wins. Registration order follows stacking: config rules → `api.add` rules → `addRule` calls.
6. **No match → default policy**: If no rules match, fall back to `config.permissions.defaultPolicy`.

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

Hook rule targets use the `pattern:type` **suffix** form: the trailing `:type` names the hook phase, and `:hook` matches any hook type on a path.

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

## API Surface — api.slothlet.permissions

The permissions namespace is organized into four groups:

### Top-Level — Mutation Operations

| Method               | Description                                                                              |
| -------------------- | ---------------------------------------------------------------------------------------- |
| `addRule(rule)`      | Add a permission rule. Returns the rule ID. Gated by `config.api.mutations.permissions`. |
| `removeRule(ruleId)` | Remove a rule by ID. Self-modification blocked (throws `PERMISSION_SELF_MODIFY`).        |

### `self.*` — Always Available

Scoped to the calling module via its context. A module can always introspect its own permissions.

| Method                | Description                                                                  |
| --------------------- | ---------------------------------------------------------------------------- |
| `self.access(target)` | Check if the calling module is allowed to reach `target`. Returns `boolean`. |
| `self.rules()`        | List all rules where the caller pattern matches the calling module's path.   |

### `global.*` — Gatable Diagnostics

Cross-module inspection. Can be independently denied with a single rule on `slothlet.permissions.global.**`.

| Method                               | Description                                                                          |
| ------------------------------------ | ------------------------------------------------------------------------------------ |
| `global.checkAccess(caller, target)` | Check if an arbitrary `caller` path is allowed to reach `target`. Returns `boolean`. |
| `global.rulesForPath(path)`          | List all rules matching a given target path.                                         |
| `global.rulesByModule(moduleID)`     | List all rules owned by a given module.                                              |

### `control.*` — Global Toggles (Deny-by-Default)

Controls the global enforcement state. A built-in rule automatically denies all modules from calling these methods:

```javascript
{ caller: "**", target: "slothlet.permissions.control.**", effect: "deny" }
```

To allow a trusted module to toggle permissions, add a more specific allow rule:

```javascript
{ caller: "admin.**", target: "slothlet.permissions.control.**", effect: "allow" }
```

| Method                      | Description                                                                                                                                                                                                                                        |
| --------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `control.enable()`          | Enable permission enforcement globally.                                                                                                                                                                                                            |
| `control.disable()`         | Disable permission enforcement globally (all calls allowed).                                                                                                                                                                                       |
| `control.enabled`           | Accessor — current global enforcement state (`boolean`).                                                                                                                                                                                           |
| `control.readGating(value)` | Enable (`true`) or disable (`false`) [read-level gating](#read-level-gating) at runtime. Throws `INVALID_ARGUMENT` for a non-boolean.                                                                                                              |
| `control.readGatingEnabled` | Accessor — current read-gating state (`boolean`).                                                                                                                                                                                                  |
| `control.seal()`            | One-way lock (v3.12.0+). Freezes the policy: after sealing, `enable`, `disable`, `addRule`, `removeRule`, and `readGating` throw `PERMISSION_SEALED`. Idempotent; there is no unseal. Enforcement keeps running and `shutdown()` is never blocked. |
| `control.sealed`            | Accessor — whether the control surface has been sealed (`boolean`).                                                                                                                                                                                |

**Sealing the policy.** `control.seal()` locks the permission policy so it cannot be mutated again for the life of the instance — useful once a host has finished wiring rules and wants to guarantee no later code (including a rule-managing leaf) can widen access. Only the host or an explicitly-allowed module can call it, since `control.**` is deny-by-default for modules. The seal is preserved across `reload()`. It never blocks `shutdown()`, so teardown always works, and it does not change enforcement — sealed or not, rules evaluate the same.

### Other `slothlet.*` Routes Are Gated Too

The entire `slothlet` namespace is wrapped by an internal route proxy, so every `slothlet.*` member a module calls through `self` is a permission-gated route — including the caller-identity utilities `slothlet.lockCaller` and `slothlet.bind` (see [Caller Identity in Callbacks](HOOKS.md#caller-identity-in-callbacks)).

`slothlet.lockCaller` and `slothlet.bind` are **allowed by default** via built-in rules — they grant no security-sensitive access, they only pin a callback's caller identity, which _strengthens_ enforcement. So even a `defaultPolicy: "deny"` configuration can use them without an explicit allow rule:

```javascript
// Built-in rules registered for every instance:
{ caller: "**", target: "slothlet.lockCaller", effect: "allow" }
{ caller: "**", target: "slothlet.bind",       effect: "allow" }
```

A more specific user rule can still deny them for a particular module if needed. The whole point of `lockCaller` is downstream of this: the callback it returns runs with the caller identity set to the **registering** module, so permission rules keyed to that module match instead of failing against whatever module's async context happened to be ambient when the callback fired.

---

## Audit Events

The `PermissionManager` emits lifecycle events for enforcement decisions:

| Event                    | Payload                                                 | When                                    | Emission                |
| ------------------------ | ------------------------------------------------------- | --------------------------------------- | ----------------------- |
| `permission:denied`      | `{ caller, target, rule, conditionMatched, timestamp }` | A call was blocked                      | Always                  |
| `permission:self-bypass` | `{ caller, target, filePath, timestamp }`               | A self-call was detected and bypassed   | Always                  |
| `permission:allowed`     | `{ caller, target, rule, conditionMatched, timestamp }` | A call was explicitly allowed by a rule | `audit: "verbose"` only |
| `permission:default`     | `{ caller, target, policy, timestamp }`                 | No rule matched; default policy applied | `audit: "verbose"` only |

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
2. **Resolved result cache** — `Map<"${callerPath}::${targetPath}", boolean>` storing the final allow/deny result.

**Conditional rule bypass:** When any candidate rule in an evaluation carries a `condition` field, that evaluation's result is never written to the resolved cache. This ensures that the same caller→target pair can produce different outcomes in different request contexts. Only evaluations where every matching rule is unconditional are cached.

The resolved cache is **fully cleared** whenever the rule set or module topology changes:

| Event                          | Why                                             |
| ------------------------------ | ----------------------------------------------- |
| `addRule()` / `removeRule()`   | Rule set changed                                |
| `api.slothlet.api.add(...)`    | New module may match existing rules             |
| `api.slothlet.api.remove(...)` | Cached pairs involving removed module are stale |
| `api.slothlet.api.reload(...)` | Permissions or metadata may have changed        |
| `enable()` / `disable()`       | All cached results are invalid                  |

---

## Lifecycle — Replay, Reload, Shutdown

### Replay

`addRule` and `removeRule` calls are recorded in `operationHistory`. During a full reload:

1. `PermissionManager.shutdown()` clears all state.
2. Config-level rules from `config.permissions.rules` are re-applied.
3. `operationHistory` replays `addPermissionRule` and `removePermissionRule` entries in order, reconstructing the full rule stack.

Rule IDs are preserved across replays to ensure `removeRule` targets the correct rule.

### Module Reload

When a module is reloaded via `api.slothlet.api.reload(...)`, the resolved cache is cleared (the reloaded module may now match different rules).

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

| Code                      | When                                                                                                                                 |
| ------------------------- | ------------------------------------------------------------------------------------------------------------------------------------ |
| `PERMISSION_DENIED`       | A call was blocked by a permission rule. Includes `caller` and `target` in the error context.                                        |
| `PERMISSION_SELF_MODIFY`  | A module attempted to remove its own permission rule. Includes `ruleId` and `moduleID`.                                              |
| `INVALID_PERMISSION_RULE` | A malformed rule was passed to `addRule()`. Includes `reason` and `received`.                                                        |
| `PERMISSION_SEALED`       | A policy-mutating control method (`enable` / `disable` / `addRule` / `removeRule` / `readGating`) was called after `control.seal()`. |

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
