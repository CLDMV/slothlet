/**
 * Simulates a database connection pool (like pg-pool) for testing cleanup.
 * This API file creates EventEmitters internally and should clean them up
 * when the module is unloaded or slothlet shuts down.
 */

import { EventEmitter } from "node:events";

let poolInstance = null;

/**
 * Simulate a connection pool with EventEmitters
 */
class ConnectionPool {
	constructor() {
		this.clients = [];
		this.isShutdown = false;

		// Create 5 client connections, each is an EventEmitter
		for (let i = 0; i < 5; i++) {
			const client = new EventEmitter();

			// Add typical database client listeners
			client.once("error", () => {});
			client.on("response", () => {});
			client.on("connect", () => {});
			client.on("end", () => {});

			this.clients.push(client);
		}
	}

	/**
	 * Get listener count across all clients
	 */
	getListenerCount() {
		return this.clients.reduce(
			(sum, client) =>
				sum +
				client.listenerCount("error") +
				client.listenerCount("response") +
				client.listenerCount("connect") +
				client.listenerCount("end"),
			0
		);
	}

	/**
	 * Shutdown the pool and clean up all client listeners
	 */
	shutdown() {
		if (this.isShutdown) return;

		this.clients.forEach((client) => {
			client.removeAllListeners();
		});

		this.isShutdown = true;
	}
}

/**
 * Database pool API
 */
export const pool = {
	/**
	 * Initialize the connection pool
	 */
	init() {
		if (!poolInstance) {
			poolInstance = new ConnectionPool();
		}
		return {
			clientCount: poolInstance.clients.length,
			listenerCount: poolInstance.getListenerCount()
		};
	},

	/**
	 * Get current pool statistics
	 */
	getStats() {
		if (!poolInstance) {
			return { clientCount: 0, listenerCount: 0, isShutdown: null };
		}

		return {
			clientCount: poolInstance.clients.length,
			listenerCount: poolInstance.getListenerCount(),
			isShutdown: poolInstance.isShutdown
		};
	},

	/**
	 * Shutdown the pool
	 */
	shutdown() {
		if (poolInstance) {
			poolInstance.shutdown();
			const wasShutdown = poolInstance.isShutdown;
			poolInstance = null;
			return { success: true, wasShutdown };
		}
		return { success: false, wasShutdown: null };
	}
};
