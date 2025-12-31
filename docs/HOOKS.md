# Hook System Documentation

The Hook System is a comprehensive interceptor framework for API function calls in slothlet. It enables you to intercept, modify, and observe function execution with minimal overhead and maximum flexibility.

## Overview

Hooks work seamlessly across all loading modes (eager/lazy) and runtime types (async/live), providing a unified API for function interception regardless of your slothlet configuration.

**Key Features:**

- Four hook types: `before`, `after`, `always`, and `error`
- Pattern matching with wildcards and exact matches
- Priority-based execution ordering
- Runtime enable/disable globally or by pattern
- Short-circuit execution support
- Detailed error source tracking
- Zero-overhead when disabled

## Table of Contents

- [Hook Configuration](#hook-configuration)
- [Hook Types](#hook-types)
- [Basic Usage](#basic-usage)
- [Short-Circuit Execution](#short-circuit-execution)
- [Pattern Matching](#pattern-matching)
- [Priority and Chaining](#priority-and-chaining)
- [Runtime Control](#runtime-control)
- [Hook Management](#hook-management)
- [Error Handling](#error-handling)
- [Error Source Tracking](#error-source-tracking)
- [Cross-Mode Compatibility](#cross-mode-compatibility)

## Hook Configuration

Hooks can be configured when creating a slothlet instance:

```javascript
// Enable hooks (simple boolean)
const api = await slothlet({
	dir: "./api",
	hooks: true // Enable all hooks with default pattern "**"
});

// Enable with custom pattern
const api = await slothlet({
	dir: "./api",
	hooks: "database.*" // Only enable for database functions
});

// Full configuration object
const api = await slothlet({
	dir: "./api",
	hooks: {
		enabled: true, // Enable or disable hook execution
		pattern: "**", // Default pattern for filtering
		suppressErrors: false // Control error throwing behavior
	}
});
```

### Configuration Options

- **`enabled`** (boolean): Enable or disable hook execution
- **`pattern`** (string): Default pattern for filtering which functions hooks apply to
- **`suppressErrors`** (boolean): Control error throwing behavior
  - `false` (default): Errors are sent to error hooks, THEN thrown (normal behavior)
  - `true`: Errors are sent to error hooks, BUT NOT thrown (returns `undefined`)

### Error Suppression Behavior

Error hooks **ALWAYS receive errors** regardless of this setting. The `suppressErrors` option only controls whether errors are thrown after error hooks execute.

> **⚠️ Important**: Error hooks (and all hooks) only execute when `hooks.enabled: true`. If hooks are disabled, errors are thrown normally without any hook execution.

When `suppressErrors: true`, errors are caught and sent to error hooks, but not thrown:

```javascript
const api = await slothlet({
	dir: "./api",
	hooks: {
		enabled: true,
		pattern: "**",
		suppressErrors: true // Suppress all errors
	}
});

// Register error hook to monitor failures
api.hooks.on(
	"error-monitor",
	"error",
	({ path, error, source }) => {
		console.error(`Error in ${path}:`, error.message);
		// Log to monitoring service without crashing
	},
	{ pattern: "**" }
);

// Function errors won't crash the application
const result = await api.riskyOperation();
if (result === undefined) {
	// Function failed but didn't throw
	console.log("Operation failed gracefully");
}
```

### Error Flow

1. Error occurs (in before hook, function, or after hook)
2. Error hooks execute and receive the error
3. **If `suppressErrors: false`** → Error is thrown (crashes if uncaught)
4. **If `suppressErrors: true`** → Error is NOT thrown, function returns `undefined`

### What Gets Suppressed

When `suppressErrors: true`:

- ✅ Before hook errors → Sent to error hooks, NOT thrown
- ✅ Function execution errors → Sent to error hooks, NOT thrown
- ✅ After hook errors → Sent to error hooks, NOT thrown
- ✅ Always hook errors → Sent to error hooks, never thrown (regardless of setting)

> **💡 Use Case**: Enable `suppressErrors: true` for resilient systems where you want to monitor failures without crashing. Perfect for background workers, batch processors, or systems with comprehensive error monitoring.

> **⚠️ Critical Operations**: For validation or authorization hooks where errors MUST stop execution, use `suppressErrors: false` (default) to ensure errors propagate normally.

## Hook Types

Four hook types with distinct responsibilities:

### before

Intercept before function execution:

- Modify arguments passed to functions
- Cancel execution and return custom values (short-circuit)
- Execute validation or logging before function runs

### after

Transform results after successful execution:

- Transform function return values
- Only runs if function executes (skipped on short-circuit)
- Chain multiple transformations in priority order

### always

Observe final result with full execution context:

- Always executes after function completes
- Runs even when `before` hooks cancel execution or errors occur
- Receives complete context: `{ path, result, hasError, errors }`
- Cannot modify result (read-only observation)
- Perfect for unified logging of both success and error scenarios

### error

Monitor and handle errors:

- Receives detailed error context with source tracking
- Error source types: 'before', 'function', 'after', 'always', 'unknown'
- Includes error type, hook ID, hook tag, timestamp, and stack trace
- Perfect for error monitoring, logging, and alerting

## Basic Usage

```javascript
import slothlet from "@cldmv/slothlet";

const api = await slothlet({
	dir: "./api",
	hooks: true // Enable hooks
});

// Before hook: Modify arguments
api.hooks.on(
	"validate-input",
	"before",
	({ path, args }) => {
		console.log(`Calling ${path} with args:`, args);
		// Return modified args or original
		return [args[0] * 2, args[1] * 2];
	},
	{ pattern: "math.add", priority: 100 }
);

// After hook: Transform result
api.hooks.on(
	"format-output",
	"after",
	({ path, result }) => {
		console.log(`${path} returned:`, result);
		// Return transformed result
		return result * 10;
	},
	{ pattern: "math.*", priority: 100 }
);

// Always hook: Observe final result with error context
api.hooks.on(
	"log-execution",
	"always",
	({ path, result, hasError, errors }) => {
		if (hasError) {
			console.log(`${path} failed with ${errors.length} error(s):`, errors);
		} else {
			console.log(`${path} succeeded with result:`, result);
		}
		// Return value ignored - read-only observer
	},
	{ pattern: "**" }
); // All functions

// Call function - hooks execute automatically
const result = await api.math.add(2, 3);
// Logs: "Calling math.add with args: [2, 3]"
// Logs: "math.add returned: 10" (4+6)
// Logs: "Final result for math.add: 100" (10*10)
// result === 100
```

## Short-Circuit Execution

`before` hooks can cancel function execution and return custom values:

```javascript
// Caching hook example
const cache = new Map();

api.hooks.on(
	"cache-check",
	"before",
	({ path, args }) => {
		const key = JSON.stringify({ path, args });
		if (cache.has(key)) {
			console.log(`Cache hit for ${path}`);
			return cache.get(key); // Short-circuit: return cached value
		}
		// Return undefined to continue to function
	},
	{ pattern: "**", priority: 1000 }
); // High priority

api.hooks.on(
	"cache-store",
	"after",
	({ path, args, result }) => {
		const key = JSON.stringify({ path, args });
		cache.set(key, result);
		return result; // Pass through
	},
	{ pattern: "**", priority: 100 }
);

// First call - executes function and caches
await api.math.add(2, 3); // Computes and stores

// Second call - returns cached value (function not executed)
await api.math.add(2, 3); // Cache hit! No computation
```

## Pattern Matching

Hooks support flexible pattern matching:

```javascript
// Exact match
api.hooks.on("hook1", "before", handler, { pattern: "math.add" });

// Wildcard: all functions in namespace
api.hooks.on("hook2", "before", handler, { pattern: "math.*" });

// Wildcard: specific function in all namespaces
api.hooks.on("hook3", "before", handler, { pattern: "*.add" });

// Global: all functions
api.hooks.on("hook4", "before", handler, { pattern: "**" });
```

## Priority and Chaining

Multiple hooks execute in priority order (highest first):

```javascript
// High priority - runs first
api.hooks.on(
	"validate",
	"before",
	({ args }) => {
		if (args[0] < 0) throw new Error("Negative numbers not allowed");
		return args;
	},
	{ pattern: "math.*", priority: 1000 }
);

// Medium priority - runs second
api.hooks.on(
	"double",
	"before",
	({ args }) => {
		return [args[0] * 2, args[1] * 2];
	},
	{ pattern: "math.*", priority: 500 }
);

// Low priority - runs last
api.hooks.on(
	"log",
	"before",
	({ path, args }) => {
		console.log(`Final args for ${path}:`, args);
		return args;
	},
	{ pattern: "math.*", priority: 100 }
);
```

## Runtime Control

Enable and disable hooks at runtime:

```javascript
const api = await slothlet({ dir: "./api", hooks: true });

// Add hooks
api.hooks.on("test", "before", handler, { pattern: "math.*" });

// Disable all hooks
api.hooks.disable();
await api.math.add(2, 3); // No hooks execute

// Re-enable all hooks
api.hooks.enable();
await api.math.add(2, 3); // Hooks execute

// Enable specific pattern only
api.hooks.disable();
api.hooks.enable("math.*"); // Only math.* pattern enabled
await api.math.add(2, 3); // math.* hooks execute
await api.other.func(); // No hooks execute
```

## Hook Management

```javascript
// List registered hooks
const beforeHooks = api.hooks.list("before");
const afterHooks = api.hooks.list("after");
const allHooks = api.hooks.list(); // All types

// Remove specific hook by ID
const id = api.hooks.on("temp", "before", handler, { pattern: "math.*" });
api.hooks.off(id);

// Remove all hooks matching pattern
api.hooks.off("math.*");

// Clear all hooks of a type
api.hooks.clear("before"); // Remove all before hooks
api.hooks.clear(); // Remove all hooks
```

## Error Handling

Hooks have a special `error` type for observing function errors with detailed source tracking:

```javascript
api.hooks.on(
	"error-logger",
	"error",
	({ path, error, source }) => {
		console.error(`Error in ${path}:`, error.message);
		console.error(`Source: ${source.type}`); // 'before', 'after', 'always', 'function', 'unknown'

		if (source.type === "function") {
			console.error("Error occurred in function execution");
		} else if (["before", "after", "always"].includes(source.type)) {
			console.error(`Error occurred in ${source.type} hook:`);
			console.error(`  Hook ID: ${source.hookId}`);
			console.error(`  Hook Tag: ${source.hookTag}`);
		}

		console.error(`Timestamp: ${source.timestamp}`);
		console.error(`Stack trace:\n${source.stack}`);

		// Log to monitoring service with full context
		// Error is re-thrown after all error hooks execute
	},
	{ pattern: "**" }
);

try {
	await api.validateData({ invalid: true });
} catch (error) {
	// Error hooks executed before this catch block
	console.log("Caught error:", error);
}
```

## Error Source Tracking

Error hooks receive detailed context about where errors originated:

### Source Types

- `"function"`: Error occurred during function execution
- `"before"`: Error occurred in a before hook
- `"after"`: Error occurred in an after hook
- `"always"`: Error occurred in an always hook
- `"unknown"`: Error source could not be determined

### Source Metadata

- `source.type`: Error source type (see above)
- `source.hookId`: Hook identifier (for hook errors)
- `source.hookTag`: Hook tag/name (for hook errors)
- `source.timestamp`: ISO timestamp when error occurred
- `source.stack`: Full stack trace

### Example: Comprehensive Error Monitoring

```javascript
const errorStats = {
	function: 0,
	before: 0,
	after: 0,
	always: 0,
	byHook: {}
};

api.hooks.on(
	"error-analytics",
	"error",
	({ path, error, source }) => {
		// Track error source statistics
		errorStats[source.type]++;

		if (source.hookId) {
			if (!errorStats.byHook[source.hookTag]) {
				errorStats.byHook[source.hookTag] = 0;
			}
			errorStats.byHook[source.hookTag]++;
		}

		// Log detailed error info
		console.error(`[${source.timestamp}] Error in ${path}:`);
		console.error(`  Type: ${source.type}`);
		console.error(`  Message: ${error.message}`);

		if (source.type === "function") {
			// Function-level error - might be a bug in implementation
			console.error("  Action: Review function implementation");
		} else {
			// Hook-level error - might be a bug in hook logic
			console.error(`  Action: Review ${source.hookTag} hook (${source.type})`);
		}

		// Send to monitoring service
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
	{ pattern: "**" }
);

// Later: Analyze error patterns
console.log("Error Statistics:", errorStats);
// {
//   function: 5,
//   before: 2,
//   after: 1,
//   always: 0,
//   byHook: {
//     "validate-input": 2,
//     "format-output": 1
//   }
// }
```

### Important Notes

- Errors from `before` and `after` hooks are re-thrown after error hooks execute
- Errors from `always` hooks are caught and logged but do NOT crash execution
- Error hooks themselves do not receive errors from other error hooks (no recursion)
- The `_hookSourceReported` flag prevents double-reporting of errors

## Cross-Mode Compatibility

Hooks work identically across all configurations:

```javascript
// Eager + AsyncLocalStorage
const api1 = await slothlet({ dir: "./api", lazy: false, runtime: "async", hooks: true });

// Eager + Live Bindings
const api2 = await slothlet({ dir: "./api", lazy: false, runtime: "live", hooks: true });

// Lazy + AsyncLocalStorage
const api3 = await slothlet({ dir: "./api", lazy: true, runtime: "async", hooks: true });

// Lazy + Live Bindings
const api4 = await slothlet({ dir: "./api", lazy: true, runtime: "live", hooks: true });

// Same hook code works with all configurations
[api1, api2, api3, api4].forEach((api) => {
	api.hooks.on(
		"universal",
		"before",
		({ args }) => {
			return [args[0] * 10, args[1] * 10];
		},
		{ pattern: "math.add" }
	);
});
```

### Key Benefits

- ✅ **Universal**: Works across all 4 mode/runtime combinations
- ✅ **Flexible**: Pattern matching with wildcards and priorities
- ✅ **Powerful**: Modify args, transform results, observe execution
- ✅ **Composable**: Chain multiple hooks with priority control
- ✅ **Dynamic**: Enable/disable at runtime globally or by pattern
- ✅ **Observable**: Separate hook types for different responsibilities

## API Reference

### api.hooks.on(id, type, handler, options)

Register a new hook.

**Parameters:**

- `id` (string): Unique identifier for the hook
- `type` (string): Hook type - "before", "after", "always", or "error"
- `handler` (function): Hook handler function
- `options` (object): Hook configuration
  - `pattern` (string): Pattern to match against function paths
  - `priority` (number): Execution priority (higher = earlier)

**Returns:** string - The hook ID

### api.hooks.off(idOrPattern)

Remove hooks by ID or pattern.

**Parameters:**

- `idOrPattern` (string): Hook ID or pattern to match

### api.hooks.enable(pattern?)

Enable hooks globally or by pattern.

**Parameters:**

- `pattern` (string, optional): Pattern to enable (all if omitted)

### api.hooks.disable()

Disable all hooks.

### api.hooks.list(type?)

List registered hooks.

**Parameters:**

- `type` (string, optional): Hook type to filter by

**Returns:** array - Array of hook objects

### api.hooks.clear(type?)

Clear all hooks of a specific type or all hooks.

**Parameters:**

- `type` (string, optional): Hook type to clear (all if omitted)

---

For more information, see:

- [Changelog v2.6](../changelog/v2.6.md) - Hook system introduction
- [API Reference](API.md) - Complete API documentation
- [README](../../README.md) - Main project documentation
