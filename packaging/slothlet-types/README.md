# @cldmv/slothlet-types

TypeScript declaration files (`.d.mts`) for [`@cldmv/slothlet`](https://github.com/CLDMV/slothlet).

## Install

```sh
npm install @cldmv/slothlet
npm install -D @cldmv/slothlet-types
```

`@cldmv/slothlet` does not ship its own declarations. Each of its typed exports resolves to a small stub that re-exports the matching declaration from this package, so installing it alongside the core runtime is what gives editors and the type-checker their types. The version tracks the core runtime it describes exactly (both are built and published in lockstep).

## Without it

If `@cldmv/slothlet-types` is not installed, importing `@cldmv/slothlet` in a TypeScript project reports:

```text
Cannot find module '@cldmv/slothlet-types' or its corresponding type declarations.
```

That error names exactly what to add. The runtime itself never depends on this package — it is a development-time, type-only dependency, declared as an optional peer of `@cldmv/slothlet`.

## What's inside

The declarations mirror the core export surface (`.`, `./slothlet`, `./errors`, `./i18n`, `./helpers/*`, `./handlers/*`, …). Source maps are intentionally not shipped — they point at the minified runtime and the readable source is stripped on publish.
