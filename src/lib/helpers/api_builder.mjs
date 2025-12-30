/**
 *	@Project: @cldmv/slothlet
 *	@Filename: /src/lib/helpers/api_builder.mjs
 *	@Date: 2025-10-27 10:18:09 -07:00 (1761585489)
 *	@Author: Nate Hyson <CLDMV>
 *	@Email: <Shinrai@users.noreply.github.com>
 *	-----
 *	@Last modified by: Nate Hyson <CLDMV> (Shinrai@users.noreply.github.com)
 *	@Last modified time: 2025-12-30 08:54:22 -08:00 (1767113662)
 *	-----
 *	@Copyright: Copyright (c) 2013-2025 Catalyzed Motivation Inc. All rights reserved.
 */

/**
 * @fileoverview Centralized API decision-making system for slothlet (main coordinator module).
 * @module @cldmv/slothlet/src/lib/helpers/api_builder
 * @internal
 * @package
 *
 * @description
 * This module serves as the main coordinator and re-export point for the split API builder modules.
 * The actual functionality is now organized into focused modules:
 *
 * - analysis.mjs: Module analysis and processing
 * - decisions.mjs: Decision-making logic for flattening and structure
 * - construction.mjs: Final API assembly and construction
 * - utilities.mjs: Utility functions for property manipulation and deep merging
 * - add_api.mjs: Dynamic API extension functionality
 *
 * This split maintains the same public API while improving maintainability by organizing
 * related functionality into smaller, more focused files.
 *
 * @example
 * // Import from main module (re-exports from split modules)
 * import { analyzeModule, buildCategoryStructure, addApiFromFolder } from "@cldmv/slothlet/helpers/api_builder";
 */

// Re-export all functions from the split modules (in api_builder/ subfolder)
export {
	isLikelySerializable,
	analyzeModule,
	processModuleFromAnalysis,
	analyzeDirectoryStructure,
	getCategoryBuildingDecisions
} from "@cldmv/slothlet/helpers/api_builder/analysis";

export {
	getFlatteningDecision,
	applyFunctionNamePreference,
	processModuleForAPI,
	buildCategoryDecisions
} from "@cldmv/slothlet/helpers/api_builder/decisions";

export { buildCategoryStructure, buildRootAPI, toapiPathKey, shouldIncludeFile } from "@cldmv/slothlet/helpers/api_builder/construction";

export { safeDefine, deepMerge, mutateLiveBindingFunction } from "@cldmv/slothlet/helpers/api_builder/utilities";

export { addApiFromFolder } from "@cldmv/slothlet/helpers/api_builder/add_api";
