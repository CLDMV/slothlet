/**
 *	@Project: @cldmv/slothlet
 *	@Filename: /src/lib/helpers/api_builder.mjs
 *	@Date: 2025-10-27 10:18:09 -07:00 (1761585489)
 *	@Author: Nate Hyson <CLDMV>
 *	@Email: <Shinrai@users.noreply.github.com>
 *	-----
 *	@Last modified by: Nate Hyson <CLDMV> (Shinrai@users.noreply.github.com)
 *	@Last modified time: 2025-12-29 00:00:00 -08:00
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
 * The actual functionality is now organized into three focused modules:
 *
 * - api_builder_analysis.mjs: Module analysis and processing
 * - api_builder_decisions.mjs: Decision-making logic for flattening and structure
 * - api_builder_construction.mjs: Final API assembly and construction
 *
 * This split maintains the same public API while improving maintainability by organizing
 * related functionality into smaller, more focused files.
 *
 * @example
 * // Import from main module (re-exports from split modules)
 * import { analyzeModule, buildCategoryStructure } from "@cldmv/slothlet/helpers/api_builder";
 */

// Re-export all functions from the split modules (in api_builder/ subfolder)
export {
	isLikelySerializable,
	analyzeModule,
	processModuleFromAnalysis,
	analyzeDirectoryStructure,
	getCategoryBuildingDecisions
} from "./api_builder/analysis.mjs";

export {
	getFlatteningDecision,
	applyFunctionNamePreference,
	processModuleForAPI,
	buildCategoryDecisions
} from "./api_builder/decisions.mjs";

export { buildCategoryStructure, buildRootAPI, toapiPathKey, shouldIncludeFile } from "./api_builder/construction.mjs";
