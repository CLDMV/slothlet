/**
 * @fileoverview Eager mode implementation - loads all modules immediately with unified wrapper
 * @module @cldmv/slothlet/modes/eager
 */
import { SlothletError } from "@cldmv/slothlet/errors";
import { loadModule, scanDirectory, extractExports, mergeExportsIntoAPI } from "@cldmv/slothlet/helpers/loader";
import { sanitizePropertyName } from "@cldmv/slothlet/helpers/sanitize";
import { getFlatteningDecision, processModuleForAPI, buildCategoryDecisions } from "@cldmv/slothlet/helpers/flatten";
import { processRootFiles, applyRootContributor, processDirectory } from "@cldmv/slothlet/helpers/modes";
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
	const rootDefaultFunction = await processRootFiles(api, structure.files, ownership, contextManager, instanceId, config, "eager");

	// Process directories - wrap in unified wrappers for reload support

	for (const directory of structure.directories) {
		const categoryName = sanitizePropertyName(directory.name);
		const categoryObj = {};
		await processDirectory(categoryObj, directory, ownership, contextManager, instanceId, config, 1, "eager");

		// processDirectory creates structure like categoryObj.math = { ... }
		// Extract the actual content (could be object, function, or function with properties)
		const categoryContent = categoryObj[categoryName];

		// Wrap category in unified wrapper (eager mode with immediate __impl)
		const wrapper = new UnifiedWrapper({
			mode: "eager",
			apiPath: categoryName,
			contextManager,
			instanceId,
			initialImpl: categoryContent,
			ownership
		});
		api[categoryName] = wrapper.createProxy();
	}

	// Apply root contributor pattern: if a root function exists, make it THE api
	const finalApi = await applyRootContributor(api, rootDefaultFunction, config, "eager");

	return finalApi;
}
