/**
 * @fileoverview Eager mode implementation - loads all modules immediately with unified wrapper
 * @module @cldmv/slothlet/modes/eager
 */
import { SlothletError } from "@cldmv/slothlet/errors";
import { loadModule, scanDirectory, extractExports, mergeExportsIntoAPI } from "@cldmv/slothlet/processors/loader";
import { sanitizePropertyName } from "@cldmv/slothlet/helpers/sanitize";
import { getFlatteningDecision, processModuleForAPI, buildCategoryDecisions } from "@cldmv/slothlet/processors/flatten";
import { UnifiedWrapper } from "@cldmv/slothlet/handlers/unified-wrapper";
import { t } from "@cldmv/slothlet/i18n";
import path from "node:path";

/**
 * Build API in eager mode (load all modules immediately)
 * @param {Object} options - Build options
 * @param {string} options.dir - Directory path to load from
 * @param {Object} options.ownership - Ownership manager
 * @param {Object} options.contextManager - Context manager for binding
 * @param {string} options.instanceID - Slothlet instance ID
 * @param {Object} options.config - Configuration
 * @param {number} [options.maxDepth=Infinity] - Maximum depth for directory traversal
 * @param {string} [options.apiPathPrefix=""] - Prefix for API paths
 * @returns {Promise<Object>} Built API object
 * @public
 */
export async function buildEagerAPI({
	dir,
	ownership,
	contextManager,
	instanceID,
	config = {},
	maxDepth = Infinity,
	apiPathPrefix = "",
	collisionContext = "initial",
	modesProcessor
}) {
	const api = {};

	// Scan directory structure
	const structure = await scanDirectory(dir);

	// Process root files (with root contributor pattern support)
	// Pass synthetic root directory with children.directories for consistent handling
	const rootDirectory = {
		name: ".",
		children: {
			files: structure.files,
			directories: structure.directories
		}
	};
	const rootDefaultFunction = await modesProcessor.processFiles(
		api,
		structure.files,
		rootDirectory,
		ownership,
		contextManager,
		instanceID,
		config,
		0,
		"eager",
		true, // isRoot
		true, // recursive - MUST be true to process subdirectories!
		false, // populateDirectly - keep false
		apiPathPrefix,
		collisionContext
	);

	// Directory processing is now handled by processFiles when recursive=true

	// Apply root contributor pattern: if a root function exists, make it THE api
	const finalApi = await modesProcessor.applyRootContributor(api, rootDefaultFunction, config, "eager");

	return finalApi;
}
