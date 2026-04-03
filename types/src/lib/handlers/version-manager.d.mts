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
     * @returns {void}
     * @example
     * versionManager.registerVersion("auth", "v1", "auth_abc", { stable: true }, true);
     */
    registerVersion(logicalPath: string, versionTag: string, moduleID: string, versionMeta: object, isDefault: boolean): void;
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
     * Retrieve the VersionManager-only metadata object stored for a module ID.
     *
     * @param {string} moduleID - Module ID.
     * @returns {object | undefined} Stored version metadata or `undefined`.
     * @example
     * versionManager.getVersionMetadata("auth_abc123"); // { version: "v1", logicalPath: "auth", stable: true }
     */
    getVersionMetadata(moduleID: string): object | undefined;
    /**
     * Return a snapshot of all registered versions and the default tag for a logical path.
     *
     * @param {string} logicalPath - Logical API path.
     * @returns {{ versions: object, default: string | null }} Snapshot object.
     * @example
     * versionManager.list("auth"); // { versions: { v1: {...}, v2: {...} }, default: "v2" }
     */
    list(logicalPath: string): {
        versions: object;
        default: string | null;
    };
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
     * `caller.versionMetadata`. When it is a function, calls it with `(allVersions, caller)`.
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
     * Build the `allVersions` argument passed to function discriminators.
     *
     * Each key is a version tag; each value contains `version`, `default`, `metadata`
     * (regular Metadata system data), and `versionMetadata` (VersionManager-only store).
     *
     * @param {string} logicalPath - Logical API path.
     * @returns {object} Map-like object keyed by version tag.
     * @example
     * versionManager.buildAllVersionsArg("auth");
     * // { v1: { version: "v1", default: true, metadata: {...}, versionMetadata: {...} } }
     */
    buildAllVersionsArg(logicalPath: string): object;
    /**
     * Build the `caller` argument passed to function discriminators.
     *
     * Returns `null` for version-specific fields when the caller is not a registered
     * versioned module.
     *
     * @param {object | null | undefined} callerWrapper - The caller's UnifiedWrapper proxy.
     * @returns {{ version: string|null, default: boolean|null, metadata: object, versionMetadata: object|null }}
     * @example
     * versionManager.buildCallerArg(callerWrapper);
     * // { version: "v2", default: false, metadata: {...}, versionMetadata: {...} }
     */
    buildCallerArg(callerWrapper: object | null | undefined): {
        version: string | null;
        default: boolean | null;
        metadata: object;
        versionMetadata: object | null;
    };
    /**
     * Create a native Proxy that dispatches property accesses to the correct versioned path.
     *
     * The dispatcher handles all property categories defined in the spec (framework
     * internal keys, stable framework accessors, `then`, symbols, routing, etc.).
     *
     * @param {string} logicalPath - Logical API path this dispatcher covers.
     * @returns {Proxy} A frozen-target Proxy for version-dispatched property access.
     * @example
     * const proxy = versionManager.createDispatcher("auth");
     * proxy.login; // resolves version then returns api.v2.auth.login
     */
    createDispatcher(logicalPath: string): ProxyConstructor;
    /**
     * Rebuild (or create) the dispatcher proxy for a logical path and mount it
     * on both `api` and `boundApi`.
     *
     * @param {string} logicalPath - Logical API path.
     * @returns {void}
     * @example
     * versionManager.updateDispatcher("auth");
     */
    updateDispatcher(logicalPath: string): void;
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
     * @returns {void}
     * @example
     * versionManager.onVersionedModuleReload("auth_abc");
     */
    onVersionedModuleReload(moduleID: string): void;
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
import { ComponentBase } from "@cldmv/slothlet/factories/component-base";
//# sourceMappingURL=version-manager.d.mts.map