/**
 *	@Project: @cldmv/slothlet
 *	@Filename: /src/lib/modes/eager.mjs
 *	@Date: 2026-01-20 20:25:54 -08:00 (1737432354)
 *	@Author: Nate Hyson <CLDMV>
 *	@Email: <Shinrai@users.noreply.github.com>
 *	-----
 *	@Last modified by: Nate Hyson <CLDMV> (Shinrai@users.noreply.github.com)
 *	@Last modified time: 2026-02-05 15:54:19 -08:00 (1770335659)
 *	-----
 *	@Copyright: Copyright (c) 2013-2026 Catalyzed Motivation Inc. All rights reserved.
 */

/**
 * @fileoverview Eager mode implementation - loads all modules immediately with unified wrapper
 * @module @cldmv/slothlet/modes/eager
 */

/**
 * Build API in eager mode (load all modules immediately)
 * @param {Object} options - Build options
 * @param {string} options.dir - Directory path to load from
 * @param {Object} options.ownership - Ownership manager
 * @param {Object} options.contextManager - Context manager for binding
 * @param {string} options.instanceID - Slothlet instance ID
 * @param {Object} options.config - Configuration
 * @param {number} [options.maxDepth=Infinity] - Maximum depth for directory traversal
 * @param {string} [options.apiPathPrefix=""] - Prefix for API paths
 * @returns {Promise<Object>} Built API object
 * @public
 */
export async function buildEagerAPI({
	dir,
	apiPathPrefix = "",
	collisionContext = "initial",
	moduleID,
	slothlet,
	apiDepth = Infinity,
	cacheBust = null
}) {
	const api = {};

	// Access components via slothlet instance
	const { modesProcessor } = slothlet.builders;
	const { loader } = slothlet.processors;

	// Scan directory structure with depth limit
	const structure = await loader.scanDirectory(dir, { maxDepth: apiDepth });

	// Process root files (with root contributor pattern support)
	// Pass synthetic root directory with children.directories for consistent handling
	const rootDirectory = {
		name: ".",
		path: dir, // Add path so folder wrappers can be tagged with metadata
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
		true, // recursive - MUST be true to process subdirectories!
		false, // populateDirectly - keep false
		apiPathPrefix,
		collisionContext,
		moduleID,
		dir, // sourceFolder for metadata
		cacheBust
	);

	// Directory processing is now handled by processFiles when recursive=true

	// Apply root contributor pattern: if a root function exists, make it THE api
	const finalApi = await modesProcessor.applyRootContributor(api, rootDefaultFunction, slothlet.config, "eager");

	return finalApi;
}
