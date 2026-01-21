/**
 *	@Project: @cldmv/slothlet
 *	@Filename: /src/lib/helpers/metadata-api.mjs
 *	@Date: 2025-12-31 00:00:00 -08:00
 *	@Author: Nate Hyson <CLDMV>
 *	@Email: <Shinrai@users.noreply.github.com>
 *	-----
 *	@Last modified by: Nate Hyson <CLDMV> (Shinrai@users.noreply.github.com)
 *	@Last modified time: 2025-12-31 22:38:21 -08:00 (1767249501)
 *	-----
 *	@Copyright: Copyright (c) 2013-2025 Catalyzed Motivation Inc. All rights reserved.
 */

/**
 * @fileoverview Metadata API for accessing function metadata in slothlet.
 * @module @cldmv/slothlet/lib/helpers/metadata-api
 * @memberof module:@cldmv/slothlet.lib.helpers
 * @public
 *
 * @description
 * Provides introspection capabilities for accessing metadata attached to dynamically
 * loaded API functions. Enables security and access control patterns by allowing
 * functions to inspect metadata of their callers.
 *
 * @example
 * // ESM usage
 * import { metadataAPI } from "@cldmv/slothlet/runtime";
 *
 * export function secureFunction() {
 *     const caller = metadataAPI.caller();
 *     if (!caller?.trusted) {
 *         throw new Error("Access denied");
 *     }
 *     return "sensitive data";
 * }
 *
 * @example
 * // CJS usage
 * const { metadataAPI } = require("@cldmv/slothlet/runtime");
 */

import { getStack, toFsPath } from "@cldmv/slothlet/helpers/resolve-from-caller";

// Runtime module import (lazy loaded on first use)
let runtimeModule = null;
let runtimeImportPromise = null;

/**
 * Lazily import the runtime module on first access.
 *
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
 * Get the current API root from runtime's self binding.
 * The runtime system (async/live) handles instance detection.
 *
 * @function getApiRoot
 * @private
 * @returns {object|null} Current API root (self binding)
 */
function getApiRoot() {
	// Note: This must be called after ensureRuntime() has completed
	return runtimeModule?.self || null;
}

/**
 * Finds a function in the API tree by matching file path and line number from stack trace.
 *
 * @function findFunctionByStack
 * @private
 * @param {object} apiRoot - Root API object to search
 * @param {string} targetFile - File path from stack trace
 * @param {number} targetLine - Line number from stack trace
 * @param {WeakSet} [visited] - Visited objects tracker
 * @returns {Function|null} Found function or null
 *
 * @description
 * Recursively searches the API tree for a function whose __sourceFile and __sourceLine
 * match the stack trace information. This enables reliable caller identification.
 */
function findFunctionByStack(apiRoot, targetFile, targetLine, visited = new WeakSet()) {
	if (!apiRoot || visited.has(apiRoot)) return null;
	visited.add(apiRoot);

	// Check if this function matches
	if (typeof apiRoot === "function" && apiRoot.__sourceFile && apiRoot.__sourceLine) {
		if (apiRoot.__sourceFile === targetFile && apiRoot.__sourceLine === targetLine) {
			return apiRoot;
		}
	}

	// Search properties
	if (typeof apiRoot === "object" || typeof apiRoot === "function") {
		const keys = Object.keys(apiRoot);
		for (const key of keys) {
			// Skip internal properties
			if (key.startsWith("_") || ["hooks", "shutdown", "addApi", "describe", "run"].includes(key)) {
				continue;
			}

			const result = findFunctionByStack(apiRoot[key], targetFile, targetLine, visited);
			if (result) return result;
		}
	}

	return null;
}

/**
 * Finds a function in the API tree by dot-notation path.
 *
 * @function findFunctionByPath
 * @private
 * @param {object} apiRoot - Root API object to search
 * @param {string} path - Dot-notation path (e.g., "math.add")
 * @returns {Function|null} Found function or null
 *
 * @description
 * Navigates the API tree using a dot-notation path string to locate a specific function.
 * Used by the get() method and as a fallback for caller identification.
 */
function findFunctionByPath(apiRoot, path) {
	if (!path || typeof path !== "string") return null;

	const parts = path.split(".");
	let current = apiRoot;

	for (const part of parts) {
		if (!current || (typeof current !== "object" && typeof current !== "function")) {
			if (process.env.SLOTHLET_DEBUG) {
				console.log("[findFunctionByPath] Failed: current is", typeof current);
			}
			return null;
		}
		current = current[part];
	}

	const result = typeof current === "function" ? current : null;
	if (process.env.SLOTHLET_DEBUG) {
		console.log("[findFunctionByPath] Result:", result ? "function found" : "null");
	}
	return result;
}

/**
 * Extracts file path and line number from a V8 CallSite object.
 *
 * @function parseCallSite
 * @private
 * @param {CallSite} cs - V8 CallSite object from getStack()
 * @returns {{file: string, line: number}|null} Parsed information or null
 *
 * @description
 * Extracts file path and line number from V8 CallSite objects.
 * Uses toFsPath() to handle file:// URLs properly across platforms.
 * Returns null for invalid or internal Node.js frames.
 */
function parseCallSite(cs) {
	if (!cs) return null;

	const fileName = cs.getFileName?.();
	if (!fileName) return null;

	// Convert to filesystem path (handles file:// URLs)
	const filePath = toFsPath(fileName);
	if (!filePath) return null;

	// Skip node:internal modules
	if (filePath.startsWith?.("node:internal")) return null;

	const lineNum = cs.getLineNumber?.();
	if (typeof lineNum !== "number") return null;

	return { file: filePath, line: lineNum };
}

/**
 * Metadata API for introspection of function metadata.
 *
 * @namespace metadataAPI
 * @public
 *
 * @description
 * Provides methods to inspect metadata attached to API functions. Enables
 * access control patterns where functions can verify the identity and
 * permissions of their callers.
 */
export const metadataAPI = {
	/**
	 * Get metadata of the function that called the current function.
	 *
	 * @function caller
	 * @memberof metadataAPI
	 * @returns {object|null} Caller's metadata object or null if not found
	 * @public
	 *
	 * @description
	 * Uses stack trace analysis to identify the calling function and retrieve
	 * its attached metadata. Useful for implementing access control where a
	 * function needs to verify the identity/permissions of its caller.
	 *
	 * Stack trace structure:
	 * - Line 0: Error
	 * - Line 1: metadataAPI.caller (this function)
	 * - Line 2: Current function (the one checking)
	 * - Line 3: The caller we want to identify
	 *
	 * @example
	 * // In a secure function
	 * import { metadataAPI } from "@cldmv/slothlet/runtime";
	 *
	 * export function getSecrets() {
	 *     const caller = metadataAPI.caller();
	 *
	 *     if (!caller?.trusted) {
	 *         throw new Error("Access denied: untrusted caller");
	 *     }
	 *
	 *     if (!caller.permissions?.includes("read_secrets")) {
	 *         throw new Error("Access denied: insufficient permissions");
	 *     }
	 *
	 *     return { apiKey: "secret123", token: "xyz" };
	 * }
	 *
	 * @example
	 * // With custom metadata tags
	 * const caller = metadataAPI.caller();
	 * console.log("Caller source:", caller?.sourceFolder);
	 * console.log("Caller version:", caller?.version);
	 * console.log("Caller author:", caller?.author);
	 */
	async caller() {
		// Ensure runtime is loaded first
		await ensureRuntime();

		// Use runtime's self binding which handles instance detection
		const apiRoot = getApiRoot();
		if (!apiRoot || typeof apiRoot !== "object") return null;

		// Get V8 stack trace using existing helper
		const stack = getStack(metadataAPI.caller);

		// Skip: current function line (already skipped by getStack)
		// Stack[0] is the caller, Stack[1] is the caller's caller, etc.
		// We want Stack[0] - the function that called the function that called metadataAPI.caller()
		if (stack.length < 1) return null;

		const parsed = parseCallSite(stack[0]);
		if (!parsed) return null;

		// Find function by file path and line number
		const func = findFunctionByStack(apiRoot, parsed.file, parsed.line);
		if (!func) return null;

		// Return the metadata object (or null if not present)
		return func.__metadata || null;
	},

	/**
	 * Get metadata of the current function.
	 *
	 * @function self
	 * @memberof metadataAPI
	 * @returns {object|null} Current function's metadata or null if not found
	 * @public
	 *
	 * @description
	 * Retrieves metadata attached to the currently executing function. Useful
	 * for functions that need to inspect their own metadata (e.g., for logging,
	 * conditional behavior based on load source).
	 *
	 * Stack trace structure:
	 * - Line 0: Error
	 * - Line 1: metadataAPI.self (this function)
	 * - Line 2: Current function (the one we want to identify)
	 *
	 * @example
	 * // Function checking its own metadata
	 * import { metadataAPI } from "@cldmv/slothlet/runtime";
	 *
	 * export function smartFunction() {
	 *     const meta = metadataAPI.self();
	 *
	 *     if (meta?.environment === "development") {
	 *         console.log("Running in development mode");
	 *     }
	 *
	 *     if (meta?.version) {
	 *         console.log(`Function version: ${meta.version}`);
	 *     }
	 *
	 *     return "result";
	 * }
	 */
	async self() {
		// Ensure runtime is loaded first
		await ensureRuntime();

		// Use runtime's self binding which handles instance detection
		const apiRoot = getApiRoot();
		if (!apiRoot || typeof apiRoot !== "object") return null;

		// Get V8 stack trace using existing helper
		const stack = getStack(metadataAPI.self);

		// Stack[0] is the caller (the function whose metadata we want)
		if (stack.length < 1) return null;

		const parsed = parseCallSite(stack[0]);
		if (!parsed) return null;

		// Find function by file path and line number
		const func = findFunctionByStack(apiRoot, parsed.file, parsed.line);
		if (!func) return null;

		// Return the metadata object (or null if not present)
		return func.__metadata || null;
	},

	/**
	 * Get metadata of any function by API path.
	 *
	 * @function get
	 * @memberof metadataAPI
	 * @param {string} path - Dot-notation API path (e.g., "math.add", "plugins.helper")
	 * @param {object} [apiRoot] - Optional API root object (uses runtime.self if not provided)
	 * @returns {object|null} Function's metadata or null if not found
	 * @public
	 *
	 * @description
	 * Retrieves metadata for any function in the API tree by its path. Useful
	 * for checking metadata of functions you have references to, or for
	 * administrative/introspection purposes.
	 *
	 * @example
	 * // Check metadata of a specific function
	 * import { metadataAPI } from "@cldmv/slothlet/runtime";
	 *
	 * export function checkPermissions() {
	 *     const pluginMeta = metadataAPI.get("plugins.userPlugin");
	 *
	 *     if (!pluginMeta) {
	 *         throw new Error("Plugin not found or has no metadata");
	 *     }
	 *
	 *     if (pluginMeta.trusted) {
	 *         console.log("Plugin is trusted");
	 *     } else {
	 *         console.log("Plugin is untrusted");
	 *     }
	 * }
	 *
	 * @example
	 * // Iterate and check all plugins
	 * const pluginPaths = ["plugins.auth", "plugins.logger", "plugins.cache"];
	 * for (const path of pluginPaths) {
	 *     const meta = metadataAPI.get(path);
	 *     console.log(`${path}: ${meta?.version || "unknown"}`);
	 * }
	 *
	 * @example
	 * // From outside slothlet context, pass API root explicitly
	 * const api = await slothlet({ dir: "./modules" });
	 * const meta = await metadataAPI.get("plugins.helper", api);
	 */
	async get(path, apiRoot) {
		// Ensure runtime is loaded first
		await ensureRuntime();

		// Use provided apiRoot or fallback to runtime's self binding
		const root = apiRoot || getApiRoot();
		if (!root || (typeof root !== "object" && typeof root !== "function")) {
			return null;
		}

		const func = findFunctionByPath(root, path);
		if (!func) return null;

		// Return the metadata object (or null if not present)
		return func.__metadata || null;
	}
};
