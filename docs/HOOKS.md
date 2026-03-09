# Hook System

The Hook System is a comprehensive interceptor framework for API function calls. It enables you to intercept, modify, and observe function execution with minimal overhead and maximum flexibility.

## Overview

Hooks work across all loading modes (eager/lazy) and runtime types (async/live), providing a unified API for function interception regardless of your slothlet configuration.

**Key capabilities:**

- Four hook types: `before`, `after`, `always`, and `error`
- Pattern matching with wildcards, brace expansion, and negation
- Priority-based execution ordering within three-phase subsets
- Runtime enable/disable globally or by filter
- Short-circuit execution support
- Synchronous hooks with correct async function handling
- Zero-overhead when disabled

## Table of Contents

- [Hook Configuration](#hook-configuration)
- [Hook Types](#hook-types)
- [Basic Usage](#basic-usage)
- [Hook Handler Context](#hook-handler-context)
- [Short-Circuit Execution](#short-circuit-execution)
- [Pattern Matching](#pattern-matching)
- [Priority and Chaining](#priority-and-chaining)
- [Hook Subsets](#hook-subsets)
- [Runtime Control](#runtime-control)
- [Hook Management](#hook-management)
- [Error Handling](#error-handling)
- [Error Source Tracking](#error-source-tracking)
- [Sync and Async Function Behavior](#sync-and-async-function-behavior)

---

## Hook Configuration

Hooks are configured when creating a slothlet instance:

```javascript
// Enable hooks (simple boolean)
const api = await slothlet({
	dir: "./api",
	hook: true
});

// Enable with default pattern filter
const api = await slothlet({
	dir: "./api",
	hook: "database.*" // Only intercept database functions by default
});

// Full configuration object
const api = await slothlet({
	dir: "./api",
	hook: {
		enabled: true,
		pattern: "**",
		suppressErrors: false
	}
});
```

### Configuration Options

- **`enabled`** (boolean): Enable or disable hook execution
- **`pattern`** (string): Default pattern filter for which functions hooks apply to
- **`suppressErrors`** (boolean): Control error throwing behavior
  - `false` (default): Errors are sent to error hooks AND then re-thrown
  - `true`: Errors are sent to error hooks but NOT thrown (returns `undefined`)

### Error Suppression

Error hooks **always receive errors** regardless of this setting. `suppressErrors` only controls whether the error is thrown after all error hooks have executed.

> Hooks (including error hooks) only execute when `hook.enabled: true`. If hooks are disabled entirely, errors throw normally with no hook execution.

```javascript
const api = await slothlet({
	dir: "./api",
	hook: { enabled: true, suppressErrors: true }
});

api.slothlet.hook.on("error:**", ({ path, error }) => {
	console.error(`Error in ${path}:`, error.message);
	// Send to monitoring service
});

const result = await api.riskyOperation();
if (result === undefined) {
	// Operation failed silently - error hook was called
}
```

### Error Flow

1. Error occurs (in before hook, function, or after hook)
2. Error hooks execute with full source context
3. If `suppressErrors: false` → error is re-thrown
4. If `suppressErrors: true` → error is NOT thrown; function returns `undefined`

---

## Hook Types

### before

Executes before the target function. Can:

- Modify the arguments passed to the function
- Cancel execution and return a custom value (short-circuit)
- Execute validation or authorization logic

**Must be synchronous.** Returning a Promise throws an error.

### after

Executes after successful function completion. Can:

- Transform the function's return value
- Access the original args alongside the result

Runs only if the function executes (skipped on short-circuit). Attaches to the Promise chain for async functions.

### always

Executes after the function completes regardless of success or failure. Receives full execution context including error information. **Return value is ignored** - read-only observer.

### error

Executes only when an error occurs. Receives the error with detailed source tracking (where the error originated - before hook, the function itself, after hook, etc.).

---

## Basic Usage

```javascript
import slothlet from "@cldmv/slothlet";

const api = await slothlet({ dir: "./api", hook: true });

// Before hook: Modify arguments
api.slothlet.hook.on(
	"before:math.add",
	({ path, args }) => {
		console.log(`Calling ${path} with:`, args);
		return [args[0] * 2, args[1] * 2]; // Return array to modify args
	},
	{ id: "double-args", priority: 100 }
);

// After hook: Transform result
api.slothlet.hook.on(
	"after:math.*",
	({ path, result }) => {
		console.log(`${path} returned:`, result);
		return result * 10; // Return value to replace result
	},
	{ id: "multiply-result", priority: 100 }
);

// Always hook: Observe final result (read-only)
api.slothlet.hook.on(
	"always:**",
	({ path, result, hasError, errors }) => {
		if (hasError) {
			console.log(`${path} failed:`, errors);
		} else {
			console.log(`${path} succeeded:`, result);
		}
		// Return value ignored
	},
	{ id: "logger" }
);

const result = await api.math.add(2, 3);
// Hooks execute: args doubled → 4+6=10 → result×10 → 100
// result === 100
```

---

## Hook Handler Context

Each hook type receives a context object:

### Before hook context

```javascript
api.slothlet.hook.on("before:math.*", ({ path, args, api, ctx }) => {
	// path: string - API path being called (e.g. "math.add")
	// args: Array - current arguments
	// api: object - the live API object (self)
	// ctx: object - the current context object
});
```

**Return values:**
- Return an `Array` → replaces arguments
- Return any other non-`undefined` value → short-circuits (function not called, returned value becomes result)
- Return `undefined` / no return → continue with existing args

### After hook context

```javascript
api.slothlet.hook.on("after:math.*", ({ path, args, result, api, ctx }) => {
	// path: string - API path
	// args: Array - original arguments
	// result: * - current result value (may have been modified by earlier after hooks)
	// api, ctx - as above
});
```

**Return values:**
- Return any non-`undefined` value → replaces result
- Return `undefined` / no return → result unchanged

### Always hook context

```javascript
api.slothlet.hook.on("always:**", ({ path, args, result, hasError, errors, api, ctx }) => {
	// path: string - API path
	// args: Array - original arguments
	// result: * - final result (undefined if hasError)
	// hasError: boolean - whether an error occurred
	// errors: Array<Error> - array of errors that occurred
	// api, ctx - as above
	// Return value is ignored
});
```

### Error hook context

```javascript
api.slothlet.hook.on("error:**", ({ path, args, error, errorType, source, timestamp, api, ctx }) => {
	// path: string - API path
	// args: Array - function arguments
	// error: Error - the error object
	// errorType: string - error constructor name
	// timestamp: Date - when the error occurred
	// source: object - error source details
	//   source.type: "before" | "after" | "always" | "function" | "unknown"
	//   source.subset: hook subset (if hook error)
	//   source.hookId: hook ID (if hook error)
	//   source.hookTag: hook tag/name (if hook error)
	//   source.timestamp: epoch ms
	//   source.stack: full stack trace
	// api, ctx - as above
});
```

---

## Short-Circuit Execution

Before hooks can cancel function execution entirely:

```javascript
const cache = new Map();

// Cache check - short-circuit on hit
api.slothlet.hook.on(
	"before:**",
	({ path, args }) => {
		const key = JSON.stringify({ path, args });
		if (cache.has(key)) {
			return cache.get(key); // Non-array, non-undefined → short-circuit
		}
		// Return undefined → continue to function
	},
	{ id: "cache-check", priority: 1000 }
);

// Cache store - save result after function runs
api.slothlet.hook.on(
	"after:**",
	({ path, args, result }) => {
		const key = JSON.stringify({ path, args });
		cache.set(key, result);
		return result;
	},
	{ id: "cache-store", priority: 100 }
);
```

When a before hook short-circuits:
- The function is not called
- After hooks are skipped
- Always hooks still execute with the short-circuit result

---

## Pattern Matching

The typePattern argument to `hook.on()` has the format `"type:pattern"`:

```javascript
// type = "before", pattern = "math.add"
api.slothlet.hook.on("before:math.add", handler);

// type = "after", pattern = "math.*" (all math functions)
api.slothlet.hook.on("after:math.*", handler);

// type = "always", pattern = "**" (all functions)
api.slothlet.hook.on("always:**", handler);

// type = "error", pattern = "database.*"
api.slothlet.hook.on("error:database.*", handler);
```

### Supported Pattern Syntax

| Syntax | Description | Example |
|---|---|---|
| `exact.path` | Exact match | `"math.add"` |
| `namespace.*` | All functions in namespace | `"math.*"` |
| `*.funcName` | Function name in any namespace | `"*.add"` |
| `**` | All functions | `"**"` |
| `{a,b,c}` | Brace expansion - matches "a", "b", or "c" | `"{math,utils}.*"` |
| `!pattern` | Negation - matches anything except pattern | `"!internal.*"` |

### Pattern Examples

```javascript
// Match all functions except internal ones
api.slothlet.hook.on("before:!internal.*", handler);

// Match math or database functions
api.slothlet.hook.on("before:{math,database}.*", handler);

// Match specific methods across all namespaces
api.slothlet.hook.on("after:*.{add,update,delete}", handler);
```

### Diagnostic: Test a Pattern

```javascript
// Compile a pattern to test it
const matcher = api.slothlet.diag.hook.compilePattern("math.*");
console.log(matcher("math.add"));   // true
console.log(matcher("other.func")); // false
```

---

## Priority and Chaining

Within each subset, hooks execute in priority order (highest first):

```javascript
// High priority - runs first
api.slothlet.hook.on(
	"before:math.*",
	({ args }) => {
		if (args[0] < 0) throw new Error("Negative not allowed");
		return args;
	},
	{ id: "validate", priority: 1000 }
);

// Medium priority - runs second
api.slothlet.hook.on(
	"before:math.*",
	({ args }) => [args[0] * 2, args[1] * 2],
	{ id: "double", priority: 500 }
);

// Low priority - runs last
api.slothlet.hook.on(
	"before:math.*",
	({ path, args }) => {
		console.log(`Final args for ${path}:`, args);
		return args;
	},
	{ id: "log", priority: 100 }
);
```

---

## Hook Subsets

Each hook type supports three ordered execution phases (`subset`):

| Subset | Order | Typical use |
|---|---|---|
| `"before"` | First | Auth checks, security validation, initialization |
| `"primary"` | Middle (default) | Main hook logic, business rules |
| `"after"` | Last | Cleanup, audit trails, notifications |

Within each subset, hooks still sort by priority (highest first), then registration order.

```javascript
// Auth (before subset) - must run before any other before-hooks
api.slothlet.hook.on(
	"before:protected.*",
	({ ctx }) => {
		if (!ctx.user) throw new Error("Unauthorized");
	},
	{ id: "auth", subset: "before", priority: 2000 }
);

// Business validation (primary subset) - default
api.slothlet.hook.on(
	"before:math.*",
	({ args }) => {
		if (args[0] < 0) throw new Error("Invalid input");
		return args;
	},
	{ id: "validate", subset: "primary", priority: 1000 }
);

// Audit log (after subset) - runs after all other before-hooks
api.slothlet.hook.on(
	"before:**",
	({ path, args }) => {
		console.log(`[AUDIT] Executing ${path} with args:`, args);
		return args;
	},
	{ id: "audit", subset: "after", priority: 100 }
);
```

**Complete execution order** for a function call:

```text
before hooks:  [subset=before, ↓priority] → [subset=primary, ↓priority] → [subset=after, ↓priority]
↓ function executes
after hooks:   [subset=before, ↓priority] → [subset=primary, ↓priority] → [subset=after, ↓priority]
always hooks:  [subset=before, ↓priority] → [subset=primary, ↓priority] → [subset=after, ↓priority]
```

---

## Runtime Control

Enable and disable hooks at runtime without unregistering them:

```javascript
const api = await slothlet({ dir: "./api", hook: true });

// Disable all hooks
api.slothlet.hook.disable();

// Re-enable all hooks
api.slothlet.hook.enable();

// Disable only a specific pattern
api.slothlet.hook.disable({ pattern: "math.*" });

// Re-enable by type
api.slothlet.hook.enable({ type: "before" });

// Disable a specific hook by ID
api.slothlet.hook.disable({ id: "my-expensive-hook" });
```

---

## Hook Management

### Registering

```javascript
// Returns the hook ID (auto-generated if not specified in options)
const hookId = api.slothlet.hook.on(
	"before:math.*",
	({ args }) => args,
	{ id: "my-hook", priority: 100, subset: "primary" }
);
```

### Removing

```javascript
// Remove by ID
api.slothlet.hook.remove({ id: hookId });

// Remove all before hooks matching a pattern
api.slothlet.hook.remove({ type: "before", pattern: "math.*" });

// Remove all hooks of a type
api.slothlet.hook.remove({ type: "error" });

// off() is an alias for remove - accepts ID string or filter object
api.slothlet.hook.off(hookId);
api.slothlet.hook.off({ pattern: "math.*" });

// clear() is also an alias for remove
api.slothlet.hook.clear({ type: "before" });
api.slothlet.hook.clear(); // Remove all hooks
```

### Listing

```javascript
// List all hooks
const all = api.slothlet.hook.list();

// List by type
const beforeHooks = api.slothlet.hook.list({ type: "before" });

// List only enabled hooks
const active = api.slothlet.hook.list({ enabled: true });

// List by pattern
const mathHooks = api.slothlet.hook.list({ pattern: "math.*" });
```

---

## Error Handling

The `error` hook type receives detailed context about any error in the execution chain:

```javascript
api.slothlet.hook.on(
	"error:**",
	({ path, error, source }) => {
		console.error(`Error in ${path}:`, error.message);
		console.error(`Source type: ${source.type}`); // "before" | "function" | "after" | "always" | "unknown"

		if (source.type === "function") {
			console.error("Error in function body");
		} else {
			console.error(`Error in ${source.type} hook: ${source.hookTag}`);
		}
	},
	{ id: "error-monitor" }
);
```

**Important notes:**

- Errors from `before` and `after` hooks are re-thrown after error hooks run (unless `suppressErrors: true`)
- Errors from `always` hooks are caught and passed to error hooks, but do NOT re-throw (never crash execution)
- Error hooks do not receive errors thrown by other error hooks (no recursion)

---

## Error Source Tracking

### Source Types

| `source.type` | Description |
|---|---|
| `"function"` | Error in the target function body |
| `"before"` | Error in a before hook |
| `"after"` | Error in an after hook |
| `"always"` | Error in an always hook |
| `"unknown"` | Source could not be determined |

### Source Properties

- `source.type` - source type (see above)
- `source.subset` - hook subset where error occurred (for hook errors)
- `source.hookId` - ID of the hook that failed (for hook errors)
- `source.hookTag` - name/tag of the hook that failed (for hook errors)
- `source.timestamp` - epoch millisecond when error occurred
- `source.stack` - full stack trace string

### Comprehensive Error Monitoring Example

```javascript
const errorStats = { function: 0, before: 0, after: 0, always: 0, byHook: {} };

api.slothlet.hook.on(
	"error:**",
	({ path, error, source }) => {
		errorStats[source.type] = (errorStats[source.type] || 0) + 1;

		if (source.hookTag) {
			errorStats.byHook[source.hookTag] = (errorStats.byHook[source.hookTag] || 0) + 1;
		}

		sendToMonitoring({
			timestamp: source.timestamp,
			path,
			errorType: source.type,
			hookId: source.hookId,
			hookTag: source.hookTag,
			message: error.message,
			stack: source.stack
		});
	},
	{ id: "error-analytics" }
);
```

---

## Sync and Async Function Behavior

Hook handlers are **synchronous functions**. Returning a Promise from a before hook throws. Returning a Promise from after/always/error hooks is silently ignored (the return value is unused or treated as the non-async value).

The hook system intelligently handles both sync and async *target functions*:

**For synchronous functions:**

```text
executeBeforeHooks() → fn() → executeAfterHooks() → executeAlwaysHooks()
```
All steps run synchronously in sequence.

**For async functions:**

```text
executeBeforeHooks() → fn() returns Promise → .then(executeAfterHooks, executeErrorHooks) → executeAlwaysHooks()
```
After, error, and always hooks attach to the Promise chain - they do not block the event loop.

This design ensures:
- Synchronous functions return synchronous values (no unwanted Promise wrapping)
- Async functions process hooks without blocking the event loop
- The fundamental contract of all modes is preserved

---

## API Reference

### api.slothlet.hook.on(typePattern, handler, options?)

Register a hook.

**Parameters:**

- `typePattern` (string) - Combined type and pattern, format: `"type:pattern"` (e.g. `"before:math.*"`)
- `handler` (Function) - Synchronous hook handler
- `options.id` (string, optional) - Unique identifier (auto-generated if omitted)
- `options.priority` (number, optional) - Execution priority; higher executes first (default: `0`)
- `options.subset` (string, optional) - Execution phase: `"before"`, `"primary"` (default), or `"after"`

**Returns:** string - The hook ID

### api.slothlet.hook.remove(filter?)

Remove hooks matching filter criteria.

**Parameters:**

- `filter.id` (string) - Remove exact hook by ID
- `filter.type` (string) - Remove all hooks of this type
- `filter.pattern` (string) - Remove all hooks matching this pattern

**Returns:** number - Count of hooks removed

### api.slothlet.hook.off(idOrFilter)

Alias for `remove()`. Accepts a bare ID string or a filter object.

### api.slothlet.hook.clear(filter?)

Alias for `remove()`.

### api.slothlet.hook.enable(filter?)

Enable hooks. Empty filter enables all.

**Parameters:** Same filter object as `remove()`.

**Returns:** number - Count of hooks enabled

### api.slothlet.hook.disable(filter?)

Disable hooks without unregistering them. Empty filter disables all.

**Returns:** number - Count of hooks disabled

### api.slothlet.hook.list(filter?)

List registered hooks matching filter.

**Parameters:**

- `filter.id`, `filter.type`, `filter.pattern` - As above
- `filter.enabled` (boolean) - Filter by enabled state

**Returns:** Array of hook objects

---

## See Also

- [Context Propagation](CONTEXT-PROPAGATION.md) - `ctx` object available in hook handlers
- [README](../README.md) - Main project documentation
