/**
 *	@Project: @cldmv/slothlet
 *	@Filename: /src/lib/builders/modes-processor.mjs
 *	@Date: 2026-01-30 22:47:23 -08:00 (1769842043)
 *	@Author: Nate Hyson <CLDMV>
 *	@Email: <Shinrai@users.noreply.github.com>
 *	-----
 *	@Last modified by: Nate Hyson <CLDMV> (Shinrai@users.noreply.github.com)
 *	@Last modified time: 2026-02-20 16:22:47 -08:00 (1771633367)
 *	-----
 *	@Copyright: Copyright (c) 2013-2026 Catalyzed Motivation Inc. All rights reserved.
 */

/**
 * @fileoverview Mode processing orchestration - file/directory processing for eager/lazy modes
 * @module @cldmv/slothlet/builders/modes-processor
 *
 * @description
 * Class-based processor for handling mode-specific file and directory transformations.
 * Extends ComponentBase for consistent dependency injection and error handling.
 *
 * @example
 * const processor = new ModesProcessor(slothlet);
 * await processor.processFiles(api, files, directory, ownership, contextManager, instanceID, config, 0, "lazy", true, false);
 */
import { ComponentBase } from "@cldmv/slothlet/factories/component-base";
import { t } from "@cldmv/slothlet/i18n";
import { UnifiedWrapper, resolveWrapper } from "@cldmv/slothlet/handlers/unified-wrapper";
/**
 * ModesProcessor - Handles mode-specific file and directory processing.
 *
 * @class
 * @extends ComponentBase
 * @package
 */
export class ModesProcessor extends ComponentBase {
	static slothletProperty = "modesProcessor";
	/**
	 * Creates a new ModesProcessor instance.
	 *
	 * @param {Object} slothlet - Parent slothlet instance
	 */
	constructor(slothlet) {
		super(slothlet);
	}
	async processFiles(
		api,
		files,
		directory,
		currentDepth,
		mode,
		isRoot,
		recursive,
		populateDirectly = false,
		apiPathPrefix = "",
		collisionContext = "initial",
		moduleID = null,
		sourceFolder = null,
		cacheBust = null,
		collisionModeOverride = null
	) {
		// Access components and data via slothlet instance
		const { ownership, metadata } = this.slothlet.handlers;
		const { loader, flatten } = this.slothlet.processors;
		const { contextManager, instanceID, config } = this.slothlet;
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
		const categoryName = isRoot && !populateDirectly ? null : this.slothlet.helpers.sanitize.sanitizePropertyName(directory.name);
		let targetApi = isRoot && !populateDirectly ? api : populateDirectly ? api : (api[categoryName] = api[categoryName] || {});

		// CRITICAL: Root files should ALWAYS be wrapped eagerly, even in lazy mode
		// This ensures file wrappers are materialized for collision handling
		const isRootFile = currentDepth === 0 && !populateDirectly;
		const effectiveMode = mode === "lazy" && isRootFile ? "eager" : mode;
		const shouldWrap = !(effectiveMode === "lazy" && populateDirectly);

		if (!isRoot && shouldWrap && !populateDirectly) {
			const existingTarget = api[categoryName];
			if (existingTarget && resolveWrapper(existingTarget)) {
				if (config.debug?.modes) {
					this.slothlet.debug("modes", {
						message: "Category reuse - using existing wrapper",
						categoryName,
						apiPath: resolveWrapper(existingTarget)?.apiPath
					});
				}
				targetApi = existingTarget;
			} else if (existingTarget === undefined || (typeof existingTarget === "object" && existingTarget !== null)) {
				// If existingTarget is a wrapper proxy, don't try to clone it - use empty object
				// The wrapper will be populated with new children during file processing
				const initialImpl = resolveWrapper(existingTarget)
					? {}
					: this.slothlet.helpers.modesUtils.cloneWrapperImpl(existingTarget || {}, mode);
				if (config.debug?.modes) {
					this.slothlet.debug("modes", {
						message: "Category wrapper created",
						categoryName,
						apiPath: buildApiPath(categoryName)
					});
				}
				const wrapper = new UnifiedWrapper(this.slothlet, {
					mode: effectiveMode,
					apiPath: buildApiPath(categoryName),
					initialImpl,
					filePath: directory.path,
					moduleID: moduleID || categoryName,
					sourceFolder
				});
				api[categoryName] = wrapper.createProxy();

				// Tag folder wrapper with system metadata so folders have metadata accessible
				if (this.slothlet.handlers?.metadata) {
					this.slothlet.handlers.metadata.tagSystemMetadata(
						wrapper,
						{
							filePath: directory.path,
							apiPath: buildApiPath(categoryName),
							moduleID: moduleID || "base",
							sourceFolder: sourceFolder || directory.path
						},
						{ _fromLifecycle: true }
					);
				}

				if (config.debug?.modes) {
					this.slothlet.debug("modes", {
						message: "Category wrapper assigned to API",
						categoryName
					});
				}
				targetApi = api[categoryName];
				if (config.debug?.modes) {
					this.slothlet.debug("modes", {
						message: "Category created",
						categoryName,
						apiPath: wrapper.apiPath
					});
					this.slothlet.debug("modes", {
						message: "Category targetApi status",
						isWrapper: !!resolveWrapper(targetApi),
						targetApiKeys: Object.keys(targetApi)
					});
				}
			}
		}
		if (!isRoot && config.debug?.modes) {
			this.slothlet.debug("modes", {
				message: await t("DEBUG_MODE_PROCESSING_DIRECTORY", { mode, categoryName, currentDepth })
			});
		}
		// Load all modules
		const loadedModules = [];
		for (const file of files) {
			if (config.debug?.modes && categoryName === "string") {
				this.slothlet.debug("modes", {
					message: "Processing file",
					categoryName,
					file: file.name,
					isRoot,
					populateDirectly,
					mode
				});
			}
			try {
				const mod = await loader.loadModule(file.path, instanceID, moduleID, cacheBust);
				const exports = loader.extractExports(mod);
				const moduleName = this.slothlet.helpers.sanitize.sanitizePropertyName(file.name);
				const moduleKeys = Object.keys(exports).filter((k) => k !== "default");
				const analysis = {
					hasDefault: exports.default !== undefined,
					hasNamed: moduleKeys.length > 0,
					defaultExportType: exports.default ? typeof exports.default : null
				};
				loadedModules.push({ file, mod: exports, moduleName, moduleKeys, analysis });
			} catch (error) {
				if (error.name === "SlothletError") throw error;
				throw new this.SlothletError("MODULE_LOAD_FAILED", { modulePath: file.path, moduleID: moduleID || file.moduleID }, error);
			}
		}
		// Calculate if there are multiple default exports in this directory
		const hasMultipleDefaults = loadedModules.filter((m) => m.analysis.hasDefault).length > 1;
		// Process each module
		for (const { file, mod, moduleName, moduleKeys, analysis } of loadedModules) {
			if (config.debug?.modes && categoryName === "logger") {
				this.slothlet.debug("modes", {
					message: "Processing module",
					categoryName,
					moduleName,
					hasDefault: analysis.hasDefault,
					moduleKeys,
					targetApiType: typeof targetApi,
					targetApiCallable: typeof targetApi === "function"
				});
			}
			// Check for root contributor (only at root level)
			// Exception: addapi files with OBJECT defaults should use flatten-to-category logic
			// But addapi files with FUNCTION defaults should be root contributors (callable namespace)
			const isAddapiFile =
				moduleName === "addapi" ||
				file.name === "addapi" ||
				(file.fullName && ["addapi.mjs", "addapi.cjs", "addapi.js", "addapi.ts"].includes(file.fullName.toLowerCase()));
			const isAddapiObjectDefault = isAddapiFile && analysis.hasDefault && typeof mod.default !== "function";
			const isRootContributor = isRoot && analysis.hasDefault && typeof mod.default === "function" && !isAddapiObjectDefault;
			if (moduleName === "config" || moduleKeys.some((k) => k.includes("Config") || k.includes("config"))) {
				if (config.debug?.modes) {
					this.slothlet.debug("modes", {
						message: "File processing",
						module: moduleName,
						category: categoryName || "(none)",
						isRoot,
						hasDefault: analysis.hasDefault,
						moduleKeys
					});
				}
			}
			if (isRootContributor) {
				// Build the function with named exports attached
				const defaultFunc = this.slothlet.helpers.modesUtils.ensureNamedExportFunction(mod.default, moduleName);
				for (const key of moduleKeys) {
					if (!this.slothlet.helpers.utilities.shouldAttachNamedExport(key, mod[key], defaultFunc, mod.default)) {
						continue;
					}
					defaultFunc[key] = mod[key];
				}
				// Track root-level default function exports for post-processing
				rootContributors.push({ moduleName, file, defaultFunc });
				continue; // Skip normal processing for root contributors
			} else {
				// Regular module - apply flattening decisions
				const decision = await flatten.getFlatteningDecision({
					mod,
					moduleName,
					categoryName: categoryName || moduleName,
					analysis,
					hasMultipleDefaults,
					moduleKeys,
					t
				});
				if (config.debug?.modes) {
					this.slothlet.debug("modes", {
						message: await t("DEBUG_MODE_MODULE_DECISION", { mode, moduleName, reason: decision.reason })
					});
				}
				// Use preferred name from decision (Rule 9 - Function Name Preference)
				const propertyName = decision.preferredName || moduleName;

				// For root-level files, categoryName is null, but we may need it for flatten-to-category
				// Use moduleName as fallback for API path assignment
				const effectiveCategoryName = categoryName || moduleName;

				// Build module content based on decision
				let moduleContent = {};

				// Rule 11 (F06) - C33: AddApi Special File Pattern
				// When addapi.{mjs,cjs,js,ts} has default export + named exports,
				// use default export as namespace base and merge named exports onto it
				const isAddapiFile =
					moduleName === "addapi" ||
					file.name === "addapi" ||
					(file.fullName && ["addapi.mjs", "addapi.cjs", "addapi.js", "addapi.ts"].includes(file.fullName.toLowerCase()));
				if (isAddapiFile && analysis.hasDefault && moduleKeys.length > 0) {
					// Default export becomes the namespace, named exports merge onto it
					moduleContent = mod.default;
					for (const key of moduleKeys) {
						moduleContent[key] = mod[key];
					}
				} else if (decision.useAutoFlattening) {
					// C04: Single named export matches module name
					moduleContent = mod[moduleName];
				} else if (mod.default && moduleKeys.length > 0) {
					// Hybrid pattern: default + named exports
					if (typeof mod.default === "function") {
						// Default is function: attach named exports as properties (like logger(), logger.info())
						moduleContent = this.slothlet.helpers.modesUtils.ensureNamedExportFunction(mod.default, propertyName);
						const collisionConfig = config.api?.collision || config.collision;
						const collisionMode = (collisionContext === "initial" ? collisionConfig?.initial : collisionConfig?.api) || "merge";
						for (const key of moduleKeys) {
							if (!this.slothlet.helpers.utilities.shouldAttachNamedExport(key, mod[key], moduleContent, mod.default)) {
								continue;
							}
							// Respect collision mode when attaching named exports
							const hasExisting = Object.prototype.hasOwnProperty.call(moduleContent, key);
							if (hasExisting) {
								if (collisionMode === "merge" || collisionMode === "skip") {
									// Keep existing property from default export
									continue;
								} else if (collisionMode === "error") {
									throw new Error(
										`Collision detected: property "${key}" already exists on default export at ${apiPathPrefix}.${propertyName}`
									);
								} else if (collisionMode === "warn") {
									new this.slothlet.SlothletWarning("WARNING_COLLISION_DEFAULT_EXPORT_OVERWRITE", {
										key,
										apiPath: `${apiPathPrefix}.${propertyName}`
									});
								}
								// collisionMode === "replace" or "merge-replace" falls through to assignment
							}
							moduleContent[key] = mod[key];
						}
					} else if (typeof mod.default === "object" && mod.default !== null) {
						// Default is object: treat like ESM default export with named exports
						// CJS pattern: module.exports = { default: obj, namedExport: fn }
						// Result: api.property = obj (with named exports as properties)
						// Don't clone for now - use the default object directly
						moduleContent = mod.default;
						// Add named exports that aren't already in the default object
						for (const key of moduleKeys) {
							if (key in mod.default) {
								// Skip if already exists in default object
								continue;
							}
							if (!this.slothlet.helpers.utilities.shouldAttachNamedExport(key, mod[key], moduleContent, mod.default)) {
								continue;
							}
							moduleContent[key] = mod[key];
						}
					} else {
						// Default is primitive: create namespace
						moduleContent.default = mod.default;
						for (const key of moduleKeys) {
							moduleContent[key] = mod[key];
						}
					}
				} else if (mod.default && moduleKeys.length === 0) {
					// Only default export - use it directly (no need to wrap in object)
					moduleContent = this.slothlet.helpers.modesUtils.ensureNamedExportFunction(mod.default, propertyName);
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
								this.slothlet.debug("modes", {
									message: "Single-file folder detected",
									categoryName,
									populateDirectly,
									isRoot,
									mode,
									exportKeys: Object.keys(exportedValue)
								});
							}
							// CRITICAL: Wrap the object so all its functions get context wrapping
							if (shouldWrap) {
								const wrapper = new UnifiedWrapper(this.slothlet, {
									mode: effectiveMode,
									apiPath: buildApiPath(categoryName),
									initialImpl: exportedValue,
									materializeOnCreate: config.backgroundMaterialize,
									filePath: file.path,
									moduleID: moduleID || file.moduleID,
									sourceFolder
								});
								// Assign wrapper to API
								api[categoryName] = wrapper.createProxy();
								targetApi = api[categoryName];
							} else {
								this.slothlet.debug("modes", {
									message: "Single-file folder set to wrapped property",
									categoryName,
									implKeys: Object.keys(exportedValue)
								});
							}
							// Register each property for ownership tracking
							for (const key of Object.keys(exportedValue)) {
								if (ownership) {
									ownership.register({
										moduleID: moduleID || file.moduleID,
										apiPath: `${categoryName}.${key}`,
										source: "core",
										collisionMode: this.slothlet.helpers.modesUtils.getOwnershipCollisionMode(config, collisionContext),
										filePath: file.path
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
						const callableModule =
							typeof mod.default === "function"
								? this.slothlet.helpers.modesUtils.ensureNamedExportFunction(mod.default, categoryName)
								: moduleContent;
						// Attach named exports to the module (function or object)
						if (namedKeys.length > 0) {
							for (const key of namedKeys) {
								// Skip if already in moduleContent (from earlier CJS default object handling)
								if (key in callableModule) {
									continue;
								}
								if (!this.slothlet.helpers.utilities.shouldAttachNamedExport(key, mod[key], callableModule, mod.default)) {
									continue;
								}
								callableModule[key] = mod[key];
							}
						}
						moduleContent = callableModule;
						if (shouldWrap) {
							const wrapper = new UnifiedWrapper(this.slothlet, {
								mode: effectiveMode,
								apiPath: buildApiPath(categoryName),
								initialImpl: this.slothlet.helpers.modesUtils.cloneWrapperImpl(callableModule, mode),
								materializeOnCreate: config.backgroundMaterialize,
								filePath: file.path,
								moduleID: moduleID || file.moduleID,
								sourceFolder
							});
							// Replace the empty object with the wrapped callable function
							api[categoryName] = wrapper.createProxy();
							// Update targetApi reference to point to the new function so other files can attach properties
							targetApi = api[categoryName];
						} else {
							api[categoryName] = moduleContent;
							targetApi = api[categoryName];
						}
						// Only process named exports separately if the default was a function
						// (For object defaults, named exports are already in callableModule)
						const needsSeparateNamedExports = typeof mod.default === "function";
						if (needsSeparateNamedExports && namedKeys.length > 0) {
							for (const key of namedKeys) {
								if (key === "default") {
									continue;
								}
								if (shouldWrap) {
									const namedWrapper = new UnifiedWrapper(this.slothlet, {
										mode: effectiveMode,
										apiPath: buildApiPath(`${categoryName}.${key}`),
										initialImpl: mod[key],
										materializeOnCreate: config.backgroundMaterialize,
										filePath: file.path,
										moduleID: moduleID || file.moduleID,
										sourceFolder
									});
									this.slothlet.builders.apiAssignment.assignToApiPath(targetApi, key, namedWrapper.createProxy(), {
										useCollisionDetection: true,
										config,
										collisionContext
									});
								} else {
									this.slothlet.builders.apiAssignment.assignToApiPath(targetApi, key, mod[key], {
										useCollisionDetection: true,
										config,
										collisionContext
									});
								}
								if (ownership) {
									ownership.register({
										moduleID: moduleID || file.moduleID,
										apiPath: `${categoryName}.${key}`,
										source: "core",
										collisionMode: this.slothlet.helpers.modesUtils.getOwnershipCollisionMode(config, collisionContext),
										filePath: file.path
									});
								}
							}
						}
						if (ownership) {
							ownership.register({
								moduleID: moduleID || file.moduleID,
								apiPath: categoryName,
								source: "core",
								collisionMode: this.slothlet.helpers.modesUtils.getOwnershipCollisionMode(config, collisionContext),
								filePath: file.path
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
									const wrapper = new UnifiedWrapper(this.slothlet, {
										mode: effectiveMode,
										apiPath: buildApiPath(`${categoryName}.${propKey}`),
										initialImpl: this.slothlet.helpers.modesUtils.cloneWrapperImpl(propValue, mode),
										materializeOnCreate: config.backgroundMaterialize,
										filePath: file.path,
										moduleID: moduleID || file.moduleID,
										sourceFolder
									});
									this.slothlet.builders.apiAssignment.assignToApiPath(targetApi, propKey, wrapper.createProxy(), {
										useCollisionDetection: true,
										config,
										collisionContext
									});
								} else {
									this.slothlet.builders.apiAssignment.assignToApiPath(targetApi, propKey, propValue, {
										useCollisionDetection: true,
										config,
										collisionContext
									});
								}
								if (ownership) {
									ownership.register({
										moduleID: moduleID || file.moduleID,
										apiPath: `${categoryName}.${propKey}`,
										source: "core",
										collisionMode: this.slothlet.helpers.modesUtils.getOwnershipCollisionMode(config, collisionContext),
										filePath: file.path
									});
								}
							}
							// Add other named exports from this file to category
							for (const key of moduleKeys) {
								if (key !== moduleName) {
									if (shouldWrap) {
										const wrapper = new UnifiedWrapper(this.slothlet, {
											mode: effectiveMode,
											apiPath: buildApiPath(`${categoryName}.${key}`),
											initialImpl: this.slothlet.helpers.modesUtils.cloneWrapperImpl(mod[key], mode),
											materializeOnCreate: config.backgroundMaterialize,
											filePath: file.path,
											moduleID: moduleID || file.moduleID,
											sourceFolder
										});
										this.slothlet.builders.apiAssignment.assignToApiPath(targetApi, key, wrapper.createProxy(), {
											useCollisionDetection: true,
											config,
											collisionContext
										});
									} else {
										this.slothlet.builders.apiAssignment.assignToApiPath(targetApi, key, mod[key], {
											useCollisionDetection: true,
											config,
											collisionContext
										});
									}
									if (ownership) {
										ownership.register({
											moduleID: moduleID || file.moduleID,
											apiPath: `${categoryName}.${key}`,
											source: "core",
											collisionMode: this.slothlet.helpers.modesUtils.getOwnershipCollisionMode(config, collisionContext),
											filePath: file.path
										});
									}
								}
							}
						} else {
							// Regular multi-export file (no matching object)
							if (config.debug?.modes) {
								this.slothlet.debug("modes", {
									message: "Flatten multi-export file",
									moduleName,
									categoryName,
									exportCount: moduleKeys.length
								});
								this.slothlet.debug("modes", {
									message: "Flatten multi-export targetApi status",
									isWrapper: !!resolveWrapper(targetApi),
									keysBefore: Object.keys(targetApi)
								});
							}
							for (const key of moduleKeys) {
								if (config.debug?.modes) {
									this.slothlet.debug("modes", {
										message: "Flatten multi-export assigning key",
										key
									});
								}
								if (shouldWrap) {
									const wrapper = new UnifiedWrapper(this.slothlet, {
										mode: effectiveMode,
										apiPath: buildApiPath(`${categoryName}.${key}`),
										initialImpl: this.slothlet.helpers.modesUtils.cloneWrapperImpl(mod[key], mode),
										materializeOnCreate: config.backgroundMaterialize,
										filePath: file.path,
										moduleID: moduleID || file.moduleID,
										sourceFolder
									});
									const assigned = this.slothlet.builders.apiAssignment.assignToApiPath(targetApi, key, wrapper.createProxy(), {
										useCollisionDetection: true,
										config,
										collisionContext
									});
									if (assigned) {
										this.slothlet.debug("modes", {
											message: "Flatten multi-export key assigned successfully",
											key,
											keysAfter: Object.keys(targetApi)
										});
									} else {
										this.slothlet.debug("modes", {
											message: "Flatten multi-export key blocked by safeAssign",
											key
										});
									}
								} else {
									this.slothlet.builders.apiAssignment.assignToApiPath(targetApi, key, mod[key], {
										useCollisionDetection: true,
										config,
										collisionContext
									});
								}
								if (ownership) {
									ownership.register({
										moduleID: moduleID || file.moduleID,
										apiPath: `${categoryName}.${key}`,
										source: "core",
										collisionMode: this.slothlet.helpers.modesUtils.getOwnershipCollisionMode(config, collisionContext),
										filePath: file.path
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
				// ALSO: Skip objects that match the module name - those need property-level wrapping (matching-object branch)
				if (!analysis.hasDefault && moduleKeys.length === 1 && !isRoot) {
					const key = moduleKeys[0];
					const keyValue = mod[key];
					const isMatchingObject = key === moduleName && typeof keyValue === "object" && keyValue !== null && !Array.isArray(keyValue);
					// Skip matching objects - they need to go through the matching-object branch below
					if (!isMatchingObject) {
						// Only auto-flatten if the export name matches the module name (case-insensitive, ignore separators)
						const normalizedKey = key.toLowerCase().replace(/[-_]/g, "");
						const normalizedModuleName = moduleName.toLowerCase().replace(/[-_]/g, "");
						if (normalizedKey === normalizedModuleName) {
							// Prefer the actual export name over sanitized filename (preserves capitalization like parseJSON, getHTTPStatus)
							const preferredName = key;
							if (shouldWrap) {
								const wrapper = new UnifiedWrapper(this.slothlet, {
									mode: effectiveMode,
									apiPath: buildApiPath(`${categoryName}.${preferredName}`),
									initialImpl: this.slothlet.helpers.modesUtils.cloneWrapperImpl(mod[key], mode),
									materializeOnCreate: config.backgroundMaterialize,
									filePath: file.path,
									moduleID: moduleID || file.moduleID,
									sourceFolder
								});
								this.slothlet.builders.apiAssignment.assignToApiPath(targetApi, preferredName, wrapper.createProxy(), {
									useCollisionDetection: true,
									config,
									collisionContext
								});
							} else {
								this.slothlet.builders.apiAssignment.assignToApiPath(targetApi, preferredName, mod[key], {
									useCollisionDetection: true,
									config,
									collisionContext
								});
							}
							if (ownership) {
								ownership.register({
									moduleID: moduleID || file.moduleID,
									apiPath: `${categoryName}.${preferredName}`,
									source: "core",
									collisionMode: this.slothlet.helpers.modesUtils.getOwnershipCollisionMode(config, collisionContext),
									filePath: file.path
								});
							}
							continue;
						}
					}
				}

				// Handle flatten-to-category decision (C09, C33)
				// Flatten named exports directly to parent category instead of creating nested namespace
				if (decision.flattenToCategory && moduleContent && effectiveCategoryName) {
					const isAddapiFile = decision.flattenType === "addapi-metadata-default" || decision.flattenType === "addapi-special-file";

					if (isAddapiFile && typeof moduleContent === "object" && !Array.isArray(moduleContent) && typeof moduleContent !== "function") {
						// ADDAPI OBJECT DEFAULT: Merge exports directly into targetApi without creating addapi namespace
						// When api.add('plugins', './dir'), addapi exports become api.plugins.{exports}, NOT api.plugins.addapi.{exports}
						for (const key of Object.keys(moduleContent)) {
							const value = moduleContent[key];
							const keyPath = isRoot ? key : `${apiPathPrefix ? apiPathPrefix + "." : ""}${key}`;

							if (shouldWrap && typeof value === "function") {
								const wrapper = new UnifiedWrapper(this.slothlet, {
									mode: effectiveMode,
									apiPath: buildApiPath(keyPath),
									initialImpl: value,
									materializeOnCreate: config.backgroundMaterialize,
									filePath: file.path,
									moduleID: moduleID || file.moduleID,
									sourceFolder
								});
								this.slothlet.builders.apiAssignment.assignToApiPath(targetApi, key, wrapper.createProxy(), {
									useCollisionDetection: true,
									config,
									collisionContext
								});
							} else {
								this.slothlet.builders.apiAssignment.assignToApiPath(targetApi, key, value, {
									useCollisionDetection: true,
									config,
									collisionContext
								});
							}
						}

						// Register ownership for each merged property
						if (ownership) {
							for (const key of Object.keys(moduleContent)) {
								const apiPath = isRoot ? key : apiPathPrefix ? `${apiPathPrefix}.${key}` : key;
								ownership.register({
									moduleID: moduleID || file.moduleID,
									apiPath,
									source: "core",
									collisionMode: this.slothlet.helpers.modesUtils.getOwnershipCollisionMode(config, collisionContext),
									config
								});
							}
						}
					} else {
						// NORMAL FLATTEN-TO-CATEGORY: Assign moduleContent (function or object) to category name
						const localPath = isRoot ? effectiveCategoryName : `${apiPathPrefix ? apiPathPrefix + "." : ""}${effectiveCategoryName}`;

						if (shouldWrap) {
							const wrapper = new UnifiedWrapper(this.slothlet, {
								mode: effectiveMode,
								apiPath: buildApiPath(localPath),
								initialImpl: moduleContent,
								materializeOnCreate: config.backgroundMaterialize,
								filePath: file.path,
								moduleID: moduleID || file.moduleID,
								sourceFolder,
								isCallable: typeof moduleContent === "function"
							});
							this.slothlet.builders.apiAssignment.assignToApiPath(targetApi, effectiveCategoryName, wrapper.createProxy(), {
								useCollisionDetection: true,
								config,
								collisionContext
							});
						} else {
							this.slothlet.builders.apiAssignment.assignToApiPath(targetApi, effectiveCategoryName, moduleContent, {
								useCollisionDetection: true,
								config,
								collisionContext
							});
						}

						// Register ownership
						if (ownership) {
							const apiPath = isRoot
								? effectiveCategoryName
								: apiPathPrefix
									? `${apiPathPrefix}.${effectiveCategoryName}`
									: effectiveCategoryName;
							ownership.register({
								moduleID: moduleID || file.moduleID,
								apiPath,
								source: "core",
								collisionMode: this.slothlet.helpers.modesUtils.getOwnershipCollisionMode(config, collisionContext),
								config
							});
						}
					}
					// Skip normal assignment since we've handled it
					continue;
				}

				// Wrap in UnifiedWrapper
				if (shouldWrap) {
					const localPath = isRoot ? propertyName : `${categoryName}.${propertyName}`;
					const wrapper = new UnifiedWrapper(this.slothlet, {
						mode: effectiveMode,
						apiPath: buildApiPath(localPath),
						initialImpl: moduleContent, // Use moduleContent directly, don't clone (preserves added properties)
						materializeOnCreate: config.backgroundMaterialize,
						filePath: file.path,
						moduleID: moduleID || file.moduleID,
						sourceFolder
					});
					this.slothlet.debug("modes", {
						message: "File wrapper assignment",
						propertyName,
						apiPath: buildApiPath(localPath),
						overwriting: propertyName in targetApi ? (resolveWrapper(targetApi[propertyName]) ? "wrapper" : "value") : "nothing"
					});
					this.slothlet.builders.apiAssignment.assignToApiPath(targetApi, propertyName, wrapper.createProxy(), {
						useCollisionDetection: true,
						config,
						collisionContext
					});
				} else {
					this.slothlet.builders.apiAssignment.assignToApiPath(targetApi, propertyName, moduleContent, {
						useCollisionDetection: true,
						config,
						collisionContext
					});
				}
				if (config.debug?.modes && categoryName === "logger") {
					this.slothlet.debug("modes", {
						message: "After assignment status",
						targetApiType: typeof targetApi,
						propertyName,
						hasProperty: propertyName in targetApi,
						implType: typeof resolveWrapper(targetApi)?.____slothletInternal.impl,
						implHasProperty: !!resolveWrapper(targetApi)?.____slothletInternal.impl?.utils
					});
				}
				if (ownership) {
					const apiPath = isRoot ? propertyName : `${categoryName}.${propertyName}`;
					ownership.register({
						moduleID: moduleID || file.moduleID,
						apiPath,
						source: "core",
						collisionMode: this.slothlet.helpers.modesUtils.getOwnershipCollisionMode(config, collisionContext),
						config
					});
				}
			}
		}
		// Handle subdirectories based on mode
		if (config.debug?.modes) {
			this.slothlet.debug("modes", {
				message: "Subdirectory check",
				isRoot,
				categoryName,
				hasDirectory: !!directory,
				hasChildren: !!directory?.children,
				directoryCount: directory?.children?.directories?.length || 0
			});
		}
		this.slothlet.debug("modes", {
			message: "Directory check",
			hasChildren: !!directory?.children,
			hasDirectories: !!directory?.children?.directories,
			length: directory?.children?.directories?.length || 0
		});
		if (directory?.children?.directories) {
			this.slothlet.debug("modes", {
				message: "Directory check passed",
				recursive
			});
			if (config.debug?.modes) {
				this.slothlet.debug("modes", {
					message: "Subdirectories found",
					subdirectoryCount: directory.children.directories.length,
					recursive
				});
			}
			if (recursive) {
				// Eager mode: recurse into subdirectories
				this.slothlet.debug("modes", {
					message: "Subdirectory loop start",
					count: directory.children.directories.length
				});
				for (const subDir of directory.children.directories) {
					this.slothlet.debug("modes", {
						message: "Processing subdirectory",
						name: subDir.name,
						fileCount: subDir.children.files.length,
						subdirCount: subDir.children.directories.length
					});
					const subDirName = this.slothlet.helpers.sanitize.sanitizePropertyName(subDir.name);
					// Check if this is a single-file folder that might need special handling
					if (subDir.children.files.length === 1 && subDir.children.directories.length === 0) {
						const file = subDir.children.files[0];
						const moduleName = this.slothlet.helpers.sanitize.sanitizePropertyName(file.name);
						const genericFilenames = ["singlefile", "index", "main", "default"];
						const isGeneric = genericFilenames.includes(moduleName.toLowerCase());
						const filenameMatchesFolder = moduleName === subDirName;
						// Only apply folder-level flattening for specific cases:
						// 1. Generic filenames (singlefile, index, main, default)
						// 2. Filename matches folder name
						// 3. Has default export (checked below)
						if (isGeneric || filenameMatchesFolder) {
							this.slothlet.debug("modes", {
								message: "Folder-level flatten check",
								subDir: subDirName,
								file: moduleName,
								isGeneric,
								filenameMatches: filenameMatchesFolder
							});
							const mod = await loader.loadModule(file.path, instanceID, moduleID, cacheBust);
							const exports = loader.extractExports(mod);
							const moduleKeys = Object.keys(exports).filter((k) => k !== "default");
							const analysis = {
								hasDefault: exports.default !== undefined,
								hasNamed: moduleKeys.length > 0,
								defaultExportType: exports.default ? typeof exports.default : null
							};
							const modContent = exports.default !== undefined ? exports.default : exports;
							const categoryDecision = await flatten.buildCategoryDecisions({
								categoryName: subDirName,
								mod: modContent,
								moduleName,
								fileBaseName: file.name,
								analysis,
								moduleKeys,
								currentDepth: currentDepth + 1,
								moduleFiles: subDir.children.files,
								t
							});
							// Flattening is about module internal structure (math/math.mjs → math),
							// not about the target path prefix. Must flatten regardless of apiPathPrefix
							// so api.add() produces the same flattened structure as standalone loading.
							if (categoryDecision.shouldFlatten) {
								this.slothlet.debug("modes", {
									message: "Folder-level flatten - skipping recursion",
									subDir: subDirName
								});
								// For filename-folder match with named export, extract the matching export
								// Example: date/date.mjs with 'export const date = {...}' → nested.date = {...}
								let implToWrap;

								// Rule 11 (F06) - C33: AddApi Special File Pattern with metadata default
								// When addapi.{mjs,cjs,js,ts} has object default + named exports,
								// flatten only the named exports to parent, ignoring the metadata default
								if (categoryDecision.flattenType === "addapi-metadata-default") {
									// Create object with only named exports, ignore default
									implToWrap = {};
									for (const key of moduleKeys) {
										if (key !== "default") {
											implToWrap[key] = exports[key];
										}
									}
								} else if (moduleName === subDirName && moduleKeys.includes(subDirName)) {
									// Named export matches folder name - use that specific export
									implToWrap = exports[subDirName];
								} else if (exports.default !== undefined) {
									// Default export - use it
									implToWrap = exports.default;
									if (moduleKeys.length > 0) {
										// Add named exports to the default (function or object)
										if (typeof implToWrap === "function") {
											// Function default: attach named exports as properties
											const collisionConfig = config.api?.collision || config.collision;
											const collisionMode = (collisionContext === "initial" ? collisionConfig?.initial : collisionConfig?.api) || "merge";
											for (const key of moduleKeys) {
												if (key !== "default") {
													const hasExisting = implToWrap[key] !== undefined;
													if (hasExisting) {
														if (collisionMode === "merge" || collisionMode === "skip") {
															// Keep existing property from default export
															continue;
														} else if (collisionMode === "error") {
															throw new Error(
																`Collision detected: property "${key}" already exists on default export at ${apiPathPrefix}.${subDirName}`
															);
														} else if (collisionMode === "warn") {
															new this.slothlet.SlothletWarning("WARNING_COLLISION_DEFAULT_EXPORT_OVERWRITE", {
																key,
																apiPath: `${apiPathPrefix}.${subDirName}`
															});
														}
														// collisionMode === "replace" or "merge-replace" falls through to assignment
													}
													implToWrap[key] = exports[key];
												}
											}
										} else if (typeof implToWrap === "object" && implToWrap !== null) {
											// Object default: add named exports that aren't already present
											for (const key of moduleKeys) {
												if (key !== "default" && !(key in implToWrap)) {
													implToWrap[key] = exports[key];
												}
											}
										}
									}
								} else {
									// Fallback - use the whole module
									implToWrap = modContent;
								}

								// CRITICAL: File-vs-folder collision within same module directory.
								// When a file and folder share the same name (e.g., math.mjs + math/),
								// the file's exports need to be merged into the folder wrapper's impl.
								// The file was processed first (files before directories), so its value
								// may already exist at targetApi[subDirName].
								// IMPORTANT: Respect collision mode:
								// - replace: Do NOT merge. The folder completely replaces the file.
								// - skip: Do NOT merge. The file (first) stays, folder is ignored.
								// - error: Should have thrown earlier during assignToApiPath.
								// - merge/warn: Merge file exports into folder impl (folder wins conflicts via !(k in implToWrap)).
								// - merge-replace: Merge file exports into folder impl (folder wins conflicts via !(k in implToWrap)).
								const modes_eagerCollisionConfig = config.api?.collision || config.collision;
								const modes_eagerCollisionMode =
									(collisionContext === "initial" ? modes_eagerCollisionConfig?.initial : modes_eagerCollisionConfig?.api) || "merge";
								const modes_existingAtKey = targetApi[subDirName];
								if (modes_existingAtKey !== undefined && modes_eagerCollisionMode !== "replace" && modes_eagerCollisionMode !== "skip") {
									const modes_existingWrapper = resolveWrapper(modes_existingAtKey);
									if (modes_existingWrapper) {
										// In lazy mode, the file wrapper hasn't materialized yet.
										// Force materialization so we can access its exports.
										if (
											modes_existingWrapper.____slothletInternal?.materializeFunc &&
											!modes_existingWrapper.____slothletInternal?.state?.materialized
										) {
											await modes_existingWrapper._materialize();
										}
										// Ensure children are adopted from impl
										if (
											modes_existingWrapper.____slothletInternal?.impl &&
											!modes_existingWrapper.____slothletInternal?.state?.childrenAdopted
										) {
											modes_existingWrapper.___adoptImplChildren();
										}
										const modes_existingImpl = modes_existingWrapper.__impl;
										if (modes_existingImpl && typeof modes_existingImpl === "object" && !Array.isArray(modes_existingImpl)) {
											if (typeof implToWrap === "object" && implToWrap !== null) {
												for (const [k, v] of Object.entries(modes_existingImpl)) {
													if (!(k in implToWrap)) {
														implToWrap[k] = v;
													}
												}
											} else if (typeof implToWrap === "function") {
												for (const [k, v] of Object.entries(modes_existingImpl)) {
													if (implToWrap[k] === undefined) {
														implToWrap[k] = v;
													}
												}
											}
										}
										// Also absorb any child properties from existing wrapper
										const modes_existingChildKeys = Object.keys(modes_existingWrapper).filter(
											(k) => !k.startsWith("_") && !k.startsWith("__")
										);
										for (const ck of modes_existingChildKeys) {
											if (typeof implToWrap === "object" && implToWrap !== null && !(ck in implToWrap)) {
												implToWrap[ck] = modes_existingWrapper[ck];
											} else if (typeof implToWrap === "function" && implToWrap[ck] === undefined) {
												implToWrap[ck] = modes_existingWrapper[ck];
											}
										}
										this.slothlet.debug("modes", {
											message: "File-folder collision: merged file exports into folder impl",
											subDir: subDirName,
											mergedKeys: Object.keys(implToWrap)
										});
									}
								}

								// Flatten: put the module content directly at targetApi[subDirName]
								const wrapper = new UnifiedWrapper(this.slothlet, {
									mode: effectiveMode,
									apiPath: buildApiPath(categoryName ? `${categoryName}.${subDirName}` : subDirName),
									initialImpl: implToWrap, // Use implToWrap directly, don't clone (preserves added properties)
									materializeOnCreate: config.backgroundMaterialize,
									filePath: file.path,
									moduleID: moduleID || file.moduleID,
									sourceFolder
								});
								this.slothlet.builders.apiAssignment.assignToApiPath(targetApi, subDirName, wrapper.createProxy(), {
									useCollisionDetection: true,
									config,
									collisionContext
								});
								if (ownership) {
									const apiPath = buildApiPath(categoryName ? `${categoryName}.${subDirName}` : subDirName);
									const collisionMode = config.collision?.[collisionContext] || "merge";
									ownership.register({
										moduleID: moduleID || file.moduleID,
										apiPath,
										source: "core",
										collisionMode: this.slothlet.helpers.modesUtils.getOwnershipCollisionMode(config, collisionContext),
										collisionMode,
										config
									});
								}
								continue;
							}
						}
					}

					// Folder Transparency: If subfolder name matches current category, don't create nested namespace
					// Example: api.add('config', './path') where path contains config/ subfolder
					// Result: config/server.mjs → api.config.server (not api.config.config.server)
					// Note: apiPathPrefix contains the current category path (e.g., "config")
					// Extract the last segment to get the current category name
					const currentCategoryName = apiPathPrefix ? apiPathPrefix.split(".").pop() : categoryName;
					if (subDirName === currentCategoryName && currentCategoryName !== null) {
						// Process folder contents directly into current targetApi (transparent folder)
						await this.processFiles(
							targetApi, // Use current targetApi, don't create new namespace
							subDir.children.files,
							subDir, // Pass subDir as directory for metadata
							currentDepth + 1,
							mode,
							false, // Not root
							recursive,
							true, // populateDirectly - don't create category wrapper
							apiPathPrefix,
							collisionContext,
							moduleID,
							sourceFolder,
							cacheBust
						);
						continue;
					}

					// Regular subdirectory processing
					await this.processFiles(
						targetApi,
						subDir.children.files,
						{ name: subDirName, path: subDir.path, children: subDir.children }, // Preserve path for metadata
						currentDepth + 1,
						mode,
						false, // Not root
						recursive, // Pass through recursive flag
						false, // populateDirectly - build on parent api
						apiPathPrefix, // Pass through apiPathPrefix to subdirectories
						collisionContext,
						moduleID, // Pass through moduleID to subdirectories
						sourceFolder,
						cacheBust
					);
				}
			} else {
				// Lazy mode: create lazy wrappers for subdirectories
				for (const subDir of directory.children.directories) {
					const subDirName = this.slothlet.helpers.sanitize.sanitizePropertyName(subDir.name);

					// Folder Transparency: if subfolder name matches current category, process its contents
					// directly into targetApi instead of creating a nested namespace.
					// Example: api.add('config', './path') where path/config/ exists → config/server.mjs becomes api.config.server
					// Use eager mode so files at this level become objects (same as root-level file behavior).
					// IMPORTANT: Only fire at root-level registration boundary (populateDirectly=false).
					// When populateDirectly=true we are inside a lazy wrapper materialization —
					// e.g. services/ materialising finds services/services/ whose name matches,
					// but that is a legitimate nested namespace, NOT a transparent root folder.
					const lazy_currentCategoryName = apiPathPrefix ? apiPathPrefix.split(".").pop() : categoryName;
					if (subDirName === lazy_currentCategoryName && lazy_currentCategoryName !== null && !populateDirectly) {
						await this.processFiles(
							targetApi,
							subDir.children.files,
							subDir,
							currentDepth + 1,
							"eager",
							false,
							true, // recursive = true to process nested subdirs too
							true, // populateDirectly
							apiPathPrefix,
							collisionContext,
							moduleID,
							sourceFolder,
							cacheBust
						);
						continue;
					}

					const apiPath = categoryName ? `${categoryName}.${subDirName}` : apiPathPrefix ? `${apiPathPrefix}.${subDirName}` : subDirName;
					if (config.debug?.modes) {
						this.slothlet.debug("modes", {
							message: "Creating lazy subdirectory",
							apiPath,
							fileCount: subDir.children.files.length
						});
					}

					// CRITICAL: File-folder collision within same module directory.
					// If a file (e.g., math.mjs) already created a wrapper at this key,
					// its exports must be preserved and merged into the lazy folder wrapper
					// during materialization. Extract the file's exports BEFORE replacement.
					// IMPORTANT: Only extract for merge/merge-replace modes. In replace mode,
					// the folder completely replaces the file — no file exports should persist.
					// The replace mode collision in api-assignment.mjs handles materialization.
					const collisionConfig = config.api?.collision;
					const modes_initialCollisionMode =
						collisionModeOverride || (collisionContext === "initial" ? collisionConfig?.initial : collisionConfig?.api) || "replace";
					let modes_fileFolderImpl = null;
					const modes_lazyExisting = targetApi[subDirName];
					if (modes_initialCollisionMode !== "replace" && resolveWrapper(modes_lazyExisting)) {
						const modes_lazyExistingW = resolveWrapper(modes_lazyExisting);
						// Root files are processed eagerly even in lazy mode, so impl should exist
						const existImpl = modes_lazyExistingW.__impl;
						if (existImpl && typeof existImpl === "object" && !Array.isArray(existImpl)) {
							modes_fileFolderImpl = { ...existImpl };
						}
						// Also capture child properties from the existing wrapper
						const existChildKeys = Object.keys(modes_lazyExistingW).filter((k) => !k.startsWith("_") && !k.startsWith("__"));
						for (const ck of existChildKeys) {
							if (!modes_fileFolderImpl) modes_fileFolderImpl = {};
							if (!(ck in modes_fileFolderImpl)) {
								modes_fileFolderImpl[ck] = modes_lazyExistingW[ck];
							}
						}
					}

					this.slothlet.builders.apiAssignment.assignToApiPath(
						targetApi,
						subDirName,
						this.createLazySubdirectoryWrapper(
							subDir,
							ownership,
							contextManager,
							instanceID,
							apiPath,
							config,
							loader,
							flatten,
							apiPathPrefix,
							moduleID,
							sourceFolder,
							cacheBust,
							modes_fileFolderImpl,
							modes_initialCollisionMode
						),
						{
							useCollisionDetection: true,
							config,
							collisionContext
						}
					);
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
					this.slothlet.debug("modes", {
						message: await t("DEBUG_MODE_ROOT_CONTRIBUTOR", { mode, functionName: defaultFunc.name || "anonymous" })
					});
				}
				if (ownership) {
					ownership.register({
						moduleID: moduleID || file.moduleID,
						apiPath: moduleName,
						source: "core",
						collisionMode: this.slothlet.helpers.modesUtils.getOwnershipCollisionMode(config, collisionContext),
						filePath: file.path
					});
				}
			} else {
				// Multiple root contributors: namespace ALL of them and warn
				new this.SlothletWarning("WARNING_MULTIPLE_ROOT_CONTRIBUTORS", {
					rootContributors: rootContributors.map((rc) => rc.moduleName).join(", "),
					firstContributor: rootContributors[0].moduleName
				});
				for (const { moduleName, file, defaultFunc } of rootContributors) {
					// Wrap in UnifiedWrapper if needed
					if (shouldWrap) {
						const wrapper = new UnifiedWrapper(this.slothlet, {
							mode: effectiveMode,
							apiPath: buildApiPath(moduleName),
							initialImpl: this.slothlet.helpers.modesUtils.cloneWrapperImpl(defaultFunc, mode),
							materializeOnCreate: config.backgroundMaterialize,
							filePath: file.path,
							moduleID: moduleID || file.moduleID,
							sourceFolder
						});
						this.slothlet.builders.apiAssignment.assignToApiPath(targetApi, moduleName, wrapper.createProxy(), {
							useCollisionDetection: true,
							config,
							collisionContext
						});
					} else {
						this.slothlet.builders.apiAssignment.assignToApiPath(targetApi, moduleName, defaultFunc, {
							useCollisionDetection: true,
							config,
							collisionContext
						});
					}
					if (ownership) {
						ownership.register({
							moduleID: moduleID || file.moduleID,
							apiPath: moduleName,
							source: "core",
							collisionMode: this.slothlet.helpers.modesUtils.getOwnershipCollisionMode(config, collisionContext),
							filePath: file.path
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
	 * @public
	 */
	createLazySubdirectoryWrapper(
		dir,
		ownership,
		contextManager,
		instanceID,
		apiPath,
		config,
		loader,
		flatten,
		parentApiPathPrefix = "",
		moduleID = null,
		sourceFolder = null,
		cacheBust = null,
		fileFolderCollisionImpl = null,
		collisionMode = "merge"
	) {
		// Create materialization function (POC pattern: returns implementation, doesn't take wrapper param)
		/**
		 * Materialize a lazy subdirectory into a concrete implementation object.
		 * @returns {Promise<unknown>} Materialized implementation for this subdirectory
		 * @private
		 */
		const lazy_materializeFunc = this.slothlet.helpers.modesUtils.createNamedMaterializeFunc(apiPath, async () => {
			if (config.debug?.modes) {
				this.slothlet.debug("modes", {
					message: "Materialize function starting",
					dir: dir.name,
					fileCount: dir.children.files?.length || 0
				});
			}
			const categoryName = this.slothlet.helpers.sanitize.sanitizePropertyName(dir.name);
			const materialized = {};

			// Compute actual subdirectory sourceFolder path
			// If parent sourceFolder exists, append this directory name
			// Otherwise use config dir as base
			const actualSourceFolder = sourceFolder
				? `${sourceFolder}/${dir.name}`.replace(/\\/g, "/")
				: `${this.slothlet.config?.dir}/${dir.name}`.replace(/\\/g, "/");

			// Compute parent API path prefix - strip the last segment (which is this directory)
			// e.g., if this wrapper is 'lookup.config', and we're materializing 'config' directory,
			//       we want children to be 'lookup.config.X', not 'lookup.config.config.X'
			// So we strip the last segment: 'lookup.config' → 'lookup'
			const parentPrefix = apiPath.includes(".") ? apiPath.split(".").slice(0, -1).join(".") : "";
			const subDirs = dir.children.directories || [];
			if (dir.children.files.length === 1 && subDirs.length === 0) {
				const file = dir.children.files[0];
				const moduleName = this.slothlet.helpers.sanitize.sanitizePropertyName(file.name);
				const genericFilenames = ["singlefile", "index", "main", "default"];
				const isGeneric = genericFilenames.includes(moduleName.toLowerCase());
				const filenameMatchesFolder = moduleName === categoryName;
				if (isGeneric || filenameMatchesFolder) {
					const mod = await loader.loadModule(file.path, instanceID, moduleID, cacheBust);
					const exports = loader.extractExports(mod);
					const moduleKeys = Object.keys(exports).filter((k) => k !== "default");
					const analysis = {
						hasDefault: exports.default !== undefined,
						hasNamed: moduleKeys.length > 0,
						defaultExportType: exports.default ? typeof exports.default : null
					};
					const modContent = exports.default !== undefined ? exports.default : exports;
					const categoryDecision = await flatten.buildCategoryDecisions({
						categoryName,
						mod: modContent,
						moduleName,
						fileBaseName: file.name,
						analysis,
						moduleKeys,
						currentDepth: apiPath.split(".").length,
						moduleFiles: dir.children.files,
						t
					});
					if (categoryDecision.shouldFlatten) {
						let implToWrap;

						// Rule 11 (F06) - C33: AddApi Special File Pattern
						// When addapi.{mjs,cjs,js,ts} has default export + named exports,
						// use default export as namespace base and merge named exports onto it
						if (categoryDecision.flattenType === "addapi-metadata-default") {
							// Default export becomes the namespace, named exports merge onto it
							implToWrap = exports.default;
							for (const key of moduleKeys) {
								if (key !== "default") {
									implToWrap[key] = exports[key];
								}
							}
						} else if (moduleName === categoryName && moduleKeys.includes(categoryName)) {
							implToWrap = exports[categoryName];
						} else if (exports.default !== undefined) {
							implToWrap = exports.default;

							// Hybrid pattern: default (function OR object) + named exports
							// Attach named exports as properties
							if (moduleKeys.length > 0 && (typeof implToWrap === "function" || (typeof implToWrap === "object" && implToWrap !== null))) {
								const collisionMode = this.slothlet.config?.collision?.initial || "merge";
								for (const key of moduleKeys) {
									if (!this.slothlet.helpers.utilities.shouldAttachNamedExport(key, exports[key], implToWrap, exports.default)) {
										continue;
									}
									// Respect collision mode when attaching named exports
									const hasExisting = Object.prototype.hasOwnProperty.call(implToWrap, key);
									if (hasExisting) {
										if (collisionMode === "merge" || collisionMode === "skip") {
											// Keep existing property from default export
											continue;
										} else if (collisionMode === "error") {
											throw new Error(`Collision detected: property "${key}" already exists on default export at ${apiPath}`);
										} else if (collisionMode === "warn") {
											new this.slothlet.SlothletWarning("WARNING_COLLISION_DEFAULT_EXPORT_OVERWRITE", {
												key,
												apiPath
											});
										}
										// collisionMode === "replace" falls through to assignment
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
						// 1. Initial build registers entire API tree with moduleID="base"
						// 2. Lazy materialization would try to re-register with file-specific moduleID
						// 3. Different moduleIDs trigger OWNERSHIP_CONFLICT unless allowConflict=true
						// The collision config should be respected via registerAPIWithOwnership, not here

						// Tag implToWrap's functions with metadata so ___adoptImplChildren can inherit it
						if (implToWrap && typeof implToWrap === "object" && this.slothlet.handlers?.lifecycle) {
							for (const key of Object.keys(implToWrap)) {
								const value = implToWrap[key];
								if (typeof value === "function") {
									this.slothlet.handlers.lifecycle.emit("impl:created", {
										apiPath: `${apiPath}.${key}`,
										impl: value,
										source: "lazy-materialization",
										moduleID: moduleID,
										filePath: file.path,
										sourceFolder: sourceFolder || this.slothlet.config?.dir
									});
								}
							}
						}

						// CRITICAL: Create __childFilePaths for ALL children in this folder
						// Map each child to the file.path they came from
						if (implToWrap && typeof implToWrap === "object") {
							// Initialize __childFilePaths with all children mapped to file.path
							const childPaths = {};
							for (const key of Object.keys(implToWrap)) {
								if (typeof key !== "symbol" && key !== "__childFilePaths" && key !== "__filePath") {
									childPaths[key] = file.path;
								}
							}

							// Merge with collision-merged children paths if they exist
							if (this.__childFilePathsPreMaterialize) {
								Object.assign(childPaths, this.__childFilePathsPreMaterialize);
							}

							implToWrap.__childFilePaths = childPaths;
						}

						// Merge file-folder collision exports (from same-name file, e.g., math.mjs + math/)
						if (fileFolderCollisionImpl && typeof implToWrap === "object" && implToWrap !== null) {
							for (const [k, v] of Object.entries(fileFolderCollisionImpl)) {
								if (!(k in implToWrap)) {
									implToWrap[k] = v;
								}
							}
						} else if (fileFolderCollisionImpl && typeof implToWrap === "function") {
							for (const [k, v] of Object.entries(fileFolderCollisionImpl)) {
								if (implToWrap[k] === undefined) {
									implToWrap[k] = v;
								}
							}
						}

						return implToWrap;
					}
				}
			}
			// Process files in this directory using unified processFiles
			// IMPORTANT: populateDirectly=true to populate materialized object directly
			// But isRoot=false so flattening logic knows we're inside a category
			await this.processFiles(
				materialized,
				dir.children.files,
				{ name: dir.name, children: dir.children },
				0,
				"eager",
				false, // Not root (for root contributor detection)
				false, // NOT recursive - create lazy wrappers for subdirectories, don't cascade eager load
				true, // Populate directly (don't nest under categoryName)
				parentPrefix, // Use computed parent prefix so children get correct paths
				"initial",
				moduleID, // Pass parent moduleID to children
				actualSourceFolder, // Use computed actual subdirectory path for metadata
				cacheBust,
				collisionMode // Pass collision mode to child wrappers
			);
			if (config.debug?.modes) {
				this.slothlet.debug("modes", {
					message: "Materialize function returning impl",
					dir: dir.name,
					keys: Object.keys(materialized)
				});
			}

			// Debug for math folder
			if (dir.name === "math") {
			}

			// Merge file-folder collision exports into materialized result
			// Applies when the processFiles path is used (non-flatten)
			if (fileFolderCollisionImpl) {
				for (const [k, v] of Object.entries(fileFolderCollisionImpl)) {
					if (!(k in materialized)) {
						materialized[k] = v;
					}
				}
			}

			const materializedKeys = Object.keys(materialized);
			// Check for folder/folder.mjs pattern - if materialized has a property matching the folder name,
			// attach all other properties to it (e.g., logger/logger.mjs + logger/utils.mjs → logger function with .utils attached)
			// GUARD: Only fire when there is an ACTUAL FILE named after the folder in this directory's
			// direct files.  Without this guard, a lazy subdirectory wrapper whose name happens to equal
			// the folder name (e.g. services/ containing services/services/ subdir) would wrongly trigger
			// the hoist, turning the folder wrapper into just that subdirectory wrapper.
			const _hasCategoryFile = dir.children.files.some((f) => this.slothlet.helpers.sanitize.sanitizePropertyName(f.name) === categoryName);
			if (_hasCategoryFile && materializedKeys.includes(categoryName) && materializedKeys.length > 1) {
				if (config.debug?.modes) {
					this.slothlet.debug("modes", {
						message: "Folder pattern match",
						dir: dir.name,
						categoryName,
						keys: materializedKeys
					});
				}
				const mainValue = materialized[categoryName];
				// Attach all other properties to the main value
				for (const key of materializedKeys) {
					if (key !== categoryName) {
						if (config.debug?.modes) {
							this.slothlet.debug("modes", {
								message: "Folder pattern attach property",
								categoryName,
								key,
								valueType: typeof materialized[key]
							});
						}
						mainValue[key] = materialized[key];
					}
				}
				if (config.debug?.modes) {
					this.slothlet.debug("modes", {
						message: "Folder pattern return",
						categoryName,
						keys: Object.keys(mainValue).filter((k) => !k.startsWith("__"))
					});
				}
				return mainValue;
			}
			if (materializedKeys.length === 1 && materializedKeys[0] === categoryName) {
				const nestedValue = materialized[categoryName];
				if (nestedValue && resolveWrapper(nestedValue) !== null) {
					const attachedKeys = Object.keys(nestedValue).filter((key) => key !== "____slothletInternal");
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
		const wrapper = new UnifiedWrapper(this.slothlet, {
			mode: "lazy",
			apiPath,
			materializeFunc: lazy_materializeFunc,
			materializeOnCreate: config.backgroundMaterialize,
			filePath: dir.path, // Use directory path so lifecycle events can tag system metadata
			moduleID: moduleID, // Use parent moduleID
			sourceFolder
		});

		// Set collision mode from parent (api.add config or parent wrapper's collision mode)
		if (collisionMode) {
			wrapper.____slothletInternal.state.collisionMode = collisionMode;
		}

		// CRITICAL: Add file-folder collision exports as immediate children on the wrapper.
		// These come from a same-name file (e.g., math.mjs) that collides with this folder (math/).
		// Without this, the exports are trapped in the materialization closure and invisible
		// to merge operations in api-assignment.mjs until materialization completes.
		// IMPORTANT: Only pre-populate for merge/warn modes where the FILE (first) wins conflicts.
		// For merge-replace mode, the FOLDER (second) should win — pre-populating file exports
		// causes the get trap to return them before materialization can replace them with folder versions.
		// For merge-replace, the _mergeAfterMaterialize mechanism in api-assignment handles
		// adding non-conflicting file keys after materialization completes.
		const shouldPrePopulate = collisionMode === "merge" || collisionMode === "warn";
		if (fileFolderCollisionImpl && shouldPrePopulate) {
			for (const [k, v] of Object.entries(fileFolderCollisionImpl)) {
				if (typeof k === "string" && !k.startsWith("_") && !k.startsWith("__")) {
					Object.defineProperty(wrapper, k, {
						value: v,
						writable: false,
						enumerable: true,
						configurable: true
					});
				}
			}
		}

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
	async applyRootContributor(api, rootFunction, config, mode) {
		if (rootFunction) {
			// Merge all other API properties onto the root function
			Object.assign(rootFunction, api);
			if (config.debug?.modes) {
				this.slothlet.debug("modes", {
					message: await t("DEBUG_MODE_ROOT_CONTRIBUTOR_APPLIED", { mode, properties: Object.keys(api).length })
				});
			}
			return rootFunction;
		}
		return api;
	}
}
