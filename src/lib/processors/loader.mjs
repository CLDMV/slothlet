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
import { ComponentBase } from "#factories/component-base";
import { DEFAULT_API_DEPTH } from "@cldmv/slothlet/helpers/defaults";

// Node-only static imports resolved via top-level await so `node:*` never
// enters the static-import graph in browser bundles. The filesystem-scanning
// and CJS-loader methods on Loader are Node-only; browser mode uses
// #scanDirectoryBrowser / #loadModuleBrowser which walk the manifest tree.
// fs/promises + path + url + module builtins resolved in the platform module (#123); the loader's
// disk-scanning / CJS-loader methods are Node-only (browser mode uses #scanDirectoryBrowser /
// #loadModuleBrowser over the manifest tree), so they reference the namespaces directly — null in a
// browser, but those methods never run there, so no per-call guard is needed.
import { fsp, path, url, createRequire } from "@cldmv/slothlet/helpers/platform";
import { compilePattern } from "@cldmv/slothlet/helpers/pattern-matcher";
import { isFrameworkReservedKey } from "#handlers/unified-wrapper";
import { SlothletWarning } from "@cldmv/slothlet/errors";
import { installInstanceImportHooks, requireInInstance } from "@cldmv/slothlet/helpers/instance-imports";

/**
 * Whether THIS copy of slothlet runs outside a bundler/test-runner module graph.
 *
 * Vite-family transforms inject `import.meta.env` into every module they process; native ESM has
 * no such property. Computed once at module scope — it is a property of how this file was loaded.
 * @type {boolean}
 */
// --- API-RULES condition markers (see docs/API-RULES/API-DISCOVERY-CONDITIONS.md) ---
// Rule 14 (G01): Loadable-extension gate — ~L521
// Rule 14 (G02): Hidden folder exclusion (dot/__) — ~L493
// Rule 14 (G03): Hidden file exclusion (dot/__) — ~L524
// Rule 14 (G04): Consumer `hidden` glob exclusion — ~L496 / ~L544
// Rule 14 (G05): fileFilter single-file gate — ~L487 / ~L529
// Rule 14, Rule 3 (G06): Empty container → no leaf — ~L511
// Rule 14 (G07): Depth / non-recursive truncation — ~L501
// Rule 14 (G08): Reserved-filename rejection — ~L553
// Rule 15 (G14): CJS interop export shaping — ~L368 / ~L807 / ~L826

const RUNTIME_EXTERNALIZED = !("env" in import.meta);

/**
 * Warns when a coverage run will silently misattribute the consumer's leaf coverage (#235).
 *
 * @param {object} config - The instance's transformed config.
 * @param {object} [overrides] - Environment inputs, injectable for tests.
 * @param {object|undefined} [overrides.worker] - The vitest worker global, when present.
 * @param {boolean} [overrides.externalized] - Whether this slothlet copy is outside the runner's
 *   module graph.
 * @returns {boolean} True when the warning was emitted.
 * @package
 *
 * @description
 * Fires only when every condition of the misattribution scenario holds: a vitest COVERAGE run is
 * active (`__vitest_worker__.config.coverage.enabled` — a plain test run stays silent), this
 * slothlet copy is EXTERNALIZED (an inlined copy attributes fine), no `import` importer is
 * configured (the fix), and the instance is not `silent`. The worker global is vitest-internal,
 * so it is read defensively — its absence or a shape change simply means no hint, never a wrong
 * one. Detection cannot DO the fix: the importer must be a closure authored in the consumer's own
 * transformed code, which is why this is a pointer to docs/TESTING.md rather than an auto-enable.
 */
export function warnIfCoverageWithoutImporter(config, { worker = globalThis.__vitest_worker__, externalized = RUNTIME_EXTERNALIZED } = {}) {
	if (worker?.config?.coverage?.enabled !== true) return false;
	if (!externalized) return false;
	if (typeof config?.import === "function") return false;
	if (config?.silent) return false;
	new SlothletWarning("WARNING_COVERAGE_IMPORTER_UNSET", {});
	return true;
}

/**
 * Whether a coverage run is collecting this process's coverage (#484).
 *
 * @param {object} [overrides] - Environment inputs, injectable for tests.
 * @param {object|undefined} [overrides.worker] - The vitest worker global, when present.
 * @param {object} [overrides.env] - The environment variables to read (default `process.env`).
 * @returns {boolean} True under a vitest coverage run or a native/c8 `NODE_V8_COVERAGE` run.
 * @package
 *
 * @description
 * A vitest coverage run is read from `__vitest_worker__.config.coverage.enabled`, exactly as
 * {@link warnIfCoverageWithoutImporter} reads it: the global is vitest-internal, so a missing or
 * reshaped value means "not detected", never a throw. A native or c8 run is read from
 * `NODE_V8_COVERAGE`, which Node itself honours to write coverage (and each loaded module's source
 * map) for the process.
 */
export function isCoverageRun({ worker = globalThis.__vitest_worker__, env = globalThis.process?.env } = {}) {
	if (worker?.config?.coverage?.enabled === true) return true;
	return typeof env?.NODE_V8_COVERAGE === "string" && env.NODE_V8_COVERAGE.length > 0;
}

/**
 * The effective `sourcemap` setting for TypeScript transforms (#484).
 *
 * @param {object} typescriptConfig - The instance's normalized `typescript` config.
 * @param {object} [overrides] - Environment inputs forwarded to {@link isCoverageRun}.
 * @returns {boolean} True when transpiled output should carry an inline source map.
 * @package
 *
 * @description
 * An explicit boolean wins. When `sourcemap` is not set, source maps are on exactly during a
 * coverage run: a TypeScript leaf executes from its `.slothlet-cache/` copy, and the inline map is
 * the only way coverage can be remapped onto the `.ts` source.
 */
export function resolveSourcemap(typescriptConfig, overrides) {
	const explicit = typescriptConfig?.sourcemap;
	if (typeof explicit === "boolean") return explicit;
	return isCoverageRun(overrides);
}

/**
 * Warns when a coverage run loads TypeScript leaves with source maps explicitly off (#484).
 *
 * @param {object} config - The instance's transformed config.
 * @param {object} [overrides] - Environment inputs forwarded to {@link isCoverageRun}.
 * @returns {boolean} True when the warning was emitted.
 * @package
 *
 * @description
 * Without the inline map, coverage for a TypeScript leaf is recorded against its cache copy and
 * can never reach the `.ts` source. The Loader calls this once per instance, on the first
 * TypeScript leaf it loads; a `silent` instance stays quiet.
 */
export function warnIfCoverageWithoutSourcemap(config, overrides) {
	if (config?.typescript?.sourcemap !== false) return false;
	if (config?.silent) return false;
	if (!isCoverageRun(overrides)) return false;
	new SlothletWarning("WARNING_COVERAGE_TS_SOURCEMAP_OFF", {});
	return true;
}

/**
 * Compile a `hidden` option (a glob string or array of globs) into a matcher, or null when there's
 * nothing to hide. Globs match an entry's path relative to the API root, built from the RAW on-disk
 * directory/file names — NOT the sanitized API keys. For a file that's the extension-stripped dotted
 * path (so `secret/config.mjs` matches `secret.config`); a folder `draft-notes` (surfaced as
 * `api.draftNotes`) matches `draft-notes`, not `draftNotes`. Reuses slothlet's dot-separated glob
 * dialect: `*` matches one segment, `**` any depth, `?` one char, `{a,b}` alternation. Globs may be
 * written folder-style (`a/b`) — `/` is normalized to `.`.
 * @param {string|string[]|null} globs - Hidden glob(s).
 * @returns {?function(string): boolean} Matcher over the dot-joined relative path, or null.
 * @private
 */
function compileHidden(globs) {
	if (!globs) return null;
	const list = Array.isArray(globs) ? globs : [globs];
	const rules = [];
	for (const g of list) {
		if (typeof g !== "string" || g.length === 0) continue;
		const negated = g.startsWith("!");
		// Compile the pattern BODY (without a leading "!") as a positive matcher; the "!" is applied here
		// as gitignore-style un-hiding, NOT via compilePattern's "match everything except" semantics —
		// those don't compose under a hide-list (a single `!x` would then hide everything except x).
		const body = (negated ? g.slice(1) : g).replace(/\//g, ".");
		if (body.length === 0) continue; // bare "!" — nothing to match
		rules.push({ negated, match: compilePattern(body) });
	}
	if (!rules.length) return null;
	// Evaluate in order, last matching rule wins: a normal glob hides a matched path; a `!`-prefixed glob
	// un-hides paths an earlier glob hid (gitignore semantics).
	return (relDotted) => {
		let hidden = false;
		for (const rule of rules) {
			if (rule.match(relDotted)) hidden = !rule.negated;
		}
		return hidden;
	};
}

/**
 * Parse JSON text, returning null when it is not valid JSON.
 * @param {string} text - JSON text.
 * @returns {*} The parsed value, or null.
 * @example
 * parseJsonOrNull('{"type":"module"}'); // { type: "module" }
 * @private
 */
function parseJsonOrNull(text) {
	try {
		return JSON.parse(text);
	} catch {
		return null;
	}
}

/**
 * Loader component for module loading, directory scanning, and API merging
 * @class Loader
 * @extends ComponentBase
 * @package
 */
/**
 * Absolute path of the worker strict TypeScript mode forks to generate the api's declaration file. It
 * lives next to this module, so it ships wherever the loader does (`dist/lib/processors/` when
 * installed) (#500). Resolved on call, from the Node-only strict-mode path: `path`/`url` are `null`
 * in browser mode, and the literal `new URL("./…", import.meta.url)` form is avoided because bundlers
 * and vite treat it as a module reference and load the worker into the current process.
 * @returns {string} Absolute path of `type-generation-worker.mjs`.
 * @internal
 * @example
 * fork(typeGenerationWorkerPath(), [], { stdio: ["pipe", "pipe", "pipe", "ipc"] });
 */
export function typeGenerationWorkerPath() {
	return path.join(path.dirname(url.fileURLToPath(import.meta.url)), "type-generation-worker.mjs");
}

/**
 * Whether this loader copy has registered the per-instance helper-import resolve hook (#518).
 * @type {boolean}
 * @private
 */
let instanceImportHooksInstalled = false;

/**
 * Register the Node resolve hook that carries a leaf's `?slothlet_instance=…` query onto the
 * relative helpers it imports, once per process. Node-only: called from the disk-loading path,
 * never in browser mode. `node:module` is read through the platform's createRequire rather than an
 * `import("node:module")` literal, which would pull a `node:` specifier into browser bundles.
 * @returns {void}
 * @private
 */
function ensureInstanceImportHooks() {
	if (instanceImportHooksInstalled) return;
	instanceImportHooksInstalled = installInstanceImportHooks(createRequire(import.meta.url)("node:module"));
}

export class Loader extends ComponentBase {
	static slothletProperty = "loader";

	/**
	 * Whether the one-shot TypeScript-coverage source-map check has run for this instance (#484).
	 * @type {boolean}
	 * @private
	 */
	#coverageSourcemapChecked = false;

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
			// A `.js` file Node treats as CommonJS (#521) takes the same path as `.cjs`. Its relative
			// requires share one private cache per instance (#518) — kept across partial reloads, like ESM helpers.
			// The hooks serve its require() of an ES module the instance's copy (#534).
			if (filePath.endsWith(".cjs") || (filePath.endsWith(".js") && (await this.#isCommonJSFile(filePath)))) {
				ensureInstanceImportHooks();
				return this.#loadCJSIsolated(filePath, instanceID);
			}

			// Relative helpers a leaf imports must follow the leaf's per-instance query (#518): the
			// process-wide resolve hook copies it onto every relative/`file:` child below the leaf.
			ensureInstanceImportHooks();

			// Check if TypeScript transformation is needed
			const isTypeScript = filePath.endsWith(".ts") || filePath.endsWith(".mts");
			const typescriptConfig = this.slothlet.config?.typescript;

			let moduleUrl;

			if (isTypeScript && typescriptConfig?.enabled) {
				const mode = typescriptConfig.mode;
				// Source maps: explicit setting, else on during a coverage run (#484).
				const sourcemap = resolveSourcemap(typescriptConfig);
				if (!this.#coverageSourcemapChecked) {
					this.#coverageSourcemapChecked = true;
					warnIfCoverageWithoutSourcemap(this.slothlet.config);
				}
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

						// The worker ships next to this file (src/lib/processors → dist/lib/processors).
						const scriptPath = typeGenerationWorkerPath();

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
					const { transformTypeScriptStrict, writeTransformedToCache, formatDiagnostics, getTypeScript } =
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
							compilerOptions: typescriptConfig.compilerOptions,
							sourcemap
						});
						// Check for type errors
						if (result.diagnostics && result.diagnostics.length > 0) {
							// Route through the same guarded loader transformTypeScriptStrict just used
							// (memoized — this is not a second capability check) so a TypeScript 7
							// install without the compiler API is reported the same way here as there.
							const ts = await getTypeScript();
							const errors = formatDiagnostics(result.diagnostics, ts);

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
						sourcemap
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

			// Injectable importer (#235): a consumer's test runner can only attribute leaf execution
			// it loads itself, so a configured importer receives the exact cache-busted URL and its
			// module namespace is used unchanged — per-instance isolation, mount identity, and reload
			// busting ride the URL either way; only whose import() executes differs.
			const customImport = this.slothlet?.config?.import;
			const module = customImport ? await customImport(moduleUrl) : await import(moduleUrl);
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
	 * Load a CJS module with a fresh module.exports on every call, and give its relative
	 * dependency graph one copy per instance (#518, #534).
	 * Node's require() cache is keyed on the resolved file path and ignores URL
	 * query parameters, so two Slothlet instances loading the same .cjs file
	 * would otherwise share the exact same module.exports object — and so would
	 * every helper the leaf require()s.
	 *
	 * The leaf itself is always evaluated fresh. The instance-scoped files it reaches are served from
	 * the instance's private CommonJS cache — shared by every mount and kept across partial reloads; a
	 * full reload rotates the instance ID and so starts a fresh one — and an ES module it require()s is
	 * the instance's copy of that module (see requireInInstance in helpers/instance-imports).
	 * @param {string} filePath - Absolute path to the .cjs file
	 * @param {string} scopeKey - The instance ID whose helper copies the leaf's requires are served from
	 * @returns {Object} Synthetic ESM namespace: { default, ...namedExports }
	 * @example
	 * const ns = this.#loadCJSIsolated("/path/to/module.cjs", "inst");
	 * ns.default; // module.exports
	 * @private
	 */
	#loadCJSIsolated(filePath, scopeKey) {
		const exports = requireInInstance(filePath, scopeKey, { fresh: true });

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
		// import() of a CommonJS file exposes a "module.exports" binding, which is how the ownership index
		// recognises a CommonJS namespace whose file is not named `.cjs` (a CommonJS `.js`, #521). It is
		// non-enumerable so every key walk over the namespace sees exactly the exports listed above.
		Object.defineProperty(namespace, "module.exports", { value: exports, enumerable: false });
		return namespace;
	}

	/**
	 * Per-directory cache of the nearest package.json `type` scope, so a tree of `.js` leaves reads each
	 * package.json once. Values: `"module"`, `"commonjs"`, `"none"` (no package.json / no `type`), or
	 * `"invalid"` (unreadable or malformed package.json — left for Node's own loader to report).
	 * @type {Map<string, string>}
	 * @private
	 */
	#packageTypeCache = new Map();

	/**
	 * Resolve the `type` of the package scope a directory belongs to, the way Node does: walk up to the
	 * nearest `package.json` (the first one found ends the walk, with or without a `type`), stopping at a
	 * `node_modules` boundary or the filesystem root.
	 * @param {string} dir - Absolute directory of the file being loaded.
	 * @returns {Promise<string>} `"module"`, `"commonjs"`, `"none"`, or `"invalid"`.
	 * @example
	 * await this.#packageScopeType("/abs/api/counter"); // "commonjs"
	 * @private
	 */
	async #packageScopeType(dir) {
		const visited = [];
		let current = dir;
		let type = "none";
		for (;;) {
			const cached = this.#packageTypeCache.get(current);
			if (cached !== undefined) {
				type = cached;
				break;
			}
			visited.push(current);
			const raw = await fsp.readFile(path.join(current, "package.json"), "utf8").catch(() => null);
			if (raw !== null) {
				const pkg = parseJsonOrNull(raw);
				// Node rejects a package.json that is not a JSON object (ERR_INVALID_PACKAGE_CONFIG) and
				// ignores a `type` other than "module" / "commonjs".
				if (pkg === null || typeof pkg !== "object" || Array.isArray(pkg)) type = "invalid";
				else type = pkg.type === "module" || pkg.type === "commonjs" ? pkg.type : "none";
				break;
			}
			const parent = path.dirname(current);
			if (parent === current || path.basename(current) === "node_modules") break;
			current = parent;
		}
		for (const d of visited) this.#packageTypeCache.set(d, type);
		return type;
	}

	/**
	 * Whether Node loads this `.js` file as CommonJS (#521).
	 * @param {string} filePath - Absolute path to a `.js` file.
	 * @returns {Promise<boolean>} True when the file is CommonJS and must take the isolated CJS path.
	 * @example
	 * if (await this.#isCommonJSFile("/abs/api/counter.js")) return this.#loadCJSIsolated(...);
	 * @private
	 *
	 * @description
	 * Mirrors Node's own format resolution for `.js`:
	 * - nearest package.json `"type": "module"` → ES module;
	 * - `"type": "commonjs"` → CommonJS, with no syntax detection (Node reports ESM syntax there as an
	 *   error either way);
	 * - no `type` (or no package.json) → Node's syntax detection: the source is compiled as a CommonJS
	 *   function body, exactly as Node's CJS loader wraps it; when that compiles, Node loads the file as
	 *   CommonJS, and when it throws (an `import`/`export` statement, `import.meta`, top-level `await`, or
	 *   a genuine syntax error), the file is left to `import()` so Node itself decides — loading it as
	 *   an ES module or reporting the error.
	 * - an unreadable/malformed package.json → `import()`, which surfaces Node's own error.
	 */
	async #isCommonJSFile(filePath) {
		const type = await this.#packageScopeType(path.dirname(filePath));
		if (type === "commonjs") return true;
		if (type !== "none") return false;
		const { compileFunction } = await import("node:vm");
		// A leading hashbang is valid in a CommonJS file (Node strips it) but not in a function body.
		const source = (await fsp.readFile(filePath, "utf8")).replace(/^#!.*/, "");
		try {
			compileFunction(source, ["exports", "require", "module", "__filename", "__dirname"], { filename: filePath });
			return true;
		} catch {
			return false;
		}
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
	 * @param {number} [options.maxDepth=DEFAULT_API_DEPTH] - Maximum traversal depth ({@link DEFAULT_API_DEPTH})
	 * @param {Function|null} [options.fileFilter=null] - Optional filter function (fileName) => boolean to load specific files only
	 * @param {string|string[]|Function|null} [options.hidden=null] - Glob(s) hiding files/folders, matched against each entry's
	 *   path relative to the API root (extension-stripped for files). Internal recursion passes the compiled matcher function.
	 * @param {boolean} [options.scanHiddenFolders=false] - Deprecated: restore the pre-v3.11 scanning of `.`/`__`-prefixed folders.
	 * @param {string} [options.rootDir] - API root the relative hidden-glob paths are computed from (defaults to the scanned dir).
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
			maxDepth = DEFAULT_API_DEPTH,
			fileFilter = null,
			hidden = null,
			scanHiddenFolders = false,
			rootDir = dir
		} = options;

		// Compile the hidden matcher once (on the root scan); recursion receives the compiled function.
		const hiddenMatcher = typeof hidden === "function" ? hidden : compileHidden(hidden);
		// `.`/`__`-prefixed entries are hidden by default. The deprecated `scanHiddenFolders` opt-out
		// restores the pre-v3.11 behavior of scanning such *folders* (files keep the prefix skip).
		const apiRel = (p) => path.relative(rootDir, p).split(path.sep).join(".");
		const hasHiddenPrefix = (name) => name.startsWith(".") || name.startsWith("__");

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

				// Built-in: skip `.`/`__`-prefixed folders (unless the deprecated opt-out is set), then
				// skip folders matched by the consumer-supplied `hidden` glob(s).
				if (!scanHiddenFolders && hasHiddenPrefix(entry.name)) {
					continue;
				}
				if (hiddenMatcher && hiddenMatcher(apiRel(fullPath))) {
					continue;
				}

				// Only recurse if within depth limit
				if (recursive && currentDepth < maxDepth) {
					const subStructure = await this.scanDirectory(fullPath, {
						...options,
						isRootScan: false,
						currentDepth: currentDepth + 1,
						hidden: hiddenMatcher,
						scanHiddenFolders,
						rootDir
					});
					// #156: a folder that yields no files and no kept subfolders must not create a leaf.
					if (subStructure.files.length === 0 && subStructure.directories.length === 0) {
						continue;
					}
					structure.directories.push({
						path: fullPath,
						name: entry.name,
						children: subStructure
					});
				}
			} else if (entry.isFile()) {
				const ext = path.extname(entry.name);
				if (extensions.includes(ext)) {
					// Built-in: skip `.`/`__`-prefixed files (JSDoc-only, test helpers, dotfiles, etc.).
					if (hasHiddenPrefix(entry.name)) {
						continue;
					}

					// Apply file filter if provided
					if (fileFilter && !fileFilter(entry.name)) {
						continue;
					}

					const nameWithoutExt = path.basename(entry.name, ext);

					// Reserved-name rejection (#260): a module file named for a framework-reserved key
					// would overwrite the framework's own handle when its children are adopted — the
					// `_materialize.mjs` shape used to break composition with a bare TypeError, and
					// `_impl.mjs` silently emptied the lazy surface. Fail the scan with a named error
					// instead. Only names the hidden-prefix skip above does NOT already exclude can
					// reach this (the single-underscore reserved names).
					//
					// Skip files matched by the consumer-supplied `hidden` glob(s), evaluated against the
					// file's extension-stripped API path relative to the API root.
					if (hiddenMatcher && hiddenMatcher(apiRel(path.join(dir, nameWithoutExt)))) {
						continue;
					}

					// Checked LAST, after every exclusion: the refusal covers the files this mount
					// actually loads. A single-file `api.add` filters the listing down to one file, and
					// `hidden` globs drop files the consumer has excluded — neither reaches the composed
					// surface, so neither is this mount's problem. Each fails on its own the moment
					// something does try to compose it.
					if (isFrameworkReservedKey(nameWithoutExt)) {
						throw new this.SlothletError("MODULE_RESERVED_FILENAME", { file: entry.name, dir }, null, { validationError: true });
					}

					structure.files.push({
						path: fullPath,
						name: nameWithoutExt,
						fullName: entry.name,
						moduleID: this.slothlet.helpers.sanitize.getModuleId(fullPath, dir)
					});
				}
			}
		}

		// Warn if directory is empty or has no loadable modules (only for root scans or add-api workflows).
		// Console warning honors `silent`, consistent with every other SlothletWarning site.
		if (isRootScan && structure.files.length === 0 && structure.directories.length === 0 && !this.____config?.silent) {
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
		// Mirror the disk scan's inclusion gating so browser-manifest mode honors the same runtime
		// options: consumer `hidden` glob, `apiDepth`/`maxDepth`, `scanHiddenFolders`, dot/`__`-prefix
		// skip, and empty-subtree pruning (#423). `apiPrefix` accumulates the dotted api-relative path
		// through recursion (browser has no `node:path` for a `path.relative`-based apiRel).
		const {
			fileFilter = null,
			hidden = null,
			scanHiddenFolders = false,
			maxDepth = DEFAULT_API_DEPTH,
			currentDepth = 0,
			apiPrefix = ""
		} = options;
		const ALLOWED_EXTS = [".mjs", ".cjs", ".js"];
		const hiddenMatcher = typeof hidden === "function" ? hidden : compileHidden(hidden);
		const hasHiddenPrefix = (n) => n.startsWith(".") || n.startsWith("__");
		const structure = { files: [], directories: [] };

		for (const file of node.files || []) {
			const filePath = file.path || file.relativePath || "";
			const fullName = file.fullName || filePath.split("/").pop();
			const lastDot = fullName.lastIndexOf(".");
			const ext = lastDot >= 0 ? fullName.slice(lastDot) : "";

			// Skip non-JS files and dot/double-underscore helpers.
			if (!ALLOWED_EXTS.includes(ext)) continue;
			if (hasHiddenPrefix(fullName)) continue;

			// Apply caller-supplied file filter (used for single-file api.add calls).
			if (fileFilter && !fileFilter(fullName)) continue;

			// Inner ternary's false-arm (lastDot < 0) is unreachable here: the
			// ALLOWED_EXTS check above (`continue` when ext === "") filters out any
			// file without a dot in its fullName before reaching this name fallback.
			/* v8 ignore next */
			const name = file.name || (lastDot >= 0 ? fullName.slice(0, lastDot) : fullName);

			// Consumer `hidden` glob, matched against the file's extension-stripped api-relative
			// dotted path — same semantics as the disk scan.
			if (hiddenMatcher && hiddenMatcher(apiPrefix ? `${apiPrefix}.${name}` : name)) continue;

			// Reserved-name rejection (#260), mirroring the filesystem scan. The hazard is the
			// composed wrapper shape, not the platform: a manifest carrying `_impl.mjs` would empty
			// the lazy surface in a browser exactly as it does under Node.
			if (isFrameworkReservedKey(name)) {
				throw new this.SlothletError("MODULE_RESERVED_FILENAME", { file: fullName, dir: rootPath }, null, { validationError: true });
			}

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
				const dirName = dir.name || dirPath.split("/").pop();

				// dot/`__`-prefixed folders are hidden unless the deprecated scanHiddenFolders opt-out
				// is set; then apply the consumer `hidden` glob against the folder's api-relative path.
				if (!scanHiddenFolders && hasHiddenPrefix(dirName)) continue;
				const dirApiRel = apiPrefix ? `${apiPrefix}.${dirName}` : dirName;
				if (hiddenMatcher && hiddenMatcher(dirApiRel)) continue;

				// apiDepth / maxDepth truncation: don't descend past the limit.
				if (currentDepth >= maxDepth) continue;

				const children = this.#manifestNodeToStructure(dir.children || dir, dirPath, {
					...options,
					hidden: hiddenMatcher,
					currentDepth: currentDepth + 1,
					apiPrefix: dirApiRel
				});

				// A folder that yields no files and no kept subfolders must not create a leaf (#156).
				if (children.files.length === 0 && children.directories.length === 0) continue;

				structure.directories.push({ path: dirPath, name: dirName, children });
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
				// Reserved-name rejection (#260): an export named for a framework-reserved key
				// (`_materialize`, `__impl`, …) can only ever be shadowed by the framework's own
				// handle — it is unreachable on the composed surface and a standing hazard to the
				// wrapper contract. Refuse it loudly at load instead of silently coexisting, so the
				// module author learns at the file, not from a distant behavioral surprise.
				if (isFrameworkReservedKey(key)) {
					throw new this.SlothletError("MODULE_RESERVED_EXPORT", { name: key }, null, { validationError: true });
				}
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
