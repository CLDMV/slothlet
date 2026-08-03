/**
 * @typedef {import("../helpers/module-discovery.mjs").DiscoverResult} DiscoverResult
 * @typedef {import("../helpers/module-discovery.mjs").DiscoverOptions} DiscoverOptions
 */
/**
 * @typedef {object} AddModuleOptions
 * @property {"skip"|"warn"|"replace"|"merge"|"merge-replace"|"error"} [collisionMode="merge"] - Per-mount override; defaults to "merge" (matches `DEFAULT_MODULE_COLLISION_MODE`). Use "error" to throw on any pre-flight mountPath collision against api-manager's `addHistory`.
 * @property {string} [version] - When the discovery cache holds multiple versions of the same `name`, mount only the entry whose package.json version matches.
 * @property {DiscoverOptions} [discover] - Options to forward to the lazy discover() call if the cache is empty. Ignored when the cache already holds data.
 */
/**
 * @typedef {object} AddModulesOptions
 * @property {"skip"|"warn"|"replace"|"merge"|"merge-replace"|"error"} [collisionMode="merge"] - Per-call collision policy passed to every mount. Defaults to "merge" (matches `DEFAULT_MODULE_COLLISION_MODE`); use "error" to throw on any pre-flight mountPath collision.
 * @property {"throw"|"rollback"|"best-effort"} [onFailure="throw"] - Failure policy. `throw` (default): throw on first failure, leave mounted entries in place. `rollback`: throw on first failure, remove every entry mounted in this call. `best-effort`: collect failures, return aggregate `{ mounted, failed }`.
 * @property {number} [concurrency=1] - Mount concurrency. `1` (default) = serial. Higher values mount in parallel batches.
 */
/**
 * @typedef {object} MountResult
 * @property {string} packageName
 * @property {string} mountPath - Dot-notation path used at the time of mount.
 * @property {string} moduleID - moduleID returned by api.add().
 * @property {DiscoverResult} discoverResult
 * @property {{version: string, default: boolean}|null} versionConfig - Versioning descriptor when the module mounted under a `vMAJOR.<mountPath>` prefix (multi-version case from `#buildVersionConfigs`), otherwise `null`. `version` is the slothlet version tag (`vMAJOR`); `default` indicates whether this entry is the default for the unversioned dispatch path.
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
     */
    discover(options?: DiscoverOptions): Promise<DiscoverResult[]>;
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
     * @returns {MountResult[]} Mounts whose `${packageName}@${version}` is no longer in the cache.
     */
    getStaleMounts(): MountResult[];
    /**
     * Mount a single module — by name (cache lookup), by DiscoverResult directly,
     * or with a lazy-trigger discover() if the name is not cached.
     *
     * @param {string|DiscoverResult} nameOrResult
     * @param {AddModuleOptions} [options]
     * @returns {Promise<MountResult>}
     * @throws {SlothletError} `MODULE_PACKAGE_NOT_FOUND` when a name cannot be resolved.
     * @throws {SlothletError} `MODULE_MOUNT_COLLISION` when the exact mountPath is already occupied and `collisionMode` is `"error"`.
     */
    addModule(nameOrResult: string | DiscoverResult, options?: AddModuleOptions): Promise<MountResult>;
    /**
     * Mount a list of modules.
     *
     * @param {Array<string|DiscoverResult>} items - Heterogeneous array; strings resolved through the discovery cache.
     * @param {AddModulesOptions} [options]
     * @returns {Promise<MountResult[] | {mounted: MountResult[], failed: FailureEntry[]}>} Plain array under `throw`/`rollback`; aggregate object under `best-effort`.
     */
    addModules(items: Array<string | DiscoverResult>, options?: AddModulesOptions): Promise<MountResult[] | {
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
     * @returns {Promise<boolean>} `true` when something was unmounted, `false` when no matching mount was found.
     */
    removeModule(name: string, opts?: {
        version?: string | undefined;
    }): Promise<boolean>;
    #private;
}
export type DiscoverResult = import("../helpers/module-discovery.mjs").DiscoverResult;
export type DiscoverOptions = import("../helpers/module-discovery.mjs").DiscoverOptions;
export type AddModuleOptions = {
    /**
     * - Per-mount override; defaults to "merge" (matches `DEFAULT_MODULE_COLLISION_MODE`). Use "error" to throw on any pre-flight mountPath collision against api-manager's `addHistory`.
     */
    collisionMode?: "merge" | "replace" | "skip" | "warn" | "merge-replace" | "error" | undefined;
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
     * - Per-call collision policy passed to every mount. Defaults to "merge" (matches `DEFAULT_MODULE_COLLISION_MODE`); use "error" to throw on any pre-flight mountPath collision.
     */
    collisionMode?: "merge" | "replace" | "skip" | "warn" | "merge-replace" | "error" | undefined;
    /**
     * - Failure policy. `throw` (default): throw on first failure, leave mounted entries in place. `rollback`: throw on first failure, remove every entry mounted in this call. `best-effort`: collect failures, return aggregate `{ mounted, failed }`.
     */
    onFailure?: "throw" | "rollback" | "best-effort" | undefined;
    /**
     * - Mount concurrency. `1` (default) = serial. Higher values mount in parallel batches.
     */
    concurrency?: number | undefined;
};
export type MountResult = {
    packageName: string;
    /**
     * - Dot-notation path used at the time of mount.
     */
    mountPath: string;
    /**
     * - moduleID returned by api.add().
     */
    moduleID: string;
    discoverResult: DiscoverResult;
    /**
     * - Versioning descriptor when the module mounted under a `vMAJOR.<mountPath>` prefix (multi-version case from `#buildVersionConfigs`), otherwise `null`. `version` is the slothlet version tag (`vMAJOR`); `default` indicates whether this entry is the default for the unversioned dispatch path.
     */
    versionConfig: {
        version: string;
        default: boolean;
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