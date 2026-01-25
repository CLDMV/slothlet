# CRITICAL: EventEmitter Context Propagation Missing in V3

**Status:** ⚠️ **NOT IMPLEMENTED** - No stubs, no documentation, no code  
**Priority:** 🔴 **CRITICAL** - Breaking feature for event-driven APIs  
**Impact:** User code using EventEmitters will lose AsyncLocalStorage context across event boundaries

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

**📋 When EventEmitter context tests pass 100%:**
- Add EventEmitter-related test files to `tests/vitests/baseline-tests.json`
- But ONLY if `npm run debug` AND `npm run testv3 -- --baseline` both pass
- This ensures we catch regressions in working tests immediately

---

## Problem Statement

V3 of slothlet is **completely missing** the EventEmitter context propagation system that was a core feature of V2. This is a critical architectural gap that will cause silent context loss for any API that uses event-driven patterns (TCP servers, HTTP servers, custom EventEmitters, etc.).

### What's Missing

**No EventEmitter patching system in V3:**
- ❌ No `als-eventemitter.mjs` equivalent
- ❌ No `auto-wrap.mjs` equivalent  
- ❌ No AsyncResource-based listener wrapping
- ❌ No documentation about EventEmitter support
- ❌ No stubs or placeholders indicating this needs to be implemented

**Search Results:**
```bash
# Searching V3 codebase (src/):
grep -r "EventEmitter" src/         # 0 matches
grep -r "AsyncResource" src/        # 0 matches (only AsyncLocalStorage import)
grep -r "async_hooks" src/          # 1 match (AsyncLocalStorage only)
```

### Why This Is Critical

When API modules use EventEmitters (a fundamental Node.js pattern), event handler callbacks execute in a **different async context** than where they were registered. Without proper context propagation:

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

**This silently breaks:**
- TCP servers (net.createServer)
- HTTP servers (http.createServer)
- WebSocket servers
- Custom EventEmitters
- Any event-driven API code
- Third-party libraries that use events

---

## V2 Implementation (What Needs To Be Ported)

V2 had **two critical files** that handled EventEmitter context propagation:

### 1. `src2/lib/helpers/als-eventemitter.mjs` (393 lines)

**Purpose:** Patches `EventEmitter.prototype` globally to preserve AsyncLocalStorage context across all event listeners using Node.js AsyncResource API.

**Key Components:**

#### A. EventEmitter Prototype Patching
```javascript
enableAlsForEventEmitters(als) {
    // Patches EventEmitter.prototype methods:
    // - on, once, addListener
    // - prependListener, prependOnceListener  
    // - off, removeListener, removeAllListeners
}
```

#### B. Listener Wrapping with AsyncResource
```javascript
function runtime_wrapListener(listener) {
    const alsInstance = activeAls;
    const store = alsInstance.getStore(); // Capture context at registration time
    
    const resource = new AsyncResource("slothlet-als-listener");
    
    const runtime_wrappedListener = function(...args) {
        // Re-enter the ALS store captured at registration
        return resource.runInAsyncScope(() => 
            alsInstance.run(resolvedStore, () => 
                listener.apply(this, args)
            ), 
            this, 
            ...args
        );
    };
    
    return runtime_wrappedListener;
}
```

#### C. Tracking and Cleanup
```javascript
// Track all wrapped listeners for proper cleanup
const globalListenerTracker = new WeakMap();
const globalResourceSet = new Set();
const allPatchedListeners = new Set();

// Clean up AsyncResource on removeListener
if (wrapped._slothletResource) {
    const resource = wrapped._slothletResource;
    globalResourceSet.delete(resource);
    resource.emitDestroy();
}
```

#### D. Key Features
- **Capture-at-registration:** Context is captured when `.on()` is called, not when event fires
- **AsyncResource isolation:** Each listener gets its own AsyncResource
- **Proper cleanup:** Resources are destroyed when listeners are removed
- **Global tracking:** All patched listeners tracked for shutdown cleanup
- **Runtime ALS injection:** Runtime can inject the shared ALS instance

### 2. `src2/lib/helpers/auto-wrap.mjs` (85 lines)

**Purpose:** Automatically wraps Node.js built-in modules (like `net`) so that EventEmitter instances created within API context are automatically context-aware.

**Key Components:**

#### A. Module-Level Auto-Wrapping
```javascript
export async function autoWrapEventEmitters(nodeModule) {
    const { self } = await import("@cldmv/slothlet/runtime/async");
    if (!self?.__ctx) {
        return nodeModule; // Not in slothlet context
    }
    
    const { makeWrapper } = await import("@cldmv/slothlet/runtime/async");
    const wrapper = makeWrapper(self.__ctx);
    
    // Create wrapped version
    const wrappedModule = { ...nodeModule };
    
    // Wrap EventEmitter constructors
    if (typeof nodeModule.createServer === "function") {
        wrappedModule.createServer = function(...args) {
            const server = originalCreateServer.apply(this, args);
            return wrapper(server); // Return wrapped instance
        };
    }
    
    return wrappedModule;
}
```

#### B. Convenient Getters
```javascript
export async function getNet() {
    const originalNet = await import("node:net");
    return autoWrapEventEmitters(originalNet.default || originalNet);
}
```

**Usage in API modules:**
```javascript
// Instead of: import net from "node:net";
import { getNet } from "@cldmv/slothlet/src/lib/helpers/auto-wrap";
const net = await getNet(); // Returns wrapped version

// Now server and sockets automatically preserve context
const server = net.createServer((socket) => {
    console.log(context.user); // ✅ Works!
});
```

---

## Related Test Files

The following test files in `tests/vitests` are related to EventEmitter context propagation:

- **`suites/context/tcp-eventemitter-context.test.vitest.mjs`** - Tests EventEmitter context preservation across TCP socket events
- **`suites/context/tcp-context-propagation.test.vitest.mjs`** - Tests context propagation in TCP server scenarios
- **`suites/context/auto-context-propagation.test.vitest.mjs`** - Tests automatic context propagation
- **`suites/listener-cleanup/listener-cleanup.test.vitest.mjs`** - Tests EventEmitter listener cleanup on shutdown
- **`suites/listener-cleanup/third-party-cleanup.test.vitest.mjs`** - Tests cleanup of third-party EventEmitter listeners

---

## What V3 Needs

### Required Components

1. **EventEmitter Patching System**
   - Port `als-eventemitter.mjs` to V3 architecture
   - Integrate with V3's UnifiedWrapper system
   - Use V3's context-async.mjs instead of separate runtime
   - Support both async and live runtime modes

2. **Auto-Wrapping Helpers**
   - Port `auto-wrap.mjs` concept
   - Provide convenient wrappers for common Node.js modules:
     - `net` (TCP servers)
     - `http`/`https` (HTTP servers)  
     - `events` (custom EventEmitters)
   - Make it easy for API authors to opt-in

3. **Integration Points**

   **A. Component-Based Architecture:**
   ```javascript
   // V3 uses ComponentBase pattern
   export class EventEmitterHelper extends ComponentBase {
       static slothletProperty = "eventEmitterHelper";
       
       enablePatching() {
           // Patch EventEmitter.prototype
       }
       
       disablePatching() {
           // Restore original methods
       }
       
       wrapEmitter(emitter) {
           // Wrap specific instance
       }
   }
   ```

   **B. Runtime Integration:**
   ```javascript
   // src/lib/handlers/context-async.mjs needs to:
   // 1. Import the EventEmitter helper
   // 2. Call enablePatching() during initialization
   // 3. Call disablePatching() during shutdown
   ```

   **C. UnifiedWrapper Support:**
   ```javascript
   // UnifiedWrapper may need EventEmitter-specific handling
   // Check if target is EventEmitter subclass
   if (target instanceof EventEmitter) {
       // Apply additional event-specific wrapping
   }
   ```

4. **Documentation Updates**
   - Update `docs/CONTEXT-PROPAGATION.md` with V3-specific details
   - Add EventEmitter examples to API documentation
   - Document auto-wrap helpers usage
   - Add migration notes for V2 → V3 users

5. **Testing Requirements**
   - Test TCP server context propagation
   - Test HTTP server context propagation
   - Test custom EventEmitters
   - Test nested event handlers
   - Test listener removal and cleanup
   - Test shutdown behavior
   - Test with both async and live runtime modes

---

## Architecture Considerations for V3

### Differences from V2

**V2 Architecture:**
- Separate runtime files (`runtime/async.mjs`, `runtime/live.mjs`)
- `makeWrapper()` function for wrapping objects
- Separate ALS instance management

**V3 Architecture:**
- Unified `context-async.mjs` handler
- ComponentBase pattern for all helpers
- UnifiedWrapper for proxy-based wrapping
- Single AsyncLocalStorage instance in context manager

### Integration Strategy

**Option 1: Global EventEmitter Patching (V2 approach)**
- ✅ Automatic - works for all EventEmitters
- ✅ No API author changes needed
- ⚠️ Affects global prototype
- ⚠️ Could conflict with other libraries

**Option 2: Explicit Wrapping (Safer)**
- ✅ No global patching
- ✅ Explicit opt-in per module
- ⚠️ API authors must use wrapped versions
- ⚠️ Easy to forget and lose context

**Option 3: Hybrid Approach (Recommended)**
- Global patching for AsyncLocalStorage runtime (like V2)
- Explicit wrapping helpers available for granular control
- Documentation guides users to best practices
- Disable global patching if conflicts detected

### Performance Considerations

**V2 Metrics:**
- AsyncResource overhead: ~2-5% per event
- Wrapping overhead: Minimal (WeakMap lookup)
- Cleanup overhead: Negligible

**V3 Should:**
- Benchmark against V2 performance
- Consider lazy patching (only patch when first EventEmitter is created in API context)
- Reuse AsyncResource instances when possible
- Ensure WeakMap cleanup doesn't leak memory

---

## Implementation Checklist

### Phase 1: Core Infrastructure
- [ ] Create `src/lib/helpers/event-emitter-helper.mjs` component class
- [ ] Port AsyncResource-based listener wrapping logic
- [ ] Integrate with V3's context manager (AsyncLocalStorage access)
- [ ] Add enable/disable patching methods
- [ ] Add global tracking for cleanup

### Phase 2: Integration
- [ ] Hook into `context-async.mjs` initialization
- [ ] Add shutdown cleanup to context manager
- [ ] Test with UnifiedWrapper compatibility
- [ ] Handle both async and live runtime modes

### Phase 3: Auto-Wrapping Helpers
- [ ] Create `src/lib/helpers/auto-wrap-net.mjs`
- [ ] Create `src/lib/helpers/auto-wrap-http.mjs`  
- [ ] Provide convenient module getter functions
- [ ] Document usage patterns

### Phase 4: Testing
- [ ] Add TCP server test (net.createServer)
- [ ] Add HTTP server test (http.createServer)
- [ ] Add custom EventEmitter test
- [ ] Add nested event handler test
- [ ] Add cleanup and removal test
- [ ] Add performance benchmarks

### Phase 5: Documentation
- [ ] Update `CONTEXT-PROPAGATION.md` for V3
- [ ] Add EventEmitter examples to API docs
- [ ] Document auto-wrap helper usage
- [ ] Add V2→V3 migration notes
- [ ] Update changelog

---

## Code References

### V2 Files (Source Material)
```
src2/lib/helpers/als-eventemitter.mjs    (393 lines)
src2/lib/helpers/auto-wrap.mjs           (85 lines)
```

### V3 Integration Points
```
src/lib/handlers/context-async.mjs       (AsyncLocalStorage runtime)
src/lib/handlers/unified-wrapper.mjs     (Proxy-based wrapping)
src/lib/factories/component-base.mjs     (Component pattern)
```

### Documentation Files
```
docs/CONTEXT-PROPAGATION.md              (Claims EventEmitter support works)
docs/changelog/v2.3.md                   (EventEmitter feature announcement)
```

---

## Risk Assessment

**Critical Risks:**

1. **Silent Failures**
   - Users won't get errors, context will just be `undefined`
   - Data corruption risk (wrong user's context in multi-tenant apps)
   - Security risk (accessing wrong session data)

2. **Documentation Mismatch**
   - `CONTEXT-PROPAGATION.md` claims EventEmitter support works
   - Users will expect it based on docs
   - No migration guide warns about this gap

3. **V2→V3 Breaking Change**
   - Users upgrading from V2 will silently lose EventEmitter context
   - No deprecation warnings
   - No runtime errors to indicate the issue

**Mitigation:**
- Add this to `BREAKING-CHANGES-V3.md` immediately
- Add runtime warning if EventEmitter is detected in API modules
- Prioritize implementation before V3 stable release

---

## Questions to Resolve

1. **Should EventEmitter patching be opt-in or automatic?**
   - V2: Automatic via `runtime: "async"` config
   - V3: Consider explicit opt-in to avoid surprises?

2. **How does this interact with UnifiedWrapper?**
   - Should UnifiedWrapper detect EventEmitter subclasses?
   - Should auto-wrapping happen at module load or instance creation?

3. **What about live-binding runtime?**
   - V2 auto-wrap only worked with async runtime
   - Does V3 live runtime need EventEmitter support?
   - Different approach needed?

4. **Memory management strategy?**
   - V2 used WeakMaps and Sets for tracking
   - V3 UnifiedWrapper already tracks instances
   - Can we reuse existing tracking infrastructure?

5. **Third-party EventEmitter subclasses?**
   - V2 patched `EventEmitter.prototype` (catches all subclasses)
   - V3 should do the same or provide explicit wrappers?

---

## Related Issues

- `BREAKING-CHANGES-V3.md` - Should document EventEmitter gap
- `V2-V3-GAP-LIST.md` - Should list this as a missing feature
- `docs/CONTEXT-PROPAGATION.md` - Incorrectly claims EventEmitter support exists in V3

---

## Next Steps

1. **Immediate:** Add to BREAKING-CHANGES-V3.md
2. **Short-term:** Create EventEmitterHelper component class
3. **Medium-term:** Port core patching logic from V2
4. **Long-term:** Add auto-wrap helpers and documentation

---

**Document Created:** 2026-01-24  
**Priority:** CRITICAL  
**Estimated Effort:** 3-5 days (core patching) + 2-3 days (helpers + docs + tests)  
**Risk if not implemented:** Silent context loss, data corruption, security issues in production
