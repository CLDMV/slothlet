/**
 *	@Project: @cldmv/slothlet
 *	@Filename: /src/lib/handlers/event-manager.mjs
 *	@Date: 2026-09-17 00:00:00 -07:00
 *	@Author: Nate Corcoran <CLDMV>
 *	@Email: <Shinrai@users.noreply.github.com>
 *	-----
 *	@Last modified by: Nate Corcoran <CLDMV> (Shinrai@users.noreply.github.com)
 *	@Last modified time: 2026-09-17 00:00:00 -07:00
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
 */

import { ComponentBase } from "#factories/component-base";

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
	 * `{ listener, once, subscriberPath, ownerWrapper, level, levelEpoch }`.
	 * @type {Map<string, Set<object>>}
	 * @private
	 */
	#subscribers = new Map();

	/**
	 * @param {object} slothlet - Slothlet instance.
	 */
	constructor(slothlet) {
		super(slothlet);
		this.#subscribers = new Map();
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
	 * @returns {{ level: "deny"|"notify"|"allow", off: Function }} The granted level and an unsubscribe
	 *   function. At `deny` the listener is not registered and `off` is a no-op.
	 * @throws {SlothletError} INVALID_ARGUMENT for a non-string event or non-function listener.
	 * @public
	 */
	on(event, listener, options = {}) {
		if (typeof event !== "string" || !event) {
			throw new this.SlothletError("INVALID_ARGUMENT", { argument: "event", expected: "a non-empty string", received: typeof event });
		}
		if (typeof listener !== "function") {
			throw new this.SlothletError("INVALID_ARGUMENT", { argument: "listener", expected: "a function", received: typeof listener });
		}

		// Capture the SUBSCRIBER's identity at registration — the module that called on(). Null for the
		// host (no module caller). Mirrors HookManager: the caller-supplied identity is never trusted.
		const ownerWrapper = this.slothlet.contextManager?.getCallerIdentity?.()?.currentWrapper ?? null;
		const subscriberPath = ownerWrapper?.____slothletInternal?.apiPath ?? null;

		const sub = {
			listener,
			once: options.once === true,
			subscriberPath,
			ownerWrapper,
			level: null,
			levelEpoch: -1
		};

		const level = this.#levelFor(sub, event);
		// deny → subscription refused; do not register, hand back a no-op unsubscribe.
		if (level === "deny") {
			return { level, off: () => {} };
		}

		if (!this.#subscribers.has(event)) this.#subscribers.set(event, new Set());
		this.#subscribers.get(event).add(sub);

		return { level, off: () => this.#removeSub(event, sub) };
	}

	/**
	 * Subscribe for a single delivery, then auto-unsubscribe. Shorthand for `on(event, listener, { once: true })`.
	 * @param {string} event - Event name.
	 * @param {Function} listener - Listener.
	 * @param {object} [options={}] - Options (merged with `once: true`).
	 * @returns {{ level: "deny"|"notify"|"allow", off: Function }} The granted level and unsubscribe.
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
	 * @param {string} event - Event name.
	 * @param {*} [payload] - Domain payload, delivered only to `allow`-level subscribers.
	 * @returns {Promise<void>} Resolves once all listeners (including async) have settled.
	 * @throws {SlothletError} INVALID_ARGUMENT for a non-string event.
	 * @public
	 */
	async emit(event, payload) {
		if (typeof event !== "string" || !event) {
			throw new this.SlothletError("INVALID_ARGUMENT", { argument: "event", expected: "a non-empty string", received: typeof event });
		}
		const set = this.#subscribers.get(event);
		if (!set || set.size === 0) return;

		const meta = { event, at: Date.now(), instanceID: this.instanceID };
		const cm = this.slothlet.contextManager;
		const promises = [];

		// Snapshot: allow listeners to off()/subscribe during dispatch, and support `once` removal.
		for (const sub of [...set]) {
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
				const result =
					sub.ownerWrapper && cm?.runInContext
						? cm.runInContext(this.instanceID, sub.listener, undefined, callArgs, sub.ownerWrapper, true)
						: sub.listener(...callArgs);
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

		const runtimeContext = this.slothlet.contextManager?.tryGetContext?.() ?? null;
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
	}
}
