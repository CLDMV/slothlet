/**
 * @fileoverview Module loading utilities
 * @module @cldmv/slothlet/helpers/loader
 */
import { readdir, stat } from "node:fs/promises";
import { join, extname, basename, resolve } from "node:path";
import { pathToFileURL } from "node:url";
import { SlothletError, SlothletWarning } from "@cldmv/slothlet/errors";
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
		throw new SlothletError(
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
 * @returns {Promise<Object>} Directory structure
 * @public
 */
export async function scanDirectory(dir, options = {}) {
	const { recursive = true, extensions = [".mjs", ".cjs", ".js"] } = options;

	try {
		await stat(dir);
	} catch (error) {
		throw new SlothletError(
			"INVALID_DIRECTORY",
			{
				dir
			},
			error
		);
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

	// Warn if directory is empty or has no loadable modules (valid for add-api workflows)
	if (structure.files.length === 0 && structure.directories.length === 0) {
		new SlothletWarning("WARN_DIRECTORY_EMPTY", {
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

/**
 * Merge extracted exports into an API object with smart flattening.
 * Handles the common pattern where export name matches module name.
 * @param {Object} target - Target API object to merge into
 * @param {Object} exports - Extracted exports from module
 * @param {string} propertyName - Property name to assign to (sanitized module name)
 * @returns {void}
 * @public
 */
export function mergeExportsIntoAPI(target, exports, propertyName) {
	const exportKeys = Object.keys(exports).filter((k) => k !== "default");

	// Case 1: Single named export matching property name - flatten it
	if (exportKeys.length === 1 && exportKeys[0] === propertyName && !exports.default) {
		target[propertyName] = exports[exportKeys[0]];
		return;
	}

	// Case 2: Only default export
	if (exports.default && exportKeys.length === 0) {
		target[propertyName] = exports.default;
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
			const callable = exports.default;
			for (const key of exportKeys) {
				callable[key] = exports[key];
			}
			target[propertyName] = callable;
			return;
		}

		// If default is not a function (object/primitive), create namespace
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
