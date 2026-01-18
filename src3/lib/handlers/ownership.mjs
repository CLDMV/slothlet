/**
 * @fileoverview Centralized ownership tracking for hot reload
 * @module @cldmv/slothlet/ownership
 */
import { SlothletError } from "@cldmv/slothlet/errors";

/**
 * Tracks which modules own which API paths for hot reload and rollback
 * @public
 */
export class OwnershipManager {
	constructor() {
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
	 * @param {boolean} [options.allowConflict=false] - Allow overwriting existing owner
	 * @returns {Object} Registration entry
	 * @public
	 */
	register({ moduleId, apiPath, value, source = "core", allowConflict = false }) {
		// Validate inputs
		if (!moduleId || typeof moduleId !== "string") {
			throw new SlothletError("OWNERSHIP_INVALID_MODULE_ID", { moduleId }, null, { validationError: true });
		}
		if (!apiPath || typeof apiPath !== "string") {
			throw new SlothletError("OWNERSHIP_INVALID_API_PATH", { apiPath }, null, { validationError: true });
		}

		// Check for conflicts
		const currentOwner = this.getCurrentOwner(apiPath);
		if (currentOwner && currentOwner.moduleId !== moduleId && !allowConflict) {
			throw new SlothletError("OWNERSHIP_CONFLICT", {
				apiPath,
				existingModuleId: currentOwner.moduleId,
				newModuleId: moduleId
			});
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
			value
		};

		this.pathToModule.get(apiPath).push(entry);

		return entry;
	}

	/**
	 * Unregister module and return affected paths
	 * @param {string} moduleId - Module to unregister
	 * @returns {Object} Unregistration results with removed and rolled back paths
	 * @public
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
					restoredTo: result.moduleId
				});
			}
		}

		this.moduleToPath.delete(moduleId);

		return { removed, rolledBack };
	}

	/**
	 * Remove specific moduleId from apiPath ownership
	 * @param {string} apiPath - API path to modify
	 * @param {string} moduleId - Module to remove
	 * @returns {Object} Action taken (none, delete, or restore)
	 * @private
	 */
	removePath(apiPath, moduleId) {
		const stack = this.pathToModule.get(apiPath);
		if (!stack) {
			return { action: "none" };
		}

		// Find and remove entry
		const index = stack.findIndex((entry) => entry.moduleId === moduleId);
		if (index === -1) {
			return { action: "none" };
		}

		stack.splice(index, 1);

		// If stack empty, delete path entirely
		if (stack.length === 0) {
			this.pathToModule.delete(apiPath);
			return { action: "delete" };
		}

		// Otherwise, restore to previous owner
		const previous = stack[stack.length - 1];
		return {
			action: "restore",
			moduleId: previous.moduleId,
			source: previous.source
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
