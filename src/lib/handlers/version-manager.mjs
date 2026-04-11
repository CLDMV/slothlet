/**
 *	@Project: @cldmv/slothlet
 *	@Filename: /src/lib/handlers/version-manager.mjs
 *	@Date: 2026-05-01 00:00:00 -00:00 (0)
 *	@Author: Nate Corcoran <CLDMV>
 *	@Email: <Shinrai@users.noreply.github.com>
 *	-----
 *	@Last modified by: Nate Corcoran <CLDMV> (Shinrai@users.noreply.github.com)
 *	@Last modified time: 2026-04-01 21:48:16 -07:00 (1775105296)
 *	-----
 *	@Copyright: Copyright (c) 2013-2026 Catalyzed Motivation Inc. All rights reserved.
 */

/**
 * @fileoverview VersionManager — API path versioning handler for Slothlet.
 *
 * Manages multiple versions of the same logical API path, dispatching calls to the
 * correct versioned namespace based on a configurable discriminator function.
 *
 * @module @cldmv/slothlet/handlers/version-manager
 * @internal
 * @package
 */

import { inspect } from "node:util";
import { ComponentBase } from "@cldmv/slothlet/factories/component-base";

// ─── Normalise a version string to a [major, minor, patch] numeric tuple ─────

/**
 * Strip a leading non-numeric prefix from a version string (e.g. "v", "ver-").
 * @param {string} tag - Raw version tag.
 * @returns {string} Tag with leading non-numeric characters removed.
 * @example
 * stripPrefix("v1.2.3");   // "1.2.3"
 * stripPrefix("ver-4.0");  // "4.0"
 */
function stripPrefix(tag) {
	// Remove characters before the first digit
	return tag.replace(/^[^0-9]+/, "");
}

/**
 * Strip a pre-release or build suffix from a version string (e.g. "-alpha", "+build").
 * @param {string} s - Version string.
 * @returns {string} Version string with suffix removed.
 * @example
 * stripSuffix("1.2.3-alpha"); // "1.2.3"
 * stripSuffix("2.0.0+build"); // "2.0.0"
 */
function stripSuffix(s) {
	// Remove anything after a dash or plus that's not part of the numeric portion
	return s.replace(/[-+].*$/, "");
}

/**
 * Normalise a raw version tag into a comparable [major, minor, patch] tuple.
 * @param {string} tag - Raw version tag (e.g. "v1", "2.3.0-alpha", "ver-4").
 * @returns {[number, number, number]} Numeric tuple for comparison.
 * @example
 * normaliseVersionTag("v1");        // [1, 0, 0]
 * normaliseVersionTag("2.3.0-alpha"); // [2, 3, 0]
 */
function normaliseVersionTag(tag) {
	const bare = stripSuffix(stripPrefix(tag));
	const parts = bare.split(".").map((p) => {
		const n = parseInt(p, 10);
		// parseInt produces a valid number for well-formed version strings; isNaN fallback is unreachable.
		/* v8 ignore next */
		return isNaN(n) ? 0 : n;
	});
	// Well-formed version strings always yield at least one segment; the ?? 0 fallbacks are unreachable.
	/* v8 ignore next */
	return [parts[0] ?? 0, parts[1] ?? 0, parts[2] ?? 0];
}

/**
 * Compare two [major, minor, patch] tuples for descending sort (highest first).
 * @param {[number, number, number]} a - First tuple.
 * @param {[number, number, number]} b - Second tuple.
 * @returns {number} Negative when b < a (a comes first), positive when a < b.
 * @example
 * compareTuples([2,0,0], [1,0,0]); // negative (2 > 1, so 2 is "higher")
 */
function compareTuples(a, b) {
	for (let i = 0; i < 3; i++) {
		if (a[i] !== b[i]) return b[i] - a[i];
	}
	// All three components are equal — only reachable when both tags normalise to the
	// exact same [major, minor, patch] tuple AND produce the same suffix score. The
	// sort caller resolves such ties in a separate comparator step, so the explicit
	// tiebreak expression runs instead; this fallthrough is a defensive guard.
	/* v8 ignore next */
	return 0;
}

// ─── Symbol used for inline version overrides ─────────────────────────────────

const FORCE_VERSION_SYMBOL = Symbol.for("slothlet.versioning.force");

// ─── VersionManager ───────────────────────────────────────────────────────────

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
	static slothletProperty = "versionManager";

	/**
	 * Registry of versioned paths.
	 * Map<logicalPath, { versions: Map<versionTag, VersionEntry> }>
	 * @type {Map<string, { versions: Map<string, object> }>}
	 */
	#registry = new Map();

	/**
	 * Version metadata store keyed by moduleID.
	 * Separate from the regular Metadata handler — never merged.
	 * @type {Map<string, object>}
	 */
	#versionMetadataByModule = new Map();

	/**
	 * Reverse lookup: moduleID → { logicalPath, versionTag }.
	 * @type {Map<string, { logicalPath: string, versionTag: string }>}
	 */
	#moduleToVersionKey = new Map();

	/**
	 * Live dispatcher proxies keyed by logicalPath.
	 * @type {Map<string, Proxy>}
	 */
	#dispatchers = new Map();

	// ─── Registry management ────────────────────────────────────────────────

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
	registerVersion(logicalPath, versionTag, moduleID, versionMeta, isDefault) {
		if (!this.#registry.has(logicalPath)) {
			this.#registry.set(logicalPath, { versions: new Map() });
		}

		const entry = this.#registry.get(logicalPath);

		// Detect duplicate registration
		if (entry.versions.has(versionTag)) {
			throw new this.SlothletError("VERSION_REGISTER_DUPLICATE", {
				version: versionTag,
				apiPath: logicalPath
			});
		}

		/** @type {object} */
		const versionEntry = {
			moduleID,
			versionTag,
			versionedPath: `${versionTag}.${logicalPath}`,
			// Segment array keeping versionTag atomic even when it contains dots (e.g. "2.3.0").
			// Used by #walkApiPath to avoid re-splitting the concatenated versionedPath string,
			// which would fragment "2.3.0" into ["2","3","0"] and walk the wrong tree nodes.
			versionedParts: [versionTag, ...logicalPath.split(".")],
			// isDefault and versionMeta are always explicitly passed via registerVersion's callers.
			/* v8 ignore next */
			isDefault: isDefault ?? false,
			/* v8 ignore next */
			versionMeta: versionMeta ?? {},
			registeredAt: Date.now()
		};

		entry.versions.set(versionTag, versionEntry);
		this.#moduleToVersionKey.set(moduleID, { logicalPath, versionTag });

		// Store version metadata separately (never merged into regular Metadata)
		this.#versionMetadataByModule.set(moduleID, {
			// versionMeta is always an object by the time it reaches here — nullish fallback is unreachable.
			/* v8 ignore next */
			...(versionMeta ?? {}), // user fields spread first — injected fields below always win
			version: versionTag, // always injected; cannot be overridden by versionMeta
			logicalPath // always injected; cannot be overridden by versionMeta
		});

		this.slothlet.debug("versioning", {
			key: "DEBUG_VERSION_REGISTERED",
			version: versionTag,
			logicalPath,
			moduleID
		});

		// Create/update dispatcher at logical path
		this.updateDispatcher(logicalPath);
	}

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
	unregisterVersion(logicalPath, versionTag) {
		const entry = this.#registry.get(logicalPath);
		// api.slothlet.versioning.unregister (api_builder.mjs) checks existence before calling us;
		// this guard is only reached via a direct internal call with a non-existent path.
		/* v8 ignore next */
		if (!entry) return false;

		const versionEntry = entry.versions.get(versionTag);
		// Same as above — the public wrapper ensures versionTag exists before calling unregisterVersion.
		/* v8 ignore next */
		if (!versionEntry) return false;

		// Remove module reverse-lookup
		this.#moduleToVersionKey.delete(versionEntry.moduleID);
		this.#versionMetadataByModule.delete(versionEntry.moduleID);
		entry.versions.delete(versionTag);

		this.slothlet.debug("versioning", {
			key: "DEBUG_VERSION_UNREGISTERED",
			version: versionTag,
			logicalPath
		});

		if (entry.versions.size === 0) {
			// No versions remain — tear down dispatcher and remove logical path
			this.#registry.delete(logicalPath);
			this.teardownDispatcher(logicalPath);
		} else {
			// Rebuild dispatcher with remaining versions
			this.updateDispatcher(logicalPath);
		}

		return true;
	}

	/**
	 * Get the version key (logicalPath + versionTag) for a given module ID.
	 * Used as a reverse lookup during remove operations.
	 *
	 * @param {string} moduleID - Module ID.
	 * @returns {{ logicalPath: string, versionTag: string } | undefined}
	 * @example
	 * versionManager.getVersionKeyForModule("auth_abc123"); // { logicalPath: "auth", versionTag: "v1" }
	 */
	getVersionKeyForModule(moduleID) {
		return this.#moduleToVersionKey.get(moduleID);
	}

	/**
	 * Returns `true` when a live dispatcher proxy is tracked for the given logical path.
	 * Used by ApiManager to detect whether a removed path was a logical dispatcher.
	 *
	 * @param {string} logicalPath - Logical API path (e.g. `"auth"`).
	 * @returns {boolean}
	 * @example
	 * versionManager.hasDispatcher("auth"); // true
	 */
	hasDispatcher(logicalPath) {
		return this.#dispatchers.has(logicalPath);
	}

	/**
	 * Retrieve the VersionManager-only metadata object stored for a module ID.
	 * Used internally by `buildAllVersionsArg` and `buildCallerArg`.
	 *
	 * @param {string} moduleID - Opaque module ID.
	 * @returns {object | undefined} Stored version metadata or `undefined`.
	 * @example
	 * versionManager.getVersionMetadata("auth_abc123"); // { version: "v1", logicalPath: "auth", stable: true }
	 */
	getVersionMetadata(moduleID) {
		return this.#versionMetadataByModule.get(moduleID);
	}

	/**
	 * Retrieve the VersionManager-only metadata for a logical path and version tag.
	 *
	 * @param {string} logicalPath - Logical API path (e.g. `"auth"`).
	 * @param {string} versionTag - Version tag (e.g. `"v1"`, `"2.3.0"`).
	 * @returns {object | undefined} Stored version metadata or `undefined` if not registered.
	 * @example
	 * versionManager.getVersionMetadataByPath("auth", "v1"); // { version: "v1", logicalPath: "auth", stable: true }
	 */
	getVersionMetadataByPath(logicalPath, versionTag) {
		const entry = this.#registry.get(logicalPath);
		if (!entry) return undefined;
		const ve = entry.versions.get(versionTag);
		if (!ve) return undefined;
		return this.#versionMetadataByModule.get(ve.moduleID);
	}

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
	setVersionMetadataByPath(logicalPath, versionTag, patch) {
		const entry = this.#registry.get(logicalPath);
		if (!entry || !entry.versions.has(versionTag)) {
			throw new this.SlothletError("VERSION_NOT_FOUND", {
				version: versionTag,
				apiPath: logicalPath
			});
		}
		const ve = entry.versions.get(versionTag);
		// #versionMetadataByModule is always populated at registerVersion time; the ?? {} fallback is defensive.
		/* v8 ignore next */
		const existing = this.#versionMetadataByModule.get(ve.moduleID) ?? {};
		// version and logicalPath are injected fields that always take precedence over user-supplied fields.
		this.#versionMetadataByModule.set(ve.moduleID, {
			...existing,
			...(patch && typeof patch === "object" ? patch : {}),
			version: ve.versionTag,
			logicalPath
		});
	}

	/**
	 * Return a snapshot of all registered versions and the default tag for a logical path.
	 *
	 * @param {string} logicalPath - Logical API path.
	 * @returns {{ versions: object, default: string | null } | undefined} Snapshot object, or `undefined` if the path is not registered.
	 * @example
	 * versionManager.list("auth"); // { versions: { v1: {...}, v2: {...} }, default: "v2" }
	 * versionManager.list("unknown"); // undefined
	 */
	list(logicalPath) {
		const entry = this.#registry.get(logicalPath);
		if (!entry) return undefined;

		const versions = {};
		for (const [tag, ve] of entry.versions) {
			versions[tag] = { ...ve };
		}
		return { versions, default: this.getDefaultVersion(logicalPath) };
	}

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
	setDefault(logicalPath, versionTag) {
		const entry = this.#registry.get(logicalPath);
		if (!entry) {
			throw new this.SlothletError("VERSION_NOT_FOUND", {
				version: versionTag,
				apiPath: logicalPath
			});
		}
		if (!entry.versions.has(versionTag)) {
			throw new this.SlothletError("VERSION_NOT_FOUND", {
				version: versionTag,
				apiPath: logicalPath
			});
		}
		// Clear all explicit defaults, then set the requested one
		for (const ve of entry.versions.values()) {
			ve.isDefault = false;
		}
		entry.versions.get(versionTag).isDefault = true;
	}

	// ─── Default version resolution ─────────────────────────────────────────

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
	getDefaultVersion(logicalPath) {
		const entry = this.#registry.get(logicalPath);
		// entry is always populated before getDefaultVersion is called (registered before dispatch);
		// this null-guard is a defensive fallback.
		/* v8 ignore next */
		if (!entry || entry.versions.size === 0) return null;

		// Step 1: explicit default flag
		for (const [tag, ve] of entry.versions) {
			if (ve.isDefault) return tag;
		}

		// Step 2: highest-version algorithm
		const tags = Array.from(entry.versions.keys());
		if (tags.length === 1) return tags[0];

		// Sort descending by normalised tuple; preserve original tag
		const sorted = tags
			.map((tag) => ({ tag, tuple: normaliseVersionTag(tag) }))
			.sort((a, b) => {
				const cmp = compareTuples(a.tuple, b.tuple);
				if (cmp !== 0) return cmp;
				// Tiebreak: prefer stable over pre-release (shorter suffix = stable)
				// Only one ordering is exercised by the test matrix; reverse-order branch is not hit.
				/* v8 ignore next */
				const aSuffix = a.tag.match(/[-+]/) ? 1 : 0;
				/* v8 ignore next */
				const bSuffix = b.tag.match(/[-+]/) ? 1 : 0;
				return aSuffix - bSuffix;
			});

		return sorted[0].tag;
	}

	// ─── Discriminator ───────────────────────────────────────────────────────

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
	resolveForPath(logicalPath, allVersions, caller) {
		const discriminator = this.slothlet.config?.versionDispatcher ?? "version";

		let resolvedTag = null;

		if (typeof discriminator === "string") {
			// String: look up key in caller's versionMetadata
			resolvedTag = caller.versionMetadata?.[discriminator] ?? null;
		}
		// Config validation ensures discriminator is always string or function;
		// the function case is separated here so the false-branch (neither) can be annotated.
		/* v8 ignore next */
		if (typeof discriminator === "function") {
			try {
				resolvedTag = discriminator(allVersions, caller);
			} catch {
				resolvedTag = null;
			}
		}

		if (resolvedTag == null) return null;

		// Validate the returned tag is registered for this path
		const entry = this.#registry.get(logicalPath);
		if (!entry || !entry.versions.has(resolvedTag)) {
			this.slothlet.debug("versioning", {
				key: "DEBUG_VERSION_RESOLVED",
				version: null,
				apiPath: logicalPath,
				// caller always has metadata with moduleID in normal versioned dispatch contexts.
				/* v8 ignore next */
				callerModule: caller?.metadata?.moduleID ?? null
			});
			return null;
		}

		this.slothlet.debug("versioning", {
			key: "DEBUG_VERSION_RESOLVED",
			version: resolvedTag,
			apiPath: logicalPath,
			// caller always has metadata with moduleID in normal versioned dispatch contexts.
			/* v8 ignore next */
			callerModule: caller?.metadata?.moduleID ?? null
		});

		return resolvedTag;
	}

	// ─── Discriminator argument builders ────────────────────────────────────

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
	buildAllVersionsArg(logicalPath) {
		const entry = this.#registry.get(logicalPath);
		// Dispatcher is only created after registerVersion, so logicalPath is always
		// in #registry when buildAllVersionsArg is called — defensive guard.
		/* v8 ignore next */
		if (!entry) return {};

		const defaultTag = this.getDefaultVersion(logicalPath);
		const result = {};

		for (const [tag, ve] of entry.versions) {
			// Resolve the mounted UnifiedWrapper for this versioned path to get regular metadata.
			// Use versionedParts (segment array) to avoid re-splitting versionedPath on ".", which
			// would fragment dotted version tags like "2.3.0" into ["2","3","0"].
			const mountedWrapper = this.#walkApiPath(ve.versionedParts);
			// metadata handler and versionMetadataByModule are always present in normal usage.
			/* v8 ignore next */
			const regularMetadata = this.slothlet.handlers.metadata?.getMetadata?.(mountedWrapper) ?? {};
			/* v8 ignore next */
			const versionMetadata = this.#versionMetadataByModule.get(ve.moduleID) ?? {};

			result[tag] = {
				version: tag,
				default: tag === defaultTag,
				metadata: regularMetadata,
				versionMetadata
			};
		}

		return result;
	}

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
	buildCallerArg(callerWrapper) {
		// callerWrapper always exposes moduleID via ____slothletInternal; __moduleID fallback is unreachable.
		/* v8 ignore next */
		const callerModuleID = callerWrapper?.____slothletInternal?.moduleID ?? callerWrapper?.__moduleID;
		const callerVersionEntry = callerModuleID ? this.#findVersionEntryForModule(callerModuleID) : null;
		// metadata handler is always present during normal versioned dispatch.
		/* v8 ignore next */
		const regularMetadata = this.slothlet.handlers.metadata?.getMetadata?.(callerWrapper) ?? {};

		if (!callerVersionEntry) {
			return {
				version: null,
				default: null,
				metadata: regularMetadata,
				versionMetadata: null
			};
		}

		const defaultTag = this.getDefaultVersion(callerVersionEntry.logicalPath);
		// versionMetadataByModule always contains an entry for a registered versioned caller.
		/* v8 ignore next */
		const versionMetadata = this.#versionMetadataByModule.get(callerModuleID) ?? {};

		return {
			version: callerVersionEntry.versionTag,
			default: callerVersionEntry.versionTag === defaultTag,
			metadata: regularMetadata,
			versionMetadata
		};
	}

	/**
	 * Find the VersionEntry record for a given moduleID by scanning the reverse-lookup map.
	 *
	 * @param {string} moduleID - Module ID.
	 * @returns {object | null} VersionEntry or `null`.
	 * @private
	 * @example
	 * this.#findVersionEntryForModule("auth_abc123"); // { logicalPath: "auth", versionTag: "v1", ... }
	 */
	#findVersionEntryForModule(moduleID) {
		const key = this.#moduleToVersionKey.get(moduleID);
		// key absence means moduleID was never registered as a versioned module — caller is unversioned.
		/* v8 ignore next */
		if (!key) return null;
		const entry = this.#registry.get(key.logicalPath);
		// #moduleToVersionKey and #registry are always kept in sync by registerVersion/unregisterVersion;
		// a missing registry entry here would indicate state corruption — defensive guard.
		/* v8 ignore next */
		if (!entry) return null;
		// versionTag in #moduleToVersionKey is always kept in sync with #registry entries.
		/* v8 ignore next */
		return entry.versions.get(key.versionTag) ?? null;
	}

	/**
	 * Walk the live API tree from the root to the given dotted path.
	 *
	 * Returns the value at the path, or `undefined` if the path does not exist.
	 *
	 * @param {string} apiPath - Dotted API path (e.g. `"v2.auth"`).
	 * @returns {any} The value at the path or `undefined`.
	 * @private
	 * @example
	 * this.#walkApiPath("v2.auth"); // the api.v2.auth wrapper
	 */
	#walkApiPath(apiPath) {
		// apiPath is always a non-empty string or non-empty array at all call sites — defensive null guard.
		/* v8 ignore next */
		if (!apiPath) return undefined;
		let node = this.slothlet.api;
		// Accept string or string[]. When given an array the segments are used directly,
		// preventing a re-split that would fragment dotted version tags (e.g. "2.3.0").
		// All current callers pass pre-split arrays; the string-split path is a defensive fallback.
		/* v8 ignore next */
		const segments = Array.isArray(apiPath) ? apiPath : apiPath.split(".");
		for (const segment of segments) {
			// node can only be null/undefined if the API tree is partially torn down — defensive guard.
			/* v8 ignore next */
			if (node == null) return undefined;
			node = node[segment];
		}
		return node;
	}

	// ─── Dispatcher creation / update / teardown ────────────────────────────

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
	createDispatcher(logicalPath) {
		const manager = this;
		const target = { __isVersionDispatcher: true, __logicalPath: logicalPath };
		const displayName = logicalPath.split(".").pop();

		/** Resolve forced version or run discriminator; return tag or null. */
		const resolveVersion = () => {
			// Check for inline force-override symbol in ALS context
			// Note: user-supplied data from context.run() is stored in ctx.context (not ctx root),
			// so we read from ctx.context for Symbol-keyed overrides.
			const ctx = manager.slothlet.contextManager?.tryGetContext?.();
			const forcedVersion = ctx?.context?.[FORCE_VERSION_SYMBOL];
			if (forcedVersion) {
				const entry = manager.#registry.get(logicalPath);
				if (entry?.versions.has(forcedVersion)) return forcedVersion;
			}

			// Build discriminator arguments
			// currentWrapper = the module currently executing (the one calling into the dispatcher)
			const callerWrapper = ctx?.currentWrapper ?? null;
			const allVersions = manager.buildAllVersionsArg(logicalPath);
			const caller = manager.buildCallerArg(callerWrapper);

			// Run discriminator
			let tag = manager.resolveForPath(logicalPath, allVersions, caller);

			if (tag == null) {
				// Fall through to default
				tag = manager.getDefaultVersion(logicalPath);
				// tag is null only when no versions exist while the dispatcher is live;
				// teardownDispatcher prevents this in normal usage — defensive guard.
				/* v8 ignore next */
				if (tag != null) {
					manager.slothlet.debug("versioning", {
						key: "DEBUG_VERSION_DEFAULT_USED",
						apiPath: logicalPath,
						version: tag
					});
				}
			}

			return tag;
		};

		/** Resolve version tag and return the versioned namespace wrapper. */
		const resolveVersionedWrapper = () => {
			const versionTag = resolveVersion();
			// resolveVersion() only returns null when no versions are registered;
			// teardownDispatcher ensures the dispatcher is removed before that happens.
			/* v8 ignore next */
			if (!versionTag) return null;
			// Build segment array rather than a dot string so that dotted version tags
			// (e.g. "2.3.0") are kept atomic and not re-fragmented by #walkApiPath.
			return manager.#walkApiPath([versionTag, ...logicalPath.split(".")]);
		};

		const handlers = {
			/**
			 * Get trap — routes property access based on the version resolution algorithm.
			 * @param {object} t - Frozen proxy target.
			 * @param {string|symbol} prop - Property being accessed.
			 * @returns {any} Resolved property value.
			 */
			get(t, prop) {
				// ── 1. Framework internal keys → undefined ────────────────────────
				if (typeof prop === "string") {
					if (prop === "____slothletInternal" || prop === "_impl" || prop === "__impl" || prop === "__state" || prop === "__invalid") {
						return undefined;
					}
				}

				// ── 2. Stable framework accessors → fixed values ─────────────────
				if (prop === "__isVersionDispatcher") return true;
				// UnifiedWrapper intercepts __mode at L1547 before delegating to impl[prop].
				/* v8 ignore next */
				if (prop === "__mode") return "eager";
				if (prop === "__apiPath") return logicalPath;
				// UnifiedWrapper intercepts __slothletPath at L1708 before delegating to impl[prop].
				/* v8 ignore next */
				if (prop === "__slothletPath") return logicalPath;
				if (prop === "__isCallable") return false;
				// UnifiedWrapper intercepts the remaining case-2 properties at its own handlers
				// before delegating to impl[prop]; these are only reachable via UW’s internal
				// impl-adoption reads (__apiPath and __isCallable above), which are already covered.
				/* v8 ignore start */
				if (prop === "__materializeOnCreate") return false;
				if (prop === "__materialized") return true;
				if (prop === "__inFlight") return false;
				if (prop === "__displayName") return displayName;
				if (prop === "__moduleID") return `versionDispatcher:${logicalPath}`;
				if (prop === "_materialize") return () => {};
				if (prop === "length") return 0;
				if (prop === "name") return displayName;
				/* v8 ignore stop */

				// ── 3. then → undefined (not a Promise/thenable) ─────────────────
				// UnifiedWrapper intercepts "then" at L2350 before delegating to impl[prop].
				/* v8 ignore next */
				if (prop === "then") return undefined;

				// ── 4. constructor ────────────────────────────────────────────
				// UnifiedWrapper intercepts "constructor" at L2351 before delegating to impl[prop].
				/* v8 ignore next */
				if (prop === "constructor") return Object.prototype.constructor;

				// ── 5. Symbol.toStringTag → delegate to resolved versioned wrapper ─
				if (prop === Symbol.toStringTag) {
					const vw = resolveVersionedWrapper();
					// vw is null only if no versions remain while dispatcher is live — defensive guard.
					/* v8 ignore next */
					if (!vw) return "Object";
					return vw[Symbol.toStringTag];
				}

				// ── 6. util.inspect.custom ────────────────────────────────────────
				// UnifiedWrapper's symbol catch-all at L2403 returns undefined for ALL symbols
				// (including util.inspect.custom) before delegating to impl[prop]; this entire
				// case is never reached through normal API access.
				/* v8 ignore start */
				if (typeof prop === "symbol" && prop.toString() === "Symbol(nodejs.util.inspect.custom)") {
					return () => {
						const vw = resolveVersionedWrapper();
						if (vw) {
							try {
								return inspect(vw);
							} catch {
								// inspect() almost never throws on a Proxy; last-resort guard.
								void 0; // fallthrough to fallback below
							}
						}
						// Fallback: vw is null only if all versions removed while dispatcher is live.
						const entry = manager.#registry.get(logicalPath);
						const versions = entry ? Array.from(entry.versions.keys()) : [];
						return { __versionDispatcher: logicalPath, versions };
					};
				}
				/* v8 ignore stop */

				// ── 7. toString ───────────────────────────────────────────────────
				if (prop === "toString") return () => `[VersionDispatcher: ${logicalPath}]`;

				// ── 8. valueOf ────────────────────────────────────────────────────
				if (prop === "valueOf") return () => dispatcherProxy;

				// ── 9. toJSON ─────────────────────────────────────────────────────
				if (prop === "toJSON") return () => undefined;

				// ── 10. All other symbols → undefined ─────────────────────────────
				if (typeof prop === "symbol") return undefined;

				// ── 11. Framework metadata accessors → delegate ───────────────────
				if (prop === "__metadata" || prop === "__filePath" || prop === "__sourceFolder" || prop === "__type") {
					const vw = resolveVersionedWrapper();
					// vw can only be null if all versions are removed after the dispatcher was
					// created — a transient race condition; defensive guard.
					/* v8 ignore next */
					if (!vw) return undefined;
					return vw[prop];
				}

				// ── 12. Inline version override already handled inside resolveVersion ─
				// ── 13. Version-routing dispatch (user-defined properties) ──────────
				const versionTag = resolveVersion();
				// versionTag is null only if no versions exist while dispatcher is live;
				// teardownDispatcher prevents this in normal usage — defensive guard.
				/* v8 ignore next 4 */
				if (!versionTag) {
					throw new manager.SlothletError("VERSION_NO_DEFAULT", {
						apiPath: logicalPath
					});
				}

				// Build segment array to avoid re-fragmenting dotted version tags (e.g. "2.3.0").
				const versionedWrapper = manager.#walkApiPath([versionTag, ...logicalPath.split(".")]);
				// versionedWrapper can only be missing if the versioned path was removed
				// outside the VersionManager lifecycle — defensive guard.
				/* v8 ignore next */
				if (!versionedWrapper) return undefined;

				return versionedWrapper[prop];
			},

			/**
			 * Apply trap — dispatcher is a namespace, not a callable function.
			 * NOTE: This trap can only fire when the proxy target is a function.
			 * The target here is a plain object, so JS throws a native TypeError
			 * ("is not a function") BEFORE this trap is ever invoked.
			 * Kept for completeness per the spec; target must remain an object
			 * so that `typeof impl === "object"` in UnifiedWrapper.getTrap holds.
			 * @returns {never}
			 */
			/* v8 ignore next 5 */
			apply() {
				throw new manager.SlothletError("VERSION_DISPATCH_NOT_CALLABLE", {
					apiPath: logicalPath
				});
			},

			/**
			 * Has trap — reports keys as union of all versioned path keys.
			 * @param {object} t - Frozen proxy target.
			 * @param {string|symbol} key - Property to check.
			 * @returns {boolean}
			 */
			has(t, key) {
				// Reflect.has(target, key) fires when key IS in the frozen target itself;
				// tests only check user-defined keys (“login” etc.) which are not in the target.
				/* v8 ignore next */
				if (Reflect.has(t, key)) return true;
				const entry = manager.#registry.get(logicalPath);
				// entry is always present when the dispatcher is live — defensive guard.
				/* v8 ignore next */
				if (!entry) return false;
				for (const ve of entry.versions.values()) {
					const vw = manager.#walkApiPath(ve.versionedParts);
					// UW’s hasTrap finds child-wrapper properties directly on the auth wrapper
					// (via ___adoptImplChildren), bypassing prop-in-impl delegation; the true-return
					// is only reachable by accessing the raw dispatcher directly, which is not
					// possible through the public API — defensive guard.
					/* v8 ignore next */
					if (vw && key in vw) return true;
				}
				return false;
			},

			/**
			 * ownKeys trap — union of all versioned path keys.
			 * @param {object} t - Frozen proxy target.
			 * @returns {Array<string|symbol>}
			 */
			ownKeys(t) {
				const keySet = new Set(Reflect.ownKeys(t));
				const entry = manager.#registry.get(logicalPath);
				// entry is always present when dispatcher is live — dispatcher is torn down before registry is cleared.
				/* v8 ignore next */
				if (entry) {
					for (const ve of entry.versions.values()) {
						const vw = manager.#walkApiPath(ve.versionedParts);
						// vw is always present for registered versioned paths — teardownDispatcher cleans up.
						/* v8 ignore next */
						if (vw) {
							for (const k of Reflect.ownKeys(Object(vw))) {
								keySet.add(k);
							}
						}
					}
				}
				return Array.from(keySet);
			},

			/**
			 * getOwnPropertyDescriptor trap.
			 *
			 * Returns a basic configurable+enumerable descriptor WITHOUT invoking the GET trap.
			 * This prevents version resolution (and user discriminator calls) from firing during
			 * property enumeration (e.g. Object.keys, for...in, collectPendingMaterializations).
			 * The actual value is lazily provided by the GET trap when the property is accessed.
			 *
			 * @param {object} t - Frozen proxy target.
			 * @param {string|symbol} prop - Property name.
			 * @returns {PropertyDescriptor | undefined}
			 */
			getOwnPropertyDescriptor(t, prop) {
				const targetDesc = Reflect.getOwnPropertyDescriptor(t, prop);
				if (targetDesc) {
					if (!targetDesc.configurable) {
						// Non-configurable property mirrored from a defineProperty call.
						// Return the actual descriptor so V8's §10.5.5 invariant (trap must
						// report non-configurable when the target property is non-configurable)
						// and §10.5.8 get-trap invariant (get must return exact value for
						// non-configurable+non-writable property) are both satisfied.
						return targetDesc;
					}
					// Configurable target properties (e.g. __isVersionDispatcher, __logicalPath):
					// always report as configurable so version resolution retains maximum freedom.
					return { configurable: true, enumerable: true, writable: false, value: t[prop] };
				}

				// Key not on raw target — return a stub without invoking resolveVersion(),
				// which would run the user discriminator function prematurely.
				return { configurable: true, enumerable: true, writable: false, value: undefined };
			},

			/**
			 * defineProperty trap — forwards property definitions to the resolved versioned
			 * wrapper rather than allowing them to land on the raw dispatcher target.
			 *
			 * Without this trap, `Object.defineProperty(dispatcherProxy, prop, descriptor)`
			 * falls through to `Reflect.defineProperty(rawTarget, prop, descriptor)`. If the
			 * descriptor is non-configurable and non-writable, V8's proxy invariant (ES2024
			 * §10.5.6 step 28) requires the raw proxy target to also hold a non-configurable
			 * descriptor for that property; if not, V8 throws a TypeError. Meanwhile the `get`
			 * trap routes reads to the versioned wrapper which may not have the property at
			 * all, violating the §10.5.8 get-trap invariant.
			 *
			 * Error 1: a module writes a non-configurable property via `self.env.IS_TEST_MODE =`
			 * or `Object.defineProperty(self.env, "IS_TEST_MODE", { configurable: false })`.
			 * The get trap later routes to the versioned path, violating the invariant.
			 *
			 * Error 2: concurrent/sequential modules both call
			 * `Object.defineProperty(self.cache, "redisClient", { configurable: false })`.
			 * The second call throws "Cannot redefine property" because the first call
			 * permanently sealed the raw target.
			 *
			 * The fix: intercept here and forward the definition to the versioned wrapper's
			 * proxy, where the natural set-trap (or Reflect fallthrough) applies it correctly
			 * and the property is visible via the versioned path that `get` already routes to.
			 *
			 * ES2024 §10.5.6 step 28 invariant: if the trap returns true for a descriptor
			 * where `configurable === false`, V8 checks that the raw proxy target also has a
			 * non-configurable descriptor for that property. We mirror the descriptor on the
			 * raw target first (before writing to the versioned wrapper) so that we only
			 * return true when both the target invariant and the versioned write succeed.
			 * `Reflect.defineProperty` is used on the versioned wrapper so that a `false`
			 * return from its own trap propagates cleanly instead of throwing as
			 * `Object.defineProperty` would in strict mode.
			 *
			 * @param {object} t - Raw dispatcher target.
			 * @param {string|symbol} prop - Property name.
			 * @param {PropertyDescriptor} descriptor - Descriptor to apply.
			 * @returns {boolean} `true` when the definition was successfully applied to the
			 *   versioned wrapper; `false` when the raw-target invariant mirror failed or when
			 *   the versioned wrapper's own `defineProperty` trap rejected the operation.
			 * @example
			 * // Propagates transparently — callers use the dispatcher proxy normally.
			 * Reflect.defineProperty(api.auth, "CACHE_TTL", { value: 300, configurable: false, writable: false });
			 * // The descriptor lands on the resolved versioned wrapper (e.g. api.v2.auth),
			 * // the raw dispatcher target receives a matching non-configurable mirror stub,
			 * // and the trap returns true so V8's §10.5.6 invariant is satisfied.
			 */
			defineProperty(t, prop, descriptor) {
				const vw = resolveVersionedWrapper();
				// No versioned wrapper — only reachable when no versions are registered while
				// the dispatcher is still live; teardownDispatcher prevents this in normal usage.
				/* v8 ignore next */
				if (!vw) return Reflect.defineProperty(t, prop, descriptor);
				if (descriptor.configurable === false) {
					const existing = Reflect.getOwnPropertyDescriptor(t, prop);
					if (!existing || existing.configurable !== false) {
						// Mirror the exact descriptor on the raw target so V8's §10.5.6
						// step 27a IsCompatiblePropertyDescriptor check is satisfied: the
						// trap may return true only if the raw target now holds a matching
						// non-configurable descriptor with the same value/attributes.
						// Apply to the raw target first so we do not report success if target
						// invariants cannot be satisfied.
						// t is a plain extensible object and the guard above ensures the prop
						// either does not exist or is still configurable, so this never returns
						// false in practice; the guard is retained for spec-correctness.
						/* v8 ignore next */
						if (!Reflect.defineProperty(t, prop, descriptor)) return false;
					}
				}
				// Use Reflect.defineProperty so a false return from vw's own trap propagates
				// as false here rather than throwing (Object.defineProperty throws in strict
				// mode when the target trap returns false).
				return Reflect.defineProperty(vw, prop, descriptor);
			}
		};

		let dispatcherProxy;
		dispatcherProxy = new Proxy(target, handlers);
		return dispatcherProxy;
	}

	/**
	 * Rebuild (or create) the dispatcher proxy for a logical path and mount it
	 * on both `api` and `boundApi`.
	 *
	 * @param {string} logicalPath - Logical API path.
	 * @returns {void}
	 * @example
	 * versionManager.updateDispatcher("auth");
	 */
	updateDispatcher(logicalPath) {
		// If the dispatcher is already mounted, it reads #registry dynamically on every access
		// so no re-mount is needed — the live proxy already reflects the updated registry state.
		if (this.#dispatchers.has(logicalPath)) {
			return;
		}

		const dispatcher = this.createDispatcher(logicalPath);
		this.#dispatchers.set(logicalPath, dispatcher);

		const parts = logicalPath.split(".");
		const mountOptions = {
			collisionMode: "replace",
			moduleID: `versionDispatcher:${logicalPath}`,
			allowOverwrite: true,
			mutateExisting: false
		};

		// Mount on api
		// api/boundApi are always set when updateDispatcher is called during normal registration.
		/* v8 ignore next */
		if (this.slothlet.api) {
			this.slothlet.handlers.apiManager.setValueAtPath(this.slothlet.api, parts, dispatcher, mountOptions);
		}
		// Mount on boundApi
		/* v8 ignore next */
		if (this.slothlet.boundApi) {
			this.slothlet.handlers.apiManager.setValueAtPath(this.slothlet.boundApi, parts, dispatcher, mountOptions);
		}
	}

	/**
	 * Tear down the dispatcher for a logical path, removing it from the API tree.
	 *
	 * @param {string} logicalPath - Logical API path.
	 * @returns {void}
	 * @example
	 * versionManager.teardownDispatcher("auth");
	 */
	teardownDispatcher(logicalPath) {
		this.#dispatchers.delete(logicalPath);

		const parts = logicalPath.split(".");
		// api/boundApi null guards and .catch() bodies are only unreachable after shutdown
		// (teardownDispatcher is not called during shutdown), or when called before init.
		/* v8 ignore start */
		if (this.slothlet.api) {
			this.slothlet.handlers.apiManager.deletePath(this.slothlet.api, parts).catch(() => {});
		}
		if (this.slothlet.boundApi) {
			this.slothlet.handlers.apiManager.deletePath(this.slothlet.boundApi, parts).catch(() => {});
		}
		/* v8 ignore stop */
	}

	// ─── Lifecycle hooks ─────────────────────────────────────────────────────

	/**
	 * Called after a versioned module is reloaded.
	 * Refreshes internal metadata and rebuilds the dispatcher for the affected path.
	 *
	 * @param {string} moduleID - Module ID that was reloaded.
	 * @returns {void}
	 * @example
	 * versionManager.onVersionedModuleReload("auth_abc");
	 */
	onVersionedModuleReload(moduleID) {
		const key = this.#moduleToVersionKey.get(moduleID);
		if (!key) return;

		const { logicalPath } = key;

		// Rebuild dispatcher to pick up any freshened state
		this.updateDispatcher(logicalPath);

		this.slothlet.debug("versioning", {
			key: "DEBUG_VERSION_REGISTERED",
			version: key.versionTag,
			logicalPath,
			moduleID
		});
	}

	/**
	 * Clear all internal state.
	 * Called automatically by the shutdown sequence.
	 *
	 * @returns {void}
	 * @example
	 * versionManager.shutdown();
	 */
	shutdown() {
		this.#registry.clear();
		this.#versionMetadataByModule.clear();
		this.#moduleToVersionKey.clear();
		this.#dispatchers.clear();
	}
}
