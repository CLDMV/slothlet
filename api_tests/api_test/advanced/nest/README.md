# nest Example

This folder demonstrates **single-file folder structure** with named exports in slothlet.

## Folder Structure

This folder contains a single file with named exports that create an object namespace:

- **File**: `nest/nest.mjs`
- **Export**: `export function alpha(name)`
- **API Path**: `api.advanced.nest.alpha()` (creates object with alpha method)

The file exports are organized under the folder name as an object, providing a clear namespace for related functions.

## Usage

```js
api.advanced.nest.alpha("test"); // Calls the alpha function: "alpha: test"
```

## Use Case

This pattern is useful when you want a folder to represent a collection of related functions under a single namespace. The folder name becomes an object containing all the exported functions from the single file.
