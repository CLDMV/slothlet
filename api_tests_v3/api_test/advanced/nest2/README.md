# nest2 Example

This folder contains multi-file exports in a nested structure, demonstrating how to organize related modules in subdirectories.

## Pattern

This pattern shows multiple named exports in a nested folder:

- **Files**: `alpha.mjs`, `beta.mjs`
- **Exports**: Named object exports with methods
- **API Paths**: `api.advanced.nest2.alpha.hello()`, `api.advanced.nest2.beta.world()`

## Usage

### alpha.mjs

```js
api.advanced.nest2.alpha.hello(); // 'alpha hello'
```

### beta.mjs

```js
api.advanced.nest2.beta.world(); // 'beta world'
```

## Use Case

This pattern is ideal for grouping related functionality in logical modules while keeping them organized in nested folder structures. Each file can contain specialized methods while being part of a cohesive API namespace.
