/**
 *	@Project: @cldmv/slothlet
 *	@Filename: /src/lib/processors/flatten.mjs
 *	@Date: 2026-01-24 08:43:52 -08:00 (1737730432)
 *	@Author: Nate Hyson <CLDMV>
 *	@Email: <Shinrai@users.noreply.github.com>
 *	-----
 *	@Last modified by: Nate Hyson <CLDMV> (Shinrai@users.noreply.github.com)
 *	@Last modified time: 2026-02-21 18:31:00 -08:00 (1771727460)
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
	 * @param {function} t - Translation function
	 * @returns {Promise<object|null>} Multi-default decision or null
	 * @private
	 */
	async #checkMultiDefault(analysis, hasMultipleDefaults, t) {
		if (!hasMultipleDefaults) return null;

		// Rule 5 - C02: Multi-default with default export - preserve namespace
		if (analysis.hasDefault) {
			return {
				preserveAsNamespace: true,
				reason: await t("FLATTEN_REASON_MULTI_DEFAULT_WITH_DEFAULT")
			};
		}

		// Rule 5 - C03: Multi-default without default - flatten
		return {
			flattenToRoot: true,
			reason: await t("FLATTEN_REASON_MULTI_DEFAULT_WITHOUT_DEFAULT")
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
	 * @param {function} options.t - Translation function
	 * @returns {Promise<object>} Flattening decision
	 * @public
	 */
	async getFlatteningDecision(options) {
		const { mod, moduleName, categoryName, analysis, hasMultipleDefaults, moduleKeys, t } = options;

		// Rule 11 (F06) - C33: AddApi Special File Pattern
		// Files named addapi.{mjs,cjs,js,ts} always flatten regardless of autoFlatten setting
		const isAddapiFile = moduleName === "addapi";
		if (isAddapiFile) {
			// Check for metadata default export pattern (object default + named exports)
			if (analysis.hasDefault && analysis.defaultExportType === "object" && moduleKeys.length > 0) {
				return {
					flattenToCategory: true,
					flattenType: "addapi-metadata-default",
					reason: await t("FLATTEN_REASON_ADDAPI_METADATA_DEFAULT")
				};
			}
			// Even without metadata pattern, addapi files should always flatten
			return {
				flattenToCategory: true,
				flattenType: "addapi-special-file",
				reason: await t("FLATTEN_REASON_ADDAPI_SPECIAL_FILE")
			};
		}

		// Rule 6 - C01: Self-referential check - preserve namespace
		if (this.#checkSelfReferential(mod, moduleName)) {
			return {
				preserveAsNamespace: true,
				reason: await t("FLATTEN_REASON_SELF_REFERENTIAL")
			};
		}

		// Rule 5 - C02, C03: Multi-default context handling
		const multiDefaultDecision = await this.#checkMultiDefault(analysis, hasMultipleDefaults, t);
		if (multiDefaultDecision) {
			return multiDefaultDecision;
		}

		// Rule 7 (F02, F03) - C04: Auto-flatten single named export matching filename
		if (this.#checkAutoFlatten(mod, moduleName, moduleKeys)) {
			return {
				useAutoFlattening: true,
				reason: await t("FLATTEN_REASON_SINGLE_EXPORT_MATCHES_FILENAME")
			};
		}

		// Rule 1 (F01) - C05: Filename matches container - flatten to category
		if (moduleName === categoryName) {
			return {
				flattenToCategory: true,
				reason: await t("FLATTEN_REASON_FILENAME_MATCHES_CATEGORY")
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
					reason: await t("FLATTEN_REASON_PRESERVING_FUNCTION_NAME")
				};
			}
		}

		// Rule 2 - C06: Single file context (INTENTIONALLY NOT IMPLEMENTED)
		// Architectural decision: Would auto-flatten single file directories, but this reduces
		// API path flexibility. Users should use C05 (filename matching) if they want flattening.

		// Rule 2 - C07: Default fallback - preserve as namespace
		return {
			preserveAsNamespace: true,
			reason: await t("FLATTEN_REASON_DEFAULT_PRESERVE_NAMESPACE")
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
	 * @param {function} options.t - Translation function
	 * @returns {Promise<object>} Category decision
	 * @public
	 */
	async buildCategoryDecisions(options) {
		const { categoryName, mod, moduleName, fileBaseName, analysis, moduleKeys, currentDepth, moduleFiles = [], t } = options;

		const decision = {
			shouldFlatten: false,
			flattenType: "preserve",
			preferredName: null,
			reason: await t("FLATTEN_REASON_NO_CONDITIONS_MET")
		};

		// Rule 11 (F06) - C33: AddApi Special File Pattern
		// Files named addapi.{mjs,cjs,js,ts} always flatten regardless of autoFlatten setting
		const isAddapiFile =
			moduleName === "addapi" ||
			fileBaseName === "addapi" ||
			(fileBaseName && ["addapi.mjs", "addapi.cjs", "addapi.js", "addapi.ts"].includes(fileBaseName.toLowerCase()));
		if (isAddapiFile) {
			// Check for metadata default export pattern (object default + named exports)
			if (analysis.hasDefault && analysis.defaultExportType === "object" && moduleKeys.length > 0) {
				return {
					shouldFlatten: true,
					flattenType: "addapi-metadata-default",
					reason: await t("FLATTEN_REASON_ADDAPI_SPECIAL_FILE_PARENT")
				};
			}
			// Even without metadata pattern, addapi files should always flatten
			return {
				shouldFlatten: true,
				flattenType: "addapi-special-file",
				reason: await t("FLATTEN_REASON_ADDAPI_SPECIAL_FILE")
			};
		}

		// Rule 2, Rule 3 - C10: Single-file function folder match
		if (moduleName === categoryName && typeof mod === "function" && currentDepth > 0) {
			return {
				shouldFlatten: true,
				flattenType: "function-folder-match",
				reason: await t("FLATTEN_REASON_FUNCTION_FOLDER_MATCH")
			};
		}

		// Rule 4, Rule 8 (F02, F04, F05) - C11: Default export flattening
		if (analysis.hasDefault && analysis.defaultExportType === "object" && moduleName === categoryName && currentDepth > 0) {
			return {
				shouldFlatten: true,
				flattenType: "default-export-flatten",
				reason: await t("FLATTEN_REASON_DEFAULT_OBJECT_EXPORT_FLATTEN")
			};
		}

		// Rule 7 (F02, F03) - C12: Object auto-flatten (single named export matching filename)
		if (moduleName === categoryName && mod && typeof mod === "object" && !Array.isArray(mod) && currentDepth > 0) {
			if (moduleKeys.length === 1 && moduleKeys[0] === moduleName) {
				return {
					shouldFlatten: true,
					flattenType: "object-auto-flatten",
					reason: await t("FLATTEN_REASON_SINGLE_EXPORT_MATCHES_FILENAME")
				};
			}
		}

		// Rule 1, Rule 2 (F01) - C13: Filename-folder exact match flattening
		if (fileBaseName === categoryName && moduleKeys.length > 0) {
			return {
				shouldFlatten: true,
				flattenType: "filename-folder-match-flatten",
				reason: await t("FLATTEN_REASON_BASENAME_MATCHES_CATEGORY")
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
					reason: await t("FLATTEN_REASON_GENERIC_FILENAME_SINGLE_EXPORT")
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
					reason: await t("FLATTEN_REASON_FUNCTION_FOLDER_MATCH")
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
					reason: await t("FLATTEN_REASON_PRESERVING_FUNCTION_NAME")
				};
			}
		}

		// Rule 4, Rule 8 (F02, F04, F05) - C17: Default function export flattening
		if (typeof mod === "function" && (!mod.name || mod.name === "default" || mod.__slothletDefault === true) && currentDepth > 0) {
			return {
				shouldFlatten: true,
				flattenType: "default-function",
				preferredName: categoryName,
				reason: await t("FLATTEN_REASON_DEFAULT_FUNCTION_EXPORT")
			};
		}

		// Rule 7 (F02, F03) - C18: Object auto-flatten (final check)
		if (moduleKeys.length === 1 && moduleKeys[0] === moduleName) {
			return {
				shouldFlatten: true,
				flattenType: "object-auto-flatten",
				preferredName: moduleName,
				reason: await t("FLATTEN_REASON_SINGLE_EXPORT_MATCHES_MODULE")
			};
		}

		return decision;
	}

	/**
	 * Decide whether a named export should be attached to a callable default export.
	 *
	 * Returns false when the named export is the same reference as the default (re-export
	 * pattern), or when the export key matches the function name (self-referential export).
	 *
	 * @param {string} key - Named export key.
	 * @param {unknown} value - Named export value.
	 * @param {Function} defaultFunc - Wrapped callable default export.
	 * @param {Function} originalDefault - Original default export.
	 * @returns {boolean} True if the export should be attached.
	 * @public
	 */
	shouldAttachNamedExport(key, value, defaultFunc, originalDefault) {
		if (!key || key === "default") {
			return false;
		}
		if (value === defaultFunc || value === originalDefault) {
			return false;
		}
		if (typeof defaultFunc === "function" && key === defaultFunc.name) {
			return false;
		}
		if (typeof originalDefault === "function" && key === originalDefault.name) {
			return false;
		}
		return true;
	}
}
