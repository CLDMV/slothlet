/**
 * @fileoverview Simplified failure operation utility for testing.
 */

export function failOperation(message, _ = {}) {
	return { success: false, error: message };
}