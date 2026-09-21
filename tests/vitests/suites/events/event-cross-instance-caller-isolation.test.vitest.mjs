/**
 *	@Project: @cldmv/slothlet
 *	@Filename: /tests/vitests/suites/events/event-cross-instance-caller-isolation.test.vitest.mjs
 *	@Author: Nate Corcoran <CLDMV>
 *	@Email: <Shinrai@users.noreply.github.com>
 *	@Copyright: Copyright (c) 2013-2026 Catalyzed Motivation Inc. All rights reserved.
 */

/**
 * @fileoverview Cross-instance caller isolation for `caller()` and event-listener pinning.
 *
 * @description
 * The async context manager is a process-level singleton, and AsyncLocalStorage propagates a store
 * across `await` / `queueMicrotask`. So when one instance's module flow is active and code touches a
 * DIFFERENT instance's api — exactly what @cldmv/slothlet-vine's serving side does when a same-process
 * (loopback) transport hands it a `sub` frame carrying the far subscriber's flow — that other instance
 * must NOT mistake the foreign module for its own caller. It has no such caller; the answer is the host.
 *
 * Two properties, both of which failed before `caller()` / `event.on` scoped their identity read to the
 * querying instance (they read the raw active store, so a foreign instance's flow leaked in):
 *
 * 1. `foreign.slothlet.caller()`, read while THIS instance's module flow is active, is `null` (host) —
 *    not this module's path.
 * 2. A listener subscribed on `foreign` while this module's flow is active is pinned to the HOST there
 *    (its `ownerWrapper` is host, not the leaked foreign module), so the host-only
 *    `foreign.slothlet.event.resolveLevel(...)` succeeds inside its delivery instead of being denied
 *    under a leaked identity — the exact failure that stopped the vine's trusted side from forwarding.
 *
 * @module tests/vitests/suites/events/event-cross-instance-caller-isolation.test.vitest
 */

import { describe, it, expect, afterEach } from "vitest";
import slothlet from "@cldmv/slothlet";
import { getMatrixConfigs, TEST_DIRS } from "../../setup/vitest-helper.mjs";

const PROBE_BASE = TEST_DIRS.API_TEST_CROSS_INSTANCE;

/** Serving-side event rules: the host is trusted; a `probe.**` subscriber is allowed on `orders.*`. */
const TRUSTED_EVENTS = { default: "notify", rules: [{ caller: "probe.**", event: "orders.*", effect: "allow" }] };

describe.each(getMatrixConfigs())("Events > cross-instance caller isolation > $name", ({ config }) => {
	/** The two instances torn down after each test. @type {object[]} */
	let instances = [];

	afterEach(async () => {
		for (const api of instances.reverse()) {
			try {
				await api.shutdown();
			} catch {
				// Teardown must not mask the assertion that already failed.
			}
		}
		instances = [];
	});

	/**
	 * Stand up two independent instances: `trusted` carries the event rules and emits; `subscriber`
	 * carries the `probe` module whose extent we run foreign-instance code from.
	 * @returns {Promise<{ trusted: object, subscriber: object }>} The wired pair.
	 */
	async function twoInstances() {
		const trusted = await slothlet({ ...config, base: PROBE_BASE, permissions: { defaultPolicy: "allow", events: TRUSTED_EVENTS } });
		const subscriber = await slothlet({ ...config, base: PROBE_BASE, permissions: { defaultPolicy: "allow" } });
		instances.push(trusted, subscriber);
		return { trusted, subscriber };
	}

	it("caller() reports the module's own path within its own instance (baseline)", async () => {
		const { subscriber } = await twoInstances();
		expect(await subscriber.probe.whoami()).toBe("probe.whoami");
	});

	it("a foreign instance's caller() is the host (null), not this module, while this module's flow is active", async () => {
		const { trusted, subscriber } = await twoInstances();
		// Run `trusted.slothlet.caller()` while `subscriber`'s probe.runHere extent is the active flow.
		const callerOnTrusted = await subscriber.probe.runHere(() => trusted.slothlet.caller());
		expect(callerOnTrusted).toBe(null); // host — probe belongs to `subscriber`, not `trusted`
	});

	it("a listener subscribed on a foreign instance is host-pinned — its delivery can drive the host-only resolveLevel", async () => {
		const { trusted, subscriber } = await twoInstances();

		let sawCaller = "unset";
		let resolveOutcome = "unset";
		// Subscribe on `trusted` while `subscriber`'s module flow is active — the vine serving-side shape.
		const { level } = await subscriber.probe.runHere(() =>
			trusted.slothlet.event.on("orders.created", () => {
				sawCaller = trusted.slothlet.caller();
				try {
					resolveOutcome = trusted.slothlet.event.resolveLevel("probe.here", "orders.created");
				} catch (error) {
					resolveOutcome = `THREW:${error.code || error.name}`;
				}
			})
		);
		// A host subscription on `trusted` (probe is foreign) is granted the full level.
		expect(level).toBe("allow");

		await trusted.slothlet.event.emit("orders.created", { id: 1 });

		// The listener ran pinned to the HOST of `trusted`, not to `subscriber`'s leaked probe identity:
		expect(sawCaller).toBe(null);
		// so the host-only resolveLevel answered instead of being denied under the leaked identity.
		expect(resolveOutcome).toBe("allow");
	});
});
