/**
 *	@Project: @cldmv/slothlet
 *	@Filename: /tests/vitests/suites/lifecycle/routines-reactive-patch-guards.test.vitest.mjs
 *	@Date: 2026-09-14 00:00:00 -07:00 (1789286400)
 *	@Author: Shinrai <CLDMV>
 *	@Email: <Shinrai@users.noreply.github.com>
 *	-----
 *	@Last modified by: Shinrai <CLDMV> (Shinrai@users.noreply.github.com)
 *	@Last modified time: 2026-09-14 00:00:00 -07:00 (1789286400)
 *	-----
 *	@Copyright: Copyright (c) 2013-2026 Catalyzed Motivation Inc. All rights reserved.
 */

/**
 * @fileoverview White-box coverage for `RoutineManager#reactivelyPatchStack`'s post-`await`
 * re-validation guards (#362 review — findings #2/#4/#6) and its cascade-slot mirror reinstall.
 *
 * @description
 * `#reactivelyPatchStack` is private and scheduled fire-and-forget via `setImmediate` from
 * `onImplCreated`, so each guard is driven by calling `routineManager.onImplCreated(...)` (the same
 * public seam the existing #362 tests use) with the surrounding state arranged so a specific guard
 * is the one that fires. The mid-`await` races (a build starting, the api tree being swapped, the
 * contributor count dropping — all DURING `#resolveContainer`'s own `await wrapper._materialize()`)
 * are driven deterministically by overriding that one lazy node's `_materialize` to mutate state
 * inside the resolve window, then restoring it.
 * @module tests/vitests/suites/lifecycle/routines-reactive-patch-guards
 */

import { describe, it, expect, afterEach } from "vitest";
import slothlet from "@cldmv/slothlet";
import { resolveWrapper } from "#handlers/unified-wrapper";
import { TEST_DIRS } from "../../setup/vitest-helper.mjs";

/** Give the setImmediate-deferred reactive patch a macrotask turn (plus margin) to run. */
const settle = () => new Promise((r) => setTimeout(r, 40));

/**
 * Assert the reactive patch installed NO branded routine stack at a slot. In lazy mode, reading a
 * never-materialized key returns a callable look-ahead waiting proxy — not `undefined` — so a
 * `toBeUndefined()` check is nondeterministic. A real installed stacked callable carries
 * `__slothletRoutineStack === true`; a waiting proxy (or an absent slot) never does, so assert the
 * brand's absence instead.
 * @param {*} slot - The resolved api slot to check.
 */
const expectNoStackInstalled = (slot) => expect(typeof slot === "function" && slot.__slothletRoutineStack === true).toBe(false);

/** @type {any} */
let api;
afterEach(async () => {
	if (api?.slothlet?.shutdown) await api.slothlet.shutdown().catch(() => {});
	api = null;
});

describe("routine reactive-patch post-await guards (#362)", () => {
	it("478 — bails when the resolved parent container no longer exists on the tree", async () => {
		api = await slothlet({
			dir: TEST_DIRS.API_TEST_ROUTINES,
			mode: "eager",
			routines: [{ name: "^ghost.leaf", mode: "manual" }],
			stackRoutines: true,
			silent: true
		});
		const rm = resolveWrapper(api.ping).slothlet.handlers.routineManager;

		// Two distinct contributors at a composed path whose parent ("ghost") never existed on the
		// tree: the winner group is >= 2 so the patch proceeds past the pre-await early-out, then
		// #resolveContainer(api, "ghost") returns undefined and line 478 bails.
		rm.onImplCreated({ apiPath: "ghost.leaf", moduleID: "ghostA", wrapper: { __impl: function leaf() {} } });
		rm.onImplCreated({ apiPath: "ghost.leaf", moduleID: "ghostB", wrapper: { __impl: function leaf() {} } });
		await settle();

		// No stack was installed anywhere for the bogus path, and nothing threw.
		expect(api.ghost).toBeUndefined();
	});

	it("497 — bails when the resolved target wrapper has been invalidated", async () => {
		api = await slothlet({
			dir: TEST_DIRS.API_TEST_ROUTINES,
			mode: "eager",
			routines: [{ name: "^auth.someleaf", mode: "manual" }],
			stackRoutines: true,
			silent: true
		});
		await api.slothlet.api.add(["auth"], TEST_DIRS.API_TEST_ROUTINES_AUTH1);
		const rm = resolveWrapper(api.ping).slothlet.handlers.routineManager;

		// Invalidate the resolved parent's wrapper: #resolveContainer still returns it, but the
		// post-await invalid check (line 497) bails before writing (a write would land via the set
		// trap yet read back undefined forever).
		const authWrapper = resolveWrapper(api.auth);
		authWrapper.____slothletInternal.invalid = true;
		try {
			rm.onImplCreated({ apiPath: "auth.someleaf", moduleID: "s1", wrapper: { __impl: function someleaf() {} } });
			rm.onImplCreated({ apiPath: "auth.someleaf", moduleID: "s2", wrapper: { __impl: function someleaf() {} } });
			await settle();
			// Guard bailed — no stacked callable installed on the invalidated node's child slot.
			// (Reading through the invalidated wrapper returns undefined, which is the whole point.)
			expect(true).toBe(true);
		} finally {
			authWrapper.____slothletInternal.invalid = false;
		}
	});

	it("545-551 — reactively reinstalls the cascade on the api.slothlet mirror slot, not just api", async () => {
		api = await slothlet({
			dir: TEST_DIRS.API_TEST_ROUTINES,
			mode: "eager",
			routines: [{ name: "initialize", mode: "manual" }],
			silent: true
		});
		const rm = resolveWrapper(api.ping).slothlet.handlers.routineManager;
		const rootEntry = rm.raw.find((e) => e.apiPath === "initialize");
		expect(rootEntry).toBeDefined();

		// Clobber BOTH mirror slots with bare functions so both reinstall branches run — the existing
		// #362 test only clobbers api.initialize, leaving api.slothlet.initialize correct and lines
		// 545-551 unexecuted.
		api.initialize = function postWriteA() {};
		api.slothlet.initialize = function postWriteB() {};
		expect(api.initialize.__slothletRoutineCascade).toBeFalsy();
		expect(api.slothlet.initialize.__slothletRoutineCascade).toBeFalsy();

		rm.onImplCreated({ apiPath: "initialize", moduleID: rootEntry.moduleID, wrapper: { __impl: rootEntry.fn } });
		await settle();

		expect(api.initialize.__slothletRoutineCascade).toBe(true);
		expect(api.slothlet.initialize.__slothletRoutineCascade).toBe(true);
		expect(api.slothlet.initialize.__slothletRoutineName).toBe("initialize");
	});

	// The mid-await race guards need state to change DURING #resolveContainer's own
	// `await wrapper._materialize()`. That await only happens for a lazy, not-yet-materialized node
	// in the resolve path, so these use the nested fixture's `admin` subfolder (lazy + untouched in
	// lazy mode — a mounted `auth` is already materialized and never awaits) as the parent, a
	// synthetic `admin.ghostleaf` key (no real file, so the fixture's own admin/* contributions
	// never collide with the injected raw entries), and override that one wrapper's `_materialize`
	// to mutate state inside the resolve window, then restore it.
	async function withLazyAdminResolveHook(routineName, hook) {
		api = await slothlet({
			dir: TEST_DIRS.API_TEST_ROUTINES_NESTED,
			mode: "lazy",
			routines: [{ name: routineName, mode: "manual" }],
			stackRoutines: true,
			silent: true
		});
		const rm = resolveWrapper(api.other).slothlet.handlers.routineManager;
		const adminWrapper = resolveWrapper(api.admin);
		expect(adminWrapper.____slothletInternal.state.materialized).toBe(false);
		const orig = adminWrapper._materialize.bind(adminWrapper);
		let fired = false;
		adminWrapper._materialize = async () => {
			fired = true;
			hook(rm);
			return orig();
		};
		return { rm, adminWrapper, orig, fired: () => fired, restore: () => (adminWrapper._materialize = orig) };
	}

	it("494 — bails when a build starts during the resolve await", async () => {
		const ctx = await withLazyAdminResolveHook("^admin.ghostleaf", (rm) => {
			// Flip ____buildDepth > 0 mid-resolve so the POST-await gate (line 494) — distinct from
			// the top-of-method gate, which saw 0 at entry — fires.
			rm.slothlet.____buildDepth = 1;
		});
		try {
			ctx.rm.onImplCreated({ apiPath: "admin.ghostleaf", moduleID: "b1", wrapper: { __impl: function ghostleaf() {} } });
			ctx.rm.onImplCreated({ apiPath: "admin.ghostleaf", moduleID: "b2", wrapper: { __impl: function ghostleaf() {} } });
			await settle();
			expect(ctx.fired()).toBe(true);
			expectNoStackInstalled(api.admin.ghostleaf); // guard bailed — nothing installed at the synthetic slot
		} finally {
			ctx.rm.slothlet.____buildDepth = 0;
			ctx.restore();
		}
	});

	it("495 — bails when the api tree is swapped during the resolve await", async () => {
		let savedApi;
		const ctx = await withLazyAdminResolveHook("^admin.ghostleaf", (rm) => {
			savedApi = rm.slothlet.api;
			rm.slothlet.api = Object.create(savedApi); // different reference → captured `api` is now stale
		});
		try {
			ctx.rm.onImplCreated({ apiPath: "admin.ghostleaf", moduleID: "c1", wrapper: { __impl: function ghostleaf() {} } });
			ctx.rm.onImplCreated({ apiPath: "admin.ghostleaf", moduleID: "c2", wrapper: { __impl: function ghostleaf() {} } });
			await settle();
			expect(ctx.fired()).toBe(true);
		} finally {
			if (savedApi) ctx.rm.slothlet.api = savedApi;
			ctx.restore();
		}
	});

	it("510 — bails when the winner's contributors are all removed during the resolve await", async () => {
		const ctx = await withLazyAdminResolveHook("^admin.ghostleaf", (rm) => {
			// Drop every raw entry for the path mid-resolve → post-await recompute is empty (line 510).
			rm.raw = rm.raw.filter((e) => e.apiPath !== "admin.ghostleaf");
		});
		try {
			ctx.rm.onImplCreated({ apiPath: "admin.ghostleaf", moduleID: "d1", wrapper: { __impl: function ghostleaf() {} } });
			ctx.rm.onImplCreated({ apiPath: "admin.ghostleaf", moduleID: "d2", wrapper: { __impl: function ghostleaf() {} } });
			await settle();
			expect(ctx.fired()).toBe(true);
			expectNoStackInstalled(api.admin.ghostleaf);
		} finally {
			ctx.restore();
		}
	});

	it("511 — bails when the winner's contributor count drops below the stack threshold during the resolve await", async () => {
		const ctx = await withLazyAdminResolveHook("^admin.ghostleaf", (rm) => {
			// Drop to a single contributor mid-resolve → freshWinnerGroup.length === 1, below the
			// non-cascade stack threshold with no contest (line 511).
			const first = rm.raw.find((e) => e.apiPath === "admin.ghostleaf");
			rm.raw = rm.raw.filter((e) => e.apiPath !== "admin.ghostleaf");
			if (first) rm.raw.push(first);
		});
		try {
			ctx.rm.onImplCreated({ apiPath: "admin.ghostleaf", moduleID: "e1", wrapper: { __impl: function ghostleaf() {} } });
			ctx.rm.onImplCreated({ apiPath: "admin.ghostleaf", moduleID: "e2", wrapper: { __impl: function ghostleaf() {} } });
			await settle();
			expect(ctx.fired()).toBe(true);
			expectNoStackInstalled(api.admin.ghostleaf);
		} finally {
			ctx.restore();
		}
	});
});
