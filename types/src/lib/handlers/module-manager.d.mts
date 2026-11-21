/**
 * @typedef {import("../helpers/module-discovery.mjs").DiscoverResult} DiscoverResult
 * @typedef {import("../helpers/module-discovery.mjs").DiscoverOptions} DiscoverOptions
 */
/**
 * @typedef {object} AddModuleOptions
 * @property {string|{mode?: "skip"|"warn"|"replace"|"merge"|"merge-replace"|"error"}} [collision] - `collision.mode` (or the mode as a bare string): per-mount override; defaults to "merge" (matches `DEFAULT_MODULE_COLLISION_MODE`). Use "error" to throw on any pre-flight mount collision against api-manager's `addHistory`.
 * @property {string} [version] - When the discovery cache holds multiple versions of the same `name`, mount only the entry whose package.json version matches.
 * @property {DiscoverOptions} [discover] - Options to forward to the lazy discover() call if the cache is empty. Ignored when the cache already holds data.
 */
/**
 * @typedef {object} AddModulesOptions
 * @property {string|{mode?: "skip"|"warn"|"replace"|"merge"|"merge-replace"|"error"}} [collision] - `collision.mode` (or the mode as a bare string): per-call collision policy passed to every mount. Defaults to "merge" (matches `DEFAULT_MODULE_COLLISION_MODE`); use "error" to throw on any pre-flight mount collision.
 * @property {"throw"|"rollback"|"best-effort"} [failure="throw"] - Failure policy. `throw` (default): throw on first failure, leave mounted entries in place. `rollback`: throw on first failure, remove every entry mounted in this call. `best-effort`: collect failures, return aggregate `{ mounted, failed }`.
 * @property {number} [concurrency=1] - Mount concurrency. `1` (default) = serial. Higher values mount in parallel batches.
 */
/**
 * @typedef {object} MountResult
 * @property {string} module - The module id api.add() returned for the mount.
 * @property {string} package - The package name.
 * @property {string[]} mount - Segments of the path used at the time of mount, including any version prefix.
 * @property {DiscoverResult} found - The discovery result the module was mounted from.
 * @property {{default: boolean, tag: string}|null} version - Versioning descriptor when the module mounted under a `vMAJOR.<mount>` prefix (multi-version case from `#buildVersionConfigs`), otherwise `null`. `tag` is the slothlet version tag (`vMAJOR`); `default` indicates whether this entry is the default for the unversioned dispatch path.
 */
/**
 * @typedef {object} FailureEntry
 * @property {DiscoverResult|string} item - The cache entry or name that failed.
 * @property {Error} error
 */
/**
 * Module discovery + mount handler.
 * @class
 * @extends ComponentBase
 */
export class ModuleManager extends ComponentBase {
    /**
     * Property name used by slothlet's auto-discovery initialization loop.
     * @type {string}
     * @static
     */
    static slothletProperty: string;
    /**
     * @param {object} slothlet - Parent slothlet instance.
     */
    constructor(slothlet: object);
    /**
     * Walk the filesystem for slothlet modules, validate manifests, dedupe, and
     * replace the discovery cache with the new results. Returns the sorted
     * candidate list using sortModules's default comparator.
     *
     * Emits `modules:discover-start` before the walk and
     * `modules:discover-complete` after the cache is populated.
     *
     * @param {DiscoverOptions} [options]
     * @returns {Promise<DiscoverResult[]>} Validated discovery results in walk order (apply `sortModules()` for deterministic ordering).
     * @throws {SlothletError} `MODULE_DISCOVERY_REQUIRES_NODE` in a browser, which has no filesystem to walk.
     */
    discover(options?: DiscoverOptions): Promise<DiscoverResult[]>;
    /**
     * Whether `value` is a discover result this instance's `discover()` returned. `modules.add()` takes one of these
     * back as a module to mount and reads any other object as options: a result is told apart by where it came from,
     * never by its shape.
     * @param {unknown} value - Any value.
     * @returns {boolean} True for a result this instance's discovery produced.
     */
    issued(value: unknown): boolean;
    /**
     * Pure sort wrapper. Forwards to `sortModules()` without touching cache state.
     *
     * @param {DiscoverResult[]} results
     * @param {(a: DiscoverResult, b: DiscoverResult) => number} [comparator]
     * @returns {DiscoverResult[]}
     */
    sort(results: DiscoverResult[], comparator?: (a: DiscoverResult, b: DiscoverResult) => number): DiscoverResult[];
    /**
     * Return the list of modules currently in the discovery cache.
     * @returns {DiscoverResult[]}
     */
    getDiscoveryCache(): DiscoverResult[];
    /**
     * Empty the discovery cache. Does not affect already-mounted modules.
     * @returns {void}
     */
    clearDiscoveryCache(): void;
    /**
     * Compute the stale-mount set per S3b: mounted modules that did not surface
     * in the most recent `discover()` cache. Host calls this after re-discovery
     * to decide what to unmount.
     *
     * @returns {MountResult[]} Mounts whose `${package}@${version}` is no longer in the cache.
     */
    getStaleMounts(): MountResult[];
    /**
     * Mount a single module — by name (cache lookup), by a DiscoverResult this
     * instance's discover() returned, or with a lazy-trigger discover() if the
     * name is not cached. Any other object is refused as an invalid argument.
     *
     * @param {string|DiscoverResult} nameOrResult
     * @param {AddModuleOptions} [options]
     * @returns {Promise<MountResult>}
     * @throws {SlothletError} `MODULE_PACKAGE_NOT_FOUND` when a name cannot be resolved.
     * @throws {SlothletError} `INVALID_ARGUMENT` when `nameOrResult` is an object this instance's discover() did not return.
     * @throws {SlothletError} `MODULE_MOUNT_COLLISION` when the exact mountPath is already occupied and `collisionMode` is `"error"`.
     */
    addModule(nameOrResult: string | DiscoverResult, options?: AddModuleOptions, writer?: any): Promise<MountResult>;
    /**
     * Mount a list of modules.
     *
     * @param {Array<string|DiscoverResult>} items - Heterogeneous array; strings resolved through the discovery cache,
     *   objects only as results this instance's discover() returned (any other object refuses the whole batch).
     * @param {AddModulesOptions} [options]
     * @returns {Promise<MountResult[] | {mounted: MountResult[], failed: FailureEntry[]}>} Plain array under `throw`/`rollback`; aggregate object under `best-effort`.
     */
    addModules(items: Array<string | DiscoverResult>, options?: AddModulesOptions, writer?: any): Promise<MountResult[] | {
        mounted: MountResult[];
        failed: FailureEntry[];
    }>;
    /**
     * Unmount a previously-mounted module by package name (and optional version
     * when multi-version mounts are in play).
     *
     * @param {string} name - Package name.
     * @param {object} [opts]
     * @param {string} [opts.version] - Disambiguator when more than one mounted entry shares the name.
     * @param {object|null} [writer] - The calling module's wrapper, or null for host code; read where the call enters,
     *   before any await, as the live runtime no longer knows the caller after one (#625).
     * @returns {Promise<boolean>} `true` when something was unmounted, `false` when no matching mount was found.
     * @throws {SlothletError} What {@link ApiManager#assertModuleRemovalOf} throws: module code removes every match or
     *   none.
     */
    removeModule(name: string, opts?: {
        version?: string | undefined;
    }, writer?: object | null): Promise<boolean>;
    #private;
}
export type DiscoverResult = import("../helpers/module-discovery.mjs").DiscoverResult;
export type DiscoverOptions = import("../helpers/module-discovery.mjs").DiscoverOptions;
export type AddModuleOptions = {
    /**
     * - `collision.mode` (or the mode as a bare string): per-mount override; defaults to "merge" (matches `DEFAULT_MODULE_COLLISION_MODE`). Use "error" to throw on any pre-flight mount collision against api-manager's `addHistory`.
     */
    collision?: string | {
        mode?: "skip" | "warn" | "replace" | "merge" | "merge-replace" | "error";
    } | undefined;
    /**
     * - When the discovery cache holds multiple versions of the same `name`, mount only the entry whose package.json version matches.
     */
    version?: string | undefined;
    /**
     * - Options to forward to the lazy discover() call if the cache is empty. Ignored when the cache already holds data.
     */
    discover?: import("../helpers/module-discovery.mjs").DiscoverOptions | undefined;
};
export type AddModulesOptions = {
    /**
     * - `collision.mode` (or the mode as a bare string): per-call collision policy passed to every mount. Defaults to "merge" (matches `DEFAULT_MODULE_COLLISION_MODE`); use "error" to throw on any pre-flight mount collision.
     */
    collision?: string | {
        mode?: "skip" | "warn" | "replace" | "merge" | "merge-replace" | "error";
    } | undefined;
    /**
     * - Failure policy. `throw` (default): throw on first failure, leave mounted entries in place. `rollback`: throw on first failure, remove every entry mounted in this call. `best-effort`: collect failures, return aggregate `{ mounted, failed }`.
     */
    failure?: "throw" | "rollback" | "best-effort" | undefined;
    /**
     * - Mount concurrency. `1` (default) = serial. Higher values mount in parallel batches.
     */
    concurrency?: number | undefined;
};
export type MountResult = {
    /**
     * - The module id api.add() returned for the mount.
     */
    module: string;
    /**
     * - The package name.
     */
    package: string;
    /**
     * - Segments of the path used at the time of mount, including any version prefix.
     */
    mount: string[];
    /**
     * - The discovery result the module was mounted from.
     */
    found: DiscoverResult;
    /**
     * - Versioning descriptor when the module mounted under a `vMAJOR.<mount>` prefix (multi-version case from `#buildVersionConfigs`), otherwise `null`. `tag` is the slothlet version tag (`vMAJOR`); `default` indicates whether this entry is the default for the unversioned dispatch path.
     */
    version: {
        default: boolean;
        tag: string;
    } | null;
};
export type FailureEntry = {
    /**
     * - The cache entry or name that failed.
     */
    item: DiscoverResult | string;
    error: Error;
};
import { ComponentBase } from "#factories/component-base";
//# sourceMappingURL=module-manager.d.mts.map