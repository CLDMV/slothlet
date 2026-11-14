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
- [Write Permissions](#write-permissions)
- [Event Rules](#event-rules) → [Full Reference](./EVENTS.md)
- [API Surface — api.slothlet.permissions](#api-surface--apislothletpermissions)
- [Audit Events](#audit-events)
- [Cache Behavior](#cache-behavior)
- [Lifecycle — Replay, Reload, Shutdown](#lifecycle--replay-reload-shutdown)
- [Multi-Instance Isolation](#multi-instance-isolation)
- [Error Reference](#error-reference)
- [Full Example](#full-example)

---

## Modes

The permission system runs in one of three modes:

| Mode                  | How                                                                                    | What applies                                                                                                                                                                                                                                                                                                                                                             |
| --------------------- | -------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `"on"`                | a `permissions` config (`mode: "on"`, or `enabled` not `false`), or `control.enable()` | Every rule: calls, reads, writes, events, and ownership.                                                                                                                                                                                                                                                                                                                 |
| `"off"` (the default) | no `permissions` config, `mode: "off"`, `enabled: false`, or `control.disable()`       | No call or read rule is evaluated (except those on `slothlet.permissions.control.**` and `.principal.**`) and no write is refused on ownership, but the built-in write rules, and host rules on what they cover, still keep module code from changing the framework's own namespace, root functions, or keys on api nodes (see [Write Permissions](#write-permissions)). |
| `"disabled"`          | `mode: "disabled"` in the config only                                                  | Nothing but the reserved names `slothlet`, `shutdown` and `destroy` on `self`. A module may change the framework's own namespace, and call `control.*` and `principal.*` too, so it can turn the system on or off itself.                                                                                                                                                |

[Event rules](#event-rules) are evaluated under `"on"` only: under `"off"` and `"disabled"` every event subscription is delivered at `allow`.

`api.slothlet.permissions.control.mode` reports the mode. From `"disabled"`, `control.enable()` and `control.disable()` move to `"on"` and `"off"`.

## Configuration

Configure permissions when creating a slothlet instance:

```javascript
const api = await slothlet({
	dir: "./api",
	permissions: {
		defaultPolicy: "deny", // "allow" (default) or "deny"
		mode: "on", // "on" (default with a permissions config), "off", or "disabled"
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

| Option                   | Type                  | Default     | Description                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                             |
| ------------------------ | --------------------- | ----------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `defaultPolicy`          | `string`              | `"allow"`   | Fallback when no rule matches: `"allow"` or `"deny"`                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                    |
| `mode`                   | `string`              | `"on"`      | `"on"`: every rule applies. `"off"`: no rule is evaluated and no write is refused on ownership, but the built-in write rules still keep module code off the framework's own namespace, root functions, and keys on api nodes; with no `permissions` config the system is off. `"disabled"`: nothing is checked at all. See [Modes](#modes). Takes precedence over `enabled`.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                            |
| `enabled`                | `boolean`             | `true`      | `true` for `mode: "on"`, `false` for `mode: "off"`.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                     |
| `audit`                  | `string`              | `"default"` | Audit level: `"default"` (denied + self-bypass only) or `"verbose"` (all decisions)                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                     |
| `readGating`             | `boolean`             | `true`      | When `true` (the default), reading a terminal data value (primitive, `Buffer`, `TypedArray`, `Date`, `Map`, etc.) off a module API path is permission-checked the same way calls are. Set `false` to gate calls only. See [Read-Level Gating](#read-level-gating).                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                      |
| `failOpenOnAbsentCaller` | `boolean`             | `false`     | When `false` (the default), a call or read made with **no resolvable caller identity** is denied — fail closed. Set `true` to restore the pre-3.12.0 fail-open behavior for such calls. See [Caller Identity & Fail-Closed Enforcement](#caller-identity--fail-closed-enforcement).                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                     |
| `references.capture`     | `boolean`             | `true`      | When `true` (the default), a function read out of the api carries the identity of the module that read it, so it stays enforced as that module wherever it is later invoked. Costs a per-reader object per wrapper read — see the measured overhead below. Set `false` to restore the older behavior, where a reference invoked with no active caller was treated as host-initiated. See [Captured references remember who captured them](#captured-references-remember-who-captured-them).                                                                                                                                                                                                                                                                                                                                                                                                                                             |
| `owner`                  | `boolean`             | `false`     | When `true`, a module may access every leaf it currently owns — across its own subdirectories — wherever `defaultPolicy` would otherwise deny. An explicit deny rule still wins. See [Owner Grant](#owner-grant).                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                       |
| `ceiling`                | `string`              | `"leaf"`    | Code a caller hands to a leaf runs as the caller, with the leaf it is running inside as its ceiling. With `"chain"`, the ceiling also keeps every leaf the code was handed through on the way, and all of them are enforced. Code a module runs on its own behalf is never affected. See [Code a caller hands to a leaf runs as the caller](#code-a-caller-hands-to-a-leaf-runs-as-the-caller).                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                         |
| `provenance`             | `boolean`             | `true`      | When `true` (the default), code is told apart by the file it was written in: a module's own function running inside another module's call — passed through a callback, a shared object, a global, or a built-in it replaced — runs as that module, with the call it runs inside as its ceiling, so both have to be allowed. `false` turns this off, and such a function runs with the permissions of whichever call runs it. What a module returns through slothlet is not such a route: with `false`, a returned value is searched for code when it is handed out instead (under `attribution: "precise"`), so code nested in returned data still runs as the module that made it. Under `attribution: "fast"` nothing is handed out wrapped, so `false` there leaves no author check at all: every function runs as whoever runs it. See [Code passed by routes slothlet does not see](#code-passed-by-routes-slothlet-does-not-see). |
| `attribution`            | `string`              | `"precise"` | How the definer of code a module hands out is known. `"precise"` wraps a returned value that is itself code (a function, class, class instance, generator, promise, Proxy export) to record its definer, so it is known where the stack cannot tell it, at the cost of `===` for returned functions and about 1 µs per call of one. `"fast"` wraps nothing, keeping `===` and plain calls, and tells every definer from the stack, refusing with `PERMISSION_DENIED` where it cannot. With the permission system not on, nothing is wrapped under either. See [`permissions.attribution`](#permissionsattribution-how-the-definer-is-known).                                                                                                                                                                                                                                                                                            |
| `typedArrayMembers`      | `boolean` or `number` | `false`     | Whether a typed array or `Buffer` one module hands another is checked for members of its own under string keys (`bytes.item = …`). Checking means listing the array's keys, every index among them: about 14 ms for 64 KB and 400 ms for 1 MB, each time the array crosses. `false` (the default) never lists, so such a member rides along with the array; `true` always lists; a whole number lists arrays of up to that many kilobytes and leaves larger ones unchecked. An array found holding a member reaches the other module as a view. See [Values that cross between modules](#values-that-cross-between-modules).                                                                                                                                                                                                                                                                                                            |
| `rules`                  | `array`               | `[]`        | Array of rule objects applied at initialization (earliest stacking order); each is stored by value (see [Rules are stored by value](#rules-are-stored-by-value))                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                        |

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
- A module's own files reach slothlet only through `@cldmv/slothlet` and its runtime (`/runtime`, `/runtime/async`, `/runtime/live`). Every other file of slothlet's (`/helpers/*`, `/processors/*`, `/builders/*`, `/modes/*`, `/errors`, `/i18n`, the internals above), named by its specifier, its URL or its path, imported or required, is refused to them with `MODULE_INTERNAL_NOT_IMPORTABLE`, under Node's loader and through the `slothletInstanceImports()` vite plugin alike. The host's own imports of those files are unchanged. See [MODULE-STRUCTURE.md](MODULE-STRUCTURE.md#what-a-module-imports-from-slothlet).
- Per-request context is isolated with **AsyncLocalStorage**, and enforcement fails closed on an absent/forged caller.

So a dependency loaded into a Node process has no supported path to the raw instance and cannot step around the gate.

**Under the live runtime the second of those guarantees is unavailable.** `AsyncLocalStorage` is what makes caller identity intrinsic: the store follows the flow across every `await`, timer, and callback because the engine carries it. The live runtime exists for hosts that have no `async_hooks` at all, so it keeps identity in a single field that unwinds when a call returns, and carries it across deferred work by **patching the boundaries** instead — `EventEmitter` registration, `setTimeout` / `setInterval` / `setImmediate` / `queueMicrotask` / `process.nextTick` / `requestAnimationFrame` / `requestIdleCallback` / `scheduler.postTask`, promise reactions (`then`, and `catch` / `finally`, which register through it), `EventTarget.addEventListener`, IDL `on*` handler properties (every `on*` accessor of every `EventTarget` interface the global object exposes — `HTMLElement`'s `onclick`, `Document`, `XMLHttpRequest`, `WebSocket`, `Worker`, `MessagePort`, IndexedDB requests and so on — plus the global object's own, such as `window.onload`), and the `MutationObserver` / `ResizeObserver` / `IntersectionObserver` / `PerformanceObserver` / `ReportingObserver` constructors. Each captures the registering module at registration (or construction), which is the only moment the information exists.

A callback is pinned to the context that actually registered it: a module call executing synchronously at registration, or a suspended call whose code is on the stack. A registration the stack attributes to no call is the host's, and so is one it cannot attribute. Such a callback then runs as the host, rather than as whichever call happens to be the only one suspended when it fires; permission checks treat it as host-initiated, as they do any host call. That holds for every instance the callback calls into, not only the one it was registered against, and across the callback's own `await`s: after one, the callback's frames match no suspended call, so it is the host's (rule 3 below). `await` is unaffected by the promise patch — on a native promise it does not go through `then`.

Patching covers the boundaries a module reaches through the globals it was given, which is what ordinary code does. It does not — and cannot — cover every boundary. Any Node API that takes a completion callback (`fs.readFile` and friends), a scheduler reached through a second realm (`iframe.contentWindow.setTimeout`), a listener written straight into an emitter's internal handler list instead of registered through `on()`, a reaction registered through a promise's `then` captured before slothlet loaded, and `import { setTimeout } from "node:timers"` are all outside it. That last one is worth naming because it looks patchable and is not: the builtin's ESM named exports are a snapshot taken when the module is first linked, so replacing the property afterwards has no effect on anything that imported it that way — and a library cannot arrange to load first.

Which of these each runtime actually needs differs, and it is worth being precise about:

| Boundary                                                                                                                                                                      | async runtime                                                                             | live runtime                                                                                           |
| ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------ |
| `EventEmitter` registration                                                                                                                                                   | needed — restores the store so a listener can use `self`                                  | needed — carries the registering module's identity                                                     |
| Timers / microtasks (`setTimeout`, `setInterval`, `setImmediate`, `queueMicrotask`, `process.nextTick`, `requestAnimationFrame`, `requestIdleCallback`, `scheduler.postTask`) | not needed — AsyncLocalStorage already spans them                                         | needed                                                                                                 |
| Promise reactions (`then`, `catch`, `finally`)                                                                                                                                | not needed — AsyncLocalStorage already spans them                                         | needed                                                                                                 |
| `EventTarget.addEventListener`                                                                                                                                                | needed — this boundary drops the store entirely, so `self` was unusable inside a listener | needed                                                                                                 |
| IDL `on*` handler properties (every `EventTarget` interface's, and the global object's)                                                                                       | not needed — AsyncLocalStorage already spans them                                         | needed                                                                                                 |
| Observer constructors (`MutationObserver`, `ResizeObserver`, `IntersectionObserver`, `PerformanceObserver`, `ReportingObserver`)                                              | not needed — AsyncLocalStorage already spans them                                         | needed                                                                                                 |
| `AsyncLocalStorage.snapshot()`, `AsyncLocalStorage.bind()`, `AsyncResource` (construction, `runInAsyncScope`, `bind`)                                                         | not needed — they carry the store themselves                                              | needed — what they run is pinned to the load or call that made them (Node only; a browser has neither) |

The patches are installed when the first instance is created and removed only once the **last** one shuts down. They replace process-global functions, so removal is global too: taking them away while another instance is still running would leave that instance's deferred work unattributed, and an unattributed caller cannot reach `self` at all — turning reads the rules permit into refusals. Two copies of slothlet in one realm (two installs of the package) each patch the same globals, one over the other, and may unpatch in either order: a copy whose wrapper is still under another's when it unpatches leaves it in place as a pass-through, and the last restore puts back the original from under every such wrapper.

**What happens at an unpatched boundary is a refusal, not an escalation.** `self` resolves only while a module is executing (see below), so deferred work that lost its identity gets no `self` at all — it throws `RUNTIME_NO_ACTIVE_CONTEXT_SELF` rather than quietly running with the host's authority. That is what keeps an unenumerable surface fail-closed, and it is why the patches above should be read as **keeping ordinary deferred code working and correctly attributed**, not as the boundary itself. The boundary is the pair of rules that do not depend on enumerating anything: `self` requires an executing module, and a reference read out of the api remembers who read it.

One route does not read `self` at call time and so is not covered by that guard: a module captures an api function while it holds it (`const fn = self.db.write.erase`) and invokes the captured reference later. It is handled a step earlier instead. **A reference read out of the api carries the identity of whoever read it**, recorded at the read — the last moment that identity is known — so the reference enforces as its capturer wherever and whenever it is called, through any boundary, patched or not.

That identity is a floor, not a substitute for the live caller: both are checked. Handing a captured reference to a module with fewer rights does not lend it anything, because the recipient is still enforced on its own account. Nothing changes for a module using its own reference, or for the host reading through the bound `api` object — with no module executing there is nothing to record, so host access is untouched.

**Overlapping calls.** The live runtime's caller field can name only one call, and it is restored call by call as each settles — in settle order, not entry order — so once module calls overlap it can name a call that is suspended, or one that has already finished. Identity is therefore resolved from what is actually in flight, in this order:

1. **A module entered synchronously is the caller** for as long as its body is on the stack — a nested leaf, or a callback pinned with `self.slothlet.lockCaller()` — however many other calls are suspended. An `await` continuation only resumes on an empty stack, so nothing else can be running underneath it.
2. **With no module call in flight**, the caller is the host (or, inside a `run()` / `scope()` a module opened, that module).
3. **With one or more calls suspended**, the call stack decides. One suspended call is not assumed to be what is running: host code can run meanwhile, after its own `await` or in a callback it registered while nothing was in flight. This applies to the live runtime only (the browser, or `runtime: "live"` in Node); the async runtime knows the caller without reading the stack.

   Each frame is placed by its location:

   - **A suspended call's file** — the file the call entered through, compared by real path as well, so a base reached through a symlink still matches.
   - **Instance code** — every file slothlet loads for an instance, a leaf and each file it imports wherever it lives, carries the instance's import tag (in Node, and through the vite plugin), and the instance's CommonJS copies are known. Slothlet records which files each of the instance's files imports, so such a frame belongs to the suspended calls whose leaves import its file. Instance code that no suspended call imports means a module is running that no suspended call accounts for.
   - **A module's folder** — an untagged frame (in a browser, a file a leaf imports carries no tag) under a module's root folder (`base`, or the folder given to `api.slothlet.api.add()`; the deepest root wins) belongs to that module's suspended calls.

   The code that is running is the job's. When the job is a suspended call resuming — the outermost frame is the function the call entered, in its own file, with nothing below it but the microtask runner — it runs as that call, and so does everything it calls: a handler another module registered with it, or a function another call returned, as the async runtime attributes them. The same holds when the job starts in a function nested in that export, or in a promise callback it made, while that call is the only one of its file waiting: the call picked up again, and another module's function it runs since (`(await self.bag.make())()`) runs as its definer with that call as its caller, under `"precise"` and `"fast"` alike. With several calls of the file waiting and no name to tell them apart, the access is held to all of them (see One of several calls, below). The exception is code the call was handed by a call higher up its chain — a callback, a getter, a `toString` — which runs as the call that supplied it (see [Code a caller hands to a leaf runs as the caller](#code-a-caller-hands-to-a-leaf-runs-as-the-caller)). Any other job (a callback an unpatched boundary started, say) is every frame of the synchronous part placed in one of these ways — the callback and the helpers it called or was handed to — and all of them have to agree on the call: a module calling another module's helper is still itself (the helper's file is imported by both, the module's own frame narrows it), and a module's callback run by another module's function is refused. Instance code that no suspended call imports refuses too, rather than taking another module's identity, unless it is an async function picking up that a suspended call is awaiting (see One of several calls, below). In Node an untagged frame at a file the instance loaded under its tag (a leaf, or a file of its import graph) is another copy of it (a package's or the host's own import of that file), so it counts as code no suspended call accounts for; a file the instance never tags (a file of another package, however the import reaches it, which stays shared on purpose) is placed by its folder. A helper of the module's own package reached through its `#imports` or a self-reference is tagged like a relative import of it, so it is the instance's copy (#715). A TypeScript leaf is matched by the compiled copy it runs from. A resumed call that handed the work to a helper in another file first (`await helper()`, where the helper then runs a handler) is a job of the second kind; wrap such handlers with `lockCaller` to give them their registering module's identity. The `at async` frames beyond the synchronous part are the flows awaiting it; they only narrow a job placed among several calls, or place a job whose own frames are all unplaced.

   Only when no frame on the stack is placed at all does a frame naming a suspended call's entry function place it: a package a leaf re-exports from runs inside that function or in code it awaits, which the stack lists as `at async <name>`. A name is the weakest evidence, since any code can carry it. Host code calling a function of its own that shares a suspended entry's name (`run`, `handle`) with nothing else placed on the stack is therefore attributed to that call and held to its rules — it fails closed, but it is not the host's. The same holds for host code running in a CommonJS file a module's leaves also require: Node loads such a file once, under one path, for the host and the module alike.

   A stack with none of the suspended calls on it is the host's (rule 2). That is only said of a stack read to its end: when the top 50 frames place nothing and the stack goes on past them (Node's own code, a package or the host recursing before it calls an api function), it is read further out, up to 1024 frames, to the code that started the recursion. A module's call that picked up after an `await` and has a package call one of its api nodes from the bottom of a deep recursion is so still that call, and the host recursing in its own code is still the host. When 1024 frames place nothing and the stack still goes on, nothing says whose access it is, and it is refused for everyone, the host included. The deeper read is only made in that case; on the machine it was measured on, a host api call from 60, 200, 600 and 1000 frames of the host's own recursion while a module's call was suspended took about 1.6, 2.9, 6.5 and 10.6 ms where the 50-frame read took about 0.8 ms (five identity reads per call, each reading the stack again).

   **Cost.** While any live-runtime call is suspended, every identity read made with nothing entered synchronously reads the stack: each host api call, each `self.*` call a resumed module makes, and each promise reaction registered anywhere in the process (`then` is patched for the live runtime so a fire-and-forget reaction keeps its registering module). On V8 the frames are read as structured call sites. The read takes the top 25 frames, and the top 50 only when those were cut short without settling the answer (and up to 1024 when those 50 place nothing and the stack goes on, see below); it costs from a few to tens of microseconds, depending on stack depth and the machine. What it matches against — the files each instance loaded, its import graph — is built once and rebuilt only when the instance loads more, so the cost does not grow with the number of leaves. Nothing pays it while no call is suspended, inside a call's synchronous part, or on the async runtime.

When the running code belongs to several suspended api paths and no frame tells them apart — they resume in a file both import, and none of their own entry files is on the stack — identity is **unresolved** and the access is refused rather than guessed. The same holds when the stack cannot tell whether the running code is one of the suspended calls at all. An access made under an unresolved caller is refused with `PERMISSION_DENIED`: in every mode, whatever the code's definer may do, and whatever reference it goes through — a `self.*` read, a node read before the `await`, a node the host handed in, or a function or class instance another module handed out (it is not run on its definer's rights alone). It is never checked as the definer alone, never as one of the calls it could be, and never as the host, also when a lazy node it reaches loads after the other calls have settled. Only code that no suspended call accounts for is read by its frames, as code the host runs outside any call is, and refused too when they name no definer.

**One of several calls.** In two situations the stack names a set of suspended calls rather than one. The access is then allowed only when every call of the set allows it: it is checked against each of them and refused when any one refuses, so the code is never given more than the call really running may do.

- **Several calls of one file are waiting and the job picks up in an unnamed function of that file** — a function nested in an export, with no promise callback of the call's to carry it. The job is one of that file's waiting calls. `export const inNested = () => attempt(async () => (await self.bag.make())())`, picking up while `sup.inExport` is waiting too, is held to `sup.inNested` and to `sup.inExport`.
- **Another module's async function picks up after an `await` inside a waiting call whose file does not import it** — a function another module handed out, or a helper file's function a leaf handed out, that a call ran and is awaiting (`await fn()`). The stack shows that a suspended call is awaiting the function, not which call started it (a promise can be awaited by a call other than the one that made it), so the access is held to every suspended call. A function no suspended call is awaiting stays code no suspended call accounts for.

Whose code is running is told by its frames when the access is checked, as everywhere else: another module's function runs as its definer, and the calls of the set are the callers that all have to allow it. Where every call of the set is allowed, the answer is the one the async runtime gives. Where one of them is denied the access is refused, also when the call really running is an allowed one, which the async runtime, knowing the call, allows. A call of the set that cannot answer for the code (one pinned to the host, or code running as no module) leaves the access refused.

Only the permission check is settled this way. What the code is told about its call is one call's, not necessarily its own: `metadata.caller()` reports the caller of the call of the set that started waiting first. `context` is the store's the calls are waiting on (the calls of a set are all calls of one store: the instance's own, or one `run()` / `scope()` flow), which is the right one for calls made on the same store and, for calls made in interleaved `run()` flows, the context of whichever flow the live runtime's active field names (see the runtime caveat in [CONTEXT-PROPAGATION.md](CONTEXT-PROPAGATION.md)). A callback registered from such code (a `then` reaction, a listener) is not pinned to a call. Telling the call itself is tracked in [#756](https://github.com/CLDMV/slothlet/issues/756).

**A flow no call waits for.** A module's call can start an async function and return without awaiting it or returning its promise. The async runtime carries the call into that function's flow, so the module's rules hold it however long it runs. In the live runtime, once that call has returned nothing says which call started the function. Code of the instance (a leaf's file, a helper file it imports) that picks up after an `await` with no call waiting for it is therefore held to every module of the instance as well as to its definer, unless the host's own code is what awaits it: with nothing denied it runs as before, and where any module would be refused, it is refused. Code the host or a package calls synchronously keeps its caller's answer, and so does a callback Node runs (a timer's, an emitter's): one a module registers is pinned to that module, one the host registers is the host's. One difference from the async runtime follows: the host starting a module's async function without awaiting it in its own code (taken as plain data, or any function under `"fast"`) is refused after the function's first `await` while some module is denied what it does, where the async runtime, knowing the host started it, allows it. Under `"precise"` a function returned as it is is a stand-in whose call the runtime tracks, and it answers as in the async runtime. A browser that lists no awaiting flows gives no such sign, and holds the code to every module. While other calls are waiting, such code stays code no waiting call accounts for (above).

A leaf entered from any of these situations takes as its caller the identity resolved this way at the moment it is entered, so `metadata.caller()` and `lockCaller.caller` report the same caller enforcement admitted the call as — never the shared field, which can name a call that has already finished.

**Several instances.** The active instance is one field shared by every instance and restored the same way, so with two instances in flight it can name the other one. It is resolved like the caller: while code runs synchronously inside a call the field is exact; otherwise the suspended calls of every instance are told apart from the stack. Each instance imports its own copy of a leaf (under a `?slothlet_instance=…` query, in Node and in the browser), so a frame also says which instance it belongs to, even for two instances built from the same folder. CommonJS is the exception: Node loads a CommonJS file once, under one path, so code in a CommonJS file both instances load cannot say which of them is running it, and an access from it while both have calls suspended is refused.

Because this reads locations, it inherits their limits: a file reached only through a dynamic `import()` with a computed specifier is still the instance's, but the vite plugin cannot see which leaf imported it, so outside Node's own loader code running in it is refused; in a browser, a file a leaf imports is told apart only by its module's folder, so a callback in one module's folder can run as another suspended call of the same module; a bundle that merges files, or a `//# sourceURL=` comment that renames a script, changes the locations an engine reports; and a module that imports another module's leaf file itself and hands its entry function to the engine as a thenable's `then` makes that function run exactly as the call resuming would, so an entry that runs a callback it is given would run that module's callback as itself. These are the cooperative-boundary terms described above.

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

### Code a caller hands to a leaf runs as the caller

A leaf that converts, reads or calls a value it was handed runs code the value carries: `String(v)` and a template literal run a `toString`, `+v` runs a `valueOf` or `Symbol.toPrimitive`, `JSON.stringify(v)` runs a `toJSON`, `v.x` runs a getter or a Proxy `get` trap, `key in v` runs a `has` trap, and `fn()` runs a callback. That code belongs to the module that supplied the value, not to the leaf, so an api call it makes is the supplier's. Were it attributed to the leaf, any module could borrow every right of any module it is allowed to call simply by handing it an object with a `toString`.

Both runtimes therefore tell the two apart. A call handed a receiver or an argument that can carry code is marked when it is entered: a function, a Proxy, an object whose prototype is anything but `Object.prototype`, `Array.prototype` or `null`, an accessor property, plain data that can still be changed, or plain data that nests one of these or nests deeper than four levels or wider than a few hundred properties. Only **deeply frozen** plain data — frozen objects and arrays holding only primitives and more frozen plain data — and slothlet's own api nodes leave a call unmarked. The mark is decided once, when the call is entered, so a value its caller could still change afterwards — give it a getter, a `toString` or a prototype, or put a function in it, while the leaf awaits or from code the leaf calls back into — has to mark the call from the start. The mark is decided without running any of the caller's code: only `typeof`, slothlet's own registries, `Object.isFrozen`, and the prototype and own property descriptors of a value already known not to be a Proxy are read. In the browser a Proxy cannot be recognised, so every object marks the call there.

While a marked call runs, an identity read takes the frames on the stack below slothlet's own, up to where slothlet entered the leaf (or, for a leaf resuming after an `await`, up to the microtask runner), places each on the chain of calls that led to the leaf using the location rules described above, and fails closed:

- every frame is placed on the leaf and on no other call of the chain: the leaf's own code is running, and the leaf is the caller;
- a frame is placed on calls further up the chain: the nearest of them supplied the code that is running — wherever that frame sits, so the leaf's own function called from a closure its caller handed it (`run(() => useSecret())`) runs as the caller;
- anything else — evaluated code, code compiled under a location it does not belong to (see below), an innermost frame no call can be placed on (a package, the host, a Node internal calling an api function it was handed; inside a leaf with no file, see below), a helper file the leaf shares with another call of the chain, instance code none of them accounts for — is taken to be the code of the call that made the leaf's.

A leaf the host adds as an object or a function (`api.slothlet.api.add(["host", "records"], { apply(options) { … } })`) has no file of its own. It is its own entity, identified by its path (`host.records.apply`), not by the file its function was written in, and its permissions are the rules for that path. The same object added at another path is another leaf, held to that path's rules. Only a leaf host code adds is such an entity: a node a module assigns (`self.made = { … }`) and a leaf a module mounts with its own `api.slothlet.api.add` have no frame placed on them either, so inside a call handed code or data that can still be changed their code runs as the call that made theirs. While a leaf the host added runs, everything inside its call runs as the leaf except the code its caller handed in:

- code of the calling module, wherever its file is and however it was loaded, runs as the caller: a frame placed on a call up the chain runs as the nearest such call, and a file of the module's that slothlet did not load (one reached through a package scope's `"imports"`, one a package's `import()` loaded for it) or a copy of its file runs as the call that made the leaf's, even when the leaf's own code is running further out;
- evaluated code (`eval`, `new Function`, `vm`, a `//# sourceURL=` comment) runs as the call that made the leaf's;
- everything else runs as the leaf: its body, the host's helpers in any of the host's files, and package code, whoever loaded the package — one only the host loaded, one another module loaded too, or one the calling module imports itself.

A frame is never placed on a leaf other than the one entered. With `ext.b.** → host.records.**` and `host.records.** → store.**` allowed and nothing letting `ext.b` open a partition, `ext.b.work` calling `host.records.apply({ id: "x" })` gets the partition opened as `host.records.apply`, whether the leaf opens it itself, through a helper or through a package, even one `ext.b` imports too; `host.records.run(() => self.store.partition())` is refused as `ext.b.work`, and so is a function of a file of `ext.b`'s outside its folder, a getter, `toString`, Proxy trap or thenable `ext.b` wrote in the argument, or evaluated code it made. A frozen argument gets the same answers. Libraries several modules share are meant to be shared through the runtime `context` (see [CONTEXT-PROPAGATION.md](CONTEXT-PROPAGATION.md)), not imported by each module.

A frame is held to the script its location's code runs in. Every Node release slothlet supports (22.15 and later) reports the SHA-256 of the source each frame's script was compiled from (`CallSite#getScriptHash()`); slothlet records the hash of the source each instance module was loaded from, and of the script a leaf's own function runs in when slothlet enters it. Code compiled under another module's location — `vm.runInThisContext`, `new vm.Script`, `vm.compileFunction` or `Module#_compile` with that module's file name — runs in a script of its own, so it is not that module's code: it is treated like evaluated code. A frame placed only by its plain path — anywhere in a module's folder, or at a CommonJS file a leaf required — has to run the source of the file on disk at that path: slothlet hashes the file once and compares. Code compiled under a file name that does not exist, or under a real file whose source is something else, is therefore placed on nothing. A copy of a leaf's file that a raw `import` loads is a module of its own, which slothlet did not enter, so its frames are placed by who imports it rather than on the leaf.

A leaf's function handed over as a value — the very function slothlet wraps — is checked when it is handed over: the call it is handed to is gated as though the caller had called that leaf through `self` as well, so handing a module its own `useSecret` gets the caller nothing it could not call itself. The same holds for such a function held in plain data the call is handed.

A leaf whose own code runs through a helper it shares with its caller, or hands an api function straight to a package that calls it, is therefore checked as its caller as well as itself while it was handed code. That only ever narrows what it may do.

Code supplied this way runs as its supplier, and the leaf it runs inside is its ceiling: **both have to be allowed**. The target sees the supplier in `metadata.caller()`, and `metadata.self()` inside the supplied code reports the supplier too. The leaf keeps its own rights for its own code, so asking a permitted module to do something on its own account still works, and the supplier gains nothing the leaf could not have done either. The ceiling travels with every identity taken while such code runs: `lockCaller`, `lockCaller.caller`, pinned hooks and event subscriptions, a captured reference, a lazy chain's waiting proxy, and a `run()` / `scope()` the code opens all carry it, so a pin cannot carry the supplier past what the leaf may do. Every decision taken from the identity holds for both: an assignment to `self` and a write to an owner-locked context key are allowed only where the supplier and the leaf both own the member or key; a hook is registered, and fires, only where the supplier and the leaf may both hook; an event subscription is delivered at the stricter of their two levels; a principal's resolver runs with the leaf as its ceiling; unregistering or invalidating a principal, or removing a rule, has to be allowed to both modules; `permissions.self.access()` answers for both and `permissions.self.rules()` lists only the rules both share; and a version discriminator that would route the two differently routes to the default version — which is then gated for both, so a version either of them may not call is refused rather than reached.

A slothlet function a module reads out of `self.slothlet` stays that module's: `event.on`, `hook.on`, `permissions.principal.register`, `scope`, `lockCaller.caller` and the rest run as the module that read them, with whoever calls them later as a ceiling as well. Handing one to another module — bound to its arguments, say — so that module calls it gets the reader nothing: the subscription, hook, principal or scope is still the reader's, under both. Called by the module that read it, it runs exactly as before.

A getter or setter of an object a module exports runs as that module, under whoever reads or writes it — the rule for code a module hands out, below — and reading or writing it is checked as a call through `self` is: the reader has to be allowed to call the api object that holds it. The same holds for an accessor put on an api node later — one defined with `Object.defineProperty`, and one on an object assigned through the api (`self.box.late = { get v() { … } }`), at any depth, or inherited by an object it holds — whether it is read, written, or taken from the node's description and run elsewhere. The getter and setter an api node's description reports are therefore the node's own, which run the module's accessor with the node as `this`; they are not the functions the module defined. A Proxy a module exports runs its traps as that module on every operation, through its api node and slothlet's own checks of it alike. A function under a symbol on an api object (`Symbol.iterator`, say) runs as its module when called. An api node holding a function under a symbol, an accessor its object holds that was never adopted, or a module's own Proxy still marks a call it is handed to, like any other value that can carry code.

The members of an api function that are not api nodes of their own are checked the same way. A class or function a module exports carries code no node stands for: a static method or accessor, its `prototype` and the methods and `constructor` on it, a member the module defined on the function without making it enumerable (a Proxy among them), a static `toString`, `valueOf`, `toJSON` or `Symbol.hasInstance`. Reading one is checked as a call of the node it belongs to, so a module that may not call `self.callee.ops.Client` is refused `self.callee.ops.Client.open`, `self.callee.ops.Client.prototype.method` and `self.callee.ops.fn.prototype.constructor` too, however it reaches them: by dot or bracket, `Reflect.get`, `.call` / `.apply`, a member of a member, a frozen node, or an `await` of the chain before the node loads. An instance's prototype is checked the same way, whichever of `Object.getPrototypeOf`, `Reflect.getPrototypeOf` or `__proto__` reaches it: as a call of its class's node, or of the instance's own node when its class can't be told without running the module's code (a `constructor` getter, a `constructor` of the instance's own, a prototype with none, or a Proxy prototype). Each prototype further up the chain that belongs to a class a node stands for is checked against that class's node, so a module allowed `Sub` but not `Base` is refused `Base.prototype` one level up `Object.getPrototypeOf(sub)` or `Sub.prototype.__proto__`. Such a module is not described those members (`Object.getOwnPropertyDescriptor` reports none), awaiting the node itself gives it the node rather than the function behind it, and an emitter of a class of the module's own reports to it, by `Object.getPrototypeOf` and through `__proto__` alike, an empty object inheriting from the nearest prototype holding none of the module's code, which refuses any change made through it, so a write meant for the class never lands on a prototype other values share. The emitter otherwise works as a value for a module denied it (`Object.keys`, `await`, handing it to another module).

What a reader allowed a prototype of the module's gets — a class's `prototype`, or an instance's or an emitter's prototype by any of those paths — is the same whether it reads it through `self` or holds the node:

| Reader                                                                                                                      | Gets                                                                            |
| --------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------- |
| The host                                                                                                                    | The object itself                                                               |
| The module the prototype belongs to, when no write rule could refuse it a write at the prototype's path or beneath it       | The object itself                                                               |
| A module write rules grant every write at the prototype's path and beneath it, when no write rule could refuse it one there | The object itself                                                               |
| Every module, while the permission system is off                                                                            | The object itself                                                               |
| Any other module allowed the read, the owner and a granted module under a narrower rule beneath the path among them         | A checked view                                                                  |
| A module denied the read                                                                                                    | A refusal (`PERMISSION_DENIED`), or for an emitter the stand-in described above |
| Everyone holding a closed node (frozen, sealed or not extensible) of an emitter or of a class instance                      | The view the node's shell holds, described below                                |

A checked view exists only because something would be refused: a module gets the object itself only when nothing reachable through it would be refused for it. It owns the prototype's path or write rules grant it the whole subtree (`owner.**:write`), no write rule for it could refuse a write at the path or anywhere beneath it (a deny such as `owner.Foo.prototype.hi:write`, or a rule with a condition), and the same holds at the path of each class a node stands for further up the prototype's chain. A grant of the path alone (`owner.Foo.prototype:write`) grants no member beneath it, so it leaves the module the checked view, as a deny beneath a broader grant does; each write through the view is then decided at the path of the member written. The built-in rules on the framework's own keys of api nodes play no part here, since a prototype is no node. The rules are read once per module and path, and again whenever they change. A class exported under two names (`export { Foo, Foo as Alias }`) has one prototype at both paths, so a module gets the object itself only when it would at `owner.Foo.prototype` and at `owner.Alias.prototype` alike; otherwise it gets the checked view, and each write through it is decided at the path it is read at: read as `Foo` at `owner.Foo.prototype`, read as `Alias` at `owner.Alias.prototype`, whichever was read first. The checked view reads and calls as the prototype does, `instanceof` still holds through the class's node and against Node's own classes, and a change through it is refused as a write at the path it was reached at is (`LOOSE_SET_NOT_OWNED`, or `PERMISSION_DENIED` under a deny rule). The view is not the object, so for that module `Object.getPrototypeOf(bus) === Bus.prototype` and `instanceof` against a `Bus` it imported itself answer `false`.

A module holding the object itself, through `self` or in its own binding of the class, may hand it on, at any depth, by any route a value crosses between modules through slothlet: returned (inside an object, a frozen object or a `WeakRef` included), passed as an argument (nested in plain data or a frozen object included), thrown or rejected with on an error, carried by the error an `:error` hook another module registered is handed, or emitted as an event's payload (`self.slothlet.event.emit`) to a listener another module registered, delivered at once, through a host strategy's `defaultDeliver`, or later with `deliver`. A listener of the emitting module's own, and one the host registered, hears the payload as it was emitted. While the permission system is on, whoever it reaches gets it as reading it would give it, at every path it is known at: each path it was read at, and, whether or not anything read it yet, the `prototype` of the class at every name a node exports it as. A module that may not write at one of them gets the checked view, and its writes are decided at a path where it may not write. The host receives a module call's return value, a promise's value included, and gets the object itself there, as it does reading it. Where slothlet cannot yet tell who will hold it (a member of a return value, the target of a returned `WeakRef`), it is handed as a view deciding each write when it is made, which the host and every module read and call as the prototype, and which a module reading it through `self` is handed as reading it would give it, so the host gets that view rather than the object by these routes. With the system off everything passes as it is. A value handed by a route slothlet takes no part in reaches its holder as it is: `globalThis`, and a module both import. A function one module hands another is not one of those routes: it reaches the other module as a view, and what the other module calls it with reaches the first as any value handed between modules does (see [Values that cross between modules](#values-that-cross-between-modules)). What a prototype holds reaches its holder unchecked, a value the host stored there included; the framework's namespace stored there stays protected, since the namespace itself refuses module code's changes however a module came to hold it (see [Write Permissions](#write-permissions)).

Once the host freezes, seals or prevents extensions on an emitter or a node holding a class instance, the node has to report one prototype to everyone holding the node, as JavaScript requires of a closed object. It reports a view standing as the node does: the host, and a module the node itself is handed to (its own module included), read, call and write through that view rather than the object, and each change through it is decided when it is made, as a change through the node is: the host's goes through, and one from a module that may not write the prototype's path is refused. The node can be handed to any module, and the permission system turned on later, so the view stays for every holder: none of them, the host included, gets `Object.getPrototypeOf(inst) === Foo.prototype` on the closed node, though the view reads, calls and tests `instanceof` as the prototype does. Reading the node through `self` still gives the answers in the table, decided by the permission system as it is when the node is read: once the system is turned on after the node was closed, a module not allowed the write is handed a checked view and refused it. For a module denied the read, reading that prototype (`Object.getPrototypeOf`, `instanceof`) is refused.

Slothlet's own checks of a value never use `instanceof`, so a `Symbol.hasInstance` a module gives a global class (`Error`, `WeakRef`, `Promise`) is never run by them. An emitter whose module also exports its class by name is checked the same way: its methods and getters are reached only by a module that may call it. A Proxy an object node holds is a node of its own, and a read through it runs the module's traps, so it is checked as a call of that node, whether the module's own Proxy or the stand-in slothlet hands it out as. A node's `util.inspect` hook never hands a module the function behind the node: read and called by module code, it gives the function's form as `util.inspect` prints it (`[Function: fn]`, `[class Sub extends Base]`) and the node's members, as `console.log` prints them; the host still gets the value itself. Its data members and its `name` and `length` read as before, and `instanceof` against the node still works.

By default the ceiling is the leaf the code is running inside: code handed on from one leaf to the next is held to its supplier and the leaf it currently runs inside. With `permissions.ceiling: "chain"` the ceiling accumulates instead — every leaf the code was handed through, and any ceiling those carried — and all of it is enforced. Code a module runs on its own behalf is never held to a ceiling either way. That choice is about the supplier's own code. Code a third module defined, relayed through such calls, is held to every call that handed it down under either setting (see [Code a module hands out runs as its definer](#code-a-module-hands-out-runs-as-its-definer)).

```javascript
// A hands B code; inside B, that code takes a lockCaller pin, and the pinned code later hands C code that
// calls `vault.forA`, which A and C may call and B may not.
//
// ceiling: "leaf" (default) — inside C the code runs as A under C: allowed (A and C both may).
// ceiling: "chain"         — inside C the code runs as A under B and C: refused (B may not).
const api = await slothlet({
	base: "./api",
	permissions: { defaultPolicy: "deny", ceiling: "chain", rules }
});
```

A call handed only primitives, plain data and api nodes — host calls with plain arguments, and most module calls — is never marked and never reads the stack. A marked call reads it only when an identity is asked for while it runs (a nested `self.*` call or read, a `metadata` lookup, a pin), starting with the top 16 frames and reading deeper only when those were cut short before the leaf's entry.

Limits:

- **A callback the leaf keeps and runs later from another flow** — stored, then fired by a timer, an event or a queue after the call it was handed to has returned — is no longer inside that call, so nothing ties it to its supplier. Pin it with `self.slothlet.lockCaller.caller(fn)` where it is registered, or have the supplier pin it with `self.slothlet.lockCaller(fn)` before handing it over.
- **Placement is by location**, so the supplier's code and the leaf's have to live in files a frame can tell apart. Code bundled into one file with the leaf cannot be told from the leaf's own and runs as the leaf. Evaluated code (`eval`, `new Function`, a `//# sourceURL=` comment) reports whatever location it chooses, so it is never placed on the leaf; it runs as the call that made the leaf's.
- **Script binding needs a script hash.** In the browser, whose stack frames report none, a script compiled with a `filename` is placed like a file. In Node, a CommonJS file is compared with the source slothlet's load hook saw when the file was loaded, hashed as V8 hashes it (the text decoded as UTF-8, without a byte-order mark); a file placed by its folder that was not loaded that way is compared with its source on disk, as text or as bytes, and read again when it changes or appears. A loader that transforms a file outside that hook (vite's module runner), or a transforming hook registered after slothlet's own, makes its frames unattributable, which only makes them fail closed. Code compiled under a caller's location from inside a leaf still runs with the leaf as its ceiling, so placing it there can only take rights away from the leaf.
- **A leaf's function is recognised only as itself.** A bound copy (`useSecret.bind(null)`), or one behind a getter or a Proxy, cannot be recognised without running the caller's code, so handed over that way it runs as the leaf it is handed to. A raw `import` of another module's leaf file is not refused outright; the copy it loads runs as whoever calls it, and handed to the leaf, as its importer.
- **A host function a module was given and passes back in runs as the leaf.** Inside a leaf with no file, the host's code is the leaf's, whoever handed it over: a module the host gave a generic `invoke(obj, name)` that passes `invoke.bind(null, self.store, "partition")` to `host.records.run` gets the partition opened as `host.records.run`. Don't hand modules host functions that call whatever they are given.
- **A package function a module passes in runs as the leaf too.** Inside a leaf with no file, package code is the leaf's, even a package the module imports itself: `ext.b` passing `invoke.bind(null, self.store, "partition")` from a package it imports to `host.records.run` gets the partition opened as `host.records.run`. Code in the module's own files is still told apart and runs as the module.
- **Source a module has a package write into the package's folder and import runs as the leaf.** To slothlet it is a file of the package's, whoever supplied its text, so inside a leaf with no file it is package code.
- **A file the host loads through a package a module imports too is taken for the module's.** Slothlet records the package as the file's importer, and a module loaded that package, so inside a leaf with no file the file's code runs as the call that made the leaf's, and in a call not handed code it is refused. Load host files with the host's own `import`.
- **In the live runtime, a leaf with no file is told only in its synchronous part.** Its code there, and the timers and promise reactions it registers there, run as the leaf. Once it resumes after an `await`, none of its frames can be placed on a call, so its code runs as the call awaiting it (the caller), or as the leaf when no call awaits it. The async runtime carries the leaf's call across every `await`, timer and reaction.
- **Inside a vitest worker**, whose module runner can load a module's packages itself, slothlet does not tell which module loaded a package, so inside a leaf with no file every package's code is code no call accounts for: in a call handed code or data that can still be changed it runs as the call that made the leaf's; in any other call it is refused, unless it reaches in through an api node a call read, which answers for it as that call.
- **`ceiling` is `"leaf"` by default.** Without `"chain"`, code handed on from leaf to leaf is held to its supplier and the leaf it runs inside, not to every leaf it passed through.
- **A function a module stores somewhere another module reads** — a shared registry the other module imports, a global — and that module then calls on its own account runs as the caller: only what passes through slothlet, as a call's result, an api node's member or a value handed in, is told apart.
- **The event envelope's `emitter` and an around hook's `caller` metadata are attribution, not authority**, like `metadata.caller()` below: they name the module the emitting or calling code was placed on.
- **Inside a marked call, `metadata.caller()` and `metadata.self()` are attribution, not authority.** They name the module the running code was placed on, which the leaf can influence as described above. Use them to report or route, never to grant: enforcement checks the ceiling as well, and an access decision a leaf makes itself from `metadata.caller()` does not.
- **A polluted `Object.prototype` or `Array.prototype` runs as whoever triggers it.** A getter or a `toString` installed on a built-in prototype is reached through plain data, which does not mark a call, and is not the code of any value a caller handed over; it runs as the call executing when it is triggered. That includes a hole in a frozen array: reading it reads through `Array.prototype`.
- **In the browser** a frame outside a leaf's own file is placed only by its module's folder, so code of two modules sharing a folder cannot be told apart. Placement can only refuse there, as everywhere: a frame placed on a supplier subjects the access to the supplier's rules in addition to the leaf's, never to fewer.
- **In the live runtime, a promise a module's callback returns has its state read by printing it.** A callback pinned to a module (a timer, a listener, a `lockCaller` function) that returns a promise holds the module's identity until that promise settles, and slothlet follows it without reacting to it, so a rejection the callback left unhandled is still reported as unhandled. To tell whether the promise has already settled, slothlet prints it with Node's inspector, with custom inspectors and getters turned off. Printing a settled promise prints its value, which can run code the value carries: a class's static `name` getter, its `Symbol.hasInstance`, a `Symbol.toStringTag` getter, or an error's `stack`, `message` or `name` getter. That code runs synchronously, at once, as the callback's own module — the module whose code it is — with no rights it did not already have; in plain JavaScript nothing would have run it. A promise whose own state cannot be printed without running code of its own (an accessor or an object or function among its own properties, a Proxy or a getter along its prototype chain) is not printed: it is followed as pending, and released when it settles, when it is garbage-collected (a collected promise can no longer settle, so the call is over), or when its instance shuts down. Until a collection runs, such a promise that had settled already keeps its call counted as suspended, which only makes identity reads read the stack.

### Code a module hands out runs as its definer

A `self.*` call is allowed only when **both** of these are allowed:

- the **definer** of the code making it: the nearest leaf on the stack. Walking out from the `self` call through the frames of the same file, the first one whose code sits inside an export's function names that leaf, so a helper written outside every export, called from a leaf's code, runs as that leaf. Only when no frame of that file is inside any export is the definer the file's module. A frame of another file ends the walk; code the host wrote is the host's. Where each export's function sits is read from the source the engine was given when the file loaded (the compiled code for a TypeScript leaf), at the place the export is declared: `export const a = …`, `export function a`, `export default …`, a list (`export { t as a }`, also a minifier's), `exports.a = …`, `module.exports = { a }`. Two exports with the same text are therefore told apart, source maps change nothing, and neither does a file edited on disk after it loaded. An export built at runtime (a bound function, the result of a factory) has no place in the source, and its code is the file's module's;
- the **caller** running it: the module call it runs inside, or the host when it runs inside none.

Defining a function, storing it, returning it or passing it checks nothing. Where the code goes decides only who its caller is:

- **Code a module hands in** to another module's call — a callback, a getter, an object with code passed as an argument or as `this` — runs as its definer, with the leaf it runs inside as its ceiling (above).
- **Code a module hands out** — a closure it returns, what a factory makes, a class and its instances, an iterator or generator, a Proxy, a getter or a function inside returned data — runs as its definer under whoever runs it. Returning a closure lends nothing: a module that may not reach the vault cannot reach it by running a closure of a module that may.
- **Code handed on runs under every call that handed it down.** A module that may not reach the vault does not reach it by passing such a closure to a leaf that may, either: inside a call that was handed anything able to carry code (a function, an object with methods, a Proxy), another module's code runs under the leaf it runs inside **and** under the call that made that call, and under the call that made that one when it was handed code too, up the chain. This holds whoever defined the code, so handing a closure back to a leaf of the module that made it changes nothing. slothlet cannot tell which function a caller handed in from one the leaf obtained itself, so inside such a call both are held to the caller; a leaf that is handed only data, or that the host calls, runs other modules' code under itself alone.

  ```javascript
  // ext is denied the vault; bag, runner and relay are allowed it
  const made = await self.bag.make(); // () => self.vault.get()
  await self.runner.call(made); // refused: definer bag.make, leaf runner.call, handed in by ext
  await self.relay.pass(made); // refused: relay hands it to runner, and ext handed it to relay
  await self.bag.call(made); // refused: bag's own leaf running bag's closure for ext
  await self.runner.own(); // allowed: runner asks bag for the closure itself and was handed nothing
  ```

  To lend on purpose, a module pins the function with `self.slothlet.lockCaller(fn)`, which runs as the module that pinned it whoever calls it, or exposes a leaf: calling `self.bag.read()` is a call of `bag`'s, checked as one.

- **A call runs with the callee's rights.** Rules are per hop: a module that may call `bag.read` gets what `bag.read` returns, whatever `bag.read` itself had to reach to produce it. That is what a service is, and it holds however the caller came by the leaf's function. A module's **exported function handed out as it is** counts as a call of that function's api node: whoever runs it has to be allowed to call the leaf, and it then runs with the leaf's rights, exactly as `self.bag.read()` does. Under `"precise"` the function comes back as the node itself; under `"fast"`, and for one nested in returned data, it is recognised when it runs, by where its export is declared. A **private** function (one no export names) is the case above: it lends nothing.

  ```javascript
  // bag/bag.mjs (bag may read the vault)
  export const viaLeaf = () => self.vault.get(); // the service's function
  export const leafRef = () => self.bag.viaLeaf; // hands out the node
  export const boundLeaf = () => viaLeaf; // hands out the exported function itself
  export const closure = () => () => self.vault.get(); // hands out a private function

  // sup/sup.mjs                          deny sup.** → vault.**     deny sup.** → bag.viaLeaf
  self.bag.viaLeaf(); //                  "SECRET"                   refused
  (await self.bag.boundLeaf())(); //      "SECRET"                   refused
  (await self.bag.closure())(); //        refused                    "SECRET"
  ```

  With `sup` denied the vault it still gets the service's answer, by any of the first three: it calls the service, and the service reads the vault. Denied the service's function, it does not get it by being handed the function either.

With `bag` allowed `vault.**`, every module allowed `bag.**` and `shared.**`, and nothing else allowed the vault:

```javascript
// bag/bag.mjs
export const make = () => () => self.vault.get(); // a closure: definer bag.make
export const box = () => ({ run: () => self.vault.get() }); // a function inside data: definer bag.box
export const call = (fn) => fn(); // runs what it is handed
export const inst = () =>
	new (class Client {
		run() {
			return self.vault.get();
		}
	})();

// supplier/supplier.mjs
(await self.bag.make())(); // refused: definer bag.make is allowed, caller supplier is not
(await self.bag.box()).run(); // refused, the same
(await self.bag.inst()).run(); // refused, the same
await self.bag.call(() => self.vault.get()); // refused: definer supplier is not allowed
await self.shared.keep(() => self.vault.get()); // allowed: storing a function checks nothing

// reader/reader.mjs
(await self.shared.take())(); // refused: definer supplier, caller reader

// the host
(await api.bag.make())(); // allowed: definer bag.make, caller the host
// bag's own code running a closure bag made, by a local call or fetched through self: allowed
```

Several leaves of one file are told apart by where their source sits: with `mixed.trusted` allowed the vault and `mixed.plain` not, a closure written inside `trusted` reaches it and one written inside `plain` is refused. A helper outside every export runs as the leaf whose code called it: a `then` written inside `syncThen` that calls a file-level `attempt()` is `b.give.syncThen`, and so is the getter and the function a `then` getter written inside `getterThen` returns (`b.give.getterThen`). Code outside every export with no frame of an export of its file below it on the stack (a getter a helper put on an error that slothlet reads later, or the helper itself handed out and run by another module or the host) is the file's module, `mixed`, in eager and lazy mode alike, and needs a rule of its own: one on `mixed` itself, or on `mixed.**`, since `**` matches zero segments too (see [Pattern Syntax](#pattern-syntax)). A rule on `mixed.trusted` does not reach it.

Constructing a class or function a module exports (`new self.supplier.ctor.Named()`) runs its body as that module, and a Proxy a module exports runs its traps as that module however it is touched, slothlet's own checks included, each under whoever touches it. A Proxy that is an api node's own export is a member of that node: its traps run as a call of the node, under either `permissions.attribution`, also when a leaf hands the Proxy itself back. A getter or setter on an api object runs as its module too, and reading or writing it is checked as a call through `self` would be: a module no rule lets call `callee` is refused `self.callee.box.held.value`. A module added with `api.slothlet.api.add()`, or reloaded with `api.slothlet.api.reload()`, from inside another module's call, is built as no module's code. A lazy node's first load runs apart from the call that asked for it, as an eager tree's build runs before any call: its module's top level, and the getters and Proxy traps of its exports that slothlet reads while building it, run as their definer under no caller, never inside that call.

Code a module handed out that the host runs outside any call reads `self` as its definer: `api.bag.make()()` works, checked against `bag.make`'s rules, and the node it calls sees that definer as its caller in `self.slothlet.metadata.caller()`, the identity the check used. Code whose definer the stack cannot tell is refused with `PERMISSION_DENIED` rather than read as anyone (see the limits below). A script of the host's own still has no `self` (`RUNTIME_NO_ACTIVE_CONTEXT_SELF`, see [`self` requires an executing module](#self-requires-an-executing-module)).

#### File-level code has its own permission path

Code written outside every export of a file is not any of the file's leaves. When it runs with no export's frame of its file below it on the stack, it runs as **the file's module path**: the path of the node the file was built into. Two ordinary ways for that to happen are a timer, listener or queue the file starts when it loads, and a helper declared at file level that a leaf returns and the host (or another module) runs later.

A rule has to name that path itself to reach this code. `m` matches it, and so does `m.**`, because `**` matches zero segments. A rule on the leaves (`m.*`, `m.{a,b}`, one rule per leaf) does not: the module path is not folded into its leaves, and an allow rule for one leaf never reaches file-level code. The reverse holds too: a rule on exactly `m` does not reach `m`'s leaves. A deny list that is meant to cover everything a module does should use `m.**`.

```javascript
// api/sync.mjs
import { self } from "@cldmv/slothlet/runtime";

const flush = () => self.vault.get(); // file-level code
setInterval(flush, 1000); // runs as "sync"

export const now = () => flush(); // a leaf's frame is below it: runs as "sync.now"
export const helper = () => flush; // the host running what this returns runs it as "sync"
```

```javascript
{ caller: "sync", target: "vault.**", effect: "deny" } // stops the timer and the returned helper, not sync.now()
{ caller: "sync.*", target: "vault.**", effect: "deny" } // stops sync.now(), not the timer or the returned helper
{ caller: "sync.**", target: "vault.**", effect: "deny" } // stops all three
```

Which path that is follows from how the file becomes part of the api (see [API-RULES.md](API-RULES.md)); it is the same in eager and lazy mode, in both runtimes and under both values of `permissions.attribution`:

| File                                                | How it is loaded                                                           | Its leaves             | File-level code runs as |
| --------------------------------------------------- | -------------------------------------------------------------------------- | ---------------------- | ----------------------- |
| `m.mjs` at the root of the base folder              | several named exports                                                      | `m.a`, `m.b`           | `m`                     |
| `m/m.mjs`                                           | a file named after its folder                                              | `m.a`, `m.b`           | `m`                     |
| `m/a.mjs`                                           | a file in a folder, alone or beside others                                 | `m.a.x`, `m.a.y`       | `m.a`                   |
| `m/main.mjs`                                        | a file with a generic name                                                 | `m.main.x`, `m.main.y` | `m.main`                |
| `m/m/a.mjs`                                         | a folder that is its same-named parent's only entry (one level, `api.m.a`) | `m.a.x`, `m.a.y`       | `m.a`                   |
| `m.mjs` with `export default { … }`                 | a default export object                                                    | `m.a`, `m.b`           | `m`                     |
| `m/f.mjs` with a default function and named exports | a callable node with members                                               | `m.f`, `m.f.a`         | `m.f`                   |
| `m.mjs` whose one export is `m`                     | a single named export                                                      | `m.m`                  | `m`                     |
| `m.cjs`                                             | a CommonJS file                                                            | `m.a`, `m.b`           | `m`                     |
| `addapi.mjs` of a folder added at `m`               | `api.slothlet.api.add("m", folder)`                                        | `m.a`, `m.b`           | `m`                     |
| `m/m.mjs` of a folder added at `m`                  | the sub-folder named after the mount is hoisted                            | `m.a`, `m.b`           | `m`                     |
| `tool.mjs` of a folder added at `ext.m`             | a nested mount path                                                        | `ext.m.tool.a`         | `ext.m.tool`            |

The `caller` a `PERMISSION_DENIED` error names is that path. The table holds as well when a root file's default function makes `api` itself callable.

**A helper file's code.** A helper file is a file an api file imports that is no api file itself (`api/sync.mjs` importing `../lib/queue.mjs`). It has no leaf and no path of its own, so its code runs for the api code that uses it:

- **Called by a leaf's code**, it runs as that leaf, as a function written outside every export of the leaf's own file does. Called by the file-level code of an api file, it runs as that file's module.
- **Handed out by a leaf** (`export const give = () => helperFn`) and run later by the host or another module, with no code of an importing file calling it, it belongs to the leaf that handed it out. With `permissions.attribution: "precise"` (the default) the stand-in the leaf's caller receives records that leaf, and each leaf that hands the function out gets its own answer: `alpha.give` returning `helperFn` hands out a function that runs as `alpha.give`, `beta.give` returning the same `helperFn` one that runs as `beta.give`. (The two are different stand-ins, so they are not `===` each other; the same leaf hands out the same one every time.)
- **Where there is no stand-in**, only the stack can say whose the code is, and the stack names the helper file, not the leaf that handed its function out. That is every hand-out under `"fast"`, and under `"precise"` a function nested in returned plain data, or one handed back into the module that made it (which receives the function itself). The helper then stands for the api files that import it, directly or through other helper files: **with one importing api file, the code runs as that file's module path** (the path file-level code of that file runs as, above); **with several, the module path of every importing api file has to be allowed**, since nothing says which of them the function was handed out by. Whoever runs it has to be allowed as well.
- **Which api files import a helper is what slothlet's loader recorded**, and nothing else: its resolve hook, and its own CommonJS `require`, which also records a `require` Node answered from its cache. The record is kept inside slothlet, with everything else it keeps about an instance's files (which CommonJS files are the instance's code, its private module copies, the require that is running). Each instance claims its ID before its first file loads, and only the handle it gets back loads a file as the instance's or releases what is kept for it. Slothlet's own module hands out read-only views and copies, and the object slothlet shares between its copies on the global object is frozen and holds no collection. Code can record a further importer (the vite plugin's registration does), which only adds a module that has to be allowed, and can neither drop nor replace one. The code slothlet generates for a CommonJS helper reaches slothlet with a one-time ticket the load hook wrote into it, so a module that imitates that code gets nothing. A URL is text any code can write, so the tags that say which api file a helper copy was loaded for (`helpers: "module"`) are given by slothlet alone: a file imported under tags its importer wrote out is loaded as the same file without them, and is held to its importers as recorded.

```javascript
// lib/shared.mjs (imported by api/alpha.mjs and api/beta.mjs)
export const read = () => self.vault.get();

// api/alpha.mjs                           // api/beta.mjs
export const give = () => read;
export const give = () => read;
export const box = () => ({ run: read });
```

```javascript
(await api.alpha.give())(); // "precise": runs as "alpha.give"      "fast": held to "alpha" and "beta"
(await api.beta.give())(); //  "precise": runs as "beta.give"       "fast": held to "alpha" and "beta"
(await api.alpha.box()).run(); // either value: held to "alpha" and "beta" (nested in data, the stack decides)
```

A rule set that is meant to cover everything a module's files do, their helpers included, should name the module path and everything under it (`alpha.**`).

> **Tip: [`helpers: "module"`](CONFIGURATION.md#helpers) makes this exact.** With that option an instance loads each helper file once per importing api file instead of once per instance. Each copy's stack frames then name the one api file it was loaded for, so a helper's code is that file's alone: under `"fast"`, and for a function nested in returned data, `alpha`'s copy runs as `alpha` and `beta`'s as `beta`, with no every-importer fallback. The cost is that the api files no longer share the helper's module state, and each copy takes memory. A CommonJS helper's frames carry no such name, and a browser build loads one copy whatever the option says; both keep the every-importer rule.

**What a file starts while it loads carries its module.** slothlet runs each file's top level under the file's module, in eager and lazy mode alike. A timer, a job queue, an event listener, an `AsyncResource` or an `AsyncLocalStorage.snapshot()` made there keeps that identity, so whatever it runs later has the module as its **caller**, never the host. The code doing the access is still read as its definer, and both have to be allowed:

```javascript
// api/sup.mjs  (denied the vault)
const queue = [];
setInterval(() => queue.shift()?.(), 2); // an ordinary job queue, started at load

export async function probe() {
	const made = await self.bag.make(); // bag is allowed the vault
	queue.push(made); // runs later with definer bag.make and caller sup: refused
	queue.push(() => self.vault.get()); // definer sup.probe, caller sup: refused
}
```

The async runtime carries the module in the store the file loads in. The live runtime pins what the file registers through the schedulers, emitters and promises it patches (see [Runtime choice](#runtime-choice--the-permission-boundary)), and what an `AsyncLocalStorage.snapshot()`, an `AsyncLocalStorage.bind()` or an `AsyncResource` the file made runs later: each is pinned to the load (or the call) that made it, so the code it runs carries that module in the live runtime as it does in the async one, with the call that runs it as a caller too. While the module cannot be found (the file is still loading, its node was removed, the instance has shut down) such code has no `self` and is refused.

**What a helper file starts while it loads** is held to every api file that imports the helper. A helper file is loaded once per instance, inside the load of whichever api file imports it first, so its timer or queue would otherwise carry that one file's module and nothing of the others'. When the helper's own flow runs code (the helper's own code with no code of an importing file calling it, or a job put on its queue), the module path of **every** api file importing the helper, directly or through other helper files, has to be allowed, in both runtimes; the code doing the access is still read as its definer. With one importing api file that is that file's module, as for the file's own timers. A file that waits on a module with a top-level `await` is evaluated when that module is ready, in the flow of whichever file started loading the module first. A helper waiting on such a module another api file started can so be evaluated inside the load of an api file that does not import it; its flow then carries that file's module, which is held to as well, beside the importers. Slothlet's own runtime (`@cldmv/slothlet/runtime`) waits at its top level too, and is loaded by slothlet before the first api file, so no api file ever waits on it.

```javascript
// lib/queue.mjs (imported by api/alpha.mjs and api/beta.mjs)
const jobs = [];
setInterval(() => jobs.shift()?.(), 2); // started once, inside whichever of the two loads first
export const push = (job) => jobs.push(job);

// api/alpha.mjs
export const later = () => push(() => self.vault.get()); // definer alpha.later, callers alpha and beta
```

A helper's code called by the file-level code of an api file (its own timer calling a function of the helper) runs as that file's module alone. With [`helpers: "module"`](CONFIGURATION.md#helpers) every api file gets its own copy of the helper, loaded inside that file's own load, so what a copy starts carries that one file's module and no other importer is held to (ES module helpers under Node and the vite plugin; a CommonJS helper's copy, and a browser build, keep the every-importer rule).

Where neither a call nor a load says who the caller is (a module that left the async store on purpose, a scheduler slothlet does not patch), the leaves whose code is further out on the synchronous stack are the callers, and all of them have to be allowed. A callback handed straight to such a scheduler has no frame of the module under it when it runs; that is the limit of what frames can tell.

#### `permissions.attribution`: how the definer is known

The definer comes from one of two places, chosen with `permissions.attribution`:

|                                                                                | `"precise"` (default)                                                                                                                      | `"fast"`                                                     |
| ------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------ |
| A returned function, class, class instance, generator, promise or Proxy export | a stand-in that records a definer (the leaf whose call returned it) for where the stack cannot tell one, and runs it under whoever runs it | itself, unwrapped                                            |
| Code nested in returned data, code handed in                                   | told by its frames when it runs                                                                                                            | told by its frames when it runs                              |
| `===` for a returned function                                                  | the same stand-in every time, but not the original (`util.types.isProxy` reports it)                                                       | the original itself                                          |
| Cost                                                                           | about 1 µs more per call of a returned function, and a check per returned value                                                            | none beyond reading the stack where a `self` call is checked |
| Where the stack names the definer                                              | the stack's definer: the nearest frame of the file inside a leaf's source, or the file's module                                            | the same                                                     |
| Where the stack cannot tell the definer                                        | a returned function runs as its recorded definer, except evaluated code while `provenance` is on                                           | the access is refused with `PERMISSION_DENIED`               |

**`"fast"` with `provenance: false`.** Both options are ways of knowing who wrote code: `provenance` reads it from the stack, `"precise"` records it on what a module hands out. Turn both off and nothing knows, so every function runs as whoever runs it. Every other combination refuses the same accesses:

```js
// rules: defaultPolicy "allow", { caller: "author.**", target: "vault.**", effect: "deny" }
// author (denied the vault):   export const make = () => () => self.vault.get();
//                              export const box  = () => ({ run: () => self.vault.get() });
// runner (allowed the vault):  export const direct = async () => (await self.author.make())();
//                              export const nested = async () => (await self.author.box()).run();
//
//                                   runner.direct()        runner.nested()
// "precise", provenance on          PERMISSION_DENIED      PERMISSION_DENIED   (the stack names author)
// "fast",    provenance on          PERMISSION_DENIED      PERMISSION_DENIED   (the stack names author)
// "precise", provenance: false      PERMISSION_DENIED      PERMISSION_DENIED   (what author hands out records it)
// "fast",    provenance: false      "SECRET"               "SECRET"            (runs as runner: no author check)
```

The last row is the same in both runtimes. Choose it only where every module that can hand code to another is trusted as much as the module that runs it.

With `"precise"` the stack wins wherever it names the definer, as it does under `"fast"`: a helper written outside every export and returned by a leaf is its file's module's when no frame of a leaf of its file is below it, and a caller's own function a module returns is the caller's. The record is only the fallback, where the stack cannot tell: a helper file's own function, which no leaf was built from (the leaf that handed it out is recorded, see [a helper file's code](#file-level-code-has-its-own-permission-path)); in the browser, where modules loaded from one folder share their URLs; a CommonJS file two running instances load, whose frames carry its path but not the instance. There the instance whose flow is running is the one whose code it is: inside a call, a hook, a `run()` / `scope()` callback or a file's load of an instance, the file's code is that instance's and is checked under its rules. Only where nothing names an instance (the host running a returned function outside every flow) can it not be told: `"fast"` refuses there and `"precise"` uses its record ([#735](https://github.com/CLDMV/slothlet/issues/735)); and `provenance: false`, where no frames are read. Code built with `eval` or the `Function` constructor is not one of these while `provenance` is on: its frames name no file, so it is refused under either value (see the limits below). With `"fast"`, nothing is wrapped, `===` holds and every call of a returned function is a plain call, and where the stack cannot tell the access is refused instead.

Either way, **plain data is never searched and never copied**, at any depth and width. The host gets it as itself: `util.types.isProxy` reports false for every object in it. A `Map`, `Set`, `Date`, error, typed array, `Buffer`, key, emitter and Node's own data classes are data too. The caller's own values handed in come back as themselves (`out.list === input.list` holds for a leaf returning `{ ...input }`, as in plain JavaScript), and a module's own stand-in handed back to it arrives as the value it made — inside a plain array or object too. What one module hands _another module_ reaches it as a view of the same data while the permission system is on (see [Values that cross between modules](#values-that-cross-between-modules)).

**With the permission system not on** (no `permissions` config, `mode: "off"`, `enabled: false`, `mode: "disabled"`), nothing is wrapped, nothing is searched and nothing is checked under either value: a leaf's return is exactly what it returned, and handed-out code runs as plain JavaScript. Handed-out code the host runs still reads `self` as its definer, so it keeps working, also once its node is removed, and the built-in write rules still keep it off the framework's own namespace. Code of a shut-down instance has no context to read `self` from; run inside another instance's call, it reads that call's. The one exception is 3.23.0's: in the async runtime an instance of a class a module wrote comes back in a context wrapper that runs its methods in the instance's context ([#328](https://github.com/CLDMV/slothlet/issues/328)), granting nothing; the live runtime returns it as itself. The wrapper reads and writes on the instance itself, so a getter over a `#private` field works; the same instance is the same wrapper every time it is returned (`a === b`, and a method returning `this` returns the wrapper); and handed back to the module that made it, it is the instance again. An instance of a class no module wrote (a `URL`, a `Response`, an `AbortController`, an `Intl.NumberFormat`) is never wrapped. `#field in value` on the wrapper is false, as it is for any Proxy.

Limits:

- **What shows** (`"precise"`, permissions on). A returned function, class, Proxy or class instance is a Proxy of slothlet's: `util.types.isProxy` reports it and `structuredClone` refuses it; `Function.prototype.toString.call(fn)` and `fn.toString()` both read the source (see below). A returned generator function or async function is a function of the same kind that runs the original, with the original's `name`, `length` and `prototype`.
- **The stand-in's recorded definer is the leaf that returned the code** (`"precise"`). It is read only where the stack cannot tell the definer (above); a helper written outside every export and returned by a leaf runs as the file's module wherever its frames name the file and no frame of a leaf of that file is below it. A function that is not written in a leaf's file (a helper file's own function, a bound or native function) is handed out as one stand-in per leaf, each recording its own leaf, so what two leaves return of it is not `===`; a class, and a function written in an api file, stay one value whichever leaves of the module return them.
- **A helper file's function under `"fast"`** has no record, and the stack names only the helper file: it runs as the module of the one api file importing the helper, and where several api files import it, every one of their modules has to be allowed (see [a helper file's code](#file-level-code-has-its-own-permission-path)). [`helpers: "module"`](CONFIGURATION.md#helpers) gives each importing api file its own copy, whose frames name it, so the code runs as that file's module alone.
- **A caller's function nested in an argument** (`"precise"`, permissions on) comes back as a stand-in when the module returns it on its own (`bag.pick({ cb }, "cb")`): the arguments are not searched. It still runs as the caller's code, told by its frames, under whoever runs it, but it is not `===` the caller's function. Returned inside data, or handed in at the top level, it comes back as itself.
- **Returned data is searched with `provenance: false`** (`"precise"`). No frames are read, so nothing would tell code nested in returned data from its caller's. The value is searched when it is handed out instead, four levels and 512 properties deep, and one that holds code (or is too large to tell) comes back as a stand-in of the module's, as a function returned directly does: its code runs as the module that made it, under whoever runs it. Data holding no code within that reach still comes back as itself. This is the cost `provenance: false` trades the stack read for; with `provenance` on, data is never searched.
- **`"fast"` with `provenance: false` keeps no author check.** `"fast"` wraps nothing and tells every definer from the stack, so with the stack read off nothing says who wrote a function: one a module returned, alone or inside data, runs as whoever runs it. Run by a module, it is checked as that module alone; run by the host, it has no `self`. This is the one combination in which `"precise"` and `"fast"` refuse different things, and it is a deliberate choice of speed over this check (see the example under [`permissions.attribution`](#permissionsattribution-how-the-definer-is-known)). Use `"precise"` with `provenance: false` where returned code has to keep its definer.
- **Code built with `eval` or the `Function` constructor** names no file, so while `provenance` is on `"precise"` does not know its definer either, even for a function returned directly: it is refused under either value, run by the host or inside a call (the evaluated-code limit). With `provenance: false`, a function `"precise"` returned directly runs as its recorded definer.
- **What no module made passes as it is.** A module handing on a `node:` built-in's export (`EventEmitter`, `fs.promises`) or slothlet's runtime hands out the value itself, so `===` and `instanceof` hold against the host's own import.
- **A package's values come back as the module's** (`"precise"`). A class or function from a package under `node_modules` that a module hands on is a stand-in like the module's own code.
- **A removed node and a shut-down instance** leave what they made without standing while the permission system is on: run later, a `self` call from it is refused. With it off, nothing is checked and they are not set aside (above).
- **CommonJS code of a shut-down instance in the live runtime.** The async runtime carries "outside every instance" into everything that code goes on to run. The live runtime tells which call is running from the call stack, and a CommonJS file's frames carry only its path, so in the live runtime that code, run later while another instance built from the same folder has a call into that same module waiting, cannot be told from that call's. It never takes on any other module's rights.

### Values that cross between modules

While the permission system is on, an object or function one module hands another through slothlet reaches it as a **view** of the value, not the value. A module may change data it is handed; it may not change the code of a module whose path it may not write, however it came to hold it. The routes are every one slothlet takes part in: what a call returns (awaited, yielded by a generator, resolved by a thenable included), its arguments, the `this` and arguments of a function one module calls for another, what a constructor is called with, a thrown or rejected error, an event's payload, a hook's `args`, `result` and `error`, and a value a module stored under a key of the runtime `context`.

Who gets the value itself rather than a view:

| Receiver                                                                                                                                                  | Gets                                                                                                          |
| --------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------- |
| The host                                                                                                                                                  | The value itself, always                                                                                      |
| The module the value came from                                                                                                                            | The value itself: a module's own object comes back `===` the one it made, through any number of other modules |
| A module that may make every write at the path the value came from (it owns it, or write rules grant it the whole subtree and none could refuse it there) | The value itself, unless a write rule denies the value's module a write to this one                           |
| The module such a writer hands _its_ values to (the module whose path it may write)                                                                       | The value itself, unless a write rule denies it a write to the writer                                         |
| Every module, while the permission system is off                                                                                                          | The value itself                                                                                              |
| Any other module                                                                                                                                          | A view                                                                                                        |

The table is read with the rules as they are each time a value is handed over. A view a module already holds does not fix the answer: after `addRule`, `removeRule`, `control.enable()` or `control.disable()`, the next read of the same value decides again, for each of the module's functions, whether it gets the value itself. Between rule changes the answer for a function and a value is remembered, so it is not worked out on every read.

Primitives are never viewed. Neither are the language's own objects and functions, a `node:` built-in's exports, slothlet's own nodes, or a date, regular expression, `ArrayBuffer`, typed array, `Buffer`, `DataView` or boxed primitive that has nothing on it but its own data (the language's or Node's own prototype, no member of its own): those hold no reference to anything else, and native code needs the object itself.

A view reads, calls and enumerates as the value does. Every value read through it — a member, an element, a `Map` or `Set` entry, what an iterator yields, a `WeakRef`'s target, what a method returns or throws, what a promise settles to, a getter's result, a descriptor's value — reaches the reader the same way, so nothing is searched when the value is handed over and a member the owner stores later is covered too. Every value the reader puts into it reaches the module the value came from the same way. One value is one view for a module, in every function of that module: `registry.add(item)` in one function and `registry.has(item)` in another see the same object, and the same value read twice is `===`. Who gets the value itself is still decided for each function by the rules that name it: where a write rule grants one function of a module the owner's subtree (`caller: "reader.sync"`), that function gets the value itself and the module's other functions get the view, whichever of them read the value first.

Through a view, data is the reader's to change and code is not:

- **A prototype some module wrote** is code. Reached through any value (`Object.getPrototypeOf(value)`, `value.__proto__`, `value.constructor.prototype`, the class's `prototype`), it is handed as reading it at its class's path would hand it (the reader table above, under [Code a caller hands to a leaf](#code-a-caller-hands-to-a-leaf-runs-as-the-caller)) when a node exports the class, and otherwise as a checked view held to the path of the node that first handed it on. Every function of a module gets the same checked view, so `value instanceof Class` holds for a class and an instance handed over by different functions.
- **A function** is its module's code: a write, `Object.defineProperty`, `delete`, `Object.setPrototypeOf` or `Object.preventExtensions` on another module's function or class is a write to that module's path. That covers a class's statics, `Symbol.hasInstance`, and `F.prototype = …`. It holds in both directions: a module that stores a member on a function its _caller_ passed in is writing the caller's code.
- **An instance's own code**: replacing its prototype (`Object.setPrototypeOf(value, …)`, `value.__proto__ = …`), assigning or defining a member of its own under a name a prototype some module wrote holds as a method or accessor (`value.method = fn`), and replacing, redefining or deleting a function or accessor the value itself holds (`handlers.onSave = fn`) are writes to the owner's path. An assignment the member's own setter takes is the owner's code deciding, and goes through.
- Everything else is data: a data member assigned, added or deleted, a new member of any kind, an element pushed, an entry set, and a function the reader's own module stored earlier and now replaces.

A write that is the owner's code is decided as a write at the path of the module the value came from: refused with `LOOSE_SET_NOT_OWNED` when the writer does not own it, with `PERMISSION_DENIED` under a deny rule, and allowed when a write rule grants that member. The view's reader and the module whose code is executing both have to be allowed, for these writes and for writes through any checked prototype view: a built-in bound to the write (`Reflect.set.bind(null, prototype, "method", fn)`) that the reader hands a module with more rights to run writes nothing the reader could not.

The language's and Node's own methods run on the value itself when the value has internal state only it answers for (a `Map`, a `Set`, a `WeakRef`, a date, an iterator, a boxed primitive) or is an instance of a class no module wrote, or of a module's subclass of one (a `URL`, an error, an emitter, a stream): `url.searchParams.get("a")`, `map.get(key)` and `emitter.on(name, listener)` work through a view, with what they return and what they call back with handed to the reader as above. A step of one of the language's own iterators or generators, sync or async (`gen.next()`, `for…of`, `for await`), reaches the reader as a plain `{ value, done }` result of its own under either `attribution`, as the engine makes one, with the value in it handed over as above. A plain object, an array and an instance of a module's own class take them through the view.

What the host relays keeps where it came from. The host holds real objects; when it passes on, as it is, a value a module's call returned to it (`api.reader.use(await api.owner.make())`), the receiving module gets a view, checked against the first module's path, and the first module gets its own value back. What the host builds itself (`{ item }`, an element it picked out of returned data) is the host's and is handed in as it is. Events and hooks follow the same rule: a value a module's call returned, which the host emits as an event's payload or passes to a call another module hooks, reaches that module's listener or hook as a view, and reaches the listener or hook of the module it came from as that module's own value. What a module passes to a function of its own reaches another module's hook on that function as a view too.

A view outlives nothing it was made to keep. A module that holds a view when the instance shuts down still holds a view: what it reads through it is still viewed, and a write it could not make while the instance was up is refused afterwards (a module no longer mounted owns nothing).

What shows, and limits:

- **A view is a Proxy.** `util.types.isProxy` reports it; the engine's brand checks answer for the Proxy (`util.types.isMap(view)` and `Error.isError(view)` are false, `Object.prototype.toString.call(view)` is `[object Object]`, `Map.prototype.get.call(view, key)` throws) while `instanceof`, `Array.isArray`, `JSON.stringify`, iteration and the value's own methods work. `util.inspect` and `console.log` print the value.
- **Cloning copies the data behind a view.** `structuredClone`, `v8.serialize` and `postMessage` (of a `MessagePort`, a `BroadcastChannel`, a `Worker`, and the browser's `window`) refuse a Proxy, so while an instance is up slothlet wraps them: each calls the platform's function first with what it was given, and only when that refuses the value does it look for slothlet's views and api nodes in it, on its own or inside the caller's plain objects, arrays, `Map`s and `Set`s, and hand the platform the data behind them. An api node's data (`structuredClone(api.m.config)`, with the permission system on or off) is read member by member through the node, so each read is checked as any read of the node is and a member the caller may not read is not copied. A built-in data object read through the api (a `Date`, `Map`, `Set`, error, `RegExp`, `ArrayBuffer`, typed array, `DataView` or boxed primitive, held by a node or reaching a module as a view) is copied from reads of it: what the object holds in its internal slots, read with the language's own methods (so none of a module's code runs, as none runs when the platform clones the object), each value it holds copied the same way, and an error's `message`, `stack` and `cause` read through the node or view, so one the caller may not read is left out. Memory the copy would share with the owner (a `SharedArrayBuffer`, or an array over one) is refused to a module that may not write it, since a clone of it would let that module write it. The caller gets the platform's copy, never the object behind the view or the node, and a value the platform cannot copy (a function, a Proxy of someone else's) is refused as it is in plain JavaScript. The wrappers are marked (`Symbol.for("slothlet.clone.original")` holds what each wraps), installed once for any number of instances, and removed when the last instance shuts down. Not covered: a view inside an instance of a class (the platform reads the instance itself), a lazy node that has not loaded, `process.send` with advanced serialization, and a cloning function someone captured before slothlet loaded.
- **`Function.prototype.toString` reads the source behind a view of a function.** The language answers `function () { [native code] }` for any Proxy, so while an instance is up slothlet wraps `Function.prototype.toString`: for an api node of a function, a view of one, a view of another module's function and a stand-in for a returned function it answers the source of the function behind it, which is what each already answers to its own `toString()`; for every other receiver it calls the language's function with what it was given. Only the text is answered, never the function. The wrapper is marked (`Symbol.for("slothlet.functionSource.original")` holds what it wraps), installed once for any number of instances, answers `function toString() { [native code] }` for itself, and is removed when the last instance shuts down. Slothlet's own reads of a function's text use the `toString` taken when slothlet loaded, so what it decides from that text is unchanged, and it recognises its wrapper by identity, never by the marker. Not covered: a `toString` someone captured before slothlet loaded, and a lazy node that has not loaded (native code, as before).
- **A typed array's or `Buffer`'s own members under string keys are not looked at by default.** Listing them lists every index, which costs milliseconds on a buffer of any size, so a member a module stored on one (`bytes.item = instance`) reaches the other module with the array, as it is. `permissions.typedArrayMembers` turns the listing on, for every array (`true`) or for arrays up to a size in kilobytes; an array found holding such a member is then handed over as a view, which native consumers that need the array itself (`fs.write`, `TextDecoder`) do not take. A subclass of a typed array, and a member under a symbol, are viewed whatever the option says.
- **An object a module uses as a prototype is that module's code, handed over as data too,** from the moment slothlet has seen something that inherits from it cross between modules: every change to it (a member replaced, added, redefined or deleted) is then a write to the owner's path, through a view taken before that as well, and the object is `===` whether it is read from the data or as the prototype. An object no value crossing between modules has inherited from yet is data like any other: a reader may add a member to it, though not replace a function it holds.
- **A module that holds another module's value itself and puts its own value into it hands that value over as it is.** A module handed a caller's object as itself (it may write the caller's path) that stores an instance into it, or calls the caller's function with one, has handed the instance over by its own write. A write rule that denies the caller a write to that module ends this: then each of the two gets views of the other's values, in both directions.
- **Modules loaded from one folder are one module.** Files under `base` share a module id and own each other's paths, so they hand each other values as they are, unless a write rule denies one of them the other's subtree; then what each of the two hands the other is a view.
- **What a module puts into an object the host shares through `context`** (`context.bag.item = …`) is plain JavaScript between the modules holding that object. Only the value stored under a `context` key is covered.
- **A promise another module holds in data is a view, like any other object.** Nothing is added to the promise until the reader adds it through the view (`then`, `catch`, `finally`, `await`), so a rejection counts as handled or unhandled exactly as the owner and the reader left it: a reader that only holds the promise causes no report when the owner handled it, and the owner's own rejection is still reported when nobody did. `await`, `Promise.all` and `instanceof Promise` work on the view; `util.types.isPromise(view)` is false and `Promise.prototype.then.call(view, …)` throws, as for any Proxy. What it settles to reaches the reader as a view. The promise of a call itself (`self.owner.load()`) is slothlet's own promise, as it always was.
- **A built-in a module replaces does not steer the checks.** Module code shares the realm with slothlet and can replace `Object.create`, `Reflect.get`, `Array.from`, `Function.prototype.toString` or the global `Proxy` for everyone, as in plain JavaScript. The handlers that decide reads and writes call those functions (every static of `Reflect`, `Object`, `Array`, `JSON` and `Math`, `Function.prototype.toString`, and `Proxy`) as they were when slothlet loaded. The same holds for the global constructors: slothlet's checks construct the language's own `Map`, `Set`, `WeakMap`, `WeakSet`, `WeakRef` and `Promise` and call `Symbol`, `Symbol.for`, `Symbol.keyFor` and the static functions of `Promise` as they were when slothlet loaded, whatever `globalThis.Map` (and the others) hold afterwards. This holds for all of slothlet's code, not only the checks: building, adding to, reloading and shutting down an api, loading files and recording which file imports which (with `URL` and `URLSearchParams` as loaded too), the boundary patches, the config and the errors all use the built-ins as they were when slothlet loaded. Methods a value inherits (`array.map`, `map.get`, `promise.then`) are still looked up on the value.
- **Cost.** A view is one Proxy per object read, about a microsecond the first time and a lookup after that. A module that walks a large structure another module handed it pays that per object.

### Code passed by routes slothlet does not see

A module can pass a function of its own to another module without going through slothlet: through a callback it was handed, a shared object or collection, an emitter, a generator, a global, or a built-in it replaces. Called later by the other module, such a function is told apart by the file it was written in. With `permissions.provenance` on (the default), the code doing an access decides: a module's own code running inside another module's call runs as the leaf built from its file, with the call it runs inside as its ceiling, so **both have to be allowed** — the same rule as [code a caller hands to a leaf](#code-a-caller-hands-to-a-leaf-runs-as-the-caller). The internal state of a Node stream or socket a module hands out (its `_readableState`, `_writableState`, listener table or native handle) is one of those routes: slothlet hands such a stream out as the object itself and does not look inside that state, so with `provenance` off a function planted there runs with the permissions of whichever call runs it.

```js
// plugin: export function install() { self.registry.register(() => self.c.read()); }
// registry: export async function fire() { await tick(); for (const h of handlers) await h(); }
//
//                            provenance: false        provenance: true (default)
// both may read c            runs as registry ✓       runs as plugin under registry ✓
// only registry may read c   runs as registry ✓       refused (plugin may not)
// only plugin may read c     refused (registry)       refused (registry is its ceiling)
```

Details:

- **A file with several leaves.** Code in a file several leaves were built from runs as one of them, with the others added to its ceiling: all of them have to be allowed.
- **Code of a file no module's folder holds** — a package's, a linked package's, a file a module `require`s by some other path — doing an access is the code of the modules that loaded it, as slothlet's loader recorded the imports: a module's own dependency runs as that module, and a package another module ships, planted in the caller's object, runs as that module under the caller. A file a module loads through `createRequire`, whatever file it names as the importer, is that module's, and every module's that requires it the same way, whichever of them required it first and in every instance built over the folder: Node keeps the file once and answers a later `require` of it from its own caches, so slothlet answers each of those requires itself and records it. A module's own dependency, and a file no module loaded (the host's own), act for the code that called them, as Node's own code does: the next frame out decides. So a function another module handed in that has a package both modules import call a node (`() => descend(5, self.vault.get)`) is that module's code, with or without the package between, under `"precise"` and `"fast"`, with `references.capture` on or off; the module's own code calling the package is the module's; and code that reaches the start of the job through such frames alone runs as the leaf. When such frames go on past the 1024 frames read, nothing says whose code called them, and the access is refused. A file no module loaded is the host's own only when the code runs that file's own source: code compiled under a name no file holds, or holding another source (`vm.runInThisContext`, `Module#_compile`, a `data:` URL, a `vm.SourceTextModule` named after a file), is no one's and is refused, as is a package file with no loader recorded at all — unless it is a file of the package that created the instance. That package is the one whose code called `slothlet()` (the nearest folder above that file holding a `package.json`), so a host installed as a package and loaded before slothlet, such as `node_modules/@cldmv/rummage`, keeps its own files the host's; a package installed inside it has its own `package.json` and is not the owner's. Node's own code (`util.inspect` reading a node, an `fs` or stream callback calling an api function) acts for whoever called it — told by its script, which has to hash as the source Node compiles under that name, not by its name: code compiled under a `node:` name (a `vm` filename, a `//# sourceURL` comment) is refused like any other. An access a builtin makes from a queued job, straight or through Node's own functions (`AsyncResource.bind`, `util.deprecate`), with no one's code on the stack and no slothlet call entered — a chain of the engine's own functions a module queued, say `promise.then(Reflect.get.bind(null, self, "vault"))` — is refused, unless it goes through a function or node a module read and kept, which settles it as that module. The imports are recorded by slothlet's loader under Node. Under vitest slothlet reads them from vitest's own record of the modules its runner evaluated, as that record stood when slothlet's runtime loaded, so for the files vitest had evaluated by then the answer is the one Node's loader gives; with the `slothletInstanceImports()` vite plugin, it reads them for files vite evaluates later from the plugin's own record of the imports it resolved (see Where the source cannot be checked, below). Under another vite runner without the plugin the imports are not recorded, so a package's code there is refused.
- **A helper file's own code running inside a call whose file does not import the helper** (a function of the helper's that a leaf importing it handed out, run by another module) is the code of the modules whose api files import the helper: all of them have to be allowed, under the call it runs inside (see [a helper file's code](#file-level-code-has-its-own-permission-path)). In the live runtime, such a function picking up after an `await` inside another module's waiting call is held to every waiting call, since the stack does not say which of them ran it (see Overlapping calls under [Runtime choice & the permission boundary](#runtime-choice--the-permission-boundary)).
- **Code no leaf accounts for** — a helper file no api file is recorded as importing, or code compiled under some file name by someone else (`vm`, `eval`) — runs as no module, and its access is refused.
- **Where the source cannot be checked.** Attributing code to the leaf whose file it is in requires that the code is that file's own source: its script is one slothlet's loader recorded for the file, or it hashes as the file on disk does. Code vite loads under Node (a dev server's server-side modules, `vitest`) is transformed before it runs and never passes through Node's loader, so neither holds there. Under vitest, slothlet checks such a frame against vitest's own record of the code vite gave its runner for the file instead: the frame runs the file's own source when its script is the one vitest's runner compiles that code into, and the files that import it are the ones the record names. That record is read once, when slothlet's runtime loads (at the first `slothlet()` call; under vitest's default isolation, once per test file), and never again; no configuration is needed. A file vitest had already evaluated by then gets the answer Node's loader gives. A file vite evaluates later, and anything added to the record later, is not read, so its code is not taken as a file's own source on the strength of the record: a module's helper outside its api folder, which vite loads when the module loads, is refused under vitest without the plugin until [#682](https://github.com/CLDMV/slothlet/issues/682). The `slothletInstanceImports()` vite plugin covers the files vite evaluates later, and those under another vite runner (see [TESTING.md](TESTING.md#the-hosts-own-files-under-vitest)). It appends one statement to each JavaScript or TypeScript file it transforms outside `node_modules`, a module's instance copies among them, that records the script vite compiled the file into, and slothlet takes that script as the file's own source only when vitest's or vite's runner (code of the `vitest` or `vite` package, running its own source on disk) was evaluating the file. Each such file that is not an instance copy also imports a virtual module the plugin writes, recording which modules loaded the file as the plugin resolved their imports: an instance copy, or another file a module loaded. An import is evaluated before the file's own code, and the virtual module's code is the plugin's alone, so no file's code can change what it records. With these, a file vite evaluates later is attributed as Node's loader attributes it: a file only the host loaded (a package's file the host imports once the instance exists, as rummage imports an extension's `main`) runs as the leaf; a file a module loaded runs as that module; another module's function runs as the leaf its file was built for; and a module's helper outside its api folder runs as that module. A file of the package that created the instance is the host's whatever the plugin recorded. The record of a file is the imports resolved when it was first evaluated in the process: a module that imports a file only after the host loaded it is not added to it. Code a module compiles with `vm` under a file's name is refused either way, whether or not it makes the same registration itself. Code that drives vitest's module evaluator directly with source of its own, or changes vitest's record of a file before slothlet's runtime loads, is outside what this check can tell apart. The Node built-ins the check reads through (`fs`, `crypto`, `TextDecoder`, `URLSearchParams`, the `Map` and `Set` iterators) are the ones in place when slothlet's runtime loaded, so replacing them later does not change an answer. In a browser there are no script hashes to compare, so code is attributed by its file as elsewhere in frame placement, without this check.
- **A module's function handed out through slothlet** runs as its definer under whoever runs it (see [Code a module hands out runs as its definer](#code-a-module-hands-out-runs-as-its-definer)).
- **An access made from deep inside Node's own code**, or a package's, is held to the code that started it. When Node's own code recurses before it calls an api function (`util.inspect` printing a deep value calls a getter at the bottom of it), the frames nearest the access are only slothlet's and Node's own; the stack is then read further out, up to 1024 frames, to the code that began it. Past that nothing says whose access it is, and it is refused for everyone, the host included. The live runtime reads as far for the call that is running when a package's or the host's own recursion fills the frames nearest the access (see Overlapping calls under [Runtime choice & the permission boundary](#runtime-choice--the-permission-boundary)).
- **Cost.** It reads the stack on each permission-checked access while permissions are on. Turning `provenance` off removes that read, and with it this protection: a function from a less trusted module then runs with the permissions of whichever call runs it.

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

The same holds for a namespace, a top-level one (`const db = self.db`) included: every function and value read through it later is enforced as the module that read the namespace, so a function the module leaves behind for the host to call, reading `db.metrics` through the namespace it kept, is refused where the module may not read it.

Reads through the bound `api` object returned by `slothlet()` are unaffected: no module is executing, so there is nothing to record, and the host keeps its own standing.

**Both runtimes need this**, unlike the boundary patches. The live runtime needs it because a reference invoked from a boundary carrying no caller would otherwise be read as host-initiated. The async runtime is already safe there — outside a flow it has no store to inherit — but it shares the second case: without capture, an unprivileged module could hand a reference to a permitted one and have the work done on its behalf, since only the live caller would be checked.

**Cost.** Recording the reader means interposing a per-reader object on each wrapper that module reads, because telling holders apart is the entire point of having one — there is no cheaper way. Measured on a permitted inter-module call whose target does nothing (so the overhead is as visible as it can be), enabling it costs **tens of percent — repeated paired runs landed between roughly 25% and 50%, or about 5–10 µs per gated call**. The spread is that wide because the figure is sensitive to machine and load, so treat it as a magnitude rather than a number to quote; measure on your own hardware if it matters to you. Two things bound it in practice: instances with no `permissions` block skip it entirely, and the fraction shrinks as the target does real work. Set `references: { capture: false }` if you have measured it and want the older behavior back.

### `self` requires an executing module

`self` is the in-module view of the api, and what makes it safe is that every access through it is attributed to the module making it. Code that is not a module has no such attribution, so `self` refuses to resolve at all outside a module call — reads, writes, `in`, `Object.keys`, and descriptor lookups alike, so nothing discloses the api's shape either. Under the async runtime this is automatic (no store, nothing to read through); under the live runtime it is an explicit check, because the live store stays populated for the instance's whole lifetime and would otherwise resolve for any script that imported the runtime.

Code a module wrote, run by the host outside any call — a closure the module returned, a function in data it returned — is the exception: it reads `self` as its definer (see [Code a module hands out runs as its definer](#code-a-module-hands-out-runs-as-its-definer)). A script of the host's own has no definer and gets no `self`.

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

A `**` that is a whole segment takes the `.` beside it along when it matches no segment: `payments.**` matches `payments` itself as well as everything below it, `**.charge` matches `charge`, and `a.**.b` matches `a.b`. Every `**` in a pattern does, wherever it stands, and several in a row say the same as one: `a.**.**` matches `a`, and `a.**.**.b` matches `a.b`. A `*` is always exactly one segment, so `a.**.*` matches `a.b` and not `a`. Hooks, routine names and the loader's `hidden` globs compile their patterns the same way. So a rule on `x.**` also covers the module path `x`, which code outside every export of `x`'s file runs as.

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

- **`key(ctx)`** maps the per-request context to this principal's identity key. It must be synchronous. A `null`/`undefined` key means "no identity" — rules requiring the principal do not match for that call. Like `resolve`, a module's `key` runs as the module that registered it.
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

// Later, remove it
api.slothlet.permissions.removeRule(ruleId);
```

Module code can call the same `addRule` / `removeRule`, and pass `permissions` to an `api.add` it makes, but by default only for **its own subtree**: the rule's target pattern (a call, hook, or `:write` target alike) must have a non-empty literal prefix — its segments before the first glob segment — inside the subtree the module owns, and must not name the framework's namespace, root functions, or internal keys. `victim.**` and `victim.store.*` are fine for the module mounted at `victim`; `**`, `*.x`, `other.**`, and `slothlet.**` are refused with `INVALID_PERMISSION_RULE`, and so is removing such a rule. A rule module code adds is that module's rule, at the module layer, so a host rule outranks it at equal specificity.

That default is the built-in rule `{ caller: "**", target: "slothlet.permissions.addRule", effect: "deny" }`. It decides only what module code may register beyond its own subtree; calling `addRule` for the module's own subtree is not gated by it. An explicit allow on that target for a module — the host's, or the module's own manifest's — lifts it, and the module then manages rules for any target, as the host does (`defaultPolicy: "allow"` alone lifts nothing):

```javascript
const api = await slothlet({
	dir: "./api",
	permissions: { rules: [{ caller: "mgr.**", target: "slothlet.permissions.addRule", effect: "allow" }] }
});
```

#### Rules are stored by value

`addRule(rule)`, the config's `permissions.rules`, a manifest's rules, and the `permissions` option of an `api.add` each store their own copy of the rule, its `condition` included (copied deeply into frozen data: its plain objects and arrays are copied, and a value of any other kind — a `Map`, a `Date`, a class instance — is kept as the same value, since a condition compares such a value to the context's by identity). Editing the object afterwards does not change the installed rule, and a reload replays the copy. To change a rule, remove it and add the new one. A function condition is kept as the same function, and it is still evaluated on every check, against that call's context. When module code registered the rule (through `addRule`, a manifest it mounted, or the `permissions` option of an `api.add` it made), the function runs as that module, whichever caller's call is being checked: what it reads, calls, or writes through `self` is judged with that module's standing, never the caller's. A rule whose fields are accessors, or whose condition holds a `Proxy`, is refused.

```javascript
const rule = { caller: "reports.**", target: "billing.**", effect: "deny" };
const id = api.slothlet.permissions.addRule(rule);
rule.effect = "allow"; // no effect: the installed rule still denies
api.slothlet.permissions.removeRule(id);
api.slothlet.permissions.addRule({ ...rule }); // now it allows
```

Module code removes only the rules its own module owns. A module allowed to manage rules beyond its subtree also removes other modules' rules, but never a host rule (config or runtime) or a built-in one; to override one, it adds a rule of its own, which normal precedence weighs. A module keeps its rules — call, write, and event rules alike: its manifest's, its code's, and those registered with its `api.add` — and its principals, event listeners, and moduleID until its last live mount is gone: removed by its moduleID, or its mount path removed (removing a path removes everything under it, so a mount inside it is gone). Then they all go, do not come back on a reload, and the moduleID is free again. A moduleID the host mounted at several paths keeps all of it while one mount remains; removing one mount removes only that mount's paths. Removing a module by its moduleID removes the paths it owns: a container of it that still holds another module's paths stays for them, an emptied one goes, and a module mounted below it stays mounted with its rules. The host's own rules naming a module's paths stay. A module's right to remove a mount it added goes when that module is removed, so a module that later takes the freed moduleID inherits nothing. The removed module's own code stays without standing too: a function it kept or handed out (one pinned with `lockCaller` included) owns nothing once its module is gone, no rule grants it a write (while the permission system is on, a write it makes is refused with `LOOSE_SET_NOT_OWNED`, or with `RUNTIME_NO_ACTIVE_CONTEXT_SELF` when it runs outside any call, as code of no module does), and while the permission system is on every call it makes is refused (`PERMISSION_DENIED`), since the rules naming its old path may now be another module's. The function conditions of rules it registered stop matching. All of this holds even after another module is mounted under the freed moduleID, at any path, its old one included.

A module owns the paths under its mount point that no other module's deeper mount covers: a module mounted at `outer` does not write into a module mounted at `outer.inner`, and does not register a rule whose target's literal prefix lies in it (`outer.inner.**`). Modules mounted at the same point share that point's subtree, not each other's other mounts. The base module keeps the whole tree. A rule a module registers for its subtree matches its pattern as written, so `outer.**` covers everything mounted under `outer`, other modules mounted below it included, as a host rule would.

`api.add`, `api.remove`, and `api.modules.addModule` / `addModules` / `addDiscovered` / `removeModule` from module code are writes: mounting at a path writes there, replacing an existing subtree (`forceOverwrite`, or the `replace` / `merge-replace` collision modes) writes at every path it replaces, and removing a module, a path, or a module's share of a path deletes there. A removal reaches every path it would delete — every mount and path of a module removed by its moduleID, every registered path under a removed path — and is checked whole before anything changes: if one path is refused, nothing is removed. `api.modules.removeModule` checks every mount matching the name (and version) before removing any. A refused `api.add` leaves nothing behind: what it registered, what loading lazy content for its checks registered included, is reverted.

A module may store a reference to another module's node under its own path (`self.reports.ref = self.cache.store`); reads and calls through it work as through the node itself. The node stays its owner's: every write `api.add`, `api.remove`, `api.reload`, and the metadata and versioning setters make is judged by the real path and owner of each node it walks, not by the path the node was reached at. So an `api.add` at or below `reports.ref` writes into `cache.store` and, while the permission system is on, needs the write there (`LOOSE_SET_NOT_OWNED` otherwise), and nothing is removed through such a reference. `api.remove("reports.ref")` removes only the reference, the member of the module's own node holding it, and leaves `cache.store` whole; so does removing a module or path that holds one, from module or host code. A reference to a node of the module's own is that node, and writes through it as such. A stored version dispatcher stands for the versioned node it routes to, and is judged by that node's path and owner. A path that runs through an accessor (a getter defined on a node, or on an object stored there) or through a Proxy a module stored is refused to module code without running the getter or trap, since what it answers is not known until it runs; the host's own adds through a getter still place where it points. While the permission system is on, each needs the module to own the path, a `:write` allow naming it, or to be inside a mount the module itself performed, and is refused as any other write is (`LOOSE_SET_NOT_OWNED`, or `PERMISSION_DENIED` from a write rule), the framework's own write rules included. An `api.add` from module code also writes at every path its content creates or merges into below the mount, whatever the collision mode, so content cannot land in a module mounted below it or past a write deny there; in lazy mode the content is loaded for that check. A path is checked as it is mounted (trimmed). The framework's setters are writes too when module code calls them: `metadata.set` / `remove` / `setFor` / `removeFor` / `setForVersion`, `versioning.setDefault` / `setVersionMetadata`, and `api.reload` (at every path it rebuilds). A versioned `api.add` writes at both the version-tagged mount path (`<versionTag>.<apiPath>`) and the path where its version dispatcher sits, and module code needs both. A module mounting below its own path hands that path to the module it mounts, and its code may always remove that mount, or part of it, without a grant; the mounted module may remove itself. A mount the host made below a module's path is not that module's to remove without a grant. Host code mounts and removes anywhere, as before. Module code mounts with its own moduleID or one not in use; a moduleID of another mounted module is refused (`MODULE_ID_IN_USE`). The host may re-use a moduleID.

A manifest's rules apply as declared only when the host mounts its module. When module code mounts one (`api.modules.addModule` / `addModules` / `addDiscovered`), the manifest's rules, event rules included, are that module's rules and placed like its `addRule`'s: a rule beyond its subtree refuses the whole mount with `INVALID_PERMISSION_RULE`. A manifest the host mounts is not restricted this way: its rules apply at mount, at the `manifest` layer, whatever they target. Mounting a module is the consumer's choice to accept them.

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
5. **Tiebreak**: Among rules at the same specificity, the higher precedence **layer** wins — `runtime` > `instance` (config) > module rules (a module's own `slothlet.module.json` rules, and the rules its code adds) > `builtin` (framework defaults) — and only within a single layer does the **last-registered** rule win. So a composing host's config or runtime rule overrides a module's manifest rule of equal specificity, which overrides a framework built-in.
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

Either way a private member is a member of the api: its leaf is composed in eager and lazy mode alike, and generated types include it. Privacy is an access rule checked when the member is read or called, not something that removes the member.

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

A file whose default export is one of these built-ins (`export default new Map()`, `export default new RangeError(…)`) is an api node standing for that value at its path. A rule denying a read of that path refuses every member read through the node — an error's `name`, `message`, `stack` and `cause`, a map's `size` and its methods — as a read of the same value exported by name is refused. The node fronts the value as data, so its methods are the value's and no api paths of their own: a rule on `cache.entries.get` decides nothing, for the host or for a module, and a rule on the node's path (or `path.**`) covers every member alike. A plain object a file exports by default is a namespace: a rule on its path alone leaves its members readable, each gated at its own path.

An object member of a module's data (a plain object or array a file exports by name, or one held inside such a value or inside a file's default export) is hidden by a deny on its exact path. The rule covers the member and everything it holds, as a rule on `path.**` would, so a reader the rule names cannot read what the member holds, and the member is left out of `Object.keys()`, a spread, `JSON.stringify`, `structuredClone`, `v8.serialize` and `postMessage`, as a primitive member it may not read is. A more specific allow beneath the member still lets what it names through: the member is then listed, holding only that.

```javascript
// owner.mjs
export const config = { nested: { public: 1, hidden: 2 }, prim: 3 };

// rules: { caller: "reader.**", target: "owner.config.nested", effect: "deny" }
self.owner.config.nested.hidden; // PERMISSION_DENIED
Object.keys(self.owner.config); // ["prim"]
JSON.stringify(self.owner.config); // '{"prim":3}'

// adding { caller: "reader.**", target: "owner.config.nested.public", effect: "allow" }
self.owner.config.nested.public; // 1
JSON.stringify(self.owner.config); // '{"nested":{"public":1},"prim":3}'
```

Reading the member itself stays traversal: `self.owner.config.nested` is an object with nothing the reader may read, and `"nested" in self.owner.config` is true, as it is for a primitive member the reader may not read. Within the rule's coverage it ranks as a rule on `path.**` does, so a rule naming a path beneath the member more specifically decides that path. The rule covers reads of data only: calling a function the member holds is decided by the call rules on the function's own path. A deny on the exact path of a folder, a file (its default export included) or a function is unchanged: it does not cover what is beneath it.

**What is NOT gated:**

- **Namespace traversal** — walking `self.admin` → `.manage` → `.deleteUser` returns child wrappers, not data values, so a `defaultPolicy: "deny"` configuration does **not** need an allow rule for every intermediate path segment.
- **Callable functions** — reading a function reference returns a wrapper; the eventual call is still gated by the normal call enforcement.
- **External user code** — reads from outside any module (e.g. `api.db.secrets.token` in your own application code) have no caller context and are exempt, mirroring call enforcement.

The [self-call bypass](#self-call-bypass) still applies — a module reading a data value exported from its own source file is always allowed.

> **Upgrading to v3.7.0:** read gating is on by default. A `defaultPolicy: "deny"` configuration that previously relied on data values being freely readable will now deny those cross-module reads. Add allow rules for the data paths you intend to share, or set `readGating: false` to keep the pre-v3.7.0 calls-only behavior.

### Frozen and sealed api nodes

Freezing or sealing an api node (`Object.freeze(api.secrets)`, `Object.seal(api.box.items)`) works as it does on the object itself, and keeps every read gated. A sealed node holds its members as data properties, so `Object.isSealed`, `Object.isFrozen` and its descriptors report what a sealed or frozen object of its own would. A sealed member stays writable, and reads keep going through the node's permission check. Freezing pins each member's current value. JavaScript requires a frozen value to be reported as it is, so a read or descriptor of it throws `PERMISSION_DENIED` for a caller the rules deny, instead of handing it over. `Object.isFrozen` and `Object.isSealed` read every descriptor, so that caller's integrity check of a node holding such a value is refused the same way; it can still seal or freeze the node. Freezing or sealing an array member applies the same operation to the module's current array, and a module that freezes or seals its own array after the node was read is reported the same way.

A frozen or sealed node has these limits, which the language imposes:

- **Its member names are visible to every caller.** A sealed object must list the same keys to every reader, so `Object.keys()` no longer withholds the names of members a caller may not read. Their values stay gated.
- **A frozen member is checked against whoever reads it.** Elsewhere, a member a module reads keeps that module's identity, so a copy it calls later, from a callback slothlet does not patch, is still checked against that module. A frozen member, like the inspect hook a sealed node holds, must be read as the node holds it, so it is checked against the live caller instead.
- **A reload gives it a new node.** A sealed or frozen node's keys and values are fixed, so it cannot take what a reload builds. The reloaded module's value gets a new node at the same path; a reference still held to the old one keeps the object it was, as a reference to a replaced object does in plain JavaScript.

Elements of an array member are gated like any other member, including when the array is serialized through its parent: `JSON.stringify(self.secrets)` reads each element of an array it contains through the api, once, as plain JavaScript reads it. It throws `PERMISSION_DENIED` for an element the caller may not read, and leaves out the denied leaves of an object element, as it does for an object member. `util.inspect` of a node reads its members through the api the same way: a member the caller may not read is left out, as `Object.keys()` leaves it out. An object member of a module's data (not a folder, a file or a function) that the rules leave the caller nothing of (a deny on `secrets.config.**`, which covers the member's own path and everything beneath it) is left out of `Object.keys()`, a spread, `JSON.stringify`, `structuredClone`, `v8.serialize` and `postMessage` alike, as a primitive member the caller may not read is, rather than listed and copied as an empty object. A deny on the member's exact path (`secrets.config`) covers what it holds the same way (see [Read-Level Gating](#read-level-gating)); a more specific allow beneath it leaves the member listed, holding what that allow lets through.

A key the module puts on an array member itself, such as `list.toJSON = () => list[0]` or `list.meta = { … }`, is a member of the array, the same as a member of an object: `secrets.list.toJSON` is call-gated, and `secrets.list.meta`'s leaves are read-gated. `JSON.stringify(list)` therefore throws `PERMISSION_DENIED` for a caller denied that path, rather than letting the function hand over an element the caller may not read. A symbol-keyed member of an array or an object (`node[Symbol.for("tag")]`) is read as in plain JavaScript and gated like its other members. An array's `length` and what it inherits (its methods, `Symbol.iterator`) are read from the array itself.

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

## Write Permissions

While the permission system is on, a module writes into the api only under the subtree it owns (a module mounted at `P` writes under `P.*`). The base module (loaded from `base`) owns the whole tree; a module mounted with `api.add` or `api.modules.*` owns its own subtree only, so it cannot write another module's paths or the framework namespace (`LOOSE_SET_NOT_OWNED`). Ownership itself is always tracked (it is what `api.slothlet.api.remove()`, `reload()`, and collisions work from), but a write is refused on it only while the permission system is on. With the system off (no `permissions` config, `mode: "off"`, `enabled: false`, or after `control.disable()`) no write is refused on ownership and none of the refusals below applies, except that module code still never changes the framework's own namespace, root functions, or keys on api nodes; with it disabled nothing restricts where a module writes.

While the permission system is on (`mode: "on"`, a `permissions` config whose `enabled` is not `false`, or after `control.enable()`), writing is a permission like calling, and a `:write` rule grants or refuses it: a target with the `pattern:write` **suffix** matches a module assigning, defining, or deleting a member at that path, or changing the prototype or extensibility of the node there (`Object.setPrototypeOf`, `Object.preventExtensions`, `Object.freeze`, `Object.seal`).

- A denying write rule refuses the write with `PERMISSION_DENIED`, whatever the module owns.
- An allowing write rule **grants** the write to the callers it names: another module's subtree, or a member a built-in write rule protects (below), becomes writable for them, and the ownership rule is not applied to that write. What the writer places there becomes part of that subtree: a function it stores runs as the module that owns the path, with that module's standing, when anyone calls it. Granting writes into a module's subtree therefore lets the writer add code to that module; grant it only to callers that may act as the module.
- With no matching write rule, ownership alone decides (`LOOSE_SET_NOT_OWNED`). `defaultPolicy: "allow"` grants nothing here.
- Precedence is the usual one: most specific first, then the higher layer (host over module rules), then the last registered. A more specific deny beats a broader grant.
- A **symbol-keyed** member is matched against the path of the node it is written on: `self.victim.v[sym] = …` is a write to `victim.v`. A plain value reached through a node — a class's `prototype`, a method of it, an object a prototype holds — is matched against the path it was reached at: `self.billing.Account.prototype.balance = …` is a write to `billing.Account.prototype.balance`. A member read that walks back into a value the same walk already went through is handed that value's view, so a cycle of plain values closes as it does on the values (`conn.self.self === conn.self` for `conn.self = conn`) and deep equality terminates; such a lap is matched against the earlier, shorter path. The cycle closes from the first plain value on the walk: a node is handed out as a node view and its own value as a member view, so `node.me === node` stays false when `me` points back at the node, and `node.me.me === node.me` holds. The same value at two paths that are no cycle is a separate view at each, matched against its own path. An instance another module's method returns is data that module chose to share, and is handed out as it is; so are the realm's built-ins (`Object`, `Map.prototype.get`, …).
- A module's **data objects** — a `Map`, `Set`, `WeakMap`, `WeakSet`, `Date`, `ArrayBuffer`, `SharedArrayBuffer`, typed array, `DataView`, `RegExp`, `Promise`, or `WeakRef` it holds on its api, one made in another realm (`node:vm`) included — are held to the same rule, at the path they were reached at. Reaching one at all follows the read rules, as any member does. A module that may write the path — it owns it, or a write rule grants it the write — is handed the object itself, so native code taking it (`fs.write`, `crypto`, a socket, `structuredClone`, `ArrayBuffer.isView`) works as on the object. Any other module is handed a live, read-only view: it reads the object itself, so it sees every later change the owner makes. Through the view, the methods of the object's kind that only read it work as plain JS: `get`, `has`, iteration, `forEach`, a `Date`'s `get…` and `to…` methods, a typed array's `slice`, `map`, `indexOf`, a regular expression's `test` and `exec` (which move its `lastIndex`, as using a regular expression does), a `Set`'s comparisons (`union`, `isSubsetOf`, …), a promise's `then`. Every other method the engine gives the kind is a write — `set`, `delete`, `clear`, `add`, `setFullYear`, `fill`, `transfer`, `compile`, and any method the engine adds later — as are assigning, defining, or deleting a member or an element and changing the prototype or extensibility. A method the owning module defined on its own subclass of the kind runs on the object it belongs to, as any call through a view does, and what it returns is data the module chose to share; called with another value's view as `this`, it gets that view. A module handed the object itself keeps it, as any reference: a write rule removed later does not take it back. What the object holds — a value `get` returns, what iteration yields, what a callback or a promise is handed, and what a promise's `then()`, `catch()`, or `finally()` passes on (the object itself is handed as the view), what a `WeakRef`'s `deref()` returns, a typed array's shared `buffer` and `subarray`, its own members and prototype — comes back held to the same rule; a copy a method makes (`slice()`, `union()`) is the caller's own. Native code refuses a view, and so does `Map.prototype.get.call(view, …)`; call the method on the view, and copy what native code needs (`Buffer.from(view)`, `view.slice()`). A data object that is a file's default export, and so an api node of its own (`export default new Map(…)` in `cache/entries.mjs`, read as `self.cache.entries`), answers alike: the methods of its kind, its iterator and what they hand back of it are held to the same rule at the node's path, so a module that may not write `cache.entries` changes neither the map nor an object it holds (`self.cache.entries.get("k").n = 1` is refused as it is for a map exported by name), and one that may write it gets each method running on the map itself.
- Host code (no module executing) is never subject to write rules.

The host grants a write in its config or with `api.slothlet.permissions.addRule`:

```javascript
const api = await slothlet({
	dir: "./api",
	permissions: {
		rules: [
			// `reports` may write into `cache`, which `cache` itself owns.
			{ caller: "reports.**", target: "cache.**:write", effect: "allow" },
			{ caller: "reports.**", target: "cache:write", effect: "allow" }
		]
	}
});
```

A module grants or refuses writes into its own subtree, through its manifest, its code, or the `permissions` option of an `api.add` it makes (see [Declaring Permissions](#3-programmatically-via-apislothletpermissions) for what module code may target):

```javascript
// api/cache/setup.mjs — the module mounted at `cache`
import { self } from "@cldmv/slothlet/runtime";

export function initialize() {
	self.slothlet.permissions.addRule({ caller: "reports.**", target: "cache.**:write", effect: "allow" });
}
```

Write rules belong to the permission system. While it is on, every write rule is evaluated. While it is off (no `permissions` config, `mode: "off"`, `enabled: false`, or after `control.disable()`) only the built-in ones below are, with any host rule on what they cover: module code never changes the framework's own namespace, root functions, or keys on api nodes, however it reached them (a reference to `self.slothlet` stored elsewhere included, and the namespace the host holds, handed to the module as an argument or stored on an object the module holds as itself; while no call of a module's runs, whose code makes the change decides, so a function a module left on an object of the host's or on `globalThis` is refused when the host calls it later), and no other write is refused, by a rule or on ownership. While it is disabled (`mode: "disabled"`) none is. The limits on what rules module code may register stay on regardless (see [Declaring Permissions](#3-programmatically-via-apislothletpermissions)), and a rule registered while the system is off takes effect once the host turns it on. `slothlet`, `shutdown`, and `destroy` are reserved names on `self` in every mode, refused when defined or deleted as when assigned (`INVALID_CONFIG_API_PATH_INVALID`). Ownership is recorded in every mode: what a module writes while the system is off is that module's, and is held to its ownership once the system is on. The built-in rules:

| Built-in rule                                                              | What it keeps modules from changing                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                             |
| -------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `slothlet:write`, `slothlet.**:write`                                      | The framework namespace and everything under it, at any depth (`self.slothlet.lockCaller`, `self.slothlet.lockCaller.caller`, `self.slothlet.permissions.addRule`, …)                                                                                                                                                                                                                                                                                                                                                                           |
| `shutdown:write`, `shutdown.**:write`, `destroy:write`, `destroy.**:write` | The framework's root functions                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                  |
| `<key>:write`, `**.<key>:write` for each framework-internal key            | The framework's own keys on any api node: wrapper state (`____slothletInternal`, `____slothlet`, `___setImpl`, `___getState`, `___resetLazy`, `___invalidate`, `_impl`, `_materialize`), what a node reports about itself (`__state`, `__invalid`, `__mode`, `__apiPath`, `__slothletPath`, `__isCallable`, `__materializeOnCreate`, `__displayName`, `__type`, `__metadata`, `__filePath`, `__sourceFolder`, `__moduleID`, `__materialized`, `__inFlight`, `__impl`), and impl metadata (`__childFilePaths`, `__childFilePathsPreMaterialize`) |

They are defaults. The host lifts one with a rule of equal or higher specificity, and so may a module's manifest, or module code the host or its manifest let manage rules beyond its subtree. A rule module code adds for its own subtree never lifts one. A lift grants the write to the callers it names, as any write allow does. Module code assigning, defining, or deleting an internal key is refused alike; the host's assignment or deletion of one is absorbed silently (it reports success and changes nothing).

```javascript
const api = await slothlet({
	dir: "./api",
	permissions: {
		rules: [
			// Only the `config` module may set one extra member on the namespace.
			{ caller: "config.**", target: "slothlet.featureFlags:write", effect: "allow" }
		]
	}
});
```

Ownership is judged for the module **executing** the write, as caller identity tracks it (see [Caller Identity & Fail-Closed Enforcement](#caller-identity--fail-closed-enforcement)). A callback one module hands to another and that the other calls synchronously runs inside the other's call, so its writes are judged as that module's. To keep a callback to the module that made it, wrap it with `self.slothlet.lockCaller`.

Module code the host invokes inside its own `context.run()` / `scope()` — a function, thenable, or getter a module returned — is that module's code there as it is outside the flow: it reads `self` as its definer, so its calls, reads and writes are held to that module's rules and ownership. The flow gives it the host's context data, not the host's standing. The host's own code inside the flow stays the host's.

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

Event rules are part of the permission system and follow its [mode](#modes): they are evaluated only while it is on. While it is off or disabled every subscription is delivered at `allow`, payload included, and the rules (the config's, a manifest's, runtime ones) wait until it is switched on. Module code reaches `event.rules.add` / `remove` while the system is off or disabled, since no call rule is evaluated there, and is held to the same limits as when it is on: event rules for its own events only, never removing the host's, ranked below the host's, with conditions that run as the module; the rules it adds under `"off"` or `"disabled"` come along, as added, when the system is switched on.

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

| Method               | Description                                                                                                                                                                                                                                                                                                 |
| -------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `addRule(rule)`      | Add a permission rule. Returns the rule ID. Gated by `config.api.mutations.permissions`. From module code, limited to the module's own subtree unless an explicit allow on `slothlet.permissions.addRule` lifts that default (see [Declaring Permissions](#3-programmatically-via-apislothletpermissions)). |
| `removeRule(ruleId)` | Remove a rule by ID. From module code, limited the same way; a module cannot remove the rules registered on its behalf (`PERMISSION_SELF_MODIFY`).                                                                                                                                                          |

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
| `control.disable()`         | Turn the system off (`mode: "off"`): rules are no longer evaluated, apart from the built-in write rules and the control and principal surfaces.                                                                                                                                                                                          |
| `control.enabled`           | Accessor — current global enforcement state (`boolean`).                                                                                                                                                                                                                                                                                 |
| `control.mode`              | Accessor — the current [mode](#modes): `"on"`, `"off"`, or `"disabled"`.                                                                                                                                                                                                                                                                 |
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

Like every built-in call rule, it is enforced only while the permission system is on. With no `permissions` block the system is off, so modules can call `restart()`; configure `permissions` (even just `{ defaultPolicy: "allow" }`) to make it host-only. The host is never gated. To let a trusted module restart the instance, add an instance rule on the same exact target — equal specificity, higher layer, so it outranks the built-in (this holds under both `defaultPolicy: "allow"` and `"deny"`):

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

As with every built-in call rule, these apply only while the permission system is on — with no `permissions` block the system is off and modules can call all of these. The host is never gated. To grant one to a trusted module, add an instance rule on the same exact target; it outranks the built-in under both `defaultPolicy: "allow"` and `"deny"`:

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

`slothlet.metadata.setGlobal` is **denied to modules by default**: global metadata is what every node reports, every other module's included, so it is the host's. The deny is checked once the call's arguments are valid, so a malformed call still reports what is wrong with it. A host or manifest allow lifts it for the modules it names:

```javascript
// Built-in rule registered for every instance:
{ caller: "**", target: "slothlet.metadata.setGlobal", effect: "deny" }

// Host grant — let the `config` module set global metadata:
{ caller: "config.**", target: "slothlet.metadata.setGlobal", effect: "allow" }
```

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

A module of one instance that calls into another's api (through a reference the host handed it, say) is that module to both: the instance it calls holds the call to its own rules by the module's api path. Being no module of that instance, it is not one of its removed modules either. The other instance's framework surface (`slothlet.*`) does not yet tell such a module from its own host: code that holds another instance's api reaches that instance as its host does, so hand a module another instance's api only if you would trust it with that instance's host access.

---

## Error Reference

| Code                      | When                                                                                                                                                                                 |
| ------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `PERMISSION_DENIED`       | A call or a module write was blocked by a permission rule. Includes `caller` and `target` in the error context; a write's target carries the `:write` suffix.                        |
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
