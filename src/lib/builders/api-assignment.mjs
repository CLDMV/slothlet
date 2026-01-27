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

			// Effective mode after warn conversion
			let effectiveMode = collisionMode;
			if (collisionMode === "warn") {
				console.warn(`[slothlet] Collision detected at "${String(key)}" - merging file and folder exports (collision mode: 'warn')`);
				// Treat warn as merge - merge file properties into lazy folder to preserve lazy capability
				effectiveMode = "merge";
			}

			if (effectiveMode === "merge" || effectiveMode === "merge-replace") {
				const isMergeReplace = effectiveMode === "merge-replace";
				// Special handling for wrapper proxies - merge their implementations
				const existingIsWrapper = this.isWrapperProxy(existing);
				const valueIsWrapper = this.isWrapperProxy(value);

				if (existingIsWrapper && valueIsWrapper) {
					// Both are wrappers - merge their child caches (properties are moved there during adoption)
					const existingWrapper = existing.__wrapper;
					const valueWrapper = value.__wrapper;

					// Strategy: Keep the lazy wrapper and copy the other wrapper's childCache into it
					// When the lazy wrapper materializes, it will merge with the copied childCache
					const existingIsLazyUnmaterialized = existingWrapper.mode === "lazy" && !existingWrapper._state.materialized;
					const valueIsLazyUnmaterialized = valueWrapper.mode === "lazy" && !valueWrapper._state.materialized;

					if (existingIsLazyUnmaterialized && !valueIsLazyUnmaterialized) {
						// Case 1: Lazy folder processed first, file processed second
						// Copy value's childCache (file exports) into existing (lazy folder)
						
						// Get file wrapper's metadata to extract filePath for child mappings
						const valueMetadata = this.slothlet.handlers?.metadata?.getMetadata(value);
						const valueFilePath = valueMetadata?.filePath;
						
						console.log(`[COLLISION MERGE] file wrapper filePath: ${valueFilePath}`);
						
						// Create temporary object to hold __childFilePaths if _impl doesn't exist yet
						// When lazy materializes, it will merge with this or we can store it on the wrapper directly
						if (!existingWrapper.__childFilePathsPreMaterialize) {
							existingWrapper.__childFilePathsPreMaterialize = {};
						}
						
						for (const [key, child] of valueWrapper._childCache.entries()) {
							existingWrapper._childCache.set(key, child);
							// Store filePath mapping so child wrappers can inherit correct filePath
							if (valueFilePath) {
								existingWrapper.__childFilePathsPreMaterialize[key] = valueFilePath;
								console.log(`[COLLISION MERGE] Mapping ${key} -> ${valueFilePath}`);
							}
							// NOTE: Do NOT set child on _proxyTarget - it's a wrapper object
							// In live runtime, direct property access would return the wrapper instead of unwrapped value
							// The proxy's get trap will handle unwrapping from _childCache
						}

						return true; // Keep existing (lazy folder with copied file exports)
					} else if (valueIsLazyUnmaterialized && !existingIsLazyUnmaterialized) {
						// Case 2: File processed first, lazy folder processed second
						// Copy existing's childCache (file exports) into value (lazy folder)
						// BUT: In merge-replace mode, DON'T copy keys that will be overwritten by folder

						// In merge-replace mode, we need to know which keys the lazy folder will provide
						// But we can't know that until it materializes. Solution: Don't copy ANY keys in merge-replace,
						// let the folder materialize and provide all its keys fresh, then existing non-conflicting keys
						// can be added via the normal merge process in _adoptImplChildren

						if (!isMergeReplace) {
							// Merge mode: Copy all existing keys into lazy folder
							// When folder materializes, _adoptImplChildren will preserve these (merge scenario)
							
							// Get file wrapper's metadata to extract filePath for child mappings
							const existingMetadata = this.slothlet.handlers?.metadata?.getMetadata(existing);
							const existingFilePath = existingMetadata?.filePath;
							
							console.log(`[COLLISION MERGE Case 2] file wrapper filePath: ${existingFilePath}`);
							
							// Create temporary object to hold __childFilePaths if _impl doesn't exist yet
							if (!valueWrapper.__childFilePathsPreMaterialize) {
								valueWrapper.__childFilePathsPreMaterialize = {};
							}
							
							for (const [key, child] of existingWrapper._childCache.entries()) {
								valueWrapper._childCache.set(key, child);
								// Store filePath mapping so child wrappers can inherit correct filePath
								if (existingFilePath) {
									valueWrapper.__childFilePathsPreMaterialize[key] = existingFilePath;
									console.log(`[COLLISION MERGE Case 2] Mapping ${key} -> ${existingFilePath}`);
								}
								// NOTE: Do NOT set child on _proxyTarget - it's a wrapper object
								// In live runtime, direct property access would return the wrapper instead of unwrapped value
								// The proxy's get trap will handle unwrapping from _childCache
							}
						} else {
							// Merge-replace mode: Don't copy anything
							// Let the lazy folder materialize clean, its keys will be the "new" values
							// After materialization, we'll need to merge in non-conflicting keys from existing
							// Store reference to existing wrapper so we can merge after materialization
							valueWrapper._mergeAfterMaterialize = {
								existingWrapper,
								isMergeReplace: true
							};
						}

						// Assign value to API (replace existing with lazy folder wrapper)
						targetApi[key] = value;
						return true; // Assignment completed
					}

					// CRITICAL: For materialized lazy wrappers, we need child caches populated
					// In lazy mode, _impl is already set but _adoptImplChildren hasn't run yet
					if (existingWrapper._impl && existingWrapper._childCache.size === 0) {
						existingWrapper._adoptImplChildren();
					}
					if (valueWrapper._impl && valueWrapper._childCache.size === 0) {
						valueWrapper._adoptImplChildren();
					}

					// Merge value's child cache into existing's child cache
					// CRITICAL: In merge mode, only ADD new keys, don't OVERWRITE existing ones
					// In merge-replace mode, ADD new keys AND OVERWRITE existing ones
					for (const [key, child] of valueWrapper._childCache.entries()) {
						const keyExists = existingWrapper._childCache.has(key);

						if (!keyExists) {
							existingWrapper._childCache.set(key, child);
							// NOTE: Do NOT set child on _proxyTarget - it's a wrapper object
							// In live runtime, direct property access would return the wrapper instead of unwrapped value
							// The proxy's get trap will handle unwrapping from _childCache
						} else if (isMergeReplace) {
							existingWrapper._childCache.set(key, child);
							// NOTE: Do NOT set child on _proxyTarget - it's a wrapper object
							// In live runtime, direct property access would return the wrapper instead of unwrapped value
							// The proxy's get trap will handle unwrapping from _childCache
						}
					}
					// The value wrapper has the materializeFunc that will load folder's exports
					if (valueWrapper.mode === "lazy" && !valueWrapper._state.materialized && valueWrapper._materializeFunc) {
						// Don't copy impl - the lazy folder needs to materialize on its own
						// The childCache already has the file's exports from the copy above
						return false; // Assign value, not existing
					}

					return true;
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
