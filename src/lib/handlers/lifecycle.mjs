/**
 *	@Project: @cldmv/slothlet
 *	@Filename: /src/lib/handlers/lifecycle.mjs
 *	@Date: 2026-01-27 11:05:55 -08:00 (1737999955)
 *	@Author: Nate Hyson <CLDMV>
 *	@Email: <Shinrai@users.noreply.github.com>
 *	-----
 *	@Last modified by: Nate Hyson <CLDMV> (Shinrai@users.noreply.github.com)
 *	@Last modified time: 2026-02-05 15:54:19 -08:00 (1770335659)
 *	-----
 *	@Copyright: Copyright (c) 2013-2026 Catalyzed Motivation Inc. All rights reserved.
 */

/**
 * @fileoverview Centralized lifecycle event management for impl changes
 * @description Provides event system for tracking impl creation, modification, and removal.
 *              Allows metadata, ownership, and other systems to subscribe to lifecycle events.
 */

import { ComponentBase } from "@cldmv/slothlet/factories/component-base";

/**
 * Lifecycle event manager for impl changes
 * @extends ComponentBase
 * @public
 */
export class Lifecycle extends ComponentBase {
	/**
	 * Where this component should be mounted on the Slothlet instance
	 * @type {string}
	 */
	static slothletProperty = "lifecycle";

	/**
	 * @param {object} slothlet - Slothlet instance
	 */
	constructor(slothlet) {
		super(slothlet);
		this.subscribers = new Map();
		this.eventLog = [];
		this.maxLogSize = 1000;
	}

	/**
	 * Subscribe to lifecycle event
	 * @param {string} event - Event name (impl:created, impl:changed, impl:removed, materialized:complete, path:collision)
	 * @param {Function} handler - Event handler function(eventData)
	 * @returns {Function} Unsubscribe function
	 * @public
	 *
	 * @description
	 * Subscribe to lifecycle events to react to impl changes.
	 *
	 * @example
	 * const unsubscribe = lifecycle.subscribe("impl:changed", (data) => {
	 *   console.log("Impl changed:", data.apiPath, data.source);
	 * });
	 */
	subscribe(event, handler) {
		if (!this.subscribers.has(event)) {
			this.subscribers.set(event, new Set());
		}
		this.subscribers.get(event).add(handler);

		// Return unsubscribe function
		return () => {
			const handlers = this.subscribers.get(event);
			if (handlers) {
				handlers.delete(handler);
			}
		};
	}

	/**
	 * Alias for subscribe() - standard EventEmitter pattern
	 * @param {string} event - Event name
	 * @param {Function} handler - Event handler function
	 * @returns {Function} Unsubscribe function
	 * @public
	 *
	 * @example
	 * lifecycle.on('materialized:complete', (data) => {
	 *   console.log(`${data.total} modules materialized`);
	 * });
	 */
	on(event, handler) {
		return this.subscribe(event, handler);
	}

	/**
	 * Unsubscribe from lifecycle event - standard EventEmitter pattern
	 * @param {string} event - Event name
	 * @param {Function} handler - Event handler function to remove
	 * @public
	 *
	 * @example
	 * const handler = (data) => console.log(data);
	 * lifecycle.on('impl:changed', handler);
	 * lifecycle.off('impl:changed', handler);
	 */
	off(event, handler) {
		const handlers = this.subscribers.get(event);
		if (handlers) {
			handlers.delete(handler);
		}
	}

	/**
	 * Alias for off() - standard EventEmitter pattern
	 * @param {string} event - Event name
	 * @param {Function} handler - Event handler function to remove
	 * @public
	 */
	unsubscribe(event, handler) {
		this.off(event, handler);
	}

	/**
	 * Emit lifecycle event
	 * @param {string} event - Event name
	 * @param {object} data - Event data
	 * @private
	 *
	 * @description
	 * Emit event to all subscribers. Event data should include:
	 * - apiPath: API path where impl exists
	 * - impl: The implementation object
	 * - source: Source of event (initial, hot-reload, materialization, etc)
	 * - moduleID: Module identifier (if applicable)
	 * - filePath: File path (if applicable)
	 * - metadata: Additional metadata
	 *
	 * @example
	 * lifecycle.emit("impl:created", {
	 *   apiPath: "math.add",
	 *   impl: addFunction,
	 *   source: "initial",
	 *   moduleID: "base_abc123",
	 *   filePath: "/path/to/math.mjs"
	 * });
	 */
	async emit(event, data) {
		// Log event if debugging enabled
		if (this.____config?.debug?.lifecycle) {
			this.eventLog.push({
				event,
				data: { ...data },
				timestamp: Date.now()
			});

			// Trim log if too large
			if (this.eventLog.length > this.maxLogSize) {
				this.eventLog.shift();
			}

			this.slothlet.debug("lifecycle", {
				key: "DEBUG_MODE_LIFECYCLE_EVENT",
				event,
				apiPath: data.apiPath,
				source: data.source,
				moduleID: data.moduleID
			});
		}

		// Notify all subscribers and await async handlers
		const handlers = this.subscribers.get(event);
		if (handlers) {
			// Collect all handler promises (both sync and async)
			const handlerPromises = [];

			for (const handler of handlers) {
				try {
					const result = handler(data);
					// If handler returns a promise, track it
					if (result && typeof result.then === "function") {
						handlerPromises.push(
							result.catch((error) => {
								// Log error but don't stop other handlers
								if (!this.____config?.silent) {
									console.error(`[slothlet] Lifecycle event handler error (${event}):`, error);
								}
							})
						);
					}
				} catch (error) {
					// Log synchronous errors but don't stop other handlers
					if (!this.____config?.silent) {
						console.error(`[slothlet] Lifecycle event handler error (${event}):`, error);
					}
				}
			}

			// Wait for all async handlers to complete
			if (handlerPromises.length > 0) {
				await Promise.all(handlerPromises);
			}
		}
	}

	/**
	 * Get event log (for debugging)
	 * @returns {Array} Event log entries
	 * @public
	 */
	getEventLog() {
		return [...this.eventLog];
	}

	/**
	 * Clear event log
	 * @public
	 */
	clearEventLog() {
		this.eventLog = [];
	}

	/**
	 * Get subscriber count for event
	 * @param {string} event - Event name
	 * @returns {number} Number of subscribers
	 * @public
	 */
	getSubscriberCount(event) {
		return this.subscribers.get(event)?.size || 0;
	}
}
