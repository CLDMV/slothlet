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
		return value && (typeof value === "object" || typeof value === "function") && "__wrapper" in value;
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
	 * @param {Object} [options.config] - Slothlet config (uses config.collision.initial or config.collision.addApi)
	 * @param {string} [options.collisionContext="initial"] - Collision context: "initial" or "addApi"
	 * @param {Function} [options.syncWrapper] - Function to sync two wrapper proxies
	 * @returns {boolean} True if assignment succeeded, false if blocked by collision or other constraint
	 *
	 * @description
	 * This function encapsulates all assignment patterns from processFiles:
	 * - Direct assignment when no collision
	 * - Wrapper sync when both existing and new are wrappers
	 * - Collision detection using config.collision[context] mode (merge/replace/error/skip/warn)
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
	 *     config,
	 *     collisionContext: "initial"
	 * });
	 */
	assignToApiPath(targetApi, key, value, options = {}) {
		const {
			allowOverwrite = false,
			mutateExisting = false,
			useCollisionDetection = false,
			config = null,
			collisionContext = "initial",
			syncWrapper = null
		} = options;

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
			console.log(`[DEBUG:COLLISION] Detected collision at key "${String(key)}"`, {
				collisionContext,
				mode: config.collision?.[collisionContext] || "merge",
				existingType: typeof existing,
				valueType: typeof value
			});
			// Get collision mode from config.collision.initial or config.collision.addApi
			const collisionMode = config.collision?.[collisionContext] || "merge";

			if (collisionMode === "error") {
				const SlothletError = this.slothlet?.SlothletError || Error;
				throw new SlothletError("COLLISION_ERROR", {
					key: String(key),
					collisionMode,
					collisionContext
				});
			}

			if (collisionMode === "skip") {
				// Skip assignment - keep existing value
				return false;
			}

			if (collisionMode === "warn") {
				console.warn(`[slothlet] Collision detected at "${String(key)}" - using 'replace' behavior (collision mode: 'warn')`);
				// Fall through to replace
			}

			if (collisionMode === "merge") {
				// Special handling for wrapper proxies - merge their implementations
				const existingIsWrapper = this.isWrapperProxy(existing);
				const valueIsWrapper = this.isWrapperProxy(value);

				console.log("[DEBUG:MERGE] Checking wrapper status:", {
					existingIsWrapper,
					valueIsWrapper,
					existingType: typeof existing,
					valueType: typeof value,
					valueHasWrapper: value?.__wrapper !== undefined,
					valueConstructor: value?.constructor?.name,
					existingMode: existing?.__wrapper?.mode,
					valueMode: value?.__wrapper?.mode,
					existingMaterialized: existing?.__wrapper?._state?.materialized,
					valueMaterialized: value?.__wrapper?._state?.materialized
				});

				if (existingIsWrapper && valueIsWrapper) {
					// Both are wrappers - merge their child caches (properties are moved there during adoption)
					const existingWrapper = existing.__wrapper;
					const valueWrapper = value.__wrapper;

					console.log("[DEBUG:MERGE] Before adoption:");
					console.log("  existing._impl:", existingWrapper._impl);
					console.log("  existing._impl keys:", Object.keys(existingWrapper._impl || {}));
					console.log("  existing has _materializeFunc:", existingWrapper._materializeFunc !== null);
					console.log("  value._impl:", valueWrapper._impl);
					console.log("  value._impl keys:", Object.keys(valueWrapper._impl || {}));
					console.log("  value has _materializeFunc:", valueWrapper._materializeFunc !== null);

					// CRITICAL: For lazy unmaterialized wrappers, we can't merge synchronously
					// Fall through to replace behavior (value overwrites existing)
					if (
						(existingWrapper.mode === "lazy" && !existingWrapper._state.materialized) ||
						(valueWrapper.mode === "lazy" && !valueWrapper._state.materialized)
					) {
						console.log("[DEBUG:MERGE] Cannot merge unmaterialized lazy wrappers - using replace");
						// Fall through to replace behavior below
					} else {
						// CRITICAL: For lazy wrappers, we need child caches populated
						// In lazy mode, _impl is already set but _adoptImplChildren hasn't run yet
						// We can't await async _materialize(), so manually adopt children if needed
						if (existingWrapper._impl && existingWrapper._childCache.size === 0) {
							existingWrapper._adoptImplChildren();
						}
						if (valueWrapper._impl && valueWrapper._childCache.size === 0) {
							valueWrapper._adoptImplChildren();
						}

						console.log("[DEBUG:MERGE] Merging wrapper child caches:");
						console.log("  existing childCache keys:", Array.from(existingWrapper._childCache.keys()));
						console.log("  value childCache keys:", Array.from(valueWrapper._childCache.keys()));

						// Merge value's child cache into existing's child cache
						for (const [key, child] of valueWrapper._childCache.entries()) {
							existingWrapper._childCache.set(key, child);
							// Also update proxy target if it exists
							if (existingWrapper._proxyTarget && (typeof key === "string" || typeof key === "symbol")) {
								existingWrapper._proxyTarget[key] = child;
							}
						}

						console.log("  merged childCache keys:", Array.from(existingWrapper._childCache.keys()));
						return true;
					}
				} else if (existingIsWrapper && !valueIsWrapper) {
					// Existing is wrapper, new value is plain - merge into impl
					const existingWrapper = existing.__wrapper;
					const existingImpl = existingWrapper.__impl;
					const mergedImpl = { ...(existingImpl || {}), ...value };
					existingWrapper.__setImpl(mergedImpl);
					return true;
				} else if (!existingIsWrapper && valueIsWrapper) {
					// Existing is plain, new value is wrapper - can't merge into plain object
					// Fall through to replace
				} else {
					// Both are plain objects - use Object.assign
					if (typeof existing === "object" && existing !== null && typeof value === "object" && value !== null) {
						Object.assign(existing, value);
						return true;
					}
				}
				// Can't merge - fall through to replace
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
			this.slothlet.debug("api", {
				message: "mergeApiObjects entry",
				targetApiType: typeof targetApi,
				sourceApiType: typeof sourceApi
			});
			this.slothlet.debug("api", {
				message: "mergeApiObjects sourceApi keys",
				sourceApiKeys: sourceApi ? Object.keys(sourceApi) : []
			});
		}

		// Allow both objects and functions (functions can have properties too)
		if (!sourceApi || (typeof sourceApi !== "object" && typeof sourceApi !== "function")) {
			if (config?.debug?.api) {
				this.slothlet.debug("api", {
					message: "mergeApiObjects exit - sourceApi not object/function"
				});
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
				this.slothlet.debug("api", {
					message: "mergeApiObjects processing key",
					key,
					targetValueType: typeof targetValue,
					sourceValueType: typeof sourceValue
				});
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
					this.slothlet.debug("api", {
						message: "mergeApiObjects - both plain objects, recursing",
						key
					});
				}
				await this.mergeApiObjects(targetValue, sourceValue, options);
			} else {
				// Use unified assignment logic
				if (config?.debug?.api) {
					this.slothlet.debug("api", {
						message: "mergeApiObjects calling assignToApiPath",
						key
					});
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
			const {
				allowOverwrite = false,
				mutateExisting = false,
				useCollisionDetection = false,
				config = null,
				collisionContext = "initial",
				syncWrapper = null
			} = opts;
			const existing = tApi[k];

			if (existing !== undefined && this.isWrapperProxy(existing) && this.isWrapperProxy(v)) {
				if (mutateExisting && syncWrapper) {
					syncWrapper(existing, v);
					return true;
				}
			}

			if (useCollisionDetection && config && existing !== undefined) {
				const collisionMode = config.collision?.[collisionContext] || "merge";
				if (collisionMode === "error") {
					throw new Error(`[slothlet] Collision detected at "${String(k)}" - collision mode is 'error' (context: ${collisionContext})`);
				}
				if (collisionMode === "skip") {
					return false;
				}
				if (collisionMode === "warn") {
					console.warn(`[slothlet] Collision detected at "${String(k)}" - using 'replace' behavior (collision mode: 'warn')`);
				}
				if (collisionMode === "merge") {
					// Special handling for wrapper proxies - merge their implementations
					const existingIsWrapper = this.isWrapperProxy(existing);
					const valueIsWrapper = this.isWrapperProxy(v);

					if (existingIsWrapper && valueIsWrapper) {
						// Both are wrappers - merge their implementations
						const existingWrapper = existing.__wrapper;
						const valueWrapper = v.__wrapper;
						const existingImpl = existingWrapper.__impl;
						const valueImpl = valueWrapper.__impl;
						const mergedImpl = { ...(existingImpl || {}), ...(valueImpl || {}) };
						existingWrapper.__setImpl(mergedImpl);
						return true;
					} else if (existingIsWrapper && !valueIsWrapper) {
						// Existing is wrapper, new value is plain - merge into impl
						const existingWrapper = existing.__wrapper;
						const existingImpl = existingWrapper.__impl;
						const mergedImpl = { ...(existingImpl || {}), ...v };
						existingWrapper.__setImpl(mergedImpl);
						return true;
					} else if (!existingIsWrapper && valueIsWrapper) {
						// Existing is plain, new value is wrapper - can't merge, fall through
					} else {
						// Both are plain objects
						if (typeof existing === "object" && existing !== null && typeof v === "object" && v !== null) {
							Object.assign(existing, v);
							return true;
						}
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
