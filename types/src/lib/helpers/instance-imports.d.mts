/**
 * Whether a specifier names a file relative to (or absolute from) its importer, as opposed to a
 * bare package/builtin/subpath-import specifier.
 * @param {string} specifier - The import/require specifier as written.
 * @returns {boolean} True for `./`, `../`, `/` and `file:` specifiers.
 * @internal
 * @example
 * isFileSpecifier("../lib/state.mjs"); // true
 * isFileSpecifier("@cldmv/slothlet/runtime"); // false
 */
export function isFileSpecifier(specifier: string): boolean;
/**
 * Whether a module resolved at `child` (imported from `parent`) belongs to the importing leaf's
 * per-instance graph. Slothlet's own files are always shared. A file inside a `node_modules`
 * package is per instance only when the importer lives in that same package — a slothlet plugin
 * installed as a dependency keeps its own helpers per instance, while a relative path that
 * reaches into some other package does not duplicate that package.
 * @param {string} child - Resolved child (`file:` URL, path or vite id).
 * @param {string} parent - The importer (`file:` URL, path or vite id).
 * @returns {boolean} True when the child should carry the parent's instance query.
 * @internal
 * @example
 * isInstanceScopedFile("/app/lib/state.mjs", "/app/api/tally.mjs"); // true
 * isInstanceScopedFile("/app/node_modules/x/index.js", "/app/api/tally.mjs"); // false
 */
export function isInstanceScopedFile(child: string, parent: string): boolean;
/**
 * Copy the slothlet instance query from `parent` onto `child` when the import belongs to the
 * leaf's per-instance graph; otherwise return `child` unchanged. Works on `file:` URLs (Node) and
 * on vite ids (absolute paths with an optional query) alike.
 * @param {string} specifier - The specifier as written in the importer.
 * @param {string|undefined} parent - The importer's URL or id.
 * @param {string} child - The resolved child URL or id.
 * @returns {string} `child`, with the instance query appended when it applies.
 * @internal
 * @example
 * propagateInstanceQuery("../lib/state.mjs", "file:///app/api/tally.mjs?slothlet_instance=a", "file:///app/lib/state.mjs");
 * // → "file:///app/lib/state.mjs?slothlet_instance=a"
 */
export function propagateInstanceQuery(specifier: string, parent: string | undefined, child: string): string;
/**
 * Run a CommonJS file through an instance's private CommonJS cache (#518, #534) and return its
 * `module.exports`.
 *
 * Node's `require.cache` is keyed on the file path alone, so the instance-scoped files the require
 * reaches (see {@link isInstanceScopedFile} — the file itself and its relative helpers, never
 * `node_modules` packages or slothlet's own files) are kept in a private cache per instance ID and
 * swapped into `require.cache` only for the duration of this synchronous require: global entries for
 * those files are set aside and restored afterwards, so neither the host's copies nor another
 * instance's copies are ever served, and `require.cache` does not grow. The cache is shared by every
 * leaf and mount of the instance and kept across partial reloads; a full reload rotates the instance
 * ID and so starts a fresh one ({@link releaseInstanceScope} drops the old one).
 *
 * While the require runs, the scope is active: a relative `require()` of an ES module from a file of
 * the scope is served the instance's copy of that module (the resolve and load hooks of
 * {@link installInstanceImportHooks}).
 * @param {string} filePath - Absolute path of the CommonJS file.
 * @param {string} instanceID - The instance whose copies are served.
 * @param {object} [options] - Options.
 * @param {boolean} [options.fresh=false] - Evaluate the file itself anew instead of serving (and
 *   keeping) the instance's copy of it — how a leaf is loaded, so a partial reload re-runs it.
 * @returns {*} The file's `module.exports`.
 * @internal
 * @example
 * const exports = requireInInstance("/app/api/counter.cjs", "inst-a", { fresh: true });
 */
export function requireInInstance(filePath: string, instanceID: string, { fresh }?: {
    fresh?: boolean | undefined;
}): any;
/**
 * Drop an instance's private CommonJS copies (#534): on shutdown, and for the old instance ID on a
 * full reload. Its ES module copies stay in Node's module cache (which has no eviction) but are no
 * longer reachable from a live instance.
 * @param {string|null|undefined} instanceID - The instance ID.
 * @returns {void}
 * @internal
 * @example
 * releaseInstanceScope(oldInstanceID);
 */
export function releaseInstanceScope(instanceID: string | null | undefined): void;
/**
 * Source of the ES module that stands in for a CommonJS helper imported by an instance (#534): it
 * runs the file through the instance's private CommonJS cache and exports what Node's own
 * ESM-to-CommonJS import exports — `default` (`module.exports`), `"module.exports"`, and the named
 * exports found by a static scan of the source, read from `module.exports` once it has run.
 * @param {string} filePath - Absolute path of the CommonJS file.
 * @param {string} instanceID - The instance ID.
 * @param {string|null|undefined|Uint8Array} source - Its source, when the loader already read it.
 * @returns {string} The wrapper's ES module source.
 * @internal
 * @example
 * commonJSWrapperSource("/app/lib/state.cjs", "inst-a", null);
 */
export function commonJSWrapperSource(filePath: string, instanceID: string, source: string | null | undefined | Uint8Array): string;
/**
 * Register the resolve and load hooks with Node, once per process (idempotent across slothlet copies).
 * The resolve hook copies a leaf's instance query onto its relative imports and marks relative
 * `require()`s made inside an instance scope; the load hook serves the cross-module-system cases
 * (#534) and passes every unmarked URL straight through.
 * Uses the synchronous in-thread `module.registerHooks()` (Node >= 22.15 / 23.5, slothlet's engines
 * floor). The off-thread `module.register()` is deliberately not used: it adds a cross-thread round
 * trip to every import in the process and reorders module evaluation enough to break leaves that
 * start a fire-and-forget runtime import. A host without `registerHooks()` is left untouched.
 * @param {object} nodeModule - The `node:module` namespace.
 * @param {object} [registry=globalThis] - Where the process-wide "registered" flag lives; the global
 *   object in production, so every slothlet copy in the process sees one registration.
 * @returns {boolean} True when a hook is (now or already) registered.
 * @internal
 * @example
 * installInstanceImportHooks(await import("node:module"));
 */
export function installInstanceImportHooks(nodeModule: object, registry?: object): boolean;
/**
 * Whether Node loads a file as CommonJS, decided the way Node decides it: `.cjs` always; `.js` by the
 * nearest `package.json` `type` (the first one found ends the walk), and with no `type` by syntax
 * detection (the source compiles as a CommonJS function body). Used by the vite plugin, which sees
 * file ids rather than Node's resolved formats.
 * @param {string} filePath - Absolute file path.
 * @returns {boolean} True when the file is CommonJS.
 * @internal
 * @example
 * isCommonJSFile("/app/lib/state.cjs"); // true
 */
export function isCommonJSFile(filePath: string): boolean;
/**
 * Vite plugin applying the same rule inside a vite module graph — for leaves a consumer loads
 * through slothlet's `import` hook under vitest (docs/TESTING.md), where Node's resolve hooks
 * never see the leaf's imports. Add it to the consumer's `vitest.config` `plugins`.
 *
 * A CommonJS helper imported under an instance id (#534) is loaded as the same ES module wrapper the
 * Node load hook generates: the file runs through the instance's private CommonJS cache in the
 * test's own process, so its own `require()`s — CommonJS or ES module — are per instance too, and
 * the copy is shared with the instance's `.cjs` leaves.
 * @returns {object} A vite plugin (`name`, `enforce`, `resolveId`, `load`).
 * @public
 * @example
 * // vitest.config.mjs
 * import { slothletInstanceImports } from "@cldmv/slothlet/helpers/instance-imports";
 * export default defineConfig({ plugins: [slothletInstanceImports()] });
 */
export function slothletInstanceImports(): object;
/**
 * Query parameters copied from a leaf onto its helpers: the instance only. The leaf's `module`
 * (mount) and `_reload` (partial-reload stamp) parameters are deliberately NOT copied — a helper is
 * one copy per instance, shared by every mount and kept across partial reloads; a full reload
 * rotates the instance ID and so yields a fresh copy.
 * @type {ReadonlyArray<string>}
 * @internal
 */
export const INSTANCE_QUERY_KEYS: ReadonlyArray<string>;
/**
 * Process-wide instance-import state.
 */
export type InstanceImportState = {
    /**
     * - Per instance ID: the private CommonJS module
     * copies of that instance, by filename.
     */
    scopes: Map<string, Map<string, object>>;
    /**
     * - The scope a synchronous
     * {@link requireInInstance} is running in (`anchor` is the file it required), else null.
     */
    active: {
        instanceID: string;
        anchor: string;
    } | null;
    /**
     * - Entry point of the ESM wrapper
     * generated for a CommonJS helper.
     */
    requireCJS: (filePath: string, instanceID: string) => any;
    /**
     * - Entry point of the CommonJS stub generated for a
     * `require()` of an ES module.
     */
    requireESM: (url: string) => any;
};
/**
 * Resolve-result shape shared by Node's resolve hooks.
 */
export type ResolveResult = {
    /**
     * - The resolved module URL.
     */
    url: string;
    /**
     * - The module format hint.
     */
    format?: string | undefined;
    /**
     * - Whether the chain was short-circuited.
     */
    shortCircuit?: boolean | undefined;
};
/**
 * Node's next-in-chain resolve function.
 */
export type NextResolve = (specifier: string, context?: object | undefined) => ResolveResult | Promise<ResolveResult>;
//# sourceMappingURL=instance-imports.d.mts.map