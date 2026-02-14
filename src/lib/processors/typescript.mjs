/**
 *	@Project: @cldmv/slothlet
 *	@Filename: /src/lib/processors/typescript.mjs
 *	@Date: 2026-02-14 00:00:00 -08:00
 *	@Author: Nate Hyson <CLDMV>
 *	@Email: <Shinrai@users.noreply.github.com>
 *	-----
 *	@Last modified by: Nate Hyson <CLDMV> (Shinrai@users.noreply.github.com)
 *	@Last modified time: 2026-02-14 00:00:00 -08:00
 *	-----
 *	@Copyright: Copyright (c) 2013-2026 Catalyzed Motivation Inc. All rights reserved.
 */

/**
 * @fileoverview TypeScript file transformation using esbuild (fast mode)
 * @module @cldmv/slothlet/processors/typescript
 */

// NO static imports of esbuild - only dynamic imports when needed
import fs from "fs";
import { SlothletError } from "@cldmv/slothlet/errors";

let esbuildInstance = null;

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
		} catch (error) {
			throw new SlothletError(
				"TYPESCRIPT_ESBUILD_NOT_INSTALLED",
				{ mode: "fast" },
				error
			);
		}
	}
	return esbuildInstance;
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
