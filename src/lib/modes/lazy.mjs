/**
 * @fileoverview Lazy mode implementation - deferred loading with unified wrapper
 * @module @cldmv/slothlet/modes/lazy
 */
import { loadModule, scanDirectory, extractExports, mergeExportsIntoAPI } from "@cldmv/slothlet/helpers/loader";
import { sanitizePropertyName } from "@cldmv/slothlet/helpers/sanitize";
import { processFiles, applyRootContributor, createLazySubdirectoryWrapper } from "@cldmv/slothlet/helpers/modes";
import { UnifiedWrapper } from "@cldmv/slothlet/handlers/unified-wrapper";

/**
 * Create a named async materialization function for clearer debug output.
 * @param {string} apiPath - API path to derive the function name from.
 * @param {function} handler - Async handler that performs materialization.
 * @returns {function} Named async materialization function.
 */
function createNamedMaterializeFunc(apiPath, handler) {
	const safePath = String(apiPath || "api")
		.replace(/\./g, "__")
		.replace(/[^A-Za-z0-9_$]/g, "_");
	const normalized = safePath && /^[A-Za-z_$]/.test(safePath[0]) ? safePath : safePath ? `_${safePath}` : "api";
	const funcName = `${normalized}__lazy_materializeFunc`;
	return {
		[funcName]: async function (...args) {
			return handler(...args);
		}
	}[funcName];
}

/**
 * Build API in lazy mode (proxy-based deferred loading)
 * @param {Object} options - Build options
 * @param {string} options.dir - Directory to build from
 * @param {Object} options.ownership - Ownership manager
 * @param {Object} options.contextManager - Context manager for binding
 * @param {string} options.instanceID - Slothlet instance ID
 * @param {Object} [options.config={}] - Configuration
 * @returns {Promise<Object>} Built API object with lazy proxies
 * @public
 */
export async function buildLazyAPI({ dir, ownership, contextManager, instanceID, config = {} }) {
	const api = {};

	// Scan directory structure
	const structure = await scanDirectory(dir);

	// Process root files (with root contributor pattern support)
	// Pass synthetic root directory with children.directories so processFiles can create lazy wrappers
	const rootDirectory = {
		name: ".",
		children: {
			files: structure.files,
			directories: structure.directories
		}
	};
	const rootDefaultFunction = await processFiles(
		api,
		structure.files,
		rootDirectory,
		ownership,
		contextManager,
		instanceID,
		config,
		0,
		"lazy",
		true,
		false
	);

	// Lazy wrappers for directories are now created by processFiles when recursive=false

	// Apply root contributor pattern: if a root function exists, make it THE api
	const finalApi = await applyRootContributor(api, rootDefaultFunction, config, "lazy");

	return finalApi;
}

/**
 * Create lazy wrapper using UnifiedWrapper
 * @param {Object} dir - Directory structure
 * @param {Object} ownership - Ownership manager
 * @param {Object} contextManager - Context manager
 * @param {string} instanceID - Instance ID
 * @param {string} apiPath - Current API path
 * @param {Object} config - Configuration
 * @returns {Proxy} Lazy unified wrapper
 * @private
 */
function createLazyWrapper(dir, ownership, contextManager, instanceID, apiPath, config) {
	// Create materialization function (POC pattern: returns implementation, no wrapper param)
	const materializeFunc = createNamedMaterializeFunc(apiPath, async () => {
		if (config.debug?.modes) {
			console.log(`[LAZY.MJS materializeFunc] START for apiPath=${apiPath}, dir=${dir.name}`);
		}
		const materialized = {};

		// Load files in directory
		for (const file of dir.children.files) {
			try {
				if (config.debug?.modes) {
					console.log(`[LAZY.MJS] Loading file: ${file.name} from ${file.path}`);
				}
				const mod = await loadModule(file.path);
				if (config.debug?.modes) {
					console.log(`[LAZY.MJS] Loaded file: ${file.name}, extracting exports...`);
				}
				const exports = extractExports(mod);
				if (config.debug?.modes) {
					console.log(`[LAZY.MJS] Extracted exports for ${file.name}:`, Object.keys(exports));
				}
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
				if (config.debug?.modes) {
					console.log(`[LAZY.MJS] Merging exports for ${file.name} into materialized...`);
				}
				mergeExportsIntoAPI(materialized, exports, moduleName);
				if (config.debug?.modes) {
					console.log(`[LAZY.MJS] Merged exports for ${file.name}, materialized keys now:`, Object.keys(materialized));
				}
			} catch (error) {
				console.error(`[LAZY.MJS] ERROR loading ${file.name}:`, error.message);
				throw error;
			}
		}

		// Create lazy wrappers for subdirectories
		for (const subdir of dir.children.directories || []) {
			const propName = sanitizePropertyName(subdir.name);
			materialized[propName] = createLazyWrapper(subdir, ownership, contextManager, instanceID, `${apiPath}.${propName}`, config);
		}

		if (config.debug?.modes) {
			console.log(`[LAZY.MJS materializeFunc] DONE for apiPath=${apiPath}, keys=${Object.keys(materialized).join(",")}`);
		}
		// POC pattern: return the materialized implementation
		return materialized;
	});

	// Create unified wrapper in lazy mode
	const wrapper = new UnifiedWrapper({
		mode: "lazy",
		apiPath,
		contextManager,
		instanceID,
		initialImpl: null, // Lazy mode starts with null
		materializeFunc,
		ownership
	});

	return wrapper.createProxy();
}
