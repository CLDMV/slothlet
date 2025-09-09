# objectDefaultMethod Example

This folder demonstrates the **filename-folder flattening** behavior with a callable object that has a default method.

## Flattening Pattern

When a filename matches its folder name (`objectDefaultMethod/objectDefaultMethod.mjs`), the exports are flattened to the folder level:

- **File**: `objectDefaultMethod/objectDefaultMethod.mjs`
- **Export**: `export const objectDefaultMethod = { default: function, ... }`
- **API Path**: `api.objectDefaultMethod()` with methods like `api.objectDefaultMethod.info()`

## Usage

```js
// Call the default method
api.objectDefaultMethod('Hello'); // 'INFO: Hello'
api.objectDefaultMethod('Hello', 'warn'); // 'WARN: Hello'

// Call specific named methods
api.objectDefaultMethod.info('Hello'); // 'INFO: Hello'
api.objectDefaultMethod.warn('Hello'); // 'WARN: Hello' 
api.objectDefaultMethod.error('Hello'); // 'ERROR: Hello'
```

## Use Case

This pattern shows how filename-folder flattening works with callable objects that have both a default method and named methods. The flattening behavior allows the object to be callable directly while maintaining access to its specialized methods.

By organizing your code this way, you can provide flexible API endpoints that support both general and specialized operations from one module, with clean API access thanks to the flattening behavior.
