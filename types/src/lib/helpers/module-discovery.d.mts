/**
 * @typedef {object} DiscoverOptions
 * @property {string|string[]} [root] - Filesystem path(s) to scan. Default: upward-walk from process.cwd() to nearest node_modules ancestor.
 * @property {string} [manifest="slothlet.module.json"] - Manifest filename, or `<file>#<dotted.key>` locator pointing at a subkey of another file (e.g. `"package.json#slothlet"`).
 * @property {Record<string, string>} [schema] - Field-name remap for legacy manifests. Maps canonical name → legacy name.
 * @property {string|string[]} [prefix] - Name-prefix filter applied BEFORE manifest read. Matches against full package name including scope.
 * @property {(manifest: object, packageName: string) => boolean} [filter] - Content-based filter applied AFTER manifest validation.
 */
/**
 * @typedef {object} DiscoverResult
 * @property {string} package - Package name from package.json.
 * @property {string} folder - Resolved absolute filesystem path to the package directory.
 * @property {string[]} mount - Normalized mount segments (always an array).
 * @property {string} base - Absolute resolved filesystem path to the manifest's `base` folder inside the package.
 * @property {object} manifest - Normalized + deep-frozen manifest (per M3).
 */
/**
 * Walk the filesystem and return validated module candidates.
 *
 * @param {DiscoverOptions} [options] - Discovery options.
 * @param {object} [hooks] - Internal hooks.
 * @param {(details: {package: string, manifest: string}) => void} [hooks.warn] - Called for a manifest that is valid but written in the deprecated format 1 (`WARNING_MODULE_MANIFEST_FORMAT_1`).
 * @returns {Promise<DiscoverResult[]>} Discovered modules in walk order (apply `sort()` for deterministic ordering).
 * @throws {SlothletError} `MODULE_*` codes on manifest validation failures or G7 duplicate-name-version-mismatch.
 *
 * @example
 * import { discoverModules } from "#helpers/module-discovery";
 *
 * const found = await discoverModules();
 * // Default upward-walk root, default slothlet.module.json manifest.
 *
 * @example
 * const drivers = await discoverModules({
 *   prefix: "@cldmv/packrat-driver-",
 *   filter: (m) => m.kind === "driver"
 * });
 */
export function discoverModules(options?: DiscoverOptions, hooks?: {
    warn?: ((details: {
        package: string;
        manifest: string;
    }) => void) | undefined;
}): Promise<DiscoverResult[]>;
export type DiscoverOptions = {
    /**
     * - Filesystem path(s) to scan. Default: upward-walk from process.cwd() to nearest node_modules ancestor.
     */
    root?: string | string[] | undefined;
    /**
     * - Manifest filename, or `<file>#<dotted.key>` locator pointing at a subkey of another file (e.g. `"package.json#slothlet"`).
     */
    manifest?: string | undefined;
    /**
     * - Field-name remap for legacy manifests. Maps canonical name → legacy name.
     */
    schema?: Record<string, string> | undefined;
    /**
     * - Name-prefix filter applied BEFORE manifest read. Matches against full package name including scope.
     */
    prefix?: string | string[] | undefined;
    /**
     * - Content-based filter applied AFTER manifest validation.
     */
    filter?: ((manifest: object, packageName: string) => boolean) | undefined;
};
export type DiscoverResult = {
    /**
     * - Package name from package.json.
     */
    package: string;
    /**
     * - Resolved absolute filesystem path to the package directory.
     */
    folder: string;
    /**
     * - Normalized mount segments (always an array).
     */
    mount: string[];
    /**
     * - Absolute resolved filesystem path to the manifest's `base` folder inside the package.
     */
    base: string;
    /**
     * - Normalized + deep-frozen manifest (per M3).
     */
    manifest: object;
};
//# sourceMappingURL=module-discovery.d.mts.map