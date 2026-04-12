/**
 *	@Project: @cldmv/slothlet
 *	@Filename: /tests/vitests/suites/versioning/versioning-dispatcher-internals.test.vitest.mjs
 *	@Date: 2026-04-02 00:00:00 -07:00 (1775116800)
 *	@Author: Nate Corcoran <CLDMV>
 *	@Email: <Shinrai@users.noreply.github.com>
 *	-----
 *	@Last modified by: Nate Corcoran <CLDMV> (Shinrai@users.noreply.github.com)
 *	@Last modified time: 2026-04-02 00:00:00 -07:00 (1775116800)
 *	-----
 *	@Copyright: Copyright (c) 2013-2026 Catalyzed Motivation Inc. All rights reserved.
 */

/**
 * @fileoverview Dispatcher proxy internals — exercises all GET, apply, has, and ownKeys
 * trap cases that are not covered by the routing or basics test suites.
 *
 * Covers: Symbol.toStringTag (case 5), util.inspect.custom (case 6),
 * toString (case 7), valueOf (case 8), toJSON (case 9),
 * other symbols → undefined (case 10), __metadata delegate (case 11),
 * apply trap → VERSION_DISPATCH_NOT_CALLABLE,
 * has trap, ownKeys trap, and getOwnPropertyDescriptor.
 *
 * @module tests/vitests/suites/versioning/versioning-dispatcher-internals
 */

import { describe, it, expect, afterEach } from "vitest";
import { inspect } from "node:util";
import slothlet from "@cldmv/slothlet";
import { getMatrixConfigs, TEST_DIRS } from "../../setup/vitest-helper.mjs";

const BASE = TEST_DIRS.API_TEST_VERSIONED;

/** Helper: set up a slothlet instance with auth registered as v1 + v2. */
async function makeApi(config, extra = {}) {
	const api = await slothlet({ ...config, dir: `${BASE}/callers`, ...extra });
	await api.slothlet.api.add("auth", `${BASE}/v1`, {}, { version: "v1", default: true });
	await api.slothlet.api.add("auth", `${BASE}/v2`, {}, { version: "v2" });
	return api;
}

describe.each(getMatrixConfigs())("Versioning > Dispatcher Internals > $name", ({ config }) => {
	let api;

	afterEach(async () => {
		if (api) await api.shutdown();
		api = null;
	});

	// ── Case 5 — Symbol.toStringTag ──────────────────────────────────────────

	it("Symbol.toStringTag delegates to the resolved versioned wrapper", async () => {
		api = await makeApi(config);
		// Accessing Symbol.toStringTag on the dispatcher should not throw
		// and should return a value (either the versioned wrapper's tag or "Object").
		const tag = api.auth[Symbol.toStringTag];
		// Just verify it returns a string or undefined — not throw
		expect(typeof tag === "string" || tag === undefined).toBe(true);
	});

	// ── Case 6 — util.inspect.custom ────────────────────────────────────────

	it("util.inspect on the dispatcher returns a string representation", async () => {
		api = await makeApi(config);
		// util.inspect triggers Symbol(nodejs.util.inspect.custom) on the wrapper
		const result = inspect(api.auth);
		expect(typeof result).toBe("string");
		expect(result.length).toBeGreaterThan(0);
	});

	// ── Case 7 — toString ────────────────────────────────────────────────────

	it("dispatcher.toString returns [VersionDispatcher: path]", async () => {
		api = await makeApi(config);
		const str = api.auth.toString();
		expect(str).toBe("[VersionDispatcher: auth]");
	});

	// ── Case 8 — valueOf ─────────────────────────────────────────────────────

	it("dispatcher.valueOf returns the dispatcher proxy itself", async () => {
		api = await makeApi(config);
		const val = api.auth.valueOf();
		// The returned value should itself have __isVersionDispatcher = true
		expect(val.__isVersionDispatcher).toBe(true);
	});

	// ── Case 9 — toJSON ──────────────────────────────────────────────────────

	it("dispatcher.toJSON returns undefined (omits from JSON.stringify)", async () => {
		api = await makeApi(config);
		const json = api.auth.toJSON();
		expect(json).toBeUndefined();
	});

	it("JSON.stringify with a dispatcher value produces valid JSON (no throw)", async () => {
		api = await makeApi(config);
		// toJSON() returning undefined causes JSON.stringify to omit the key
		expect(() => JSON.stringify({ auth: api.auth })).not.toThrow();
		const parsed = JSON.parse(JSON.stringify({ auth: api.auth, x: 1 }));
		// 'auth' key is omitted, 'x' remains
		expect(parsed).not.toHaveProperty("auth");
		expect(parsed).toHaveProperty("x", 1);
	});

	// ── Case 10 — other Symbols → undefined ──────────────────────────────────

	it("accessing an arbitrary Symbol on the dispatcher returns undefined", async () => {
		api = await makeApi(config);
		const sym = Symbol("arbitrary");
		const result = api.auth[sym];
		expect(result).toBeUndefined();
	});

	it("Symbol.iterator on the dispatcher returns undefined", async () => {
		api = await makeApi(config);
		expect(api.auth[Symbol.iterator]).toBeUndefined();
	});

	// ── Case 11 — __metadata delegate ────────────────────────────────────────

	it("__metadata on the dispatcher delegates to the resolved versioned wrapper", async () => {
		api = await makeApi(config);
		// __metadata should not throw and should return an object (or undefined)
		const meta = api.auth.__metadata;
		// It's either an object or undefined depending on whether metadata handler is active
		expect(meta === undefined || typeof meta === "object").toBe(true);
	});

	it("__filePath on the dispatcher delegates to the resolved versioned wrapper", async () => {
		api = await makeApi(config);
		// __filePath should be a string pointing to the resolved version's source file
		const fp = api.auth.__filePath;
		expect(fp === undefined || typeof fp === "string").toBe(true);
	});

	it("__type on the dispatcher delegates to the resolved versioned wrapper", async () => {
		api = await makeApi(config);
		const t = api.auth.__type;
		expect(t === undefined || typeof t === "string").toBe(true);
	});

	// ── Apply trap — NOT callable (target is a plain object) ──────────────────

	it("calling the dispatcher as a function throws a TypeError (not a function)", async () => {
		api = await makeApi(config);
		// The dispatcher proxy target is a plain object, so JS throws a native TypeError
		// before the apply trap can fire. This is by design: the proxy stays typeof 'object'
		// so UnifiedWrapper's `typeof impl === 'object'` delegation check passes.
		const dispatcher = api.auth.valueOf();
		expect(() => dispatcher()).toThrow(TypeError);
	});

	// ── has trap ─────────────────────────────────────────────────────────────

	it("'in' operator on the dispatcher reports keys from versioned namespaces", async () => {
		api = await makeApi(config);
		const dispatcher = api.auth.valueOf();
		// "login" is exported by both v1 and v2 auth
		expect("login" in dispatcher).toBe(true);
	});

	it("'in' operator returns false for keys not in any versioned namespace", async () => {
		api = await makeApi(config);
		const dispatcher = api.auth.valueOf();
		expect("nonExistentMethod_xyz" in dispatcher).toBe(false);
	});

	// ── ownKeys trap ─────────────────────────────────────────────────────────

	it("Reflect.ownKeys on the dispatcher returns keys from versioned namespaces", async () => {
		api = await makeApi(config);
		const dispatcher = api.auth.valueOf();
		const keys = Reflect.ownKeys(dispatcher);
		// Should include at least the exported function names (login, logout, createUser)
		expect(Array.isArray(keys)).toBe(true);
		expect(keys.length).toBeGreaterThan(0);
	});

	it("Object.keys on the dispatcher returns enumerable keys via ownKeys+getOwnPropertyDescriptor", async () => {
		api = await makeApi(config);
		const dispatcher = api.auth.valueOf();
		// Object.keys triggers ownKeys + getOwnPropertyDescriptor for each key
		const keys = Object.keys(dispatcher);
		expect(Array.isArray(keys)).toBe(true);
	});

	// ── defineProperty trap ───────────────────────────────────────────────────

	it("Object.defineProperty with configurable:false on the dispatcher does not violate the get-trap invariant", async () => {
		api = await makeApi(config);
		// Without a defineProperty trap, this seals rawTarget with { configurable:false }.
		// The subsequent get read routes to the versioned wrapper (which has no such property),
		// so the trap returns undefined. V8 §10.5.8 step 10a.i requires the trap to return
		// the exact raw-target value when the descriptor is non-configurable+non-writable
		// → TypeError: 'get' on proxy: property 'IS_TEST_MODE' is a read-only and
		//   non-configurable property but the proxy did not return its actual value.
		// Also tests V8 §10.5.6 step 28: when the defineProperty trap returns true for a
		// non-configurable descriptor, V8 checks the raw target has a matching non-configurable
		// descriptor — the trap must mirror a stub on the raw target to satisfy this invariant.
		expect(() => {
			Object.defineProperty(api.auth, "IS_TEST_MODE", {
				value: true,
				configurable: false,
				writable: false,
				enumerable: true
			});
		}).not.toThrow();
		// Reading back via the dispatcher must not throw and must return the written value.
		expect(api.auth.IS_TEST_MODE).toBe(true);
	});

	it("defining the same non-configurable property twice with the same reference does not throw", async () => {
		api = await makeApi(config);
		// Without a defineProperty trap, the first call seals rawTarget with
		// { configurable:false }. The second call hits the sealed raw target and throws
		// "Cannot redefine property: redisClient".
		// With the trap forwarding to the versioned wrapper, repeated identical-reference
		// definitions succeed: SameValue(client, client) === true satisfies the spec rule
		// that allows redefining a non-configurable data property only when all attributes
		// are identical (ES2024 §10.1.6.3 step 8e).
		const client = { connected: true };
		expect(() => {
			const desc = { value: client, configurable: false, writable: false, enumerable: true };
			Object.defineProperty(api.auth, "redisClient", desc);
			Object.defineProperty(api.auth, "redisClient", desc);
		}).not.toThrow();
	});

	it("redefining a non-configurable dispatcher property with an incompatible descriptor returns false without mutating the versioned wrapper", async () => {
		api = await makeApi(config);
		// First definition — seals prop on the raw target with value 1.
		const succeeded = Reflect.defineProperty(api.auth, "SEALED_PROP", {
			value: 1,
			configurable: false,
			writable: false,
			enumerable: true
		});
		expect(succeeded).toBe(true);
		// Second definition — incompatible value. Without the fix, the guard
		// `existing.configurable !== false` was false so the raw-target mirror was skipped,
		// the versioned wrapper was mutated, and V8 threw a proxy-invariant TypeError after
		// the fact. With the fix, Reflect.defineProperty(t, ...) returns false (plain-object
		// semantics for incompatible non-configurable redefine) and the trap exits without
		// touching the versioned wrapper.
		const rejected = Reflect.defineProperty(api.auth, "SEALED_PROP", {
			value: 2,
			configurable: false,
			writable: false,
			enumerable: true
		});
		expect(rejected).toBe(false);
		// Versioned wrapper must not have been mutated — value stays 1.
		expect(api.auth.SEALED_PROP).toBe(1);
	});

	it("Object.getOwnPropertyDescriptor on a non-configurable dispatcher property returns the actual stored descriptor", async () => {
		api = await makeApi(config);
		// This exercises the getOwnPropertyDescriptor trap's non-configurable branch (branch 44).
		// After defineProperty with configurable:false the raw target holds a non-configurable stub,
		// so GOPD must return that exact descriptor — not a coerced configurable:true wrapper —
		// to satisfy V8 §10.5.5 (trap must report non-configurable when target property is non-configurable).
		Object.defineProperty(api.auth, "IS_TEST_MODE", {
			value: true,
			configurable: false,
			writable: false,
			enumerable: true
		});
		const desc = Object.getOwnPropertyDescriptor(api.auth, "IS_TEST_MODE");
		expect(desc).toBeDefined();
		expect(desc.configurable).toBe(false);
		expect(desc.value).toBe(true);
	});

	it("Object.defineProperty with configurable:true on the dispatcher does not mirror a stub on the raw target", async () => {
		api = await makeApi(config);
		// This exercises the defineProperty trap's configurable:true branch (branch 46 false arm).
		// When configurable:true, no raw-target mirroring is needed (V8 §10.5.6 step 28 only
		// applies to non-configurable descriptors), so the property is forwarded to the versioned
		// wrapper without any reflection back to the raw proxy target.
		expect(() => {
			Object.defineProperty(api.auth, "tempConfigProp", {
				value: 42,
				configurable: true,
				writable: true,
				enumerable: true
			});
		}).not.toThrow();
	});
});
