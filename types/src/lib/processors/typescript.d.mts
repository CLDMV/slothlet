/**
 * Transform TypeScript code to JavaScript using esbuild
 * @param {string} filePath - Path to the TypeScript file
 * @param {object} [options={}] - esbuild transform options
 * @param {string} [options.target] - ECMAScript target version (default: "es2020")
 * @param {string} [options.format] - Module format (default: "esm")
 * @param {boolean} [options.sourcemap] - Generate source maps (default: false)
 * @returns {Promise<string>} Transformed JavaScript code
 * @throws {SlothletError} If transformation fails
 * @public
 */
export function transformTypeScript(filePath: string, options?: {
    target?: string | undefined;
    format?: string | undefined;
    sourcemap?: boolean | undefined;
}): Promise<string>;
/**
 * Create a data URL for dynamic import with cache busting
 * @param {string} code - JavaScript code to encode
 * @returns {string} Data URL suitable for dynamic import
 * @public
 */
export function createDataUrl(code: string): string;
/**
 * Rewrite relative `import`/`export` specifiers in transformed TS output to
 * absolute `file://` URLs anchored at the **original source directory**.
 *
 * Transformed TS modules are written to (and imported from) a cache file under
 * `.slothlet-cache/…`, which is not co-located with the original source.
 * esbuild and tsc transform the code but never rewrite specifiers, so a
 * relative specifier (`./sibling.mjs`, `../shared/util.mjs`) left as-is would
 * resolve against the cache directory and fail with `Cannot find module`.
 * Each relative specifier is therefore resolved against the real on-disk
 * source location and emitted as an absolute `file://` URL, which resolves
 * identically no matter where the importing cache file lives.
 *
 * Only `./`- and `../`-prefixed specifiers are rewritten. Bare specifiers
 * (`@cldmv/slothlet/runtime`, npm packages) and absolute URLs are left
 * untouched — Node resolves bare specifiers by walking up to `node_modules`,
 * which works because the cache lives inside the project tree.
 *
 * Covered statement forms: static `import`/`export … from` declarations
 * (including multi-line binding lists and `export *`), bare side-effect
 * `import "…"`, and dynamic `import("…")` with a static string literal. A
 * relative specifier that resolves to another `.ts`/`.mts` file is rewritten
 * too, but will still fail to load — Node has no loader for those extensions;
 * slothlet wires TS modules together through `self.*`, not relative imports.
 * @param {string} code - Transformed JavaScript (ESM) code
 * @param {string} sourcePath - Absolute path to the original .ts/.mts source
 * @returns {string} Code with relative specifiers rewritten to absolute file URLs
 * @private
 */
export function rewriteRelativeSpecifiers(code: string, sourcePath: string): string;
/**
 * Write transformed TS output to a content-hashed cache file inside the project
 * so Node's ESM resolver can resolve **bare specifiers** like
 * `import { self } from "@cldmv/slothlet/runtime"` against it. The previous
 * `data:` URL approach could not serve as a resolution base for any non-absolute
 * import; bare specifiers are what every TS module needs in practice (the
 * runtime singletons live in `@cldmv/slothlet/runtime`).
 *
 * **Relative specifiers:** relative `import`/`export` paths in the transformed
 * code are anchored at the original source directory by
 * {@link rewriteRelativeSpecifiers} before the code is hashed and written, so
 * `import './sibling.mjs'` resolves against the source tree rather than the
 * cache directory. Relative imports that resolve to another `.ts`/`.mts` file
 * still will not load (Node has no loader for those extensions); slothlet
 * wires TS modules together via `self.*` at runtime.
 *
 * Cache lives at `<projectRoot>/.slothlet-cache/<pid>-<instanceID>/<hash>.mjs` —
 * deliberately OUTSIDE `node_modules/` because Node's `READ_PACKAGE_SCOPE` halts
 * at a `node_modules` segment and would otherwise break self-reference resolution
 * (needed when slothlet runs inside its own repo / monorepo workspace, where no
 * `node_modules/@cldmv/slothlet` exists). For external consumers, bare-specifier
 * lookup walks up to `<projectRoot>/node_modules/@cldmv/slothlet` either way.
 *
 * The `<pid>-` prefix lets the startup sweep detect orphaned dirs (owner PID
 * gone) without touching live ones.
 * @param {string} originalPath - Path to the original .ts/.mts source (relative or absolute; normalized to an absolute path internally)
 * @param {string} code - Transformed JavaScript code
 * @param {string} instanceID - Slothlet instance ID (used as cache namespace)
 * @returns {Promise<{url: string, cacheDir: string}>} File URL and the cache directory for this instance
 * @public
 */
export function writeTransformedToCache(originalPath: string, code: string, instanceID: string): Promise<{
    url: string;
    cacheDir: string;
}>;
/**
 * Transform TypeScript code to JavaScript using tsc with type checking
 * @param {string} filePath - Path to the TypeScript file
 * @param {object} [options={}] - TypeScript compiler options
 * @param {string} [options.target] - ECMAScript target version (default: "ES2020")
 * @param {string} [options.module] - Module format (default: "ESNext")
 * @param {boolean} [options.strict] - Enable strict type checking (default: true)
 * @param {boolean} [options.skipTypeCheck] - Skip type checking and only transform (default: false)
 * @param {string} [options.typeDefinitionPath] - Path to .d.ts file for type checking
 * @returns {Promise<{code: string, diagnostics: object[]}>} Transformed code and type diagnostics
 * @throws {SlothletError} If transformation fails
 * @public
 */
export function transformTypeScriptStrict(filePath: string, options?: {
    target?: string | undefined;
    module?: string | undefined;
    strict?: boolean | undefined;
    skipTypeCheck?: boolean | undefined;
    typeDefinitionPath?: string | undefined;
}): Promise<{
    code: string;
    diagnostics: object[];
}>;
/**
 * Format TypeScript diagnostics into readable error messages
 * @param {object[]} diagnostics - TypeScript diagnostic objects
 * @param {object} ts - TypeScript module instance
 * @returns {string[]} Array of formatted error messages
 * @private
 */
export function formatDiagnostics(diagnostics: object[], ts: object): string[];
//# sourceMappingURL=typescript.d.mts.map