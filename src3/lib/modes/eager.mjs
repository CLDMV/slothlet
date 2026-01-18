/**
 * @fileoverview Eager mode implementation - loads all modules immediately with unified wrapper
 * @module @cldmv/slothlet/modes/eager
 */
import { SlothletError } from "@cldmv/slothlet/errors";
import { loadModule, scanDirectory, extractExports, mergeExportsIntoAPI } from "@cldmv/slothlet/helpers/loader";
import { sanitizePropertyName } from "@cldmv/slothlet/helpers/sanitize";
import { getFlatteningDecision, processModuleForAPI, buildCategoryDecisions } from "@cldmv/slothlet/helpers/flatten";
import { processFiles, applyRootContributor } from "@cldmv/slothlet/helpers/modes";
import { UnifiedWrapper } from "@cldmv/slothlet/handlers/unified-wrapper";
import { t } from "@cldmv/slothlet/i18n";
import path from "node:path";

/**
 * Build API in eager mode (load all modules immediately)
 * @param {Object} options - Build options
 * @param {string} options.dir - Directory path to load from
 * @param {Object} options.ownership - Ownership manager
 * @param {Object} options.contextManager - Context manager for binding
 * @param {string} options.instanceId - Slothlet instance ID
 * @param {Object} options.config - Configuration
 * @param {number} [options.maxDepth=Infinity] - Maximum depth for directory traversal
 * @returns {Promise<Object>} Built API object
 * @public
 */
export async function buildEagerAPI({ dir, ownership, contextManager, instanceId, config = {}, maxDepth = Infinity }) {
	const api = {};

	// Scan directory structure
	const structure = await scanDirectory(dir);

	// Process root files (with root contributor pattern support)
	const rootDefaultFunction = await processFiles(
		api,
		structure.files,
		null,
		ownership,
		contextManager,
		instanceId,
		config,
		0,
		"eager",
		true,
		true
	);

	// Process directories (eager mode - recursive)
	for (const directory of structure.directories) {
		const categoryName = sanitizePropertyName(directory.name);
		api[categoryName] = api[categoryName] || {};
		await processFiles(api, directory.children.files, directory, ownership, contextManager, instanceId, config, 1, "eager", false, true);
	}

	// Apply root contributor pattern: if a root function exists, make it THE api
	const finalApi = await applyRootContributor(api, rootDefaultFunction, config, "eager");

	return finalApi;
}
