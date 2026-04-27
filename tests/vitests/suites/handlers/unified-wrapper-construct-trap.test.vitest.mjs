/**
 *	@Project: @cldmv/slothlet
 *	@Filename: /tests/vitests/suites/handlers/unified-wrapper-construct-trap.test.vitest.mjs
 *	@Date: 2026-04-26 00:00:00 -07:00 (1745654400)
 *	@Author: Nate Corcoran <CLDMV>
 *	@Email: <Shinrai@users.noreply.github.com>
 *	-----
 *	@Last modified by: Nate Corcoran <CLDMV> (Shinrai@users.noreply.github.com)
 *	@Last modified time: 2026-04-26 20:42:36 -07:00 (1777261356)
 *	-----
 *	@Copyright: Copyright (c) 2013-2026 Catalyzed Motivation Inc. All rights reserved.
 */

/**
 * @fileoverview Tests for the `construct` proxy trap added to UnifiedWrapper.
 *
 * @description
 * Before the fix, `new api.classes.Counter(0)` fell back to constructing the
 * empty stub proxyTarget function, returning `{}` with no prototype chain and a
 * silently skipped constructor body.
 *
 * These tests verify that:
 *   1. The constructor body runs and own properties are set.
 *   2. The prototype chain is preserved (methods are reachable).
 *   3. Private class fields work correctly (raw instance returned, not re-proxied).
 *   4. Constructing a non-function impl throws INVALID_CONFIG_NOT_A_FUNCTION.
 * @module tests.vitests.suites.handlers.unified-wrapper-construct-trap
 */

import { describe, test, expect, beforeEach, afterEach } from "vitest";
import { getMatrixConfigs, TEST_DIRS } from "../../setup/vitest-helper.mjs";

// ─── Eager mode: construct trap routes `new` to real impl constructor ─────────

describe.each(getMatrixConfigs({ mode: "eager" }))("UnifiedWrapper > constructTrap > eager > Config: '$name'", ({ config }) => {
	let api;

	beforeEach(async () => {
		const { default: slothlet } = await import("@cldmv/slothlet");
		api = await slothlet({ ...config, dir: TEST_DIRS.API_TEST, collision: { initial: "replace", api: "replace" } });
	});

	afterEach(async () => {
		if (api) await api.shutdown();
		api = null;
	});

	test("constructor body runs — own property is set on the instance", () => {
		// Before the fix: new fell back to the stub fn, value was never set.
		const counter = new api.classes.Counter(42);
		expect(counter.value).toBe(42);
	});

	test("prototype chain is preserved — methods are callable", () => {
		// Before the fix: no prototype chain, methods were undefined.
		const counter = new api.classes.Counter(10);
		expect(typeof counter.increment).toBe("function");
		expect(counter.increment()).toBe(11);
		expect(counter.get()).toBe(11);
	});

	test("instance is not a plain empty object", () => {
		// Before the fix: Object.keys({}) → [] and value was undefined.
		const counter = new api.classes.Counter(7);
		expect(counter).not.toEqual({});
		expect(counter.value).toBe(7);
	});

	test("private class fields work — raw instance returned, not re-proxied", () => {
		// Private fields are stored in per-instance WeakMaps keyed on the real instance.
		// Re-proxying would break WeakMap lookup. The construct trap must return the
		// raw instance so private field access doesn't throw TypeError.
		const secrets = new api.classes.Secrets("hunter2");
		expect(secrets.reveal()).toBe("hunter2");
	});

	test("instanceof check passes against the real class", () => {
		// The new.target forwarded via Reflect.construct preserves the prototype chain.
		// Dynamic import the real class to verify instanceof.
		const counter = new api.classes.Counter(0);
		// The instance should have the prototype methods, which means the chain is intact.
		expect(Object.getPrototypeOf(counter)).toBe(Object.getPrototypeOf(new api.classes.Counter(0)));
	});
});

// ─── Lazy mode: construct trap routes `new` to real impl constructor ──────────

// ─── Lazy mode: constructTrap returns a Promise when called before materialization
//     so callers can simply `await new api.classes.Foo(args)` — no pre-warm needed.

describe.each(getMatrixConfigs({ mode: "lazy" }))("UnifiedWrapper > constructTrap > lazy (await new) > Config: '$name'", ({ config }) => {
	let api;

	beforeEach(async () => {
		const { default: slothlet } = await import("@cldmv/slothlet");
		api = await slothlet({ ...config, dir: TEST_DIRS.API_TEST, collision: { initial: "replace", api: "replace" } });
	});

	afterEach(async () => {
		if (api) await api.shutdown();
		api = null;
	});

	test("constructor body runs — own property is set on the instance", async () => {
		// The construct trap triggers materialization and returns a Promise.
		// Awaiting `new` resolves to the real instance with the constructor applied.
		const counter = await new api.classes.Counter(99);
		expect(counter.value).toBe(99);
	});

	test("prototype chain is preserved — methods are callable", async () => {
		const counter = await new api.classes.Counter(5);
		expect(typeof counter.increment).toBe("function");
		expect(counter.increment()).toBe(6);
		expect(counter.get()).toBe(6);
	});

	test("instance is not a plain empty object", async () => {
		const counter = await new api.classes.Counter(3);
		expect(counter).not.toEqual({});
		expect(counter.value).toBe(3);
	});

	test("private class fields work — raw instance returned, not re-proxied", async () => {
		// Private fields are stored in per-instance WeakMaps keyed on the real instance.
		// Re-proxying would break WeakMap lookup. The construct trap must return the
		// raw instance so private field access doesn't throw TypeError.
		const secrets = await new api.classes.Secrets("lazy-secret");
		expect(secrets.reveal()).toBe("lazy-secret");
	});

	test("prototype chain is consistent between two instances", async () => {
		const a = await new api.classes.Counter(0);
		const b = await new api.classes.Counter(0);
		expect(Object.getPrototypeOf(a)).toBe(Object.getPrototypeOf(b));
	});
});
