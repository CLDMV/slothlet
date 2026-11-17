# Metadata System

The metadata system lets code tag api functions with its own data (trust levels, tenants, versions, owners) and read those tags back at runtime for authorization, auditing and multi-tenant architectures. Metadata is user data only. What slothlet itself knows about a node (the file it came from, its api path, the module that owns it, its load state) is not metadata: `api.slothlet.node(target)` reports it.

## Table of Contents

- [Metadata and Node Reports](#metadata-and-node-reports)
- [Init Metadata](#init-metadata)
- [Setting Metadata at Load Time](#setting-metadata-at-load-time)
- [Runtime Metadata API](#runtime-metadata-api)
- [Runtime Introspection](#runtime-introspection)
- [Metadata Lookup Priority](#metadata-lookup-priority)
- [Node Reports](#node-reports)
- [Immutability](#immutability)
- [Hot Reload Behavior](#hot-reload-behavior)
- [Lazy Mode Considerations](#lazy-mode-considerations)
- [Security Considerations](#security-considerations)
- [Architecture Patterns](#architecture-patterns)
- [Performance Notes](#performance-notes)
- [API Reference](#api-reference)

---

## Metadata and Node Reports

### User metadata

Provided by code: at load time (the `metadata` option of `api.slothlet.api.add()`), at runtime (`api.slothlet.metadata.set()` / `global()`), or at startup (the `metadata` option of `slothlet()`). Three scopes:

| Scope    | Set with                                                                      | Priority |
| -------- | ----------------------------------------------------------------------------- | -------- |
| Global   | `api.slothlet.metadata.global()`, `slothlet({ metadata })`                    | Lowest   |
| Path     | `api.slothlet.metadata.set(path, …)`, `api.slothlet.api.add(…, { metadata })` | Middle   |
| Function | `api.slothlet.metadata.set(fn, …)`                                            | Highest  |

`api.slothlet.metadata.get(target)` reads the merged result, synchronously.

### Node reports

Every node slothlet builds carries facts slothlet recorded when it composed the node. They are read with `api.slothlet.node(target)`, never off the node itself (nodes carry no framework keys, so a module's own `__type` or `__metadata` export is just a member):

```javascript
api.slothlet.node(api.plugins.auth.login);
// {
//   callable: true,
//   file: "/app/plugins/auth.mjs",
//   folder: "/app/plugins",
//   loading: false,
//   materialized: true,
//   mode: "eager",
//   module: "plugins_x1y2z3",
//   path: ["plugins", "auth", "login"],
//   type: "function"
// }
```

User metadata never carries these facts, and a user key named `filePath` or `moduleID` is just a user key.

---

## Init Metadata

The `metadata` option of `slothlet()` seeds metadata at startup. Each key is set as global metadata, so every later `api.slothlet.api.add()` inherits it, and the whole object is also registered as user metadata for the base module:

```javascript
const api = await slothlet({ base: "./api", metadata: { team: "platform", tier: "internal" } });
console.log(api.slothlet.metadata.get(api.math.add).team); // "platform"
```

---

## Setting Metadata at Load Time

Pass a `metadata` option to `api.slothlet.api.add()`:

```javascript
const api = await slothlet({ base: "./api" });

await api.slothlet.api.add("plugins.trusted", "./trusted-plugins", {
	metadata: { trusted: true, permissions: ["read", "write", "admin"], version: "1.0.0", author: "TeamSecurity" }
});

await api.slothlet.api.add("plugins.external", "./third-party", {
	metadata: { trusted: false, permissions: ["read"], sandbox: true }
});

const meta = api.slothlet.metadata.get(api.plugins.trusted.someFunc);
console.log(meta.trusted); // true
console.log(meta.version); // "1.0.0"

const report = api.slothlet.node(api.plugins.trusted.someFunc);
console.log(report.path); // ["plugins", "trusted", "someFunc"]
console.log(report.file); // absolute path
```

---

## Runtime Metadata API

`api.slothlet.metadata` has four methods for managing user metadata after load: `global`, `set`, `remove` and `get`. `set`, `remove` and `get` take one kind of `target`:

- a function or node (`api.math.add`): metadata of that function;
- an api path, as a dotted string (`"math"`, `"v1.auth"`) or a segment array (`["2.3.0", "auth"]`, which keeps a dotted version tag whole): metadata for every function at or under that path;
- a module id from a previous `api.slothlet.api.add()`: resolved to the path it was added at.

### global(key, value) / global(object)

Set a global metadata value applied to every function in the instance:

```javascript
api.slothlet.metadata.global("environment", "production");
api.slothlet.metadata.global({ appVersion: "3.0.0", build: { region: "us" } });

const meta = api.slothlet.metadata.get(api.math.add);
console.log(meta.environment); // "production"
console.log(meta.appVersion); // "3.0.0"
```

Global metadata is the host's: module code needs an allow rule on `slothlet.metadata.global` (see [PERMISSIONS.md](./PERMISSIONS.md)).

### set(target, key, value) / set(target, object)

```javascript
// One function
api.slothlet.metadata.set(api.math.add, "description", "Adds two numbers");

// Every function under a path; an object merges several keys at once
api.slothlet.metadata.set("math", { category: "math", version: "2.0.0" });

// A version of a versioned path
api.slothlet.metadata.set("v1.auth", "stable", true);
```

Multiple calls merge; later calls override earlier ones for the same key. Path metadata applies to functions mounted under the path later, too, and survives `api.slothlet.reload()`.

### remove(target, key?)

```javascript
// One key of a function's metadata
api.slothlet.metadata.remove(api.math.add, "description");

// Several keys set for a path
api.slothlet.metadata.remove("math", ["category", "version"]);

// Everything set for a path
api.slothlet.metadata.remove("math");
```

A path removes only what was set for that exact path; it does not walk descendants or touch function-level metadata.

### get(target, options?)

```javascript
api.slothlet.metadata.set("math", "category", "math");
api.slothlet.metadata.get("math"); // { category: "math" }

// Descendants inherit ancestor entries; the closer entry wins
api.slothlet.metadata.get("math.add"); // { category: "math" }
api.slothlet.metadata.set("math.add", "category", "addition");
api.slothlet.metadata.get(api.math.add); // { category: "addition" }

// A version of a logical path
api.slothlet.metadata.get("auth", { version: "v1" }); // what get("v1.auth") reads
```

Synchronous. Global metadata is merged in, so a path nothing was set for returns the global metadata (or `{}`). For a function or node, the result is deeply frozen; for a path, it is a copy made for the call. Either way, changing it never changes what is stored.

---

## Runtime Introspection

Use `self.slothlet.metadata.*` to inspect metadata from within slothlet-loaded functions. The `self` proxy from `@cldmv/slothlet/runtime` gives access to the full running API - including `self.slothlet.metadata.*` - from any loaded module.

> **Note:** every `self.slothlet.metadata.*` read is **synchronous**. `self()` and `caller()` return a **caller object**, `{ path, module, metadata, version }`: the leaf's api path as segments, its module id, its user metadata, and its version record (`{ tag, default, metadata }`, or `null` when its module is no registered version). Version dispatchers and around hooks get the same object as their `caller`.

> **Permissions:** `metadata.self()`, `metadata.caller()` and `slothlet.node()` are allowed by default through built-in rules, so they work under `permissions.policy: "deny"` without an explicit allow (`node()` still needs the caller to be allowed to reach its target); `metadata.get()` stays gated. See [Other `slothlet.*` Routes Are Gated Too](./PERMISSIONS.md#other-slothlet-routes-are-gated-too).

### self.slothlet.metadata.self()

Get the currently executing function, as a caller object (synchronous):

```javascript
import { self } from "@cldmv/slothlet/runtime";

export async function chargeCard(amount) {
	const funcMeta = self.slothlet.metadata.self().metadata;

	console.log(`Service: ${funcMeta.service}`); // user metadata
	console.log(`Path: ${self.slothlet.metadata.self().path.join(".")}`); // which leaf this is

	const report = self.slothlet.node(self.payments.chargeCard);
	console.log(`Source: ${report.file}`); // what slothlet recorded
}
```

### self.slothlet.metadata.caller()

Get the function that called the current function, as a caller object (synchronous); its `metadata` is that function's user metadata, its `path` and `module` say which leaf it is:

```javascript
import { self } from "@cldmv/slothlet/runtime";

export async function sensitiveOperation() {
	const caller = self.slothlet.metadata.caller()?.metadata;

	if (!caller?.trusted) {
		throw new Error("Unauthorized: caller is not trusted");
	}

	if (!caller.permissions?.includes("admin")) {
		throw new Error("Admin permission required");
	}

	// Proceed
}
```

Returns `null` only when there is no module caller in the active context — a host-initiated call, or code invoked directly from outside the API. `caller()` resolves the caller from the active **context-manager store** (not a stack walk), so it carries across `await`, timers, and callbacks; see [Handle null caller gracefully](#handle-null-caller-gracefully).

### self.slothlet.metadata.get(target)

Get the metadata of any function or path (synchronous):

```javascript
import { self } from "@cldmv/slothlet/runtime";

export async function checkPlugin(task) {
	const pluginMeta = self.slothlet.metadata.get("plugins.external.processTask");

	if (!pluginMeta?.trusted) {
		throw new Error("Cannot delegate to untrusted plugin");
	}

	return self.plugins.external.processTask(task);
}
```

---

## Metadata Lookup Priority

`metadata.get(target)` merges the layers below (lowest to highest priority):

| Layer        | Source                                                                                      |
| ------------ | ------------------------------------------------------------------------------------------- |
| 1 - Global   | `api.slothlet.metadata.global()`, `slothlet({ metadata })`                                  |
| 2 - Path     | `api.slothlet.metadata.set(path, …)`, `api.slothlet.api.add(…, { metadata })`, root to leaf |
| 3 - Function | `api.slothlet.metadata.set(fn, …)`                                                          |

Nothing slothlet records is merged in: a user key is never overridden by a framework field, and never mistaken for one.

---

## Node Reports

`api.slothlet.node(target)` returns one frozen object per call. `target` is a node (as read from `api`, from `self`, or a reference a module kept) or its api path, as a dotted string or a segment array. It returns `undefined` when the target is no api node (a plain value, or a path nothing is mounted at).

| Field          | Type             | Description                                                                                                         |
| -------------- | ---------------- | ------------------------------------------------------------------------------------------------------------------- |
| `callable`     | boolean          | Whether the node can be called. A callable folder is a `"namespace"` with `callable: true`                          |
| `file`         | string \| null   | Absolute path to the source file                                                                                    |
| `folder`       | string \| null   | Absolute path to the folder the node was composed from                                                              |
| `loading`      | boolean          | A lazy node is loading right now                                                                                    |
| `logical`      | string[]         | Only on a versioned node read through its logical path (`api.auth` → `["auth"]`)                                    |
| `manifest`     | object           | Only on a node of a package mount: the parsed `slothlet.module.json`                                                |
| `materialized` | boolean          | The node has loaded (always true in eager mode)                                                                     |
| `mode`         | string           | `"eager"` or `"lazy"`                                                                                               |
| `module`       | string \| null   | The module id that owns the node: the id used with `api.slothlet.api.add()` / `remove()`                            |
| `path`         | string[]         | The node's api path as segments (`["v2", "auth", "login"]`; a dotted version tag stays one segment)                 |
| `type`         | symbol \| string | `slothlet.types.UNMATERIALIZED` / `IN_FLIGHT` until a lazy node loads, then `"function"`, `"data"` or `"namespace"` |

Reading a report never starts loading a lazy node. The caller must be allowed to reach the target: with permissions on (and read gating on), the report is decided as a read of the node's own path, so a module the rules deny the node is refused with `PERMISSION_DENIED`. Calling `node` itself is allowed by a built-in rule, so a `defaultPolicy: "deny"` host does not have to allow it.

```javascript
const report = api.slothlet.node("auth"); // a versioned path
report.logical; // ["auth"]
report.path; // ["v2", "auth"] — the version this caller is routed to
```

---

## Immutability

The metadata `metadata.get()` returns for a function or node is deeply frozen via recursive `Object.freeze()` (a path's is a copy made for the call), and every node report is frozen:

```javascript
const meta = api.slothlet.metadata.get(api.plugins.someFunc);

// None of these mutate metadata (TypeError in strict mode, silent fail otherwise)
meta.trusted = false; // blocked
meta.config.timeout = 1000; // blocked - nested objects frozen too
meta.permissions.push("admin"); // blocked - arrays frozen too
delete meta.trusted; // blocked

// To update user metadata, use the explicit API:
api.slothlet.metadata.set(api.plugins.someFunc, "trusted", false);
```

---

## Hot Reload Behavior

### Metadata survives full reload

User metadata set via `set()` and `global()` is automatically preserved across `api.slothlet.reload()`:

```javascript
api.slothlet.metadata.set(api.math.add, "category", "math");
api.slothlet.metadata.global("appVersion", "3.0.0");

await api.slothlet.reload();

// Both values still present after reload
console.log(api.slothlet.metadata.get(api.math.add).category); // "math"
console.log(api.slothlet.metadata.get(api.math.add).appVersion); // "3.0.0"
```

Path-level metadata set with `set(path, …)` also survives reload without extra steps.

### Atomic reload with metadata update

To update path-level metadata at the same time as a partial reload, pass a `metadata` option:

```javascript
await api.slothlet.api.reload("plugins", {
	metadata: {
		version: "2.0.0",
		updated: true
	}
});
// Fresh module implementations AND updated metadata in one step
```

The metadata is merged into the path store after the cache rebuild, so all freshly-tagged wrappers return the new values immediately.

To update metadata without reloading:

```javascript
// Takes effect immediately, no reload needed
api.slothlet.metadata.set("plugins", "version", "2.0.0");
```

---

## Lazy Mode Considerations

In lazy mode, modules are not loaded until first use. Path metadata is keyed by api path, so `metadata.get(path)` answers before anything loads; a node's report tells whether it has loaded:

```javascript
const api = await slothlet({ base: "./api", mode: "lazy" });
await api.slothlet.api.add("plugins", "./plugins", { metadata: { trusted: true } });

api.slothlet.metadata.get("plugins.someFunc").trusted; // true, nothing loaded yet
api.slothlet.node(api.plugins).type === api.slothlet.types.UNMATERIALIZED; // true; the report does not load it

await api.plugins.someFunc();
api.slothlet.node(api.plugins.someFunc).type; // "function"
```

---

## Security Considerations

### Metadata as defense in depth

Metadata-based authorization is one layer - not a complete security solution:

```javascript
import { self, context } from "@cldmv/slothlet/runtime";

export async function deleteUser(userId) {
	const caller = self.slothlet.metadata.caller()?.metadata;

	// Layer 1: metadata trust check
	if (!caller?.trusted || !caller.permissions?.includes("admin")) {
		throw new Error("Unauthorized: metadata check failed");
	}

	// Layer 2: session-based auth
	if (!context.user?.isAdmin) {
		throw new Error("Unauthorized: no active admin session");
	}

	// Layer 3: database-level permissions check
	await db.users.delete(userId);
}
```

### Handle null caller gracefully

`caller()` returns `null` when there is no module caller in the active context (a host-initiated call, or code invoked directly from outside the API):

```javascript
export async function protectedOp() {
	const caller = self.slothlet.metadata.caller()?.metadata;

	if (!caller) {
		// No tracked caller - require explicit auth token
		if (!context.explicitAuthToken) {
			throw new Error("Authentication required");
		}
	} else if (!caller.trusted) {
		throw new Error("Unauthorized caller");
	}
}
```

**When `caller()` returns `null`:**

- A **host-initiated** call — invoked from outside any module context (including a `run()` / `scope()` descended from the host root)
- Code called **directly from outside the API** — not through a `self.*` call

It does **not** return `null` merely because the call crossed a `setTimeout` / `setInterval`, an event-emitter callback, or a deep stack. Caller identity is resolved from the active context, which is carried across those boundaries — intrinsically by `AsyncLocalStorage` under the async runtime, and reconstructed by boundary patching under the live runtime (see [PERMISSIONS.md](PERMISSIONS.md#runtime-choice--the-permission-boundary)).

### How `caller()` resolves the caller

`caller()` reads the caller from the active **context-manager store** (`callerWrapper`) — the same caller identity the permission system enforces against — **not** a stack walk, and it does **not** use `Error.prepareStackTrace()`. Because identity lives in the context (carried by `AsyncLocalStorage` under the async runtime, or reconstructed by boundary patching under the live runtime), `caller()` is robust across `await` chains, timers, and event/callback boundaries. It returns `null` only when there is genuinely no module caller in context — a host-initiated call, or code invoked directly from outside the API.

---

## Architecture Patterns

### Plugin Security System

```javascript
// Load different plugin tiers
await api.slothlet.api.add("plugins.core", "./core-plugins", {
	metadata: {
		trusted: true,
		tier: "core",
		permissions: ["read", "write", "admin", "config"]
	}
});

await api.slothlet.api.add("plugins.community", "./community-plugins", {
	metadata: {
		trusted: false,
		tier: "community",
		permissions: ["read"]
	}
});

// Enforce in sensitive functions
import { self } from "@cldmv/slothlet/runtime";

export async function updateConfig(key, value) {
	const caller = self.slothlet.metadata.caller()?.metadata;

	if (!caller?.trusted) {
		throw new Error("Untrusted plugins cannot modify config");
	}
	if (!caller.permissions.includes("config")) {
		throw new Error("Config permission required");
	}

	config[key] = value;
	return { success: true };
}
```

### Multi-Tenant Isolation

```javascript
// Load tenant-specific modules
await api.slothlet.api.add("tenants.acme", "./tenants/acme", {
	metadata: {
		tenantId: "acme",
		tier: "enterprise",
		features: ["analytics", "api", "webhooks", "sso"],
		maxUsers: 1000
	}
});

await api.slothlet.api.add("tenants.startup", "./tenants/startup", {
	metadata: {
		tenantId: "startup",
		tier: "basic",
		features: ["analytics"],
		maxUsers: 10
	}
});

// Enforce in feature code
export async function createWebhook(url, events) {
	const caller = self.slothlet.metadata.caller()?.metadata;

	if (!caller?.features.includes("webhooks")) {
		throw new Error(`Webhooks not available on ${caller.tier} tier`);
	}

	return { id: "webhook_123", url, events };
}

export async function addUser(email) {
	const funcMeta = self.slothlet.metadata.self().metadata;
	const currentUsers = await countUsers(funcMeta.tenantId);

	if (currentUsers >= funcMeta.maxUsers) {
		throw new Error(`User limit reached (${funcMeta.maxUsers} max)`);
	}

	return { id: "user_456", email };
}
```

### Audit Logging

```javascript
await api.slothlet.api.add("services.payment", "./services/payment", {
	metadata: {
		service: "payment",
		version: "2.3.1",
		author: "TeamPayments",
		deployedAt: "2025-12-31T10:30:00Z",
		gitCommit: "a1b2c3d"
	}
});

import { self } from "@cldmv/slothlet/runtime";

export async function chargeCard(amount, cardId) {
	const caller = self.slothlet.metadata.caller()?.metadata;
	const funcMeta = self.slothlet.metadata.self().metadata;

	await logAudit({
		timestamp: new Date().toISOString(),
		operation: "chargeCard",
		amount,
		service: { name: funcMeta.service, version: funcMeta.version, commit: funcMeta.gitCommit },
		caller: { service: caller?.service, version: caller?.version }
	});

	return processCharge(amount, cardId);
}
```

---

## Performance Notes

| Operation                                 | Approximate cost               |
| ----------------------------------------- | ------------------------------ |
| `api.slothlet.api.add()` metadata tagging | ~0.1 ms per module             |
| `metadata.get(fn)`                        | ~0.01 ms (Map lookup + freeze) |
| `slothlet.node(target)`                   | ~0.01 ms                       |
| `self.slothlet.metadata.caller()`         | ~0.001 ms (context lookup)     |
| `self.slothlet.metadata.self()`           | ~0.001 ms (context lookup)     |

Cache the results at the top of a function body - both calls are synchronous but caching keeps intent clear:

```javascript
// ✅ Cache at top of function
export async function handler(data) {
	const caller = self.slothlet.metadata.caller()?.metadata;
	const funcMeta = self.slothlet.metadata.self().metadata;

	if (caller?.trusted && funcMeta?.permissions) {
		// use cached values throughout
	}
}
```

---

## API Reference

### api.slothlet.metadata.global(keyOrObj, value?)

Set global metadata applied to every function.

- `keyOrObj` (string | Object) - Metadata key, or an object of keys to merge (nested plain objects keep their shape)
- `value` (\*) - Value when `keyOrObj` is a key

### api.slothlet.metadata.set(target, keyOrObj, value?)

Set user metadata on a function or node, or for every function at or under a path.

- `target` (Function | Object | string | string[]) - Function or node, api path (dotted or segments), or module id
- `keyOrObj` (string | Object) - Metadata key, or an object of keys to merge
- `value` (\*) - Value when `keyOrObj` is a key

### api.slothlet.metadata.remove(target, key?)

Remove user metadata set on the target.

- `target` (Function | Object | string | string[]) - Function or node, api path, or module id
- `key` (string | string[], optional) - Key(s) to remove; omit to remove all

### api.slothlet.metadata.get(target, options?)

Read user metadata (synchronous).

- `target` (Function | Object | string | string[]) - Function or node, api path, or module id
- `options.version` (string, optional) - Read that version of the logical path `target`

**Returns:** `Object`

### api.slothlet.node(target)

Report what slothlet knows about a node (see [Node Reports](#node-reports)).

- `target` (Function | Object | string | string[]) - Node, or its api path

**Returns:** `Object | undefined` (frozen)

**Throws:** `SlothletError("PERMISSION_DENIED")` when the caller may not reach the target.

---

### Runtime Introspection (from within modules)

Use `self.slothlet.metadata.*` and `self.slothlet.node()` from within any slothlet-loaded module via the `self` proxy:

```javascript
import { self } from "@cldmv/slothlet/runtime";
```

### self.slothlet.metadata.self()

Get the currently executing function, as a caller object (synchronous).

**Returns:** `{ path: string[], module: string|null, metadata: Object, version: Object|null }`

**Throws:** `SlothletError("RUNTIME_NO_ACTIVE_CONTEXT")` if called outside an active function execution context.

### self.slothlet.metadata.caller()

Get the function that called the current one, as a caller object (synchronous).

**Returns:** `Object | null` - The same shape as `self()`; `null` only when there is no module caller in context (host-initiated, or called directly from outside the API); it is carried across timers and callbacks. See [Handle null caller gracefully](#handle-null-caller-gracefully).

---

## See Also

- [Context Propagation](CONTEXT-PROPAGATION.md) - `context` object available alongside metadata
- [Hooks](HOOKS.md) - Use hooks to intercept calls based on metadata
- [README](../README.md) - Main project documentation
