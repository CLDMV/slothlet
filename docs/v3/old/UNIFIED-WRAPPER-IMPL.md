# UnifiedWrapper `_impl` and Child Adoption System

## Overview

The UnifiedWrapper uses an internal `_impl` property to store the actual module implementation, but **keys are moved out of `_impl` into `_childCache` during the adoption process**. This is critical to understand when working with hot reload and wrapper synchronization.

## Key Properties

### `_impl` (private)
- **Type**: `Object | Function | null`
- **Purpose**: Stores the actual module exports/implementation
- **Lifecycle**: Initially populated with module exports, then **keys are deleted** after child adoption
- **Result**: After `_adoptImplChildren()` runs, `_impl` is often an empty object `{}`

### `__impl` (public getter)
- **Type**: `Object | Function | null`
- **Purpose**: Public getter that returns `this._impl`
- **Usage**: `wrapper.__impl` 
- **Important**: Returns the **current state** of `_impl`, which may be empty after child adoption

### `_childCache` (private)
- **Type**: `Map<string | symbol, UnifiedWrapper>`
- **Purpose**: Stores child property wrappers
- **Lifecycle**: Populated during `_adoptImplChildren()` as keys are moved from `_impl`
- **Result**: This is where the actual child wrappers live

### `_proxyTarget` (private)
- **Type**: `Object | Function`
- **Purpose**: The proxy target object that holds child wrapper references
- **Lifecycle**: Updated during adoption - children added as properties
- **Result**: This is what the proxy traps actually access

## The Adoption Process

### `__setImpl(newImpl)`

When you call `wrapper.__setImpl(newImpl)`:

```javascript
__setImpl(newImpl) {
    this._impl = newImpl;                    // 1. Set new implementation
    this._adoptImplChildren();               // 2. Adopt children (moves keys!)
    this._state.materialized = true;         // 3. Mark as materialized
}
```

### `_adoptImplChildren()`

This is where the **key movement** happens:

```javascript
_adoptImplChildren() {
    // 1. Loop through all keys in _impl
    for (const key of Object.keys(this._impl)) {
        const value = this._impl[key];
        
        // 2. Check if child wrapper already exists
        const existing = this._childCache.get(key);
        if (existing) {
            // Update existing child wrapper
            existing.__setImpl(value);
            delete this._impl[key];          // ⚠️ DELETE from _impl
            continue;
        }
        
        // 3. Create new child wrapper
        const wrapped = this._createChildWrapper(key, value);
        this._childCache.set(key, wrapped);
        this._proxyTarget[key] = wrapped;
        delete this._impl[key];              // ⚠️ DELETE from _impl
    }
}
```

**Critical insight**: Keys are **deleted from `_impl`** after being wrapped. This means:
- `Object.keys(wrapper.__impl)` returns `[]` empty array
- `Object.keys(wrapper)` returns the child keys (via proxy traps)
- The actual data lives in `_childCache` and `_proxyTarget`

## Why This Matters for Hot Reload

### The Problem

When `buildAPI()` returns a wrapper for a subfolder:

```javascript
const newApi = await buildAPI({ dir: "api_tests/smart_flatten/smart_flatten_single" });
// newApi is a wrapper where:
// - newApi.__impl is {} (empty - keys already moved to _childCache)
// - Object.keys(newApi) returns ['default', 'getConfig', 'setConfig', 'validateConfig']
// - The child wrappers are in newApi._childCache
```

### The Incorrect Approach

```javascript
// ❌ WRONG: This copies an empty object
existingWrapper.__setImpl(newWrapper.__impl);  // __impl is {}!
```

This adopts **nothing** because `__impl` is already empty.

### The Correct Approach

You need to **transfer the child wrappers from `_childCache` to `_childCache`**, not copy the empty `_impl`:

```javascript
// ✅ CORRECT: Access _childCache directly or use proxy access
for (const key of Object.keys(newWrapper)) {
    const childWrapper = newWrapper[key];  // Gets from _childCache via proxy
    existingWrapper._childCache.set(key, childWrapper);
    existingWrapper._proxyTarget[key] = childWrapper;
}
```

Or better: **just replace the entire wrapper** instead of trying to sync:

```javascript
// ✅ CORRECT: Replace wrapper entirely (matches buildAPI behavior)
parent[key] = newWrapper;
```

## buildAPI Behavior

`buildAPI()` uses **plain property assignment** to merge exports:

```javascript
// From mergeExportsIntoAPI():
target[propertyName] = exports[key];  // Plain assignment
```

It doesn't try to sync wrappers - it just **replaces them**. This is why initial load works but hot reload breaks when trying to "intelligently" merge wrappers.

## Recommendations

1. **For initial load**: Plain assignment works fine (buildAPI pattern)
2. **For hot reload**: Either:
   - Replace wrapper entirely (plain assignment)
   - OR transfer `_childCache` entries directly
   - DON'T try to copy `__impl` (it's empty)

3. **For wrapper updates**: Use `__setImpl()` only when you have the **actual module exports**, not another wrapper's `__impl`

## Implementation Status

As of v3.0.0, the hot reload system (`addApiComponent`) incorrectly tries to sync wrappers using `__impl`, which fails because `__impl` is empty after child adoption. This needs to be fixed to either:
- Use plain replacement (matches buildAPI)
- Transfer `_childCache` entries properly
