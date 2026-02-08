/**
 *	@Project: @cldmv/slothlet
 *	@Filename: /src/lib/handlers/api-cache-manager.mjs
 *	@Date: 2026-02-06 17:30:00 -08:00 (1770450600)
 *	@Author: Nate Hyson <CLDMV>
 *	@Email: <Shinrai@users.noreply.github.com>
 *	-----
 *	@Last modified by: Nate Hyson <CLDMV> (Shinrai@users.noreply.github.com)
 *	@Last modified time: 2026-02-06 19:24:00 -08:00 (1770434640)
 *	-----
 *	@Copyright: Copyright (c) 2013-2026 Catalyzed Motivation Inc. All rights reserved.
 */

/**
 * @fileoverview API cache management for hot reload and module lifecycle
 * @module @cldmv/slothlet/handlers/api-cache-manager
 * @package
 *
 * @description
 * Manages complete buildAPI result caches per moduleID. The cache system is the single
 * source of truth for all API trees - the live API references cached trees, not copies.
 * Each cache stores the complete buildAPI result with all parameters needed for rebuild.
 *
 * @example
 * const cache = slothlet.handlers.apiCacheManager;
 * cache.set("base_abc123", {
 *   endpoint: ".",
 *   api: apiTree,
 *   folderPath: "./src",
 *   mode: "lazy"
 * });
 * const baseApi = cache.get("base_abc123").api; // Get API from cache
 */
import { ComponentBase } from "@cldmv/slothlet/factories/component-base";

/**
 * Manages API caches - complete buildAPI results per moduleID
 * @class ApiCacheManager
 * @extends ComponentBase
 * @public
 *
 * @description
 * Stores complete API trees for each moduleID with all rebuild parameters.
 * The cache is the PRIMARY storage - live API references cached trees.
 * Enables hot reload by rebuilding caches from disk and updating live references.
 *
 * @example
 * const cacheManager = new ApiCacheManager(slothlet);
 * cacheManager.set("module_abc", { api: tree, folderPath: "./plugins", ... });
 */
export class ApiCacheManager extends ComponentBase {
	static slothletProperty = "apiCacheManager";

	/**
	 * Create ApiCacheManager instance
	 * @param {object} slothlet - Slothlet instance
	 * @public
	 */
	constructor(slothlet) {
		super(slothlet);

		/**
		 * Cache storage - moduleID → CacheEntry
		 * @type {Map<string, CacheEntry>}
		 * @private
		 *
		 * CacheEntry structure:
		 * {
		 *   endpoint: string,         // API path endpoint (e.g., ".", "plugins")
		 *   moduleID: string,          // Module identifier
		 *   api: Object,               // Complete buildAPI result tree (PRIMARY STORAGE)
		 *   folderPath: string,        // Source folder path
		 *   mode: string,              // lazy/eager
		 *   sanitizeOptions: Object,   // Sanitization config
		 *   collisionMode: string,     // Collision handling mode
		 *   config: Object,            // Config snapshot at add time
		 *   timestamp: number          // Cache creation time
		 * }
		 */
		this.caches = new Map();
	}

	/**
	 * Store cache entry for moduleID
	 * @param {string} moduleID - Module identifier
	 * @param {CacheEntry} entry - Cache entry with api tree and rebuild parameters
	 * @returns {void}
	 * @public
	 *
	 * @description
	 * Stores complete buildAPI result. The cached API tree becomes the source of truth.
	 * Existing references should point to entry.api, not copy it.
	 *
	 * @example
	 * cache.set("base_abc123", {
	 *   endpoint: ".",
	 *   moduleID: "base_abc123",
	 *   api: apiTree,
	 *   folderPath: this.config.dir,
	 *   mode: "lazy",
	 *   sanitizeOptions: {},
	 *   collisionMode: "merge",
	 *   config: {...this.config},
	 *   timestamp: Date.now()
	 * });
	 */
	set(moduleID, entry) {
		if (!moduleID || typeof moduleID !== "string") {
			throw new this.SlothletError("INVALID_ARGUMENT", {
				argument: "moduleID",
				expected: "non-empty string",
				received: typeof moduleID,
				validationError: true
			});
		}

		if (!entry || !entry.api) {
			throw new this.SlothletError("INVALID_ARGUMENT", {
				argument: "entry.api",
				expected: "API tree object",
				received: typeof entry?.api,
				validationError: true
			});
		}

		// Ensure moduleID matches entry
		if (entry.moduleID && entry.moduleID !== moduleID) {
			throw new this.SlothletError("CACHE_MODULEID_MISMATCH", {
				cacheKey: moduleID,
				entryModuleID: entry.moduleID,
				validationError: true
			});
		}

		this.caches.set(moduleID, entry);

		this.slothlet.debug("cache", {
			message: "Cache entry stored",
			moduleID,
			endpoint: entry.endpoint,
			mode: entry.mode,
			timestamp: entry.timestamp
		});
	}

	/**
	 * Get cache entry by moduleID
	 * @param {string} moduleID - Module identifier
	 * @returns {CacheEntry|undefined} Cache entry or undefined if not found
	 * @public
	 *
	 * @example
	 * const cache = cacheManager.get("base_abc123");
	 * if (cache) {
	 *   const api = cache.api; // Get API tree from cache
	 * }
	 */
	get(moduleID) {
		return this.caches.get(moduleID);
	}

	/**
	 * Check if cache exists for moduleID
	 * @param {string} moduleID - Module identifier
	 * @returns {boolean} True if cache exists
	 * @public
	 *
	 * @example
	 * if (cacheManager.has("base_abc123")) {
	 *   // Cache exists
	 * }
	 */
	has(moduleID) {
		return this.caches.has(moduleID);
	}

	/**
	 * Delete cache entry by moduleID
	 * @param {string} moduleID - Module identifier
	 * @returns {boolean} True if cache was deleted
	 * @public
	 *
	 * @description
	 * Removes cache entry. Should be called when module is removed via api.remove(moduleID).
	 *
	 * @example
	 * cacheManager.delete("plugins_abc123");
	 */
	delete(moduleID) {
		const deleted = this.caches.delete(moduleID);

		if (deleted) {
			this.slothlet.debug("cache", {
				message: "Cache entry deleted",
				moduleID
			});
		}

		return deleted;
	}

	/**
	 * Get all moduleIDs in cache
	 * @returns {string[]} Array of moduleIDs
	 * @public
	 *
	 * @example
	 * const moduleIDs = cacheManager.getAllModuleIDs();
	 * // ["base_abc123", "plugins_xyz789", ...]
	 */
	getAllModuleIDs() {
		return Array.from(this.caches.keys());
	}

	/**
	 * Get cache diagnostics
	 * @returns {object} Diagnostic information
	 * @public
	 *
	 * @description
	 * Returns diagnostic data about cached modules. Available under api.slothlet.diag.caches
	 * when config.debug.diagnostics is enabled.
	 *
	 * @example
	 * const diag = cacheManager.getCacheDiagnostics();
	 * // {
	 * //   totalCaches: 3,
	 * //   caches: [
	 * //     { moduleID: "base_abc123", endpoint: ".", pathCount: 42, timestamp: ... },
	 * //     ...
	 * //   ]
	 * // }
	 */
	getCacheDiagnostics() {
		const caches = [];

		for (const [moduleID, entry] of this.caches.entries()) {
			// Count paths in API tree
			const pathCount = this._countPaths(entry.api);

			caches.push({
				moduleID,
				endpoint: entry.endpoint,
				folderPath: entry.folderPath,
				mode: entry.mode,
				pathCount,
				timestamp: entry.timestamp
			});
		}

		return {
			totalCaches: this.caches.size,
			caches
		};
	}

	/**
	 * Count API paths in a tree
	 * @param {object} api - API tree
	 * @param {WeakSet} [visited] - Visited objects (prevent circular refs)
	 * @returns {number} Number of paths
	 * @private
	 */
	_countPaths(api, visited = new WeakSet()) {
		if (!api || typeof api !== "object" || visited.has(api)) {
			return 0;
		}

		visited.add(api);
		let count = 0;

		for (const [key, value] of Object.entries(api)) {
			// Skip internal properties
			if (key.startsWith("__") || key.startsWith("_")) {
				continue;
			}

			count += 1;

			if (value && typeof value === "object") {
				count += this._countPaths(value, visited);
			}
		}

		return count;
	}

	/**
	 * Clear all caches
	 * @returns {void}
	 * @public
	 *
	 * @description
	 * Removes all cache entries. Used during shutdown or full reload.
	 *
	 * @example
	 * cacheManager.clear();
	 */
	clear() {
		this.caches.clear();

		this.slothlet.debug("cache", {
			message: "All caches cleared"
		});
	}

	/**
	 * Rebuild cache from disk by calling buildAPI with stored parameters
	 * @param {string} moduleID - Module identifier to rebuild
	 * @returns {Promise<object>} Fresh API tree from buildAPI
	 * @public
	 *
	 * @description
	 * Reloads module source files and rebuilds API tree. Does NOT update cache -
	 * caller must call set() with fresh tree. Returns the new API tree.
	 *
	 * @example
	 * const freshApi = await cacheManager.rebuildCache("plugins_abc123");
	 * cacheManager.set("plugins_abc123", { ...existingEntry, api: freshApi, timestamp: Date.now() });
	 */
	async rebuildCache(moduleID) {
		const entry = this.get(moduleID);

		if (!entry) {
			throw new this.SlothletError("CACHE_NOT_FOUND", {
				moduleID,
				validationError: true
			});
		}

		this.slothlet.debug("cache", {
			message: "Rebuilding cache from disk",
			moduleID,
			folderPath: entry.folderPath,
			mode: entry.mode
		});

		// Build fresh API with stored parameters
		// CRITICAL: Always use "eager" mode for rebuilds to ensure all implementations
		// are fully materialized. The fresh API values will be set on existing wrappers
		// (which may be lazy), so we need actual impl values, not lazy proxies.
		// CRITICAL: collisionContext must match the initial load context.
		// For base modules (endpoint "."), use "initial" — the same context used during load().
		// For addApi modules, use "addApi". Using "core" would cause config.collision["core"]
		// to be undefined, falling back to "merge" and producing different collision outcomes.
		// CRITICAL: Pass a cacheBust timestamp so dynamic import() returns fresh module objects.
		// Without cache-busting, the Node.js module cache returns the SAME function reference
		// used by the live API, and applyRootContributor's Object.assign overwrites the live
		// API's properties with fresh wrappers (destroying custom properties and proxy identity).
		// The moduleID itself must remain unchanged for ownership/metadata consistency.
		const freshApi = await this.slothlet.builders.builder.buildAPI({
			dir: entry.folderPath,
			mode: "eager",
			sanitize: entry.sanitizeOptions,
			moduleID: moduleID,
			apiPathPrefix: entry.endpoint === "." ? "" : entry.endpoint,
			collisionMode: entry.collisionMode,
			collisionContext: entry.endpoint === "." ? "initial" : "addApi",
			cacheBust: Date.now()
		});

		this.slothlet.debug("cache", {
			message: "Cache rebuilt successfully",
			moduleID,
			timestamp: Date.now()
		});

		return freshApi;
	}
}
