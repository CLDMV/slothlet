/**
 *	@Project: @cldmv/slothlet
 *	@Filename: /api_tests/api_test/request-context.mjs
 *	@Date: 2025-12-30T19:29:09-08:00 (1767151749)
 *	@Author: Nate Corcoran <CLDMV>
 *	@Email: <Shinrai@users.noreply.github.com>
 *	-----
 *	@Last modified by: Nate Corcoran <CLDMV> (Shinrai@users.noreply.github.com)
 *	@Last modified time: 2026-03-01 20:21:11 -08:00 (1772425271)
 *	-----
 *	@Copyright: Copyright (c) 2013-2026 Catalyzed Motivation Inc. All rights reserved.
 */
/**
 * @fileoverview Test module for per-request context access.
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

