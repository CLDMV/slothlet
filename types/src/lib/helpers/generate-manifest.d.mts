/**
 * Generate a slothlet browser manifest by scanning a directory at build time.
 *
 * This is the primary entry point for producing the `manifest` object required by
 * `slothlet({ loader: { files, resolve } })`. Call this once during your build
 * step and embed the result in your browser bundle.
 *
 * @param {string} dir - Absolute or relative path to the API root directory.
 * @returns {Promise<{ files: Array<{path:string,name:string,full:string}>, directories: Array }>}
 *   Manifest object ready to pass to `slothlet()`.
 *
 * @throws {SlothletError} `FILES_FOLDER_INVALID` if `dir` is not a non-empty string.
 * @throws {SlothletError} `FILES_FOLDER_UNREADABLE` if `dir` cannot be read (missing path, permission denied); the underlying reason is surfaced in the message.
 * @throws {SlothletError} `FILES_NOT_A_FOLDER` if `dir` exists but is not a directory.
 *
 * @example
 * // Build script — produces a manifest and writes it to disk
 * import { generateManifest } from "#helpers/generate-manifest";
 * import { writeFileSync } from "node:fs";
 *
 * const manifest = await generateManifest("./src/api");
 * writeFileSync("./dist/api-manifest.json", JSON.stringify(manifest, null, 2));
 *
 * @example
 * // Vite plugin — inline manifest into the browser bundle
 * import { generateManifest } from "#helpers/generate-manifest";
 *
 * export function slothletManifestPlugin(apiDir) {
 *   return {
 *     name: "slothlet-manifest",
 *     async buildStart() {
 *       const manifest = await generateManifest(apiDir);
 *       this.emitFile({
 *         type: "asset",
 *         fileName: "slothlet-manifest.json",
 *         source: JSON.stringify(manifest)
 *       });
 *     }
 *   };
 * }
 */
export function generateManifest(dir: string): Promise<{
    files: Array<{
        path: string;
        name: string;
        full: string;
    }>;
    directories: any[];
}>;
/**
 * Generate everything the browser needs to run slothlet, in one build-time call.
 *
 * Returns both halves of a browser-mode setup:
 * - `manifest` — the API-directory listing passed to `slothlet({ loader: { files } })` (replaces the
 *   filesystem `readdir` slothlet uses in Node).
 * - `importmap` — the `<script type="importmap">` content that lets the browser resolve slothlet's
 *   own module graph AND the third-party packages the registered API leaves import.
 *
 * Run this in your build step (or, for Electron, in the main process) and send both to the
 * renderer: inline `importmap` into the page's importmap script tag, and pass `manifest` (plus a
 * `loader.resolve` for your API base) to `slothlet()`.
 *
 * The importmap covers two surfaces. First, slothlet's own modules (rebased onto `base`).
 * Second — and this is what the registered API leaves need — the **exact `exports` subpaths** of the
 * other packages in the browser graph: the generator scans the `apiDir` leaves for the packages they
 * import, reads each package's `package.json` `exports`, and emits the redirected subpath keys a
 * plain prefix map can't produce (`@scope/ext/errors` → `…/@scope/ext/src/lib/errors.mjs`). Without
 * these, a subpath the `exports` map redirects resolves to a literal URL and 404s in the browser, so
 * consumers previously hand-maintained allowlists. Those sibling packages are served next to
 * `@cldmv/slothlet` under a base **derived** from `base` (its node_modules/CDN parent). (#297)
 *
 * @param {string} apiDir - Absolute or relative path to the API root directory.
 * @param {object} [options] - Options.
 * @param {string} [options.base="/node_modules/@cldmv/slothlet/"] - URL/path prefix where
 *   the `@cldmv/slothlet` package is served in the browser. Defaults to the conventional
 *   node_modules location (slothlet installed as a dependency, node_modules served at the web
 *   root). Override with a CDN URL, an Electron protocol path, or `"/"` when the package is served
 *   at the web root.
 * @returns {Promise<{ manifest: { files: Array, directories: Array }, importmap: { imports: Object<string,string>, scopes: Object<string, Object<string,string>> } }>}
 *   The API manifest and slothlet's own browser importmap (see {@link generateImportMap} for its `scopes`).
 *
 * @throws {SlothletError} `FILES_BASE_INVALID` if `options.base` is provided but is not a string.
 *
 * @example
 * // Build step — slothlet installed in node_modules (default base), ship both to the renderer.
 * import { generateBrowserAssets } from "#helpers/generate-manifest";
 * const { manifest, importmap } = await generateBrowserAssets("./src/api");
 * // → inline importmap: `<script type="importmap">${JSON.stringify(importmap)}</script>`
 * // → pass manifest to slothlet({ loader: { files, resolve } })
 *
 * @example
 * // Override the base for a CDN (or "/" when the package is served at the web root).
 * const { manifest, importmap } = await generateBrowserAssets("./src/api", {
 *   base: "https://cdn.example.com/@cldmv/slothlet@3/"
 * });
 */
export function generateBrowserAssets(apiDir: string, options?: {
    base?: string | undefined;
}): Promise<{
    manifest: {
        files: any[];
        directories: any[];
    };
    importmap: {
        imports: {
            [x: string]: string;
        };
        scopes: {
            [x: string]: {
                [x: string]: string;
            };
        };
    };
}>;
/**
 * Generate the browser importmap for slothlet's OWN modules.
 *
 * In a browser, slothlet's internal imports (`@cldmv/slothlet`, `#helpers/*`, …)
 * are static and resolved by the page's importmap **before slothlet runs** — they cannot route
 * through `loader.resolve` (which only governs API-leaf loads). This produces that
 * importmap from slothlet's public export surface so consumers never hand-roll it.
 *
 * Each specifier is resolved via `import.meta.resolve`, which automatically picks the dev
 * (`slothlet-dev` → `src/`) or published (`default` → `dist/`) files based on the conditions of
 * the build process — then rebased onto `base` (where the package is served).
 *
 * Slothlet's own files are slothlet's: `imports` maps only what any script of the page may import (the main entry,
 * the runtime and the manifest resolver), and every other specifier of slothlet's is mapped under `scopes`, for
 * slothlet's own files alone (its code folders and entry files under `base`). An api file, or any other
 * script, importing one of them by its specifier fails to resolve it. Inline the whole object, `scopes` included.
 *
 * @param {string} [base="/node_modules/@cldmv/slothlet/"] - URL/path prefix where the
 *   `@cldmv/slothlet` package is served in the browser. Defaults to the conventional node_modules
 *   location; override with a CDN URL, an Electron protocol path, or `"/"` when the package is
 *   served at the web root.
 * @returns {Promise<{ imports: Object<string,string>, scopes: Object<string, Object<string,string>> }>} An importmap
 *   object ready to inline as `<script type="importmap">`.
 */
export function generateImportMap(base?: string): Promise<{
    imports: {
        [x: string]: string;
    };
    scopes: {
        [x: string]: {
            [x: string]: string;
        };
    };
}>;
/**
 * Collect the full set of `@cldmv/slothlet[/sub]` specifiers the browser importmap must cover.
 *
 * Three sources, unioned so the map mirrors slothlet's public export surface: (1) declared flat entry points from package.json `exports` — so
 * every flat (non-wildcard) public module specifier a consumer can import resolves via the importmap, including public aggregators that
 * slothlet's own internals never import directly (notably the bare `@cldmv/slothlet/runtime`, whose
 * `/runtime/async` + `/runtime/live` variants are the only ones internally referenced); (2) a per-file
 * enumeration of every wildcard `exports` and `imports` directory (`#helpers/*`, `#handlers/*`, …) so EVERY
 * such subpath gets an entry by construction — not just the modules slothlet itself imports, so a browser can
 * never hit a wildcard endpoint the map lacks; and (3) a recursive source scan as a backstop for any
 * imported specifier the first two miss, which is how the exact `imports` keys (`#slothlet`, `#errors`, …) get in. i18n locales are handled separately — they are dynamic-template imports the
 * static scan can't see, and are enumerated separately from the languages directory. Inclusion here is about
 * specifier resolution, not runtime compatibility — some public exports (e.g. `typegen`) are
 * Node-only and won't execute in a browser even though their specifier resolves. JSON exports (the
 * module-manifest schema) are tooling-only and excluded too — they aren't browser module imports. (#137)
 *
 * @param {string} root - The slothlet package root (holds package.json and the shipped source).
 * @returns {Promise<Set<string>>} The set of bare specifiers, always including `@cldmv/slothlet` and
 *   its flat (non-wildcard) public exports.
 */
export function collectSlothletSpecifiers(root: string): Promise<Set<string>>;
/**
 * Collect the exact importmap subpath keys for ANY package from its `package.json` `exports`.
 *
 * The package-agnostic counterpart to {@link collectSlothletSpecifiers}: given a package's root
 * directory, read its `exports` map and return the bare specifier → relative-target pairs a browser
 * importmap needs. Import maps do plain prefix substitution and never consult a package's `exports`,
 * so a subpath the `exports` map *redirects* (`@scope/pkg/errors` → `./src/lib/errors.mjs`) 404s
 * unless the importmap carries that exact key. This produces those keys.
 *
 * Handles the same shapes the self-collector does, generalized: the package root (`.`), flat
 * (non-wildcard) subpaths, wildcard directories (`./x/*` → every module file under the declared
 * target dir), conditional `exports` (via {@link pickBrowserTarget} — browser/import/default, never
 * node/require), and the string-exports and conditions-only (`.` sugar) forms. Only ES-module
 * targets are emitted (see {@link isBrowserModuleTarget}); a package with no `exports` (or an
 * unreadable `package.json`) yields an empty map — the prefix map already covers those.
 *
 * The returned targets are the paths the `exports` map itself declares, so the caller rebases them
 * onto wherever the package is served — no `import.meta.resolve` (which resolves from slothlet's own
 * scope, not the consumer's) is involved.
 *
 * @param {string} packageRoot - Absolute path to the package's root (the dir holding its package.json).
 * @returns {Promise<Map<string,string>>} Map of bare specifier → target path relative to `packageRoot`.
 * @public
 */
export function collectPackageSpecifiers(packageRoot: string): Promise<Map<string, string>>;
//# sourceMappingURL=generate-manifest.d.mts.map