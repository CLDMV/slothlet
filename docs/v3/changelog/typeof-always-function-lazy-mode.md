# `typeof` Always Returns "function" in Lazy Mode

**Category**: Architecture / Lazy Mode Behavior  
**Severity**: Documentation / Behavioral Note  
**Affects**: Lazy mode only  
**Date**: 2026-01-21

## Summary

In lazy mode, `typeof api.math.add` will **always return `"function"`** even if the module hasn't been materialized yet. This is because the lazy mode proxy wraps functions, and JavaScript's `typeof` operator checks the proxy target (which is always a function) rather than the actual implementation.

## Why This Happens

When lazy mode creates the API, it only has access to the proxy wrapper functions, not the actual implementations. The proxy target is a function that will trigger materialization when called. Therefore:

```javascript
// Lazy mode - always returns "function"
typeof api.math.add === "function"  // ✅ true (even if not materialized)

// But the actual impl might not be loaded yet
await api.math.add(2, 3)  // This triggers materialization
```

## How to Check Actual Materialization Status

This is **why we added `__type`**. Use `__type` to check if a module is actually materialized:

```javascript
const api = await slothlet({ mode: "lazy" });

// Check if module is materialized
const mathType = api.math.__type;

if (mathType === api.slothlet.types.IN_FLIGHT) {
	console.log("Module is loading but not materialized yet");
} else if (mathType === api.slothlet.types.UNMATERIALIZED) {
	console.log("Module has not started loading yet");
} else {
	console.log("Module is materialized, __type is:", mathType);  // e.g., "object"
}

// typeof will ALWAYS say "function" in lazy mode
console.log(typeof api.math.add);  // "function" regardless of materialization
```

## Comparison with Eager Mode

**Eager Mode**: All modules are loaded immediately, so `typeof` accurately reflects the actual implementation type.

```javascript
const api = await slothlet({ mode: "eager" });

// Eager mode - typeof reflects actual impl
typeof api.math.add === "function"  // true (because it IS the function)
typeof api.math === "object"        // true (because it IS the object)
```

**Lazy Mode**: Modules are wrapped in proxies, so `typeof` always returns the proxy target type (function).

```javascript
const api = await slothlet({ mode: "lazy" });

// Lazy mode - typeof reflects proxy target (function)
typeof api.math.add === "function"  // true (proxy is a function)
typeof api.math === "function"      // true (proxy is a function, NOT "object"!)
```

## Practical Implications

### ✅ Safe to Use `typeof` for:
- Checking if something exists at all
- Feature detection where you don't care about materialization

### ❌ Do NOT use `typeof` for:
- Checking if a lazy module is actually loaded
- Determining actual implementation type before calling

### ✅ Use `__type` instead:
```javascript
// Check actual materialization before calling
const mathType = api.math.__type;
if (mathType !== api.slothlet.types.IN_FLIGHT && 
    mathType !== api.slothlet.types.UNMATERIALIZED) {
	// Safe to call - module is materialized
	const result = await api.math.add(2, 3);
}
```

## Related

- See [CONTEXT-PROPAGATION.md](../../CONTEXT-PROPAGATION.md) for more on lazy mode behavior
- See [PERFORMANCE.md](../../PERFORMANCE.md) for lazy vs eager mode comparison
- The `__type` property is the authoritative way to check materialization status in lazy mode
