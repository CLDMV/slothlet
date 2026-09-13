/**
 * Summary result of an unregister operation.
 * @typedef {Object} UnregisterResult
 * @property {string[]} removed - API paths that were removed.
 * @property {Object[]} rolledBack - Entries that were rolled back to a previous owner.
 */
/**
 * Tracks which modules own which API paths for hot reload and rollback
 * @class OwnershipManager
 * @extends ComponentBase
 * @public
 */
export class OwnershipManager extends ComponentBase {
    static slothletProperty: string;
    /**
     * Create an OwnershipManager instance.
     * @param {object} slothlet - Slothlet class instance.
     */
    constructor(slothlet: object);
    moduleToPath: Map<any, any>;
    pathToModule: Map<any, any>;
    _unregisteredModules: Set<any>;
    moduleEndpoints: Map<any, any>;
    /**
     * Record a module's mount endpoint (the apiPath it was loaded/added at).
     * This is the module's ownership root — the subtree it is allowed to write
     * to via `self.X = …`. Base modules use `"."`.
     * @param {string} moduleID - Module identifier.
     * @param {string} endpoint - Mount endpoint (`"."` for base modules).
     * @returns {void}
     * @public
     */
    public setModuleEndpoint(moduleID: string, endpoint: string): void;
    /**
     * Look up a module's mount endpoint.
     * @param {string} moduleID - Module identifier.
     * @returns {string|undefined} The mount endpoint, or undefined if unknown.
     * @public
     */
    public getModuleEndpoint(moduleID: string): string | undefined;
    /**
     * Register module ownership of API path with its value
     * @param {Object} options - Registration options
     * @param {string} options.moduleID - Module identifier
     * @param {string} options.apiPath - API path being registered
     * @param {*} options.value - The actual function/object being registered
     * @param {string} [options.source="core"] - Source of registration
     * @param {string} [options.collisionMode="error"] - Collision mode: skip, warn, error, merge, replace
     * @param {Object} [options.config] - Config object for silent mode check
     * @param {string} [options.filePath=null] - File path of the module source (for metadata tracking)
     * @returns {Object|null} Registration entry or null if skipped
     * @public
     */
    public register({ moduleID, apiPath, value, source, collisionMode, config, filePath }: {
        moduleID: string;
        apiPath: string;
        value: any;
        source?: string | undefined;
        collisionMode?: string | undefined;
        config?: Object | undefined;
        filePath?: string | undefined;
    }): Object | null;
    /**
     * @param {string} moduleID - Module to unregister.
     * @returns {UnregisterResult} Removal summary.
     * @public
     *
     * @description
     * Removes all paths owned by the provided moduleID and reports removals and rollbacks.
     *
     * @example
     * const result = ownership.unregister("module-a");
     */
    public unregister(moduleID: string): UnregisterResult;
    /**
     * Block a moduleID from any further path registration without removing its current paths.
     *
     * @param {string} moduleID - Module to block from re-registration.
     * @returns {void}
     * @public
     *
     * @description
     * Sets the same async-race guard {@link OwnershipManager#unregister} sets, but standalone: the scoped
     * `remove(moduleID, apiPath)` path detaches nodes one at a time via {@link OwnershipManager#removePath}
     * and never calls `unregister`. Tearing down a lazy node materializes it, and that materialization can
     * register previously-unregistered descendants (a lazy submodule's leaves) AFTER the removal's target
     * list was computed — which, on a reload replay, leak back and resurrect the removed subtree. When a
     * scoped removal empties a module, call this BEFORE the walk so those late registrations are rejected
     * (register() returns null for a module in this set). Cleared on the next {@link OwnershipManager#clear}
     * (reload). Only for a full removal — a partial one keeps sibling paths that must still materialize.
     *
     * Because this is called only when the module is fully gone, it also drops its {@link OwnershipManager#moduleEndpoints}
     * entry — `removePath()` deletes the emptied `moduleToPath` set but not the endpoint, and `unregister()`
     * (the moduleID-only remove's analog) does delete it, so the scoped full-removal must too or a stale
     * endpoint leaks until the next reload.
     *
     * @example
     * ownership.markUnregistered("plugins-core");
     */
    public markUnregistered(moduleID: string): void;
    /**
     * Re-arm a moduleID for registration after a prior removal, for a deliberate new `api.add()`.
     * @param {string} moduleID - Module identifier about to be (re-)registered.
     * @returns {void}
     * @public
     *
     * @description
     * `register()`'s guard against `_unregisteredModules` (see its own doc comment) is meant to
     * reject a STALE, late-arriving registration from a removed module's own in-flight lazy
     * materialization — not to permanently block that moduleID from ever registering again. Without
     * this call, a deliberate `api.add()` reusing a moduleID that was previously removed had every
     * one of its registrations silently dropped (`register()` returns `null` unconditionally),
     * losing ownership tracking entirely for content that WAS actually assigned onto the live tree —
     * confirmed via a remove-then-re-add-same-moduleID repro (#372 review, suppressed finding on
     * ownership.mjs's merge-loss correction). Called at the very start of `addApiComponent()`, before
     * any registration for this build, so a genuinely new add's own registrations are never rejected;
     * a stale materialization from the module's PREVIOUS lifetime that fires after this point is a
     * separate, pre-existing race this call does not change the risk profile of.
     *
     * @example
     * ownership.clearUnregistered("plugins-core");
     */
    public clearUnregistered(moduleID: string): void;
    /**
     * @param {string} apiPath - API path to modify.
     * @param {string|null} [moduleID=null] - Module to remove (defaults to current owner).
     * @returns {{ action: "delete"|"none"|"restore", removedModuleId: string|null,
     * restoreModuleId: string|null }} Action taken for the path.
     * @public
     *
     * @description
     * Removes a module owner from a specific API path. If the current owner is removed and
     * previous owners exist, the path is restored to the previous owner.
     *
     * @example
     * const result = ownership.removePath("plugins.tools", "module-a");
     */
    public removePath(apiPath: string, moduleID?: string | null): {
        action: "delete" | "none" | "restore";
        removedModuleId: string | null;
        restoreModuleId: string | null;
    };
    /**
     * Get current owner of API path
     * @param {string} apiPath - API path to check
     * @returns {Object|null} Current owner entry or null
     * @public
     */
    public getCurrentOwner(apiPath: string): Object | null;
    /**
     * Get current value for API path
     * @param {string} apiPath - API path to check
     * @returns {*} Current value or undefined
     * @public
     */
    public getCurrentValue(apiPath: string): any;
    /**
     * Get all paths owned by module
     * @param {string} moduleID - Module to query
     * @returns {Array<string>} Array of API paths
     * @public
     */
    public getModulePaths(moduleID: string): Array<string>;
    /**
     * Get ownership history for path
     * @param {string} apiPath - API path to query
     * @returns {Array<Object>} Ownership history stack
     * @public
     */
    public getPathHistory(apiPath: string): Array<Object>;
    /**
     * Check if module owns path
     * @param {string} moduleID - Module to check
     * @param {string} apiPath - API path to check
     * @returns {boolean} True if module owns path
     * @public
     */
    public ownsPath(moduleID: string, apiPath: string): boolean;
    /**
     * Get diagnostic info about ownership
     * @returns {Object} Diagnostic information
     * @public
     */
    public getDiagnostics(): Object;
    /**
     * Get ownership info for a specific API path
     * @param {string} apiPath - API path to check
     * @returns {Set<string>|null} Set of moduleIDs that own this path, or null if path not found
     * @public
     */
    public getPathOwnership(apiPath: string): Set<string> | null;
    /**
     * Recursively register API subtree with ownership
     * @param {object} api - API object or subtree
     * @param {string} moduleID - Module identifier (owner)
     * @param {string} path - Current API path
     * @param {WeakSet} [visited] - Visited objects (prevents circular refs)
     * @returns {void}
     * @public
     *
     * @description
     * Registers entire API subtree structure with ownership manager.
     * Used during load, reload, and api.add to establish ownership relationships.
     *
     * @example
     * ownership.registerSubtree(api, "base_abc123", "");
     */
    public registerSubtree(api: object, moduleID: string, path: string, visited?: WeakSet<any>): void;
    /**
     * Snapshot the entries moduleID currently owns, keyed by apiPath, for later restoration
     * @param {string} moduleID - Module identifier to snapshot.
     * @returns {Map<string, {value: *, filePath: (string|null), source: string, isMergeLoss: boolean}>}
     *   One entry per apiPath the module currently owns, capturing exactly the fields a duplicate
     *   registration can overwrite.
     * @public
     *
     * @description
     * Call this BEFORE a candidate build's construction (buildAPI) runs, so a later revert can tell
     * a path moduleID genuinely already owned (whose entry must be restored, not deleted) from one
     * the candidate build's own speculative registration fabricated (which must be deleted outright).
     *
     * @example
     * const snapshot = ownership.snapshotModuleEntries("same-mod");
     */
    public snapshotModuleEntries(moduleID: string): Map<string, {
        value: any;
        filePath: (string | null);
        source: string;
        isMergeLoss: boolean;
    }>;
    /**
     * Restore a single entry's value/filePath/source/isMergeLoss, undoing a later registration's
     * overwrite without changing its position in the ownership stack
     * @param {string} moduleID - Module identifier.
     * @param {string} apiPath - API path whose entry to restore.
     * @param {{value: *, filePath: (string|null), source: string, isMergeLoss: boolean}} snapshot -
     *   Prior field values, from {@link OwnershipManager#snapshotModuleEntries}.
     * @returns {void}
     * @public
     *
     * @example
     * ownership.restoreEntry("same-mod", "thing", snapshot.get("thing"));
     */
    public restoreEntry(moduleID: string, apiPath: string, snapshot: {
        value: any;
        filePath: (string | null);
        source: string;
        isMergeLoss: boolean;
    }): void;
    /**
     * Snapshot exactly one (apiPath, moduleID) pair's current entry — the single-path analog of
     * {@link OwnershipManager#snapshotModuleEntries}, for an internal candidate's own revert.
     * @param {string} apiPath - Full api path the candidate is about to (re-)contribute to.
     * @param {string} moduleID - Module identifier making the contribution.
     * @returns {{value: *, filePath: (string|null), source: string, isMergeLoss: boolean}|undefined}
     *   The prior entry's snapshot, or `undefined` if none exists yet.
     * @public
     *
     * @description
     * `ModesProcessor`'s internal collision branches each construct a `UnifiedWrapper` (firing
     * `impl:created` unconditionally) BEFORE `assignToApiPath()`'s real, per-call-aware collision
     * decision is known. The generic `impl:created` subscriber (`src/slothlet.mjs`) reacts to that
     * same construction and registers ownership using the INSTANCE's configured default mode,
     * clamped to `"replace"`/`"merge-replace"` only (never `"skip"`/`"warn"`/`"error"`, exactly like
     * `ModesProcessor#resolveOwnershipCollisionMode` clamps its own authoritative registration) —
     * so that call always succeeds, regardless of what the real per-call mode later turns out to
     * be. A `skip`/`warn`-rejected (or thrown) internal candidate therefore leaves a real,
     * unrevertable ownership entry behind unless the caller snapshots-before/restores-or-drops-after
     * around its own construction+assignment attempt (#372/#373 review, suppressed finding).
     *
     * @example
     * const priorEntry = ownership.snapshotPathEntry("thing.initialize", moduleID);
     * // ...wrapper construction + assignToApiPath() run...
     * if (!assigned) {
     *   if (priorEntry) ownership.restoreEntry(moduleID, "thing.initialize", priorEntry);
     *   else ownership.removePath("thing.initialize", moduleID);
     * }
     */
    public snapshotPathEntry(apiPath: string, moduleID: string): {
        value: any;
        filePath: (string | null);
        source: string;
        isMergeLoss: boolean;
    } | undefined;
    /**
     * Revert a speculative API subtree's ownership registrations
     * @param {object} api - API object or subtree (same shape registerSubtree() would have walked)
     * @param {string} moduleID - Module identifier whose speculative registrations to revert
     * @param {string} path - Current API path
     * @param {Map<string, {value: *, filePath: (string|null), source: string}>} priorEntries -
     *   Snapshot from {@link OwnershipManager#snapshotModuleEntries}, taken before the candidate
     *   build ran, of what moduleID already legitimately owned.
     * @param {WeakSet} [visited] - Visited objects (prevents circular refs)
     * @returns {void}
     * @public
     *
     * @description
     * Mirrors registerSubtree()'s traversal. A candidate build's wrapper construction fires
     * impl:created before the caller's own collision decision runs (buildAPI's apiPathPrefix
     * already targets the final mount path), so the framework's generic impl:created subscriber
     * (slothlet.mjs) auto-registers ownership for it — clamped to "merge" so it never throws —
     * even when that build is a hot-reload api.add() candidate still pending its own
     * setValueAtPath check. When that check then rejects the assignment under skip/warn, the live
     * api tree is untouched but the speculative registration is not (#366 review). At each level:
     * if `priorEntries` has this exact path, moduleID already owned it before this build — restore
     * its value/filePath/source (register()'s duplicate-entry path overwrote them unconditionally,
     * even for what turned out to be a rejected candidate), rather than deleting a genuine,
     * pre-existing registration. Otherwise the path is purely speculative — remove it outright.
     *
     * @example
     * const priorEntries = ownership.snapshotModuleEntries("same-mod");
     * // ...buildAPI runs, candidate is rejected...
     * ownership.revertSpeculativeSubtree(apiToMerge, "same-mod", "thing", priorEntries);
     */
    public revertSpeculativeSubtree(api: object, moduleID: string, path: string, priorEntries: Map<string, {
        value: any;
        filePath: (string | null);
        source: string;
    }>, visited?: WeakSet<any>): void;
    /**
     * Revert every speculative registration currently on record for a module, driven by the
     * module's own current ownership state rather than a candidate api-tree reference
     * @param {string} moduleID - Module identifier whose speculative state to revert.
     * @param {Map<string, {value: *, filePath: (string|null), source: string, isMergeLoss: boolean}>} priorEntries -
     *   Snapshot from {@link OwnershipManager#snapshotModuleEntries}, taken before the candidate
     *   build ran.
     * @returns {void}
     * @public
     *
     * @description
     * {@link OwnershipManager#revertSpeculativeSubtree} needs a concrete api-tree value to walk —
     * fine when the caller has one (a rejected `skip`/`warn` candidate whose `apiToMerge` was still
     * built successfully). It has nothing to walk when `buildAPI()` or `setValueAtPath()` itself
     * THROWS (a genuine `collisionMode: "error"` collision, or any other failure) partway through —
     * the candidate's speculative registrations still exist (whatever fired `impl:created` before
     * the throw), but there may be no valid `newApi`/`apiToMerge` reference left to walk. This reads
     * `moduleToPath.get(moduleID)` directly instead: whatever paths this moduleID currently owns,
     * restore the ones already present in `priorEntries` and delete the rest — the same outcome as
     * `revertSpeculativeSubtree`, without needing the tree shape at all (#372 review).
     *
     * @example
     * const priorEntries = ownership.snapshotModuleEntries("same-mod");
     * try {
     *   // ...buildAPI/setValueAtPath run and throw...
     * } catch (err) {
     *   ownership.revertSpeculativeState("same-mod", priorEntries);
     *   throw err;
     * }
     */
    public revertSpeculativeState(moduleID: string, priorEntries: Map<string, {
        value: any;
        filePath: (string | null);
        source: string;
        isMergeLoss: boolean;
    }>): void;
    /**
     * Clear all ownership data
     * @public
     */
    public clear(): void;
    /**
     * Export ownership state for preservation during reload
     * @returns {Object} Serializable ownership state
     * @public
     */
    public exportState(): Object;
    /**
     * Import ownership state from exported data
     * @param {Object} state - Previously exported state
     * @public
     */
    public importState(state: Object): void;
    #private;
}
/**
 * Summary result of an unregister operation.
 */
export type UnregisterResult = {
    /**
     * - API paths that were removed.
     */
    removed: string[];
    /**
     * - Entries that were rolled back to a previous owner.
     */
    rolledBack: Object[];
};
import { ComponentBase } from "#factories/component-base";
//# sourceMappingURL=ownership.d.mts.map