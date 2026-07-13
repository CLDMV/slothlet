# Browser / Worker Mode

Slothlet runs in the browser, web workers, and Electron renderers — anywhere there is no filesystem. Because the loader cannot `readdir` an API directory or resolve `node:*` builtins, browser mode swaps two things in: a **manifest** that lists the API modules, and an **importmap** that lets the browser resolve slothlet's own modules. Both are produced at build time (or in an Electron main process) by a single helper and shipped to the page.

## Quick start

```js
// build step (Node) — produces everything the browser needs
import { generateBrowserAssets } from "@cldmv/slothlet/helpers/generate-manifest";

const { manifest, importmap } = await generateBrowserAssets("./src/api");
// → manifest:  the API-directory listing
// → importmap: { imports: { "@cldmv/slothlet": "/node_modules/@cldmv/slothlet/…", … } }
```

```html
<!-- the page — importmap MUST come before any module script that imports slothlet -->
<script type="importmap">
	{
		"imports": {/* …importmap.imports… */}
	}
</script>
<script type="module">
	import slothlet from "@cldmv/slothlet";
	const api = await slothlet({
	  platform: "browser",
	  base: "/api/",                       // where your API modules are served
	  manifest: /* …manifest… */,
	  resolveModuleSpecifier: ({ path }) => new URL(path, "/api/").href,
	  mode: "eager"
	});
	await api.math.add(2, 3); // 5
</script>
```

That is the whole setup. The rest of this document explains the pieces and the less-common cases.

## Why two artifacts (manifest **and** importmap)

Browser mode loads two different kinds of module, resolved at two different times:

- **Your API leaves** are loaded by slothlet **at runtime**. Slothlet walks the manifest and, for each entry, calls your `resolveModuleSpecifier({ path })` to turn the manifest-relative path into a URL and dynamically `import()`s it. The manifest only needs to say _which files exist_; the URL is supplied live by your resolver.
- **Slothlet's own modules** (`@cldmv/slothlet`, `@cldmv/slothlet/helpers/*`, …) are static imports the browser resolves **before slothlet runs** — so they cannot route through `resolveModuleSpecifier`. They have to be declared in the page's `<script type="importmap">`.

So the manifest is consumed by slothlet (runtime config); the importmap is consumed by the browser (page setup, before any code runs). `generateBrowserAssets` produces both in one call so consumers never hand-roll the importmap.

When the optional [`@cldmv/slothlet-i18n`](./I18N.md) language pack is installed, the generated importmap also includes one entry per pack locale (`@cldmv/slothlet-i18n/language/<lang>.json`), so `setLanguage()` can dynamically import non-English locales in the browser. Without the pack, only the bundled `en-us` is available and other locales fall back to English.

> If you bundle your app (Vite, Webpack, esbuild, Rollup), the bundler resolves `@cldmv/slothlet` for you and **no importmap is needed** — use [`generateManifest`](#generatemanifestdir) for just the manifest. The importmap matters only for raw-ESM pages and Electron renderers that load slothlet over the network/file protocol.

## `generateBrowserAssets(apiDir, options?)`

The recommended one-call entry point. Returns `{ manifest, importmap }`.

| Option         | Type     | Default                            | Description                                                                   |
| -------------- | -------- | ---------------------------------- | ----------------------------------------------------------------------------- |
| `slothletBase` | `string` | `"/node_modules/@cldmv/slothlet/"` | URL/path prefix where the `@cldmv/slothlet` package is served in the browser. |

`slothletBase` is the one thing the build step cannot infer: `import.meta.resolve` knows slothlet's _filesystem_ location, but not the _URL_ you serve it from. The default assumes the conventional layout — slothlet installed as a dependency with `node_modules` served at the web root.

The importmap entries are resolved with `import.meta.resolve`, so they automatically point at the files that match the build's export conditions — `dist/*` for an installed package, `src/*` in slothlet's own dev tree. Locale JSON files (`@cldmv/slothlet/i18n/language/*.json`), which are loaded via a dynamic template import a static scan can't see, are enumerated and included automatically. You only ever set `slothletBase`; the per-file paths underneath it are filled in for you.

## Choosing `slothletBase`

| Scenario                                                              | `slothletBase`                                 | Notes                                                                                                                                                   |
| --------------------------------------------------------------------- | ---------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Installed dependency, `node_modules` served at web root** (default) | `"/node_modules/@cldmv/slothlet/"`             | No override needed. The common case for raw-ESM apps that serve the project root.                                                                       |
| **Package copied/vendored to the web root**                           | `"/"`                                          | When you publish slothlet's package files at the site root (this is also what the repo's own smoke test uses, since slothlet _is_ the workspace there). |
| **CDN**                                                               | `"https://cdn.example.com/@cldmv/slothlet@3/"` | Pin a major/exact version. A trailing slash is added if you omit it.                                                                                    |
| **Sub-path mount**                                                    | `"/vendor/slothlet/"`                          | When the package is served under a custom prefix.                                                                                                       |
| **Bundled app** (Vite, Webpack, esbuild, Rollup)                      | _(not needed)_                                 | The bundler resolves `@cldmv/slothlet`; skip the importmap and use [`generateManifest`](#generatemanifestdir) for just the manifest.                    |

```js
// default — installed dependency, node_modules at web root
await generateBrowserAssets("./src/api");

// CDN
await generateBrowserAssets("./src/api", { slothletBase: "https://cdn.example.com/@cldmv/slothlet@3/" });

// package served at the web root (vendored copy)
await generateBrowserAssets("./src/api", { slothletBase: "/" });
```

## Electron

In Electron, the generator and the importmap live on **two different sides** — keep them straight:

- **Node / main side** is where `generateBrowserAssets` _runs_. The main process (and `preload` with `nodeIntegration`/a bridge) has filesystem and module-resolution access; the renderer does not. Call it there, then hand `{ manifest, importmap }` to the renderer over IPC or a `contextBridge` preload.
- **Renderer side** is what `slothletBase` _describes_ — the URL/protocol the renderer fetches slothlet's files from. It is **not** the main process's filesystem path; it's how the renderer addresses those files.

```js
// main.mjs (Node side) — generate and forward to the renderer
import { generateBrowserAssets } from "@cldmv/slothlet/helpers/generate-manifest";
import { ipcMain } from "electron";

ipcMain.handle("slothlet:assets", async () => {
	return generateBrowserAssets("./resources/api", {
		// The renderer addresses slothlet via whatever you expose to it:
		slothletBase: "app://slothlet/" // a registered custom protocol, OR
		// slothletBase: "file:///abs/path/to/app/node_modules/@cldmv/slothlet/"  // loading from disk, OR
		// slothletBase: "/node_modules/@cldmv/slothlet/"   // when a dev server (electron-vite) serves node_modules
	});
});
```

```js
// renderer (browser side) — receive, inline the importmap, compose
const { manifest, importmap } = await window.electron.invoke("slothlet:assets");
// inject importmap into a <script type="importmap"> BEFORE importing slothlet, then:
const slothlet = (await import("@cldmv/slothlet")).default;
const api = await slothlet({ platform: "browser", manifest, resolveModuleSpecifier, mode: "eager" });
```

Pick the `slothletBase` that matches how your renderer is loaded: a **custom protocol** you register in main (`protocol.handle("app", …)` serving the package dir → `"app://slothlet/"`), a **`file://`** path when loading the page straight from disk, or the **dev server's** node_modules path under electron-vite.

## Lower-level helpers

### `generateManifest(dir)`

Returns just the API manifest — the `{ files, directories }` tree — for cases where you only need the manifest (bundled apps, or when you build the importmap another way).

```js
import { generateManifest } from "@cldmv/slothlet/helpers/generate-manifest";
const manifest = await generateManifest("./src/api");
```

### `createManifestResolver(base)`

A ready-made `resolveModuleSpecifier` that resolves manifest-relative paths against a base URL (`new URL(entry.path, base)`), which covers the common case of serving API modules from a known base.

```js
import { createManifestResolver } from "@cldmv/slothlet/helpers/manifest-resolver";
const api = await slothlet({
	platform: "browser",
	manifest,
	resolveModuleSpecifier: createManifestResolver(new URL("./api/", import.meta.url))
});
```

## Runtime behaviour in the browser

- **Live-binding context manager.** Browsers have no `AsyncLocalStorage`, so browser mode forces the live context manager regardless of the requested `runtime`. Sequential `context.run()` / `scope()` calls are isolated, but interleaved concurrent calls on the same instance require the Node async (ALS) runtime — see [CONTEXT-PROPAGATION.md](./CONTEXT-PROPAGATION.md) for the boundary.
- **Awaitable locale switching.** Use [`setLanguageAsync(lang)`](./I18N.md) instead of `setLanguage()` when you need to await a locale change, since browser locales arrive via dynamic `import(…, { with: { type: "json" } })`.
- **No `node:*`.** All Node-builtin access is gated behind a single platform layer, so the browser graph never touches `node:fs` / `node:path` / `node:url` / `node:async_hooks`.
- **Permissions are a cooperative boundary in the browser.** The permission system is an enforced boundary in Node (module privacy + ALS isolation); in the browser it is least-privilege among cooperative modules you trust, **not** a sandbox against adversarial code — any served module is importable by URL and page script has full DOM authority. If you load untrusted leaves, isolate them in a Worker/iframe at the app level. See [PERMISSIONS.md → Browser mode](./PERMISSIONS.md#browser-mode--the-permission-boundary).

## Verifying it works

The repository ships a Playwright smoke test (`npm run test:browser`) that builds the assets with `generateBrowserAssets`, serves them, and loads slothlet in a real headless browser — composing an api, exercising `self`, hooks, metadata, i18n, lifecycle events, api mutation, and permissions end-to-end.
