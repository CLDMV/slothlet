/**
 *	@Project: @cldmv/slothlet
 *	@Filename: /tests/vitests/suites/runtime/runtime-livebindings.test.vitest.mjs
 *	@Date: 2026-02-23 00:00:00 -08:00
 *	@Author: Nate Hyson <CLDMV>
 *	@Email: <Shinrai@users.noreply.github.com>
 *	-----
 *	@Last modified by: Nate Hyson <CLDMV> (Shinrai@users.noreply.github.com)
 *	@Last modified time: 2026-02-23 00:00:00 -08:00
 *	-----
 *	@Copyright: Copyright (c) 2013-2026 Catalyzed Motivation Inc. All rights reserved.
 */

/**
 * @fileoverview Direct proxy-trap coverage for runtime live bindings.
 * @module tests/vitests/suites/runtime/runtime-livebindings.test.vitest
 */

import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { self, context } from "@cldmv/slothlet/runtime/live";
import { liveRuntime } from "@cldmv/slothlet/factories/context";
import { withSuppressedSlothletErrorOutput } from "../../setup/vitest-helper.mjs";

/**
 * Reset the singleton live runtime state for deterministic tests.
 * @returns {void}
 */
function resetLiveRuntimeState() {
	liveRuntime.instances.clear();
	liveRuntime.currentInstanceID = null;
}

/**
 * Initialize a live runtime store and make it active.
 * @param {object} [storeOverrides={}] - Per-test store overrides.
 * @returns {object} Active store.
 */
function initializeActiveStore(storeOverrides = {}) {
	const instanceID = `live-${Date.now()}-${Math.random().toString(36).slice(2)}`;
	const store = liveRuntime.initialize(instanceID, {});
	store.self = {
		ping: "pong",
		call() {
			return "ok";
		}
	};
	store.context = { userId: 123, role: "admin" };
	Object.assign(store, storeOverrides);
	liveRuntime.currentInstanceID = instanceID;
	return store;
}

describe("runtime-livebindings", () => {
	beforeEach(() => {
		resetLiveRuntimeState();
	});

	afterEach(() => {
		resetLiveRuntimeState();
	});

	describe("self proxy", () => {
		it("reads properties and supports ownKeys/has/descriptor", () => {
			const store = initializeActiveStore();
			Object.defineProperty(store.self, "fixed", {
				value: 10,
				writable: false,
				configurable: false,
				enumerable: true
			});

			expect(self.ping).toBe("pong");
			expect("call" in self).toBe(true);
			expect(Reflect.ownKeys(self)).toContain("ping");

			const descriptor = Object.getOwnPropertyDescriptor(self, "fixed");
			expect(descriptor).toBeTruthy();
			expect(descriptor.configurable).toBe(true);
			expect(descriptor.value).toBe(10);
			expect(Object.getOwnPropertyDescriptor(self, "doesNotExist")).toBeUndefined();
		});

		it("returns empty proxy-introspection values when self is missing", () => {
			initializeActiveStore({ self: null });

			expect(Reflect.ownKeys(self)).toEqual([]);
			expect("ping" in self).toBe(false);
			expect(Object.getOwnPropertyDescriptor(self, "ping")).toBeUndefined();
		});

		it("throws RUNTIME_NO_ACTIVE_CONTEXT_SELF when store has no self object", async () => {
			initializeActiveStore({ self: null });

			await withSuppressedSlothletErrorOutput(async () => {
				expect(() => self.anyProperty).toThrow("RUNTIME_NO_ACTIVE_CONTEXT_SELF");
			});
		});
	});

	describe("context proxy", () => {
		it("reads and writes context values", () => {
			initializeActiveStore();

			expect(context.userId).toBe(123);
			context.traceId = "abc";
			expect(context.traceId).toBe("abc");
			expect("role" in context).toBe(true);
			expect(Reflect.ownKeys(context)).toContain("userId");
			const descriptor = Object.getOwnPropertyDescriptor(context, "role");
			expect(descriptor?.value).toBe("admin");
		});

		it("returns undefined/empty values when context object is missing", () => {
			initializeActiveStore({ context: null });

			expect(context.userId).toBeUndefined();
			expect("anything" in context).toBe(false);
			expect(Reflect.ownKeys(context)).toEqual([]);
			expect(Object.getOwnPropertyDescriptor(context, "userId")).toBeUndefined();
		});

		it("throws RUNTIME_NO_ACTIVE_CONTEXT_CONTEXT when setting without context object", async () => {
			initializeActiveStore({ context: null });

			await withSuppressedSlothletErrorOutput(async () => {
				expect(() => {
					context.newValue = 1;
				}).toThrow("RUNTIME_NO_ACTIVE_CONTEXT_CONTEXT");
			});
		});
	});
});
