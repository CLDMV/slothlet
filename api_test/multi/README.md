# multi Example

This folder contains example modules that export multiple named objects with methods. This pattern allows:

- Direct calls to each object's methods (e.g., `api.multi.alpha.hello()`, `api.multi.beta.world()`)
- Grouping related operations in a single API endpoint
- Multiple modules in one folder namespace

## Usage

### alpha.mjs

```js
api.multi.alpha.hello(); // 'alpha hello'
```

### beta.mjs

```js
api.multi.beta.world(); // 'beta world'
```

## Use Case

By organizing your code this way, you can keep related utilities together, making your API endpoints more discoverable and maintainable. Each file can contain specialized object methods while being part of a cohesive API namespace.
