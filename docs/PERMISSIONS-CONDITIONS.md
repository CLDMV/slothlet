# Permission Rule Conditions

Permission rules may include an optional `condition` field that is evaluated against the **per-request runtime context** at the moment the permission check fires. When a condition does not match, the rule is treated as absent — other rules continue to be evaluated normally.

A **function** condition additionally receives the invocation's own arguments and the concrete target path as a second argument — `condition(ctx, { args, target })` — so it can authorize on the **resource named in the call itself**, not just ambient context (a "resource-scoped gate"). See [Function](#function) and [Resource-Scoped Gates](#resource-scoped-gates).

Rules **without** a `condition` field always participate in evaluation regardless of any active context.

> **See also:** [PERMISSIONS.md](./PERMISSIONS.md) for the full permission system reference.

---

## Table of Contents

- [The Runtime Context](#the-runtime-context)
- [Condition Forms](#condition-forms)
  - [Plain Object](#plain-object)
  - [Function](#function)
  - [Array (OR semantics)](#array-or-semantics)
- [Behavior Reference](#behavior-reference)
- [Validation](#validation)
- [Caching](#caching)
- [Declaring Conditions via `api.add` Shorthand](#declaring-conditions-via-apiadd-shorthand)
- [Audit Events](#audit-events)
- [Common Patterns](#common-patterns)
  - [Multi-Tenant Routing](#multi-tenant-routing)
  - [Role-Based Access](#role-based-access)
  - [Combining With Default Policy](#combining-with-default-policy)
  - [Resource-Scoped Gates](#resource-scoped-gates)

---

## The Runtime Context

The runtime context is the object passed as the first argument to `api.slothlet.context.run()`, **shallow-merged onto any context already active** — the instance-level `context` from `slothlet({ context })`, plus any enclosing `run()` / `scope()`:

```javascript
await api.slothlet.context.run({ tenant: "acme", role: "admin" }, async () => {
	// All permission checks that fire inside this callback receive:
	// { tenant: "acme", role: "admin" }
	// as their runtime context.
	await api.billing.getInvoices();
});
```

When a condition (function or plain object) is evaluated, it receives this merged context. If no `context.run()` is currently active, it receives the instance-level context configured via `slothlet({ context })` — or `{}` when none was configured. Function conditions receive this directly; plain object conditions match against it (against `{}`, all key checks fail).

---

## Condition Forms

### Plain Object

Every key-value pair in the condition object must match the runtime context by strict equality (`===`). Nesting is fully supported — sub-objects are recursed and every **leaf value** must match. Extra keys present in the runtime context at any level are ignored.

```javascript
// Flat: context must have { service: "premium" }
{
	caller: "callers.**",
	target: "payments.**",
	effect: "allow",
	condition: { service: "premium" }
}
```

```javascript
// Nested: context.user.role must === "admin" AND context.user.active must === true
// Other keys on context (e.g. context.user.name) are ignored
{
	caller: "callers.**",
	target: "admin.**",
	effect: "allow",
	condition: { user: { role: "admin", active: true } }
}
```

**Missing key behavior:** If a key named in the condition does not exist in the runtime context, it is treated as a non-match. `context.role` being `undefined` does not equal any condition value.

**Leaf value types:** Leaf values are compared with `===`. Booleans, numbers, strings, and `null` all work. Do not use nested arrays or non-plain-object values as leaf values — those cannot be matched by this system and should instead be handled with a function condition.

### Function

The function is called with the full runtime context object and must return a truthy value to indicate a match. Exceptions thrown by the function are caught and treated as a non-match — they do not propagate to the caller.

```javascript
{
	caller: "callers.**",
	target: "admin.**",
	effect: "allow",
	condition: (ctx) => ctx.role === "admin" && ctx.verified === true
}
```

The function receives the same object the user passed to `context.run()`, or `{}` if no run is active. It may inspect any field at any depth.

#### Second argument: call metadata (`callMeta`)

At a **call** or **construct** gate the function condition also receives a second argument, `callMeta`, carrying the invocation's own details:

| Field    | Type       | Meaning                                                      |
| -------- | ---------- | ------------------------------------------------------------ |
| `args`   | `Array<*>` | The arguments the target leaf was called / constructed with. |
| `target` | `string`   | The **concrete** (post-glob) target api path being invoked.  |

```javascript
// Authorize on the resource identified in the call itself — no context ceremony at the call site:
{
	caller: "**",
	target: "project.get",
	effect: "allow",
	condition: (ctx, { args }) => hasRole(ctx.caller, args[0], "read")
}
```

`callMeta` is provided at the **call** gate (`self.x.leaf(...)`), the **construct** gate (`new self.x.Foo(...)`), and when a **captured reference** (`const f = self.x.leaf; f(...)`) is later invoked — all three see the invocation's real arguments. It is **`null`** everywhere else a condition is evaluated: terminal-value **reads**, **hook** gating, **event** delivery, the internal `slothlet.*` control surface, and silent queries (`permissions.global.checkAccess`, `permissions.self.access`, `matchesCondition`). Because `target` is the concrete leaf (never the rule's glob), one `**`-globbed rule can branch on exactly which leaf was called.

**Write `callMeta`-reading conditions defensively.** Since `callMeta` can be `null`, guard the access — `(ctx, meta) => meta?.args?.[0] === id` — or scope the rule to a `target` that only ever gates at a call/construct site. A condition that throws (including a `TypeError` from reading `args` on a `null` `callMeta`) is caught and treated as a non-match, never an implicit allow.

**Security note:** If the function throws, the condition is treated as non-match — meaning the rule does not fire. If the rule is an `allow` rule, a throwing condition results in the rule not matching, which may lead to a `deny` from another rule or the default policy. Always write condition functions that are safe to call with an empty object (and a `null` `callMeta`).

### Array (OR semantics)

An array of plain objects and/or functions. The condition matches when **any one** entry matches — evaluation short-circuits at the first match. This enables OR-style conditions without requiring a function.

```javascript
// Allow if the request is either premium-service OR made by an admin
{
	caller: "callers.**",
	target: "payments.**",
	effect: "allow",
	condition: [
		{ service: "premium" },
		(ctx) => ctx.role === "admin"
	]
}
```

Each entry in the array is evaluated independently using the same rules as its standalone form:

- Plain object entries use `deepObjectMatches` (all keys must match)
- Function entries are called with the full context; exceptions are non-match

An empty array `[]` is rejected at `addRule()` time.

---

## Behavior Reference

| Situation                                                | Result                                                                                           |
| -------------------------------------------------------- | ------------------------------------------------------------------------------------------------ |
| No `condition` on rule                                   | Rule always participates; context is irrelevant                                                  |
| `condition` is `null` or `undefined`                     | Treated as absent — rule always participates                                                     |
| `condition` is plain object                              | Every leaf must match via `===`; nesting is recursed; extra keys ignored                         |
| `condition` is function                                  | Called with full context (or `{}`); truthy return = match                                        |
| `condition` is array                                     | OR semantics — any one entry matching is sufficient                                              |
| Function throws                                          | Treated as non-match; exception is swallowed; rule does not fire                                 |
| No active `context.run()`                                | Context passed to condition evaluation is `{}`                                                   |
| Object condition, key absent                             | Non-match (`undefined !== any value`)                                                            |
| Object condition, nested key absent                      | Non-match — missing intermediate key means `deepObjectMatches` receives `undefined` as candidate |
| Array condition, all entries non-match                   | Non-match — rule does not fire                                                                   |
| Function condition at a call/construct gate              | Receives `(ctx, { args, target })` — the call's arguments and the concrete target path           |
| Function condition on a captured reference invoked later | Also receives the real `{ args, target }` of that invocation                                     |
| Function condition off the call/construct path           | Second argument is `null` (reads, hooks, events, control surface, silent queries)                |

---

## Validation

`addRule()` validates the `condition` field at registration time. Invalid conditions throw `INVALID_PERMISSION_RULE` immediately — the rule is never stored.

**Accepted values for `condition`:**

| Value                                                        | Accepted                      |
| ------------------------------------------------------------ | ----------------------------- |
| `undefined` / `null`                                         | Yes — treated as no condition |
| Plain object (own prototype is `Object.prototype` or `null`) | Yes                           |
| Function                                                     | Yes                           |
| Array where every entry is a plain object or function        | Yes                           |
| Primitive (string, number, boolean, symbol, bigint)          | **No** — throws               |
| Array containing a primitive entry                           | **No** — throws               |
| Empty array `[]`                                             | **No** — throws               |
| Class instance (custom prototype)                            | **No** — throws               |

**Why primitives are rejected:** A condition is a _context matcher_ — it describes properties of the per-request runtime context. A bare primitive like `"admin"` has no defined semantics as a context matcher. Use a function condition if you need arbitrary matching logic.

---

## Caching

When **any** candidate rule for a given caller→target pair carries a `condition` field, the resolved result is **not written to the permission cache**. The same caller→target pair may produce different allow/deny outcomes under different request contexts, so caching would produce incorrect results.

Rules without `condition` are unaffected — they continue to be cached as before.

This means conditional rules have a small per-call overhead compared to unconditional rules. In the common case (most rules have no condition, only a few tenant/role gates do), the overhead is minimal.

---

## Declaring Conditions via `api.add` Shorthand

The `permissions` shorthand on `api.slothlet.api.add()` accepts `{ target, condition }` objects inside the `allow` and `deny` arrays alongside plain target strings:

```javascript
await api.slothlet.api.add("payments", "./payments", {
	permissions: {
		deny: [
			"admin.**", // plain string, no condition
			{ target: "billing.**", condition: { tenant: "trial" } } // conditional deny
		],
		allow: ["db.read", { target: "db.write.**", condition: (ctx) => ctx.role === "billing" }]
	}
});
```

Each object entry in the array must have a `target` string. The `condition` field is optional and follows the same validation rules as `addRule()`.

---

## Audit Events

The `permission:allowed` and `permission:denied` lifecycle events include a `conditionMatched` field in their payload (the `permission:default` and `permission:self-bypass` events do not):

| Field              | Value   | Meaning                                                 |
| ------------------ | ------- | ------------------------------------------------------- |
| `conditionMatched` | `true`  | The winning rule had a `condition` field and it matched |
| `conditionMatched` | `false` | The winning rule had no `condition` field               |

```javascript
api.slothlet.lifecycle.on("permission:denied", ({ caller, target, rule, conditionMatched, timestamp }) => {
	if (conditionMatched) {
		logger.warn("Condition-gated deny fired", { caller, target, ruleId: rule.id });
	} else {
		logger.warn("Static deny fired", { caller, target, ruleId: rule.id });
	}
});
```

---

## Common Patterns

### Multi-Tenant Routing

Isolate tenants from each other's resources using conditions on shared API paths:

```javascript
const api = await slothlet({
	dir: "./api",
	permissions: {
		defaultPolicy: "deny",
		rules: [
			// Allow tenant-a modules to reach tenant-a data
			{ caller: "**", target: "data.tenantA.**", effect: "allow", condition: { tenant: "tenant-a" } },
			// Allow tenant-b modules to reach tenant-b data
			{ caller: "**", target: "data.tenantB.**", effect: "allow", condition: { tenant: "tenant-b" } }
		]
	}
});

// Per-request context wraps each incoming request
await api.slothlet.context.run({ tenant: "tenant-a" }, async () => {
	await api.callers.someModule.doWork(); // → can reach data.tenantA, blocked from data.tenantB
});
```

### Role-Based Access

Combine unconditional base rules with conditional overrides:

```javascript
// Global deny for sensitive operations
{ caller: "**", target: "admin.**", effect: "deny" }

// Admin role override
{
	caller: "**",
	target: "admin.**",
	effect: "allow",
	condition: (ctx) => ctx.role === "admin"
}
```

Because the two rules are equally specific, the last-registered rule (the allow) wins the tiebreak when it applies — and because conditions are evaluated independently, the allow rule only applies when `ctx.role === "admin"`: so when the role is admin the allow fires, otherwise the allow is absent and the deny rule wins.

### Combining With Default Policy

With `defaultPolicy: "deny"`, conditions can open specific paths per context rather than using broad allow rules:

```javascript
const api = await slothlet({
	dir: "./api",
	permissions: {
		defaultPolicy: "deny",
		rules: [
			// Only allow the billing module to be reached when the request is flagged as internal
			{ caller: "**", target: "billing.**", effect: "allow", condition: { internal: true } }
		]
	}
});

// Public-facing requests (no context.run or ctx.internal !== true) → all billing calls denied
// Internal service calls → billing calls allowed
await api.slothlet.context.run({ internal: true }, async () => {
	await api.orchestrator.runBillingJob();
});
```

### Resource-Scoped Gates

A context-level condition can express "may this caller reach `project.get` at all"; it cannot express "may this caller `read` **the specific project whose id is in the call**", because the resource is an argument, not ambient context. The function condition's second argument (`callMeta`) closes that gap — the rule reads the resource straight out of `args`, so the call site needs no ceremony:

```javascript
const api = await slothlet({
	dir: "./api",
	permissions: {
		defaultPolicy: "deny",
		rules: [
			// The predicate names the resource from the call's own arguments.
			{ caller: "**", target: "project.get", effect: "allow", condition: (ctx, { args }) => hasRole(ctx.caller, args[0], "read") },
			{ caller: "**", target: "project.update", effect: "allow", condition: (ctx, { args }) => hasRole(ctx.caller, args[0], "write") }
		]
	}
});

// No wrap, no id injected into context — the id is the call argument the condition already sees:
await self.project.get(projectId);
```

One `**`-globbed rule can serve many leaves and branch on `callMeta.target`, the concrete leaf that was called:

```javascript
{
	caller: "**",
	target: "project.**",
	effect: "allow",
	// "project.get" needs read; anything else under project.** needs write.
	condition: (ctx, { args, target }) => hasRole(ctx.caller, args[0], target === "project.get" ? "read" : "write")
}
```

This is the declarative replacement for hand-rolled per-resource wrappers (a `GATE` map plus a `_leaf` wrapper that reads `args[0]`): the **mechanism** is slothlet's enforcement, the **identity** is injected by the host via `context.run({ caller })`, and the **predicate** is supplied by the application. Guard `callMeta` for `null` (see [Function](#function)) if the same rule could also match a non-call gate.
