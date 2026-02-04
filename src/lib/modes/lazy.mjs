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
 * @param {Object} [options.userMetadata={}] - User metadata to apply to all wrappers
 * @returns {Promise<Object>} Built API object with lazy proxies
 * @public
 */
export async function buildLazyAPI({
	dir,
	apiPathPrefix = "",
	collisionContext = "initial",
	moduleId,
	userMetadata = {},
	slothlet,
	apiDepth = Infinity
}) {
	const api = {};

	// Access components via slothlet instance
	const { modesProcessor } = slothlet.builders;
	const { loader } = slothlet.processors;

	// Scan directory structure with depth limit
	const structure = await loader.scanDirectory(dir, { maxDepth: apiDepth });

	// Process root files (with root contributor pattern support)
	// Pass synthetic root directory with children.directories so processFiles can create lazy wrappers
	const rootDirectory = {
		name: ".",
		path: dir, // Add path so folder wrappers can be tagged with metadata
		children: {
			files: structure.files,
			directories: structure.directories
		}
	};

	// Load all root-level content (files and folders)
	// Root files will be wrapped eagerly (see modes-processor.mjs special handling)
	const rootDefaultFunction = await modesProcessor.processFiles(
		api,
		structure.files,
		rootDirectory,
		0,
		"lazy",
		true, // isRoot=true for root contributor detection
		false, // recursive=false to create lazy wrappers for subdirectories (not eager load)
		false, // populateDirectly=false for root level
		apiPathPrefix,
		collisionContext,
		moduleId,
		dir, // sourceFolder for metadata
		userMetadata
	);

	// Apply root contributor pattern: if a root function exists, make it THE api
	const finalApi = await modesProcessor.applyRootContributor(api, rootDefaultFunction, slothlet.config, "lazy");

	return finalApi;
}

/**
 * Create lazy wrapper using UnifiedWrapper
 * @param {Object} dir - Directory structure
 * @param {string} apiPath - Current API path
 * @param {Object} slothlet - Slothlet instance
 * @param {string} moduleIdOverride - Module ID from api.add() to use instead of file.moduleId
 * @param {Object} userMetadata - User metadata to inherit from parent
 * @returns {Proxy} Lazy unified wrapper
 * @private
 */
function createLazyWrapper(dir, apiPath, slothlet, moduleIdOverride, userMetadata = {}) {
	// Create materialization function (POC pattern: accepts setter for synchronous impl updates)
	const materializeFunc = createNamedMaterializeFunc(apiPath, async (lazy_setImpl) => {
		slothlet.debug("modes", {
			message: "Lazy materializeFunc started",
			apiPath,
			dirName: dir.name
		});
		const materialized = {};
		// Store file paths for each property so child wrappers get correct filePath
		const childFilePaths = {};

		// Load files in directory
		for (const file of dir.children.files) {
			try {
				slothlet.debug("modes", {
					message: "Loading file",
					fileName: file.name,
					filePath: file.path
				});
				// Use moduleIdOverride from api.add() if provided, otherwise use file's auto-generated ID
				const effectiveModuleId = moduleIdOverride || file.moduleId;
				const mod = await slothlet.processors.loader.loadModule(file.path, slothlet.instanceID, effectiveModuleId);
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
						moduleId: effectiveModuleId,
						apiPath: `${apiPath}.${moduleName}`,
						source: "core",
						collisionMode: slothlet.config.collision?.core || "error",
						filePath: file.path
					});
				}

				// Store the file path for this property
				childFilePaths[moduleName] = file.path;

				// Merge exports into materialized object
				slothlet.debug("modes", {
					message: "Merging exports",
					fileName: file.name
				});
				slothlet.processors.loader.mergeExportsIntoAPI(materialized, exports, moduleName);
				// Tag system metadata for the merged module AND its properties with correct file path
				if (materialized[moduleName] && slothlet.handlers?.lifecycle) {
					// Emit impl:created event for the module object itself
					slothlet.handlers.lifecycle.emit("impl:created", {
						apiPath: `${apiPath}.${moduleName}`,
						impl: materialized[moduleName],
						source: "lazy-merge",
						moduleId: effectiveModuleId,
						filePath: file.path,
						sourceFolder: dir.path
					});

					// Emit impl:created events for all properties (functions) in the module
					if (typeof materialized[moduleName] === "object") {
						for (const key of Object.keys(materialized[moduleName])) {
							const prop = materialized[moduleName][key];
							if (typeof prop === "function" || (typeof prop === "object" && prop !== null)) {
								slothlet.handlers.lifecycle.emit("impl:created", {
									apiPath: `${apiPath}.${moduleName}.${key}`,
									impl: prop,
									source: "lazy-merge-property",
									moduleId: effectiveModuleId,
									filePath: file.path,
									sourceFolder: dir.path
								});
							}
						}
					}
				}
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

		// Create lazy wrappers for subdirectories (inherit userMetadata and moduleIdOverride from parent)
		for (const subdir of dir.children.directories || []) {
			const propName = slothlet.helpers.sanitize.sanitizePropertyName(subdir.name);
			materialized[propName] = createLazyWrapper(subdir, `${apiPath}.${propName}`, slothlet, moduleIdOverride, userMetadata);
		}

		// Store the file path mapping as non-enumerable property
		Object.defineProperty(materialized, "__childFilePaths", {
			value: childFilePaths,
			enumerable: false,
			configurable: false,
			writable: false
		});

		slothlet.debug("modes", {
			message: "Lazy materializeFunc complete",
			apiPath,
			keys: Object.keys(materialized)
		});
		// Log what's in materialized for "math" in collision scenarios
		if (apiPath === "math") {
			slothlet.debug("modes", {
				message: "MATERIALIZE-COMPLETE: apiPath=math materialized keys",
				keys: Object.keys(materialized).join(", ")
			});
		}
		// CRITICAL: Set _impl synchronously (matches v2 behavior where 'materialized' variable is set immediately)
		// This allows property access to work without waiting for the function to return
		if (lazy_setImpl) {
			lazy_setImpl(materialized);
		}

		// POC pattern: return the materialized implementation (for backward compatibility)
		return materialized;
	});

	// Create unified wrapper in lazy mode
	const wrapper = new UnifiedWrapper(slothlet, {
		mode: "lazy",
		apiPath,
		initialImpl: null, // Lazy mode starts with null
		materializeFunc,
		materializeOnCreate: slothlet.config.backgroundMaterialize,
		filePath: null, // Don't set filePath yet - will be set during materialization
		moduleId: moduleIdOverride, // Use the override if provided, otherwise null
		sourceFolder: slothlet.config?.dir
	});

	// Store directory structure for later access (e.g., replace mode pre-population)
	wrapper._directoryStructure = dir;
	slothlet.debug("modes", {
		message: "LAZY-CREATE: stored _directoryStructure",
		apiPath,
		fileCount: dir?.children?.files?.length || 0
	});

	return wrapper.createProxy();
}
