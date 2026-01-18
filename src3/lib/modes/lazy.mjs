/**
 * @fileoverview Lazy mode implementation - deferred loading with unified wrapper
 * @module @cldmv/slothlet/modes/lazy
 */
import { loadModule, scanDirectory, extractExports, mergeExportsIntoAPI } from "@cldmv/slothlet/helpers/loader";
import { sanitizePropertyName } from "@cldmv/slothlet/helpers/sanitize";
import { processRootFiles, applyRootContributor } from "@cldmv/slothlet/helpers/modes";
import { UnifiedWrapper } from "@cldmv/slothlet/handlers/unified-wrapper";

/**
 * Build API in lazy mode (proxy-based deferred loading)
 * @param {Object} options - Build options
 * @param {string} options.dir - Directory to build from
 * @param {Object} options.ownership - Ownership manager
 * @param {Object} options.contextManager - Context manager for binding
 * @param {string} options.instanceId - Slothlet instance ID
 * @param {Object} [options.config={}] - Configuration
 * @returns {Promise<Object>} Built API object with lazy proxies
 * @public
 */
export async function buildLazyAPI({ dir, ownership, contextManager, instanceId, config = {} }) {
	const api = {};

	// Scan directory structure
	const structure = await scanDirectory(dir);

	// Process root files (with root contributor pattern support)
	const rootDefaultFunction = await processRootFiles(api, structure.files, ownership, contextManager, instanceId, config, "lazy");

	// Create unified wrappers for directories (with lazy materialization)
	for (const directory of structure.directories) {
		const propName = sanitizePropertyName(directory.name);
		api[propName] = createLazyWrapper(directory, ownership, contextManager, instanceId, propName, config);
	}

	// Apply root contributor pattern: if a root function exists, make it THE api
	const finalApi = await applyRootContributor(api, rootDefaultFunction, config, "lazy");

	return finalApi;
}

/**
 * Create lazy wrapper using UnifiedWrapper
 * @param {Object} dir - Directory structure
 * @param {Object} ownership - Ownership manager
 * @param {Object} contextManager - Context manager
 * @param {string} instanceId - Instance ID
 * @param {string} apiPath - Current API path
 * @param {Object} config - Configuration
 * @returns {Proxy} Lazy unified wrapper
 * @private
 */
function createLazyWrapper(dir, ownership, contextManager, instanceId, apiPath, config) {
	// Create materialization function
	async function materializeFunc(wrapper) {
		const materialized = {};

		// Load files in directory
		for (const file of dir.children.files) {
			const mod = await loadModule(file.path);
			const exports = extractExports(mod);
			const moduleName = sanitizePropertyName(file.name);

			// Register ownership
			if (ownership) {
				ownership.register({
					moduleId: file.moduleId,
					apiPath: `${apiPath}.${moduleName}`,
					source: "core"
				});
			}

			// Merge exports into materialized object
			mergeExportsIntoAPI(materialized, exports, moduleName);
		}

		// Create lazy wrappers for subdirectories
		for (const subdir of dir.children.directories || []) {
			const propName = sanitizePropertyName(subdir.name);
			materialized[propName] = createLazyWrapper(subdir, ownership, contextManager, instanceId, `${apiPath}.${propName}`, config);
		}

		// Set the materialized implementation
		wrapper.__setImpl(materialized);
	}

	// Create unified wrapper in lazy mode
	const wrapper = new UnifiedWrapper({
		mode: "lazy",
		apiPath,
		contextManager,
		instanceId,
		initialImpl: null, // Lazy mode starts with null
		materializeFunc,
		ownership
	});

	return wrapper.createProxy();
}
