/**
 *	@Project: @cldmv/slothlet
 *	@Filename: /tests/vitests/suites/lifecycle/routines-stack-flag.test.vitest.mjs
 *	@Date: 2026-09-10 06:14:28 -07:00 (1789046068)
 *	@Author: Shinrai <CLDMV>
 *	@Email: <Shinrai@users.noreply.github.com>
 *	-----
 *	@Last modified by: Shinrai <CLDMV> (Shinrai@users.noreply.github.com)
 *	@Last modified time: 2026-09-10 06:14:28 -07:00 (1789046068)
 *	-----
 *	@Copyright: Copyright (c) 2013-2026 Catalyzed Motivation Inc. All rights reserved.
 */

/**
 * @fileoverview Regression coverage (#365 finding 3, corrected): whether two modules colliding at
 * the exact same routine-matched api path both run is governed by the new, independent
 * `stackRoutines` boolean — NOT by `collisionMode`. Before this, ANY collision (merge, replace,
 * whatever) always stacked every raw-captured contributor regardless of what the real composed
 * tree actually kept, which is wrong: nothing before #341 ever stacked functions at a shared api
 * path, and #341 should not have made that automatic/implicit in `collisionMode`'s side effects.
 * `stackRoutines` defaults to `false` (like `autoRoutines`, a deliberate opt-in) — a module that
 * lost a collision (under ANY collisionMode) must not still run via the routine system unless
 * `stackRoutines: true` is explicitly set, and that setting is honored uniformly, independent of
 * which collisionMode produced the winner.
 * @module tests/vitests/suites/lifecycle/routines-stack-flag
 */

import { describe, it, expect, beforeEach } from "vitest";
import slothlet from "@cldmv/slothlet";
import { TEST_DIRS } from "../../setup/vitest-helper.mjs";

describe.each(["eager", "lazy"])("stackRoutines (#365) — mode: %s", (mode) => {
	beforeEach(() => {
		globalThis.__slothletRoutineLog = [];
	});

	describe("default (stackRoutines omitted, false)", () => {
		it("a merge collision at the same api path runs only the surviving (existing) contributor", async () => {
			const api = await slothlet({ dir: TEST_DIRS.API_TEST_ROUTINES, mode, autoRoutines: true, silent: true });
			try {
				globalThis.__slothletRoutineLog = [];
				await api.slothlet.api.add(["auth"], TEST_DIRS.API_TEST_ROUTINES_AUTH1);
				await api.slothlet.api.add(["auth"], TEST_DIRS.API_TEST_ROUTINES_AUTH2); // default collisionMode: merge

				await api.auth.initialize();
				expect(globalThis.__slothletRoutineLog).toEqual(["auth1:initialize"]);
			} finally {
				await api.slothlet.shutdown();
			}
		});

		it("a replace collision at the same api path runs only the winning (incoming) contributor", async () => {
			const api = await slothlet({ dir: TEST_DIRS.API_TEST_ROUTINES, mode, autoRoutines: true, silent: true });
			try {
				globalThis.__slothletRoutineLog = [];
				await api.slothlet.api.add(["auth"], TEST_DIRS.API_TEST_ROUTINES_AUTH1);
				await api.slothlet.api.add(["auth"], TEST_DIRS.API_TEST_ROUTINES_AUTH2, {
					forceOverwrite: true,
					moduleID: "auth2-forced"
				});

				await api.auth.initialize();
				expect(globalThis.__slothletRoutineLog).toEqual(["auth2:initialize"]);
			} finally {
				await api.slothlet.shutdown();
			}
		});

		it("the root cascade also only reflects the surviving contributor at a collided path", async () => {
			const api = await slothlet({ dir: TEST_DIRS.API_TEST_ROUTINES, mode, autoRoutines: true, silent: true });
			try {
				globalThis.__slothletRoutineLog = [];
				await api.slothlet.api.add(["auth"], TEST_DIRS.API_TEST_ROUTINES_AUTH1);
				await api.slothlet.api.add(["auth"], TEST_DIRS.API_TEST_ROUTINES_AUTH2);

				globalThis.__slothletRoutineLog = [];
				await api.initialize();
				// The root cascade also re-runs the base mount's own top-level initialize.mjs — that's
				// unrelated to the "auth" collision this test is about.
				expect(globalThis.__slothletRoutineLog).toEqual(["root:initialize", "auth1:initialize"]);
			} finally {
				await api.slothlet.shutdown();
			}
		});
	});

	describe("stackRoutines: true", () => {
		it("a merge collision at the same api path stacks both contributors, in mount order", async () => {
			const api = await slothlet({ dir: TEST_DIRS.API_TEST_ROUTINES, mode, autoRoutines: true, stackRoutines: true, silent: true });
			try {
				globalThis.__slothletRoutineLog = [];
				await api.slothlet.api.add(["auth"], TEST_DIRS.API_TEST_ROUTINES_AUTH1);
				await api.slothlet.api.add(["auth"], TEST_DIRS.API_TEST_ROUTINES_AUTH2);

				expect(api.auth.initialize.__slothletRoutineStack).toBe(true);
				await api.auth.initialize();
				expect(globalThis.__slothletRoutineLog).toEqual(["auth1:initialize", "auth2:initialize"]);
			} finally {
				await api.slothlet.shutdown();
			}
		});

		it("a replace collision at the same api path ALSO stacks both contributors — stacking is independent of collisionMode", async () => {
			const api = await slothlet({ dir: TEST_DIRS.API_TEST_ROUTINES, mode, autoRoutines: true, stackRoutines: true, silent: true });
			try {
				globalThis.__slothletRoutineLog = [];
				await api.slothlet.api.add(["auth"], TEST_DIRS.API_TEST_ROUTINES_AUTH1);
				await api.slothlet.api.add(["auth"], TEST_DIRS.API_TEST_ROUTINES_AUTH2, {
					forceOverwrite: true,
					moduleID: "auth2-forced"
				});

				await api.auth.initialize();
				expect(globalThis.__slothletRoutineLog).toEqual(["auth1:initialize", "auth2:initialize"]);
			} finally {
				await api.slothlet.shutdown();
			}
		});

		it("a removed merge-loser's raw contribution stops running — stale raw entries don't survive api.remove() (#372)", async () => {
			const api = await slothlet({ dir: TEST_DIRS.API_TEST_ROUTINES, mode, autoRoutines: true, stackRoutines: true, silent: true });
			try {
				globalThis.__slothletRoutineLog = [];
				await api.slothlet.api.add(["auth"], TEST_DIRS.API_TEST_ROUTINES_AUTH1);
				// Default collision.api is "merge" — auth2 loses the collision and is never the live
				// property at "auth", but its raw contribution still stacks under stackRoutines.
				const idB = await api.slothlet.api.add(["auth"], TEST_DIRS.API_TEST_ROUTINES_AUTH2);

				await api.auth.initialize();
				expect(globalThis.__slothletRoutineLog).toEqual(["auth1:initialize", "auth2:initialize"]);

				// Removing the merge-loser resolves as an ownership "restore" (the live tree already
				// showed auth1's value, unchanged) rather than a "delete" — impl:removed never fires
				// for auth2's own entry, so its raw contribution must be pruned some other way.
				await api.slothlet.api.remove(idB);

				globalThis.__slothletRoutineLog = [];
				await api.auth.initialize();
				expect(globalThis.__slothletRoutineLog).toEqual(["auth1:initialize"]);
			} finally {
				await api.slothlet.shutdown();
			}
		});

		it("a skip-rejected add's raw-captured contribution does not run — the module was never mounted (#372/#373)", async () => {
			const api = await slothlet({
				dir: TEST_DIRS.API_TEST_ROUTINES,
				mode,
				autoRoutines: true,
				stackRoutines: true,
				collision: { api: "skip" },
				silent: true
			});
			try {
				globalThis.__slothletRoutineLog = [];
				await api.slothlet.api.add(["auth"], TEST_DIRS.API_TEST_ROUTINES_AUTH1);
				// Rejected outright under skip — auth2's whole subtree, including its raw-captured
				// "initialize", must never have existed as far as the routine system is concerned,
				// even though stackRoutines bypasses ownership filtering entirely.
				await api.slothlet.api.add(["auth"], TEST_DIRS.API_TEST_ROUTINES_AUTH2);

				await api.auth.initialize();
				expect(globalThis.__slothletRoutineLog).toEqual(["auth1:initialize"]);
			} finally {
				await api.slothlet.shutdown();
			}
		});
	});
});
