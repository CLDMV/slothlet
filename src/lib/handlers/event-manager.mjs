/**
 *	@Project: @cldmv/slothlet
 *	@Filename: /src/lib/handlers/event-manager.mjs
 *	@Date: 2026-09-20T15:33:32+00:00 (1789918412)
 *	@Author: Nate Corcoran <CLDMV>
 *	@Email: <Shinrai@users.noreply.github.com>
 *	-----
 *	@Last modified by: Nate Corcoran <CLDMV> (Shinrai@users.noreply.github.com)
 *	@Last modified time: 2026-09-26 22:33:00 -07:00 (1790487180)
 *	-----
 *	@Copyright: Copyright (c) 2013-2026 Catalyzed Motivation Inc. All rights reserved.
 */

/**
 * @fileoverview Instance-wide, permission-gated event system (#407)
 * @module @cldmv/slothlet/handlers/event-manager
 * @internal
 * @description
 * Named pub/sub scoped to one composed api instance — the third member of the family alongside
 * `hook` (call interception) and `lifecycle` (framework events): arbitrary app/domain events.
 * Each subscriber's DELIVERY LEVEL is resolved from the permission model's event-rule pool
 * (deny / notify / allow) against the subscriber's own identity, so a boundary-agnostic instance
 * enforces per-subscriber policy locally:
 *
 * - deny   → subscription refused; the listener is never registered and never fires.
 * - notify → subscribed, but the listener receives only a safe trigger envelope
 *            `{ event, at, instanceID }` (no domain payload). This is the default.
 * - allow  → subscribed with the full domain payload.
 *
 * Listeners are called `(payload, meta)`: at `allow`, `payload` is the emitted value; at `notify`,
 * `payload` is `undefined` and `meta` (the trigger envelope) is always present. A subscriber learns
 * its granted level from the `{ level, off }` returned by `on`/`once`, so it never silently assumes
 * `allow` and receives nothing.
 *
 * Delivery is async, fire-and-forget, with per-listener error isolation (one throwing listener never
 * breaks the others or the emitter). Each listener runs pinned to its registering module's identity
 * (captured at subscribe) so `self.*` inside a listener is attributed correctly — the same discipline
 * the hook manager uses. `emit` is NOT gated (emitting must not break); only subscription/delivery is.
 *
 * Delivery can be taken over by the host (#497): `strategy(fn)` installs a function called per emit
 * with the event's envelope, the recipients' listener ids, and a `defaultDeliver` that delivers now.
 * A strategy that does not call `defaultDeliver` defers the event; the host later delivers it one
 * listener at a time with `deliver(envelope, listenerId)`, which enforces the event rules at that
 * moment and runs inside the context captured at emit time. Listener ids —
 * `<owner moduleID>:<event>:<n or key>` — are resolved against the live registrations on every
 * `deliver`, so an envelope stays deliverable across a reload once the listener re-registers.
 */

import { ComponentBase } from "#factories/component-base";
import { MODULE_ID_SEPARATOR } from "#handlers/metadata";

/**
 * Envelope → its private delivery record `{ slothlet, meta, flow, subs }`. Module-level (not per
 * EventManager) so an envelope kept by the host stays deliverable after a full reload, which replaces
 * the instance's EventManager; the record names the owning Slothlet instance so another instance
 * refuses it. A WeakMap, so a discarded (rolled-back) envelope is collected with its record.
 * @type {WeakMap<object, object>}
 * @private
 */
const ENVELOPES = new WeakMap();

/**
 * Machine-readable `reason` codes of an undelivered `deliver()` result (#497). Stable tokens a host
 * branches on — not display text, so not translated.
 * @type {Readonly<{ LISTENER_GONE: "listener-gone", DENIED: "denied" }>}
 * @internal
 */
export const DELIVERY_REASONS = Object.freeze({ LISTENER_GONE: "listener-gone", DENIED: "denied" });

/**
 * The owner segment of a listener id: the registering module's base moduleID, or `""` for a host
 * subscription. `""` can never be a real moduleID (an empty `moduleID` option falls back to the
 * generated default), so a host id never collides with a module's.
 * @param {object|null} wrapper - The registering (or emitting) module's wrapper, or null for the host.
 * @returns {string} The owner id.
 * @private
 */
function ownerIdOf(wrapper) {
	if (!wrapper) return "";
	return String(wrapper.____slothletInternal.moduleID).split(MODULE_ID_SEPARATOR)[0];
}

/**
 * Instance-wide event manager (#407).
 * @extends ComponentBase
 * @public
 */
export class EventManager extends ComponentBase {
	/**
	 * Where this component mounts on the Slothlet instance (`slothlet.handlers.eventManager`).
	 * @type {string}
	 */
	static slothletProperty = "eventManager";

	/**
	 * Event name → Set of subscription records. Each record:
	 * `{ listener, once, subscriberPath, ownerWrapper, ownerID, id, level, levelEpoch }`.
	 * @type {Map<string, Set<object>>}
	 * @private
	 */
	#subscribers = new Map();

	/**
	 * Owner id → (event → next keyless listener ordinal). The `<n>` of a listener id is the ordinal of
	 * its registration among its owner's registrations for that event, so the same registration order
	 * reproduces the same ids after a reload. Reset for an owner whose module is reloaded or removed.
	 * @type {Map<string, Map<string, number>>}
	 * @private
	 */
	#ordinals = new Map();

	/**
	 * The host's delivery strategy (#497), or null for immediate delivery.
	 * @type {Function|null}
	 * @private
	 */
	#strategy = null;

	/**
	 * @param {object} slothlet - Slothlet instance.
	 */
	constructor(slothlet) {
		super(slothlet);
		this.#subscribers = new Map();
		this.#ordinals = new Map();
		this.#strategy = null;
	}

	/**
	 * The permission manager for this instance, or null if unavailable.
	 * @returns {object|null} PermissionManager.
	 * @private
	 */
	get #permissions() {
		return this.slothlet.handlers?.permissionManager ?? null;
	}

	/**
	 * Subscribe a listener to an event. The subscriber's granted delivery level is resolved from the
	 * event-rule pool against its own identity and returned so the caller knows whether it will
	 * receive payloads.
	 *
	 * @param {string} event - Event name to subscribe to.
	 * @param {Function} listener - Listener, called `(payload, meta)` on emit. At `notify`, `payload`
	 *   is `undefined`; `meta` is `{ event, at, instanceID }`.
	 * @param {object} [options={}] - Options.
	 * @param {boolean} [options.once=false] - Remove the subscription after its first delivery.
	 * @param {string|number} [options.key] - Replaces the ordinal `<n>` in the listener id, for a listener
	 *   that is registered conditionally (so its position among its module's listeners is not stable).
	 * @returns {{ level: "deny"|"notify"|"allow", off: Function, id: string }} The granted level, an
	 *   unsubscribe function, and the listener id (`<owner moduleID>:<event>:<n or key>`, owner `""` for
	 *   the host). At `deny` the listener is not registered and `off` is a no-op.
	 * @throws {SlothletError} INVALID_ARGUMENT for a non-string event, a non-function listener, an empty
	 *   or non-string/number `key`, or an id already held by another registered listener.
	 * @public
	 */
	on(event, listener, options = {}) {
		if (typeof event !== "string" || !event) {
			throw new this.SlothletError("INVALID_ARGUMENT", { argument: "event", expected: "a non-empty string", received: typeof event });
		}
		if (typeof listener !== "function") {
			throw new this.SlothletError("INVALID_ARGUMENT", { argument: "listener", expected: "a function", received: typeof listener });
		}
		const key = options.key;
		if (key !== undefined && !((typeof key === "string" && key !== "") || (typeof key === "number" && Number.isFinite(key)))) {
			throw new this.SlothletError("INVALID_ARGUMENT", {
				argument: "options.key",
				expected: "a non-empty string or a finite number",
				received: key === "" ? "empty string" : typeof key
			});
		}

		// Capture the SUBSCRIBER's identity at registration — the module that called on(). Null for the
		// host (no module caller). Mirrors HookManager: the caller-supplied identity is never trusted.
		// Scoped to THIS instance: AsyncLocalStorage is a shared singleton across instances and
		// propagates across `await`/`queueMicrotask`, so a subscription registered while a DIFFERENT
		// instance's flow is active (e.g. a same-process transport delivering a frame — @cldmv/slothlet-vine's
		// serving side subscribing to forward an event) would otherwise capture that foreign instance's
		// caller and pin every delivery to it, denying the host-only re-resolution at emit. Passing the
		// instance id reports no caller (host) for a foreign flow while still capturing the real module
		// for this instance's own — the same instance-scoping the read-gate (#290) already uses.
		const ownerWrapper = this.slothlet.contextManager?.getCallerIdentity?.(this.instanceID)?.currentWrapper ?? null;
		const subscriberPath = ownerWrapper?.____slothletInternal?.apiPath ?? null;
		const ownerID = ownerIdOf(ownerWrapper);
		const id = `${ownerID}:${event}:${key === undefined ? this.#nextOrdinal(ownerID, event) : String(key)}`;
		for (const existing of this.#subscribers.get(event) ?? []) {
			if (existing.id === id) {
				throw new this.SlothletError("INVALID_ARGUMENT", {
					argument: "options.key",
					expected: "a listener id not already registered for this event",
					received: id
				});
			}
		}

		const sub = {
			listener,
			once: options.once === true,
			subscriberPath,
			ownerWrapper,
			ownerID,
			id,
			level: null,
			levelEpoch: -1
		};

		const level = this.#levelFor(sub, event);
		// deny → subscription refused; do not register, hand back a no-op unsubscribe. The ordinal is
		// still consumed, so a later rule change cannot shift the ids of this module's other listeners.
		if (level === "deny") {
			return { level, off: () => {}, id };
		}

		if (!this.#subscribers.has(event)) this.#subscribers.set(event, new Set());
		this.#subscribers.get(event).add(sub);

		return { level, off: () => this.#removeSub(event, sub), id };
	}

	/**
	 * Take the next keyless-listener ordinal for an owner and event.
	 * @param {string} ownerID - Owner id (`""` for the host).
	 * @param {string} event - Event name.
	 * @returns {number} The ordinal.
	 * @private
	 */
	#nextOrdinal(ownerID, event) {
		let perEvent = this.#ordinals.get(ownerID);
		if (!perEvent) {
			perEvent = new Map();
			this.#ordinals.set(ownerID, perEvent);
		}
		const n = perEvent.get(event) ?? 0;
		perEvent.set(event, n + 1);
		return n;
	}

	/**
	 * Subscribe for a single delivery, then auto-unsubscribe. Shorthand for `on(event, listener, { once: true })`.
	 * @param {string} event - Event name.
	 * @param {Function} listener - Listener.
	 * @param {object} [options={}] - Options (merged with `once: true`).
	 * @returns {{ level: "deny"|"notify"|"allow", off: Function, id: string }} The granted level, unsubscribe, and listener id.
	 * @public
	 */
	once(event, listener, options = {}) {
		return this.on(event, listener, { ...options, once: true });
	}

	/**
	 * Remove a specific listener from an event.
	 * @param {string} event - Event name.
	 * @param {Function} listener - The listener reference passed to `on`/`once`.
	 * @returns {boolean} True if a matching subscription was removed.
	 * @public
	 */
	off(event, listener) {
		const set = this.#subscribers.get(event);
		if (!set) return false;
		for (const sub of set) {
			if (sub.listener === listener) {
				this.#removeSub(event, sub);
				return true;
			}
		}
		return false;
	}

	/**
	 * Emit an event to its subscribers. NOT gated — any caller may emit; the three-level policy is
	 * enforced per subscriber at delivery. Async, fire-and-forget, per-listener error isolation:
	 * a throwing listener surfaces a `SlothletWarning` and never affects the others or the emitter.
	 *
	 * With a host {@link strategy} installed, the event is handed to it instead of being delivered:
	 * `emit` resolves once the strategy has ACCEPTED it (its return value has settled), plus — when the
	 * strategy called `defaultDeliver` by then — once that delivery has settled too. A strategy that
	 * returns without calling `defaultDeliver` has deferred the event; a strategy that throws or rejects
	 * rejects `emit` with that error.
	 *
	 * @param {string} event - Event name.
	 * @param {*} [payload] - Domain payload, delivered only to `allow`-level subscribers.
	 * @returns {Promise<void>} Resolves once all listeners (including async) have settled, or — under a
	 *   deferring strategy — once the strategy has accepted the event.
	 * @throws {SlothletError} INVALID_ARGUMENT for a non-string event.
	 * @public
	 */
	async emit(event, payload) {
		if (typeof event !== "string" || !event) {
			throw new this.SlothletError("INVALID_ARGUMENT", { argument: "event", expected: "a non-empty string", received: typeof event });
		}
		const set = this.#subscribers.get(event);
		const strategy = this.#strategy;
		if (strategy) {
			await this.#emitThroughStrategy(strategy, event, payload, set ? [...set] : []);
			return;
		}
		if (!set || set.size === 0) return;

		const meta = { event, at: Date.now(), instanceID: this.instanceID };
		// Snapshot: allow listeners to off()/subscribe during dispatch, and support `once` removal.
		await this.#dispatch(event, payload, meta, [...set]);
	}

	/**
	 * Deliver an event to a snapshot of its subscribers now — the immediate path, shared by a plain
	 * `emit` and a strategy's `defaultDeliver`.
	 * @param {string} event - Event name.
	 * @param {*} payload - Domain payload.
	 * @param {object} meta - Trigger envelope `{ event, at, instanceID }` handed to every listener.
	 * @param {Array<object>} subs - Subscription records to deliver to.
	 * @returns {Promise<void>} Resolves once every listener has settled.
	 * @private
	 */
	async #dispatch(event, payload, meta, subs) {
		const cm = this.slothlet.contextManager;
		const promises = [];

		for (const sub of subs) {
			const level = this.#levelFor(sub, event);
			// A (gated) rule change may have downgraded this subscriber to deny → drop it.
			if (level === "deny") {
				this.#removeSub(event, sub);
				continue;
			}
			const callArgs = level === "allow" ? [payload, meta] : [undefined, meta];
			if (sub.once) this.#removeSub(event, sub);

			try {
				// Run pinned to the subscriber's identity/context so self.* resolves as that module.
				// rawErrors:true surfaces the listener's own error so we can isolate + warn on it.
				const result = this.#invoke(sub, callArgs, cm);
				if (result && typeof result.then === "function") {
					promises.push(result.catch((error) => this.#warnListener(event, error)));
				}
			} catch (error) {
				this.#warnListener(event, error);
			}
		}

		if (promises.length > 0) await Promise.all(promises);
	}

	/**
	 * Call a subscription's listener, pinned to its registering module's identity when it has one.
	 * @param {object} sub - Subscription record.
	 * @param {Array} callArgs - `[payload, meta]`.
	 * @param {object} cm - Context manager.
	 * @returns {*} The listener's return value.
	 * @private
	 */
	#invoke(sub, callArgs, cm) {
		return sub.ownerWrapper && cm?.runInContext
			? cm.runInContext(this.instanceID, sub.listener, undefined, callArgs, sub.ownerWrapper, true)
			: sub.listener(...callArgs);
	}

	/**
	 * Hand an emit to the host's strategy (#497). Builds the envelope — event, payload, emitter
	 * identity, and the emit-time level of each recipient — records its private delivery state
	 * (the captured flow, the trigger meta), and calls `strategy(envelope, listeners, defaultDeliver)`.
	 * @param {Function} strategy - The host strategy.
	 * @param {string} event - Event name.
	 * @param {*} payload - Domain payload.
	 * @param {Array<object>} subs - Snapshot of the event's subscription records.
	 * @returns {Promise<void>} Resolves on acceptance, and after any `defaultDeliver` it triggered.
	 * @private
	 */
	async #emitThroughStrategy(strategy, event, payload, subs) {
		const meta = { event, at: Date.now(), instanceID: this.instanceID };
		const cm = this.slothlet.contextManager;
		// The emitter's flow — its user context, caller identity and trust — so a deferred delivery runs
		// in it, exactly as the immediate one would have. Also the emitter identity for the envelope.
		const flow = cm?.snapshotFlow?.(this.instanceID) ?? null;
		const emitterWrapper = flow?.currentWrapper ?? null;

		const listeners = [];
		const levels = {};
		for (const sub of subs) {
			// Informational only: rules are enforced again when each listener is actually delivered.
			// A listener denied at emit time is not a recipient.
			const level = this.#levelFor(sub, event);
			if (level === "deny") continue;
			listeners.push(sub.id);
			levels[sub.id] = level;
		}
		Object.freeze(listeners);

		const envelope = Object.freeze({
			event,
			payload,
			at: meta.at,
			instanceID: this.instanceID,
			emitter: emitterWrapper
				? Object.freeze({ moduleID: ownerIdOf(emitterWrapper), apiPath: emitterWrapper.____slothletInternal.apiPath })
				: null,
			levels: Object.freeze(levels),
			listeners
		});
		ENVELOPES.set(envelope, { slothlet: this.slothlet, meta, flow });

		let delivery = null;
		const defaultDeliver = () => {
			// Idempotent: a second call returns the first delivery rather than delivering twice.
			if (!delivery) delivery = this.#dispatch(event, payload, meta, subs);
			return delivery;
		};

		await strategy(envelope, listeners, defaultDeliver);
		if (delivery) await delivery;
	}

	/**
	 * Install (or clear) the host's delivery strategy (#497). Host-only — gated like `rules.*` by the
	 * built-in `slothlet.event.**` deny. The strategy is called per emit as
	 * `strategy(envelope, listeners, defaultDeliver)`:
	 *
	 * - `envelope` — frozen `{ event, payload, at, instanceID, emitter, levels, listeners }`: `emitter` is
	 *   `{ moduleID, apiPath }` of the emitting module (null for the host); `levels` maps each recipient's
	 *   listener id to its level resolved at emit time (informational — levels are enforced at delivery).
	 * - `listeners` — the recipients' listener ids (the same array as `envelope.listeners`).
	 * - `defaultDeliver()` — delivers now, exactly as without a strategy; returns a promise that settles
	 *   when the listeners have. Idempotent.
	 *
	 * Returning without calling `defaultDeliver` defers the event: `emit` resolves once the strategy's
	 * return value settles, and the host delivers later with {@link deliver}. The strategy survives a
	 * reload.
	 *
	 * @param {Function|null} fn - The strategy, or null to restore immediate delivery.
	 * @returns {void}
	 * @throws {SlothletError} INVALID_ARGUMENT when `fn` is neither a function nor null.
	 * @public
	 */
	strategy(fn) {
		if (fn !== null && typeof fn !== "function") {
			throw new this.SlothletError("INVALID_ARGUMENT", { argument: "fn", expected: "a function or null", received: typeof fn });
		}
		this.#strategy = fn;
	}

	/**
	 * The installed strategy, so a full reload can carry it into the rebuilt EventManager.
	 * @returns {Function|null} The strategy, or null.
	 * @internal
	 */
	exportStrategy() {
		return this.#strategy;
	}

	/**
	 * Deliver a strategy-held envelope to ONE listener (#497), so a per-listener retry never re-runs
	 * listeners that already succeeded. Host-only — gated like `rules.*` by the built-in
	 * `slothlet.event.**` deny.
	 *
	 * The listener id is resolved against the CURRENT registrations, so after a full or scoped reload
	 * it reaches the re-registered listener with that id. The delivery runs inside the flow captured at
	 * `emit()` — the emitter's user context and caller identity — and the listener's level is resolved
	 * now, against the current rules, in that flow; a listener runs pinned to its module, as on the
	 * immediate path. A `once` listener is consumed by its first delivery.
	 *
	 * @param {object} envelope - An envelope this instance passed to its strategy.
	 * @param {string} listenerId - One of `envelope.listeners`.
	 * @returns {Promise<{ delivered: true, level: "notify"|"allow" }|{ delivered: false, reason: "listener-gone"|"denied" }>}
	 *   `delivered: true` with the level it was delivered at; `listener-gone` when no listener holds that
	 *   id any more (its module was removed, or a reload dropped it and it has not re-registered);
	 *   `denied` when the current rules deny that listener the event (the subscription is dropped, as on
	 *   the immediate path). The listener's return value is discarded, as on the immediate path.
	 * @throws {SlothletError} INVALID_ARGUMENT (as a rejection) for an envelope this instance did not
	 *   produce or a listener id not on it. A listener that throws or rejects rejects with its own error.
	 * @public
	 */
	async deliver(envelope, listenerId) {
		const record = envelope !== null && typeof envelope === "object" ? ENVELOPES.get(envelope) : undefined;
		if (!record || record.slothlet !== this.slothlet) {
			throw new this.SlothletError("INVALID_ARGUMENT", {
				argument: "envelope",
				expected: "an envelope this instance passed to its event strategy",
				received: envelope === null ? "null" : typeof envelope
			});
		}
		if (typeof listenerId !== "string" || !envelope.listeners.includes(listenerId)) {
			throw new this.SlothletError("INVALID_ARGUMENT", {
				argument: "listenerId",
				expected: "a listener id listed on the envelope",
				received: typeof listenerId === "string" ? listenerId : typeof listenerId
			});
		}
		const cm = this.slothlet.contextManager;
		const run = () => this.#deliverOne(envelope, record, listenerId, cm);
		return record.flow && cm?.runInSnapshotFlow ? cm.runInSnapshotFlow(this.instanceID, record.flow, run) : run();
	}

	/**
	 * Resolve one listener id against the current registrations and deliver the envelope to it.
	 * Runs inside the captured flow (see {@link deliver}).
	 * @param {object} envelope - The envelope.
	 * @param {object} record - Its private delivery record.
	 * @param {string} listenerId - Listener id.
	 * @param {object} cm - Context manager.
	 * @returns {Promise<object>} The delivery result.
	 * @private
	 */
	async #deliverOne(envelope, record, listenerId, cm) {
		const { event } = envelope;
		let sub = null;
		for (const candidate of this.#subscribers.get(event) ?? []) {
			if (candidate.id === listenerId) {
				sub = candidate;
				break;
			}
		}
		if (!sub) return { delivered: false, reason: DELIVERY_REASONS.LISTENER_GONE };

		const level = this.#levelFor(sub, event);
		if (level === "deny") {
			this.#removeSub(event, sub);
			return { delivered: false, reason: DELIVERY_REASONS.DENIED };
		}
		if (sub.once) this.#removeSub(event, sub);
		const callArgs = level === "allow" ? [envelope.payload, record.meta] : [undefined, record.meta];
		await this.#invoke(sub, callArgs, cm);
		return { delivered: true, level };
	}

	/**
	 * Drop every subscription a module registered and reset its listener ordinals. Called when the
	 * module is removed: its listeners are closures over code that is gone.
	 * @param {string} moduleID - The removed module's id.
	 * @returns {void}
	 * @internal
	 */
	onModuleRemoved(moduleID) {
		this.#dropOwner(moduleID);
	}

	/**
	 * Drop every subscription a module registered and reset its listener ordinals, BEFORE the module is
	 * rebuilt by a scoped reload. The old listeners are closures over the pre-reload module; the
	 * reloaded module registers its listeners again and, in the same order, gets the same ids — which
	 * is what lets a strategy-held envelope reach them.
	 * @param {string} moduleID - The reloaded module's id.
	 * @returns {void}
	 * @internal
	 */
	onModuleReloaded(moduleID) {
		this.#dropOwner(moduleID);
	}

	/**
	 * Remove an owner's subscriptions and ordinals.
	 * @param {string} moduleID - Module id (plain or composite).
	 * @returns {void}
	 * @private
	 */
	#dropOwner(moduleID) {
		const ownerID = String(moduleID).split(MODULE_ID_SEPARATOR)[0];
		for (const [event, set] of [...this.#subscribers]) {
			for (const sub of [...set]) {
				if (sub.ownerID === ownerID) this.#removeSub(event, sub);
			}
		}
		this.#ordinals.delete(ownerID);
	}

	/**
	 * Resolve the delivery level a given subscriber identity WOULD be granted for an event, WITHOUT
	 * subscribing. Host-only (gated like `rules.*` by the built-in `slothlet.event.**` deny), because
	 * it is answered for a caller-SUPPLIED identity — the inverse of {@link on}, which derives the
	 * subscriber from the live caller and never trusts a supplied one. Here the caller is the trusted
	 * host, resolving on behalf of someone else.
	 *
	 * The motivating consumer is a cross-boundary forwarding layer such as `@cldmv/slothlet-vine`:
	 * to carry an instance's events to a subscriber in another instance, the trusted (serving) side
	 * resolves that remote subscriber's level here and strips the payload BEFORE it crosses, so a
	 * `notify`-level far subscriber's domain payload never leaves this instance. Enforcement stays on
	 * the trusted side; the boundary layer never re-implements the policy.
	 *
	 * Pure and side-effect-free: it registers nothing and mutates no state. Conditional event rules
	 * resolve against the current runtime context, exactly as an emit-time resolution would.
	 *
	 * @param {string|null} subscriberPath - The subscriber's api path to resolve for. `null` denotes a
	 *   host subscription and always resolves `allow`.
	 * @param {string} event - Event name.
	 * @returns {"deny"|"notify"|"allow"} The level that identity would be granted for this event under
	 *   the current rule set and runtime context.
	 * @throws {SlothletError} INVALID_ARGUMENT for a non-string/empty event, or a `subscriberPath` that
	 *   is neither a string nor `null`.
	 * @public
	 */
	resolveLevel(subscriberPath, event) {
		if (typeof event !== "string" || !event) {
			throw new this.SlothletError("INVALID_ARGUMENT", { argument: "event", expected: "a non-empty string", received: typeof event });
		}
		if (subscriberPath !== null && typeof subscriberPath !== "string") {
			throw new this.SlothletError("INVALID_ARGUMENT", {
				argument: "subscriberPath",
				expected: "a string or null",
				received: typeof subscriberPath
			});
		}
		const pm = this.#permissions;
		// No permission manager → ungated (full payload), matching #levelFor and on().
		if (!pm) return "allow";
		// The USER context (`context.run()`'s), not the whole async-context store — event-rule conditions
		// see the same `ctx` as call-rule conditions (#511).
		const runtimeContext = this.slothlet.contextManager?.tryGetContext?.()?.context ?? null;
		return pm.resolveEventLevel(subscriberPath, event, runtimeContext);
	}

	/**
	 * Resolve (and cache) a subscription's delivery level. Cached against the permission manager's
	 * event-rules epoch so repeated emits do not re-run rule matching; the cache is bypassed when any
	 * event rule is conditional (the level can then vary with the per-request context).
	 *
	 * @param {object} sub - Subscription record.
	 * @param {string} event - Event name.
	 * @returns {"deny"|"notify"|"allow"} The resolved level.
	 * @private
	 */
	#levelFor(sub, event) {
		const pm = this.#permissions;
		// No permission manager → ungated (full payload).
		if (!pm) return "allow";

		const conditional = pm.hasConditionalEventRules;
		const epoch = pm.eventRulesEpoch;
		if (!conditional && sub.level != null && sub.levelEpoch === epoch) {
			return sub.level;
		}

		// The emitter's USER context, as in resolveLevel (#511).
		const runtimeContext = this.slothlet.contextManager?.tryGetContext?.()?.context ?? null;
		const level = pm.resolveEventLevel(sub.subscriberPath, event, runtimeContext);
		// Only memoize the stable (non-conditional) case; conditional levels are recomputed each emit.
		sub.level = conditional ? null : level;
		sub.levelEpoch = epoch;
		return level;
	}

	/**
	 * Remove a subscription record from an event, pruning the empty event bucket.
	 * @param {string} event - Event name.
	 * @param {object} sub - Subscription record.
	 * @returns {void}
	 * @private
	 */
	#removeSub(event, sub) {
		const set = this.#subscribers.get(event);
		if (!set) return;
		set.delete(sub);
		if (set.size === 0) this.#subscribers.delete(event);
	}

	/**
	 * Surface a listener error as a non-fatal warning (unless the instance is silent).
	 * @param {string} event - Event name.
	 * @param {Error} error - The error a listener threw or rejected with.
	 * @returns {void}
	 * @private
	 */
	#warnListener(event, error) {
		if (this.____config?.silent) return;
		new this.SlothletWarning("WARNING_EVENT_HANDLER_ERROR", { event }, error);
	}

	/**
	 * Tear down all subscriptions. Called from `Slothlet.shutdown()`.
	 * @returns {void}
	 * @public
	 */
	shutdown() {
		this.#subscribers.clear();
		this.#ordinals.clear();
		this.#strategy = null;
	}
}
