/**
 *	@Project: @cldmv/slothlet
 *	@Filename: /src/lib/handlers/ownership.mjs
 *	@Date: 2026-01-20 20:25:54 -08:00 (1737432354)
 *	@Author: Nate Corcoran <CLDMV>
 *	@Email: <Shinrai@users.noreply.github.com>
 *	-----
 *	@Last modified by: Shinrai <CLDMV> (Shinrai@users.noreply.github.com)
 *	@Last modified time: 2026-09-10 06:04:14 -07:00 (1789045454)
 *	-----
 *	@Copyright: Copyright (c) 2013-2026 Catalyzed Motivation Inc. All rights reserved.
 */

/**
 * @fileoverview Centralized ownership tracking for hot reload
 * @module @cldmv/slothlet/ownership
 * @internal
 */
import { ComponentBase } from "#factories/component-base";
import { resolveWrapper } from "#handlers/unified-wrapper";

/**
 * `register()`'s `source` value for a post-hoc "confirm this moduleID still owns this subtree"
 * re-touch (registerSubtree()'s own recursive walk) — as opposed to a genuine, freshly-evaluated
 * collision-mode decision. Never influences `isMergeLoss` (#372): the confirming call's
 * `collisionMode` is a fixed, context-free label, not a real outcome, so it must never override
 * an already-correctly-decided entry's position just because it happens to run after the real,
 * authoritative registration.
 * @type {string}
 */
const REGISTRATION_SOURCE_CONFIRM = "subtree-confirm";

/**
 * `register()`'s `source` value for the one call site that genuinely evaluates a fresh,
 * per-call-aware collision decision (`ModesProcessor`, `src/lib/builders/modes-processor.mjs`) —
 * the only source a DUPLICATE registration's `isMergeLoss` correction may trust (#372).
 *
 * Every other source that can reach the duplicate branch is unreliable there, even though it's
 * perfectly fine for a FRESH (non-duplicate) registration:
 * - The generic `impl:created`/`impl:changed` subscriber (slothlet.mjs) registers with the
 *   instance's DEFAULT collision mode, not knowing a specific call's real, resolved mode. Its
 *   FIRST touch of a genuinely new (moduleID, apiPath) pair is a correct, standalone
 *   `isMergeLoss` computation (there is nothing yet to "correct") — but a SECOND, duplicate
 *   touch of that pair is not a new decision, just a re-fire (the same event fires twice per
 *   wrapper construction) or a side effect of an unrelated module's merge composition
 *   re-touching this module's already-decided wrapper. Trusting it there previously flipped an
 *   already-correct "replace" winner into a false merge-loss the moment ANY other module shared
 *   its path (an auth1/auth2 routines regression this exact scenario produced).
 * - `registerSubtree()`'s own confirming re-touch (`REGISTRATION_SOURCE_CONFIRM`) never carried a
 *   real decision to begin with.
 * @type {string}
 */
const REGISTRATION_SOURCE_AUTHORITATIVE = "core";

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
	static slothletProperty = "ownership";

	/**
	 * Create an OwnershipManager instance.
	 * @param {object} slothlet - Slothlet class instance.
	 */
	constructor(slothlet) {
		super(slothlet);
		this.moduleToPath = new Map(); // moduleID → Set<apiPath>
		this.pathToModule = new Map(); // apiPath → Array<{moduleID, source, timestamp, value}>
		this._unregisteredModules = new Set(); // moduleIDs that have been explicitly unregistered
		this.moduleEndpoints = new Map(); // moduleID → mount endpoint (e.g. ".", "lib.config")
	}

	/**
	 * Record a module's mount endpoint (the apiPath it was loaded/added at).
	 * This is the module's ownership root — the subtree it is allowed to write
	 * to via `self.X = …`. Base modules use `"."`.
	 * @param {string} moduleID - Module identifier.
	 * @param {string} endpoint - Mount endpoint (`"."` for base modules).
	 * @returns {void}
	 * @public
	 */
	setModuleEndpoint(moduleID, endpoint) {
		// Callers (addApiComponent, base load) always pass a real string moduleID;
		// the type guard is defensive against a malformed/absent ID.
		/* v8 ignore next */
		if (typeof moduleID === "string" && moduleID) {
			this.moduleEndpoints.set(moduleID, endpoint);
		}
	}

	/**
	 * Look up a module's mount endpoint.
	 * @param {string} moduleID - Module identifier.
	 * @returns {string|undefined} The mount endpoint, or undefined if unknown.
	 * @public
	 */
	getModuleEndpoint(moduleID) {
		return this.moduleEndpoints.get(moduleID);
	}

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
	register({ moduleID, apiPath, value, source = "core", collisionMode = "error", config = null, filePath = null }) {
		// Validate inputs
		if (!moduleID || typeof moduleID !== "string") {
			throw new this.SlothletError("OWNERSHIP_INVALID_MODULE_ID", { moduleID }, null, { validationError: true });
		}
		// Allow empty string for root-level registrations
		if (apiPath !== "" && (!apiPath || typeof apiPath !== "string")) {
			throw new this.SlothletError("OWNERSHIP_INVALID_API_PATH", { apiPath }, null, { validationError: true });
		}

		// Guard: reject registration for modules that have been explicitly unregistered.
		// This prevents stale ownership entries from being re-created when async lazy
		// materialization completes after a module has already been removed via api.remove().
		if (this._unregisteredModules.has(moduleID)) {
			return null;
		}

		// Check for conflicts
		const currentOwner = this.getCurrentOwner(apiPath);
		if (currentOwner && currentOwner.moduleID !== moduleID) {
			// Handle conflict based on collision mode
			if (collisionMode === "merge" || collisionMode === "replace" || collisionMode === "merge-replace") {
				// Allow registration - will merge or replace
			} else if (collisionMode === "skip") {
				// Skip registration silently
				return null;
			} else if (collisionMode === "warn") {
				// Skip registration but emit warning (unless silent)
				if (!config?.silent) {
					new this.SlothletWarning("WARNING_OWNERSHIP_CONFLICT", {
						apiPath,
						existingModuleId: currentOwner.moduleID,
						newModuleId: moduleID
					});
				}
				return null;
			} else {
				// error mode - throw
				throw new this.SlothletError("OWNERSHIP_CONFLICT", {
					apiPath,
					existingModuleId: currentOwner.moduleID,
					newModuleId: moduleID,
					validationError: true
				});
			}
		}

		// Add to moduleToPath
		if (!this.moduleToPath.has(moduleID)) {
			this.moduleToPath.set(moduleID, new Set());
		}
		this.moduleToPath.get(moduleID).add(apiPath);

		// Add to pathToModule stack
		if (!this.pathToModule.has(apiPath)) {
			this.pathToModule.set(apiPath, []);
		}

		// Check for duplicate registration - if this moduleID is already in the stack, don't add again
		const stack = this.pathToModule.get(apiPath);
		const existingEntry = stack.find((entry) => entry.moduleID === moduleID);
		if (existingEntry) {
			// Update existing entry instead of creating duplicate
			existingEntry.source = source;
			existingEntry.timestamp = Date.now();
			// Do not downgrade a known value to `undefined`: the same path is registered more than
			// once for a leaf (a namespace/marker registration omits the value while the leaf's own
			// registration carries the callable), and under lazy the value-less one can arrive last.
			// Overwriting unconditionally erased the function value, so kindOf misclassified the leaf
			// as data and leaves() dropped it. Guard it exactly as filePath below already is.
			if (value !== undefined) {
				existingEntry.value = value;
			}
			if (filePath !== null) {
				existingEntry.filePath = filePath;
			}
			// A later, more-authoritative registration for the SAME (moduleID, apiPath) pair can
			// correct an earlier call's `isMergeLoss` determination. The framework's generic
			// `impl:created` listener (slothlet.mjs) registers every construction with the
			// instance's DEFAULT collision mode — it has no visibility into a per-call override
			// (e.g. `forceOverwrite`, or a `merge` override on a `replace`-default instance) — and
			// typically fires (from inside the wrapper constructor) BEFORE the caller's own,
			// correctly-collisionMode-aware registration (modes-processor.mjs) for the same pair.
			// Since only the FIRST call for a pair decides the initial flag, this duplicate call,
			// now carrying the real mode, must be able to correct it (#365, #372).
			//
			// ONLY when this duplicate call's source is REGISTRATION_SOURCE_AUTHORITATIVE — see its
			// own doc comment for the full reasoning. In short: every OTHER source that reaches this
			// branch (the generic subscriber's own duplicate re-fire, an unrelated module's merge
			// composition re-touching this module's wrapper, registerSubtree()'s confirming walk)
			// carries no real, freshly-evaluated collision decision, and trusting any of them here
			// flipped an already-correctly-decided entry into a false merge-loss the moment ANY
			// other module shared its path — regressing the ownership rollback-chain test AND (in a
			// second attempt) a routines auth1/auth2 collision test, each via a different one of
			// these unreliable sources (#372 review).
			// Scoped to the same `typeof value === "function"` leaf case the fresh-registration
			// branch below uses — a container/namespace entry is never flagged a merge loss,
			// matching that restriction.
			if (typeof existingEntry.value === "function" && source === REGISTRATION_SOURCE_AUTHORITATIVE) {
				if (collisionMode === "replace" || collisionMode === "merge-replace") {
					existingEntry.isMergeLoss = false;
				} else if (collisionMode === "merge") {
					// A real collision only exists when some OTHER entry is CURRENTLY the non-loser
					// this one must defer to — not merely because other entries exist at all. In the
					// normal A-wins/B-loses merge stack, an authoritative re-registration of A itself
					// must stay non-loss: `stack.length > 1` (true because B is also present) wrongly
					// flagged A too, and #currentEntry() then fell back to B — ownership diverging
					// from the composed tree (#372 review).
					existingEntry.isMergeLoss = stack.some((entry) => entry !== existingEntry && !entry.isMergeLoss);
				}
				// skip/warn/error duplicates are defensive/rejected re-touches, not a fresh
				// collision outcome — never second-guess an already-established isMergeLoss
				// determination here.
			}
			return existingEntry;
		}

		// A genuine LEAF "merge" collision (a different module's function already owns this exact
		// path) must NOT become the new current owner: merge mode's real tree composition
		// (syncWrapper()) keeps the EXISTING function at a colliding leaf, never the incoming one —
		// unlike replace/merge-replace, where the incoming value does win. Scoped to `typeof value
		// === "function"` deliberately: a CONTAINER/namespace merge (value is an object — two
		// modules' namespaces combining their distinct children under the same path) has no single
		// "winner" to prefer — both genuinely coexist as children, so last-registered-wins is the
		// right (existing) behavior there and must be left alone. Tagged on the entry itself,
		// rather than encoded via stack position, so the determination survives an unrelated LATER
		// entry at this path being removed — #currentEntry()/getCurrentOwner() skip a flagged entry
		// regardless of where it sits in the stack (#372: a merge loser must stay suppressed even
		// after whichever module beat it is itself later removed, not resurface as an accidental
		// new "winner"). Excludes an administrative re-touch (see the duplicate branch above for
		// why) since its `collisionMode` label carries no real collision decision either.
		const isMergeLoss =
			source !== REGISTRATION_SOURCE_CONFIRM &&
			Boolean(currentOwner) &&
			currentOwner.moduleID !== moduleID &&
			collisionMode === "merge" &&
			typeof value === "function";

		const entry = {
			moduleID,
			source,
			timestamp: Date.now(),
			value,
			filePath,
			isMergeLoss
		};

		stack.push(entry);
		return entry;
	}

	/**
	 * Find the entry a stack's readers should treat as "current": the last entry, in registration
	 * order, that isn't flagged `isMergeLoss`.
	 * @param {Array<{moduleID: string, isMergeLoss?: boolean}>} stack - A path's ownership stack.
	 * @returns {Object|undefined} The current entry, or `undefined` for an empty stack.
	 * @private
	 *
	 * @description
	 * Falls back to the literal last entry when every entry in the stack is flagged — the
	 * first-ever registration at a path is never itself a merge loss, so this only matters for a
	 * stack this invariant has somehow already broken; kept as a defensive floor so a lookup never
	 * returns nothing for a non-empty stack.
	 */
	#currentEntry(stack) {
		if (!stack || stack.length === 0) return undefined;
		for (let i = stack.length - 1; i >= 0; i--) {
			if (!stack[i].isMergeLoss) return stack[i];
		}
		return stack[stack.length - 1];
	}

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
	unregister(moduleID) {
		const paths = this.moduleToPath.get(moduleID);
		if (!paths) {
			return { removed: [], rolledBack: [] };
		}

		// Mark this module as unregistered so that late-arriving async registrations
		// (e.g., from in-flight lazy materialization) are silently rejected.
		this._unregisteredModules.add(moduleID);

		const removed = [];
		const rolledBack = [];

		for (const apiPath of paths) {
			const result = this.removePath(apiPath, moduleID);

			if (result.action === "delete") {
				removed.push(apiPath);
			} else if (result.action === "restore") {
				rolledBack.push({
					apiPath,
					restoredTo: result.restoreModuleId
				});
			}
		}

		this.moduleToPath.delete(moduleID);
		this.moduleEndpoints.delete(moduleID);

		return { removed, rolledBack };
	}

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
	markUnregistered(moduleID) {
		this._unregisteredModules.add(moduleID);
		this.moduleEndpoints.delete(moduleID);
	}

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
	removePath(apiPath, moduleID = null) {
		const stack = this.pathToModule.get(apiPath);
		if (!stack) {
			return { action: "none", removedModuleId: null, restoreModuleId: null };
		}

		// Find and remove entry — an explicit moduleID targets it directly; the default (remove
		// "current") must resolve the same skip-merge-loss entry getCurrentOwner() would, not just
		// the literal last element (#372: a merge loser can sit anywhere in the stack).
		const index = moduleID ? stack.findIndex((entry) => entry.moduleID === moduleID) : stack.indexOf(this.#currentEntry(stack));
		if (index === -1) {
			return { action: "none", removedModuleId: null, restoreModuleId: null };
		}
		const [removed] = stack.splice(index, 1);
		const removedModuleId = removed.moduleID;
		if (removedModuleId && this.moduleToPath.has(removedModuleId)) {
			const pathSet = this.moduleToPath.get(removedModuleId);
			pathSet.delete(apiPath);
			if (pathSet.size === 0) {
				this.moduleToPath.delete(removedModuleId);
			}
		}

		// If stack empty, delete path entirely
		if (stack.length === 0) {
			this.pathToModule.delete(apiPath);
			return { action: "delete", removedModuleId, restoreModuleId: null };
		}

		// Otherwise, restore to previous owner — skip a stale merge-loss entry so a module that
		// lost a collision earlier doesn't accidentally resurface as "current" just because
		// whichever module beat it is the one being removed now (#372).
		const previous = this.#currentEntry(stack);
		return {
			action: "restore",
			removedModuleId,
			restoreModuleId: previous.moduleID
		};
	}

	/**
	 * Get current owner of API path
	 * @param {string} apiPath - API path to check
	 * @returns {Object|null} Current owner entry or null
	 * @public
	 */
	getCurrentOwner(apiPath) {
		const stack = this.pathToModule.get(apiPath);
		if (!stack || stack.length === 0) return null;
		return this.#currentEntry(stack) ?? null;
	}

	/**
	 * Get current value for API path
	 * @param {string} apiPath - API path to check
	 * @returns {*} Current value or undefined
	 * @public
	 */
	getCurrentValue(apiPath) {
		const owner = this.getCurrentOwner(apiPath);
		if (!owner) return undefined;

		const value = owner.value;

		// If value is a wrapper proxy, unwrap it to get the raw implementation.
		// Use resolveWrapper (checks the internal _proxyRegistry WeakMap directly) rather than
		// `"__impl" in value`, which goes through the hasTrap - and __impl is now blocked there.
		const rawWrapper = resolveWrapper(value);
		if (rawWrapper) {
			return rawWrapper.__impl;
		}

		return value;
	}

	/**
	 * Get all paths owned by module
	 * @param {string} moduleID - Module to query
	 * @returns {Array<string>} Array of API paths
	 * @public
	 */
	getModulePaths(moduleID) {
		return Array.from(this.moduleToPath.get(moduleID) || []);
	}

	/**
	 * Get ownership history for path
	 * @param {string} apiPath - API path to query
	 * @returns {Array<Object>} Ownership history stack
	 * @public
	 */
	getPathHistory(apiPath) {
		return this.pathToModule.get(apiPath) || [];
	}

	/**
	 * Check if module owns path
	 * @param {string} moduleID - Module to check
	 * @param {string} apiPath - API path to check
	 * @returns {boolean} True if module owns path
	 * @public
	 */
	ownsPath(moduleID, apiPath) {
		const owner = this.getCurrentOwner(apiPath);
		return owner && owner.moduleID === moduleID;
	}

	/**
	 * Get diagnostic info about ownership
	 * @returns {Object} Diagnostic information
	 * @public
	 */
	getDiagnostics() {
		return {
			totalModules: this.moduleToPath.size,
			totalPaths: this.pathToModule.size,
			modules: Array.from(this.moduleToPath.entries()).map(([id, paths]) => ({
				moduleID: id,
				pathCount: paths.size
			})),
			conflictedPaths: Array.from(this.pathToModule.entries())
				.filter(([_, stack]) => stack.length > 1)
				.map(([path, stack]) => ({
					apiPath: path,
					ownerStack: stack.map((e) => e.moduleID)
				}))
		};
	}

	/**
	 * Get ownership info for a specific API path
	 * @param {string} apiPath - API path to check
	 * @returns {Set<string>|null} Set of moduleIDs that own this path, or null if path not found
	 * @public
	 */
	getPathOwnership(apiPath) {
		const stack = this.pathToModule.get(apiPath);
		if (!stack || stack.length === 0) {
			return null;
		}
		return new Set(stack.map((entry) => entry.moduleID));
	}

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
	registerSubtree(api, moduleID, path, visited = new WeakSet()) {
		if (!api || typeof api !== "object") return;

		// Prevent infinite recursion on circular references
		if (visited.has(api)) {
			return;
		}
		visited.add(api);

		// Register this level if path exists
		if (path) {
			this.register({
				moduleID,
				apiPath: path,
				value: api,
				source: REGISTRATION_SOURCE_CONFIRM,
				collisionMode: "merge",
				filePath: null
			});
		}

		// Recursively register children
		for (const [key, value] of Object.entries(api)) {
			// Skip internal properties
			const skipProps = ["__metadata", "__type", "_materialize", "_impl", "____slothletInternal"];
			if (skipProps.includes(key)) {
				continue;
			}

			const childPath = path ? `${path}.${key}` : key;
			if (typeof value === "function" || (value && typeof value === "object")) {
				this.register({
					moduleID,
					apiPath: childPath,
					value,
					source: REGISTRATION_SOURCE_CONFIRM,
					collisionMode: "merge",
					filePath: null
				});

				// Recurse for objects (not functions with properties)
				if (typeof value === "object" && !Array.isArray(value)) {
					this.registerSubtree(value, moduleID, childPath, visited);
				}
			}
		}
	}

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
	snapshotModuleEntries(moduleID) {
		const snapshot = new Map();
		for (const path of this.moduleToPath.get(moduleID) || []) {
			const entry = this.pathToModule.get(path)?.find((candidate) => candidate.moduleID === moduleID);
			if (entry) {
				snapshot.set(path, { value: entry.value, filePath: entry.filePath, source: entry.source, isMergeLoss: entry.isMergeLoss });
			}
		}
		return snapshot;
	}

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
	restoreEntry(moduleID, apiPath, snapshot) {
		const entry = this.pathToModule.get(apiPath)?.find((candidate) => candidate.moduleID === moduleID);
		if (!entry) return;
		entry.value = snapshot.value;
		entry.filePath = snapshot.filePath;
		entry.source = snapshot.source;
		entry.isMergeLoss = snapshot.isMergeLoss;
	}

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
	revertSpeculativeSubtree(api, moduleID, path, priorEntries, visited = new WeakSet()) {
		// A callable leaf (a function-typed wrapper proxy) is a common top-level shape here — unlike
		// registerSubtree()'s callers, which only ever pass its own already-`typeof === "object"`
		// children recursively, addApiComponent's cleanup call passes `apiToMerge` directly, which is
		// frequently a Rule-13-hoisted callable. Excluding functions here would silently no-op the
		// exact case this method exists for.
		if (!api || (typeof api !== "object" && typeof api !== "function")) return;

		// Prevent infinite recursion on circular references
		if (visited.has(api)) {
			return;
		}
		visited.add(api);

		const revert = (revertPath) => {
			const prior = priorEntries.get(revertPath);
			if (prior) {
				this.restoreEntry(moduleID, revertPath, prior);
			} else {
				this.removePath(revertPath, moduleID);
			}
		};

		// Revert this level if path exists
		if (path) {
			revert(path);
		}

		// Recursively revert children
		for (const [key, value] of Object.entries(api)) {
			// Skip internal properties
			const skipProps = ["__metadata", "__type", "_materialize", "_impl", "____slothletInternal"];
			if (skipProps.includes(key)) {
				continue;
			}

			const childPath = path ? `${path}.${key}` : key;
			if (typeof value === "function" || (value && typeof value === "object")) {
				revert(childPath);

				// Recurse for objects (not functions with properties)
				if (typeof value === "object" && !Array.isArray(value)) {
					this.revertSpeculativeSubtree(value, moduleID, childPath, priorEntries, visited);
				}
			}
		}
	}

	/**
	 * Clear all ownership data
	 * @public
	 */
	clear() {
		this.moduleToPath.clear();
		this.pathToModule.clear();
		this._unregisteredModules.clear();
		this.moduleEndpoints.clear();
	}

	/**
	 * Export ownership state for preservation during reload
	 * @returns {Object} Serializable ownership state
	 * @public
	 */
	exportState() {
		return {
			moduleToPath: Array.from(this.moduleToPath.entries()).map(([id, paths]) => [id, Array.from(paths)]),
			pathToModule: Array.from(this.pathToModule.entries())
		};
	}

	/**
	 * Import ownership state from exported data
	 * @param {Object} state - Previously exported state
	 * @public
	 */
	importState(state) {
		// Clear current state
		this.clear();

		// Restore moduleToPath
		for (const [id, paths] of state.moduleToPath) {
			this.moduleToPath.set(id, new Set(paths));
		}

		// Restore pathToModule
		for (const [path, stack] of state.pathToModule) {
			this.pathToModule.set(path, stack);
		}
	}
}
