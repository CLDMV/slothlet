# Migrating from Slothlet v2 to v3

This guide covers every breaking change in v3.0.0 and how to update your code. Most application code requires only a handful of find-and-replace changes. The biggest impact is on code that directly calls the management API (`addApi`, `run`, `hooks`).

---

## Table of Contents

- [Quick Reference](#quick-reference)
- [Breaking Changes](#breaking-changes)
  - [Hook System Renamed and Moved](#1-hook-system-renamed-and-moved)
  - [Context API Moved](#2-context-api-moved)
  - [Reload / Dynamic API Management Moved](#3-reload--dynamic-api-management-moved)
  - [Collision Config Redesigned](#4-collision-config-redesigned)
  - [Mutation Config Redesigned](#5-mutation-config-redesigned)
  - [Sanitize Helper Export Renamed](#6-sanitize-helper-export-renamed)
  - [Cross-Instance Context Behavior Changed](#7-cross-instance-context-behavior-changed)
- [New Features Worth Adopting](#new-features-worth-adopting)
- [Configuration Diff](#configuration-diff)
- [Removed Options](#removed-options)

---

## Quick Reference

The most common changes at a glance:

| What | v2 | v3 |
|---|---|---|
| Hook config key | `hooks: true` | `hook: true` |
| Hook access | `api.hooks` | `api.slothlet.hook` |
| Hook registration | `api.hooks.on(id, type, fn, { pattern })` | `api.slothlet.hook.on("type:pattern", fn, { id })` |
| Context run | `api.run(ctx, fn)` | `api.slothlet.context.run(ctx, fn)` |
| Context scope | `api.scope(ctx)` | `api.slothlet.context.scope(ctx)` |
| Add API | `api.addApi(path, dir)` | `api.slothlet.api.add(path, dir)` |
| Remove API | `api.removeApi(path)` | `api.slothlet.api.remove(path)` |
| Reload API | `api.reloadApi(path)` | `api.slothlet.api.reload(path)` |
| Allow overwrite | `allowApiOverwrite: boolean` | `api: { collision: "overwrite" \| "skip" }` |
| Allow mutation | `allowMutation: false` | `api: { mutations: { add: false, remove: false, reload: false } }` |
| Sanitize export | `sanitizePathName` | `sanitizePropertyName` |
| Lifecycle subscribe | `api.slothlet.lifecycle.subscribe(...)` | `api.slothlet.lifecycle.on(...)` |

---

## Breaking Changes

### 1. Hook System Renamed and Moved

**Config key**: `hooks` (plural) → `hook` (singular)

```js
// v2
const api = await slothlet({ dir: "./api", hooks: true });
const api = await slothlet({ dir: "./api", hooks: "math.*" });
const api = await slothlet({ dir: "./api", hooks: { enabled: true, pattern: "**" } });

// v3
const api = await slothlet({ dir: "./api", hook: true });
const api = await slothlet({ dir: "./api", hook: "math.*" });
const api = await slothlet({ dir: "./api", hook: { enabled: true, pattern: "**" } });
```

**Access path**: `api.hooks` → `api.slothlet.hook`

```js
// v2
api.hooks.on("validate", "before", handler, { pattern: "math.*" });
api.hooks.off("validate");

// v3
api.slothlet.hook.on("before:math.*", handler, { id: "validate" });
api.slothlet.hook.off("validate");
```

**Registration signature changed**: The `on()` call in v2 took `(id, type, handler, { pattern })` as separate arguments. In v3 the type and pattern are combined into a single `"type:pattern"` string, and `id` moves into the options object:

```js
// v2
api.hooks.on("my-hook",   "before", handler, { pattern: "math.*",  priority: 100 });
api.hooks.on("log-hook",  "always", handler, { pattern: "**" });
api.hooks.on("err-hook",  "error",  handler, { pattern: "**" });
api.hooks.on("fmt-hook",  "after",  handler, { pattern: "math.*" });

// v3
api.slothlet.hook.on("before:math.*",  handler, { id: "my-hook",  priority: 100 });
api.slothlet.hook.on("always:**",      handler, { id: "log-hook" });
api.slothlet.hook.on("error:**",       handler, { id: "err-hook" });
api.slothlet.hook.on("after:math.*",   handler, { id: "fmt-hook" });
```

**v3 adds hook subsets** - three ordered execution phases within each hook type (`"before"` → `"primary"` → `"after"`). These are optional; hooks default to `"primary"`. Use subsets when ordering guarantees matter more than raw priority numbers:

```js
api.slothlet.hook.on("before:**", authCheck,   { id: "auth",     subset: "before"  });
api.slothlet.hook.on("before:**", mainLogic,   { id: "validate", subset: "primary" }); // default
api.slothlet.hook.on("after:**",  auditTrail,  { id: "audit",    subset: "after"   });
```

---

### 2. Context API Moved

`api.run()` and `api.scope()` have moved under `api.slothlet.context`:

```js
// v2
await api.run({ userId: "alice" }, async () => {
	await api.database.query();
});
const scopedApi = api.scope({ userId: "bob" });

// v3
await api.slothlet.context.run({ userId: "alice" }, async () => {
	await api.database.query();
});
const scopedApi = api.slothlet.context.scope({ userId: "bob" });
```

The merge strategy option is now explicit:

```js
// v3 - deep merge (default is shallow)
await api.slothlet.context.run(
	{ nested: { prop: "value" } },
	handler,
	{ mergeStrategy: "deep" }
);
```

Instance-level defaults can be set in config (new in v3):

```js
const api = await slothlet({
	dir: "./api",
	scope: {
		isolation: "partial", // "partial" (default) | "full"
		merge: "shallow"      // "shallow" (default) | "deep"
	}
});
```

---

### 3. Reload / Dynamic API Management Moved

All dynamic API management methods have moved from the root `api` object to `api.slothlet.api`:

```js
// v2
await api.addApi("plugins", "./plugins-folder");
await api.addApi("plugins.trusted", "./trusted", { trusted: true });
await api.removeApi("oldModule");
await api.reloadApi("database.*");

// v3
await api.slothlet.api.add("plugins", "./plugins-folder");
await api.slothlet.api.add("plugins.trusted", "./trusted", { trusted: true });
await api.slothlet.api.remove("oldModule");
await api.slothlet.api.reload("database.*");
```

Full instance reload (new in v3) replays all `add()`/`remove()` operations made at runtime so dynamic modifications survive:

```js
await api.slothlet.reload();
```

Reload with metadata update (new in v3):

```js
await api.slothlet.api.reload("plugins", {
	metadata: { version: "2.0.0", updated: true }
});
```

---

### 4. Collision Config Redesigned

The `allowInitialOverwrite` and `allowAddApiOverwrite` boolean flags have been removed in favour of typed collision modes.

```js
// v2 - removed
{
	allowInitialOverwrite: true,
	allowAddApiOverwrite: false
}

// v3 - typed modes, configurable independently for load vs runtime add()
{
	api: {
		collision: {
			initial: "merge",  // during initial load()
			api: "skip"        // during api.slothlet.api.add()
		}
	}
}

// Shorthand - same mode for both contexts
{ api: { collision: "merge" } }
```

**Available collision modes:**

| Mode | Behaviour on conflict | Non-conflicting keys |
|---|---|---|
| `merge` *(default)* | First loaded wins | Both sources added |
| `merge-replace` | Second loaded wins | Both sources added |
| `replace` | Second completely replaces first | Only second |
| `skip` | First is kept, second discarded silently | Only first |
| `warn` | Same as `merge`, but logs a warning | Both sources added |
| `error` | Throws `SlothletError` (`OWNERSHIP_CONFLICT`) | - |

---

### 5. Mutation Config Redesigned

The `allowMutation: false` flag has been replaced with per-operation controls:

```js
// v2 - removed
{ allowMutation: false }

// v3 - disable specific operations independently
{
	api: {
		mutations: {
			add: false,
			remove: false,
			reload: false
		}
	}
}
```

All three default to `true`. Include only the operations you want to restrict.

---

### 6. Sanitize Helper Export Renamed

If you import the low-level sanitize helper directly:

```js
// v2
import { sanitizePathName } from "@cldmv/slothlet/helpers/sanitize";

// v3
import { sanitizePropertyName } from "@cldmv/slothlet/helpers/sanitize";
```

For most use cases the runtime convenience method is preferable - it uses the instance's own config automatically:

```js
// v3 - uses your instance's sanitize config
api.slothlet.sanitize("get-http-status"); // → "getHTTPStatus"
```

---

### 7. Cross-Instance Context Behavior Changed

In v2, `.run()` / `.scope()` used a parent-chain model for context resolution. This meant a `.run()` on one Slothlet instance could see context values set by a `.run()` on a different instance that wrapped it.

In v3, each instance is fully isolated. A `.run()` on `api1` cannot see context from `api2.run()`, even if the calls are nested:

```js
// v2 - context leaked across instances
await api1.run({ user: "alice" }, async () => {
	await api2.run({ requestId: "123" }, async () => {
		// OLD: api1 context was still visible inside api2 scope
	});
});

// v3 - each instance is independent
await api1.slothlet.context.run({ user: "alice" }, async () => {
	await api2.slothlet.context.run({ requestId: "123" }, async () => {
		// api1 context is NOT visible here - api2 only sees its own
	});
});
```

If you were relying on this behavior, restructure to pass context explicitly between instances or use a shared context object.

---

### 8. Lifecycle API: `subscribe` → `on`

The `subscribe` / `unsubscribe` / `emit` methods are now internal-only. The public surface is `on` and `off`:

```js
// v2
api.slothlet.lifecycle.subscribe("impl:changed", handler);
api.slothlet.lifecycle.unsubscribe("impl:changed", handler);

// v3
api.slothlet.lifecycle.on("impl:changed", handler);
api.slothlet.lifecycle.off("impl:changed", handler);
```

---

## New Features Worth Adopting

These features are all new in v3 - there is nothing to migrate, but they replace common v2 patterns.

### Background Materialization

Pre-load all lazy modules immediately after init without blocking startup. Tracking and the `materialized:complete` event are enabled automatically.

```js
const api = await slothlet({
	dir: "./api",
	mode: "lazy",
	backgroundMaterialize: true
});

// Await all modules being ready
await api.slothlet.materialize.wait();

// Or subscribe to the event
api.slothlet.lifecycle.on("materialized:complete", ({ total }) => {
	console.log(`${total} modules ready`);
});
```

### Lifecycle Events

```js
api.slothlet.lifecycle.on("impl:created",          handler); // module loaded
api.slothlet.lifecycle.on("impl:changed",          handler); // module reloaded
api.slothlet.lifecycle.on("impl:removed",          handler); // module removed
api.slothlet.lifecycle.on("materialized:complete", handler); // all lazy modules ready
```

### Runtime Sanitize

```js
api.slothlet.sanitize("my-module-name"); // uses your instance's sanitize config
```

### Inspectable API Objects

```js
// v2 - console.log(api.math) printed: {}
// v3 - prints the actual module contents
console.log(api.math); // { add: [Function: add], multiply: [Function: multiply], ... }
```

### Hook Subsets

Order hooks within a type without fighting priority numbers. See [Hook System](#1-hook-system-renamed-and-moved).

### i18n

All error and debug messages are now translated. Configure via:

```js
const api = await slothlet({ dir: "./api", i18n: { language: "es" } });
```

Supported: `en-us`, `en-gb`, `de-de`, `es-es`, `es-mx`, `fr-fr`, `hi-in`, `ja-jp`, `ko-kr`, `pt-br`, `ru-ru`, `zh-cn`

---

## Configuration Diff

Full side-by-side of every config option that changed:

| Config key | v2 | v3 | Notes |
|---|---|---|---|
| `hooks` | `boolean \| string \| object` | **removed** | Renamed to `hook` |
| `hook` | - | `boolean \| string \| object` | Singular |
| `allowInitialOverwrite` | `boolean` | **removed** | Use `api.collision.initial` |
| `allowAddApiOverwrite` | `boolean` | **removed** | Use `api.collision.api` |
| `api.collision` | - | `string \| { initial, api }` | New |
| `allowMutation` | `boolean` | **removed** | Use `api.mutations` |
| `api.mutations` | - | `{ add, remove, reload }` | New |
| `lazy` | `boolean` | **removed** | Use `mode: "lazy"` |
| `api_mode` | `string` | **removed** | Auto-detected in v3 |
| `engine` | `string` | **removed** | VM/Worker/Fork modes dropped |
| `backgroundMaterialize` | - | `boolean` | New |
| `scope.isolation` | - | `"partial" \| "full"` | New |
| `scope.merge` | - | `"shallow" \| "deep"` | New |
| `i18n` | - | `{ language }` | New |
| `silent` | - | `boolean` | New |

---

## Removed Options

These config options were present in v2 and are gone in v3 with no equivalent:

| Option | Reason |
|---|---|
| `lazy: boolean` | Superseded by `mode: "lazy"` (deprecated since v2, removed in v3) |
| `api_mode` | API callable/object type is now auto-detected and not user-configurable |
| `engine: "vm" \| "worker" \| "fork" \| "child"` | All alternative execution modes were abandoned in v3 - only `"singleton"` mode is supported |
| `allowInitialOverwrite` | Replaced by `api.collision.initial` |
| `allowAddApiOverwrite` | Replaced by `api.collision.api` |
| `allowMutation` | Replaced by `api.mutations` |
