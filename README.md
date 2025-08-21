# @cldmv/slothlet

[![npm version](https://img.shields.io/npm/v/@cldmv/slothlet.svg)](https://www.npmjs.com/package/@cldmv/slothlet)
[![license](https://img.shields.io/github/license/CLDMV/slothlet.svg)](LICENSE)
![size](https://img.shields.io/npm/unpacked-size/@cldmv/slothlet.svg)
![npm-downloads](https://img.shields.io/npm/dm/@cldmv/slothlet.svg)
![github-downloads](https://img.shields.io/github/downloads/CLDMV/slothlet/total)

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

### Node.js API

```js
import slothlet from "@cldmv/slothlet";

// Lazy load from default directory
await slothlet.load({ lazy: true });
const api = slothlet.createBoundApi(context);

// Eager load from a custom directory
await slothlet.load({ lazy: false, dir: "./api_test" });
const api = slothlet.createBoundApi(context);

// Access API endpoints
const sum = api.math.add(2, 3); // 5
const upper = api.string.upper("abc"); // 'ABC'
const today = api.nested.date.today(); // '2025-08-15'
```

### API Loader Example

```js
// Example: Load all endpoints in api_test
await slothlet.load({ lazy: false, dir: "./api_test" });
const api = slothlet.createBoundApi({});
console.log(api.math.add(2, 3));
console.log(api.string.upper("abc"));
console.log(api.nested.date.today());
```

## API Reference

See JSDoc in source for full details. Key methods:

- `slothlet.load(config)` — Loads API modules (lazy or eager)
- `slothlet.createBoundApi(context)` — Returns API object bound to context
- `slothlet.getApi()` — Returns loaded API object (Proxy or plain)
- `slothlet.isLoaded()` — Returns true if API is loaded

### Config Options

- `lazy` (boolean): Enable lazy loading (default: true)
- `lazyDepth` (number): How deep to lazy load (default: Infinity)
- `dir` (string): Directory to load API modules from

## Module Structure

- Single-file modules: `api_test/math/math.mjs` → `api.math`
- Multi-file modules: `api_test/multi/alpha.mjs` → `api.multi.alpha`, `api_test/multi/beta.mjs` → `api.multi.beta`
- Dashes in names: `api_test/root-math.mjs` → `api.rootMath`

## Safety & Errors

- Throws descriptive errors for missing API paths or methods
- Only loads modules when accessed (lazy) or all at once (eager)

## License

Apache-2.0 © Shinrai / CLDMV
