# funcmod Example

This folder demonstrates the **filename-folder flattening** behavior with a default export function.

## Flattening Pattern

When a filename matches its folder name (`funcmod/funcmod.mjs`), the exports from that file are flattened to the folder level:

- **File**: `funcmod/funcmod.mjs`
- **Export**: `export default function(name)`
- **API Path**: `api.funcmod(name)` (function flattened to folder level)

## Usage

```js
api.funcmod("slothlet"); // 'Hello, slothlet!'
```

## Use Case

This pattern allows you to create focused API endpoints for individual operations while keeping them organized in appropriately named files. The filename-folder matching tells slothlet to flatten the default export, making the API cleaner by allowing direct calls to `api.funcmod()` instead of requiring a nested structure.

By organizing your code this way, you can create focused API endpoints for individual operations, making your codebase easy to use and maintain.
