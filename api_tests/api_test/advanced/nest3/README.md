# nest3 Example

This folder contains a single file with a default export function, demonstrating deeply nested callable API endpoints.

## Pattern

This pattern shows a default function export in a nested structure:

- **File**: `singlefile.mjs`
- **Export**: `export default function(name)`
- **API Path**: `api.advanced.nest3(name)` (callable function)

## Usage

```js
api.advanced.nest3('slothlet'); // 'Hello, slothlet!'
```

## Use Case

This pattern is perfect for creating deeply nested utility functions that can be called directly without additional method names. The folder structure provides logical organization while the default export creates clean, callable API endpoints.
