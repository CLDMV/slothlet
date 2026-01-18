/**
 * @fileoverview Shared mode utilities - common logic for eager and lazy modes
 * @module @cldmv/slothlet/helpers/modes
 */
import path from "node:path";
import { SlothletError } from "@cldmv/slothlet/errors";
import { loadModule, extractExports, scanDirectory } from "@cldmv/slothlet/helpers/loader";
import { sanitizePropertyName } from "@cldmv/slothlet/helpers/sanitize";
import { getFlatteningDecision, processModuleForAPI, buildCategoryDecisions } from "@cldmv/slothlet/helpers/flatten";
import { t } from "@cldmv/slothlet/i18n";
import { UnifiedWrapper } from "@cldmv/slothlet/handlers/unified-wrapper";

/**
 * Process root files and detect root contributor pattern
 * @param {Object} api - API object being built
 * @param {Array} files - Root files from scanner
 * @param {Object} ownership - Ownership manager
 * @param {Object} contextManager - Context manager for wrapper
 * @param {string} instanceId - Instance ID for wrapper
 * @param {Object} config - Configuration
 * @param {string} mode - Mode name for debug messages
 * @returns {Promise<Function|null>} Root contributor function if found
 * @public
 */
export async function processRootFiles(api, files, ownership, contextManager, instanceId, config, mode) {
	let rootDefaultFunction = null;

	for (const file of files) {
		const mod = await loadModule(file.path);
		const moduleName = sanitizePropertyName(file.name);
		const exports = extractExports(mod);

		// Check if this is a root contributor (default function export)
		const isRootContributor = exports.default && typeof exports.default === "function";

		if (isRootContributor) {
			// This is a root contributor - attach named exports to the default function
			const defaultFunc = exports.default;
			const namedExports = Object.keys(exports).filter((k) => k !== "default");

			for (const key of namedExports) {
				defaultFunc[key] = exports[key];
			}

			// Register ownership for the function itself
			if (ownership) {
				ownership.register({
					moduleId: file.moduleId,
					apiPath: moduleName,
					source: "core"
				});
			}

			if (config.debug?.modes) {
				console.log(await t("DEBUG_MODE_ROOT_FILE", { mode, moduleName, isContributor: true }));
			}

			// Save as root function if we don't have one yet
			if (!rootDefaultFunction) {
				rootDefaultFunction = defaultFunc;
				if (config.debug?.modes) {
					console.log(await t("DEBUG_MODE_ROOT_CONTRIBUTOR", { mode, functionName: defaultFunc.name || "anonymous" }));
				}
			}
		} else {
			// Regular module - NOT a root contributor
			// Root files should create their own namespace with their sanitized filename
			// The file's exports become properties of that namespace

			const moduleContent = {};

			// Collect all exports (default and named)
			if (exports.default) {
				moduleContent.default = exports.default;
			}

			const namedExports = Object.keys(exports).filter((k) => k !== "default");
			for (const key of namedExports) {
				moduleContent[key] = exports[key];
			}

			// Wrap in UnifiedWrapper with the file's sanitized name as the namespace
			const wrapper = new UnifiedWrapper({
				mode,
				apiPath: moduleName,
				contextManager,
				instanceId,
				initialImpl: moduleContent,
				ownership
			});

			api[moduleName] = wrapper.createProxy();

			// Register ownership
			if (ownership) {
				ownership.register({
					moduleId: file.moduleId,
					apiPath: moduleName,
					source: "core"
				});
			}

			if (config.debug?.modes) {
				console.log(await t("DEBUG_MODE_ROOT_FILE", { mode, moduleName, isContributor: false }));
			}
		}
	}

	return rootDefaultFunction;
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

/**
 * Universal directory processing function used by both eager and lazy modes
 * For eager: deep dives and loads everything immediately
 * For lazy: processes current level, returns proxies for subdirectories
 * @param {Object} api - API object being built
 * @param {Object} directory - Directory object with name, path, and children
 * @param {Object} ownership - Ownership manager
 * @param {Object} contextManager - Context manager
 * @param {string} instanceId - Instance ID
 * @param {Object} config - Configuration
 * @param {number} currentDepth - Current recursion depth
 * @param {string} mode - Mode ("eager" or "lazy")
 * @returns {Promise<void>}
 * @public
 */
export async function processDirectory(api, directory, ownership, contextManager, instanceId, config, currentDepth, mode = "eager") {
	const categoryName = sanitizePropertyName(directory.name);
	const moduleFiles = directory.children.files;

	if (config.debug?.modes) {
		console.log(await t("DEBUG_MODE_PROCESSING_DIRECTORY", { mode, categoryName, currentDepth }));
	}

	// Create category if it doesn't exist
	if (!api[categoryName]) {
		api[categoryName] = {};
	}

	// Load all modules in this directory
	const loadedModules = [];
	for (const file of moduleFiles) {
		try {
			const mod = await loadModule(file.path);
			const exports = extractExports(mod);
			const moduleName = sanitizePropertyName(file.name);

			// Analyze exports
			const moduleKeys = Object.keys(exports).filter((k) => k !== "default");
			const analysis = {
				hasDefault: exports.default !== undefined,
				hasNamed: moduleKeys.length > 0,
				defaultExportType: exports.default ? typeof exports.default : null
			};

			loadedModules.push({
				file,
				mod: exports,
				moduleName,
				moduleKeys,
				analysis
			});
		} catch (error) {
			if (error.name === "SlothletError") {
				throw error;
			}
			throw new SlothletError(
				"MODULE_LOAD_FAILED",
				{
					modulePath: file.path,
					moduleId: file.moduleId
				},
				error
			);
		}
	}

	// Calculate if there are multiple default exports in this directory
	const hasMultipleDefaults = loadedModules.filter((m) => m.analysis.hasDefault).length > 1;

	// Process each module with flattening logic
	for (const { file, mod, moduleName, moduleKeys, analysis } of loadedModules) {
		// Get flattening decision
		const decision = getFlatteningDecision({
			mod,
			moduleName,
			categoryName,
			analysis,
			hasMultipleDefaults,
			moduleKeys
		});

		if (config.debug?.modes) {
			console.log(await t("DEBUG_MODE_MODULE_DECISION", { mode, moduleName, reason: decision.reason }));
		}

		// Check for self-referential
		const isSelfReferential = mod[moduleName] === mod;

		// Process module for API
		const result = processModuleForAPI({
			mod,
			decision,
			apiPathKey: moduleName,
			moduleKeys,
			isSelfReferential
		});

		// Apply category-level decisions
		const categoryDecision = buildCategoryDecisions({
			categoryName,
			mod,
			moduleName,
			fileBaseName: path.basename(file.path, path.extname(file.path)),
			analysis,
			moduleKeys,
			currentDepth,
			moduleFiles
		});

		// Determine final API path
		let targetApi = api[categoryName];
		let finalKey = moduleName;

		// Special case: folder/folder.mjs with matching export
		// Case 1: export const folder = {...} - flatten contents to category level
		if (
			moduleName === categoryName &&
			moduleKeys.length === 1 &&
			moduleKeys[0] === moduleName &&
			!analysis.hasDefault &&
			result.apiAssignments[moduleName]
		) {
			const exportedValue = result.apiAssignments[moduleName];
			if (typeof exportedValue === "object" && exportedValue !== null) {
				// Merge the exported object's properties directly into the category
				for (const [key, value] of Object.entries(exportedValue)) {
					targetApi[key] = value;

					if (ownership) {
						const apiPath = `${categoryName}.${key}`;
						ownership.register({
							moduleId: file.moduleId,
							apiPath,
							source: "core"
						});
					}
				}
				continue;
			}
		}

		// Case 2: folder/folder.mjs with default export - replace category with the export
		if (moduleName === categoryName && analysis.hasDefault) {
			const assignedValue = result.apiAssignments[moduleName];

			if (config.debug?.modes) {
				console.log(
					await t("DEBUG_MODE_FOLDER_MATCH", {
						mode,
						moduleName,
						categoryName,
						hasAssignment: !!assignedValue,
						assignmentKeys: Object.keys(result.apiAssignments).join(", ")
					})
				);
			}

			if (assignedValue) {
				api[categoryName] = assignedValue;

				if (ownership) {
					ownership.register({
						moduleId: file.moduleId,
						apiPath: categoryName,
						source: "core"
					});
				}

				if (config.debug?.modes) {
					console.log(await t("DEBUG_MODE_FOLDER_DEFAULT", { mode, categoryName, moduleName }));
				}
				continue;
			}
		}

		// Apply flattening if needed
		if (categoryDecision.shouldFlatten) {
			if (config.debug?.modes) {
				console.log(await t("DEBUG_MODE_FLATTENING", { mode, moduleName, flattenType: categoryDecision.flattenType }));
			}

			if (categoryDecision.preferredName) {
				finalKey = sanitizePropertyName(categoryDecision.preferredName);
			}
		}

		// Merge API assignments
		for (const [key, value] of Object.entries(result.apiAssignments)) {
			const sanitizedKey = sanitizePropertyName(key);
			targetApi[sanitizedKey] = value;

			if (ownership) {
				const apiPath = `${categoryName}.${sanitizedKey}`;
				ownership.register({
					moduleId: file.moduleId,
					apiPath,
					source: "core"
				});
			}
		}
	}

	// Recurse into subdirectories
	for (const subDir of directory.children.directories) {
		const subDirName = sanitizePropertyName(subDir.name);
		const subDirObj = {};
		await processDirectory(subDirObj, subDir, ownership, contextManager, instanceId, config, currentDepth + 1, mode);

		// Extract the actual content
		const subDirContent = subDirObj[subDirName];

		// Wrap subdirectory in unified wrapper
		const wrapper = new UnifiedWrapper({
			mode,
			apiPath: `${categoryName}.${subDirName}`,
			contextManager,
			instanceId,
			initialImpl: subDirContent,
			ownership
		});
		api[categoryName][subDirName] = wrapper.createProxy();
	}
}
