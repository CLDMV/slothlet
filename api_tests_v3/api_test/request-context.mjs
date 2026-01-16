/**
 * @fileoverview Test module for per-request context access
 * @module api_test.requestContext
 * @memberof module:api_test
 */

import { context } from "@cldmv/slothlet/runtime";

/**
 * Request context testing utilities
 * @namespace requestContext
 * @memberof module:api_test
 */
export const requestContext = {
	/**
	 * Get current context data
	 * @returns {object} Current context object
	 */
	getContext() {
		return {
			userId: context.userId,
			requestId: context.requestId,
			appName: context.appName,
			version: context.version,
			traceId: context.traceId,
			level: context.level,
			spanId: context.spanId,
			appId: context.appId
		};
	},

	/**
	 * Get specific context property
	 * @param {string} key - Context key to retrieve
	 * @returns {any} Context value
	 */
	get(key) {
		return context[key];
	},

	/**
	 * Test async context access
	 * @param {number} delay - Delay in milliseconds
	 * @returns {Promise<object>} Context after delay
	 */
	async getContextAfterDelay(delay = 10) {
		await new Promise((resolve) => setTimeout(resolve, delay));
		return this.getContext();
	}
};
