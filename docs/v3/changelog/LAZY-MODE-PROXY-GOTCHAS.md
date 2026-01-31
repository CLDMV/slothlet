# V3 Changelog: Lazy Mode Custom Proxy Behavior

**Document Version:** 1.0  
**Last Updated:** January 31, 2026  
**Applies To:** Slothlet v3.0.0+

---

## Breaking Change: Array Access on Custom Proxies in Lazy Mode

### Overview

In **Slothlet v3 lazy mode**, custom proxies (e.g., exports using `new Proxy()` with array access or custom get traps) require explicit awaiting of the parent wrapper before accessing array indices or other custom proxy features. This is a **behavioral difference** from eager mode and represents a breaking change for users migrating from v2 or switching between loading modes.

---

## The Requirement

### What Changed in V3

When your API module exports a custom proxy with special access patterns (array indices, computed properties, etc.), you **must await the parent wrapper** before accessing those features in lazy mode.

**Example: API Module with Custom Proxy**

```javascript
// api/devices/controllers.mjs
const DeviceControllers = new Proxy({}, {
    get(target, prop) {
        // Array index access: controllers[0]
        if (/^\d+$/.test(prop)) {
            return getDeviceByIndex(parseInt(prop));
        }
        // Named access: controllers.device1
        return target[prop];
    }
});

export default DeviceControllers;
```

### V3 Lazy Mode Requirement

```javascript
import slothlet from "@cldmv/slothlet";

const api = await slothlet.load("./api", { mode: "lazy" });

// ❌ BROKEN: Direct array access in lazy mode
const device = api.devices.controllers[0];
// Returns a waiting proxy, not the actual device object

// ✅ REQUIRED: Await parent wrapper first
await api.devices.controllers;
const device = api.devices.controllers[0];
// Now returns the actual device object
```

---

## Why This Is Required

### Lazy Mode Loading Behavior

1. **Initial State**: `api.devices.controllers` is a waiting proxy (module not loaded)
2. **Array Access**: `[0]` doesn't trigger module loading - it extends the proxy chain
3. **Result**: You get a waiting proxy for `devices.controllers[0]`, not the actual value
4. **Property Access**: Accessing properties on the waiting proxy creates more waiting proxies

### The Problem Without Awaiting

```javascript
// Without awaiting parent
const device = api.devices.controllers[0];

console.log(typeof device);          // "function" (waiting proxy)
console.log(device.id);               // Another waiting proxy, not the actual id
console.log(await device.connect()); // Error: proxy chain fails
```

### The Solution: Await Parent First

```javascript
// Await parent wrapper to trigger module loading
await api.devices.controllers;

// Now array access works correctly
const device = api.devices.controllers[0];

console.log(typeof device);          // "object" ✓
console.log(device.id);               // Actual id value ✓
console.log(await device.connect()); // Works correctly ✓
```

---

## Eager Mode Comparison

### No Await Required in Eager Mode

In **eager mode**, all modules are loaded immediately, so array access works without awaiting:

```javascript
const api = await slothlet.load("./api", { mode: "eager" });

// ✅ Works immediately in eager mode (no await needed)
const device = api.devices.controllers[0];
console.log(device.id); // Actual value
```

### Cross-Mode Compatibility Pattern

To write code that works in **both lazy and eager modes**, always await the parent:

```javascript
// ✅ Works in BOTH lazy and eager modes
await api.devices.controllers;
const device = api.devices.controllers[0];
```

**Why this works:**
- **Lazy mode**: Triggers module loading, then array access works
- **Eager mode**: Module already loaded, await is a no-op, array access works

---

## Common Patterns Requiring Await

### 1. Array Index Access

```javascript
// ❌ Broken in lazy mode
const item = api.collection[0];

// ✅ Required pattern
await api.collection;
const item = api.collection[0];
```

### 2. Numeric Property Access

```javascript
// ❌ Broken in lazy mode
const port = api.servers[8080];

// ✅ Required pattern
await api.servers;
const port = api.servers[8080];
```

### 3. Dynamic Property Access

```javascript
// ❌ Broken in lazy mode
const key = "device1";
const device = api.controllers[key];

// ✅ Required pattern
await api.controllers;
const key = "device1";
const device = api.controllers[key];
```

### 4. Computed Properties

```javascript
// ❌ Broken in lazy mode
const prop = Symbol("custom");
const value = api.registry[prop];

// ✅ Required pattern
await api.registry;
const prop = Symbol("custom");
const value = api.registry[prop];
```

---

## What Works Without Awaiting

### Function Calls Auto-Materialize

Function calls trigger automatic materialization in lazy mode:

```javascript
// ✅ Works without await (function calls auto-materialize)
const result = await api.devices.controllers.getAll();
const status = await api.devices.controllers.getStatus("device1");
```

### Named Property Access Auto-Materializes

Regular property access (not array indices) triggers materialization:

```javascript
// ✅ Works without await (property access auto-materializes)
const config = api.devices.controllers.config;
const version = api.devices.controllers.version;
```

---

## Migration Guide

### Identifying Code That Needs Updates

Search your codebase for array/numeric access patterns:

```bash
# Find potential array access on API objects
grep -r "api\.[a-zA-Z_][a-zA-Z0-9_.]*\[" src/
```

### Update Pattern

**Before (v2 / eager mode):**
```javascript
const device = api.devices.controllers[0];
const port = api.servers[8080];
```

**After (v3 lazy mode compatible):**
```javascript
await api.devices.controllers;
const device = api.devices.controllers[0];

await api.servers;
const port = api.servers[8080];
```

### Batch Pattern for Multiple Accesses

If accessing multiple indices, await once:

```javascript
// ✅ Efficient: Await once, access multiple times
await api.devices.controllers;

const device1 = api.devices.controllers[0];
const device2 = api.devices.controllers[1];
const device3 = api.devices.controllers.byName("primary");
```

---

## Performance Impact

### Startup vs Runtime Trade-offs

**Lazy Mode:**
- ✅ Faster application startup (4.3x improvement)
- ✅ Lower memory footprint (only load what's used)
- ⚠️ Requires explicit await for custom proxy array access
- ⚠️ Small runtime overhead on first access

**Eager Mode:**
- ✅ No await required for any access pattern
- ✅ Slightly faster function calls (1.1x faster)
- ❌ Slower startup (loads everything upfront)
- ❌ Higher memory usage (all modules in memory)

### Recommendation

- Use **lazy mode** for large applications with many modules where startup time matters
- Use **eager mode** for small applications or when custom proxies are heavily used

---

## Summary

### The Core Requirement

**In Slothlet v3 lazy mode, you must await custom proxies before accessing array indices or computed properties.**

```javascript
// ✅ The Required Pattern
await api.custom.proxy;
const value = api.custom.proxy[0];
```

### What Auto-Materializes

- ✅ Function calls: `api.module.func()`
- ✅ Named properties: `api.module.property`
- ❌ Array indices: `api.module[0]` (requires await)
- ❌ Computed properties: `api.module[key]` (requires await)

### Cross-Mode Compatibility

Always await before array/computed access to ensure code works in both modes:

```javascript
// Works in lazy AND eager mode
await api.custom.proxy;
const value = api.custom.proxy[index];
```

---

## Related Documentation

- [V3 Migration Guide](./V3-MIGRATION.md) - Full v2 → v3 migration instructions
- [API Rules](../API-RULES.md) - Core API building rules
- [Performance Guide](../PERFORMANCE.md) - Lazy vs Eager benchmarks
- [Module Structure](../MODULE-STRUCTURE.md) - How modules are loaded and wrapped

---

**Questions or Issues?** Open an issue on GitHub with the `v3-lazy-mode` label.

---

## Related Documentation

- [API Rules](../API-RULES.md) - Core API building rules
- [Context Propagation](../CONTEXT-PROPAGATION.md) - AsyncLocalStorage context system
- [Performance Guide](../PERFORMANCE.md) - Lazy vs Eager benchmarks
- [Module Structure](../MODULE-STRUCTURE.md) - How modules are loaded and wrapped

---

**Questions or Issues?** Open an issue on GitHub with the `lazy-mode` label.
