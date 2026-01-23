/**
 * @fileoverview Duplicate math module to test collision handling
 * @module api_test.math.duplicate
 * 
 * @description
 * This file has the same name as math/main.mjs and will create a collision
 * during initial load. The behavior depends on collision.initial config:
 * - skip: This file is silently ignored
 * - warn: This file is ignored with a warning
 * - replace: This file replaces the original
 * - merge: Properties are merged (if possible at this level)
 * - error: Throws error immediately
 */

/**
 * Duplicate math function that should collide with math/main.mjs
 * @param {number} a - First number
 * @param {number} b - Second number
 * @returns {number} Product
 */
export function duplicateMultiply(a, b) {
	return a * b * 100; // Different implementation
}

/**
 * Version string to identify which module won the collision
 * @type {string}
 */
export const collisionVersion = "duplicate-file";
