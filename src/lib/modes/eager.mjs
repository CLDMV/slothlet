/**
 *	@Project: @cldmv/slothlet
 *	@Filename: /src/lib/modes/eager.mjs
 *	@Date: 2026-01-20 20:25:54 -08:00 (1737432354)
 *	@Author: Nate Corcoran <CLDMV>
 *	@Email: <Shinrai@users.noreply.github.com>
 *	-----
 *	@Last modified by: Nate Corcoran <CLDMV> (Shinrai@users.noreply.github.com)
 *	@Last modified time: 2026-03-01 20:21:38 -08:00 (1772425298)
 *	-----
 *	@Copyright: Copyright (c) 2013-2026 Catalyzed Motivation Inc. All rights reserved.
 */

/**
 * @fileoverview Eager mode implementation - loads all modules immediately with unified wrapper
 * @module @cldmv/slothlet/modes/eager
 * @internal
 */
import { ComponentBase } from "@cldmv/slothlet/factories/component-base";

/**
 * Eager mode component - builds APIs by loading all modules immediately.
 * @class EagerMode
 * @extends ComponentBase
 * @package
 */
export class EagerMode extends ComponentBase {
	static slothletProperty = "eager";

	/**
	 * Create EagerMode instance.
	 * @param {object} slothlet - Slothlet orchestrator instance.
	 * @package
	 */
	constructor(slothlet) {
		super(slothlet);
	}

	/**
	 * Build API in eager mode (load all modules immediately).
	 * @param {Object} options - Build options
	 * @param {string} options.dir - Directory path to load from
	 * @param {string} [options.apiPathPrefix=""] - Prefix for API paths
	 * @param {string} [options.collisionContext="initial"] - Collision context
	 * @param {string} [options.moduleID] - Module ID
	 * @param {number} [options.apiDepth=Infinity] - Maximum directory depth
	 * @param {string|null} [options.cacheBust=null] - Cache-busting value
	 * @param {Function|null} [options.fileFilter=null] - Optional filter (fileName) => boolean
	 * @param {Object|null} [options.preloadedStructure=null] - Pre-built `{ files, directories }` structure
	 *   to use instead of scanning `dir` (synthetic / in-memory build, #117). Each synthetic file entry
	 *   carries its exports directly so no module is loaded from disk.
	 * @returns {Promise<Object>} Built API object
	 * @public
	 *
	 * @example
	 * const api = await slothlet.modes.eager.buildAPI({ dir: "./api", moduleID: "base" });
	 */
	async buildAPI({
		dir,
		apiPathPrefix = "",
		collisionContext = "initial",
		moduleID,
		apiDepth = Infinity,
		cacheBust = null,
		fileFilter = null,
		preloadedStructure = null
	}) {
		const api = {};

		const { modesProcessor } = this.slothlet.builders;
		const { loader } = this.slothlet.processors;

		// Synthetic / in-memory build (#117): use the provided structure (files carry their
		// exports) instead of scanning the filesystem.
		const structure = preloadedStructure ?? (await loader.scanDirectory(dir, { maxDepth: apiDepth, fileFilter }));

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
			"eager",
			true, // isRoot
			true, // recursive — load all subdirectories immediately
			false, // populateDirectly=false
			apiPathPrefix,
			collisionContext,
			moduleID,
			dir,
			cacheBust
		);

		return modesProcessor.applyRootContributor(api, rootDefaultFunction, "eager");
	}
}
