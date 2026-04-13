/**
 *	@Project: @cldmv/slothlet
 *	@Filename: /tests/vitests/suites/versioning/versioning-dispatcher-set.test.vitest.mjs
 *	@Date: 2026-04-12 00:00:00 -07:00 (1776808800)
 *	@Author: Nate Corcoran <CLDMV>
 *	@Email: <Shinrai@users.noreply.github.com>
 *	-----
 *	@Last modified by: Nate Corcoran <CLDMV> (Shinrai@users.noreply.github.com)
 *	@Last modified time: 2026-04-12 00:00:00 -07:00 (1776808800)
 *	-----
 *	@Copyright: Copyright (c) 2013-2026 Catalyzed Motivation Inc. All rights reserved.
 */

/**
 * @fileoverview Dispatcher proxy set trap — regression tests for the missing `set`
 * trap on the version dispatcher proxy.
 *
 * Bug: without a `set` trap, the dispatcher's `getOwnPropertyDescriptor` trap
 * returns `{ writable: false }` for all unknown properties. V8's default `[[Set]]`
 * path consults GOPD on the receiver and refuses the write with
 * "Cannot redefine property: <prop>", even on the first assignment.
 *
 * Fix: the `set` trap delegates via `Reflect.set(vw, prop, value, vw)` to the
 * real versioned wrapper's own `setTrap`, which performs the correct
 * delete → `defineProperty(configurable: true)` cycle.
 *
 * @module tests/vitests/suites/versioning/versioning-dispatcher-set
 */

import { describe, it, expect, afterEach } from "vitest";
import { inspect } from "node:util";
import slothlet from "@cldmv/slothlet";
import { VersionManager } from "@cldmv/slothlet/handlers/version-manager";
import { getMatrixConfigs, TEST_DIRS } from "../../setup/vitest-helper.mjs";

const BASE = TEST_DIRS.API_TEST_VERSIONED;

/** Helper: one versioned path "auth" registered as v1 (default). */
async function makeApi(config) {
	const api = await slothlet({ ...config, dir: `${BASE}/callers` });
	await api.slothlet.api.add("auth", `${BASE}/v1`, {}, { version: "v1", default: true });
	return api;
}

describe.each(getMatrixConfigs())("Versioning > Dispatcher set trap > $name", ({ config }) => {
	let api;

	afterEach(async () => {
		if (api) await api.shutdown();
		api = null;
	});

	it("plain assignment to a dispatcher path does not throw", async () => {
		api = await makeApi(config);
		expect(() => {
			api.auth.runtimeProp = "hello";
		}).not.toThrow();
	});

	it("assigned value is readable back through the dispatcher", async () => {
		api = await makeApi(config);
		api.auth.runtimeProp = "hello";
		expect(api.auth.runtimeProp).toBe("hello");
	});

	it("value is stored on the versioned wrapper, not the dispatcher target", async () => {
		api = await makeApi(config);
		api.auth.runtimeProp = "from-dispatcher";
		// The real versioned path must also see the value
		expect(api.v1.auth.runtimeProp).toBe("from-dispatcher");
	});

	it("assignment can be repeated without throwing (reassignment cycle)", async () => {
		api = await makeApi(config);
		expect(() => {
			api.auth.runtimeProp = "first";
			api.auth.runtimeProp = "second";
			api.auth.runtimeProp = "third";
		}).not.toThrow();
		expect(api.auth.runtimeProp).toBe("third");
	});

	it("multiple distinct properties can be assigned", async () => {
		api = await makeApi(config);
		api.auth.clientA = "a";
		api.auth.clientB = "b";
		api.auth.clientC = 42;
		expect(api.auth.clientA).toBe("a");
		expect(api.auth.clientB).toBe("b");
		expect(api.auth.clientC).toBe(42);
	});

	it("assignment routes to the active default version when two versions exist", async () => {
		api = await slothlet({ ...config, dir: `${BASE}/callers` });
		await api.slothlet.api.add("auth", `${BASE}/v1`, {}, { version: "v1", default: true });
		await api.slothlet.api.add("auth", `${BASE}/v2`, {}, { version: "v2" });

		api.auth.sharedClient = "shared";

		// v1 is the default — prop must be visible on v1.auth
		expect(api.v1.auth.sharedClient).toBe("shared");
		// v2.auth should NOT have it (different wrapper)
		expect(api.v2.auth.sharedClient).toBeUndefined();
	});

	// ── Special-case key absorption ──────────────────────────────────────────
	// The get trap returns fixed values for a known set of keys (framework internals,
	// stable accessors, thenable/structural props, all symbols). Writing to those keys
	// would create invisible hidden state on the versioned wrapper — never observable
	// through the dispatcher's get trap. The set trap absorbs those writes silently.

	it("write to a framework accessor key is silently absorbed without throwing", async () => {
		api = await makeApi(config);
		// These would return fixed dispatcher values from get; writes must not throw
		// and must not alter what get returns.
		expect(() => {
			api.auth.__isVersionDispatcher = false;
			api.auth.__apiPath = "overridden";
			api.auth.__moduleID = "hacked";
			api.auth.toString = "not-a-function";
			api.auth.valueOf = null;
			api.auth.toJSON = null;
			api.auth.then = () => {};
			api.auth.length = 99;
			api.auth.name = "renamed";
		}).not.toThrow();

		// Reads must return the original fixed values, not the written values
		expect(api.auth.__isVersionDispatcher).toBe(true);
		expect(api.auth.__apiPath).toBe("auth");
		expect(api.auth.toString()).toBe("[VersionDispatcher: auth]");
		expect(api.auth.then).toBeUndefined();
		expect(api.auth.length).toBe(0);
	});

	it("write to a symbol key is silently absorbed without throwing", async () => {
		api = await makeApi(config);
		const MY_SYM = Symbol("test");
		expect(() => {
			api.auth[MY_SYM] = "symbol-value";
			api.auth[Symbol.toStringTag] = "Overridden";
			api.auth[Symbol.iterator] = () => {};
		}).not.toThrow();

		// All symbol writes are absorbed — none leak through to the versioned wrapper
		expect(api.auth[MY_SYM]).toBeUndefined();
		expect(api.v1.auth[MY_SYM]).toBeUndefined();
		// Symbol.toStringTag is also absorbed; get still returns the computed UW value
		expect(api.auth[Symbol.toStringTag]).toBeDefined();
	});

	it("absorbed writes do not pollute the versioned wrapper", async () => {
		api = await makeApi(config);
		const sentinel = {};
		// Write special-case keys that the dispatcher absorbs
		api.auth.__isCallable = sentinel;
		api.auth.toString = "corrupted";
		// The versioned wrapper (v1.auth) must be unaffected — __isCallable is always false
		// from UnifiedWrapper's own get trap regardless of what we write to the dispatcher
		expect(api.v1.auth.__isCallable).toBe(false);
		expect(typeof api.v1.auth.toString).not.toBe("string");
	});

	it("writes to framework internal string keys are absorbed (case 1 set guard)", async () => {
		api = await makeApi(config);
		// These keys return undefined from the get trap (case 1); writes must be absorbed silently.
		expect(() => {
			api.auth.____slothletInternal = "corrupted";
			api.auth._impl = "corrupted";
			api.auth.__impl = "corrupted";
			api.auth.__state = "corrupted";
			api.auth.__invalid = "corrupted";
		}).not.toThrow();
		// Internal keys are never visible through the dispatcher
		expect(api.auth.____slothletInternal).toBeUndefined();
		expect(api.auth._impl).toBeUndefined();
	});

	it("util.inspect shows the resolved versioned namespace (inspection transparency)", async () => {
		api = await makeApi(config);
		const result = inspect(api.auth, { depth: 3, colors: false });
		// Must show default-version namespace content, not the raw dispatcher target.
		// The raw target only has __isVersionDispatcher and __logicalPath.
		expect(result).toContain("login");
		expect(result).not.toContain("__isVersionDispatcher");
	});

	it("[util.inspect.custom] is accessible via explicit property access (get trap case 6)", async () => {
		api = await makeApi(config);
		const customSym = Symbol.for("nodejs.util.inspect.custom");
		// get trap case 6 fires on explicit symbol property access
		const customFn = api.auth[customSym];
		expect(typeof customFn).toBe("function");
		// Called with no args: falls back to inspect(vw, undefined)
		const result = customFn();
		// Returns a string that represents the resolved versioned namespace
		expect(typeof result).toBe("string");
		expect(result).toContain("login");
		// Called with options forwarding: honoured by inspectFn
		const { inspect: inspectFn } = await import("node:util");
		const resultWithOptions = customFn(3, { depth: 3, colors: false }, inspectFn);
		expect(typeof resultWithOptions).toBe("string");
		expect(resultWithOptions).toContain("login");
	});

	it("raw target inspect function called without inspectFn uses inspect() fallback", async () => {
		api = await makeApi(config);
		const customSym = Symbol.for("nodejs.util.inspect.custom");
		// GOPD on the proxy returns the raw-target function (not the get-trap arrow function).
		// Calling it without an inspectFn exercises the fallback branch used when inspectFn is not provided.
		const rawTargetFn = Object.getOwnPropertyDescriptor(api.auth, customSym)?.value;
		expect(typeof rawTargetFn).toBe("function");
		const result = rawTargetFn();
		expect(typeof result).toBe("string");
		expect(result).toContain("login");
	});

	it("direct dispatcher use before registration returns the fallback inspect payload", () => {
		const versionManager = new VersionManager({
			contextManager: { tryGetContext: () => null },
			handlers: { metadata: null, apiManager: null },
			debug() {}
		});
		const dispatcher = versionManager.createDispatcher("auth");
		const customSym = Symbol.for("nodejs.util.inspect.custom");

		// Node's util.inspect reads the symbol installed directly on the dispatcher target.
		expect(inspect(dispatcher)).toBe("{ __versionDispatcher: 'auth', versions: [] }");
		// Explicit property access hits get-trap case 6 and must return the same fallback payload.
		expect(dispatcher[customSym]()).toEqual({ __versionDispatcher: "auth", versions: [] });
	});

	it("direct dispatcher fallback lists registered versions when registry exists but no wrapper is mounted", () => {
		const versionManager = new VersionManager({
			api: {},
			contextManager: { tryGetContext: () => null },
			handlers: {
				metadata: null,
				apiManager: { setValueAtPath() {} }
			},
			debug() {}
		});
		versionManager.registerVersion("auth", "v1", "module:v1", {}, true);
		const dispatcher = versionManager.createDispatcher("auth");
		const customSym = Symbol.for("nodejs.util.inspect.custom");

		// Registry has an entry, but slothlet.api does not have a mounted v1.auth wrapper,
		// so resolveVersionedWrapper() returns undefined and the fallback exposes versions.
		expect(inspect(dispatcher)).toBe("{ __versionDispatcher: 'auth', versions: [ 'v1' ] }");
		expect(dispatcher[customSym]()).toEqual({ __versionDispatcher: "auth", versions: ["v1"] });
	});
});
