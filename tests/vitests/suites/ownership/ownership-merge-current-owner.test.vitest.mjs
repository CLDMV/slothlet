/**
 *	@Project: @cldmv/slothlet
 *	@Filename: /tests/vitests/suites/ownership/ownership-merge-current-owner.test.vitest.mjs
 *	@Date: 2026-09-10 05:55:16 -07:00 (1789044916)
 *	@Author: Shinrai <CLDMV>
 *	@Email: <Shinrai@users.noreply.github.com>
 *	-----
 *	@Last modified by: Shinrai <CLDMV> (Shinrai@users.noreply.github.com)
 *	@Last modified time: 2026-09-10 05:55:16 -07:00 (1789044916)
 *	-----
 *	@Copyright: Copyright (c) 2013-2026 Catalyzed Motivation Inc. All rights reserved.
 */

/**
 * @fileoverview Regression coverage (#365 finding 2): `OwnershipManager#register()` always
 * `push()`es a newly-allowed collision entry onto `pathToModule`'s stack, and
 * `getCurrentOwner()`/`getCurrentValue()`/`ownsPath()` all read `stack[stack.length - 1]` —
 * last-registered-wins. That's correct for `replace`/`merge-replace` (the incoming module DOES
 * win the real composed tree under those modes), but wrong for `merge`: `merge` mode's real tree
 * composition (`syncWrapper()`, api-manager.mjs) keeps the EXISTING (first) value at a colliding
 * leaf, not the incoming one — so ownership's "current owner" disagreed with the real, live api
 * surface for every `merge` collision. `getPathOwnership()`/`getPathHistory()` (the full stack)
 * are unaffected — this is specifically about which single entry counts as "current."
 * @module tests/vitests/suites/ownership/ownership-merge-current-owner
 */

import { describe, it, expect } from "vitest";
import { OwnershipManager } from "#handlers/ownership";
import { SlothletError, SlothletWarning } from "@cldmv/slothlet/errors";

/**
 * Minimal mock slothlet sufficient for OwnershipManager.
 * @returns {object} Mock slothlet object.
 */
function makeMock() {
	return {
		config: {},
		debug: () => {},
		SlothletError,
		SlothletWarning
	};
}

describe("OwnershipManager — merge mode current-owner tracking (#365)", () => {
	it("keeps the FIRST-registered (existing) module as current owner after a merge collision", () => {
		const ownership = new OwnershipManager(makeMock());
		const firstFn = function () {};
		const secondFn = function () {};

		ownership.register({ moduleID: "existing", apiPath: "sub.testFunc", value: firstFn, collisionMode: "merge" });
		ownership.register({ moduleID: "incoming", apiPath: "sub.testFunc", value: secondFn, collisionMode: "merge" });

		// merge mode keeps the EXISTING value on the real composed tree — ownership must agree.
		expect(ownership.getCurrentOwner("sub.testFunc").moduleID).toBe("existing");
		expect(ownership.getCurrentValue("sub.testFunc")).toBe(firstFn);
		expect(ownership.ownsPath("existing", "sub.testFunc")).toBe(true);
		expect(ownership.ownsPath("incoming", "sub.testFunc")).toBe(false);

		// The full stack must still record both contributors — merge doesn't discard the loser's
		// registration entirely, it just doesn't become "current."
		expect(ownership.getPathOwnership("sub.testFunc")).toEqual(new Set(["existing", "incoming"]));
	});

	it("keeps the existing module as current owner across multiple subsequent merge losers", () => {
		const ownership = new OwnershipManager(makeMock());
		const firstFn = function () {};

		ownership.register({ moduleID: "existing", apiPath: "sub.testFunc", value: firstFn, collisionMode: "merge" });
		ownership.register({ moduleID: "loserB", apiPath: "sub.testFunc", value: function () {}, collisionMode: "merge" });
		ownership.register({ moduleID: "loserC", apiPath: "sub.testFunc", value: function () {}, collisionMode: "merge" });

		expect(ownership.getCurrentOwner("sub.testFunc").moduleID).toBe("existing");
		expect(ownership.getCurrentValue("sub.testFunc")).toBe(firstFn);
		expect(ownership.getPathOwnership("sub.testFunc")).toEqual(new Set(["existing", "loserB", "loserC"]));
	});

	it("removing the existing (current) owner restores to the most recent merge loser, not the original", () => {
		// removePath()'s restore-to-previous-owner semantics read the position just below the
		// removed entry — merge's insertion order must stay consistent with that contract.
		const ownership = new OwnershipManager(makeMock());

		ownership.register({ moduleID: "existing", apiPath: "sub.testFunc", value: function () {}, collisionMode: "merge" });
		ownership.register({ moduleID: "loserB", apiPath: "sub.testFunc", value: function () {}, collisionMode: "merge" });

		const result = ownership.removePath("sub.testFunc", "existing");
		expect(result.action).toBe("restore");
		expect(result.restoreModuleId).toBe("loserB");
		expect(ownership.getCurrentOwner("sub.testFunc").moduleID).toBe("loserB");
	});

	it("replace mode still makes the incoming module the current owner (unchanged behavior)", () => {
		const ownership = new OwnershipManager(makeMock());
		const firstFn = function () {};
		const secondFn = function () {};

		ownership.register({ moduleID: "existing", apiPath: "sub.testFunc", value: firstFn, collisionMode: "replace" });
		ownership.register({ moduleID: "incoming", apiPath: "sub.testFunc", value: secondFn, collisionMode: "replace" });

		expect(ownership.getCurrentOwner("sub.testFunc").moduleID).toBe("incoming");
		expect(ownership.getCurrentValue("sub.testFunc")).toBe(secondFn);
	});

	it("merge-replace mode still makes the incoming module the current owner (unchanged behavior)", () => {
		const ownership = new OwnershipManager(makeMock());
		const firstFn = function () {};
		const secondFn = function () {};

		ownership.register({ moduleID: "existing", apiPath: "sub.testFunc", value: firstFn, collisionMode: "merge-replace" });
		ownership.register({ moduleID: "incoming", apiPath: "sub.testFunc", value: secondFn, collisionMode: "merge-replace" });

		expect(ownership.getCurrentOwner("sub.testFunc").moduleID).toBe("incoming");
		expect(ownership.getCurrentValue("sub.testFunc")).toBe(secondFn);
	});

	it("a later 'merge' registration for the same pair demotes it, correcting an earlier call's wrong 'replace' guess (#372)", () => {
		// Mirrors the generic impl:created subscriber (slothlet.mjs), which has no visibility into
		// a per-call override and registers every construction with the instance's DEFAULT
		// collision mode first — here, wrongly assuming "replace" when the real, per-call mode is
		// "merge". The caller's own correctly-collisionMode-aware registration (modes-processor.mjs)
		// arrives second, for the SAME (moduleID, apiPath) pair, carrying the real mode.
		const ownership = new OwnershipManager(makeMock());
		const existingFn = function () {};
		const incomingFn = function () {};

		ownership.register({ moduleID: "existing", apiPath: "sub.testFunc", value: existingFn, collisionMode: "merge" });
		ownership.register({ moduleID: "incoming", apiPath: "sub.testFunc", value: incomingFn, collisionMode: "replace" });
		expect(ownership.getCurrentOwner("sub.testFunc").moduleID, "wrong assumption briefly wins").toBe("incoming");

		ownership.register({ moduleID: "incoming", apiPath: "sub.testFunc", value: incomingFn, collisionMode: "merge" });

		expect(ownership.getCurrentOwner("sub.testFunc").moduleID, "corrected once the real mode is known").toBe("existing");
		expect(ownership.getCurrentValue("sub.testFunc")).toBe(existingFn);
	});

	it("an administrative re-touch (registerSubtree) never demotes an already-correct 'replace' winner (#372)", () => {
		// registerSubtree()'s own recursive "confirm this moduleID still owns this subtree" walk
		// always re-registers with a hardcoded "merge" label, regardless of the real collision mode
		// that actually decided this entry's position — it must never be trusted to flip a
		// genuinely-decided winner into a "loser" just because it happens to run after the real,
		// authoritative registration (the naive first attempt at #372 regressed exactly this case).
		const ownership = new OwnershipManager(makeMock());
		const coreValue = { doSomething: function () {} };
		const winnerValue = { doSomething: function () {} };

		ownership.register({ moduleID: "core", apiPath: "shop", value: coreValue, collisionMode: "replace" });
		ownership.register({ moduleID: "winner", apiPath: "shop", value: winnerValue, collisionMode: "replace" });
		expect(ownership.getCurrentOwner("shop").moduleID).toBe("winner");

		ownership.registerSubtree(winnerValue, "winner", "shop");

		expect(ownership.getCurrentOwner("shop").moduleID).toBe("winner");
		expect(ownership.getCurrentValue("shop")).toBe(winnerValue);
	});

	it("a merge loser stays suppressed after the module that beat it is later removed — interleaved collisionMode history (#372)", () => {
		// A → merge B (B loses to A) → replace C (C wins over A) → merge D (D loses to C). Removing
		// C must fall back to A, not resurrect D: D never beat A, it only ever lost to C.
		const ownership = new OwnershipManager(makeMock());
		const fnA = function () {};
		const fnB = function () {};
		const fnC = function () {};
		const fnD = function () {};

		ownership.register({ moduleID: "A", apiPath: "sub.testFunc", value: fnA, collisionMode: "merge" });
		ownership.register({ moduleID: "B", apiPath: "sub.testFunc", value: fnB, collisionMode: "merge" });
		ownership.register({ moduleID: "C", apiPath: "sub.testFunc", value: fnC, collisionMode: "replace" });
		ownership.register({ moduleID: "D", apiPath: "sub.testFunc", value: fnD, collisionMode: "merge" });

		expect(ownership.getCurrentOwner("sub.testFunc").moduleID).toBe("C");

		const result = ownership.removePath("sub.testFunc", "C");
		expect(result.action).toBe("restore");
		expect(result.restoreModuleId, "D lost its own merge collision to C, not to A — it can't win now").toBe("A");
		expect(ownership.getCurrentOwner("sub.testFunc").moduleID).toBe("A");
		expect(ownership.getCurrentValue("sub.testFunc")).toBe(fnA);
	});
});
