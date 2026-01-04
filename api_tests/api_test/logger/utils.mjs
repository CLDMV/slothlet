/**
 * @fileoverview Debug utilities for logger namespace
 */

/**
 * Debug level logging
 * @param {string} message - Debug message
 * @returns {string} Formatted debug message
 */
export function debug(message) {
	return `[DEBUG] ${new Date().toISOString()}: ${message}`;
}

/**
 * Error level logging
 * @param {string} message - Error message
 * @returns {string} Formatted error message
 */
export function error(message) {
	return `[ERROR] ${new Date().toISOString()}: ${message}`;
}
