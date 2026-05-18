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
 * Resolve the on-disk file a relative specifier targets and classify it as a
 * TypeScript source or not.
 *
 * Besides the literal path, this probes the TypeScript source-extension
 * convention: a specifier may name a `.mjs` / `.js` file (or omit the
 * extension) while the file on disk is the corresponding `.mts` / `.ts`
 * source. Whichever form exists wins.
 * @param {string} absoluteTarget - Absolute path the specifier resolves to, as written
 * @returns {{ path: string, isTS: boolean }} The resolved file and whether it is a `.ts`/`.mts` source
 * @private
 */
export function resolveModuleFile(absoluteTarget: string): {
    path: string;
    isTS: boolean;
};
/**
 * Mark every character index that falls inside a string literal, template
 * literal, or comment, so the specifier rewrite can skip `import`/`from` text
 * that is not actually part of an import statement (e.g. `const s = "import('./x')"`).
 *
 * Template literals are masked whole — opening backtick to closing backtick,
 * including any `${…}` interpolations — so a relative dynamic `import()` inside
 * a template interpolation is left un-rewritten rather than risk a false
 * rewrite; nested template literals are not deeply parsed.
 * @param {string} code - JavaScript source to scan
 * @returns {Uint8Array} `1` at indices inside a string/template/comment, `0` elsewhere
 * @private
 */
export function maskStringsAndComments(code: string): Uint8Array;
/**
 * Rewrite relative `import`/`export` specifiers in transformed TS output.
 *
 * Transformed TS modules are written to (and imported from) a cache file under
 * `.slothlet-cache/…`, which is not co-located with the original source.
 * esbuild and tsc transform the code but never rewrite specifiers, so a
 * relative specifier (`./sibling.mjs`, `../shared/util.mjs`) left as-is would
 * resolve against the cache directory and fail with `Cannot find module`.
 *
 * Each relative specifier is resolved against the original source directory
 * and handed to `resolve`, which returns its replacement. The default `resolve`
 * emits an absolute `file://` URL at the source location — correct for plain
 * `.mjs`/`.cjs`/`.js` targets. {@link writeTransformedToCache} passes a `resolve`
 * that additionally points relative `.ts`/`.mts` targets at their transpiled
 * cache files. Bare specifiers (`@cldmv/slothlet/runtime`, npm packages) and
 * absolute URLs are never touched.
 *
 * Matches inside a string literal or comment are skipped via
 * {@link maskStringsAndComments}, so import-shaped text in string data or
 * comments is never mutated.
 *
 * Covered statement forms: static `import`/`export … from` declarations
 * (including multi-line binding lists and `export *`), bare side-effect
 * `import "…"`, and dynamic `import("…")` with a static string literal.
 * Whitespace and comments between the tokens of these forms — including
 * between `from`/`import` and the module string — are tolerated.
 * @param {string} code - Transformed JavaScript (ESM) code
 * @param {string} sourcePath - Absolute path to the original .ts/.mts source
 * @param {(absoluteTarget: string, suffix: string, specifier: string) => string} [resolve]
 *   - Maps a relative specifier to its replacement. Receives the absolute path the
 *   specifier resolves to, any `?query`/`#hash` suffix, and the original specifier
 *   text. Defaults to an absolute `file://` URL anchored at the source directory.
 * @returns {string} Code with relative specifiers rewritten
 * @private
 */
export function rewriteRelativeSpecifiers(code: string, sourcePath: string, resolve?: (absoluteTarget: string, suffix: string, specifier: string) => string): string;
/**
 * Write transformed TS output — and the transitive graph of `.ts`/`.mts` files
 * it relatively imports — to content-hashed cache files inside the project,
 * returning the entry module's `file://` URL.
 *
 * The cache file is not co-located with the source, so every relative specifier
 * is rewritten by {@link rewriteRelativeSpecifiers}:
 *
 * - **Bare specifiers** (`@cldmv/slothlet/runtime`, npm packages) resolve
 *   normally — the cache lives inside the project tree, so Node walks up to
 *   `node_modules` as usual. They are left untouched.
 * - **Relative imports of plain `.mjs`/`.cjs`/`.js` files** are rewritten to an
 *   absolute `file://` URL at the original source location.
 * - **Relative imports of other `.ts`/`.mts` files** are followed: when a
 *   `transform` callback is supplied, each dependency is transpiled and cached
 *   too, and the importing specifier is rewritten to the dependency's cache
 *   file. Import cycles are handled. Without `transform`, a relative `.ts`/`.mts`
 *   target is left at its source path (and will not load).
 *
 * Each cache file is named by a hash over the absolute source paths and
 * transpiled code of its whole relative-`.ts`/`.mts` closure, so editing any
 * file in the graph produces fresh URLs for every importer — a reload never
 * serves stale linked output.
 *
 * Cache lives at `<projectRoot>/.slothlet-cache/<pid>-<instanceID>/<hash>.mjs` —
 * deliberately OUTSIDE `node_modules/` because Node's `READ_PACKAGE_SCOPE` halts
 * at a `node_modules` segment and would otherwise break self-reference resolution
 * (needed when slothlet runs inside its own repo / monorepo workspace, where no
 * `node_modules/@cldmv/slothlet` exists). The `<pid>-` prefix lets the startup
 * sweep detect orphaned dirs (owner PID gone) without touching live ones.
 * @param {string} originalPath - Path to the original .ts/.mts source (relative or absolute; normalized internally)
 * @param {string} code - Transformed JavaScript code for `originalPath`
 * @param {string} instanceID - Slothlet instance ID (used as cache namespace)
 * @param {(filePath: string) => Promise<string>} [transform] - Transpiles a `.ts`/`.mts`
 *   file to JavaScript; enables following relative `.ts`/`.mts` imports.
 * @returns {Promise<{url: string, cacheDir: string}>} Entry file URL and the cache directory for this instance
 * @public
 */
export function writeTransformedToCache(originalPath: string, code: string, instanceID: string, transform?: (filePath: string) => Promise<string>): Promise<{
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