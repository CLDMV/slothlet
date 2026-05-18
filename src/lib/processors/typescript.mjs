/**
 *	@Project: @cldmv/slothlet
 *	@Filename: /src/lib/processors/typescript.mjs
 *	@Date: 2026-02-14T14:39:47-08:00 (1771108787)
 *	@Author: Nate Corcoran <CLDMV>
 *	@Email: <Shinrai@users.noreply.github.com>
 *	-----
 *	@Last modified by: Nate Corcoran <CLDMV> (Shinrai@users.noreply.github.com)
 *	@Last modified time: 2026-03-05 17:08:03 -08:00 (1772759283)
 *	-----
 *	@Copyright: Copyright (c) 2013-2026 Catalyzed Motivation Inc. All rights reserved.
 */

/**
 * @fileoverview TypeScript file transformation using esbuild (fast mode)
 * @module @cldmv/slothlet/processors/typescript
 * @internal
 */

// NO static imports of esbuild/typescript - only dynamic imports when needed
import fs from "fs";
import path from "path";
import { writeFile, mkdir, readdir, rm } from "node:fs/promises";
import { createHash } from "node:crypto";
import { tmpdir } from "node:os";
import { pathToFileURL } from "node:url";
import { SlothletError } from "@cldmv/slothlet/errors";

let esbuildInstance = null;
let typescriptInstance = null;

/**
 * Lazy-load esbuild to avoid requiring installation when not using TypeScript
 * @returns {Promise<object>} esbuild module
 * @throws {SlothletError} TYPESCRIPT_ESBUILD_NOT_INSTALLED if esbuild is not installed
 * @private
 */
async function getEsbuild() {
	if (!esbuildInstance) {
		try {
			esbuildInstance = await import("esbuild");
			// unreachable via tests: esbuild is a devDependency always present during testing.
			// The catch only fires in end-user environments where esbuild is not installed.
			/* v8 ignore start */
		} catch (error) {
			throw new SlothletError("TYPESCRIPT_ESBUILD_NOT_INSTALLED", { mode: "fast" }, error);
		}
		/* v8 ignore stop */
	}
	return esbuildInstance;
}

/**
 * Lazy-load TypeScript compiler to avoid requiring installation when not using strict mode
 * @returns {Promise<object>} typescript module
 * @throws {SlothletError} TYPESCRIPT_TSC_NOT_INSTALLED if typescript is not installed
 * @private
 */
async function getTypeScript() {
	if (!typescriptInstance) {
		try {
			typescriptInstance = await import("typescript");
			// unreachable via tests: typescript is a devDependency always present during testing.
			// The catch only fires in end-user environments where typescript is not installed.
			/* v8 ignore start */
		} catch (error) {
			throw new SlothletError("TYPESCRIPT_TSC_NOT_INSTALLED", { mode: "strict" }, error);
		}
		/* v8 ignore stop */
	}
	return typescriptInstance;
}

/**
 * Transform TypeScript code to JavaScript using esbuild
 * @param {string} filePath - Path to the TypeScript file
 * @param {object} [options={}] - esbuild transform options
 * @param {string} [options.target] - ECMAScript target version (default: "es2020")
 * @param {string} [options.format] - Module format (default: "esm")
 * @param {boolean} [options.sourcemap] - Generate source maps (default: false)
 * @returns {Promise<string>} Transformed JavaScript code
 * @throws {SlothletError} If transformation fails
 * @public
 */
export async function transformTypeScript(filePath, options = {}) {
	const esbuild = await getEsbuild(); // Lazy load - only when actually needed
	const code = fs.readFileSync(filePath, "utf8");

	const result = await esbuild.transform(code, {
		loader: "ts",
		format: options.format || "esm",
		target: options.target || "es2020",
		sourcemap: options.sourcemap || false,
		...options
	});

	return result.code;
}

/**
 * Create a data URL for dynamic import with cache busting
 * @param {string} code - JavaScript code to encode
 * @returns {string} Data URL suitable for dynamic import
 * @public
 */
export function createDataUrl(code) {
	// Use proper JavaScript MIME type
	const encoded = encodeURIComponent(code);
	const timestamp = Date.now();
	return `data:text/javascript;charset=utf-8,${encoded}#t=${timestamp}`;
}

/**
 * Walk up from a file or directory until a package.json is found.
 * Node's ESM resolver anchors bare-specifier resolution at the importer's URL
 * and walks parent directories looking for node_modules; the package root is
 * the natural anchor for that walk.
 *
 * `startPath` is resolved to an absolute path first, so the return value is
 * always absolute even when the caller passes a relative path — downstream
 * code (`pathToFileURL`, cache writes) must not depend on the process cwd.
 * @param {string} startPath - File or directory to walk up from (relative or absolute)
 * @returns {string|null} Absolute path to the package root, or null if none found
 * @private
 */
function findPackageRoot(startPath) {
	let dir;
	try {
		const resolved = path.resolve(startPath);
		dir = fs.statSync(resolved).isFile() ? path.dirname(resolved) : resolved;
	} catch {
		return null;
	}
	while (true) {
		if (fs.existsSync(path.join(dir, "package.json"))) return dir;
		const parent = path.dirname(dir);
		if (parent === dir) return null;
		dir = parent;
	}
}

/**
 * Probe whether a PID identifies a live process.
 *
 * Sends signal 0 — a no-op probe that does NOT kill anything. Only `ESRCH`
 * ("no such process") is treated as definitively dead. Every other outcome —
 * `EPERM` (process exists, we lack permission to signal it) and any other
 * unexpected error code — is treated as alive. This is deliberately
 * fail-safe: the caller (`sweepStaleSlothletCache`) deletes cache dirs whose
 * owner is dead, so when the liveness of a PID is uncertain we must err
 * toward "alive" and keep the dir rather than risk deleting a live
 * instance's cache.
 * @param {number} pid
 * @returns {boolean} `false` only when the process is confirmed gone (ESRCH).
 * @private
 */
function isProcessAlive(pid) {
	try {
		process.kill(pid, 0);
		return true;
	} catch (err) {
		// Fail-safe: only a confirmed ESRCH means dead; anything else → alive.
		return err.code !== "ESRCH";
	}
}

const sweepPromises = new Map();

/**
 * Best-effort sweep of orphaned cache dirs left behind by processes that exited
 * without running `shutdown()` (SIGKILL, OOM, crash, forgotten shutdown call).
 * Cache dir names are prefixed with the owning PID so we can detect dead owners
 * passively via `process.kill(pid, 0)`. Memoized per project root per process.
 *
 * Failures are swallowed — cleanup is opportunistic, not load-bearing.
 * Unrecognized dir names (no `<pid>-` prefix) are left alone.
 * @param {string} projectRoot - Project root that owns the `.slothlet-cache/` directory
 * @returns {Promise<void>}
 * @private
 */
function sweepStaleSlothletCache(projectRoot) {
	if (sweepPromises.has(projectRoot)) return sweepPromises.get(projectRoot);
	const promise = (async () => {
		const cacheRoot = path.join(projectRoot, ".slothlet-cache");
		let entries;
		try {
			entries = await readdir(cacheRoot, { withFileTypes: true });
		} catch {
			return;
		}
		const currentPid = process.pid;
		await Promise.allSettled(
			entries.map(async (entry) => {
				if (!entry.isDirectory()) return;
				const match = entry.name.match(/^(\d+)-/);
				if (!match) return;
				const pid = Number(match[1]);
				if (pid === currentPid || isProcessAlive(pid)) return;
				await rm(path.join(cacheRoot, entry.name), { recursive: true, force: true });
			})
		);
	})();
	sweepPromises.set(projectRoot, promise);
	return promise;
}

/**
 * Rewrite relative `import`/`export` specifiers in transformed TS output to
 * absolute `file://` URLs anchored at the **original source directory**.
 *
 * Transformed TS modules are written to (and imported from) a cache file under
 * `.slothlet-cache/…`, which is not co-located with the original source.
 * esbuild and tsc transform the code but never rewrite specifiers, so a
 * relative specifier (`./sibling.mjs`, `../shared/util.mjs`) left as-is would
 * resolve against the cache directory and fail with `Cannot find module`.
 * Each relative specifier is therefore resolved against the real on-disk
 * source location and emitted as an absolute `file://` URL, which resolves
 * identically no matter where the importing cache file lives.
 *
 * Only `./`- and `../`-prefixed specifiers are rewritten. Bare specifiers
 * (`@cldmv/slothlet/runtime`, npm packages) and absolute URLs are left
 * untouched — Node resolves bare specifiers by walking up to `node_modules`,
 * which works because the cache lives inside the project tree.
 *
 * Covered statement forms: static `import`/`export … from` declarations
 * (including multi-line binding lists and `export *`), bare side-effect
 * `import "…"`, and dynamic `import("…")` with a static string literal. A
 * relative specifier that resolves to another `.ts`/`.mts` file is rewritten
 * too, but will still fail to load — Node has no loader for those extensions;
 * slothlet wires TS modules together through `self.*`, not relative imports.
 * @param {string} code - Transformed JavaScript (ESM) code
 * @param {string} sourcePath - Absolute path to the original .ts/.mts source
 * @returns {string} Code with relative specifiers rewritten to absolute file URLs
 * @private
 */
export function rewriteRelativeSpecifiers(code, sourcePath) {
	const sourceDir = path.dirname(sourcePath);
	/**
	 * Resolve one relative specifier against the source directory, preserving
	 * any `?query`/`#hash` suffix (only the path portion is resolved).
	 * @param {string} specifier - The relative specifier (`./…` or `../…`)
	 * @returns {string} Absolute `file://` URL with the original suffix reattached
	 */
	const toAbsoluteUrl = (specifier) => {
		const suffixIdx = specifier.search(/[?#]/);
		const pathPart = suffixIdx === -1 ? specifier : specifier.slice(0, suffixIdx);
		const suffix = suffixIdx === -1 ? "" : specifier.slice(suffixIdx);
		return pathToFileURL(path.resolve(sourceDir, pathPart)).href + suffix;
	};
	return (
		code
			// `import … from "./x"` / `export … from "./x"` / `export * from "./x"`.
			// Line-anchored: transformed ESM always hoists these to the top level,
			// so this never matches `from "./x"`-shaped text inside a string literal.
			.replace(
				/^([ \t]*(?:import|export)\b[^"'`;]*?\bfrom\s*)(["'])(\.\.?\/[^"']*)\2/gm,
				(_m, pre, q, spec) => `${pre}${q}${toAbsoluteUrl(spec)}${q}`
			)
			// Bare side-effect import: `import "./x"` (no binding clause, no `from`).
			.replace(/^([ \t]*import\s*)(["'])(\.\.?\/[^"']*)\2/gm, (_m, pre, q, spec) => `${pre}${q}${toAbsoluteUrl(spec)}${q}`)
			// Dynamic `import("./x")` with a static string literal — may appear anywhere.
			.replace(
				/(?<![.\w$])import(\s*\(\s*)(["'])(\.\.?\/[^"']*)\2(\s*\))/g,
				(_m, pre, q, spec, post) => `import${pre}${q}${toAbsoluteUrl(spec)}${q}${post}`
			)
	);
}

/**
 * Write transformed TS output to a content-hashed cache file inside the project
 * so Node's ESM resolver can resolve **bare specifiers** like
 * `import { self } from "@cldmv/slothlet/runtime"` against it. The previous
 * `data:` URL approach could not serve as a resolution base for any non-absolute
 * import; bare specifiers are what every TS module needs in practice (the
 * runtime singletons live in `@cldmv/slothlet/runtime`).
 *
 * **Relative specifiers:** relative `import`/`export` paths in the transformed
 * code are anchored at the original source directory by
 * {@link rewriteRelativeSpecifiers} before the code is hashed and written, so
 * `import './sibling.mjs'` resolves against the source tree rather than the
 * cache directory. Relative imports that resolve to another `.ts`/`.mts` file
 * still will not load (Node has no loader for those extensions); slothlet
 * wires TS modules together via `self.*` at runtime.
 *
 * Cache lives at `<projectRoot>/.slothlet-cache/<pid>-<instanceID>/<hash>.mjs` —
 * deliberately OUTSIDE `node_modules/` because Node's `READ_PACKAGE_SCOPE` halts
 * at a `node_modules` segment and would otherwise break self-reference resolution
 * (needed when slothlet runs inside its own repo / monorepo workspace, where no
 * `node_modules/@cldmv/slothlet` exists). For external consumers, bare-specifier
 * lookup walks up to `<projectRoot>/node_modules/@cldmv/slothlet` either way.
 *
 * The `<pid>-` prefix lets the startup sweep detect orphaned dirs (owner PID
 * gone) without touching live ones.
 * @param {string} originalPath - Path to the original .ts/.mts source (relative or absolute; normalized to an absolute path internally)
 * @param {string} code - Transformed JavaScript code
 * @param {string} instanceID - Slothlet instance ID (used as cache namespace)
 * @returns {Promise<{url: string, cacheDir: string}>} File URL and the cache directory for this instance
 * @public
 */
export async function writeTransformedToCache(originalPath, code, instanceID) {
	// Normalize to an absolute path up front. `findPackageRoot` already resolves
	// internally, but the hash below must use the SAME absolute form: hashing a
	// relative `originalPath` would make the cache key — and therefore the
	// resulting file:// URL and Node's ESM module identity — depend on
	// process.cwd(). The same source would then cache twice under different URLs
	// and resolve to two distinct module instances.
	const absolutePath = path.resolve(originalPath);
	const projectRoot = findPackageRoot(absolutePath) ?? tmpdir();
	await sweepStaleSlothletCache(projectRoot);
	// Anchor relative import/export specifiers at the original source directory.
	// The cache file lives under .slothlet-cache/ — not beside the source — so an
	// unrewritten `./sibling.mjs` would resolve against the cache dir and fail.
	// Done before hashing so the cache key reflects exactly what is written.
	const cacheCode = rewriteRelativeSpecifiers(code, absolutePath);
	// Hash incorporates the absolute source path so two source files whose
	// transformed output is byte-identical (e.g. empty modules, side-effect-only
	// re-exports) get distinct cache files — otherwise Node's ESM cache would
	// return the same module instance for both source paths, silently aliasing
	// them. The NUL separator prevents path/code boundary collisions like
	// `(path="a", code="b")` vs `(path="ab", code="")`.
	const hash = createHash("sha256").update(absolutePath).update("\0").update(cacheCode).digest("hex").slice(0, 16);
	const cacheDir = path.join(projectRoot, ".slothlet-cache", `${process.pid}-${instanceID}`);
	const cachePath = path.join(cacheDir, `${hash}.mjs`);
	if (!fs.existsSync(cachePath)) {
		await mkdir(cacheDir, { recursive: true });
		await writeFile(cachePath, cacheCode, "utf8");
	}
	return { url: pathToFileURL(cachePath).href, cacheDir };
}

/**
 * Transform TypeScript code to JavaScript using tsc with type checking
 * @param {string} filePath - Path to the TypeScript file
 * @param {object} [options={}] - TypeScript compiler options
 * @param {string} [options.target] - ECMAScript target version (default: "ES2020")
 * @param {string} [options.module] - Module format (default: "ESNext")
 * @param {boolean} [options.strict] - Enable strict type checking (default: true)
 * @param {boolean} [options.skipTypeCheck] - Skip type checking and only transform (default: false)
 * @param {string} [options.typeDefinitionPath] - Path to .d.ts file for type checking
 * @returns {Promise<{code: string, diagnostics: object[]}>} Transformed code and type diagnostics
 * @throws {SlothletError} If transformation fails
 * @public
 */
export async function transformTypeScriptStrict(filePath, options = {}) {
	const ts = await getTypeScript(); // Lazy load - only when actually needed
	const code = fs.readFileSync(filePath, "utf8");

	// Map target string to ScriptTarget enum
	const targetMap = {
		es3: ts.ScriptTarget.ES3,
		es5: ts.ScriptTarget.ES5,
		es6: ts.ScriptTarget.ES2015,
		es2015: ts.ScriptTarget.ES2015,
		es2016: ts.ScriptTarget.ES2016,
		es2017: ts.ScriptTarget.ES2017,
		es2018: ts.ScriptTarget.ES2018,
		es2019: ts.ScriptTarget.ES2019,
		es2020: ts.ScriptTarget.ES2020,
		es2021: ts.ScriptTarget.ES2021,
		es2022: ts.ScriptTarget.ES2022,
		esnext: ts.ScriptTarget.ESNext,
		latest: ts.ScriptTarget.Latest
	};

	// Map module string to ModuleKind enum
	const moduleMap = {
		none: ts.ModuleKind.None,
		commonjs: ts.ModuleKind.CommonJS,
		amd: ts.ModuleKind.AMD,
		system: ts.ModuleKind.System,
		umd: ts.ModuleKind.UMD,
		es6: ts.ModuleKind.ES2015,
		es2015: ts.ModuleKind.ES2015,
		es2020: ts.ModuleKind.ES2020,
		es2022: ts.ModuleKind.ES2022,
		esnext: ts.ModuleKind.ESNext,
		node16: ts.ModuleKind.Node16,
		nodenext: ts.ModuleKind.NodeNext
	};

	const targetKey = (options.target || "es2020").toLowerCase();
	const moduleKey = (options.module || "esnext").toLowerCase();

	const compilerOptions = {
		target: targetMap[targetKey] || ts.ScriptTarget.ES2020,
		module: moduleMap[moduleKey] || ts.ModuleKind.ESNext,
		strict: options.strict !== false,
		esModuleInterop: true,
		skipLibCheck: true,
		noEmit: false, // We need emit for transformation
		...(options.typeDefinitionPath && {
			typeRoots: [path.dirname(options.typeDefinitionPath)],
			types: [path.basename(options.typeDefinitionPath, ".d.ts")]
		}),
		...options.compilerOptions
	};

	// Perform type checking using Program API if not skipped
	let diagnostics = [];
	if (!options.skipTypeCheck) {
		// Create a temporary in-memory compiler host
		const host = ts.createCompilerHost(compilerOptions);

		// Override readFile to provide our code
		const originalReadFile = host.readFile;
		host.readFile = (fileName) => {
			if (fileName === filePath) {
				return code;
			}
			return originalReadFile.call(host, fileName);
		};

		// Create program with single file
		const program = ts.createProgram([filePath], compilerOptions, host);

		// Get all diagnostics (semantic + syntactic)
		const allDiagnostics = [...program.getSemanticDiagnostics(), ...program.getSyntacticDiagnostics()];

		// Filter to only this file's diagnostics
		diagnostics = allDiagnostics.filter((d) => d.file && d.file.fileName === filePath);
	}

	// Transform using transpileModule (fast, doesn't require full type checking)
	const result = ts.transpileModule(code, {
		compilerOptions,
		fileName: filePath
	});

	return {
		code: result.outputText,
		diagnostics
	};
}

/**
 * Format TypeScript diagnostics into readable error messages
 * @param {object[]} diagnostics - TypeScript diagnostic objects
 * @param {object} ts - TypeScript module instance
 * @returns {string[]} Array of formatted error messages
 * @private
 */
export function formatDiagnostics(diagnostics, ts) {
	return diagnostics.map((diagnostic) => {
		const message = ts.flattenDiagnosticMessageText(diagnostic.messageText, "\n");
		if (diagnostic.file && diagnostic.start !== undefined) {
			const { line, character } = diagnostic.file.getLineAndCharacterOfPosition(diagnostic.start);
			const fileName = diagnostic.file.fileName;
			return `${fileName}:${line + 1}:${character + 1} - ${message}`;
		}
		return message;
	});
}
