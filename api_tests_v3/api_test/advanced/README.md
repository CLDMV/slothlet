# advanced Example

This folder contains advanced example modules that demonstrate complex patterns and features of the slothlet API loader, including:

## Features Demonstrated

- **Live bindings**: Modules that import and use `self`, `context`, and `reference` from the slothlet loader
- **Cross-module references**: API modules that call other API modules using live bindings
- **Nested structures**: Multi-level folder organization with various export patterns
- **Advanced export patterns**: Complex module structures for testing edge cases

## Modules

### self-object.mjs

Demonstrates live binding usage by calling other API endpoints:

```js
api.advanced.selfObject.addViaSelf(2, 3); // Uses self.math.add via live binding
```

### Nested Folders

- **nest/**: Single function that becomes callable at folder level (`api.advanced.nest()`)
- **nest2/**: Multi-file exports with alpha and beta objects (`api.advanced.nest2.alpha`, `api.advanced.nest2.beta`)
- **nest3/**: Single file that becomes callable at folder level (`api.advanced.nest3()`)
- **nest4/**: Single file with named export (`api.advanced.nest4.singlefile()`)

## Live Bindings Pattern

The modules in this folder show how to properly import live bindings:

```js
import { self, context, reference } from "@cldmv/slothlet/runtime";
```

This pattern allows modules to access the full API context and call other endpoints dynamically.
