/**
 * @fileoverview Collision test module - for testing hot-reload collision modes
 * @module api_test.collisionTest
 * 
 * @description
 * This module provides functions that can be used to test collision.addApi modes.
 * When api.add() is called with this content targeting an existing path, the
 * collision mode determines how the conflict is resolved.
 */

/**
 * Original function that exists before hot reload
 * @returns {string} Identifier
 */
export function originalFunction() {
	return "original-collision-test";
}

/**
 * Version marker to identify which module is active
 * @type {string}
 */
export const version = "1.0.0-original";

/**
 * Counter to test state preservation
 * @type {number}
 */
export const callCount = 0;
