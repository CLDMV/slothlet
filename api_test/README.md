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

### rootstring.mjs

Provides string utilities:

```js
api.rootstring.upper("abc"); // 'ABC'
api.rootstring.reverse("abc"); // 'cba'
```

## Filename Dashes and camelCase

When building your API, any dashes (`-`) in filenames are automatically converted to camelCase in the resulting API endpoints. For example:

- `root-math.mjs` becomes `api.rootMath`
- `my-cool-feature.mjs` becomes `api.myCoolFeature`

This helps keep your API naming consistent and JavaScript-friendly.

Explore the subfolders for more patterns, including grouped, nested, and hybrid exports.
