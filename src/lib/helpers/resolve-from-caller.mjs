/**
 *	@Project: @cldmv/slothlet
 *	@Filename: /src/lib/helpers/resolve-from-caller.mjs
 *	@Date: 2025-09-09 08:06:19 -07:00 (1725890779)
 *	@Author: Nate Corcoran <CLDMV>
 *	@Email: <Shinrai@users.noreply.github.com>
 *	-----
 *	@Last modified by: Nate Corcoran <CLDMV> (Shinrai@users.noreply.github.com)
 *	@Last modified time: 2026-03-01 20:21:38 -08:00 (1772425298)
 *	-----
 *	@Copyright: Copyright (c) 2013-2026 Catalyzed Motivation Inc. All rights reserved.
 */

/**
 * @fileoverview Path resolution from caller context
 * @description
 * Resolves relative paths based on where slothlet() was called from.
 * @module @cldmv/slothlet/helpers/resolve-from-caller
 * @package
 */

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { ComponentBase } from "@cldmv/slothlet/factories/component-base";

/**
 * Calculate slothlet source directory path ONCE at module initialization.
 * This file is at src3/lib/helpers/resolve-from-caller.mjs, so 2 levels up is src3/
 * In other versions: src/lib/helpers/... -> src/ or dist/lib/helpers/... -> dist/
 * @private
 */
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const SLOTHLET_LIB_ROOT = path.resolve(__dirname, "../..");

/**
 * Path resolver component
 * @class Resolver
 * @extends ComponentBase
 * @package
 */
export class Resolver extends ComponentBase {
	static slothletProperty = "resolver";

	/**
	 * Get V8 stack trace as CallSite array.
	 * @param {Function} [skipFn] - Optional function to skip from stack trace
	 * @returns {Array} Array of CallSite objects
	 * @public
	 */
	getStack(skipFn) {
		const orig = Error.prepareStackTrace;
		try {
			Error.prepareStackTrace = (_, s) => s; // V8 CallSite[]
			const e = new Error("Stack trace");
			if (skipFn) Error.captureStackTrace(e, skipFn);
			return e.stack;
		} finally {
			Error.prepareStackTrace = orig;
		}
	}

	/**
	 * Internal version for module use
	 * @returns {Array} Array of CallSite objects
	 * @private
	 */
	#getStack() {
		const originalPrepare = Error.prepareStackTrace;
		Error.prepareStackTrace = (___, stack) => stack;
		const stack = new Error().stack;
		Error.prepareStackTrace = originalPrepare;
		return stack;
	}

	/**
	 * Convert file:// URL to filesystem path or return as-is.
	 * @param {any} v - Value to convert
	 * @returns {string|null} Filesystem path or null
	 * @public
	 */
	toFsPath(v) {
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
	#isSlothletInternal(filePath) {
		// Normalize path for comparison
		const normalized = path.normalize(filePath);
		const normalizedLibRoot = path.normalize(SLOTHLET_LIB_ROOT);

		// Check if file is within the slothlet source directory (src3/, src/, or dist/)
		if (normalized.startsWith(normalizedLibRoot)) {
			return true;
		}

		// Explicitly check for entry point files at any location
		const basename = path.basename(normalized);
		if (basename === "index.mjs" || basename === "index.cjs") {
			return true;
		}

		return false;
	}

	/**
	 * Find the caller's base file from stack trace.
	 * @returns {string|null} Caller file path or null
	 * @private
	 */
	#findCallerBase() {
		const stack = this.#getStack();
		const files = stack.map((s) => this.toFsPath(s.getFileName())).filter(Boolean);

		// Find slothlet.mjs in the stack
		const slothletIndex = files.findIndex((f) => path.basename(f).toLowerCase() === "slothlet.mjs");

		if (slothletIndex === -1) {
			// No slothlet.mjs in stack, find first non-internal file
			for (const file of files) {
				if (!this.#isSlothletInternal(file)) {
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
			if (this.#isSlothletInternal(file)) continue;

			// Found user code!
			return file;
		}

		// Fallback: return first non-internal file
		for (const file of files) {
			if (!this.#isSlothletInternal(file)) {
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
	resolvePathFromCaller(rel) {
		// Short-circuit: already absolute or file:// URL
		if (rel.startsWith?.("file://")) return fileURLToPath(rel);
		if (path.isAbsolute(rel)) return rel;

		// Find caller's base directory
		const callerFile = this.#findCallerBase();

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

}
