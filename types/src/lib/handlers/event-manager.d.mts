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
     * @returns {{ level: "deny"|"notify"|"allow", off: Function }} The granted level and an unsubscribe
     *   function. At `deny` the listener is not registered and `off` is a no-op.
     * @throws {SlothletError} INVALID_ARGUMENT for a non-string event or non-function listener.
     * @public
     */
    public on(event: string, listener: Function, options?: {
        once?: boolean | undefined;
    }): {
        level: "deny" | "notify" | "allow";
        off: Function;
    };
    /**
     * Subscribe for a single delivery, then auto-unsubscribe. Shorthand for `on(event, listener, { once: true })`.
     * @param {string} event - Event name.
     * @param {Function} listener - Listener.
     * @param {object} [options={}] - Options (merged with `once: true`).
     * @returns {{ level: "deny"|"notify"|"allow", off: Function }} The granted level and unsubscribe.
     * @public
     */
    public once(event: string, listener: Function, options?: object): {
        level: "deny" | "notify" | "allow";
        off: Function;
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
     * @param {string} event - Event name.
     * @param {*} [payload] - Domain payload, delivered only to `allow`-level subscribers.
     * @returns {Promise<void>} Resolves once all listeners (including async) have settled.
     * @throws {SlothletError} INVALID_ARGUMENT for a non-string event.
     * @public
     */
    public emit(event: string, payload?: any): Promise<void>;
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