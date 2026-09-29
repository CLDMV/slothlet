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
    placementModes: Map<any, any>;
    exportIndex: Map<any, any>;
    cloneSources: WeakMap<object, any>;
    /**
     * Index where each value of a freshly loaded module sits in that module's namespace (#484).
     * @param {string} filePath - Absolute path of the loaded file.
     * @param {object} mod - The module namespace as loaded (`import()` result, or the CJS loader's
     *   `{ default: module.exports, ...ownKeys }` namespace).
     * @returns {void}
     * @public
     *
     * @description
     * Wrappers built from this file later look their impl up here to learn their `exportPath` — the
     * access path within the namespace that produced the value (`["add"]`, `["default"]`,
     * `["default", "member"]`). A named export wins over the same value reached through `default`.
     * For a CommonJS module every path is rooted at `["default"]` (`module.exports`), since the
     * named keys a CommonJS namespace carries are copies of `module.exports`' own keys.
     *
     * @example
     * ownership.indexModuleExports("/abs/api/math.mjs", await import("/abs/api/math.mjs"));
     */
    public indexModuleExports(filePath: string, mod: object): void;
    /**
     * Whether `filePath` was loaded as a CommonJS module (its exports are `module.exports`) (#484).
     * @param {string} filePath - Absolute path of a loaded file.
     * @returns {boolean} True for a CommonJS module; false for ES modules and files never indexed.
     * @public
     *
     * @example
     * ownership.isCommonJSModule("/abs/api/text.cjs"); // true
     */
    public isCommonJSModule(filePath: string): boolean;
    /**
     * Record the per-key origins of a value composed from a module's exports (#484).
     * @param {string} filePath - Absolute path of the file the content was built from.
     * @param {object|Function} content - The composed content (a fresh namespace object, or a default
     *   export the named exports were attached onto).
     * @param {Object<string, string[]>|null} members - Composed key → the exportPath it came from.
     * @param {string[]|null} [self=null] - The content's own exportPath, when it is itself an export.
     * @returns {void}
     * @public
     *
     * @description
     * Flattening merges a module's default and named exports into one content value, so a key's
     * position under that content no longer tells where it came from. Recording the map lets a
     * wrapper built from the content hand each child — including a primitive child, which has no
     * identity to look up — its real exportPath.
     *
     * @example
     * ownership.recordComposedContent(file, content, { add: ["add"], VERSION: ["VERSION"] });
     */
    public recordComposedContent(filePath: string, content: object | Function, members: {
        [x: string]: string[];
    } | null, self?: string[] | null): void;
    /**
     * Remember that `clone` was cloned from `original`, so an origin lookup sees through the clone.
     * @param {*} clone - The clone.
     * @param {*} original - The value it was cloned from.
     * @returns {void}
     * @public
     *
     * @example
     * ownership.noteClone(copy, exported);
     */
    public noteClone(clone: any, original: any): void;
    /**
     * Look up where `value` sits in the module namespace of `filePath` (#484).
     * @param {string|null} filePath - File the value was loaded from.
     * @param {*} value - The value (or an eager-mode clone of it).
     * @returns {string[]|null} The exportPath, or `null` when the value is not a known export of that file.
     * @public
     *
     * @example
     * ownership.resolveExportPath("/abs/api/math.mjs", addFn); // ["add"]
     */
    public resolveExportPath(filePath: string | null, value: any): string[] | null;
    /**
     * Look up an export of `filePath` by the NAME it was placed under, confirmed by value (#484).
     * @param {string|null} filePath - File the value was loaded from.
     * @param {string} key - The key the value sits under in the composed api.
     * @param {*} value - The value itself; must be the value that export held (`Object.is`).
     * @returns {string[]|null} The exportPath, or `null` when `filePath` has no export of that name
     *   holding that value.
     * @public
     *
     * @description
     * For a value with no identity to look up — a primitive — merged into a namespace that several
     * files compose (a folder whose files flatten into it), where no per-key map was recorded for the
     * namespace itself. The value check keeps a same-named but different value from borrowing the path.
     *
     * @example
     * ownership.resolveExportPathByKey("/abs/api/tuning/tuning.mjs", "TUNE_STEP", 5); // ["TUNE_STEP"]
     */
    public resolveExportPathByKey(filePath: string | null, key: string, value: any): string[] | null;
    /**
     * Look up the per-key origins recorded for a composed content value (#484).
     * @param {string|null} filePath - File the content was built from.
     * @param {*} value - The content (or an eager-mode clone of it).
     * @returns {Object<string, string[]>|null} Composed key → exportPath, or `null`.
     * @public
     *
     * @example
     * ownership.resolveMemberExportPaths(file, content); // { add: ["add"] }
     */
    public resolveMemberExportPaths(filePath: string | null, value: any): {
        [x: string]: string[];
    } | null;
    /**
     * Read where the value currently at `apiPath` came from (#484).
     * @param {string} apiPath - API path to look up.
     * @returns {{moduleID: string, filePath: (string|null), exportPath: (string[]|null), members: (Object<string, string[]>|null)}|null}
     *   The current owner's origin, or `null` when nothing owns the path.
     * @public
     *
     * @description
     * `exportPath` is the access path within `filePath`'s module namespace that produced the value;
     * `null` when the value has no module origin (a runtime `self.X = value`, a synthetic in-memory
     * `api.add()`, a namespace container slothlet created). `members` carries per-key origins for a
     * value composed from several exports.
     *
     * @example
     * ownership.getOrigin("math.add"); // { moduleID, filePath: "/abs/api/math.mjs", exportPath: ["add"], members: null }
     */
    public getOrigin(apiPath: string): {
        moduleID: string;
        filePath: (string | null);
        exportPath: (string[] | null);
        members: ({
            [x: string]: string[];
        } | null);
    } | null;
    /**
     * Refresh the origin recorded for a module's entry at `apiPath` without touching its position,
     * source, or collision state — for a wrapper whose impl arrived after it was registered (lazy
     * materialization, hot reload).
     * @param {string} moduleID - Module whose entry to refresh.
     * @param {string} apiPath - API path of the entry.
     * @param {{filePath?: (string|null), exportPath?: (string[]|null), memberExportPaths?: (Object|null)}} origin - New origin.
     * @returns {void}
     * @public
     *
     * @example
     * ownership.refreshOrigin("base", "math.add", { filePath, exportPath: ["add"] });
     */
    public refreshOrigin(moduleID: string, apiPath: string, origin: {
        filePath?: (string | null);
        exportPath?: (string[] | null);
        memberExportPaths?: (Object | null);
    }): void;
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
     * Record the collision mode an `api.add()` places a module's content under at `endpoint` (#524).
     * @param {string} moduleID - Module identifier.
     * @param {string} endpoint - The add's mount path (`""` for a root-level add).
     * @param {string|null} collisionMode - The add's resolved collision mode. Only `"replace"` and
     *   `"merge-replace"` are recorded; any other value (or `null`) clears the endpoint's record.
     * @returns {string|null} The mode previously recorded for this endpoint, for a caller to restore
     *   with a second call when the add is abandoned.
     * @public
     *
     * @description
     * Under `"replace"`/`"merge-replace"` (`forceOverwrite` included) the incoming module's content is
     * what goes live at every path it provides. The registrations made while that content is built and
     * materialized — wrapper construction, lazy materialization, impl reassignment — come through the
     * generic `impl:created`/`impl:changed` subscribers, which otherwise only know the instance's default
     * collision mode and would record the incoming module as a merge loser wherever another module's
     * function already sits. {@link OwnershipManager#getPlacementMode} lets them register with the mode
     * that actually decided placement instead, including for a lazy leaf that materializes after the
     * add has returned.
     *
     * @example
     * const previous = ownership.setPlacementMode("shadow", "launcher.session", "replace");
     */
    public setPlacementMode(moduleID: string, endpoint: string, collisionMode: string | null): string | null;
    /**
     * Look up the collision mode a module's content at `apiPath` was placed under (#524).
     * @param {string} moduleID - Module identifier.
     * @param {string} apiPath - API path being registered.
     * @returns {string|null} `"replace"` or `"merge-replace"` when `apiPath` lies at or below an endpoint
     *   the module was added at under that mode (the deepest such endpoint wins); otherwise `null`.
     * @public
     *
     * @example
     * ownership.getPlacementMode("shadow", "launcher.session.store.create"); // "replace"
     */
    public getPlacementMode(moduleID: string, apiPath: string): string | null;
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
     * @param {string[]|null} [options.exportPath=null] - Access path within `filePath`'s module namespace
     *   that produced `value` (`["add"]`, `["default"]`, `["default", "member"]`); `null` when the value
     *   has no module origin (#484).
     * @param {Object<string, string[]>|null} [options.memberExportPaths=null] - Per-key exportPaths for a
     *   value composed from several exports (#484).
     * @returns {Object|null} Registration entry or null if skipped
     * @public
     */
    public register({ moduleID, apiPath, value, source, collisionMode, config, filePath, exportPath, memberExportPaths }: {
        moduleID: string;
        apiPath: string;
        value: any;
        source?: string | undefined;
        collisionMode?: string | undefined;
        config?: Object | undefined;
        filePath?: string | undefined;
        exportPath?: string[] | null | undefined;
        memberExportPaths?: {
            [x: string]: string[];
        } | null | undefined;
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
     * @param {object} [options] - Walk options.
     * @param {string} [options.collisionMode="merge"] - The collision mode the subtree was placed on the
     *   live api under. `"replace"`/`"merge-replace"` make `moduleID` the current owner of every path the
     *   walk reaches (#524); any other value only confirms the paths without changing their order.
     * @param {WeakSet} [options.visited] - Visited objects (prevents circular refs)
     * @returns {void}
     * @public
     *
     * @description
     * Registers entire API subtree structure with ownership manager.
     * Used during load, reload, and api.add to establish ownership relationships.
     *
     * Under `"replace"`/`"merge-replace"` the subtree's content is what is live at each of its paths, so the
     * walk also claims them: the module's entry is un-flagged as a merge loss and moved to the top of the
     * path's stack. That overrides registrations made while the add was in progress that do not reflect the
     * placement — in lazy mode the replaced module's wrappers are materialized during the collision and
     * register after the incoming module's own construction-time entries.
     *
     * @example
     * ownership.registerSubtree(api, "base_abc123", "");
     *
     * @example
     * ownership.registerSubtree(apiToMerge, "shadow", "launcher.session", { collisionMode: "replace" });
     */
    public registerSubtree(api: object, moduleID: string, path: string, { collisionMode, visited }?: {
        collisionMode?: string | undefined;
        visited?: WeakSet<any> | undefined;
    }): void;
    /**
     * Snapshot the entries moduleID currently owns, keyed by apiPath, for later restoration
     * @param {string} moduleID - Module identifier to snapshot.
     * @returns {Map<string, {value: *, filePath: (string|null), exportPath: (string[]|null), memberExportPaths: (Object|null), source: string, isMergeLoss: boolean}>}
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
        exportPath: (string[] | null);
        memberExportPaths: (Object | null);
        source: string;
        isMergeLoss: boolean;
    }>;
    /**
     * Restore a single entry's value/filePath/source/isMergeLoss, undoing a later registration's
     * overwrite without changing its position in the ownership stack
     * @param {string} moduleID - Module identifier.
     * @param {string} apiPath - API path whose entry to restore.
     * @param {{value: *, filePath: (string|null), exportPath?: (string[]|null), memberExportPaths?: (Object|null), source: string, isMergeLoss: boolean}} snapshot -
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
        exportPath?: (string[] | null);
        memberExportPaths?: (Object | null);
        source: string;
        isMergeLoss: boolean;
    }): void;
    /**
     * Snapshot exactly one (apiPath, moduleID) pair's current entry — the single-path analog of
     * {@link OwnershipManager#snapshotModuleEntries}, for an internal candidate's own revert.
     * @param {string} apiPath - Full api path the candidate is about to (re-)contribute to.
     * @param {string} moduleID - Module identifier making the contribution.
     * @returns {{value: *, filePath: (string|null), exportPath: (string[]|null), memberExportPaths: (Object|null), source: string, isMergeLoss: boolean}|undefined}
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
        exportPath: (string[] | null);
        memberExportPaths: (Object | null);
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