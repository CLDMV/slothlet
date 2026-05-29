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

/** Per-process memo for {@link getSecureFallbackRoot}. @type {string|undefined} @private */
let secureFallbackRoot;

/**
 * Lazily create a per-process secure root for the no-package-root fallback.
 *
 * Writing the transform cache directly into the shared, world-readable
 * `os.tmpdir()` is an insecure-temporary-file risk (CWE-377): the path is
 * predictable and the directory is accessible to other users. `fs.mkdtempSync`
 * instead atomically creates an unpredictable, owner-only (`0o700`) directory —
 * the zero-dependency Node built-in equivalent of the `tmp` package. Memoized so
 * every fallback cache in this process shares one stable root, preserving the
 * cross-call cache reuse the project-local `.slothlet-cache/` path already has.
 *
 * @returns {string} Absolute path to the private per-process temp root.
 * @private
 */
function getSecureFallbackRoot() {
	return (secureFallbackRoot ??= fs.mkdtempSync(path.join(tmpdir(), "slothlet-")));
}

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
 * Matches a `.ts` / `.mts` (TypeScript source) file path.
 * @constant
 * @private
 */
const TS_SOURCE_EXT = /\.m?ts$/;

/**
 * Resolve the on-disk file a relative specifier targets and classify it as a
 * TypeScript source or not.
 *
 * Besides the literal path, this probes the TypeScript source-extension
 * convention: a specifier may name a `.mjs` / `.js` file (or omit the
 * extension) while the file on disk is the corresponding `.mts` / `.ts`
 * source. Whichever form exists wins.
 * @param {string} absoluteTarget - Absolute path the specifier resolves to, as written
 * @returns {{ path: string, isTS: boolean }} The resolved file and whether it is a `.ts`/`.mts` source
 * @private
 */
export function resolveModuleFile(absoluteTarget) {
	const isFile = (candidate) => {
		try {
			return fs.statSync(candidate).isFile();
		} catch {
			return false;
		}
	};
	if (isFile(absoluteTarget)) {
		return { path: absoluteTarget, isTS: TS_SOURCE_EXT.test(absoluteTarget) };
	}
	// Literal target missing — probe the TS source extension for the importer's
	// declared output extension (`./x.mjs` → `x.mts`, `./x.js` → `x.ts`) and the
	// extensionless form.
	const ext = path.extname(absoluteTarget);
	const base = ext ? absoluteTarget.slice(0, -ext.length) : absoluteTarget;
	const candidates = ext === ".mjs" ? [".mts"] : ext === ".js" ? [".ts"] : ext === "" ? [".mts", ".ts"] : [];
	for (const candidate of candidates) {
		if (isFile(base + candidate)) {
			return { path: base + candidate, isTS: true };
		}
	}
	// Nothing on disk — leave the specifier at its source location so Node
	// surfaces the real resolution error.
	return { path: absoluteTarget, isTS: false };
}

/**
 * Keywords after which a `/` begins a regular-expression literal rather than
 * the division operator. Other keywords and plain identifiers are values, so a
 * `/` following them is division. Consulted by {@link maskStringsAndComments}.
 * @constant
 * @private
 */
const REGEX_PRECEDING_KEYWORDS = new Set([
	"return",
	"typeof",
	"instanceof",
	"in",
	"of",
	"new",
	"delete",
	"void",
	"throw",
	"else",
	"yield",
	"await",
	"case",
	"do"
]);

/**
 * Whether `ch` can appear within a JavaScript identifier — ASCII letters,
 * digits, `_`, `$`, and (coarsely) any non-ASCII character, so unicode
 * identifiers are not mistaken for punctuation. Used by
 * {@link maskStringsAndComments} to scan identifier/keyword runs.
 * @param {string} ch - A single character.
 * @returns {boolean} `true` if `ch` is an identifier character.
 * @private
 */
function isIdentifierChar(ch) {
	const cc = ch.charCodeAt(0);
	return (
		(cc >= 0x61 && cc <= 0x7a) || // a-z
		(cc >= 0x41 && cc <= 0x5a) || // A-Z
		(cc >= 0x30 && cc <= 0x39) || // 0-9
		ch === "_" ||
		ch === "$" ||
		cc > 0x7f // non-ASCII — treat unicode identifier characters as identifiers
	);
}

/**
 * Mark every character index that falls inside a string literal, template
 * literal, comment, or regular-expression literal, so the specifier rewrite can
 * skip `import`/`from` text that is not actually part of an import statement
 * (e.g. `const s = "import('./x')"`).
 *
 * Template literals are masked whole — opening backtick to closing backtick,
 * including any `${…}` interpolations — so a relative dynamic `import()` inside
 * a template interpolation is left un-rewritten rather than risk a false
 * rewrite; nested template literals are not deeply parsed.
 *
 * Regex literals are masked whole as well: their bodies can contain text shaped
 * like a line- or block-comment delimiter (`/\/\//`), and without regex
 * awareness the scanner would mis-read that as a comment and mask the rest of
 * the line — silently suppressing a real `import()` later on the same line. A
 * `/` is read as a regex when the previous significant token expects an
 * expression (start of input, an operator, `(`/`{`/`}`/`,`/`;`/`:`, or a
 * {@link REGEX_PRECEDING_KEYWORDS} keyword) and as division otherwise. The one
 * imperfect case is a `/` directly after the `)` of an `if`/`for`/`while`
 * header — treated as division — an accepted limit of this lightweight scan.
 * @param {string} code - JavaScript source to scan
 * @returns {Uint8Array} `1` at indices inside a string/template/comment/regex, `0` elsewhere
 * @private
 */
export function maskStringsAndComments(code) {
	const n = code.length;
	const mask = new Uint8Array(n);
	// Whether a `/` at the current position would open a regex literal (true)
	// or be the division operator (false). Starts true: at the start of input a
	// `/` opens a regex (or a comment).
	let regexAllowed = true;
	let i = 0;
	while (i < n) {
		const c = code[i];
		const c2 = code[i + 1];
		if (c === "/" && c2 === "/") {
			// Line comment — to end of line. Leaves `regexAllowed` unchanged.
			while (i < n && code[i] !== "\n") mask[i++] = 1;
		} else if (c === "/" && c2 === "*") {
			// Block comment — to the closing `*/` (or end of input if unterminated).
			mask[i++] = 1;
			mask[i++] = 1;
			while (i < n && !(code[i] === "*" && code[i + 1] === "/")) mask[i++] = 1;
			if (i < n) {
				mask[i++] = 1;
				mask[i++] = 1;
			}
		} else if (c === "/" && regexAllowed) {
			// Regex literal — masked whole so `//`/`*/`-shaped text in its body is
			// not mis-scanned as a comment. Runs to the first unescaped `/` outside
			// a `[…]` character class. A regex cannot span a line, so a newline
			// also ends the scan (a guard against a mis-classified `/`).
			mask[i++] = 1;
			let inClass = false;
			while (i < n && code[i] !== "\n") {
				const ch = code[i];
				if (ch === "\\" && i + 1 < n) {
					mask[i++] = 1;
					mask[i++] = 1;
					continue;
				}
				if (ch === "[") inClass = true;
				else if (ch === "]") inClass = false;
				mask[i++] = 1;
				if (ch === "/" && !inClass) break;
			}
			regexAllowed = false; // a regex literal is a value
		} else if (c === '"' || c === "'" || c === "`") {
			// String / template literal — to the matching unescaped quote.
			mask[i++] = 1;
			while (i < n && code[i] !== c) {
				if (code[i] === "\\" && i + 1 < n) mask[i++] = 1;
				mask[i++] = 1;
			}
			if (i < n) mask[i++] = 1;
			regexAllowed = false; // a string literal is a value
		} else if (c === " " || c === "\t" || c === "\n" || c === "\r" || c === "\f" || c === "\v") {
			// Whitespace is insignificant — leave `regexAllowed` unchanged.
			i++;
		} else if (isIdentifierChar(c) && !(c >= "0" && c <= "9")) {
			// Identifier / keyword run. A `/` after most words is division; after
			// a REGEX_PRECEDING_KEYWORDS keyword it opens a regex. The run is sliced
			// out once (not built char-by-char) to stay linear in the word length.
			const start = i;
			while (i < n && isIdentifierChar(code[i])) i++;
			regexAllowed = REGEX_PRECEDING_KEYWORDS.has(code.slice(start, i));
		} else {
			// Punctuator or numeric literal. `)`, `]` and digits are values (a `/`
			// after them is division); every other punctuator — operators, `(`,
			// `{`, `}`, `,`, `;`, `:` … — expects an expression next, so a `/`
			// after it opens a regex.
			regexAllowed = c !== ")" && c !== "]" && !(c >= "0" && c <= "9");
			i++;
		}
	}
	return mask;
}

/**
 * A (possibly empty) run of whitespace and/or comments — every inter-token gap
 * JavaScript permits. Inlined into the specifier-rewrite patterns below so a
 * comment sitting between `from`/`import` and the module string does not defeat
 * the match and leave a relative specifier unrewritten (it would then resolve
 * against the cache directory and fail at runtime with `Cannot find module`).
 *
 * This gap is real on transformed output, not hypothetical: tsc preserves
 * comments by default, and esbuild deliberately keeps magic comments inside
 * `import()` calls (e.g. a `webpackIgnore` annotation before the specifier).
 *
 * The block-comment alternative uses a lazy body so it stops at the first
 * closing delimiter; the line-comment alternative runs to — but not past — its
 * newline, which the leading `\s` of the next iteration then consumes. The
 * three alternatives never begin on the same character, so the outer `*`
 * has no ambiguity to backtrack over.
 * @constant
 * @private
 */
const TOKEN_GAP = "(?:\\s|/\\*[\\s\\S]*?\\*/|//[^\\n]*)*";

/**
 * `import … from "./x"` / `export … from "./x"` / `export * from "./x"` —
 * a relative specifier in a static import/export declaration. Group 1 is the
 * statement text up to and including the `from` token gap, group 2 the quote,
 * group 3 the specifier.
 * @constant
 * @private
 */
const STATIC_FROM_RE = new RegExp(`^([ \\t]*(?:import|export)\\b[^"'\`;]*?\\bfrom${TOKEN_GAP})(["'])(\\.\\.?/[^"']*)\\2`, "gm");

/**
 * Bare side-effect import: `import "./x"` (no binding clause, no `from`).
 * Group 1 is `import` plus the token gap, group 2 the quote, group 3 the
 * specifier.
 * @constant
 * @private
 */
const BARE_IMPORT_RE = new RegExp(`^([ \\t]*import${TOKEN_GAP})(["'])(\\.\\.?/[^"']*)\\2`, "gm");

/**
 * Dynamic `import("./x")` with a static string literal — may appear anywhere.
 * Group 1 spans the gap, `(`, and gap up to the quote; group 2 the quote;
 * group 3 the specifier; group 4 the trailing gap and `)`.
 * @constant
 * @private
 */
const DYNAMIC_IMPORT_RE = new RegExp(`(?<![.\\w$])import(${TOKEN_GAP}\\(${TOKEN_GAP})(["'])(\\.\\.?/[^"']*)\\2(${TOKEN_GAP}\\))`, "g");

/**
 * Rewrite relative `import`/`export` specifiers in transformed TS output.
 *
 * Transformed TS modules are written to (and imported from) a cache file under
 * `.slothlet-cache/…`, which is not co-located with the original source.
 * esbuild and tsc transform the code but never rewrite specifiers, so a
 * relative specifier (`./sibling.mjs`, `../shared/util.mjs`) left as-is would
 * resolve against the cache directory and fail with `Cannot find module`.
 *
 * Each relative specifier is resolved against the original source directory
 * and handed to `resolve`, which returns its replacement. The default `resolve`
 * emits an absolute `file://` URL at the source location — correct for plain
 * `.mjs`/`.cjs`/`.js` targets. {@link writeTransformedToCache} passes a `resolve`
 * that additionally points relative `.ts`/`.mts` targets at their transpiled
 * cache files. Bare specifiers (`@cldmv/slothlet/runtime`, npm packages) and
 * absolute URLs are never touched.
 *
 * Matches inside a string literal or comment are skipped via
 * {@link maskStringsAndComments}, so import-shaped text in string data or
 * comments is never mutated.
 *
 * Covered statement forms: static `import`/`export … from` declarations
 * (including multi-line binding lists and `export *`), bare side-effect
 * `import "…"`, and dynamic `import("…")` with a static string literal.
 * Whitespace and comments between the tokens of these forms — including
 * between `from`/`import` and the module string — are tolerated.
 * @param {string} code - Transformed JavaScript (ESM) code
 * @param {string} sourcePath - Absolute path to the original .ts/.mts source
 * @param {(absoluteTarget: string, suffix: string, specifier: string) => string} [resolve]
 *   - Maps a relative specifier to its replacement. Receives the absolute path the
 *   specifier resolves to, any `?query`/`#hash` suffix, and the original specifier
 *   text. Defaults to an absolute `file://` URL anchored at the source directory.
 * @returns {string} Code with relative specifiers rewritten
 * @private
 */
export function rewriteRelativeSpecifiers(code, sourcePath, resolve) {
	const sourceDir = path.dirname(sourcePath);
	const resolveSpecifier = resolve ?? ((absoluteTarget, suffix) => pathToFileURL(absoluteTarget).href + suffix);
	/**
	 * Map one relative specifier to its replacement, splitting off any
	 * `?query`/`#hash` suffix first (only the path portion is resolved).
	 * @param {string} specifier - The relative specifier (`./…` or `../…`)
	 * @returns {string} The replacement specifier
	 */
	const handle = (specifier) => {
		const suffixIdx = specifier.search(/[?#]/);
		const pathPart = suffixIdx === -1 ? specifier : specifier.slice(0, suffixIdx);
		const suffix = suffixIdx === -1 ? "" : specifier.slice(suffixIdx);
		return resolveSpecifier(path.resolve(sourceDir, pathPart), suffix, specifier);
	};
	/**
	 * Apply one specifier-rewrite regex, skipping any match whose start index
	 * lands inside a string literal or comment. The mask is rebuilt per call
	 * because a prior pass may have lengthened the text.
	 * @param {string} text - Current code
	 * @param {RegExp} regex - Specifier-matching pattern
	 * @param {(...groups: string[]) => string} replacer - Builds the replacement for a real match
	 * @returns {string} `text` with non-string, non-comment matches rewritten
	 */
	const rewriteWith = (text, regex, replacer) => {
		const mask = maskStringsAndComments(text);
		return text.replace(regex, (...args) => {
			// String.prototype.replace passes (match, ...groups, offset, string);
			// with no named groups, the offset is the second-to-last argument.
			const offset = args[args.length - 2];
			return mask[offset] ? args[0] : replacer(...args);
		});
	};
	let out = code;
	// `import … from "./x"` / `export … from "./x"` / `export * from "./x"`.
	out = rewriteWith(out, STATIC_FROM_RE, (_m, pre, q, spec) => `${pre}${q}${handle(spec)}${q}`);
	// Bare side-effect import: `import "./x"` (no binding clause, no `from`).
	out = rewriteWith(out, BARE_IMPORT_RE, (_m, pre, q, spec) => `${pre}${q}${handle(spec)}${q}`);
	// Dynamic `import("./x")` with a static string literal — may appear anywhere.
	out = rewriteWith(out, DYNAMIC_IMPORT_RE, (_m, pre, q, spec, post) => `import${pre}${q}${handle(spec)}${q}${post}`);
	return out;
}

/**
 * Write transformed TS output — and the transitive graph of `.ts`/`.mts` files
 * it relatively imports — to content-hashed cache files inside the project,
 * returning the entry module's `file://` URL.
 *
 * The cache file is not co-located with the source, so every relative specifier
 * is rewritten by {@link rewriteRelativeSpecifiers}:
 *
 * - **Bare specifiers** (`@cldmv/slothlet/runtime`, npm packages) resolve
 *   normally — the cache lives inside the project tree, so Node walks up to
 *   `node_modules` as usual. They are left untouched.
 * - **Relative imports of plain `.mjs`/`.cjs`/`.js` files** are rewritten to an
 *   absolute `file://` URL at the original source location.
 * - **Relative imports of other `.ts`/`.mts` files** are followed: when a
 *   `transform` callback is supplied, each dependency is transpiled and cached
 *   too, and the importing specifier is rewritten to the dependency's cache
 *   file. Import cycles are handled. Without `transform`, a relative `.ts`/`.mts`
 *   target is left at its source path (and will not load).
 *
 * Each cache file is named by a hash over the absolute source paths and
 * transpiled code of its whole relative-`.ts`/`.mts` closure, so editing any
 * file in the graph produces fresh URLs for every importer — a reload never
 * serves stale linked output.
 *
 * Cache lives at `<projectRoot>/.slothlet-cache/<pid>-<instanceID>/<hash>.mjs` —
 * deliberately OUTSIDE `node_modules/` because Node's `READ_PACKAGE_SCOPE` halts
 * at a `node_modules` segment and would otherwise break self-reference resolution
 * (needed when slothlet runs inside its own repo / monorepo workspace, where no
 * `node_modules/@cldmv/slothlet` exists). The `<pid>-` prefix lets the startup
 * sweep detect orphaned dirs (owner PID gone) without touching live ones.
 * @param {string} originalPath - Path to the original .ts/.mts source (relative or absolute; normalized internally)
 * @param {string} code - Transformed JavaScript code for `originalPath`
 * @param {string} instanceID - Slothlet instance ID (used as cache namespace)
 * @param {(filePath: string) => Promise<string>} [transform] - Transpiles a `.ts`/`.mts`
 *   file to JavaScript; enables following relative `.ts`/`.mts` imports.
 * @returns {Promise<{url: string, cacheDir: string}>} Entry file URL and the cache directory for this instance
 * @public
 */
export async function writeTransformedToCache(originalPath, code, instanceID, transform) {
	// Normalize to an absolute path up front. The hash below must use the SAME
	// absolute form: hashing a relative `originalPath` would make the cache key —
	// and the resulting file:// URL and Node's module identity — depend on
	// process.cwd(), aliasing the same source to two distinct module instances.
	const absolutePath = path.resolve(originalPath);
	const projectRoot = findPackageRoot(absolutePath) ?? getSecureFallbackRoot();
	await sweepStaleSlothletCache(projectRoot);
	const cacheDir = path.join(projectRoot, ".slothlet-cache", `${process.pid}-${instanceID}`);

	// Phase 1 — transpile the transitive graph of relative `.ts`/`.mts` imports.
	// `transformed` maps each absolute TS source path to its transpiled (pre-rewrite)
	// code; `deps` records the relative-`.ts`/`.mts` edges used for closure hashing.
	const transformed = new Map([[absolutePath, code]]);
	const deps = new Map();
	if (transform) {
		const pending = [absolutePath];
		while (pending.length > 0) {
			const file = pending.pop();
			const fileDeps = new Set();
			deps.set(file, fileDeps);
			// Discovery pass: collect relative `.ts`/`.mts` targets without rewriting.
			rewriteRelativeSpecifiers(transformed.get(file), file, (absoluteTarget, _suffix, specifier) => {
				const resolved = resolveModuleFile(absoluteTarget);
				if (resolved.isTS) fileDeps.add(resolved.path);
				return specifier;
			});
			for (const dep of fileDeps) {
				if (!transformed.has(dep)) {
					transformed.set(dep, await transform(dep));
					pending.push(dep);
				}
			}
		}
	}

	// Phase 2 — name each cache file by a hash over its whole relative-`.ts`/`.mts`
	// closure, so editing any file in the graph changes every importer's URL.
	const closureCache = new Map();
	/**
	 * Transitive closure of relative-`.ts`/`.mts` dependencies for `file`,
	 * including `file` itself.
	 * @param {string} file - Absolute TS source path
	 * @returns {Set<string>} Every TS source reachable from `file` (incl. `file`)
	 */
	const closureOf = (file) => {
		if (closureCache.has(file)) return closureCache.get(file);
		const seen = new Set();
		const walk = (node) => {
			if (seen.has(node)) return;
			seen.add(node);
			for (const next of deps.get(node) ?? []) walk(next);
		};
		walk(file);
		closureCache.set(file, seen);
		return seen;
	};
	/**
	 * Cache file name for `file` — a content hash over its closure. Files that
	 * share a closure (e.g. an import cycle) still get distinct names.
	 * @param {string} file - Absolute TS source path
	 * @returns {string} The `<hash>.mjs` cache file name
	 */
	const cacheName = (file) => {
		const hash = createHash("sha256");
		// The NUL separators prevent path/code boundary collisions.
		for (const member of [...closureOf(file)].sort()) {
			hash.update(member).update("\0").update(transformed.get(member)).update("\0");
		}
		hash.update("entry\0").update(file);
		return `${hash.digest("hex").slice(0, 16)}.mjs`;
	};

	// Phase 3 — rewrite each file's specifiers and write it to its cache file.
	await mkdir(cacheDir, { recursive: true });
	for (const [file, fileCode] of transformed) {
		const rewritten = rewriteRelativeSpecifiers(fileCode, file, (absoluteTarget, suffix) => {
			const resolved = resolveModuleFile(absoluteTarget);
			// A relative `.ts`/`.mts` import that was followed → its cache file;
			// anything else → an absolute `file://` URL at the RESOLVED on-disk path.
			// `resolved.path` (not `absoluteTarget`) is used so the TS source-extension
			// remap is honored: a specifier written `./dep.js` whose source is `dep.ts`
			// points at `dep.ts`, not a non-existent `dep.js`. For plain `.mjs`/`.cjs`/
			// `.js` targets `resolveModuleFile` leaves `resolved.path === absoluteTarget`,
			// so this is identical for them.
			if (resolved.isTS && transformed.has(resolved.path)) {
				return pathToFileURL(path.join(cacheDir, cacheName(resolved.path))).href + suffix;
			}
			return pathToFileURL(resolved.path).href + suffix;
		});
		const cachePath = path.join(cacheDir, cacheName(file));
		// Atomic create-exclusive: cacheName() is a content hash, so an existing
		// cachePath already holds byte-identical content. `wx` (O_CREAT|O_EXCL)
		// writes exactly once and no-ops on EEXIST, closing the existsSync→write
		// TOCTOU window (CWE-367) without a separate existence check.
		try {
			await writeFile(cachePath, rewritten, { encoding: "utf8", flag: "wx" });
		} catch (err) {
			if (err.code !== "EEXIST") throw err;
		}
	}
	return { url: pathToFileURL(path.join(cacheDir, cacheName(absolutePath))).href, cacheDir };
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
 * @public
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
