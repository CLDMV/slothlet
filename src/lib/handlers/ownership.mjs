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
		this.moduleToPath = new Map(); // moduleId → Set<apiPath>
		this.pathToModule = new Map(); // apiPath → Array<{moduleId, source, timestamp, value}>
	}

	/**
	 * Register module ownership of API path with its value
	 * @param {Object} options - Registration options
	 * @param {string} options.moduleId - Module identifier
	 * @param {string} options.apiPath - API path being registered
	 * @param {*} options.value - The actual function/object being registered
	 * @param {string} [options.source="core"] - Source of registration
	 * @param {string} [options.collisionMode="error"] - Collision mode: skip, warn, error, merge, replace
	 * @param {Object} [options.config] - Config object for silent mode check
	 * @param {string} [options.filePath=null] - File path of the module source (for metadata tracking)
	 * @returns {Object|null} Registration entry or null if skipped
	 * @public
	 */
	register({ moduleId, apiPath, value, source = "core", collisionMode = "error", config = null, filePath = null }) {
		// Validate inputs
		if (!moduleId || typeof moduleId !== "string") {
			throw new this.SlothletError("OWNERSHIP_INVALID_MODULE_ID", { moduleId }, null, { validationError: true });
		}
		if (!apiPath || typeof apiPath !== "string") {
			throw new this.SlothletError("OWNERSHIP_INVALID_API_PATH", { apiPath }, null, { validationError: true });
		}

		// Check for conflicts
		const currentOwner = this.getCurrentOwner(apiPath);
		if (currentOwner && currentOwner.moduleId !== moduleId) {
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
						existingModuleId: currentOwner.moduleId,
						newModuleId: moduleId
					});
				}
				return null;
			} else {
				// error mode - throw
				throw new this.SlothletError("OWNERSHIP_CONFLICT", {
					apiPath,
					existingModuleId: currentOwner.moduleId,
					newModuleId: moduleId,
					validationError: true
				});
			}
		}

		// Add to moduleToPath
		if (!this.moduleToPath.has(moduleId)) {
			this.moduleToPath.set(moduleId, new Set());
		}
		this.moduleToPath.get(moduleId).add(apiPath);

		// Add to pathToModule stack
		if (!this.pathToModule.has(apiPath)) {
			this.pathToModule.set(apiPath, []);
		}

		const entry = {
			moduleId,
			source,
			timestamp: Date.now(),
			value,
			filePath
		};

		this.pathToModule.get(apiPath).push(entry);

		return entry;
	}

	/**
	 * @param {string} moduleId - Module to unregister.
	 * @returns {{ removed: string[], rolledBack: Record<string, string>[] }} Removal summary.
	 * @public
	 *
	 * @description
	 * Removes all paths owned by the provided moduleId and reports removals and rollbacks.
	 *
	 * @example
	 * const result = ownership.unregister("module-a");
	 */
	unregister(moduleId) {
		const paths = this.moduleToPath.get(moduleId);
		if (!paths) {
			return { removed: [], rolledBack: [] };
		}

		const removed = [];
		const rolledBack = [];

		for (const apiPath of paths) {
			const result = this.removePath(apiPath, moduleId);

			if (result.action === "delete") {
				removed.push(apiPath);
			} else if (result.action === "restore") {
				rolledBack.push({
					apiPath,
					restoredTo: result.restoreModuleId
				});
			}
		}

		this.moduleToPath.delete(moduleId);

		return { removed, rolledBack };
	}

	/**
	 * @param {string} apiPath - API path to modify.
	 * @param {string|null} [moduleId=null] - Module to remove (defaults to current owner).
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
	removePath(apiPath, moduleId = null) {
		const stack = this.pathToModule.get(apiPath);
		if (!stack) {
			return { action: "none", removedModuleId: null, restoreModuleId: null };
		}

		// Find and remove entry
		const index = moduleId ? stack.findIndex((entry) => entry.moduleId === moduleId) : stack.length - 1;
		if (index === -1) {
			return { action: "none", removedModuleId: null, restoreModuleId: null };
		}
		const [removed] = stack.splice(index, 1);
		const removedModuleId = removed?.moduleId || null;
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
			restoreModuleId: previous.moduleId
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
		return owner ? owner.value : undefined;
	}

	/**
	 * Get all paths owned by module
	 * @param {string} moduleId - Module to query
	 * @returns {Array<string>} Array of API paths
	 * @public
	 */
	getModulePaths(moduleId) {
		return Array.from(this.moduleToPath.get(moduleId) || []);
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
	 * @param {string} moduleId - Module to check
	 * @param {string} apiPath - API path to check
	 * @returns {boolean} True if module owns path
	 * @public
	 */
	ownsPath(moduleId, apiPath) {
		const owner = this.getCurrentOwner(apiPath);
		return owner && owner.moduleId === moduleId;
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
				moduleId: id,
				pathCount: paths.size
			})),
			conflictedPaths: Array.from(this.pathToModule.entries())
				.filter(([_, stack]) => stack.length > 1)
				.map(([path, stack]) => ({
					apiPath: path,
					ownerStack: stack.map((e) => e.moduleId)
				}))
		};
	}

	/**
	 * Clear all ownership data
	 * @public
	 */
	clear() {
		this.moduleToPath.clear();
		this.pathToModule.clear();
	}
}
