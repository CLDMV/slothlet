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
 * Write transformed TS output to a content-hashed cache file inside the project
 * so Node's ESM resolver can resolve **bare specifiers** like
 * `import { self } from "@cldmv/slothlet/runtime"` against it. The previous
 * `data:` URL approach could not serve as a resolution base for any non-absolute
 * import; bare specifiers are what every TS module needs in practice (the
 * runtime singletons live in `@cldmv/slothlet/runtime`).
 *
 * **Scope:** bare-specifier resolution only. Relative imports between user TS
 * modules (`import './sibling.ts'`) are NOT supported via this path — they
 * would resolve against the cache directory rather than the original source
 * directory. Slothlet doesn't need them because each `.ts`/`.mts` file is
 * loaded independently through this loader and the modules are wired
 * together via `self.*` at runtime. Cross-module relative imports between
 * user TS modules would require mirroring the source tree under the cache
 * dir and rewriting specifiers — out of scope for this loader.
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