/**
 *
 *	@Project: @cldmv/slothlet
 *	@Filename: src/lib/handlers/lifecycle.mjs
 *	@Date: 2026-01-27T11:05:55-08:00 (1769540755)
 *	@Author: Nate Corcoran <CLDMV>
 *	@Email: <Shinrai@users.noreply.github.com>
 *	-----
 *	@Last modified by: Nate Corcoran <CLDMV> (Shinrai@users.noreply.github.com)
 *	@Last modified time: 2026-11-28T04:30:37-08:00 (1795869037)
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
import { segmentsOf } from "#helpers/segments";
import { getInstanceToken } from "#handlers/lifecycle-token";
import { FORK, SILENT_BUILD, writeTarget } from "#helpers/flow-stores";
import { internals as unifiedWrapperInternals } from "#handlers/unified-wrapper";
import {
	ArrayMethods,
	copyList,
	listPush,
	Map,
	mapEntries,
	mapEntriesToArray,
	mapFrom,
	MapMethods,
	Objects,
	promiseAll,
	PromiseMethods,
	Reflect,
	SafePromise,
	Set,
	setFrom,
	SetMethods,
	settledWith,
	setToArray,
	setValues
} from "#helpers/intrinsics";
const { selfModuleReader, selfView } = unifiedWrapperInternals("lib/handlers/lifecycle");

/**
 * Lifecycle event manager for impl changes
 * @extends ComponentBase
 * @public
 */

/**
 * The `source` a public event reports, by the operation slothlet ran (D-5): one word for each. The internal stream keeps
 * its own words.
 * @type {Readonly<Record<string, string>>}
 * @private
 */
const PUBLIC_SOURCE = Objects.freeze({
	__proto__: null,
	initial: "create",
	"hot-reload": "reload",
	reload: "reload",
	"lazy-materialization": "materialize",
	removal: "remove",
	buildAPI: "build",
	addApi: "add",
	"module-mount": "mount"
});

/**
 * Run a subscriber and settle what it returns while still inside its call: a `then` it carries (a getter, a thenable's
 * method, a promise's own `then`) is read and called here, so it runs as the subscriber, and no other member of it is
 * called. The promise made here settles to `undefined` whatever the result resolves to, so the emitting flow never
 * holds, and never reads, any value of the subscriber's.
 * @param {Function} handler - The subscriber.
 * @param {Array} args - Its arguments.
 * @returns {Promise<void>|undefined} A promise that settles when the subscriber's result does, or `undefined` when it
 *   returned no thenable.
 * @private
 */
function runAndSettle(handler, args) {
	const result = Reflect.apply(handler, undefined, args);
	if (result === null || (typeof result !== "object" && typeof result !== "function")) return undefined;
	const then = result.then;
	if (typeof then !== "function") return undefined;
	return new SafePromise((resolve, reject) => Reflect.apply(then, result, [() => resolve(), reject]));
}

/**
 * The handler {@link Lifecycle#[FORK]} is copying, read once by the constructor it calls; null otherwise.
 * @type {Lifecycle|null}
 * @private
 */
let forkingFrom = null;

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
		/** @type {Map<string, Set<Function>>} */
		this.subscribers = new Map();
		// Internal-only subscriber tier (#398). The construction/contribution stream (`impl:created` /
		// `impl:changed` emitted pre-placement, per contribution, with the raw callable available to the
		// framework's own metadata/routine/ownership systems) is delivered via emitInternal() to these
		// subscribers ONLY — it never reaches public `api.slothlet.lifecycle.on(...)` / `config.lifecycle`
		// consumers. Those see the sanitized, post-placement PUBLIC `impl:created` / `impl:changed` emitted
		// via emit(), which carries the wrapped callable + metadata, never the raw unwrapped impl.
		/** @type {Map<string, Set<Function>>} */
		this.internalSubscribers = new Map();
		// The module each public subscriber was subscribed from (#625), per event: such a subscriber is handed
		// its module's view of the node an event is about, never the node or its implementation itself.
		/** @type {Map<string, Map<Function, unknown>>} */
		this.subscriberReaders = new Map();
		this.eventLog = [];
		this.maxLogSize = 1000;
		const from = forkingFrom;
		if (from !== null) {
			forkingFrom = null;
			for (const ofEntry of mapEntries(from.subscribers)) MapMethods.set(this.subscribers, ofEntry[0], setFrom(setToArray(ofEntry[1])));
			for (const ofEntry of mapEntries(from.internalSubscribers))
				MapMethods.set(this.internalSubscribers, ofEntry[0], setFrom(setToArray(ofEntry[1])));
			for (const ofEntry of mapEntries(from.subscriberReaders))
				MapMethods.set(this.subscriberReaders, ofEntry[0], mapFrom(mapEntriesToArray(ofEntry[1])));
			this.eventLog = copyList(from.eventLog);
			this.maxLogSize = from.maxLogSize;
		}
	}

	/**
	 * A copy of this handler for a `run()` / `scope()` (see `FORK` in `helpers/flow-stores`): its subscribers (public
	 * and the framework's own) and the event log, which later changes to either leave the other as it is.
	 * @returns {Lifecycle} The copy.
	 * @internal
	 */
	[FORK]() {
		forkingFrom = this;
		return new Lifecycle(this.slothlet);
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
		const written = writeTarget(this);
		if (written !== this) return written.subscribe(event, handler);
		if (!MapMethods.has(this.subscribers, event)) {
			MapMethods.set(this.subscribers, event, new Set());
			MapMethods.set(this.subscriberReaders, event, new Map());
		}
		SetMethods.add(MapMethods.get(this.subscribers, event), handler);
		// Who subscribed: a module executing now (#625), or the host. The host is handed what it always was.
		const reader = selfModuleReader(this.slothlet);
		if (reader) MapMethods.set(MapMethods.get(this.subscriberReaders, event), handler, reader);
		else MapMethods.delete(MapMethods.get(this.subscriberReaders, event), handler);

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
		if (!MapMethods.has(this.internalSubscribers, event)) {
			MapMethods.set(this.internalSubscribers, event, new Set());
		}
		SetMethods.add(MapMethods.get(this.internalSubscribers, event), handler);

		// Return unsubscribe function
		return () => {
			const handlers = MapMethods.get(this.internalSubscribers, event);
			// The bucket is created on subscribe and never deleted (buckets persist for the instance's
			// life), so `handlers` is always present here; the guard is defensive and its else unreachable.
			/* v8 ignore else */
			if (handlers) {
				SetMethods.delete(handlers, handler);
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
		const written = writeTarget(this);
		if (written !== this) return written.off(event, handler);
		const handlers = MapMethods.get(this.subscribers, event);
		if (handlers) {
			SetMethods.delete(handlers, handler);
			MapMethods.get(this.subscriberReaders, event) == null
				? undefined
				: MapMethods.delete(MapMethods.get(this.subscriberReaders, event), handler);
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
	emit(event, data, nodes) {
		// Not an async function: the promise handed back is slothlet's own (helpers/intrinsics `SafePromise`), so awaiting
		// it reads nothing module code can put on `Promise.prototype`.
		try {
			// A copy of a tree built for a run loads nothing new: its subscribers hear nothing of the build.
			if (this.slothlet?.[SILENT_BUILD]?.() === true) return new SafePromise((resolve) => resolve());
			if (data && typeof data.source === "string" && PUBLIC_SOURCE[data.source] !== undefined)
				data = { ...data, source: PUBLIC_SOURCE[data.source] };
			this.#logEvent(event, data);
			return this.#notify(MapMethods.get(this.subscribers, event), event, data, MapMethods.get(this.subscriberReaders, event), nodes);
		} catch (error) {
			return new SafePromise((resolve, reject) => reject(error));
		}
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
	emitInternal(event, data) {
		try {
			this.#logEvent(event, data);
			return this.#notify(MapMethods.get(this.internalSubscribers, event), event, data);
		} catch (error) {
			return new SafePromise((resolve, reject) => reject(error));
		}
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
			listPush(this.eventLog, {
				event,
				data: { ...data },
				timestamp: this.clock.now()
			});

			// Trim log if too large
			if (this.eventLog.length > this.maxLogSize) {
				ArrayMethods.shift(this.eventLog);
			}

			this.slothlet.debug("lifecycle", {
				key: "DEBUG_MODE_LIFECYCLE_EVENT",
				event,
				apiPath: data.apiPath ?? (data.path ? ArrayMethods.join(data.path, ".") : undefined),
				source: data.source,
				moduleID: data.moduleID ?? data.module
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
		const path = data.path ?? segmentsOf(data.apiPath);
		if (path && path.length > 0) {
			new this.SlothletWarning(
				"WARNING_LIFECYCLE_HANDLER_ERROR",
				{ key: "WARNING_LIFECYCLE_HANDLER_ERROR_AT_PATH", event, path: segmentsOf(path), module: data.module ?? data.moduleID },
				{ cause: error }
			);
			return;
		}
		new this.SlothletWarning("WARNING_LIFECYCLE_HANDLER_ERROR", { event }, { cause: error });
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
		const view = selfView(node, reader);
		// Something that is no api node is never handed over: it would be the implementation itself.
		return { ...data, impl: view === node ? null : view };
	}

	/**
	 * Call a subscriber a module subscribed as that module (#625), the way the event manager calls a module's
	 * listener: whatever triggered the event — the module that owns a node writing it, another module's
	 * `api.add`, the host — the subscriber's own `self` writes are held to the module that subscribed it.
	 * @param {Function} handler - The subscriber.
	 * @param {object} reader - The module it was subscribed from.
	 * @param {Array} args - `[data]`: a module's subscriber is handed the event, never the instance token.
	 * @returns {*} What the subscriber returns.
	 * @private
	 */
	#invokeAs(handler, reader, args) {
		const contextManager = this.slothlet.contextManager;
		// Code the live runtime could not attribute is no module to run as: its subscriber is called as it was.
		if (!reader.____slothletInternal || !contextManager?.runInContext) return Reflect.apply(handler, undefined, args);
		return contextManager.runInContext(this.slothlet.instanceID, handler, undefined, args, reader, true);
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
	#notify(handlers, event, data, readers, nodes) {
		if (!handlers) return settledWith(undefined);

		// Collect all handler promises (both sync and async)
		const handlerPromises = [];

		const token = getInstanceToken(this.slothlet);
		for (const handler of setValues(handlers)) {
			try {
				const reader = readers == null ? undefined : MapMethods.get(readers, handler);
				// A removed module's subscriber hears nothing more but its own removal (#625), and a module's is handed the
				// event only: the instance's token is the framework's own.
				const apiManager = this.slothlet.handlers?.apiManager;
				// Only a public subscriber has a reader, and the public payload names the module `module`.
				if (reader && apiManager?.isRemovedCaller(reader) && !apiManager.isOwnRetired(reader, data?.module)) continue;
				// What the subscriber returns is settled inside its own call, as an event listener's is: the promise made
				// there is slothlet's, and settles to `undefined` whatever the subscriber's result resolves to.
				const settle = (...args) => runAndSettle(handler, args);
				const settled = reader ? this.#invokeAs(settle, reader, [this.#viewFor(data, reader, nodes)]) : settle(data, token);
				if (settled) {
					listPush(
						handlerPromises,
						PromiseMethods.then(settled, undefined, (error) => {
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
		if (handlerPromises.length === 0) return settledWith(undefined);
		return PromiseMethods.then(promiseAll(handlerPromises), () => undefined);
	}
}
