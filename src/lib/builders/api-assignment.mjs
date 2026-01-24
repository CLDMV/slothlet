/**
 * @fileoverview Unified API assignment logic extracted from processFiles
 * @module @cldmv/slothlet/lib/builders/api-assignment
 * @description
 * This module provides a single source of truth for assigning values to API paths.
 * Used by both initial API build (processFiles) and hot reload (mutateApiValue).
 *
 * @example
 * const assignment = new ApiAssignment(slothlet);
 * assignment.assignToApiPath(api, "math", mathWrapper, {});
 */
import { ComponentBase } from "@cldmv/slothlet/factories/component-base";

/**
 * Manages unified API assignment logic
 * @class ApiAssignment
 * @extends ComponentBase
 * @package
 *
 * @description
 * Class-based utility for assigning values to API paths with collision detection,
 * wrapper sync, and merge operations. Extends ComponentBase for Slothlet property access.
 *
 * @example
 * const assignment = new ApiAssignment(slothlet);
 * assignment.assignToApiPath(api, "math", mathWrapper, {});
 */
export class ApiAssignment extends ComponentBase {
	static slothletProperty = "apiAssignment";

	/**
	 * Create an ApiAssignment instance.
	 * @param {object} slothlet - Slothlet class instance.
	 * @package
	 *
	 * @description
	 * Creates ApiAssignment with ComponentBase support for config access.
	 */
	constructor(slothlet) {
		super(slothlet);
	}

	/**
	 * Check if a value is a UnifiedWrapper proxy
	 * @param {unknown} value - Value to check
	 * @returns {boolean} True if value is a wrapper proxy
	 * @private
	 */
	isWrapperProxy(value) {
		return value && typeof value === "object" && "__wrapper" in value;
	}

	/**
	 * Assign a value to an API object at a given property key.
	 * Handles wrapper sync, collision detection, and proper proxy preservation.
	 *
	 * @param {Object} targetApi - Target object to assign to (may be a UnifiedWrapper proxy)
	 * @param {string|symbol} key - Property name to assign
	 * @param {unknown} value - Value to assign (may be UnifiedWrapper proxy, raw value, etc.)
	 * @param {Object} options - Assignment options
	 * @param {boolean} [options.allowOverwrite=false] - Allow overwriting existing non-wrapper values
	 * @param {boolean} [options.mutateExisting=false] - Sync existing wrappers instead of replacing
	 * @param {boolean} [options.useCollisionDetection=false] - Enable collision detection using config.collision mode
	 * @param {Object} [options.config] - Slothlet config (uses config.collision: "merge"|"replace"|"error")
	 * @param {Function} [options.syncWrapper] - Function to sync two wrapper proxies
	 * @returns {boolean} True if assignment succeeded, false if blocked by collision or other constraint
	 *
	 * @description
	 * This function encapsulates all assignment patterns from processFiles:
	 * - Direct assignment when no collision
	 * - Wrapper sync when both existing and new are wrappers
	 * - Collision detection using config.collision mode (merge/replace/error)
	 * - Proper handling of UnifiedWrapper proxies (preserves them, doesn't unwrap)
	 *
	 * @example
	 * // Direct assignment
	 * assignment.assignToApiPath(api, "math", mathWrapper, {});
	 *
	 * @example
	 * // Sync existing wrapper with new data
	 * assignment.assignToApiPath(api, "config", newConfigWrapper, { mutateExisting: true, syncWrapper });
	 *
	 * @example
	 * // With collision detection
	 * assignment.assignToApiPath(api.math, "add", addFunction, {
	 *     useCollisionDetection: true,
	 *     config
	 * });
	 */
	assignToApiPath(targetApi, key, value, options = {}) {
		const { allowOverwrite = false, mutateExisting = false, useCollisionDetection = false, config = null, syncWrapper = null } = options;

		// Get existing value
		const existing = targetApi[key];

		// Case 1: Both are wrapper proxies - sync them if mutateExisting is true
		if (existing !== undefined && this.isWrapperProxy(existing) && this.isWrapperProxy(value)) {
			if (mutateExisting && syncWrapper) {
				syncWrapper(existing, value);
				return true;
			}
			// If not mutating, fall through to collision detection
		}

		// Case 2: Collision detection with config
		if (useCollisionDetection && config && existing !== undefined) {
			const collisionMode = config.collision || "merge";

			if (collisionMode === "error") {
				throw new Error(`[slothlet] Collision detected at "${String(key)}" - collision mode is 'error'`);
			}

			if (collisionMode === "merge") {
				// Merge objects/wrappers
				if (typeof existing === "object" && existing !== null && typeof value === "object" && value !== null) {
					Object.assign(existing, value);
					return true;
				}
			}

			// collisionMode === "replace" or can't merge - fall through to assignment
		}

		// Case 3: Block overwrite if not allowed
		if (existing !== undefined && !allowOverwrite && !mutateExisting && !useCollisionDetection) {
			return false; // Assignment blocked
		}

		// Case 4: Direct assignment
		targetApi[key] = value;
		return true;
	}

	/**
	 * Recursively merge a source object into a target object using assignToApiPath logic.
	 *
	 * @param {Object} targetApi - Target object
	 * @param {Object} sourceApi - Source object to merge from
	 * @param {Object} options - Assignment options (passed to assignToApiPath)
	 * @param {boolean} [options.removeMissing=false] - Remove keys from target that don't exist in source
	 * @returns {Promise<void>}
	 *
	 * @description
	 * Recursively walks the source object and assigns each value to the target using
	 * assignToApiPath. This provides consistent merge behavior for both initial build
	 * and hot reload operations.
	 *
	 * @example
	 * await assignment.mergeApiObjects(api.config, newConfigApi, {
	 *     mutateExisting: true,
	 *     syncWrapper,
	 *     removeMissing: false
	 * });
	 */
	async mergeApiObjects(targetApi, sourceApi, options = {}) {
		const config = options.config;
		if (config?.debug?.api) {
			console.log(`[mergeApiObjects ENTRY] targetApi type=${typeof targetApi}, sourceApi type=${typeof sourceApi}`);
			console.log(`[mergeApiObjects ENTRY] sourceApi keys:`, sourceApi ? Object.keys(sourceApi) : "N/A");
		}

		// Allow both objects and functions (functions can have properties too)
		if (!sourceApi || (typeof sourceApi !== "object" && typeof sourceApi !== "function")) {
			if (config?.debug?.api) {
				console.log(`[mergeApiObjects EXIT] sourceApi is not an object/function`);
			}
			return;
		}

		const { removeMissing = false, ...assignOptions } = options;

		// Merge source keys into target
		const sourceKeys = new Set(Object.keys(sourceApi));
		for (const key of sourceKeys) {
			const sourceValue = sourceApi[key];
			const targetValue = targetApi[key];

			if (config?.debug?.api) {
				console.log(
					`[mergeApiObjects] Processing key="${key}", sourceValue type=${typeof sourceValue}, targetValue type=${typeof targetValue}`
				);
			}

			// If both are plain objects (not wrappers), recurse
			if (
				targetValue &&
				typeof targetValue === "object" &&
				!this.isWrapperProxy(targetValue) &&
				sourceValue &&
				typeof sourceValue === "object" &&
				!this.isWrapperProxy(sourceValue)
			) {
				if (config?.debug?.api) {
					console.log(`[mergeApiObjects] Both plain objects - recursing`);
				}
				await this.mergeApiObjects(targetValue, sourceValue, options);
			} else {
				// Use unified assignment logic
				if (config?.debug?.api) {
					console.log(`[mergeApiObjects] Calling assignToApiPath for key="${key}"`);
				}
				this.assignToApiPath(targetApi, key, sourceValue, assignOptions);
			}
		}

		// Remove keys from target that don't exist in source
		if (removeMissing) {
			for (const key of Object.keys(targetApi)) {
				if (!sourceKeys.has(key)) {
					delete targetApi[key];
				}
			}
		}
	}
}

// Backwards-compatible standalone function exports for code that hasn't been converted to classes yet
// TODO: Remove these after modes-processor is converted to a class (Phase 2.2 - 4/4)

/**
 * Standalone assignToApiPath function (backwards-compatible)
 * @deprecated Use ApiAssignment class instance instead
 * @param {Object} targetApi - Target API object
 * @param {string|symbol} key - Property key
 * @param {unknown} value - Value to assign
 * @param {Object} options - Assignment options
 * @returns {boolean} True if assignment succeeded
 */
export function assignToApiPath(targetApi, key, value, options = {}) {
	// Create a temporary instance without slothlet (for backwards compatibility)
	const tempInstance = {
		isWrapperProxy(val) {
			return val && typeof val === "object" && "__wrapper" in val;
		},
		assignToApiPath(tApi, k, v, opts) {
			const { allowOverwrite = false, mutateExisting = false, useCollisionDetection = false, config = null, syncWrapper = null } = opts;
			const existing = tApi[k];

			if (existing !== undefined && this.isWrapperProxy(existing) && this.isWrapperProxy(v)) {
				if (mutateExisting && syncWrapper) {
					syncWrapper(existing, v);
					return true;
				}
			}

			if (useCollisionDetection && config && existing !== undefined) {
				const collisionMode = config.collision || "merge";
				if (collisionMode === "error") {
					throw new Error(`[slothlet] Collision detected at "${String(k)}" - collision mode is 'error'`);
				}
				if (collisionMode === "merge") {
					if (typeof existing === "object" && existing !== null && typeof v === "object" && v !== null) {
						Object.assign(existing, v);
						return true;
					}
				}
			}

			if (existing !== undefined && !allowOverwrite && !mutateExisting && !useCollisionDetection) {
				return false;
			}

			tApi[k] = v;
			return true;
		}
	};

	return tempInstance.assignToApiPath(targetApi, key, value, options);
}

/**
 * Standalone mergeApiObjects function (backwards-compatible)
 * @deprecated Use ApiAssignment class instance instead
 * @param {Object} targetApi - Target API object
 * @param {Object} sourceApi - Source API object
 * @param {Object} options - Merge options
 * @returns {Promise<void>}
 */
export async function mergeApiObjects(targetApi, sourceApi, options = {}) {
	// Create a temporary instance without slothlet (for backwards compatibility)
	const tempInstance = {
		isWrapperProxy(val) {
			return val && typeof val === "object" && "__wrapper" in val;
		},
		assignToApiPath,
		async mergeApiObjects(tApi, sApi, opts) {
			const config = opts.config;
			if (!sApi || (typeof sApi !== "object" && typeof sApi !== "function")) {
				return;
			}

			const { removeMissing = false, ...assignOptions } = opts;
			const sourceKeys = new Set(Object.keys(sApi));

			for (const key of sourceKeys) {
				const sourceValue = sApi[key];
				const targetValue = tApi[key];

				if (
					targetValue &&
					typeof targetValue === "object" &&
					!this.isWrapperProxy(targetValue) &&
					sourceValue &&
					typeof sourceValue === "object" &&
					!this.isWrapperProxy(sourceValue)
				) {
					await this.mergeApiObjects(targetValue, sourceValue, opts);
				} else {
					this.assignToApiPath(tApi, key, sourceValue, assignOptions);
				}
			}

			if (removeMissing) {
				for (const key of Object.keys(tApi)) {
					if (!sourceKeys.has(key)) {
						delete tApi[key];
					}
				}
			}
		}
	};

	return tempInstance.mergeApiObjects(targetApi, sourceApi, options);
}
