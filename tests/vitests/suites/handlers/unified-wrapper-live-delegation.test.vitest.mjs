/**
 *	@Project: @cldmv/slothlet
 *	@Filename: /tests/vitests/suites/handlers/unified-wrapper-live-delegation.test.vitest.mjs
 *	@Date: 2026-09-07T00:00:49-07:00 (1788764449)
 *	@Author: Nate Corcoran <CLDMV>
 *	@Email: <Shinrai@users.noreply.github.com>
 *	-----
 *	@Last modified by: Shinrai <CLDMV> (Shinrai@users.noreply.github.com)
 *	@Last modified time: 2026-09-07 08:25:58 -07:00 (1788794758)
 *	-----
 *	@Copyright: Copyright (c) 2013-2026 Catalyzed Motivation Inc. All rights reserved.
 */

/**
 * @fileoverview Regression coverage for #340 — wrap-on-set (`self.X = obj`) must delegate
 * live to the assigned object instead of eagerly cloning/snapshotting it, and must not
 * exclude EventEmitter-derived instances from `self`-context access.
 *
 * Covers the acceptance criteria from the issue body's "End-to-end verification" section:
 *  - two-way live binding for a plain object assigned via wrap-on-set (raw write visible
 *    through the wrapper, wrapper write visible on the raw object)
 *  - the same, two levels of nesting deep
 *  - read-level permission gating still enforced on the live-delegated path
 *  - an EventEmitter-derived instance assigned via wrap-on-set gets real `self`-context
 *    access on its own methods instead of throwing RUNTIME_NO_ACTIVE_CONTEXT_SELF
 */
import { describe, it, expect, afterEach } from "vitest";
import slothlet from "../../../../index.mjs";
import { resolveWrapper } from "#handlers/unified-wrapper";
import { TEST_DIRS } from "../../setup/vitest-helper.mjs";

const BASE = TEST_DIRS.API_TEST_PERMISSIONS;

describe("UnifiedWrapper > wrap-on-set live delegation (#340)", () => {
	let api;

	afterEach(async () => {
		if (api) await api.shutdown();
		api = null;
	});

	it("raw mutation of the assigned object is visible through the wrapper", async () => {
		api = await slothlet({ base: BASE, mode: "eager", permissions: { defaultPolicy: "allow" } });

		const obj = await api.mod.assignX();
		expect(await api.mod.readXY()).toBe(1);

		obj.y = 2;
		expect(await api.mod.readXY()).toBe(2);
	});

	it("a wrapper write reaches the original raw object", async () => {
		api = await slothlet({ base: BASE, mode: "eager", permissions: { defaultPolicy: "allow" } });

		const obj = await api.mod.assignX();
		api.mod.x.y = 5;

		expect(obj.y).toBe(5);
		expect(await api.mod.readXY()).toBe(5);
	});

	it("stays live two levels deep", async () => {
		api = await slothlet({ base: BASE, mode: "eager", permissions: { defaultPolicy: "allow" } });

		const obj = await api.mod.assignX();
		expect(await api.mod.readNestedZ()).toBe(1);

		obj.nested.z = 6;
		expect(await api.mod.readNestedZ()).toBe(6);

		api.mod.x.nested.z = 9;
		expect(obj.nested.z).toBe(9);
	});

	it("read-level permission gating still applies to a wrap-on-set-grafted property", async () => {
		api = await slothlet({
			base: BASE,
			mode: "eager",
			permissions: {
				defaultPolicy: "allow",
				readGating: true,
				rules: [{ caller: "callers.untrustedCaller.**", target: "mod.**", effect: "deny" }]
			}
		});

		await api.mod.assignX();

		// External read (no caller context) is exempt from gating.
		expect(await api.mod.readXY()).toBe(1);

		// A caller explicitly denied against mod.** is refused, even on the live-delegated path.
		try {
			await api.callers.untrustedCaller.callModReadXY();
			expect.unreachable("Should have thrown PERMISSION_DENIED");
		} catch (err) {
			expect(err.message).toMatch(/PERMISSION_DENIED/);
		}
	});

	it("an EventEmitter-derived instance assigned via wrap-on-set resolves self in its own methods", async () => {
		api = await slothlet({ base: BASE, mode: "eager", permissions: { defaultPolicy: "allow" } });

		await api.mod.assignDriver();
		await expect(api.mod.driverDoWork()).resolves.toBe("mod-label");
	});

	it("still behaves as a real EventEmitter (on/emit) after wrap-on-set, through the wrapped proxy", async () => {
		api = await slothlet({ base: BASE, mode: "eager", permissions: { defaultPolicy: "allow" } });

		await api.mod.assignDriver();
		// Exercise the wrapped proxy (getTrap/applyTrap, including the thisArg substitution),
		// not the raw instance retained by the caller — that's the only path a regression in the
		// Proxy delegation itself would actually break.
		const wrappedDriver = await api.mod.driver;
		let fired = false;
		wrappedDriver.on("ping", () => {
			fired = true;
		});
		wrappedDriver.emit("ping");
		expect(fired).toBe(true);
	});

	it("a primitive write against a frozen live impl throws instead of silently reporting success", async () => {
		api = await slothlet({ base: BASE, mode: "eager", permissions: { defaultPolicy: "allow" } });

		const obj = await api.mod.assignX();
		Object.freeze(obj);

		// `y` is now non-writable — Reflect.set fails silently (returns false, no throw); the
		// wrapper's set trap must propagate that failure (Proxy invariant: a strict-mode assignment
		// through a trap that returns false throws) rather than reporting a successful write.
		expect(() => {
			api.mod.x.y = 99;
		}).toThrow(TypeError);
		expect(obj.y).toBe(1);
	});

	it("a BRAND NEW primitive property on a live-identity wrapper forwards to impl on first write", async () => {
		api = await slothlet({ base: BASE, mode: "eager", permissions: { defaultPolicy: "allow" } });

		const obj = await api.mod.assignX();
		// `brandNewProp` was never part of the originally-assigned object, so this is the FIRST
		// write to this key through setTrap's live-impl-forwarding branch — no pre-existing accessor
		// from adoption to reuse (unlike `y`, which is adopted with a live accessor before any
		// setTrap write ever happens to it).
		api.mod.x.brandNewProp = "hello";

		expect(api.mod.x.brandNewProp).toBe("hello");
		expect(obj.brandNewProp).toBe("hello");

		// A second write must reuse the accessor rather than stomping it with a static value.
		api.mod.x.brandNewProp = "world";
		expect(obj.brandNewProp).toBe("world");
	});

	it("a primitive write against an ORDINARY (non-live-identity) namespace stores on the wrapper, not its impl", async () => {
		api = await slothlet({ base: BASE, mode: "eager", permissions: { defaultPolicy: "allow" } });

		// `cache.store` is an ordinary built module — not wrap-on-set, not an EventEmitter — so
		// this write must NOT take the live-impl-forwarding path (that's scoped to
		// `deferChildAdopt`/EventEmitter wrappers only). It should land as a plain static value on
		// the wrapper itself, exactly like the rest of setTrap's fallthrough behavior, and leave the
		// module untouched.
		api.cache.store.tag = "v1";
		expect(api.cache.store.tag).toBe("v1");
		expect(Object.getOwnPropertyDescriptor(api.cache.store, "tag")).toMatchObject({ value: "v1", writable: false });

		expect(await api.cache.store.get("k")).toEqual({ ok: true, module: "cache", action: "get", key: "k" });
	});

	it("a deferred descendant's primitive stays live-forwarding across an internal eager re-adopt", async () => {
		api = await slothlet({ base: BASE, mode: "eager", permissions: { defaultPolicy: "allow" } });

		await api.mod.assignX();
		// Force lazy adoption of `nested` (a deferred descendant TWO levels under the wrap-on-set
		// root — inherits deferChildAdopt but is never itself tagged userAssigned, unlike the root).
		const nestedProxy = await api.mod.x.nested;
		const nestedWrapper = resolveWrapper(nestedProxy);
		expect(nestedWrapper.____slothletInternal.deferChildAdopt).toBe(true);

		// ___setImpl -> _applyNewImpl -> ___adoptImplChildren is the internal path that runs an
		// EAGER adoption walk against an already-deferred wrapper (e.g. the existing-child-reuse
		// branch during a collision/reload elsewhere in the tree resolving to this wrapper). Without
		// deferChildAdopt correctly bailing a primitive child to null here, this would silently
		// snapshot the primitive as a frozen static value instead of the live-forwarding accessor
		// #340 requires for a deferred subtree.
		nestedWrapper.___setImpl({ z: 5 }, null, true);

		expect(nestedProxy.z).toBe(5);
		expect(Object.getOwnPropertyDescriptor(nestedWrapper, "z")).toMatchObject({
			get: expect.any(Function),
			set: expect.any(Function)
		});

		// Two-way live: a direct impl mutation must be visible through the wrapper, proving the
		// accessor forwards rather than having snapshotted a static copy.
		nestedWrapper.____slothletInternal.impl.z = 77;
		expect(nestedProxy.z).toBe(77);
	});

	it("Object.preventExtensions() on a live-identity wrapper does not break instanceof/getPrototypeOf", async () => {
		api = await slothlet({ base: BASE, mode: "eager", permissions: { defaultPolicy: "allow" } });

		await api.mod.assignX();
		const xProxy = api.mod.x;
		expect(xProxy instanceof Object).toBe(true);

		// The proxy TARGET here is the wrapper itself (not `impl`), so once it becomes
		// non-extensible the Proxy spec requires getPrototypeOf to return the target's OWN real
		// prototype exactly, or every subsequent instanceof/getPrototypeOf call throws.
		Object.preventExtensions(xProxy);
		expect(Object.isExtensible(xProxy)).toBe(false);

		expect(() => xProxy instanceof Object).not.toThrow();
		expect(() => Object.getPrototypeOf(xProxy)).not.toThrow();
	});

	it("a deferred descendant's NULL field stays live-forwarding across an internal eager re-adopt", async () => {
		api = await slothlet({ base: BASE, mode: "eager", permissions: { defaultPolicy: "allow" } });

		await api.mod.assignX();
		const xProxy = api.mod.x;
		const xWrapper = resolveWrapper(xProxy);

		// `typeof null === "object"` — a null-valued field must still be treated as a terminal
		// value (like any other primitive) by the deferred live-forwarding branch, not fall through
		// to the opaque-builtin/null static-snapshot branch just because of that typeof quirk.
		xWrapper.___setImpl({ y: 1, nullable: null }, null, true);

		expect(xProxy.nullable).toBe(null);
		expect(Object.getOwnPropertyDescriptor(xWrapper, "nullable")).toMatchObject({
			get: expect.any(Function),
			set: expect.any(Function)
		});

		// Two-way live: a direct impl mutation must be visible through the wrapper.
		xWrapper.____slothletInternal.impl.nullable = "changed";
		expect(xProxy.nullable).toBe("changed");
	});
});
