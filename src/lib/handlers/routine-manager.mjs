/**
 *	@Project: @cldmv/slothlet
 *	@Filename: /src/lib/handlers/routine-manager.mjs
 *	@Date: 2026-09-08 00:00:00 -07:00 (1788800000)
 *	@Author: Shinrai <CLDMV>
 *	@Email: <Shinrai@users.noreply.github.com>
 *	-----
 *	@Last modified by: Shinrai <CLDMV> (Shinrai@users.noreply.github.com)
 *	@Last modified time: 2026-09-08 00:00:00 -07:00 (1788800000)
 *	-----
 *	@Copyright: Copyright (c) 2013-2026 Catalyzed Motivation Inc. All rights reserved.
 */

/**
 * @fileoverview Stackable lifecycle routines (#341) — a configurable list of cross-module runnables.
 * Every mounted module's contribution matching a configured routine name is stacked into one
 * callable at its resolved api path, plus a root cascade that runs every matching contribution
 * anywhere, ordered per the routine's configured `order` (registration order, or depth-first — see
 * {@link #orderPaths}). See `docs/LIFECYCLE.md` ("Routines") for the full contract —
 * name matching (bare / mount-relative / recursive / root-anchored), ordering, and the lazy-mode
 * materialization cost model, which is precisely scoped to what each configured pattern requires.
 * @module @cldmv/slothlet/handlers/routine-manager
 * @internal
 */
import { ComponentBase } from "#factories/component-base";
import { SlothletError } from "@cldmv/slothlet/errors";
import { resolveWrapper } from "#handlers/unified-wrapper";
import { isFrameworkInternal } from "#handlers/framework-internals";
import { compilePattern, expandBraces } from "@cldmv/slothlet/helpers/pattern-matcher";

/**
 * Root-level api keys whose routine cascade is integrated into the framework's own existing
 * dispose builtins (`createShutdownFunction` / `createDestroyFunction` in api_builder.mjs) instead
 * of a freshly-generated `self.<name>` / `api.slothlet.<name>` property. Mirrors
 * `Slothlet.RESERVED_ROOT_KEYS` (src/slothlet.mjs) minus `"slothlet"` itself — `"slothlet"` can
 * never be a routine name at all (rejected by `Config.normalizeRoutines`), so it needs no runtime
 * guard here.
 * @type {ReadonlySet<string>}
 */
const ROOT_BUILTIN_NAMES = new Set(["shutdown", "destroy"]);

/**
 * Tracks, per Slothlet instance, every mounted module's raw contribution of a real function at any
 * api path, and resolves — on demand, at rebuild/cascade time, never inside the event handler
 * itself — which configured routine(s) each one matches.
 *
 * @description
 * Interpretation is deliberately deferred: a module's ownership *endpoint* (its own mount root,
 * needed for mount-relative name matching) is not recorded until AFTER all of that module's own
 * `impl:created` events have already fired (see `api-manager.mjs`'s `addApiComponent` —
 * `setModuleEndpoint` runs once, after `buildAPI` has already built and emitted for every leaf).
 * Matching inside the event handler would therefore see `undefined` for a brand-new module's own
 * endpoint on its very first events. Capturing the raw `{apiPath, moduleID, fn}` unconditionally and
 * resolving matches later — once every relevant `setModuleEndpoint` call has definitely run —
 * sidesteps that ordering hazard entirely.
 *
 * @class RoutineManager
 * @extends ComponentBase
 * @public
 */
export class RoutineManager extends ComponentBase {
	static slothletProperty = "routineManager";

	/**
	 * Create a RoutineManager instance.
	 * @param {object} slothlet - Slothlet class instance.
	 */
	constructor(slothlet) {
		super(slothlet);

		/**
		 * Raw capture, in arrival (registration) order, deduplicated by `(apiPath, moduleID)`. A
		 * re-registration of the same pair (hot-reload, or an incidental re-touch from an unrelated
		 * later mount at the same parent path) replaces the existing entry in place — preserving its
		 * original position — rather than appending a duplicate.
		 * @type {Array<{apiPath: string, moduleID: string, fn: Function}>}
		 */
		this.raw = [];

		/**
		 * Recording guard. `rebuildStacks()` overwrites live api properties, which re-enters
		 * `onImplCreated` via the same `impl:created` event every other write goes through — this
		 * flag is turned off for the duration of that overwrite so the stacked callable it just
		 * installed is never captured as a phantom contributor to its own chain.
		 * @type {boolean}
		 */
		this.recording = true;

		/**
		 * Compiled-glob-pattern cache, keyed by the raw pattern string (never includes a leading `^`
		 * — callers strip that themselves before compiling).
		 * @type {Map<string, function(string): boolean>}
		 */
		this.patternCache = new Map();
	}

	/**
	 * Discard all captured state. Called at the start of every `load()` (including `reload()`,
	 * which re-invokes `load()` on the same instance) so a previous cycle's contributors never
	 * bleed into a fresh compose.
	 * @returns {void}
	 * @public
	 */
	reset() {
		this.raw = [];
		this.patternCache.clear();
	}

	/**
	 * The instance's normalized `routines` config list.
	 * @returns {Array<{name: string, mode: "manual"|"startup"|"shutdown"|"destroy", recursive: boolean, order: "mount"|"depth"}>}
	 * @private
	 */
	get #routines() {
		return this.slothlet.config?.routines ?? [];
	}

	/**
	 * Look up a configured routine entry by name.
	 * @param {string} name - Routine name (as configured — may start with `^`, may contain dots).
	 * @returns {{name: string, mode: string, recursive: boolean}|undefined}
	 * @private
	 */
	#findRoutine(name) {
		return this.#routines.find((routine) => routine.name === name);
	}

	/**
	 * Compile (and cache) a glob pattern via the shared `compilePattern()` engine
	 * (`helpers/pattern-matcher.mjs` — the same one `HookManager`/`PermissionManager` use).
	 * @param {string} pattern - Glob pattern (no leading `^`).
	 * @returns {function(string): boolean} Matcher function.
	 * @private
	 */
	#compile(pattern) {
		let matcher = this.patternCache.get(pattern);
		if (!matcher) {
			matcher = compilePattern(pattern);
			this.patternCache.set(pattern, matcher);
		}
		return matcher;
	}

	/**
	 * Whether a raw contribution matches a configured routine, per the mount-relative / recursive /
	 * root-anchored rules (see `docs/LIFECYCLE.md` — "Routines").
	 *
	 * @description
	 * - A `^`-prefixed name is root-anchored: the pattern (with the `^` stripped) is compiled and
	 *   matched directly against the contribution's full absolute api path, crossing mount
	 *   boundaries entirely.
	 * - Otherwise the name is mount-relative: resolved against the contributing module's OWN
	 *   ownership endpoint (`OwnershipManager#getModuleEndpoint`). A bare name (no dots) only ever
	 *   matches when the relative path equals it exactly — i.e. the contribution sits directly at
	 *   the mount's own top level. A dotted name matches that exact relative path (`recursive:
	 *   false`, default) or, additionally, the same name appearing at any depth within the mount's
	 *   own subtree (`recursive: true`, via an implicit `**.` prefix).
	 * @param {{name: string, recursive: boolean}} routine - Normalized routine entry.
	 * @param {{apiPath: string, moduleID: string}} entry - Raw contribution to test.
	 * @returns {boolean}
	 * @private
	 */
	#matches(routine, entry) {
		const { name, recursive } = routine;
		if (name.startsWith("^")) {
			return this.#compile(name.slice(1))(entry.apiPath);
		}

		const endpoint = this.slothlet.handlers.ownership?.getModuleEndpoint(entry.moduleID);
		if (endpoint === undefined) return false; // Endpoint not (yet) known — cannot resolve a mount-relative match.

		let relative;
		// A root-mounted module's endpoint is "." for the initial base build (src/slothlet.mjs) but
		// "" for a root-level api.add("", folderPath) call (addApiComponent stores effectivePath
		// verbatim) — both mean the same thing (this instance's own root), matching the same
		// equivalence api-manager.mjs already applies when reading an endpoint back (#366 review).
		if (endpoint === "." || endpoint === "") relative = entry.apiPath;
		else if (entry.apiPath === endpoint)
			relative = ""; // The mount's own root itself has no relative sub-path.
		else if (entry.apiPath.startsWith(`${endpoint}.`)) relative = entry.apiPath.slice(endpoint.length + 1);
		else return false; // This contribution isn't under the module's own mount at all — shouldn't normally happen.

		if (relative === "") return false; // A routine name can never be the empty string.
		if (this.#compile(name)(relative)) return true;
		return recursive && this.#compile(`**.${name}`)(relative);
	}

	/**
	 * Whether resolving a configured routine could ever require descending past a mount's own
	 * guaranteed-eager top level — the precise trigger for the lazy-mode materialization cost.
	 * @param {{name: string, recursive: boolean}} routine - Normalized routine entry.
	 * @returns {boolean} `true` for a `^`-anchored name, a dotted mount-relative name, or `recursive: true`; `false` for a bare mount-relative name.
	 * @private
	 */
	#requiresDescent(routine) {
		if (routine.name.startsWith("^")) return true;
		if (routine.recursive) return true;
		return routine.name.includes(".");
	}

	/**
	 * Whether a raw contribution is still the api path's currently-recognized owner, per
	 * `OwnershipManager#getCurrentOwner()`. Conservative by design: a path ownership has no record
	 * for at all is never excluded (ownership tracking doesn't reach every construction path, and
	 * an untracked path was never a collision in the first place) — this only ever EXCLUDES an
	 * entry when ownership explicitly says a DIFFERENT module currently owns that exact path.
	 * @param {{apiPath: string, moduleID: string}} entry - Raw contribution to test.
	 * @returns {boolean}
	 * @private
	 */
	#isCurrentOwner(entry) {
		const ownership = this.slothlet.handlers.ownership;
		if (!ownership) return true;
		const owner = ownership.getCurrentOwner(entry.apiPath);
		if (!owner) return true;
		return owner.moduleID === entry.moduleID;
	}

	/**
	 * Apply the `stackRoutines` (#365) gate to a list of entries already known to belong to the
	 * same routine/path grouping. Both {@link #contributorsFor} (routine name matching) and
	 * {@link runPath} (the installed stacked callable's own direct apiPath lookup — a SEPARATE
	 * `this.raw` read that does not go through `#contributorsFor` at all) must apply this
	 * identically, or a module that lost a collision would still run via one path but not the
	 * other.
	 * @param {Array<{apiPath: string, moduleID: string, fn: Function}>} entries - Candidate entries.
	 * @returns {Array<{apiPath: string, moduleID: string, fn: Function}>}
	 * @private
	 */
	#applyStackFilter(entries) {
		if (this.slothlet.config?.stackRoutines) return entries;
		return entries.filter((entry) => this.#isCurrentOwner(entry));
	}

	/**
	 * Every raw entry matching a configured routine, in original raw-capture (registration) order.
	 *
	 * @description
	 * Whether a module that LOST a collision at this exact api path still counts is governed by
	 * `stackRoutines` (#365) — independent of `collisionMode` entirely. Nothing before #341 ever
	 * stacked functions at a shared api path, so stacking must not be an implicit side effect of
	 * whichever collisionMode happened to be in play. `stackRoutines: false` (the default) narrows
	 * to whichever contribution is ownership's currently-recognized owner of that path — matching
	 * what actually won the collision on the real composed tree, regardless of collisionMode.
	 * `stackRoutines: true` keeps every raw-captured contribution, uniformly, regardless of mode.
	 * @param {string} name - Routine name.
	 * @returns {Array<{apiPath: string, moduleID: string, fn: Function}>}
	 * @private
	 */
	#contributorsFor(name) {
		const routine = this.#findRoutine(name);
		if (!routine) return [];
		return this.#applyStackFilter(this.raw.filter((entry) => this.#matches(routine, entry)));
	}

	/**
	 * Group an ordered list of contributions by their exact api path, preserving each group's own
	 * first-appearance position — the order in which the cascade visits distinct paths.
	 * @param {Array<{apiPath: string, moduleID: string, fn: Function}>} entries - Contributions, in order.
	 * @returns {Map<string, Array<{apiPath: string, moduleID: string, fn: Function}>>}
	 * @private
	 */
	#groupByPath(entries) {
		const groups = new Map();
		for (const entry of entries) {
			let group = groups.get(entry.apiPath);
			if (!group) {
				group = [];
				groups.set(entry.apiPath, group);
			}
			group.push(entry);
		}
		return groups;
	}

	/**
	 * Lifecycle subscriber for BOTH `impl:created` and `impl:changed` (subscribed to both in
	 * src/slothlet.mjs's `_setupLifecycleSubscribers()`). Captures a contribution's raw
	 * `{apiPath, moduleID, fn}` unconditionally — routine-name interpretation happens later, at
	 * rebuild/cascade time (see the class-level description for why).
	 *
	 * @description
	 * Reads `data.wrapper.__impl` (present on every such event, in both eager and lazy mode) rather
	 * than `data.impl` — `impl:created` fires twice per leaf construction (once with `impl` set to
	 * the wrapper itself, once with the raw value for eager-known impls), and `wrapper.__impl` is
	 * the one consistent field across every variant. Fires BEFORE collision resolution decides
	 * which contributor's value survives onto the composed tree, so every contributor is captured —
	 * not just the merge winner.
	 *
	 * Also subscribed to `impl:changed` so a LATE, direct reassignment (`self.auth.shutdown = fn`,
	 * done after the module that owns `auth` finished loading) is captured too, not just the
	 * original module-load-time contribution — and, symmetrically, so a later reassignment AWAY
	 * from a function (to an object, `null`, or any other non-function value) removes the earlier
	 * capture rather than leaving a stale function contribution behind for a cascade to invoke.
	 * @param {object} data - `impl:created` / `impl:changed` event payload.
	 * @returns {void}
	 * @public
	 */
	onImplCreated(data) {
		if (!this.recording) return;
		if (this.#routines.length === 0) return;
		const apiPath = data?.apiPath;
		if (typeof apiPath !== "string" || apiPath.length === 0) return;
		const moduleID = data.moduleID;
		const fn = data.wrapper?.__impl;
		const existingIndex = this.raw.findIndex((e) => e.apiPath === apiPath && e.moduleID === moduleID);
		// A stacked callable installed by rebuildStacks() must never be captured as if it were a
		// module's own contribution, no matter what later re-touches the property it was written
		// to. `recording = false` only protects rebuildStacks()'s OWN write — a later, unrelated
		// write to the SAME property (e.g. ownership restoring a container's value onto the live
		// tree after a sibling module is removed) runs with `recording` back to `true` and can
		// re-read the stacked callable that's ALREADY sitting there as this property's current
		// impl. Capturing it would make this raw entry's `fn` the stacked callable itself:
		// invoking it re-enters runPath() for the same apiPath, which finds this same
		// self-referential entry again — infinite async recursion that grows the heap until OOM
		// (#372 review; confirmed pre-existing, reproducible without any of this session's other
		// changes: stackRoutines: true + a "merge" collision + removing the merge-loser).
		if (typeof fn === "function" && fn.__slothletRoutineStack === true) {
			return;
		}
		if (typeof fn !== "function") {
			// The same (apiPath, moduleID) previously contributed a real function but its impl has
			// since changed to something else (a direct reassignment to an object/null, or a lazy
			// placeholder resolving to a non-function export) — drop the now-stale entry so a later
			// cascade/stack rebuild never invokes a function that no longer reflects current state.
			if (existingIndex !== -1) this.raw.splice(existingIndex, 1);
			return;
		}
		const entry = { apiPath, moduleID, fn };
		if (existingIndex === -1) this.raw.push(entry);
		else this.raw[existingIndex] = entry;
	}

	/**
	 * Lifecycle subscriber: `impl:removed`. Prunes a removed module's raw contribution.
	 * @param {object} data - `impl:removed` event payload.
	 * @returns {void}
	 * @public
	 */
	onImplRemoved(data) {
		const apiPath = data?.apiPath;
		const moduleID = data?.moduleID;
		if (typeof apiPath !== "string" || !moduleID) return;
		this.raw = this.raw.filter((e) => !(e.apiPath === apiPath && e.moduleID === moduleID));
	}

	/**
	 * Prune every raw-captured contribution belonging to a module, regardless of whether it was
	 * ever the live property at its own path.
	 * @param {string} moduleID - Module identifier being fully removed.
	 * @returns {void}
	 * @public
	 *
	 * @description
	 * `onImplRemoved()` alone is not enough for a whole-module removal: it prunes by (apiPath,
	 * moduleID) on the `impl:removed` lifecycle event, which fires only when a property is actually
	 * DELETED from the live composed tree. A module that lost a collision (a merge-loser, recorded
	 * in ownership but never installed as the live property at its path) is never the live property,
	 * so removing it resolves as an ownership "restore" (the current owner's value is re-applied,
	 * unchanged) rather than a "delete" — `impl:removed` never fires for the loser's own entry, and
	 * its raw contribution would otherwise survive `api.remove()` indefinitely, still invoked under
	 * `stackRoutines: true` (#372). Call this alongside `OwnershipManager#unregister()` for a
	 * whole-module removal, which already discards every path the module owned regardless of
	 * whether the live tree changed for each one.
	 *
	 * @example
	 * ownership.unregister(moduleID);
	 * routineManager.pruneModule(moduleID);
	 */
	pruneModule(moduleID) {
		this.raw = this.raw.filter((e) => e.moduleID !== moduleID);
	}

	/**
	 * Snapshot the raw contributions moduleID currently has, keyed by apiPath, for later restoration
	 * @param {string} moduleID - Module identifier to snapshot.
	 * @returns {Map<string, Function>} One entry per apiPath the module currently contributes to.
	 * @public
	 *
	 * @description
	 * Call this BEFORE a candidate build's construction (buildAPI) runs, so a later revert can tell
	 * an apiPath moduleID already genuinely contributed to (whose entry must be restored, not
	 * dropped) from one the candidate build's own speculative `impl:created` capture fabricated
	 * (which must be discarded outright).
	 *
	 * @example
	 * const snapshot = routineManager.snapshotRawEntries("same-mod");
	 */
	snapshotRawEntries(moduleID) {
		const snapshot = new Map();
		for (const entry of this.raw) {
			if (entry.moduleID === moduleID) snapshot.set(entry.apiPath, entry.fn);
		}
		return snapshot;
	}

	/**
	 * Revert a speculative API subtree's raw routine contributions
	 * @param {object} api - API object or subtree (the same candidate value addApiComponent built).
	 * @param {string} moduleID - Module identifier whose speculative contributions to revert.
	 * @param {string} path - Current API path.
	 * @param {Map<string, Function>} priorEntries - Snapshot from
	 *   {@link RoutineManager#snapshotRawEntries}, taken before the candidate build ran, of what
	 *   moduleID already genuinely contributed.
	 * @param {WeakSet} [visited] - Visited objects (prevents circular refs).
	 * @returns {void}
	 * @public
	 *
	 * @description
	 * Mirrors OwnershipManager#revertSpeculativeSubtree()'s reasoning for the same underlying cause:
	 * `onImplCreated` fires from the SAME `impl:created`/`impl:changed` events during a candidate
	 * build's construction, before addApiComponent's own collision decision runs — capturing every
	 * constructed wrapper's function into `this.raw` regardless of whether the build is later
	 * accepted. Under `stackRoutines: true` (which bypasses ownership filtering entirely), a
	 * skip/warn-rejected candidate's raw entry would otherwise still be invoked by root-anchored
	 * routines and the exact-path stacked callable, even though its module was never actually
	 * mounted. At each level: if `priorEntries` has this exact apiPath, moduleID already
	 * contributed to it before this build — restore that function (a later re-registration for the
	 * same pair replaces in place, so a rejected candidate's fn would otherwise silently overwrite a
	 * genuine, pre-existing contribution). Otherwise the entry is purely speculative — drop it.
	 *
	 * @example
	 * const priorEntries = routineManager.snapshotRawEntries("same-mod");
	 * // ...buildAPI runs, candidate is rejected...
	 * routineManager.revertSpeculativeSubtree(apiToMerge, "same-mod", "thing", priorEntries);
	 */
	revertSpeculativeSubtree(api, moduleID, path, priorEntries, visited = new WeakSet()) {
		if (!api || (typeof api !== "object" && typeof api !== "function")) return;

		if (visited.has(api)) {
			return;
		}
		visited.add(api);

		const revert = (revertPath) => {
			const prior = priorEntries.get(revertPath);
			if (prior) {
				const idx = this.raw.findIndex((e) => e.apiPath === revertPath && e.moduleID === moduleID);
				if (idx !== -1) this.raw[idx] = { apiPath: revertPath, moduleID, fn: prior };
			} else {
				this.raw = this.raw.filter((e) => !(e.apiPath === revertPath && e.moduleID === moduleID));
			}
		};

		if (path) {
			revert(path);
		}

		for (const [key, value] of Object.entries(api)) {
			const skipProps = ["__metadata", "__type", "_materialize", "_impl", "____slothletInternal"];
			if (skipProps.includes(key)) {
				continue;
			}

			const childPath = path ? `${path}.${key}` : key;
			if (typeof value === "function" || (value && typeof value === "object")) {
				revert(childPath);

				if (typeof value === "object" && !Array.isArray(value)) {
					this.revertSpeculativeSubtree(value, moduleID, childPath, priorEntries, visited);
				}
			}
		}
	}

	/**
	 * Revert every speculative raw contribution currently on record for a module, driven by the
	 * module's own current `raw` entries rather than a candidate api-tree reference
	 * @param {string} moduleID - Module identifier whose speculative raw entries to revert.
	 * @param {Map<string, Function>} priorEntries - Snapshot from
	 *   {@link RoutineManager#snapshotRawEntries}, taken before the candidate build ran.
	 * @returns {void}
	 * @public
	 *
	 * @description
	 * Mirrors `OwnershipManager#revertSpeculativeState()`'s reasoning: `revertSpeculativeSubtree`
	 * needs a concrete api-tree value to walk, which may not exist when `buildAPI()` or
	 * `setValueAtPath()` throws partway through a candidate build. Reads `this.raw` directly for
	 * whatever paths this moduleID currently has an entry at, restoring the ones already present in
	 * `priorEntries` and dropping the rest (#372 review).
	 *
	 * @example
	 * const priorEntries = routineManager.snapshotRawEntries("same-mod");
	 * try {
	 *   // ...buildAPI/setValueAtPath run and throw...
	 * } catch (err) {
	 *   routineManager.revertSpeculativeState("same-mod", priorEntries);
	 *   throw err;
	 * }
	 */
	revertSpeculativeState(moduleID, priorEntries) {
		for (const path of this.raw.filter((e) => e.moduleID === moduleID).map((e) => e.apiPath)) {
			const prior = priorEntries.get(path);
			if (prior) {
				const idx = this.raw.findIndex((e) => e.apiPath === path && e.moduleID === moduleID);
				if (idx !== -1) this.raw[idx] = { apiPath: path, moduleID, fn: prior };
			} else {
				this.raw = this.raw.filter((e) => !(e.apiPath === path && e.moduleID === moduleID));
			}
		}
	}

	/**
	 * Run one exact api path's contributors sequentially, awaiting each before the next, collecting
	 * both what each one returns AND what each one throws — best-effort, mirroring
	 * `module-manager.mjs`'s own `onFailure: "best-effort"` convention and the dispose semantics this
	 * replaces: every contributor gets a chance to run regardless of an earlier one failing.
	 *
	 * @description
	 * Each contributor is invoked via `Reflect.apply(fn, receiver, args)`, where `receiver` is that
	 * path's own PARENT node in the CURRENT composed api tree, so a contributor written as a method
	 * relying on `this` behaves identically to a direct call through the api.
	 * @param {string} apiPath - Exact composed api path (e.g. `"auth.initialize"`).
	 * @param {Array<{apiPath: string, moduleID: string, fn: Function}>} entries - This path's contributors.
	 * @param {Array} [args] - Arguments forwarded to every contributor.
	 * @returns {Promise<{results: Array<*>, failures: Array<{apiPath: string, moduleID: string, error: unknown}>}>}
	 * @private
	 */
	async #runEntries(apiPath, entries, args = []) {
		const lastDot = apiPath.lastIndexOf(".");
		const parentPath = lastDot === -1 ? "" : apiPath.slice(0, lastDot);
		const receiver = parentPath === "" ? this.slothlet.api : await this.#resolveContainer(this.slothlet.api, parentPath);
		if (receiver === undefined) {
			// #resolveContainer already treats a missing or permission-gated segment like a missing
			// one (returns undefined rather than throwing) — mirror that same best-effort skip here
			// instead of invoking every contributor with an invalid `this` binding, which would
			// produce a misleading failure (a TypeError from inside the contributor) rather than
			// correctly reflecting that the receiver itself couldn't be reached.
			return { results: [], failures: [] };
		}
		const results = [];
		const failures = [];
		for (const { moduleID, fn } of entries) {
			try {
				// Sequential-by-contract: each contributor must observe the previous one's completed side effects.
				results.push(await Reflect.apply(fn, receiver, args));
			} catch (error) {
				// Best-effort: record the failure, attributed, and keep running the remaining contributors.
				failures.push({ apiPath, moduleID, error });
			}
		}
		return { results, failures };
	}

	/**
	 * Throw an aggregate `ROUTINE_FAILED` error for a batch of collected failures, chaining the
	 * first one as `cause` and carrying the full list in `context.failures` — never called when
	 * `failures` is empty.
	 * @param {Array<{apiPath: string, moduleID: string, error: unknown}>} failures - Collected failures, in the order they occurred.
	 * @returns {never}
	 * @throws {SlothletError} Always.
	 * @private
	 */
	#throwAggregate(failures) {
		// Each entry keeps its plain {apiPath, moduleID} shape (structurally matched elsewhere via
		// context.failures) but gains a non-enumerable toString so the translated message — which
		// interpolates {failures} via String(value) — renders a readable list instead of the array's
		// default "[object Object],[object Object]" join.
		const failureEntries = failures.map(({ apiPath, moduleID }) => {
			const entry = { apiPath, moduleID };
			Object.defineProperty(entry, "toString", { value: () => `${apiPath} (${moduleID})`, enumerable: false });
			return entry;
		});
		Object.defineProperty(failureEntries, "toString", {
			value: () => failureEntries.map(String).join(", "),
			enumerable: false
		});
		throw new SlothletError(
			"ROUTINE_FAILED",
			{
				apiPath: failures[0].apiPath,
				moduleID: failures[0].moduleID,
				count: failures.length,
				failures: failureEntries
			},
			failures[0].error
		);
	}

	/**
	 * Run one exact api path's stacked contributors directly (the callable installed at that path
	 * by {@link rebuildStacks} delegates here). Every contributor runs regardless of an earlier
	 * one's failure; if any failed, one aggregate `ROUTINE_FAILED` error is thrown once all of them
	 * have run (see {@link #throwAggregate}).
	 * @param {string} apiPath - Exact composed api path.
	 * @param {Array} [args] - Arguments forwarded to every contributor.
	 * @param {object} [routine] - The specific routine config this callable was built for
	 *   ({@link #buildStackedCallable}'s own caller, {@link rebuildStacks}, always supplies it).
	 *   When present, entries are also filtered by {@link #matches} so a mount-relative name
	 *   pattern belonging to a DIFFERENT routine that happens to resolve to the same exact apiPath
	 *   (e.g. a root module's bare `"initialize"` and an `api.add()`-mounted module's own
	 *   `"initialize"`, both composing to the same final path) doesn't invoke that other routine's
	 *   raw functions too (#366 review).
	 * @returns {Promise<*>} The sole contributor's return value, an ordered array of every
	 *   contributor's return value when there are two or more, or `[]` when there are none (e.g. a
	 *   stacked callable left in place after its last contributor was removed without an
	 *   intervening rebuild) — matching {@link runCascade}'s identical "no contributors" contract.
	 * @throws {SlothletError} `ROUTINE_FAILED` — see {@link #throwAggregate}.
	 * @public
	 */
	async runPath(apiPath, args = [], routine = null) {
		// Post-destroy() safety — see the identical guard + rationale in runCascade().
		if (!this.slothlet.api) return undefined;
		const pathEntries = this.raw.filter((entry) => entry.apiPath === apiPath);
		const scopedEntries = routine ? pathEntries.filter((entry) => this.#matches(routine, entry)) : pathEntries;
		const entries = this.#applyStackFilter(scopedEntries);
		const { results, failures } = await this.#runEntries(apiPath, entries, args);
		if (failures.length > 0) this.#throwAggregate(failures);
		return results.length === 1 ? results[0] : results;
	}

	/**
	 * Force-materialize every lazy-mode node under a given root — a generic version of
	 * `_collectLifecycleHooks`'s own walk (same cycle/depth guard, framework-internal skip, and
	 * materialization-failure bail — see src/slothlet.mjs) that visits every node unconditionally
	 * rather than checking each one for a single named export.
	 *
	 * @description
	 * A cascade needs COMPLETE information — every contribution anywhere the configured pattern
	 * could match — but `this.raw` only reflects whatever has fired `impl:created`/`impl:changed`
	 * SO FAR, and a lazy-mode node nothing has touched yet never fires that at all. Forcing
	 * materialization here, immediately before a cascade reads `this.raw`, is what fires those
	 * pending events and makes the registry complete — mirroring `_collectLifecycleHooks`'s own
	 * strategy of discovering fresh at invocation time rather than trusting a stale pre-built cache.
	 *
	 * Scope is precise, not blanket (see `docs/LIFECYCLE.md` — "Routines"): a bare mount-relative
	 * name never calls this at all (its mount's own top level is always eager); a dotted or
	 * `recursive: true` mount-relative name calls this once per KNOWN mount root; a `^`-anchored
	 * name calls this once against the whole composed tree.
	 * @param {object} root - Node to walk (a specific mount's own object, or the whole composed api).
	 * @returns {Promise<void>}
	 * @private
	 */
	async #materializeTree(root) {
		if (!root) return;
		const seen = new Set();

		/**
		 * Recursively visit a node, force-materializing any unmaterialized lazy wrapper found.
		 * @param {object|Function} obj - Node to visit.
		 * @param {number} depth - Current recursion depth (capped at 15, mirroring `_collectLifecycleHooks`).
		 * @returns {Promise<void>}
		 */
		const visit = async (obj, depth = 0) => {
			const objType = typeof obj;
			if (!obj || (objType !== "object" && objType !== "function") || depth > 15 || seen.has(obj)) return;
			seen.add(obj);
			try {
				if (isFrameworkInternal(obj)) return;
				const wrapper = resolveWrapper(obj);
				if (wrapper) {
					if (wrapper.____slothletInternal.mode === "lazy" && !wrapper.____slothletInternal.state.materialized) {
						try {
							await wrapper._materialize();
						} catch {
							return; // Materialization failed — do not descend into a broken subtree.
						}
					}
					for (const key of Object.keys(wrapper)) {
						if (!key.startsWith("____")) await visit(wrapper[key], depth + 1);
					}
					return;
				}
				for (const key of Object.keys(obj)) {
					await visit(obj[key], depth + 1);
				}
			} catch {
				// Best-effort discovery: ignore errors from partially-constructed or attack-state wrappers.
			}
		};

		// Only the true api root has reserved builtin keys (RESERVED_ROOT_KEYS is root-depth-only —
		// a mount can legitimately export an ordinary module literally named "shutdown"/"destroy"/
		// "slothlet"), so the skip below must not apply when `root` is a mount root passed in from
		// `#materializeFor`'s per-mount loop.
		const isApiRoot = root === this.slothlet.api;
		for (const key of Object.keys(root)) {
			// The api root's own builtins carry no routine contributors of their own — only nested content does.
			if (isApiRoot && (key === "slothlet" || key === "shutdown" || key === "destroy")) continue;
			if (key.startsWith("____")) continue;
			await visit(root[key]);
		}
	}

	/**
	 * Force-materialize exactly what a dotted, non-recursive glob pattern (no `**`, no `{}`, not a
	 * `!`-negation — see {@link #materializeFor}) could match, walking one `.`-segment at a time
	 * instead of the pattern's entire remaining subtree — falling back to a subtree walk only from
	 * the exact node a `**` segment is reached at, never from the mount's own root.
	 *
	 * @description
	 * A single `*`/`?` never crosses a `.` boundary (`compilePattern()` compiles a lone `*` to
	 * `[^.]*`, never `.*`) — so a wildcard segment only ever needs ITS OWN level enumerated, never
	 * anything past it. `**` compiles to `.*` (crosses `.` freely, unbounded depth) — but only from
	 * the point it appears: `"admin.**"` still narrows to "admin" first via an ordinary literal
	 * step, and only THEN needs its remaining subtree walked in full, never a sibling of "admin" the
	 * same mount also contains. Each `.`-segment is handled on its own merits: a literal segment
	 * steps directly into that one named child (materializing it first if it's still an
	 * unmaterialized lazy wrapper); `**` force-materializes the CURRENT node's entire remaining
	 * subtree via {@link #materializeTree} and stops (nothing bounds it further); a `*`/`?` segment
	 * force-materializes the CURRENT node (so its direct children are real) and enumerates them,
	 * recursing into only the ones the segment's own compiled pattern actually matches — a
	 * mismatched sibling is left untouched. `{}` brace-expansion is resolved by the caller
	 * ({@link #materializeFor}, via `expandBraces()`) into concrete alternatives before this method
	 * ever runs, since a brace option can itself embed a literal `.` (e.g. `"{a.b,c}"`) that a
	 * naive `.`-split here couldn't tell apart from a real segment boundary.
	 * @param {object|Function} node - Current node (mount root on the initial call).
	 * @param {string[]} segments - Remaining `.`-split segments of the pattern still to resolve.
	 * @returns {Promise<void>}
	 * @private
	 */
	async #materializeGlobPath(node, segments) {
		if (node === null || node === undefined || segments.length === 0) return;
		const nodeType = typeof node;
		if (nodeType !== "object" && nodeType !== "function") return;

		// The current node itself may still be an unmaterialized lazy wrapper (a subfolder reached
		// via a previous segment) — force it now so its direct children are real, whichever branch
		// below needs them.
		const nodeWrapper = resolveWrapper(node);
		if (nodeWrapper && nodeWrapper.____slothletInternal.mode === "lazy" && !nodeWrapper.____slothletInternal.state.materialized) {
			try {
				await nodeWrapper._materialize();
			} catch {
				return; // Materialization failed — nothing further to resolve down this branch.
			}
		}

		const [segment, ...rest] = segments;

		if (segment === "**") {
			// Unbounded from exactly here — `**` can span any further depth, so the current node's
			// own entire remaining subtree (already-materialized above, safe for #materializeTree to
			// read directly) is the narrowest target there is. Never re-walks from the mount's root.
			await this.#materializeTree(node);
			return;
		}

		if (!/[*?]/.test(segment)) {
			// Pure literal segment — step directly into the one named child, no enumeration needed.
			let child;
			try {
				child = node[segment];
			} catch {
				return; // Permission-gated or otherwise unreadable — treat like a missing segment.
			}
			await this.#materializeGlobPath(child, rest);
			return;
		}

		// Single-level wildcard (`*`/`?`, never `**`): enumerate this node's now-real direct
		// children and recurse only into the ones the segment's own compiled pattern actually
		// matches.
		let keys;
		try {
			keys = Object.keys(node);
		} catch {
			return;
		}
		const matches = this.#compile(segment);
		for (const key of keys) {
			if (!matches(key)) continue;
			let child;
			try {
				child = node[key];
			} catch {
				continue;
			}
			await this.#materializeGlobPath(child, rest);
		}
	}

	/**
	 * Force-materialize whatever a configured routine's pattern could require (see
	 * {@link #requiresDescent} and {@link #materializeTree}) — a no-op for a bare mount-relative
	 * name, since its mount's own top level is always eager in either mode.
	 *
	 * @description
	 * A cascade needs COMPLETE information — every contribution anywhere the configured pattern
	 * could match — but `this.raw` only reflects whatever has fired `impl:created`/`impl:changed`
	 * SO FAR, and a lazy-mode node nothing has touched yet never fires that at all. Forcing
	 * materialization here, immediately before a cascade reads `this.raw`, is what fires those
	 * pending events and makes the registry complete.
	 *
	 * Scope is precise, not blanket, whenever a segment-by-segment walk can express it: a bare
	 * mount-relative name never calls this at all (its mount's own top level is always eager). Every
	 * other non-recursive, non-negated mount-relative name — literal, a single-level wildcard
	 * (`*`/`?`), a `**` anywhere in it, or `{}` brace-expansion — is walked one `.`-segment at a time
	 * via {@link #materializeGlobPath}, which descends only as far as each segment actually requires
	 * (never a sibling subtree the same mount also happens to contain): a literal segment steps into
	 * exactly that one child; a `*`/`?` segment only needs ITS OWN level enumerated, since a lone
	 * wildcard never crosses a `.` boundary (`compilePattern()` compiles it to `[^.]*`, not `.*`);
	 * `**` needs its remaining subtree walked in full, but only from wherever it's reached — e.g.
	 * `"admin.**"` still narrows to "admin" first, never a sibling of "admin". `{}` brace-expansion
	 * is resolved into concrete alternatives up front (`expandBraces()`, the same utility
	 * `compilePattern()` itself uses) since a brace option can embed a literal `.` a naive split here
	 * couldn't tell apart from a real segment boundary — e.g. `"a{a,b}.*"` walks only "aa" and "ab",
	 * never a sibling "ac" the same mount might also contain. Only `recursive: true` (an implicit
	 * `**.` prefix — unbounded from the mount's own root, not from any narrowing prefix) or a
	 * `!`-negated name (its matching set is a complement, inherently unbounded) walks a known mount's
	 * entire subtree outright. A `^`-anchored name walks the whole composed tree (the target could be
	 * anywhere at all).
	 * @param {{name: string, recursive: boolean}} routine - Normalized routine entry.
	 * @returns {Promise<void>}
	 * @private
	 */
	async #materializeFor(routine) {
		if (!this.#requiresDescent(routine)) return;
		if (routine.name.startsWith("^")) {
			await this.#materializeTree(this.slothlet.api);
			return;
		}
		const ownership = this.slothlet.handlers.ownership;
		const endpoints = ownership ? new Set(ownership.moduleEndpoints.values()) : new Set();
		if (!routine.recursive && !routine.name.startsWith("!")) {
			// Every bounded shape (literal, `*`/`?`, `**`, `{}`) walks one `.`-segment at a time —
			// #materializeGlobPath descends only as far as each segment actually requires. Brace
			// alternatives are expanded into their own concrete segment chains first, since a brace
			// option can embed a literal `.` a naive split here couldn't distinguish from a real
			// segment boundary.
			const segmentChains = expandBraces(routine.name).map((alternative) => alternative.split("."));
			for (const endpoint of endpoints) {
				// Same "." vs "" root-endpoint equivalence as #matches() above.
				const mountRoot =
					endpoint === "." || endpoint === "" ? this.slothlet.api : await this.#resolveContainer(this.slothlet.api, endpoint);
				if (mountRoot === null || mountRoot === undefined) continue;
				for (const segments of segmentChains) {
					await this.#materializeGlobPath(mountRoot, segments);
				}
			}
			return;
		}
		// `recursive: true` (unbounded from the mount's own root) or a `!`-negated name (an unbounded
		// complement — precision doesn't help): walk each known mount's entire subtree.
		// Same "." vs "" root-endpoint equivalence as #matches() above.
		if (endpoints.has(".") || endpoints.has("")) {
			// The base endpoint's own subtree IS the whole composed api, so walking it already covers
			// every other mount — materializing each mount separately afterward would just re-walk
			// already-materialized ground for no new information.
			await this.#materializeTree(this.slothlet.api);
			return;
		}
		for (const endpoint of endpoints) {
			const mountRoot = await this.#resolveContainer(this.slothlet.api, endpoint);
			await this.#materializeTree(mountRoot);
		}
	}

	/**
	 * Order a routine's matching api paths per its configured `order`: `"mount"` preserves each
	 * path's first-appearance position in raw registration order (`this.#groupByPath`'s `Map`
	 * already reflects that natively); `"depth"` sorts deepest-first (more dot-segments first),
	 * breaking ties by mount order — the deepest-first teardown convention the replaced
	 * `collectLifecycleHooks` mechanism always hardcoded, now the default for `shutdown`/`destroy`.
	 * @param {string[]} apiPaths - Matching paths, already in mount (first-appearance) order.
	 * @param {"mount"|"depth"} order - The routine's configured order.
	 * @returns {string[]} Reordered paths.
	 * @private
	 */
	#orderPaths(apiPaths, order) {
		if (order !== "depth") return apiPaths;
		return apiPaths
			.map((apiPath, index) => ({ apiPath, index, depth: apiPath.split(".").length }))
			.sort((a, b) => b.depth - a.depth || a.index - b.index)
			.map((entry) => entry.apiPath);
	}

	/**
	 * Run the root cascade for a routine: every matching contribution anywhere, grouped by exact
	 * api path (contributors colliding at the same path run together, adjacently), the groups
	 * themselves ordered per the routine's configured `order` (see {@link #orderPaths}). No-op —
	 * and returns `undefined` — when the routine isn't configured.
	 *
	 * @description
	 * Force-materializes whatever the routine's pattern requires (see {@link #materializeFor})
	 * before reading `this.raw`, so a not-yet-touched lazy contribution is captured rather than
	 * missed. Best-effort across the whole cascade: every matching path's group runs regardless of
	 * an earlier group's failure; if any contributor anywhere failed, one aggregate `ROUTINE_FAILED`
	 * error is thrown once everything has run (see {@link #throwAggregate}).
	 * @param {string} name - Routine name.
	 * @param {boolean} [skipMaterialize=false] - Skip the {@link #materializeFor} call — internal
	 *   use only, for a caller (`#runModeRoutines`) that already force-materialized this exact
	 *   routine immediately beforehand and would otherwise re-walk the same tree for no new
	 *   information. Always leave this `false` for any externally-triggered cascade (the installed
	 *   `api[name]()` / `api.slothlet[name]()` callables never pass it), since those calls have no
	 *   such prior guarantee.
	 * @returns {Promise<*>} The sole involved path's result, an ordered array of every involved
	 *   path's result when there are two or more, `[]` when the routine has no contributors
	 *   anywhere, or `undefined` when the routine isn't configured at all OR the instance has
	 *   already been destroyed.
	 * @throws {SlothletError} `ROUTINE_FAILED` — see {@link #throwAggregate}.
	 * @public
	 */
	async runCascade(name, skipMaterialize = false) {
		// Post-destroy() safety, mirroring the removed `_collectLifecycleHooks`'s own
		// `if (!this.api) return []` guard: `destroy()` clears `slothlet.api` at the very end of its
		// own cleanup, and a second destroy()/shutdown() call must be a safe no-op, not re-run every
		// contributor again against a receiver that no longer exists.
		if (!this.slothlet.api) return undefined;
		const routine = this.#findRoutine(name);
		if (!routine) return undefined;
		if (!skipMaterialize) await this.#materializeFor(routine);
		const groups = this.#groupByPath(this.#contributorsFor(name));
		const orderedPaths = this.#orderPaths([...groups.keys()], routine.order);
		const results = [];
		const failures = [];
		for (const apiPath of orderedPaths) {
			// Sequential-by-contract: cascade order is the entire point.
			const outcome = await this.#runEntries(apiPath, groups.get(apiPath));
			results.push(outcome.results.length === 1 ? outcome.results[0] : outcome.results);
			failures.push(...outcome.failures);
		}
		if (failures.length > 0) this.#throwAggregate(failures);
		return results.length === 1 ? results[0] : results;
	}

	/**
	 * Run every configured routine of a given mode, in declared order. Shared by
	 * {@link runStartupModeRoutines}, {@link runShutdownModeRoutines}, and
	 * {@link runDestroyModeRoutines}.
	 * @param {"startup"|"shutdown"|"destroy"} mode - Mode to run.
	 * @returns {Promise<void>}
	 * @private
	 */
	async #runModeRoutines(mode) {
		if (!this.slothlet.config?.autoRoutines) return;
		const routines = this.#routines.filter((routine) => routine.mode === mode);
		if (routines.length === 0) return;
		for (const routine of routines) {
			await this.#materializeFor(routine);
		}
		await this.rebuildStacks(this.slothlet.api);
		for (const routine of routines) {
			// Sequential-by-contract: routines run in declared order, each fully drained.
			// skipMaterialize: true — the loop above already force-materialized this exact routine;
			// letting runCascade() do it again would re-walk the same tree for no new information.
			await this.runCascade(routine.name, true);
		}
	}

	/**
	 * Run every configured `mode: "shutdown"` routine's cascade. Called from the framework's
	 * existing dispose builtin (`createShutdownFunction()` in api_builder.mjs) — the
	 * `"shutdown"`-mode integration point the spec calls "the existing dispose path". Covers the
	 * default `shutdown` routine and any custom-named `mode: "shutdown"` routine alike.
	 *
	 * @description
	 * TEMPORARY v3-compat gate (#341): a no-op unless `config.autoRoutines` is `true` (its
	 * deprecated alias is `collectLifecycleHooks`, which also expands into an implicit
	 * `mode: "shutdown"` routine — see `Config.normalizeRoutines`). Every routine is always
	 * stacked/wrapped regardless of this flag — `self.<path>()` is always directly callable — only
	 * the AUTOMATIC firing at dispose is gated, so that a project upgrading to a slothlet version
	 * carrying #341 sees no behavior change by default. Planned for v4: default `autoRoutines` to
	 * `true` and remove `collectLifecycleHooks` — do not lose track of this before that release.
	 * @returns {Promise<void>}
	 * @public
	 */
	async runShutdownModeRoutines() {
		return this.#runModeRoutines("shutdown");
	}

	/**
	 * Run every configured `mode: "destroy"` routine's cascade. Called from the framework's
	 * existing dispose builtin (`createDestroyFunction()` in api_builder.mjs) — the "existing
	 * dispose path" for `destroy`, replacing what used to be a separate `_collectLifecycleHooks
	 * ("destroy")` walk. `destroy()` also calls the root `shutdown()` afterward, so
	 * `mode: "shutdown"` routines still run as part of `destroy()` too — this only covers routines
	 * a consumer wants to fire on `destroy()` specifically, not on a plain `shutdown()`.
	 *
	 * @description
	 * Same TEMPORARY v3-compat `autoRoutines` gate as {@link runShutdownModeRoutines} — see that
	 * method's description for the full rationale and the v4 migration plan.
	 * @returns {Promise<void>}
	 * @public
	 */
	async runDestroyModeRoutines() {
		return this.#runModeRoutines("destroy");
	}

	/**
	 * Run every configured `mode: "startup"` routine's cascade. Called once, as the final awaited
	 * step of `load()` — `await slothlet(...)` resolves only after this completes.
	 *
	 * @description
	 * Same TEMPORARY v3-compat `autoRoutines` gate as {@link runShutdownModeRoutines} — see that
	 * method's description for the full rationale and the v4 migration plan. Wrapping still always
	 * happens; only automatic firing is gated.
	 * @returns {Promise<void>}
	 * @public
	 */
	async runStartupModeRoutines() {
		return this.#runModeRoutines("startup");
	}

	/**
	 * Resolve a dotted path against the composed api object, force-materializing any unmaterialized
	 * lazy-mode node encountered along the way.
	 *
	 * @description
	 * Without this, a path that is still an unmaterialized lazy wrapper when {@link rebuildStacks}
	 * writes its stacked callable would have that write silently discarded the moment something
	 * else later triggers materialization — materializing re-derives the node's properties from its
	 * source module, overwriting whatever was assigned before. Forcing materialization here first
	 * (mirroring `_collectLifecycleHooks`'s own lazy-materialize-first pattern) means the write
	 * always lands on a stable node.
	 * @param {object} api - Composed api (or any subtree) to resolve against.
	 * @param {string} path - Dotted path (`""` resolves to `api` itself).
	 * @returns {Promise<*>} The resolved node, or `undefined` if any segment is missing or fails to materialize.
	 * @private
	 */
	async #resolveContainer(api, path) {
		if (path === "") return api;
		let node = api;
		for (const part of path.split(".")) {
			if (node === null || node === undefined) return undefined;
			try {
				node = node[part];
			} catch {
				// Best-effort: a permission-gated (or otherwise read-guarded) segment must not abort
				// the caller's cascade — treat it exactly like a missing segment.
				return undefined;
			}
			const wrapper = resolveWrapper(node);
			if (wrapper && wrapper.____slothletInternal.mode === "lazy" && !wrapper.____slothletInternal.state.materialized) {
				try {
					await wrapper._materialize();
				} catch {
					return undefined;
				}
			}
		}
		return node;
	}

	/**
	 * Build the stacked callable for one exact api path — invoking each of that path's contributors
	 * in registration order, sequentially, awaiting each. Branded with `__slothletRoutineStack` as a
	 * public introspection marker (`fn.__slothletRoutineStack === true` identifies a
	 * routine-managed callable) — no longer load-bearing for double-invoke prevention since
	 * `collectLifecycleHooks` now expands into ordinary routines (see `Config.normalizeRoutines`)
	 * rather than running a separate parallel walk.
	 * @param {string} apiPath - Exact composed api path.
	 * @param {object} routine - The routine config this callable is built for, threaded into
	 *   {@link runPath} so its entry filtering can't cross into a different routine sharing the
	 *   same exact apiPath (#366 review).
	 * @returns {Function} The stacked callable.
	 * @private
	 */
	#buildStackedCallable(apiPath, routine) {
		const manager = this;
		const stacked = async function slothletRoutineStack(...args) {
			return manager.runPath(apiPath, args, routine);
		};
		Object.defineProperty(stacked, "__slothletRoutineStack", { value: true, enumerable: false });
		return stacked;
	}

	/**
	 * Build the root-cascade callable for a routine.
	 * @param {string} name - Routine name.
	 * @returns {Function} The cascade callable.
	 * @private
	 */
	#buildCascadeCallable(name) {
		const manager = this;
		const cascade = async function slothletRoutineCascade() {
			return manager.runCascade(name);
		};
		Object.defineProperty(cascade, "__slothletRoutineStack", { value: true, enumerable: false });
		return cascade;
	}

	/**
	 * Overwrite every currently-known matching api path's slot on the live api tree with its
	 * stacked callable, and (re)attach every configured routine's root cascade at the api root and
	 * under `api.slothlet` (using the routine's `name` verbatim as the property key — a dotted or
	 * `^`-prefixed name is reachable via bracket notation, e.g. `api.slothlet["admin.initialize"]`,
	 * `api["^ext.*.initialize"]`; only a bare name gets clean dot-notation access).
	 *
	 * @description
	 * Safe to call repeatedly — at the end of initial `load()`, and again after every
	 * `api.slothlet.api.add()` — it re-derives every path from current state. A path whose
	 * container no longer resolves (its owning module was removed without ever un-registering) is
	 * silently skipped rather than throwing: teardown ordering across removal + rebuild is
	 * best-effort, not a correctness guarantee this feature makes.
	 *
	 * Guards writes with `recording = false`: the property write below re-enters `onImplCreated`
	 * via the same `impl:created` event ordinary module writes go through, and without the guard
	 * the stacked callable being installed would be captured as a phantom contributor on the very
	 * next rebuild.
	 * @param {object} api - The fully composed, bound api object.
	 * @returns {Promise<void>}
	 * @public
	 */
	async rebuildStacks(api) {
		if (!api || (typeof api !== "object" && typeof api !== "function")) return;
		this.recording = false;
		try {
			for (const routine of this.#routines) {
				const groups = this.#groupByPath(this.#contributorsFor(routine.name));
				for (const apiPath of groups.keys()) {
					const lastDot = apiPath.lastIndexOf(".");
					const parentPath = lastDot === -1 ? "" : apiPath.slice(0, lastDot);
					const key = lastDot === -1 ? apiPath : apiPath.slice(lastDot + 1);
					if (parentPath === "" && ROOT_BUILTIN_NAMES.has(key)) continue; // integrated via the existing dispose builtins instead
					const target = await this.#resolveContainer(api, parentPath);
					if (target === null || target === undefined || (typeof target !== "object" && typeof target !== "function")) continue;
					try {
						target[key] = this.#buildStackedCallable(apiPath, routine);
					} catch {
						// Best-effort: a target that refuses the write (frozen, permission-gated) is left as-is.
					}
				}

				if (ROOT_BUILTIN_NAMES.has(routine.name)) continue; // integrated via the existing dispose builtins instead
				const cascade = this.#buildCascadeCallable(routine.name);
				try {
					api[routine.name] = cascade;
				} catch {
					// Best-effort — see above.
				}
				if (api.slothlet && (typeof api.slothlet === "object" || typeof api.slothlet === "function")) {
					try {
						api.slothlet[routine.name] = cascade;
					} catch {
						// Best-effort — see above.
					}
				}
			}
		} finally {
			this.recording = true;
		}
	}
}
