/**
 * @fileoverview Main logger function for callable namespace test
 */

/**
 * Default logger function - makes the namespace callable
 * @param {string} message - Message to log
 * @returns {string} Formatted log message
 */
export default function log(message) {
	return `[LOG] ${new Date().toISOString()}: ${message}`;
}
