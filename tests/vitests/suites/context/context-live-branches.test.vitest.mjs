/**
 *      @Project: @cldmv/slothlet
 *      @Filename: /tests/vitests/suites/context/context-live-branches.test.vitest.mjs
 *      @Date: 2026-07-20T00:00:00-07:00 (1753056000)
 *      @Author: Nate Hyson <CLDMV>
 *      @Email: <Shinrai@users.noreply.github.com>
 *      -----
 *      @Last modified by: Nate Hyson <CLDMV> (Shinrai@users.noreply.github.com)
 *      @Last modified time: 2026-07-20 00:00:00 -07:00 (1753056000)
 *      -----
 *      @Copyright: Copyright (c) 2013-2026 Catalyzed Motivation Inc. All rights reserved.
 */

/**
 * @fileoverview Coverage tests for LiveContextManager error branches (lines 142, 147, 168, 181).
 *
 * @description
 * Covers four code paths that are not exercised by the existing integration test suite.
 * Where a path can be triggered through the public slothlet runtime API, it uses that
 * interface. Only lines 147 and 181 require direct instantiation because they depend on
 * internal state corruption that cannot be created through any public API.
 *
 * ### Test strategy per line
 *
 * - **Line 142** — `getContext()` throws `NO_ACTIVE_CONTEXT_LIVE` when no instance is active:
 *   Triggered by importing `@cldmv/slothlet/runtime/live` (public export) and accessing
 *   `self.anything` outside any live slothlet context.  The `self` proxy's `get` trap calls
 *   `liveRuntime.getContext()` directly, which hits line 142.
 *
 * - **Line 168** — `tryGetContext()` returns `undefined` when `currentInstanceID` is null:
 *   Triggered by importing `@cldmv/slothlet/runtime` (the dispatcher module, public export)
 *   and accessing `self.anything` outside any context.  `getCurrentRuntime()` calls
 *   `liveRuntime.tryGetContext()` — when `currentInstanceID` is null, that returns
 *   `undefined` at line 168, after which the async fallback runtime is returned (and that
 *   module's `self.get` trap throws the familiar RUNTIME_NO_ACTIVE_CONTEXT_SELF error).
 *
 * - **Line 147** — `getContext()` throws `CONTEXT_NOT_FOUND` when `currentInstanceID` names
 *   an ID absent from `this.instances`: Only reachable by directly deleting a Map entry
 *   while leaving `currentInstanceID` set.  No public API can produce this state.
 *   Direct instantiation is used with an explanatory comment.
 *
 * - **Line 181** — `cleanup()` throws `CONTEXT_NOT_FOUND` for an unknown instanceID:
 *   Only reachable by calling `cleanup()` on an ID that was never registered.  The public
 *   `api.shutdown()` path always uses a known ID and succeeds; there is no public API
 *   that delegates cleanup for an arbitrary unknown ID.  Direct instantiation is used.
 *
 * @module tests/vitests/suites/context/context-live-branches.test.vitest
 */

import { describe, it, expect } from "vitest";
import { LiveContextManager } from "@cldmv/slothlet/handlers/context-live";
import { SlothletError } from "@cldmv/slothlet/errors";

// ─── line 142: getContext() throws NO_ACTIVE_CONTEXT_LIVE ────────────────────
// Approach: use @cldmv/slothlet/runtime/live (public export).
// The `self` proxy's `get` trap calls liveRuntime.getContext() directly.
// When no live instance is active, getContext() throws at line 142.

describe("LiveContextManager.getContext — throws NO_ACTIVE_CONTEXT_LIVE via runtime/live (line 142)", () => {
	it("accessing self.anything from runtime/live outside context throws SlothletError", async () => {
		// Import the public live runtime — its self proxy calls liveRuntime.getContext()
		// directly. Without an active live slothlet instance the call throws line 142.
		const { self: liveself } = await import("@cldmv/slothlet/runtime/live");

		expect(() => liveself.someMethod).toThrow(SlothletError);
	});

	it("error code contains NO_ACTIVE_CONTEXT_LIVE", async () => {
		const { self: liveself } = await import("@cldmv/slothlet/runtime/live");

		expect(() => liveself.anything).toThrow(/NO_ACTIVE_CONTEXT_LIVE/);
	});

	it("multiple properties all throw the same error", async () => {
		const { self: liveself } = await import("@cldmv/slothlet/runtime/live");

		expect(() => liveself.a).toThrow(SlothletError);
		expect(() => liveself.b).toThrow(SlothletError);
		expect(() => liveself.c).toThrow(SlothletError);
	});
});

// ─── line 168: tryGetContext() returns undefined via runtime dispatcher ───────
// Approach: use @cldmv/slothlet/runtime (the dispatcher, public export).
// getCurrentRuntime() checks asyncRuntime.tryGetContext() first (returns null because
// we are outside any ALS scope), then calls liveRuntime.tryGetContext().
// Since the default slothlet config uses runtime:"async", liveRuntime.currentInstanceID
// is ALWAYS null outside of API function calls, so tryGetContext() returns undefined
// at line 168 every time we access the dispatcher outside a running slothlet chain.
// Note: existing tests that exercise "outside-context" errors import from
// @cldmv/slothlet/runtime/async directly, bypassing getCurrentRuntime() altogether.
// This test file is the only one that covers the dispatcher path.

describe("LiveContextManager.tryGetContext — returns undefined via runtime dispatcher (line 168)", () => {
	it("accessing self from the runtime dispatcher outside context triggers tryGetContext → undefined (line 168)", async () => {
		// No slothlet instance needed: asyncRuntime.tryGetContext() is null outside ALS scope,
		// so getCurrentRuntime() proceeds to liveRuntime.tryGetContext() → line 168,
		// returns asyncRuntimeModule, whose self.get throws RUNTIME_NO_ACTIVE_CONTEXT_SELF.
		const { self: dispatchedSelf } = await import("@cldmv/slothlet/runtime");

		expect(() => dispatchedSelf.anything).toThrow();
	});

	it("accessing context from the runtime dispatcher outside context also triggers line 168", async () => {
		const { context: dispatchedContext } = await import("@cldmv/slothlet/runtime");

		// context.prop outside context returns undefined rather than throwing — the ALS
		// fallback silently returns undefined.  The important thing for coverage is that
		// getCurrentRuntime() was called, which exercises line 168.
		const result = dispatchedContext.anything;
		expect(result).toBeUndefined();
	});

	it("does not throw for context.prop access via dispatcher (line 168, silent async fallback)", async () => {
		const { context: dispatchedContext } = await import("@cldmv/slothlet/runtime");

		expect(() => dispatchedContext.user).not.toThrow();
	});
});

// ─── line 147: getContext() throws CONTEXT_NOT_FOUND (direct instantiation) ──
// Justification: requires `currentInstanceID` set to an ID not in `this.instances`.
// This is a corrupted-state scenario: the public `api.shutdown()` path always uses
// a known ID and removes it cleanly.  No public API creates this inconsistency.

describe("LiveContextManager.getContext — throws CONTEXT_NOT_FOUND when store missing (line 147) [direct]", () => {
	it("throws when currentInstanceID points to a deleted Map entry", () => {
		const cm = new LiveContextManager();
		cm.initialize("inst-orphan");

		// Forcibly remove from instances while keeping currentInstanceID set.
		// This state cannot be produced through any public slothlet API.
		cm.instances.delete("inst-orphan");
		expect(cm.currentInstanceID).toBe("inst-orphan");

		expect(() => cm.getContext()).toThrow(SlothletError);
	});

	it("error code is CONTEXT_NOT_FOUND on orphaned ID", () => {
		const cm = new LiveContextManager();
		cm.initialize("inst-gone");
		cm.instances.delete("inst-gone");

		expect(() => cm.getContext()).toThrow(/CONTEXT_NOT_FOUND/);
	});
});

// ─── line 181: cleanup() throws CONTEXT_NOT_FOUND (direct instantiation) ──────
// Justification: slothlet's public `api.shutdown()` always calls cleanup() with the
// registered instanceID.  There is no public API that delegates cleanup for an arbitrary
// unknown ID, making this branch unreachable without direct instantiation.

describe("LiveContextManager.cleanup — throws CONTEXT_NOT_FOUND for unknown instanceID (line 181) [direct]", () => {
	it("throws when instanceID was never registered", () => {
		const cm = new LiveContextManager();

		expect(() => cm.cleanup("never-existed")).toThrow(SlothletError);
	});

	it("error code is CONTEXT_NOT_FOUND on unknown ID", () => {
		const cm = new LiveContextManager();

		expect(() => cm.cleanup("ghost-instance")).toThrow(/CONTEXT_NOT_FOUND/);
	});

	it("throws when cleanup is called twice for the same instanceID", () => {
		const cm = new LiveContextManager();
		cm.initialize("inst-c");
		cm.cleanup("inst-c"); // first cleanup: Map entry removed

		// Second cleanup: the entry is gone → line 181 fires
		expect(() => cm.cleanup("inst-c")).toThrow(SlothletError);
	});
});
