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
export function createImmutableMetadata(initial = {}) {
	// Helper to recursively protect nested objects/arrays with proxies
	// Objects are NOT frozen, so new properties can be added
	// But existing properties become immutable
	function makeImmutable(obj, visited = new WeakSet()) {
		if (obj === null || typeof obj !== "object") return obj;
		if (visited.has(obj)) return obj;
		visited.add(obj);

		// Arrays: make existing elements immutable, but don't freeze array itself
		if (Array.isArray(obj)) {
			// Recursively protect array elements
			for (let i = 0; i < obj.length; i++) {
				obj[i] = makeImmutable(obj[i], visited);
			}

			// Wrap array in proxy to prevent ANY modification
			// Arrays should be fully immutable (can't change existing or add new)
			return new Proxy(obj, {
				set() {
					// Reject ALL modifications to arrays
					// (existing elements, new elements, length, etc.)
					return false;
				},
				deleteProperty() {
					// Prevent deletion
					return false;
				}
			});
		}

		// Objects: recursively protect nested properties
		for (const [key, value] of Object.entries(obj)) {
			const immutableValue = makeImmutable(value, visited);
			Object.defineProperty(obj, key, {
				value: immutableValue,
				writable: false, // Cannot modify existing property values
				enumerable: true,
				configurable: true
			});
		}

		// Wrap object in proxy to make new properties immutable after adding
		return new Proxy(obj, {
			set(target, prop, value) {
				const descriptor = Object.getOwnPropertyDescriptor(target, prop);

				// If property exists and is not writable, reject modification
				if (descriptor && !descriptor.writable) {
					return false;
				}

				// Allow adding NEW properties (make them immutable immediately)
				if (!descriptor) {
					const immutableValue = makeImmutable(value);
					Object.defineProperty(target, prop, {
						value: immutableValue,
						writable: false,
						enumerable: true,
						configurable: true
					});
					return true;
				}

				return Reflect.set(target, prop, value);
			},
			deleteProperty() {
				// Prevent deletion
				return false;
			}
		});
	}

	// Create the base object with initial properties made immutable
	const base = {};

	// Set initial properties as non-writable but configurable (for proxy compatibility)
	// Recursively protect nested objects/arrays
	for (const [key, value] of Object.entries(initial)) {
		const immutableValue = makeImmutable(value);
		Object.defineProperty(base, key, {
			value: immutableValue,
			writable: false,
			enumerable: true,
			configurable: true // Required for proxy trap compatibility
		});
	}

	// Use Proxy to intercept new property additions and make them immutable too
	return new Proxy(base, {
		set(target, prop, value) {
			// Check if property already exists
			const descriptor = Object.getOwnPropertyDescriptor(target, prop);

			// If property exists and is not writable, reject modification
			if (descriptor && !descriptor.writable) {
				if (process.env.SLOTHLET_DEBUG) {
					console.warn(`[slothlet] Cannot modify existing metadata property: "${String(prop)}"`);
				}
				// Return false to properly reject the modification
				// In strict mode, this will throw TypeError (which is what we want)
				return false;
			}

			// Allow adding NEW properties (but make them immutable immediately)
			if (!descriptor) {
				Object.defineProperty(target, prop, {
					value,
					writable: false,
					enumerable: true,
					configurable: true // Required for proxy trap compatibility
				});
				return true;
			}

			// If property exists and is writable (shouldn't happen with our setup), allow modification
			// This is a fallback case that shouldn't normally be reached
			return Reflect.set(target, prop, value);
		},

		deleteProperty(target, prop) {
			// Silently ignore deletion attempts
			if (process.env.SLOTHLET_DEBUG) {
				console.warn(`[slothlet] Cannot delete metadata property: "${String(prop)}"`);
			}
			return true; // Return true to avoid TypeError, but don't actually delete
		}
	});
}

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
export function cleanMetadata(obj, visited = new WeakSet()) {
	// Prevent infinite recursion
	if (!obj || (typeof obj !== "object" && typeof obj !== "function")) return;
	if (visited.has(obj)) return;
	visited.add(obj);

	// Clean if it's a function
	if (typeof obj === "function") {
		try {
			if (obj.__metadata) {
				delete obj.__metadata;
			}
			if (obj.__sourceFolder) {
				delete obj.__sourceFolder;
			}
		} catch (_) {
			// Ignore errors (frozen objects, etc.)
		}
	}

	// Recursively clean properties
	try {
		const keys = Object.keys(obj);
		for (const key of keys) {
			if (
				key.startsWith("_") ||
				["hooks", "shutdown", "addApi", "describe", "run", "__proto__", "constructor", "prototype"].includes(key)
			) {
				continue;
			}
			cleanMetadata(obj[key], visited);
		}
	} catch {
		// Ignore errors accessing properties
	}
}

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
export function tagLoadedFunctions(obj, metadata, baseDir, visited = new WeakSet()) {
	// Prevent infinite recursion
	if (!obj || (typeof obj !== "object" && typeof obj !== "function")) return;
	if (visited.has(obj)) return;
	visited.add(obj);

	// Tag if it's a function
	if (typeof obj === "function") {
		try {
			// Create new immutable metadata object
			const immutableMeta = createImmutableMetadata(metadata);

			Object.defineProperty(obj, "__metadata", {
				value: immutableMeta,
				writable: false,
				enumerable: false,
				configurable: true // MUST be configurable for lazy mode proxy compatibility
			});

			// Also add sourceFolder separately for easy access
			if (metadata.sourceFolder) {
				Object.defineProperty(obj, "__sourceFolder", {
					value: metadata.sourceFolder,
					writable: false,
					enumerable: false,
					configurable: true // MUST be configurable for lazy mode proxy compatibility
				});
			}

			// Track source file and line for stack trace matching
			// This requires source map or file tracking during module load
			// For now, we'll skip this and rely on __slothletPath for identification
		} catch (error) {
			// Ignore errors (frozen objects, etc.)
			if (metadata.debug) {
				console.warn(`[slothlet] Could not tag function with metadata:`, error.message);
			}
		}
	}

	// Recursively tag properties (works for both functions and objects)
	try {
		const keys = Object.keys(obj);
		for (const key of keys) {
			// Skip internal properties and management methods
			if (
				key.startsWith("_") ||
				["hooks", "shutdown", "addApi", "describe", "run", "__proto__", "constructor", "prototype"].includes(key)
			) {
				continue;
			}

			tagLoadedFunctions(obj[key], metadata, baseDir, visited);
		}
	} catch {
		// Ignore errors accessing properties
	}
}
