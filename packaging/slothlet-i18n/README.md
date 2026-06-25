# @cldmv/slothlet-i18n

Additional locale packs for [`@cldmv/slothlet`](https://github.com/CLDMV/slothlet) — the translated error and warning messages for every shipped language except the built-in `en-us` base, which is bundled in the core package.

## Install

```sh
npm install @cldmv/slothlet @cldmv/slothlet-i18n
```

That is all there is to it. Slothlet auto-detects this package when it is installed and resolves locales from it on demand — there is nothing to import, register, or configure. Without it, slothlet runs in English only.

## What's inside

One JSON file per locale (`de-de`, `en-gb`, `es-es`, `es-mx`, `fr-fr`, `hi-in`, `ja-jp`, `ko-kr`, `pt-br`, `ru-ru`, `zh-cn`). These are data files consumed by slothlet's i18n loader; they are not meant to be imported directly.

This package is built and published from the [slothlet](https://github.com/CLDMV/slothlet) repository in lockstep with `@cldmv/slothlet` — its version always matches the core release it pairs with.
