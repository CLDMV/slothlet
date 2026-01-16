# exportDefault Example

This folder demonstrates the **filename-folder flattening** behavior with hybrid default and named exports.

## Flattening Pattern

When a filename matches its folder name (`exportDefault/exportDefault.mjs`), the exports are flattened to the folder level:

- **File**: `exportDefault/exportDefault.mjs`
- **Export**: `export default function` with attached named methods
- **API Path**: `api.exportDefault()` (callable) with `api.exportDefault.extra()`

## Usage

```js
// Call the default function
api.exportDefault(); // 'exportDefault default'

// Call named method attached to the function
api.exportDefault.extra(); // 'extra method'
```

## Use Case

This pattern shows how filename-folder flattening works with hybrid export patterns (default + named). The flattening behavior eliminates redundant nesting while preserving both the callable nature of the default export and access to named methods.

By organizing your code this way, you can keep related functionality together and make your API endpoints more discoverable and maintainable. For example, you might have a main handler as the default export and helper methods as named exports, all accessible from the same module with clean API paths thanks to flattening.
