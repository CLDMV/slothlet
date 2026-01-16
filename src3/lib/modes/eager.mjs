/**
 * @fileoverview Eager mode implementation - loads all modules immediately with proper flattening
 * @module @cldmv/slothlet/modes/eager
 */
import { SlothletError } from "@cldmv/slothlet/errors";
import { loadModule, scanDirectory } from "@cldmv/slothlet/helpers/loader";
import { sanitizePropertyName } from "@cldmv/slothlet/helpers/sanitize";
import { getFlatteningDecision, processModuleForAPI, buildCategoryDecisions } from "@cldmv/slothlet/helpers/flatten";
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

	// Scan directory structure
	const structure = await scanDirectory(dir);

	// Process root files
	for (const file of structure.files) {
		await processRootFile(api, file, ownership, config);
	}

	// Process directories
	for (const directory of structure.directories) {
		await processDirectory(api, directory, ownership, config, 1);
	}

	return api;
}

/**
 * Process a root-level file
 * @param {Object} api - API object being built
 * @param {Object} file - File info from scanner
 * @param {Object} ownership - Ownership manager
 * @param {Object} config - Configuration
 * @private
 */
async function processRootFile(api, file, ownership, config) {
	try {
		const mod = await loadModule(file.path);
		const moduleName = sanitizePropertyName(file.name);

		// Root files don't get flattened - they go directly on api
		api[moduleName] = mod.default || mod;

		// Register ownership
		if (ownership) {
			ownership.register({
				moduleId: file.moduleId,
				apiPath: moduleName,
				source: "core"
			});
		}

		if (config.debug) {
			console.log(`[eager] Root file: ${moduleName}`);
		}
	} catch (error) {
		throw new SlothletError("MODULE_LOAD_FAILED", {
			modulePath: file.path,
			moduleId: file.moduleId,
			error: error.message
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
		console.log(`[eager] Processing directory: ${categoryName} (depth ${currentDepth})`);
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
			const moduleName = sanitizePropertyName(file.name);

			// Analyze exports
			const moduleKeys = Object.keys(mod).filter((k) => k !== "default");
			const analysis = {
				hasDefault: mod.default !== undefined,
				hasNamed: moduleKeys.length > 0,
				defaultExportType: mod.default ? typeof mod.default : null
			};

			loadedModules.push({
				file,
				mod,
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
			console.log(`[eager] Module ${moduleName}: ${decision.reason}`);
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

		// Apply flattening if needed
		if (categoryDecision.shouldFlatten) {
			if (config.debug) {
				console.log(`[eager] Flattening ${moduleName}: ${categoryDecision.flattenType}`);
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
