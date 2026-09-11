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

	it("impl:created fires for the existing module's leaf as part of resolving the collision", async () => {
		restoreDebugOutput = suppressSlothletDebugOutput();
		api = await slothlet({ base: LAZYBASE, mode: "lazy", silent: true });

		expect(resolveWrapper(api.sub).____slothletInternal.state.materialized).toBe(false);

		const created = [];
		api.slothlet.lifecycle.on("impl:created", (d) => {
			if (d.apiPath === "sub.testFunc") created.push(d.moduleID);
		});

		await api.slothlet.api.add(["sub"], DIR2, { collisionMode: "merge" });

		// Both the pre-existing (lazybase) and incoming (dir2) modules' leaves must be observed as
		// part of resolving the collision — the existing one must not be silently skipped just
		// because it was never touched before. Two distinct contributing moduleIDs, not just "at
		// least one event fired" (which the incoming module alone would already satisfy).
		const distinctModuleIDs = new Set(created);
		expect(distinctModuleIDs.size).toBe(2);
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
});
