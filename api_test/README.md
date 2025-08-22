# api_test Folder Overview

This folder contains example modules and subfolders that demonstrate different ways to organize and export API endpoints using file structure. At the root, you will find `.mjs` files such as `root-math.mjs` and `rootstring.mjs`.

While organizing your API in folders is recommended for clarity and maintainability, placing `.mjs` files at the root level is the way to create top-level API endpoints (e.g., `api.function`, `api.function2`) without creating separate folders for each. Root `.mjs` files are included here to demonstrate this approach for users who want direct, flat API access.

## API Usage Examples for Root Files

When the `api_test` folder is loaded by your API loader, these endpoints are available at the top level:

### root-math.mjs

Provides math utilities:

```js
api.rootMath.add(2, 3); // 5
api.rootMath.multiply(2, 3); // 6
```

### root-function.mjs

Provides named function exports that are flattened to the root level:

```js
api.rootFunctionShout("World"); // 'HELLO, WORLD!'
api.rootFunctionWhisper("World"); // 'hello, world'
```

### config.mjs

Provides configuration object:

```js
api.config.host; // 'https://unifi.example.com'
api.config.username; // 'admin'
// ... other config properties
```

### rootstring.mjs

Provides string manipulation utilities:

```js
api.rootstring.upper("abc"); // 'ABC'
api.rootstring.reverse("abc"); // 'cba'
```

### Built-in Slothlet Functions

Slothlet automatically adds these built-in functions to every API:

```js
api.describe(); // API introspection function
api.shutdown(); // Graceful shutdown function
```

## Filename-Folder Flattening Behavior

**Important Pattern**: When a filename matches its folder name, slothlet flattens the exports to the folder level instead of creating nested structures.

### Examples of Flattening:

- `math/math.mjs` → `api.math.add()` (not `api.math.math.add()`)
- `string/string.mjs` → `api.string.upper()` (not `api.string.string.upper()`)
- `funcmod/funcmod.mjs` → `api.funcmod()` (not `api.funcmod.funcmod()`)
- `util/util.mjs` → `api.util.size()` (flattened alongside `api.util.controller.*`)

### Examples of Non-Flattening:

- `util/controller.mjs` → `api.util.controller.*` (filename differs from folder)
- `multi/alpha.mjs` → `api.multi.alpha.*` (filename differs from folder)

This behavior creates cleaner, more intuitive API structures by eliminating redundant nesting when the file purpose matches the folder purpose.

## Filename Dashes and camelCase

When building your API, any dashes (`-`) in filenames are automatically converted to camelCase in the resulting API endpoints. For example:

- `root-math.mjs` becomes `api.rootMath`
- `root-function.mjs` becomes `api.rootFunction`
- `my-cool-feature.mjs` becomes `api.myCoolFeature`

This helps keep your API naming consistent and JavaScript-friendly.

## Folder Structure

The api_test folder contains several subfolders demonstrating different organizational patterns:

- **advanced/**: Complex patterns with live bindings and nested structures
- **exportDefault/**: Hybrid default + named export patterns
- **funcmod/**: Single function modules
- **math/**: Mathematical utility modules
- **multi/**: Multi-file object exports
- **multi_func/**: Multi-file function exports
- **nested/**: Nested folder structures (e.g., date utilities)
- **objectDefaultMethod/**: Callable objects with methods
- **string/**: String manipulation utilities
- **util/**: General utility modules with live bindings

Explore the subfolders for more patterns, including grouped, nested, and hybrid exports.
