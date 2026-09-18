/**
 *	@Project: @cldmv/slothlet
 *	@Filename: /tests/vitests/suites/events/event-system.test.vitest.mjs
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
 * @fileoverview #407 — instance-wide, permission-gated event system.
 *
 * Exercises the three-level per-subscriber delivery (deny/notify/allow), the layered precedence
 * (built-in default < instance config < runtime), most-specific-wins, the ungated emit, the
 * subscribe/once/off mechanics, per-listener error isolation, gated runtime rule mutation, and
 * reload replay — across the full eager/lazy × async/live matrix.
 */

import { describe, it, expect, afterEach } from "vitest";
import slothlet from "@cldmv/slothlet";
import { getMatrixConfigs, TEST_DIRS } from "../../setup/vitest-helper.mjs";

const BASE = TEST_DIRS.API_TEST_EVENTS;

describe.each(getMatrixConfigs())("Events > event system (#407) > $name", ({ config }) => {
	let api;

	afterEach(async () => {
		if (api) await api.shutdown();
		api = null;
	});

	// ── Host path (trusted root) ────────────────────────────────────────────────
	it("host subscription is granted allow and receives the full payload + meta", async () => {
		api = await slothlet({ ...config, base: BASE });
		let got = null;
		const { level, off } = api.slothlet.event.on("orders.created", (payload, meta) => {
			got = { payload, meta };
		});
		expect(level).toBe("allow");
		await api.slothlet.event.emit("orders.created", { id: 42 });
		expect(got.payload).toEqual({ id: 42 });
		expect(got.meta.event).toBe("orders.created");
		expect(typeof got.meta.at).toBe("number");
		expect(got.meta.instanceID).toBeTruthy();
		off();
		got = null;
		await api.slothlet.event.emit("orders.created", { id: 99 });
		expect(got).toBe(null);
	});

	it("once delivers exactly once; error in one listener does not stop the others", async () => {
		api = await slothlet({ ...config, base: BASE });
		let count = 0;
		api.slothlet.event.once("ping", () => count++);
		await api.slothlet.event.emit("ping");
		await api.slothlet.event.emit("ping");
		expect(count).toBe(1);

		let sibling = false;
		api.slothlet.event.on("boom", () => {
			throw new Error("listener failure");
		});
		api.slothlet.event.on("boom", () => {
			sibling = true;
		});
		await api.slothlet.event.emit("boom", {});
		expect(sibling).toBe(true);
	});

	// ── Module path: three levels ────────────────────────────────────────────────
	it("a module with no matching rule gets the notify default: trigger only, no payload", async () => {
		api = await slothlet({ ...config, base: BASE, permissions: { defaultPolicy: "allow", events: { default: "notify" } } });
		const level = await api.subscriber.subscribe("news.item");
		expect(level).toBe("notify");
		await api.emitter.fire("news.item", { secret: "top" });
		const got = await api.subscriber.drain();
		expect(got).toHaveLength(1);
		expect(got[0].payload).toBeUndefined(); // notify → no domain payload
		expect(got[0].meta.event).toBe("news.item");
	});

	it("a module granted allow receives the full payload", async () => {
		api = await slothlet({
			...config,
			base: BASE,
			permissions: {
				defaultPolicy: "allow",
				events: { default: "notify", rules: [{ caller: "subscriber.**", event: "secret.*", effect: "allow" }] }
			}
		});
		const level = await api.subscriber.subscribe("secret.data");
		expect(level).toBe("allow");
		await api.emitter.fire("secret.data", { value: 7 });
		const got = await api.subscriber.drain();
		expect(got).toHaveLength(1);
		expect(got[0].payload).toEqual({ value: 7 });
	});

	it("a module denied never subscribes and never fires", async () => {
		api = await slothlet({
			...config,
			base: BASE,
			permissions: {
				defaultPolicy: "allow",
				events: { default: "notify", rules: [{ caller: "subscriber.**", event: "blocked.*", effect: "deny" }] }
			}
		});
		const level = await api.subscriber.subscribe("blocked.thing");
		expect(level).toBe("deny");
		await api.emitter.fire("blocked.thing", { x: 1 });
		const got = await api.subscriber.drain();
		expect(got).toHaveLength(0);
	});

	// ── Resolution semantics ─────────────────────────────────────────────────────
	it("most-specific-wins: a specific allow overrides a broad deny for its scope", async () => {
		api = await slothlet({
			...config,
			base: BASE,
			permissions: {
				defaultPolicy: "allow",
				events: {
					default: "notify",
					rules: [
						{ caller: "**", event: "**", effect: "deny" },
						{ caller: "subscriber.**", event: "open.*", effect: "allow" }
					]
				}
			}
		});
		expect(await api.subscriber.subscribe("open.door")).toBe("allow"); // specific allow wins
		expect(await api.subscriber.subscribe("other.thing")).toBe("deny"); // only the broad deny matches
	});

	it("runtime layer overrides instance config at equal specificity, and re-resolves existing subscribers (epoch)", async () => {
		api = await slothlet({
			...config,
			base: BASE,
			permissions: {
				defaultPolicy: "allow",
				events: { default: "notify", rules: [{ caller: "subscriber.**", event: "evt.*", effect: "allow" }] }
			}
		});
		// Instance rule grants allow.
		expect(await api.subscriber.subscribe("evt.one")).toBe("allow");
		await api.emitter.fire("evt.one", { n: 1 });
		expect((await api.subscriber.drain())[0].payload).toEqual({ n: 1 });

		// A runtime rule of equal specificity flips it to notify — runtime layer wins.
		api.slothlet.event.rules.add({ caller: "subscriber.**", event: "evt.*", effect: "notify" });
		await api.emitter.fire("evt.one", { n: 2 });
		const got = await api.subscriber.drain();
		expect(got).toHaveLength(1);
		expect(got[0].payload).toBeUndefined(); // existing subscriber re-resolved to notify after the rule change
	});

	// ── Runtime mutation gating ──────────────────────────────────────────────────
	it("runtime rule mutation is refused when config.api.mutations.events is false", async () => {
		api = await slothlet({ ...config, base: BASE, api: { mutations: { events: false } } });
		expect(() => api.slothlet.event.rules.add({ caller: "**", event: "x", effect: "allow" })).toThrow(/MUTATIONS_DISABLED/);
	});

	// ── Reload replay ────────────────────────────────────────────────────────────
	it("a runtime-added event rule replays across reload", async () => {
		api = await slothlet({ ...config, base: BASE, permissions: { defaultPolicy: "allow", events: { default: "notify" } } });
		const id = api.slothlet.event.rules.add({ caller: "subscriber.**", event: "kept.*", effect: "allow" });
		expect(typeof id).toBe("string");
		// Before reload: allow.
		expect(await api.subscriber.subscribe("kept.data")).toBe("allow");

		await api.slothlet.reload();

		// After reload: the runtime rule is replayed, so a fresh subscription is still allow.
		expect(await api.subscriber.subscribe("kept.data")).toBe("allow");
	});
});
