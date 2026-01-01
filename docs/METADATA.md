# Function Metadata System

**Version**: 2.10.0+

## Overview

The Slothlet metadata system enables function tagging and runtime introspection for security, authorization, auditing, and multi-tenant architectures. Functions loaded through `addApi()` can be tagged with arbitrary immutable metadata that persists across calls and can be inspected from within the slothlet execution context.

## Core Concepts

### Metadata Properties

- **User-defined**: Any JSON-serializable values (strings, numbers, booleans, objects, arrays)
- **Auto-added**: `sourceFolder` - absolute path where function was loaded from
- **Immutability**: All metadata is deeply frozen and protected by Proxy traps
- **Persistence**: Metadata survives across function calls and remains attached to function objects

### metadataAPI

Runtime introspection interface available from within slothlet-loaded modules:

```javascript
import { metadataAPI } from "@cldmv/slothlet/runtime";

// Get metadata by path
const meta = await metadataAPI.get("api.path.to.function");

// Get caller's metadata
const callerMeta = await metadataAPI.caller();

// Get current function's metadata
const selfMeta = await metadataAPI.self();
```

## Usage

### Basic Metadata Tagging

Tag all functions loaded from a folder:

```javascript
const api = await slothlet({ dir: "./api" });

await api.addApi("plugins.trusted", "./trusted-plugins", {
	trusted: true,
	version: "1.0.0",
	author: "Alice",
	permissions: ["read", "write", "admin"]
});

await api.addApi("plugins.external", "./third-party", {
	trusted: false,
	permissions: ["read"]
});

// Access metadata on any function
const meta = api.plugins.trusted.myFunction.__metadata;
console.log(meta.trusted); // true
console.log(meta.version); // "1.0.0"
console.log(meta.sourceFolder); // Absolute path to ./trusted-plugins
```

### Metadata Immutability

Metadata is **deeply immutable** to prevent tampering:

```javascript
await api.addApi("plugins", "./plugins", {
	trusted: true,
	config: { timeout: 5000 },
	permissions: ["read", "write"]
});

const meta = api.plugins.someFunc.__metadata;

// ❌ Cannot modify existing properties
meta.trusted = false; // TypeError in strict mode, silent fail otherwise
meta.config.timeout = 1000; // TypeError - nested objects frozen
meta.permissions.push("admin"); // TypeError - arrays frozen

// ❌ Cannot delete properties
delete meta.trusted; // Silently ignored

// ✅ CAN add new properties
meta.newProperty = "allowed";
console.log(meta.newProperty); // "allowed"

// ❌ But new properties become immutable immediately
meta.newProperty = "changed"; // TypeError in strict mode
```

**Implementation Details:**

- All nested objects and arrays are recursively frozen with `Object.freeze()`
- Proxy `set` trap returns `false` to reject modifications
- Proxy `deleteProperty` trap returns `false` to reject deletions
- In strict mode, modification attempts throw `TypeError`
- In non-strict mode, modifications silently fail

### Runtime Introspection

Use `metadataAPI` to inspect metadata from within slothlet context:

#### metadataAPI.get(path)

Get metadata for any function by dot-notation path:

```javascript
// api_tests/api_test/admin/secure-operation.mjs
import { metadataAPI } from "@cldmv/slothlet/runtime";

export async function performAction() {
	// Get metadata for another function
	const targetMeta = await metadataAPI.get("plugins.trusted.someFunc");

	if (targetMeta?.trusted) {
		console.log("Target function is trusted");
	}

	// ... logic
}
```

#### metadataAPI.caller()

Get metadata of the function that called the current function:

```javascript
// api_tests/api_test/security/authorize.mjs
import { metadataAPI } from "@cldmv/slothlet/runtime";

export async function restrictedOperation() {
	// Introspect caller's metadata
	const caller = await metadataAPI.caller();

	if (!caller) {
		throw new Error("Cannot determine caller metadata");
	}

	if (!caller.trusted) {
		throw new Error("Unauthorized: Caller is not trusted");
	}

	if (!caller.permissions.includes("admin")) {
		throw new Error("Unauthorized: Admin permission required");
	}

	// Proceed with sensitive operation
	return "Success";
}
```

**How it works:**

- Uses V8's `Error.prepareStackTrace()` API to capture call stack
- Finds caller's file path from stack trace
- Maps file path to slothlet API path
- Returns metadata for that path

#### metadataAPI.self()

Get metadata of the currently executing function:

```javascript
// api_tests/api_test/utils/logger.mjs
import { metadataAPI } from "@cldmv/slothlet/runtime";

export async function logOperation(message) {
	// Get own metadata
	const self = await metadataAPI.self();

	console.log(`[${self.version}] ${message}`);
	console.log(`Source: ${self.sourceFolder}`);
	console.log(`Author: ${self.author}`);
}
```

### Empty Metadata Handling

Passing empty metadata object or no metadata parameter prevents metadata creation:

```javascript
// No metadata parameter - no metadata created
await api.addApi("plugins", "./plugins");
console.log(api.plugins.someFunc.__metadata); // undefined

// Empty object - also no metadata created
await api.addApi("plugins", "./other-plugins", {});
console.log(api.plugins.otherFunc.__metadata); // undefined
```

**CommonJS Cache Cleanup:**

When no metadata provided, `cleanMetadata()` removes stale metadata from cached CJS modules:

```javascript
// First load with metadata
await api.addApi("plugins", "./plugins", { trusted: true });
console.log(api.plugins.someFunc.__metadata.trusted); // true

// Reload without metadata
await api.addApi("plugins", "./plugins");
console.log(api.plugins.someFunc.__metadata); // undefined

// CJS cached functions have __metadata removed
```

## Architecture Patterns

### Plugin Security System

```javascript
// Load different plugin tiers with appropriate metadata
await api.addApi("plugins.core", "./core-plugins", {
	trusted: true,
	tier: "core",
	permissions: ["read", "write", "admin", "config"],
	version: "1.0.0"
});

await api.addApi("plugins.verified", "./verified-plugins", {
	trusted: true,
	tier: "verified",
	permissions: ["read", "write"],
	version: "1.2.0"
});

await api.addApi("plugins.community", "./community-plugins", {
	trusted: false,
	tier: "community",
	permissions: ["read"],
	source: "external"
});

// Enforce permissions in sensitive operations
// api_tests/api_test/admin/config.mjs
import { metadataAPI } from "@cldmv/slothlet/runtime";

export async function updateConfig(key, value) {
	const caller = await metadataAPI.caller();

	// Check trust level
	if (!caller?.trusted) {
		throw new Error("Untrusted plugins cannot modify config");
	}

	// Check permissions
	if (!caller.permissions.includes("config")) {
		throw new Error("Config permission required");
	}

	// Update configuration
	config[key] = value;
	return { success: true };
}

export async function readConfig(key) {
	const caller = await metadataAPI.caller();

	// Read permission required
	if (!caller?.permissions.includes("read")) {
		throw new Error("Read permission required");
	}

	return config[key];
}
```

### Multi-Tenant SaaS

```javascript
// Load tenant-specific modules with isolation metadata
await api.addApi("tenants.acme", "./tenants/acme", {
	tenantId: "acme",
	tier: "enterprise",
	features: ["analytics", "api", "webhooks", "sso"],
	maxUsers: 1000,
	region: "us-east-1"
});

await api.addApi("tenants.startup", "./tenants/startup", {
	tenantId: "startup",
	tier: "basic",
	features: ["analytics"],
	maxUsers: 10,
	region: "us-west-2"
});

// Enforce tier restrictions
// api_tests/api_test/features/webhooks.mjs
import { metadataAPI } from "@cldmv/slothlet/runtime";

export async function createWebhook(url, events) {
	const caller = await metadataAPI.caller();

	// Check feature availability
	if (!caller?.features.includes("webhooks")) {
		throw new Error(`Webhooks not available on ${caller.tier} tier`);
	}

	// Create webhook...
	return { id: "webhook_123", url, events };
}

export async function addUser(email) {
	const self = await metadataAPI.self();

	// Check user limits
	const currentUsers = await countUsers(self.tenantId);
	if (currentUsers >= self.maxUsers) {
		throw new Error(`User limit reached (${self.maxUsers} max)`);
	}

	// Add user...
	return { id: "user_456", email };
}
```

### Audit Logging System

```javascript
// Tag modules with deployment metadata
await api.addApi("services.payment", "./services/payment", {
	service: "payment",
	version: "2.3.1",
	author: "TeamPayments",
	deployedAt: "2025-12-31T10:30:00Z",
	gitCommit: "a1b2c3d",
	environment: "production"
});

await api.addApi("services.auth", "./services/auth", {
	service: "auth",
	version: "1.5.2",
	author: "TeamSecurity",
	deployedAt: "2025-12-20T15:45:00Z",
	gitCommit: "e4f5g6h",
	environment: "production"
});

// Comprehensive audit logging
// api_tests/api_test/services/payment/charge.mjs
import { metadataAPI } from "@cldmv/slothlet/runtime";

export async function chargeCard(amount, cardId) {
	const caller = await metadataAPI.caller();
	const self = await metadataAPI.self();

	// Create audit record
	const audit = {
		timestamp: new Date().toISOString(),
		operation: "chargeCard",
		amount,
		cardId,
		service: {
			name: self.service,
			version: self.version,
			author: self.author,
			commit: self.gitCommit
		},
		caller: {
			service: caller?.service,
			version: caller?.version,
			sourceFolder: caller?.sourceFolder
		}
	};

	// Log audit record
	await logAudit(audit);

	// Process charge
	const result = await processCharge(amount, cardId);

	return result;
}
```

### Feature Flags & A/B Testing

```javascript
// Tag modules with feature flag metadata
await api.addApi("features.v1", "./features/v1", {
	version: "v1",
	stable: true,
	rollout: 100
});

await api.addApi("features.v2beta", "./features/v2", {
	version: "v2",
	stable: false,
	rollout: 10, // 10% of users
	flag: "new-ui-beta"
});

// Feature flag enforcement
// api_tests/api_test/features/render.mjs
import { metadataAPI } from "@cldmv/slothlet/runtime";

export async function renderDashboard(userId) {
	const self = await metadataAPI.self();

	// Check if user is in rollout percentage
	if (!self.stable) {
		const userHash = hashUserId(userId);
		const userPercentile = userHash % 100;

		if (userPercentile >= self.rollout) {
			// User not in rollout, fall back to v1
			const v1 = await metadataAPI.get("features.v1.renderDashboard");
			return api.features.v1.renderDashboard(userId);
		}
	}

	// Proceed with this version
	return renderV2Dashboard(userId);
}
```

## Testing Patterns

### Test Metadata Tagging

```javascript
import slothlet from "@cldmv/slothlet";

// Create test instance with metadata
const api = await slothlet({ dir: "./api_tests/api_test" });

await api.addApi("testModules", "./api_tests/api_test/security", {
	testMode: true,
	trusted: true,
	permissions: ["read", "write", "admin"]
});

// Verify metadata attached
const meta = api.testModules.authorize.__metadata;
assert(meta.testMode === true);
assert(meta.trusted === true);
assert(meta.permissions.includes("admin"));
```

### Test Introspection Methods

```javascript
// Test caller detection
async function testCaller() {
	// Load helper that uses metadataAPI.caller()
	const result = await api.security.authorize();
	assert(result === "authorized");
}

// Test self introspection
async function testSelf() {
	// Load module that logs its own metadata
	await api.utils.logger("test message");
	// Verify log output contains metadata fields
}

// Test path-based lookup
async function testGet() {
	const meta = await api.metadataTestHelper.getMeta("security.authorize");
	assert(meta.trusted === true);
}
```

### Test Immutability

```javascript
// Verify metadata cannot be modified
const meta = api.testModules.someFunc.__metadata;

// Test property modification
try {
	("use strict");
	meta.trusted = false;
	assert.fail("Should have thrown TypeError");
} catch (err) {
	assert(err instanceof TypeError);
}

// Test nested object modification
try {
	("use strict");
	meta.permissions.push("newPerm");
	assert.fail("Should have thrown TypeError");
} catch (err) {
	assert(err instanceof TypeError);
}

// Test deletion
const hadProp = "trusted" in meta;
delete meta.trusted;
assert("trusted" in meta === hadProp); // Still present
```

## Technical Implementation

### Deep Freezing

All metadata objects undergo recursive freezing:

```javascript
function createImmutableMetadata(initial = {}) {
	function deepFreeze(obj) {
		Object.freeze(obj);

		for (const key of Object.keys(obj)) {
			const value = obj[key];
			if (value && typeof value === "object" && !Object.isFrozen(value)) {
				deepFreeze(value);
			}
		}

		return obj;
	}

	const frozen = deepFreeze({ ...initial });

	// Proxy enforcement for runtime checks
	return new Proxy(frozen, {
		set: () => false,
		deleteProperty: () => false
	});
}
```

### Metadata Attachment

Functions are tagged recursively:

```javascript
function tagLoadedFunctions(obj, metadata, visited = new WeakSet()) {
	if (!obj || typeof obj !== "object" || visited.has(obj)) {
		return;
	}

	visited.add(obj);

	for (const key of Object.keys(obj)) {
		const value = obj[key];

		if (typeof value === "function") {
			// Tag function with metadata
			value.__metadata = metadata;
		} else if (typeof value === "object" && value !== null) {
			// Recurse into nested objects
			tagLoadedFunctions(value, metadata, visited);
		}
	}
}
```

### Stack Trace Introspection

metadataAPI uses V8's stack trace API:

```javascript
function getCallerPath() {
	const originalPrepare = Error.prepareStackTrace;

	Error.prepareStackTrace = (_, stack) => stack;
	const stack = new Error().stack;
	Error.prepareStackTrace = originalPrepare;

	// stack[0] = getCallerPath
	// stack[1] = metadataAPI.caller
	// stack[2] = current function
	// stack[3] = caller we want

	const callerFrame = stack[3];
	if (!callerFrame) return null;

	return callerFrame.getFileName();
}
```

### CommonJS Cache Handling

CJS modules cache function object references:

```javascript
function cleanMetadata(obj, visited = new WeakSet()) {
	if (!obj || typeof obj !== "object" || visited.has(obj)) {
		return;
	}

	visited.add(obj);

	for (const key of Object.keys(obj)) {
		const value = obj[key];

		if (typeof value === "function" && value.__metadata) {
			// Remove stale metadata
			delete value.__metadata;
		} else if (typeof value === "object" && value !== null) {
			// Recurse
			cleanMetadata(value, visited);
		}
	}
}
```

## Security Considerations

### Metadata as Security Boundary

**✅ Good: Defense in Depth**

Use metadata as ONE layer of security, not the only layer:

```javascript
export async function deleteUser(userId) {
	const caller = await metadataAPI.caller();

	// First layer: metadata-based auth
	if (!caller?.trusted || !caller.permissions.includes("admin")) {
		throw new Error("Unauthorized");
	}

	// Second layer: session-based auth
	if (!ctx.user?.isAdmin) {
		throw new Error("Unauthorized");
	}

	// Third layer: database-level permissions
	await db.users.delete(userId);
}
```

**❌ Bad: Metadata as Sole Security**

```javascript
export async function deleteUser(userId) {
	const caller = await metadataAPI.caller();

	// Only checking metadata - not enough!
	if (caller?.trusted) {
		await db.users.delete(userId);
	}
}
```

### Metadata Tampering Prevention

**Immutability Protects Against:**

- ✅ Runtime modification attempts
- ✅ Accidental mutations
- ✅ Nested property changes

**Immutability DOES NOT Protect Against:**

- ❌ Malicious code that redefines `addApi()`
- ❌ Direct manipulation of `__metadata` property
- ❌ Prototype pollution
- ❌ Code injection attacks

**Best Practices:**

1. **Validate at Load Time:**

```javascript
// Validate metadata schema
function validateMetadata(meta) {
	if (!meta.trusted || typeof meta.trusted !== "boolean") {
		throw new Error("Invalid metadata: trusted must be boolean");
	}
	if (!Array.isArray(meta.permissions)) {
		throw new Error("Invalid metadata: permissions must be array");
	}
}

const metadata = { trusted: true, permissions: ["read"] };
validateMetadata(metadata);
await api.addApi("plugins", "./plugins", metadata);
```

2. **Use TypeScript for Metadata Schemas:**

```typescript
interface PluginMetadata {
	trusted: boolean;
	permissions: ("read" | "write" | "admin")[];
	version: string;
	author: string;
}

await api.addApi("plugins", "./plugins", metadata as PluginMetadata);
```

3. **Combine with Other Security Measures:**

- Session-based authentication
- Database-level permissions
- Input validation
- Rate limiting
- Audit logging

### Stack Trace Reliability

`metadataAPI.caller()` depends on V8 stack traces:

**Reliable:**

- ✅ Direct function calls
- ✅ Async/await chains
- ✅ Promise chains

**May Fail:**

- ⚠️ setTimeout/setInterval callbacks (no meaningful caller)
- ⚠️ Event emitter callbacks (caller is event system, not business logic)
- ⚠️ Deeply nested calls (stack depth limits)

**Handle Gracefully:**

```javascript
export async function sensitiveOp() {
	const caller = await metadataAPI.caller();

	if (!caller) {
		// No caller detected - require explicit auth
		if (!ctx.explicitAuth) {
			throw new Error("Authentication required");
		}
	} else {
		// Caller detected - check metadata
		if (!caller.trusted) {
			throw new Error("Unauthorized caller");
		}
	}

	// Proceed...
}
```

## Limitations

### Performance Impact

- **Metadata Tagging**: Negligible (~0.1ms per module load)
- **metadataAPI.get()**: Fast (~0.01ms lookup time)
- **metadataAPI.caller()**: Moderate (~0.5-1ms stack trace capture)
- **metadataAPI.self()**: Moderate (~0.5-1ms stack trace capture)

**Recommendation**: Cache metadata lookups if called frequently:

```javascript
// ❌ Bad: Repeated stack trace captures
export async function frequentOperation() {
	const caller = await metadataAPI.caller(); // 1ms
	// ... more code ...
	const self = await metadataAPI.self(); // 1ms
	// ... more code ...
	const caller2 = await metadataAPI.caller(); // 1ms (redundant!)
}

// ✅ Good: Cache once
export async function frequentOperation() {
	const caller = await metadataAPI.caller(); // 1ms
	const self = await metadataAPI.self(); // 1ms

	// Use cached values
	if (caller?.trusted && self?.permissions.includes("write")) {
		// ...
	}
}
```

### Metadata Size

Large metadata objects increase memory usage:

```javascript
// ❌ Bad: Huge metadata object
await api.addApi("plugins", "./plugins", {
	trusted: true,
	// Don't include huge objects
	entireUserDatabase: [...], // Bad!
	loggingHistory: [...] // Bad!
});

// ✅ Good: Minimal metadata
await api.addApi("plugins", "./plugins", {
	trusted: true,
	permissions: ["read", "write"],
	version: "1.0.0"
});
```

### Lazy Mode Considerations

In lazy mode, metadata is only attached after module materialization:

```javascript
const api = await slothlet({ dir: "./api", mode: "lazy" });

await api.addApi("plugins", "./plugins", { trusted: true });

// ❌ No metadata yet - module not loaded
console.log(api.plugins.someFunc.__metadata); // undefined

// ✅ Trigger materialization first
await api.plugins.someFunc();
console.log(api.plugins.someFunc.__metadata); // { trusted: true, ... }
```

**Workaround**: Access module before checking metadata:

```javascript
// Materialize module
await api.plugins.someFunc();

// Now metadata available
const meta = api.plugins.someFunc.__metadata;
```

## API Reference

### addApi(apiPath, folderPath, metadata)

Add modules from folder with optional metadata tagging.

**Parameters:**

- `apiPath` (string): Dot-notation path (e.g., `"plugins.security"`)
- `folderPath` (string): Path to folder containing modules
- `metadata` (object, optional): Metadata to attach to all loaded functions

**Metadata Properties:**

- User-defined: Any JSON-serializable values
- Auto-added: `sourceFolder` (absolute path)

**Returns:** Promise\<void\>

**Example:**

```javascript
await api.addApi("plugins", "./plugins", {
	trusted: true,
	version: "1.0.0"
});
```

### metadataAPI.get(path)

Get metadata for function at dot-notation path.

**Parameters:**

- `path` (string): Dot-notation path (e.g., `"plugins.security.authorize"`)

**Returns:** Promise\<object | undefined\>

**Example:**

```javascript
const meta = await metadataAPI.get("plugins.trusted.someFunc");
console.log(meta.trusted); // true
```

### metadataAPI.caller()

Get metadata of calling function (from stack trace).

**Returns:** Promise\<object | undefined\>

**Example:**

```javascript
export async function restrictedOp() {
	const caller = await metadataAPI.caller();
	if (!caller?.trusted) {
		throw new Error("Unauthorized");
	}
}
```

### metadataAPI.self()

Get metadata of currently executing function.

**Returns:** Promise\<object | undefined\>

**Example:**

```javascript
export async function logVersion() {
	const self = await metadataAPI.self();
	console.log("Version:", self.version);
}
```

### Function.\_\_metadata

Direct access to function's metadata object (immutable).

**Type:** object | undefined

**Example:**

```javascript
const meta = api.plugins.someFunc.__metadata;
console.log(meta.trusted);
console.log(meta.sourceFolder);
```

## Troubleshooting

### Metadata is undefined

**Symptom:**

```javascript
console.log(api.plugins.someFunc.__metadata); // undefined
```

**Causes:**

1. No metadata provided to `addApi()`
2. Empty metadata object provided: `{}`
3. Lazy mode - module not yet materialized

**Solutions:**

```javascript
// 1. Provide metadata
await api.addApi("plugins", "./plugins", { trusted: true });

// 2. Don't use empty object
await api.addApi("plugins", "./plugins", { version: "1.0.0" });

// 3. Materialize lazy module first
await api.plugins.someFunc();
console.log(api.plugins.someFunc.__metadata);
```

### metadataAPI.caller() returns undefined

**Symptom:**

```javascript
const caller = await metadataAPI.caller();
console.log(caller); // undefined
```

**Causes:**

1. Called from outside slothlet context (e.g., setTimeout)
2. Stack depth exceeded
3. Caller has no metadata

**Solutions:**

```javascript
// 1. Avoid async callbacks
setTimeout(async () => {
	// ❌ No caller here
	const caller = await metadataAPI.caller();
});

// 2. Check for undefined
const caller = await metadataAPI.caller();
if (!caller) {
	// Handle no-caller case
	requireExplicitAuth();
}

// 3. Ensure caller has metadata
await api.addApi("callerModule", "./caller", { trusted: true });
```

### Metadata modification fails silently

**Symptom:**

```javascript
const meta = api.plugins.someFunc.__metadata;
meta.trusted = false;
console.log(meta.trusted); // still true
```

**Cause:**
Metadata is immutable (intentional)

**Solution:**
Don't modify metadata. If you need mutable data, use slothlet context:

```javascript
import { context } from "@cldmv/slothlet/runtime";

// Store mutable data in context
context.userSettings = { theme: "dark" };
context.userSettings.theme = "light"; // Works
```

### CommonJS metadata persists

**Symptom:**

```javascript
await api.addApi("plugins", "./plugins", { trusted: true });
// ... later ...
await api.addApi("plugins", "./plugins"); // No metadata
console.log(api.plugins.someFunc.__metadata); // Still { trusted: true }
```

**Cause:**
CJS modules cache function objects

**Solution:**
This is handled automatically by `cleanMetadata()`. If it persists, it's a bug - please report.

## Migration from 2.9.x

No breaking changes. Simply start using metadata parameter:

**Before (v2.9.x):**

```javascript
await api.addApi("plugins", "./plugins");
```

**After (v2.10.0):**

```javascript
await api.addApi("plugins", "./plugins", {
	trusted: true,
	version: "1.0.0"
});
```

All existing code continues to work without changes.

## Further Reading

- [Changelog v2.10](./changelog/v2.10.md) - Full release notes
- [addApi Documentation](../README.md#addapi) - Complete addApi usage
- [Runtime Exports](./CONTEXT-PROPAGATION.md) - Context and runtime systems
- [Security Best Practices](../SECURITY.md) - Security guidelines
