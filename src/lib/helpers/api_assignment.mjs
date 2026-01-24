/**
 * @fileoverview Unified API assignment logic extracted from processFiles
 * @module @cldmv/slothlet/lib/helpers/api_assignment
 * @description
 * This module provides a single source of truth for assigning values to API paths.
 * Used by both initial API build (processFiles) and hot reload (mutateApiValue).
 */

/**
 * Check if a value is a UnifiedWrapper proxy
 * @param {unknown} value - Value to check
 * @returns {boolean} True if value is a wrapper proxy
 * @private
 */
function isWrapperProxy(value) {
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
 * @param {boolean} [options.useCollisionDetection=true] - Use safeAssign for collision detection
 * @param {Object} [options.config] - Slothlet config for collision detection
 * @param {Function} [options.syncWrapper] - Function to sync two wrapper proxies
 * @param {Function} [options.safeAssign] - Function for safe assignment with collision detection
 * @returns {boolean} True if assignment succeeded, false if blocked by collision or other constraint
 *
 * @description
 * This function encapsulates all assignment patterns from processFiles:
 * - Direct assignment when no collision
 * - Wrapper sync when both existing and new are wrappers
 * - safeAssign collision detection when enabled
 * - Proper handling of UnifiedWrapper proxies (preserves them, doesn't unwrap)
 *
 * @example
 * // Direct assignment
 * assignToApiPath(api, "math", mathWrapper, {});
 *
 * @example
 * // Sync existing wrapper with new data
 * assignToApiPath(api, "config", newConfigWrapper, { mutateExisting: true, syncWrapper });
 *
 * @example
 * // With collision detection
 * assignToApiPath(api.math, "add", addFunction, {
 *     useCollisionDetection: true,
 *     config,
 *     safeAssign
 * });
 */
export function assignToApiPath(targetApi, key, value, options = {}) {
	const {
		allowOverwrite = false,
		mutateExisting = false,
		useCollisionDetection = false,
		config = null,
		syncWrapper = null,
		safeAssign = null
	} = options;

	// Get existing value
	const existing = targetApi[key];

	// Case 1: Both are wrapper proxies - sync them if mutateExisting is true
	if (existing !== undefined && isWrapperProxy(existing) && isWrapperProxy(value)) {
		if (mutateExisting && syncWrapper) {
			syncWrapper(existing, value);
			return true;
		}
		// If not mutating, fall through to overwrite logic
	}

	// Case 2: Existing value present but overwrite not allowed
	if (existing !== undefined && !allowOverwrite && !mutateExisting) {
		return false; // Assignment blocked
	}

	// Case 3: Use collision detection (safeAssign)
	if (useCollisionDetection && safeAssign && config) {
		if (safeAssign(targetApi, key, value, config)) {
			targetApi[key] = value;
			return true;
		}
		return false; // Collision detected, assignment blocked
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
 * await mergeApiObjects(api.config, newConfigApi, {
 *     mutateExisting: true,
 *     syncWrapper,
 *     removeMissing: false
 * });
 */
export async function mergeApiObjects(targetApi, sourceApi, options = {}) {
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
			!isWrapperProxy(targetValue) &&
			sourceValue &&
			typeof sourceValue === "object" &&
			!isWrapperProxy(sourceValue)
		) {
			if (config?.debug?.api) {
				console.log(`[mergeApiObjects] Both plain objects - recursing`);
			}
			await mergeApiObjects(targetValue, sourceValue, options);
		} else {
			// Use unified assignment logic
			if (config?.debug?.api) {
				console.log(`[mergeApiObjects] Calling assignToApiPath for key="${key}"`);
			}
			assignToApiPath(targetApi, key, sourceValue, assignOptions);
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
