/**
 *	@Project: @cldmv/slothlet
 *	@Filename: /src/lib/builders/builder.mjs
 *	@Date: 2026-01-20 20:25:54 -08:00 (1737432354)
 *	@Author: Nate Corcoran <CLDMV>
 *	@Email: <Shinrai@users.noreply.github.com>
 *	-----
 *	@Last modified by: Nate Corcoran <CLDMV> (Shinrai@users.noreply.github.com)
 *	@Last modified time: 2026-03-01 20:21:36 -08:00 (1772425296)
 *	-----
 *	@Copyright: Copyright (c) 2013-2026 Catalyzed Motivation Inc. All rights reserved.
 */

/**
 * @fileoverview API building orchestration (mode-agnostic)
 * @module @cldmv/slothlet/builder
 * @internal
 */
import { ComponentBase } from "@cldmv/slothlet/factories/component-base";

/**
 * API builder class for orchestrating mode-based API construction.
 * @class Builder
 * @extends ComponentBase
 * @package
 *
 * @description
 * Orchestrates API building by delegating to mode-specific builders (eager/lazy).
 * Extends ComponentBase for access to Slothlet configuration and error classes.
 *
 * @example
 * const builder = new Builder(slothlet);
 * const api = await builder.buildAPI({ dir: "./api" });
 */
export class Builder extends ComponentBase {
	static slothletProperty = "builder";

	/**
	 * Create Builder instance.
	 * @param {object} slothlet - Slothlet orchestrator instance.
	 * @package
	 *
	 * @description
	 * Stores Slothlet reference for accessing configuration and components.
	 *
	 * @example
	 * const builder = new Builder(slothlet);
	 */
	constructor(slothlet) {
		super(slothlet);
	}

	/**
	 * Build API from directory or file.
	 * @param {Object} options - Build options
	 * @param {string} [options.dir] - Directory or file to build from. Required unless `syntheticExports` is set (synthetic / in-memory leaf, #117).
	 * @param {string} [options.mode="eager"] - Loading mode (eager or lazy)
	 * @param {Object} [options.ownership] - Ownership manager (uses slothlet's if not provided)
	 * @param {Object} [options.contextManager] - Context manager (uses slothlet's if not provided)
	 * @param {string} [options.instanceID] - Instance ID (uses slothlet's if not provided)
	 * @param {Object} [options.config] - Configuration (uses slothlet's if not provided)
	 * @param {string} [options.apiPathPrefix=""] - Prefix for API paths (for api.add support)
	 * @param {string} [options.collisionContext="initial"] - Collision context
	 * @param {Function|null} [options.fileFilter=null] - Optional filter function (fileName) => boolean to load specific files only
	 * @param {Object|null} [options.syntheticExports=null] - Inline `{ default?, ...named }` exports to build
	 *   from instead of scanning `dir` (synthetic / in-memory leaf, #117). When set, `dir` is not required.
	 * @param {string} [options.syntheticName="synthetic"] - Intermediate key name for the synthetic build.
	 * @returns {Promise<Object>} Raw API object (unwrapped)
	 * @public
	 *
	 * @description
	 * Validates inputs and delegates to mode-specific builder (buildEagerAPI or buildLazyAPI).
	 * When fileFilter is provided, only files matching the filter are loaded.
	 *
	 * @example
	 * const api = await builder.buildAPI({ dir: "./api_tests/api_test", mode: "eager" });
	 *
	 * @example
	 * // Load specific file only
	 * const api = await builder.buildAPI({
	 *   dir: "./api_tests/api_test",
	 *   mode: "eager",
	 *   fileFilter: (fileName) => fileName === "math.mjs"
	 * });
	 */
	async buildAPI(options) {
		const {
			dir,
			mode = "eager",
			apiPathPrefix = "",
			collisionContext = "initial",
			moduleID,
			cacheBust = null,
			fileFilter = null,
			collisionMode = null,
			syntheticExports = null,
			syntheticName = "synthetic"
		} = options;

		// Synthetic / in-memory build (#117): build the API from supplied exports rather than a
		// directory. A single synthetic "file" carries the `{ default?, ...named }` exports and
		// flows through the same flatten + wrap pipeline a real file would. `dir` is not required.
		let preloadedStructure = null;
		let effectiveDir = dir;
		if (syntheticExports) {
			// Validate synthetic inputs up front so a malformed value fails with a structured
			// SlothletError rather than a raw TypeError deep in the flatten pipeline (#136 review).
			// The export map must be a PLAIN object: the flatten pipeline expects a
			// `{ default?, ...named }` shape, so class instances (Map/Date/Buffer/TypedArray/…)
			// would otherwise pass a bare `typeof === "object"` check and produce empty/odd mounts.
			const isPlainObject = (value) => {
				if (value === null || typeof value !== "object") return false;
				const proto = Object.getPrototypeOf(value);
				return proto === Object.prototype || proto === null;
			};
			if (!isPlainObject(syntheticExports)) {
				throw new this.SlothletError("INVALID_CONFIG_SYNTHETIC_EXPORTS_SHAPE", {
					received: Array.isArray(syntheticExports)
						? "array"
						: typeof syntheticExports === "object"
							? `${syntheticExports.constructor?.name ?? "non-plain object"} instance`
							: typeof syntheticExports,
					validationError: true
				});
			}
			if (typeof syntheticName !== "string" || !syntheticName) {
				throw new this.SlothletError("INVALID_CONFIG_SYNTHETIC_NAME", {
					// An empty string passes `typeof === "string"`, so reporting the type alone
					// ("received string") hides the real fault; surface it as "<empty>" instead.
					received: typeof syntheticName === "string" ? "<empty>" : typeof syntheticName,
					validationError: true
				});
			}
			const sentinel = `synthetic:${syntheticName}`;
			effectiveDir = sentinel;
			preloadedStructure = {
				files: [
					{
						path: sentinel,
						name: syntheticName,
						fullName: `${syntheticName}.mjs`,
						moduleID,
						synthetic: true,
						exports: syntheticExports
					}
				],
				directories: []
			};
		} else if (!dir || typeof dir !== "string") {
			// Validate inputs — dir is required for a filesystem build.
			throw new this.SlothletError(
				"INVALID_CONFIG_DIR_INVALID",
				{
					dir: dir
				},
				null,
				{ validationError: true }
			);
		}

		if (mode !== "eager" && mode !== "lazy") {
			throw new this.SlothletError(
				"INVALID_CONFIG_MODE_INVALID",
				{
					value: mode
				},
				null,
				{ validationError: true }
			);
		}

		// Build based on mode - each mode handles its own scanning and flattening
		let rawAPI;
		if (mode === "eager") {
			rawAPI = await this.slothlet.modes.eager.buildAPI({
				dir: effectiveDir,
				apiPathPrefix,
				collisionContext,
				moduleID,
				apiDepth: this.slothlet.config.apiDepth,
				cacheBust,
				fileFilter,
				preloadedStructure
			});
		} else {
			rawAPI = await this.slothlet.modes.lazy.buildAPI({
				dir: effectiveDir,
				apiPathPrefix,
				collisionContext,
				collisionMode,
				moduleID,
				apiDepth: this.slothlet.config.apiDepth,
				cacheBust,
				fileFilter,
				preloadedStructure
			});
		}

		return rawAPI;
	}
}
