/**
 *	@Project: @cldmv/slothlet
 *	@Filename: /tests/vitests/suites/runtime/runtime-dispatcher.test.vitest.mjs
 *	@Date: 2026-02-24 00:00:00 -08:00
 *	@Author: Nate Hyson <CLDMV>
 *	@Email: <Shinrai@users.noreply.github.com>
 *	-----
 *	@Last modified by: Nate Hyson <CLDMV> (Shinrai@users.noreply.github.com)
 *	@Last modified time: 2026-02-24 00:00:00 -08:00
 *	-----
 *	@Copyright: Copyright (c) 2013-2026 Catalyzed Motivation Inc. All rights reserved.
 */

/**
 * @fileoverview Coverage for the runtime.mjs dispatcher proxy traps.
 * Tests the public `@cldmv/slothlet/runtime` re-export layer that routes
 * `self`, `context`, and `instanceID` to either the async or live runtime.
 * @module tests/vitests/suites/runtime/runtime-dispatcher.test.vitest
 */

import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { self, context, instanceID } from "@cldmv/slothlet/runtime";
import { liveRuntime } from "@cldmv/slothlet/factories/context";

/**
 * Reset live runtime singleton state between tests.
 * @returns {void}
 */
function resetLiveRuntimeState() {
	liveRuntime.instances.clear();
	liveRuntime.currentInstanceID = null;
}

/**
 * Activate a live runtime store with known self/context values.
 * @param {object} [selfProps={}] - Properties to set on store.self.
 * @param {object} [contextProps={}] - Properties to set on store.context.
 * @returns {{ store: object, instanceID: string }} The active store and its ID.
 */
function activateLiveStore(selfProps = {}, contextProps = {}) {
	const id = `dispatcher-${Date.now()}-${Math.random().toString(36).slice(2)}`;
	const store = liveRuntime.initialize(id, {});
	store.self = { ping: "pong", greet() { return "hello"; }, ...selfProps };
	store.context = { userId: 42, role: "tester", ...contextProps };
	liveRuntime.currentInstanceID = id;
	return { store, instanceID: id };
}

describe("runtime-dispatcher (runtime.mjs proxy traps)", () => {
	beforeEach(() => {
		resetLiveRuntimeState();
	});

	afterEach(() => {
		resetLiveRuntimeState();
	});

	// -----------------------------------------------------------------------
	// Fallback path (line 48): no ALS and no live context → async runtime
	// -----------------------------------------------------------------------

	describe("fallback to async runtime when no context is active", () => {
		it("self.get throws RUNTIME_NO_ACTIVE_CONTEXT_SELF when no context is active", () => {
			// No live context and no ALS context — routes to asyncRuntimeModule.
			// The async module raises SlothletError, but the dispatcher's own
			// get trap (line 61-63) is still exercised on the way through.
			expect(() => self.anything).toThrow("RUNTIME_NO_ACTIVE_CONTEXT_SELF");
		});

		it("instanceID.get returns undefined when no context is active", () => {
			// Exercises the instanceID get trap (lines 128-129) via async fallback.
			// asyncRuntimeModule.instanceID is a Proxy; with no ALS ctx it returns undefined.
			const result = instanceID.someKey;
			expect(result).toBeUndefined();
		});

		it("instanceID.has returns boolean when no context is active", () => {
			// Exercises the instanceID has trap (lines 132-133) via async fallback.
			const result = "someKey" in instanceID;
			expect(typeof result).toBe("boolean");
		});
	});

	// -----------------------------------------------------------------------
	// self proxy traps with live context active
	// -----------------------------------------------------------------------

	describe("self proxy traps with live context", () => {
		beforeEach(() => {
			activateLiveStore();
		});

		it("get trap returns the correct value", () => {
			expect(self.ping).toBe("pong");
		});

		it("ownKeys trap returns known keys", () => {
			// Exercises lines 68-70: ownKeys() on self proxy
			const keys = Reflect.ownKeys(self);
			expect(keys).toContain("ping");
			expect(keys).toContain("greet");
		});

		it("has trap checks property existence", () => {
			// Exercises lines 72-74: has() on self proxy
			expect("ping" in self).toBe(true);
			expect("__definitely_missing__" in self).toBe(false);
		});

		it("getOwnPropertyDescriptor trap returns descriptor for existing property", () => {
			// Exercises lines 76-83 — the truthy branch of the descriptor check
			const desc = Object.getOwnPropertyDescriptor(self, "ping");
			expect(desc).toBeDefined();
			expect(desc.value).toBe("pong");
			// Dispatcher wraps it as configurable to avoid proxy invariant violations
			expect(desc.configurable).toBe(true);
		});

		it("getOwnPropertyDescriptor trap returns undefined for missing property", () => {
			// Exercises line 80 — the falsy branch (no descriptor found)
			const desc = Object.getOwnPropertyDescriptor(self, "__nonexistent_prop__");
			expect(desc).toBeUndefined();
		});
	});

	// -----------------------------------------------------------------------
	// context proxy traps with live context active
	// -----------------------------------------------------------------------

	describe("context proxy traps with live context", () => {
		beforeEach(() => {
			activateLiveStore();
		});

		it("get trap returns context value", () => {
			expect(context.userId).toBe(42);
		});

		it("ownKeys trap returns context keys", () => {
			// Exercises lines 102-104: ownKeys() on context proxy
			const keys = Reflect.ownKeys(context);
			expect(keys).toContain("userId");
			expect(keys).toContain("role");
		});

		it("has trap checks context property existence", () => {
			// Exercises lines 106-108: has() on context proxy
			expect("userId" in context).toBe(true);
			expect("__missing__" in context).toBe(false);
		});

		it("getOwnPropertyDescriptor trap returns descriptor for context property", () => {
			// Exercises lines 110-112: getOwnPropertyDescriptor() on context proxy
			const desc = Object.getOwnPropertyDescriptor(context, "role");
			expect(desc).toBeDefined();
			expect(desc.value).toBe("tester");
		});

		it("set trap writes value into the live context store", () => {
			// Exercises lines 113-115: set() on context proxy
			context.newKey = "injected";
			expect(context.newKey).toBe("injected");
		});
	});
});
