/**
 * @fileoverview File-level collision test - collides with math/ folder.
 * This file exports at the same path as the math/ folder, creating a collision.
 * @module api_test/collision-math
 */

/**
 * Alternative math implementation that collides with math/ folder.
 * @param {number} a - First number.
 * @param {number} b - Second number.
 * @returns {number} Sum of the two numbers.
 */
export function add(a, b) {
	return a + b + 1000; // Different implementation to test collision
}

/**
 * Version identifier for collision detection.
 * @type {string}
 */
export const collisionVersion = "collision-math-file";
