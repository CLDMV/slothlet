/**
 *	@Project: @cldmv/slothlet
 *	@Filename: /tests/vitests/suites/proxies/proxy-internals-attack.test.vitest.mjs
 *	@Date: 2026-02-20 13:51:54 -08:00 (1771624314)
 *	@Author: Nate Hyson <CLDMV>
 *	@Email: <Shinrai@users.noreply.github.com>
 *	-----
 *	@Last modified by: Nate Hyson <CLDMV> (Shinrai@users.noreply.github.com)
 *	@Last modified time: 2026-02-20 16:53:10 -08:00 (1771635190)
 *	-----
 *	@Copyright: Copyright (c) 2013-2026 Catalyzed Motivation Inc. All rights reserved.
 */

/**
 * @fileoverview Security test: all framework internals must be unreachable from user-facing proxies.
 *
 * @description
 * Validates that the framework's private internal state cannot be accessed, enumerated,
 * mutated, or leaked through any standard or advanced JavaScript introspection technique
 * on a user-facing slothlet proxy — for BOTH main proxies (all modes) and waiting proxies
 * (lazy pre-materialization).
 *
 * Attack surfaces covered:
 *
 * A. ____slothletInternal (the private state bag — backed by #internal private field)
 *    A1.  Direct property read
 *    A2.  Bracket notation read
 *    A3.  `in` operator (hasTrap)
 *    A4.  Object.getOwnPropertyDescriptor
 *    A5.  Object.keys / Object.getOwnPropertyNames / Reflect.ownKeys (ownKeysTrap)
 *    A6.  for..in enumeration
 *    A7.  Spread operator ({ ...proxy })
 *    A8.  Object.assign
 *    A9.  Prototype chain walk
 *    A10. Mutation via set — must NOT shadow the #internal private field getter
 *    A11. Mutation via Object.defineProperty
 *    A12. Delete attempt — must not throw (return true silently)
 *    A13. Waiting proxy (lazy pre-materialization) — must also block ____slothletInternal
 *
 * B. ___getState / __state — now blocked (removed from allowedInternals)
 *    B1.  ___getState returns undefined through the proxy (internal access uses resolveWrapper)
 *    B2.  __state returns undefined through the proxy
 *
 * C. Framework mutation/disruption APIs (___setImpl, ___resetLazy, ___invalidate)
 *    C1.  These ARE accessible (intentional framework extension points — documents exposure)
 *    C2.  ___invalidate() callable from outside (documents effect)
 *
 * D. Implementation / server-path info leaks (__impl, __filePath, __sourceFolder)
 *    D1.  __impl returns raw implementation (intentional — documents exposure)
 *    D2.  __filePath / __sourceFolder may expose server-side paths (documents exposure)
 *
 * E. Read-only informational properties — cannot be overwritten from outside
 *    E1.  Writing to any read-only prop is silently absorbed — read returns original value
 *    E2.  Writing to read-only props on a waiting proxy (lazy pre-materialization) is also absorbed
 *    E3.  Deleting a read-only prop is silently absorbed — read still returns original value
 *
 * F. resolveWrapper as the safe internal access path
 *    F1.  resolveWrapper(proxy) returns the UnifiedWrapper
 *    F2.  resolveWrapper(waitingProxy) returns the UnifiedWrapper in lazy mode
 *    F3.  resolveWrapper returns null for non-proxy values
 *    F4.  Raw wrapper via resolveWrapper CAN read ____slothletInternal (framework use)
 *    F5.  The proxy itself still blocks ____slothletInternal
 */

import { describe, it, expect, beforeEach, afterEach } from "vitest";
import slothlet from "@cldmv/slothlet";
import { resolveWrapper } from "@cldmv/slothlet/handlers/unified-wrapper";
import { getMatrixConfigs, TEST_DIRS } from "../../setup/vitest-helper.mjs";

/**
 * Keys that must be completely inaccessible through any user-facing slothlet proxy.
 * Tests A1–A13 are run for every entry in this array (via describe.each).
 *
 * @type {Array<{key: string, desc: string}>}
 */
const BLOCKED_KEYS = [
	{ key: "____slothletInternal", desc: "private state bag backed by #internal field" },
	{ key: "___getState", desc: "state accessor — removed from allowedInternals, use resolveWrapper internally" },
	{ key: "__state", desc: "state alias — removed from allowedInternals" }
];

/**
 * The key used by framework code to access the state bag on a raw UnifiedWrapper instance
 * (i.e. via resolveWrapper). This is intentionally accessible on the raw wrapper — never
 * through a user-facing proxy.
 */
const INTERNAL_KEY = "____slothletInternal";

describe.each(getMatrixConfigs({}))("Proxy Internals Attack Vectors - $name", ({ config }) => {
	/** @type {object} */
	let api;

	beforeEach(async () => {
		api = await slothlet({
			...config,
			dir: TEST_DIRS.API_TEST
		});
	});

	afterEach(async () => {
		if (api?.shutdown) await api.shutdown();
		api = null;
	});

	// ---------------------------------------------------------------------------
	// Helpers
	// ---------------------------------------------------------------------------

	/**
	 * Returns a materialized leaf proxy (api.math.add) and namespace proxy (api.math).
	 * Triggers _materialize() unconditionally — it is a no-op in eager mode and
	 * performs actual async work in lazy mode, ensuring the proxies are fully resolved.
	 * @returns {Promise<{ leaf: unknown, ns: unknown }>}
	 */
	async function getMaterializedProxies() {
		await api.math._materialize();
		return {
			leaf: api.math.add,
			ns: api.math
		};
	}

	// ---------------------------------------------------------------------------
	// A. Blocked keys — must be completely inaccessible through any proxy surface.
	//    Each test iterates all BLOCKED_KEYS so we share a single API instance.
	// ---------------------------------------------------------------------------

	it("A1. Direct read returns undefined for all blocked keys", async () => {
		const { leaf, ns } = await getMaterializedProxies();
		for (const { key } of BLOCKED_KEYS) {
			expect(leaf[key], `leaf["${key}"]`).toBeUndefined();
			expect(ns[key], `ns["${key}"]`).toBeUndefined();
		}
	});

	it("A2. Bracket notation read returns undefined for all blocked keys", async () => {
		const { leaf, ns } = await getMaterializedProxies();
		for (const { key } of BLOCKED_KEYS) {
			// eslint-disable-next-line dot-notation
			expect(leaf[key], `leaf["${key}"]`).toBeUndefined();
			// eslint-disable-next-line dot-notation
			expect(ns[key], `ns["${key}"]`).toBeUndefined();
		}
	});

	it("A3. `in` operator (hasTrap) returns false for all blocked keys", async () => {
		const { leaf, ns } = await getMaterializedProxies();
		for (const { key } of BLOCKED_KEYS) {
			expect(key in leaf, `"${key}" in leaf`).toBe(false);
			expect(key in ns, `"${key}" in ns`).toBe(false);
		}
	});

	it("A4. Object.getOwnPropertyDescriptor returns undefined for all blocked keys", async () => {
		const { leaf, ns } = await getMaterializedProxies();
		for (const { key } of BLOCKED_KEYS) {
			expect(Object.getOwnPropertyDescriptor(leaf, key), `descriptor(leaf, "${key}")`).toBeUndefined();
			expect(Object.getOwnPropertyDescriptor(ns, key), `descriptor(ns, "${key}")`).toBeUndefined();
		}
	});

	it("A5a. Object.keys does not include any blocked key", async () => {
		const { leaf, ns } = await getMaterializedProxies();
		const leafKeys = Object.keys(leaf);
		const nsKeys = Object.keys(ns);
		for (const { key } of BLOCKED_KEYS) {
			expect(leafKeys, `Object.keys(leaf) must not contain "${key}"`).not.toContain(key);
			expect(nsKeys, `Object.keys(ns) must not contain "${key}"`).not.toContain(key);
		}
	});

	it("A5b. Object.getOwnPropertyNames does not include any blocked key", async () => {
		const { leaf, ns } = await getMaterializedProxies();
		const leafNames = Object.getOwnPropertyNames(leaf);
		const nsNames = Object.getOwnPropertyNames(ns);
		for (const { key } of BLOCKED_KEYS) {
			expect(leafNames, `getOwnPropertyNames(leaf) must not contain "${key}"`).not.toContain(key);
			expect(nsNames, `getOwnPropertyNames(ns) must not contain "${key}"`).not.toContain(key);
		}
	});

	it("A5c. Reflect.ownKeys does not include any blocked key", async () => {
		const { leaf, ns } = await getMaterializedProxies();
		const leafKeys = Reflect.ownKeys(leaf);
		const nsKeys = Reflect.ownKeys(ns);
		for (const { key } of BLOCKED_KEYS) {
			expect(leafKeys, `Reflect.ownKeys(leaf) must not contain "${key}"`).not.toContain(key);
			expect(nsKeys, `Reflect.ownKeys(ns) must not contain "${key}"`).not.toContain(key);
		}
	});

	it("A6. for..in loop does not expose any blocked key", async () => {
		const { leaf, ns } = await getMaterializedProxies();
		const leafForIn = [];
		// eslint-disable-next-line guard-for-in
		for (const k in leaf) leafForIn.push(k);
		const nsForIn = [];
		// eslint-disable-next-line guard-for-in
		for (const k in ns) nsForIn.push(k);
		for (const { key } of BLOCKED_KEYS) {
			expect(leafForIn, `for..in(leaf) must not contain "${key}"`).not.toContain(key);
			expect(nsForIn, `for..in(ns) must not contain "${key}"`).not.toContain(key);
		}
	});

	it("A7. Spread operator does not expose any blocked key", async () => {
		const { ns } = await getMaterializedProxies();
		const spread = { ...ns };
		const spreadKeys = Object.keys(spread);
		for (const { key } of BLOCKED_KEYS) {
			expect(spreadKeys, `{...ns} keys must not contain "${key}"`).not.toContain(key);
			expect(spread[key], `spread["${key}"]`).toBeUndefined();
		}
	});

	it("A8. Object.assign does not copy any blocked key", async () => {
		const { ns } = await getMaterializedProxies();
		const target = {};
		Object.assign(target, ns);
		const assignedKeys = Object.keys(target);
		for (const { key } of BLOCKED_KEYS) {
			expect(assignedKeys, `Object.assign target keys must not contain "${key}"`).not.toContain(key);
			expect(target[key], `target["${key}"] after assign`).toBeUndefined();
		}
	});

	it("A9. Prototype chain walk does not expose any blocked key", async () => {
		const { leaf, ns } = await getMaterializedProxies();
		let proto = Object.getPrototypeOf(leaf);
		while (proto !== null) {
			for (const { key } of BLOCKED_KEYS) {
				expect(proto[key], `proto["${key}"] on leaf chain`).toBeUndefined();
			}
			proto = Object.getPrototypeOf(proto);
		}
		proto = Object.getPrototypeOf(ns);
		while (proto !== null) {
			for (const { key } of BLOCKED_KEYS) {
				expect(proto[key], `proto["${key}"] on ns chain`).toBeUndefined();
			}
			proto = Object.getPrototypeOf(proto);
		}
	});

	it("A10. Mutation via set is silently absorbed for all blocked keys — proxy remains functional", async () => {
		const { leaf, ns } = await getMaterializedProxies();
		const sentinel = { injected: true };
		for (const { key } of BLOCKED_KEYS) {
			expect(() => {
				leaf[key] = sentinel;
			}, `set leaf["${key}"]`).not.toThrow();
			expect(() => {
				ns[key] = sentinel;
			}, `set ns["${key}"]`).not.toThrow();
			expect(leaf[key], `leaf["${key}"] after set`).toBeUndefined();
			expect(ns[key], `ns["${key}"] after set`).toBeUndefined();
		}
		// Proxy must remain fully functional after all mutation attempts
		expect(resolveWrapper(leaf)).not.toBeNull();
		expect(resolveWrapper(ns)).not.toBeNull();
	});

	it("A11. Object.defineProperty cannot install any blocked key on proxy", async () => {
		const { ns } = await getMaterializedProxies();
		for (const { key } of BLOCKED_KEYS) {
			try {
				Object.defineProperty(ns, key, { value: 42, configurable: true });
			} catch {
				// Acceptable — proxy may reject defineProperty
			}
			expect(ns[key], `ns["${key}"] after defineProperty`).toBeUndefined();
		}
	});

	it("A12. delete does not throw and does not break the proxy for any blocked key", async () => {
		const { ns } = await getMaterializedProxies();
		for (const { key } of BLOCKED_KEYS) {
			expect(() => {
				delete ns[key];
			}, `delete ns["${key}"]`).not.toThrow();
		}
		expect(resolveWrapper(ns)).not.toBeNull();
	});

	it("A13. All proxy states (pre- and post-materialization) block all blocked keys", async () => {
		const nsPre = api.math;
		for (const { key } of BLOCKED_KEYS) {
			expect(nsPre[key], `nsPre["${key}"] pre-materialization`).toBeUndefined();
			expect(key in nsPre, `"${key}" in nsPre pre-materialization`).toBe(false);
		}

		await api.math._materialize();
		const nsPost = api.math;
		for (const { key } of BLOCKED_KEYS) {
			expect(nsPost[key], `nsPost["${key}"] post-materialization`).toBeUndefined();
			expect(key in nsPost, `"${key}" in nsPost post-materialization`).toBe(false);
		}
	});

	// ---------------------------------------------------------------------------
	// B. ___getState / __state — blocked (removed from allowedInternals)
	//    Internal state reads go via resolveWrapper(...).____slothletInternal.state
	// ---------------------------------------------------------------------------

	it("B1. ___getState is blocked — returns undefined through the proxy", async () => {
		const { ns } = await getMaterializedProxies();
		expect(ns.___getState).toBeUndefined();
	});

	it("B2. __state is blocked — returns undefined through the proxy", async () => {
		const { ns } = await getMaterializedProxies();
		expect(ns.__state).toBeUndefined();
	});

	// ---------------------------------------------------------------------------
	// C. Framework mutation/disruption APIs (___setImpl, ___resetLazy, ___invalidate)
	// ---------------------------------------------------------------------------

	it("C1. ___setImpl / ___resetLazy / ___invalidate are accessible (intentional framework APIs)", async () => {
		const { ns } = await getMaterializedProxies();
		// These are in allowedInternals — documents their intentional exposure
		expect(typeof ns.___setImpl).toBe("function");
		expect(typeof ns.___resetLazy).toBe("function");
		expect(typeof ns.___invalidate).toBe("function");
	});

	it("C2. ___invalidate() callable externally — marks wrapper invalid", async () => {
		const { ns } = await getMaterializedProxies();
		expect(() => {
			ns.___invalidate();
		}).not.toThrow();
		const wrapper = resolveWrapper(ns);
		expect(wrapper[INTERNAL_KEY].invalid).toBe(true);
	});

	// ---------------------------------------------------------------------------
	// D. Implementation / server-path info leaks
	// ---------------------------------------------------------------------------

	it("D1. __impl returns the raw implementation (intentional — documents exposure)", async () => {
		const { leaf } = await getMaterializedProxies();
		const impl = leaf.__impl;
		// May be a function, object, or null; verify it's not undefined to confirm it's exposed
		expect(["function", "object"].includes(typeof impl)).toBe(true);
	});

	it("D2. __filePath / __sourceFolder expose server-side paths (intentional — documents exposure)", async () => {
		const { leaf } = await getMaterializedProxies();
		const filePath = leaf.__filePath;
		const sourceFolder = leaf.__sourceFolder;
		// If present they must be strings (paths), not the internal state object
		if (filePath !== undefined) {
			expect(typeof filePath).toBe("string");
		}
		if (sourceFolder !== undefined) {
			expect(typeof sourceFolder).toBe("string");
		}
	});

	// ---------------------------------------------------------------------------
	// E. Read-only informational properties — external writes must be silently absorbed.
	//    Each prop's getTrap handler returns directly from ____slothletInternal, so
	//    any own-property installation by setTrap would be bypassed on read anyway.
	//    setTrap explicitly blocks these in blockedKeys for a clean no-op.
	// ---------------------------------------------------------------------------

	/**
	 * Informational / state-read props that must be read-only from outside.
	 * getTrap returns all of these from wrapper.____slothletInternal — writes cannot corrupt them.
	 * @type {string[]}
	 */
	const READ_ONLY_INFO_PROPS = [
		// Mode & identity
		"__mode",
		"__apiPath",
		"__slothletPath",
		"__isCallable",
		"__materializeOnCreate",
		"__displayName",
		"__type",
		// Server-info (D section)
		"__filePath",
		"__sourceFolder",
		"__moduleID",
		// Lazy state
		"__materialized",
		"__inFlight",
		// Misc
		"__metadata",
		"__invalid"
	];

	it("E1. Writing to any read-only informational prop is silently absorbed — read returns original value", async () => {
		const { leaf, ns } = await getMaterializedProxies();
		const SENTINEL = Symbol("hijack-attempt");
		for (const prop of READ_ONLY_INFO_PROPS) {
			const originalLeaf = leaf[prop];
			const originalNs = ns[prop];
			expect(() => {
				leaf[prop] = SENTINEL;
			}, `set leaf["${prop}"]`).not.toThrow();
			expect(() => {
				ns[prop] = SENTINEL;
			}, `set ns["${prop}"]`).not.toThrow();
			expect(leaf[prop], `leaf["${prop}"] after write`).toStrictEqual(originalLeaf);
			expect(ns[prop], `ns["${prop}"] after write`).toStrictEqual(originalNs);
		}
	});

	it("E2. Writing to read-only props on a waiting proxy (pre-materialization) is also absorbed", () => {
		// api.math is a waiting proxy in lazy mode, or already resolved in eager mode —
		// either way the write must not corrupt the read.
		const proxy = api.math;
		const SENTINEL = Symbol("hijack-attempt");
		for (const prop of READ_ONLY_INFO_PROPS) {
			const original = proxy[prop];
			expect(() => {
				proxy[prop] = SENTINEL;
			}, `set api.math["${prop}"]`).not.toThrow();
			expect(proxy[prop], `api.math["${prop}"] after write`).toStrictEqual(original);
		}
	});

	it("E3. Deleting a read-only informational prop is silently absorbed — read still returns original value", async () => {
		const { leaf, ns } = await getMaterializedProxies();
		for (const prop of READ_ONLY_INFO_PROPS) {
			const originalLeaf = leaf[prop];
			const originalNs = ns[prop];
			expect(() => {
				delete leaf[prop];
			}, `delete leaf["${prop}"]`).not.toThrow();
			expect(() => {
				delete ns[prop];
			}, `delete ns["${prop}"]`).not.toThrow();
			expect(leaf[prop], `leaf["${prop}"] after delete`).toStrictEqual(originalLeaf);
			expect(ns[prop], `ns["${prop}"] after delete`).toStrictEqual(originalNs);
		}
	});

	// ---------------------------------------------------------------------------
	// F. resolveWrapper as the correct internal access path
	// ---------------------------------------------------------------------------

	it("F1. resolveWrapper(proxy) returns the UnifiedWrapper — not null", async () => {
		const { leaf, ns } = await getMaterializedProxies();
		expect(resolveWrapper(leaf)).not.toBeNull();
		expect(resolveWrapper(ns)).not.toBeNull();
	});

	it("F2. resolveWrapper on any proxy state returns the UnifiedWrapper", () => {
		// In lazy mode api.math is a waiting proxy at this point; in eager it is already resolved.
		// resolveWrapper must never return null for a valid slothlet proxy.
		const nsPre = api.math;
		expect(resolveWrapper(nsPre)).not.toBeNull();
	});

	it("F3. resolveWrapper returns null for non-proxy values", () => {
		expect(resolveWrapper(null)).toBeNull();
		expect(resolveWrapper(undefined)).toBeNull();
		expect(resolveWrapper(42)).toBeNull();
		expect(resolveWrapper("string")).toBeNull();
		expect(resolveWrapper({})).toBeNull();
		expect(resolveWrapper(() => {})).toBeNull();
	});

	it("F4. Raw wrapper via resolveWrapper CAN access ____slothletInternal (framework use)", async () => {
		const { leaf, ns } = await getMaterializedProxies();
		const leafWrapper = resolveWrapper(leaf);
		const nsWrapper = resolveWrapper(ns);
		expect(leafWrapper[INTERNAL_KEY]).not.toBeUndefined();
		expect(nsWrapper[INTERNAL_KEY]).not.toBeUndefined();
		expect(leafWrapper[INTERNAL_KEY]).not.toBeNull();
		expect(nsWrapper[INTERNAL_KEY]).not.toBeNull();
	});

	it("F5. The proxy blocks ____slothletInternal while resolveWrapper can access it", async () => {
		const { leaf, ns } = await getMaterializedProxies();
		// Proxy: blocked
		expect(leaf[INTERNAL_KEY]).toBeUndefined();
		expect(ns[INTERNAL_KEY]).toBeUndefined();
		// Raw wrapper: accessible for framework use
		expect(resolveWrapper(leaf)[INTERNAL_KEY]).not.toBeUndefined();
		expect(resolveWrapper(ns)[INTERNAL_KEY]).not.toBeUndefined();
	});
});
