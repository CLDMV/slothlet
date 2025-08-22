# multi_func Example

This folder contains example modules that export multiple functions and objects, demonstrating mixed export patterns. This pattern allows:

- Direct calls to functions (e.g., `api.multi_func.alpha(name)`)
- Calls to object methods (e.g., `api.multi_func.beta.hello()`)
- Flattened named exports (e.g., `api.multi_func.multi_func_hello()`)
- Grouping related but differently structured operations in a single API endpoint

## Usage

### alpha.mjs (Function Export)

```js
api.multi_func.alpha("test"); // 'alpha: test'
```

### beta.mjs (Object Export)

```js
api.multi_func.beta.hello(); // 'beta hello'
```

### Flattened Named Exports

Additional functions that are flattened to the multi_func namespace:

```js
api.multi_func.multi_func_hello(); // Function result
api.multi_func.uniqueOne(); // Function result
api.multi_func.uniqueTwo(); // Function result
api.multi_func.uniqueThree(); // Function result
```

## Use Case

This example demonstrates slothlet's flexibility in handling mixed export patterns within a single folder. Some utilities work better as direct functions, others as objects with methods, and some are flattened from multiple sources into the same namespace.
