/**
 * @fileoverview Eager mode implementation - loads all modules immediately with proper flattening
 * @module @cldmv/slothlet/modes/eager
 */
import { SlothletError } from "@cldmv/slothlet/errors";
import { loadModule, scanDirectory, extractExports, mergeExportsIntoAPI } from "@cldmv/slothlet/helpers/loader";
import { sanitizePropertyName } from "@cldmv/slothlet/helpers/sanitize";
import { getFlatteningDecision, processModuleForAPI, buildCategoryDecisions } from "@cldmv/slothlet/helpers/flatten";
import { t } from "@cldmv/slothlet/i18n";
import path from "node:path";

/**
 * Build API in eager mode (load all modules immediately)
 * @param {string} dir - Directory path to load from
 * @param {Object} ownership - Ownership manager
 * @param {Object} config - Configuration
 * @returns {Promise<Object>} Built API object
 * @public
 */
export async function buildEagerAPI({ dir, ownership, config = {} }) {
	const api = {};
	let rootDefaultFunction = null;

	// Scan directory structure
	const structure = await scanDirectory(dir);

	// Process root files (with root contributor pattern support)
	for (const file of structure.files) {
		const contributedFunction = await processRootFile(api, file, ownership, config);

		// If a root file contributes a default function, save it
		if (contributedFunction && !rootDefaultFunction) {
			rootDefaultFunction = contributedFunction;
			if (config.debug) {
				console.log(await t("DEBUG_MODE_ROOT_CONTRIBUTOR", { mode: "eager", functionName: contributedFunction.name || "anonymous" }));
			}
		}
	}

	// Process directories
	for (const directory of structure.directories) {
		await processDirectory(api, directory, ownership, config, 1);
	}

	// Apply root contributor pattern: if a root function exists, make it THE api
	let finalApi;
	if (rootDefaultFunction) {
		// Merge all other API properties onto the root function
		Object.assign(rootDefaultFunction, api);
		finalApi = rootDefaultFunction;
		if (config.debug) {
			console.log(await t("DEBUG_MODE_ROOT_CONTRIBUTOR_APPLIED", { mode: "eager", properties: Object.keys(api).length }));
		}
	} else {
		// No root contributor - API is plain object
		finalApi = api;
	}

	return finalApi;
}

/**
 * Process a root-level file
 * @param {Object} api - API object being built
 * @param {Object} file - File info from scanner
 * @param {Object} ownership - Ownership manager
 * @param {Object} config - Configuration
 * @returns {Function|null} Returns default function if module is a root contributor
 * @private
 */
async function processRootFile(api, file, ownership, config) {
	try {
		const mod = await loadModule(file.path);
		const moduleName = sanitizePropertyName(file.name);
		const exports = extractExports(mod);

		// Check if this is a root contributor (default function export)
		// Root contributors become THE api (with other modules as properties)
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

			if (config.debug) {
				console.log(await t("DEBUG_MODE_ROOT_FILE", { mode: "eager", moduleName, isContributor: true }));
			}

			// Return the function to be used as root contributor
			return defaultFunc;
		} else {
			// Not a root contributor - use normal merge logic
			mergeExportsIntoAPI(api, exports, moduleName);

			// Register ownership
			if (ownership) {
				ownership.register({
					moduleId: file.moduleId,
					apiPath: moduleName,
					source: "core"
				});
			}

			if (config.debug) {
				console.log(await t("DEBUG_MODE_ROOT_FILE", { mode: "eager", moduleName, isContributor: false }));
			}

			return null;
		}
	} catch (error) {
		throw new SlothletError("MODULE_LOAD_FAILED", {
			modulePath: file.path,
			moduleId: file.moduleId,
			error: error.message || error.toString(),
			stack: error.stack
		});
	}
}

/**
 * Process a directory (folder with modules)
 * @param {Object} api - API object being built
 * @param {Object} directory - Directory info from scanner
 * @param {Object} ownership - Ownership manager
 * @param {Object} config - Configuration
 * @param {number} currentDepth - Current nesting depth
 * @private
 */
async function processDirectory(api, directory, ownership, config, currentDepth) {
	const categoryName = sanitizePropertyName(directory.name);
	const moduleFiles = directory.children.files;

	if (config.debug) {
		console.log(await t("DEBUG_MODE_PROCESSING_DIRECTORY", { mode: "eager", categoryName, currentDepth }));
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
				mod: exports, // Use extracted exports instead of raw module
				moduleName,
				moduleKeys,
				analysis
			});
		} catch (error) {
			throw new SlothletError("MODULE_LOAD_FAILED", {
				modulePath: file.path,
				moduleId: file.moduleId,
				error: error.message
			});
		}
	}

	// Check for multiple default exports in folder
	const defaultCount = loadedModules.filter((m) => m.analysis.hasDefault).length;
	const hasMultipleDefaults = defaultCount > 1;

	// Process each module with flattening logic
	for (const { file, mod, moduleName, moduleKeys, analysis } of loadedModules) {
		// Get flattening decision (C01-C07)
		const decision = getFlatteningDecision({
			mod,
			moduleName,
			categoryName,
			analysis,
			hasMultipleDefaults,
			moduleKeys
		});

		if (config.debug) {
			console.log(await t("DEBUG_MODE_MODULE_DECISION", { mode: "eager", moduleName, reason: decision.reason }));
		}

		// Check for self-referential
		const isSelfReferential = mod[moduleName] === mod;

		// Process module for API (C08-C09b)
		const result = processModuleForAPI({
			mod,
			decision,
			apiPathKey: moduleName,
			moduleKeys,
			isSelfReferential
		});

		// Apply category-level decisions (C10-C18)
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
			// Instead of api.math.math = {...}, flatten to api.math = {...}
			const exportedValue = result.apiAssignments[moduleName];
			if (typeof exportedValue === "object" && exportedValue !== null) {
				// Merge the exported object's properties directly into the category
				for (const [key, value] of Object.entries(exportedValue)) {
					targetApi[key] = value;

					// Register ownership for each property
					if (ownership) {
						const apiPath = `${categoryName}.${key}`;
						ownership.register({
							moduleId: file.moduleId,
							apiPath,
							source: "core"
						});
					}
				}
				// Skip the normal API assignments since we've already merged
				continue;
			}
		}

		// Case 2: folder/folder.mjs with default export - replace category with the export
		if (moduleName === categoryName && analysis.hasDefault) {
			// folder/folder.mjs with default export (with or without named exports)
			// Use the default (potentially with named exports merged) as the category itself
			const assignedValue = result.apiAssignments[moduleName];

			if (config.debug) {
				console.log(
					await t("DEBUG_MODE_FOLDER_MATCH", {
						mode: "eager",
						moduleName,
						categoryName,
						hasAssignment: !!assignedValue,
						assignmentKeys: Object.keys(result.apiAssignments).join(", ")
					})
				);
			}

			if (assignedValue) {
				api[categoryName] = assignedValue;

				// Register ownership
				if (ownership) {
					ownership.register({
						moduleId: file.moduleId,
						apiPath: categoryName,
						source: "core"
					});
				}

				if (config.debug) {
					console.log(await t("DEBUG_MODE_FOLDER_DEFAULT", { mode: "eager", categoryName, moduleName }));
				}
				// Skip normal assignments - we've replaced the category
				continue;
			}
		}
		// Apply flattening if needed
		if (categoryDecision.shouldFlatten) {
			if (config.debug) {
				console.log(await t("DEBUG_MODE_FLATTENING", { mode: "eager", moduleName, flattenType: categoryDecision.flattenType }));
			}

			// Use preferred name if available
			if (categoryDecision.preferredName) {
				finalKey = sanitizePropertyName(categoryDecision.preferredName);
			}
		}

		// Merge API assignments
		for (const [key, value] of Object.entries(result.apiAssignments)) {
			const sanitizedKey = sanitizePropertyName(key);
			targetApi[sanitizedKey] = value;

			// Register ownership
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
		await processDirectory(api[categoryName], subDir, ownership, config, currentDepth + 1);
	}
}
