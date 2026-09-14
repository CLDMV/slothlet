/**
 *	@Project: @cldmv/slothlet
 *	@Filename: /tests/vitests/suites/builders/modes-processor-revert-gaps.test.vitest.mjs
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
 * @fileoverview Coverage for the remaining `ModesProcessor` raw-value revert gaps that
 * `modes-processor-revert-coverage.test.vitest.mjs`'s own C03 scenario doesn't reach:
 * `#assignWithRoutineRevert`'s no-wrapper `else` branch (constructedWrapper === null) and
 * both arms of the `#revertOwnershipEntry` helper it calls, plus the "not assigned" false
 * arm on both the C03 hoist path and the addApi/category-merge path.
 *
 * @description
 * `api_test_multi_default_ownership_revert/notifications` is a Rule-5/C03 multi-default
 * folder (email.mjs + sms.mjs default-export `send`; helperA.mjs/helperB.mjs have NO
 * default and each export a RAW, non-function `shared` named export, with helperA.mjs
 * additionally exporting a RAW `constructor`). Loading it under `collision: { initial:
 * "skip" }` reaches two genuinely distinct revert outcomes inside ONE build, without any
 * re-add — every internal collision in this file happens within a SINGLE `buildAPI()` call
 * (a fresh, empty root object each time), so every conflicting pair shares the same
 * moduleID; a later candidate can only ever collide with an earlier one from the SAME
 * build:
 *   - `shared`: helperA.mjs and helperB.mjs both hoist a key named `shared`. Whichever the
 *     loader processes second collides with the other's already-registered ownership
 *     entry (registered the moment the first one's hoist succeeded) — its rejected hoist
 *     reverts via `#revertOwnershipEntry`'s `restoreEntry` arm (a genuine prior entry
 *     exists). This is order-independent: whichever file loses is the one that exercises
 *     the arm.
 *   - `constructor`: `notifications` is composed as a UnifiedWrapper namespace proxy, and
 *     that proxy's own `constructor` trap answers `Object.prototype.constructor` for an
 *     ordinary framework-built namespace (see `unified-wrapper.mjs`) — so
 *     `targetApi.constructor` reads as already "existing" from the moment the namespace
 *     wrapper is created, before any candidate ever attempts it, and NO ownership entry is
 *     ever registered at that exact path (nothing ever succeeds there). helperA.mjs's
 *     hoist of `constructor` is therefore always rejected and always reverts via
 *     `#revertOwnershipEntry`'s `removePath` arm (no prior entry to restore).
 *
 * Both keys are RAW (non-function) values, so their hoist constructs no `UnifiedWrapper`
 * (`shouldWrap && typeof value === "function"` is false) — `#assignWithRoutineRevert`'s
 * `constructedWrapper` stays `null`, taking the no-wrapper `else` branch on rejection
 * (`revertRawEntry` + `#revertOwnershipEntry`) instead of the wrapper-subtree walk the
 * existing C03 coverage test's `RETRY_LIMIT` scenario was intended to reach but — per the
 * option-name check in the companion file's docstring — never actually rejected under.
 *
 * The identical `constructor`-collides-with-the-namespace-proxy's-own-trap mechanism is
 * reused on `api_test_multi_default_ownership_revert/plugins/addapi.mjs` (a default-export-
 * only addApi file: Rule 11/C33) to cover the addApi/category-merge path's own "not
 * assigned" false arm (`modes_addapiOneAssigned`) alongside the C03 hoist path's identical
 * arm (`modes_hoistedOneAssigned`).
 *
 * @module tests/vitests/suites/builders/modes-processor-revert-gaps
 */

import { describe, it, expect, afterEach } from "vitest";
import slothlet from "@cldmv/slothlet";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const OWNERSHIP_REVERT_DIR = path.resolve(__dirname, "../../../../api_tests/api_test_multi_default_ownership_revert");

/** @type {any} */
let api;
afterEach(async () => {
	if (api?.slothlet?.shutdown) await api.slothlet.shutdown().catch(() => {});
	api = null;
});

describe.each(["eager", "lazy"])("modes-processor raw-value revert gaps (#366/#372) — mode: %s", (mode) => {
	it("hoisting two sibling no-default files' colliding raw `shared` export under collision:skip reverts the loser via #revertOwnershipEntry's restoreEntry arm", async () => {
		api = await slothlet({ base: OWNERSHIP_REVERT_DIR, mode, silent: true, collision: { initial: "skip" } });

		// Trigger lazy materialization (no-op in eager) so both hoisted/addapi namespaces exist.
		if (typeof api.notifications.email === "function") await api.notifications.email("a@x");
		await api.plugins;

		// One of the two files' `shared` value won (first to hoist); the loser was rejected and
		// reverted, but the winner's value survives untouched either way.
		expect(["helperA-value", "helperB-value"]).toContain(api.notifications.shared);
	});

	it("hoisting a raw `constructor` export under collision:skip always collides with the namespace proxy's own inherited constructor and reverts via #revertOwnershipEntry's removePath arm", async () => {
		api = await slothlet({ base: OWNERSHIP_REVERT_DIR, mode, silent: true, collision: { initial: "skip" } });

		if (typeof api.notifications.email === "function") await api.notifications.email("a@x");
		await api.plugins;

		// The rejected raw candidate never lands; the namespace keeps its normal, inherited
		// constructor instead of the fixture's string, on BOTH the C03 hoist path and the
		// addApi/category-merge path.
		expect(api.notifications.constructor).toBe(Object.prototype.constructor);
		expect(api.notifications.constructor).not.toBe("not-a-function");
		expect(Object.keys(api.notifications)).not.toContain("constructor");

		expect(api.plugins.constructor).toBe(Object.prototype.constructor);
		expect(api.plugins.constructor).not.toBe("not-a-function");
		expect(Object.keys(api.plugins)).not.toContain("constructor");
	});

	it("a non-colliding hoisted/addApi-merged key still assigns and registers ownership normally alongside its rejected sibling", async () => {
		api = await slothlet({ base: OWNERSHIP_REVERT_DIR, mode, silent: true, collision: { initial: "skip" } });

		if (typeof api.notifications.email === "function") await api.notifications.email("a@x");
		await api.plugins;

		// email/sms (the multi-default siblings) and the addApi file's non-colliding `greeting`
		// all assigned successfully — the rejections above are scoped to their own keys only.
		expect(typeof api.notifications.email).toBe("function");
		expect(typeof api.notifications.sms).toBe("function");
		expect(api.plugins.greeting).toBe("hello");
	});
});
