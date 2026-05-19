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

	it("a locked callback propagates a thrown error unchanged (no CONTEXT_EXECUTION_FAILED re-typing)", async () => {
		await makeApi();
		const locked = api.slothlet.lockCaller(() => {
			throw new TypeError("locked-bare-boom");
		});
		let error;
		try {
			locked();
		} catch (err) {
			error = err;
		}
		// runInContext must not re-type a framework callback's own error.
		expect(error).toBeInstanceOf(TypeError);
		expect(error.message).toBe("locked-bare-boom");
	});

	it("a locked callback propagates a thrown error unchanged when nested inside another locked callback", async () => {
		await makeApi();
		// The inner callback runs while the outer callback's context is already active,
		// exercising the rawErrors path of the in-context branch of runInContext.
		const inner = api.slothlet.lockCaller(() => {
			throw new TypeError("nested-locked-boom");
		});
		const outer = api.slothlet.lockCaller(() => inner());
		let error;
		try {
			outer();
		} catch (err) {
			error = err;
		}
		expect(error).toBeInstanceOf(TypeError);
		expect(error.message).toBe("nested-locked-boom");
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
		"bind freezes the slothlet caller identity captured inside the registering module",
		async () => {
			await makeApi();
			// Built as consumer code → bind freezes the consumer's slothlet caller identity.
			const boundProbe = await api.consumer.probe.makeBoundIdentityProbe();
			// Invoked while the producer is the ambient caller; bind restores the consumer.
			// AsyncResource.bind only meaningfully captures slothlet context in async mode.
			expect(await api.producer.relay.viaDirect(boundProbe)).toBe("consumer");
		}
	);

	it("a run() callback keeps the registering module's caller identity", async () => {
		await makeApi();
		// run() isolates context data but must carry the caller identity through —
		// a self.* call inside the callback stays attributed to the consumer.
		expect(await api.consumer.probe.probeIdentityViaRun()).toBe("consumer");
	});

	it("a scope() callback keeps the registering module's caller identity", async () => {
		await makeApi();
		expect(await api.consumer.probe.probeIdentityViaScope()).toBe("consumer");
	});

	it.skipIf(!config.hook?.enabled)("a hook auto-pins the registering module's caller identity (opt-out, default on)", async () => {
		await makeApi();
		// Registered as consumer code — the hook manager pins the consumer identity.
		await api.consumer.probe.registerIdentityHook("producer.relay.viaDirect");
		// Triggered via the producer; the before-hook fires under the consumer identity.
		await api.producer.relay.viaDirect(() => 0);
		expect(await api.consumer.probe.getHookProbedIdentity()).toBe("consumer");
	});

	it.skipIf(!config.hook?.enabled)("{ lockCaller: false } opts a hook out of caller-identity pinning", async () => {
		await makeApi();
		await api.consumer.probe.registerIdentityHook("producer.relay.viaDirect", { lockCaller: false });
		await api.producer.relay.viaDirect(() => 0);
		// Opted out: the handler is not pinned, so it never resolves to the consumer.
		// (Async runtime: no context → the probe stashes RUNTIME_NO_ACTIVE_CONTEXT_SELF;
		// live runtime: the probe resolves to the ambient identity instead.)
		const probed = await api.consumer.probe.getHookProbedIdentity();
		// Non-null proves the hook actually fired (registerIdentityHook resets it to null);
		// not "consumer" proves the opt-out took effect.
		expect(probed).not.toBeNull();
		expect(probed).not.toBe("consumer");
	});

	it.skipIf(!config.hook?.enabled)("an already-locked hook handler is respected, not double-wrapped", async () => {
		await makeApi();
		// The handler is pre-wrapped with lockCaller; hook.on must keep the existing lock.
		await api.consumer.probe.registerPreLockedHook("producer.relay.viaDirect");
		await api.producer.relay.viaDirect(() => 0);
		expect(await api.consumer.probe.getHookProbedIdentity()).toBe("consumer");
	});

	it.skipIf(!config.hook?.enabled)("an auto-pinned hook keeps caller identity after a full reload", async () => {
		await makeApi();
		// Short-circuit hook so the probed identity flows back through the call result —
		// observable even after reload() re-imports the consumer module.
		await api.consumer.probe.registerShortCircuitIdentityHook("producer.relay.viaDirect");
		expect(await api.producer.relay.viaDirect(() => 0)).toBe("consumer");
		// A full reload swaps the instanceID and contextManager and carries the pinned
		// handler into the new HookManager; it must resolve against the new instance.
		await api.slothlet.reload();
		expect(await api.producer.relay.viaDirect(() => 0)).toBe("consumer");
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
