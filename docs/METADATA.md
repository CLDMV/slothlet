# Metadata System

The metadata system provides secure, immutable function tagging and runtime introspection for authorization, auditing, and multi-tenant architectures. Functions loaded through `addApi()` can carry both automatic system metadata and user-defined metadata that persists across calls and survives hot reloads.

## Overview

Every function loaded by slothlet automatically receives **system metadata** — immutable fields like `filePath`, `apiPath`, and `moduleID` that are set by the lifecycle system and cannot be overridden. On top of that, user code can attach **user metadata** at load time (via `addApi()`), at runtime (via `api.slothlet.metadata.*`), or globally (via `setGlobal()`).

All metadata is deeply frozen and protected by Proxy traps. No code can modify an existing metadata value — modifications must go through the metadata API, which creates updated internal state and merges fresh frozen objects on the next read.

## Table of Contents

- [Metadata Types](#metadata-types)
- [Setting Metadata at Load Time](#setting-metadata-at-load-time)
- [Runtime Metadata API](#runtime-metadata-api)
- [Runtime Introspection](#runtime-introspection)
- [Metadata Lookup Priority](#metadata-lookup-priority)
- [System Metadata Fields](#system-metadata-fields)
- [Immutability](#immutability)
- [Hot Reload Behavior](#hot-reload-behavior)
- [Lazy Mode Considerations](#lazy-mode-considerations)
- [Security Considerations](#security-considerations)
- [Architecture Patterns](#architecture-patterns)
- [Performance Notes](#performance-notes)
- [API Reference](#api-reference)

---

## Metadata Types

### System Metadata

Automatically tagged by the lifecycle system when a module is loaded or reloaded. Always wins over user metadata — system fields cannot be overridden.

```javascript
{
	filePath: "/absolute/path/to/plugins/auth.mjs",
	sourceFolder: "/absolute/path/to/plugins",
	apiPath: "plugins.auth.login",
	moduleID: "module-id:plugins/auth/login",
	taggedAt: 1706400000000
}
```

### User Metadata

Provided by user code. Stored separately and merged with system metadata at read time. Three scopes:

| Scope | API | Priority |
|---|---|---|
| Global | `api.slothlet.metadata.setGlobal()` | Lowest |
| Path | `api.slothlet.metadata.setFor()` / `addApi()` | Middle |
| Function | `api.slothlet.metadata.set()` | Highest (overrides path and global, but not system) |

System metadata always wins regardless of user metadata scope.

---

## Setting Metadata at Load Time

Pass a metadata object as the third argument to `addApi()`:

```javascript
const api = await slothlet({ dir: "./api" });

await api.slothlet.api.addApi("plugins.trusted", "./trusted-plugins", {
	trusted: true,
	permissions: ["read", "write", "admin"],
	version: "1.0.0",
	author: "TeamSecurity"
});

await api.slothlet.api.addApi("plugins.external", "./third-party", {
	trusted: false,
	permissions: ["read"],
	sandbox: true
});

// Access metadata immediately
const meta = api.plugins.trusted.someFunc.__metadata;
console.log(meta.trusted);   // true
console.log(meta.version);   // "1.0.0"
console.log(meta.apiPath);   // "plugins.trusted.someFunc" (system field)
console.log(meta.filePath);  // absolute path (system field)
```

Empty metadata or no third argument produces no user metadata (only system metadata).

---

## Runtime Metadata API

`api.slothlet.metadata` exposes five methods for managing user metadata after load.

### setGlobal(key, value)

Set a global metadata value applied to all functions in the instance:

```javascript
api.slothlet.metadata.setGlobal("environment", "production");
api.slothlet.metadata.setGlobal("appVersion", "3.0.0");

// All functions now have these in __metadata
const meta = api.math.add.__metadata;
console.log(meta.environment); // "production"
console.log(meta.appVersion);  // "3.0.0"
```

### set(fn, key, value)

Set metadata on a specific function reference:

```javascript
api.slothlet.metadata.set(api.math.add, "description", "Adds two numbers");
api.slothlet.metadata.set(api.math.add, "category", "math");

console.log(api.math.add.__metadata.description); // "Adds two numbers"
```

### remove(fn, key?)

Remove user metadata from a function:

```javascript
// Remove a specific key
api.slothlet.metadata.remove(api.math.add, "description");

// Remove all user metadata for this function
api.slothlet.metadata.remove(api.math.add);
```

### setFor(pathOrModuleId, keyOrObj, value?)

Set metadata for all functions under an API path, without needing function references:

```javascript
// Single key
api.slothlet.metadata.setFor("math", "category", "math");

// Object merge — multiple keys at once
api.slothlet.metadata.setFor("math", { category: "math", version: "2.0.0" });

// Target a specific subpath
api.slothlet.metadata.setFor("math.add", "description", "Adds two numbers");
```

All functions whose `apiPath` starts with the given path inherit the values. Multiple calls to the same path are merged; later calls override earlier ones for conflicting keys. `setFor()` metadata survives `api.slothlet.reload()`.

Also accepts a `moduleID` from a prior `api.add()` call — the ID is resolved to its registered `apiPath` automatically.

### removeFor(pathOrModuleId, key?)

Remove path-level metadata:

```javascript
// Remove a single key
api.slothlet.metadata.removeFor("math", "category");

// Remove multiple keys
api.slothlet.metadata.removeFor("math", ["category", "version"]);

// Remove ALL path-level metadata
api.slothlet.metadata.removeFor("math");
```

Only affects metadata stored for that exact path segment — does not walk descendant paths or affect function-level (`set()`) metadata.

---

## Runtime Introspection

Import `metadataAPI` from `@cldmv/slothlet/runtime` to inspect metadata from within slothlet-loaded functions:

```javascript
import { metadataAPI } from "@cldmv/slothlet/runtime";
```

### metadataAPI.self()

Get the currently executing function's metadata:

```javascript
export async function chargeCard(amount) {
	const self = await metadataAPI.self();

	console.log(`Service: ${self.service}`);     // user metadata
	console.log(`Source: ${self.filePath}`);     // system metadata
	console.log(`Path: ${self.apiPath}`);        // system metadata
}
```

### metadataAPI.caller()

Get the metadata of the function that called the current function:

```javascript
export async function sensitiveOperation() {
	const caller = await metadataAPI.caller();

	if (!caller?.trusted) {
		throw new Error("Unauthorized: caller is not trusted");
	}

	if (!caller.permissions?.includes("admin")) {
		throw new Error("Admin permission required");
	}

	// Proceed
}
```

`caller()` uses V8 stack trace introspection to find the calling function. Returns `null` if the caller was not tracked by slothlet (e.g., external code, setTimeout callbacks, event emitter callbacks).

**Security warning detection**: If the caller's stack file path does not match the stored `filePath` metadata, the returned object includes:

```javascript
{
	...callerMeta,
	__securityWarning: "FILE_PATH_MISMATCH",
	__stackFile: "/actual/path/from/stack"
}
```

Check `__securityWarning` in security-sensitive code to detect potential tampering.

### metadataAPI.get(path)

Get metadata for any function by dot-notation path:

```javascript
export async function checkPlugin(task) {
	const pluginMeta = await metadataAPI.get("plugins.external.processTask");

	if (!pluginMeta?.trusted) {
		throw new Error("Cannot delegate to untrusted plugin");
	}

	return api.plugins.external.processTask(task);
}
```

---

## Metadata Lookup Priority

When `__metadata` is read, the system merges all metadata layers (lowest to highest priority):

| Layer | Source |
|---|---|
| 1 — Global | `api.slothlet.metadata.setGlobal()` |
| 2 — Path | `api.slothlet.metadata.setFor()`, `addApi()` metadata |
| 3 — Function | `api.slothlet.metadata.set()` |
| 4 — System | `filePath`, `sourceFolder`, `apiPath`, `moduleID`, `taggedAt` |

**System metadata always wins.** User code cannot override `filePath`, `apiPath`, `moduleID`, `sourceFolder`, or `taggedAt`.

---

## System Metadata Fields

| Field | Type | Description |
|---|---|---|
| `filePath` | string | Absolute path to the source file |
| `sourceFolder` | string | Absolute path to the directory the file was loaded from |
| `apiPath` | string | Dot-notation path within the API tree (e.g. `"math.add"`) |
| `moduleID` | string | Unique module identifier including API path (e.g. `"mod:math/add"`) |
| `taggedAt` | number | Epoch millisecond when the function was tagged |

---

## Immutability

All metadata returned from `__metadata` is deeply frozen via `Object.freeze()` plus a Proxy guard:

```javascript
const meta = api.plugins.someFunc.__metadata;

// None of these mutate metadata (TypeError in strict mode, silent fail otherwise)
meta.trusted = false;           // blocked
meta.config.timeout = 1000;    // blocked — nested objects frozen too
meta.permissions.push("admin"); // blocked — arrays frozen too
delete meta.trusted;            // blocked

// To update user metadata, use the explicit API:
api.slothlet.metadata.set(api.plugins.someFunc, "trusted", false);
```

---

## Hot Reload Behavior

### Metadata survives full reload

User metadata set via `set()` and `setGlobal()` is automatically preserved across `api.slothlet.reload()`:

```javascript
api.slothlet.metadata.set(api.math.add, "category", "math");
api.slothlet.metadata.setGlobal("appVersion", "3.0.0");

await api.slothlet.reload();

// Both values still present after reload
console.log(api.math.add.__metadata.category);   // "math"
console.log(api.math.add.__metadata.appVersion); // "3.0.0"
```

`setFor()` path-level metadata also survives reload without extra steps.

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
api.slothlet.metadata.setFor("plugins", "version", "2.0.0");
```

---

## Lazy Mode Considerations

In lazy mode, modules are not loaded until first call. Metadata is only available after a function has been materialized:

```javascript
const api = await slothlet({ dir: "./api", mode: "lazy" });
await api.slothlet.api.addApi("plugins", "./plugins", { trusted: true });

// Module not yet loaded — only proxy exists
console.log(api.plugins.someFunc.__metadata); // undefined

// Trigger materialization
await api.plugins.someFunc();

// Metadata now available
console.log(api.plugins.someFunc.__metadata.trusted); // true
```

---

## Security Considerations

### Metadata as defense in depth

Metadata-based authorization is one layer — not a complete security solution:

```javascript
import { metadataAPI } from "@cldmv/slothlet/runtime";
import { context } from "@cldmv/slothlet/runtime";

export async function deleteUser(userId) {
	const caller = await metadataAPI.caller();

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

`caller()` returns `null` when the calling function is not tracked by slothlet:

```javascript
export async function protectedOp() {
	const caller = await metadataAPI.caller();

	if (!caller) {
		// No tracked caller — require explicit auth token
		if (!context.explicitAuthToken) {
			throw new Error("Authentication required");
		}
	} else if (!caller.trusted) {
		throw new Error("Unauthorized caller");
	}
}
```

**Contexts where `caller()` returns null:**
- `setTimeout` / `setInterval` callbacks
- Event emitter callbacks
- Deeply nested call stacks beyond V8 stack depth limits
- Code called from outside slothlet context

### Stack trace reliability

`caller()` depends on V8's `Error.prepareStackTrace()`. Reliable for direct function calls and async/await chains. May not return meaningful results in timer or event callbacks.

---

## Architecture Patterns

### Plugin Security System

```javascript
// Load different plugin tiers
await api.slothlet.api.addApi("plugins.core", "./core-plugins", {
	trusted: true,
	tier: "core",
	permissions: ["read", "write", "admin", "config"]
});

await api.slothlet.api.addApi("plugins.community", "./community-plugins", {
	trusted: false,
	tier: "community",
	permissions: ["read"]
});

// Enforce in sensitive functions
import { metadataAPI } from "@cldmv/slothlet/runtime";

export async function updateConfig(key, value) {
	const caller = await metadataAPI.caller();

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
await api.slothlet.api.addApi("tenants.acme", "./tenants/acme", {
	tenantId: "acme",
	tier: "enterprise",
	features: ["analytics", "api", "webhooks", "sso"],
	maxUsers: 1000
});

await api.slothlet.api.addApi("tenants.startup", "./tenants/startup", {
	tenantId: "startup",
	tier: "basic",
	features: ["analytics"],
	maxUsers: 10
});

// Enforce in feature code
export async function createWebhook(url, events) {
	const caller = await metadataAPI.caller();

	if (!caller?.features.includes("webhooks")) {
		throw new Error(`Webhooks not available on ${caller.tier} tier`);
	}

	return { id: "webhook_123", url, events };
}

export async function addUser(email) {
	const self = await metadataAPI.self();
	const currentUsers = await countUsers(self.tenantId);

	if (currentUsers >= self.maxUsers) {
		throw new Error(`User limit reached (${self.maxUsers} max)`);
	}

	return { id: "user_456", email };
}
```

### Audit Logging

```javascript
await api.slothlet.api.addApi("services.payment", "./services/payment", {
	service: "payment",
	version: "2.3.1",
	author: "TeamPayments",
	deployedAt: "2025-12-31T10:30:00Z",
	gitCommit: "a1b2c3d"
});

import { metadataAPI } from "@cldmv/slothlet/runtime";

export async function chargeCard(amount, cardId) {
	const caller = await metadataAPI.caller();
	const self = await metadataAPI.self();

	await logAudit({
		timestamp: new Date().toISOString(),
		operation: "chargeCard",
		amount,
		service: { name: self.service, version: self.version, commit: self.gitCommit },
		caller: { service: caller?.service, version: caller?.version }
	});

	return processCharge(amount, cardId);
}
```

---

## Performance Notes

| Operation | Approximate cost |
|---|---|
| `addApi()` metadata tagging | ~0.1 ms per module |
| `__metadata` property read | ~0.01 ms (Map lookup + freeze) |
| `metadataAPI.get()` | ~0.01 ms |
| `metadataAPI.caller()` | ~0.5–1 ms (V8 stack trace) |
| `metadataAPI.self()` | ~0.5–1 ms (V8 stack trace) |

Cache `caller()` and `self()` results within a function body — each call captures a new stack trace:

```javascript
// ✅ Cache at top of function
export async function handler(data) {
	const caller = await metadataAPI.caller(); // one stack capture
	const self = await metadataAPI.self();     // one stack capture

	if (caller?.trusted && self?.permissions) {
		// use cached values throughout
	}
}
```

---

## API Reference

### api.slothlet.metadata.setGlobal(key, value)

Set global metadata applied to all functions.

**Parameters:**
- `key` (string) — Metadata key
- `value` (*) — Metadata value

### api.slothlet.metadata.set(fn, key, value)

Set user metadata on a specific function.

**Parameters:**
- `fn` (Function) — Target function (must have system metadata)
- `key` (string) — Metadata key
- `value` (*) — Metadata value

### api.slothlet.metadata.remove(fn, key?)

Remove user metadata from a function.

**Parameters:**
- `fn` (Function) — Target function
- `key` (string | string[], optional) — Key(s) to remove; omit to remove all

### api.slothlet.metadata.setFor(pathOrModuleId, keyOrObj, value?)

Set metadata for all functions under an API path.

**Parameters:**
- `pathOrModuleId` (string) — Dot-notation path (`"math"`) or moduleID
- `keyOrObj` (string | Object) — Key string (with `value`) or metadata object to merge
- `value` (*) — Value when `keyOrObj` is a key string

### api.slothlet.metadata.removeFor(pathOrModuleId, key?)

Remove path-level metadata.

**Parameters:**
- `pathOrModuleId` (string) — Dot-notation path or moduleID
- `key` (string | string[], optional) — Key(s) to remove; omit to remove all

---

### metadataAPI (from @cldmv/slothlet/runtime)

```javascript
import { metadataAPI } from "@cldmv/slothlet/runtime";
```

### metadataAPI.self()

Get metadata of the current function.

**Returns:** `Promise<Object | null>`

### metadataAPI.caller()

Get metadata of the calling function.

**Returns:** `Promise<Object | null>`

**Note:** May return `null` when called from outside tracked slothlet context (timers, event callbacks, etc.).

### metadataAPI.get(path)

Get metadata for any function by dot-notation path.

**Parameters:**
- `path` (string) — Dot-notation API path (e.g. `"plugins.trusted.someFunc"`)

**Returns:** `Promise<Object | null>`

---

### Function.__metadata

Direct metadata access on any slothlet function:

```javascript
const meta = api.plugins.someFunc.__metadata;
```

Returns combined system + user metadata as a deeply frozen object. Returns `undefined` if no metadata exists for the function.

---

## See Also

- [Context Propagation](CONTEXT-PROPAGATION.md) — `context` object available alongside metadata
- [Hooks](HOOKS.md) — Use hooks to intercept calls based on metadata
- [README](../README.md) — Main project documentation
