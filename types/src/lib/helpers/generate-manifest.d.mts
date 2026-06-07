/**
 * Generate a slothlet browser manifest by scanning a directory at build time.
 *
 * This is the primary entry point for producing the `manifest` object required by
 * `slothlet({ manifest, resolveModuleSpecifier })`. Call this once during your build
 * step and embed the result in your browser bundle.
 *
 * @param {string} dir - Absolute or relative path to the API root directory.
 * @returns {Promise<{ files: Array<{path:string,name:string,fullName:string}>, directories: Array }>}
 *   Manifest object ready to pass to `slothlet()`.
 *
 * @throws {SlothletError} `GENERATE_MANIFEST_DIR_INVALID` if `dir` is not a non-empty string.
 * @throws {SlothletError} `GENERATE_MANIFEST_DIR_UNREADABLE` if `dir` cannot be read (missing path, permission denied); the underlying reason is surfaced in the message.
 * @throws {SlothletError} `GENERATE_MANIFEST_NOT_DIRECTORY` if `dir` exists but is not a directory.
 *
 * @example
 * // Build script — produces a manifest and writes it to disk
 * import { generateManifest } from "@cldmv/slothlet/helpers/generate-manifest";
 * import { writeFileSync } from "node:fs";
 *
 * const manifest = await generateManifest("./src/api");
 * writeFileSync("./dist/api-manifest.json", JSON.stringify(manifest, null, 2));
 *
 * @example
 * // Vite plugin — inline manifest into the browser bundle
 * import { generateManifest } from "@cldmv/slothlet/helpers/generate-manifest";
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
        fullName: string;
    }>;
    directories: any[];
}>;
/**
 * Generate everything the browser needs to run slothlet, in one build-time call.
 *
 * Returns both halves of a browser-mode setup:
 * - `manifest` — the API-directory listing passed to `slothlet({ manifest })` (replaces the
 *   filesystem `readdir` slothlet uses in Node).
 * - `importmap` — the `<script type="importmap">` content that lets the browser resolve
 *   slothlet's OWN module graph (so consumers don't hand-roll it).
 *
 * Run this in your build step (or, for Electron, in the main process) and send both to the
 * renderer: inline `importmap` into the page's importmap script tag, and pass `manifest` (plus a
 * `resolveModuleSpecifier` for your API base) to `slothlet()`.
 *
 * @param {string} apiDir - Absolute or relative path to the API root directory.
 * @param {object} [options] - Options.
 * @param {string} [options.slothletBase="/node_modules/@cldmv/slothlet/"] - URL/path prefix where
 *   the `@cldmv/slothlet` package is served in the browser. Defaults to the conventional
 *   node_modules location (slothlet installed as a dependency, node_modules served at the web
 *   root). Override with a CDN URL, an Electron protocol path, or `"/"` when the package is served
 *   at the web root.
 * @returns {Promise<{ manifest: { files: Array, directories: Array }, importmap: { imports: Object<string,string> } }>}
 *   The API manifest and slothlet's own browser importmap.
 *
 * @throws {SlothletError} `GENERATE_BROWSER_ASSETS_SLOTHLET_BASE_INVALID` if `options.slothletBase` is provided but is not a string.
 *
 * @example
 * // Build step — slothlet installed in node_modules (default base), ship both to the renderer.
 * import { generateBrowserAssets } from "@cldmv/slothlet/helpers/generate-manifest";
 * const { manifest, importmap } = await generateBrowserAssets("./src/api");
 * // → inline importmap: `<script type="importmap">${JSON.stringify(importmap)}</script>`
 * // → pass manifest to slothlet({ manifest, resolveModuleSpecifier })
 *
 * @example
 * // Override the base for a CDN (or "/" when the package is served at the web root).
 * const { manifest, importmap } = await generateBrowserAssets("./src/api", {
 *   slothletBase: "https://cdn.example.com/@cldmv/slothlet@3/"
 * });
 */
export function generateBrowserAssets(apiDir: string, options?: {
    slothletBase?: string | undefined;
}): Promise<{
    manifest: {
        files: any[];
        directories: any[];
    };
    importmap: {
        imports: {
            [x: string]: string;
        };
    };
}>;
/**
 * Generate the browser importmap for slothlet's OWN modules.
 *
 * In a browser, slothlet's internal imports (`@cldmv/slothlet`, `@cldmv/slothlet/helpers/*`, …)
 * are static and resolved by the page's importmap **before slothlet runs** — they cannot route
 * through `resolveModuleSpecifier` (which only governs API-leaf loads). This produces that
 * importmap from slothlet's public export surface so consumers never hand-roll it.
 *
 * Each specifier is resolved via `import.meta.resolve`, which automatically picks the dev
 * (`slothlet-dev` → `src/`) or published (`default` → `dist/`) files based on the conditions of
 * the build process — then rebased onto `slothletBase` (where the package is served).
 *
 * @param {string} [slothletBase="/node_modules/@cldmv/slothlet/"] - URL/path prefix where the
 *   `@cldmv/slothlet` package is served in the browser. Defaults to the conventional node_modules
 *   location; override with a CDN URL, an Electron protocol path, or `"/"` when the package is
 *   served at the web root.
 * @returns {Promise<{ imports: Object<string,string> }>} An importmap object ready to inline as
 *   `<script type="importmap">`.
 */
export function generateImportMap(slothletBase?: string): Promise<{
    imports: {
        [x: string]: string;
    };
}>;
//# sourceMappingURL=generate-manifest.d.mts.map