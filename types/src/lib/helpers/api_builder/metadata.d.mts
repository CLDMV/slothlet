/**
 *	@Project: @cldmv/slothlet
 *	@Filename: /src/lib/helpers/api_builder/metadata.mjs
 *	@Date: 2025-12-31 00:00:00 -08:00
 *	@Author: Nate Hyson <CLDMV>
 *	@Email: <Shinrai@users.noreply.github.com>
 *	-----
 *	@Last modified by: Nate Hyson <CLDMV> (Shinrai@users.noreply.github.com)
 *	@Last modified time: 2025-12-31 22:30:16 -08:00 (1767249016)
 *	-----
 *	@Copyright: Copyright (c) 2013-2025 Catalyzed Motivation Inc. All rights reserved.
 */
/**
 * @fileoverview Metadata management utilities for API functions.
 * @module @cldmv/slothlet/lib/helpers/api_builder/metadata
 * @memberof module:@cldmv/slothlet.lib.helpers.api_builder
 * @internal
 * @private
 *
 * @description
 * Provides utilities for tagging functions with immutable metadata, cleaning stale metadata
 * from cached modules, and creating immutable metadata objects with deep freezing.
 *
 * Key Features:
 * - Immutable metadata with Proxy-based enforcement
 * - Deep freezing of nested objects and arrays
 * - Recursive traversal for tagging/cleaning object trees
 * - CommonJS cache-aware metadata cleanup
 */
/**
 * Creates an immutable-but-extensible metadata proxy object.
 *
 * @function createImmutableMetadata
 * @param {object} initial - Initial metadata properties
 * @returns {object} Object with immutable existing properties but allows adding new ones
 *
 * @description
 * Creates an object that enforces immutability of existing properties while allowing
 * new properties to be added. This prevents tampering with security-critical metadata
 * while allowing runtime extension of metadata for additional context.
 *
 * Security features:
 * - Existing properties cannot be modified (non-writable, non-configurable after first set)
 * - Properties cannot be deleted
 * - New properties can be added, which then become immutable
 *
 * @example
 * const meta = createImmutableMetadata({ trusted: true, version: "1.0" });
 * meta.author = "Alice"; // OK - new property
 * meta.author = "Bob"; // FAIL - cannot modify after setting
 * meta.trusted = false;  // FAIL - cannot modify existing property
 * delete meta.version;   // FAIL - cannot delete properties
 */
export function createImmutableMetadata(initial?: object): object;
/**
 * Removes metadata from all functions in an object tree.
 *
 * @function cleanMetadata
 * @param {object|Function} obj - Object or function to clean
 * @param {WeakSet} [visited] - Visited objects tracker to prevent infinite recursion
 * @returns {void}
 *
 * @description
 * Traverses an object/function tree and removes __metadata and __sourceFolder properties.
 * This is needed when reloading CommonJS modules that cache function object references.
 */
export function cleanMetadata(obj: object | Function, visited?: WeakSet<any>): void;
/**
 * Recursively tags all functions in an object tree with metadata.
 *
 * @function tagLoadedFunctions
 * @param {object|Function} obj - Object or function to tag
 * @param {object} metadata - Metadata object to attach
 * @param {string} baseDir - Base directory path for relative file tracking
 * @param {WeakSet} [visited] - Visited objects tracker to prevent infinite recursion
 * @returns {void}
 *
 * @description
 * Traverses an object/function tree and attaches immutable metadata to all functions.
 * Also tracks source file information (__sourceFile, __sourceLine) for stack trace
 * matching. Only tags functions that don't already have metadata (non-overwriting).
 *
 * Attached properties:
 * - __metadata: Immutable metadata proxy with all user-provided metadata
 * - __sourceFolder: Absolute path to the folder the module was loaded from
 * - __sourceFile: Absolute file path (for stack trace matching)
 * - __sourceLine: Line number where function is defined (for stack trace matching)
 *
 * @example
 * const modules = { math: { add: (a, b) => a + b } };
 * tagLoadedFunctions(modules, {
 *     trusted: true,
 *     version: "1.0.0",
 *     author: "Alice"
 * }, "/path/to/plugins");
 * // Now modules.math.add.__metadata.trusted === true
 */
export function tagLoadedFunctions(obj: object | Function, metadata: object, baseDir: string, visited?: WeakSet<any>): void;
//# sourceMappingURL=metadata.d.mts.map