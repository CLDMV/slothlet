# Browser / Worker Mode

Slothlet runs in the browser, web workers, and Electron renderers — anywhere there is no filesystem. Because the loader cannot `readdir` an API directory or resolve `node:*` builtins, browser mode swaps two things in: a **manifest** that lists the API modules, and an **importmap** that lets the browser resolve slothlet's own modules. Both are produced at build time (or in an Electron main process) by a single helper and shipped to the page.

## Quick start

```js
// build step (Node) — produces everything the browser needs
import { files } from "@cldmv/slothlet/files";

const { manifest, importmap } = await files.assets("./src/api");
// → manifest:  the API-directory listing
// → importmap: { imports: { "@cldmv/slothlet": "/node_modules/@cldmv/slothlet/…", … }, scopes: { … } }
```

```html
<!-- the page — importmap MUST come before any module script that imports slothlet -->
<script type="importmap">
	/* …JSON.stringify(importmap): its imports AND its scopes… */
</script>
<script type="module">
	import slothlet from "@cldmv/slothlet";
	const api = await slothlet({
	  base: "/api/",                       // where your API modules are served
	  loader: {
	    platform: "browser",
	    files: /* …manifest… */,
	    resolve: ({ path }) => new URL(path, "/api/").href
	  },
	  mode: "eager"
	});
	await api.math.add(2, 3); // 5
</script>
```

That is the whole setup. The rest of this document explains the pieces and the less-common cases.

An instance can also start with **no base at all** — omit `base` and `manifest` and build the tree at runtime with `api.slothlet.api.add()` (for example in-memory `{ exports }` modules); only the importmap is still needed. See [No base directory](./CONFIGURATION.md#base).

## Why two artifacts (manifest **and** importmap)

Browser mode loads two different kinds of module, resolved at two different times:

- **Your API leaves** are loaded by slothlet **at runtime**. Slothlet walks the manifest and, for each entry, calls your `loader.resolve({ path })` to turn the manifest-relative path into a URL and dynamically `import()`s it. The manifest only needs to say _which files exist_; the URL is supplied live by your resolver.
- **Slothlet's own modules** (`@cldmv/slothlet` and the package-private `#helpers/*`, `#handlers/*`, …) are static imports the browser resolves **before slothlet runs** — so they cannot route through `loader.resolve`. They have to be declared in the page's `<script type="importmap">`.

So the manifest is consumed by slothlet (runtime config); the importmap is consumed by the browser (page setup, before any code runs). `files.assets` produces both in one call so consumers never hand-roll the importmap.

There is a third kind of module the page must resolve: **the packages your API leaves import.** A leaf that does `import { StorageError } from "@cldmv/rummage-ext-storage/errors"` relies on that package's `exports` map redirecting `./errors` to its real file (`./src/lib/errors.mjs`). Import maps only do plain **prefix substitution** — they never consult a package's `exports` — so `@cldmv/rummage-ext-storage/errors` would resolve to a literal `…/errors` URL and 404 in the browser. `files.assets` closes this: it scans the API directory for the packages its leaves import, reads each package's `package.json` `exports`, and emits the **exact** redirected subpath keys (flat entries, wildcard directories, and the browser/`import`/`default` condition of conditional exports). Those sibling packages are served next to `@cldmv/slothlet` under a base **derived from `base`** (its `node_modules`/CDN parent), so you don't configure them separately — and you can delete any hand-maintained browser-dep allowlists. (#297)

When the optional [`@cldmv/slothlet-i18n`](./I18N.md) language pack is installed, the generated importmap also includes one entry per pack locale (`@cldmv/slothlet-i18n/language/<lang>.json`), so `setLanguage()` can dynamically import non-English locales in the browser. Without the pack, only the bundled `en-us` is available and other locales fall back to English.

> If you bundle your app (Vite, Webpack, esbuild, Rollup), the bundler resolves `@cldmv/slothlet` for you and **no importmap is needed** — use [`files.generate`](#filesgeneratedir) for just the manifest. The importmap matters only for raw-ESM pages and Electron renderers that load slothlet over the network/file protocol.

## `files.assets(apiDir, options?)`

The recommended one-call entry point. Returns `{ manifest, importmap }`.

| Option | Type     | Default                            | Description                                                                   |
| ------ | -------- | ---------------------------------- | ----------------------------------------------------------------------------- |
| `base` | `string` | `"/node_modules/@cldmv/slothlet/"` | URL/path prefix where the `@cldmv/slothlet` package is served in the browser. |

`base` is the one thing the build step cannot infer: `import.meta.resolve` knows slothlet's _filesystem_ location, but not the _URL_ you serve it from. The default assumes the conventional layout — slothlet installed as a dependency with `node_modules` served at the web root.

The importmap's `imports` maps what any script of the page may import of slothlet: `@cldmv/slothlet`, the runtime (`/runtime`, `/runtime/async`, `/runtime/live`) and `/files`. Every other specifier of slothlet's is slothlet's own, and the importmap maps it under `scopes`, for slothlet's own files alone (one scope per code folder and entry file under `base`), so an api leaf or a page script resolving `#helpers/…` or `#handlers/…` fails (see [MODULE-STRUCTURE.md](./MODULE-STRUCTURE.md#what-a-module-imports-from-slothlet)). Inline the whole object, `scopes` included: a page given `imports` alone cannot load slothlet. A browser loads any served file by its URL, so a file imported by its URL still evaluates; what it exports that is slothlet's own answers only slothlet's own files and the page's own code, and an api leaf using it is refused with `MODULE_INTERNAL_NOT_IMPORTABLE` (see [MODULE-STRUCTURE.md](./MODULE-STRUCTURE.md#using-what-slothlets-own-files-export)).

The importmap entries are resolved with `import.meta.resolve`, so they automatically point at the files that match the build's export conditions — `dist/*` for an installed package, `src/*` in slothlet's own dev tree. Locale JSON files (`@cldmv/slothlet/i18n/language/*.json`), which are loaded via a dynamic template import a static scan can't see, are enumerated and included automatically. You only ever set `base`; the per-file paths underneath it are filled in for you.

## Choosing `base`

| Scenario                                                              | `base`                                         | Notes                                                                                                                                                   |
| --------------------------------------------------------------------- | ---------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Installed dependency, `node_modules` served at web root** (default) | `"/node_modules/@cldmv/slothlet/"`             | No override needed. The common case for raw-ESM apps that serve the project root.                                                                       |
| **Package copied/vendored to the web root**                           | `"/"`                                          | When you publish slothlet's package files at the site root (this is also what the repo's own smoke test uses, since slothlet _is_ the workspace there). |
| **CDN**                                                               | `"https://cdn.example.com/@cldmv/slothlet@3/"` | Pin a major/exact version. A trailing slash is added if you omit it.                                                                                    |
| **Sub-path mount**                                                    | `"/vendor/slothlet/"`                          | When the package is served under a custom prefix.                                                                                                       |
| **Bundled app** (Vite, Webpack, esbuild, Rollup)                      | _(not needed)_                                 | The bundler resolves `@cldmv/slothlet`; skip the importmap and use [`files.generate`](#filesgeneratedir) for just the manifest.                         |

```js
// default — installed dependency, node_modules at web root
await files.assets("./src/api");

// CDN
await files.assets("./src/api", { base: "https://cdn.example.com/@cldmv/slothlet@3/" });

// package served at the web root (vendored copy)
await files.assets("./src/api", { base: "/" });
```

## Electron

In Electron, the generator and the importmap live on **two different sides** — keep them straight:

- **Node / main side** is where `files.assets` _runs_. The main process (and `preload` with `nodeIntegration`/a bridge) has filesystem and module-resolution access; the renderer does not. Call it there, then hand `{ manifest, importmap }` to the renderer over IPC or a `contextBridge` preload.
- **Renderer side** is what `base` _describes_ — the URL/protocol the renderer fetches slothlet's files from. It is **not** the main process's filesystem path; it's how the renderer addresses those files.

```js
// main.mjs (Node side) — generate and forward to the renderer
import { files } from "@cldmv/slothlet/files";
import { ipcMain } from "electron";

ipcMain.handle("slothlet:assets", async () => {
	return files.assets("./resources/api", {
		// The renderer addresses slothlet via whatever you expose to it:
		base: "app://slothlet/" // a registered custom protocol, OR
		// base: "file:///abs/path/to/app/node_modules/@cldmv/slothlet/"  // loading from disk, OR
		// base: "/node_modules/@cldmv/slothlet/"   // when a dev server (electron-vite) serves node_modules
	});
});
```

```js
// renderer (browser side) — receive, inline the importmap, compose
const { manifest, importmap } = await window.electron.invoke("slothlet:assets");
// inject importmap into a <script type="importmap"> BEFORE importing slothlet, then:
const slothlet = (await import("@cldmv/slothlet")).default;
const api = await slothlet({ loader: { platform: "browser", files: manifest, resolve }, mode: "eager" });
```

Pick the `base` that matches how your renderer is loaded: a **custom protocol** you register in main (`protocol.handle("app", …)` serving the package dir → `"app://slothlet/"`), a **`file://`** path when loading the page straight from disk, or the **dev server's** node_modules path under electron-vite.

## Lower-level helpers

Everything here lives on the one `files` namespace from `@cldmv/slothlet/files`. `files.assets`, `files.generate`, `files.importmap` and `files.specifiers.slothlet` / `files.specifiers.packages` read the disk and run only in Node; called in a page they reject with `FILES_REQUIRES_NODE`. `files.resolver` runs anywhere, so a page imports `@cldmv/slothlet/files` for it without pulling in any `node:` module.

### `files.generate(dir)`

Returns just the API manifest — the `{ files, directories }` tree — for cases where you only need the manifest (bundled apps, or when you build the importmap another way).

```js
import { files } from "@cldmv/slothlet/files";
const manifest = await files.generate("./src/api");
```

### `files.resolver(base)`

A ready-made `loader.resolve` that resolves manifest-relative paths against a base URL (`new URL(entry.path, base)`), which covers the common case of serving API modules from a known base.

```js
import { files } from "@cldmv/slothlet/files";
const api = await slothlet({
	loader: {
		platform: "browser",
		files: manifest,
		resolve: files.resolver(new URL("./api/", import.meta.url))
	}
});
```

## Runtime behaviour in the browser

- **Live-binding context manager.** Browsers have no `AsyncLocalStorage`, so browser mode forces the live context manager regardless of the requested `runtime`. Sequential `context.run()` / `scope()` calls are isolated, but interleaved concurrent calls on the same instance require the Node async (ALS) runtime — see [CONTEXT-PROPAGATION.md](./CONTEXT-PROPAGATION.md) for the boundary.
- **Caller identity reads the stack while a call is suspended.** With any module call suspended at an `await`, an identity read made with nothing entered synchronously reads the call stack, so host code running meanwhile is not mistaken for the suspended module: each host api call, each `self.*` call a resumed module makes, and each promise reaction registered on the page. The read costs from a few to tens of microseconds, depending on stack depth. A browser loads the files a leaf imports without slothlet's instance tag, so a resumed call's code in such a file is placed by its module's folder, or, outside every module folder, by the function the call entered, which the stack names as `at async <name>`. That name counts only when no frame on the stack is placed otherwise; code that names none of the suspended calls is the host's, and host code calling a function that shares a suspended entry's name is held to that call's rules. Leaves themselves carry the tag, so a leaf of an api path with nothing suspended running in a callback is refused rather than run as another module's call. Work a module starts without awaiting it (an un-awaited async helper that resumes after the module's call has ended) is not linked back to the module: the browser has no way to carry identity across that `await` until the `AsyncContext` proposal ships. Calls made while nothing is suspended, or synchronously inside another call, do not read the stack. See [PERMISSIONS.md → Overlapping calls](./PERMISSIONS.md).
- **One copy of each leaf per instance, mount and reload.** When `loader.resolve` returns a `file:`, `http:` or `https:` URL, the leaf is imported with the same `?slothlet_instance=…&module=…&_reload=…` query Node uses, merged with any query the URL already has. Two instances of one folder, two `api.slothlet.api.add()` mounts of one folder, and a full reload each get their own copy of the leaf and its module-level state. A bare or import-map specifier, and a `blob:` or `data:` URL, is imported exactly as returned — a query would no longer match the importmap entry, or would change the content's identity.
- **`api.slothlet.api.add()` mounts a folder or a single file the manifest lists.** A file is named by its URL under `base` or by its path relative to the manifest's root (`"utils/format.mjs"`), and the add loads only that file of its folder, as it does in Node; `api.slothlet.api.reload()` and `remove()` take its moduleID or path. The browser has no `node:path`, so the folder, file name and extension come from the string itself; a name that does not end in `.mjs`, `.cjs` or `.js` is refused with `INVALID_CONFIG_FILE_TYPE`.
- **No module discovery.** `api.slothlet.api.modules.discover()` walks the filesystem, so in a browser it, `addDiscovered()` and an `addModule(name)` that has to discover are refused with `MODULE_DISCOVERY_REQUIRES_NODE` ([MODULE-DISCOVERY.md](./MODULE-DISCOVERY.md)). Mount modules with `api.slothlet.api.add()` from the manifest.
- **Relative imports a leaf makes are still shared.** In Node a resolve hook carries the leaf's query onto the relative helpers it imports, so each instance has its own copy of those too. A browser has no resolve hook, so a helper module a leaf imports is one copy for every instance, mount and reload in the page: keep per-instance state in the leaf itself (or in `context`), not in a module-level variable of a shared helper.
- **Awaitable locale switching.** Use [`setLanguageAsync(lang)`](./I18N.md) instead of `setLanguage()` when you need to await a locale change, since browser locales arrive via dynamic `import(…, { with: { type: "json" } })`.
- **No `node:*`.** All Node-builtin access is gated behind a single platform layer, so the browser graph never touches `node:fs` / `node:path` / `node:url` / `node:async_hooks`.
- **An object `Proxy` default is composed as the value it fronts.** Node can tell a `Proxy` from its target (`util.types.isProxy`); a browser cannot, since a proxy is indistinguishable from what it fronts by design. So the layer that keeps an object `Proxy` default's traps working ([MODULE-STRUCTURE.md](./MODULE-STRUCTURE.md)) is Node-only. In a browser, an object `Proxy` default is copied, keeping the members it reports but not its traps. The same holds for an object `Proxy` anywhere in a module's exports. A callable `Proxy` default is unaffected: every function default with named exports gets a callable layer, recognized by `typeof`, so its traps keep answering and nothing is written through them in a browser too.
- **Values that cross between modules are viewed as in Node.** With the permission system on, what one module hands another reaches it as a view that keeps the owner's code to the owner's write rules ([PERMISSIONS.md](./PERMISSIONS.md#values-that-cross-between-modules)). The views read no stack and need no `node:util`: the brand checks they rest on (`Map`, `Set`, `Date`, `RegExp`, buffers, typed arrays, boxed primitives, iterators) come from the engine's own methods in a browser, and where a value cannot be told it is viewed, never handed on as it is. A browser cannot tell a `Proxy` from the object it fronts, so a module's own `Proxy` is described by its traps when slothlet reads its prototype and `constructor`.
- **Cloning works on views as in Node.** `structuredClone` and `postMessage` (`MessagePort`, `BroadcastChannel`, `Worker`, `window`) are wrapped while an instance is up, so they copy the data behind a view another module was handed and the data of an api node ([PERMISSIONS.md](./PERMISSIONS.md#values-that-cross-between-modules)). `v8.serialize` is Node's alone.
- **Permissions are a cooperative boundary in the browser, and cannot be made otherwise.** The permission system is an enforced boundary under the async runtime (module privacy + ALS isolation), which needs `async_hooks` and so is Node-only. A browser always runs the live runtime, where it is least-privilege among cooperative modules you trust, **not** a sandbox against adversarial code: any served module is importable by URL, page script has full DOM authority, and identity across deferred work rests on patched boundaries that code setting out to avoid them can step around. Unattributed work fails closed — it loses access rather than gaining any — but that is not the same as a sandbox. The blocking factor is the absence of an `AsyncLocalStorage` equivalent in browsers; if one ships (the TC39 `AsyncContext` proposal is the candidate), the enforced model becomes possible there too. Until then, isolate untrusted leaves in a Worker/iframe at the app level. See [PERMISSIONS.md → Why the browser cannot be made a hard boundary](./PERMISSIONS.md#why-the-browser-cannot-be-made-a-hard-boundary).
- **Serve a Content Security Policy that refuses code from strings and `blob:`/`data:` scripts.** With permissions on, an instance checks as it starts that building a `Function` from a string and importing a `blob:` or `data:` module are refused, and warns for each that is not; `permissions.mode: "strict"` refuses to start instead. `script-src 'self'` (with a nonce or hash for the page's own inline scripts) meets all three. Even then the page is not safe: these are only the checks slothlet can make, and code that ran before slothlet may have faked what they read. Firefox still takes code that names a module's URL in a `//# sourceURL=` comment for that module's file where the policy allows it (runtime inline scripts, string timers), and WebKit reports string timers and runtime inline scripts as the page's own code. See [PERMISSIONS.md → The baseline](./PERMISSIONS.md#the-baseline).

## Verifying it works

The repository ships a Playwright smoke test (`npm run test:browser`) that builds the assets with `files.assets`, serves them, and loads slothlet in a real headless browser — composing an api, exercising `self`, hooks, metadata, i18n, lifecycle events, api mutation, and permissions end-to-end.
