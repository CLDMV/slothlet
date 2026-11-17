/**
 * Manages versioned API paths and their dispatcher proxies.
 *
 * Allows the same logical API path (e.g. `auth`) to be registered under multiple
 * version tags (e.g. `v1`, `v2`). A dispatcher proxy lives at the logical path and
 * routes property accesses to the correct versioned namespace at call time.
 *
 * @class VersionManager
 * @extends ComponentBase
 * @package
 */
export class VersionManager extends ComponentBase {
    static slothletProperty: string;
    /**
     * Register a new version for a logical path and rebuild the dispatcher.
     *
     * @param {string} logicalPath - Logical API path (e.g. `"auth"`).
     * @param {string} versionTag - Version tag (e.g. `"v1"`).
     * @param {string} moduleID - Module ID of the mounted versioned module.
     * @param {object} versionMeta - User-supplied version metadata (stored in VersionManager only).
     * @param {boolean} isDefault - Whether this version should be the explicit default.
     * @returns {Promise<void>|void} Settles once a new dispatcher is mounted; nothing when the path has one.
     * @example
     * await versionManager.registerVersion("auth", "v1", "auth_abc", { stable: true }, true);
     */
    registerVersion(logicalPath: string, versionTag: string, moduleID: string, versionMeta: object, isDefault: boolean): Promise<void> | void;
    /**
     * Unregister a version for a logical path.
     * Rebuilds or tears down the dispatcher accordingly.
     *
     * @param {string} logicalPath - Logical API path.
     * @param {string} versionTag - Version tag to remove.
     * @returns {boolean} `true` when the version was found and removed.
     * @example
     * versionManager.unregisterVersion("auth", "v2");
     */
    unregisterVersion(logicalPath: string, versionTag: string): boolean;
    /**
     * Get the version key (logicalPath + versionTag) for a given module ID.
     * Used as a reverse lookup during remove operations.
     *
     * @param {string} moduleID - Module ID.
     * @returns {{ logicalPath: string, versionTag: string } | undefined}
     * @example
     * versionManager.getVersionKeyForModule("auth_abc123"); // { logicalPath: "auth", versionTag: "v1" }
     */
    getVersionKeyForModule(moduleID: string): {
        logicalPath: string;
        versionTag: string;
    } | undefined;
    /**
     * Returns `true` when a live dispatcher proxy is tracked for the given logical path.
     * Used by ApiManager to detect whether a removed path was a logical dispatcher.
     *
     * @param {string} logicalPath - Logical API path (e.g. `"auth"`).
     * @returns {boolean}
     * @example
     * versionManager.hasDispatcher("auth"); // true
     */
    hasDispatcher(logicalPath: string): boolean;
    /**
     * Retrieve the VersionManager-only metadata object stored for a module ID.
     * Used internally by `buildAllVersionsArg` and `buildCallerArg`.
     *
     * @param {string} moduleID - Opaque module ID.
     * @returns {object | undefined} Stored version metadata or `undefined`.
     * @example
     * versionManager.getVersionMetadata("auth_abc123"); // { version: "v1", logicalPath: "auth", stable: true }
     */
    getVersionMetadata(moduleID: string): object | undefined;
    /**
     * Retrieve the VersionManager-only metadata for a logical path and version tag.
     *
     * @param {string} logicalPath - Logical API path (e.g. `"auth"`).
     * @param {string} versionTag - Version tag (e.g. `"v1"`, `"2.3.0"`).
     * @returns {object | undefined} Stored version metadata or `undefined` if not registered.
     * @example
     * versionManager.getVersionMetadataByPath("auth", "v1"); // { version: "v1", logicalPath: "auth", stable: true }
     */
    getVersionMetadataByPath(logicalPath: string, versionTag: string): object | undefined;
    /**
     * Patch (merge) the VersionManager-only metadata for a registered logical path and version tag at runtime.
     * The injected `version` and `logicalPath` keys always win over any user-supplied fields in `patch`.
     *
     * @param {string} logicalPath - Logical API path (e.g. `"auth"`).
     * @param {string} versionTag - Version tag (e.g. `"v1"`, `"2.3.0"`).
     * @param {object} patch - Plain object of keys to merge into the stored version metadata.
     * @returns {void}
     * @throws {SlothletError} When the logical path or version tag is not registered.
     * @example
     * versionManager.setVersionMetadataByPath("auth", "v1", { stable: true });
     */
    setVersionMetadataByPath(logicalPath: string, versionTag: string, patch: object): void;
    /**
     * Find the registered logical path that covers a dotted api pattern.
     *
     * @param {string} path - Dotted api path or hook pattern (e.g. "auth.login").
     * @returns {string | null} The longest registered logical path that is a segment-prefix of
     *   `path`, or `null` when no registered version covers it.
     * @public
     * @example
     * versionManager.findLogicalPathFor("auth.login"); // "auth"
     */
    public findLogicalPathFor(path: string): string | null;
    /**
     * Return a snapshot of all registered versions and the default tag for a logical path.
     *
     * @param {string} logicalPath - Logical API path.
     * @returns {{ versions: object, default: string | null } | undefined} Snapshot object, or `undefined` if the path is not registered.
     * @example
     * versionManager.list("auth"); // { versions: { v1: {...}, v2: {...} }, default: "v2" }
     * versionManager.list("unknown"); // undefined
     */
    list(logicalPath: string): {
        versions: object;
        default: string | null;
    } | undefined;
    /**
     * Explicitly override the default version for a logical path at runtime.
     * Clears any previous explicit defaults and marks only the specified tag.
     *
     * @param {string} logicalPath - Logical API path.
     * @param {string} versionTag - Version tag to set as default.
     * @returns {void}
     * @throws {SlothletError} When the version tag is not registered for the path.
     * @example
     * versionManager.setDefault("auth", "v1");
     */
    setDefault(logicalPath: string, versionTag: string): void;
    /**
     * Determine the default version tag for a logical path.
     *
     * Algorithm:
     * 1. Return the first version entry with `isDefault === true`.
     * 2. Otherwise, normalise all tags, sort descending, return highest.
     * 3. Return `null` when no versions are registered.
     *
     * @param {string} logicalPath - Logical API path.
     * @returns {string | null} The default version tag, or `null`.
     * @example
     * // Given: ["v1", "v3", "v8", "v2"]
     * versionManager.getDefaultVersion("auth"); // "v8"
     */
    getDefaultVersion(logicalPath: string): string | null;
    /**
     * Run the configured discriminator and return the winning version tag.
     *
     * When the configured `versionDispatcher` is a string, reads that key from
     * `caller.version.metadata`. When it is a function, calls it with `(allVersions, caller)`.
     *
     * @param {string} logicalPath - Logical API path.
     * @param {object} allVersions - Pre-built allVersions arg (see `buildAllVersionsArg`).
     * @param {object} caller - Pre-built caller arg (see `buildCallerArg`).
     * @returns {string | null} Resolved version tag, or `null` to fall through to default.
     * @example
     * const tag = versionManager.resolveForPath("auth", allVersions, caller); // "v2"
     */
    resolveForPath(logicalPath: string, allVersions: object, caller: object): string | null;
    /**
     * Build the `versions` argument passed to function dispatchers.
     *
     * Keyed by version tag. Each entry carries the version's user `metadata` (what `metadata.get` reads for its path)
     * and its `version` record (`{ tag, default, metadata }`, the shape of the add option `version`; its `metadata` is
     * the version-manager store).
     *
     * @param {string} logicalPath - Logical API path.
     * @returns {object} Object keyed by version tag.
     * @example
     * versionManager.buildAllVersionsArg("auth");
     * // { v1: { metadata: {...}, version: { tag: "v1", default: true, metadata: {...} } } }
     */
    buildAllVersionsArg(logicalPath: string): object;
    /**
     * Build the `caller` object handed to dispatchers, around hooks and permission records.
     *
     * `{ path, module, metadata, version }`: the calling leaf's api path as segments, its module id, its user metadata,
     * and its `version` record (`{ tag, default, metadata }`) when the calling module is a registered version, else
     * null. Null for a call from outside the api (no module caller).
     *
     * @param {object | null | undefined} callerWrapper - The caller's UnifiedWrapper (or its proxy).
     * @returns {{ path: string[], module: string|null, metadata: object, version: { tag: string, default: boolean, metadata: object }|null }|null}
     * @example
     * versionManager.buildCallerArg(callerWrapper);
     * // { path: ["v2", "auth", "login"], module: "auth-v2", metadata: {...}, version: { tag: "v2", default: false, metadata: {...} } }
     */
    buildCallerArg(callerWrapper: object | null | undefined): {
        path: string[];
        module: string | null;
        metadata: object;
        version: {
            tag: string;
            default: boolean;
            metadata: object;
        } | null;
    } | null;
    /**
     * Split a dotted api path into its segments, keeping a registered version's tag whole (`"2.3.0.auth.login"` →
     * `["2.3.0", "auth", "login"]`).
     *
     * @param {string} apiPath - Dotted api path.
     * @returns {string[]} Its segments.
     * @package
     * @example
     * versionManager.pathSegments("2.3.0.auth"); // ["2.3.0", "auth"]
     */
    pathSegments(apiPath: string): string[];
    /**
     * What a version dispatcher stands for, when `value` is one: its logical path and how it resolves for the caller.
     * @param {*} value - Any value (a node's impl).
     * @returns {{ logicalPath: string, resolve: () => (object|null) }|null} The dispatcher's record, or null.
     * @package
     * @example
     * versionManager.dispatcherOf(wrapper.____slothletInternal.impl)?.logicalPath; // "auth"
     */
    dispatcherOf(value: any): {
        logicalPath: string;
        resolve: () => (object | null);
    } | null;
    /**
     * Create a native Proxy that dispatches property accesses to the correct versioned path.
     *
     * The dispatcher handles all property categories defined in the spec (framework
     * internal keys, stable framework accessors, `then`, symbols, routing, etc.).
     *
     * @param {string} logicalPath - Logical API path this dispatcher covers.
     * @returns {object} A Proxy instance for version-dispatched property access. The returned
     *   value is a Proxy wrapping a frozen plain-object target; it is NOT the Proxy constructor.
     * @example
     * const proxy = versionManager.createDispatcher("auth");
     * proxy.login; // resolves version then returns api.v2.auth.login
     */
    createDispatcher(logicalPath: string): object;
    /**
     * Rebuild (or create) the dispatcher proxy for a logical path and mount it
     * on both `api` and `boundApi`.
     *
     * @param {string} logicalPath - Logical API path.
     * @returns {Promise<void>|void} Settles once a new dispatcher is mounted; nothing when the path has one.
     * @example
     * await versionManager.updateDispatcher("auth");
     */
    updateDispatcher(logicalPath: string): Promise<void> | void;
    /**
     * Tear down the dispatcher for a logical path, removing it from the API tree.
     *
     * @param {string} logicalPath - Logical API path.
     * @returns {void}
     * @example
     * versionManager.teardownDispatcher("auth");
     */
    teardownDispatcher(logicalPath: string): void;
    /**
     * Called after a versioned module is reloaded.
     * Refreshes internal metadata and rebuilds the dispatcher for the affected path.
     *
     * @param {string} moduleID - Module ID that was reloaded.
     * @returns {Promise<void>|void} Settles once a dispatcher it had to mount is mounted.
     * @example
     * await versionManager.onVersionedModuleReload("auth_abc");
     */
    onVersionedModuleReload(moduleID: string): Promise<void> | void;
    /**
     * Clear all internal state.
     * Called automatically by the shutdown sequence.
     *
     * @returns {void}
     * @example
     * versionManager.shutdown();
     */
    shutdown(): void;
    #private;
}
import { ComponentBase } from "#factories/component-base";
//# sourceMappingURL=version-manager.d.mts.map