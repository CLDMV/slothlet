/**
 * Record that one of slothlet's runtime entry files has been evaluated, with its namespace (#760). Called by each of
 * those files as its last statement. A process can run two module loaders at once: under vitest, slothlet's source is
 * evaluated by vite's module runner, while a CommonJS file, or a file imported by its URL, is loaded by Node itself.
 * Asked for the runtime by such a file, Node would evaluate the runtime's file a second time, and that second copy
 * knows no instance. With the namespace recorded here, the resolve hook sends Node's import of the file to a module
 * that re-exports the namespace already made (see {@link ownModuleBridge}), so the importer gets the runtime slothlet
 * runs on. A second copy of slothlet that Node loaded itself keeps Node's own evaluation of the file, which is that
 * copy's runtime (see {@link isOtherCopysFile}). Only the runtime's entry files are taken, each once.
 * @param {string} url - The file's `import.meta.url`.
 * @param {object} namespace - Its module namespace.
 * @returns {void}
 * @internal
 * @example
 * registerOwnModule(import.meta.url, runtimeNamespace);
 */
export function registerOwnModule(url: string, namespace: object): void;
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
 * per-instance graph. Slothlet's own files are always shared. A file in a package other than the
 * importer's own stays shared, however the import is spelled (#715): reached by a relative path or a
 * `file:` URL it is the same module as its package-name spelling, which is shared — one file, one URL
 * within an instance. A package is a `node_modules` package directory or, outside `node_modules`, the
 * nearest named `package.json` (a pnpm workspace package resolves to its real path there). A slothlet
 * plugin installed as a dependency, or a module that is a package of its own, keeps its own helpers per
 * instance.
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
 * Whether a file a bare specifier resolved to (`#imports`, or a package's reference to itself by name) is in the
 * importing module's own package, and so belongs to its per-instance graph as a relative import of the file does
 * (#715): one file is one URL inside an instance, however the import is spelled. A bare specifier that resolves into
 * another package stays shared, and slothlet's own source or build tree always does.
 * @param {string} child - Resolved child (`file:` URL, path or vite id).
 * @param {string} parent - The importer (`file:` URL, path or vite id).
 * @returns {boolean} True when the child should carry the parent's instance query.
 * @internal
 * @example
 * isOwnPackageImport("/app/lib/state.mjs", "/app/api/tally.mjs"); // true when `/app/package.json` is the package of both
 * isOwnPackageImport("/app/node_modules/x/index.js", "/app/api/tally.mjs"); // false
 */
export function isOwnPackageImport(child: string, parent: string): boolean;
/**
 * Whether a file is one of slothlet's own files a module's files may not import: any file of slothlet's code but the
 * runtime's entry files (see {@link MODULE_IMPORTABLE}).
 * @param {string} ref - The file's URL, path or vite id.
 * @returns {boolean} True when only slothlet's own files may import it.
 * @internal
 * @example
 * isSlothletInternal("file:///app/node_modules/@cldmv/slothlet/dist/lib/helpers/config.mjs"); // true
 * isSlothletInternal("file:///app/node_modules/@cldmv/slothlet/dist/lib/runtime/runtime.mjs"); // false
 */
export function isSlothletInternal(ref: string): boolean;
/**
 * Record that slothlet loads an api file: its path, so the file's own code is told to be a module's wherever it runs
 * under its path alone (a loader evaluating the copy under another name, a `require` made from the file's plain path).
 * @param {string} ref - The api file's path or URL.
 * @returns {void}
 * @internal
 */
export function noteModuleFile(ref: string): void;
/**
 * Register how a refused import is reported: a function given `{ specifier, file, allowed }` that returns the error to
 * throw. Taken once, by the copy that keeps the shared object.
 * @param {function(object): Error} make - Builds the error.
 * @returns {void}
 * @internal
 */
export function setImportRefusal(make: (arg0: object) => Error): void;
/**
 * Copy the slothlet instance query from `parent` onto `child` when the import belongs to the
 * leaf's per-instance graph; otherwise return `child` unchanged. Works on `file:` URLs (Node) and
 * on vite ids (absolute paths with an optional query) alike. When the parent carries {@link HELPERS_PARAM}
 * (the `helpers: "module"` option), the child is the copy of the api file the parent is, or was loaded for.
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
 * The import graph of an instance's own code: for each file a leaf of the instance reached through an
 * import or require that carries the instance (#601 review), the files that import it. The live runtime
 * walks it upwards to tell which leaves a stack frame's code belongs to.
 * What comes back is a read-only view (see graphView): it reads as a `Map` of importers by imported file does, hands
 * out each collection of importers as a copy, and is one object per instance for as long as its graph lives.
 * @param {string} instanceID - The instance ID.
 * @returns {object|null} Importers by imported file (forward-slash paths), or null.
 * @internal
 * @example
 * instanceImporters("inst-a")?.get("/app/lib/state.mjs"); // Set { "/app/api/tally.mjs" }
 */
export function instanceImporters(instanceID: string): object | null;
/**
 * The files of an instance's CommonJS code (#534): its CommonJS leaves and the helpers they required.
 * They run under their plain path, with no import query, so the live runtime looks a stack frame up
 * here to tell the instance's code from the host's (#601 review).
 * @param {string} instanceID - The instance ID.
 * @returns {string[]} Absolute paths, as Node's require cache keys them.
 * @internal
 * @example
 * instanceCommonJSFiles("inst-a"); // ["/app/lib/state.cjs"]
 */
export function instanceCommonJSFiles(instanceID: string): string[];
/**
 * What a reader can key what it derived from {@link instanceCommonJSFiles} on (#601 review): an object standing for
 * the instance's CommonJS state, dropped by the instance's release, and how many files the instance has. Files are
 * only ever added while the instance lives, so an equal count means the same files. The object holds nothing.
 * @param {string} instanceID - The instance ID.
 * @returns {{key: object, count: number}|null} The key and file count, or null when it has none.
 * @internal
 * @example
 * instanceCommonJSVersion("inst-a"); // { key: {}, count: 3 }
 */
export function instanceCommonJSVersion(instanceID: string): {
    key: object;
    count: number;
} | null;
/**
 * Claim an instance ID for the instance that carries it, before any of its files load. The handle is how the instance
 * loads its CommonJS files ({@link scopeRequire}) and, when it shuts down or takes a new ID, releases what slothlet
 * keeps about its files. The instance keeps the handle to itself: nothing else can load a file as the instance's code
 * or drop what is recorded about it, whatever it can import or reach through the global object. With two copies of
 * slothlet in the process, the copy that loaded first keeps every instance's record, and this claims there.
 * @param {string} instanceID - The instance ID.
 * @returns {{instanceID: string, require: function(string, object=): *, release: function(): void}|null} The handle,
 *   or null when the ID is claimed already.
 * @internal
 * @example
 * const scope = claimInstanceScope(instanceID);
 * scope.require("/app/api/counter.cjs", { fresh: true });
 * scope.release();
 */
export function claimInstanceScope(instanceID: string): {
    instanceID: string;
    require: (arg0: string, arg1: object | undefined) => any;
    release: () => void;
} | null;
/**
 * Run a CommonJS file through the private CommonJS cache of an instance ID no instance has claimed (see
 * {@link scopeRequire} for what that does): for a caller that is not an instance, such as a test of the cache. An
 * instance loads its files through the handle it claimed ({@link claimInstanceScope}); for an ID an instance holds,
 * this throws.
 * @param {string} filePath - Absolute path of the CommonJS file.
 * @param {string} instanceID - The instance ID whose copies are served.
 * @param {object} [options] - Options, as {@link scopeRequire} takes them (`fresh`, `importer`, `mount`).
 * @returns {*} The file's `module.exports`.
 * @throws {TypeError} When the ID is claimed by an instance.
 * @internal
 * @example
 * const exports = requireInInstance("/app/api/counter.cjs", "inst-a", { fresh: true });
 */
export function requireInInstance(filePath: string, instanceID: string, options?: object): any;
/**
 * Drop what is kept for an instance ID that {@link requireInInstance} claimed, or that no one claimed (what the hooks
 * recorded for a URL carrying it). An ID an instance holds is released by the instance's own handle, and is left as
 * it is here.
 * @param {string|null|undefined} instanceID - The instance ID.
 * @returns {void}
 * @internal
 * @example
 * releaseInstanceScope("inst-a");
 */
export function releaseInstanceScope(instanceID: string | null | undefined): void;
/**
 * Register frame placement's check of who is calling into slothlet: given an `Error` slothlet created on entry, the
 * location of the module whose own top-level code made the call, when vitest's or vite's module runner was evaluating
 * that module, else null. Taken once, by the copy that keeps the shared object.
 * @param {function(Error): (string|null)} check - The check.
 * @returns {void}
 * @internal
 */
export function setCallerCheck(check: (arg0: Error) => (string | null)): void;
/**
 * Source of the ES module that stands in for a CommonJS helper imported by an instance (#534): it
 * runs the file through the instance's private CommonJS cache and exports what Node's own
 * ESM-to-CommonJS import exports — `default` (`module.exports`), `"module.exports"`, and the named
 * exports found by a static scan of the source, read from `module.exports` once it has run.
 * @param {string} filePath - Absolute path of the CommonJS file.
 * @param {string} instanceID - The instance ID.
 * @param {string|null|undefined|Uint8Array} source - Its source, when the loader already read it.
 * @param {string|null} [importer=null] - The api file the copy is loaded for (`helpers: "module"`): the file then
 *   runs through that api file's own CommonJS cache.
 * @param {string|null} [mount=null] - That api file's mount.
 * @returns {string} The wrapper's ES module source.
 * @internal
 * @example
 * commonJSWrapperSource("/app/lib/state.cjs", "inst-a", null);
 */
export function commonJSWrapperSource(filePath: string, instanceID: string, source: string | null | undefined | Uint8Array, importer?: string | null, mount?: string | null): string;
/**
 * Add a hash to a list of the newest {@link SCRIPTS_PER_KEY}: one already there becomes the newest again.
 * @param {Array<string>} hashes - The list, oldest first.
 * @param {string} hash - The hash.
 * @returns {void}
 * @internal
 */
export function rememberNewest(hashes: Array<string>, hash: string): void;
/**
 * Register how a URL is reduced to the key its script hashes are kept under (see {@link scriptKeyOf}).
 * @param {function(string): string} keyOf - The URL's key.
 * @returns {void}
 * @internal
 */
export function setScriptKey(keyOf: (arg0: string) => string): void;
/**
 * Whether sources are recorded for a script key, and whether a given one is among them (see
 * {@link recordLoadedSource}).
 * @param {string} key - The script key.
 * @param {string} [hash] - A script's hash.
 * @returns {{known: boolean, has: boolean}} The answer.
 * @internal
 */
export function loadedScriptLookup(key: string, hash?: string): {
    known: boolean;
    has: boolean;
};
/**
 * The text of a source recorded for a script key (see {@link recordLoadedSource}): the one with the given hash, or the
 * newest when no hash is given. Undefined when none is recorded (the hook did not load the file, or another slothlet
 * copy's hook did and keeps no text).
 * @param {string} key - The script key.
 * @param {string|null} [hash] - The script's hash.
 * @returns {string|undefined} The text.
 * @internal
 * @example
 * loadedScriptText(key, frame.hash); // "export const a = () => 1;\n"
 */
export function loadedScriptText(key: string, hash?: string | null): string | undefined;
/**
 * The URLs of the files that import a package file, as the resolve hook recorded them (#597).
 * @param {string} path - The package file's path.
 * @returns {Array<string>} The importers' URLs.
 * @internal
 */
export function packageImporters(path: string): Array<string>;
/**
 * The hashes recorded for the script a URL loads, oldest first.
 * @param {string} url - The URL.
 * @returns {Array<string>} The hashes.
 * @internal
 * @example
 * recordedScriptHashes("file:///app/api/x.mjs?slothlet_instance=a"); // ["…"]
 */
export function recordedScriptHashes(url: string): Array<string>;
/**
 * How many script keys have hashes recorded.
 * @returns {number} The count.
 * @internal
 * @example
 * recordedScriptCount(); // 12
 */
export function recordedScriptCount(): number;
/**
 * The instance a script key names, or null for code no instance tagged.
 * @param {string} key - A script key: path, instance tag and mount tag, NUL-separated.
 * @returns {string|null} The instance ID.
 * @internal
 */
export function scriptKeyInstance(key: string): string | null;
/**
 * Register the resolve and load hooks with Node, once per process: the hooks of the slothlet copy that keeps every
 * instance's record (the first to load), which another copy asks to register them.
 * The resolve hook copies a leaf's instance query onto its relative imports and marks relative
 * `require()`s made inside an instance scope; the load hook serves the cross-module-system cases
 * (#534) and passes every unmarked URL straight through.
 * Uses the synchronous in-thread `module.registerHooks()` (Node >= 22.15 / 23.5, slothlet's engines
 * floor). The off-thread `module.register()` is deliberately not used: it adds a cross-thread round
 * trip to every import in the process and reorders module evaluation enough to break leaves that
 * start a fire-and-forget runtime import. A host without `registerHooks()` is left untouched.
 * @param {object} nodeModule - The `node:module` namespace.
 * @param {object} [registry=globalThis] - The global object in production. Any other object is a registry of the
 *   caller's own: this copy's hooks are then registered on `nodeModule` once per registry, whichever copy keeps the
 *   record.
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
 *
 * Every JavaScript or TypeScript ES module it transforms that is not under `node_modules` and not slothlet's own, an
 * instance file among them, gets one statement appended that records the script vite compiled it into (#714). Each such
 * file that is not an instance file also imports a virtual module that records which modules loaded it, as the plugin
 * resolved their imports: an instance file, or another file a module loaded. With permissions on, code running inside
 * a module's call is then attributed as it is under Node's own loader (docs/PERMISSIONS.md).
 * @returns {object} A vite plugin (`name`, `enforce`, `resolveId`, `transform`, `load`).
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
 * Query parameter a leaf's URL carries when its instance loads helper files once per importing api file (the
 * `helpers: "module"` option), and its value. A helper loaded for such a leaf carries it too, with
 * {@link HELPERS_FOR_PARAM} naming the api file it was loaded for and {@link HELPERS_MOUNT_PARAM} that file's mount,
 * so each api file gets its own copy of every helper it imports, and a copy's stack frames name the file it runs for.
 * @type {string}
 * @internal
 */
export const HELPERS_PARAM: string;
/**
 * The value of {@link HELPERS_PARAM}.
 * @type {string}
 * @internal
 */
export const HELPERS_PER_MODULE: string;
/**
 * Query parameter of a helper copy: the path of the api file it was loaded for (see {@link HELPERS_PARAM}).
 * @type {string}
 * @internal
 */
export const HELPERS_FOR_PARAM: string;
/**
 * Query parameter of a helper copy: the mount (`module` parameter) of the api file it was loaded for.
 * @type {string}
 * @internal
 */
export const HELPERS_MOUNT_PARAM: string;
/**
 * How many script hashes are kept for one script key; a file loaded again with another source past that forgets its
 * oldest. Frame placement keeps the scripts it learns to the same number, newest kept.
 * @type {number}
 * @internal
 */
export const SCRIPTS_PER_KEY: number;
/**
 * The global key a host file's registration puts what it captures under (#714): an array of the `Error`s each of the
 * host's own files vite transformed created as its last statement, read by slothlet's frame placement.
 * @type {string}
 * @internal
 */
export const VITE_HOST_SCRIPTS: string;
/**
 * The global key the records of who loaded each of the host's own vite-transformed files go under (#714): the `Error`
 * each record's virtual module creates, frozen, its message the JSON of the importers, read by slothlet's frame placement.
 * @type {string}
 * @internal
 */
export const VITE_LOADED_BY: string;
/**
 * The specifier of the virtual module that records who loaded a file (#714), before its `id` parameter: imported by the
 * statement the vite plugin appends to each of the host's own files, resolved by the plugin to the id with a leading
 * `\0`, which no file on disk can have.
 * @type {string}
 * @internal
 */
export const LOADED_BY_SPECIFIER: string;
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
/**
 * The object the slothlet copies of a process share, made and kept by the first copy to load. It is frozen, and holds
 * no collection and no record: what slothlet keeps about an instance's files stays in module-private state of the
 * copy that made the object, and every member here either reads from that state without handing any of it out, only
 * ever adds to it what a module may add, or acts for one instance on proof of being that instance.
 */
export type InstanceImportState = {
    /**
     * - Records a module's
     * imports; called by the registration the vite plugin appends to each instance module. It only ever adds an importer.
     */
    recordImports: (instanceID: string, parent: string, children: string[]) => void;
    /**
     * - The reader of the import graphs (see graphView).
     */
    imports: {
        of: (arg0: string) => (object | null);
    };
    /**
     * -
     * The reader of the sources the load hook recorded (#597).
     */
    scripts: {
        lookup: Function;
        hashes: Function;
        text: Function;
        count: Function;
        packageImporters: Function;
    };
    /**
     * -
     * The reader of an instance's CommonJS files.
     */
    commonJS: {
        files: (arg0: string) => string[];
        version: (arg0: string) => ({
            key: object;
            count: number;
        } | null);
    };
    /**
     * - How a URL is reduced to its script key.
     */
    scriptKeyOf: (url: string) => string;
    /**
     * - The namespace of one of slothlet's runtime entry files the
     * keeping copy has evaluated (#760, see registerOwnModule).
     */
    own: (url: string) => (object | undefined);
    /**
     * - Claims an instance ID (see claimInstanceScope).
     */
    claim: (instanceID: string) => (object | null);
    /**
     * - Registers the keeping copy's hooks with Node, once.
     */
    hooks: () => boolean;
    /**
     * - Entry point of the code the load hook generates (see mintTicket).
     */
    redeem: (ticket: string) => object;
    /**
     * - Holds an import or `import.meta.resolve` an instance
     * module vite loaded makes by a specifier only known as it runs (see checkModuleImport).
     */
    checkImport: (specifier: any, importer: string) => any;
    /**
     * - Entry point of the wrapper the vite plugin
     * generates for a CommonJS helper (see requireCJSFromRunner).
     */
    requireCJS: (filePath: string, instanceID: string) => any;
};
//# sourceMappingURL=instance-imports.d.mts.map