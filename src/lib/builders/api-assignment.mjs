/**
 *	@Project: @cldmv/slothlet
 *	@Filename: /src/lib/builders/api-assignment.mjs
 *	@Date: 2026-01-23 21:51:45 -08:00 (1737694305)
 *	@Author: Nate Corcoran <CLDMV>
 *	@Email: <Shinrai@users.noreply.github.com>
 *	-----
 *	@Last modified by: Nate Corcoran <CLDMV> (Shinrai@users.noreply.github.com)
 *	@Last modified time: 2026-03-01 20:21:36 -08:00 (1772425296)
 *	-----
 *	@Copyright: Copyright (c) 2013-2026 Catalyzed Motivation Inc. All rights reserved.
 */

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
import { resolveWrapper } from "@cldmv/slothlet/handlers/unified-wrapper";

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
		return !!(value && resolveWrapper(value));
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
		const valueId = valueIsWrapper ? (resolveWrapper(value)?.____slothletInternal?.id ?? "no-id") : "not-wrapper";
		this.slothlet.debug("api", {
			key: "DEBUG_MODE_ASSIGN_TO_API",
			propKey: key,
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
			moduleID = null
		} = options;

		// Get existing value
		const existing = targetApi[key];

		// Case 1: Both are wrapper proxies - sync them if mutateExisting is true
		if (existing !== undefined && this.isWrapperProxy(existing) && this.isWrapperProxy(value)) {
			if (mutateExisting && syncWrapper) {
				syncWrapper(existing, value, config, collisionMode, moduleID);
				return true;
			}
			// If not mutating, fall through to collision detection
		}

		// Case 2: Collision detection with config
		this.slothlet.debug("api", {
			key: "DEBUG_MODE_COLLISION_CHECK",
			propKey: key,
			useCollisionDetection,
			hasConfig: !!config,
			hasExisting: existing !== undefined,
			existingType: typeof existing
		});
		if (useCollisionDetection && config && existing !== undefined) {
			this.slothlet.debug("api", {
				key: "DEBUG_MODE_COLLISION_DETECT",
				propKey: key,
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
				key: "DEBUG_MODE_COLLISION_WRAPPER_DETECTION",
				propKey: key,
				existingIsWrapper,
				valueIsWrapper,
				hasExistingWrapper: resolveWrapper(existing) ? "yes" : "no",
				hasValueWrapper: resolveWrapper(value) ? "yes" : "no"
			});

			if (existingIsWrapper && valueIsWrapper) {
				const existingWrapper = resolveWrapper(existing);
				const valueWrapper = resolveWrapper(value);
				const existingIsLazyUnmaterialized =
					existingWrapper.____slothletInternal.mode === "lazy" && !existingWrapper.____slothletInternal.state.materialized;
				const valueIsLazyUnmaterialized =
					valueWrapper.____slothletInternal.mode === "lazy" && !valueWrapper.____slothletInternal.state.materialized;

				this.slothlet.debug("api", {
					key: "DEBUG_MODE_COLLISION_LAZY_DETECTION",
					propKey: key,
					effectiveMode,
					existingLazy: existingIsLazyUnmaterialized,
					valueLazy: valueIsLazyUnmaterialized
				});

				// Store collision mode on lazy wrappers so they know how to handle properties during materialization
				// Use effectiveMode (which includes warn→merge conversion)
				// CRITICAL: Store in _state object so it persists across proxy boundaries
				if (existingIsLazyUnmaterialized) {
					this.slothlet.debug("api", {
						key: "DEBUG_MODE_COLLISION_SET_MODE_EXISTING_WRAPPER",
						effectiveMode,
						apiPath: existingWrapper.____slothletInternal.apiPath
					});
					existingWrapper.____slothletInternal.state.collisionMode = effectiveMode;
					this.slothlet.debug("api", {
						key: "DEBUG_MODE_COLLISION_VERIFIED_EXISTING_WRAPPER_MODE",
						collisionMode: existingWrapper.____slothletInternal.state.collisionMode
					});
				}
				if (valueIsLazyUnmaterialized) {
					this.slothlet.debug("api", {
						key: "DEBUG_MODE_COLLISION_SET_MODE_VALUE_WRAPPER",
						effectiveMode,
						apiPath: valueWrapper.____slothletInternal.apiPath
					});
					valueWrapper.____slothletInternal.state.collisionMode = effectiveMode;
					this.slothlet.debug("api", {
						key: "DEBUG_MODE_COLLISION_VERIFIED_VALUE_WRAPPER_MODE",
						collisionMode: valueWrapper.____slothletInternal.state.collisionMode
					});

					// CRITICAL: In replace mode, trigger immediate materialization
					// This ensures _impl is populated as soon as possible
					if (effectiveMode === "replace") {
						this.slothlet.debug("api", {
							key: "DEBUG_MODE_COLLISION_REPLACE_MATERIALIZE",
							apiPath: valueWrapper.____slothletInternal.apiPath
						});
						valueWrapper._materialize(); // Fire-and-forget - will populate _impl asynchronously
					}
				}
			}

			// Replace mode: Last loaded completely replaces first loaded
			if (effectiveMode === "replace") {
				if (existingIsWrapper && valueIsWrapper) {
					const existingWrapper = resolveWrapper(existing);
					const valueWrapper = resolveWrapper(value);
					const existingIsLazyUnmaterialized =
						existingWrapper.____slothletInternal.mode === "lazy" && !existingWrapper.____slothletInternal.state.materialized;
					const valueIsLazyUnmaterialized =
						valueWrapper.____slothletInternal.mode === "lazy" && !valueWrapper.____slothletInternal.state.materialized;

					// For lazy folder replacing eager file: Just assign the lazy folder, don't copy anything
					if (valueIsLazyUnmaterialized && !existingIsLazyUnmaterialized) {
						this.slothlet.debug("api", {
							key: "DEBUG_MODE_COLLISION_REPLACE_NO_COPY"
						});
						this.slothlet.debug("api", {
							key: "DEBUG_MODE_COLLISION_REPLACE_BEFORE",
							propKey: key,
							currentWrapperId: resolveWrapper(existing)?.____slothletInternal.id
						});
						this.slothlet.debug("api", {
							key: "DEBUG_MODE_COLLISION_ASSIGN_REPLACING_WITH_LAZY",
							propKey: key,
							collisionMode: valueWrapper.____slothletInternal.state.collisionMode
						});
						targetApi[key] = value;
						this.slothlet.debug("api", {
							key: "DEBUG_MODE_COLLISION_REPLACE_AFTER",
							propKey: key,
							newWrapperId: resolveWrapper(targetApi[key])?.____slothletInternal.id
						});
						this.slothlet.debug("api", {
							key: "DEBUG_MODE_COLLISION_REPLACE_VERIFY",
							expectedId: valueWrapper.____slothletInternal.id,
							actualId: resolveWrapper(targetApi[key])?.____slothletInternal.id
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
					const existingWrapper = resolveWrapper(existing);
					const valueWrapper = resolveWrapper(value);

					// Strategy: Keep the lazy wrapper and copy the other wrapper's childCache into it
					// When the lazy wrapper materializes, it will merge with the copied childCache
					const existingIsLazyUnmaterialized =
						existingWrapper.____slothletInternal.mode === "lazy" && !existingWrapper.____slothletInternal.state.materialized;
					const valueIsLazyUnmaterialized =
						valueWrapper.____slothletInternal.mode === "lazy" && !valueWrapper.____slothletInternal.state.materialized;

					if (existingIsLazyUnmaterialized && !valueIsLazyUnmaterialized) {
						// Case 1: Lazy folder processed first, file processed second
						// Copy value's childCache (file exports) into existing (lazy folder)

						// Get file wrapper's metadata to extract filePath for child mappings
						const valueMetadata = this.slothlet.handlers?.metadata?.getMetadata(value);
						const valueFilePath = valueMetadata?.filePath;

						// Create temporary object to hold __childFilePaths if _impl doesn't exist yet
						// When lazy materializes, it will merge with this or we can store it on the wrapper directly
						if (!existingWrapper.____slothletInternal.childFilePathsPreMaterialize) {
							existingWrapper.____slothletInternal.childFilePathsPreMaterialize = {};
						}

						const valueChildKeys = Object.keys(valueWrapper).filter((k) => !k.startsWith("_") && !k.startsWith("__"));
						for (const key of valueChildKeys) {
							// const child = valueWrapper[key];
							Object.defineProperty(existingWrapper, key, {
								configurable: true
							});
							// Store filePath mapping so child wrappers can inherit correct filePath
							if (valueFilePath) {
								existingWrapper.____slothletInternal.childFilePathsPreMaterialize[key] = valueFilePath;
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
								key: "DEBUG_MODE_COLLISION_REPLACE_NO_COPY"
							});
						} else if (!isMergeReplace) {
							// Merge mode: Copy all existing keys into lazy folder
							// When folder materializes, ___adoptImplChildren will preserve these (merge scenario)

							// Get file wrapper's metadata to extract filePath for child mappings
							const existingMetadata = this.slothlet.handlers?.metadata?.getMetadata(existing);
							const existingFilePath = existingMetadata?.filePath;

							// Create temporary object to hold __childFilePaths if _impl doesn't exist yet
							if (!valueWrapper.____slothletInternal.childFilePathsPreMaterialize) {
								valueWrapper.____slothletInternal.childFilePathsPreMaterialize = {};
							}

							const existingChildKeys = Object.keys(existingWrapper).filter((k) => !k.startsWith("_") && !k.startsWith("__"));
							this.slothlet.debug("api", {
								key: "DEBUG_MODE_COLLISION_COPY_CHILD_KEYS",
								existingChildKeys: existingChildKeys.join(","),
								fromApiPath: existingWrapper.____slothletInternal.apiPath,
								toApiPath: valueWrapper.____slothletInternal.apiPath,
								valueWrapperId: valueWrapper.____slothletInternal.id || "no-id"
							});

							// Track collision-merged properties so materialization knows these are from file, not folder children
							if (!valueWrapper.____slothletInternal.collisionMergedKeys) {
								valueWrapper.____slothletInternal.collisionMergedKeys = new Set();
							}

							for (const key of existingChildKeys) {
								const child = existingWrapper[key];
								this.slothlet.debug("api", {
									key: "DEBUG_MODE_COLLISION_COPY_INDIVIDUAL_KEY",
									propKey: key,
									childName: child?.name,
									typeOf: typeof child,
									valueWrapperId: valueWrapper.____slothletInternal.id || "no-id"
								});
								Object.defineProperty(valueWrapper, key, {
									value: child,
									writable: false,
									enumerable: true,
									configurable: true
								});
								// Mark this key as collision-merged
								valueWrapper.____slothletInternal.collisionMergedKeys.add(key);
								// Store filePath mapping so child wrappers can inherit correct filePath
								if (existingFilePath) {
									valueWrapper.____slothletInternal.childFilePathsPreMaterialize[key] = existingFilePath;
								}
							}

							// CRITICAL: Trigger early materialization for collision-merged lazy folders
							// This starts loading the folder module so children become available sooner
							// Fire-and-forget: We don't await because collision handling must remain synchronous
							// The folder children will be added to wrapper during materialization
							this.slothlet.debug("api", {
								key: "DEBUG_MODE_COLLISION_TRIGGER_EARLY_MAT",
								apiPath: valueWrapper.____slothletInternal.apiPath
							});
							valueWrapper.____slothletInternal.needsImmediateChildAdoption = true;
							if (
								valueWrapper.____slothletInternal.materializeFunc &&
								!valueWrapper.____slothletInternal.state?.materialized &&
								!valueWrapper.____slothletInternal.state?.inFlight
							) {
								valueWrapper._materialize().catch((err) => {
									new this.slothlet.SlothletWarning(
										"WARNING_COLLISION_TRIGGER_MATERIALIZE_ERROR",
										{
											apiPath: valueWrapper.____slothletInternal.apiPath
										},
										err
									);
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
							key: "DEBUG_MODE_COLLISION_ASSIGN_REPLACING_WITH_LAZY",
							propKey: key,
							collisionMode: valueWrapper.____slothletInternal.state.collisionMode
						});
						targetApi[key] = value;
						return true; // Assignment completed
					}

					// CRITICAL: For materialized lazy wrappers, we need child caches populated
					// In lazy mode, _impl is already set but ___adoptImplChildren hasn't run yet
					const existingChildCount = Object.keys(existingWrapper).filter((k) => !k.startsWith("_") && !k.startsWith("__")).length;
					const valueChildCount = Object.keys(valueWrapper).filter((k) => !k.startsWith("_") && !k.startsWith("__")).length;
					if (existingWrapper.____slothletInternal.impl && existingChildCount === 0) {
						existingWrapper.___adoptImplChildren();
					}
					if (valueWrapper.____slothletInternal.impl && valueChildCount === 0) {
						valueWrapper.___adoptImplChildren();
					}

					// Merge value's child properties into existing's child properties
					// CRITICAL: In merge mode, only ADD new keys, don't OVERWRITE existing ones
					// In merge-replace mode, ADD new keys AND OVERWRITE existing ones
					// When both existing and new child at a key are wrappers, recursively merge
					// their children (e.g., math wrapper from API_TEST merges with math wrapper
					// from API_TEST_COLLISIONS → power, sqrt, modulo get added to existing math)
					const valueChildKeys2 = Object.keys(valueWrapper).filter((k) => !k.startsWith("_") && !k.startsWith("__"));
					for (const key of valueChildKeys2) {
						const child = valueWrapper[key];
						const isInternal = typeof key === "string" && (key.startsWith("_") || key.startsWith("__"));
						// CRITICAL: Use hasOwnProperty to avoid matching ComponentBase prototype getters
						const keyExists = !isInternal && Object.prototype.hasOwnProperty.call(existingWrapper, key);

						if (!keyExists) {
							Object.defineProperty(existingWrapper, key, {
								value: child,
								writable: false,
								enumerable: true,
								configurable: true
							});
						} else if (isMergeReplace) {
							const descriptor = Object.getOwnPropertyDescriptor(existingWrapper, key);
							if (descriptor?.configurable) {
								delete existingWrapper[key];
							}
							Object.defineProperty(existingWrapper, key, {
								value: child,
								writable: false,
								enumerable: true,
								configurable: true
							});
						} else {
							// Merge mode, key exists - recursive merge for nested wrappers
							// Example: existing math has {add, multiply, divide}, new math has {power, sqrt, modulo}
							// → merge adds power, sqrt, modulo into existing math wrapper
							const existingChild = existingWrapper[key];
							const existingChildWrapper = resolveWrapper(existingChild);
							const newChildWrapper = resolveWrapper(child);
							if (existingChildWrapper && newChildWrapper) {
								// Ensure new child has adopted its impl children before merge
								const newChildChildCount = Object.keys(newChildWrapper).filter((k) => !k.startsWith("_") && !k.startsWith("__")).length;
								if (newChildWrapper.____slothletInternal.impl && newChildChildCount === 0) {
									newChildWrapper.___adoptImplChildren();
								}
								const newChildKeys = Object.keys(newChildWrapper).filter((k) => !k.startsWith("_") && !k.startsWith("__"));
								const existingChildKeys = Object.keys(existingChildWrapper).filter((k) => !k.startsWith("_") && !k.startsWith("__"));
								for (const childKey of newChildKeys) {
									const childKeyExists = Object.prototype.hasOwnProperty.call(existingChildWrapper, childKey);
									if (!childKeyExists) {
										Object.defineProperty(existingChildWrapper, childKey, {
											value: newChildWrapper[childKey],
											writable: false,
											enumerable: true,
											configurable: true
										});
									}
								}
							}
						}
					}
					// The value wrapper has the materializeFunc that will load folder's exports
					if (
						valueWrapper.____slothletInternal.mode === "lazy" &&
						!valueWrapper.____slothletInternal.state.materialized &&
						valueWrapper.____slothletInternal.materializeFunc
					) {
						// Don't copy impl - the lazy folder needs to materialize on its own
						// The childCache already has the file's exports from the copy above
						return false; // Assign value, not existing
					}

					return true;
				} else if (existingIsWrapper && !valueIsWrapper) {
					// Existing is wrapper, new value is plain - merge into impl
					const existingWrapper = resolveWrapper(existing);
					const existingImpl = existingWrapper.__impl;
					const mergedImpl = { ...(existingImpl || {}), ...value };
					existingWrapper.___setImpl(mergedImpl);
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
				key: "DEBUG_MODE_MERGE_API_OBJECTS_ENTRY",
				targetApiType: typeof targetApi,
				sourceApiType: typeof sourceApi
			});
			this.slothlet.debug("api", {
				key: "DEBUG_MODE_MERGE_API_OBJECTS_SOURCE_KEYS",
				sourceApiKeys: sourceApi ? Object.keys(sourceApi) : []
			});
		}

		// Allow both objects and functions (functions can have properties too)
		if (!sourceApi || (typeof sourceApi !== "object" && typeof sourceApi !== "function")) {
			if (config?.debug?.api) {
				this.slothlet.debug("api", {
					key: "DEBUG_MODE_MERGE_API_OBJECTS_EXIT_INVALID_SOURCE"
				});
			}
			return;
		}

		const { removeMissing = false, moduleID = null, ...assignOptions } = options;

		// Merge source keys into target
		const sourceKeys = new Set(Object.keys(sourceApi));
		for (const key of sourceKeys) {
			const sourceValue = sourceApi[key];
			const targetValue = targetApi[key];

			if (config?.debug?.api) {
				this.slothlet.debug("api", {
					key: "DEBUG_MODE_MERGE_API_OBJECTS_PROCESSING_KEY",
					propKey: key,
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
						key: "DEBUG_MODE_MERGE_API_OBJECTS_RECURSING",
						propKey: key
					});
				}
				await this.mergeApiObjects(targetValue, sourceValue, options);
			} else {
				// Use unified assignment logic
				if (config?.debug?.api) {
					this.slothlet.debug("api", {
						key: "DEBUG_MODE_MERGE_API_OBJECTS_CALLING_ASSIGN",
						propKey: key
					});
				}
				this.assignToApiPath(targetApi, key, sourceValue, { ...assignOptions, moduleID });
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
