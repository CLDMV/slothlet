/**
 * @fileoverview Shared mode utilities - common logic for eager and lazy modes
 * @module @cldmv/slothlet/helpers/modes
 */
import path from "node:path";
import { SlothletError } from "@cldmv/slothlet/errors";
import { loadModule, extractExports, scanDirectory } from "@cldmv/slothlet/helpers/loader";
import { sanitizePropertyName } from "@cldmv/slothlet/helpers/sanitize";
import { getFlatteningDecision, buildCategoryDecisions } from "@cldmv/slothlet/helpers/flatten";
import { t } from "@cldmv/slothlet/i18n";
import { UnifiedWrapper } from "@cldmv/slothlet/handlers/unified-wrapper";

/**
 * Universal file processing function for both root and nested directories
 * @param {Object} api - API object being built
 * @param {Array} files - Files to process
 * @param {Object} directory - Directory object (for nested) or null (for root)
 * @param {Object} ownership - Ownership manager
 * @param {Object} contextManager - Context manager
 * @param {string} instanceId - Instance ID
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
	instanceId,
	config,
	currentDepth,
	mode,
	isRoot,
	recursive,
	populateDirectly = false
) {
	let rootDefaultFunction = null;
	const categoryName = isRoot && !populateDirectly ? null : sanitizePropertyName(directory.name);
	let targetApi = isRoot && !populateDirectly ? api : populateDirectly ? api : (api[categoryName] = api[categoryName] || {});

	if (!isRoot && config.debug?.modes) {
		console.log(await t("DEBUG_MODE_PROCESSING_DIRECTORY", { mode, categoryName, currentDepth }));
	}

	// Load all modules
	const loadedModules = [];
	for (const file of files) {
		try {
			const mod = await loadModule(file.path);
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
		// Check for root contributor (only at root level)
		const isRootContributor = isRoot && analysis.hasDefault && typeof mod.default === "function";

		if (isRootContributor) {
			// Root contributor: default function with named exports attached
			const defaultFunc = mod.default;
			for (const key of moduleKeys) {
				defaultFunc[key] = mod[key];
			}

			if (ownership) {
				ownership.register({ moduleId: file.moduleId, apiPath: moduleName, source: "core" });
			}

			if (!rootDefaultFunction) {
				rootDefaultFunction = defaultFunc;
				if (config.debug?.modes) {
					console.log(await t("DEBUG_MODE_ROOT_CONTRIBUTOR", { mode, functionName: defaultFunc.name || "anonymous" }));
				}
			}
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
				moduleContent = mod.default;
				for (const key of moduleKeys) {
					moduleContent[key] = mod[key];
				}
			} else if (mod.default && moduleKeys.length === 0) {
				// Only default export - use it directly (no need to wrap in object)
				moduleContent = mod.default;
			} else {
				// Multiple named exports or mixed default (non-function) + named
				if (mod.default) moduleContent.default = mod.default;
				for (const key of moduleKeys) {
					moduleContent[key] = mod[key];
				}
			}

			// Special case: folder/folder.mjs pattern (only for nested, not root)
			if (!isRoot && moduleName === categoryName) {
				if (moduleKeys.length === 1 && moduleKeys[0] === moduleName && !analysis.hasDefault) {
					// Case 1: export const folder = {...} - wrap and use as category
					const exportedValue = mod[moduleName];
					if (typeof exportedValue === "object" && exportedValue !== null) {
						// CRITICAL: Wrap the object so all its functions get context wrapping
						const wrapper = new UnifiedWrapper({
							mode,
							apiPath: categoryName,
							contextManager,
							instanceId,
							initialImpl: exportedValue,
							ownership
						});

						// Replace targetApi reference with the wrapped proxy
						// This allows other files in the folder to attach properties if needed
						api[categoryName] = wrapper.createProxy();
						targetApi = api[categoryName];

						// Register each property for ownership tracking
						for (const key of Object.keys(exportedValue)) {
							if (ownership) {
								ownership.register({ moduleId: file.moduleId, apiPath: `${categoryName}.${key}`, source: "core" });
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
					const wrapper = new UnifiedWrapper({
						mode,
						apiPath: categoryName,
						contextManager,
						instanceId,
						initialImpl: moduleContent,
						ownership
					});

					// Replace the empty object with the wrapped callable function
					api[categoryName] = wrapper.createProxy();
					// Update targetApi reference to point to the new function so other files can attach properties
					targetApi = api[categoryName];

					if (ownership) {
						ownership.register({ moduleId: file.moduleId, apiPath: categoryName, source: "core" });
					}

					// DON'T continue - other files in this folder should attach as properties on the function
					// Fall through to allow remaining modules to be processed
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
							const wrapper = new UnifiedWrapper({
								mode,
								apiPath: `${categoryName}.${propKey}`,
								contextManager,
								instanceId,
								initialImpl: propValue,
								ownership
							});
							targetApi[propKey] = wrapper.createProxy();
							if (ownership) {
								ownership.register({ moduleId: file.moduleId, apiPath: `${categoryName}.${propKey}`, source: "core" });
							}
						}

						// Add other named exports from this file to category
						for (const key of moduleKeys) {
							if (key !== moduleName) {
								const wrapper = new UnifiedWrapper({
									mode,
									apiPath: `${categoryName}.${key}`,
									contextManager,
									instanceId,
									initialImpl: mod[key],
									ownership
								});
								targetApi[key] = wrapper.createProxy();
								if (ownership) {
									ownership.register({ moduleId: file.moduleId, apiPath: `${categoryName}.${key}`, source: "core" });
								}
							}
						}
					} else {
						// Regular multi-export file (no matching object)
						for (const key of moduleKeys) {
							const wrapper = new UnifiedWrapper({
								mode,
								apiPath: `${categoryName}.${key}`,
								contextManager,
								instanceId,
								initialImpl: mod[key],
								ownership
							});
							targetApi[key] = wrapper.createProxy();
							if (ownership) {
								ownership.register({ moduleId: file.moduleId, apiPath: `${categoryName}.${key}`, source: "core" });
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
					const wrapper = new UnifiedWrapper({
						mode,
						apiPath: `${categoryName}.${preferredName}`,
						contextManager,
						instanceId,
						initialImpl: mod[key],
						ownership
					});
					targetApi[preferredName] = wrapper.createProxy();
					if (ownership) {
						ownership.register({ moduleId: file.moduleId, apiPath: `${categoryName}.${preferredName}`, source: "core" });
					}
					continue;
				}
			}

			// Wrap in UnifiedWrapper
			const wrapper = new UnifiedWrapper({
				mode,
				apiPath: isRoot ? propertyName : `${categoryName}.${propertyName}`,
				contextManager,
				instanceId,
				initialImpl: moduleContent,
				ownership
			});

			targetApi[propertyName] = wrapper.createProxy();

			if (ownership) {
				const apiPath = isRoot ? propertyName : `${categoryName}.${propertyName}`;
				ownership.register({ moduleId: file.moduleId, apiPath, source: "core" });
			}
		}
	}

	// Handle subdirectories based on mode
	if (directory?.children?.directories) {
		if (recursive) {
			// Eager mode: recurse into subdirectories
			for (const subDir of directory.children.directories) {
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
						const mod = await loadModule(file.path);
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

						if (categoryDecision.shouldFlatten) {
							// For filename-folder match with named export, extract the matching export
							// Example: date/date.mjs with 'export const date = {...}' → nested.date = {...}
							let implToWrap;
							if (moduleName === subDirName && moduleKeys.includes(subDirName)) {
								// Named export matches folder name - use that specific export
								implToWrap = exports[subDirName];
							} else if (exports.default !== undefined) {
								// Default export - use it
								implToWrap = exports.default;
							} else {
								// Fallback - use the whole module
								implToWrap = modContent;
							}

							// Flatten: put the module content directly at targetApi[subDirName]
							const wrapper = new UnifiedWrapper({
								mode,
								apiPath: `${categoryName}.${subDirName}`,
								contextManager,
								instanceId,
								initialImpl: implToWrap,
								ownership
							});
							targetApi[subDirName] = wrapper.createProxy();
							if (ownership) {
								ownership.register({ moduleId: file.moduleId, apiPath: `${categoryName}.${subDirName}`, source: "core" });
							}
							continue;
						}
					}
				}

				// Regular subdirectory processing
				targetApi[subDirName] = targetApi[subDirName] || {};
				await processFiles(
					targetApi[subDirName],
					subDir.children.files,
					{ name: subDirName, children: subDir.children },
					ownership,
					contextManager,
					instanceId,
					config,
					currentDepth + 1,
					mode,
					false, // Not root
					recursive, // Pass through recursive flag
					true // populateDirectly - put content directly into targetApi[subDirName]
				);
			}
		} else {
			// Lazy mode: create lazy wrappers for subdirectories
			for (const subDir of directory.children.directories) {
				const subDirName = sanitizePropertyName(subDir.name);
				const apiPath = `${categoryName}.${subDirName}`;
				targetApi[subDirName] = createLazySubdirectoryWrapper(subDir, ownership, contextManager, instanceId, apiPath, config);
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
 * @param {string} instanceId - Instance ID
 * @param {string} apiPath - Current API path
 * @param {Object} config - Configuration
 * @returns {Proxy} Lazy unified wrapper
 * @private
 */
function createLazySubdirectoryWrapper(dir, ownership, contextManager, instanceId, apiPath, config) {
	// Create materialization function
	async function lazy_materializeFunc(wrapper) {
		const materialized = {};

		// Process files in this directory using unified processFiles
		// IMPORTANT: populateDirectly=true to populate materialized object directly
		// But isRoot=false so flattening logic knows we're inside a category
		await processFiles(
			materialized,
			dir.children.files,
			{ name: dir.name, children: dir.children },
			ownership,
			contextManager,
			instanceId,
			config,
			0,
			"lazy",
			false, // Not root (for root contributor detection)
			false, // Not recursive (create lazy wrappers for subdirs)
			true // Populate directly (don't nest under categoryName)
		);

		// Set the materialized implementation
		wrapper.__setImpl(materialized);
	}

	// Create unified wrapper in lazy mode
	const wrapper = new UnifiedWrapper({
		mode: "lazy",
		apiPath,
		contextManager,
		instanceId,
		materializeFunc: lazy_materializeFunc,
		ownership
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
