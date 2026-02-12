/**
 *	@Project: @cldmv/slothlet
 *	@Filename: /src/lib/handlers/ownership.mjs
 *	@Date: 2026-01-20 20:25:54 -08:00 (1737432354)
 *	@Author: Nate Hyson <CLDMV>
 *	@Email: <Shinrai@users.noreply.github.com>
 *	-----
 *	@Last modified by: Nate Hyson <CLDMV> (Shinrai@users.noreply.github.com)
 *	@Last modified time: 2026-02-07 15:31:00 -08:00 (1770507060)
 *	-----
 *	@Copyright: Copyright (c) 2013-2026 Catalyzed Motivation Inc. All rights reserved.
 */

/**
 * @fileoverview Centralized ownership tracking for hot reload
 * @module @cldmv/slothlet/ownership
 */
import { ComponentBase } from "@cldmv/slothlet/factories/component-base";

/**
 * Tracks which modules own which API paths for hot reload and rollback
 * @class OwnershipManager
 * @extends ComponentBase
 * @public
 */
export class OwnershipManager extends ComponentBase {
	static slothletProperty = "ownership";

	constructor(slothlet) {
		super(slothlet);
		this.moduleToPath = new Map(); // moduleID → Set<apiPath>
		this.pathToModule = new Map(); // apiPath → Array<{moduleID, source, timestamp, value}>
		this._unregisteredModules = new Set(); // moduleIDs that have been explicitly unregistered
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
			existingEntry.value = value;
			if (filePath !== null) {
				existingEntry.filePath = filePath;
			}
			return existingEntry;
		}

		const entry = {
			moduleID,
			source,
			timestamp: Date.now(),
			value,
			filePath
		};

		this.pathToModule.get(apiPath).push(entry);

		return entry;
	}

	/**
	 * @param {string} moduleID - Module to unregister.
	 * @returns {{ removed: string[], rolledBack: Record<string, string>[] }} Removal summary.
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

		return { removed, rolledBack };
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

		// Find and remove entry
		const index = moduleID ? stack.findIndex((entry) => entry.moduleID === moduleID) : stack.length - 1;
		if (index === -1) {
			return { action: "none", removedModuleId: null, restoreModuleId: null };
		}
		const [removed] = stack.splice(index, 1);
		const removedModuleId = removed?.moduleID || null;
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

		// Otherwise, restore to previous owner
		const previous = stack[stack.length - 1];
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
		return stack[stack.length - 1];
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

		// If value is a wrapper proxy, unwrap it to get the raw implementation
		// Ownership stores wrappers for rollback capability, but when restoring,
		// we need the raw impl to avoid double-wrapping
		// Functions can also be wrappers (callable proxies), so check both objects and functions
		if (value && (typeof value === "object" || typeof value === "function") && "__impl" in value) {
			return value.__impl;
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
				source: "core",
				collisionMode: "merge",
				filePath: null
			});
		}

		// Recursively register children
		for (const [key, value] of Object.entries(api)) {
			// Skip internal properties
			const skipProps = ["__wrapper", "__metadata", "__type", "_materialize", "_impl"];
			if (skipProps.includes(key)) {
				continue;
			}

			const childPath = path ? `${path}.${key}` : key;
			if (typeof value === "function" || (value && typeof value === "object")) {
				this.register({
					moduleID,
					apiPath: childPath,
					value,
					source: "core",
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
	 * Clear all ownership data
	 * @public
	 */
	clear() {
		this.moduleToPath.clear();
		this.pathToModule.clear();
		this._unregisteredModules.clear();
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
