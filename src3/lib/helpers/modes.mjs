/**
 * @fileoverview Shared mode utilities - common logic for eager and lazy modes
 * @module @cldmv/slothlet/helpers/modes
 */
import { loadModule, extractExports } from "@cldmv/slothlet/helpers/loader";
import { sanitizePropertyName } from "@cldmv/slothlet/helpers/sanitize";
import { t } from "@cldmv/slothlet/i18n";
import { UnifiedWrapper } from "@cldmv/slothlet/handlers/unified-wrapper";

/**
 * Process root files and detect root contributor pattern
 * @param {Object} api - API object being built
 * @param {Array} files - Root files from scanner
 * @param {Object} ownership - Ownership manager
 * @param {Object} contextManager - Context manager for wrapper
 * @param {string} instanceId - Instance ID for wrapper
 * @param {Object} config - Configuration
 * @param {string} mode - Mode name for debug messages
 * @returns {Promise<Function|null>} Root contributor function if found
 * @public
 */
export async function processRootFiles(api, files, ownership, contextManager, instanceId, config, mode) {
	let rootDefaultFunction = null;

	for (const file of files) {
		const mod = await loadModule(file.path);
		const moduleName = sanitizePropertyName(file.name);
		const exports = extractExports(mod);

		// Check if this is a root contributor (default function export)
		const isRootContributor = exports.default && typeof exports.default === "function";

		if (isRootContributor) {
			// This is a root contributor - attach named exports to the default function
			const defaultFunc = exports.default;
			const namedExports = Object.keys(exports).filter((k) => k !== "default");

			for (const key of namedExports) {
				defaultFunc[key] = exports[key];
			}

			// Register ownership for the function itself
			if (ownership) {
				ownership.register({
					moduleId: file.moduleId,
					apiPath: moduleName,
					source: "core"
				});
			}

			if (config.debug?.modes) {
				console.log(await t("DEBUG_MODE_ROOT_FILE", { mode, moduleName, isContributor: true }));
			}

			// Save as root function if we don't have one yet
			if (!rootDefaultFunction) {
				rootDefaultFunction = defaultFunc;
				if (config.debug?.modes) {
					console.log(await t("DEBUG_MODE_ROOT_CONTRIBUTOR", { mode, functionName: defaultFunc.name || "anonymous" }));
				}
			}
		} else {
			// Regular module - NOT a root contributor
			// Root files should create their own namespace with their sanitized filename
			// The file's exports become properties of that namespace

			const moduleContent = {};

			// Collect all exports (default and named)
			if (exports.default) {
				moduleContent.default = exports.default;
			}

			const namedExports = Object.keys(exports).filter((k) => k !== "default");
			for (const key of namedExports) {
				moduleContent[key] = exports[key];
			}

			// Wrap in UnifiedWrapper with the file's sanitized name as the namespace
			const wrapper = new UnifiedWrapper({
				mode,
				apiPath: moduleName,
				contextManager,
				instanceId,
				initialImpl: moduleContent,
				ownership
			});

			api[moduleName] = wrapper.createProxy();

			// Register ownership
			if (ownership) {
				ownership.register({
					moduleId: file.moduleId,
					apiPath: moduleName,
					source: "core"
				});
			}

			if (config.debug?.modes) {
				console.log(await t("DEBUG_MODE_ROOT_FILE", { mode, moduleName, isContributor: false }));
			}
		}
	}

	return rootDefaultFunction;
}

/**
 * Apply root contributor pattern - merge API into root function
 * @param {Object} api - API object with properties
 * @param {Function|null} rootFunction - Root contributor function
 * @param {Object} config - Configuration
 * @param {string} mode - Mode name for debug messages
 * @returns {Promise<Object|Function>} Final API (function if root contributor, object otherwise)
 * @public
 */
export async function applyRootContributor(api, rootFunction, config, mode) {
	if (rootFunction) {
		// Merge all other API properties onto the root function
		Object.assign(rootFunction, api);
		if (config.debug?.modes) {
			console.log(await t("DEBUG_MODE_ROOT_CONTRIBUTOR_APPLIED", { mode, properties: Object.keys(api).length }));
		}
		return rootFunction;
	}
	return api;
}
