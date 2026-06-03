/**
 *	@Project: @cldmv/slothlet
 *	@Filename: /src/lib/processors/loader.mjs
 *	@Date: 2026-01-24 08:43:52 -08:00 (1737730432)
 *	@Author: Nate Corcoran <CLDMV>
 *	@Email: <Shinrai@users.noreply.github.com>
 *	-----
 *	@Last modified by: Nate Corcoran <CLDMV> (Shinrai@users.noreply.github.com)
 *	@Last modified time: 2026-05-28 09:43:15 -07:00 (1779986595)
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
 * @internal
 */
import { ComponentBase } from "@cldmv/slothlet/factories/component-base";

// Node-only static imports resolved via top-level await so `node:*` never
// enters the static-import graph in browser bundles. The filesystem-scanning
// and CJS-loader methods on Loader are Node-only; browser mode uses
// #scanDirectoryBrowser / #loadModuleBrowser which walk the manifest tree.
// fs/promises + path + url + module builtins resolved in the platform module (#123); the loader's
// disk-scanning / CJS-loader methods are Node-only (browser mode uses #scanDirectoryBrowser /
// #loadModuleBrowser over the manifest tree), so they reference the namespaces directly — null in a
// browser, but those methods never run there, so no per-call guard is needed.
import { fsp, path, url, createRequire } from "@cldmv/slothlet/helpers/platform";

/**
 * Loader component for module loading, directory scanning, and API merging
 * @class Loader
 * @extends ComponentBase
 * @package
 */
export class Loader extends ComponentBase {
	static slothletProperty = "loader";

	/**
	 * Create a Loader instance.
	 * @param {object} slothlet - Slothlet class instance.
	 * @package
	 */
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
			// Browser mode: filesystem paths and pathToFileURL are not available.
			// Delegate to the callback the user supplied via config.resolveModuleSpecifier.
			if (this.slothlet.envTarget === "browser") {
				return this.#loadModuleBrowser(filePath);
			}

			// CJS files must bypass the shared require() cache; query-param cache-busting
			// has no effect on require() because it keys on the resolved file path only.
			if (filePath.endsWith(".cjs")) {
				return this.#loadCJSIsolated(filePath);
			}

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
						const scriptPath = path.resolve(__dirname, "../../../tools/build/generate-types-worker.mjs");

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
									// Covered by loader-fork-message-error.test.vitest.mjs but the full coverage
									// run's parallel worker merge loses it because vi.mock("child_process") is
									// file-scoped and the dynamic import("child_process") caches across workers.
									/* v8 ignore start */
								} else if (msg.type === "error") {
									// msg.error is a string (serialized over IPC). Wrap in a message-object so
									// SlothletError auto-enriches {error} from originalError.message without
									// needing a bare new Error() construction.
									reject(new this.SlothletError("TS_TYPE_GENERATION_FAILED", {}, { message: msg.error }));
								}
								/* v8 ignore stop */
							});

							child.on("error", (error) => {
								reject(new this.SlothletError("TS_TYPE_GENERATION_FORK_FAILED", {}, error));
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
					const { transformTypeScriptStrict, writeTransformedToCache, formatDiagnostics } =
						await import("@cldmv/slothlet/processors/typescript");

					// Transform + type-check a single .ts/.mts file. Reused for the entry
					// module and for every relative .ts/.mts file it imports, so type
					// errors anywhere in the import graph surface the same way.
					const strictTransform = async (tsPath) => {
						const result = await transformTypeScriptStrict(tsPath, {
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
							const error = new this.SlothletError("TS_TYPE_CHECK_ERRORS", { filePath: tsPath, errors: errors.join("\n") }, null, {
								validationError: true
							});
							error.diagnostics = result.diagnostics;
							throw error;
						}
						return result.code;
					};

					const entryCode = await strictTransform(filePath);
					moduleUrl = await this.#buildTypescriptModuleUrl(
						writeTransformedToCache,
						filePath,
						entryCode,
						instanceID,
						moduleID,
						cacheBust,
						strictTransform
					);
				} else {
					// Fast mode: Use esbuild
					const { transformTypeScript, writeTransformedToCache } = await import("@cldmv/slothlet/processors/typescript");

					const transformOptions = {
						target: typescriptConfig.target,
						sourcemap: typescriptConfig.sourcemap
					};
					// Transform TypeScript to JavaScript. The same transform is used to
					// follow relative .ts/.mts imports between user modules.
					const transformedCode = await transformTypeScript(filePath, transformOptions);
					const transform = (tsPath) => transformTypeScript(tsPath, transformOptions);

					moduleUrl = await this.#buildTypescriptModuleUrl(
						writeTransformedToCache,
						filePath,
						transformedCode,
						instanceID,
						moduleID,
						cacheBust,
						transform
					);
				}
			} else {
				// Regular JavaScript file
				const fileUrl = url.pathToFileURL(filePath).href;
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
	 * Load a CJS module with a fresh module.exports on every call by clearing
	 * its entry from require.cache before loading.
	 * Node's require() cache is keyed on the resolved file path and ignores URL
	 * query parameters, so two Slothlet instances loading the same .cjs file
	 * would otherwise share the exact same module.exports object.
	 * @param {string} filePath - Absolute path to the .cjs file
	 * @returns {Promise<Object>} Synthetic ESM namespace: { default, ...namedExports }
	 * @example
	 * const ns = await this.#loadCJSIsolated("/path/to/module.cjs");
	 * ns.default; // module.exports
	 * @private
	 */
	#loadCJSIsolated(filePath) {
		const requireFn = createRequire(filePath);
		const resolved = requireFn.resolve(filePath);

		// Clear from require.cache so each call gets a fresh module.exports.
		delete requireFn.cache[resolved];
		const exports = requireFn(resolved);
		// Remove after loading so the cache doesn't grow unboundedly across instances.
		delete requireFn.cache[resolved];

		// Build a synthetic ESM namespace that mirrors what import() returns for CJS:
		//   - default = module.exports
		//   - each own key of module.exports becomes a named export
		const namespace = { default: exports };
		if (exports !== null && typeof exports === "object") {
			for (const key of Object.keys(exports)) {
				if (key !== "default") {
					namespace[key] = exports[key];
				}
			}
		}
		return namespace;
	}

	/**
	 * Persist transformed TS code to a project-local cache file and build the
	 * file URL with the same `?slothlet_instance=…&module=…&_reload=…` suffix
	 * the `.mjs` branch uses, so bare-specifier resolution works and Node's
	 * module-cache key matches the `.mjs` branch (URLs incl. query are the key).
	 * Records the cache directory on the slothlet instance for shutdown cleanup.
	 * @param {Function} writeTransformedToCache - Lazily-imported helper from processors/typescript
	 * @param {string} filePath - Original .ts/.mts source path
	 * @param {string} code - Transformed JavaScript code
	 * @param {string} instanceID - Slothlet instance ID
	 * @param {string} [moduleID] - Optional module ID for api.slothlet.api.add
	 * @param {number|null} [cacheBust] - Optional reload timestamp
	 * @param {(filePath: string) => Promise<string>} [transform] - Transpiler used to
	 *   follow relative .ts/.mts imports between user modules
	 * @returns {Promise<string>} Full file:// URL with cache-bust query
	 * @private
	 */
	async #buildTypescriptModuleUrl(writeTransformedToCache, filePath, code, instanceID, moduleID, cacheBust, transform) {
		const { url, cacheDir } = await writeTransformedToCache(filePath, code, instanceID, transform);
		(this.slothlet._typescriptCacheDirs ??= new Set()).add(cacheDir);
		let moduleUrl = `${url}?slothlet_instance=${instanceID}`;
		// The false (no-moduleID) arm is covered by initial-TS-load tests in isolation but lost in
		// full-suite coverage merge — the .mjs branch above (lines 195-204) uses the same pattern
		// and matches via cross-file aggregation; the TS branch fires in fewer files so v8 drops it.
		/* v8 ignore next 3 */
		if (moduleID) {
			moduleUrl += `&module=${moduleID}`;
		}
		if (cacheBust) {
			moduleUrl += `&_reload=${cacheBust}`;
		}
		return moduleUrl;
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
		// Browser mode: the filesystem is not available. Use the manifest provided at init.
		if (this.slothlet.envTarget === "browser") {
			return this.#scanDirectoryBrowser(dir, options);
		}

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
			await fsp.stat(dir);
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

		const entries = await fsp.readdir(dir, { withFileTypes: true });

		for (const entry of entries) {
			const fullPath = path.join(dir, entry.name);

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
				const ext = path.extname(entry.name);
				if (extensions.includes(ext)) {
					// Skip files starting with __ (JSDoc only, test helpers, etc.)
					if (entry.name.startsWith("__")) {
						continue;
					}

					// Apply file filter if provided
					if (fileFilter && !fileFilter(entry.name)) {
						continue;
					}

					const nameWithoutExt = path.basename(entry.name, ext);
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
				resolvedPath: path.resolve(dir)
			});
		}

		return structure;
	}

	/**
	 * Browser-mode directory scan: builds the same `{ files, directories }` structure
	 * that the filesystem-based `scanDirectory` produces, but from the pre-generated
	 * `manifest` object provided via `config.manifest`.
	 *
	 * The manifest is the top-level structure. When a sub-path `dir` is requested
	 * (e.g. from `api.slothlet.api.add` in browser mode), this method searches the
	 * manifest recursively to find the matching directory node.
	 *
	 * @param {string} dir - Root or sub-directory identifier. Empty string / "/" means root.
	 * @param {Object} [options={}] - Scan options forwarded from `scanDirectory`.
	 * @param {Function|null} [options.fileFilter=null] - Optional file-name filter.
	 * @returns {{ files: Array, directories: Array }} Directory structure.
	 * @throws {SlothletError} When the manifest is missing or the requested dir is not found.
	 * @private
	 *
	 * @example
	 * // Called internally by scanDirectory in browser mode:
	 * this.#scanDirectoryBrowser("", {});
	 * this.#scanDirectoryBrowser("billing", { fileFilter: (n) => n === "invoice.mjs" });
	 */
	#scanDirectoryBrowser(dir, options = {}) {
		const manifest = this.slothlet.config?.manifest;
		// manifest is validated during transformConfig; this guard protects against
		// accidental calls before config is fully applied.
		/* v8 ignore next 3 */
		if (!manifest) {
			throw new this.SlothletError("INVALID_CONFIG_BROWSER_REQUIRES_MANIFEST", {}, null, { validationError: true });
		}

		// Compute the relative path by stripping the base URL/path prefix.
		// When dir equals config.dir (the root), the relative path is empty → root scan.
		// When dir is a relative segment like "utils", it passes through unchanged.
		// The `|| ""` fallbacks on each line are defensive: real callers always go
		// through transformConfig (config.dir non-empty) and pass a resolved dir
		// via scanDirectory's public callers (modes/{eager,lazy}.mjs + api.add).
		// Direct internal `loader.scanDirectory("")` is not a supported path.
		/* v8 ignore next */
		const configBase = (this.slothlet.config?.dir || "").replace(/\/$/, "");
		/* v8 ignore next */
		let relativePath = (dir || "").replace(/\/$/, "");
		if (configBase && relativePath.startsWith(configBase)) {
			relativePath = relativePath.slice(configBase.length).replace(/^\/|\/$/g, "");
		}

		const isRoot = !relativePath || relativePath === "/" || relativePath === ".";
		const node = isRoot ? manifest : this.#findManifestNode(manifest, relativePath);
		if (!node) {
			throw new this.SlothletError("INVALID_DIRECTORY", { dir }, null);
		}

		return this.#manifestNodeToStructure(node, dir, options);
	}

	/**
	 * Recursively search the manifest tree for the node that matches `targetPath`.
	 *
	 * @param {Object} node - Current manifest node (`{ files, directories }`).
	 * @param {string} targetPath - Relative path of the directory to find.
	 * @returns {Object|null} Matched manifest node, or null when not found.
	 * @private
	 *
	 * @example
	 * this.#findManifestNode(manifest, "billing");
	 * this.#findManifestNode(manifest, "billing/reports");
	 */
	#findManifestNode(node, targetPath) {
		const normalised = targetPath.replace(/\\/g, "/").replace(/^\/|\/$/g, "");
		// `node.directories || []` defensive fallback for malformed manifest nodes
		// — generateManifest always emits the field, and the validation in Config
		// guarantees the top-level shape. The fallback is unreachable in normal flow.
		/* v8 ignore next */
		for (const dir of node.directories || []) {
			// `dir.path || dir.name || ""` is a defensive fallback chain. Both fields
			// are normally populated by generateManifest; hand-crafted manifests may
			// omit one or the other. The final `|| ""` arm is unreachable because
			// at least one of `path` / `name` is required for a usable directory entry.
			/* v8 ignore next */
			const dirPath = (dir.path || dir.name || "").replace(/\\/g, "/").replace(/^\/|\/$/g, "");
			if (dirPath === normalised) return dir.children || dir;
			// Recurse into sub-directories for nested paths like "billing/reports".
			const found = this.#findManifestNode(dir.children || dir, normalised);
			if (found) return found;
		}
		return null;
	}

	/**
	 * Convert one manifest node into the `{ files, directories }` structure that the
	 * rest of the framework pipeline expects from `scanDirectory`.
	 *
	 * @param {Object} node - Manifest node with optional `files` and `directories` arrays.
	 * @param {string} rootPath - Root-relative path prefix for this node (used for `moduleID`).
	 * @param {Object} [options={}] - Scan options.
	 * @param {Function|null} [options.fileFilter=null] - Optional file-name filter.
	 * @returns {{ files: Array, directories: Array }} Directory structure.
	 * @private
	 *
	 * @example
	 * this.#manifestNodeToStructure(manifest, "", {});
	 */
	#manifestNodeToStructure(node, rootPath, options = {}) {
		const { fileFilter = null } = options;
		const ALLOWED_EXTS = [".mjs", ".cjs", ".js"];
		const structure = { files: [], directories: [] };

		for (const file of node.files || []) {
			const filePath = file.path || file.relativePath || "";
			const fullName = file.fullName || filePath.split("/").pop();
			const lastDot = fullName.lastIndexOf(".");
			const ext = lastDot >= 0 ? fullName.slice(lastDot) : "";

			// Skip non-JS files and double-underscore helpers.
			if (!ALLOWED_EXTS.includes(ext)) continue;
			if (fullName.startsWith("__")) continue;

			// Apply caller-supplied file filter (used for single-file api.add calls).
			if (fileFilter && !fileFilter(fullName)) continue;

			// Inner ternary's false-arm (lastDot < 0) is unreachable here: the
			// ALLOWED_EXTS check above (`continue` when ext === "") filters out any
			// file without a dot in its fullName before reaching this name fallback.
			/* v8 ignore next */
			const name = file.name || (lastDot >= 0 ? fullName.slice(0, lastDot) : fullName);
			structure.files.push({
				path: filePath,
				name,
				fullName,
				moduleID: this.slothlet.helpers.sanitize.getModuleId(filePath, rootPath)
			});
		}

		// Never recurse into subdirectories when a file-filter is active (single-file mode).
		if (!fileFilter) {
			for (const dir of node.directories || []) {
				const dirPath = dir.path || dir.name || "";
				structure.directories.push({
					path: dirPath,
					name: dir.name || dirPath.split("/").pop(),
					children: this.#manifestNodeToStructure(dir.children || dir, dirPath, options)
				});
			}
		}

		return structure;
	}

	/**
	 * Browser-mode module loading: delegates to the `resolveModuleSpecifier` callback
	 * supplied in `config`, or falls back to resolving relative to `config.base`. Plain
	 * filesystem paths are automatically converted to `file://` URLs so callers do not
	 * need to prefix `base` with `"file://"`.
	 *
	 * @param {string} filePath - The relative path as stored in the manifest.
	 * @returns {Promise<Object>} Loaded module namespace.
	 * @private
	 *
	 * @example
	 * // Default resolver — no resolveModuleSpecifier needed when base is a filesystem path:
	 * // config.base = "/srv/api"  →  loads file:///srv/api/auth.mjs
	 * await this.#loadModuleBrowser("auth.mjs");
	 *
	 * @example
	 * // Custom resolver — user supplies resolveModuleSpecifier:
	 * // config.resolveModuleSpecifier = ({ path }) => `https://cdn.example.com/api/${path}`;
	 * await this.#loadModuleBrowser("auth.mjs");
	 */
	async #loadModuleBrowser(filePath) {
		// Use the user-supplied resolver, or fall back to resolving relative to config.base.
		// Plain filesystem paths (no URL scheme) are automatically converted to file:// URLs
		// so callers can pass base: "/path/to/api" without manually prefixing "file://".
		const resolveModuleSpecifier =
			this.slothlet.config?.resolveModuleSpecifier ??
			(({ path: p }) => {
				// `?? config?.dir ?? ""` chain: transformConfig sets both `base` and
				// `dir` to the same resolved value, so `config?.base ?? ...` always
				// hits the first arm in normal flow. Both fallback arms are defensive.
				/* v8 ignore next */
				const base = this.slothlet.config?.base ?? this.slothlet.config?.dir ?? "";
				// If base already has a URL scheme (file://, https://, etc.) keep it; otherwise
				// convert a plain filesystem path to a file:// URL with a trailing slash so that
				// new URL(relativePath, base) resolves correctly.
				// Windows-style paths (e.g. "C:/api" — no leading slash) take the
				// `: "/"` arm of the inline conditional. The Node-only test runner
				// runs under POSIX paths and cannot exercise the Windows branch
				// without an actual Windows filesystem — passing a custom resolver
				// bypasses this code path entirely.
				/* v8 ignore next */
				const leadingSlash = base.startsWith("/") ? "" : "/";
				const baseUrl = /^[a-zA-Z][\w+\-.]*:\/\//.test(base)
					? base.endsWith("/")
						? base
						: base + "/"
					: "file://" + leadingSlash + base.replace(/\/?$/, "/");
				return new URL(p, baseUrl).href;
			});

		const fullName = filePath.split("/").pop();
		const lastDot = fullName.lastIndexOf(".");
		// Ternary false-arm (lastDot < 0) is unreachable: files reaching
		// #loadModuleBrowser have already passed #manifestNodeToStructure's
		// ALLOWED_EXTS filter, which requires a dot + recognised JS extension.
		/* v8 ignore next */
		const name = lastDot >= 0 ? fullName.slice(0, lastDot) : fullName;

		const specifier = resolveModuleSpecifier({ path: filePath, name, fullName });
		const module = await import(specifier);
		return module;
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
