# math Example

This folder demonstrates the **filename-folder flattening** behavior of slothlet.

## Flattening Pattern

When a filename matches its folder name (`math/math.mjs`), the exports from that file are flattened to the folder level:

- **File**: `math/math.mjs`
- **Export**: `export const math = { ... }`
- **API Path**: `api.math.add()`, `api.math.multiply()` (object methods flattened to folder level)

## Usage

```js
api.math.add(2, 3); // 5
api.math.multiply(2, 3); // 6
```

## Use Case

This pattern allows you to organize related mathematical utilities in a single file while keeping the API structure clean. The filename-folder matching tells slothlet to flatten the exports, so instead of `api.math.math.add()` you get the cleaner `api.math.add()` structure.

By organizing your code this way, you can keep mathematical utilities together in appropriately named files, making your API endpoints more discoverable and maintainable.
