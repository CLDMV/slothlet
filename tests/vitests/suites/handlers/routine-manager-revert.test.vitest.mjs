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

import { describe, it, expect } from "vitest";
import { RoutineManager } from "#handlers/routine-manager";
import { SlothletError } from "@cldmv/slothlet/errors";

function makeMock() {
	return {
		config: { routines: [{ name: "initialize", mode: "manual" }] },
		debug: () => {},
		SlothletError,
		SlothletWarning: class {},
		handlers: {}
	};
}

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
