# Events

Slothlet provides an instance-wide, permission-gated event system: named publish/subscribe scoped to one composed api instance. It is the third member of the family alongside `hook` (call interception) and `lifecycle` (framework events) — where those cover _framework_ signals, `event` carries arbitrary _application / domain_ events.

Slothlet stays boundary-agnostic: it knows nothing about processes, browsers, or trust. It enforces one policy — a per-subscriber delivery level — locally within the instance, using the same identity model the rest of the framework uses.

## Table of Contents

- [Overview](#overview)
- [API](#api)
- [Delivery levels](#delivery-levels)
- [The event-rule construct](#the-event-rule-construct)
- [Precedence](#precedence)
- [Declaring event rules in a manifest](#declaring-event-rules-in-a-manifest)
- [Runtime rule mutation](#runtime-rule-mutation)
- [Listener identity and error isolation](#listener-identity-and-error-isolation)

## Overview

```javascript
import { self } from "@cldmv/slothlet/runtime";

// Subscribe. `on` returns the granted delivery level and an unsubscribe function.
const { level, off } = self.slothlet.event.on("orders.created", (payload, meta) => {
	// At `allow`: payload is the emitted value. At `notify`: payload is undefined.
	// meta is always { event, at, instanceID }.
});

// Emit. Emitting is never gated — the policy is enforced per subscriber, not on the emit side.
await self.slothlet.event.emit("orders.created", { id: 42 });

off(); // stop receiving
```

`emit` is fire-and-forget with per-listener error isolation: one throwing listener never stops the others or the emitter. It returns a promise that resolves once every listener (including async ones) has settled, so a caller may `await` it when ordering matters.

## API

All verbs live under `api.slothlet.event` (and `self.slothlet.event` inside modules).

| Member         | Signature                                         | Notes                                                                                                                                             |
| -------------- | ------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------- |
| `on`           | `on(event, listener, { once? }) → { level, off }` | Subscribe. Returns the granted level (`deny`/`notify`/`allow`) and an unsubscribe. At `deny` the listener is not registered and `off` is a no-op. |
| `once`         | `once(event, listener) → { level, off }`          | Subscribe for a single delivery, then auto-unsubscribe.                                                                                           |
| `off`          | `off(event, listener) → boolean`                  | Remove a listener by reference.                                                                                                                   |
| `emit`         | `emit(event, payload?) → Promise<void>`           | Publish. Ungated. Resolves once all listeners settle.                                                                                             |
| `rules.add`    | `rules.add(rule) → ruleId`                        | Add an event rule at runtime. Host-only; gated by `api.mutations.events`. See [Runtime rule mutation](#runtime-rule-mutation).                    |
| `rules.remove` | `rules.remove(ruleId) → boolean`                  | Remove a runtime event rule. Host-only; gated.                                                                                                    |

A listener is always called `(payload, meta)`:

- `payload` — the emitted value at `allow`; `undefined` at `notify`.
- `meta` — the trigger envelope, always present: `{ event, at, instanceID }` (`at` is `Date.now()` at emit).

Because `on`/`once` report the granted level, a subscriber never has to assume it will receive payloads and then silently get nothing — it knows whether it was granted `allow` up front.

## Delivery levels

Each subscriber's delivery is governed by a three-level effect, resolved from the subscriber's own identity:

- **`deny`** — subscription is refused. The listener is never registered and never fires.
- **`notify`** — subscribed, but delivered only the trigger envelope `{ event, at, instanceID }` — no domain payload. This is the default: subscription is open, payload is opt-_in_.
- **`allow`** — subscribed with the full domain payload.

A **host** subscription — one made with no module caller in context (the composing host, or any `run()` / `scope()` descended from the host root) — is trusted like a host-initiated call and always resolves `allow`.

## The event-rule construct

Event rules are a construct distinct from the binary `allow`/`deny` call rules. They are declared under `permissions.events`:

```javascript
const api = await slothlet({
	base: "./api",
	permissions: {
		events: {
			default: "notify", // base level when no rule matches (built-in default)
			rules: [
				{ caller: "reporting.**", event: "orders.*", effect: "allow" },
				{ caller: "**", event: "billing.*", effect: "deny" }
			]
		}
	}
});
```

- `caller` — a glob matched against the **subscriber's** api path.
- `event` — a glob matched against the **event name**.
- `effect` — `deny` | `notify` | `allow`.
- `condition` — optional, the same condition shape permission rules accept (see [PERMISSIONS-CONDITIONS.md](PERMISSIONS-CONDITIONS.md)); a subscriber's level is re-resolved per emit when any event rule is conditional.

`default` overrides the built-in base level (`notify`) for subscribers that match no rule.

## Precedence

Event rules resolve **most-specific-wins**, exactly like call rules. When two matching rules have **equal** specificity, the higher precedence **layer** wins; within a layer, the last-registered rule wins. Layers, lowest to highest:

1. **built-in default** — the framework baseline (`notify`).
2. **manifest** — a module's own `slothlet.module.json` event rules.
3. **instance** — `permissions.events` passed at `slothlet({ … })`.
4. **runtime** — rules added via `event.rules.add` (host-only).

So the composing host has the final say, a module can override only the built-in default, and — because specificity is primary — a broad host rule does not override a module's _narrower_ rule; the host must be at least as specific to override it.

Worked example — a host locks events down and a module opens its own:

```
built-in default:               notify
manifest (module "orders"):     orders.*  → allow     (specificity 2)
instance:                       **        → deny      (specificity 1)
```

| subscribe call                                                       | matched by                         | result                                     |
| -------------------------------------------------------------------- | ---------------------------------- | ------------------------------------------ |
| `event.on("orders.created", …)` from a subscriber the manifest names | `orders.*` (spec 2), `**` (spec 1) | **allow** — most-specific wins             |
| `event.on("audit.write", …)`                                         | `**` (spec 1) only                 | **deny** — the broad instance lock applies |

Equal specificity — the host overrides the manifest:

```
manifest (module "orders"):     orders.*  → allow
instance:                       orders.*  → notify
```

`event.on("orders.created", …)` → **notify**: both rules are `orders.*` (equal specificity), so the higher layer (instance) wins.

## Declaring event rules in a manifest

A module ships its own event rules in `slothlet.module.json`, registered at the **manifest** layer (scoped to that module) when it mounts:

```jsonc
{
	"schemaVersion": 1,
	"mountPath": ["orders"],
	"apiDir": "./api",
	"events": [{ "caller": "reporting.**", "event": "orders.*", "effect": "allow" }]
}
```

A manifest rule overrides the built-in default; the composing host's instance and runtime rules override it in turn (see [Precedence](#precedence)).

## Runtime rule mutation

Event rules are mutable at runtime through a gated, host-only surface — mirroring `permissions.addRule` for call rules:

```javascript
const id = api.slothlet.event.rules.add({ caller: "reporting.**", event: "orders.*", effect: "allow" });
api.slothlet.event.rules.remove(id);
```

- Runtime rules enter the highest (**runtime**) layer.
- The surface is gated by `api.mutations.events` (defaults to `true`); set it `false` to freeze the event-rule set, and `rules.add` / `rules.remove` throw.
- It is **host-only**: the built-in rules keep `event.rules.*` reachable only from the host, so a module cannot rewrite event policy at runtime.
- Runtime mutations are recorded and **replayed on `reload()`**, like permission-rule mutations.

Changing the rule set re-resolves the delivery level of existing subscribers on the next emit — a subscriber granted `allow` is downgraded (or upgraded) as soon as a matching rule changes.

## Listener identity and error isolation

A listener is captured with the identity of the module that registered it, and runs pinned to that identity, so `self.*` inside a listener resolves as that module — the same discipline hooks use. A listener error (thrown or rejected) is isolated: it surfaces as a non-fatal `SlothletWarning` and never affects the other listeners or the emitter.

Delivery is asynchronous and fire-and-forget; `emit` awaits all listeners so a caller can sequence work after them when needed.
