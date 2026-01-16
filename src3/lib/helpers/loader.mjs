/**
 * @fileoverview Module loading utilities
 * @module @cldmv/slothlet/helpers/loader
 */
import { readdir, stat } from "node:fs/promises";
import { join, extname, basename } from "node:path";
import { pathToFileURL } from "node:url";
import { SlothletError } from "@cldmv/slothlet/errors";
import { getModuleId } from "@cldmv/slothlet/helpers/sanitize";

/**
 * Load a single module
 * @param {string} filePath - Path to module file
 * @returns {Promise<Object>} Loaded module
 * @public
 */
export async function loadModule(filePath) {
	try {
		const fileUrl = pathToFileURL(filePath).href;
		const module = await import(fileUrl);
		return module;
	} catch (error) {
		throw new SlothletError("MODULE_LOAD_FAILED", {
			modulePath: filePath,
			reason: error.message,
			stack: error.stack,
			hint: "Check that the file exists and has valid syntax"
		});
	}
}

/**
 * Scan directory for module files
 * @param {string} dir - Directory to scan
 * @param {Object} [options={}] - Scan options
 * @returns {Promise<Object>} Directory structure
 * @public
 */
export async function scanDirectory(dir, options = {}) {
	const { recursive = true, extensions = [".mjs", ".cjs", ".js"] } = options;

	try {
		await stat(dir);
	} catch (error) {
		throw new SlothletError("INVALID_DIRECTORY", {
			dir,
			reason: error.message
		});
	}

	const structure = {
		files: [], // Array of { path, name, moduleId }
		directories: [] // Array of { path, name, children: structure }
	};

	const entries = await readdir(dir, { withFileTypes: true });

	for (const entry of entries) {
		const fullPath = join(dir, entry.name);

		if (entry.isDirectory()) {
			if (recursive) {
				const subStructure = await scanDirectory(fullPath, options);
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

				const nameWithoutExt = basename(entry.name, ext);
				structure.files.push({
					path: fullPath,
					name: nameWithoutExt,
					fullName: entry.name,
					moduleId: getModuleId(fullPath, dir)
				});
			}
		}
	}

	return structure;
}

/**
 * Check if module has valid exports
 * @param {Object} module - Loaded module
 * @returns {boolean} True if module has exports
 * @public
 */
export function hasValidExports(module) {
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
export function extractExports(module) {
	const exports = {};

	// Add default export if exists
	if (module.default !== undefined) {
		exports.default = module.default;
	}

	// Add named exports
	for (const key of Object.keys(module)) {
		if (key !== "default" && typeof key === "string") {
			exports[key] = module[key];
		}
	}

	return exports;
}
