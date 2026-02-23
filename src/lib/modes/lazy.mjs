/**
 *	@Project: @cldmv/slothlet
 *	@Filename: /src/lib/modes/lazy.mjs
 *	@Date: 2026-01-20 20:25:54 -08:00 (1737432354)
 *	@Author: Nate Hyson <CLDMV>
 *	@Email: <Shinrai@users.noreply.github.com>
 *	-----
 *	@Last modified by: Nate Hyson <CLDMV> (Shinrai@users.noreply.github.com)
 *	@Last modified time: 2026-02-22 19:47:47 -08:00 (1771818467)
 *	-----
 *	@Copyright: Copyright (c) 2013-2026 Catalyzed Motivation Inc. All rights reserved.
 */

/**
 * @fileoverview Lazy mode implementation - deferred loading with unified wrapper
 * @module @cldmv/slothlet/modes/lazy
 */
import { ComponentBase } from "@cldmv/slothlet/factories/component-base";

/**
 * Lazy mode component - builds APIs with deferred (on-demand) loading.
 * @class LazyMode
 * @extends ComponentBase
 * @package
 */
export class LazyMode extends ComponentBase {
	static slothletProperty = "lazy";

	/**
	 * Create LazyMode instance.
	 * @param {object} slothlet - Slothlet orchestrator instance.
	 * @package
	 */
	constructor(slothlet) {
		super(slothlet);
	}

	/**
	 * Create a named async materialization function for lazy subdirectories.
	 * @param {string} apiPath - API path to derive the function name from.
	 * @param {Function} handler - Async handler that performs materialization.
	 * @returns {Function} Named async materialization function.
	 * @public
	 *
	 * @example
	 * const fn = lazyMode.createNamedMaterializeFunc('api.math', async () => ({ add: (a,b) => a+b }));
	 */
	createNamedMaterializeFunc(apiPath, handler) {
		const safePath = String(apiPath || "api")
			.replace(/\./g, "__")
			.replace(/[^A-Za-z0-9_$]/g, "_");
		const normalized = safePath && /^[A-Za-z_$]/.test(safePath[0]) ? safePath : safePath ? `_${safePath}` : "api";
		const funcName = `${normalized}__lazy_materializeFunc`;
		return {
			[funcName]: async function (...args) {
				return handler(...args);
			}
		}[funcName];
	}

	/**
	 * Build API in lazy mode (proxy-based deferred loading).
	 * @param {Object} options - Build options
	 * @param {string} options.dir - Directory to build from
	 * @param {string} [options.apiPathPrefix=""] - Prefix for API paths
	 * @param {string} [options.collisionContext="initial"] - Collision context
	 * @param {string|null} [options.collisionMode=null] - Collision mode override from api.add()
	 * @param {string} [options.moduleID] - Module ID
	 * @param {number} [options.apiDepth=Infinity] - Maximum directory depth
	 * @param {string|null} [options.cacheBust=null] - Cache-busting value
	 * @param {Function|null} [options.fileFilter=null] - Optional filter (fileName) => boolean
	 * @returns {Promise<Object>} Built API object with lazy proxies
	 * @public
	 *
	 * @example
	 * const api = await slothlet.modes.lazy.buildAPI({ dir: "./api", moduleID: "base" });
	 */
	async buildAPI({
		dir,
		apiPathPrefix = "",
		collisionContext = "initial",
		collisionMode = null,
		moduleID,
		apiDepth = Infinity,
		cacheBust = null,
		fileFilter = null
	}) {
		this.slothlet.debug("modes", {
			key: "DEBUG_MODE_BUILD_LAZY_API_CALLED",
			apiPathPrefix,
			collisionMode,
			collisionContext
		});
		const api = {};

		const { modesProcessor } = this.slothlet.builders;
		const { loader } = this.slothlet.processors;

		const structure = await loader.scanDirectory(dir, { maxDepth: apiDepth, fileFilter });

		const rootDirectory = {
			name: ".",
			path: dir,
			children: {
				files: structure.files,
				directories: structure.directories
			}
		};

		const rootDefaultFunction = await modesProcessor.processFiles(
			api,
			structure.files,
			rootDirectory,
			0,
			"lazy",
			true, // isRoot
			false, // recursive=false — lazy wrappers for subdirs, not eager load
			false, // populateDirectly=false for root level
			apiPathPrefix,
			collisionContext,
			moduleID,
			dir,
			cacheBust,
			collisionMode
		);

		return modesProcessor.applyRootContributor(api, rootDefaultFunction, "lazy");
	}
}
