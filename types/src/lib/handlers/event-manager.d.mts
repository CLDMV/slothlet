/**
 * Machine-readable `reason` codes of an undelivered `deliver()` result (#497). Stable tokens a host
 * branches on — not display text, so not translated.
 * @type {Readonly<{ LISTENER_GONE: "listener-gone", DENIED: "denied" }>}
 * @internal
 */
export const DELIVERY_REASONS: Readonly<{
    LISTENER_GONE: "listener-gone";
    DENIED: "denied";
}>;
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
    static slothletProperty: string;
    /**
     * @param {object} slothlet - Slothlet instance.
     */
    constructor(slothlet: object);
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
    public on(event: string, listener: Function, options?: {
        once?: boolean | undefined;
        key?: string | number | undefined;
    }): {
        level: "deny" | "notify" | "allow";
        off: Function;
        id: string;
    };
    /**
     * Subscribe for a single delivery, then auto-unsubscribe. Shorthand for `on(event, listener, { once: true })`.
     * @param {string} event - Event name.
     * @param {Function} listener - Listener.
     * @param {object} [options={}] - Options (merged with `once: true`).
     * @returns {{ level: "deny"|"notify"|"allow", off: Function, id: string }} The granted level, unsubscribe, and listener id.
     * @public
     */
    public once(event: string, listener: Function, options?: object): {
        level: "deny" | "notify" | "allow";
        off: Function;
        id: string;
    };
    /**
     * Remove a specific listener from an event.
     * @param {string} event - Event name.
     * @param {Function} listener - The listener reference passed to `on`/`once`.
     * @returns {boolean} True if a matching subscription was removed.
     * @public
     */
    public off(event: string, listener: Function): boolean;
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
    public emit(event: string, payload?: any): Promise<void>;
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
    public strategy(fn: Function | null): void;
    /**
     * The installed strategy, so a full reload can carry it into the rebuilt EventManager.
     * @returns {Function|null} The strategy, or null.
     * @internal
     */
    exportStrategy(): Function | null;
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
    public deliver(envelope: object, listenerId: string): Promise<{
        delivered: true;
        level: "notify" | "allow";
    } | {
        delivered: false;
        reason: "listener-gone" | "denied";
    }>;
    /**
     * Drop every subscription a module registered and reset its listener ordinals. Called when the
     * module is removed: its listeners are closures over code that is gone.
     * @param {string} moduleID - The removed module's id.
     * @returns {void}
     * @internal
     */
    onModuleRemoved(moduleID: string): void;
    /**
     * Drop every subscription a module registered and reset its listener ordinals, BEFORE the module is
     * rebuilt by a scoped reload. The old listeners are closures over the pre-reload module; the
     * reloaded module registers its listeners again and, in the same order, gets the same ids — which
     * is what lets a strategy-held envelope reach them.
     * @param {string} moduleID - The reloaded module's id.
     * @returns {void}
     * @internal
     */
    onModuleReloaded(moduleID: string): void;
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
    public resolveLevel(subscriberPath: string | null, event: string): "deny" | "notify" | "allow";
    /**
     * Tear down all subscriptions. Called from `Slothlet.shutdown()`.
     * @returns {void}
     * @public
     */
    public shutdown(): void;
    #private;
}
import { ComponentBase } from "#factories/component-base";
//# sourceMappingURL=event-manager.d.mts.map