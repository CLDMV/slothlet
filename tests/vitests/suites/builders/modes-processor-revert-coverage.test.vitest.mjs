/**
 *	@Project: @cldmv/slothlet
 *	@Filename: /tests/vitests/suites/builders/modes-processor-revert-coverage.test.vitest.mjs
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
 * @fileoverview Coverage for `ModesProcessor`'s skip/warn-rejected assignment branches on the C03
 * hoist path — the assign-REJECTED (`if (assigned)` false) branch and, for a non-function hoisted
 * value, the no-wrapper revert `else` branch of `#assignWithRoutineRevert` plus `#revertOwnershipEntry`.
 *
 * @description
 * `api_test_multi_default/notifications` is a Rule-5/C03 folder (email.mjs + sms.mjs default-export
 * `send`; helpers.mjs has NO default and exports `formatPhone` (a function) and `RETRY_LIMIT = 3` (a
 * non-function constant)). Composing it hoists both `formatPhone` and `RETRY_LIMIT` directly onto the
 * `notifications` namespace. Re-adding the same folder at the same mount under `collision: "skip"`
 * re-runs the hoist while those keys already exist, so each hoisted assign is REJECTED:
 *   - the rejected assign makes `#assignWithRoutineRevert` return falsy → the `if (…OneAssigned)` guard's
 *     false branch (a key is NOT recorded as newly-owned),
 *   - `RETRY_LIMIT` is a non-function, so its hoist branch constructs no wrapper (`shouldWrap &&
 *     typeof value === "function"` is false) → `#assignWithRoutineRevert`'s `constructedWrapper` stays
 *     null → the no-wrapper revert `else` runs (`revertRawEntry` + `#revertOwnershipEntry`), and since a
 *     prior ownership entry exists at that path, `#revertOwnershipEntry` takes its `restoreEntry` arm.
 *
 * @module tests/vitests/suites/builders/modes-processor-revert-coverage
 */

import { describe, it, expect, afterEach } from "vitest";
import slothlet from "@cldmv/slothlet";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
// The PARENT dir, so `notifications` is a non-root subfolder — C03 flatten-to-root only hoists a
// no-default file's exports into a subfolder namespace (it is deliberately skipped at the api root).
const MULTI_DEFAULT_DIR = path.resolve(__dirname, "../../../../api_tests/api_test_multi_default");

/** @type {any} */
let api;
afterEach(async () => {
	if (api?.slothlet?.shutdown) await api.slothlet.shutdown().catch(() => {});
	api = null;
});

describe.each(["eager", "lazy"])("modes-processor hoist skip-rejection revert (#366) — mode: %s", (mode) => {
	it("re-adding a C03 hoist folder under collision:skip rejects the colliding hoisted keys and reverts the non-function one cleanly", async () => {
		api = await slothlet({ base: MULTI_DEFAULT_DIR, mode, silent: true });

		// Baseline: helpers.mjs's exports were C03-hoisted onto the `notifications` subfolder namespace.
		// Trigger lazy materialization (no-op in eager) so the hoisted leaves exist before the re-add.
		await api.notifications.formatPhone("5555555555");
		expect(typeof api.notifications.formatPhone).toBe("function");
		expect(api.notifications.RETRY_LIMIT).toBe(3);

		// Re-add the SAME multi-default tree at root under collision:skip. The `notifications` subfolder
		// is re-processed → C03 hoist re-runs while formatPhone and RETRY_LIMIT already exist, so each
		// hoisted assign is skip-REJECTED. RETRY_LIMIT (a non-function) constructs no wrapper, exercising
		// #assignWithRoutineRevert's no-wrapper revert else-branch + #revertOwnershipEntry's restore arm.
		await api.slothlet.api.add("", MULTI_DEFAULT_DIR, { collision: "skip" });

		// The originals survive untouched (skip kept the existing values); nothing threw.
		expect(typeof api.notifications.formatPhone).toBe("function");
		expect(api.notifications.RETRY_LIMIT).toBe(3);
	});
});
