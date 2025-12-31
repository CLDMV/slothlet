# Context Propagation Documentation

Slothlet provides automatic context preservation across all asynchronous boundaries in your API modules. Context is maintained through EventEmitters, class instances, and all other async patterns without any configuration or code changes.

## Overview

Context propagation ensures that the `context` object and full `self` API access are available in **every** callback, event handler, and method call in your API modules, regardless of how deeply nested or asynchronous the code becomes.

**Key Features:**

- Automatic EventEmitter context propagation
- Transparent class instance context wrapping
- Zero configuration required
- Works with all async patterns (TCP, HTTP, custom EventEmitters)
- Clean shutdown support
- Minimal performance overhead

## Table of Contents

- [Live Bindings](#live-bindings)
- [Per-Request Context Isolation](#per-request-context-isolation)
- [EventEmitter Context Propagation](#eventemitter-context-propagation)
- [Class Instance Context Propagation](#class-instance-context-propagation)

## Live Bindings

Access live-bound references in your API modules:

```javascript
// Create API with reference functions
const api = await slothlet({
	dir: "./api",
	reference: {
		md5: (str) => crypto.createHash("md5").update(str).digest("hex"),
		version: "2.0.0",
		utils: { format: (msg) => `[LOG] ${msg}` }
	}
});
```

### ESM Module Example

```javascript
// In your API modules (ESM)
import { self, context, reference } from "@cldmv/slothlet/runtime";

export function myFunction() {
	console.log(context.user); // Access live context
	return self.otherModule.helper(); // Access other API modules

	// Reference functions are available directly on self
	const hash = self.md5("hello world"); // Access reference function
	console.log(self.version); // Access reference data
}

// Mixed module example (ESM accessing CJS)
export function processData(data) {
	// Call a CJS module from ESM
	const processed = self.cjsModule.process(data);

	// Use reference utilities directly
	const logged = self.utils.format(`Processed: ${processed}`);
	return self.md5(logged); // Hash the result
}
```

### CJS Module Example

```javascript
// In your CJS modules
const { self, context, reference } = require("@cldmv/slothlet/runtime");

function cjsFunction(data) {
	console.log(context.env); // Access live context

	// Reference functions available directly on self
	const hash = self.md5(data); // Direct access to reference function

	return self.esmModule.transform(hash); // Access ESM modules from CJS
}

module.exports = { cjsFunction };
```

## Per-Request Context Isolation

**Added in v2.9.0** - Slothlet provides dedicated methods for executing functions with isolated context data, enabling per-request context isolation in HTTP servers, multi-tenant applications, and other scenarios requiring request-specific state.

### Overview

Per-request context isolation allows you to execute API functions with temporary context data that:
- **Doesn't affect** the global slothlet instance context
- **Inherits from** parent context when nested
- **Supports** both shallow and deep merge strategies
- **Automatically propagates** through all async boundaries

**Key Methods:**

- `api.run(contextData, callback, ...args)` - Simple function-based API
- `api.scope({ context, fn, args, merge })` - Structured object-based API

### API Reference

#### api.run(contextData, callback, ...args)

Executes a callback function with isolated context data.

**Parameters:**
- `contextData` (Object) - Context data to merge with current context
- `callback` (Function) - Function to execute with isolated context
- `...args` (any) - Arguments to pass to the callback

**Returns:** Result of the callback function

**Example:**

```javascript
import slothlet from "@cldmv/slothlet";

const api = await slothlet({
	dir: "./api",
	context: { app: "myApp", version: "1.0" }
});

// Execute with isolated per-request context
const result = await api.run(
	{ userId: "alice", requestId: "req-123" },
	async (data) => {
		// Inside callback, context has both global and request-specific data
		// context = { app: "myApp", version: "1.0", userId: "alice", requestId: "req-123" }
		return api.processRequest(data);
	},
	{ payload: "test data" }
);
```

#### api.scope({ context, fn, args, merge })

Executes a function with isolated context using structured options.

**Parameters:**
- `context` (Object) - Context data to merge
- `fn` (Function) - Function to execute
- `args` (Array, optional) - Arguments array for the function
- `merge` (String, optional) - Merge strategy: `"shallow"` (default) or `"deep"`

**Returns:** Result of the function

**Example:**

```javascript
import slothlet from "@cldmv/slothlet";

const api = await slothlet({
	dir: "./api",
	context: { config: { timeout: 5000 } }
});

// Shallow merge (default) - replaces entire config object
const result1 = await api.scope({
	context: { config: { retries: 3 } },
	fn: async () => {
		// context.config = { retries: 3 } (config.timeout lost)
		return api.fetchData();
	}
});

// Deep merge - merges nested properties
const result2 = await api.scope({
	context: { config: { retries: 3 } },
	fn: async () => {
		// context.config = { timeout: 5000, retries: 3 } (merged)
		return api.fetchData();
	},
	merge: "deep"
});
```

### HTTP Server Example

```javascript
// server.mjs - HTTP server with per-request context
import slothlet from "@cldmv/slothlet";
import http from "node:http";
import { randomUUID } from "node:crypto";

const api = await slothlet({
	dir: "./api",
	context: {
		app: "MyApp",
		version: "1.0.0",
		environment: "production"
	}
});

const server = http.createServer(async (req, res) => {
	// Each request gets isolated context
	const result = await api.run(
		{
			requestId: randomUUID(),
			userId: req.headers["x-user-id"],
			ip: req.socket.remoteAddress,
			path: req.url,
			method: req.method
		},
		async () => {
			// All API calls in this scope have request-specific context
			// context = { app: "MyApp", version: "1.0.0", environment: "production",
			//             requestId: "...", userId: "...", ip: "...", path: "...", method: "..." }

			try {
				// Process request with full context
				const data = await api.handleRequest(req);

				// Log with request context
				api.logger.info("Request processed successfully");

				return data;
			} catch (error) {
				// Error handling with request context
				api.logger.error(`Request failed: ${error.message}`);
				throw error;
			}
		}
	);

	res.writeHead(200, { "Content-Type": "application/json" });
	res.end(JSON.stringify(result));
});

server.listen(3000);
console.log("Server running with per-request context isolation");
```

```javascript
// api/logger.mjs - Logger that uses request context
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

```javascript
// api/handleRequest.mjs - Request handler with context access
import { self, context } from "@cldmv/slothlet/runtime";

export async function handleRequest(req) {
	// Access request-specific context
	const { userId, requestId, path, method } = context;

	// Log with context
	self.logger.info(`Processing ${method} request`);

	// Validate user
	const user = await self.database.getUser(userId);
	if (!user) {
		throw new Error("User not found");
	}

	// Process request
	const data = await self.business.processData(req);

	// Log success
	self.logger.info("Request processing complete");

	return { success: true, data, requestId };
}
```

### Multi-Tenant Example

```javascript
// multi-tenant.mjs - Multi-tenant application with isolated context
import slothlet from "@cldmv/slothlet";

const api = await slothlet({
	dir: "./api",
	context: {
		app: "SaaS Platform",
		sharedConfig: { apiVersion: "v1" }
	}
});

// Process requests for different tenants
async function handleTenantRequest(tenantId, requestData) {
	return await api.scope({
		context: {
			tenant: {
				id: tenantId,
				database: `db_${tenantId}`,
				features: await getTenantFeatures(tenantId)
			}
		},
		fn: async () => {
			// All API calls use tenant-specific context
			// context = { app: "SaaS Platform", sharedConfig: {...}, tenant: {...} }

			// Validate tenant access
			await api.validateTenantAccess();

			// Process with tenant context
			const result = await api.processData(requestData);

			// Log with tenant context
			api.logger.info(`Processed request for tenant ${tenantId}`);

			return result;
		},
		merge: "deep" // Deep merge to preserve sharedConfig
	});
}

// Example: Process requests for multiple tenants concurrently
const results = await Promise.all([
	handleTenantRequest("tenant-001", { action: "create" }),
	handleTenantRequest("tenant-002", { action: "read" }),
	handleTenantRequest("tenant-003", { action: "update" })
]);

console.log("All tenant requests processed with isolated context");
```

```javascript
// api/validateTenantAccess.mjs - Tenant validation with context
import { context } from "@cldmv/slothlet/runtime";

export async function validateTenantAccess() {
	const { tenant } = context;

	if (!tenant || !tenant.id) {
		throw new Error("No tenant context available");
	}

	// Check tenant status
	const isActive = await checkTenantStatus(tenant.id);
	if (!isActive) {
		throw new Error(`Tenant ${tenant.id} is not active`);
	}

	// Check feature access
	if (!tenant.features.includes("api_access")) {
		throw new Error(`Tenant ${tenant.id} does not have API access`);
	}

	return true;
}
```

### Context Inheritance

Per-request context supports nested execution with automatic parent context inheritance:

```javascript
import slothlet from "@cldmv/slothlet";

const api = await slothlet({
	dir: "./api",
	context: { app: "MyApp", level: 0 }
});

// Nested context isolation with inheritance
await api.run({ level: 1, user: "alice" }, async () => {
	// context = { app: "MyApp", level: 1, user: "alice" }
	console.log("Level 1:", context.level); // 1

	await api.run({ level: 2, requestId: "req-123" }, async () => {
		// context = { app: "MyApp", level: 2, user: "alice", requestId: "req-123" }
		console.log("Level 2:", context.level); // 2
		console.log("User:", context.user); // alice (inherited)

		// Inner scope inherits from outer scope
		await api.processData();
	});

	// Back to level 1 context
	console.log("Back to Level 1:", context.level); // 1
});

// Back to original context
console.log("Original context:", context.level); // 0
```

### Merge Strategies

#### Shallow Merge (Default)

Top-level properties are merged, nested objects are replaced:

```javascript
const api = await slothlet({
	dir: "./api",
	context: {
		config: { timeout: 5000, retries: 3 },
		user: "alice"
	}
});

await api.run({ config: { maxSize: 1000 } }, async () => {
	// context.config = { maxSize: 1000 } (timeout and retries lost)
	// context.user = "alice" (preserved)
});
```

#### Deep Merge

Nested objects are recursively merged:

```javascript
const api = await slothlet({
	dir: "./api",
	context: {
		config: { timeout: 5000, retries: 3 },
		user: "alice"
	}
});

await api.scope({
	context: { config: { maxSize: 1000 } },
	fn: async () => {
		// context.config = { timeout: 5000, retries: 3, maxSize: 1000 } (merged)
		// context.user = "alice" (preserved)
	},
	merge: "deep"
});
```

### Key Benefits

- ✅ **True Isolation**: Per-request context doesn't affect global instance context
- ✅ **Inheritance**: Nested scopes automatically inherit parent context
- ✅ **Flexible Merging**: Choose between shallow and deep merge strategies
- ✅ **Automatic Propagation**: Context flows through all async boundaries (EventEmitters, Promises, class methods)
- ✅ **Type-Safe**: Full TypeScript support with proper type inference
- ✅ **Zero Configuration**: Works automatically with existing API modules

> [!TIP]  
> **Use Cases**: Per-request context isolation is ideal for HTTP servers (request-specific data), multi-tenant applications (tenant isolation), batch processing (job-specific context), and any scenario where you need temporary, isolated context state without affecting the global slothlet instance.

> [!NOTE]  
> **Performance**: Per-request context uses AsyncLocalStorage.run() internally, which is highly optimized in Node.js v16+. There is minimal overhead compared to manual context passing patterns.

## EventEmitter Context Propagation

Slothlet automatically preserves AsyncLocalStorage context across all EventEmitter callbacks using Node.js AsyncResource patterns. This ensures your API modules maintain full context access in event handlers without any configuration.

### TCP Server Example

```javascript
// api/tcp-server.mjs - Your API module
import { self, context } from "@cldmv/slothlet/runtime";
import net from "node:net";

export function createTcpServer() {
	const server = net.createServer();

	// Connection handler maintains full context automatically
	server.on("connection", (socket) => {
		console.log(`User: ${context.user}`); // ✅ Context preserved
		console.log(`API keys: ${Object.keys(self).length}`); // ✅ Full API access

		// Socket data handler also maintains context automatically
		socket.on("data", (data) => {
			console.log(`Session: ${context.session}`); // ✅ Context preserved
			console.log(`Processing for: ${context.user}`); // ✅ Context preserved

			// Full API access in nested event handlers
			const processed = self.dataProcessor.handle(data.toString());
			socket.write(processed);
		});

		socket.on("error", (err) => {
			// Error handlers also maintain context
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

### Usage Example

```javascript
// Usage in your application
import slothlet from "@cldmv/slothlet";

const api = await slothlet({
	dir: "./api",
	context: { user: "alice", session: "tcp-session" }
});

// Start the server - all event handlers will have full context
const server = api.startServer(8080);
console.log("TCP server started with context preservation");
```

### Key Benefits

- ✅ **Automatic**: No configuration needed - works transparently in all API modules
- ✅ **Complete Context**: Full `context` object and `self` API access in all event handlers
- ✅ **Nested Events**: Works with any depth of EventEmitter nesting (server → socket → custom emitters)
- ✅ **Universal Support**: All EventEmitter methods (`on`, `once`, `addListener`) are automatically context-aware
- ✅ **Production Ready**: Uses Node.js AsyncResource patterns for reliable context propagation
- ✅ **Clean Shutdown**: Automatically cleans up all AsyncResource instances during shutdown to prevent hanging processes
- ✅ **Zero Overhead**: Only wraps listeners when context is active, minimal performance impact

> [!TIP]  
> **Automatic Context Propagation**: EventEmitter context propagation works automatically in both lazy and eager modes. TCP servers, HTTP servers, custom EventEmitters, and any other event-driven patterns in your API modules will maintain full slothlet context and API access without any code changes.

## Class Instance Context Propagation

Slothlet automatically preserves AsyncLocalStorage context across all class instance method calls. When your API functions return class instances, slothlet wraps them transparently to ensure all method calls maintain full context access.

### Data Processor Example

```javascript
// api/data-processor.mjs - Your API module
import { self, context } from "@cldmv/slothlet/runtime";

class DataProcessor {
	constructor(config) {
		this.config = config;
	}

	process(data) {
		// Context automatically available in all methods
		console.log(`Processing for user: ${context.user}`); // ✅ Context preserved
		console.log(`Request ID: ${context.requestId}`); // ✅ Context preserved

		// Full API access in class methods
		const validated = self.validator.check(data);
		return this.transform(validated);
	}

	transform(data) {
		// Context preserved in nested method calls
		console.log(`Transforming for: ${context.user}`); // ✅ Context preserved

		// Call other API modules from class methods
		return self.utils.format(data);
	}
}

export function createProcessor(config) {
	// Return class instance - slothlet automatically wraps it
	return new DataProcessor(config);
}
```

### Usage Example

```javascript
// Usage in your application
import slothlet from "@cldmv/slothlet";

const api = await slothlet({
	dir: "./api",
	context: { user: "alice", requestId: "req-123" }
});

// Create processor instance - all methods will have full context
const processor = api.createProcessor({ format: "json" });

// All method calls maintain context automatically
const result = processor.process({ data: "test" });
console.log("Processing completed with context preservation");
```

### Key Benefits

- ✅ **Automatic**: Class instances returned from API functions are automatically context-aware
- ✅ **Transparent**: No code changes needed - works with existing class patterns
- ✅ **Complete Context**: Full `context` object and `self` API access in all class methods
- ✅ **Nested Methods**: Context preserved across method chains and internal calls
- ✅ **Constructor Support**: Context preserved for both function calls and `new` constructor usage
- ✅ **Performance Optimized**: Method wrapping is cached to avoid overhead on repeated calls

> [!TIP]  
> **Universal Class Support**: Any class instance returned from your API functions automatically maintains slothlet context. This includes database models, service classes, utility classes, and any other object-oriented patterns in your codebase.

---

For more information, see:

- [Changelog v2.3](changelog/v2.3.md) - Context propagation introduction
- [README](../README.md) - Main project documentation
- [Hooks Documentation](HOOKS.md) - Hook system with context access
