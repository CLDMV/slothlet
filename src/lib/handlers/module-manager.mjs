/**
 *	@Project: @cldmv/slothlet
 *	@Filename: /src/lib/handlers/module-manager.mjs
 *	@Author: Nate Corcoran <CLDMV>
 *	@Copyright: Copyright (c) 2013-2026 Catalyzed Motivation Inc. All rights reserved.
 */

/**
 * @fileoverview Module discovery + mount handler.
 * @module @cldmv/slothlet/handlers/module-manager
 * @internal
 *
 * @description
 * Wraps the pure discovery / sort helpers with per-instance cache state and
 * exposes the addModule / addModules / removeModule mount methods. Discovery
 * results are cached on this handler so addModule(name) can resolve names
 * against a prior discover() call without re-walking the filesystem.
 *
 * Mounts go through `slothlet.handlers.apiManager.addApiComponent()` directly
 * (handler-to-handler), the same way slothlet's own load flow does. That call
 * accepts `collisionMode` from internal callers — only the public
 * `api.slothlet.api.add()` wrapper strips it. External code cannot reach
 * `addApiComponent` through the public api surface, so the public/internal
 * split is the security boundary; no per-call token is needed here.
 *
 * Pre-flight collision detection is exact-match only per S7: ancestor /
 * descendant overlap is permitted and merges per slothlet's standard
 * collisionMode behavior.
 */

import { ComponentBase } from "@cldmv/slothlet/factories/component-base";
import { SlothletError } from "@cldmv/slothlet/errors";
import { discoverModules } from "@cldmv/slothlet/helpers/module-discovery";
import { sortModules } from "@cldmv/slothlet/helpers/module-sort";

/**
 * Default collision policy passed to slothlet's underlying `addApiComponent()`
 * call. Matches slothlet's own default (`"merge"`) so the helper does not
 * impose stricter intermediate-namespace behavior than the host configured.
 *
 * Exact-mountPath collision detection runs separately as a pre-flight check
 * in `#mountSingle()` per S7 — that throws `MODULE_MOUNT_COLLISION` whether
 * the underlying collision mode is "merge" or "error". Ancestor/descendant
 * overlap (per S7's resolution) flows through slothlet's underlying mode.
 *
 * @type {string}
 */
const DEFAULT_MODULE_COLLISION_MODE = "merge";

/**
 * @typedef {import("../helpers/module-discovery.mjs").DiscoverResult} DiscoverResult
 * @typedef {import("../helpers/module-discovery.mjs").DiscoverOptions} DiscoverOptions
 */

/**
 * @typedef {object} AddModuleOptions
 * @property {string} [collisionMode="error"] - One of "skip"|"warn"|"replace"|"merge"|"merge-replace"|"error". Per-mount override; defaults to "error".
 * @property {string} [version] - When the discovery cache holds multiple versions of the same `name`, mount only the entry whose package.json version matches.
 * @property {DiscoverOptions} [discover] - Options to forward to the lazy discover() call if the cache is empty. Ignored when the cache already holds data.
 */

/**
 * @typedef {object} AddModulesOptions
 * @property {string} [collisionMode="error"] - Per-call collision policy passed to every mount.
 * @property {"throw"|"rollback"|"best-effort"} [onFailure="throw"] - Failure policy. `throw` (default): throw on first failure, leave mounted entries in place. `rollback`: throw on first failure, remove every entry mounted in this call. `best-effort`: collect failures, return aggregate `{ mounted, failed }`.
 * @property {number} [concurrency=1] - Mount concurrency. `1` (default) = serial. Higher values mount in parallel batches.
 */

/**
 * @typedef {object} MountResult
 * @property {string} packageName
 * @property {string} mountPath - Dot-notation path used at the time of mount.
 * @property {string} moduleID - moduleID returned by api.add().
 * @property {DiscoverResult} discoverResult
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
	static slothletProperty = "moduleManager";

	/**
	 * Per-(packageName + version) cache of validated discovery results.
	 * Keyed by `${packageName}@${version}`. Populated by `discover()` and
	 * `addDiscovered()`; consumed by `addModule(name)` for name-based mounts.
	 * @type {Map<string, DiscoverResult>}
	 * @private
	 */
	#cache = new Map();

	/**
	 * Records of modules mounted via this manager. Keyed by `${packageName}@${version}`.
	 * Tracks moduleID + the mountPath used so removeModule() can resolve a name
	 * back to its mount and so re-discover can detect stale mounts.
	 * @type {Map<string, MountResult>}
	 * @private
	 */
	#mounted = new Map();

	/**
	 * @param {object} slothlet - Parent slothlet instance.
	 */
	constructor(slothlet) {
		super(slothlet);
	}

	// ─── Discovery ─────────────────────────────────────────────────────────

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
	async discover(options = {}) {
		await this.#emit("modules:discover-start", { scanRoot: options.scanRoot, options });
		const found = await discoverModules(options);
		this.#cache.clear();
		for (const result of found) {
			const key = `${result.packageName}@${result.manifest.version}`;
			this.#cache.set(key, result);
		}
		await this.#emit("modules:discover-complete", {
			found,
			stale: this.getStaleMounts()
		});
		return found;
	}

	/**
	 * Pure sort wrapper. Forwards to `sortModules()` without touching cache state.
	 *
	 * @param {DiscoverResult[]} results
	 * @param {(a: DiscoverResult, b: DiscoverResult) => number} [comparator]
	 * @returns {DiscoverResult[]}
	 */
	sort(results, comparator) {
		return sortModules(results, comparator);
	}

	/**
	 * Return the list of modules currently in the discovery cache.
	 * @returns {DiscoverResult[]}
	 */
	getDiscoveryCache() {
		return [...this.#cache.values()];
	}

	/**
	 * Empty the discovery cache. Does not affect already-mounted modules.
	 * @returns {void}
	 */
	clearDiscoveryCache() {
		this.#cache.clear();
	}

	/**
	 * Compute the stale-mount set per S3b: mounted modules that did not surface
	 * in the most recent `discover()` cache. Host calls this after re-discovery
	 * to decide what to unmount.
	 *
	 * @returns {MountResult[]} Mounts whose `${packageName}@${version}` is no longer in the cache.
	 */
	getStaleMounts() {
		const stale = [];
		for (const [key, mountResult] of this.#mounted) {
			if (!this.#cache.has(key)) {
				stale.push(mountResult);
			}
		}
		return stale;
	}

	// ─── Mount ─────────────────────────────────────────────────────────────

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
	async addModule(nameOrResult, options = {}) {
		const collisionMode = options.collisionMode ?? DEFAULT_MODULE_COLLISION_MODE;
		const discoverResult = await this.#resolveToDiscoverResult(nameOrResult, options);
		await this.#emit("modules:mount-start", { items: [nameOrResult], options });
		// addModule is single-item by contract — no multi-version routing here
		// (a single DiscoverResult cannot be "multiple versions of itself").
		// Callers that want multi-version mounting use addModules with the
		// resolved DiscoverResult[] of every version.
		const mountResult = await this.#mountSingle(discoverResult, collisionMode, null);
		await this.#emit("modules:loaded", { mounted: [mountResult] });
		return mountResult;
	}

	/**
	 * Mount a list of modules.
	 *
	 * @param {Array<string|DiscoverResult>} items - Heterogeneous array; strings resolved through the discovery cache.
	 * @param {AddModulesOptions} [options]
	 * @returns {Promise<MountResult[] | {mounted: MountResult[], failed: FailureEntry[]}>} Plain array under `throw`/`rollback`; aggregate object under `best-effort`.
	 */
	async addModules(items, options = {}) {
		if (!Array.isArray(items)) {
			throw new SlothletError(
				"INVALID_ARGUMENT",
				{
					argument: "items",
					expected: "array of string|DiscoverResult",
					received: typeof items
				},
				null,
				{ validationError: true }
			);
		}
		const onFailure = options.onFailure ?? "throw";
		const concurrency = Math.max(1, Number(options.concurrency) || 1);
		const collisionMode = options.collisionMode ?? DEFAULT_MODULE_COLLISION_MODE;

		if (!["throw", "rollback", "best-effort"].includes(onFailure)) {
			throw new SlothletError(
				"INVALID_ARGUMENT",
				{
					argument: "onFailure",
					expected: "throw|rollback|best-effort",
					received: String(onFailure)
				},
				null,
				{ validationError: true }
			);
		}

		// Resolve all items to DiscoverResults up front so name lookups happen
		// once. Cache misses surface as MODULE_PACKAGE_NOT_FOUND now, before
		// any mount runs — easier to roll back nothing than something.
		const resolved = [];
		for (const item of items) {
			resolved.push(await this.#resolveToDiscoverResult(item, options));
		}

		// G7 multi-version mounting (case 2): if the resolved set has two or
		// more entries sharing a packageName, route every entry in that group
		// through slothlet's versionConfig so each lands at a versioned mount
		// path (and a dispatcher at the plain mountPath routes between them).
		// Highest semver in each group becomes the registered default version.
		const versionConfigs = this.#buildVersionConfigs(resolved);

		await this.#emit("modules:mount-start", { items, options });
		let outcome;
		if (concurrency === 1) {
			outcome = await this.#mountSerial(resolved, collisionMode, onFailure, versionConfigs);
		} else {
			outcome = await this.#mountParallel(resolved, collisionMode, onFailure, concurrency, versionConfigs);
		}
		// Emit modules:loaded with the same shape returned to the caller.
		// For throw/rollback, outcome is the mounted array; for best-effort, it's the aggregate.
		const loadedPayload = Array.isArray(outcome)
			? { mounted: outcome }
			: { mounted: outcome.mounted, failed: outcome.failed };
		await this.#emit("modules:loaded", loadedPayload);
		return outcome;
	}

	/**
	 * Unmount a previously-mounted module by package name (and optional version
	 * when multi-version mounts are in play).
	 *
	 * @param {string} name - Package name.
	 * @param {object} [opts]
	 * @param {string} [opts.version] - Disambiguator when more than one mounted entry shares the name.
	 * @returns {Promise<boolean>} `true` when something was unmounted, `false` when no matching mount was found.
	 */
	async removeModule(name, opts = {}) {
		const matches = [];
		for (const [key, mountResult] of this.#mounted) {
			if (mountResult.packageName !== name) continue;
			if (opts.version !== undefined && mountResult.discoverResult.manifest.version !== opts.version) continue;
			matches.push({ key, mountResult });
		}
		if (matches.length === 0) return false;
		for (const { key, mountResult } of matches) {
			await this.slothlet.handlers.apiManager.removeApiComponent(mountResult.moduleID);
			this.#mounted.delete(key);
		}
		return true;
	}

	// ─── Private helpers ───────────────────────────────────────────────────

	/**
	 * Resolve a `string|DiscoverResult` argument to a `DiscoverResult`, lazily
	 * triggering `discover()` if the cache is empty and the argument is a name.
	 * @param {string|DiscoverResult} arg
	 * @param {object} options - Passed through to lazy discover().
	 * @returns {Promise<DiscoverResult>}
	 * @throws {SlothletError} `MODULE_PACKAGE_NOT_FOUND` when a name cannot be resolved after discovery.
	 * @private
	 */
	async #resolveToDiscoverResult(arg, options) {
		if (arg && typeof arg === "object" && typeof arg.packageName === "string") {
			return arg;
		}
		if (typeof arg !== "string") {
			throw new SlothletError(
				"INVALID_ARGUMENT",
				{
					argument: "module name or DiscoverResult",
					expected: "string or DiscoverResult object",
					received: typeof arg
				},
				null,
				{ validationError: true }
			);
		}

		// Cache miss + lazy discover (G8 lazy-discover-on-empty fallback).
		if (this.#cache.size === 0) {
			await this.discover(options.discover ?? {});
		}

		const candidates = [];
		for (const result of this.#cache.values()) {
			if (result.packageName !== arg) continue;
			if (options.version !== undefined && result.manifest.version !== options.version) continue;
			candidates.push(result);
		}
		if (candidates.length === 0) {
			throw new SlothletError(
				"MODULE_PACKAGE_NOT_FOUND",
				{
					packageName: arg,
					hint: "addModule(name) requires the package to be installed under one of the scanned roots. Run discover() first, or pass a DiscoverResult object directly."
				},
				null,
				{ validationError: true }
			);
		}
		if (candidates.length > 1) {
			// Multi-version cache hit + no version disambiguator. addModules
			// handles this by mounting each version; addModule wants exactly one.
			throw new SlothletError(
				"INVALID_ARGUMENT",
				{
					argument: "version",
					expected: "version disambiguator (multi-version cache hit)",
					received: "undefined"
				},
				null,
				{ validationError: true }
			);
		}
		return candidates[0];
	}

	/**
	 * Mount a single DiscoverResult via apiManager.addApiComponent().
	 * Performs the S7 pre-flight collision check (against the effective path
	 * when a versionConfig is supplied) before calling.
	 *
	 * @param {DiscoverResult} discoverResult
	 * @param {string} collisionMode
	 * @param {{version: string, default: boolean}|null} versionConfig - When non-null, mount under the versioned prefix per G7 multi-version handling.
	 * @returns {Promise<MountResult>}
	 * @private
	 */
	async #mountSingle(discoverResult, collisionMode, versionConfig) {
		const mountPathDotted = discoverResult.mountPath.join(".");
		const effectiveMountPath = versionConfig?.version ? `${versionConfig.version}.${mountPathDotted}` : mountPathDotted;

		// S7 helper-layer collision enforcement: the caller-supplied
		// `collisionMode` controls exact-mountPath collision policy at this
		// layer. "error" throws MODULE_MOUNT_COLLISION when the EFFECTIVE
		// mount path (including any version prefix) is occupied. All other
		// modes defer to slothlet's underlying behavior; ancestor/descendant
		// overlap is permitted per S7.
		//
		// The value passed DOWN to slothlet's addApiComponent is always
		// "merge". Slothlet's collisionMode "error" mode at the runtime add
		// path has issues with intermediate-namespace creation, so the helper
		// fully owns the collision policy via the pre-flight check.
		if (collisionMode === "error") {
			const existing = this.#findExactMountAt(effectiveMountPath);
			if (existing) {
				throw new SlothletError(
					"MODULE_MOUNT_COLLISION",
					{
						packageName: discoverResult.packageName,
						mountPath: effectiveMountPath,
						existingModuleID: existing.moduleID,
						collisionMode
					},
					null,
					{ validationError: true }
				);
			}
		}

		const version = discoverResult.manifest.version;
		const underlyingCollisionMode = collisionMode === "error" ? "merge" : collisionMode;

		const moduleID = await this.slothlet.handlers.apiManager.addApiComponent({
			apiPath: mountPathDotted,
			folderPath: discoverResult.apiDir,
			options: {
				collisionMode: underlyingCollisionMode,
				metadata: { _module: { manifest: discoverResult.manifest } }
			},
			versionConfig: versionConfig ?? null
		});

		const result = {
			packageName: discoverResult.packageName,
			mountPath: effectiveMountPath,
			moduleID,
			discoverResult,
			versionConfig: versionConfig ?? null
		};
		this.#mounted.set(`${discoverResult.packageName}@${version}`, result);
		await this.#emit("modules:mount-complete", {
			name: discoverResult.packageName,
			version,
			mountPath: effectiveMountPath,
			moduleID
		});
		return result;
	}

	/**
	 * Build a per-item versionConfig map for `addModules` based on packageName
	 * grouping. Items that share a packageName with siblings in the same call
	 * each get a `{version: "vMAJOR", default}` config; the highest semver in
	 * each group is the registered default. Solo items get `null`.
	 *
	 * @param {DiscoverResult[]} resolved
	 * @returns {Map<number, {version: string, default: boolean} | null>} index → versionConfig
	 * @private
	 */
	#buildVersionConfigs(resolved) {
		/** @type {Map<string, DiscoverResult[]>} */ const byName = new Map();
		for (const r of resolved) {
			const list = byName.get(r.packageName) ?? [];
			list.push(r);
			byName.set(r.packageName, list);
		}

		/** @type {Map<string, string>} */ const highestByName = new Map();
		for (const [name, group] of byName) {
			if (group.length < 2) continue;
			const versions = group.map((r) => r.manifest.version);
			highestByName.set(name, pickHighestSemver(versions));
		}

		const configs = new Map();
		for (let i = 0; i < resolved.length; i++) {
			const r = resolved[i];
			const group = byName.get(r.packageName);
			if (!group || group.length < 2) {
				configs.set(i, null);
				continue;
			}
			const versionTag = semverToTag(r.manifest.version);
			const isDefault = r.manifest.version === highestByName.get(r.packageName);
			configs.set(i, { version: versionTag, default: isDefault });
		}
		return configs;
	}

	/**
	 * Emit a lifecycle event via slothlet's lifecycle handler when present.
	 * Silently no-ops if the lifecycle handler isn't wired (defensive — slothlet
	 * always registers it but the guard keeps the manager usable in isolation).
	 *
	 * @param {string} event
	 * @param {object} payload
	 * @returns {Promise<void>}
	 * @private
	 */
	async #emit(event, payload) {
		const lifecycle = this.slothlet?.handlers?.lifecycle;
		if (lifecycle && typeof lifecycle.emit === "function") {
			await lifecycle.emit(event, payload);
		}
	}

	/**
	 * Look up an existing mount at an exact dotted mountPath in api-manager's
	 * addHistory. Returns the most recent entry whose `apiPath` matches, or
	 * `null` if no such entry exists.
	 * @param {string} dottedPath
	 * @returns {object|null}
	 * @private
	 */
	#findExactMountAt(dottedPath) {
		const history = this.slothlet?.handlers?.apiManager?.state?.addHistory;
		if (!Array.isArray(history)) return null;
		for (let i = history.length - 1; i >= 0; i--) {
			const entry = history[i];
			if (entry?.apiPath === dottedPath) return entry;
		}
		return null;
	}

	/**
	 * @param {DiscoverResult[]} resolved
	 * @param {string} collisionMode
	 * @param {"throw"|"rollback"|"best-effort"} onFailure
	 * @returns {Promise<MountResult[] | {mounted: MountResult[], failed: FailureEntry[]}>}
	 * @private
	 */
	async #mountSerial(resolved, collisionMode, onFailure, versionConfigs) {
		const mounted = [];
		const failed = [];
		for (let i = 0; i < resolved.length; i++) {
			const item = resolved[i];
			try {
				const mountResult = await this.#mountSingle(item, collisionMode, versionConfigs?.get(i) ?? null);
				mounted.push(mountResult);
			} catch (err) {
				if (onFailure === "throw") {
					throw err;
				}
				if (onFailure === "rollback") {
					await this.#rollback(mounted);
					throw err;
				}
				// best-effort: record and continue
				failed.push({ item, error: err });
			}
		}
		if (onFailure === "best-effort") {
			return { mounted, failed };
		}
		return mounted;
	}

	/**
	 * Parallel mount with bounded concurrency. Lifecycle event order tracks
	 * completion order, not insertion order (callers who need strict order
	 * should use `concurrency: 1`).
	 * @param {DiscoverResult[]} resolved
	 * @param {string} collisionMode
	 * @param {"throw"|"rollback"|"best-effort"} onFailure
	 * @param {number} concurrency
	 * @returns {Promise<MountResult[] | {mounted: MountResult[], failed: FailureEntry[]}>}
	 * @private
	 */
	async #mountParallel(resolved, collisionMode, onFailure, concurrency, versionConfigs) {
		const mounted = [];
		const failed = [];
		let firstError = null;
		let nextIndex = 0;

		const worker = async () => {
			while (true) {
				if (firstError && onFailure !== "best-effort") return;
				const i = nextIndex++;
				if (i >= resolved.length) return;
				const item = resolved[i];
				try {
					const mountResult = await this.#mountSingle(item, collisionMode, versionConfigs?.get(i) ?? null);
					mounted.push(mountResult);
				} catch (err) {
					if (onFailure === "best-effort") {
						failed.push({ item, error: err });
					} else if (!firstError) {
						firstError = err;
					}
				}
			}
		};

		const workers = Array.from({ length: Math.min(concurrency, resolved.length) }, () => worker());
		await Promise.all(workers);

		if (firstError) {
			if (onFailure === "rollback") {
				await this.#rollback(mounted);
			}
			throw firstError;
		}
		if (onFailure === "best-effort") {
			return { mounted, failed };
		}
		return mounted;
	}

	/**
	 * Best-effort rollback: unmount every entry in the supplied list. Any
	 * removeApiComponent failures are swallowed; the original mount failure
	 * is what the caller cares about.
	 * @param {MountResult[]} mounted
	 * @returns {Promise<void>}
	 * @private
	 */
	async #rollback(mounted) {
		for (const m of mounted) {
			try {
				await this.slothlet.handlers.apiManager.removeApiComponent(m.moduleID);
				this.#mounted.delete(`${m.packageName}@${m.discoverResult.manifest.version}`);
			} catch {
				// Swallow rollback errors — propagating them would mask the original failure.
			}
		}
	}
}

/**
 * Convert a semver string to a slothlet version tag (`vMAJOR`).
 * Falls back to a `v<raw>` form for non-numeric leads so any string-shaped
 * version still produces a valid mount tag.
 *
 * @param {string} version
 * @returns {string}
 * @private
 */
function semverToTag(version) {
	const m = /^(\d+)/.exec(String(version));
	return m ? `v${m[1]}` : `v${version}`;
}

/**
 * Pick the highest semver-shaped version from a list. Compares numeric
 * segments left-to-right (major / minor / patch …). Non-numeric segments
 * sort as 0. Order is stable for equal values (first wins).
 *
 * @param {string[]} versions
 * @returns {string} The highest version, or the only version if length === 1.
 * @private
 */
function pickHighestSemver(versions) {
	if (versions.length === 1) return versions[0];
	const segs = (v) =>
		String(v)
			.split(/[.\-+]/)
			.map((p) => {
				const n = Number.parseInt(p, 10);
				return Number.isFinite(n) ? n : 0;
			});
	let best = versions[0];
	let bestSegs = segs(best);
	for (let i = 1; i < versions.length; i++) {
		const candidate = versions[i];
		const candidateSegs = segs(candidate);
		const len = Math.max(candidateSegs.length, bestSegs.length);
		let candidateWins = false;
		for (let j = 0; j < len; j++) {
			const a = candidateSegs[j] ?? 0;
			const b = bestSegs[j] ?? 0;
			if (a > b) {
				candidateWins = true;
				break;
			}
			if (a < b) break;
		}
		if (candidateWins) {
			best = candidate;
			bestSegs = candidateSegs;
		}
	}
	return best;
}

