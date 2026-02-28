/**
 *	@Project: @cldmv/slothlet
 *	@Filename: /src/lib/processors/flatten.mjs
 *	@Date: 2026-01-24 08:43:52 -08:00 (1737730432)
 *	@Author: Nate Hyson <CLDMV>
 *	@Email: <Shinrai@users.noreply.github.com>
 *	-----
 *	@Last modified by: Nate Hyson <CLDMV> (Shinrai@users.noreply.github.com)
 *	@Last modified time: 2026-02-27 16:39:11 -08:00 (1772239151)
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
			// Rule 9 still applies even in multi-default context: if the function has an explicit
			// name that differs in casing from the sanitized filename, preserve it as preferredName.
			if (multiDefaultDecision.preserveAsNamespace) {
				const exportToCheck = typeof mod === "function" ? mod : mod?.default && typeof mod.default === "function" ? mod.default : null;
				if (exportToCheck && exportToCheck.name && exportToCheck.name !== "default") {
					const normalizedFunctionName = exportToCheck.name.toLowerCase().replace(/[-_]/g, "");
					const normalizedModuleName = moduleName.toLowerCase().replace(/[-_]/g, "");
					if (normalizedFunctionName === normalizedModuleName) {
						multiDefaultDecision.preferredName = exportToCheck.name;
					}
				}
			}
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
	 * Build module content for API assignment.
	 *
	 * Canonical implementation of the C08-C09b content-building rules, including
	 * AddApi detection and collision handling. Previously this logic was inlined
	 * inside modes-processor.mjs; it now lives here so the processor stays focused
	 * on wrapping and assignment concerns only.
	 *
	 * Collision config, modesUtils helpers, and SlothletWarning are accessed
	 * directly through {@link this.slothlet} / {@link this.slothlet.config} — no caller
	 * plumbing required.
	 *
	 * @param {object}   options                              - Processing options.
	 * @param {object}   options.mod                         - Module exports.
	 * @param {object}   options.decision                    - Flattening decision from getFlatteningDecision.
	 * @param {string}   options.moduleName                  - Sanitized module name (used for C08 auto-flatten key lookup).
	 * @param {string}   options.propertyName                - Resolved preferred name (decision.preferredName || moduleName).
	 * @param {string[]} options.moduleKeys                  - Named export keys (excluding "default").
	 * @param {object}   options.analysis                    - { hasDefault, hasNamed, defaultExportType }.
	 * @param {object}   [options.file=null]                 - File descriptor for AddApi detection via file.name / file.fullName.
	 * @param {string}   [options.collisionContext="initial"] - Collision context ("initial" | "api").
	 * @param {string}   [options.apiPathPrefix=""]          - API path prefix for collision error messages.
	 * @returns {{ moduleContent: object|Function }} Built module content ready for wrapping/assignment.
	 * @public
	 */
	processModuleForAPI(options) {
		const {
			mod,
			decision,
			moduleName,
			propertyName,
			moduleKeys,
			analysis,
			file = null,
			collisionContext = "initial",
			apiPathPrefix = "",
			isSelfReferential = false
		} = options;

		// Rule 11 (F06) - C33: AddApi Special File Pattern
		// When addapi.{mjs,cjs,js,ts} has a default export + named exports,
		// use the default as the namespace base and merge named exports onto it.
		const isAddapiFile =
			moduleName === "addapi" ||
			(file && file.name === "addapi") ||
			(file && file.fullName && ["addapi.mjs", "addapi.cjs", "addapi.js", "addapi.ts"].includes(file.fullName.toLowerCase()));
		if (isAddapiFile && analysis.hasDefault && moduleKeys.length > 0) {
			const moduleContent = mod.default;
			for (const key of moduleKeys) {
				moduleContent[key] = mod[key];
			}
			return { moduleContent };
		}

		// Rule 7 (F02, F03) - C08: Auto-flattening (single named export matching module name)
		if (decision.useAutoFlattening) {
			return { moduleContent: mod[moduleName] };
		}

		// Rule 1 (F01) - C09: Flatten to root/category — merge all exports into one flat content object for caller to assign
		if (decision.flattenToRoot || decision.flattenToCategory) {
			if (mod.default && moduleKeys.length === 0) {
				return { moduleContent: mod.default };
			}
			if (mod.default && moduleKeys.length > 0) {
				const moduleContent = typeof mod.default === "function" ? mod.default : { ...mod.default };
				for (const key of moduleKeys) {
					moduleContent[key] = mod[key];
				}
				return { moduleContent };
			}
			// Only named exports: expose each directly (caller merges to parent)
			const moduleContent = {};
			for (const key of moduleKeys) {
				moduleContent[key] = mod[key];
			}
			return { moduleContent };
		}

		// Rule 6 - C09a: Self-referential non-function — use the named export that is itself (or full mod)
		if (isSelfReferential) {
			return { moduleContent: mod[moduleName] || mod };
		}

		// Hybrid pattern: default + named exports
		if (mod.default && moduleKeys.length > 0) {
			if (typeof mod.default === "function") {
				// Default is a function: attach named exports as properties (e.g. logger(), logger.info())
				const moduleContent = this.slothlet.helpers.modesUtils.ensureNamedExportFunction(mod.default, propertyName);
				const collisionConfig = this.slothlet.config.api?.collision || this.slothlet.config.collision;
				const collisionMode = (collisionContext === "initial" ? collisionConfig?.initial : collisionConfig?.api) || "merge";
				for (const key of moduleKeys) {
					if (!this.shouldAttachNamedExport(key, mod[key], moduleContent, mod.default)) {
						continue;
					}
					const hasExisting = Object.prototype.hasOwnProperty.call(moduleContent, key);
					if (hasExisting) {
						if (collisionMode === "merge" || collisionMode === "skip") {
							// Keep the existing property from the default export
							continue;
						} else if (collisionMode === "error") {
							throw new this.slothlet.SlothletError(
								"COLLISION_DEFAULT_EXPORT_ERROR",
								{
									key,
									apiPath: `${apiPathPrefix}.${propertyName}`
								},
								null,
								{ validationError: true }
							);
						} else if (collisionMode === "warn") {
							new this.slothlet.SlothletWarning("WARNING_COLLISION_DEFAULT_EXPORT_OVERWRITE", {
								key,
								apiPath: `${apiPathPrefix}.${propertyName}`
							});
						}
						// collisionMode "replace" / "merge-replace" — fall through to assignment
					}
					moduleContent[key] = mod[key];
				}
				return { moduleContent };
			}
			if (typeof mod.default === "object" && mod.default !== null) {
				// Default is an object: use it directly and add named exports not already present
				const moduleContent = mod.default;
				for (const key of moduleKeys) {
					if (key in mod.default) {
						continue;
					}
					if (!this.shouldAttachNamedExport(key, mod[key], moduleContent, mod.default)) {
						continue;
					}
					moduleContent[key] = mod[key];
				}
				return { moduleContent };
			}
			// Default is a primitive: wrap in a namespace object
			const moduleContent = { default: mod.default };
			for (const key of moduleKeys) {
				moduleContent[key] = mod[key];
			}
			return { moduleContent };
		}

		// Rule 1 (F01), Rule 2 - C09b: Traditional namespace preservation — only default export, use it directly
		if (mod.default && moduleKeys.length === 0) {
			return { moduleContent: this.slothlet.helpers.modesUtils.ensureNamedExportFunction(mod.default, propertyName) };
		}

		// Fallback: named-only or mixed (non-function) default + named
		const moduleContent = {};
		if (mod.default) moduleContent.default = mod.default;
		for (const key of moduleKeys) {
			moduleContent[key] = mod[key];
		}
		return { moduleContent };
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
