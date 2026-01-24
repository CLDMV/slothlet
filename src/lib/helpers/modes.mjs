/**
 * @fileoverview Shared mode utilities - common logic for eager and lazy modes
 * @module @cldmv/slothlet/helpers/modes
 */
import path from "node:path";
import { SlothletError, SlothletWarning } from "@cldmv/slothlet/errors";
import { loadModule, extractExports, scanDirectory } from "@cldmv/slothlet/helpers/loader";
import { sanitizePropertyName } from "@cldmv/slothlet/helpers/sanitize";
import { getFlatteningDecision, buildCategoryDecisions } from "@cldmv/slothlet/helpers/flatten";
import { t } from "@cldmv/slothlet/i18n";
import { UnifiedWrapper } from "@cldmv/slothlet/handlers/unified-wrapper";
import { shouldAttachNamedExport } from "@cldmv/slothlet/helpers/utilities";

/**
 * Build a safe function name for debug output from an API path or module name.
 * @param {string} name - Name hint to sanitize.
 * @param {string} fallback - Fallback name if the hint is unusable.
 * @returns {string} Safe function name.
 */
function getSafeFunctionName(name, fallback) {
	const safeBase = String(name || "").replace(/[^A-Za-z0-9_$]/g, "_");
	const normalized = safeBase && /^[A-Za-z_$]/.test(safeBase[0]) ? safeBase : safeBase ? `_${safeBase}` : "";
	return normalized || fallback;
}

/**
 * Create a named wrapper for default export functions when they are anonymous.
 * NOTE: This function is now a pass-through since UnifiedWrapper handles name/length/toString
 * through its proxy get trap. Wrapping is no longer needed and causes toString mismatches.
 * @param {Function} fn - Original function.
 * @param {string} nameHint - Name to apply if fn is anonymous or named "default" (unused).
 * @returns {Function} Original function unmodified.
 */
function ensureNamedExportFunction(fn, nameHint) {
	// UnifiedWrapper now handles name, length, and toString through proxy get trap
	// No wrapping needed - return original function as-is
	return fn;
}

/**
 * Create a named async materialization function for lazy subdirectories.
 * @param {string} apiPath - API path to derive the function name from.
 * @param {Function} handler - Async handler that performs materialization.
 * @returns {Function} Named async materialization function.
 */
function createNamedMaterializeFunc(apiPath, handler) {
	const safePath = String(apiPath || "api")
		.replace(/\./g, "__")
		.replace(/[^A-Za-z0-9_$]/g, "_");
	const normalized = safePath && /^[A-Za-z_$]/.test(safePath[0]) ? safePath : safePath ? `_${safePath}` : "api";
	const funcName = `${normalized}__lazy_materializeFunc`;
	return {
		[funcName]: async function (...args) {
			return handler(...args);
		}
	}[funcName];
}

/**
 * Clone eager-mode module exports to avoid mutating import cache objects.
 * @param {unknown} value - Value to clone for wrapping
 * @param {string} mode - Current mode ("eager" or "lazy")
 * @returns {unknown} Cloned value for eager mode, original otherwise
 * @public
 */
function cloneWrapperImpl(value, mode) {
	if (mode !== "eager") {
		return value;
	}
	if (!value || typeof value !== "object") {
		return value;
	}
	if (Array.isArray(value)) {
		return value.slice();
	}
	const descriptors = Object.getOwnPropertyDescriptors(value);
	return Object.create(Object.getPrototypeOf(value), descriptors);
}

/**
 * Helper to determine if collision mode allows ownership conflicts
 * @param {Object} config - Slothlet configuration
 * @param {string} collisionContext - Either 'initial' or 'addApi'
 * @returns {boolean} True if ownership conflicts should be allowed
 */
function getOwnershipCollisionMode(config, collisionContext = "initial") {
	return config.collision?.[collisionContext] || "merge";
}

/**
 * Check if a property assignment should be allowed during initial load.
 * Emits warning if assignment is blocked by config.
 * @param {Object} targetApi - Target API object
 * @param {string} propertyName - Property name to assign
 * @param {unknown} value - Value being assigned
 * @param {Object} config - Slothlet configuration
 * @returns {boolean} True if assignment should proceed, false to skip
 */
function safeAssign(targetApi, propertyName, value, config, collisionContext = "initial", apiPath = "") {
	// Check if property already exists
	const existing = targetApi[propertyName];
	if (existing === undefined) {
		return true; // No conflict, allow assignment
	}

	// Handle collision based on collision context (initial or addApi)
	const collisionMode = config.collision?.[collisionContext] || "merge";

	if (collisionMode === "error") {
		throw new SlothletError("COLLISION_ERROR", {
			apiPath: apiPath || propertyName,
			reason: `Property "${propertyName}" already exists and collision mode is 'error'`,
			validationError: true
		});
	}

	if (collisionMode === "skip") {
		if (!config.silent && config.debug?.api) {
			console.log(`[slothlet] Skipping collision at "${propertyName}" (mode: skip)`);
		}
		return false; // Skip assignment
	}

	if (collisionMode === "warn") {
		if (!config.silent) {
			const isWrapper = !!(existing.__wrapper || existing.__setImpl || existing.__getState);
			new SlothletWarning("WARNING_PROPERTY_COLLISION", {
				propertyName,
				apiPath
			});
			if (isWrapper) {
				new SlothletWarning("WARNING_PROPERTY_COLLISION_WRAPPER", {
					apiPath
				});
			}
		}
		return false; // Keep existing
	}

	if (collisionMode === "replace") {
		if (!config.silent && config.debug?.api) {
			console.log(`[slothlet] Replacing "${propertyName}" (mode: replace)`);
		}
		return true; // Allow replacement
	}

	// Default: merge mode
	// For initial load, merge isn't truly possible (no mutateApiValue available here)
	// So we log and allow the assignment (which may merge at wrapper level if supported)
	if (!config.silent && config.debug?.api) {
		console.log(`[slothlet] Allowing assignment at "${propertyName}" (mode: merge)`);
	}
	return true;
}

/**
 * Universal file processing function for both root and nested directories
 * @param {Object} api - API object being built
 * @param {Array} files - Files to process
 * @param {Object} directory - Directory object (for nested) or null (for root)
 * @param {Object} ownership - Ownership manager
 * @param {Object} contextManager - Context manager
 * @param {string} instanceID - Instance ID
 * @param {Object} config - Configuration
 * @param {number} currentDepth - Current recursion depth
 * @param {string} mode - Mode ("eager" or "lazy")
 * @param {boolean} isRoot - Whether processing root level files (enables root contributor detection)
 * @param {boolean} recursive - Whether to recurse into subdirectories
 * @param {boolean} populateDirectly - Whether to populate api object directly (for lazy materialization)
 * @returns {Promise<Function|null>} Root contributor function if found (only when isRoot=true)
 * @public
 */
export async function processFiles(
	api,
	files,
	directory,
	ownership,
	contextManager,
	instanceID,
	config,
	currentDepth,
	mode,
	isRoot,
	recursive,
	populateDirectly = false,
	apiPathPrefix = "",
	collisionContext = "initial"
) {
	// Helper to build full apiPath with prefix
	const buildApiPath = (path) => {
		if (!apiPathPrefix) return path;
		// Anti-double-prefix: if path already contains the prefix in a dotted chain, don't prepend again
		// Example: if prefix="config" and path="config.get", return "config.get" (don't make "config.config.get")
		// But if prefix="config" and path="config" (matching subdirectory name), still add prefix for "config.config"
		if (path.startsWith(`${apiPathPrefix}.`)) {
			return path; // Already has prefix in chain
		}
		// Always add prefix - even if names match, they represent different levels
		return `${apiPathPrefix}.${path}`;
	};

	let rootDefaultFunction = null;
	const rootContributors = []; // Track all root-level default exports for multi-detection
	const categoryName = isRoot && !populateDirectly ? null : sanitizePropertyName(directory.name);
	let targetApi = isRoot && !populateDirectly ? api : populateDirectly ? api : (api[categoryName] = api[categoryName] || {});
	const shouldWrap = !(mode === "lazy" && populateDirectly);

	if (!isRoot && shouldWrap && !populateDirectly) {
		const existingTarget = api[categoryName];
		if (existingTarget && existingTarget.__wrapper) {
			if (config.debug?.modes) {
				console.log(
					`[CATEGORY REUSE] Reusing existing wrapper for categoryName="${categoryName}", apiPath="${existingTarget.__wrapper.apiPath}"`
				);
			}
			targetApi = existingTarget;
		} else if (existingTarget === undefined || (typeof existingTarget === "object" && existingTarget !== null)) {
			// If existingTarget is a wrapper proxy, don't try to clone it - use empty object
			// The wrapper will be populated with new children during file processing
			const initialImpl = existingTarget && existingTarget.__wrapper ? {} : cloneWrapperImpl(existingTarget || {}, mode);

			if (config.debug?.modes) {
				console.log(`[CATEGORY WRAPPER CREATED] categoryName="${categoryName}", apiPath="${buildApiPath(categoryName)}"`);
			}
			const wrapper = new UnifiedWrapper({
				mode,
				apiPath: buildApiPath(categoryName),
				contextManager,
				instanceID,
				initialImpl,
				ownership
			});
			api[categoryName] = wrapper.createProxy();
			if (config.debug?.modes) {
				console.log(`[CATEGORY WRAPPER ASSIGNED] api["${categoryName}"] is now a wrapper`);
			}
			targetApi = api[categoryName];
			if (config.debug?.modes) {
				console.log(`[CATEGORY CREATED] Created new category wrapper for categoryName="${categoryName}", apiPath="${wrapper.apiPath}"`);
				console.log(`[CATEGORY CREATED] targetApi is wrapper: ${!!targetApi.__wrapper}, targetApi keys: ${Object.keys(targetApi)}`);
			}
		}
	}

	if (!isRoot && config.debug?.modes) {
		console.log(await t("DEBUG_MODE_PROCESSING_DIRECTORY", { mode, categoryName, currentDepth }));
	}

	// Load all modules
	const loadedModules = [];
	for (const file of files) {
		if (config.debug?.modes && categoryName === "string") {
			console.log(
				`[PROCESS FILE] categoryName=${categoryName}, file=${file.name}, isRoot=${isRoot}, populateDirectly=${populateDirectly}, mode=${mode}`
			);
		}

		try {
			const mod = await loadModule(file.path, instanceID);
			const exports = extractExports(mod);
			const moduleName = sanitizePropertyName(file.name);
			const moduleKeys = Object.keys(exports).filter((k) => k !== "default");
			const analysis = {
				hasDefault: exports.default !== undefined,
				hasNamed: moduleKeys.length > 0,
				defaultExportType: exports.default ? typeof exports.default : null
			};

			loadedModules.push({ file, mod: exports, moduleName, moduleKeys, analysis });
		} catch (error) {
			if (error.name === "SlothletError") throw error;
			throw new SlothletError("MODULE_LOAD_FAILED", { modulePath: file.path, moduleId: file.moduleId }, error);
		}
	}

	// Calculate if there are multiple default exports in this directory
	const hasMultipleDefaults = loadedModules.filter((m) => m.analysis.hasDefault).length > 1;

	// Process each module
	for (const { file, mod, moduleName, moduleKeys, analysis } of loadedModules) {
		if (config.debug?.modes && categoryName === "logger") {
			console.log(
				`[PROCESS MODULE] categoryName=logger, moduleName=${moduleName}, hasDefault=${analysis.hasDefault}, moduleKeys=${moduleKeys.join(",")}, targetApi type=${typeof targetApi}, targetApi callable=${typeof targetApi === "function"}`
			);
		}
		// Check for root contributor (only at root level)
		const isRootContributor = isRoot && analysis.hasDefault && typeof mod.default === "function";

		if (moduleName === "config" || moduleKeys.some((k) => k.includes("Config") || k.includes("config"))) {
			if (config.debug?.modes) {
				console.log(
					`[FILE PROCESSING] module="${moduleName}", category="${categoryName || "(none)"}", isRoot=${isRoot}, hasDefault=${analysis.hasDefault}, moduleKeys=[${moduleKeys.join(", ")}]`
				);
			}
		}

		if (isRootContributor) {
			// Build the function with named exports attached
			const defaultFunc = ensureNamedExportFunction(mod.default, moduleName);
			for (const key of moduleKeys) {
				if (!shouldAttachNamedExport(key, mod[key], defaultFunc, mod.default)) {
					continue;
				}
				defaultFunc[key] = mod[key];
			}

			// Track root-level default function exports for post-processing
			rootContributors.push({ moduleName, file, defaultFunc });
		} else {
			// Regular module - apply flattening decisions
			const decision = getFlatteningDecision({
				mod,
				moduleName,
				categoryName: categoryName || moduleName,
				analysis,
				hasMultipleDefaults,
				moduleKeys
			});

			if (config.debug?.modes) {
				console.log(await t("DEBUG_MODE_MODULE_DECISION", { mode, moduleName, reason: decision.reason }));
			}

			// Use preferred name from decision (Rule 9 - Function Name Preference)
			const propertyName = decision.preferredName || moduleName;

			// Build module content based on decision
			let moduleContent = {};

			if (decision.useAutoFlattening) {
				// C04: Single named export matches module name
				moduleContent = mod[moduleName];
			} else if (mod.default && moduleKeys.length > 0 && typeof mod.default === "function") {
				// Hybrid pattern: default function + named exports
				// Attach named exports as properties on the function (like logger(), logger.info())
				moduleContent = ensureNamedExportFunction(mod.default, propertyName);
				for (const key of moduleKeys) {
					if (!shouldAttachNamedExport(key, mod[key], moduleContent, mod.default)) {
						continue;
					}
					moduleContent[key] = mod[key];
				}
			} else if (mod.default && moduleKeys.length === 0) {
				// Only default export - use it directly (no need to wrap in object)
				moduleContent = ensureNamedExportFunction(mod.default, propertyName);
			} else {
				// Multiple named exports or mixed default (non-function) + named
				if (mod.default) moduleContent.default = mod.default;
				for (const key of moduleKeys) {
					moduleContent[key] = mod[key];
				}
			}

			// Special case: folder/folder.mjs pattern (only for nested, not root)
			// When apiPathPrefix is set, we're building a sub-API that should act like root (no flattening)
			if (!isRoot && !apiPathPrefix && moduleName === categoryName) {
				if (moduleKeys.length === 1 && moduleKeys[0] === moduleName && !analysis.hasDefault) {
					// Case 1: export const folder = {...} - wrap and use as category
					const exportedValue = mod[moduleName];
					if (typeof exportedValue === "object" && exportedValue !== null) {
						if (config.debug?.modes && categoryName === "string") {
							console.log(
								`[SINGLE-FILE FOLDER] categoryName=${categoryName}, populateDirectly=${populateDirectly}, isRoot=${isRoot}, mode=${mode}, exportKeys=${Object.keys(exportedValue).join(",")}`
							);
						}

						// CRITICAL: Wrap the object so all its functions get context wrapping
						if (shouldWrap) {
							const wrapper = new UnifiedWrapper({
								mode,
								apiPath: buildApiPath(categoryName),
								materializeOnCreate: config.backgroundMaterialize
							});

							// Replace targetApi reference with the wrapped proxy
							// This allows other files in the folder to attach properties if needed
							api[categoryName] = wrapper.createProxy();
							targetApi = api[categoryName];
						} else {
							api[categoryName] = exportedValue;
							targetApi = api[categoryName];
						}

						if (config.debug?.modes && categoryName === "string") {
							console.log(
								`[SINGLE-FILE FOLDER] Set api.${categoryName} to wrapped proxy, impl keys=${Object.keys(exportedValue).join(",")}`
							);
						}

						// Register each property for ownership tracking
						for (const key of Object.keys(exportedValue)) {
							if (ownership) {
								ownership.register({
									moduleId: file.moduleId,
									apiPath: `${categoryName}.${key}`,
									source: "core",
									collisionMode: getOwnershipCollisionMode(config, collisionContext)
								});
							}
						}
						continue;
					}
				} else if (analysis.hasDefault) {
					// Case 2: folder/folder.mjs with default export
					// Make the category callable by replacing it with wrapped function
					// But DON'T continue - allow other files to attach properties later
					// Example: logger/logger.mjs (default function) + logger/utils.mjs (named exports)
					// Result: api.logger() callable + api.logger.utils.* from other files
					const namedKeys = moduleKeys.length > 0 ? moduleKeys : Object.keys(mod).filter((key) => key !== "default");
					const callableModule = typeof mod.default === "function" ? ensureNamedExportFunction(mod.default, categoryName) : moduleContent;
					if (typeof callableModule === "function" && namedKeys.length > 0) {
						for (const key of namedKeys) {
							if (!shouldAttachNamedExport(key, mod[key], callableModule, mod.default)) {
								continue;
							}
							if (callableModule[key] === undefined) {
								callableModule[key] = mod[key];
							}
						}
					}
					moduleContent = callableModule;
					if (shouldWrap) {
						const wrapper = new UnifiedWrapper({
							mode,
							apiPath: buildApiPath(categoryName),
							contextManager,
							instanceID,
							initialImpl: cloneWrapperImpl(moduleContent, mode),
							ownership,
							materializeOnCreate: config.backgroundMaterialize
						});

						// Replace the empty object with the wrapped callable function
						api[categoryName] = wrapper.createProxy();
						// Update targetApi reference to point to the new function so other files can attach properties
						targetApi = api[categoryName];
					} else {
						api[categoryName] = moduleContent;
						targetApi = api[categoryName];
					}

					if (namedKeys.length > 0) {
						for (const key of namedKeys) {
							if (key === "default") {
								continue;
							}
							if (shouldWrap) {
								const namedWrapper = new UnifiedWrapper({
									mode,
									apiPath: buildApiPath(`${categoryName}.${key}`),
									contextManager,
									instanceID,
									initialImpl: mod[key],
									ownership,
									materializeOnCreate: config.backgroundMaterialize
								});
								if (safeAssign(targetApi, key, namedWrapper.createProxy(), config, collisionContext, `${categoryName}.${key}`)) {
									targetApi[key] = namedWrapper.createProxy();
								}
							} else {
								if (safeAssign(targetApi, key, mod[key], config, collisionContext, `${categoryName}.${key}`)) {
									targetApi[key] = mod[key];
								}
							}
							if (ownership) {
								ownership.register({
									moduleId: file.moduleId,
									apiPath: `${categoryName}.${key}`,
									source: "core",
									collisionMode: getOwnershipCollisionMode(config, collisionContext)
								});
							}
						}
					}

					if (ownership) {
						ownership.register({
							moduleId: file.moduleId,
							apiPath: categoryName,
							source: "core",
							collisionMode: getOwnershipCollisionMode(config, collisionContext)
						});
					}

					// Continue for this module; other files in the folder still process in later iterations
					continue;
				} else if (moduleKeys.length > 0) {
					// Case 3: Multiple named exports - flatten to category level (Rule 6 - F01)
					// Example: util/util.mjs with exports { size, secondFunc } → api.util.size(), api.util.secondFunc()
					// OR: multi_func.mjs with exports { uniqueOne, uniqueTwo, multi_func: {...} } → flatten multi_func object + expose others

					// Check if this specific file has a matching object export
					const hasMatchingObject = moduleKeys.some(
						(key) => key === moduleName && typeof mod[key] === "object" && mod[key] !== null && !Array.isArray(mod[key])
					);

					if (hasMatchingObject) {
						// This file has export const folder = {...}
						// Flatten the object's properties AND add other exports to category
						const matchingObj = mod[moduleName];

						// Add matching object's properties to category
						for (const [propKey, propValue] of Object.entries(matchingObj)) {
							if (shouldWrap) {
								const wrapper = new UnifiedWrapper({
									mode,
									apiPath: buildApiPath(`${categoryName}.${propKey}`),
									contextManager,
									instanceID,
									initialImpl: cloneWrapperImpl(propValue, mode),
									ownership,
									materializeOnCreate: config.backgroundMaterialize
								});
								if (safeAssign(targetApi, propKey, wrapper.createProxy(), config, collisionContext, `${categoryName}.${propKey}`)) {
									targetApi[propKey] = wrapper.createProxy();
								}
							} else {
								if (safeAssign(targetApi, propKey, propValue, config, collisionContext, `${categoryName}.${propKey}`)) {
									targetApi[propKey] = propValue;
								}
							}
							if (ownership) {
								ownership.register({
									moduleId: file.moduleId,
									apiPath: `${categoryName}.${propKey}`,
									source: "core",
									collisionMode: getOwnershipCollisionMode(config, collisionContext)
								});
							}
						}

						// Add other named exports from this file to category
						for (const key of moduleKeys) {
							if (key !== moduleName) {
								if (shouldWrap) {
									const wrapper = new UnifiedWrapper({
										mode,
										apiPath: buildApiPath(`${categoryName}.${key}`),
										contextManager,
										instanceID,
										initialImpl: cloneWrapperImpl(mod[key], mode),
										ownership,
										materializeOnCreate: config.backgroundMaterialize
									});
									if (safeAssign(targetApi, key, wrapper.createProxy(), config, collisionContext, `${categoryName}.${key}`)) {
										targetApi[key] = wrapper.createProxy();
									}
								} else {
									if (safeAssign(targetApi, key, mod[key], config, collisionContext, `${categoryName}.${key}`)) {
										targetApi[key] = mod[key];
									}
								}
								if (ownership) {
									ownership.register({
										moduleId: file.moduleId,
										apiPath: `${categoryName}.${key}`,
										source: "core",
										collisionMode: getOwnershipCollisionMode(config, collisionContext)
									});
								}
							}
						}
					} else {
						// Regular multi-export file (no matching object)
						if (config.debug?.modes) {
							console.log(`[FLATTEN MULTI-EXPORT] File "${moduleName}" in category "${categoryName}", has ${moduleKeys.length} exports`);
							console.log(`[FLATTEN MULTI-EXPORT] targetApi is wrapper: ${!!targetApi.__wrapper}, keys before: ${Object.keys(targetApi)}`);
						}
						for (const key of moduleKeys) {
							if (config.debug?.modes) {
								console.log(`[FLATTEN MULTI-EXPORT] Assigning export "${key}" to targetApi`);
							}
							if (shouldWrap) {
								const wrapper = new UnifiedWrapper({
									mode,
									apiPath: buildApiPath(`${categoryName}.${key}`),
									contextManager,
									instanceID,
									initialImpl: cloneWrapperImpl(mod[key], mode),
									ownership,
									materializeOnCreate: config.backgroundMaterialize
								});
								if (safeAssign(targetApi, key, wrapper.createProxy(), config, collisionContext, `${categoryName}.${key}`)) {
									targetApi[key] = wrapper.createProxy();
									console.log(`[FLATTEN MULTI-EXPORT] ✓ Assigned "${key}" to targetApi, keys after: ${Object.keys(targetApi)}`);
								} else {
									console.log(`[FLATTEN MULTI-EXPORT] ✗ safeAssign blocked "${key}"`);
								}
							} else {
								if (safeAssign(targetApi, key, mod[key], config, collisionContext, `${categoryName}.${key}`)) {
									targetApi[key] = mod[key];
								}
							}
							if (ownership) {
								ownership.register({
									moduleId: file.moduleId,
									apiPath: `${categoryName}.${key}`,
									source: "core",
									collisionMode: getOwnershipCollisionMode(config, collisionContext)
								});
							}
						}
					}
					continue;
				}
			}

			// Regular files with only named exports (no default) - expose each export directly
			// Example: get-http-status.mjs with export { getHTTPStatus } → api.util.getHTTPStatus()
			// BUT: Only applies when the export name matches the file name (auto-flattening)
			// This prevents helper.mjs with 'export const utilities' from being flattened incorrectly
			if (!analysis.hasDefault && moduleKeys.length === 1 && !isRoot) {
				const key = moduleKeys[0];
				// Only auto-flatten if the export name matches the module name (case-insensitive, ignore separators)
				const normalizedKey = key.toLowerCase().replace(/[-_]/g, "");
				const normalizedModuleName = moduleName.toLowerCase().replace(/[-_]/g, "");

				if (normalizedKey === normalizedModuleName) {
					// Prefer the actual export name over sanitized filename (preserves capitalization like parseJSON, getHTTPStatus)
					const preferredName = key;
					if (shouldWrap) {
						const wrapper = new UnifiedWrapper({
							mode,
							apiPath: buildApiPath(`${categoryName}.${preferredName}`),
							contextManager,
							instanceID,
							initialImpl: cloneWrapperImpl(mod[key], mode),
							ownership,
							materializeOnCreate: config.backgroundMaterialize
						});
						if (safeAssign(targetApi, preferredName, wrapper.createProxy(), config, collisionContext, preferredName)) {
							targetApi[preferredName] = wrapper.createProxy();
						}
					} else {
						if (safeAssign(targetApi, preferredName, mod[key], config, collisionContext, preferredName)) {
							targetApi[preferredName] = mod[key];
						}
					}
					if (ownership) {
						ownership.register({
							moduleId: file.moduleId,
							apiPath: `${categoryName}.${preferredName}`,
							source: "core",
							collisionMode: getOwnershipCollisionMode(config, collisionContext)
						});
					}
					continue;
				}
			}

			// Wrap in UnifiedWrapper
			if (shouldWrap) {
				const localPath = isRoot ? propertyName : `${categoryName}.${propertyName}`;
				const wrapper = new UnifiedWrapper({
					mode,
					apiPath: buildApiPath(localPath),
					contextManager,
					instanceID,
					initialImpl: cloneWrapperImpl(moduleContent, mode),
					ownership,
					materializeOnCreate: config.backgroundMaterialize
				});

				console.log(
					`[FILE WRAPPER ASSIGNMENT] propertyName="${propertyName}", apiPath="${buildApiPath(localPath)}", overwriting="${propertyName in targetApi ? (targetApi[propertyName]?.__wrapper ? "wrapper" : "value") : "nothing"}"`
				);
				targetApi[propertyName] = wrapper.createProxy();
			} else {
				targetApi[propertyName] = moduleContent;
			}
			if (config.debug?.modes && categoryName === "logger") {
				console.log(
					`[AFTER ASSIGN] targetApi type=${typeof targetApi}, propertyName=${propertyName}, has property=${propertyName in targetApi}, _impl type=${typeof targetApi.__wrapper?._impl}, _impl.utils=${typeof targetApi.__wrapper?._impl?.utils}`
				);
			}
			if (ownership) {
				const apiPath = isRoot ? propertyName : `${categoryName}.${propertyName}`;
				const collisionMode = config.collision?.[collisionContext] || "merge";
				ownership.register({
					moduleId: file.moduleId,
					apiPath,
					source: "core",
					collisionMode: getOwnershipCollisionMode(config, collisionContext),
					collisionMode,
					config
				});
			}
		}
	}

	// Handle subdirectories based on mode
	if (config.debug?.modes) {
		console.log(
			`[SUBDIR CHECK] isRoot=${isRoot}, categoryName=${categoryName}, directory=${directory ? "exists" : "null"}, children=${directory?.children ? "exists" : "null"}, directories=${directory?.children?.directories ? directory.children.directories.length : "none"}`
		);
	}
	console.log(
		`[DIRECTORY CHECK] directory.children exists: ${!!directory?.children}, directories exists: ${!!directory?.children?.directories}, length: ${directory?.children?.directories?.length || 0}`
	);
	if (directory?.children?.directories) {
		console.log(`[DIRECTORY CHECK PASSED] Will check recursive flag: ${recursive}`);
		if (config.debug?.modes) {
			console.log(`[SUBDIR FOUND] Processing ${directory.children.directories.length} subdirectories, recursive=${recursive}`);
		}
		if (recursive) {
			// Eager mode: recurse into subdirectories
			console.log(`[SUBDIRECTORY LOOP] directory.children.directories.length=${directory.children.directories.length}`);
			for (const subDir of directory.children.directories) {
				console.log(
					`[PROCESSING SUBDIRECTORY] name="${subDir.name}", fileCount=${subDir.children.files.length}, subdirCount=${subDir.children.directories.length}`
				);
				const subDirName = sanitizePropertyName(subDir.name);

				// Check if this is a single-file folder that might need special handling
				if (subDir.children.files.length === 1 && subDir.children.directories.length === 0) {
					const file = subDir.children.files[0];
					const moduleName = sanitizePropertyName(file.name);
					const genericFilenames = ["singlefile", "index", "main", "default"];
					const isGeneric = genericFilenames.includes(moduleName.toLowerCase());
					const filenameMatchesFolder = moduleName === subDirName;

					// Only apply folder-level flattening for specific cases:
					// 1. Generic filenames (singlefile, index, main, default)
					// 2. Filename matches folder name
					// 3. Has default export (checked below)
					if (isGeneric || filenameMatchesFolder) {
						console.log(
							`[FOLDER-LEVEL FLATTEN CHECK] subDir="${subDirName}", file="${moduleName}", isGeneric=${isGeneric}, filenameMatches=${filenameMatchesFolder}`
						);
						const mod = await loadModule(file.path, instanceID);
						const exports = extractExports(mod);
						const moduleKeys = Object.keys(exports).filter((k) => k !== "default");
						const analysis = {
							hasDefault: exports.default !== undefined,
							hasNamed: moduleKeys.length > 0,
							defaultExportType: exports.default ? typeof exports.default : null
						};

						const modContent = exports.default !== undefined ? exports.default : exports;
						const categoryDecision = buildCategoryDecisions({
							categoryName: subDirName,
							mod: modContent,
							moduleName,
							fileBaseName: file.name,
							analysis,
							moduleKeys,
							currentDepth: currentDepth + 1,
							moduleFiles: subDir.children.files
						});

						// When apiPathPrefix is set, we're building a sub-API that should act like root (no flattening)
						if (categoryDecision.shouldFlatten && !apiPathPrefix) {
							console.log(`[FOLDER-LEVEL FLATTEN] Flattening "${subDirName}" folder, SKIPPING regular processFiles recursion`);
							// For filename-folder match with named export, extract the matching export
							// Example: date/date.mjs with 'export const date = {...}' → nested.date = {...}
							let implToWrap;
							if (moduleName === subDirName && moduleKeys.includes(subDirName)) {
								// Named export matches folder name - use that specific export
								implToWrap = exports[subDirName];
							} else if (exports.default !== undefined) {
								// Default export - use it
								implToWrap = exports.default;
								if (typeof implToWrap === "function" && moduleKeys.length > 0) {
									for (const key of moduleKeys) {
										if (key !== "default" && implToWrap[key] === undefined) {
											implToWrap[key] = exports[key];
										}
									}
								}
							} else {
								// Fallback - use the whole module
								implToWrap = modContent;
							}

							// Flatten: put the module content directly at targetApi[subDirName]
							const wrapper = new UnifiedWrapper({
								mode,
								apiPath: buildApiPath(categoryName ? `${categoryName}.${subDirName}` : subDirName),
								contextManager,
								instanceID,
								initialImpl: cloneWrapperImpl(implToWrap, mode),
								ownership,
								materializeOnCreate: config.backgroundMaterialize
							});
							targetApi[subDirName] = wrapper.createProxy();
							if (ownership) {
								const apiPath = buildApiPath(categoryName ? `${categoryName}.${subDirName}` : subDirName);
								const collisionMode = config.collision?.[collisionContext] || "merge";
								ownership.register({
									moduleId: file.moduleId,
									apiPath,
									source: "core",
									collisionMode: getOwnershipCollisionMode(config, collisionContext),
									collisionMode,
									config
								});
							}
							continue;
						}
					}
				}

				// Regular subdirectory processing
				await processFiles(
					targetApi,
					subDir.children.files,
					{ name: subDirName, children: subDir.children },
					ownership,
					contextManager,
					instanceID,
					config,
					currentDepth + 1,
					mode,
					false, // Not root
					recursive, // Pass through recursive flag
					false, // populateDirectly - build on parent api
					apiPathPrefix // Pass through apiPathPrefix to subdirectories
				);
			}
		} else {
			// Lazy mode: create lazy wrappers for subdirectories
			for (const subDir of directory.children.directories) {
				const subDirName = sanitizePropertyName(subDir.name);
				const apiPath = categoryName ? `${categoryName}.${subDirName}` : subDirName;
				if (config.debug?.modes) {
					console.log(`[LAZY SUBDIR] Creating for ${apiPath}, files=${subDir.children.files.length}`);
				}
				targetApi[subDirName] = createLazySubdirectoryWrapper(subDir, ownership, contextManager, instanceID, apiPath, config);
			}
		}
	}

	// Post-process root contributors based on count
	if (isRoot && rootContributors.length > 0) {
		if (rootContributors.length === 1) {
			// Single root contributor: make it the root callable (don't namespace)
			const { moduleName, file, defaultFunc } = rootContributors[0];
			rootDefaultFunction = defaultFunc;
			if (config.debug?.modes) {
				console.log(await t("DEBUG_MODE_ROOT_CONTRIBUTOR", { mode, functionName: defaultFunc.name || "anonymous" }));
			}
			if (ownership) {
				ownership.register({
					moduleId: file.moduleId,
					apiPath: moduleName,
					source: "core",
					collisionMode: getOwnershipCollisionMode(config, collisionContext)
				});
			}
		} else {
			// Multiple root contributors: namespace ALL of them and warn
			new SlothletWarning("WARNING_MULTIPLE_ROOT_CONTRIBUTORS", {
				rootContributors: rootContributors.map((rc) => rc.moduleName).join(", "),
				firstContributor: rootContributors[0].moduleName
			});

			for (const { moduleName, file, defaultFunc } of rootContributors) {
				// Wrap in UnifiedWrapper if needed
				if (shouldWrap) {
					const wrapper = new UnifiedWrapper({
						mode,
						apiPath: buildApiPath(moduleName),
						contextManager,
						instanceID,
						initialImpl: cloneWrapperImpl(defaultFunc, mode),
						ownership,
						materializeOnCreate: config.backgroundMaterialize
					});
					if (safeAssign(targetApi, moduleName, wrapper.createProxy(), config, collisionContext, moduleName)) {
						targetApi[moduleName] = wrapper.createProxy();
					}
				} else {
					if (safeAssign(targetApi, moduleName, defaultFunc, config, collisionContext, moduleName)) {
						targetApi[moduleName] = defaultFunc;
					}
				}

				if (ownership) {
					ownership.register({
						moduleId: file.moduleId,
						apiPath: moduleName,
						source: "core",
						collisionMode: getOwnershipCollisionMode(config, collisionContext)
					});
				}
			}
		}
	}

	return rootDefaultFunction;
}

/**
 * Create lazy wrapper for subdirectory (lazy mode only)
 * @param {Object} dir - Directory structure
 * @param {Object} ownership - Ownership manager
 * @param {Object} contextManager - Context manager
 * @param {string} instanceID - Instance ID
 * @param {string} apiPath - Current API path
 * @param {Object} config - Configuration
 * @returns {Proxy} Lazy unified wrapper
 * @private
 */
export function createLazySubdirectoryWrapper(dir, ownership, contextManager, instanceID, apiPath, config) {
	// Create materialization function (POC pattern: returns implementation, doesn't take wrapper param)
	/**
	 * Materialize a lazy subdirectory into a concrete implementation object.
	 * @returns {Promise<unknown>} Materialized implementation for this subdirectory
	 * @private
	 */
	const lazy_materializeFunc = createNamedMaterializeFunc(apiPath, async () => {
		if (config.debug?.modes) {
			console.log(`[MATERIALIZE FUNC] Starting for dir=${dir.name}, files=${dir.children.files?.length || 0}`);
		}
		const categoryName = sanitizePropertyName(dir.name);

		const materialized = {};
		const subDirs = dir.children.directories || [];

		if (dir.children.files.length === 1 && subDirs.length === 0) {
			const file = dir.children.files[0];
			const moduleName = sanitizePropertyName(file.name);
			const genericFilenames = ["singlefile", "index", "main", "default"];
			const isGeneric = genericFilenames.includes(moduleName.toLowerCase());
			const filenameMatchesFolder = moduleName === categoryName;

			if (isGeneric || filenameMatchesFolder) {
				const mod = await loadModule(file.path, instanceID);
				const exports = extractExports(mod);
				const moduleKeys = Object.keys(exports).filter((k) => k !== "default");
				const analysis = {
					hasDefault: exports.default !== undefined,
					hasNamed: moduleKeys.length > 0,
					defaultExportType: exports.default ? typeof exports.default : null
				};
				const modContent = exports.default !== undefined ? exports.default : exports;
				const categoryDecision = buildCategoryDecisions({
					categoryName,
					mod: modContent,
					moduleName,
					fileBaseName: file.name,
					analysis,
					moduleKeys,
					currentDepth: apiPath.split(".").length,
					moduleFiles: dir.children.files
				});

				if (categoryDecision.shouldFlatten) {
					let implToWrap;
					if (moduleName === categoryName && moduleKeys.includes(categoryName)) {
						implToWrap = exports[categoryName];
					} else if (exports.default !== undefined) {
						implToWrap = ensureNamedExportFunction(exports.default, categoryName);
						// Hybrid pattern: default function + named exports
						// Attach named exports as properties on the function
						if (typeof implToWrap === "function" && moduleKeys.length > 0) {
							for (const key of moduleKeys) {
								if (!shouldAttachNamedExport(key, exports[key], implToWrap, exports.default)) {
									continue;
								}
								implToWrap[key] = exports[key];
							}
						}
					} else {
						implToWrap = modContent;
					}

					// OWNERSHIP NOTE: Do NOT register ownership here during lazy materialization
					// Ownership is registered AFTER buildAPI completes via registerAPIWithOwnership()
					// in slothlet.mjs. Registering here causes conflicts because:
					// 1. Initial build registers entire API tree with moduleId="base"
					// 2. Lazy materialization would try to re-register with file-specific moduleId
					// 3. Different moduleIds trigger OWNERSHIP_CONFLICT unless allowConflict=true
					// The collision config should be respected via registerAPIWithOwnership, not here

					return implToWrap;
				}
			}
		}

		// Process files in this directory using unified processFiles
		// IMPORTANT: populateDirectly=true to populate materialized object directly
		// But isRoot=false so flattening logic knows we're inside a category
		await processFiles(
			materialized,
			dir.children.files,
			{ name: dir.name, children: dir.children },
			ownership,
			contextManager,
			instanceID,
			config,
			0,
			"eager",
			false, // Not root (for root contributor detection)
			false, // NOT recursive - create lazy wrappers for subdirectories, don't cascade eager load
			true // Populate directly (don't nest under categoryName)
		);

		if (config.debug?.modes) {
			console.log(`[MATERIALIZE FUNC] Returning impl for dir=${dir.name}, keys=${Object.keys(materialized).join(",")}`);
		}
		const materializedKeys = Object.keys(materialized);
		// Check for folder/folder.mjs pattern - if materialized has a property matching the folder name,
		// attach all other properties to it (e.g., logger/logger.mjs + logger/utils.mjs → logger function with .utils attached)
		if (materializedKeys.includes(categoryName) && materializedKeys.length > 1) {
			if (config.debug?.modes) {
				console.log(`[FOLDER PATTERN MATCH] dir=${dir.name}, categoryName=${categoryName}, keys=${materializedKeys.join(",")}`);
			}
			const mainValue = materialized[categoryName];
			// Attach all other properties to the main value
			for (const key of materializedKeys) {
				if (key !== categoryName) {
					if (config.debug?.modes) {
						console.log(`[FOLDER PATTERN ATTACH] ${categoryName}.${key} = ${typeof materialized[key]}`);
					}
					mainValue[key] = materialized[key];
				}
			}
			if (config.debug?.modes) {
				console.log(
					`[FOLDER PATTERN RETURN] Returning ${categoryName} with keys: ${Object.keys(mainValue)
						.filter((k) => !k.startsWith("__"))
						.join(",")}`
				);
			}
			return mainValue;
		}
		if (materializedKeys.length === 1 && materializedKeys[0] === categoryName) {
			const nestedValue = materialized[categoryName];
			if (nestedValue && (nestedValue.__wrapper || nestedValue.__getState)) {
				const attachedKeys = Object.keys(nestedValue).filter((key) => key !== "__wrapper");
				if (attachedKeys.length > 0) {
					return nestedValue;
				}
				return nestedValue.__impl ?? nestedValue;
			}
			return nestedValue;
		}

		// POC pattern: return the materialized implementation
		return materialized;
	});

	// Create unified wrapper in lazy mode
	const wrapper = new UnifiedWrapper({
		mode: "lazy",
		apiPath,
		contextManager,
		instanceID,
		materializeFunc: lazy_materializeFunc,
		ownership,
		materializeOnCreate: config.backgroundMaterialize
	});

	return wrapper.createProxy();
}

/**
 * Apply root contributor pattern - merge API into root function
 * @param {Object} api - API object with properties
 * @param {Function|null} rootFunction - Root contributor function
 * @param {Object} config - Configuration
 * @param {string} mode - Mode name for debug messages
 * @returns {Promise<Object|Function>} Final API (function if root contributor, object otherwise)
 * @public
 */
export async function applyRootContributor(api, rootFunction, config, mode) {
	if (rootFunction) {
		// Merge all other API properties onto the root function
		Object.assign(rootFunction, api);
		if (config.debug?.modes) {
			console.log(await t("DEBUG_MODE_ROOT_CONTRIBUTOR_APPLIED", { mode, properties: Object.keys(api).length }));
		}
		return rootFunction;
	}
	return api;
}
