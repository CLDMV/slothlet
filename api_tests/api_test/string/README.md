# string Example

This folder demonstrates the **filename-folder flattening** behavior of slothlet.

## Flattening Pattern

When a filename matches its folder name (`string/string.mjs`), the exports from that file are flattened to the folder level:

- **File**: `string/string.mjs`
- **Export**: `export const string = { ... }`
- **API Path**: `api.string.upper()`, `api.string.reverse()` (object methods flattened to folder level)

## Usage

```js
api.string.upper("abc"); // 'ABC'
api.string.reverse("abc"); // 'cba'
```

## Use Case

This pattern allows you to organize related string manipulation utilities in a single file while keeping the API structure clean. The filename-folder matching tells slothlet to flatten the exports, so instead of `api.string.string.upper()` you get the cleaner `api.string.upper()` structure.

By organizing your code this way, you can keep string manipulation utilities together in appropriately named files, making your API endpoints more discoverable and maintainable.
