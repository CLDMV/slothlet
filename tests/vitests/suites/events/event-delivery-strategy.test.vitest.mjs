/**
 *
 *	@Project: @cldmv/slothlet
 *	@Filename: /tests/vitests/suites/events/event-delivery-strategy.test.vitest.mjs
 *	@Date: 2026-09-28T21:34:06-07:00 (1790656446)
 *	@Author: Shinrai <CLDMV>
 *	@Email: <Shinrai@users.noreply.github.com>
 *	-----
 *	@Last modified by: Shinrai <CLDMV> (Shinrai@users.noreply.github.com)
 *	@Last modified time: 2026-10-03T22:15:03-07:00 (1791090903)
 *	-----
 *	@Copyright: Copyright (c) 2013-2026 Catalyzed Motivation Inc. All rights reserved.
 *
 */

/**
 * @fileoverview #497 — host-controlled event delivery: `event.strategy(fn)` and `event.deliver(envelope, listenerId)`.
 *
 * @description
 * A host that wraps work in a transaction needs events emitted inside it delivered only once the
 * transaction commits, each listener as its own retried unit of work. Exercises, across the full
 * eager/lazy × async/live matrix: unchanged behavior with no strategy; immediate delivery through
 * `defaultDeliver`; deferred delivery through per-listener `deliver`; a discarded (rolled-back)
 * envelope never delivering; a per-listener retry not re-running listeners that already succeeded;
 * rules and levels enforced at delivery time; the emit-time context used at delivery; the listener
 * identity format and its `{ key }` override; identity stability across full and scoped reload;
 * `listener-gone` after a module is removed; a throwing listener rejecting `deliver`; host-only
 * gating; and `emit`'s acceptance-vs-settle timing.
 *
 * @module tests/vitests/suites/events/event-delivery-strategy.test.vitest
 */

import { describe, it, expect, afterEach } from "vitest";
import slothlet from "@cldmv/slothlet";
import { getMatrixConfigs, TEST_DIRS } from "../../setup/vitest-helper.mjs";

const BASE = TEST_DIRS.API_TEST_EVENTS;

/**
 * A strategy that records every envelope instead of delivering it — the "transaction" a test
 * later commits (delivers) or rolls back (discards).
 * @returns {{ strategy: Function, queue: Array<{ envelope: object, listeners: string[] }> }} The strategy and its queue.
 */
function makeQueueStrategy() {
	const queue = [];
	const strategy = (envelope, listeners) => {
		queue.push({ envelope, listeners });
	};
	return { strategy, queue };
}

describe.each(getMatrixConfigs())("Events > delivery strategy (#497) > $name", ({ config }) => {
	let api;

	afterEach(async () => {
		if (api) await api.shutdown();
		api = null;
	});

	/**
	 * Compose the events api and mount it a second time at `plug` under the explicit moduleID `plug`,
	 * so module listener identities are deterministic (`plug:<event>:<n>`). Unless a permissions block
	 * is supplied, `plug.**` listeners are granted `allow` (the built-in module default is `notify`).
	 * @param {object} [permissions] - Optional permissions block.
	 * @returns {Promise<object>} The composed api.
	 */
	const compose = async (permissions) => {
		const effective = permissions ?? {
			defaultPolicy: "allow",
			events: { default: "notify", rules: [{ caller: "plug.**", event: "**", effect: "allow" }] }
		};
		const instance = await slothlet({ ...config, base: BASE, permissions: effective });
		await instance.slothlet.api.add("plug", BASE, { moduleID: "plug" });
		return instance;
	};

	// ── No strategy ─────────────────────────────────────────────────────────────
	it("without a strategy, emit delivers immediately and resolves once listeners settle", async () => {
		api = await compose();
		const order = [];
		api.slothlet.event.on("orders.created", async (payload) => {
			await new Promise((r) => setTimeout(r, 20));
			order.push(payload.id);
		});
		await api.slothlet.event.emit("orders.created", { id: 1 });
		expect(order).toEqual([1]);
	});

	// ── Listener identity ───────────────────────────────────────────────────────
	it("listener ids are <owner moduleID>:<event>:<n>, `{ key }` overrides n, and the host owner is empty", async () => {
		api = await compose();
		const first = await api.plug.listeners.listen("evt.a", "one");
		const second = await api.plug.listeners.listen("evt.a", "two");
		const other = await api.plug.listeners.listen("evt.b", "three");
		const keyed = await api.plug.listeners.listen("evt.a", "keyed", { key: "audit" });
		expect(first.id).toBe("plug:evt.a:0");
		expect(second.id).toBe("plug:evt.a:1");
		expect(other.id).toBe("plug:evt.b:0"); // n counts per event
		expect(keyed.id).toBe("plug:evt.a:audit");

		const host = api.slothlet.event.on("evt.a", () => {});
		expect(host.id).toBe(":evt.a:0");
		expect(api.slothlet.event.on("evt.a", () => {}, { key: "k" }).id).toBe(":evt.a:k");
	});

	it("registering a second listener with an id already in use throws INVALID_ARGUMENT", async () => {
		api = await compose();
		api.slothlet.event.on("evt", () => {}, { key: "same" });
		expect(() => api.slothlet.event.on("evt", () => {}, { key: "same" })).toThrow(/INVALID_ARGUMENT/);
		expect(() => api.slothlet.event.on("evt", () => {}, { key: "" })).toThrow(/INVALID_ARGUMENT/);
	});

	// ── Strategy: immediate ─────────────────────────────────────────────────────
	it("a strategy that calls defaultDeliver delivers now, and emit resolves after the listeners settle", async () => {
		api = await compose();
		const seen = [];
		let settled = false;
		const { id } = api.slothlet.event.on("orders.created", async (payload, meta) => {
			await new Promise((r) => setTimeout(r, 20));
			settled = true;
			seen.push({ payload, event: meta.event });
		});
		let captured = null;
		api.slothlet.event.strategy((envelope, listeners, defaultDeliver) => {
			captured = { envelope, listeners };
			return defaultDeliver();
		});
		await api.slothlet.event.emit("orders.created", { id: 7 });
		expect(settled).toBe(true);
		expect(seen).toEqual([{ payload: { id: 7 }, event: "orders.created" }]);
		expect(captured.listeners).toEqual([id]);
		expect(captured.envelope.event).toBe("orders.created");
		expect(captured.envelope.payload).toEqual({ id: 7 });
		expect(captured.envelope.emitter).toBe(null); // host emit
		expect(captured.envelope.levels).toEqual({ [id]: "allow" });
	});

	it("defaultDeliver called without returning its promise still makes emit wait for delivery", async () => {
		api = await compose();
		let settled = false;
		api.slothlet.event.on("evt", async () => {
			await new Promise((r) => setTimeout(r, 20));
			settled = true;
		});
		api.slothlet.event.strategy((envelope, listeners, defaultDeliver) => {
			defaultDeliver();
		});
		await api.slothlet.event.emit("evt");
		expect(settled).toBe(true);
	});

	it("the envelope names the emitting module when a module emits", async () => {
		api = await compose();
		api.slothlet.event.on("evt", () => {});
		let envelope = null;
		api.slothlet.event.strategy((env, listeners, defaultDeliver) => {
			envelope = env;
			return defaultDeliver();
		});
		await api.plug.emitter.fire("evt", { n: 1 });
		expect(envelope.emitter).toEqual({ moduleID: "plug", apiPath: "plug.emitter.fire" });
	});

	// ── Strategy: deferred ──────────────────────────────────────────────────────
	it("a deferring strategy: emit resolves on acceptance, and deliver() later delivers per listener", async () => {
		api = await compose();
		const { strategy, queue } = makeQueueStrategy();
		api.slothlet.event.strategy(strategy);
		const a = await api.plug.listeners.listen("orders.created", "a");
		const b = await api.plug.listeners.listen("orders.created", "b");

		await api.slothlet.event.emit("orders.created", { id: 42 });
		expect(await api.plug.listeners.drain()).toEqual([]); // accepted, nothing delivered yet
		expect(queue).toHaveLength(1);
		expect(queue[0].listeners).toEqual([a.id, b.id]);

		const { envelope } = queue[0];
		const r1 = await api.slothlet.event.deliver(envelope, a.id);
		expect(r1).toEqual({ delivered: true, level: "allow" });
		expect((await api.plug.listeners.drain()).map((d) => d.tag)).toEqual(["a"]);
		const r2 = await api.slothlet.event.deliver(envelope, b.id);
		expect(r2).toEqual({ delivered: true, level: "allow" });
		const got = await api.plug.listeners.drain();
		expect(got.map((d) => d.tag)).toEqual(["b"]);
		expect(got[0].payload).toEqual({ id: 42 });
	});

	it("a rolled-back envelope (never delivered) reaches no listener", async () => {
		api = await compose();
		const { strategy, queue } = makeQueueStrategy();
		api.slothlet.event.strategy(strategy);
		await api.plug.listeners.listen("orders.created", "a");
		let hostCalls = 0;
		api.slothlet.event.on("orders.created", () => hostCalls++);

		await api.slothlet.event.emit("orders.created", { id: 1 });
		queue.length = 0; // roll back: the host discards the transaction's envelopes

		await new Promise((r) => setTimeout(r, 20));
		expect(await api.plug.listeners.drain()).toEqual([]);
		expect(hostCalls).toBe(0);
	});

	it("a per-listener retry re-runs only the failed listener, never ones that already succeeded", async () => {
		api = await compose();
		const { strategy, queue } = makeQueueStrategy();
		api.slothlet.event.strategy(strategy);
		const ok = await api.plug.listeners.listen("evt", "ok");
		const flaky = await api.plug.listeners.listen("evt", "flaky");
		await api.plug.listeners.failNext("flaky", 1);

		await api.slothlet.event.emit("evt", { v: 1 });
		const { envelope, listeners } = queue[0];
		const failed = [];
		for (const id of listeners) {
			try {
				await api.slothlet.event.deliver(envelope, id);
			} catch {
				failed.push(id);
			}
		}
		expect(failed).toEqual([flaky.id]);
		expect((await api.plug.listeners.drain()).map((d) => d.tag)).toEqual(["ok"]);

		// Retry only what failed.
		for (const id of failed) {
			expect(await api.slothlet.event.deliver(envelope, id)).toEqual({ delivered: true, level: "allow" });
		}
		expect((await api.plug.listeners.drain()).map((d) => d.tag)).toEqual(["flaky"]);
		expect(ok.id).not.toBe(flaky.id);
	});

	it("a listener that throws makes deliver reject with the listener's own error", async () => {
		api = await compose();
		const { strategy, queue } = makeQueueStrategy();
		api.slothlet.event.strategy(strategy);
		const { id } = await api.plug.listeners.listen("evt", "boom");
		await api.plug.listeners.failNext("boom", 1);
		await api.slothlet.event.emit("evt");
		await expect(api.slothlet.event.deliver(queue[0].envelope, id)).rejects.toThrow("listener boom failed");

		const hostError = new RangeError("host listener failed");
		const host = api.slothlet.event.on("evt2", () => {
			throw hostError;
		});
		await api.slothlet.event.emit("evt2");
		await expect(api.slothlet.event.deliver(queue[1].envelope, host.id)).rejects.toBe(hostError);
	});

	it("a once listener is consumed by its first delivery; a second envelope then finds it gone", async () => {
		api = await compose();
		const { strategy, queue } = makeQueueStrategy();
		api.slothlet.event.strategy(strategy);
		let calls = 0;
		const { id } = api.slothlet.event.once("evt", () => calls++);
		await api.slothlet.event.emit("evt");
		await api.slothlet.event.emit("evt");
		expect(await api.slothlet.event.deliver(queue[0].envelope, id)).toEqual({ delivered: true, level: "allow" });
		expect(await api.slothlet.event.deliver(queue[1].envelope, id)).toEqual({ delivered: false, reason: "listener-gone" });
		expect(calls).toBe(1);
	});

	// ── Delivery-time enforcement ───────────────────────────────────────────────
	it("rules and levels are enforced at delivery time: a rule changed after emit applies to the delivery", async () => {
		api = await compose({
			defaultPolicy: "allow",
			events: { default: "notify", rules: [{ caller: "plug.**", event: "evt.*", effect: "allow" }] }
		});
		const { strategy, queue } = makeQueueStrategy();
		api.slothlet.event.strategy(strategy);
		const first = await api.plug.listeners.listen("evt.one", "first");
		const second = await api.plug.listeners.listen("evt.one", "second");
		expect(first.level).toBe("allow");

		await api.slothlet.event.emit("evt.one", { secret: 1 });
		const { envelope } = queue[0];
		expect(envelope.levels).toEqual({ [first.id]: "allow", [second.id]: "allow" }); // emit-time levels

		// Downgrade after the emit: the delivery is trigger-only.
		api.slothlet.event.rules.add({ caller: "plug.**", event: "evt.*", effect: "notify" });
		expect(await api.slothlet.event.deliver(envelope, first.id)).toEqual({ delivered: true, level: "notify" });
		const got = await api.plug.listeners.drain();
		expect(got).toHaveLength(1);
		expect(got[0].payload).toBeUndefined();

		// Deny after the emit: the delivery is refused.
		api.slothlet.event.rules.add({ caller: "plug.**", event: "evt.one", effect: "deny" });
		expect(await api.slothlet.event.deliver(envelope, second.id)).toEqual({ delivered: false, reason: "denied" });
		expect(await api.plug.listeners.drain()).toEqual([]);
	});

	it("delivery runs the listener and the rule condition inside the emit-time context", async () => {
		api = await compose({
			defaultPolicy: "allow",
			events: {
				default: "notify",
				rules: [{ caller: "plug.**", event: "cond.*", effect: "allow", condition: { user: "alice" } }]
			}
		});
		const { strategy, queue } = makeQueueStrategy();
		api.slothlet.event.strategy(strategy);
		const { id } = await api.plug.listeners.listen("cond.data", "c");

		await api.slothlet.context.run({ user: "alice" }, () => api.slothlet.event.emit("cond.data", { n: 1 }));
		await api.slothlet.context.run({ user: "bob" }, () => api.slothlet.event.emit("cond.data", { n: 2 }));

		// Delivered from outside any context: alice's envelope still sees alice (and passes the condition).
		expect(await api.slothlet.event.deliver(queue[0].envelope, id)).toEqual({ delivered: true, level: "allow" });
		// Delivered from inside a DIFFERENT context: bob's envelope sees bob, not the deliverer's context.
		const viaOther = await api.slothlet.context.run({ user: "alice" }, () => api.slothlet.event.deliver(queue[1].envelope, id));
		expect(viaOther).toEqual({ delivered: true, level: "notify" });

		const got = await api.plug.listeners.drain();
		expect(got.map((d) => d.user)).toEqual(["alice", "bob"]);
		expect(got[0].payload).toEqual({ n: 1 });
		expect(got[1].payload).toBeUndefined();
	});

	// ── Reload / removal ────────────────────────────────────────────────────────
	it("listener ids survive a full reload: deliver resolves them against the re-registered listeners", async () => {
		api = await compose();
		const { strategy, queue } = makeQueueStrategy();
		api.slothlet.event.strategy(strategy);
		const a = await api.plug.listeners.listen("evt", "a");
		const b = await api.plug.listeners.listen("evt", "b", { key: "bee" });
		await api.slothlet.event.emit("evt", { v: 1 });

		await api.slothlet.reload();

		// Before re-registration the listeners are gone.
		expect(await api.slothlet.event.deliver(queue[0].envelope, a.id)).toEqual({ delivered: false, reason: "listener-gone" });
		// Re-register in the same order: same ids.
		const a2 = await api.plug.listeners.listen("evt", "a2");
		const b2 = await api.plug.listeners.listen("evt", "b2", { key: "bee" });
		expect([a2.id, b2.id]).toEqual([a.id, b.id]);
		expect(await api.slothlet.event.deliver(queue[0].envelope, a.id)).toEqual({ delivered: true, level: "allow" });
		expect(await api.slothlet.event.deliver(queue[0].envelope, b.id)).toEqual({ delivered: true, level: "allow" });
		expect((await api.plug.listeners.drain()).map((d) => d.tag)).toEqual(["a2", "b2"]);

		// The strategy itself survives the reload.
		await api.slothlet.event.emit("evt", { v: 2 });
		expect(queue).toHaveLength(2);
		expect(await api.plug.listeners.drain()).toEqual([]);
	});

	it("listener ids survive a scoped reload: the module's old listeners are dropped and the re-registered ones receive", async () => {
		api = await compose();
		const { strategy, queue } = makeQueueStrategy();
		api.slothlet.event.strategy(strategy);
		const a = await api.plug.listeners.listen("evt", "a");
		await api.slothlet.event.emit("evt", { v: 1 });

		await api.slothlet.api.reload("plug");

		expect(await api.slothlet.event.deliver(queue[0].envelope, a.id)).toEqual({ delivered: false, reason: "listener-gone" });
		const a2 = await api.plug.listeners.listen("evt", "a2");
		expect(a2.id).toBe(a.id);
		expect(await api.slothlet.event.deliver(queue[0].envelope, a.id)).toEqual({ delivered: true, level: "allow" });
		const got = await api.plug.listeners.drain();
		expect(got.map((d) => d.tag)).toEqual(["a2"]);
		expect(got[0].payload).toEqual({ v: 1 });
	});

	it("deliver resolves { delivered: false, reason: 'listener-gone' } once the owning module is removed", async () => {
		api = await compose();
		const { strategy, queue } = makeQueueStrategy();
		api.slothlet.event.strategy(strategy);
		const a = await api.plug.listeners.listen("evt", "a");
		await api.slothlet.event.emit("evt", { v: 1 });

		await api.slothlet.api.remove("plug");

		expect(await api.slothlet.event.deliver(queue[0].envelope, a.id)).toEqual({ delivered: false, reason: "listener-gone" });
	});

	// ── Validation and gating ───────────────────────────────────────────────────
	it("strategy(null) clears the strategy; a non-function strategy is refused", async () => {
		api = await compose();
		const { strategy, queue } = makeQueueStrategy();
		let calls = 0;
		api.slothlet.event.on("evt", () => calls++);
		api.slothlet.event.strategy(strategy);
		await api.slothlet.event.emit("evt");
		expect(calls).toBe(0);
		api.slothlet.event.strategy(null);
		await api.slothlet.event.emit("evt");
		expect(calls).toBe(1);
		expect(queue).toHaveLength(1);
		expect(() => api.slothlet.event.strategy("nope")).toThrow(/INVALID_ARGUMENT/);
	});

	it("deliver refuses an envelope this instance did not produce, or a listener id not on the envelope", async () => {
		api = await compose();
		const { strategy, queue } = makeQueueStrategy();
		api.slothlet.event.strategy(strategy);
		const { id } = api.slothlet.event.on("evt", () => {});
		await api.slothlet.event.emit("evt");
		await expect(api.slothlet.event.deliver({ ...queue[0].envelope }, id)).rejects.toThrow(/INVALID_ARGUMENT/);
		await expect(api.slothlet.event.deliver(queue[0].envelope, ":evt:99")).rejects.toThrow(/INVALID_ARGUMENT/);
	});

	it("a strategy that throws rejects emit with its error", async () => {
		api = await compose();
		api.slothlet.event.on("evt", () => {});
		const failure = new RangeError("transaction log unavailable");
		api.slothlet.event.strategy(() => {
			throw failure;
		});
		await expect(api.slothlet.event.emit("evt")).rejects.toBe(failure);
	});

	it("emit waits for an async strategy's acceptance, but not for a deferred delivery", async () => {
		api = await compose();
		let delivered = false;
		api.slothlet.event.on("evt", () => {
			delivered = true;
		});
		let accepted = false;
		api.slothlet.event.strategy(async () => {
			await new Promise((r) => setTimeout(r, 20));
			accepted = true;
		});
		await api.slothlet.event.emit("evt");
		expect(accepted).toBe(true);
		expect(delivered).toBe(false);
	});

	it.each([["allow"], ["deny"]])(
		"strategy and deliver are host-only: a module caller is refused under defaultPolicy %s",
		async (defaultPolicy) => {
			api = await compose({ defaultPolicy });
			expect(await api.strategist.attemptStrategy()).toEqual({ ok: false, code: "PERMISSION_DENIED" });
			expect(await api.strategist.attemptDeliver()).toEqual({ ok: false, code: "PERMISSION_DENIED" });
		}
	);
});
