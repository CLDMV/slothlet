/**
 * @fileoverview Metadata API handler for accessing function metadata
 * @module @cldmv/slothlet/handlers/metadata
 * @public
 */

import { getStack, toFsPath } from "@cldmv/slothlet/helpers/resolve-from-caller";

// Runtime module import (lazy loaded on first use)
let runtimeModule = null;
let runtimeImportPromise = null;

/**
 * Lazily import the runtime module on first access
 * @function ensureRuntime
 * @private
 * @returns {Promise<object>} Runtime module
 */
async function ensureRuntime() {
	if (runtimeModule) {
		return runtimeModule;
	}

	if (!runtimeImportPromise) {
		runtimeImportPromise = import("@cldmv/slothlet/runtime")
			.then((module) => {
				runtimeModule = module;
				return module;
			})
			.catch((err) => {
				console.error("[slothlet] Failed to import runtime for metadata API:", err.message);
				runtimeModule = {}; // Empty object to prevent repeated imports
				return {};
			});
	}

	return runtimeImportPromise;
}

/**
 * Get the current API root from runtime's self binding
 * @function getApiRoot
 * @private
 * @returns {object|null} Current API root (self binding)
 */
function getApiRoot() {
	return runtimeModule?.self || null;
}

/**
 * Parse a V8 CallSite object to extract file path and line number
 * @function parseCallSite
 * @private
 * @param {object} callSite - V8 CallSite object
 * @returns {object|null} Parsed { file, line } or null
 */
function parseCallSite(callSite) {
	try {
		const fileName = callSite.getFileName();
		const lineNumber = callSite.getLineNumber();
		if (!fileName || !lineNumber) return null;
		return {
			file: toFsPath(fileName),
			line: lineNumber
		};
	} catch {
		return null;
	}
}

/**
 * Find function by API path (dot notation)
 * @function findFunctionByPath
 * @private
 * @param {object} apiRoot - Root API object
 * @param {string} path - Dot-notation path
 * @returns {Function|null} Found function or null
 */
function findFunctionByPath(apiRoot, path) {
	const parts = path.split(".");
	let current = apiRoot;

	for (const part of parts) {
		if (!current || typeof current !== "object") return null;
		current = current[part];
	}

	return typeof current === "function" ? current : null;
}

/**
 * Find function by file path and line number from stack trace
 * @function findFunctionByStack
 * @private
 * @param {object} apiRoot - Root API object
 * @param {string} targetFile - File path from stack trace
 * @param {number} targetLine - Line number from stack trace
 * @param {WeakSet} [visited] - Visited objects tracker
 * @returns {Function|null} Found function or null
 */
function findFunctionByStack(apiRoot, targetFile, targetLine, visited = new WeakSet()) {
	if (!apiRoot || typeof apiRoot !== "object") return null;
	if (visited.has(apiRoot)) return null;
	visited.add(apiRoot);

	for (const key of Object.keys(apiRoot)) {
		const value = apiRoot[key];

		if (typeof value === "function") {
			const meta = value.__metadata;
			if (meta?.sourceFile && meta?.sourceLine) {
				const metaFile = toFsPath(meta.sourceFile);
				if (metaFile === targetFile && meta.sourceLine === targetLine) {
					return value;
				}
			}
		} else if (value && typeof value === "object") {
			const found = findFunctionByStack(value, targetFile, targetLine, visited);
			if (found) return found;
		}
	}

	return null;
}

/**
 * Metadata API for introspection of function metadata
 * @namespace metadataAPI
 * @public
 */
export const metadataAPI = {
	/**
	 * Get metadata of the function that called the current function
	 * @function caller
	 * @memberof metadataAPI
	 * @returns {Promise<object|null>} Caller's metadata object or null
	 * @public
	 */
	async caller() {
		await ensureRuntime();
		const apiRoot = getApiRoot();
		if (!apiRoot || typeof apiRoot !== "object") return null;

		const stack = getStack(metadataAPI.caller);
		if (stack.length < 1) return null;

		const parsed = parseCallSite(stack[0]);
		if (!parsed) return null;

		const func = findFunctionByStack(apiRoot, parsed.file, parsed.line);
		if (!func) return null;

		return func.__metadata || null;
	},

	/**
	 * Get metadata of the current function
	 * @function self
	 * @memberof metadataAPI
	 * @returns {Promise<object|null>} Current function's metadata or null
	 * @public
	 */
	async self() {
		await ensureRuntime();
		const apiRoot = getApiRoot();
		if (!apiRoot || typeof apiRoot !== "object") return null;

		const stack = getStack(metadataAPI.self);
		if (stack.length < 1) return null;

		const parsed = parseCallSite(stack[0]);
		if (!parsed) return null;

		const func = findFunctionByStack(apiRoot, parsed.file, parsed.line);
		if (!func) return null;

		return func.__metadata || null;
	},

	/**
	 * Get metadata of any function by API path
	 * @function get
	 * @memberof metadataAPI
	 * @param {string} path - Dot-notation API path
	 * @param {object} [apiRoot] - Optional API root object
	 * @returns {Promise<object|null>} Function's metadata or null
	 * @public
	 */
	async get(path, apiRoot) {
		await ensureRuntime();
		const root = apiRoot || getApiRoot();
		if (!root || (typeof root !== "object" && typeof root !== "function")) {
			return null;
		}

		const func = findFunctionByPath(root, path);
		if (!func) return null;

		return func.__metadata || null;
	}
};
