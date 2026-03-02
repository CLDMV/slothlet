/**
 *	@Project: @cldmv/slothlet
 *	@Filename: /api_tests/api_test/database/pool.mjs
 *	@Date: 2026-02-17T02:53:10-08:00 (1771325590)
 *	@Author: Nate Corcoran <CLDMV>
 *	@Email: <Shinrai@users.noreply.github.com>
 *	-----
 *	@Last modified by: Nate Corcoran <CLDMV> (Shinrai@users.noreply.github.com)
 *	@Last modified time: 2026-03-01 20:16:58 -08:00 (1772425018)
 *	-----
 *	@Copyright: Copyright (c) 2013-2026 Catalyzed Motivation Inc. All rights reserved.
 */

/**
 * Simulates a database connection pool for testing EventEmitter cleanup.
 * Creates REAL Node.js EventEmitters within the slothlet API context.
 * These should be tracked and cleaned up when slothlet shuts down.
 */

import { EventEmitter } from "node:events";

const emitters = [];

/**
 * Database pool API using native EventEmitter
 */
export const pool = {
	/**
	 * Create event emitters to simulate database connections
	 */
	createConnections(count = 5) {
		const newEmitters = [];

		for (let i = 0; i < count; i++) {
			const emitter = new EventEmitter();

			// Add typical database event listeners
			emitter.on("connect", () => {});
			emitter.on("query", () => {});
			emitter.on("error", () => {});
			emitter.on("disconnect", () => {});

			newEmitters.push(emitter);
			emitters.push(emitter);
		}

		return {
			count: newEmitters.length,
			totalListeners: newEmitters.reduce(
				(sum, e) =>
					sum +
					e.listenerCount("connect") +
					e.listenerCount("query") +
					e.listenerCount("error") +
					e.listenerCount("disconnect"),
				0
			)
		};
	},

	/**
	 * Get current emitter statistics
	 */
	getStats() {
		const totalListeners = emitters.reduce(
			(sum, e) =>
				sum +
				e.listenerCount("connect") +
				e.listenerCount("query") +
				e.listenerCount("error") +
				e.listenerCount("disconnect"),
			0
		);

		return {
			emitterCount: emitters.length,
			totalListeners
		};
	},

	/**
	 * Get the raw emitters for external verification
	 */
	getEmitters() {
		return emitters;
	}
};
