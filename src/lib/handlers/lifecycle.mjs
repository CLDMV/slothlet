/**
 *
 *	@Project: @cldmv/slothlet
 *	@Filename: /src/lib/handlers/lifecycle.mjs
 *	@Date: 2026-01-27T11:05:55-08:00 (1769540755)
 *	@Author: Nate Corcoran <CLDMV>
 *	@Email: <Shinrai@users.noreply.github.com>
 *	-----
 *	@Last modified by: Nate Corcoran <CLDMV> (Shinrai@users.noreply.github.com)
 *	@Last modified time: 2026-10-18T02:33:52-07:00 (1792316032)
 *	-----
 *	@Copyright: Copyright (c) 2013-2026 Catalyzed Motivation Inc. All rights reserved.
 *
 */

/**
 * @fileoverview Centralized lifecycle event management for impl changes
 * @module @cldmv/slothlet/handlers/lifecycle
 * @internal
 * @description Provides event system for tracking impl creation, modification, and removal.
 *              Allows metadata, ownership, and other systems to subscribe to lifecycle events.
 */

import { ComponentBase } from "#factories/component-base";
import { getInstanceToken } from "#handlers/lifecycle-token";
import { runtime_selfModuleReader, runtime_selfView } from "#handlers/unified-wrapper";

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
		// Internal-only subscriber tier (#398). The construction/contribution stream (`impl:created` /
		// `impl:changed` emitted pre-placement, per contribution, with the raw callable available to the
		// framework's own metadata/routine/ownership systems) is delivered via emitInternal() to these
		// subscribers ONLY — it never reaches public `api.slothlet.lifecycle.on(...)` / `config.lifecycle`
		// consumers. Those see the sanitized, post-placement PUBLIC `impl:created` / `impl:changed` emitted
		// via emit(), which carries the wrapped callable + metadata, never the raw unwrapped impl.
		this.internalSubscribers = new Map();
		// The module each public subscriber was subscribed from (#625), per event: such a subscriber is handed
		// its module's view of the node an event is about, never the node or its implementation itself.
		this.subscriberReaders = new Map();
		this.eventLog = [];
		this.maxLogSize = 1000;
	}

	/**
	 * Subscribe to lifecycle event
	 * @param {string} event - Event name (impl:created, impl:changed, impl:collision, impl:removed, materialized:complete)
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
			this.subscriberReaders.set(event, new Map());
		}
		this.subscribers.get(event).add(handler);
		// Who subscribed: a module executing now (#625), or the host. The host is handed what it always was.
		const reader = runtime_selfModuleReader(this.slothlet);
		if (reader) this.subscriberReaders.get(event).set(handler, reader);
		else this.subscriberReaders.get(event).delete(handler);

		// Return unsubscribe function
		return () => this.off(event, handler);
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
	 * Subscribe to the INTERNAL lifecycle tier (#398) — the framework's own systems (metadata,
	 * routine manager, ownership) use this for the construction/contribution stream, which fires
	 * per contribution BEFORE collision resolution decides placement and carries the raw callable.
	 * Public consumers never reach this tier; they use {@link Lifecycle#subscribe} / `on`, which
	 * receives the sanitized post-placement PUBLIC events emitted via {@link Lifecycle#emit}.
	 * @param {string} event - Event name (e.g. `"impl:created"`, `"impl:changed"`).
	 * @param {Function} handler - Event handler function(eventData, token).
	 * @returns {Function} Unsubscribe function.
	 * @internal
	 */
	subscribeInternal(event, handler) {
		if (!this.internalSubscribers.has(event)) {
			this.internalSubscribers.set(event, new Set());
		}
		this.internalSubscribers.get(event).add(handler);

		// Return unsubscribe function
		return () => {
			const handlers = this.internalSubscribers.get(event);
			// The bucket is created on subscribe and never deleted (buckets persist for the instance's
			// life), so `handlers` is always present here; the guard is defensive and its else unreachable.
			/* v8 ignore else */
			if (handlers) {
				handlers.delete(handler);
			}
		};
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
			this.subscriberReaders.get(event)?.delete(handler);
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
	 * @param {{impl?: object|null}} [nodes] - The api node the event's `impl` is about, when `data.impl` is
	 *   its implementation rather than the node: a subscriber a module subscribed is handed its module's
	 *   view of that node (#625), or null when there is none.
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
	async emit(event, data, nodes) {
		this.#logEvent(event, data);
		await this.#notify(this.subscribers.get(event), event, data, this.subscriberReaders.get(event), nodes);
	}

	/**
	 * Emit an INTERNAL lifecycle event (#398) — delivered ONLY to {@link Lifecycle#subscribeInternal}
	 * subscribers (the framework's own metadata/routine/ownership systems), never to public
	 * consumers. Used for the construction/contribution stream (`impl:created` / `impl:changed`
	 * emitted per contribution, pre-placement, carrying the raw callable the internal systems need).
	 * @param {string} event - Event name.
	 * @param {object} data - Event data.
	 * @returns {Promise<void>}
	 * @internal
	 */
	async emitInternal(event, data) {
		this.#logEvent(event, data);
		await this.#notify(this.internalSubscribers.get(event), event, data);
	}

	/**
	 * Log an emitted event when lifecycle debugging is enabled (shared by emit + emitInternal).
	 * @param {string} event - Event name.
	 * @param {object} data - Event data.
	 * @returns {void}
	 * @private
	 */
	#logEvent(event, data) {
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
	}

	/**
	 * Report a handler that threw, unless the instance is silent. The warning carries the thrown
	 * value as its `cause` (#578), and names the api path and module when the event is about one
	 * (the `impl:*` events), so a failing handler can be traced to the leaf that triggered it.
	 * @param {string} event - Event name.
	 * @param {object} data - Event data.
	 * @param {*} error - What the handler threw or rejected with.
	 * @returns {void}
	 * @private
	 */
	#warnHandlerError(event, data, error) {
		if (this.____config?.silent) return;
		if (data.apiPath) {
			new this.SlothletWarning(
				"WARNING_LIFECYCLE_HANDLER_ERROR",
				{ key: "WARNING_LIFECYCLE_HANDLER_ERROR_AT_PATH", event, apiPath: data.apiPath, moduleID: data.moduleID },
				error
			);
			return;
		}
		new this.SlothletWarning("WARNING_LIFECYCLE_HANDLER_ERROR", { event }, error);
	}

	/**
	 * The event as a subscriber a module subscribed is handed it (#625): its `impl` is that module's view of
	 * the node the event is about, the one it reads through `self`, so the module cannot keep the node or
	 * its implementation and write another module's subtree through it later. Null when there is no node
	 * to view.
	 * @param {object} data - Event data.
	 * @param {object} reader - The module the subscriber was subscribed from.
	 * @param {{impl?: object|null}} [nodes] - The node the event's `impl` is about.
	 * @returns {object} The event data for the subscriber.
	 * @private
	 */
	#viewFor(data, reader, nodes) {
		if (!data || typeof data !== "object" || !("impl" in data)) return data;
		const node = nodes && "impl" in nodes ? nodes.impl : data.impl;
		if (node === null || (typeof node !== "object" && typeof node !== "function")) return { ...data, impl: node ?? null };
		const view = runtime_selfView(node, reader);
		// Something that is no api node is never handed over: it would be the implementation itself.
		return { ...data, impl: view === node ? null : view };
	}

	/**
	 * Notify a set of handlers, awaiting any async ones and isolating handler errors (shared by
	 * emit + emitInternal).
	 * @param {Set<Function>|undefined} handlers - The subscriber set for the event, if any.
	 * @param {string} event - Event name (for error context).
	 * @param {object} data - Event data.
	 * @param {Map<Function, object>} [readers] - The module each subscriber was subscribed from (public tier).
	 * @param {{impl?: object|null}} [nodes] - The node the event's `impl` is about (see {@link Lifecycle#emit}).
	 * @returns {Promise<void>}
	 * @private
	 */
	async #notify(handlers, event, data, readers, nodes) {
		if (!handlers) return;

		// Collect all handler promises (both sync and async)
		const handlerPromises = [];

		const token = getInstanceToken(this.slothlet);
		for (const handler of handlers) {
			try {
				const reader = readers?.get(handler);
				const result = handler(reader ? this.#viewFor(data, reader, nodes) : data, token);
				// If handler returns a promise, track it
				if (result && typeof result.then === "function") {
					handlerPromises.push(
						result.catch((error) => {
							// Log error but don't stop other handlers
							this.#warnHandlerError(event, data, error);
						})
					);
				}
			} catch (error) {
				// Log synchronous errors but don't stop other handlers
				this.#warnHandlerError(event, data, error);
			}
		}

		// Wait for all async handlers to complete
		if (handlerPromises.length > 0) {
			await Promise.all(handlerPromises);
		}
	}
}
