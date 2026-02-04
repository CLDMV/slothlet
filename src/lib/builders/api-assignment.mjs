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
	 * @param {Object} [options.config] - Slothlet config (uses config.collision.initial or config.collision.api)
	 * @param {string} [options.collisionContext="initial"] - Collision context: "initial" or "api"
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
		const valueIsWrapper = this.isWrapperProxy(value);
		const valueId = valueIsWrapper ? value.__wrapper?._id : "not-wrapper";
		this.slothlet.debug("api", {
			message: "ASSIGN-TO-API",
			key,
			valueId,
			typeOf: typeof value
		});

		const {
			allowOverwrite = false,
			mutateExisting = false,
			useCollisionDetection = false,
			config = null,
			collisionContext = "initial",
			syncWrapper = null,
			collisionMode = "merge", // Default to merge for hot reload
			moduleId = null
		} = options;

		// Get existing value
		const existing = targetApi[key];

		// Case 1: Both are wrapper proxies - sync them if mutateExisting is true
		if (existing !== undefined && this.isWrapperProxy(existing) && this.isWrapperProxy(value)) {
			if (mutateExisting && syncWrapper) {
				syncWrapper(existing, value, config, collisionMode, moduleId);
				return true;
			}
			// If not mutating, fall through to collision detection
		}

		// Case 2: Collision detection with config
		this.slothlet.debug("api", {
			message: "COLLISION-CHECK",
			key,
			useCollisionDetection,
			hasConfig: !!config,
			hasExisting: existing !== undefined,
			existingType: typeof existing
		});
		if (useCollisionDetection && config && existing !== undefined) {
			this.slothlet.debug("api", {
				message: "COLLISION-DETECT",
				key,
				context: collisionContext,
				existingType: typeof existing,
				valueType: typeof value
			});
			// Get collision mode from config.collision.initial or config.collision.api
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
				new this.slothlet.SlothletWarning("WARNING_COLLISION_FILE_FOLDER_MERGE", {
					key: String(key)
				});
				// Treat warn as merge - merge file properties into lazy folder to preserve lazy capability
				effectiveMode = "merge";
			}

			// CRITICAL: Store collision mode on lazy wrappers BEFORE any collision handling
			// This must happen for ALL modes (merge, merge-replace, replace) so materialization knows how to handle properties
			const existingIsWrapper = this.isWrapperProxy(existing);
			const valueIsWrapper = this.isWrapperProxy(value);

			this.slothlet.debug("api", {
				message: "COLLISION: wrapper detection",
				key,
				existingIsWrapper,
				valueIsWrapper,
				hasExistingWrapper: existing?.__wrapper ? "yes" : "no",
				hasValueWrapper: value?.__wrapper ? "yes" : "no"
			});

			if (existingIsWrapper && valueIsWrapper) {
				const existingWrapper = existing.__wrapper;
				const valueWrapper = value.__wrapper;
				const existingIsLazyUnmaterialized = existingWrapper.mode === "lazy" && !existingWrapper._state.materialized;
				const valueIsLazyUnmaterialized = valueWrapper.mode === "lazy" && !valueWrapper._state.materialized;

				this.slothlet.debug("api", {
					message: "COLLISION: lazy detection",
					key,
					effectiveMode,
					existingLazy: existingIsLazyUnmaterialized,
					valueLazy: valueIsLazyUnmaterialized
				});

				// Store collision mode on lazy wrappers so they know how to handle properties during materialization
				// Use effectiveMode (which includes warn→merge conversion)
				// CRITICAL: Store in _state object so it persists across proxy boundaries
				if (existingIsLazyUnmaterialized) {
					this.slothlet.debug("api", {
						message: "COLLISION: Setting collision mode on EXISTING wrapper",
						effectiveMode,
						apiPath: existingWrapper.apiPath
					});
					existingWrapper._state.collisionMode = effectiveMode;
					this.slothlet.debug("api", {
						message: "COLLISION: Verified existing wrapper collision mode",
						collisionMode: existingWrapper._state.collisionMode
					});
				}
				if (valueIsLazyUnmaterialized) {
					this.slothlet.debug("api", {
						message: "COLLISION: Setting collision mode on VALUE wrapper",
						effectiveMode,
						apiPath: valueWrapper.apiPath
					});
					valueWrapper._state.collisionMode = effectiveMode;
					this.slothlet.debug("api", {
						message: "COLLISION: Verified value wrapper collision mode",
						collisionMode: valueWrapper._state.collisionMode
					});
					
					// CRITICAL: In replace mode, trigger immediate materialization
					// This ensures _impl is populated as soon as possible
					if (effectiveMode === "replace") {
						this.slothlet.debug("api", {
							message: "COLLISION-REPLACE-MATERIALIZE: Triggering immediate materialization",
							apiPath: valueWrapper.apiPath
						});
						valueWrapper._materialize(); // Fire-and-forget - will populate _impl asynchronously
					}
				}
			}

			// Replace mode: Last loaded completely replaces first loaded
			if (effectiveMode === "replace") {
				if (existingIsWrapper && valueIsWrapper) {
					const existingWrapper = existing.__wrapper;
					const valueWrapper = value.__wrapper;

					const existingIsLazyUnmaterialized = existingWrapper.mode === "lazy" && !existingWrapper._state.materialized;
					const valueIsLazyUnmaterialized = valueWrapper.mode === "lazy" && !valueWrapper._state.materialized;

					// For lazy folder replacing eager file: Just assign the lazy folder, don't copy anything
					if (valueIsLazyUnmaterialized && !existingIsLazyUnmaterialized) {
						this.slothlet.debug("api", {
							message: "COLLISION-REPLACE: Not copying file properties - replace mode will clear everything on materialization"
						});
						this.slothlet.debug("api", {
							message: "COLLISION-REPLACE: BEFORE assignment",
							key,
							currentWrapperId: existing.__wrapper._id
						});
						this.slothlet.debug("api", {
							message: "COLLISION-ASSIGN: Replacing existing with lazy folder",
							key,
							collisionMode: valueWrapper._state.collisionMode
						});
						targetApi[key] = value;
						this.slothlet.debug("api", {
							message: "COLLISION-REPLACE: AFTER assignment",
							key,
							newWrapperId: targetApi[key].__wrapper._id
						});
						this.slothlet.debug("api", {
							message: "COLLISION-REPLACE: Verification",
							expectedId: valueWrapper._id,
							actualId: targetApi[key].__wrapper._id
						});
						return true; // Assignment completed
					}
					// For other combinations, fall through to default replacement logic
				}
				// Default: Just replace
				targetApi[key] = value;
				return true;
			}

			if (effectiveMode === "merge" || effectiveMode === "merge-replace") {
				const isMergeReplace = effectiveMode === "merge-replace";
				// Special handling for wrapper proxies - merge their implementations

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

						// Create temporary object to hold __childFilePaths if _impl doesn't exist yet
						// When lazy materializes, it will merge with this or we can store it on the wrapper directly
						if (!existingWrapper.__childFilePathsPreMaterialize) {
							existingWrapper.__childFilePathsPreMaterialize = {};
						}

						const valueChildKeys = Object.keys(valueWrapper._proxyTarget).filter((k) => k !== "__wrapper");
						for (const key of valueChildKeys) {
							const child = valueWrapper._proxyTarget[key];
							Object.defineProperty(existingWrapper._proxyTarget, key, {
								value: child,
								writable: false,
								enumerable: true,
								configurable: true
							});
							// Store filePath mapping so child wrappers can inherit correct filePath
							if (valueFilePath) {
								existingWrapper.__childFilePathsPreMaterialize[key] = valueFilePath;
							}
						}

						return true; // Keep existing (lazy folder with copied file exports)
					} else if (valueIsLazyUnmaterialized && !existingIsLazyUnmaterialized) {
						// Case 2: File processed first, lazy folder processed second
						// Copy existing's childCache (file exports) into value (lazy folder)
						// BUT: In replace or merge-replace mode, DON'T copy keys

						if (effectiveMode === "replace") {
							// Replace mode: Don't copy anything from existing file
							// Let the lazy folder materialize clean and completely replace the file
							this.slothlet.debug("api", {
								message: "COLLISION-REPLACE: Not copying file properties - replace mode will clear everything on materialization"
							});
						} else if (!isMergeReplace) {
							// Merge mode: Copy all existing keys into lazy folder
							// When folder materializes, _adoptImplChildren will preserve these (merge scenario)

							// Get file wrapper's metadata to extract filePath for child mappings
							const existingMetadata = this.slothlet.handlers?.metadata?.getMetadata(existing);
							const existingFilePath = existingMetadata?.filePath;

							// Create temporary object to hold __childFilePaths if _impl doesn't exist yet
							if (!valueWrapper.__childFilePathsPreMaterialize) {
								valueWrapper.__childFilePathsPreMaterialize = {};
							}

							const existingChildKeys = Object.keys(existingWrapper._proxyTarget).filter((k) => k !== "__wrapper");
							this.slothlet.debug("api", {
								message: "COLLISION-COPY: Copying existing child keys",
								existingChildKeys: existingChildKeys.join(","),
								fromApiPath: existingWrapper.apiPath,
								toApiPath: valueWrapper.apiPath,
								valueWrapperId: valueWrapper._id || "no-id"
							});

							// Track collision-merged properties so materialization knows these are from file, not folder children
							if (!valueWrapper.__collisionMergedKeys) {
								valueWrapper.__collisionMergedKeys = new Set();
							}

							for (const key of existingChildKeys) {
								const child = existingWrapper._proxyTarget[key];
								this.slothlet.debug("api", {
									message: "COLLISION-COPY: Copying individual key",
									key,
									childName: child?.name,
									typeOf: typeof child,
									valueWrapperId: valueWrapper._id || "no-id"
								});
								Object.defineProperty(valueWrapper._proxyTarget, key, {
									value: child,
									writable: false,
									enumerable: true,
									configurable: true
								});
								// Mark this key as collision-merged
								valueWrapper.__collisionMergedKeys.add(key);
								// Store filePath mapping so child wrappers can inherit correct filePath
								if (existingFilePath) {
									valueWrapper.__childFilePathsPreMaterialize[key] = existingFilePath;
								}
							}

							// CRITICAL: Trigger early materialization for collision-merged lazy folders
							// This starts loading the folder module so children become available sooner
							// Fire-and-forget: We don't await because collision handling must remain synchronous
							// The folder children will be added to _proxyTarget during materialization
							this.slothlet.debug("api", {
								message: "COLLISION-TRIGGER-MAT: Triggering early materialization (fire-and-forget)",
								apiPath: valueWrapper.apiPath
							});
							valueWrapper.__needsImmediateChildAdoption = true;
							if (valueWrapper._materializeFunc && !valueWrapper._state?.materialized && !valueWrapper._state?.inFlight) {
								valueWrapper._materialize().catch((err) => {
									console.error(`[COLLISION-TRIGGER-MAT-ERROR] Early materialization failed for apiPath="${valueWrapper.apiPath}":`, err);
								});
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
					this.slothlet.debug("api", {
						message: "COLLISION-ASSIGN: Replacing existing with lazy folder",
						key,
						collisionMode: valueWrapper._state.collisionMode
					});
						targetApi[key] = value;
						return true; // Assignment completed
					}

					// CRITICAL: For materialized lazy wrappers, we need child caches populated
					// In lazy mode, _impl is already set but _adoptImplChildren hasn't run yet
					const existingChildCount = Object.keys(existingWrapper._proxyTarget).filter((k) => k !== "__wrapper").length;
					const valueChildCount = Object.keys(valueWrapper._proxyTarget).filter((k) => k !== "__wrapper").length;
					if (existingWrapper._impl && existingChildCount === 0) {
						existingWrapper._adoptImplChildren();
					}
					if (valueWrapper._impl && valueChildCount === 0) {
						valueWrapper._adoptImplChildren();
					}

					// Merge value's child properties into existing's child properties
					// CRITICAL: In merge mode, only ADD new keys, don't OVERWRITE existing ones
					// In merge-replace mode, ADD new keys AND OVERWRITE existing ones
					const valueChildKeys2 = Object.keys(valueWrapper._proxyTarget).filter((k) => k !== "__wrapper");
					for (const key of valueChildKeys2) {
						const child = valueWrapper._proxyTarget[key];
						const keyExists = key in existingWrapper._proxyTarget && key !== "__wrapper";

						if (!keyExists) {
							Object.defineProperty(existingWrapper._proxyTarget, key, {
								value: child,
								writable: false,
								enumerable: true,
								configurable: true
							});
						} else if (isMergeReplace) {
							const descriptor = Object.getOwnPropertyDescriptor(existingWrapper._proxyTarget, key);
							if (descriptor?.configurable) {
								delete existingWrapper._proxyTarget[key];
							}
							Object.defineProperty(existingWrapper._proxyTarget, key, {
								value: child,
								writable: false,
								enumerable: true,
								configurable: true
							});
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

		const { removeMissing = false, moduleId = null, ...assignOptions } = options;

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
				this.assignToApiPath(targetApi, key, sourceValue, { ...assignOptions, moduleId });
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
