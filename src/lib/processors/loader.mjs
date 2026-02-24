/**
 *	@Project: @cldmv/slothlet
 *	@Filename: /src/lib/processors/loader.mjs
 *	@Date: 2026-01-24 08:43:52 -08:00 (1737730432)
 *	@Author: Nate Hyson <CLDMV>
 *	@Email: <Shinrai@users.noreply.github.com>
 *	-----
 *	@Last modified by: Nate Hyson <CLDMV> (Shinrai@users.noreply.github.com)
 *	@Last modified time: 2026-02-23 15:59:27 -08:00 (1771891167)
 *	-----
 *	@Copyright: Copyright (c) 2013-2026 Catalyzed Motivation Inc. All rights reserved.
 */

/**
 * @fileoverview Loader component for module loading, directory scanning, and API merging
 * @description
 * Provides the Loader class which handles module loading with cache-busting,
 * recursive directory scanning, export validation, and intelligent API merging.
 * @example
 * const loader = new Loader(slothletInstance);
 * const module = await loader.loadModule("./path/to/file.mjs", instanceID);
 * @module @cldmv/slothlet/processors/loader
 */
import { readdir, stat } from "node:fs/promises";
import { join, extname, basename, resolve } from "node:path";
import { pathToFileURL } from "node:url";
import { ComponentBase } from "@cldmv/slothlet/factories/component-base";

/**
 * Loader component for module loading, directory scanning, and API merging
 * @class Loader
 * @extends ComponentBase
 * @package
 */
export class Loader extends ComponentBase {
	static slothletProperty = "loader";

	constructor(slothlet) {
		super(slothlet);
	}

	/**
	 * Load a single module
	 * @param {string} filePath - Path to module file
	 * @param {string} [instanceID] - Slothlet instance ID for cache busting
	 * @param {string} [moduleID] - Module ID for additional cache busting (used in api.slothlet.api.add)
	 * @param {number|null} [cacheBust=null] - Timestamp for reload cache busting (forces fresh import)
	 * @returns {Promise<Object>} Loaded module
	 * @public
	 */
	async loadModule(filePath, instanceID, moduleID, cacheBust = null) {
		try {
			// Check if TypeScript transformation is needed
			const isTypeScript = filePath.endsWith(".ts") || filePath.endsWith(".mts");
			const typescriptConfig = this.slothlet.config?.typescript;

			let moduleUrl;

			if (isTypeScript && typescriptConfig?.enabled) {
				const mode = typescriptConfig.mode || "fast";

				if (mode === "strict") {
					// Validate strict mode config
					if (!typescriptConfig.types?.output) {
						throw new this.SlothletError("TS_STRICT_REQUIRES_OUTPUT", {}, null, { validationError: true });
					}
					if (!typescriptConfig.types?.interfaceName) {
						throw new this.SlothletError("TS_STRICT_REQUIRES_INTERFACE_NAME", {}, null, { validationError: true });
					}

					// Generate types if not already generated for this instance
					if (!this.slothlet._typesGenerated) {
						const { fork } = await import("child_process");
						const path = await import("path");
						const { fileURLToPath } = await import("url");

						// Get the path to the type generation script (in tools/ not src/tools/)
						const __dirname = path.dirname(fileURLToPath(import.meta.url));
						const scriptPath = path.resolve(__dirname, "../../../tools/generate-types-worker.mjs");

						// Prepare config for child process
						// Note: Child process needs 'dir' not 'root', and should use eager mode
						const childConfig = JSON.stringify({
							dir: this.slothlet.config.root || this.slothlet.config.dir,
							mode: "eager",
							typescript: {
								enabled: true,
								mode: "fast"
							},
							types: typescriptConfig.types
						});

						// Fork child process to generate types
						await new Promise((resolve, reject) => {
							const child = fork(scriptPath, [], {
								stdio: ["pipe", "pipe", "pipe", "ipc"],
								env: { ...process.env, SLOTHLET_CONFIG: childConfig }
							});

							let output = "";
							let errorOutput = "";

							child.stdout?.on("data", (data) => {
								output += data.toString();
							});
							child.stderr?.on("data", (data) => {
								errorOutput += data.toString();
							});

							child.on("message", (msg) => {
								if (msg.type === "success") {
									this.slothlet._typesGenerated = true;
									resolve();
								} else if (msg.type === "error") {
									reject(new this.SlothletError("TS_TYPE_GENERATION_FAILED", { error: msg.error }, null, { validationError: true }));
								}
							});

							child.on("error", (error) => {
								reject(new this.SlothletError("TS_TYPE_GENERATION_FORK_FAILED", { error: error.message }, null, { validationError: true }));
							});

							child.on("exit", (code) => {
								if (code !== 0 && !this.slothlet._typesGenerated) {
									reject(
										new this.SlothletError("TS_TYPE_GENERATION_PROCESS_EXITED", { code, output: errorOutput }, null, {
											validationError: true
										})
									);
								}
							});
						});
					}

					// Lazy load TypeScript strict mode processor
					const { transformTypeScriptStrict, createDataUrl, formatDiagnostics } = await import("@cldmv/slothlet/processors/typescript");

					// Transform TypeScript with type checking
					const result = await transformTypeScriptStrict(filePath, {
						target: typescriptConfig.target,
						module: typescriptConfig.module,
						strict: typescriptConfig.strict,
						typeDefinitionPath: typescriptConfig.types.output,
						compilerOptions: typescriptConfig.compilerOptions
					});

					// Check for type errors
					if (result.diagnostics && result.diagnostics.length > 0) {
						// Get TypeScript module to format diagnostics
						const ts = await import("typescript");
						const errors = formatDiagnostics(result.diagnostics, ts.default || ts);

						// Throw error with formatted diagnostics
						const error = new this.SlothletError("TS_TYPE_CHECK_ERRORS", { filePath, errors: errors.join("\n") }, null, {
							validationError: true
						});
						error.diagnostics = result.diagnostics;
						throw error;
					}

					// Create data URL for dynamic import
					moduleUrl = createDataUrl(result.code);
				} else {
					// Fast mode: Use esbuild
					const { transformTypeScript, createDataUrl } = await import("@cldmv/slothlet/processors/typescript");

					// Transform TypeScript to JavaScript
					const transformedCode = await transformTypeScript(filePath, {
						target: typescriptConfig.target,
						sourcemap: typescriptConfig.sourcemap
					});

					// Create data URL for dynamic import
					moduleUrl = createDataUrl(transformedCode);
				}
			} else {
				// Regular JavaScript file
				const fileUrl = pathToFileURL(filePath).href;
				// Cache bust using instanceID to prevent cross-instance pollution
				// Add moduleID for api.slothlet.api.add calls to prevent cache reuse between different API paths
				moduleUrl = instanceID ? `${fileUrl}?slothlet_instance=${instanceID}` : fileUrl;
				if (moduleID) {
					moduleUrl += `&module=${moduleID}`;
				}
				// Append reload timestamp to force fresh imports during rebuildCache.
				// This prevents the Node.js module cache from returning the same function
				// reference used by the live API (which would cause applyRootContributor's
				// Object.assign to overwrite the live API's properties).
				if (cacheBust) {
					moduleUrl += `&_reload=${cacheBust}`;
				}
			}

			const module = await import(moduleUrl);
			return module;
		} catch (error) {
			throw new this.SlothletError(
				"MODULE_IMPORT_FAILED",
				{
					modulePath: filePath
				},
				error
			);
		}
	}

	/**
	 * Scan directory for module files
	 * @param {string} dir - Directory to scan
	 * @param {Object} [options={}] - Scan options
	 * @param {boolean} [options.isRootScan=true] - Whether this is the root directory scan (shows empty dir warning)
	 * @param {number} [options.currentDepth=0] - Current traversal depth
	 * @param {number} [options.maxDepth=Infinity] - Maximum traversal depth
	 * @param {Function|null} [options.fileFilter=null] - Optional filter function (fileName) => boolean to load specific files only
	 * @returns {Promise<Object>} Directory structure
	 * @public
	 */
	async scanDirectory(dir, options = {}) {
		// Check if TypeScript is enabled and add .ts/.mts extensions
		const typescriptConfig = this.slothlet.config?.typescript;
		const defaultExtensions = [".mjs", ".cjs", ".js"];
		const typescriptExtensions = typescriptConfig?.enabled ? [".ts", ".mts"] : [];
		const allExtensions = [...defaultExtensions, ...typescriptExtensions];

		const {
			recursive = true,
			extensions = allExtensions,
			isRootScan = true,
			currentDepth = 0,
			maxDepth = Infinity,
			fileFilter = null
		} = options;

		try {
			await stat(dir);
		} catch (error) {
			throw new this.SlothletError(
				"INVALID_DIRECTORY",
				{
					dir
				},
				error
			);
		}

		const structure = {
			files: [], // Array of { path, name, moduleID }
			directories: [] // Array of { path, name, children: structure }
		};

		const entries = await readdir(dir, { withFileTypes: true });

		for (const entry of entries) {
			const fullPath = join(dir, entry.name);

			if (entry.isDirectory()) {
				// Skip directories if we're filtering for specific files
				// (single file mode shouldn't load subdirectories)
				if (fileFilter) {
					continue;
				}

				// Only recurse if within depth limit
				if (recursive && currentDepth < maxDepth) {
					const subStructure = await this.scanDirectory(fullPath, { ...options, isRootScan: false, currentDepth: currentDepth + 1 });
					structure.directories.push({
						path: fullPath,
						name: entry.name,
						children: subStructure
					});
				}
			} else if (entry.isFile()) {
				const ext = extname(entry.name);
				if (extensions.includes(ext)) {
					// Skip files starting with __ (JSDoc only, test helpers, etc.)
					if (entry.name.startsWith("__")) {
						continue;
					}

					// Apply file filter if provided
					if (fileFilter && !fileFilter(entry.name)) {
						continue;
					}

					const nameWithoutExt = basename(entry.name, ext);
					structure.files.push({
						path: fullPath,
						name: nameWithoutExt,
						fullName: entry.name,
						moduleID: this.slothlet.helpers.sanitize.getModuleId(fullPath, dir)
					});
				}
			}
		}

		// Warn if directory is empty or has no loadable modules (only for root scans or add-api workflows)
		if (isRootScan && structure.files.length === 0 && structure.directories.length === 0) {
			new this.SlothletWarning("WARN_DIRECTORY_EMPTY", {
				dir,
				resolvedPath: resolve(dir)
			});
		}

		return structure;
	}

	/**
	 * Check if module has valid exports
	 * @param {Object} module - Loaded module
	 * @returns {boolean} True if module has exports
	 * @public
	 */
	hasValidExports(module) {
		if (!module || typeof module !== "object") return false;

		// Check for default export
		if (module.default !== undefined) return true;

		// Check for named exports (excluding Symbol exports)
		const namedExports = Object.keys(module).filter((key) => key !== "default" && typeof key === "string");

		return namedExports.length > 0;
	}

	/**
	 * Extract exports from module
	 * @param {Object} module - Loaded module
	 * @returns {Object} Extracted exports
	 * @public
	 */
	extractExports(module) {
		const exports = {};

		// Add default export if exists
		if (module.default !== undefined) {
			exports.default = module.default;
		}

		// Add named exports (excluding module.exports which is a Node.js internal property)
		for (const key of Object.keys(module)) {
			if (key !== "default" && key !== "module.exports" && typeof key === "string") {
				exports[key] = module[key];
			}
		}

		// CJS Default Export Normalization:
		// When a CJS module does: module.exports = { default: something, namedExport: fn }
		// Node.js wraps it as: { default: { default: something, namedExport: fn }, namedExport: fn }
		// We need to unwrap this so it behaves like ESM: export default something; export { namedExport }
		if (exports.default && typeof exports.default === "object" && exports.default !== null && "default" in exports.default) {
			// Check if this looks like the CJS pattern:
			// All named exports at root should also exist in exports.default
			const rootNamedKeys = Object.keys(exports).filter((k) => k !== "default" && k !== "module.exports");
			const defaultKeys = Object.keys(exports.default).filter((k) => k !== "default");

			// If all root named exports exist in exports.default, this is the CJS pattern
			const isCJSPattern = rootNamedKeys.every((k) => k in exports.default);

			if (isCJSPattern && defaultKeys.length > 0) {
				// Unwrap: promote exports.default.default to exports.default
				// Named exports are already at root level from Node.js
				exports.default = exports.default.default;
			}
		}

		return exports;
	}

	/**
	 * Merge extracted exports into an API object with smart flattening.
	 * Handles the common pattern where export name matches module name.
	 * @param {Object} target - Target API object to merge into
	 * @param {Object} exports - Extracted exports from module
	 * @param {string} propertyName - Property name to assign to (sanitized module name)
	 * @returns {void}
	 * @public
	 */
	mergeExportsIntoAPI(target, exports, propertyName) {
		/**
		 * Ensure default export functions have a meaningful name for debug output.
		 * @param {Function} fn - Default export function.
		 * @param {string} nameHint - Property name to use as the function name.
		 * @returns {Function} Named function or original if already named.
		 */
		function ensureNamedDefaultFunction(fn, nameHint) {
			if (typeof fn !== "function") {
				return fn;
			}
			if (fn.name && fn.name !== "default") {
				return fn;
			}
			const safeName = String(nameHint || "default").replace(/[^A-Za-z0-9_$]/g, "_") || "default";
			const wrapped = {
				[safeName]: function (...args) {
					return fn(...args);
				}
			}[safeName];
			const descriptors = Object.getOwnPropertyDescriptors(fn);
			for (const [key, descriptor] of Object.entries(descriptors)) {
				if (key === "name" || key === "length" || key === "prototype") {
					continue;
				}
				Object.defineProperty(wrapped, key, descriptor);
			}
			return wrapped;
		}

		const exportKeys = Object.keys(exports).filter((k) => k !== "default");

		// Case 1: Single named export matching property name - flatten it
		if (exportKeys.length === 1 && exportKeys[0] === propertyName && !exports.default) {
			target[propertyName] = exports[exportKeys[0]];
			return;
		}

		// Case 2: Only default export
		if (exports.default && exportKeys.length === 0) {
			target[propertyName] = ensureNamedDefaultFunction(exports.default, propertyName);
			return;
		}

		// Case 3: Single named export (not matching name)
		if (!exports.default && exportKeys.length === 1) {
			target[propertyName] = exports[exportKeys[0]];
			return;
		}

		// Case 4: Mixed - default + named exports
		if (exports.default && exportKeys.length > 0) {
			// If default is a function, attach named exports as properties
			if (typeof exports.default === "function") {
				const callable = ensureNamedDefaultFunction(exports.default, propertyName);
				for (const key of exportKeys) {
					if (!this.slothlet.processors.flatten.shouldAttachNamedExport(key, exports[key], callable, exports.default)) {
						continue;
					}
					callable[key] = exports[key];
				}
				target[propertyName] = callable;
				return;
			}

			// If default is an object, treat it like ESM "export default X; export { named }"
			// This handles CJS pattern: module.exports = { default: obj, namedExport: fn }
			// Should result in: api.property = obj (with named exports as properties)
			if (typeof exports.default === "object" && exports.default !== null) {
				// Default is an object - unwrap it and attach named exports as properties
				// Result: api.property becomes the default object with named exports as properties
				target[propertyName] = exports.default;
				for (const key of exportKeys) {
					if (!this.slothlet.processors.flatten.shouldAttachNamedExport(key, exports[key], target[propertyName], exports.default)) {
						continue;
					}
					target[propertyName][key] = exports[key];
				}
				return;
			}

			// If default is not a function or object (primitive), create namespace
			target[propertyName] = {};
			target[propertyName].default = exports.default;
			for (const key of exportKeys) {
				target[propertyName][key] = exports[key];
			}
			return;
		}

		// Case 5: Multiple named exports - create namespace
		if (!exports.default && exportKeys.length > 0) {
			target[propertyName] = {};
			for (const key of exportKeys) {
				target[propertyName][key] = exports[key];
			}
			return;
		}
	}
}
