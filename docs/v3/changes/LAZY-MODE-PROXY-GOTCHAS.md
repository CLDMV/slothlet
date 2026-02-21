# V3 Changelog: Lazy Mode Custom Proxy Behavior & Materialization Timing

**Document Version:** 2.0  
**Last Updated:** January 31, 2026  
**Applies To:** Slothlet v3.0.0+

---

## Overview: Lazy Mode Async Materialization

### Key Understanding

In **Slothlet v3 lazy mode**, module materialization is **asynchronous**. While accessing properties triggers materialization, there's a small timing window (~10-20ms) where `_impl` is being set and `_childCache` is being populated. During this window, property access may return waiting proxies instead of actual values.

**This is a timing issue, not an architectural requirement.** Both v2 and v3 use async materialization, but v3 has more overhead due to:
- UnifiedWrapper creation for each property
- `_adoptImplChildren()` processing
- Lifecycle event emission
- Metadata tagging and management

### What This Means

**Direct property access works without await**, but you may encounter waiting proxies if accessing immediately after triggering materialization:

```javascript
import slothlet from "@cldmv/slothlet";

const api = await slothlet.load("./api", { mode: "lazy" });

// Triggers materialization
const device = api.devices.controllers[0];

// Immediately accessing properties might return waiting proxy
console.log(device.id);  // May be waiting proxy if materialization incomplete

// Small delay allows materialization to complete
await new Promise(resolve => setTimeout(resolve, 20));
console.log(device.id);  // Now returns actual value
```

**OR** you can await the parent wrapper to ensure materialization completes:

```javascript
// Ensure materialization completes before accessing
await api.devices.controllers;
const device = api.devices.controllers[0];
console.log(device.id);  // Always works - materialization guaranteed complete
```

---

## When Waiting Proxies Appear

### Scenario 1: Immediate Access After Triggering Materialization

```javascript
// Trigger materialization by accessing deeply nested path
const controller = api.devices.lg[0];

// Immediately access property - may return waiting proxy
console.log(controller.tvId);  // Waiting proxy if materialization not done

// After short delay, waiting proxy resolves
setTimeout(() => {
    console.log(controller.tvId);  // Actual value - "tv1"
}, 20);
```

### Scenario 2: Rapid Sequential Access

```javascript
// First access triggers materialization
const lg = api.devices.lg;

// Immediate array access may return waiting proxy
const controller = lg[0];  // Waiting proxy during materialization

// Properties on waiting proxy return more waiting proxies
console.log(controller.tvId);  // Waiting proxy

// Wait for materialization
await new Promise(resolve => setTimeout(resolve, 20));

// Now everything resolves correctly
const controller2 = lg[0];
console.log(controller2.tvId);  // "tv1"
```

---

## How Waiting Proxies Work

### Waiting Proxy Behavior

Waiting proxies are **placeholders** created when:
1. Property accessed on lazy wrapper that hasn't materialized yet
2. Materialization is triggered but not complete
3. Parent's `_childCache` hasn't been populated yet

### Automatic Resolution

Once the parent wrapper materializes:
- `_impl` is set to the loaded module
- `_adoptImplChildren()` populates `_childCache`
- Waiting proxies resolve through `_childCache` to find actual values
- Custom proxies delegate property access correctly

```javascript
// Waiting proxy created during materialization
const lgProxy = api.devices.lg;  // _impl not set yet

// Accessing properties returns waiting proxies
const controller = lgProxy[0];  // Waiting proxy

// After materialization completes (~20ms)
// - api.devices._impl is set
// - api.devices._childCache has "lg" entry
// - Waiting proxy resolves through childCache
// - lg's _impl is the LGTVControllers custom proxy
// - Custom proxy's get trap handles [0] access
// - Returns actual TVController object

const controller2 = lgProxy[0];  // Now returns TVController
console.log(controller2.tvId);  // "tv1"
```

---

## Working Patterns

---

## Working Patterns

### Pattern 1: Await Parent Wrapper (Recommended)

```javascript
// ✅ Most reliable: Ensure materialization complete
await api.devices.controllers;
const device = api.devices.controllers[0];
console.log(device.id);  // Always works
```

### Pattern 2: Small Delay After Access

```javascript
// ✅ Works: Give materialization time to complete
const controller = api.devices.lg[0];
await new Promise(resolve => setTimeout(resolve, 20));
console.log(controller.tvId);  // Now resolved
```

### Pattern 3: Function Calls Auto-Wait

```javascript
// ✅ Function calls wait for materialization automatically
const status = await api.devices.controllers.getStatus("device1");
// No waiting proxy - function call handles async materialization
```

### Pattern 4: Check __type Property

```javascript
// ✅ Detect waiting proxies programmatically
const device = api.devices.lg[0];

if (device.__type === Symbol.for("inFlight")) {
    // It's a waiting proxy - materialization in progress
    await new Promise(resolve => setTimeout(resolve, 20));
    // Try again
}

console.log(device.tvId);
```

---

## Eager Mode Comparison

### No Timing Issues in Eager Mode

In **eager mode**, all modules load immediately during `slothlet.load()`:

```javascript
const api = await slothlet.load("./api", { mode: "eager" });

// ✅ Works immediately - no waiting proxies
const device = api.devices.controllers[0];
console.log(device.id);  // Actual value
```

### Cross-Mode Compatibility

To write code that works in **both modes**, always await the parent:

```javascript
// ✅ Works in BOTH lazy and eager modes
await api.devices.controllers;
const device = api.devices.controllers[0];
```

**Why this works:**
- **Lazy mode**: Ensures materialization completes before access
- **Eager mode**: Module already loaded, await is immediate no-op

---

## Performance Characteristics

### Lazy Mode Materialization Timing

**Typical timing breakdown:**
- Module import: ~5-10ms
- Wrapper creation: ~2-5ms per property
- `_adoptImplChildren()`: ~3-8ms
- Lifecycle events: ~1-3ms
- **Total**: ~10-20ms per folder/module

**Factors affecting timing:**
- Number of exports in module
- Nesting depth (folders within folders)
- Number of active lifecycle listeners
- System load and I/O performance

### Comparison with V2

- **V2 lazy mode**: ~1-5ms materialization (simpler architecture)
- **V3 lazy mode**: ~10-20ms materialization (richer features)
- **Tradeoff**: V3 slower but provides better metadata, hooks, inspection

---

## Common Patterns Requiring Awareness

### 1. Array Index Access on Custom Proxies

```javascript
// Custom proxy with array access
const controllers = new Proxy({}, {
    get(target, prop) {
        if (/^\d+$/.test(prop)) {
            return getDeviceByIndex(parseInt(prop));
        }
        return target[prop];
    }
});

// ✅ Reliable pattern
await api.devices.controllers;
const device = api.devices.controllers[0];
```

### 2. Rapid Property Traversal

```javascript
// Multiple levels accessed rapidly
const value = api.deeply.nested.path.to.value;

// May return waiting proxy if path not materialized yet
// ✅ Better: Await intermediate paths
await api.deeply.nested.path;
const value = api.deeply.nested.path.to.value;
```

### 3. Loop Access

```javascript
// ❌ May get waiting proxies in early iterations
for (let i = 0; i < 10; i++) {
    const device = api.devices.controllers[i];
    console.log(device.id);  // Might be waiting proxy
}

// ✅ Ensure materialized first
await api.devices.controllers;
for (let i = 0; i < 10; i++) {
    const device = api.devices.controllers[i];
    console.log(device.id);  // Always actual value
}
```

---

## What Auto-Materializes Without Issues

### Function Calls

Function calls trigger materialization and wait for completion:

```javascript
// ✅ Works reliably - function call waits
const result = await api.devices.controllers.getAll();
const status = await api.devices.controllers.getStatus("device1");
```

### Named Property Access (Not Array Indices)

Regular property access triggers materialization:

```javascript
// ✅ Works - triggers materialization
const config = api.devices.controllers.config;
const version = api.devices.controllers.version;

// But immediate property access on returned value might return waiting proxy
console.log(config.host);  // May be waiting proxy if config itself is lazy wrapper

// ✅ More reliable
await api.devices.controllers.config;
console.log(config.host);  // Actual value
```

---

## The Real Requirement: Understanding Timing

### It's Not "Await Required" - It's "Await Recommended"

The documentation previously stated await was "required" for custom proxies. **This is inaccurate.** The actual situation:

1. **Property access works without await** - it triggers materialization
2. **Waiting proxies appear during materialization window** (~10-20ms)
3. **Waiting proxies auto-resolve** once materialization completes
4. **Awaiting parent ensures materialization done** before you access properties

### When You Can Skip Await

If your code naturally has delays (async operations, network calls, etc.), waiting proxies will resolve:

```javascript
// Trigger materialization
const device = api.devices.lg[0];

// Do other async work (gives time for materialization)
await fetch("https://api.example.com/status");
await processData();

// By now, materialization likely complete
console.log(device.tvId);  // Works - materialization finished during other operations
```

### When You Should Await

When accessing properties immediately after traversing a path:

```javascript
// ❌ Risky: Immediate access after path traversal
const device = api.devices.lg[0];
console.log(device.tvId);  // Might be waiting proxy

// ✅ Safe: Await ensures materialization complete
await api.devices.lg;
const device = api.devices.lg[0];
console.log(device.tvId);  // Guaranteed actual value
```

---

## Migration Guide

### From V2 or Eager Mode

**No code changes required** if you're okay with small timing delays. But for guaranteed immediate access:

**Before:**
```javascript
const device = api.devices.controllers[0];
console.log(device.id);
```

**After (V3 lazy mode compatible):**
```javascript
await api.devices.controllers;
const device = api.devices.controllers[0];
console.log(device.id);
```

### Testing Strategy

Add small delays in tests to account for materialization timing:

```javascript
// ✅ Test pattern for lazy mode
it("should access custom proxy array indices", async () => {
    const lg = api.devices.lg;
    
    // Allow materialization to complete
    await new Promise(resolve => setTimeout(resolve, 20));
    
    const controller = lg[0];
    expect(controller.tvId).toBe("tv1");
});
```

---

## Future Improvements

See [`docs/v3/todo/future/lazy-mode-performance-optimization.md`](../todo/future/lazy-mode-performance-optimization.md) for planned optimizations to reduce materialization time closer to v2 levels.

**Target**: Reduce materialization time from ~20ms to <10ms through:
- Lazy child wrapper creation
- Batched lifecycle events  
- Conditional wrapping
- Fast paths for common cases

---

## Summary

### Core Understanding

**V3 lazy mode has async materialization with ~10-20ms timing window. Waiting proxies appear during this window but auto-resolve once materialization completes.**

### Best Practices

1. **✅ Await parent before array/computed access for guaranteed results**
2. **✅ Use small delays in tests (20ms) to account for materialization**
3. **✅ Function calls handle materialization automatically**
4. **✅ Check `__type` property to detect waiting proxies**
5. **✅ Cross-mode compatible: Always await when working with custom proxies**

### What Changed from V2

- **V2**: Materialization ~1-5ms (nearly instant)
- **V3**: Materialization ~10-20ms (richer features, more overhead)
- **Impact**: Tests need small delays where v2 worked "instantly"

---

## Related Documentation

- [Lazy Mode Performance Optimization](../todo/future/lazy-mode-performance-optimization.md) - Future improvements
- [API Rules](../API-RULES.md) - Core API building rules
- [Performance Guide](../PERFORMANCE.md) - Lazy vs Eager benchmarks
- [Module Structure](../MODULE-STRUCTURE.md) - How modules are loaded and wrapped
- [UnifiedWrapper](../../../src/lib/handlers/unified-wrapper.mjs) - Wrapper implementation

---

**Questions or Issues?** Open an issue on GitHub with the `v3-lazy-mode` label.
