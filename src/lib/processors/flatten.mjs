/**
 *	@Project: @cldmv/slothlet
 *	@Filename: /src/lib/processors/flatten.mjs
 *	@Date: 2026-01-24 08:43:52 -08:00 (1737730432)
 *	@Author: Nate Hyson <CLDMV>
 *	@Email: <Shinrai@users.noreply.github.com>
 *	-----
 *	@Last modified by: Nate Hyson <CLDMV> (Shinrai@users.noreply.github.com)
 *	@Last modified time: 2026-02-04 00:00:00 -08:00 (1770192000)
 *	-----
 *	@Copyright: Copyright (c) 2013-2026 Catalyzed Motivation Inc. All rights reserved.
 */

/**
 * Flattening decision module.
 * @description
 * Provides the Flatten class for determining when and how to flatten API structures
 * based on comprehensive rule set. Implements 18 core conditions (C01-C18) from
 * API-RULES-CONDITIONS.md. Extends ComponentBase for access to Slothlet configuration.
 * @module processors/flatten
 * @package
 * @example
 * // Flatten is instantiated by Slothlet and passed to processors
 * const flatten = new Flatten(slothlet);
 * const decision = flatten.getFlatteningDecision(options);
 * const categoryDecisions = flatten.buildCategoryDecisions(options);
 */
import { ComponentBase } from "@cldmv/slothlet/factories/component-base";

/**
 * Flattening decision processor
 * @class Flatten
 * @extends ComponentBase
 * @package
 */
export class Flatten extends ComponentBase {
	static slothletProperty = "flatten";

	/**
	 * Create a Flatten instance
	 * @param {Object} slothlet - Slothlet instance
	 */
	constructor(slothlet) {
		super(slothlet);
	}

	/**
	 * Check if module is self-referential (exports itself under same name).
	 * Rule 6 - Condition C01 from API-RULES-CONDITIONS.md.
	 * @param {object} mod - Module exports
	 * @param {string} moduleName - Name of the module
	 * @returns {boolean} True if self-referential
	 * @private
	 */
	#checkSelfReferential(mod, moduleName) {
		if (!mod || typeof mod !== "object") return false;
		return mod[moduleName] === mod;
	}

	/**
	 * Check if this is a multi-default context (multiple default exports in folder).
	 * Rule 5 - Conditions C02-C03 from API-RULES-CONDITIONS.md.
	 * @param {object} analysis - Export analysis
	 * @param {boolean} hasMultipleDefaults - Whether folder has multiple defaults
	 * @returns {object|null} Multi-default decision or null
	 * @private
	 */
	#checkMultiDefault(analysis, hasMultipleDefaults) {
		if (!hasMultipleDefaults) return null;

		// Rule 5 - C02: Multi-default with default export - preserve namespace
		if (analysis.hasDefault) {
			return {
				preserveAsNamespace: true,
				reason: "Multi-default context with default export"
			};
		}

		// Rule 5 - C03: Multi-default without default - flatten
		return {
			flattenToRoot: true,
			reason: "Multi-default context without default export"
		};
	}

	/**
	 * Check if single named export matches filename (auto-flatten case).
	 * Rule 7 (F02, F03) - Condition C04 from API-RULES-CONDITIONS.md.
	 * @param {object} mod - Module exports
	 * @param {string} moduleName - Name of the module
	 * @param {array} moduleKeys - Keys of module exports
	 * @returns {boolean} True if should auto-flatten
	 * @private
	 */
	#checkAutoFlatten(mod, moduleName, moduleKeys) {
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
	getFlatteningDecision(options) {
		const { mod, moduleName, categoryName, analysis, hasMultipleDefaults, moduleKeys } = options;

		// Rule 6 - C01: Self-referential check - preserve namespace
		if (this.#checkSelfReferential(mod, moduleName)) {
			return {
				preserveAsNamespace: true,
				reason: "Self-referential export detected"
			};
		}

		// Rule 5 - C02, C03: Multi-default context handling
		const multiDefaultDecision = this.#checkMultiDefault(analysis, hasMultipleDefaults);
		if (multiDefaultDecision) {
			return multiDefaultDecision;
		}

		// Rule 7 (F02, F03) - C04: Auto-flatten single named export matching filename
		if (this.#checkAutoFlatten(mod, moduleName, moduleKeys)) {
			return {
				useAutoFlattening: true,
				reason: "Single named export matches filename"
			};
		}

		// Rule 1 (F01) - C05: Filename matches container - flatten to category
		if (moduleName === categoryName) {
			return {
				flattenToCategory: true,
				reason: "Filename matches category name"
			};
		}

		// Rule 4, Rule 9 - C16: Function name preference (check before default fallback)
		// When function/export name matches filename (case-insensitive), preserve exact casing
		const exportToCheck = typeof mod === "function" ? mod : mod?.default && typeof mod.default === "function" ? mod.default : null;

		if (exportToCheck && exportToCheck.name && exportToCheck.name !== "default") {
			// Check if function name relates to filename (case-insensitive, ignoring separators)
			const normalizedFunctionName = exportToCheck.name.toLowerCase().replace(/[-_]/g, "");
			const normalizedModuleName = moduleName.toLowerCase().replace(/[-_]/g, "");
			const functionNameMatchesFilename = normalizedFunctionName === normalizedModuleName;

			// Rule 9: Use exact function name to preserve casing (XMLParser vs xmlParser, getHTTPStatus vs getHttpStatus)
			if (functionNameMatchesFilename) {
				return {
					preserveAsNamespace: true,
					preferredName: exportToCheck.name, // Use exact function name
					reason: "Preserving function name over filename"
				};
			}
		}

		// Rule 2 - C06: Single file context (INTENTIONALLY NOT IMPLEMENTED)
		// Architectural decision: Would auto-flatten single file directories, but this reduces
		// API path flexibility. Users should use C05 (filename matching) if they want flattening.

		// Rule 2 - C07: Default fallback - preserve as namespace
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
	processModuleForAPI(options) {
		const { mod, decision, apiPathKey, moduleKeys, isSelfReferential } = options;

		const result = {
			apiAssignments: {},
			flattened: false,
			namespaced: false
		};

		// Rule 7 (F02, F03) - C08: Auto-flattening
		if (decision.useAutoFlattening) {
			result.apiAssignments[apiPathKey] = mod[moduleKeys[0]];
			result.flattened = true;
			return result;
		}

		// Rule 1 (F01) - C09: Flatten to root/category
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

		// Rule 6 - C09a: Self-referential non-function
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

		// Rule 1 (F01), Rule 2 - C09b: Traditional namespace preservation (default)
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
	 * Implements conditions C10-C33 from buildCategoryDecisions().
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
	buildCategoryDecisions(options) {
		const { categoryName, mod, moduleName, fileBaseName, analysis, moduleKeys, currentDepth, moduleFiles = [] } = options;

		const decision = {
			shouldFlatten: false,
			flattenType: "preserve",
			preferredName: null,
			reason: "No flattening conditions met"
		};

		// Rule 11 (F06) - C33: AddApi Special File Pattern
		// Files named addapi.{mjs,cjs,js,ts} always flatten regardless of autoFlatten setting
		const isAddapiFile = moduleName === "addapi" || fileBaseName === "addapi" || 
			(fileBaseName && ["addapi.mjs", "addapi.cjs", "addapi.js", "addapi.ts"].includes(fileBaseName.toLowerCase()));
		if (isAddapiFile) {
			// Check for metadata default export pattern (object default + named exports)
			if (analysis.hasDefault && analysis.defaultExportType === "object" && moduleKeys.length > 0) {
				return {
					shouldFlatten: true,
					flattenType: "addapi-metadata-default",
					reason: "AddApi special file pattern with metadata default - flatten named exports to parent"
				};
			}
			// Even without metadata pattern, addapi files should always flatten
			return {
				shouldFlatten: true,
				flattenType: "addapi-special-file",
				reason: "AddApi special file pattern - always flatten"
			};
		}

		// Rule 3 - C10: Single-file function folder match
		if (moduleName === categoryName && typeof mod === "function" && currentDepth > 0) {
			return {
				shouldFlatten: true,
				flattenType: "function-folder-match",
				reason: "Function name matches folder name"
			};
		}

		// Rule 8 (F02, F04, F05) - C11: Default export flattening
		if (analysis.hasDefault && analysis.defaultExportType === "object" && moduleName === categoryName && currentDepth > 0) {
			return {
				shouldFlatten: true,
				flattenType: "default-export-flatten",
				reason: "Default object export matches folder name"
			};
		}

		// Rule 7 (F02, F03) - C12: Object auto-flatten (single named export matching filename)
		if (moduleName === categoryName && mod && typeof mod === "object" && !Array.isArray(mod) && currentDepth > 0) {
			if (moduleKeys.length === 1 && moduleKeys[0] === moduleName) {
				return {
					shouldFlatten: true,
					flattenType: "object-auto-flatten",
					reason: "Single named export matches filename"
				};
			}
		}

		// Rule 1 (F01) - C13: Filename-folder exact match flattening
		if (fileBaseName === categoryName && moduleKeys.length > 0) {
			return {
				shouldFlatten: true,
				flattenType: "filename-folder-match-flatten",
				reason: "File basename matches category name"
			};
		}

		// Rule 10 (F02) - C14: Parent-level flattening (generic filenames)
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

		// Rule 9 - C15: Function name matches folder
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

		// Rule 4, Rule 9 - C16: Function name preference
		// Always prefer function name over sanitized filename when function name exists
		const exportToCheck = typeof mod === "function" ? mod : mod?.default && typeof mod.default === "function" ? mod.default : null;

		if (exportToCheck && exportToCheck.name && exportToCheck.name !== "default") {
			// Check if function name relates to filename (case-insensitive, ignoring separators)
			const normalizedFunctionName = exportToCheck.name.toLowerCase().replace(/[-_]/g, "");
			const normalizedModuleName = moduleName.toLowerCase().replace(/[-_]/g, "");
			const functionNameMatchesFilename = normalizedFunctionName === normalizedModuleName;

			// Rule 9: Always use function name to preserve casing (XMLParser vs xmlParser)
			if (functionNameMatchesFilename) {
				return {
					shouldFlatten: false,
					preferredName: exportToCheck.name, // Use exact function name (preserves XMLParser, getHTTPStatus, etc.)
					reason: "Preserving function name over filename"
				};
			}
		}

		// Rule 8 (F02, F04, F05) - C17: Default function export flattening
		if (typeof mod === "function" && (!mod.name || mod.name === "default" || mod.__slothletDefault === true) && currentDepth > 0) {
			return {
				shouldFlatten: true,
				flattenType: "default-function",
				preferredName: categoryName,
				reason: "Default function export"
			};
		}

		// Rule 7 (F02, F03) - C18: Object auto-flatten (final check)
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
}
