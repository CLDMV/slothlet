/**
 *	@Project: @cldmv/slothlet
 *	@Filename: /src/lib/handlers/lifecycle.mjs
 *	@Date: 2026-01-27 11:05:55 -08:00 (1737999955)
 *	@Author: Nate Hyson <CLDMV>
 *	@Email: <Shinrai@users.noreply.github.com>
 *	-----
 *	@Last modified by: Nate Hyson <CLDMV> (Shinrai@users.noreply.github.com)
 *	@Last modified time: 2026-02-04 00:00:00 -08:00 (1770192000)
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
	 * @param {string} event - Event name (impl:created, impl:changed, impl:removed, path:collision)
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
	 * - moduleId: Module identifier (if applicable)
	 * - filePath: File path (if applicable)
	 * - metadata: Additional metadata
	 *
	 * @example
	 * lifecycle.emit("impl:created", {
	 *   apiPath: "math.add",
	 *   impl: addFunction,
	 *   source: "initial",
	 *   moduleId: "base_abc123",
	 *   filePath: "/path/to/math.mjs"
	 * });
	 */
	emit(event, data) {
		// Log event if debugging enabled
		if (this.config?.debug?.lifecycle) {
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
				message: `Event: ${event}`,
				apiPath: data.apiPath,
				source: data.source,
				moduleId: data.moduleId
			});
		}

		// Notify all subscribers
		const handlers = this.subscribers.get(event);
		if (handlers) {
			for (const handler of handlers) {
				try {
					handler(data);
				} catch (error) {
					// Log error but don't stop other handlers
					if (!this.config?.silent) {
						console.error(`[slothlet] Lifecycle event handler error (${event}):`, error);
					}
				}
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
