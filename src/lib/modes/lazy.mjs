/**
 * @fileoverview Lazy mode implementation - deferred loading with unified wrapper
 * @module @cldmv/slothlet/modes/lazy
 */
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
export async function buildLazyAPI({ dir, apiPathPrefix = "", collisionContext = "initial", slothlet }) {
	const api = {};

	// Access components via slothlet instance
	const { modesProcessor } = slothlet.builders;
	const { loader } = slothlet.processors;

	// Scan directory structure
	const structure = await loader.scanDirectory(dir);

	// Process root files (with root contributor pattern support)
	// Pass synthetic root directory with children.directories so processFiles can create lazy wrappers
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
		0,
		"lazy",
		true,
		false, // populateDirectly - keep false, the real issue is elsewhere
		false,
		apiPathPrefix,
		collisionContext
	);

	// Lazy wrappers for directories are now created by processFiles when recursive=false

	// Apply root contributor pattern: if a root function exists, make it THE api
	const finalApi = await modesProcessor.applyRootContributor(api, rootDefaultFunction, slothlet.config, "lazy");

	return finalApi;
}

/**
 * Create lazy wrapper using UnifiedWrapper
 * @param {Object} dir - Directory structure
 * @param {string} apiPath - Current API path
 * @param {Object} slothlet - Slothlet instance
 * @returns {Proxy} Lazy unified wrapper
 * @private
 */
function createLazyWrapper(dir, apiPath, slothlet) {
	// Create materialization function (POC pattern: returns implementation, no wrapper param)
	const materializeFunc = createNamedMaterializeFunc(apiPath, async () => {
		slothlet.debug("modes", {
			message: "Lazy materializeFunc started",
			apiPath,
			dirName: dir.name
		});
		const materialized = {};

		// Load files in directory
		for (const file of dir.children.files) {
			try {
				slothlet.debug("modes", {
					message: "Loading file",
					fileName: file.name,
					filePath: file.path
				});
				const mod = await slothlet.processors.loader.loadModule(file.path, slothlet.instanceID);
				slothlet.debug("modes", {
					message: "File loaded, extracting exports",
					fileName: file.name
				});
				const exports = slothlet.processors.loader.extractExports(mod);
				slothlet.debug("modes", {
					message: "Exports extracted",
					fileName: file.name,
					exportKeys: Object.keys(exports)
				});
				const moduleName = slothlet.helpers.sanitize.sanitizePropertyName(file.name);

				// Register ownership
				if (slothlet.handlers.ownership) {
					slothlet.handlers.ownership.register({
						moduleId: file.moduleId,
						apiPath: `${apiPath}.${moduleName}`,
						source: "core",
						collisionMode: slothlet.config.collision?.core || "error"
					});
				}

				// Merge exports into materialized object
				slothlet.debug("modes", {
					message: "Merging exports",
					fileName: file.name
				});
				slothlet.processors.loader.mergeExportsIntoAPI(materialized, exports, moduleName);
				slothlet.debug("modes", {
					message: "Exports merged",
					fileName: file.name,
					materializedKeys: Object.keys(materialized)
				});
			} catch (error) {
				slothlet.debug("modes", {
					message: "Error loading file",
					fileName: file.name,
					error: error.message
				});
				throw error;
			}
		}

		// Create lazy wrappers for subdirectories
		for (const subdir of dir.children.directories || []) {
			const propName = slothlet.helpers.sanitize.sanitizePropertyName(subdir.name);
			materialized[propName] = createLazyWrapper(subdir, `${apiPath}.${propName}`, slothlet);
		}
		slothlet.debug("modes", {
			message: "Lazy materializeFunc complete",
			apiPath,
			keys: Object.keys(materialized)
		});
		// POC pattern: return the materialized implementation
		return materialized;
	});

	// Create unified wrapper in lazy mode
	const wrapper = new UnifiedWrapper(slothlet, {
		mode: "lazy",
		apiPath,
		initialImpl: null, // Lazy mode starts with null
		materializeFunc,
		materializeOnCreate: slothlet.config.backgroundMaterialize
	});

	return wrapper.createProxy();
}
