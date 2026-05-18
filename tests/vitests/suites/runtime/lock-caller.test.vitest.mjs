/**
 *	@Project: @cldmv/slothlet
 *	@Filename: /tests/vitests/suites/runtime/lock-caller.test.vitest.mjs
 *	@Date: 2026-05-18T09:38:51-07:00 (1779122331)
 *	@Author: Nate Corcoran <CLDMV>
 *	@Email: <Shinrai@users.noreply.github.com>
 *	-----
 *	@Last modified by: Nate Corcoran <CLDMV> (Shinrai@users.noreply.github.com)
 *	@Last modified time: 2026-05-18 09:38:51 -07:00 (1779122331)
 *	-----
 *	@Copyright: Copyright (c) 2013-2026 Catalyzed Motivation Inc. All rights reserved.
 */

/**
 * @fileoverview Tests for `self.slothlet.lockCaller()` and `self.slothlet.bind()`.
 *
 * @description
 * Callbacks stored in plain arrays — Fastify `addHook` handlers, third-party event
 * registries — never pass through slothlet's `EventEmitter` patch, so they run with
 * whatever async context is ambient at invocation time. `lockCaller` pins the
 * registering module's caller identity onto such a callback; `bind` freezes the
 * whole async context. These tests exercise the repro and both utilities across the
 * eager/lazy × async/live matrix.
 *
 * @module tests/vitests/suites/runtime/lock-caller
 */

import { AsyncLocalStorage } from "node:async_hooks";
import { describe, it, expect, afterEach } from "vitest";
import slothlet from "@cldmv/slothlet";
import { getMatrixConfigs, TEST_DIRS, withSuppressedSlothletErrorOutput } from "../../setup/vitest-helper.mjs";

const BASE = TEST_DIRS.API_TEST_LOCK_CALLER;

/**
 * Permission rules used by the fixture probes:
 *  - `id.*` markers — denied per module so a probe can reflect its own caller identity.
 *  - `consumer.probe.guarded` — denied to the producer so the permission repro can fire.
 * @type {Array<object>}
 */
const PERMISSION_RULES = [
	{ caller: "consumer.**", target: "id.consumer", effect: "deny" },
	{ caller: "producer.**", target: "id.producer", effect: "deny" },
	{ caller: "producer.**", target: "consumer.probe.guarded", effect: "deny" }
];

describe.each(getMatrixConfigs())("Runtime > lockCaller/bind > $name", ({ config }) => {
	let api;

	afterEach(async () => {
		if (api) await api.shutdown();
		api = null;
	});

	/**
	 * Build the lock-caller fixture API and register the producer's emitter listener.
	 * @returns {Promise<object>} The Slothlet API proxy.
	 */
	async function makeApi() {
		api = await slothlet({
			...config,
			dir: BASE,
			permissions: { defaultPolicy: "allow", rules: PERMISSION_RULES }
		});
		await api.producer.relay.setup();
		return api;
	}

	it("repro: a locked callback keeps the registering module's caller identity (via emitter)", async () => {
		await makeApi();
		const lockedProbe = await api.consumer.probe.makeLockedIdentityProbe();
		// Fired from inside the producer module's emitter listener — producer is ambient.
		expect(await api.producer.relay.viaEmitter(lockedProbe)).toBe("consumer");
	});

	it("repro: a locked callback keeps caller identity for a direct nested call", async () => {
		await makeApi();
		const lockedProbe = await api.consumer.probe.makeLockedIdentityProbe();
		expect(await api.producer.relay.viaDirect(lockedProbe)).toBe("consumer");
	});

	it("a plain (un-pinned) callback inherits the ambient (wrong) caller identity", async () => {
		await makeApi();
		const plainProbe = await api.consumer.probe.makePlainIdentityProbe();
		// No pinning — the callback is attributed to whatever module is ambient.
		expect(await api.producer.relay.viaEmitter(plainProbe)).toBe("producer");
		expect(await api.producer.relay.viaDirect(plainProbe)).toBe("producer");
	});

	it("a permission rule keyed to the registering module matches inside a locked callback", async () => {
		await makeApi();
		const lockedGuarded = await api.consumer.probe.makeLockedGuardedCall();
		// `consumer.probe.guarded` is denied to the producer but allowed to the consumer.
		expect(await api.producer.relay.viaDirect(lockedGuarded)).toBe("guarded-ok");
	});

	it("a plain callback is denied because the ambient caller fails the permission rule", async () => {
		await makeApi();
		const plainGuarded = await api.consumer.probe.makePlainGuardedCall();
		await withSuppressedSlothletErrorOutput(async () => {
			let error;
			try {
				await api.producer.relay.viaDirect(plainGuarded);
			} catch (err) {
				error = err;
			}
			expect(error).toBeDefined();
			expect(error.code).toBe("PERMISSION_DENIED");
		});
	});

	it("live request context set after registration is visible inside the locked callback", async () => {
		await makeApi();
		const reader = await api.consumer.probe.makeLockedContextReader();
		await api.slothlet.context.run({ requestId: "live-xyz" }, async () => {
			// The locked callback overrides only caller identity — the request-scoped
			// context set here (after registration) stays live and visible.
			expect(await api.producer.relay.viaDirect(reader, undefined, ["requestId"])).toBe("live-xyz");
		});
	});

	it("forwards `this` into the locked callback", async () => {
		await makeApi();
		const thisProbe = await api.consumer.probe.makeLockedThisProbe();
		const thisArg = { tag: "the-this" };
		const result = await api.producer.relay.viaDirect(thisProbe, thisArg);
		expect(result).toBe(thisArg);
	});

	it("exposes the original function via `_slothletOriginal`", async () => {
		await makeApi();
		const lockedProbe = await api.consumer.probe.makeLockedIdentityProbe();
		expect(typeof lockedProbe._slothletOriginal).toBe("function");
	});

	it("lockCaller with no active context performs no override and does not throw", async () => {
		await makeApi();
		// Called from bare test code — no module wrapper to capture.
		const locked = api.slothlet.lockCaller(() => 42);
		expect(locked()).toBe(42);
	});

	it("lockCaller rejects a non-function argument", async () => {
		await makeApi();
		let error;
		try {
			api.slothlet.lockCaller(123);
		} catch (err) {
			error = err;
		}
		expect(error).toBeDefined();
		expect(error.code).toBe("INVALID_ARGUMENT");
	});

	it("bind rejects a non-function argument", async () => {
		await makeApi();
		let error;
		try {
			api.slothlet.bind(123);
		} catch (err) {
			error = err;
		}
		expect(error).toBeDefined();
		expect(error.code).toBe("INVALID_ARGUMENT");
	});

	it("bind restores the async context captured at registration time", async () => {
		await makeApi();
		const als = new AsyncLocalStorage();
		let bound;
		als.run({ value: 7 }, () => {
			bound = api.slothlet.bind(() => als.getStore()?.value);
		});
		// Invoked outside the als.run() scope — bind restored the captured store.
		expect(bound()).toBe(7);
	});

	it.skipIf(config.runtime === "live")(
		"async runtime: lockCaller preserves caller identity across an await (the Fastify async-hook case)",
		async () => {
			await makeApi();
			const asyncProbe = await api.consumer.probe.makeLockedAsyncIdentityProbe();
			// In async mode AsyncLocalStorage propagates across awaits, so the pinned
			// consumer identity is still active when identityProbe() runs after the await.
			expect(await api.producer.relay.viaDirect(asyncProbe)).toBe("consumer");
		}
	);

	it.skipIf(config.runtime !== "live")(
		"live runtime: lockCaller loses caller identity after the first await (synchronous-only coverage)",
		async () => {
			await makeApi();
			const asyncProbe = await api.consumer.probe.makeLockedAsyncIdentityProbe();
			// In live mode runInContext() restores currentWrapper in a finally as soon as
			// fn.apply() returns the Promise — before the inner await resolves. By the time
			// identityProbe() runs after the await, every synchronous frame (the locked
			// callback, viaDirect, the relay) has unwound and restored its wrapper, so no
			// module caller is active at all and the probe reports "unknown". Assert the
			// exact value so a regression to "consumer" (leak) or "producer" is caught.
			expect(await api.producer.relay.viaDirect(asyncProbe)).toBe("unknown");
		}
	);
});
