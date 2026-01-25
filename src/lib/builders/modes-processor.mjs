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
import { UnifiedWrapper } from "@cldmv/slothlet/handlers/unified-wrapper";

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
		collisionContext = "initial"
	) {
		// Access components and data via slothlet instance
		const { ownership } = this.slothlet.handlers;
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
		const shouldWrap = !(mode === "lazy" && populateDirectly);

		if (!isRoot && shouldWrap && !populateDirectly) {
			const existingTarget = api[categoryName];
			if (existingTarget && existingTarget.__wrapper) {
				if (config.debug?.modes) {
					this.slothlet.debug("modes", {
						message: "Category reuse - using existing wrapper",
						categoryName,
						apiPath: existingTarget.__wrapper.apiPath
					});
				}
				targetApi = existingTarget;
			} else if (existingTarget === undefined || (typeof existingTarget === "object" && existingTarget !== null)) {
				// If existingTarget is a wrapper proxy, don't try to clone it - use empty object
				// The wrapper will be populated with new children during file processing
				const initialImpl =
					existingTarget && existingTarget.__wrapper ? {} : this.slothlet.helpers.modesUtils.cloneWrapperImpl(existingTarget || {}, mode);

				if (config.debug?.modes) {
					this.slothlet.debug("modes", {
						message: "Category wrapper created",
						categoryName,
						apiPath: buildApiPath(categoryName)
					});
				}
				const wrapper = new UnifiedWrapper(this.slothlet, {
					mode,
					apiPath: buildApiPath(categoryName),
					initialImpl
				});
				api[categoryName] = wrapper.createProxy();
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
						isWrapper: !!targetApi.__wrapper,
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
				const mod = await loader.loadModule(file.path, instanceID);
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
				throw new this.SlothletError("MODULE_LOAD_FAILED", { modulePath: file.path, moduleId: file.moduleId }, error);
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
			const isRootContributor = isRoot && analysis.hasDefault && typeof mod.default === "function";

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
			} else {
				// Regular module - apply flattening decisions
				const decision = flatten.getFlatteningDecision({
					mod,
					moduleName,
					categoryName: categoryName || moduleName,
					analysis,
					hasMultipleDefaults,
					moduleKeys
				});

				if (config.debug?.modes) {
					this.slothlet.debug("modes", {
						message: await t("DEBUG_MODE_MODULE_DECISION", { mode, moduleName, reason: decision.reason })
					});
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
					moduleContent = this.slothlet.helpers.modesUtils.ensureNamedExportFunction(mod.default, propertyName);
					for (const key of moduleKeys) {
						if (!this.slothlet.helpers.utilities.shouldAttachNamedExport(key, mod[key], moduleContent, mod.default)) {
							continue;
						}
						moduleContent[key] = mod[key];
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
									mode,
									apiPath: buildApiPath(categoryName),
									materializeOnCreate: config.backgroundMaterialize
								});

								// Replace targetApi reference with the wrapped proxy
								// This allows other files in the folder to attach properties if needed
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
										moduleId: file.moduleId,
										apiPath: `${categoryName}.${key}`,
										source: "core",
										collisionMode: this.slothlet.helpers.modesUtils.getOwnershipCollisionMode(config, collisionContext)
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
						if (typeof callableModule === "function" && namedKeys.length > 0) {
							for (const key of namedKeys) {
								if (!this.slothlet.helpers.utilities.shouldAttachNamedExport(key, mod[key], callableModule, mod.default)) {
									continue;
								}
								if (callableModule[key] === undefined) {
									callableModule[key] = mod[key];
								}
							}
						}
						moduleContent = callableModule;
						if (shouldWrap) {
							const wrapper = new UnifiedWrapper(this.slothlet, {
								mode,
								apiPath: buildApiPath(categoryName),
								initialImpl: this.slothlet.helpers.modesUtils.cloneWrapperImpl(moduleContent, mode),
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
									const namedWrapper = new UnifiedWrapper(this.slothlet, {
										mode,
										apiPath: buildApiPath(`${categoryName}.${key}`),
										initialImpl: mod[key],
										materializeOnCreate: config.backgroundMaterialize
									});
									this.slothlet.builders.apiAssignment.assignToApiPath(targetApi, key, namedWrapper.createProxy(), {
										useCollisionDetection: true,
										config
									});
								} else {
									this.slothlet.builders.apiAssignment.assignToApiPath(targetApi, key, mod[key], {
										useCollisionDetection: true,
										config
									});
								}
								if (ownership) {
									ownership.register({
										moduleId: file.moduleId,
										apiPath: `${categoryName}.${key}`,
										source: "core",
										collisionMode: this.slothlet.helpers.modesUtils.getOwnershipCollisionMode(config, collisionContext)
									});
								}
							}
						}

						if (ownership) {
							ownership.register({
								moduleId: file.moduleId,
								apiPath: categoryName,
								source: "core",
								collisionMode: this.slothlet.helpers.modesUtils.getOwnershipCollisionMode(config, collisionContext)
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
										mode,
										apiPath: buildApiPath(`${categoryName}.${propKey}`),
										initialImpl: this.slothlet.helpers.modesUtils.cloneWrapperImpl(propValue, mode),
										materializeOnCreate: config.backgroundMaterialize
									});
									this.slothlet.builders.apiAssignment.assignToApiPath(targetApi, propKey, wrapper.createProxy(), {
										useCollisionDetection: true,
										config
									});
								} else {
									this.slothlet.builders.apiAssignment.assignToApiPath(targetApi, propKey, propValue, {
										useCollisionDetection: true,
										config
									});
								}
								if (ownership) {
									ownership.register({
										moduleId: file.moduleId,
										apiPath: `${categoryName}.${propKey}`,
										source: "core",
										collisionMode: this.slothlet.helpers.modesUtils.getOwnershipCollisionMode(config, collisionContext)
									});
								}
							}

							// Add other named exports from this file to category
							for (const key of moduleKeys) {
								if (key !== moduleName) {
									if (shouldWrap) {
										const wrapper = new UnifiedWrapper(this.slothlet, {
											mode,
											apiPath: buildApiPath(`${categoryName}.${key}`),
											initialImpl: this.slothlet.helpers.modesUtils.cloneWrapperImpl(mod[key], mode),
											materializeOnCreate: config.backgroundMaterialize
										});
										this.slothlet.builders.apiAssignment.assignToApiPath(targetApi, key, wrapper.createProxy(), {
											useCollisionDetection: true,
											config
										});
									} else {
										this.slothlet.builders.apiAssignment.assignToApiPath(targetApi, key, mod[key], {
											useCollisionDetection: true,
											config
										});
									}
									if (ownership) {
										ownership.register({
											moduleId: file.moduleId,
											apiPath: `${categoryName}.${key}`,
											source: "core",
											collisionMode: this.slothlet.helpers.modesUtils.getOwnershipCollisionMode(config, collisionContext)
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
									isWrapper: !!targetApi.__wrapper,
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
										mode,
										apiPath: buildApiPath(`${categoryName}.${key}`),
										initialImpl: this.slothlet.helpers.modesUtils.cloneWrapperImpl(mod[key], mode),
										materializeOnCreate: config.backgroundMaterialize
									});
									const assigned = this.slothlet.builders.apiAssignment.assignToApiPath(targetApi, key, wrapper.createProxy(), {
										useCollisionDetection: true,
										config
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
										config
									});
								}
								if (ownership) {
									ownership.register({
										moduleId: file.moduleId,
										apiPath: `${categoryName}.${key}`,
										source: "core",
										collisionMode: this.slothlet.helpers.modesUtils.getOwnershipCollisionMode(config, collisionContext)
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
							const wrapper = new UnifiedWrapper(this.slothlet, {
								mode,
								apiPath: buildApiPath(`${categoryName}.${preferredName}`),
								initialImpl: this.slothlet.helpers.modesUtils.cloneWrapperImpl(mod[key], mode),
								materializeOnCreate: config.backgroundMaterialize
							});
							this.slothlet.builders.apiAssignment.assignToApiPath(targetApi, preferredName, wrapper.createProxy(), {
								useCollisionDetection: true,
								config
							});
						} else {
							this.slothlet.builders.apiAssignment.assignToApiPath(targetApi, preferredName, mod[key], {
								useCollisionDetection: true,
								config
							});
						}
						if (ownership) {
							ownership.register({
								moduleId: file.moduleId,
								apiPath: `${categoryName}.${preferredName}`,
								source: "core",
								collisionMode: this.slothlet.helpers.modesUtils.getOwnershipCollisionMode(config, collisionContext)
							});
						}
						continue;
					}
				}

				// Wrap in UnifiedWrapper
				if (shouldWrap) {
					const localPath = isRoot ? propertyName : `${categoryName}.${propertyName}`;
					const wrapper = new UnifiedWrapper(this.slothlet, {
						mode,
						apiPath: buildApiPath(localPath),
						initialImpl: this.slothlet.helpers.modesUtils.cloneWrapperImpl(moduleContent, mode),
						materializeOnCreate: config.backgroundMaterialize
					});

					this.slothlet.debug("modes", {
						message: "File wrapper assignment",
						propertyName,
						apiPath: buildApiPath(localPath),
						overwriting: propertyName in targetApi ? (targetApi[propertyName]?.__wrapper ? "wrapper" : "value") : "nothing"
					});
					this.slothlet.builders.apiAssignment.assignToApiPath(targetApi, propertyName, wrapper.createProxy(), {
						useCollisionDetection: true,
						config
					});
				} else {
					this.slothlet.builders.apiAssignment.assignToApiPath(targetApi, propertyName, moduleContent, {
						useCollisionDetection: true,
						config
					});
				}
				if (config.debug?.modes && categoryName === "logger") {
					this.slothlet.debug("modes", {
						message: "After assignment status",
						targetApiType: typeof targetApi,
						propertyName,
						hasProperty: propertyName in targetApi,
						implType: typeof targetApi.__wrapper?._impl,
						implHasProperty: !!targetApi.__wrapper?._impl?.utils
					});
				}
				if (ownership) {
					const apiPath = isRoot ? propertyName : `${categoryName}.${propertyName}`;
					const collisionMode = config.collision?.[collisionContext] || "merge";
					ownership.register({
						moduleId: file.moduleId,
						apiPath,
						source: "core",
						collisionMode: this.slothlet.helpers.modesUtils.getOwnershipCollisionMode(config, collisionContext),
						collisionMode,
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
							const mod = await loader.loadModule(file.path, instanceID);
							const exports = loader.extractExports(mod);
							const moduleKeys = Object.keys(exports).filter((k) => k !== "default");
							const analysis = {
								hasDefault: exports.default !== undefined,
								hasNamed: moduleKeys.length > 0,
								defaultExportType: exports.default ? typeof exports.default : null
							};

							const modContent = exports.default !== undefined ? exports.default : exports;
							const categoryDecision = flatten.buildCategoryDecisions({
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
								this.slothlet.debug("modes", {
									message: "Folder-level flatten - skipping recursion",
									subDir: subDirName
								});
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
											if (key !== "default") {
												const hasExisting = implToWrap[key] !== undefined;
												if (!hasExisting) {
													implToWrap[key] = exports[key];
												}
											}
										}
									}
								} else {
									// Fallback - use the whole module
									implToWrap = modContent;
								}

								// Flatten: put the module content directly at targetApi[subDirName]
								const wrapper = new UnifiedWrapper(this.slothlet, {
									mode,
									apiPath: buildApiPath(categoryName ? `${categoryName}.${subDirName}` : subDirName),
									initialImpl: this.slothlet.helpers.modesUtils.cloneWrapperImpl(implToWrap, mode),
									materializeOnCreate: config.backgroundMaterialize
								});
								this.slothlet.builders.apiAssignment.assignToApiPath(targetApi, subDirName, wrapper.createProxy(), {
									useCollisionDetection: true,
									config
								});
								if (ownership) {
									const apiPath = buildApiPath(categoryName ? `${categoryName}.${subDirName}` : subDirName);
									const collisionMode = config.collision?.[collisionContext] || "merge";
									ownership.register({
										moduleId: file.moduleId,
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

					// Regular subdirectory processing
					await this.processFiles(
						targetApi,
						subDir.children.files,
						{ name: subDirName, children: subDir.children },
						currentDepth + 1,
						mode,
						false, // Not root
						recursive, // Pass through recursive flag
						false, // populateDirectly - build on parent api
						apiPathPrefix, // Pass through apiPathPrefix to subdirectories
						collisionContext
					);
				}
			} else {
				// Lazy mode: create lazy wrappers for subdirectories
				for (const subDir of directory.children.directories) {
					const subDirName = this.slothlet.helpers.sanitize.sanitizePropertyName(subDir.name);
					const apiPath = categoryName ? `${categoryName}.${subDirName}` : subDirName;
					if (config.debug?.modes) {
						this.slothlet.debug("modes", {
							message: "Creating lazy subdirectory",
							apiPath,
							fileCount: subDir.children.files.length
						});
					}
					this.slothlet.builders.apiAssignment.assignToApiPath(
						targetApi,
						subDirName,
						this.createLazySubdirectoryWrapper(subDir, ownership, contextManager, instanceID, apiPath, config, loader, flatten),
						{
							useCollisionDetection: true,
							config
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
						moduleId: file.moduleId,
						apiPath: moduleName,
						source: "core",
						collisionMode: this.slothlet.helpers.modesUtils.getOwnershipCollisionMode(config, collisionContext)
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
							mode,
							apiPath: buildApiPath(moduleName),
							initialImpl: this.slothlet.helpers.modesUtils.cloneWrapperImpl(defaultFunc, mode),
							materializeOnCreate: config.backgroundMaterialize
						});
						this.slothlet.builders.apiAssignment.assignToApiPath(targetApi, moduleName, wrapper.createProxy(), {
							useCollisionDetection: true,
							config
						});
					} else {
						this.slothlet.builders.apiAssignment.assignToApiPath(targetApi, moduleName, defaultFunc, {
							useCollisionDetection: true,
							config
						});
					}

					if (ownership) {
						ownership.register({
							moduleId: file.moduleId,
							apiPath: moduleName,
							source: "core",
							collisionMode: this.slothlet.helpers.modesUtils.getOwnershipCollisionMode(config, collisionContext)
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
	createLazySubdirectoryWrapper(dir, ownership, contextManager, instanceID, apiPath, config, loader, flatten) {
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
			const subDirs = dir.children.directories || [];

			if (dir.children.files.length === 1 && subDirs.length === 0) {
				const file = dir.children.files[0];
				const moduleName = this.slothlet.helpers.sanitize.sanitizePropertyName(file.name);
				const genericFilenames = ["singlefile", "index", "main", "default"];
				const isGeneric = genericFilenames.includes(moduleName.toLowerCase());
				const filenameMatchesFolder = moduleName === categoryName;

				if (isGeneric || filenameMatchesFolder) {
					const mod = await loader.loadModule(file.path, instanceID);
					const exports = loader.extractExports(mod);
					const moduleKeys = Object.keys(exports).filter((k) => k !== "default");
					const analysis = {
						hasDefault: exports.default !== undefined,
						hasNamed: moduleKeys.length > 0,
						defaultExportType: exports.default ? typeof exports.default : null
					};
					const modContent = exports.default !== undefined ? exports.default : exports;
					const categoryDecision = flatten.buildCategoryDecisions({
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
							implToWrap = this.slothlet.helpers.modesUtils.ensureNamedExportFunction(exports.default, categoryName);
							// Hybrid pattern: default function + named exports
							// Attach named exports as properties on the function
							if (typeof implToWrap === "function" && moduleKeys.length > 0) {
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
											throw new Error(`Collision detected: property "${key}" already exists on default export function at ${apiPath}`);
										} else if (collisionMode === "warn") {
											console.warn(
												`Collision warning: property "${key}" already exists on default export function at ${apiPath}. Named export will overwrite.`
											);
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
			await this.processFiles(
				materialized,
				dir.children.files,
				{ name: dir.name, children: dir.children },
				0,
				"eager",
				false, // Not root (for root contributor detection)
				false, // NOT recursive - create lazy wrappers for subdirectories, don't cascade eager load
				true, // Populate directly (don't nest under categoryName)
				"",
				"initial"
			);

			if (config.debug?.modes) {
				this.slothlet.debug("modes", {
					message: "Materialize function returning impl",
					dir: dir.name,
					keys: Object.keys(materialized)
				});
			}
			const materializedKeys = Object.keys(materialized);
			// Check for folder/folder.mjs pattern - if materialized has a property matching the folder name,
			// attach all other properties to it (e.g., logger/logger.mjs + logger/utils.mjs → logger function with .utils attached)
			if (materializedKeys.includes(categoryName) && materializedKeys.length > 1) {
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
		const wrapper = new UnifiedWrapper(this.slothlet, {
			mode: "lazy",
			apiPath,
			materializeFunc: lazy_materializeFunc,
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
