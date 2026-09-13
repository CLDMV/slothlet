/**
 *	@Project: @cldmv/slothlet
 *	@Filename: /tests/vitests/suites/handlers/routine-manager-revert.test.vitest.mjs
 *	@Date: 2026-09-13 00:00:00 -07:00 (1789808400)
 *	@Author: Shinrai <CLDMV>
 *	@Email: <Shinrai@users.noreply.github.com>
 *	-----
 *	@Last modified by: Shinrai <CLDMV> (Shinrai@users.noreply.github.com)
 *	@Last modified time: 2026-09-13 00:00:00 -07:00 (1789808400)
 *	-----
 *	@Copyright: Copyright (c) 2013-2026 Catalyzed Motivation Inc. All rights reserved.
 */

/**
 * @fileoverview Unit tests for RoutineManager#revertSpeculativeState/#revertSpeculativeSubtree's
 * handling of an entry that was already DELETED (not just overwritten) before the revert runs (#372
 * review, suppressed finding on routine-manager.mjs).
 * @module tests/vitests/suites/handlers/routine-manager-revert
 */

import { describe, it, expect, afterEach, vi } from "vitest";
import slothlet from "@cldmv/slothlet";
import { RoutineManager } from "#handlers/routine-manager";
import { UnifiedWrapper, resolveWrapper } from "#handlers/unified-wrapper";
import { SlothletError } from "@cldmv/slothlet/errors";
import { TEST_DIRS } from "../../setup/vitest-helper.mjs";

function makeMock() {
	return {
		config: { routines: [{ name: "initialize", mode: "manual" }] },
		debug: () => {},
		SlothletError,
		SlothletWarning: class {},
		handlers: {}
	};
}

let _api = null;

afterEach(async () => {
	if (_api && typeof _api.shutdown === "function") {
		await _api.shutdown();
	}
	_api = null;
});

describe("RoutineManager — revert restores an entry deleted mid-candidate-build (#372 review)", () => {
	it("revertSpeculativeState restores a prior entry after onImplCreated's non-function branch deleted it", () => {
		const rm = new RoutineManager(makeMock());
		const priorFn = function priorFn() {};

		rm.onImplCreated({ apiPath: "thing.initialize", moduleID: "same-mod", wrapper: { __impl: priorFn } });
		const priorEntries = rm.snapshotRawEntries("same-mod");

		// A later re-touch of the SAME (apiPath, moduleID) with a non-function value deletes the
		// entry outright (onImplCreated's own guard) rather than overwriting it.
		rm.onImplCreated({ apiPath: "thing.initialize", moduleID: "same-mod", wrapper: { __impl: {} } });
		expect(rm.raw).toEqual([]);

		// Reverting to the pre-candidate state must restore the deleted entry, not just leave it gone
		// because it no longer exists to be found-and-updated.
		rm.revertSpeculativeState("same-mod", priorEntries);
		expect(rm.raw).toHaveLength(1);
		expect(rm.raw[0]).toMatchObject({ apiPath: "thing.initialize", moduleID: "same-mod" });
		expect(rm.raw[0].fn).toBe(priorFn);
	});

	it("revertSpeculativeSubtree restores a prior entry after onImplCreated's non-function branch deleted it", () => {
		const rm = new RoutineManager(makeMock());
		const priorFn = function priorFn() {};

		rm.onImplCreated({ apiPath: "thing.initialize", moduleID: "same-mod", wrapper: { __impl: priorFn } });
		const priorEntries = rm.snapshotRawEntries("same-mod");

		rm.onImplCreated({ apiPath: "thing.initialize", moduleID: "same-mod", wrapper: { __impl: {} } });
		expect(rm.raw).toEqual([]);

		// The candidate api-tree still has a (now non-function) value at this path for the walk.
		const candidateTree = { thing: { initialize: {} } };
		rm.revertSpeculativeSubtree(candidateTree, "same-mod", "", priorEntries);

		expect(rm.raw).toHaveLength(1);
		const entry = rm.raw.find((e) => e.apiPath === "thing.initialize");
		expect(entry?.fn).toBe(priorFn);
	});
});

describe("RoutineManager — revertSpeculativeState invalidates only the wrapper(s) IT speculatively captured (#372/#373 review, suppressed finding)", () => {
	it("invalidates a candidate's wrapper but leaves an untouched pre-existing one alone", async () => {
		_api = await slothlet({
			mode: "lazy",
			runtime: "async",
			hook: { enabled: false },
			base: TEST_DIRS.API_TEST
		});
		const slothletInst = resolveWrapper(_api.task).slothlet;
		const rm = new RoutineManager(makeMock());

		// A genuinely pre-existing contribution at a DIFFERENT path — registered, then snapshotted,
		// then never re-touched by the (about to be aborted) build attempt.
		const untouchedWrapper = new UnifiedWrapper(slothletInst, { mode: "eager", apiPath: "sub.untouched", initialImpl: function () {} });
		const untouchedSpy = vi.spyOn(untouchedWrapper, "___invalidate");
		rm.onImplCreated({
			apiPath: "sub.untouched",
			moduleID: "same-mod",
			impl: untouchedWrapper,
			wrapper: { __impl: untouchedWrapper.____slothletInternal.impl }
		});

		const priorEntries = rm.snapshotRawEntries("same-mod");

		// The now-aborted build's own candidate: a NEW wrapper at a path this module never
		// previously owned. impl:created's real flow fires with `impl: this` (the wrapper itself)
		// on its first of two per-construction emits — resolveWrapper() must recognize it from
		// there, not from the deliberately minimal `data.wrapper` shape.
		const candidateWrapper = new UnifiedWrapper(slothletInst, { mode: "eager", apiPath: "sub.thing", initialImpl: function () {} });
		const candidateSpy = vi.spyOn(candidateWrapper, "___invalidate");
		rm.onImplCreated({
			apiPath: "sub.thing",
			moduleID: "same-mod",
			impl: candidateWrapper,
			wrapper: { __impl: candidateWrapper.____slothletInternal.impl }
		});
		expect(rm.raw).toHaveLength(2);

		// The build this candidate belonged to fails for an unrelated reason — buildAPI()'s own
		// catch reverts routine-manager's speculative state for the whole module, with no concrete
		// api-tree reference left to walk (newApi was never assigned).
		rm.revertSpeculativeState("same-mod", priorEntries);

		expect(candidateSpy).toHaveBeenCalledTimes(1);
		expect(untouchedSpy).not.toHaveBeenCalled();
		expect(rm.raw).toEqual([{ apiPath: "sub.untouched", moduleID: "same-mod", fn: untouchedWrapper.____slothletInternal.impl }]);
	});
});

describe("RoutineManager — revert re-inserts a deleted entry at its ORIGINAL registration position, not the end (#372/#373 review, suppressed finding)", () => {
	function threeEntries(rm) {
		const fnA = function fnA() {};
		const fnB = function fnB() {};
		const fnC = function fnC() {};
		rm.onImplCreated({ apiPath: "a", moduleID: "mod", wrapper: { __impl: fnA } });
		rm.onImplCreated({ apiPath: "b", moduleID: "mod", wrapper: { __impl: fnB } });
		rm.onImplCreated({ apiPath: "c", moduleID: "mod", wrapper: { __impl: fnC } });
		return { fnA, fnB, fnC };
	}

	it("revertRawEntry", () => {
		const rm = new RoutineManager(makeMock());
		const { fnB } = threeEntries(rm);
		const priorEntry = rm.snapshotRawEntry("b", "mod");

		// A non-function re-touch deletes "b" outright (onImplCreated's own guard), not just overwrites it.
		rm.onImplCreated({ apiPath: "b", moduleID: "mod", wrapper: { __impl: {} } });
		expect(rm.raw.map((e) => e.apiPath)).toEqual(["a", "c"]);

		rm.revertRawEntry("b", "mod", priorEntry);

		// Must land back BETWEEN "a" and "c" — appending after "c" would change stackRoutines:
		// true's registration-order execution.
		expect(rm.raw.map((e) => e.apiPath)).toEqual(["a", "b", "c"]);
		expect(rm.raw[1].fn).toBe(fnB);
	});

	it("revertSpeculativeState", () => {
		const rm = new RoutineManager(makeMock());
		threeEntries(rm);
		const priorEntries = rm.snapshotRawEntries("mod");

		rm.onImplCreated({ apiPath: "b", moduleID: "mod", wrapper: { __impl: {} } });
		expect(rm.raw.map((e) => e.apiPath)).toEqual(["a", "c"]);

		rm.revertSpeculativeState("mod", priorEntries);

		expect(rm.raw.map((e) => e.apiPath)).toEqual(["a", "b", "c"]);
	});

	it("revertSpeculativeSubtree", () => {
		const rm = new RoutineManager(makeMock());
		const { fnA, fnC } = threeEntries(rm);
		const priorEntries = rm.snapshotRawEntries("mod");

		rm.onImplCreated({ apiPath: "b", moduleID: "mod", wrapper: { __impl: {} } });
		expect(rm.raw.map((e) => e.apiPath)).toEqual(["a", "c"]);

		const candidateTree = { a: fnA, b: {}, c: fnC };
		rm.revertSpeculativeSubtree(candidateTree, "mod", "", priorEntries);

		expect(rm.raw.map((e) => e.apiPath)).toEqual(["a", "b", "c"]);
	});
});

describe("RoutineManager — pruneModule invalidates each removed module's wrapper before dropping it (#372/#373 review, suppressed finding)", () => {
	it("calls ___invalidate() on the tracked wrapper, then drops it", async () => {
		// A merge-loser's wrapper is never the live api-tree property at its path — ownership's own
		// unregister()/removePath() has nothing to invalidate it via. Without this, a still-in-flight
		// backgroundMaterialize: true materialization on this detached wrapper can complete after the
		// prune and re-fire impl:changed, re-capturing the just-removed module into `raw`.
		_api = await slothlet({
			mode: "eager",
			runtime: "async",
			hook: { enabled: false },
			base: TEST_DIRS.API_TEST
		});
		const slothletInst = resolveWrapper(_api.task).slothlet;
		const rm = slothletInst.handlers.routineManager;

		const wrapper = new UnifiedWrapper(slothletInst, { mode: "eager", apiPath: "sub.thing", initialImpl: function () {} });
		const spy = vi.spyOn(wrapper, "___invalidate");
		rm.onImplCreated({
			apiPath: "sub.thing",
			moduleID: "prune-mod",
			impl: wrapper,
			wrapper: { __impl: wrapper.____slothletInternal.impl }
		});
		expect(rm.raw.some((e) => e.moduleID === "prune-mod")).toBe(true);

		rm.pruneModule("prune-mod");

		expect(spy).toHaveBeenCalledTimes(1);
		expect(rm.raw.some((e) => e.moduleID === "prune-mod")).toBe(false);
	});
});

describe("RoutineManager — pruneSubtree prunes descendant raw entries when a scoped removal deletes a whole subtree (#372/#373 review, suppressed finding)", () => {
	it("prunes the exact path and every descendant, leaving unrelated paths alone", () => {
		// The scoped api.remove(apiPath, moduleID) deletes the ENTIRE live subtree rooted at
		// apiPath, but impl:removed only ever fires for the exact property deleted — never for
		// descendants carried away with it. A nested routine capture like "auth.initialize" would
		// otherwise survive indefinitely in `raw` after removing "auth".
		const rm = new RoutineManager(makeMock());
		rm.onImplCreated({ apiPath: "auth", moduleID: "auth-mod", wrapper: { __impl: function () {} } });
		rm.onImplCreated({ apiPath: "auth.initialize", moduleID: "auth-mod", wrapper: { __impl: function () {} } });
		rm.onImplCreated({ apiPath: "authenticator", moduleID: "auth-mod", wrapper: { __impl: function () {} } });
		rm.onImplCreated({ apiPath: "other", moduleID: "auth-mod", wrapper: { __impl: function () {} } });

		rm.pruneSubtree("auth", "auth-mod");

		// "authenticator" must survive — it merely shares the "auth" PREFIX, not the subtree (no
		// "." boundary), so a naive string-prefix check would wrongly prune it too.
		expect(rm.raw.map((e) => e.apiPath).sort()).toEqual(["authenticator", "other"]);
	});
});
