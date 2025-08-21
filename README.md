# @cldmv/slothlet

[![npm version](https://img.shields.io/npm/v/@cldmv/slothlet.svg)](https://www.npmjs.com/package/@cldmv/slothlet)
[![license](https://img.shields.io/github/license/CLDMV/slothlet.svg)](LICENSE)
![size](https://img.shields.io/npm/unpacked-size/@cldmv/slothlet.svg)
![npm-downloads](https://img.shields.io/npm/dm/@cldmv/slothlet.svg)
![github-downloads](https://img.shields.io/github/downloads/CLDMV/slothlet/total)

> **⚠️ WARNING: This module is under active development!**
>
> - The standard **eager mode** works well and is stable for production use.
> - **Lazy mode** has been tested and works for most use cases.
> - **Experimental modes** (such as worker, child process, and advanced context binding) are in development and may not be fully functional or stable.
>
> Please report issues, contribute, and use experimental features with caution.

**@cldmv/slothlet** is a modern, lazy modular API loader for Node.js projects. Designed for developers who want fast, flexible, and memory-efficient access to large modular APIs, it dynamically loads API modules and submodules only when accessed. Slothlet supports both lazy and eager loading, automatic flattening of single-file modules, and descriptive error handling—all with a fun branding twist: "slothlet is anything but slow."

## Features

- **Lazy loading:** API endpoints are loaded on demand using ES6 Proxy, minimizing initial load time and memory usage.
- **Eager loading:** Optionally load all modules up front for maximum performance.
- **Automatic flattening:** Single-file modules (e.g., `math/math.mjs`) become `api.math`.
- **CamelCase mapping:** Filenames and folders with dashes are mapped to camelCase API properties (e.g., `root-math.mjs` → `api.rootMath`).
- **Descriptive errors:** Throws clear errors for missing API paths or methods.
- **Configurable:** Set root directory and lazy loading depth.
- **ESM-first:** Clean, standards-based API.
- **TypeScript-friendly:** JSDoc-annotated API for editor support.
- **Lightweight:** No dependencies, minimal footprint.

## Installation

```sh
npm install @cldmv/slothlet
```

## Usage

> **Note:**
>
> - When using **lazy mode**, all API calls must be `await`ed, as modules are loaded asynchronously on access.
> - If you need to create more than one slothlet instance, you must import the slothlet module using a param string (e.g., `import slothlet from "./slothlet.mjs?instance=1"`).
>   - **Caveat:** Live bindings (`self`, `context`, `reference`) will only work correctly if you use the same param string for both the loader and any submodules that import those bindings. Mismatched param strings will result in separate module instances and broken live bindings.

### Node.js API

```js
import slothlet from "@cldmv/slothlet";

// Lazy load from default directory
const api = await slothlet.create({ lazy: true, context });

// Access API endpoints
const sum = await api.math.add(2, 3); // 5
const upper = await api.string.upper("abc"); // 'ABC'
const today = await api.nested.date.today(); // '2025-08-15'



// Eager load from a custom directory
const api = await slothlet.create({ lazy: false, dir: "./api_test" context });

// Access API endpoints
const sum = api.math.add(2, 3); // 5
const upper = api.string.upper("abc"); // 'ABC'
const today = api.nested.date.today(); // '2025-08-15'
```

## API Reference

### Main Methods

- `slothlet.create(options)` — Loads API modules and returns a bound API object. Options include lazy/eager mode, context, reference, and directory.
- `slothlet.load(config, ctxRef)` — Loads API modules (lazy or eager) and binds context/reference. Returns the API object.
- `slothlet.createBoundApi(context, reference)` — Returns an API object bound to the provided context and reference.
- `slothlet.getApi()` — Returns the loaded API object (Proxy or plain object).
- `slothlet.getBoundApi()` — Returns the bound API object (with context/reference).
- `slothlet.isLoaded()` — Returns true if the API is loaded.
- `slothlet.shutdown()` — Gracefully shuts down the API and internal resources.

### Config Options

- `lazy` (boolean): Enable lazy loading (default: true)
- `lazyDepth` (number): How deep to lazy load subdirectories (default: Infinity)
- `dir` (string): Directory to load API modules from (default: loader's directory)
- `debug` (boolean): Enable debug logging (default: false)

### Context & Reference

- `context`: Object passed to API modules for contextual data (e.g., user/session info)
- `reference`: Object passed to API modules for additional references or configuration

### Error Handling

- Throws descriptive errors for missing API paths or methods
- All errors include the requested path and directory for easier debugging

### JSDoc

See JSDoc comments in the source code for detailed type annotations and usage examples.

## Module Structure

- Single-file modules: `api_test/math/math.mjs` → `api.math`
- Multi-file modules: `api_test/multi/alpha.mjs` → `api.multi.alpha`, `api_test/multi/beta.mjs` → `api.multi.beta`
- Dashes in names: `api_test/root-math.mjs` → `api.rootMath`

## Safety & Errors

- Throws descriptive errors for missing API paths or methods
- Only loads modules when accessed (lazy) or all at once (eager)

## License

Apache-2.0 © Shinrai / CLDMV
