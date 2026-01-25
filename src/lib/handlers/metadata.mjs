/**
 * @fileoverview Metadata API handler for accessing function metadata
 * @module @cldmv/slothlet/handlers/metadata
 * @package
 */

import { ComponentBase } from "@cldmv/slothlet/helpers/component-base";

/**
 * Metadata handler for introspection of function metadata
 * @class Metadata
 * @extends ComponentBase
 * @package
 */
export class Metadata extends ComponentBase {
	static slothletProperty = "metadata";

	#runtimeModule = null;
	#runtimeImportPromise = null;

	/**
	 * Create Metadata instance
	 * @param {Object} slothlet - Slothlet instance
	 */
	constructor(slothlet) {
		super(slothlet);
	}

	/**
	 * Lazily import the runtime module on first access
	 * @private
	 * @returns {Promise<object>} Runtime module
	 */
	async #ensureRuntime() {
		if (this.#runtimeModule) {
			return this.#runtimeModule;
		}

		if (!this.#runtimeImportPromise) {
			this.#runtimeImportPromise = import("@cldmv/slothlet/runtime")
				.then((module) => {
					this.#runtimeModule = module;
					return module;
				})
				.catch((err) => {
					new this.SlothletWarning("ERROR_RUNTIME_IMPORT_FAILED", {}, err);
					this.#runtimeModule = {}; // Empty object to prevent repeated imports
					return {};
				});
		}

		return this.#runtimeImportPromise;
	}

	/**
	 * Get the current API root from runtime's self binding
	 * @private
	 * @returns {object|null} Current API root (self binding)
	 */
	#getApiRoot() {
		return this.#runtimeModule?.self || null;
	}

	/**
	 * Parse a V8 CallSite object to extract file path and line number
	 * @private
	 * @param {object} callSite - V8 CallSite object
	 * @returns {object|null} Parsed { file, line } or null
	 */
	#parseCallSite(callSite) {
		try {
			const fileName = callSite.getFileName();
			const lineNumber = callSite.getLineNumber();
			if (!fileName || !lineNumber) return null;
			return {
				file: this.slothlet.helpers.resolver.toFsPath(fileName),
				line: lineNumber
			};
		} catch {
			return null;
		}
	}

	/**
	 * Find function by API path (dot notation)
	 * @private
	 * @param {object} apiRoot - Root API object
	 * @param {string} path - Dot-notation path
	 * @returns {Function|null} Found function or null
	 */
	#findFunctionByPath(apiRoot, path) {
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
	 * @private
	 * @param {object} apiRoot - Root API object
	 * @param {string} targetFile - File path from stack trace
	 * @param {number} targetLine - Line number from stack trace
	 * @param {WeakSet} [visited] - Visited objects tracker
	 * @returns {Function|null} Found function or null
	 */
	#findFunctionByStack(apiRoot, targetFile, targetLine, visited = new WeakSet()) {
		if (!apiRoot || typeof apiRoot !== "object") return null;
		if (visited.has(apiRoot)) return null;
		visited.add(apiRoot);

		for (const key of Object.keys(apiRoot)) {
			const value = apiRoot[key];

			if (typeof value === "function") {
				const meta = value.__metadata;
				if (meta?.sourceFile && meta?.sourceLine) {
					const metaFile = this.slothlet.helpers.resolver.toFsPath(meta.sourceFile);
					if (metaFile === targetFile && meta.sourceLine === targetLine) {
						return value;
					}
				}
			} else if (value && typeof value === "object") {
				const found = this.#findFunctionByStack(value, targetFile, targetLine, visited);
				if (found) return found;
			}
		}

		return null;
	}

	/**
	 * Get metadata of the function that called the current function
	 * @returns {Promise<object|null>} Caller's metadata object or null
	 * @public
	 */
	async caller() {
		await this.#ensureRuntime();
		const apiRoot = this.#getApiRoot();
		if (!apiRoot || typeof apiRoot !== "object") return null;

		const stack = this.slothlet.helpers.resolver.getStack(this.caller);
		if (stack.length < 1) return null;

		const parsed = this.#parseCallSite(stack[0]);
		if (!parsed) return null;

		const func = this.#findFunctionByStack(apiRoot, parsed.file, parsed.line);
		if (!func) return null;

		return func.__metadata || null;
	}

	/**
	 * Get metadata of the current function
	 * @returns {Promise<object|null>} Current function's metadata or null
	 * @public
	 */
	async self() {
		await this.#ensureRuntime();
		const apiRoot = this.#getApiRoot();
		if (!apiRoot || typeof apiRoot !== "object") return null;

		const stack = this.slothlet.helpers.resolver.getStack(this.self);
		if (stack.length < 1) return null;

		const parsed = this.#parseCallSite(stack[0]);
		if (!parsed) return null;

		const func = this.#findFunctionByStack(apiRoot, parsed.file, parsed.line);
		if (!func) return null;

		return func.__metadata || null;
	}

	/**
	 * Get metadata of any function by API path
	 * @param {string} path - Dot-notation API path
	 * @param {object} [apiRoot] - Optional API root object
	 * @returns {Promise<object|null>} Function's metadata or null
	 * @public
	 */
	async get(path, apiRoot) {
		await this.#ensureRuntime();
		const root = apiRoot || this.#getApiRoot();
		if (!root || (typeof root !== "object" && typeof root !== "function")) {
			return null;
		}

		const func = this.#findFunctionByPath(root, path);
		if (!func) return null;

		return func.__metadata || null;
	}
}
