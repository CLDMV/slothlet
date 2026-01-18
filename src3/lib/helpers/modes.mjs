/**
 * @fileoverview Shared mode utilities - common logic for eager and lazy modes
 * @module @cldmv/slothlet/helpers/modes
 */
import path from "node:path";
import { SlothletError } from "@cldmv/slothlet/errors";
import { loadModule, extractExports, scanDirectory } from "@cldmv/slothlet/helpers/loader";
import { sanitizePropertyName } from "@cldmv/slothlet/helpers/sanitize";
import { getFlatteningDecision } from "@cldmv/slothlet/helpers/flatten";
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
 * @param {boolean} isRoot - Whether processing root level files
 * @param {boolean} recursive - Whether to recurse into subdirectories
 * @returns {Promise<Function|null>} Root contributor function if found (only when isRoot=true)
 * @public
 */
export async function processFiles(api, files, directory, ownership, contextManager, instanceId, config, currentDepth, mode, isRoot, recursive) {
	let rootDefaultFunction = null;
	const categoryName = isRoot ? null : sanitizePropertyName(directory.name);
	const targetApi = isRoot ? api : (api[categoryName] = api[categoryName] || {});

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

			// Build module content based on decision
			let moduleContent = {};

			if (decision.useAutoFlattening) {
				// C04: Single named export matches module name
				moduleContent = mod[moduleName];
			} else {
				// Standard: collect all exports
				if (mod.default) moduleContent.default = mod.default;
				for (const key of moduleKeys) {
					moduleContent[key] = mod[key];
				}
			}

			// Special case: folder/folder.mjs pattern (only for nested, not root)
			if (!isRoot && moduleName === categoryName) {
				if (moduleKeys.length === 1 && moduleKeys[0] === moduleName && !analysis.hasDefault) {
					// Case 1: export const folder = {...} - flatten to category
					const exportedValue = mod[moduleName];
					if (typeof exportedValue === "object" && exportedValue !== null) {
						for (const [key, value] of Object.entries(exportedValue)) {
							targetApi[key] = value;
							if (ownership) {
								ownership.register({ moduleId: file.moduleId, apiPath: `${categoryName}.${key}`, source: "core" });
							}
						}
						continue;
					}
				} else if (analysis.hasDefault) {
					// Case 2: default export - replace category with the export
					api[categoryName] = moduleContent.default || moduleContent;
					if (ownership) {
						ownership.register({ moduleId: file.moduleId, apiPath: categoryName, source: "core" });
					}
					continue;
				}
			}

			// Wrap in UnifiedWrapper
			const wrapper = new UnifiedWrapper({
				mode,
				apiPath: isRoot ? moduleName : `${categoryName}.${moduleName}`,
				contextManager,
				instanceId,
				initialImpl: moduleContent,
				ownership
			});

			targetApi[moduleName] = wrapper.createProxy();

			if (ownership) {
				const apiPath = isRoot ? moduleName : `${categoryName}.${moduleName}`;
				ownership.register({ moduleId: file.moduleId, apiPath, source: "core" });
			}
		}
	}

	// Recurse into subdirectories (only if recursive flag is true)
	if (recursive && directory?.children?.directories) {
		for (const subDir of directory.children.directories) {
			const subDirName = sanitizePropertyName(subDir.name);
			const subDirApi = {};
			await processFiles(
				subDirApi,
				subDir.children.files,
				subDir,
				ownership,
				contextManager,
				instanceId,
				config,
				currentDepth + 1,
				mode,
				false, // Not root
				recursive // Pass through recursive flag
			);

			// Wrap subdirectory
			const wrapper = new UnifiedWrapper({
				mode,
				apiPath: `${categoryName}.${subDirName}`,
				contextManager,
				instanceId,
				initialImpl: subDirApi[subDirName],
				ownership
			});
			targetApi[subDirName] = wrapper.createProxy();
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
