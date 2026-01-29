# EventEmitter Context Propagation

**Status:** ⚠️ **NOT IMPLEMENTED** - **CONFIRMED BROKEN**  
**Priority:** 🔴 **CRITICAL** - Breaking feature for event-driven APIs  
**Complexity:** HIGH - Requires EventEmitter.prototype patching and AsyncResource wrapping  
**Blocked By:** None - Per-request context complete  
**Ready To Implement:** ✅ YES

**Test Evidence (January 29, 2026):**
- TCP test fails with `NO_ACTIVE_CONTEXT_ASYNC` error
- Error occurs in `socket.on("data")` handler at tcp.mjs:137
- Accessing `context` getter inside EventEmitter callbacks throws error
- **Conclusion:** Node.js EventEmitter does NOT automatically propagate AsyncLocalStorage context

---

## Problem Statement

Event handlers registered on EventEmitter instances lose access to slothlet's AsyncLocalStorage context because they execute in a different async execution context than where they were registered.

### Example of the Problem

```javascript
// What users expect to work:
import { self, context } from "@cldmv/slothlet/runtime";
import net from "node:net";

export function startServer() {
    const server = net.createServer((socket) => {
        // ❌ V3: context is UNDEFINED here
        // ❌ V3: self is the WRONG instance (from a different request)
        console.log(context.user);     // undefined or wrong user!
        self.logger.log("connection"); // wrong API instance!
        
        socket.on("data", (data) => {
            // ❌ V3: Even deeper nesting - context is completely lost
            context.sessionId; // undefined!
        });
    });
    return server;
}
```

**This affects:**
- TCP servers (`net.createServer`)
- HTTP/HTTPS servers (`http.createServer`)
- WebSocket servers
- Custom EventEmitters
- Third-party libraries using events
- Any event-driven API pattern

---

## V3 Design Considerations

### Integration Options

**Option 1: Global EventEmitter.prototype Patching**
- ✅ Automatic - no API author changes needed
- ✅ Works for all EventEmitters (including third-party)
- ⚠️ Modifies global prototype
- ⚠️ Could conflict with other libraries

**Option 2: Per-Instance Wrapping**
- ✅ No global patching
- ✅ Explicit opt-in
- ⚠️ API authors must remember to wrap
- ⚠️ Easy to forget, leading to subtle bugs

**Option 3: Hybrid (Recommended)**
- Global patching as default (can be disabled)
- Explicit wrappers available for granular control
- Config option: `eventEmitter: { autoWrap: true/false }`
- Best of both worlds

### Core Implementation Strategy

**Use Node.js AsyncResource API:**
```javascript
import { AsyncResource } from "node:async_hooks";
import { EventEmitter } from "node:events";

function wrapListener(listener, contextManager, instanceID) {
    // Capture context at registration time
    const store = contextManager.getStore();
    const resource = new AsyncResource("slothlet-event-listener");
    
    const wrappedListener = function(...args) {
        // Execute listener within captured context
        return resource.runInAsyncScope(() => 
            contextManager.runInContext(instanceID, () =>
                listener.apply(this, args)
            ),
            this
        );
    };
    
    // Track for cleanup
    wrappedListener._slothletOriginal = listener;
    wrappedListener._slothletResource = resource;
    
    return wrappedListener;
}
```

### Patching Strategy

**Patch EventEmitter.prototype methods:**
1. `on` / `addListener` - Wrap listener before adding
2. `once` - Wrap listener, ensure cleanup after first call
3. `prependListener` / `prependOnceListener` - Same wrapping
4. `removeListener` / `off` - Clean up AsyncResource
5. `removeAllListeners` - Batch cleanup

**Key Implementation Details:**
```javascript
const originalOn = EventEmitter.prototype.on;

EventEmitter.prototype.on = function(event, listener) {
    // Check if we're in slothlet context
    const contextManager = getActiveContextManager();
    if (!contextManager) {
        // Not in slothlet, use original
        return originalOn.call(this, event, listener);
    }
    
    // Wrap listener with context preservation
    const wrapped = wrapListener(listener, contextManager, getInstanceID());
    
    // Track wrapped listener for removal
    trackListener(this, event, listener, wrapped);
    
    // Call original with wrapped listener
    return originalOn.call(this, event, wrapped);
};
```

---

## V2 Implementation Reference

V2 had two files handling EventEmitter context propagation. These provide implementation guidance but should be redesigned for V3's architecture.

### V2 File 1: `src2/lib/helpers/als-eventemitter.mjs`

**Core Concepts to Port:**
1. AsyncResource-based listener wrapping (✅ Good approach, reuse)
2. Capture context at registration time (✅ Critical pattern)
3. Track wrapped listeners in WeakMap (✅ Prevents memory leaks)
4. Clean up AsyncResource on removeListener (✅ Essential)
5. Global tracking for shutdown cleanup (✅ Important)

**V2 Code Pattern (Reference):**
**V2 Code Pattern (Reference):**
```javascript
// V2 approach - capture at registration, execute in captured context
function runtime_wrapListener(listener) {
    const alsInstance = activeAls;
    const store = alsInstance.getStore();
    const resource = new AsyncResource("slothlet-als-listener");
    
    return function(...args) {
        return resource.runInAsyncScope(() => 
            alsInstance.run(store, () => listener.apply(this, args)),
            this, ...args
        );
    };
}
```

### V2 File 2: `src2/lib/helpers/auto-wrap.mjs`

**Purpose:** Convenience wrappers for Node.js built-in modules so EventEmitter instances are automatically context-aware.

**Core Concept:**
```javascript
// V2 approach - wrap module methods that return EventEmitters
export async function autoWrapEventEmitters(nodeModule) {
    const wrappedModule = { ...nodeModule };
    
    if (typeof nodeModule.createServer === "function") {
        wrappedModule.createServer = function(...args) {
            const server = originalCreateServer.apply(this, args);
            return wrapEmitterInstance(server); // Wrap the returned server
        };
    }
    
    return wrappedModule;
}
```

**V3 Should Simplify:**
- Don't need module-level wrapping if global patching works
- Provide opt-in wrappers for explicit control
- Make it easier (less boilerplate) than V2

---

## V3 Implementation Plan

### Phase 1: Core EventEmitter Patching

1. **Create helper module:** `src/lib/helpers/event-emitter-context.mjs`
2. **Implement listener wrapping** using AsyncResource
3. **Patch EventEmitter.prototype methods:**
   - `on`, `once`, `addListener`
   - `prependListener`, `prependOnceListener`
   - `off`, `removeListener`, `removeAllListeners`
4. **Implement tracking system** (WeakMap for wrapped listeners)
5. **Add cleanup logic** for AsyncResource instances

### Phase 2: Context Manager Integration

1. **Hook into context-async.mjs initialization**
   - Enable patching when context manager is created
   - Provide contextManager reference to patching system
2. **Add shutdown cleanup**
   - Remove all wrapped listeners
   - Destroy all AsyncResource instances
   - Restore original EventEmitter methods
3. **Config option:** `eventEmitter: { enabled: true, autoWrap: true }`

### Phase 3: Convenience Wrappers (Optional)

1. **Explicit wrapper function**
   ```javascript
   export function wrapEmitter(emitter) {
       // Manually wrap specific emitter instance
   }
   ```
2. **Runtime export** for API modules
   ```javascript
   import { wrapEmitter } from "@cldmv/slothlet/runtime";
   ```

### Phase 4: Testing

1. **TCP server test** - `net.createServer` context preservation
2. **HTTP server test** - `http.createServer` context preservation
3. **Custom EventEmitter test** - User-defined EventEmitter subclasses
4. **Nested handlers test** - socket.on("data") inside server.on("connection")
5. **Listener removal test** - Verify AsyncResource cleanup
6. **Shutdown cleanup test** - Verify all resources destroyed
7. **Performance benchmark** - Measure overhead

---

## Test Requirements

### TCP Server Test Module

```javascript
// api_tests/api_test/tcp-server.mjs
import { self, context } from "@cldmv/slothlet/runtime";
import net from "node:net";

export function createServer() {
    const connections = [];
    
    const server = net.createServer((socket) => {
        // Should have context access
        const user = context.user;
        const requestId = context.requestId;
        
        connections.push({ user, requestId, timestamp: Date.now() });
        
        socket.on("data", (data) => {
            // Nested handler should also have context
            self.logger.log(`Data from ${context.user}: ${data}`);
        });
        
        socket.on("end", () => {
            // Context in cleanup handlers too
            self.logger.log(`${context.user} disconnected`);
        });
    });
    
    return { server, connections };
}
```

### Test Suite

```javascript
describe.each(getMatrixConfigs({}))("EventEmitter Context - $name", ({ config }) => {
    test("Context preserved in server.on('connection')", async () => {
        const api = await slothlet({
            ...config,
            dir: TEST_DIRS.API_TEST,
            context: { user: "alice", requestId: "req-123" }
        });
        
        const { server, connections } = api.createServer();
        server.listen(0); // Random port
        
        const port = server.address().port;
        const client = net.connect(port);
        
        await new Promise(resolve => setTimeout(resolve, 100));
        
        expect(connections).toHaveLength(1);
        expect(connections[0].user).toBe("alice");
        expect(connections[0].requestId).toBe("req-123");
        
        client.end();
        server.close();
        await api.shutdown();
    });
    
    test("Context preserved in nested socket.on('data')", async () => {
        // Test nested event handlers
    });
    
    test("Context preserved with .run() isolation", async () => {
        // Test per-request context works with EventEmitters
        await api.slothlet.context.run({ userId: "bob" }, async () => {
            const { server } = api.createServer();
            // Server should see "bob" in handlers
        });
    });
});
```

---

## Key Design Questions

### 1. Where to Hook the Patching?

**Option A:** In Slothlet class constructor
- ✅ Early initialization
- ✅ Simple lifecycle
- ⚠️ Always patches, even if not needed

**Option B:** In context-async.mjs initialization
- ✅ Only patches when ALS runtime is used
- ✅ Tied to actual context system
- ⚠️ More complex initialization sequence

**Option C:** Lazy patching on first API load
- ✅ Zero overhead if no EventEmitters used
- ⚠️ More complex detection logic
- ⚠️ Could miss early EventEmitters

**Recommendation:** Option B - patch in context-async.mjs initialization

### 2. How to Handle Live Binding Runtime?

Live binding runtime doesn't use AsyncLocalStorage. Options:

**Option A:** Skip EventEmitter patching for live mode
- Context is lost in event handlers
- Document limitation

**Option B:** Different wrapping strategy for live mode
- More complex
- Two codepaths to maintain

**Option C:** Recommend async runtime for EventEmitter-heavy apps
- Simpler codebase
- Clear guidance to users

**Recommendation:** Option C initially, consider Option B if needed

### 3. Cleanup Strategy?

**On removeListener:**
- Destroy individual AsyncResource
- Remove from tracking WeakMap
- Clean up references

**On shutdown:**
- Iterate all tracked resources
- Destroy all AsyncResource instances
- Restore original EventEmitter.prototype methods
- Clear all tracking structures

### 4. Config API?

**Proposed config:**
```javascript
const api = await slothlet({
    dir: "./api",
    eventEmitter: {
        enabled: true,        // Enable EventEmitter patching
        autoWrap: true,       // Patch globally or require explicit wrapping
        asyncResourceName: "slothlet-event-listener"
    }
});
```

**Alternative:** No config, always enabled for async runtime

---

## Success Criteria

-  EventEmitter.prototype patched to preserve ALS context
-  Context accessible in all event handlers (\`server.on\`, \`socket.on\`, etc.)
-  Nested event handlers work correctly
-  AsyncResource properly created and destroyed
-  removeListener/removeAllListeners clean up resources
-  Shutdown cleanup destroys all resources
-  Works with tcp-eventemitter-context.test.vitest.mjs (currently failing)
-  Performance overhead < 10% vs unwrapped
-  No memory leaks
-  Full test coverage

---

## Related

- [Class Instance Context Propagation](./class-instance-context-propagation.md) - Similar wrapping challenge
- [Per-Request Context Isolation](./completed/per-request-context-isolation.md) - Context foundation
- [CONTEXT-PROPAGATION.md](../../CONTEXT-PROPAGATION.md) - User documentation
- V2 Reference: \`src2/lib/helpers/als-eventemitter.mjs\`
- V2 Reference: \`src2/lib/helpers/auto-wrap.mjs\`
