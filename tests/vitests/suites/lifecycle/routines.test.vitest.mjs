/**
 *	@Project: @cldmv/slothlet
 *	@Filename: /tests/vitests/suites/lifecycle/routines.test.vitest.mjs
 *	@Date: 2026-09-08 00:00:00 -07:00 (1788800000)
 *	@Author: Shinrai <CLDMV>
 *	@Email: <Shinrai@users.noreply.github.com>
 *	-----
 *	@Last modified by: Shinrai <CLDMV> (Shinrai@users.noreply.github.com)
 *	@Last modified time: 2026-09-08 00:00:00 -07:00 (1788800000)
 *	-----
 *	@Copyright: Copyright (c) 2013-2026 Catalyzed Motivation Inc. All rights reserved.
 */

/**
 * @fileoverview Coverage for issue #341 (stackable lifecycle routines), including the design
 * amendment documented at https://github.com/CLDMV/slothlet/issues/341#issuecomment-5586818260:
 * mount-relative name matching (bare / dotted / `recursive`), root-anchored (`^`) glob patterns,
 * the flat registration-order root cascade, per-path stacking, the `autoRoutines` v3-compat gate,
 * a throwing contributor's attributable error, double-registration dedup, and non-interference with
 * the legacy `collectLifecycleHooks` opt-in.
 * @module tests/vitests/suites/lifecycle/routines
 */

import { describe, it, expect, beforeEach } from "vitest";
import slothlet from "@cldmv/slothlet";
import { resolveWrapper } from "#handlers/unified-wrapper";
import { TEST_DIRS, withSuppressedSlothletErrorOutput } from "../../setup/vitest-helper.mjs";

describe.each(["eager", "lazy"])("routines (#341) — mode: %s", (mode) => {
	beforeEach(() => {
		globalThis.__slothletRoutineLog = [];
	});

	describe("bare mount-relative matching (default routines)", () => {
		it("mode: startup — the default `initialize` routine auto-runs once, as the final step of compose", async () => {
			const api = await slothlet({ dir: TEST_DIRS.API_TEST_ROUTINES, mode, autoRoutines: true, silent: true });
			try {
				expect(globalThis.__slothletRoutineLog).toEqual(["root:initialize"]);
				// Ordinary sibling leaves are unaffected.
				expect(await api.ping()).toBe("pong");
			} finally {
				await api.slothlet.shutdown();
			}
		});

		it("two independently-mounted modules sharing a mount point both run their contribution, in mount order", async () => {
			const api = await slothlet({ dir: TEST_DIRS.API_TEST_ROUTINES, mode, autoRoutines: true, silent: true });
			try {
				globalThis.__slothletRoutineLog = [];
				await api.slothlet.api.add(["auth"], TEST_DIRS.API_TEST_ROUTINES_AUTH1);
				await api.slothlet.api.add(["auth"], TEST_DIRS.API_TEST_ROUTINES_AUTH2);

				// Ordinary recursive-merge would have dropped auth2's contribution entirely (#341's
				// motivating problem) — the stacked callable must run BOTH, in mount order.
				expect(api.auth.initialize.__slothletRoutineStack).toBe(true);
				await api.auth.initialize();
				expect(globalThis.__slothletRoutineLog).toEqual(["auth1:initialize", "auth2:initialize"]);

				// Each contributor's own unrelated sibling leaf is still independently reachable.
				expect(await api.auth.login()).toBe("login1");
				expect(await api.auth.logout()).toBe("logout1");
			} finally {
				await api.slothlet.shutdown();
			}
		});

		it("a bare name does NOT match a nested leaf one level below the mount's own top level", async () => {
			const api = await slothlet({ dir: TEST_DIRS.API_TEST_ROUTINES_NESTED, mode, autoRoutines: true, silent: true });
			try {
				// Only the mount's own top-level initialize.mjs counts — admin/initialize.mjs does not,
				// even though its final segment is also "initialize".
				expect(globalThis.__slothletRoutineLog).toEqual(["nested:top:initialize"]);
				expect(await api.admin.initialize()).toBeUndefined(); // still directly callable, just not a routine contribution
				expect(globalThis.__slothletRoutineLog).toEqual(["nested:top:initialize", "nested:admin:initialize"]);
			} finally {
				await api.slothlet.shutdown();
			}
		});

		it("re-running api.slothlet.api.add() after initial compose re-derives the stack without re-firing startup", async () => {
			const api = await slothlet({ dir: TEST_DIRS.API_TEST_ROUTINES, mode, autoRoutines: true, silent: true });
			try {
				// Startup already fired during compose; mounting auth1/auth2 afterward must not re-fire it.
				globalThis.__slothletRoutineLog = [];
				await api.slothlet.api.add(["auth"], TEST_DIRS.API_TEST_ROUTINES_AUTH1);
				expect(globalThis.__slothletRoutineLog).toEqual([]);

				await api.slothlet.api.add(["auth"], TEST_DIRS.API_TEST_ROUTINES_AUTH2);
				expect(globalThis.__slothletRoutineLog).toEqual([]);

				// But the late-mounted contributors are reachable via the (re-derived) stacked callable.
				await api.auth.initialize();
				expect(globalThis.__slothletRoutineLog).toEqual(["auth1:initialize", "auth2:initialize"]);
			} finally {
				await api.slothlet.shutdown();
			}
		});

		it("a later mount at the same path that contributes nothing of its own does not double-register the earlier contributor", async () => {
			const api = await slothlet({ dir: TEST_DIRS.API_TEST_ROUTINES, mode, autoRoutines: true, silent: true });
			try {
				await api.slothlet.api.add(["auth"], TEST_DIRS.API_TEST_ROUTINES_AUTH1); // has its own "initialize"
				await api.slothlet.api.add(["auth"], TEST_DIRS.API_TEST_ROUTINES_MANUAL); // does NOT export "initialize"

				globalThis.__slothletRoutineLog = [];
				await api.auth.initialize();
				expect(globalThis.__slothletRoutineLog).toEqual(["auth1:initialize"]);
			} finally {
				await api.slothlet.shutdown();
			}
		});
	});

	describe("dotted mount-relative matching (recursive: false, default)", () => {
		it("a fixed relative path matches only that exact sub-path, not the mount's own top level", async () => {
			const api = await slothlet({
				dir: TEST_DIRS.API_TEST_ROUTINES_NESTED,
				mode,
				routines: [{ name: "admin.initialize", mode: "startup" }],
				autoRoutines: true,
				silent: true
			});
			try {
				expect(globalThis.__slothletRoutineLog).toEqual(["nested:admin:initialize"]);
			} finally {
				await api.slothlet.shutdown();
			}
		});

		it.skipIf(mode !== "lazy")(
			"materializing a fixed relative path under one mount never force-materializes an unrelated mount's own untouched subdirectory (lazy mode only)",
			async () => {
				const api = await slothlet({
					dir: TEST_DIRS.API_TEST_ROUTINES_SCOPED,
					mode,
					routines: [{ name: "admin.initialize", mode: "manual" }],
					silent: true
				});
				try {
					await api.slothlet.api.add(["mountB"], TEST_DIRS.API_TEST_ROUTINES_SCOPED_OTHER);

					await api.slothlet["admin.initialize"]();
					expect(globalThis.__slothletRoutineLog).toEqual(["scoped:admin:initialize"]);

					// First-ever property access of mountB.nested anywhere in this test: reading it
					// even once earlier (e.g. a "before" assertion) would itself trigger this node's
					// own lazy "waiting proxy" materialization and contaminate the very thing being
					// checked.
					expect(resolveWrapper(api.mountB.nested).____slothletInternal.state.materialized).toBe(false);
				} finally {
					await api.slothlet.shutdown();
				}
			}
		);

		it("a dotted name containing a glob metacharacter still matches (and force-materializes) a nested contributor", async () => {
			const api = await slothlet({
				dir: TEST_DIRS.API_TEST_ROUTINES_NESTED,
				mode,
				routines: [{ name: "*.initialize", mode: "manual" }],
				silent: true
			});
			try {
				globalThis.__slothletRoutineLog = [];
				await api.slothlet["*.initialize"]();
				// "*.initialize" is a glob (not a fixed literal path) — a plain literal segment-by-
				// segment walk can't step into a wildcard segment, so this only passes in lazy mode if
				// #materializeFor's wildcard-aware walk (#materializeGlobPath) enumerates the mount's
				// top-level children and descends into the ones the "*" segment matches. The mount's
				// own top-level "initialize" (no dot) must NOT match — the pattern requires a literal
				// "." before "initialize".
				expect(globalThis.__slothletRoutineLog).toEqual(["nested:admin:initialize"]);
			} finally {
				await api.slothlet.shutdown();
			}
		});

		it.skipIf(mode !== "lazy")(
			"a dotted name containing a single-level wildcard force-materializes only the matching branch, not an unrelated sibling subfolder (lazy mode only)",
			async () => {
				const api = await slothlet({
					dir: TEST_DIRS.API_TEST_ROUTINES_SCOPED,
					mode,
					routines: [{ name: "admin.*", mode: "manual" }],
					silent: true
				});
				try {
					await api.slothlet["admin.*"]();
					// "admin.other" also matches "admin.*" but returns a value rather than logging, so
					// only "admin.initialize"'s push shows up here.
					expect(globalThis.__slothletRoutineLog).toEqual(["scoped:admin:initialize"]);

					// First-ever touch of the unrelated "quiet" sibling subfolder anywhere in this
					// test — proves the wildcard walk enumerated only "admin" (the segment the pattern
					// actually names), never the mount's whole subtree.
					expect(resolveWrapper(api.quiet).____slothletInternal.state.materialized).toBe(false);
				} finally {
					await api.slothlet.shutdown();
				}
			}
		);

		it.skipIf(mode !== "lazy")(
			"a dotted name ending in ** force-materializes its own narrowed branch's entire subtree, never a sibling subtree (lazy mode only)",
			async () => {
				const api = await slothlet({
					dir: TEST_DIRS.API_TEST_ROUTINES_SCOPED,
					mode,
					routines: [{ name: "admin.**", mode: "manual" }],
					silent: true
				});
				try {
					await api.slothlet["admin.**"]();
					expect(globalThis.__slothletRoutineLog).toEqual(["scoped:admin:initialize"]);

					// "**" is unbounded, but only from where it's reached: it still narrows to "admin"
					// first via an ordinary literal step, so it correctly reaches arbitrary depth
					// WITHIN that branch...
					expect(resolveWrapper(api.admin.deep).____slothletInternal.state.materialized).toBe(true);

					// ...First-ever touch of the unrelated "quiet" sibling subfolder anywhere in this
					// test — proves "**" never re-walks from the mount's own root, only from "admin".
					expect(resolveWrapper(api.quiet).____slothletInternal.state.materialized).toBe(false);
				} finally {
					await api.slothlet.shutdown();
				}
			}
		);

		it.skipIf(mode !== "lazy")(
			"a brace-expanded dotted name only materializes its concrete alternatives, never an unrelated sibling (lazy mode only)",
			async () => {
				const api = await slothlet({
					dir: TEST_DIRS.API_TEST_ROUTINES_SCOPED,
					mode,
					// "ghost" doesn't exist under this mount — must not error, just contribute nothing.
					routines: [{ name: "{admin,ghost}.*", mode: "manual" }],
					silent: true
				});
				try {
					await api.slothlet["{admin,ghost}.*"]();
					expect(globalThis.__slothletRoutineLog).toEqual(["scoped:admin:initialize"]);

					// First-ever touch of the unrelated "quiet" sibling subfolder anywhere in this
					// test — proves brace expansion walked only its own concrete alternatives ("admin",
					// "ghost"), never fell back to the mount's whole subtree.
					expect(resolveWrapper(api.quiet).____slothletInternal.state.materialized).toBe(false);
				} finally {
					await api.slothlet.shutdown();
				}
			}
		);
	});

	describe("recursive mount-relative matching", () => {
		it("recursive: true finds the name at both the mount's own top level and nested within it", async () => {
			const api = await slothlet({
				dir: TEST_DIRS.API_TEST_ROUTINES_NESTED,
				mode,
				routines: [{ name: "initialize", mode: "startup", recursive: true }],
				autoRoutines: true,
				silent: true
			});
			try {
				expect(globalThis.__slothletRoutineLog).toContain("nested:top:initialize");
				expect(globalThis.__slothletRoutineLog).toContain("nested:admin:initialize");
				expect(globalThis.__slothletRoutineLog).toHaveLength(2);
			} finally {
				await api.slothlet.shutdown();
			}
		});
	});

	describe("root-anchored (^) glob matching", () => {
		it("^ext.*.initialize matches every plugin's own initialize under ext, across separate mounts", async () => {
			const api = await slothlet({
				dir: TEST_DIRS.API_TEST_ROUTINES,
				mode,
				routines: [{ name: "^ext.*.initialize", mode: "manual" }],
				silent: true
			});
			try {
				await api.slothlet.api.add(["ext", "pluginA"], TEST_DIRS.API_TEST_ROUTINES_AUTH1);
				await api.slothlet.api.add(["ext", "pluginB"], TEST_DIRS.API_TEST_ROUTINES_AUTH2);

				globalThis.__slothletRoutineLog = [];
				// Non-bare routine names are reachable via bracket notation.
				await api.slothlet["^ext.*.initialize"]();
				expect(globalThis.__slothletRoutineLog).toContain("auth1:initialize");
				expect(globalThis.__slothletRoutineLog).toContain("auth2:initialize");
				expect(globalThis.__slothletRoutineLog).toHaveLength(2);
			} finally {
				await api.slothlet.shutdown();
			}
		});
	});

	describe("flat registration-order cascade across distinct mount points", () => {
		it("the root cascade runs every mount's own contribution, not just one shared path", async () => {
			const api = await slothlet({ dir: TEST_DIRS.API_TEST_ROUTINES, mode, silent: true });
			try {
				await api.slothlet.api.add(["auth"], TEST_DIRS.API_TEST_ROUTINES_AUTH1);
				await api.slothlet.api.add(["billing"], TEST_DIRS.API_TEST_ROUTINES_AUTH2);

				globalThis.__slothletRoutineLog = [];
				await api.slothlet.initialize();
				expect(globalThis.__slothletRoutineLog).toEqual(["root:initialize", "auth1:initialize", "auth2:initialize"]);

				// The bare top-level alias is the identical cascade.
				globalThis.__slothletRoutineLog = [];
				await api.initialize();
				expect(globalThis.__slothletRoutineLog).toEqual(["root:initialize", "auth1:initialize", "auth2:initialize"]);
			} finally {
				await api.slothlet.shutdown();
			}
		});
	});

	describe("mode: shutdown", () => {
		it.each([
			["api.shutdown()", async (api) => api.shutdown()],
			["api.slothlet.shutdown()", async (api) => api.slothlet.shutdown()]
		])("%s runs every shutdown-mode contributor via the existing dispose path", async (____label, dispose) => {
			const api = await slothlet({ dir: TEST_DIRS.API_TEST_ROUTINES, mode, autoRoutines: true, silent: true });
			await api.slothlet.api.add(["auth"], TEST_DIRS.API_TEST_ROUTINES_AUTH1);
			await api.slothlet.api.add(["auth"], TEST_DIRS.API_TEST_ROUTINES_AUTH2);

			globalThis.__slothletRoutineLog = [];
			await dispose(api);
			expect(globalThis.__slothletRoutineLog).toEqual(["auth1:shutdown", "auth2:shutdown"]);
		});
	});

	describe("mode: destroy", () => {
		it("api.destroy() runs every destroy-mode contributor, and shutdown-mode routines still run too (destroy() calls the root shutdown() internally)", async () => {
			const api = await slothlet({
				dir: TEST_DIRS.API_TEST_ROUTINES,
				mode,
				routines: [...slothlet.defaults.routines, "destroy:destroy"],
				autoRoutines: true,
				silent: true
			});
			await api.slothlet.api.add(["auth"], TEST_DIRS.API_TEST_ROUTINES_AUTH1);
			await api.slothlet.api.add(["auth"], TEST_DIRS.API_TEST_ROUTINES_AUTH2);

			globalThis.__slothletRoutineLog = [];
			await api.destroy();

			expect(globalThis.__slothletRoutineLog).toContain("auth1:destroy");
			expect(globalThis.__slothletRoutineLog).toContain("auth2:destroy");
			// destroy() calls the root api.shutdown() as part of its own teardown — shutdown-mode
			// contributors run too, distinguishing "runs on destroy()" from "runs on destroy() only".
			expect(globalThis.__slothletRoutineLog).toContain("auth1:shutdown");
			expect(globalThis.__slothletRoutineLog).toContain("auth2:shutdown");
		});

		it("a plain api.shutdown() call does NOT run destroy-mode routines", async () => {
			const api = await slothlet({
				dir: TEST_DIRS.API_TEST_ROUTINES,
				mode,
				routines: [{ name: "destroy", mode: "destroy" }],
				autoRoutines: true,
				silent: true
			});
			await api.slothlet.api.add(["auth"], TEST_DIRS.API_TEST_ROUTINES_AUTH1);

			globalThis.__slothletRoutineLog = [];
			await api.shutdown();
			expect(globalThis.__slothletRoutineLog).not.toContain("auth1:destroy");
		});

		it("a shutdown-mode routine failure during destroy() does not abort destroy()'s own teardown (api keys still cleared)", async () => {
			// destroy() calls api.shutdown() internally, and api.shutdown() can itself throw a
			// deferred ROUTINE_FAILED aggregate for a mode: "shutdown" routine — that throw must not
			// skip destroy()'s own isDestroyed/key-clearing/api-nulling cleanup below it.
			const api = await slothlet({
				dir: TEST_DIRS.API_TEST_ROUTINES,
				mode,
				routines: [{ name: "initialize", mode: "shutdown" }],
				autoRoutines: true,
				silent: true
			});
			await api.slothlet.api.add(["bad"], TEST_DIRS.API_TEST_ROUTINES_BAD); // bad's "initialize" throws

			const keysBefore = Object.keys(api);
			expect(keysBefore.length).toBeGreaterThan(0);

			await withSuppressedSlothletErrorOutput(async () => {
				await expect(api.destroy()).rejects.toMatchObject({ code: "ROUTINE_FAILED" });
			});

			// Teardown must have completed despite the deferred rethrow.
			expect(Object.keys(api)).toHaveLength(0);
		});
	});

	describe("order: mount vs. depth", () => {
		// A mount path's OWN depth (segment count) drives "depth" order, independent of recursive
		// matching — mounting auth2 two segments deep (["auth", "admin"]) while auth1 mounts only one
		// segment deep (["billing"]) gives a clean, unambiguous contrast: mount order is simply
		// "whichever was add()-ed first" (auth1, then auth2), while depth order puts the
		// deeper-mounted auth2 first regardless of mount sequence.
		it('order: "depth" (the mode: "shutdown" default) runs the deeper-mounted contributor first, regardless of mount sequence', async () => {
			const api = await slothlet({
				dir: TEST_DIRS.API_TEST_ROUTINES,
				mode,
				routines: [{ name: "shutdown", mode: "shutdown", order: "depth" }],
				autoRoutines: true,
				silent: true
			});
			await api.slothlet.api.add(["billing"], TEST_DIRS.API_TEST_ROUTINES_AUTH1); // mounted 1st, shallower (billing.shutdown)
			await api.slothlet.api.add(["auth", "admin"], TEST_DIRS.API_TEST_ROUTINES_AUTH2); // mounted 2nd, deeper (auth.admin.shutdown)

			globalThis.__slothletRoutineLog = [];
			await api.shutdown();
			expect(globalThis.__slothletRoutineLog).toEqual(["auth2:shutdown", "auth1:shutdown"]);
		});

		it('order: "mount" runs contributors in mount sequence regardless of relative depth', async () => {
			const api = await slothlet({
				dir: TEST_DIRS.API_TEST_ROUTINES,
				mode,
				routines: [{ name: "shutdown", mode: "shutdown", order: "mount" }],
				autoRoutines: true,
				silent: true
			});
			await api.slothlet.api.add(["billing"], TEST_DIRS.API_TEST_ROUTINES_AUTH1); // mounted 1st, shallower
			await api.slothlet.api.add(["auth", "admin"], TEST_DIRS.API_TEST_ROUTINES_AUTH2); // mounted 2nd, deeper

			globalThis.__slothletRoutineLog = [];
			await api.shutdown();
			// Opposite order from the "depth" test above — same two contributors, same mount
			// sequence, only the routine's `order` differs.
			expect(globalThis.__slothletRoutineLog).toEqual(["auth1:shutdown", "auth2:shutdown"]);
		});

		it('mode: "startup" defaults to order: "mount" (registration order), not depth', async () => {
			const api = await slothlet({
				dir: TEST_DIRS.API_TEST_ROUTINES,
				mode,
				routines: [{ name: "initialize", mode: "startup" }],
				autoRoutines: true,
				silent: true
			});
			try {
				// The startup cascade already ran once at compose end (root:initialize only, nothing
				// else mounted yet) — mount two contributors at different depths, then re-run the
				// cascade manually to observe order among them.
				await api.slothlet.api.add(["billing"], TEST_DIRS.API_TEST_ROUTINES_AUTH1); // shallower
				await api.slothlet.api.add(["auth", "admin"], TEST_DIRS.API_TEST_ROUTINES_AUTH2); // deeper

				globalThis.__slothletRoutineLog = [];
				await api.slothlet.initialize();
				// root:initialize (the base compose's own contributor) first, then mount order
				// (auth1 before auth2, not depth order) — a "startup" routine defaults to "mount",
				// the opposite default from "shutdown".
				expect(globalThis.__slothletRoutineLog).toEqual(["root:initialize", "auth1:initialize", "auth2:initialize"]);
			} finally {
				await api.slothlet.shutdown();
			}
		});
	});

	describe("mode: manual", () => {
		it("never auto-runs at compose end or on dispose; only an explicit call runs it", async () => {
			const api = await slothlet({
				dir: TEST_DIRS.API_TEST_ROUTINES_MANUAL,
				mode,
				routines: ["launch"],
				autoRoutines: true,
				silent: true
			});
			try {
				expect(globalThis.__slothletRoutineLog).toEqual([]);
				await api.launch();
				expect(globalThis.__slothletRoutineLog).toEqual(["manual:launch"]);
			} finally {
				globalThis.__slothletRoutineLog = [];
				await api.slothlet.shutdown();
				// "launch" isn't a shutdown-mode routine — dispose must not have run it again.
				expect(globalThis.__slothletRoutineLog).toEqual([]);
			}
		});
	});

	describe("internal state hygiene", () => {
		it("reset() also clears the compiled-pattern cache, not just captured contributors", async () => {
			const api = await slothlet({
				dir: TEST_DIRS.API_TEST_ROUTINES,
				mode,
				routines: [{ name: "^ext.*.initialize", mode: "manual" }],
				silent: true
			});
			try {
				await api.slothlet["^ext.*.initialize"](); // compiles + caches the "ext.*.initialize" pattern
				const routineManager = resolveWrapper(api.ping).slothlet.handlers.routineManager;
				expect(routineManager.patternCache.size).toBe(1);

				routineManager.reset();
				expect(routineManager.patternCache.size).toBe(0);
			} finally {
				await api.slothlet.shutdown();
			}
		});

		it("onImplCreated removes a stale raw contribution when the same path's impl later changes to a non-function", async () => {
			const api = await slothlet({
				dir: TEST_DIRS.API_TEST_ROUTINES,
				mode,
				routines: [{ name: "^stale.initialize" }],
				silent: true
			});
			try {
				const routineManager = resolveWrapper(api.ping).slothlet.handlers.routineManager;
				const hasEntry = () => routineManager.raw.some((e) => e.apiPath === "stale.initialize" && e.moduleID === "mod1");

				routineManager.onImplCreated({ apiPath: "stale.initialize", moduleID: "mod1", wrapper: { __impl: function initialize() {} } });
				expect(hasEntry()).toBe(true);

				// A later impl:changed for the SAME (apiPath, moduleID) whose impl is no longer a
				// function — e.g. a direct reassignment to a plain object — must drop the earlier
				// capture, not leave a stale function contribution a cascade could still invoke.
				routineManager.onImplCreated({ apiPath: "stale.initialize", moduleID: "mod1", wrapper: { __impl: {} } });
				expect(hasEntry()).toBe(false);
			} finally {
				await api.slothlet.shutdown();
			}
		});
	});

	describe("error propagation (best-effort, aggregated)", () => {
		it("a throwing contributor does not block a LATER contributor from still running (best-effort, not fail-fast)", async () => {
			const api = await slothlet({ dir: TEST_DIRS.API_TEST_ROUTINES, mode, silent: true });
			try {
				await api.slothlet.api.add(["ns"], TEST_DIRS.API_TEST_ROUTINES_GOOD); // runs, succeeds
				await api.slothlet.api.add(["ns"], TEST_DIRS.API_TEST_ROUTINES_BAD); // runs, throws
				await api.slothlet.api.add(["ns"], TEST_DIRS.API_TEST_ROUTINES_AUTH1); // must STILL run despite bad's failure

				globalThis.__slothletRoutineLog = [];
				await withSuppressedSlothletErrorOutput(async () => {
					await expect(api.ns.initialize()).rejects.toMatchObject({
						code: "ROUTINE_FAILED",
						name: "SlothletError",
						context: { apiPath: "ns.initialize", moduleID: expect.any(String), count: 1 }
					});
				});
				// "good" ran before the failure, and — the actual point of best-effort — "auth1" ran
				// AFTER it despite "bad" throwing in between. A fail-fast chain would have stopped
				// after "bad" and never reached "auth1:initialize" at all.
				expect(globalThis.__slothletRoutineLog).toEqual(["good", "auth1:initialize"]);
			} finally {
				await api.slothlet.shutdown();
			}
		});

		it("aggregates every failure across multiple failing contributors, not just the first", async () => {
			const api = await slothlet({ dir: TEST_DIRS.API_TEST_ROUTINES, mode, silent: true });
			try {
				await api.slothlet.api.add(["ns2"], TEST_DIRS.API_TEST_ROUTINES_BAD);
				await api.slothlet.api.add(["billing"], TEST_DIRS.API_TEST_ROUTINES_BAD);

				await withSuppressedSlothletErrorOutput(async () => {
					await expect(api.slothlet.initialize()).rejects.toMatchObject({
						code: "ROUTINE_FAILED",
						context: {
							count: 2,
							failures: [{ apiPath: "ns2.initialize" }, { apiPath: "billing.initialize" }]
						}
					});
				});
			} finally {
				await api.slothlet.shutdown();
			}
		});
	});

	describe("collectLifecycleHooks interaction", () => {
		it("collectLifecycleHooks: true does not double-invoke a routine-stack contributor sharing the shutdown name", async () => {
			const api = await slothlet({ dir: TEST_DIRS.API_TEST_ROUTINES, mode, collectLifecycleHooks: true, silent: true });
			await api.slothlet.api.add(["auth"], TEST_DIRS.API_TEST_ROUTINES_AUTH1);
			await api.slothlet.api.add(["auth"], TEST_DIRS.API_TEST_ROUTINES_AUTH2);

			globalThis.__slothletRoutineLog = [];
			await api.shutdown();

			// Each contributor must appear exactly once — collectLifecycleHooks' tree walk must skip the
			// branded stacked callable rather than invoking it a second time on top of the routine cascade.
			// collectLifecycleHooks: true also implies autoRoutines (deprecated alias) — see config.mjs.
			expect(globalThis.__slothletRoutineLog.filter((entry) => entry === "auth1:shutdown")).toHaveLength(1);
			expect(globalThis.__slothletRoutineLog.filter((entry) => entry === "auth2:shutdown")).toHaveLength(1);
		});

		it("recursive: true does not double-invoke either, even though collectLifecycleHooks' own walk finds the same literally-named leaves independently", async () => {
			// collectLifecycleHooks' walk is itself effectively "recursive, root-anchored, whole-tree"
			// for the literal name "shutdown" — this is the overlap case the non-recursive test above
			// does not exercise: a `recursive: true` mount-relative routine searches WITHIN one mount's
			// subtree, which is exactly where collectLifecycleHooks' own walk would also look.
			const api = await slothlet({
				dir: TEST_DIRS.API_TEST_ROUTINES,
				mode,
				routines: [{ name: "shutdown", mode: "shutdown", recursive: true }],
				collectLifecycleHooks: true,
				silent: true
			});
			await api.slothlet.api.add(["auth"], TEST_DIRS.API_TEST_ROUTINES_NESTED);

			globalThis.__slothletRoutineLog = [];
			await api.shutdown();

			expect(globalThis.__slothletRoutineLog.filter((entry) => entry === "nested:top:shutdown")).toHaveLength(1);
			expect(globalThis.__slothletRoutineLog.filter((entry) => entry === "nested:admin:shutdown")).toHaveLength(1);
		});
	});
});
