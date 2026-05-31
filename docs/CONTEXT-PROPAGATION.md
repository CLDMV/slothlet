# Context Propagation

Slothlet provides automatic context preservation across all asynchronous boundaries in your API modules. Context is maintained through EventEmitters, class instances, and all other async patterns without any configuration or code changes.

## Overview

Context propagation ensures that the `context` object and full `self` API access are available in every callback, event handler, and method call in your API modules, regardless of how deeply nested or asynchronous the code becomes.

**Key capabilities:**

- Automatic EventEmitter context propagation
- Transparent class instance context wrapping
- Per-request context isolation (`api.slothlet.context.run` / `api.slothlet.context.scope`)
- Configurable isolation modes (partial and full)
- Zero configuration required for automatic propagation
- Works with all async patterns (TCP, HTTP, custom EventEmitters)
- Clean shutdown support

## Table of Contents

- [Live Bindings](#live-bindings)
- [Per-Request Context Isolation](#per-request-context-isolation)
- [EventEmitter Context Propagation](#eventemitter-context-propagation)
- [Class Instance Context Propagation](#class-instance-context-propagation)

---

## Live Bindings

Access live-bound references in your API modules via the runtime module.

The runtime exports `self`, `context`, and `instanceID`. Note that `reference` is **not** a runtime export - reference data is merged directly into the API at initialization and is accessible via `self` alongside your API modules.

```javascript
// Reference data is merged directly into the API - accessible via self
const api = await slothlet({
	dir: "./api",
	reference: {
		md5: (str) => crypto.createHash("md5").update(str).digest("hex"),
		version: "3.0.0",
		utils: { format: (msg) => `[LOG] ${msg}` }
	}
});
// api.md5, api.version, api.utils are all available
// Inside API modules: self.md5, self.version, self.utils
```

### ESM Module Example

```javascript
// In your API modules (ESM)
import { self, context } from "@cldmv/slothlet/runtime";

export function myFunction() {
	console.log(context.user); // Access live context
	return self.otherModule.helper(); // Access other API modules

	// Reference data is merged directly into the API and accessed via self
	const hash = self.md5("hello world");
	console.log(self.version); // Access reference data
}

export function processData(data) {
	// Call another module from anywhere in the API tree
	const processed = self.cjsModule.process(data);

	// Use reference utilities directly via self
	const logged = self.utils.format(`Processed: ${processed}`);
	return self.md5(logged);
}
```

### CJS Module Example

```javascript
// In your CJS modules
const { self, context } = require("@cldmv/slothlet/runtime");

function cjsFunction(data) {
	console.log(context.env); // Access live context

	const hash = self.md5(data); // Reference data accessed via self

	return self.esmModule.transform(hash); // Access ESM modules from CJS
}

module.exports = { cjsFunction };
```

### TypeScript Module Example

`.ts` and `.mts` modules use the same import — `self`, `context`, and `instanceID` are all reachable from TypeScript exactly as they are from `.mjs`. (Slothlet writes the transpiled output to a project-local cache file so Node's resolver can anchor the bare specifier; details in [TYPESCRIPT.md](TYPESCRIPT.md). This was fixed in v3.5.0 — earlier versions could not import bare specifiers from `.ts` files.)

```typescript
// In your TypeScript modules
import { self, context, instanceID } from "@cldmv/slothlet/runtime";

interface RequestContext {
	requestId?: string;
	user?: { id: string };
}

export function tsFunction(data: string): string {
	const ctx = context as RequestContext;
	const tag = `${instanceID}/${ctx.requestId ?? "anon"}`;
	const hash = self.md5(data);
	return `[${tag}] ${self.esmModule.transform(hash)}`;
}
```

### Writable `self.X = …`

`self` is writable. Assigning to `self` from inside a Slothlet module persists the value for the instance's lifetime, makes it visible to other modules through `self.X` and to the outside through `api.X`.

A reload rebuilds the instance from disk and replays its add/remove operation history — a runtime `self.X = …` write is **not** part of that history, so it does **not** survive a reload. (A write a module performs in its module-init body does reappear — because the module body re-executes during the rebuild, not via any replay.)

```javascript
import { self } from "@cldmv/slothlet/runtime";

// From inside a module mounted at api.lib.config:
export function init() {
    self.lib.config.computed = derive();   // ✓ allowed (under own mount point)
    self.somethingElse = "x";              // ✗ throws LOOSE_SET_NOT_OWNED
}
```

Two rules apply:

- **Owner-scoped writes.** A module's writes are restricted to its own mount-point subtree. A module mounted at `api.lib.config` can write `self.lib.config.*` but not `self.lib.ssh.*` or any other top-level namespace. External code (no module-bound caller) and base-module code own the whole tree and can write anywhere. The error code on violation is `LOOSE_SET_NOT_OWNED`.
- **Wrap-on-set for callables and objects.** When the assigned value is a function or object, it gets a `UnifiedWrapper` (the same wrapper construction `api.slothlet.api.add()` uses). Primitives stay as-is. **Limitation:** hook / permission / lifecycle integration on synthetic wrappers from `self.X = …` is incomplete — for fully lifecycle-integrated mounts, use `api.slothlet.api.add()`.

This was fixed in v3.5.0. Before that, `self.X = …` was silently dropped (proxy default-set onto an empty literal target).

---

## Per-Request Context Isolation

Slothlet provides dedicated methods for executing functions with isolated context data, enabling per-request context isolation in HTTP servers, multi-tenant applications, and other scenarios requiring request-specific state.

### Overview

`api.slothlet.context.run()` and `api.slothlet.context.scope()` execute a callback with temporary context data that:

> **Aliases**: `api.slothlet.run()` and `api.slothlet.scope()` are direct aliases for `api.slothlet.context.run()` and `api.slothlet.context.scope()` respectively and are interchangeable.

- Does **not** affect the global instance context after the callback returns
- **Inherits** from and merges with the current context
- Supports **shallow** and **deep** merge strategies
- Supports **partial** and **full** isolation modes
- **Automatically propagates** through all async boundaries inside the callback

### API Reference

#### api.slothlet.context.run(contextData, callback, ...args)

> **Alias**: `api.slothlet.run(contextData, callback, ...args)`

Executes a callback function with isolated context data. `.run()` is shorthand for `.scope()` with shallow merge and partial isolation.

**Parameters:**

- `contextData` (Object) - Context data to merge with current context
- `callback` (Function) - Function to execute with isolated context
- `...args` (any) - Arguments forwarded to the callback

**Returns:** Result of the callback function

```javascript
import slothlet from "@cldmv/slothlet";

const api = await slothlet({
	dir: "./api",
	context: { app: "myApp", version: "1.0" }
});

const result = await api.slothlet.context.run(
	{ userId: "alice", requestId: "req-123" },
	async (data) => {
		// context = { app: "myApp", version: "1.0", userId: "alice", requestId: "req-123" }
		return api.processRequest(data);
	},
	{ payload: "test data" }
);

// After callback: context reverts to { app: "myApp", version: "1.0" }
```

#### api.slothlet.context.scope({ context, fn, args, merge, isolation })

> **Alias**: `api.slothlet.scope({ context, fn, args, merge, isolation })`

Executes a function with isolated context using structured options.

**Parameters:**

- `context` (Object) - Context data to merge
- `fn` (Function) - Function to execute
- `args` (Array, optional) - Arguments array for the function
- `merge` (String, optional) - Merge strategy: `"shallow"` (default) or `"deep"`
- `isolation` (String, optional) - Isolation mode: `"partial"` (default) or `"full"` - overrides instance default

**Returns:** Result of the function

```javascript
import slothlet from "@cldmv/slothlet";

const api = await slothlet({
	dir: "./api",
	context: { config: { timeout: 5000 } }
});

// Shallow merge (default) - replaces entire config object
const result1 = await api.slothlet.context.scope({
	context: { config: { retries: 3 } },
	fn: async () => {
		// context.config = { retries: 3 } (config.timeout lost)
		return api.fetchData();
	}
});

// Deep merge - merges nested properties
const result2 = await api.slothlet.context.scope({
	context: { config: { retries: 3 } },
	fn: async () => {
		// context.config = { timeout: 5000, retries: 3 } (merged)
		return api.fetchData();
	},
	merge: "deep"
});
```

### Isolation Modes

`isolation` governs **`self`** only — context is isolated in both modes (the per-request context store is discarded on scope exit regardless).

#### Partial Isolation (Default)

Child `self` is the shared base `self`. Mutations to API state inside `.run()` / `.scope()` **persist** afterward — by design. The API surface is shared; context is isolated.

```javascript
const api = await slothlet({ dir: "./api" }); // default: partial isolation
```

#### Full Isolation

Child `self` is a **copy-on-write view** over the base `self`: reads pass through to the live API, writes (top-level and deep-path) land on a per-scope overlay that is discarded on exit. Mutations to API state do **not** persist outside `.run()`. Both context AND the API surface are isolated.

```javascript
const api = await slothlet({
	dir: "./api",
	scope: { isolation: "full" }
});
```

#### Per-Call Override

The isolation mode can be overridden on a per-call basis regardless of the instance default:

```javascript
// Instance default: partial
const api = await slothlet({ dir: "./api" });

// Override to full isolation for this specific call
await api.slothlet.context.scope({
	context: { requestId: "123" },
	isolation: "full",
	fn: async () => {
		// Self is a copy-on-write view; mutations don't escape this scope
	}
});
```

#### Disable Per-Request Context

Set `scope: false` to disable `.run()` and `.scope()` entirely. Any attempt to call them will throw at runtime.

```javascript
const api = await slothlet({ dir: "./api", scope: false });
```

### Context Isolation Guarantees

Per-request context uses `structuredClone()` to deep-copy the parent context before merging. This means:

- Mutations to `context` properties inside `.run()` do **not** propagate back to the parent context
- Nested objects in context are independent copies - mutations are not shared

```javascript
const api = await slothlet({
	dir: "./api",
	context: { config: { count: 0 } }
});

await api.slothlet.context.run({ extra: true }, async () => {
	// Mutating a nested object does NOT affect the parent
	const ctx = await api.slothlet.context.get();
	ctx.config.count = 999; // ← does not persist
});

const base = await api.slothlet.context.get();
console.log(base.config.count); // 0 - parent context unchanged
```

### Cross-Instance Behavior

When calling `api.slothlet.context.get()` from inside another instance's `.run()` block, the called instance returns its own **base context** - not the calling instance's child context. This provides clear instance isolation.

```javascript
const api1 = await slothlet({ dir: "./api1", context: { app: "one" } });
const api2 = await slothlet({ dir: "./api2", context: { app: "two" } });

await api1.slothlet.context.run({ userId: 100 }, async () => {
	// api1.slothlet.context.get() → { app: "one", userId: 100 } ✅

	// Calling api2 from inside api1's run block:
	const ctx2 = await api2.slothlet.context.get();
	// ctx2 = { app: "two" } - api2's BASE context, not api1's child context

	// If you need api1's context inside api2 code, capture it first:
	const api1Ctx = await api1.slothlet.context.get();
	await api2.slothlet.context.run({ requestId: "abc" }, async () => {
		console.log(api1Ctx.userId); // 100 - explicit capture works
	});
});
```

### Context Inheritance

Nested `.run()` calls within the same instance inherit from their parent scope:

```javascript
const api = await slothlet({
	dir: "./api",
	context: { app: "MyApp", level: 0 }
});

await api.slothlet.context.run({ level: 1, user: "alice" }, async () => {
	// context = { app: "MyApp", level: 1, user: "alice" }

	await api.slothlet.context.run({ level: 2, requestId: "req-123" }, async () => {
		// context = { app: "MyApp", level: 2, user: "alice", requestId: "req-123" }
		// "user" is inherited from the outer scope
		await api.processData();
	});

	// Back to: { app: "MyApp", level: 1, user: "alice" }
});

// Back to: { app: "MyApp", level: 0 }
```

### Merge Strategies

#### Shallow Merge (Default)

Top-level properties are merged; nested objects are replaced wholesale:

```javascript
const api = await slothlet({
	dir: "./api",
	context: { config: { timeout: 5000, retries: 3 }, user: "alice" }
});

await api.slothlet.context.run({ config: { maxSize: 1000 } }, async () => {
	// context.config = { maxSize: 1000 } - timeout and retries are gone
	// context.user = "alice"             - top-level key preserved
});
```

#### Deep Merge

Nested objects are recursively merged:

```javascript
await api.slothlet.context.scope({
	context: { config: { maxSize: 1000 } },
	fn: async () => {
		// context.config = { timeout: 5000, retries: 3, maxSize: 1000 }
		// context.user = "alice"
	},
	merge: "deep"
});
```

### HTTP Server Example

```javascript
// server.mjs
import slothlet from "@cldmv/slothlet";
import http from "node:http";
import { randomUUID } from "node:crypto";

const api = await slothlet({
	dir: "./api",
	context: { app: "MyApp", version: "1.0.0", environment: "production" }
});

const server = http.createServer(async (req, res) => {
	const result = await api.slothlet.context.run(
		{
			requestId: randomUUID(),
			userId: req.headers["x-user-id"],
			ip: req.socket.remoteAddress,
			path: req.url,
			method: req.method
		},
		async () => {
			// All API calls in this scope see the merged context
			const data = await api.handleRequest(req);
			api.logger.info("Request processed successfully");
			return data;
		}
	);

	res.writeHead(200, { "Content-Type": "application/json" });
	res.end(JSON.stringify(result));
});

server.listen(3000);
```

```javascript
// api/logger.mjs
import { context } from "@cldmv/slothlet/runtime";

export function info(message) {
	const { requestId, userId, path } = context;
	console.log(`[INFO] [${requestId}] [${userId}] ${path} - ${message}`);
}

export function error(message) {
	const { requestId, userId, path } = context;
	console.error(`[ERROR] [${requestId}] [${userId}] ${path} - ${message}`);
}
```

### Multi-Tenant Example

```javascript
import slothlet from "@cldmv/slothlet";

const api = await slothlet({
	dir: "./api",
	context: { app: "SaaS Platform", sharedConfig: { apiVersion: "v1" } }
});

async function handleTenantRequest(tenantId, requestData) {
	return await api.slothlet.context.scope({
		context: {
			tenant: {
				id: tenantId,
				database: `db_${tenantId}`,
				features: await getTenantFeatures(tenantId)
			}
		},
		fn: async () => {
			// context = { app, sharedConfig, tenant }
			await api.validateTenantAccess();
			const result = await api.processData(requestData);
			api.logger.info(`Processed request for tenant ${tenantId}`);
			return result;
		},
		merge: "deep" // Deep merge to preserve sharedConfig properties
	});
}

// Process multiple tenants concurrently - each has its own isolated context
const results = await Promise.all([
	handleTenantRequest("tenant-001", { action: "create" }),
	handleTenantRequest("tenant-002", { action: "read" }),
	handleTenantRequest("tenant-003", { action: "update" })
]);
```

> **Performance**: Per-request context uses `AsyncLocalStorage.run()` internally, which is highly optimized in Node.js. Context objects are deep-cloned via `structuredClone()` for isolation - performance overhead is minimal.

> **Runtime caveat — live bindings / browser mode**: The concurrent isolation shown above relies on `AsyncLocalStorage`. Under the live-bindings runtime (`runtime: "live"`, and automatically in **browser mode**, where `node:async_hooks` is unavailable), the active context is tracked in a single global field. This isolates **sequential** `run()` / `scope()` calls — each restores the prior context when it returns — but **not interleaved concurrent** calls on the *same* instance: across an `await`, a sibling `run()` overwrites the global and the resumed callback reads the wrong context. For concurrent per-request isolation, use the default async (ALS) runtime in Node; in a browser, give each concurrent flow its own slothlet instance or serialize the `run()` calls.

---

## EventEmitter Context Propagation

Slothlet automatically preserves AsyncLocalStorage context across all EventEmitter callbacks using Node.js AsyncResource patterns. This ensures your API modules maintain full context access in event handlers without any configuration.

**Implementation**: `src/lib/helpers/eventemitter-context.mjs` patches `EventEmitter.prototype` once when the first slothlet instance is created. Each listener is wrapped with `AsyncResource` to capture and restore ALS context at registration time. A WeakMap tracks listeners for proper cleanup.

### TCP Server Example

```javascript
// api/tcp-server.mjs
import { self, context } from "@cldmv/slothlet/runtime";
import net from "node:net";

export function createTcpServer() {
	const server = net.createServer();

	server.on("connection", (socket) => {
		console.log(`User: ${context.user}`); // ✅ Context preserved
		console.log(`API keys: ${Object.keys(self).length}`); // ✅ Full API access

		socket.on("data", (data) => {
			console.log(`Session: ${context.session}`); // ✅ Context preserved in nested handlers
			const processed = self.dataProcessor.handle(data.toString());
			socket.write(processed);
		});

		socket.on("error", (err) => {
			self.logger.error(`Error for user ${context.user}: ${err.message}`);
		});
	});

	return server;
}

export function startServer(port = 3000) {
	const server = createTcpServer();
	server.listen(port);
	return server;
}
```

```javascript
// Usage
import slothlet from "@cldmv/slothlet";

const api = await slothlet({
	dir: "./api",
	context: { user: "alice", session: "tcp-session" }
});

const server = api.startServer(8080);
```

### Key Characteristics

- **Automatic**: No configuration or code changes needed - works transparently in all API modules
- **Complete context**: Full `context` object and `self` access in all event handlers
- **Nested events**: Works at any depth (server → socket → custom emitters)
- **All EventEmitter methods**: `on`, `once`, `addListener` are all automatically context-aware
- **Clean shutdown**: AsyncResource instances are cleaned up during shutdown to prevent hanging processes
- **No global state**: Listeners capture context at registration time; multiple slothlet instances are supported

> EventEmitter context propagation works automatically in both lazy and eager modes. TCP servers, HTTP servers, custom EventEmitters, and any other event-driven patterns in your API modules maintain full slothlet context without any code changes.

---

## Class Instance Context Propagation

Slothlet automatically preserves AsyncLocalStorage context across all class instance method calls. When your API functions return class instances, slothlet wraps them transparently so all method calls maintain full context access.

**Implementation**: `src/lib/helpers/class-instance-wrapper.mjs` wraps class instances returned from `runInContext()` using a Proxy. Methods are cached per instance. Wrapping is applied recursively - nested class instances are also wrapped. Standard built-in types (Array, Date, Map, EventEmitter, etc.) are excluded from wrapping.

### Data Processor Example

```javascript
// api/data-processor.mjs
import { self, context } from "@cldmv/slothlet/runtime";

class DataProcessor {
	constructor(config) {
		this.config = config;
	}

	process(data) {
		console.log(`Processing for user: ${context.user}`); // ✅ Context preserved
		console.log(`Request ID: ${context.requestId}`); // ✅ Context preserved

		const validated = self.validator.check(data);
		return this.transform(validated);
	}

	transform(data) {
		console.log(`Transforming for: ${context.user}`); // ✅ Context preserved in chained calls
		return self.utils.format(data);
	}
}

export function createProcessor(config) {
	// Return class instance - slothlet automatically wraps it
	return new DataProcessor(config);
}
```

```javascript
// Usage
import slothlet from "@cldmv/slothlet";

const api = await slothlet({
	dir: "./api",
	context: { user: "alice", requestId: "req-123" }
});

const processor = api.createProcessor({ format: "json" });
const result = processor.process({ data: "test" }); // ✅ All methods have full context
```

### Key Characteristics

- **Automatic**: Class instances returned from API functions are automatically context-aware
- **Transparent**: No code changes needed - works with existing class patterns
- **Complete context**: Full `context` object and `self` access in all class methods, including nested calls
- **Recursive**: If a class method returns another class instance, that instance is also wrapped
- **Cached**: Method wrapping is cached per instance to avoid repeated overhead
- **Built-ins excluded**: `Array`, `Date`, `Map`, `Set`, `EventEmitter`, `ArrayBuffer`, `DataView`, `Buffer`, and all typed-array views are not wrapped (they handle their own context or have no need for it — and wrapping a binary buffer would break intrinsic accessors such as `.length` / `.byteLength`)

> Any class instance returned from your API functions automatically maintains slothlet context. This includes database models, service classes, utility classes, and any other object-oriented patterns - as long as the class is not a built-in type.

---

## See Also

- [Hooks Documentation](HOOKS.md) - Hook system with context access
- [README](../README.md) - Main project documentation
