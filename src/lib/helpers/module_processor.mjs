/**
 * @fileoverview Unified module processing logic for slothlet modes. Internal file (not exported in package.json).
 * @module @cldmv/slothlet/src/lib/helpers/module_processor
 */

/**
 * Processes a single module and applies it to the API based on multi-default context and export patterns.
 * @internal
 * @private
 * @param {object} options - Processing configuration
 * @param {object} options.mod - The loaded and unwrapped module
 * @param {string} options.fileName - The base filename (without extension)
 * @param {string} options.apiKey - The sanitized API key for this module
 * @param {boolean} options.hasMultipleDefaultExports - Whether multi-default context is active
 * @param {boolean} options.isSelfReferential - Whether this module's default is self-referential
 * @param {object} options.api - The API object to modify
 * @param {Function|null} options.getRootDefault - Function to get current root default
 * @param {Function} options.setRootDefault - Function to set root default
 * @param {object} options.context - Processing context (debug, mode-specific data)
 * @param {boolean} [options.context.debug=false] - Enable debug logging
 * @param {string} [options.context.mode="unknown"] - Processing mode (eager/lazy)
 * @param {Array<object>} [options.context.moduleFiles=[]] - All module files for context
 * @returns {{
 *   processed: boolean,
 *   rootDefaultSet: boolean,
 *   flattened: boolean,
 *   namespaced: boolean
 * }} Processing result metadata
 * @example // Internal usage in slothlet modes
 * const result = processModule({
 *   mod, fileName, apiKey, hasMultipleDefaultExports, isSelfReferential,
 *   api, getRootDefault: () => rootFn, setRootDefault: (fn) => { rootFn = fn; },
 *   context: { debug: true, mode: "eager" }
 * });
 */
function processModule(options) {
	const {
		mod,
		fileName,
		apiKey,
		hasMultipleDefaultExports,
		isSelfReferential,
		api,
		getRootDefault,
		setRootDefault,
		context = {}
	} = options;

	const { debug = false, mode = "unknown", moduleFiles = [] } = context;
	const totalModuleCount = moduleFiles.length;

	let processed = false;
	let rootDefaultSet = false;
	let flattened = false;
	let namespaced = false;

	if (mod && typeof mod.default === "function") {
		processed = true;

		if (hasMultipleDefaultExports && !isSelfReferential) {
			// Multi-default case: use filename as API key
			api[apiKey] = mod.default;
			namespaced = true;

			// Also add named exports to the function
			for (const [key, value] of Object.entries(mod)) {
				if (key !== "default") {
					api[apiKey][key] = value;
				}
			}

			if (debug) {
				console.log(`[DEBUG] Multi-default in ${mode} mode: using filename '${apiKey}' for default export`);
			}
		} else if (isSelfReferential) {
			// Self-referential case: treat as namespace (preserve both named and default)
			if (debug) {
				console.log(`[DEBUG] Self-referential default export: preserving ${fileName} as namespace`);
			}
			api[apiKey] = mod;
			namespaced = true;
		} else {
			// Traditional single default case: becomes root API
			if (debug) {
				console.log(
					`[DEBUG] Processing traditional default: hasMultipleDefaultExports=${hasMultipleDefaultExports}, rootDefaultFunction=${!!getRootDefault()}`
				);
			}
			if (!hasMultipleDefaultExports && !getRootDefault()) {
				setRootDefault(mod.default);
				rootDefaultSet = true;
				if (debug) {
					console.log(`[DEBUG] Set rootDefaultFunction to:`, mod.default.name);
				}
			}
			// Only add named exports to root level in traditional single-default case
			if (!hasMultipleDefaultExports) {
				for (const [key, value] of Object.entries(mod)) {
					if (key !== "default") {
						api[key] = value;
						flattened = true;
					}
				}
			}
		}
	} else {
		// Handle non-function defaults and modules with only named exports
		processed = true;

		if (debug) {
			console.log(`[DEBUG] Processing non-function or named-only exports for ${fileName}`);
		}

		if (isSelfReferential) {
			// Self-referential case: preserve as namespace
			if (debug) {
				console.log(`[DEBUG] Self-referential ${fileName}: preserving as namespace`);
			}
			// Mode-specific behavior: eager uses mod.default, lazy uses mod[apiKey] || mod
			if (mode === "eager") {
				api[apiKey] = mod.default; // Use the default export as the namespace
			} else {
				api[apiKey] = mod[apiKey] || mod; // For lazy: use named export or whole module
			}
			namespaced = true;
		} else if (hasMultipleDefaultExports && mod.default) {
			// Multi-default context: preserve modules WITH default exports as namespaces
			if (debug) {
				console.log(`[DEBUG] Multi-default context: preserving ${fileName} as namespace (has default export)`);
			}
			api[apiKey] = mod;
			namespaced = true;
		} else if (hasMultipleDefaultExports && !mod.default) {
			// Multi-default context: flatten modules WITHOUT default exports to root
			if (debug) {
				console.log(`[DEBUG] Multi-default context: flattening ${fileName} (no default export) to root`);
			}
			const moduleKeys = Object.keys(mod).filter((k) => k !== "default");
			for (const key of moduleKeys) {
				api[key] = mod[key];
				flattened = true;
				if (debug) {
					console.log(`[DEBUG] Multi-default context: flattened ${fileName}.${key} to api.${key}`);
				}
			}
		} else {
			// Traditional context: check for auto-flattening or preserve as namespace
			const moduleKeys = Object.keys(mod).filter((k) => k !== "default");

			// Auto-flattening logic
			if (moduleKeys.length === 1 && moduleKeys[0] === apiKey) {
				// Auto-flatten: module exports single named export matching filename
				if (debug) {
					console.log(`[DEBUG] Auto-flattening: ${fileName} exports single named export ${apiKey}`);
				}
				api[apiKey] = mod[apiKey];
				namespaced = true; // Single item, but treated as namespace
			} else if (!mod.default && moduleKeys.length > 0 && (hasMultipleDefaultExports || totalModuleCount === 1)) {
				// Auto-flatten: single file with no default, only named exports
				if (debug) {
					console.log(
						`[DEBUG] Single-file auto-flattening: ${fileName}/${fileName}.${mode === "eager" ? "mjs" : "cjs"} -> flatten object contents`
					);
				}
				for (const key of moduleKeys) {
					api[key] = mod[key];
					flattened = true;
				}
			} else {
				// Traditional context: preserve as namespace
				if (debug) {
					console.log(`[DEBUG] Traditional context: preserving ${fileName} as namespace`);
				}
				api[apiKey] = mod;
				namespaced = true;
			}
		}
	}

	return { processed, rootDefaultSet, flattened, namespaced };
}

export { processModule };
