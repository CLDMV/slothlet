/**
 *	@Project: @cldmv/slothlet
 *	@Filename: /tests/vitests/suites/api-manager/api-manager-lazy-collision-materialization.test.vitest.mjs
 *	@Date: 2026-09-09 19:03:16 -07:00 (1789005796)
 *	@Author: Shinrai <CLDMV>
 *	@Email: <Shinrai@users.noreply.github.com>
 *	-----
 *	@Last modified by: Shinrai <CLDMV> (Shinrai@users.noreply.github.com)
 *	@Last modified time: 2026-09-09 19:03:16 -07:00 (1789005796)
 *	-----
 *	@Copyright: Copyright (c) 2013-2026 Catalyzed Motivation Inc. All rights reserved.
 */

/**
 * @fileoverview Regression coverage: `syncWrapper()` (api-manager.mjs) decides whether a colliding
 * child key already exists on the EXISTING side via `Object.prototype.hasOwnProperty.call(existingWrapper, key)`,
 * reading `Object.keys(existingWrapper)` — which, for a lazy-mode wrapper that has never been touched,
 * reflects only what's been materialized SO FAR, not the full key set the wrapper would eventually
 * expose. An `api.slothlet.api.add()` collision against an untouched lazy sibling therefore takes the
 * "key doesn't exist yet" fast path and installs the new value directly via `Object.defineProperty`,
 * WITHOUT ever reading/materializing the existing module — so the existing module's own file is never
 * even loaded, its lifecycle events never fire, and (for "merge" mode specifically) its documented
 * "keep existing" contract is silently violated. This is a core lazy-mode correctness defect,
 * independent of the stackable-routines feature (#341) that originally surfaced it.
 * @module tests/vitests/suites/api-manager/api-manager-lazy-collision-materialization
 */

process.env.SLOTHLET_INTERNAL_TEST_MODE = "true";

import path from "node:path";
import { describe, it, expect, afterEach } from "vitest";
import slothlet from "@cldmv/slothlet";
import { resolveWrapper } from "#handlers/unified-wrapper";
import { TEST_DIRS, suppressSlothletDebugOutput } from "../../setup/vitest-helper.mjs";

// LAZYBASE mounted as the instance's own `base` keeps sub-content genuinely lazy: "sub" (the
// mount's own top level) is eager, but "sub.testFunc" — one level deeper — stays an unmaterialized
// waiting proxy until individually touched. dir1/dir2's bare top-level `testFunc.mjs` does NOT work
// for this: a mount's own top level is always eager, and anything mounted via
// `api.slothlet.api.add()` is always eager regardless of the instance's overall mode — so the
// COLLIDING side (added via `add()`) is fine as dir2, but the EXISTING side must come from the
// initial lazy base scan, one level below its own mount top, to stay genuinely unmaterialized.
const LAZYBASE = path.join(TEST_DIRS.API_TEST_COLLISIONS, "lazybase"); // sub/testFunc() => "from-lazybase-sub"
const DIR2 = path.join(TEST_DIRS.API_TEST_COLLISIONS, "dir2"); // testFunc() => "from-dir2"
// sub/sub.mjs: self-named single-file folder, so "sub" itself materializes to a callable impl
// (smart-flatten case 2 hoist) rather than a namespace containing a child.
const LAZYFUNCBASE = path.join(TEST_DIRS.API_TEST_COLLISIONS, "lazyfuncbase");
// sub/sub.mjs: self-named single-file folder whose default export is a legitimate `null` value,
// so "sub" itself materializes to `impl === null` — valid content, not an unmaterialized shell.
const LAZYNULLBASE = path.join(TEST_DIRS.API_TEST_COLLISIONS, "lazynullbase");

describe("syncWrapper — lazy collision against an untouched existing wrapper", () => {
	let api;
	let restoreDebugOutput;

	afterEach(async () => {
		if (api?.shutdown) await api.shutdown();
		api = null;
		restoreDebugOutput?.();
		restoreDebugOutput = undefined;
	});

	it("merge mode keeps the existing module's leaf, and actually materializes it, even when it was never touched before the collision", async () => {
		restoreDebugOutput = suppressSlothletDebugOutput();
		api = await slothlet({ base: LAZYBASE, mode: "lazy", silent: true });

		// Never read `api.sub.testFunc` here — assert via "sub"'s own materialized state, the
		// reliable signal that nothing under it (including "testFunc") has been touched yet.
		expect(resolveWrapper(api.sub).____slothletInternal.state.materialized).toBe(false);

		await api.slothlet.api.add(["sub"], DIR2, { collisionMode: "merge" });

		// "merge" is documented as "keep existing, only add new keys" — the pre-existing lazybase
		// contribution must win, not be silently discarded in favor of dir2's.
		expect(await api.sub.testFunc()).toBe("from-lazybase-sub");
	});

	it("public impl:created fires once for the placed leaf in a collision, exposing the wrapped callable on `impl` (#398, #433)", async () => {
		restoreDebugOutput = suppressSlothletDebugOutput();
		api = await slothlet({ base: LAZYBASE, mode: "lazy", silent: true });

		expect(resolveWrapper(api.sub).____slothletInternal.state.materialized).toBe(false);

		const events = [];
		api.slothlet.lifecycle.on("impl:created", (d) => {
			if (d.apiPath === "sub.testFunc") events.push(d);
		});

		await api.slothlet.api.add(["sub"], DIR2, { collisionMode: "merge" });

		// Pre-#398 this fired TWICE — once per contributor, INCLUDING the merge-discarded one — and each
		// payload carried the raw unwrapped callable (the enforcement-bypassing leak). Now the PUBLIC
		// event fires once, for the leaf that actually holds the path (the current owner). #433: it exposes
		// the WRAPPED callable on a stable `impl` field (a function here) and no longer re-exposes the
		// reserved internal `wrapper.__impl` handle. (Which module owns a merge-collided leaf is ownership's
		// own concern, unchanged here — this asserts consistency with it, not a fixed id.)
		expect(events).toHaveLength(1);
		expect(typeof events[0].impl).toBe("function"); // the wrapped callable, on the stable public field
		expect(events[0].wrapper).toBeUndefined(); // internal handle no longer on the public event
		const owner = resolveWrapper(api.sub).slothlet.handlers.ownership.getCurrentOwner("sub.testFunc");
		expect(events[0].moduleID).toBe(owner.moduleID);
		// The surviving value still resolves correctly.
		expect(await api.sub.testFunc()).toBe("from-lazybase-sub");
	});

	it("keeps a callable-impl lazy wrapper marked materialized after the forced load, without double-counting it", async () => {
		restoreDebugOutput = suppressSlothletDebugOutput();
		api = await slothlet({ base: LAZYFUNCBASE, mode: "lazy", silent: true });

		// "sub" is a self-named single-file folder: once materialized, its own impl IS a function.
		expect(resolveWrapper(api.sub).____slothletInternal.state.materialized).toBe(false);
		const statsBefore = api.slothlet.materialize.get();

		// Force syncWrapper to materialize "sub" via a collision (replace mode swaps its content).
		await api.slothlet.api.add(["sub"], DIR2, { collisionMode: "replace" });

		// syncWrapper's own force-materialization legitimately completed "sub" — it must not be
		// reported back to unmaterialized just because its (now-superseded) impl was a function.
		expect(resolveWrapper(api.sub).____slothletInternal.state.materialized).toBe(true);

		// A wrapper that materializes exactly once must decrement the global unmaterialized count
		// exactly once — not twice (which would happen if state.materialized bounced back to false
		// and something re-triggered _materialize() on it later).
		const statsAfter = api.slothlet.materialize.get();
		expect(statsAfter.remaining).toBe(statsBefore.remaining - 1);
		expect(statsAfter.remaining).toBeGreaterThanOrEqual(0);
	});

	it("keeps a null-impl lazy wrapper marked materialized after the forced load, without double-counting it", async () => {
		restoreDebugOutput = suppressSlothletDebugOutput();
		api = await slothlet({ base: LAZYNULLBASE, mode: "lazy", silent: true });

		// "sub" is a self-named single-file folder: once materialized, its own impl IS `null` —
		// a legitimate exported value, not a signal that materialization never happened. Use
		// "merge" (not "replace") so the SURVIVING wrapper is "sub"'s own — merge only adds new
		// keys via Object.defineProperty, it never overwrites existingWrapper's own impl the way
		// "replace" does, so this is the mode that actually exercises existingWrapper's own
		// post-materialize impl value in the shared final-bookkeeping block below.
		expect(resolveWrapper(api.sub).____slothletInternal.state.materialized).toBe(false);
		const statsBefore = api.slothlet.materialize.get();

		await api.slothlet.api.add(["sub"], DIR2, { collisionMode: "merge" });

		// syncWrapper's own force-materialization legitimately completed "sub" — it must not be
		// reported back to unmaterialized just because its (now-superseded) impl was null.
		expect(resolveWrapper(api.sub).____slothletInternal.state.materialized).toBe(true);

		const statsAfter = api.slothlet.materialize.get();
		expect(statsAfter.remaining).toBe(statsBefore.remaining - 1);
		expect(statsAfter.remaining).toBeGreaterThanOrEqual(0);
	});
});
