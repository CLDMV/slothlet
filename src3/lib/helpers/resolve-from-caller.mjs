/**
 * Path resolution from caller context.
 * Resolves relative paths based on where slothlet() was called from.
 * @module helpers/resolve-from-caller
 * @package
 */

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

/**
 * Get V8 stack trace as CallSite array.
 * @param {Function} [skipFn] - Optional function to skip from stack trace
 * @returns {Array} Array of CallSite objects
 * @public
 */
export function getStack(skipFn) {
	const orig = Error.prepareStackTrace;
	try {
		Error.prepareStackTrace = (_, s) => s; // V8 CallSite[]
		const e = new Error("Stack trace");
		if (skipFn) Error.captureStackTrace(e, skipFn);
		return e.stack || [];
	} finally {
		Error.prepareStackTrace = orig;
	}
}

/**
 * Internal version for module use
 * @returns {Array} Array of CallSite objects
 * @private
 */
function resolve_getStack() {
	const originalPrepare = Error.prepareStackTrace;
	Error.prepareStackTrace = (___, stack) => stack;
	const stack = new Error().stack;
	Error.prepareStackTrace = originalPrepare;
	return stack || [];
}

/**
 * Convert file:// URL to filesystem path or return as-is.
 * @param {any} v - Value to convert
 * @returns {string|null} Filesystem path or null
 * @public
 */
export const toFsPath = (v) => (v && String(v).startsWith("file://") ? fileURLToPath(String(v)) : v ? String(v) : null);
function resolve_toFsPath(v) {
	if (!v) return null;
	const str = String(v);
	return str.startsWith("file://") ? fileURLToPath(str) : str;
}

/**
 * Check if file path is a slothlet internal file.
 * @param {string} filePath - File path to check
 * @returns {boolean} True if internal file
 * @private
 */
function resolve_isSlothletInternal(filePath) {
	if (!filePath) return true;

	const normalized = path.normalize(filePath).replace(/\\/g, "/");

	// Check for slothlet infrastructure files
	if (normalized.includes("/src3/") || normalized.includes("/src/") || normalized.includes("/dist/")) {
		// But not test files
		if (normalized.includes("/test")) return false;
		return true;
	}

	// Skip slothlet.mjs, index.mjs, etc.
	const basename = path.basename(filePath).toLowerCase();
	if (basename === "slothlet.mjs" || basename === "index.mjs" || basename === "index.cjs") {
		return true;
	}

	return false;
}

/**
 * Find the caller's base file from stack trace.
 * @returns {string|null} Caller file path or null
 * @private
 */
function resolve_findCallerBase() {
	const stack = resolve_getStack();
	const files = stack.map((s) => resolve_toFsPath(s.getFileName())).filter(Boolean);

	// Find slothlet.mjs in the stack
	const slothletIndex = files.findIndex((f) => path.basename(f).toLowerCase() === "slothlet.mjs");

	if (slothletIndex === -1) {
		// No slothlet.mjs in stack, find first non-internal file
		for (const file of files) {
			if (!resolve_isSlothletInternal(file)) {
				return file;
			}
		}
		return null;
	}

	// Start after slothlet.mjs and find first user code
	for (let i = slothletIndex + 1; i < files.length; i++) {
		const file = files[i];

		// Skip node: modules
		if (file.startsWith?.("node:")) continue;

		// Skip internal files
		if (resolve_isSlothletInternal(file)) continue;

		// Found user code!
		return file;
	}

	// Fallback: return first non-internal file
	for (const file of files) {
		if (!resolve_isSlothletInternal(file)) {
			return file;
		}
	}

	return null;
}

/**
 * Resolve relative path from caller's context.
 * @param {string} rel - Relative path to resolve
 * @returns {string} Absolute filesystem path
 * @public
 */
export function resolvePathFromCaller(rel) {
	// Short-circuit: already absolute or file:// URL
	if (rel.startsWith?.("file://")) return fileURLToPath(rel);
	if (path.isAbsolute(rel)) return rel;

	// Find caller's base directory
	const callerFile = resolve_findCallerBase();
	if (!callerFile) {
		// Fallback: resolve from current working directory
		return path.resolve(process.cwd(), rel);
	}

	// Resolve relative to caller's directory
	const callerDir = path.dirname(callerFile);
	const resolved = path.resolve(callerDir, rel);

	// Check if resolved path exists, otherwise try from cwd
	if (fs.existsSync(resolved)) {
		return resolved;
	}

	// Fallback: try from cwd
	const cwdResolved = path.resolve(process.cwd(), rel);
	if (fs.existsSync(cwdResolved)) {
		return cwdResolved;
	}

	// Return the caller-based resolution even if it doesn't exist
	// (let the actual loader handle the error)
	return resolved;
}

/**
 * Resolve relative path from caller's context to file:// URL.
 * @param {string} rel - Relative path to resolve
 * @returns {string} Absolute file:// URL
 * @public
 */
export function resolveUrlFromCaller(rel) {
	// Short-circuit: already a file:// URL
	if (rel.startsWith?.("file://")) return rel;

	// Resolve to path first, then convert to URL
	const absolutePath = resolvePathFromCaller(rel);
	return pathToFileURL(absolutePath).href;
}
