# nest Example

This folder demonstrates the **filename-folder flattening** behavior of slothlet.

## Flattening Pattern

When a filename matches its folder name (`nest/nest.mjs`), the exports from that file are flattened to the folder level:

- **File**: `nest/nest.mjs`
- **Export**: `export function alpha(name)`
- **API Path**: `api.advanced.nest()` (function is flattened and becomes callable at folder level)

This is different from having separate named functions - the folder itself becomes callable because the filename matches the folder name.

## Usage

```js
api.advanced.nest('test'); // Calls the alpha function with flattening behavior
```

## Use Case

This pattern is useful when you want a folder to represent a single logical operation while keeping the code organized in a appropriately named file. The filename-folder matching tells slothlet to flatten the exports up one level, making the API cleaner and more intuitive.
