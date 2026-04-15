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
- [Permission Rules](#permission-rules)
- [Declaring Permissions](#declaring-permissions)
- [Evaluation Order](#evaluation-order)
- [Self-Call Bypass](#self-call-bypass)
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
		defaultPolicy: "deny",       // "allow" (default) or "deny"
		enabled: true,               // global toggle (default: true when permissions config is provided)
		audit: "verbose",            // "default" or "verbose"
		rules: [
			{ caller: "**", target: "slothlet.api.*", effect: "deny" },
			{ caller: "admin.**", target: "slothlet.api.*", effect: "allow" }
		]
	}
});
```

### Configuration Options

| Option          | Type      | Default   | Description                                                             |
|-----------------|-----------|-----------|-------------------------------------------------------------------------|
| `defaultPolicy` | `string`  | `"allow"` | Fallback when no rule matches: `"allow"` or `"deny"`                    |
| `enabled`       | `boolean` | `true`    | Global toggle; when `false`, all calls are allowed without evaluation. Defaults to `true` when a `permissions` config block is provided; the system is off entirely when no config is provided. |
| `audit`         | `string`  | `"default"` | Audit level: `"default"` (denied + self-bypass only) or `"verbose"` (all decisions) |
| `rules`         | `array`   | `[]`      | Array of rule objects applied at initialization (earliest stacking order) |

When `permissions` is not provided or `undefined`, the permission system is **disabled** — `isEnabled()` returns `false` and no permission checks run. Existing users pay zero runtime cost.

---

## Permission Rules

A rule is a plain object with three required fields:

```javascript
{
	caller: "payments.**",    // glob pattern matching caller API paths
	target: "db.write",       // glob pattern matching target API paths
	effect: "allow"           // "allow" or "deny"
}
```

**Path convention:** Rules use the **API tree path**, not the user-land variable name. The variable holding the Slothlet instance (commonly `api`) is not part of the path. What the user accesses as `api.slothlet.api.add(...)` is targeted as `slothlet.api.*` in a rule.

### Pattern Syntax

| Pattern | Matches                                      |
|---------|----------------------------------------------|
| `*`     | Any single path segment                      |
| `**`    | Any number of path segments (including zero)  |
| `?`     | Any single character                         |
| `{a,b}` | Either `a` or `b` (brace expansion)          |
| `!pat`  | Negation — matches everything *except* `pat` |

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

## API Surface — api.slothlet.permissions

The permissions namespace is organized into four groups:

### Top-Level — Mutation Operations

| Method | Description |
|--------|-------------|
| `addRule(rule)` | Add a permission rule. Returns the rule ID. Gated by `config.api.mutations.permissions`. |
| `removeRule(ruleId)` | Remove a rule by ID. Self-modification blocked (throws `PERMISSION_SELF_MODIFY`). |

### `self.*` — Always Available

Scoped to the calling module via its context. A module can always introspect its own permissions.

| Method | Description |
|--------|-------------|
| `self.access(target)` | Check if the calling module is allowed to reach `target`. Returns `boolean`. |
| `self.rules()` | List all rules where the caller pattern matches the calling module's path. |

### `global.*` — Gatable Diagnostics

Cross-module inspection. Can be independently denied with a single rule on `slothlet.permissions.global.**`.

| Method | Description |
|--------|-------------|
| `global.checkAccess(caller, target)` | Check if an arbitrary `caller` path is allowed to reach `target`. Returns `boolean`. |
| `global.rulesForPath(path)` | List all rules matching a given target path. |
| `global.rulesByModule(moduleID)` | List all rules owned by a given module. |

### `control.*` — Global Toggles (Deny-by-Default)

Controls the global enforcement state. A built-in rule automatically denies all modules from calling these methods:

```javascript
{ caller: "**", target: "slothlet.permissions.control.**", effect: "deny" }
```

To allow a trusted module to toggle permissions, add a more specific allow rule:

```javascript
{ caller: "admin.**", target: "slothlet.permissions.control.**", effect: "allow" }
```

| Method | Description |
|--------|-------------|
| `control.enable()` | Enable permission enforcement globally. |
| `control.disable()` | Disable permission enforcement globally (all calls allowed). |

---

## Audit Events

The `PermissionManager` emits lifecycle events for enforcement decisions:

| Event | Payload | When | Emission |
|-------|---------|------|----------|
| `permission:denied` | `{ caller, target, rule, timestamp }` | A call was blocked | Always |
| `permission:self-bypass` | `{ caller, target, filePath, timestamp }` | A self-call was detected and bypassed | Always |
| `permission:allowed` | `{ caller, target, rule, timestamp }` | A call was explicitly allowed by a rule | `audit: "verbose"` only |
| `permission:default` | `{ caller, target, policy, timestamp }` | No rule matched; default policy applied | `audit: "verbose"` only |

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

The resolved cache is **fully cleared** whenever the rule set or module topology changes:

| Event | Why |
|-------|-----|
| `addRule()` / `removeRule()` | Rule set changed |
| `api.slothlet.api.add(...)` | New module may match existing rules |
| `api.slothlet.api.remove(...)` | Cached pairs involving removed module are stale |
| `api.slothlet.api.reload(...)` | Permissions or metadata may have changed |
| `enable()` / `disable()` | All cached results are invalid |

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

| Code | When |
|------|------|
| `PERMISSION_DENIED` | A call was blocked by a permission rule. Includes `caller` and `target` in the error context. |
| `PERMISSION_SELF_MODIFY` | A module attempted to remove its own permission rule. Includes `ruleId` and `moduleID`. |
| `INVALID_PERMISSION_RULE` | A malformed rule was passed to `addRule()`. Includes `reason` and `received`. |

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
