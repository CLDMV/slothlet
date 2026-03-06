/**
 *	@Project: @cldmv/slothlet
 *	@Filename: /src/lib/processors/loader.mjs
 *	@Date: 2026-01-24 08:43:52 -08:00 (1737730432)
 *	@Author: Nate Corcoran <CLDMV>
 *	@Email: <Shinrai@users.noreply.github.com>
 *	-----
 *	@Last modified by: Nate Corcoran <CLDMV> (Shinrai@users.noreply.github.com)
 *	@Last modified time: 2026-03-04 16:33:40 -08:00 (1772670820)
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
				const mode = typescriptConfig.mode;
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

							let errorOutput = "";

							child.stderr?.on("data", (data) => {
								errorOutput += data.toString();
							});

							child.on("message", (msg) => {
								// The false arm (msg.type === "error") is covered in isolation but lost in full-suite coverage merge (fork I/O module caching).
								/* v8 ignore next */
								if (msg.type === "success") {
									this.slothlet._typesGenerated = true;
									resolve();
									/* v8 ignore start */
								} else if (msg.type === "error") {
									reject(new this.SlothletError("TS_TYPE_GENERATION_FAILED", { error: msg.error }, null, { validationError: true }));
								}
								/* v8 ignore stop */
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
						const errors = formatDiagnostics(result.diagnostics, ts.default);

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
				moduleUrl = `${fileUrl}?slothlet_instance=${instanceID}`;
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
}
