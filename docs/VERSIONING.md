# API Path Versioning

API Path Versioning allows the same logical API path (e.g. `auth`) to be registered multiple times under different **version tags** (e.g. `v1`, `v2`). At call time, a **discriminator** resolves which version to invoke based on the calling module's registered version metadata. Both the direct versioned namespaces (`api.v1.auth`, `api.v2.auth`) and the logical dispatch path (`api.auth`) are kept live at all times.

## Overview

When you register the same logical path more than once with `versionConfig`, Slothlet:

1. Mounts each version at a namespaced path (e.g. `v1.auth`, `v2.auth`) in the live API tree.
2. Creates a **dispatcher proxy** at the logical path (`auth`) that transparently routes any property access to the correct versioned namespace at call time.
3. Uses a configurable **discriminator** to decide which version to route to based on who is calling.

**Key capabilities:**

- Transparent dispatch — callers use `api.auth.login(...)` without knowing which version runs
- Each version may have a completely different argument signature — the dispatcher never modifies args
- Both logical (`api.auth`) and versioned (`api.v1.auth`) paths are live simultaneously
- Default version auto-selected via highest-version algorithm when no explicit default is set
- Runtime control via `api.slothlet.versioning.*`
- Full lifecycle support: add, remove, reload, shutdown

## Table of Contents

- [Configuration](#configuration)
- [Registering Versioned APIs](#registering-versioned-apis)
- [Discriminator](#discriminator)
- [Caller Version Metadata](#caller-version-metadata)
- [Default Version Resolution](#default-version-resolution)
- [Argument Signature Compatibility](#argument-signature-compatibility)
- [Dispatcher Proxy Behavior](#dispatcher-proxy-behavior)
- [Inline Version Override](#inline-version-override)
- [Runtime API — api.slothlet.version](#runtime-api--apislothletversion)
- [Versioned vs Regular Metadata](#versioned-vs-regular-metadata)
- [Lifecycle](#lifecycle)
- [Error Reference](#error-reference)
- [Full Example](#full-example)

---

## Configuration

Configure the version discriminator when creating a slothlet instance:

```javascript
// String discriminator (default behavior — looks up key in caller's version metadata)
const api = await slothlet({
	dir: "./api",
	versionDispatcher: "version"
});

// Function discriminator (full control)
const api = await slothlet({
	dir: "./api",
	versionDispatcher: (allVersions, caller) => {
		if (caller.metadata.role === "admin") return "v2";
		return caller.version ?? null;
	}
});

// Not set / undefined — behaves exactly like versionDispatcher: "version"
const api = await slothlet({
	dir: "./api"
});
```

### Configuration Options

- **`versionDispatcher`** (`string | function | undefined`): Controls version routing at dispatch time.
  - **String**: the key to look up in the caller's version metadata (e.g. `"version"` reads `callerVersionMeta.version`)
  - **Function**: receives `(allVersions, caller)` objects, must return a version tag string or `null`/`undefined`
  - **Not set**: defaults to string `"version"` behavior

---

## Registering Versioned APIs

Pass a `versionConfig` object as the 4th argument to `api.slothlet.api.add`:

```javascript
// Mount v1 at api.v1.auth (logical dispatcher created at api.auth)
await api.slothlet.api.add("auth", "./api/v1", {}, {
	version: "v1",
	default: true,
	metadata: { deprecated: false, stable: true }
});

// Mount v2 at api.v2.auth (dispatcher updated to include v2)
await api.slothlet.api.add("auth", "./api/v2", {}, {
	version: "v2",
	metadata: { stable: true }
});
```

After both registrations:

- `api.auth` → dispatcher proxy (routes based on caller)
- `api.v1.auth` → real v1 module
- `api.v2.auth` → real v2 module

### `versionConfig` Fields

| Field | Type | Required | Description |
|---|---|---|---|
| `version` | `string` | **Yes** | The version tag (e.g. `"v1"`, `"2.3.0"`, `"beta"`) |
| `default` | `boolean` | No | Mark this version as the explicit default fallback |
| `metadata` | `object` | No | Version metadata stored in VersionManager (separate from `options.metadata`) |

> **Important**: `versionConfig.metadata` and `options.metadata` are two separate systems. `options.metadata` goes into the regular Metadata handler (accessible via `module.__metadata`). `versionConfig.metadata` goes into the VersionManager-only store (accessible via discriminator args and `api.slothlet.versioning.getVersionMetadata()`). They are never merged.

---

## Discriminator

The discriminator runs inside the dispatcher proxy every time a property is accessed on the logical path. It determines which version tag to use for the current call.

### String Discriminator

```javascript
const api = await slothlet({ dir: "./api", versionDispatcher: "version" });
```

At dispatch time, Slothlet reads `caller.versionMetadata["version"]` and uses that as the version tag. If the returned value is not a registered tag for the path, falls through to the default.

### Function Discriminator

```javascript
const api = await slothlet({
	dir: "./api",
	versionDispatcher: (allVersions, caller) => {
		// allVersions — { [versionTag]: { version, default, metadata, versionMetadata } }
		// caller      — { version, default, metadata, versionMetadata }
		if (caller.versionMetadata?.stable === false) return "v1"; // route unstable callers to v1
		return caller.version ?? null;
	}
});
```

#### `allVersions` argument

An object keyed by version tag containing info about every registered version for this path:

```javascript
{
	v1: {
		version: "v1",               // the version tag
		default: true,               // whether this is the default version
		metadata: { ... },           // regular Metadata system data (system + user, from options.metadata)
		versionMetadata: { ... }     // VersionManager-only data (from versionConfig.metadata)
	},
	v2: {
		version: "v2",
		default: false,
		metadata: { ... },
		versionMetadata: { deprecated: false, stable: true }
	}
}
```

#### `caller` argument

Info about the module that is accessing the logical path:

```javascript
{
	version: "v2",               // caller's registered version tag (null if unversioned)
	default: false,              // whether the caller's version is the default (null if unversioned)
	metadata: { ... },           // caller's regular Metadata (system + user, exactly what metadata.caller() returns)
	versionMetadata: { ... }     // caller's VersionManager-only data (null if caller is not version-registered)
}
```

### Fallback Behavior

| Discriminator result | What happens |
|---|---|
| Valid version tag | Route to that version |
| Invalid / not registered | Fall through to default |
| `null` / `undefined` | Fall through to default |
| No default exists | Throw `VERSION_NO_DEFAULT` |

---

## Caller Version Metadata

To have the discriminator route a module to a specific version, register version metadata on that module using the VersionManager at add time:

```javascript
// Register a caller module with a version tag
const callerModuleID = await api.slothlet.api.add("callers", "./api/callers", {}, {
	version: "v2",
	metadata: { stable: true }
});
```

When this caller module calls `api.auth.login(...)`, the string discriminator reads `caller.versionMetadata.version` → `"v2"` and routes to `api.v2.auth.login`.

---

## Default Version Resolution

When the discriminator returns nothing resolvable, or when there is no discriminator match, Slothlet automatically selects a default version using this algorithm:

1. Look for any registered version where `versionConfig.default === true` — return the first match.
2. If none, collect all registered version tags and normalize them:
   - Strip leading non-numeric prefix characters (e.g. `"v"`, `"V"`, `"ver-"`)
   - Strip any pre-release / build suffix (e.g. `-alpha`, `-beta`, `+build`)
   - Parse the remaining string as `[major, minor, patch]` (missing parts default to `0`)
3. Sort descending by `[major, minor, patch]` tuple.
4. Return the **original** (un-normalized) tag of the highest entry.
5. If no versions exist → return `null`.

### Examples

```text
Tags: ["v1", "v3", "v8", "v2"]
→ Normalized: [1,0,0], [3,0,0], [8,0,0], [2,0,0]
→ Default: "v8"
```

```text
Tags: ["v1", "2.0.0-alpha", "2.0.0", "v1.5"]
→ Normalized: [1,0,0], [2,0,0], [2,0,0], [1,5,0]
→ Tiebreak: "2.0.0" wins over "2.0.0-alpha" (pre-release is stripped, stable first)
→ Default: "2.0.0"
```

### Explicit Default

```javascript
await api.slothlet.api.add("auth", "./api/v1", {}, { version: "v1", default: true });
await api.slothlet.api.add("auth", "./api/v2", {}, { version: "v2" });
// Default is "v1" regardless of version comparison
```

### Override Default at Runtime

```javascript
api.slothlet.versioning.setDefault("auth", "v2");
// Now "v2" is the explicit default for this path
```

---

## Argument Signature Compatibility

The dispatcher intercepts **property access only** — it never intercepts function invocation. Different versions may have completely different argument signatures with no special handling required:

```javascript
api.auth.login(user, password)           // v1 — 2 args
api.auth.login(user, password, mfa)      // v2 — 3 args
api.auth.login(token)                    // v3 — 1 arg
```

What happens at runtime when a caller invokes `api.auth.login(user, password, mfa)`:

1. `api.auth` → returns the dispatcher proxy
2. `.login` → dispatcher `get` trap fires, resolves version tag → `api.v2.auth.login` is returned
3. `(user, password, mfa)` → the caller directly invokes the returned function reference

The dispatcher never sees or modifies arguments. Each versioned function handles its own parameter list exactly as defined.

---

## Dispatcher Proxy Behavior

The dispatcher at the logical path (`api.auth`) behaves like a real API namespace:

| Property | Returns |
|---|---|
| `__apiPath` | `"auth"` (the logical path) |
| `__isCallable` | `false` |
| `__mode` | `"eager"` |
| `__moduleID` | `"versionDispatcher:auth"` |
| `__metadata` | metadata of the resolved version |
| `__filePath` | filepath of the resolved version |
| `toString()` | `"[VersionDispatcher: auth]"` |
| `then` | `undefined` (not a Promise) |

Calling the dispatcher directly as a function throws `VERSION_DISPATCH_NOT_CALLABLE`.

---

## Inline Version Override

Force a specific version for the current call using the ALS context symbol:

```javascript
import { context } from "@cldmv/slothlet/runtime";

// Force v1 for this call, bypassing the discriminator
context[Symbol.for("slothlet.versioning.force")] = "v1";
const result = await api.auth.login(user, password);
```

This is useful for testing, admin overrides, or when the calling module needs to explicitly pin to a version.

---

## Runtime API — api.slothlet.version

### `api.slothlet.versioning.list(logicalPath)`

List all registered versions for a logical path.

```javascript
const info = api.slothlet.versioning.list("auth");
// {
//   versions: {
//     v1: { moduleID, versionTag, versionedPath, isDefault, versionMeta, registeredAt },
//     v2: { ... }
//   },
//   default: "v2"
// }
```

### `api.slothlet.versioning.setDefault(logicalPath, versionTag)`

Override the default version for a logical path at runtime.

```javascript
api.slothlet.versioning.setDefault("auth", "v1");
```

### `api.slothlet.versioning.unregister(logicalPath, versionTag)`

Unregister a specific version. If other versions remain, the dispatcher is updated. If no versions remain, the dispatcher is torn down and the logical path is removed from the API tree.

```javascript
const wasRemoved = await api.slothlet.versioning.unregister("auth", "v2");
// api.v2.auth is gone; api.auth dispatcher now routes to v1 only
```

### `api.slothlet.versioning.getVersionMetadata(moduleID)`

Retrieve the VersionManager-only metadata stored for a module ID.

```javascript
const meta = api.slothlet.versioning.getVersionMetadata("auth.v1");
// { version: "v1", logicalPath: "auth", deprecated: false, stable: true }
```

---

## Versioned vs Regular Metadata

Two separate metadata systems coexist for versioned modules:

| System | Set via | Read via | Contains |
|---|---|---|---|
| Regular Metadata | `options.metadata` in `api.add` | `module.__metadata` / `metadata.caller()` | System + user module metadata |
| Version Metadata | `versionConfig.metadata` in `api.add` | `api.slothlet.versioning.getVersionMetadata()` / discriminator args | VersionManager-only version data |

These two objects are **never merged**. The discriminator args expose both in separate named fields (`metadata` and `versionMetadata`) so the function can read from either independently.

---

## Lifecycle

### Add

Each call to `api.slothlet.api.add` with a `versionConfig` mounts the module at `${version}.${path}` and updates (or creates) the dispatcher at the logical path.

### Remove

```javascript
// Remove a specific versioned module by path
await api.slothlet.api.remove("v2.auth");
// Equivalent to calling api.slothlet.versioning.unregister("auth", "v2")

// Remove the dispatcher itself (versioned namespaces remain)
await api.slothlet.api.remove("auth");
// Removes the dispatcher only — api.v1.auth and api.v2.auth remain live
```

### Reload

```javascript
// Reload a specific versioned module
await api.slothlet.api.reload({ apiPath: "v2.auth" });
// Module source is reloaded; dispatcher is updated with refreshed metadata
```

### Full Instance Reload

`slothlet.reload()` replays all `api.add` operations in order. Each versioned registration is replayed with its original `versionConfig`, rebuilding the VersionManager state naturally.

### Shutdown

`await api.shutdown()` clears all VersionManager state including the version registry, metadata store, and all dispatcher proxies.

---

## Error Reference

| Code | When it occurs |
|---|---|
| `INVALID_CONFIG_VERSION_DISPATCHER` | `versionDispatcher` is not a string or function |
| `INVALID_CONFIG_VERSION_TAG` | `versionConfig.version` is missing or not a non-empty string |
| `VERSION_NOT_FOUND` | Requested version tag is not registered for the path |
| `VERSION_NO_DEFAULT` | No default version and discriminator returned nothing resolvable |
| `VERSION_DISPATCH_NOT_CALLABLE` | Dispatcher at logical path was called directly as a function |
| `VERSION_REGISTER_DUPLICATE` | Same version tag registered twice at the same path |
| `VERSION_DISCRIMINATOR_INVALID_RETURN` | Function discriminator returned an unrecognized version tag |

---

## Full Example

```javascript
import { slothlet } from "@cldmv/slothlet";

const api = await slothlet({
	dir: "./api/base",
	versionDispatcher: "version"
});

// Mount v1 as the default
await api.slothlet.api.add("auth", "./api/v1/auth", {}, {
	version: "v1",
	default: true,
	metadata: { stable: true, deprecated: false }
});

// Mount v2
await api.slothlet.api.add("auth", "./api/v2/auth", {}, {
	version: "v2",
	metadata: { stable: true, deprecated: false }
});

// --- Both paths live ---
const v1result = await api.v1.auth.login("alice", "pass");  // always v1
const v2result = await api.v2.auth.login("alice", "pass", "mfa-token");  // always v2

// --- Dispatcher routes based on caller's version metadata ---
// If calling module was registered with { version: "v2" }, api.auth routes to v2
const result = await api.auth.login("alice", "pass", "mfa-token");

// --- Runtime introspection ---
const info = api.slothlet.versioning.list("auth");
console.log(info.default); // "v1"

// --- Unregister v2 ---
await api.slothlet.versioning.unregister("auth", "v2");
// api.v2.auth is gone; api.auth dispatcher now routes to v1 only

await api.shutdown();
```
