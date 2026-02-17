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
