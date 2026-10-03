# Events

Slothlet provides an instance-wide, permission-gated event system: named publish/subscribe scoped to one composed api instance. It is the third member of the family alongside `hook` (call interception) and `lifecycle` (framework events) — where those cover _framework_ signals, `event` carries arbitrary _application / domain_ events.

Slothlet stays boundary-agnostic: it knows nothing about processes, browsers, or trust. It enforces one policy — a per-subscriber delivery level — locally within the instance, using the same identity model the rest of the framework uses.

## Table of Contents

- [Overview](#overview)
- [API](#api)
- [Delivery levels](#delivery-levels)
- [Resolving a level without subscribing](#resolving-a-level-without-subscribing)
- [The event-rule construct](#the-event-rule-construct)
- [Precedence](#precedence)
- [Declaring event rules in a manifest](#declaring-event-rules-in-a-manifest)
- [Runtime rule mutation](#runtime-rule-mutation)
- [Listener identity and error isolation](#listener-identity-and-error-isolation)
- [Listener ids](#listener-ids)
- [Host-controlled delivery: `strategy` and `deliver`](#host-controlled-delivery-strategy-and-deliver)

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

| Member         | Signature                                                         | Notes                                                                                                                                                                                |
| -------------- | ----------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `on`           | `on(event, listener, { once?, key? }) → { level, off, id }`       | Subscribe. Returns the granted level (`deny`/`notify`/`allow`), an unsubscribe, and the [listener id](#listener-ids). At `deny` the listener is not registered and `off` is a no-op. |
| `once`         | `once(event, listener, { key? }) → { level, off, id }`            | Subscribe for a single delivery, then auto-unsubscribe.                                                                                                                              |
| `off`          | `off(event, listener) → boolean`                                  | Remove a listener by reference.                                                                                                                                                      |
| `emit`         | `emit(event, payload?) → Promise<void>`                           | Publish. Ungated. Resolves once all listeners settle — or, under a deferring [strategy](#host-controlled-delivery-strategy-and-deliver), once the strategy accepts the event.        |
| `resolveLevel` | `resolveLevel(subscriberPath, event) → "deny"\|"notify"\|"allow"` | Resolve the level a **supplied** identity would be granted, without subscribing. Host-only. See [Resolving a level without subscribing](#resolving-a-level-without-subscribing).     |
| `rules.add`    | `rules.add(rule) → ruleId`                                        | Add an event rule at runtime. Host-only; gated by `api.mutations.events`. See [Runtime rule mutation](#runtime-rule-mutation).                                                       |
| `rules.remove` | `rules.remove(ruleId) → boolean`                                  | Remove a runtime event rule. Host-only; gated.                                                                                                                                       |
| `strategy`     | `strategy(fn \| null) → void`                                     | Hand every emit to a host delivery strategy; `null` restores immediate delivery. Host-only. See [Host-controlled delivery](#host-controlled-delivery-strategy-and-deliver).          |
| `deliver`      | `deliver(envelope, listenerId) → Promise<result>`                 | Deliver a strategy-held envelope to one listener. Host-only. See [Host-controlled delivery](#host-controlled-delivery-strategy-and-deliver).                                         |

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

## Resolving a level without subscribing

`resolveLevel(subscriberPath, event)` answers the delivery level a **supplied** subscriber identity would be granted for an event — `deny` / `notify` / `allow` — without registering anything. It is the inverse of `on`: `on` derives the subscriber from the live caller and never trusts a supplied identity, whereas `resolveLevel` is answered _for_ an identity the caller names. Because it lets one caller ask about another identity, it is **host-only** — reachable only from the composing host (or a `run()` / `scope()` descended from it), gated exactly like `rules.*` by the built-in `slothlet.event.**` deny. A `null` `subscriberPath` is a host subscription and always resolves `allow`.

The motivating consumer is a cross-boundary event-forwarding layer such as [`@cldmv/slothlet-vine`](https://github.com/CLDMV/slothlet-vine). Slothlet stays boundary-agnostic; a forwarding layer that carries an instance's events to a subscriber living in _another_ instance must enforce that remote subscriber's level on the **trusted (serving) side**, stripping the domain payload before it crosses to an instance that cannot be trusted to withhold it. `resolveLevel` is how the trusted side resolves that remote subscriber's level; the boundary layer then delivers a trigger-only or trigger-plus-payload frame accordingly, and never re-implements the policy itself. Its call-side twin is [`permissions.global.checkCall(caller, target, args)`](PERMISSIONS.md#checkcall-vs-checkaccess), which answers — for a supplied caller identity — whether the call gate would allow a specific call, host-only in the same way.

```javascript
// On the serving instance, a forwarding layer resolves a remote subscriber's level, then strips before crossing:
const level = api.slothlet.event.resolveLevel("renderer.dashboard", "orders.created");
// level === "allow"  → forward { event, payload, meta }
// level === "notify" → forward { event, meta } only (payload never leaves this instance)
// level === "deny"   → do not forward at all
```

The remote subscriber's identity comes from the **grow side**: the forwarding layer reads `api.slothlet.caller()` on the subscribing instance — the dotted api path of the module currently subscribing, captured the same way `on` captures a subscriber — and sends that to the trusted side to resolve. `caller()` returns `null` at the host and is ungated (a module only ever learns its own identity through it, never its caller's), so the identity `resolveLevel` is asked about is the subscriber's real one, not a value the untrusted side asserted for itself.

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
- `condition` — optional, the same condition shape permission rules accept (see [PERMISSIONS-CONDITIONS.md](PERMISSIONS-CONDITIONS.md)), evaluated against the same `ctx`: the `context.run()` context in effect where the level is resolved (the caller of `resolveLevel`, or the emitter at emit time). Function conditions receive `null` call metadata — an emit has no call arguments. A subscriber's level is re-resolved per emit when any event rule is conditional.

`default` overrides the built-in base level (`notify`) for subscribers that match no rule.

## Precedence

Event rules resolve **most-specific-wins**, exactly like call rules. When two matching rules have **equal** specificity, the higher precedence **layer** wins; within a layer, the last-registered rule wins. Layers, lowest to highest:

1. **built-in default** — the framework baseline (`notify`).
2. **manifest** — a module's own `slothlet.module.json` event rules.
3. **instance** — `permissions.events` passed at `slothlet({ … })`.
4. **runtime** — rules added via `event.rules.add` (host-only).

So the composing host has the final say, a module can override only the built-in default, and — because specificity is primary — a broad host rule does not override a module's _narrower_ rule; the host must be at least as specific to override it.

Worked example — a host locks events down and a module opens its own:

```text
built-in default:               notify
manifest (module "orders"):     orders.*  → allow     (specificity 2)
instance:                       **        → deny      (specificity 1)
```

| subscribe call                                                       | matched by                         | result                                     |
| -------------------------------------------------------------------- | ---------------------------------- | ------------------------------------------ |
| `event.on("orders.created", …)` from a subscriber the manifest names | `orders.*` (spec 2), `**` (spec 1) | **allow** — most-specific wins             |
| `event.on("audit.write", …)`                                         | `**` (spec 1) only                 | **deny** — the broad instance lock applies |

Equal specificity — the host overrides the manifest:

```text
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

## Listener ids

Every registration gets a listener id, returned as `id` from `on` / `once`:

```text
<owner moduleID>:<event>:<n>
```

- **owner moduleID** — the id of the module that registered the listener (e.g. `plug` for a module added with `{ moduleID: "plug" }`, `base_slothlet` for the base directory). A host registration has an empty owner, so its ids start with `:` — an empty string is never a real module id, so a host id cannot collide with a module's.
- **event** — the event name.
- **n** — the listener's registration ordinal among its owner's registrations for that event: `0`, `1`, `2`, … Every `on` / `once` call counts, including one that was refused at `deny`, so a rule change cannot shift the ids of a module's other listeners.

Because `n` is a registration ordinal, the same module registering its listeners in the same order gets the same ids again after a reload. A listener that is registered conditionally (so its position is not stable) passes an explicit key, which replaces `n`:

```javascript
const { id } = self.slothlet.event.on("orders.created", onCreated, { key: "audit" });
// id === "<moduleID>:orders.created:audit"
```

A key is a non-empty string or a finite number. Keys share the namespace with ordinals, so prefer non-numeric keys. Registering a listener whose id is already held by a registered listener throws `INVALID_ARGUMENT`.

## Host-controlled delivery: `strategy` and `deliver`

By default `emit` delivers to every listener immediately. A host that wraps work in a transaction can instead take over delivery for the whole instance — without touching the modules that emit — so that events emitted inside a transaction are delivered only if it commits, each listener as its own unit of work with retry, and a rolled-back transaction delivers nothing.

```javascript
const pending = []; // the current transaction's events

api.slothlet.event.strategy((envelope, listeners, defaultDeliver) => {
	if (!inTransaction()) return defaultDeliver(); // deliver now, exactly as without a strategy
	pending.push({ envelope, listeners }); // defer: emit resolves as soon as this returns
});

// On commit — each listener is its own retried unit of work:
for (const { envelope, listeners } of pending.splice(0)) {
	for (const id of listeners) {
		await retry(() => api.slothlet.event.deliver(envelope, id));
	}
}

// On rollback — discard; nothing is ever delivered:
pending.length = 0;
```

### `strategy(fn)`

`api.slothlet.event.strategy(fn)` installs `fn` for the instance; `strategy(null)` clears it. It is **host-only**, gated exactly like `rules.*` by the built-in `slothlet.event.**` deny — a module calling it is refused with `PERMISSION_DENIED`. The strategy survives `api.slothlet.reload()`.

It is called once per emit as `fn(envelope, listeners, defaultDeliver)`:

- **`envelope`** — a frozen object:
  - `event`, `payload` — what was emitted.
  - `at`, `instanceID` — the emit time and instance, as in the listener `meta`.
  - `emitter` — `{ moduleID, apiPath }` of the emitting module, or `null` when the host emitted.
  - `levels` — each recipient's listener id mapped to its level (`notify` / `allow`) **resolved at emit time**. It is informational: levels are enforced again at delivery (see below).
  - `listeners` — the recipients' listener ids.
- **`listeners`** — the listener ids that would receive the event (the same array as `envelope.listeners`). A listener the rules deny at emit time is not a recipient.
- **`defaultDeliver()`** — delivers the event now, exactly as `emit` does without a strategy, and returns a promise that settles when those listeners have. Calling it more than once delivers once.

The strategy signals what it did through `defaultDeliver` and its own return value:

| The strategy …                                               | `emit` resolves …                                                     |
| ------------------------------------------------------------ | --------------------------------------------------------------------- |
| calls `defaultDeliver()` before its return value settles     | once its return value **and** the delivery have settled — **settle**  |
| returns (or its returned promise settles) without calling it | once its return value settles — **acceptance**; the event is deferred |
| throws, or returns a promise that rejects                    | rejects with that error — the event was not accepted                  |

An `async` strategy can therefore make `emit` wait for durable acceptance (e.g. writing the envelope's metadata to a transaction log) without waiting for delivery. A `defaultDeliver` called later, after the strategy has settled, still delivers but `emit` no longer waits for it — to deliver a kept envelope later, use `deliver`.

### `deliver(envelope, listenerId)`

`api.slothlet.event.deliver(envelope, listenerId)` delivers a strategy-held envelope to **one** listener, so retrying a listener that failed never re-runs the listeners that already succeeded. It is host-only, gated like `strategy`.

- `envelope` must be an envelope this instance passed to its strategy (a copy is refused), and `listenerId` must be one of its `listeners`; otherwise it rejects with `INVALID_ARGUMENT`.
- The id is resolved against the listeners registered **now**, not at emit time.

It resolves or rejects as follows:

| Outcome                                                                                                          | Result                                                                                                    |
| ---------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------- |
| The listener ran and settled                                                                                     | resolves `{ delivered: true, level }` (`level` is the level it was delivered at: `notify` or `allow`)     |
| No listener holds that id any more — its module was removed, or a reload dropped it and it has not re-registered | resolves `{ delivered: false, reason: "listener-gone" }`                                                  |
| The current rules deny that listener the event                                                                   | resolves `{ delivered: false, reason: "denied" }` (the subscription is dropped, as on the immediate path) |
| The listener threw or rejected                                                                                   | rejects with the listener's own error                                                                     |

The listener's return value is discarded, as on the immediate path. A `once` listener is consumed by its first delivery; a later `deliver` of another envelope to it resolves `listener-gone`.

### What is enforced at delivery time

Delivery rules and levels are enforced when each listener is delivered, not when the event is queued. A rule added or removed between `emit` and `deliver` applies to the delivery: a listener downgraded to `notify` receives only the trigger `meta`, and one now denied is not called.

### Context

A deferred delivery runs exactly as the immediate delivery would have. The envelope carries — in memory — the flow captured at `emit()`: the `context.run()` / `scope()` user context, the emitter's caller identity, owner-locked context keys and host trust. `deliver` runs the listener, **and** the event-rule conditions that decide its level, inside that captured flow:

```javascript
await api.slothlet.context.run({ user: "alice" }, () => api.slothlet.event.emit("orders.created", order));

// Later, from anywhere — even inside another request's context:
await api.slothlet.context.run({ user: "bob" }, () => api.slothlet.event.deliver(envelope, id));
// The listener sees context.user === "alice", and a rule condition { user: "alice" } matches.
```

The deliverer's own context is not merged in. The listener still runs pinned to its registering module, as on the immediate path.

### Lifetime

- **Process restart** — a fresh instance; envelopes do not survive it. Slothlet does not serialize envelopes: the payload and the captured context are held by reference. Persisting what a host needs to re-emit after a crash is the host's concern.
- **`api.slothlet.reload()`** — kept envelopes stay deliverable. A full reload replaces every module, so all subscriptions are dropped; once modules register their listeners again (in the same order, or with the same keys), their ids match and `deliver` reaches the re-registered listeners. Host subscriptions are not re-registered by a reload.
- **`api.slothlet.api.reload(pathOrModuleID)`** — a scoped reload drops the reloaded module's subscriptions before rebuilding it and resets its ordinals, so the reloaded module's re-registrations get the same ids. Other modules' listeners are untouched.
- **`api.slothlet.api.remove(moduleID)`** — removing a module drops its subscriptions; `deliver` to one of its listener ids resolves `listener-gone`.
