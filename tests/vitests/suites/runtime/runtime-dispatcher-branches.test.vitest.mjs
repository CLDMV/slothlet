/**
 *	@Project: @cldmv/slothlet
 *	@Filename: /tests/vitests/suites/runtime/runtime-dispatcher-branches.test.vitest.mjs
 *	@Date: 2026-02-27T06:19:24-08:00 (1772201964)
 *	@Author: Nate Corcoran <CLDMV>
 *	@Email: <Shinrai@users.noreply.github.com>
 *	-----
 *	@Last modified by: Nate Corcoran <CLDMV> (Shinrai@users.noreply.github.com)
 *	@Last modified time: 2026-03-01 20:21:55 -08:00 (1772425315)
 *	-----
 *	@Copyright: Copyright (c) 2013-2026 Catalyzed Motivation Inc. All rights reserved.
 */

/**
 * @fileoverview Coverage tests for runtime.mjs dispatcher proxy traps that are not exercised
 * by the existing runtime suite.
 *
 * @description
 * The dispatcher module (`@cldmv/slothlet/runtime`) re-exports `self`, `context`, and
 * `instanceID` as Proxy objects that delegate to either the async or live runtime based on
 * which context is active.  The existing tests import directly from the sub-modules
 * (`runtime/live`, `runtime/async`), bypassing the dispatcher proxy entirely.
 *
 * Uncovered dispatcher paths targeted here:
 *
 * - Line 48:  `getCurrentRuntime` default return — fires when NEITHER async nor live context
 *             is active; delegates to asyncRuntimeModule which then throws.
 * - Lines 64-66: `self.ownKeys()` trap — `Reflect.ownKeys(self)` inside live context.
 * - Lines 68-70: `self.has()` trap — `"prop" in self` inside live context.
 * - Lines 72-80: `self.getOwnPropertyDescriptor()` trap — `Object.getOwnPropertyDescriptor`
 *               returning `undefined` (missing prop) inside live context.
 * - Lines 103-104: `context.has()` trap — `"prop" in context` inside live context.
 * - Lines 111-113: `context.set()` trap — `context.prop = value` inside live context.
 * - Lines 128-129: `instanceID.get()` trap — `instanceID.someKey` outside context (falsy path).
 * - Lines 132-133: `instanceID.has()` trap — `"someKey" in instanceID` outside context.
 *
 * @module tests/vitests/suites/runtime/runtime-dispatcher-branches.test.vitest
 */

import { describe, it, expect, beforeEach, afterEach } from "vitest";
// Import from the DISPATCHER module (not the live/async sub-modules)
import { self, context, instanceID } from "@cldmv/slothlet/runtime";
import { liveRuntime } from "@cldmv/slothlet/factories/context";
import { withSuppressedSlothletErrorOutput } from "../../setup/vitest-helper.mjs";

// ─── Live runtime helpers ─────────────────────────────────────────────────────

/**
 * Reset all live runtime state for test isolation.
 * @returns {void}
 */
function resetLiveRuntimeState() {
	liveRuntime.instances.clear();
	liveRuntime.currentInstanceID = null;
}

/**
 * Create and activate a live runtime store with a pre-populated self/context.
 * @param {object} [overrides={}] - Optional store field overrides.
 * @returns {object} Active store.
 */
function activateLiveStore(overrides = {}) {
	const id = `disp-${Date.now()}-${Math.random().toString(36).slice(2)}`;
	const store = liveRuntime.initialize(id, {});
	store.self = { ping: "pong", fixed: 42 };
	store.context = { userId: 7, role: "admin" };
	Object.assign(store, overrides);
	liveRuntime.currentInstanceID = id;
	return store;
}

// ─── Line 48: getCurrentRuntime default return (no context) ──────────────────

describe("runtime dispatcher — getCurrentRuntime default return (line 48)", () => {
	beforeEach(resetLiveRuntimeState);
	afterEach(resetLiveRuntimeState);

	it("throws when self.prop is accessed outside all runtime contexts (line 48)", async () => {
		// No async or live context active → getCurrentRuntime() hits line 48 →
		// delegates to asyncRuntimeModule which throws RUNTIME_NO_ACTIVE_CONTEXT_SELF.
		await withSuppressedSlothletErrorOutput(async () => {
			expect(() => self.ping).toThrow();
		});
	});
});

// ─── Lines 64-66: self.ownKeys trap ──────────────────────────────────────────

describe("runtime dispatcher — self ownKeys trap via live context (lines 64-66)", () => {
	beforeEach(resetLiveRuntimeState);
	afterEach(resetLiveRuntimeState);

	it("Reflect.ownKeys(self) returns self property names in live context (lines 64-66)", () => {
		activateLiveStore();
		const keys = Reflect.ownKeys(self);
		expect(keys).toContain("ping");
		expect(keys).toContain("fixed");
	});

	it("Reflect.ownKeys(self) returns empty array when store.self is empty in live context", () => {
		activateLiveStore({ self: {} });
		expect(Reflect.ownKeys(self)).toEqual([]);
	});
});

// ─── Lines 68-70: self.has trap ──────────────────────────────────────────────

describe("runtime dispatcher — self has trap via live context (lines 68-70)", () => {
	beforeEach(resetLiveRuntimeState);
	afterEach(resetLiveRuntimeState);

	it("'ping' in self returns true for existing property in live context (lines 68-70)", () => {
		activateLiveStore();
		expect("ping" in self).toBe(true);
	});

	it("'missing' in self returns false for absent property in live context (lines 68-70)", () => {
		activateLiveStore();
		expect("missing" in self).toBe(false);
	});
});

// ─── Lines 72-80: self.getOwnPropertyDescriptor trap ─────────────────────────

describe("runtime dispatcher — self getOwnPropertyDescriptor trap via live context (lines 72-80)", () => {
	beforeEach(resetLiveRuntimeState);
	afterEach(resetLiveRuntimeState);

	it("returns undefined for a non-existent property descriptor in live context (line 80)", () => {
		activateLiveStore();
		// line 80: desc is undefined → return undefined
		expect(Object.getOwnPropertyDescriptor(self, "doesNotExist")).toBeUndefined();
	});

	it("returns a configurable descriptor for an existing property in live context (lines 77-79)", () => {
		activateLiveStore();
		const desc = Object.getOwnPropertyDescriptor(self, "ping");
		expect(desc).toBeDefined();
		expect(desc.configurable).toBe(true);
	});
});

// ─── Lines 103-104: context.has trap ─────────────────────────────────────────

describe("runtime dispatcher — context has trap via live context (lines 103-104)", () => {
	beforeEach(resetLiveRuntimeState);
	afterEach(resetLiveRuntimeState);

	it("'userId' in context returns true for existing prop in live context (lines 103-104)", () => {
		activateLiveStore();
		expect("userId" in context).toBe(true);
	});

	it("'missing' in context returns false for absent prop in live context (lines 103-104)", () => {
		activateLiveStore();
		expect("missing" in context).toBe(false);
	});
});

// ─── Lines 111-113: context.set trap ─────────────────────────────────────────

describe("runtime dispatcher — context set trap via live context (lines 111-113)", () => {
	beforeEach(resetLiveRuntimeState);
	afterEach(resetLiveRuntimeState);

	it("assigns a property via context[key]=value in live context (lines 111-113)", () => {
		const store = activateLiveStore();
		// context.set trap fires; value is written to runtime.context[prop]
		context.newKey = "newValue";
		expect(store.context.newKey).toBe("newValue");
	});
});

// ─── Lines 128-129: instanceID.get trap ──────────────────────────────────────

describe("runtime dispatcher — instanceID get trap (lines 128-129)", () => {
	beforeEach(resetLiveRuntimeState);
	afterEach(resetLiveRuntimeState);

	it("instanceID.someKey returns undefined outside context (lines 128-129, falsy branch)", () => {
		// No context active → runtime = asyncRuntimeModule → runtime.instanceID = undefined
		// ternary falsy branch fires → returns undefined
		const val = instanceID.someKey;
		expect(val).toBeUndefined();
	});
});

// ─── Lines 132-133: instanceID.has trap ──────────────────────────────────────

describe("runtime dispatcher — instanceID has trap (lines 132-133)", () => {
	beforeEach(resetLiveRuntimeState);
	afterEach(resetLiveRuntimeState);

	it("'someKey' in instanceID returns false outside context (lines 132-133, falsy branch)", () => {
		// No context active → runtime.instanceID = undefined → returns false
		expect("someKey" in instanceID).toBe(false);
	});
});
