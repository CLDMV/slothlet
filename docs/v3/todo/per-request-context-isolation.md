# Per-Request Context Isolation (api.run / api.scope)

**Status:** ❌ NOT IMPLEMENTED  
**Priority:** 🟡 MEDIUM - Ergonomic enhancement for per-request isolation  
**Complexity:** MEDIUM - Requires ALS context nesting and merge strategies  
**Related:** [docs/CONTEXT-PROPAGATION.md](../../CONTEXT-PROPAGATION.md) - Complete V2 documentation (604 lines)

---

### How to Run Tests Properly

**⚠️ IMPORTANT: Always tail test output (last 40 lines):**
```powershell
npm run debug 2>&1 | Select-Object -Last 40
npm run testv3 -- --baseline 2>&1 | Select-Object -Last 40
```

**Why tail?**
- ❌ **WRONG:** Running without tailing shows the START of output, not results
- ✅ **CORRECT:** Tailing last 40 lines shows the RESULTS at the end

**📋 When per-request context tests pass 100%:**
- Add context isolation test files to `tests/vitests/baseline-tests.json`
- But ONLY if `npm run debug` AND `npm run testv3 -- --baseline` both pass
- This ensures we catch regressions in working tests immediately

---

## Problem Statement

V3 currently requires creating separate slothlet instances for different context states. V2 provided ergonomic methods (`api.run()` and `api.scope()`) for temporary context isolation within a single instance, enabling per-request context without instance overhead.

**V2 Feature (from v2.9.0):** Execute functions with isolated context data that:
- Doesn't affect the global instance context
- Inherits from parent context when nested
- Supports both shallow and deep merge strategies
- Automatically propagates through all async boundaries

**V3 Current Workaround:**
```javascript
// V3: Must create multiple instances (works but less ergonomic)
const api1 = await slothlet({ dir: "./api", context: { tenant: "alice" } });
const api2 = await slothlet({ dir: "./api", context: { tenant: "bob" } });
```

**V2 Ergonomic Solution:**
```javascript
// V2: Single instance with temporary context
const api = await slothlet({ dir: "./api" });

// Per-request isolation
await api.run({ requestId: "req-123", userId: "alice" }, async () => {
    // context has requestId and userId temporarily
    await api.processRequest();
});

// Context reverts after callback completes
```

---

## V2 API Reference

### api.run(contextData, callback, ...args)

**Purpose:** Executes a callback function with isolated context data.

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

// After callback, context reverts to { app: "myApp", version: "1.0" }
```

---

### api.scope({ context, fn, args, merge })

**Purpose:** Executes a function with isolated context using structured options.

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

---

## Use Cases

### 1. HTTP Server Per-Request Context

```javascript
import http from "node:http";
import slothlet from "@cldmv/slothlet";

const api = await slothlet({ dir: "./api" });

http.createServer((req, res) => {
    // Each request gets isolated context
    api.run({ requestId: req.id, user: req.user }, async () => {
        const result = await api.handleRequest(req);
        res.end(JSON.stringify(result));
    });
}).listen(3000);
```

### 2. Multi-Tenant Application

```javascript
const api = await slothlet({ dir: "./api" });

async function handleTenantRequest(tenantId, request) {
    return await api.run({ tenant: tenantId }, async () => {
        // All API calls within this scope have tenant context
        return api.processTenantRequest(request);
    });
}
```

### 3. Nested Context Isolation

```javascript
// Global context
const api = await slothlet({ 
    dir: "./api",
    context: { app: "myApp" }
});

await api.run({ level: 1, user: "alice" }, async () => {
    console.log(context); // { app: "myApp", level: 1, user: "alice" }
    
    await api.run({ level: 2, requestId: "req-123" }, async () => {
        console.log(context); 
        // { app: "myApp", level: 2, user: "alice", requestId: "req-123" }
    });
    
    console.log(context); // { app: "myApp", level: 1, user: "alice" }
});

console.log(context); // { app: "myApp" }
```

### 4. Deep vs Shallow Merge

```javascript
const api = await slothlet({ 
    dir: "./api",
    context: { config: { timeout: 5000, retries: 3 } }
});

// Shallow merge - replaces entire config
await api.scope({
    context: { config: { maxSize: 1000 } },
    fn: async () => {
        console.log(context.config);
        // { maxSize: 1000 } - timeout and retries lost!
    }
});

// Deep merge - merges nested properties
await api.scope({
    context: { config: { maxSize: 1000 } },
    fn: async () => {
        console.log(context.config);
        // { timeout: 5000, retries: 3, maxSize: 1000 } - merged!
    },
    merge: "deep"
});
```

---

## Implementation Requirements

### 1. API Surface

Add methods to the slothlet instance API:

```javascript
// In src/lib/builders/api_builder.mjs or similar

/**
 * Execute callback with isolated context
 * @param {Object} contextData - Context data to merge
 * @param {Function} callback - Function to execute
 * @param {...any} args - Arguments for callback
 * @returns {Promise<any>} Callback result
 */
async run(contextData, callback, ...args) {
    const contextManager = this[INTERNALS].contextManager;
    const parentContext = contextManager.getContext() || {};
    const mergedContext = { ...parentContext, ...contextData };
    
    return await contextManager.als.run(mergedContext, async () => {
        return await callback(...args);
    });
}

/**
 * Execute function with structured isolated context
 * @param {Object} options - Options object
 * @param {Object} options.context - Context data to merge
 * @param {Function} options.fn - Function to execute
 * @param {Array} [options.args] - Arguments for function
 * @param {string} [options.merge="shallow"] - Merge strategy ("shallow" or "deep")
 * @returns {Promise<any>} Function result
 */
async scope({ context: contextData, fn, args = [], merge = "shallow" }) {
    const contextManager = this[INTERNALS].contextManager;
    const parentContext = contextManager.getContext() || {};
    
    const mergedContext = merge === "deep"
        ? deepMerge(parentContext, contextData)
        : { ...parentContext, ...contextData };
    
    return await contextManager.als.run(mergedContext, async () => {
        return await fn(...args);
    });
}
```

### 2. Deep Merge Implementation

Need a deep merge utility for `merge: "deep"` option:

```javascript
/**
 * Deep merge two objects
 * @param {Object} target - Target object
 * @param {Object} source - Source object
 * @returns {Object} Merged object
 */
function deepMerge(target, source) {
    const result = { ...target };
    
    for (const key in source) {
        if (source[key] && typeof source[key] === "object" && !Array.isArray(source[key])) {
            result[key] = deepMerge(result[key] || {}, source[key]);
        } else {
            result[key] = source[key];
        }
    }
    
    return result;
}
```

### 3. Context Nesting Support

The AsyncLocalStorage already handles nesting automatically - each `.run()` call creates a new async context that inherits from the parent.

**Key behavior:**
- Parent context values are inherited by child contexts
- Child context modifications don't affect parent
- Context reverts when callback completes

### 4. Error Handling

Ensure context reverts even on errors:

```javascript
async run(contextData, callback, ...args) {
    const contextManager = this[INTERNALS].contextManager;
    const parentContext = contextManager.getContext() || {};
    const mergedContext = { ...parentContext, ...contextData };
    
    try {
        return await contextManager.als.run(mergedContext, async () => {
            return await callback(...args);
        });
    } catch (error) {
        // Context automatically reverts after ALS.run() completes
        throw error;
    }
}
```

---

## Testing Strategy

### 1. Basic Context Isolation

```javascript
test("api.run() isolates context temporarily", async () => {
    const api = await slothlet({ 
        dir: "./api_test",
        context: { global: true }
    });
    
    let innerContext;
    await api.run({ request: "abc" }, async () => {
        innerContext = context;
    });
    
    expect(innerContext).toEqual({ global: true, request: "abc" });
    expect(context).toEqual({ global: true }); // Reverted
});
```

### 2. Nested Context Isolation

```javascript
test("api.run() supports nested contexts", async () => {
    const api = await slothlet({ dir: "./api_test", context: { level: 0 } });
    
    const contexts = [];
    await api.run({ level: 1 }, async () => {
        contexts.push({ ...context });
        
        await api.run({ level: 2 }, async () => {
            contexts.push({ ...context });
        });
        
        contexts.push({ ...context });
    });
    contexts.push({ ...context });
    
    expect(contexts[0]).toEqual({ level: 1 });
    expect(contexts[1]).toEqual({ level: 2 });
    expect(contexts[2]).toEqual({ level: 1 }); // Reverted to parent
    expect(contexts[3]).toEqual({ level: 0 }); // Reverted to global
});
```

### 3. Shallow vs Deep Merge

```javascript
test("api.scope() shallow merge replaces nested objects", async () => {
    const api = await slothlet({ 
        dir: "./api_test",
        context: { config: { a: 1, b: 2 } }
    });
    
    let innerContext;
    await api.scope({
        context: { config: { c: 3 } },
        fn: async () => { innerContext = context; }
    });
    
    expect(innerContext.config).toEqual({ c: 3 }); // a and b lost
});

test("api.scope() deep merge preserves nested properties", async () => {
    const api = await slothlet({ 
        dir: "./api_test",
        context: { config: { a: 1, b: 2 } }
    });
    
    let innerContext;
    await api.scope({
        context: { config: { c: 3 } },
        fn: async () => { innerContext = context; },
        merge: "deep"
    });
    
    expect(innerContext.config).toEqual({ a: 1, b: 2, c: 3 }); // Merged
});
```

### 4. Error Context Reversion

```javascript
test("api.run() reverts context on error", async () => {
    const api = await slothlet({ 
        dir: "./api_test",
        context: { safe: true }
    });
    
    await expect(async () => {
        await api.run({ safe: false }, async () => {
            throw new Error("Test error");
        });
    }).rejects.toThrow("Test error");
    
    expect(context).toEqual({ safe: true }); // Reverted despite error
});
```

### 5. Argument Forwarding

```javascript
test("api.run() forwards arguments to callback", async () => {
    const api = await slothlet({ dir: "./api_test" });
    
    const result = await api.run(
        { test: true },
        (a, b, c) => a + b + c,
        1, 2, 3
    );
    
    expect(result).toBe(6);
});

test("api.scope() forwards arguments from array", async () => {
    const api = await slothlet({ dir: "./api_test" });
    
    const result = await api.scope({
        context: { test: true },
        fn: (a, b, c) => a + b + c,
        args: [10, 20, 30]
    });
    
    expect(result).toBe(60);
});
```

---

## Implementation Priority

**Priority Justification: MEDIUM**

**Why not HIGH:**
- V3 has working alternative (create multiple instances)
- Not blocking production deployments
- Core context isolation already works

**Why not LOW:**
- Significantly improves ergonomics for common use cases
- Reduces instance overhead in multi-tenant/per-request scenarios
- V2 users expect this feature for migration

**Recommended Implementation Order:**
1. Implement hooks system (higher priority - major feature)
2. Implement EventEmitter propagation (critical for event-driven APIs)
3. **Implement per-request context** (ergonomic improvement)
4. Minor enhancements (allowMutation config, CJS normalization)

---

## Migration Impact

**For V2 Users:**

```javascript
// V2 code using api.run()
await api.run({ requestId: "req-123" }, async () => {
    await api.processRequest();
});

// V3 current workaround (more verbose)
const requestApi = await slothlet({
    dir: "./api",
    context: { ...api.context, requestId: "req-123" }
});
await requestApi.processRequest();
```

**Breaking Change:** V2 code using `api.run()` or `api.scope()` will fail in V3 until this feature is implemented.

---

## Related Documentation

**V2 Documentation:**
- [docs/CONTEXT-PROPAGATION.md](../../CONTEXT-PROPAGATION.md) - Complete context propagation guide (604 lines)
- [docs/changelog/v2.9.md](../../changelog/v2.9.md) - V2.9 release notes introducing this feature

**V3 Documentation:**
- [docs/v3/todo/eventemitter-context-propagation.md](./eventemitter-context-propagation.md) - Related context feature

---

## Questions for Clarification

1. **API location:** Should these be methods on the API root (`api.run()`) or under slothlet namespace (`api.slothlet.run()`)?
2. **Naming:** Keep V2 names (`run`/`scope`) or rename for V3 consistency?
3. **Config option:** Should this be opt-in via config flag or always available?

---

**Last Updated:** January 27, 2026  
**Next Review:** After hooks and EventEmitter propagation implementation
