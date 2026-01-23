/**
 * Math collision test file for testing collision.addApi configuration.
 *
 * This file exports functions that will collide with the existing math/ namespace
 * when loaded via api.slothlet.api.add("math", ...).
 *
 * The api_test/math/ folder already exports: add, multiply, divide, subtract
 * This file provides additional functions that should be added to the same namespace.
 *
 * @module api_test_collections/math-collision
 */

/**
 * Calculate power of a number.
 * @param {number} base - The base number.
 * @param {number} exponent - The exponent.
 * @returns {number} The result of base^exponent.
 */
export function power(base, exponent) {
	return Math.pow(base, exponent);
}

/**
 * Calculate square root of a number.
 * @param {number} n - The number.
 * @returns {number} The square root.
 */
export function sqrt(n) {
	return Math.sqrt(n);
}

/**
 * Calculate modulo of two numbers.
 * @param {number} a - First number.
 * @param {number} b - Second number.
 * @returns {number} The remainder.
 */
export function modulo(a, b) {
	return a % b;
}

/**
 * Version identifier for collision detection.
 * @type {string}
 */
export const collisionVersion = "math-collision-v1";
