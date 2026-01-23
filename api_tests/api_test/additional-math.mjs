/**
 * @fileoverview Additional math utilities for hot-reload collision testing
 * @module api_test.additionalMath
 * 
 * @description
 * This module is used to test api.add() collision handling. When added to
 * an existing "math" path, behavior depends on collision.addApi config.
 */

/**
 * Advanced math operation
 * @param {number} a - First number
 * @param {number} b - Second number
 * @returns {number} Result
 */
export function power(a, b) {
	return Math.pow(a, b);
}

/**
 * Square root function
 * @param {number} n - Number
 * @returns {number} Square root
 */
export function sqrt(n) {
	return Math.sqrt(n);
}

/**
 * Modulo operation
 * @param {number} a - Dividend
 * @param {number} b - Divisor
 * @returns {number} Remainder
 */
export function modulo(a, b) {
	return a % b;
}

/**
 * Version identifier for collision detection
 * @type {string}
 */
export const additionalVersion = "2.0.0";
