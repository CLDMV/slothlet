/**
 * Flattening decision module.
 * Determines when and how to flatten API structures based on comprehensive rule set.
 * Implements 18 core conditions (C01-C18) from API-RULES-CONDITIONS.md.
 * @module helpers/flatten
 * @package
 */

/**
 * Check if module is self-referential (exports itself under same name).
 * Condition C01 from API-RULES-CONDITIONS.md.
 * @param {object} mod - Module exports
 * @param {string} moduleName - Name of the module
 * @returns {boolean} True if self-referential
 * @private
 */
function flatten_checkSelfReferential(mod, moduleName) {
	if (!mod || typeof mod !== "object") return false;
	return mod[moduleName] === mod;
}

/**
 * Check if this is a multi-default context (multiple default exports in folder).
 * Conditions C02-C03 from API-RULES-CONDITIONS.md.
 * @param {object} analysis - Export analysis
 * @param {boolean} hasMultipleDefaults - Whether folder has multiple defaults
 * @returns {object|null} Multi-default decision or null
 * @private
 */
function flatten_checkMultiDefault(analysis, hasMultipleDefaults) {
	if (!hasMultipleDefaults) return null;

	// C02: Multi-default with default export - preserve namespace
	if (analysis.hasDefault) {
		return {
			preserveAsNamespace: true,
			reason: "Multi-default context with default export"
		};
	}

	// C03: Multi-default without default - flatten
	return {
		flattenToRoot: true,
		reason: "Multi-default context without default export"
	};
}

/**
 * Check if single named export matches filename (auto-flatten case).
 * Condition C04 from API-RULES-CONDITIONS.md.
 * @param {object} mod - Module exports
 * @param {string} moduleName - Name of the module
 * @param {array} moduleKeys - Keys of module exports
 * @returns {boolean} True if should auto-flatten
 * @private
 */
function flatten_checkAutoFlatten(mod, moduleName, moduleKeys) {
	if (moduleKeys.length !== 1) return false;
	return moduleKeys[0] === moduleName;
}

/**
 * Core flattening decision function.
 * Implements conditions C01-C07 from getFlatteningDecision().
 * @param {object} options - Decision options
 * @param {object} options.mod - Module exports
 * @param {string} options.moduleName - Sanitized module name
 * @param {string} options.categoryName - Category/folder name
 * @param {object} options.analysis - Export analysis
 * @param {boolean} options.hasMultipleDefaults - Multiple defaults in folder
 * @param {array} options.moduleKeys - Keys from module
 * @returns {object} Flattening decision
 * @public
 */
export function getFlatteningDecision(options) {
	const { mod, moduleName, categoryName, analysis, hasMultipleDefaults, moduleKeys } = options;

	// C01: Self-referential check - preserve namespace
	if (flatten_checkSelfReferential(mod, moduleName)) {
		return {
			preserveAsNamespace: true,
			reason: "Self-referential export detected"
		};
	}

	// C02-C03: Multi-default context handling
	const multiDefaultDecision = flatten_checkMultiDefault(analysis, hasMultipleDefaults);
	if (multiDefaultDecision) {
		return multiDefaultDecision;
	}

	// C04: Auto-flatten single named export matching filename
	if (flatten_checkAutoFlatten(mod, moduleName, moduleKeys)) {
		return {
			useAutoFlattening: true,
			reason: "Single named export matches filename"
		};
	}

	// C05: Filename matches container - flatten to category
	if (moduleName === categoryName) {
		return {
			flattenToCategory: true,
			reason: "Filename matches category name"
		};
	}

	// C06: Single file context (DEPRECATED/COMMENTED OUT in source)
	// Skipping as per source code

	// C07: Default fallback - preserve as namespace
	return {
		preserveAsNamespace: true,
		reason: "Default behavior - preserve namespace"
	};
}

/**
 * Process module for API assignment.
 * Implements conditions C08-C09b from processModuleForAPI().
 * @param {object} options - Processing options
 * @param {object} options.mod - Module exports
 * @param {object} options.decision - Flattening decision from getFlatteningDecision
 * @param {string} options.apiPathKey - API path key
 * @param {array} options.moduleKeys - Module export keys
 * @param {boolean} options.isSelfReferential - Whether module is self-referential
 * @returns {object} API assignments and metadata
 * @public
 */
export function processModuleForAPI(options) {
	const { mod, decision, apiPathKey, moduleKeys, isSelfReferential } = options;

	const result = {
		apiAssignments: {},
		flattened: false,
		namespaced: false
	};

	// C08: Auto-flattening
	if (decision.useAutoFlattening) {
		result.apiAssignments[apiPathKey] = mod[moduleKeys[0]];
		result.flattened = true;
		return result;
	}

	// C09: Flatten to root/category
	if (decision.flattenToRoot || decision.flattenToCategory) {
		// If there's a default export with no named exports, use the default
		if (mod.default && moduleKeys.length === 0) {
			result.apiAssignments[apiPathKey] = mod.default;
			result.flattened = true;
			return result;
		}

		// If there's both default and named exports, merge named onto default
		if (mod.default && moduleKeys.length > 0) {
			const target = typeof mod.default === "function" ? mod.default : { ...mod.default };
			for (const key of moduleKeys) {
				target[key] = mod[key];
			}
			result.apiAssignments[apiPathKey] = target;
			result.flattened = true;
			return result;
		}

		// Only named exports - merge them
		for (const key of moduleKeys) {
			result.apiAssignments[key] = mod[key];
		}
		result.flattened = true;
		return result;
	}

	// C09a: Self-referential non-function
	if (isSelfReferential) {
		result.apiAssignments[apiPathKey] = mod[apiPathKey] || mod;
		result.namespaced = true;
		return result;
	}

	// Check for single named export matching module name (flatten it)
	if (moduleKeys.length === 1 && moduleKeys[0] === apiPathKey && !mod.default) {
		result.apiAssignments[apiPathKey] = mod[moduleKeys[0]];
		result.flattened = true;
		return result;
	}

	// C09b: Traditional namespace preservation (default)
	// For modules with default export only, use the default
	if (mod.default && moduleKeys.length === 0) {
		result.apiAssignments[apiPathKey] = mod.default;
		result.namespaced = true;
		return result;
	}

	// For modules with only named exports, create namespace
	if (!mod.default && moduleKeys.length > 0) {
		const namespace = {};
		for (const key of moduleKeys) {
			namespace[key] = mod[key];
		}
		result.apiAssignments[apiPathKey] = namespace;
		result.namespaced = true;
		return result;
	}

	// Mixed exports: merge named onto default
	if (mod.default && moduleKeys.length > 0) {
		const target = mod.default;
		for (const key of moduleKeys) {
			target[key] = mod[key];
		}
		result.apiAssignments[apiPathKey] = target;
		result.namespaced = true;
		return result;
	}

	// Fallback
	result.apiAssignments[apiPathKey] = mod;
	result.namespaced = true;
	return result;
}

/**
 * Build category-level flattening decisions.
 * Implements conditions C10-C18 from buildCategoryDecisions().
 * @param {object} options - Category options
 * @param {string} options.categoryName - Category name
 * @param {object} options.mod - Module exports
 * @param {string} options.moduleName - Module name
 * @param {string} options.fileBaseName - File base name
 * @param {object} options.analysis - Export analysis
 * @param {array} options.moduleKeys - Module keys
 * @param {number} options.currentDepth - Current depth
 * @param {array} options.moduleFiles - Files in category
 * @returns {object} Category decision
 * @public
 */
export function buildCategoryDecisions(options) {
	const { categoryName, mod, moduleName, fileBaseName, analysis, moduleKeys, currentDepth, moduleFiles = [] } = options;

	const decision = {
		shouldFlatten: false,
		flattenType: "preserve",
		preferredName: null,
		reason: "No flattening conditions met"
	};

	// C10: Single-file function folder match
	if (moduleName === categoryName && typeof mod === "function" && currentDepth > 0) {
		return {
			shouldFlatten: true,
			flattenType: "function-folder-match",
			reason: "Function name matches folder name"
		};
	}

	// C11: Default export flattening
	if (analysis.hasDefault && analysis.defaultExportType === "object" && moduleName === categoryName && currentDepth > 0) {
		return {
			shouldFlatten: true,
			flattenType: "default-export-flatten",
			reason: "Default object export matches folder name"
		};
	}

	// C12: Object auto-flatten (single named export matching filename)
	if (moduleName === categoryName && mod && typeof mod === "object" && !Array.isArray(mod) && currentDepth > 0) {
		if (moduleKeys.length === 1 && moduleKeys[0] === moduleName) {
			return {
				shouldFlatten: true,
				flattenType: "object-auto-flatten",
				reason: "Single named export matches filename"
			};
		}
	}

	// C13: Filename-folder exact match flattening
	if (fileBaseName === categoryName && moduleKeys.length > 0) {
		return {
			shouldFlatten: true,
			flattenType: "filename-folder-match-flatten",
			reason: "File basename matches category name"
		};
	}

	// C14: Parent-level flattening (generic filenames)
	if (moduleFiles.length === 1 && currentDepth > 0 && mod && typeof mod === "object" && !Array.isArray(mod)) {
		const genericFilenames = ["singlefile", "index", "main", "default"];
		const isGenericFilename = genericFilenames.includes(moduleName.toLowerCase());

		if (moduleKeys.length === 1 && isGenericFilename) {
			return {
				shouldFlatten: true,
				flattenType: "parent-level-flatten",
				reason: "Generic filename with single export"
			};
		}
	}

	// C15: Function name matches folder
	if (typeof mod === "function" && mod.name && currentDepth > 0) {
		const functionNameMatchesFolder =
			mod.name.toLowerCase() === categoryName.toLowerCase() ||
			mod.name.toLowerCase().replace(/[-_]/g, "") === categoryName.toLowerCase().replace(/[-_]/g, "");

		if (functionNameMatchesFolder) {
			return {
				shouldFlatten: true,
				flattenType: "function-folder-match",
				preferredName: mod.name,
				reason: "Function name matches folder name"
			};
		}
	}

	// C16: Function name preference
	if (typeof mod === "function" && mod.name) {
		const functionNameMatchesFilename =
			mod.name.toLowerCase() === moduleName.toLowerCase() ||
			mod.name.toLowerCase().replace(/[-_]/g, "") === moduleName.toLowerCase().replace(/[-_]/g, "");

		if (functionNameMatchesFilename) {
			return {
				shouldFlatten: false,
				preferredName: mod.name,
				reason: "Preserving function name over filename"
			};
		}
	}

	// C17: Default function export flattening
	if (typeof mod === "function" && (!mod.name || mod.name === "default" || mod.__slothletDefault === true) && currentDepth > 0) {
		return {
			shouldFlatten: true,
			flattenType: "default-function",
			preferredName: categoryName,
			reason: "Default function export"
		};
	}

	// C18: Object auto-flatten (final check)
	if (moduleKeys.length === 1 && moduleKeys[0] === moduleName) {
		return {
			shouldFlatten: true,
			flattenType: "object-auto-flatten",
			preferredName: moduleName,
			reason: "Single named export matches module name (final check)"
		};
	}

	return decision;
}
