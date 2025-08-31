# nest4 Example

This folder contains a single file with exports that demonstrate another level of nested API endpoints.

## Pattern

This pattern shows exports in a deeply nested structure:

- **File**: `singlefile.mjs`
- **Export**: Named export
- **API Path**: `api.advanced.nest4.singlefile()` (function within object)

## Usage

```js
api.advanced.nest4.singlefile(); // Calls the singlefile function
```

## Use Case

This pattern demonstrates how slothlet handles arbitrary nesting levels while maintaining clean API access. It's useful for organizing utilities by feature, category, and sub-category while keeping the final API calls accessible through the nested structure.
